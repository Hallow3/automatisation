package com.getjob.backend.payment.resilience;

public class NotchPayCircuitBreakerOpenException extends RuntimeException {
    public NotchPayCircuitBreakerOpenException(String message) {
        super(message);
    }
}
