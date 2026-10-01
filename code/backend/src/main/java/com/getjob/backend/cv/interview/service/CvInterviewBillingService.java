package com.getjob.backend.cv.interview.service;

import com.getjob.backend.candidate.domain.CandidateEntity;
import com.getjob.backend.candidate.repository.CandidateRepository;
import com.getjob.backend.cv.interview.domain.CvInterviewSessionEntity;
import com.getjob.backend.cv.interview.dto.HeartbeatDto;
import com.getjob.backend.cv.interview.repository.CvInterviewSessionRepository;
import com.getjob.backend.cv.service.CvDraftValidator;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

import com.getjob.backend.cv.repository.CvRepository;

/**
 * Service d'autorité temporelle et de facturation en direct des sessions Gemini Live.
 * Le backend mesure la durée réelle de l'appel et débite 1 crédit par minute entamée.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class CvInterviewBillingService {

    private final CandidateRepository candidateRepository;
    private final CvInterviewSessionRepository sessionRepository;
    private final CvRepository cvRepository;
    private final CvDraftValidator cvDraftValidator;

    @Data
    @Builder
    public static class LiveSessionState {
        private String sessionId;
        private Integer candidateId;
        private Long cvId;
        private Instant startedAt;
        private Instant lastHeartbeatAt;
        private int initialCredits;
        private long maxAllowedSeconds;
        @Builder.Default
        private AtomicBoolean terminated = new AtomicBoolean(false);
    }

    // Registre mémoire des sessions actives : sessionId -> LiveSessionState
    private final ConcurrentHashMap<String, LiveSessionState> activeSessions = new ConcurrentHashMap<>();

    /**
     * Démarre le compteur de facturation backend pour une session live.
     */
    @Transactional
    public LiveSessionState startSession(String sessionId, Long cvId, CandidateEntity candidate) {
        int credits = candidate.getProCredits() != null ? candidate.getProCredits() : 0;
        if (credits < 1) {
            throw new ResponseStatusException(
                    HttpStatus.PAYMENT_REQUIRED,
                    "INSUFFICIENT_CREDITS:L'accès à l'entretien vocal IA requiert au moins 1 crédit (1 minute). Veuillez recharger votre compte."
            );
        }

        Instant now = Instant.now();
        long maxSeconds = credits * 60L;

        LiveSessionState state = LiveSessionState.builder()
                .sessionId(sessionId)
                .candidateId(candidate.getId())
                .cvId(cvId)
                .startedAt(now)
                .lastHeartbeatAt(now)
                .initialCredits(credits)
                .maxAllowedSeconds(maxSeconds)
                .build();

        activeSessions.put(sessionId, state);

        // Mettre à jour l'entité si elle existe déjà
        sessionRepository.findById(sessionId).ifPresent(s -> {
            s.setStartedAt(now);
            s.setLastHeartbeatAt(now);
            s.setInterviewStatus("ACTIVE");
            sessionRepository.save(s);
        });

        log.info("[LiveBilling] Session démarrée : sessionId={}, candidateId={}, solde={} crédits (max {}s)",
                sessionId, candidate.getId(), credits, maxSeconds);
        return state;
    }

    /**
     * Traite un battement de cœur (heartbeat) régulier envoyé par le client.
     */
    @Transactional
    public HeartbeatDto.Response recordHeartbeat(String sessionId, CandidateEntity candidate) {
        LiveSessionState state = activeSessions.get(sessionId);
        if (state == null) {
            // Tenter de restaurer la session depuis la base de données
            CvInterviewSessionEntity entity = sessionRepository.findById(sessionId).orElse(null);
            if (entity != null && "ACTIVE".equalsIgnoreCase(entity.getInterviewStatus())) {
                state = restoreStateFromEntity(entity, candidate);
            }
        }

        if (state == null || state.getTerminated().get()) {
            return HeartbeatDto.Response.builder()
                    .sessionId(sessionId)
                    .status("EXPIRED")
                    .elapsedSeconds(0)
                    .remainingSeconds(0)
                    .remainingCredits(0)
                    .message("Session inactive ou déjà clôturée.")
                    .build();
        }

        Instant now = Instant.now();
        state.setLastHeartbeatAt(now);

        long elapsedSeconds = Duration.between(state.getStartedAt(), now).getSeconds();

        // Vérification de dépassement de plafond de crédit
        if (elapsedSeconds >= state.getMaxAllowedSeconds()) {
            terminateAndBill(sessionId, "CREDIT_LIMIT_REACHED");
            return HeartbeatDto.Response.builder()
                    .sessionId(sessionId)
                    .status("EXPIRED")
                    .elapsedSeconds(elapsedSeconds)
                    .remainingSeconds(0)
                    .remainingCredits(0)
                    .message("Solde de crédits épuisé.")
                    .build();
        }

        long remainingSeconds = Math.max(0, state.getMaxAllowedSeconds() - elapsedSeconds);
        int remainingCredits = (int) Math.ceil((double) remainingSeconds / 60.0);

        return HeartbeatDto.Response.builder()
                .sessionId(sessionId)
                .status("ACTIVE")
                .elapsedSeconds(elapsedSeconds)
                .remainingSeconds(remainingSeconds)
                .remainingCredits(remainingCredits)
                .message("Session active.")
                .build();
    }

    /**
     * Clôture la session et facture au temps réel consommé (1 crédit / minute entamée).
     */
    @Transactional
    public void terminateAndBill(String sessionId, String reason) {
        LiveSessionState state = activeSessions.get(sessionId);
        if (state == null) {
            // Vérifier en base
            sessionRepository.findById(sessionId).ifPresent(s -> {
                if ("ACTIVE".equalsIgnoreCase(s.getInterviewStatus()) && s.getStartedAt() != null) {
                    billEntityDirectly(s, reason);
                }
            });
            return;
        }

        if (!state.getTerminated().compareAndSet(false, true)) {
            // Déjà terminé de manière concurrente
            return;
        }

        activeSessions.remove(sessionId);

        Instant now = Instant.now();
        long rawElapsed = Duration.between(state.getStartedAt(), now).getSeconds();
        long elapsedSeconds = Math.max(0, Math.min(rawElapsed, state.getMaxAllowedSeconds()));

        final int creditsToBill;
        if ("AI_UNAVAILABLE".equals(reason) || elapsedSeconds < 5) {
            // Faux départ / fermeture immédiate sans échange
            creditsToBill = 0;
            log.info("[LiveBilling] Session {} fermée en moins de 5s ({}s) : aucun crédit débité.", sessionId, elapsedSeconds);
        } else {
            // 1 crédit par minute (60s) entamée
            int calculated = (int) Math.ceil((double) elapsedSeconds / 60.0);
            creditsToBill = Math.min(state.getInitialCredits(), Math.max(1, calculated));
        }

        // Débit atomique du candidat directement en base (anti-race condition)
        if (creditsToBill > 0) {
            candidateRepository.debitProCreditsBounded(state.getCandidateId(), creditsToBill);
            int newBalance = candidateRepository.findById(state.getCandidateId())
                    .map(c -> c.getProCredits() != null ? c.getProCredits() : 0).orElse(0);
            log.info("[LiveBilling] Candidat id={} débité de {} crédit(s) (durée={}s, raison={}). Nouveau solde={}",
                    state.getCandidateId(), creditsToBill, elapsedSeconds, reason, newBalance);
        }

        // Persistance des métriques de session
        sessionRepository.findById(sessionId).ifPresent(s -> {
            s.setEndedAt(now);
            s.setDurationSeconds(elapsedSeconds);
            s.setBilledCredits(creditsToBill);
            s.setTerminationReason(reason);
            s.setInterviewStatus("COMPLETED".equalsIgnoreCase(reason) ? "COMPLETED"
                    : "USER_STOPPED".equalsIgnoreCase(s.getInterviewStatus()) ? "USER_STOPPED"
                    : "TEMPORARILY_UNAVAILABLE");
            sessionRepository.save(s);
            syncCvOnSessionEnd(s);
        });
    }

    private LiveSessionState restoreStateFromEntity(CvInterviewSessionEntity entity, CandidateEntity candidate) {
        Instant started = entity.getStartedAt() != null ? entity.getStartedAt() : entity.getCreatedAt();
        if (started == null) started = Instant.now();

        int credits = candidate.getProCredits() != null ? candidate.getProCredits() : 0;
        LiveSessionState state = LiveSessionState.builder()
                .sessionId(entity.getId())
                .candidateId(candidate.getId())
                .cvId(entity.getCvId())
                .startedAt(started)
                .lastHeartbeatAt(Instant.now())
                .initialCredits(credits)
                .maxAllowedSeconds(credits * 60L)
                .build();
        activeSessions.put(entity.getId(), state);
        return state;
    }

    @Transactional
    public void billEntityDirectly(CvInterviewSessionEntity s, String reason) {
        Instant now = Instant.now();
        Instant started = s.getStartedAt() != null ? s.getStartedAt() : Instant.now();
        long elapsedSeconds = Math.max(0, Duration.between(started, now).getSeconds());
        int creditsToBill = elapsedSeconds < 5 ? 0 : (int) Math.ceil((double) elapsedSeconds / 60.0);

        if (creditsToBill > 0) {
            candidateRepository.debitProCreditsBounded(s.getCandidateId(), creditsToBill);
        }

        s.setEndedAt(now);
        s.setDurationSeconds(elapsedSeconds);
        s.setBilledCredits(creditsToBill);
        s.setTerminationReason(reason);
        s.setInterviewStatus("TEMPORARILY_UNAVAILABLE");
        sessionRepository.save(s);
        syncCvOnSessionEnd(s);
    }

    /**
     * Sauvegarde de sécurité absolue : garantit que le CV conserve toutes les données partielles
     * collectées lors de l'entretien, même si la session s'interrompt par timeout ou épuisement de crédits.
     */
    private void syncCvOnSessionEnd(CvInterviewSessionEntity s) {
        if (s == null || s.getCvId() == null) return;
        try {
            cvRepository.findById(s.getCvId()).ifPresent(cv -> {
                if (s.getCvDataSoFar() != null && s.getCvDataSoFar().trim().length() > 20) {
                    cv.setContentJson(s.getCvDataSoFar());
                }
                if ("DRAFT".equalsIgnoreCase(cv.getStatus())
                        && cvDraftValidator.isDraftMeaningful(cv.getContentJson())) {
                    cv.setStatus("DRAFT_READY");
                }
                if (!"COMPLETED".equalsIgnoreCase(s.getInterviewStatus())
                        && !"REVIEW".equalsIgnoreCase(cv.getInterviewStatus())) {
                    cv.setInterviewStatus("DRAFT_UPDATED");
                } else if ("IN_PROGRESS".equalsIgnoreCase(cv.getInterviewStatus())) {
                    cv.setInterviewStatus("COMPLETED");
                }
                cvRepository.save(cv);
                log.info("[LiveBilling] Données partielles du CV id={} préservées avec succès à la clôture de session.", cv.getId());
            });
        } catch (Exception e) {
            log.warn("[LiveBilling] Sauvegarde partielle du CV id={} non bloquante : {}", s.getCvId(), e.getMessage());
        }
    }

    /**
     * Nettoyage automatique en arrière-plan toutes les 30 secondes des sessions orphelines.
     * Si aucun heartbeat n'a été reçu depuis plus de 90 secondes, la session est clôturée et facturée.
     * Traite à la fois les sessions en mémoire active et les sessions orphelines persistées en DB.
     */
    @Scheduled(fixedDelay = 30000)
    @Transactional
    public void cleanupOrphanSessions() {
        Instant threshold = Instant.now().minus(Duration.ofSeconds(90));

        // 1. Nettoyage mémoire
        activeSessions.forEach((sessionId, state) -> {
            try {
                if (state.getLastHeartbeatAt().isBefore(threshold)) {
                    log.warn("[LiveBilling] Session orpheline détectée (mémoire, aucun heartbeat > 90s) : sessionId={}. Clôture et facturation...", sessionId);
                    terminateAndBill(sessionId, "HEARTBEAT_TIMEOUT");
                }
            } catch (Exception e) {
                log.error("[LiveBilling] Erreur lors de la clôture orpheline mémoire sessionId={}: {}", sessionId, e.getMessage(), e);
            }
        });

        // 2. Nettoyage résilient en base (ex: après crash/redémarrage du serveur)
        try {
            java.util.List<CvInterviewSessionEntity> orphanDbSessions =
                    sessionRepository.findByInterviewStatusAndLastHeartbeatAtBefore("ACTIVE", threshold);
            for (CvInterviewSessionEntity orphan : orphanDbSessions) {
                if (!activeSessions.containsKey(orphan.getId())) {
                    log.warn("[LiveBilling] Session orpheline DB détectée (après redémarrage/crash) : sessionId={}. Clôture...", orphan.getId());
                    try {
                        billEntityDirectly(orphan, "ORPHAN_TIMEOUT");
                    } catch (Exception e) {
                        log.error("[LiveBilling] Erreur lors de la clôture orpheline DB sessionId={}: {}", orphan.getId(), e.getMessage(), e);
                    }
                }
            }
        } catch (Exception e) {
            log.debug("[LiveBilling] Erreur vérification sessions orphelines DB: {}", e.getMessage());
        }
    }
}
