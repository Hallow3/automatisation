package com.getjob.backend.cv.interview.controller;

import com.getjob.backend.candidate.domain.CandidateEntity;
import com.getjob.backend.candidate.repository.CandidateRepository;
import com.getjob.backend.cv.interview.dto.InterviewTurnRequest;
import com.getjob.backend.cv.interview.dto.InterviewTurnResponse;
import com.getjob.backend.cv.interview.dto.RequestEndInterviewDto;
import com.getjob.backend.cv.interview.service.CvInterviewOrchestratorService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import io.micrometer.core.instrument.MeterRegistry;

import java.util.Set;

/**
 * Contrôleur REST pour l'orchestration V2 de l'entretien vocal CV (Spec V2).
 * Expose la gestion de session persistante, la synchronisation des tours de parole
 * et la validation d'arrêt utilisateur.
 */
@RestController
@RequestMapping("/api/v1/cvs")
@RequiredArgsConstructor
@Slf4j
public class CvInterviewController {

    private final CvInterviewOrchestratorService orchestratorService;
    private final CandidateRepository candidateRepository;
    private final com.getjob.backend.cv.interview.service.CvInterviewBillingService billingService;
    private final com.getjob.backend.cv.interview.service.CvInterviewStreamService streamService;
    private final MeterRegistry meterRegistry;

    private static final Set<String> CLIENT_ERROR_CODES = Set.of(
            "WS_CONNECTION", "AI_UNAVAILABLE", "MICROPHONE", "SESSION_START", "CV_WRITER", "OTHER");

    public record ClientErrorEvent(String code) {}

    @PostMapping("/interview/client-error")
    public ResponseEntity<Void> reportClientError(@RequestBody ClientErrorEvent event) {
        resolveCurrentCandidate();
        if (event == null || !CLIENT_ERROR_CODES.contains(event.code())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Code d'erreur invalide.");
        }
        meterRegistry.counter("fallajobs_interview_client_errors", "code", event.code()).increment();
        return ResponseEntity.noContent().build();
    }

    private CandidateEntity resolveCurrentCandidate() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur non authentifié.");
        }
        String email = auth.getName();
        return candidateRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Profil candidat introuvable."));
    }

    /**
     * Initialise ou reprend une session d'orchestration V2 pour un CV donné.
     * Enregistre également le démarrage du compteur de facturation au temps réel.
     */
    @PostMapping("/{id}/interview/v2/session")
    public ResponseEntity<InterviewTurnResponse> initOrResumeSession(@PathVariable String id) {
        CandidateEntity candidate = resolveCurrentCandidate();
        log.info("POST /api/v1/cvs/{}/interview/v2/session candidate_id={}", id, candidate.getId());
        InterviewTurnResponse response = orchestratorService.initOrResumeSession(id, candidate);

        // Démarrage de l'autorité de facturation backend
        if (response != null && response.getSessionId() != null) {
            Long parsedCvId = null;
            try {
                parsedCvId = Long.parseLong(id);
            } catch (Exception ignored) {}
            billingService.startSession(response.getSessionId(), parsedCvId, candidate);
        }

        return ResponseEntity.ok(response);
    }

    /**
     * Reçoit le heartbeat périodique du client (toutes les 15s) pour renouveler le bail de session.
     */
    @PostMapping("/{id}/interview/v2/heartbeat")
    public ResponseEntity<com.getjob.backend.cv.interview.dto.HeartbeatDto.Response> heartbeat(
            @PathVariable String id,
            @RequestBody com.getjob.backend.cv.interview.dto.HeartbeatDto.Request request
    ) {
        CandidateEntity candidate = resolveCurrentCandidate();
        var session = orchestratorService.requireOwnedSession(request.getSessionId(), candidate);
        if (!id.equals(session.getCvId().toString())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Session liée à un autre CV.");
        }
        return ResponseEntity.ok(billingService.recordHeartbeat(request.getSessionId(), candidate));
    }

    /**
     * Traite un tour de parole (transcription issue de Gemini Live) et renvoie le nouvel état
     * ainsi que le bloc de contrôle [INTERVIEW_STATE].
     */
    @PostMapping("/{id}/interview/v2/turn")
    public ResponseEntity<InterviewTurnResponse> processTurn(
            @PathVariable String id,
            @RequestBody InterviewTurnRequest request
    ) {
        CandidateEntity candidate = resolveCurrentCandidate();
        request.setCvId(id);
        InterviewTurnResponse response = orchestratorService.processTurn(request, candidate);
        streamService.publishCvSnapshot(response.getSessionId(), response.getCvDataSoFar());
        if ("OBSERVER_UNAVAILABLE".equals(response.getInterviewStatus())) {
            billingService.terminateAndBill(response.getSessionId(), "AI_UNAVAILABLE");
        }
        return ResponseEntity.ok(response);
    }

    /**
     * Validation stricte de la demande d'arrêt utilisateur (request_end_interview).
     * Clôture et facture le temps consommé.
     */
    @PostMapping("/{id}/interview/v2/request-end")
    public ResponseEntity<RequestEndInterviewDto.Response> requestEndInterview(
            @PathVariable String id,
            @RequestBody RequestEndInterviewDto.Request request
    ) {
        CandidateEntity candidate = resolveCurrentCandidate();
        request.setCvId(id);
        var response = orchestratorService.handleRequestEndInterview(request, candidate);
        if (response.isApproved()) {
            billingService.terminateAndBill(request.getSessionId(), "USER_HANGUP");
        }
        return ResponseEntity.ok(response);
    }
}
