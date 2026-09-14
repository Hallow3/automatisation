package com.getjob.backend.payment.resilience;

public class NotchPayServiceException extends RuntimeException {
    public NotchPayServiceException(String message) {
        super(message);
    }

    public NotchPayServiceException(String message, Throwable cause) {
        super(message, cause);
    }
}
