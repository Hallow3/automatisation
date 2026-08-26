package com.getjob.backend.ai.service;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

/**
 * Service de création de tokens éphémères Gemini Live.
 *
 * Pool de clés API :
 *   — Lit GEMINI_API_KEYS (liste séparée par virgule) ou GEMINI_API_KEY (singulier).
 *   — Rotation round-robin entre les clés disponibles.
 *   — Failover automatique : si une clé échoue (429, 403, quota), on passe à la suivante.
 *   — Si toutes les clés échouent, on lève une erreur claire (jamais de mode simulé).
 *
 * Sécurité :
 *   — Les clés API ne quittent JAMAIS ce service.
 *   — Le frontend reçoit uniquement le token éphémère (format "auth_tokens/xxx").
 *   — Les logs indiquent l'index de la clé, jamais sa valeur.
 */
@Service
@Slf4j
public class GeminiLiveTokenService {

    /**
     * Liste de clés séparées par virgule.
     * Exemple : GEMINI_API_KEYS=AQ.key1,AQ.key2,AQ.key3
     */
    @Value("${gemini.api-keys}")
    private String geminiApiKeysRaw;

    /**
     * Fallback rétrocompatible : ancienne variable singulière.
     * Ignorée si gemini.api-keys est renseigné.
     */
    @Value("${gemini.api-key}")
    private String geminiApiKeySingle;

    @Value("${gemini.live.model:gemini-2.0-flash-live-001}")
    private String geminiModel;

    /** Liste effective des clés valides chargées au démarrage. */
    private List<String> apiKeys = new ArrayList<>();

    /** Index courant pour la rotation round-robin (thread-safe). */
    private final AtomicInteger currentKeyIndex = new AtomicInteger(0);

    @PostConstruct
    public void init() {
        // Priorité : gemini.api-keys > gemini.api-key
        String raw = (geminiApiKeysRaw != null && !geminiApiKeysRaw.isBlank())
                ? geminiApiKeysRaw
                : geminiApiKeySingle;

        if (raw != null && !raw.isBlank()) {
            this.apiKeys = Arrays.stream(raw.split(","))
                    .map(String::trim)
                    .filter(k -> !k.isBlank())
                    .collect(Collectors.toList());
        }

        if (this.apiKeys.isEmpty()) {
            log.warn("Gemini : aucune clé API configurée (GEMINI_API_KEYS / GEMINI_API_KEY). " +
                     "Les sessions vocales retourneront une erreur.");
        } else {
            log.info("Gemini : {} clé(s) API chargée(s). Rotation round-robin activée.", this.apiKeys.size());
        }
    }

    /**
     * Crée un token éphémère Gemini Live.
     *
     * Tente chaque clé du pool dans l'ordre (à partir de la clé courante).
     * En cas d'échec sur une clé (429, 403, quota), passe à la suivante.
     * Si toutes les clés échouent, lève une ResponseStatusException 503.
     */
    public Map<String, String> createEphemeralToken() {
        if (apiKeys.isEmpty()) {
            log.error("Gemini : aucune clé API disponible.");
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Service vocal indisponible : aucune clé API configurée."
            );
        }

        int total = apiKeys.size();
        int startIndex = currentKeyIndex.get() % total;

        for (int attempt = 0; attempt < total; attempt++) {
            int idx = (startIndex + attempt) % total;
            String key = apiKeys.get(idx);

            try {
                Map<String, String> result = callGeminiAuthTokens(key, idx);
                // Succès : on avance l'index pour la prochaine requête (round-robin)
                currentKeyIndex.set((idx + 1) % total);
                return result;
            } catch (KeyFailedException e) {
                log.warn("Gemini : clé [{}] a échoué ({}) — essai suivant.", idx, e.getReason());
                // On continue avec la clé suivante
            }
        }

        // Toutes les clés ont échoué
        log.error("Gemini : toutes les {} clé(s) ont échoué.", total);
        throw new ResponseStatusException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "Service vocal temporairement indisponible. Veuillez réessayer dans quelques instants."
        );
    }

    public String getModel() {
        return geminiModel;
    }

    public int getKeyCount() {
        return apiKeys.size();
    }

    /**
     * Génère une réponse structurée (JSON) via Gemini 2.0 Flash avec rotation de clés et failover.
     */
    public String generateStructuredContent(String systemInstruction, String userPrompt) {
        if (apiKeys.isEmpty()) {
            log.error("Gemini : aucune clé API disponible pour la génération de contenu.");
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Service IA indisponible : aucune clé API configurée."
            );
        }

        int total = apiKeys.size();
        int startIndex = currentKeyIndex.get() % total;

        for (int attempt = 0; attempt < total; attempt++) {
            int idx = (startIndex + attempt) % total;
            String key = apiKeys.get(idx);

            try {
                String result = callGeminiGenerateContent(key, idx, systemInstruction, userPrompt);
                currentKeyIndex.set((idx + 1) % total);
                return result;
            } catch (KeyFailedException e) {
                log.warn("Gemini : clé [{}] a échoué ({}) lors de la génération — essai suivant.", idx, e.getReason());
            }
        }

        log.error("Gemini : toutes les {} clé(s) ont échoué lors de la génération.", total);
        throw new ResponseStatusException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "Service IA temporairement indisponible. Veuillez réessayer."
        );
    }

    private String callGeminiGenerateContent(String apiKey, int keyIndex, String systemInstruction, String userPrompt) {
        try {
            RestTemplate restTemplate = new RestTemplate();
            String url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + apiKey;

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            Map<String, Object> body = new HashMap<>();
            if (systemInstruction != null && !systemInstruction.isBlank()) {
                body.put("systemInstruction", Map.of("parts", List.of(Map.of("text", systemInstruction))));
            }
            body.put("contents", List.of(
                    Map.of("role", "user", "parts", List.of(Map.of("text", userPrompt)))
            ));
            body.put("generationConfig", Map.of(
                    "responseMimeType", "application/json",
                    "temperature", 0.2
            ));

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.postForObject(url, request, Map.class);

            if (response != null && response.get("candidates") instanceof List<?> candidates && !candidates.isEmpty()) {
                Object firstCandidate = candidates.get(0);
                if (firstCandidate instanceof Map<?, ?> candMap) {
                    Object content = candMap.get("content");
                    if (content instanceof Map<?, ?> contentMap) {
                        Object parts = contentMap.get("parts");
                        if (parts instanceof List<?> partsList && !partsList.isEmpty()) {
                            Object firstPart = partsList.get(0);
                            if (firstPart instanceof Map<?, ?> partMap) {
                                Object text = partMap.get("text");
                                if (text instanceof String s && !s.isBlank()) {
                                    return s;
                                }
                            }
                        }
                    }
                }
            }

            throw new KeyFailedException("réponse vide ou invalide");
        } catch (HttpClientErrorException e) {
            int status = e.getStatusCode().value();
            if (status == 400) {
                log.error("Gemini : requête invalide (400) : {}", e.getResponseBodyAsString());
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Requête IA invalide.");
            }
            throw new KeyFailedException("HTTP " + status);
        } catch (KeyFailedException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Gemini generateContent : erreur inattendue clé [{}] : {}", keyIndex, e.getMessage());
            throw new KeyFailedException("exception: " + e.getMessage());
        }
    }

    /**
     * Analyse un document (PDF, PNG, JPG) via Gemini multimodal avec rotation de clés et extraction JSON.
     */
    public String generateStructuredContentFromDocument(String systemInstruction, String userPrompt, byte[] documentBytes, String mimeType) {
        if (apiKeys.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Service IA indisponible : aucune clé API configurée.");
        }

        int total = apiKeys.size();
        int startIndex = currentKeyIndex.get() % total;
        String base64Data = Base64.getEncoder().encodeToString(documentBytes);

        for (int attempt = 0; attempt < total; attempt++) {
            int idx = (startIndex + attempt) % total;
            String key = apiKeys.get(idx);

            try {
                String result = callGeminiGenerateDocumentContent(key, idx, systemInstruction, userPrompt, base64Data, mimeType);
                currentKeyIndex.set((idx + 1) % total);
                return result;
            } catch (KeyFailedException e) {
                log.warn("Gemini Document : clé [{}] a échoué ({}) — essai suivant.", idx, e.getReason());
            }
        }

        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Analyse du document temporairement indisponible.");
    }

    private String callGeminiGenerateDocumentContent(String apiKey, int keyIndex, String systemInstruction, String userPrompt, String base64Data, String mimeType) {
        try {
            RestTemplate restTemplate = new RestTemplate();
            String url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + apiKey;

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            Map<String, Object> body = new HashMap<>();
            if (systemInstruction != null && !systemInstruction.isBlank()) {
                body.put("systemInstruction", Map.of("parts", List.of(Map.of("text", systemInstruction))));
            }

            Map<String, Object> inlineData = Map.of(
                    "mimeType", mimeType != null ? mimeType : "application/pdf",
                    "data", base64Data
            );

            body.put("contents", List.of(
                    Map.of("role", "user", "parts", List.of(
                            Map.of("inlineData", inlineData),
                            Map.of("text", userPrompt != null ? userPrompt : "Extrais l'intégralité du contenu de ce CV.")
                    ))
            ));
            body.put("generationConfig", Map.of(
                    "responseMimeType", "application/json",
                    "temperature", 0.1
            ));

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.postForObject(url, request, Map.class);

            if (response != null && response.get("candidates") instanceof List<?> candidates && !candidates.isEmpty()) {
                Object firstCandidate = candidates.get(0);
                if (firstCandidate instanceof Map<?, ?> candMap) {
                    Object content = candMap.get("content");
                    if (content instanceof Map<?, ?> contentMap) {
                        Object parts = contentMap.get("parts");
                        if (parts instanceof List<?> partsList && !partsList.isEmpty()) {
                            Object firstPart = partsList.get(0);
                            if (firstPart instanceof Map<?, ?> partMap) {
                                Object text = partMap.get("text");
                                if (text instanceof String s && !s.isBlank()) {
                                    return s;
                                }
                            }
                        }
                    }
                }
            }

            throw new KeyFailedException("réponse vide du document");
        } catch (HttpClientErrorException e) {
            int status = e.getStatusCode().value();
            if (status == 400) {
                log.error("Gemini Document (400) : {}", e.getResponseBodyAsString());
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Format de document ou requête non supporté.");
            }
            throw new KeyFailedException("HTTP " + status);
        } catch (KeyFailedException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Gemini Document : exception clé [{}] : {}", keyIndex, e.getMessage());
            throw new KeyFailedException("exception: " + e.getMessage());
        }
    }

    // ── Appel HTTP vers Gemini auth_tokens ───────────────────────────────────

    private Map<String, String> callGeminiAuthTokens(String apiKey, int keyIndex) {
        log.info("Gemini : tentative de création token avec clé [{}] (modèle: {})", keyIndex, geminiModel);

        try {
            RestTemplate restTemplate = new RestTemplate();
            String url = "https://generativelanguage.googleapis.com/v1beta/auth_tokens";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            // La clé API reste dans le header HTTP côté serveur — jamais transmise au client
            headers.set("x-goog-api-key", apiKey);

            Instant now = Instant.now();
            Map<String, Object> body = new HashMap<>();
            body.put("uses", 1);
            body.put("expireTime", now.plus(Duration.ofMinutes(30)).toString());
            body.put("newSessionExpireTime", now.plus(Duration.ofMinutes(2)).toString());

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.postForObject(url, request, Map.class);

            if (response != null) {
                String token = extractToken(response);
                if (token != null && !token.isBlank()) {
                    log.info("Gemini : token généré avec clé [{}].", keyIndex);
                    Map<String, String> result = new HashMap<>();
                    result.put("token", token);
                    result.put("model", geminiModel);
                    return result;
                }
            }

            log.error("Gemini : clé [{}] — réponse vide ou token absent.", keyIndex);
            throw new KeyFailedException("réponse vide");

        } catch (HttpClientErrorException e) {
            int status = e.getStatusCode().value();
            log.warn("Gemini : clé [{}] — HTTP {} ({})", keyIndex, status, e.getStatusText());
            // 429 = rate limit, 403 = quota/permission → failover vers clé suivante
            // 400 = requête malformée → inutile d'essayer les autres clés
            if (status == 400) {
                log.error("Gemini : erreur 400 sur clé [{}] — requête invalide : {}", keyIndex, e.getResponseBodyAsString());
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Configuration Gemini incorrecte. Contactez le support."
                );
            }
            throw new KeyFailedException("HTTP " + status);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (KeyFailedException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Gemini : clé [{}] — erreur inattendue : {}", keyIndex, e.getMessage());
            throw new KeyFailedException("exception: " + e.getMessage());
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private String extractToken(Map<String, Object> response) {
        if (response.get("name") instanceof String s && !s.isBlank()) return s;
        if (response.get("token") instanceof String s && !s.isBlank()) return s;
        if (response.get("authToken") instanceof String s && !s.isBlank()) return s;
        return null;
    }

    /** Exception interne signalant qu'une clé a échoué → on tente la suivante. */
    private static class KeyFailedException extends RuntimeException {
        private final String reason;
        KeyFailedException(String reason) {
            super(reason);
            this.reason = reason;
        }
        String getReason() { return reason; }
    }
}
