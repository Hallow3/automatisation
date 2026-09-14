package com.getjob.backend.payment.controller;

import com.getjob.backend.candidate.domain.CandidateEntity;
import com.getjob.backend.candidate.repository.CandidateRepository;
import com.getjob.backend.payment.dto.*;
import com.getjob.backend.payment.service.PaymentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@Slf4j
public class PaymentController {

    private final PaymentService paymentService;
    private final CandidateRepository candidateRepository;

    private CandidateEntity resolveCurrentCandidate() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            throw new AccessDeniedException("Aucun utilisateur authentifié dans le contexte.");
        }
        String email = auth.getName();
        return candidateRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Candidat non trouvé pour l'email connecté : " + email));
    }

    /**
     * Initie un paiement en ligne via l'API programmatique NotchPay.
     * En cas d'indisponibilité ou circuit breaker ouvert, bascule défensivement en fallback WhatsApp.
     */
    @PostMapping("/api/v1/payments/initiate")
    public ResponseEntity<InitiatePaymentResponseDto> initiatePayment(
            @Valid @RequestBody InitiatePaymentRequestDto request
    ) {
        CandidateEntity candidate = resolveCurrentCandidate();
        InitiatePaymentResponseDto response = paymentService.initiatePayment(candidate.getId(), request);
        return ResponseEntity.ok(response);
    }

    /**
     * Webhook officiel NotchPay : réception des événements (payment.complete, payment.failed, etc.)
     * Mappé sur /webhooks/notchpay (standard NotchPay global) et /api/v1/payments/webhooks/notchpay.
     */
    @PostMapping({"/webhooks/notchpay", "/api/v1/payments/webhooks/notchpay", "/api/v1/payments/webhook"})
    public ResponseEntity<Map<String, String>> handleNotchPayWebhook(
            @RequestHeader(value = "X-Notch-Signature", required = false) String notchSignature,
            @RequestHeader(value = "X-Signature", required = false) String fallbackSignature,
            @RequestBody String rawBody
    ) {
        String activeSig = (notchSignature != null && !notchSignature.isBlank())
                ? notchSignature
                : fallbackSignature;

        log.info("Webhook NotchPay reçu (longueur body={})", rawBody != null ? rawBody.length() : 0);
        paymentService.processNotchPayWebhook(rawBody, activeSig);
        return ResponseEntity.ok(Map.of("status", "SUCCESS", "message", "Webhook NotchPay traité avec succès"));
    }

    /**
     * Enregistre le basculement d'une commande vers le suivi WhatsApp
     */
    @PostMapping("/api/v1/payments/fallback-whatsapp/{reference}")
    public ResponseEntity<Map<String, String>> markFallbackWhatsApp(
            @PathVariable String reference
    ) {
        CandidateEntity candidate = resolveCurrentCandidate();
        paymentService.markFallbackWhatsApp(candidate.getId(), reference);
        return ResponseEntity.ok(Map.of("status", "SUCCESS", "message", "Commande basculée vers WhatsApp"));
    }

    /**
     * Vérifie le statut réel d'une transaction de paiement (Lecture seule, sécurisée par JWT).
     */
    @GetMapping("/api/v1/payments/status/{reference}")
    public ResponseEntity<Map<String, Object>> getPaymentStatus(
            @PathVariable String reference
    ) {
        CandidateEntity candidate = resolveCurrentCandidate();
        Map<String, Object> status = paymentService.getPaymentStatus(candidate.getId(), reference);
        return ResponseEntity.ok(status);
    }

    /**
     * Déduit 1 crédit pro pour déverrouiller le CV d'un client au guichet
     */
    @PostMapping("/api/v1/payments/use-pro-credit")
    public ResponseEntity<CvUnlockStatusDto> useProCredit(
            @Valid @RequestBody UseProCreditRequestDto request
    ) {
        CandidateEntity candidate = resolveCurrentCandidate();
        CvUnlockStatusDto status = paymentService.useProCredit(candidate.getId(), request);
        return ResponseEntity.ok(status);
    }

    /**
     * Vérifie si un CV appartient et est déverrouillé en HD pour le candidat connecté
     */
    @GetMapping("/api/v1/payments/cvs/{cvId}/status")
    public ResponseEntity<CvUnlockStatusDto> getCvStatus(
            @PathVariable Long cvId
    ) {
        CandidateEntity candidate = resolveCurrentCandidate();
        CvUnlockStatusDto status = paymentService.getCvUnlockStatus(candidate.getId(), cvId);
        return ResponseEntity.ok(status);
    }

    /**
     * Récupère la liste de tous les IDs de CV déverrouillés en base pour le candidat connecté
     */
    @GetMapping("/api/v1/payments/unlocked-cvs")
    public ResponseEntity<java.util.List<Long>> getUnlockedCvIds() {
        CandidateEntity candidate = resolveCurrentCandidate();
        return ResponseEntity.ok(paymentService.getUnlockedCvIdsForCandidate(candidate.getId()));
    }

    /**
     * Récupère l'état du compte pro (solde de crédits, total CVs déverrouillés, nom d'établissement)
     */
    @GetMapping("/api/v1/payments/pro-status")
    public ResponseEntity<ProAccountStatusDto> getProAccountStatus() {
        CandidateEntity candidate = resolveCurrentCandidate();
        ProAccountStatusDto status = paymentService.getProAccountStatus(candidate.getId());
        return ResponseEntity.ok(status);
    }

    /**
     * Met à jour le nom de l'établissement cybercafé / secrétariat
     */
    @PutMapping("/api/v1/payments/pro-shop")
    public ResponseEntity<Map<String, String>> updateShopName(
            @RequestBody Map<String, String> body
    ) {
        CandidateEntity candidate = resolveCurrentCandidate();
        String shopName = body.get("shopName");
        paymentService.updateShopName(candidate.getId(), shopName);
        return ResponseEntity.ok(Map.of("status", "SUCCESS", "message", "Nom de l'établissement mis à jour"));
    }
}
