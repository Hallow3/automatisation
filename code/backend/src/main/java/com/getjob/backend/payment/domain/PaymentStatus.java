package com.getjob.backend.payment.domain;

public enum PaymentStatus {
    PENDING,
    SUCCESS,
    FAILED,
    CANCELLED,
    EXPIRED,
    FALLBACK_WHATSAPP
}
