package com.getjob.backend.cv.interview.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.getjob.backend.cv.interview.domain.CvInterviewSessionEntity;
import com.getjob.backend.cv.interview.dto.SectionPatchDto;
import com.getjob.backend.cv.interview.repository.CvInterviewSessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
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
    private final ObjectMapper objectMapper;

    // sessionId -> SseEmitter actif
    private final ConcurrentHashMap<String, SseEmitter> emitters = new ConcurrentHashMap<>();

    private static final long SSE_TIMEOUT_MS = 10 * 60 * 1000L; // 10 min

    /**
     * Crée et enregistre un SseEmitter pour la session donnée.
     */
    public SseEmitter createEmitter(String sessionId) {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        emitters.put(sessionId, emitter);

        emitter.onCompletion(() -> emitters.remove(sessionId));
        emitter.onTimeout(() -> {
            emitters.remove(sessionId);
            emitter.complete();
        });
        emitter.onError(e -> emitters.remove(sessionId));

        log.info("[CvStream] Emitter SSE créé pour session={}", sessionId);
        return emitter;
    }

    /**
     * Traite un segment de transcription de manière asynchrone.
     * Reçoit le cvDataSoFar directement du frontend pour ne pas dépendre
     * de l'état DB qui n'est pas encore mis à jour au moment du push anticipé.
     */
    @Async("cvStreamTaskExecutor")
    public void processSegmentAsync(String cvId, String sessionId, String userSegment, Map<String, Object> cvDataSoFar) {
        SseEmitter emitter = emitters.get(sessionId);
        if (emitter == null) {
            log.debug("[CvStream] Pas d'emitter actif pour session={}, segment ignoré.", sessionId);
            return;
        }

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
                // Utiliser le cvDataSoFar envoyé par le frontend (plus à jour que la DB)
                Map<String, Object> updatedCvData = cvDataSoFar != null ? new HashMap<>(cvDataSoFar) : parseJsonMap(session.getCvDataSoFar());
                mergeSectionPatchIntoCvData(currentState, sectionIndex, patchDto.getPatch(), updatedCvData);
                pushCvPatch(emitter, sessionId, updatedCvData);
                log.debug("[CvStream] Patch SSE anticipé envoyé pour session={} state={}", sessionId, currentState);
            }
        } catch (Exception e) {
            log.warn("[CvStream] Erreur traitement segment pour session={}: {}", sessionId, e.getMessage());
        }
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
            emitters.remove(sessionId);
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
