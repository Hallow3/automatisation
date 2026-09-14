package com.getjob.backend.payment.resilience;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Circuit Breaker autonome et thread-safe pour protéger l'application
 * contre les instabilités chroniques de l'API NotchPay.
 */
@Component
@Slf4j
public class NotchPayCircuitBreaker {

    public enum State {
        CLOSED,     // Nominal : appels autorisés vers l'API
        OPEN,       // Bloqué : API considérée en panne, bascule directe en fallback WhatsApp
        HALF_OPEN   // Essai : un appel test est autorisé pour vérifier le rétablissement
    }

    private final int failureThreshold;
    private final long openDurationMs;

    private final AtomicReference<State> state = new AtomicReference<>(State.CLOSED);
    private final AtomicInteger consecutiveFailures = new AtomicInteger(0);
    private final AtomicLong lastFailureTimestamp = new AtomicLong(0);

    public NotchPayCircuitBreaker(
            @Value("${payment.notchpay.circuit-breaker.failure-threshold:3}") int failureThreshold,
            @Value("${payment.notchpay.circuit-breaker.wait-duration-in-open-ms:60000}") long openDurationMs
    ) {
        this.failureThreshold = failureThreshold;
        this.openDurationMs = openDurationMs;
    }

    /**
     * Vérifie si un appel à NotchPay peut être tenté.
     */
    public boolean canExecute() {
        State current = state.get();
        if (current == State.CLOSED) {
            return true;
        }

        if (current == State.OPEN) {
            long elapsed = System.currentTimeMillis() - lastFailureTimestamp.get();
            if (elapsed >= openDurationMs) {
                if (state.compareAndSet(State.OPEN, State.HALF_OPEN)) {
                    log.info("[NOTCHPAY_CIRCUIT_BREAKER] Temporisation écoulée ({}ms). Transition OPEN -> HALF_OPEN (essai en cours)", elapsed);
                    return true;
                }
            }
            return false;
        }

        // HALF_OPEN : permet l'essai en cours
        return true;
    }

    /**
     * Enregistre un succès d'appel vers l'API NotchPay.
     */
    public void recordSuccess() {
        consecutiveFailures.set(0);
        State previous = state.getAndSet(State.CLOSED);
        if (previous != State.CLOSED) {
            log.info("[NOTCHPAY_CIRCUIT_BREAKER] Appel réussi. Circuit rétabli : {} -> CLOSED", previous);
        }
    }

    /**
     * Enregistre un échec d'appel (timeout, 5xx, erreur réseau).
     */
    public void recordFailure() {
        lastFailureTimestamp.set(System.currentTimeMillis());
        int failures = consecutiveFailures.incrementAndGet();

        State current = state.get();
        if (current == State.HALF_OPEN) {
            state.set(State.OPEN);
            log.warn("[NOTCHPAY_CIRCUIT_BREAKER] Échec lors de la tentative en HALF_OPEN. Retour à l'état OPEN pour {}ms", openDurationMs);
        } else if (failures >= failureThreshold) {
            if (state.compareAndSet(State.CLOSED, State.OPEN)) {
                log.error("[NOTCHPAY_CIRCUIT_BREAKER] Seuil d'échecs consécutifs atteint ({} failures). Circuit OUVERT (CLOSED -> OPEN). Bascule automatique en fallback WhatsApp active.", failures);
            }
        } else {
            log.warn("[NOTCHPAY_CIRCUIT_BREAKER] Échec d'appel NotchPay ({}/{}).", failures, failureThreshold);
        }
    }

    public State getState() {
        return state.get();
    }

    public void reset() {
        consecutiveFailures.set(0);
        state.set(State.CLOSED);
    }
}
