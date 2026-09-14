package com.getjob.backend.payment.dto;

import com.getjob.backend.payment.domain.PaymentType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InitiatePaymentRequestDto {

    private Long cvId;

    @NotNull(message = "Le type de paiement est obligatoire (SINGLE_CV ou PRO_PACK)")
    private PaymentType type;

    private String packId;

    private BigDecimal amount;

    private String currency;

    @NotBlank(message = "Le code pays est obligatoire (CI, SN, CM, etc.)")
    private String countryCode;

    @NotBlank(message = "L'opérateur de paiement est obligatoire (WAVE, ORANGE, MTN...)")
    private String operator;

    private String phoneNumber;

    private String clientName;

    private String clientPhone;
}
