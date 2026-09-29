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
        return ResponseEntity.ok(orchestratorService.processTurn(request, candidate));
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
        if (request.getSessionId() != null) {
            billingService.terminateAndBill(request.getSessionId(), "USER_HANGUP");
        }
        return ResponseEntity.ok(orchestratorService.handleRequestEndInterview(request, candidate));
    }
}
