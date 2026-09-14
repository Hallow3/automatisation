package com.getjob.backend.payment.client;

import com.getjob.backend.payment.resilience.NotchPayCircuitBreaker;
import com.getjob.backend.payment.resilience.NotchPayCircuitBreakerOpenException;
import com.getjob.backend.payment.resilience.NotchPayServiceException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

/**
 * Client HTTP dédié à l'API NotchPay avec résilience intégrée :
 * - Timeouts courts et configurables
 * - Retry avec backoff exponentiel uniquement sur erreurs transitoires (5xx, timeouts)
 * - Circuit Breaker actif
 * - Métriques d'observabilité et traçabilité
 */
@Component
@Slf4j
public class NotchPayClient {

    private final NotchPayCircuitBreaker circuitBreaker;
    private final RestTemplate restTemplate;

    private final String baseUrl;
    private final String publicKey;
    private final String privateKey;
    private final int maxRetries;

    public NotchPayClient(
            NotchPayCircuitBreaker circuitBreaker,
            @Value("${payment.notchpay.base-url:https://api.notchpay.co}") String baseUrl,
            @Value("${payment.notchpay.public-key:}") String publicKey,
            @Value("${payment.notchpay.private-key:}") String privateKey,
            @Value("${payment.notchpay.connect-timeout-ms:3000}") int connectTimeout,
            @Value("${payment.notchpay.read-timeout-ms:5000}") int readTimeout,
            @Value("${payment.notchpay.max-retries:2}") int maxRetries
    ) {
        this.circuitBreaker = circuitBreaker;
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        this.publicKey = publicKey;
        this.privateKey = privateKey;
        this.maxRetries = maxRetries;

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(connectTimeout);
        factory.setReadTimeout(readTimeout);
        this.restTemplate = new RestTemplate(factory);
    }

    /**
     * Initialise un paiement programmatiquement via POST /payments
     */
    public NotchPayPaymentResponse createPayment(NotchPayCreatePaymentRequest request) {
        if (!circuitBreaker.canExecute()) {
            log.warn("[NOTCHPAY_CLIENT] Circuit Breaker OPEN : refus de tenter l'appel POST /payments pour ref={}", request.getReference());
            throw new NotchPayCircuitBreakerOpenException("Circuit Breaker NotchPay OPEN");
        }

        String url = baseUrl + "/payments";
        HttpHeaders headers = createHeaders();
        HttpEntity<NotchPayCreatePaymentRequest> entity = new HttpEntity<>(request, headers);

        int attempts = 0;
        long startTime = System.currentTimeMillis();

        while (attempts <= maxRetries) {
            attempts++;
            long attemptStart = System.currentTimeMillis();
            try {
                ResponseEntity<NotchPayPaymentResponse> response = restTemplate.exchange(
                        url,
                        HttpMethod.POST,
                        entity,
                        NotchPayPaymentResponse.class
                );

                long duration = System.currentTimeMillis() - attemptStart;
                log.info("[NOTCHPAY_METRICS] action=CREATE_PAYMENT, ref={}, attempt={}, status=SUCCESS, httpCode={}, durationMs={}",
                        request.getReference(), attempts, response.getStatusCode().value(), duration);

                circuitBreaker.recordSuccess();
                return response.getBody();

            } catch (HttpClientErrorException e) {
                // Erreur 4xx : requête invalide ou auth incorrecte -> ne pas retenter, c'est définitif
                long duration = System.currentTimeMillis() - attemptStart;
                log.error("[NOTCHPAY_METRICS] action=CREATE_PAYMENT, ref={}, attempt={}, status=CLIENT_ERROR, httpCode={}, durationMs={}, body={}",
                        request.getReference(), attempts, e.getStatusCode().value(), duration, e.getResponseBodyAsString());
                throw new NotchPayServiceException("Erreur client NotchPay (" + e.getStatusCode().value() + ") : " + e.getResponseBodyAsString(), e);

            } catch (HttpServerErrorException | ResourceAccessException e) {
                // Erreur 5xx ou Timeout réseau : transitoire
                long duration = System.currentTimeMillis() - attemptStart;
                log.warn("[NOTCHPAY_METRICS] action=CREATE_PAYMENT, ref={}, attempt={}/{}, status=TRANSIENT_ERROR, error={}, durationMs={}",
                        request.getReference(), attempts, maxRetries + 1, e.getMessage(), duration);

                if (attempts > maxRetries) {
                    circuitBreaker.recordFailure();
                    throw new NotchPayServiceException("API NotchPay indisponible après " + attempts + " tentatives (" + e.getMessage() + ")", e);
                }

                // Pause exponentielle : 500ms, 1000ms
                try {
                    Thread.sleep(500L * attempts);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw new NotchPayServiceException("Interruption lors du retry", ie);
                }
            } catch (Exception e) {
                long duration = System.currentTimeMillis() - attemptStart;
                log.error("[NOTCHPAY_METRICS] action=CREATE_PAYMENT, ref={}, attempt={}, status=UNEXPECTED_ERROR, error={}, durationMs={}",
                        request.getReference(), attempts, e.getMessage(), duration);
                circuitBreaker.recordFailure();
                throw new NotchPayServiceException("Erreur inattendue NotchPay : " + e.getMessage(), e);
            }
        }

        circuitBreaker.recordFailure();
        throw new NotchPayServiceException("Échec de création du paiement NotchPay pour ref=" + request.getReference());
    }

    /**
     * Vérifie le statut réel et le montant d'un paiement via GET /payments/{reference}
     */
    public NotchPayVerificationResponse verifyPayment(String reference) {
        String url = baseUrl + "/payments/" + reference;
        HttpHeaders headers = createHeaders();
        HttpEntity<Void> entity = new HttpEntity<>(headers);

        long start = System.currentTimeMillis();
        try {
            ResponseEntity<NotchPayVerificationResponse> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    entity,
                    NotchPayVerificationResponse.class
            );

            long duration = System.currentTimeMillis() - start;
            log.info("[NOTCHPAY_METRICS] action=VERIFY_PAYMENT, ref={}, status=SUCCESS, httpCode={}, durationMs={}",
                    reference, response.getStatusCode().value(), duration);

            return response.getBody();
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - start;
            log.error("[NOTCHPAY_METRICS] action=VERIFY_PAYMENT, ref={}, status=ERROR, error={}, durationMs={}",
                    reference, e.getMessage(), duration);
            throw new NotchPayServiceException("Impossible de vérifier la transaction " + reference + " auprès de NotchPay : " + e.getMessage(), e);
        }
    }

    private HttpHeaders createHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE);

        if (publicKey != null && !publicKey.isBlank()) {
            headers.set(HttpHeaders.AUTHORIZATION, publicKey.trim());
        }
        if (privateKey != null && !privateKey.isBlank()) {
            headers.set("X-Grant", privateKey.trim());
        }
        return headers;
    }
}
