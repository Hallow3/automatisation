package com.getjob.backend.cv.interview.controller;

import com.getjob.backend.candidate.domain.CandidateEntity;
import com.getjob.backend.candidate.repository.CandidateRepository;
import com.getjob.backend.cv.interview.service.CvInterviewStreamService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Map;

/**
 * Contrôleur SSE pour le streaming CV en temps réel (Phase 2 & 3).
 * - GET  /stream  : ouvre le canal SSE pour recevoir les patches CV
 * - POST /push-transcript : reçoit un segment de transcription et déclenche l'extraction async
 */
@RestController
@RequestMapping("/api/v1/cvs/{cvId}/interview")
@RequiredArgsConstructor
@Slf4j
public class CvInterviewStreamController {

    private final CvInterviewStreamService streamService;
    private final CandidateRepository candidateRepository;

    private CandidateEntity resolveCurrentCandidate() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur non authentifié.");
        }
        return candidateRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Profil candidat introuvable."));
    }

    /**
     * Ouvre le canal SSE pour recevoir les patches CV en temps réel.
     * Le client Angular s'y connecte via EventSource dès le démarrage de l'entretien.
     */
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter subscribeToCvStream(
            @PathVariable String cvId,
            @RequestParam String sessionId
    ) {
        resolveCurrentCandidate();
        log.info("[CvStream] Nouvelle connexion SSE cv_id={} session_id={}", cvId, sessionId);
        return streamService.createEmitter(sessionId);
    }

    /**
     * Reçoit un segment de transcription utilisateur et déclenche l'extraction CV async.
     * Appelé par le frontend dès la fin de parole du candidat (avant onModelTurnComplete).
     */
    @PostMapping("/push-transcript")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public ResponseEntity<Void> pushTranscriptSegment(
            @PathVariable String cvId,
            @RequestBody Map<String, Object> payload
    ) {
        resolveCurrentCandidate();
        String sessionId = (String) payload.get("sessionId");
        String segment = (String) payload.get("segment");

        if (sessionId == null || sessionId.isBlank() || segment == null || segment.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        if (segment.trim().split("\\s+").length < 4) {
            return ResponseEntity.accepted().build();
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> cvDataSoFar = (Map<String, Object>) payload.get("cvDataSoFar");

        log.debug("[CvStream] Segment reçu cv_id={} session_id={} ({} mots)", cvId, sessionId,
                segment.trim().split("\\s+").length);
        streamService.processSegmentAsync(cvId, sessionId, segment.trim(), cvDataSoFar);
        return ResponseEntity.accepted().build();
    }
}
