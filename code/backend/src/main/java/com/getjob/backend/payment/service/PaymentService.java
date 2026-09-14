package com.getjob.backend.payment.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.getjob.backend.candidate.domain.CandidateEntity;
import com.getjob.backend.candidate.repository.CandidateRepository;
import com.getjob.backend.cv.domain.CvEntity;
import com.getjob.backend.cv.repository.CvRepository;
import com.getjob.backend.payment.client.NotchPayClient;
import com.getjob.backend.payment.client.NotchPayCreatePaymentRequest;
import com.getjob.backend.payment.client.NotchPayPaymentResponse;
import com.getjob.backend.payment.client.NotchPayVerificationResponse;
import com.getjob.backend.payment.domain.*;
import com.getjob.backend.payment.dto.*;
import com.getjob.backend.payment.repository.CvUnlockRepository;
import com.getjob.backend.payment.repository.NotchPayWebhookEventRepository;
import com.getjob.backend.payment.repository.PaymentTransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentService {

    private final PaymentTransactionRepository transactionRepository;
    private final CvUnlockRepository unlockRepository;
    private final CandidateRepository candidateRepository;
    private final CvRepository cvRepository;
    private final NotchPayClient notchPayClient;
    private final NotchPayWebhookEventRepository webhookEventRepository;
    private final ObjectMapper objectMapper;

    @Value("${payment.notchpay.webhook-secret:}")
    private String webhookSecret;

    @Value("${payment.return-url:http://localhost:4200/cv-builder}")
    private String returnUrl;

    @Value("${payment.whatsapp.phone:237698765588}")
    private String whatsAppPhone;

    // Tarifs de référence Cameroun (XAF / FCFA)
    public static final BigDecimal PRICE_PACK_1_FCFA = new BigDecimal("500.00");
    public static final BigDecimal PRICE_PACK_3_FCFA = new BigDecimal("1200.00");

    @Transactional
    public InitiatePaymentResponseDto initiatePayment(Integer candidateId, InitiatePaymentRequestDto request) {
        CandidateEntity candidate = candidateRepository.findById(candidateId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidat introuvable"));

        CvEntity cv = null;
        if (request.getCvId() != null) {
            cv = cvRepository.findById(request.getCvId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "CV introuvable"));
            if (!candidateId.equals(cv.getCandidateId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Accès refusé : ce CV n'appartient pas à votre compte.");
            }
        }

        String currency = "XAF";
        String packId = (request.getPackId() != null && !request.getPackId().isBlank())
                ? request.getPackId()
                : (request.getType() == PaymentType.PRO_PACK ? "pack_3" : "pack_1");

        BigDecimal amount;
        int credits = 0;
        String packLabel;

        if ("pack_3".equalsIgnoreCase(packId) || request.getType() == PaymentType.PRO_PACK) {
            amount = PRICE_PACK_3_FCFA;
            credits = (cv != null) ? 2 : 3;
            packLabel = "Pack 3 CVs HD";
        } else {
            amount = PRICE_PACK_1_FCFA;
            credits = 0;
            packLabel = "1 CV HD";
        }

        String reference = "PAY-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase() + "-" + System.currentTimeMillis() % 10000;
        String operator = (request.getOperator() != null && !request.getOperator().isBlank())
                ? request.getOperator().toUpperCase()
                : "NOTCHPAY";

        String countryCode = (request.getCountryCode() != null && !request.getCountryCode().isBlank())
                ? request.getCountryCode().toUpperCase()
                : "CM";

        // 1. Sauvegarde préalable de la transaction interne en PENDING
        PaymentTransactionEntity transaction = PaymentTransactionEntity.builder()
                .reference(reference)
                .candidate(candidate)
                .cv(cv)
                .type(request.getType() != null ? request.getType() : ("pack_3".equalsIgnoreCase(packId) ? PaymentType.PRO_PACK : PaymentType.SINGLE_CV))
                .amount(amount)
                .currency(currency)
                .countryCode(countryCode)
                .operator(operator)
                .phoneNumber(request.getPhoneNumber())
                .status(PaymentStatus.PENDING)
                .creditsGranted(credits)
                .clientName(request.getClientName())
                .clientPhone(request.getClientPhone())
                .gateway("NOTCHPAY")
                .build();

        transactionRepository.save(transaction);

        log.info("Transaction initiée : ref={}, pack={}, montant={} {}, candidatId={}",
                reference, packId, amount, currency, candidateId);

        String redirectSuccess = returnUrl + (returnUrl.contains("?") ? "&" : "?")
                + "payment=success&ref=" + reference
                + (cv != null ? "&cvId=" + cv.getId() : "");

        // 2. Appel de l'API NotchPay pour créer le paiement
        try {
            NotchPayCreatePaymentRequest notchRequest = NotchPayCreatePaymentRequest.builder()
                    .amount(amount)
                    .currency(currency)
                    .customer(NotchPayCreatePaymentRequest.Customer.builder()
                            .name(candidate.getFullName())
                            .email(candidate.getEmail())
                            .phone(candidate.getPhone() != null ? candidate.getPhone() : request.getPhoneNumber())
                            .build())
                    .reference(reference)
                    .callback(redirectSuccess)
                    .description("Déverrouillage FallaJobs - " + packLabel)
                    .build();

            NotchPayPaymentResponse notchResponse = notchPayClient.createPayment(notchRequest);
            String checkoutUrl = notchResponse != null ? notchResponse.resolveAuthorizationUrl() : null;

            if (checkoutUrl == null || checkoutUrl.isBlank()) {
                throw new IllegalStateException("Aucune authorization_url retournée par NotchPay");
            }

            return InitiatePaymentResponseDto.builder()
                    .reference(reference)
                    .status(PaymentStatus.PENDING)
                    .amount(amount)
                    .currency(currency)
                    .operator(operator)
                    .phoneNumber(request.getPhoneNumber())
                    .message("Redirection vers la passerelle sécurisée NotchPay.")
                    .checkoutUrl(checkoutUrl)
                    .fallbackWhatsApp(false)
                    .build();

        } catch (Exception e) {
            // 3. Fallback WhatsApp défensif en cas d'instabilité, circuit breaker ouvert ou indisponibilité API
            log.warn("[PAYMENT_FALLBACK] NotchPay indisponible pour ref={} (erreur={}). Activation de la bascule WhatsApp.",
                    reference, e.getMessage());

            String waUrl = buildWhatsAppFallbackUrl(reference, amount, currency, packLabel, candidate);

            return InitiatePaymentResponseDto.builder()
                    .reference(reference)
                    .status(PaymentStatus.PENDING)
                    .amount(amount)
                    .currency(currency)
                    .operator(operator)
                    .phoneNumber(request.getPhoneNumber())
                    .message("Le service de paiement en ligne rencontre des lenteurs passagères. Vous pouvez finaliser instantanément votre commande avec notre assistance sur WhatsApp.")
                    .checkoutUrl(null)
                    .fallbackWhatsApp(true)
                    .whatsAppUrl(waUrl)
                    .whatsAppNumber("+" + whatsAppPhone)
                    .build();
        }
    }

    /**
     * Traite un callback webhook officiel NotchPay avec vérification HMAC et idempotence.
     */
    @Transactional
    public void processNotchPayWebhook(String rawPayload, String signatureHeader) {
        if (rawPayload == null || rawPayload.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Corps de requête webhook vide");
        }

        // 1. Vérification cryptographique de la signature X-Notch-Signature sur le raw body
        if (webhookSecret == null || webhookSecret.isBlank()) {
            log.error("Webhook NotchPay rejeté : aucun secret de webhook configuré côté serveur.");
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Configuration de sécurité webhook manquante.");
        }

        if (!verifyNotchPaySignature(rawPayload, signatureHeader)) {
            log.warn("Webhook NotchPay rejeté : signature HMAC invalide");
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Signature de webhook invalide");
        }

        // 2. Désérialisation du payload
        NotchPayWebhookPayload payload;
        try {
            payload = objectMapper.readValue(rawPayload, NotchPayWebhookPayload.class);
        } catch (Exception e) {
            log.error("Erreur de parsing du webhook NotchPay : {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Payload JSON invalide");
        }

        String eventId = payload.resolveEventId();
        String eventType = payload.resolveEventType();
        String reference = payload.resolveReference();
        String eventStatus = payload.resolveStatus();

        if (reference == null || reference.isBlank()) {
            log.warn("Webhook NotchPay sans référence de transaction : id={}", eventId);
            return;
        }

        // 3. Idempotence : ignorer silencieusement si l'événement a déjà été traité
        if (eventId != null && webhookEventRepository.existsByEventId(eventId)) {
            log.info("Webhook NotchPay déjà traité (idempotence) : eventId={}", eventId);
            return;
        }

        // Enregistrement de l'événement webhook
        if (eventId != null) {
            NotchPayWebhookEventEntity eventEntity = NotchPayWebhookEventEntity.builder()
                    .eventId(eventId)
                    .eventType(eventType)
                    .reference(reference)
                    .status(eventStatus)
                    .build();
            webhookEventRepository.save(eventEntity);
        }

        log.info("Webhook NotchPay reçu : event={}, ref={}, status={}", eventType, reference, eventStatus);

        // 4. Traitement des statuts d'événement
        if ("payment.complete".equalsIgnoreCase(eventType) || "complete".equalsIgnoreCase(eventStatus) || "paid".equalsIgnoreCase(eventStatus)) {
            // 5. Règle d'or : Double vérification obligatoire auprès de l'API NotchPay (GET /payments/{reference})
            try {
                NotchPayVerificationResponse verification = notchPayClient.verifyPayment(reference);
                if (verification == null || !verification.isComplete()) {
                    log.error("[NOTCHPAY_SECURITY] Double vérification échouée pour ref={} : statut retourné par l'API={}",
                            reference, verification != null ? verification.resolvePaymentStatus() : "null");
                    return;
                }

                PaymentTransactionEntity tx = transactionRepository.findByReference(reference).orElse(null);
                if (tx != null && verification.resolveAmount() != null) {
                    if (verification.resolveAmount().compareTo(tx.getAmount()) < 0) {
                        log.error("[NOTCHPAY_SECURITY] Incohérence de montant pour ref={} : attendu={}, payé={}",
                                reference, tx.getAmount(), verification.resolveAmount());
                        return;
                    }
                }

                String extId = verification.resolveExternalId() != null
                        ? verification.resolveExternalId()
                        : (payload.resolveExternalTransactionId() != null ? payload.resolveExternalTransactionId() : "NP_" + reference);

                confirmPaymentSuccess(reference, extId);

            } catch (Exception e) {
                log.error("[NOTCHPAY_SECURITY] Échec de la double vérification API pour ref={} : {}", reference, e.getMessage());
            }
        } else if ("payment.failed".equalsIgnoreCase(eventType) || "failed".equalsIgnoreCase(eventStatus)) {
            transactionRepository.findByReference(reference).ifPresent(tx -> {
                tx.setStatus(PaymentStatus.FAILED);
                transactionRepository.save(tx);
                log.info("Transaction {} marquée en FAILED", reference);
            });
        } else if ("payment.canceled".equalsIgnoreCase(eventType) || "canceled".equalsIgnoreCase(eventStatus) || "cancelled".equalsIgnoreCase(eventStatus)) {
            transactionRepository.findByReference(reference).ifPresent(tx -> {
                tx.setStatus(PaymentStatus.CANCELLED);
                transactionRepository.save(tx);
                log.info("Transaction {} marquée en CANCELLED", reference);
            });
        } else if ("payment.expired".equalsIgnoreCase(eventType) || "expired".equalsIgnoreCase(eventStatus)) {
            transactionRepository.findByReference(reference).ifPresent(tx -> {
                tx.setStatus(PaymentStatus.EXPIRED);
                transactionRepository.save(tx);
                log.info("Transaction {} marquée en EXPIRED", reference);
            });
        }
    }

    /**
     * Enregistre l'acceptation par le client de basculer vers le suivi et paiement WhatsApp.
     */
    @Transactional
    public void markFallbackWhatsApp(Integer candidateId, String reference) {
        PaymentTransactionEntity transaction = transactionRepository.findByReference(reference)
                .filter(t -> t.getCandidate().getId().equals(candidateId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transaction introuvable"));

        if (transaction.getStatus() == PaymentStatus.PENDING) {
            transaction.setStatus(PaymentStatus.FALLBACK_WHATSAPP);
            transactionRepository.save(transaction);
            log.info("[PAYMENT_FALLBACK] Transaction {} passée au statut FALLBACK_WHATSAPP pour candidatId={}",
                    reference, candidateId);
        }
    }

    /**
     * Valide le succès définitif de la transaction (déverrouillage CV ou crédits).
     */
    @Transactional
    public void confirmPaymentSuccess(String reference, String externalTransactionId) {
        PaymentTransactionEntity transaction = transactionRepository.findByReferenceForUpdate(reference)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transaction introuvable"));

        if (transaction.getStatus() == PaymentStatus.SUCCESS) {
            log.info("Transaction {} déjà validée", reference);
            return;
        }

        transaction.setStatus(PaymentStatus.SUCCESS);
        transaction.setExternalTransactionId(externalTransactionId);
        transactionRepository.save(transaction);

        CandidateEntity candidate = transaction.getCandidate();

        // Crédits pro accordés
        if (transaction.getCreditsGranted() > 0) {
            candidate.setProCredits(candidate.getProCredits() + transaction.getCreditsGranted());
            candidateRepository.save(candidate);
            log.info("Compte crédité : candidatId={}, +{} crédits (nouveau solde={})",
                    candidate.getId(), transaction.getCreditsGranted(), candidate.getProCredits());
        }

        // Déverrouillage CV
        if (transaction.getCv() != null) {
            Long cvId = transaction.getCv().getId();
            if (!unlockRepository.existsByCvId(cvId)) {
                CvUnlockEntity unlock = CvUnlockEntity.builder()
                        .cv(transaction.getCv())
                        .candidate(candidate)
                        .transaction(transaction)
                        .unlockMethod(transaction.getType() == PaymentType.PRO_PACK ? UnlockMethod.PRO_CREDIT : UnlockMethod.SINGLE_PAYMENT)
                        .clientName(transaction.getClientName())
                        .build();
                unlockRepository.save(unlock);
                log.info("CV {} déverrouillé avec succès via transaction NotchPay {}", cvId, reference);
            }
        }
    }

    @Transactional
    public CvUnlockStatusDto useProCredit(Integer candidateId, UseProCreditRequestDto request) {
        CandidateEntity candidate = candidateRepository.findById(candidateId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidat introuvable"));

        CvEntity cv = cvRepository.findById(request.getCvId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "CV introuvable"));

        // Anti-IDOR : Le CV doit appartenir au compte connecté
        if (!candidateId.equals(cv.getCandidateId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Accès refusé : ce CV n'appartient pas à votre compte.");
        }

        // Vérifier si le CV est déjà déverrouillé
        Optional<CvUnlockEntity> existing = unlockRepository.findByCvId(cv.getId());
        if (existing.isPresent()) {
            return mapToUnlockStatusDto(existing.get());
        }

        // Déduction atomique de 1 crédit en base
        int updatedRows = candidateRepository.decrementProCreditIfAvailable(candidateId);
        if (updatedRows == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Solde de crédits insuffisant. Veuillez recharger votre compte.");
        }

        CvUnlockEntity unlock = CvUnlockEntity.builder()
                .cv(cv)
                .candidate(candidate)
                .unlockMethod(UnlockMethod.PRO_CREDIT)
                .clientName(request.getClientName())
                .build();

        CvUnlockEntity saved = unlockRepository.save(unlock);

        log.info("1 crédit utilisé avec succès par candidatId={} pour déverrouiller le CV {} (déduction atomique)",
                candidateId, cv.getId());

        return mapToUnlockStatusDto(saved);
    }

    @Transactional(readOnly = true)
    public CvUnlockStatusDto getCvUnlockStatus(Integer candidateId, Long cvId) {
        // L'export de CV est 100% gratuit sans contrainte : tout CV est considéré comme déverrouillé
        return unlockRepository.findByCvIdAndCandidateId(cvId, candidateId)
                .map(this::mapToUnlockStatusDto)
                .orElseGet(() -> CvUnlockStatusDto.builder()
                        .cvId(cvId)
                        .unlocked(true)
                        .build());
    }

    @Transactional(readOnly = true)
    public java.util.List<Long> getUnlockedCvIdsForCandidate(Integer candidateId) {
        // L'export de CV est 100% gratuit : tous les CVs du candidat sont déverrouillés
        return cvRepository.findByCandidateId(candidateId)
                .stream()
                .map(CvEntity::getId)
                .toList();
    }

    @Transactional(readOnly = true)
    public ProAccountStatusDto getProAccountStatus(Integer candidateId) {
        CandidateEntity candidate = candidateRepository.findById(candidateId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidat introuvable"));

        long totalUnlocked = unlockRepository.findByCandidateIdOrderByUnlockedAtDesc(candidateId).size();

        return ProAccountStatusDto.builder()
                .isProAgent(candidate.isProAgent())
                .proCredits(candidate.getProCredits())
                .agentShopName(candidate.getAgentShopName())
                .totalUnlockedCvs(totalUnlocked)
                .build();
    }

    @Transactional
    public void updateShopName(Integer candidateId, String shopName) {
        CandidateEntity candidate = candidateRepository.findById(candidateId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidat introuvable"));
        candidate.setAgentShopName(shopName != null ? shopName.trim() : null);
        candidateRepository.save(candidate);
    }

    @Transactional
    public Map<String, Object> getPaymentStatus(Integer candidateId, String reference) {
        PaymentTransactionEntity tx = transactionRepository.findByReference(reference)
                .filter(t -> t.getCandidate().getId().equals(candidateId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transaction introuvable"));

        // Filet de sécurité : Si la transaction est encore PENDING, vérification active auprès de l'API NotchPay
        if (tx.getStatus() == PaymentStatus.PENDING) {
            try {
                NotchPayVerificationResponse verification = notchPayClient.verifyPayment(reference);
                if (verification != null && verification.isComplete()) {
                    if (verification.resolveAmount() == null || verification.resolveAmount().compareTo(tx.getAmount()) >= 0) {
                        String extId = verification.resolveExternalId() != null
                                ? verification.resolveExternalId()
                                : "POLL_" + reference;
                        confirmPaymentSuccess(reference, extId);
                        tx = transactionRepository.findByReference(reference).orElse(tx);
                        log.info("[PAYMENT_VERIFY] Transaction {} validée à la volée via interrogation API NotchPay", reference);
                    }
                }
            } catch (Exception e) {
                log.debug("[PAYMENT_VERIFY] Vérification à la volée NotchPay en attente pour ref={} : {}", reference, e.getMessage());
            }
        }

        boolean isSuccess = tx.getStatus() == PaymentStatus.SUCCESS;
        return Map.of(
                "reference", tx.getReference(),
                "status", tx.getStatus().name(),
                "success", isSuccess,
                "cvId", tx.getCv() != null ? tx.getCv().getId() : 0,
                "creditsGranted", tx.getCreditsGranted()
        );
    }

    private boolean verifyNotchPaySignature(String rawPayload, String signatureHeader) {
        if (signatureHeader == null || signatureHeader.isBlank() || webhookSecret == null || webhookSecret.isBlank()) {
            return false;
        }

        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKeySpec = new SecretKeySpec(
                    webhookSecret.trim().getBytes(StandardCharsets.UTF_8), "HmacSHA256"
            );
            mac.init(secretKeySpec);

            byte[] hmacBytes = mac.doFinal(rawPayload.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hmacBytes) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            String computedHex = hexString.toString();

            return MessageDigest.isEqual(
                    signatureHeader.trim().getBytes(StandardCharsets.UTF_8),
                    computedHex.getBytes(StandardCharsets.UTF_8)
            );
        } catch (Exception e) {
            log.error("Erreur lors de la vérification de la signature HMAC NotchPay : {}", e.getMessage());
            return false;
        }
    }

    private String buildWhatsAppFallbackUrl(String reference, BigDecimal amount, String currency, String packLabel, CandidateEntity candidate) {
        String rawMessage = String.format(
                "Bonjour FallaJobs, je souhaite finaliser ma commande :\n" +
                "- Référence : %s\n" +
                "- Montant : %s %s\n" +
                "- Forfait : %s\n" +
                "- Client : %s (%s)",
                reference,
                amount.intValue(),
                currency,
                packLabel,
                candidate.getFullName() != null ? candidate.getFullName() : "Candidat",
                candidate.getEmail()
        );

        String cleanPhone = whatsAppPhone.replaceAll("[^0-9]", "");
        return "https://wa.me/" + cleanPhone + "?text=" + URLEncoder.encode(rawMessage, StandardCharsets.UTF_8);
    }

    private CvUnlockStatusDto mapToUnlockStatusDto(CvUnlockEntity entity) {
        return CvUnlockStatusDto.builder()
                .cvId(entity.getCv().getId())
                .unlocked(true)
                .unlockMethod(entity.getUnlockMethod())
                .unlockedAt(entity.getUnlockedAt())
                .clientName(entity.getClientName())
                .build();
    }
}
