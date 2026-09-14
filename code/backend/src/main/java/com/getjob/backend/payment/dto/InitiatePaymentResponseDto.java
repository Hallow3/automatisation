package com.getjob.backend.payment.dto;

import com.getjob.backend.payment.domain.PaymentStatus;
import lombok.*;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InitiatePaymentResponseDto {

    private String reference;
    private PaymentStatus status;
    private BigDecimal amount;
    private String currency;
    private String operator;
    private String phoneNumber;
    private String message;
    private String ussdPrompt;
    private String checkoutUrl;

    // Fallback WhatsApp
    @Builder.Default
    private boolean fallbackWhatsApp = false;
    private String whatsAppUrl;
    private String whatsAppNumber;
}
