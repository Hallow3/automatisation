package com.getjob.backend.payment.dto;

import com.getjob.backend.payment.domain.PaymentStatus;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentCallbackDto {

    private String reference;
    private String externalTransactionId;
    private PaymentStatus status;
    private String signature;
    private String message;
}
