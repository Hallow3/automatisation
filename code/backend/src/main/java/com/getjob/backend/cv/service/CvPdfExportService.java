package com.getjob.backend.cv.service;

import com.getjob.backend.candidate.domain.CandidateEntity;
import com.getjob.backend.cv.domain.CvEntity;
import com.getjob.backend.cv.repository.CvRepository;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.io.File;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.*;

/**
 * Service de génération PDF haute fidélité côté serveur via Chromium headless.
 * Architecture robuste (Canva / Novoresume / Zety).
 * 
 * Sécurité & Performances :
 * 1. Pool dédié borné & Sémaphore de concurrence (Max 2 Chromium simultanés, libération threads Tomcat).
 * 2. Validation & Encodage strict UTF-8 de tous les paramètres d'URL (Anti-injection).
 * 3. Contrôle strict d'accès (Anti-IDOR) — Export PDF 100% gratuit et sans contrainte de facturation.
 * 4. Système de jeton d'impression éphémère à usage unique (Print Token, TTL 60s) pour Chromium.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class CvPdfExportService {

    private final CvRepository cvRepository;

    @Value("${app.frontend-url:http://localhost:4200}")
    private String frontendUrl;

    /**
     * Limite de concurrence stricte pour protéger le processeur et la mémoire vive.
     * 2 instances Chromium simultanées au maximum.
     */
    private final Semaphore chromiumSemaphore = new Semaphore(2);

    /**
     * Pool de threads dédié pour ne jamais bloquer les threads de requêtes web Tomcat.
     */
    private final ExecutorService pdfThreadPool = Executors.newFixedThreadPool(2, new ThreadFactory() {
        private int count = 1;
        @Override
        public Thread newThread(Runnable r) {
            Thread t = new Thread(r, "cv-pdf-worker-" + (count++));
            t.setDaemon(true);
            return t;
        }
    });

    /**
     * Cache des jetons d'impression éphémères (TTL 60 secondes).
     */
    private final Map<String, PrintTokenRecord> printTokens = new ConcurrentHashMap<>();

    private record PrintTokenRecord(String cvId, Instant expiresAt) {}

    /**
     * Cache des tickets de téléchargement temporaires sécurisés pour les onglets utilisateurs (TTL 5 minutes).
     */
    private final Map<String, DownloadTicketRecord> downloadTickets = new ConcurrentHashMap<>();

    private record DownloadTicketRecord(String cvId, Integer candidateId, String template, Instant expiresAt) {}

    @PreDestroy
    public void cleanup() {
        pdfThreadPool.shutdown();
        try {
            if (!pdfThreadPool.awaitTermination(3, TimeUnit.SECONDS)) {
                pdfThreadPool.shutdownNow();
            }
        } catch (InterruptedException e) {
            pdfThreadPool.shutdownNow();
        }
    }

    /**
     * Vérification en amont du droit d'accès au CV (Anti-IDOR).
     * L'exportation PDF est 100% gratuite et sans contrainte de facturation.
     *
     * @param cvIdStr Identifiant du CV demandé
     * @param currentCandidate Candidat authentifié effectuant la requête
     * @return CvEntity vérifié (ou null pour le cas démo)
     */
    public CvEntity verifyAccessAndUnlock(String cvIdStr, CandidateEntity currentCandidate) {
        return verifyAccess(cvIdStr, currentCandidate);
    }

    /**
     * Vérifie la propriété du CV pour empêcher tout accès non autorisé (Anti-IDOR).
     * Aucun contrôle de paiement : l'export PDF est entièrement gratuit.
     */
    public CvEntity verifyAccess(String cvIdStr, CandidateEntity currentCandidate) {
        if (cvIdStr == null || cvIdStr.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Identifiant de CV requis.");
        }

        String cleanId = cvIdStr.replace("cv_", "").trim();

        if ("sample".equalsIgnoreCase(cleanId) || "demo".equalsIgnoreCase(cleanId)) {
            return null; // Démo autorisée sans contrôle
        }

        if (currentCandidate == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentification requise pour exporter ce CV.");
        }

        Long cvId;
        if ("latest".equalsIgnoreCase(cleanId)) {
            CvEntity latestCv = cvRepository.findByCandidateId(currentCandidate.getId())
                    .stream()
                    .max(java.util.Comparator.comparing(CvEntity::getId))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Aucun CV trouvé pour votre compte."));
            cvId = latestCv.getId();
        } else {
            try {
                cvId = Long.parseLong(cleanId);
            } catch (NumberFormatException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Format d'identifiant de CV invalide.");
            }
        }

        // Anti-IDOR : Le CV doit exister et appartenir au candidat connecté.
        // Export PDF 100% gratuit : aucun contrôle de paiement, de déverrouillage ou de solde.
        return cvRepository.findByIdAndCandidateId(cvId, currentCandidate.getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.FORBIDDEN,
                        "Accès refusé : ce CV n'existe pas ou n'appartient pas à votre compte."
                ));
    }

    /**
     * Génère un jeton d'impression éphémère sécurisé (valide 60 secondes).
     * Permet à Chromium headless de récupérer les données du CV en local sans cookie de session.
     */
    public String createEphemeralPrintToken(String cvId) {
        purgeExpiredTokens();
        String token = UUID.randomUUID().toString();
        printTokens.put(token, new PrintTokenRecord(cvId, Instant.now().plusSeconds(60)));
        return token;
    }

    /**
     * Valide et consomme un jeton d'impression éphémère.
     */
    public boolean validatePrintToken(String cvId, String token) {
        if (token == null || token.isBlank()) return false;
        PrintTokenRecord record = printTokens.get(token);
        if (record == null) return false;

        if (Instant.now().isAfter(record.expiresAt()) || !record.cvId().equalsIgnoreCase(cvId)) {
            printTokens.remove(token);
            return false;
        }

        return true;
    }

    private void purgeExpiredTokens() {
        Instant now = Instant.now();
        printTokens.entrySet().removeIf(entry -> now.isAfter(entry.getValue().expiresAt()));
    }

    /**
     * Crée un ticket de téléchargement temporaire (valide 5 minutes).
     * Permet à l'utilisateur d'ouvrir le lien dans un nouvel onglet sans exposer de session permanente.
     */
    public String createDownloadTicket(String targetCvId, Integer candidateId, String template) {
        purgeExpiredTickets();
        String token = UUID.randomUUID().toString();
        String safeTemplate = (template != null && template.matches("^[a-zA-Z0-9_-]+$")) ? template : "modern";
        downloadTickets.put(token, new DownloadTicketRecord(targetCvId, candidateId, safeTemplate, Instant.now().plusSeconds(300)));
        return token;
    }

    /**
     * Valide et consomme le ticket de téléchargement temporaire.
     * Retourne le template configuré si valide, ou null sinon.
     */
    public String validateAndConsumeDownloadTicket(String cvId, String token) {
        if (token == null || token.isBlank()) return null;
        purgeExpiredTickets();
        DownloadTicketRecord record = downloadTickets.get(token);
        if (record == null) return null;

        if (Instant.now().isAfter(record.expiresAt()) || !record.cvId().equalsIgnoreCase(cvId)) {
            downloadTickets.remove(token);
            return null;
        }

        String template = record.template();
        // Consommer le ticket après validation
        downloadTickets.remove(token);
        return template;
    }

    private void purgeExpiredTickets() {
        Instant now = Instant.now();
        downloadTickets.entrySet().removeIf(entry -> now.isAfter(entry.getValue().expiresAt()));
    }

    /**
     * Point 3 & 4 : Génération asynchrone non-bloquante avec contrôle de concurrence strict
     * et encodage systématique UTF-8 des paramètres d'URL.
     *
     * @param cvId     Identifiant du CV
     * @param template Nom du modèle de mise en page
     * @return Future résolue avec les octets du fichier PDF vectoriel A4
     */
    public CompletableFuture<byte[]> generateCvPdfAsync(String cvId, String template) {
        // Point 4 : Validation stricte des caractères
        if (!cvId.matches("^[a-zA-Z0-9_-]+$")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Identifiant de CV invalide.");
        }
        String safeTemplate = (template != null && template.matches("^[a-zA-Z0-9_-]+$")) ? template : "modern";

        // Jeton d'impression éphémère pour cette exécution
        String printToken = createEphemeralPrintToken(cvId);

        // Exécution non-bloquante sur le pool de threads dédié (libère le thread Tomcat immédiatement)
        return CompletableFuture.supplyAsync(() -> {
            boolean acquired = false;
            try {
                // Point 3 : Acquisition avec timeout sur le sémaphore de concurrence
                acquired = chromiumSemaphore.tryAcquire(5, TimeUnit.SECONDS);
                if (!acquired) {
                    log.warn("Capacité d'impression PDF saturée (2 slots occupés). Requête rejetée avec 429.");
                    throw new ResponseStatusException(
                            HttpStatus.TOO_MANY_REQUESTS,
                            "Le moteur de génération PDF est actuellement très sollicité. Veuillez réessayer dans quelques secondes."
                    );
                }
                return executeChromiumRender(cvId, safeTemplate, printToken);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Interruption lors de la file d'attente d'impression.");
            } finally {
                if (acquired) {
                    chromiumSemaphore.release();
                }
                printTokens.remove(printToken);
            }
        }, pdfThreadPool);
    }

    /**
     * Exécute le processus Chromium headless et produit le document PDF A4.
     */
    private byte[] executeChromiumRender(String cvId, String template, String printToken) {
        String cleanFrontendUrl = frontendUrl.replaceAll("/+$", "");

        // Point 4 : Encodage UTF-8 systématique des paramètres
        String encodedCvId = URLEncoder.encode(cvId.trim(), StandardCharsets.UTF_8);
        String encodedTemplate = URLEncoder.encode(template.trim(), StandardCharsets.UTF_8);
        String encodedToken = URLEncoder.encode(printToken.trim(), StandardCharsets.UTF_8);

        String printUrl = String.format("%s/print/cv/%s?template=%s&token=%s",
                cleanFrontendUrl,
                encodedCvId,
                encodedTemplate,
                encodedToken
        );

        String chromiumPath = findChromiumExecutable();
        if (chromiumPath == null) {
            log.error("Binaire Chromium (Chrome ou Edge) introuvable sur la machine hôte.");
            throw new IllegalStateException("Aucun moteur Chromium disponible sur le serveur.");
        }

        File tempPdf = null;
        try {
            tempPdf = File.createTempFile("cv_print_" + cvId + "_", ".pdf");

            List<String> command = new ArrayList<>();
            command.add(chromiumPath);
            command.add("--headless=new");
            command.add("--disable-gpu");
            command.add("--no-sandbox");
            command.add("--disable-dev-shm-usage");
            command.add("--no-pdf-header-footer");
            command.add("--run-all-compositor-stages-before-draw");
            command.add("--virtual-time-budget=4000");
            command.add("--print-to-pdf=" + tempPdf.getAbsolutePath());
            command.add(printUrl);

            log.info("Lancement Chromium headless : URL={}, Output={}", printUrl, tempPdf.getAbsolutePath());

            ProcessBuilder pb = new ProcessBuilder(command);
            pb.redirectErrorStream(true);
            Process process = pb.start();

            boolean completed = process.waitFor(25, TimeUnit.SECONDS);
            if (!completed) {
                process.destroyForcibly();
                throw new RuntimeException("Délai d'attente dépassé (25s) lors de la génération PDF.");
            }

            if (!tempPdf.exists() || tempPdf.length() == 0) {
                throw new RuntimeException("Le fichier PDF généré par Chromium est vide ou inexistant.");
            }

            log.info("Génération PDF Chromium réussie pour CV {} ({} octets)", cvId, tempPdf.length());
            return Files.readAllBytes(tempPdf.toPath());

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Génération PDF interrompue.", e);
        } catch (IOException e) {
            log.error("Erreur d'E/S Chromium", e);
            throw new RuntimeException("Erreur de génération PDF : " + e.getMessage(), e);
        } finally {
            if (tempPdf != null && tempPdf.exists()) {
                try {
                    Files.deleteIfExists(tempPdf.toPath());
                } catch (IOException ignored) {}
            }
        }
    }

    /**
     * Localise l'exécutable Chrome ou Edge sur Windows / Linux / macOS.
     */
    private String findChromiumExecutable() {
        String envChrome = System.getenv("CHROME_BIN");
        if (envChrome != null && new File(envChrome).exists()) return envChrome;

        String envChromium = System.getenv("CHROMIUM_BIN");
        if (envChromium != null && new File(envChromium).exists()) return envChromium;

        List<String> candidates = List.of(
                "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
                "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
                "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
                "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
                "/usr/bin/google-chrome",
                "/usr/bin/google-chrome-stable",
                "/usr/bin/chromium-browser",
                "/usr/bin/chromium"
        );

        for (String path : candidates) {
            if (new File(path).exists()) {
                return path;
            }
        }

        return null;
    }
}
