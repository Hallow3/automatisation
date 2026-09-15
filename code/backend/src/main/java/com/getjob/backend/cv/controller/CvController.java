package com.getjob.backend.cv.controller;

import com.getjob.backend.candidate.domain.CandidateEntity;
import com.getjob.backend.candidate.repository.CandidateRepository;
import com.getjob.backend.cv.domain.CvEntity;
import com.getjob.backend.cv.dto.CvDto;
import com.getjob.backend.cv.service.CvPdfExportService;
import com.getjob.backend.cv.service.CvService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class CvController {

    private final CvService cvService;
    private final CvPdfExportService cvPdfExportService;
    private final CandidateRepository candidateRepository;

    private CandidateEntity resolveCurrentCandidate() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return null;
        }
        String email = auth.getName();
        return candidateRepository.findByEmail(email).orElse(null);
    }

    @GetMapping("/cvs")
    public ResponseEntity<?> getCvs(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size
    ) {
        if (page != null) {
            int pageSize = size != null ? size : 10;
            return ResponseEntity.ok(cvService.getCvs(
                    org.springframework.data.domain.PageRequest.of(page, pageSize, org.springframework.data.domain.Sort.by("id").descending())
            ));
        }
        return ResponseEntity.ok(cvService.getAllCvs());
    }

    @GetMapping("/cvs/{id}")
    public ResponseEntity<CvDto> getCv(@PathVariable String id) {
        return cvService.getCvById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/cvs")
    public ResponseEntity<CvDto> createCv(@RequestBody CvDto cv) {
        return ResponseEntity.ok(cvService.createCv(cv));
    }

    @DeleteMapping("/cvs/{id}")
    public ResponseEntity<Void> deleteCv(@PathVariable String id) {
        cvService.deleteCv(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/cv-templates")
    public ResponseEntity<List<Map<String, Object>>> getTemplates() {
        return ResponseEntity.ok(cvService.getTemplates());
    }

    @PostMapping("/cvs/{id}/interview/session")
    public ResponseEntity<Map<String, String>> createInterviewSession(@PathVariable String id) {
        return ResponseEntity.ok(cvService.createInterviewSession(id));
    }

    @PutMapping("/cvs/{id}/draft")
    public ResponseEntity<CvDto> updateDraft(@PathVariable String id, @RequestBody Object draftData) {
        return ResponseEntity.ok(cvService.updateDraft(id, draftData));
    }

    @PostMapping("/cvs/{id}/interview/complete")
    public ResponseEntity<Map<String, Object>> completeInterview(@PathVariable String id) {
        return ResponseEntity.ok(cvService.completeInterview(id));
    }

    @PostMapping("/cvs/{id}/interview/refund-aborted")
    public ResponseEntity<Map<String, Object>> refundAbortedInterviewSession(@PathVariable String id) {
        boolean refunded = cvService.refundAbortedInterviewSession(id);
        return ResponseEntity.ok(Map.of("refunded", refunded));
    }

    @PostMapping("/cvs/{id}/synthesize")
    public ResponseEntity<CvDto> synthesizeFromTranscript(@PathVariable String id, @RequestBody Map<String, Object> payload) {
        String transcript = (String) payload.get("transcript");
        return ResponseEntity.ok(cvService.synthesizeCvFromTranscript(id, transcript));
    }

    @PostMapping("/cvs/{id}/ai-edit")
    public ResponseEntity<CvDto> aiEditCv(
            @PathVariable String id,
            @RequestBody Map<String, Object> payload
    ) {
        String prompt = (String) payload.get("prompt");
        Object currentData = payload.get("currentData");
        return ResponseEntity.ok(cvService.aiEditCv(id, prompt, currentData));
    }

    @PostMapping("/cvs/import")
    public ResponseEntity<CvDto> importCv(
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file
    ) {
        return ResponseEntity.ok(cvService.importCvFromFile(file));
    }

    @GetMapping(value = "/cvs/{id}/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public CompletableFuture<ResponseEntity<byte[]>> exportCvPdf(
            @PathVariable String id,
            @RequestParam(required = false, defaultValue = "modern") String template
    ) {
        CandidateEntity candidate = resolveCurrentCandidate();
        // Export PDF 100% gratuit : contrôle d'accès propriétaire (Anti-IDOR) sans contrainte de paiement
        CvEntity verifiedCv = cvPdfExportService.verifyAccess(id, candidate);
        String targetCvId = (verifiedCv != null) ? verifiedCv.getId().toString() : id;

        return cvPdfExportService.generateCvPdfAsync(targetCvId, template)
                .thenApply(pdfBytes -> ResponseEntity.ok()
                        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"CV_" + targetCvId + ".pdf\"")
                        .contentType(MediaType.APPLICATION_PDF)
                        .body(pdfBytes));
    }

    /**
     * Génère un ticket de téléchargement temporaire (TTL 5 minutes).
     * Vérifie en amont l'authentification et la propriété du CV (export gratuit sans contrainte).
     */
    @PostMapping("/cvs/{id}/download-ticket")
    public ResponseEntity<Map<String, Object>> createDownloadTicket(
            @PathVariable String id,
            @RequestParam(required = false, defaultValue = "modern") String template
    ) {
        CandidateEntity candidate = resolveCurrentCandidate();
        CvEntity verifiedCv = cvPdfExportService.verifyAccess(id, candidate);
        String targetCvId = (verifiedCv != null) ? verifiedCv.getId().toString() : id;
        Integer candidateId = (candidate != null) ? candidate.getId() : null;

        String token = cvPdfExportService.createDownloadTicket(targetCvId, candidateId, template);
        String downloadUrl = "/api/v1/cvs/" + targetCvId + "/download?token=" + token + "&template=" + template;

        return ResponseEntity.ok(Map.of(
                "downloadUrl", downloadUrl,
                "token", token,
                "expiresIn", 300
        ));
    }

    /**
     * Endpoint de téléchargement temporaire direct pour nouvel onglet de navigateur.
     * Authentifié par le ticket éphémère (sans cookie requis dans le nouvel onglet).
     */
    @GetMapping(value = "/cvs/{id}/download", produces = MediaType.APPLICATION_PDF_VALUE)
    public CompletableFuture<ResponseEntity<byte[]>> downloadCvPdfWithTicket(
            @PathVariable String id,
            @RequestParam String token,
            @RequestParam(required = false) String template
    ) {
        String safeTemplate = cvPdfExportService.validateAndConsumeDownloadTicket(id, token);
        if (safeTemplate == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Le lien de téléchargement a expiré ou est invalide.");
        }

        String chosenTemplate = (template != null && !template.isBlank()) ? template : safeTemplate;

        return cvPdfExportService.generateCvPdfAsync(id, chosenTemplate)
                .thenApply(pdfBytes -> ResponseEntity.ok()
                        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"CV_" + id + ".pdf\"")
                        .contentType(MediaType.APPLICATION_PDF)
                        .body(pdfBytes));
    }

    /**
     * Endpoint sécurisé par jeton éphémère à usage unique (Point 5).
     * Permet au moteur Chromium headless de charger les données du CV pour l'impression A4
     * sans nécessiter de cookies de session utilisateur.
     */
    @GetMapping("/cvs/{id}/print-data")
    public ResponseEntity<CvDto> getPrintData(
            @PathVariable String id,
            @RequestParam String token
    ) {
        if (!cvPdfExportService.validatePrintToken(id, token)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Jeton d'impression invalide ou expiré.");
        }
        return cvService.getCvByIdUnrestricted(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
