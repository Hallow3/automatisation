package com.getjob.backend.cv.interview.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.getjob.backend.cv.interview.domain.CvInterviewSessionEntity;
import com.getjob.backend.cv.interview.dto.SectionPatchDto;
import com.getjob.backend.cv.interview.repository.CvInterviewSessionRepository;
import com.getjob.backend.cv.repository.CvRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service de streaming CV en temps réel via SSE.
 * Gère les canaux SSE par session et orchestre l'appel streamGenerateContent
 * de Gemini pour patcher le CV au fil des tokens.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class CvInterviewStreamService {

    private final InterviewObserverService observerService;
    private final CvInterviewSessionRepository sessionRepository;
    private final CvRepository cvRepository;
    private final ObjectMapper objectMapper;
    private final PlatformTransactionManager transactionManager;

    // sessionId -> SseEmitter actif
    private final ConcurrentHashMap<String, SseEmitter> emitters = new ConcurrentHashMap<>();

    private static final long SSE_TIMEOUT_MS = 30 * 60 * 1000L;

    /**
     * Crée et enregistre un SseEmitter pour la session donnée.
     */
    public SseEmitter createEmitter(String sessionId) {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        SseEmitter previous = emitters.put(sessionId, emitter);
        if (previous != null) previous.complete();

        emitter.onCompletion(() -> {
            emitters.remove(sessionId, emitter);
            log.debug("[CvStream] SSE complété pour session={}", sessionId);
        });
        emitter.onTimeout(() -> {
            emitters.remove(sessionId, emitter);
            emitter.complete();
            log.debug("[CvStream] SSE timeout pour session={}", sessionId);
        });
        emitter.onError(e -> {
            emitters.remove(sessionId, emitter);
            log.debug("[CvStream] SSE erreur de transport pour session={}: {}", sessionId, e.getMessage());
        });

        // Envoi d'un événement d'initialisation immédiat pour confirmer la connexion
        try {
            emitter.send(SseEmitter.event().name("init").data(Map.of("status", "connected", "sessionId", sessionId)));
        } catch (Exception e) {
            log.warn("[CvStream] Impossible d'envoyer l'init SSE: {}", e.getMessage());
        }

        log.info("[CvStream] Emitter SSE créé pour session={}", sessionId);
        return emitter;
    }

    /**
     * Traite un segment de transcription de manière asynchrone.
     * La base est la source de vérité : le patch est persisté avant le push SSE.
     */
    @Async("cvStreamTaskExecutor")
    public void processSegmentAsync(String cvId, String sessionId, String userSegment) {
        SseEmitter emitter = emitters.get(sessionId);

        CvInterviewSessionEntity session = sessionRepository.findById(sessionId).orElse(null);
        if (session == null) {
            log.warn("[CvStream] Session introuvable : {}", sessionId);
            return;
        }

        String currentState = session.getCurrentState();
        int sectionIndex = session.getSectionIndex() != null ? session.getSectionIndex() : 0;
        Map<String, Object> currentPartial = parseJsonMap(session.getSectionPartialData());

        try {
            SectionPatchDto patchDto = observerService.observeSection(
                    currentState, sectionIndex, userSegment, currentPartial
            );

            if (patchDto.getPatch() != null && !patchDto.getPatch().isEmpty()) {
                // Le patch doit être durable avant son émission. Le verrou sérialise ce chemin
                // avec la synchronisation du tour qui peut changer de section en parallèle.
                Map<String, Object> updatedCvData = new TransactionTemplate(transactionManager).execute(status -> {
                    CvInterviewSessionEntity locked = sessionRepository.findLockedById(sessionId).orElse(null);
                    if (locked == null || !currentState.equals(locked.getCurrentState())
                            || !Integer.valueOf(sectionIndex).equals(locked.getSectionIndex())) return null;
                    Map<String, Object> partial = parseJsonMap(locked.getSectionPartialData());
                    partial.putAll(patchDto.getPatch());
                    Map<String, Object> data = parseJsonMap(locked.getCvDataSoFar());
                    mergeSectionPatchIntoCvData(currentState, sectionIndex, patchDto.getPatch(), data);
                    try {
                        String json = objectMapper.writeValueAsString(data);
                        locked.setSectionPartialData(objectMapper.writeValueAsString(partial));
                        locked.setCvDataSoFar(json);
                        sessionRepository.save(locked);
                        cvRepository.findById(locked.getCvId()).ifPresent(cv -> {
                            cv.setContentJson(json);
                            cvRepository.save(cv);
                        });
                    } catch (Exception e) {
                        throw new IllegalStateException("Sauvegarde du patch CV impossible", e);
                    }
                    return data;
                });
                if (updatedCvData != null && emitter != null) pushCvPatch(emitter, sessionId, updatedCvData);
                log.debug("[CvStream] Patch SSE anticipé envoyé pour session={} state={}", sessionId, currentState);
            }
        } catch (Exception e) {
            log.warn("[CvStream] Erreur traitement segment pour session={}: {}", sessionId, e.getMessage());
        }
    }

    public void publishCvSnapshot(String sessionId, Map<String, Object> cvData) {
        SseEmitter emitter = emitters.get(sessionId);
        if (emitter != null && cvData != null && !cvData.isEmpty()) {
            pushCvPatch(emitter, sessionId, cvData);
        }
    }

    @Scheduled(fixedDelay = 20000)
    public void keepStreamsAlive() {
        emitters.forEach((sessionId, emitter) -> {
            try {
                emitter.send(SseEmitter.event().comment("keepalive"));
            } catch (Exception e) {
                emitters.remove(sessionId, emitter);
            }
        });
    }

    private void pushCvPatch(SseEmitter emitter, String sessionId, Map<String, Object> cvData) {
        try {
            String json = objectMapper.writeValueAsString(Map.of(
                    "sessionId", sessionId,
                    "patch", cvData
            ));
            emitter.send(SseEmitter.event().name("cv_patch").data(json));
            log.debug("[CvStream] Patch SSE envoyé pour session={}", sessionId);
        } catch (Exception e) {
            log.debug("[CvStream] Emitter fermé pour session={}", sessionId);
            emitters.remove(sessionId, emitter);
        }
    }

    /**
     * Fusionne un patch de section dans les données CV complètes pour un push SSE cohérent.
     */
    @SuppressWarnings("unchecked")
    private void mergeSectionPatchIntoCvData(String state, int index, Map<String, Object> patch, Map<String, Object> cvData) {
        switch (state) {
            case "IDENTITY" -> {
                Map<String, Object> id = (Map<String, Object>) cvData.computeIfAbsent("identity", k -> new HashMap<>());
                patch.forEach((k, v) -> {
                    if (v != null && !v.toString().isBlank()) {
                        if (("fullName".equals(k) || "email".equals(k)) && id.containsKey(k) && id.get(k) != null && !id.get(k).toString().isBlank()) {
                            // Conserver la valeur pré-remplie par défaut de l'utilisateur
                            return;
                        }
                        id.put(k, v);
                    }
                });
            }
            case "TARGET" -> {
                if (patch.containsKey("headline")) cvData.put("headline", patch.get("headline"));
            }
            case "EXPERIENCE" -> {
                List<Map<String, Object>> exps = (List<Map<String, Object>>) cvData.computeIfAbsent("experiences", k -> new java.util.ArrayList<>());
                while (exps.size() <= index) exps.add(new HashMap<>());
                exps.get(index).putAll(patch);
            }
            case "EDUCATION" -> {
                List<Map<String, Object>> edus = (List<Map<String, Object>>) cvData.computeIfAbsent("education", k -> new java.util.ArrayList<>());
                while (edus.size() <= index) edus.add(new HashMap<>());
                edus.get(index).putAll(patch);
            }
            case "SKILLS" -> {
                if (patch.get("skills") instanceof List<?> list) {
                    java.util.Set<String> set = new java.util.LinkedHashSet<>(
                            (List<String>) cvData.computeIfAbsent("skills", k -> new java.util.ArrayList<>()));
                    list.forEach(s -> { if (s != null && !s.toString().isBlank()) set.add(s.toString()); });
                    cvData.put("skills", new java.util.ArrayList<>(set));
                }
            }
            case "LANGUAGES" -> {
                if (patch.get("languages") instanceof List<?> list) cvData.put("languages", list);
            }
            case "OPTIONAL_DETAILS" -> {
                for (String key : java.util.List.of("personalQualities", "interests")) {
                    if (patch.get(key) instanceof List<?> list) cvData.put(key, list);
                }
            }
            case "PROJECTS" -> {
                List<Map<String, Object>> projects = (List<Map<String, Object>>) cvData.computeIfAbsent("projects", k -> new java.util.ArrayList<>());
                while (projects.size() <= index) projects.add(new HashMap<>());
                projects.get(index).putAll(patch);
            }
            default -> cvData.putAll(patch);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseJsonMap(String json) {
        if (json == null || json.isBlank()) return new HashMap<>();
        try {
            return objectMapper.readValue(json, Map.class);
        } catch (Exception e) {
            return new HashMap<>();
        }
    }
}
