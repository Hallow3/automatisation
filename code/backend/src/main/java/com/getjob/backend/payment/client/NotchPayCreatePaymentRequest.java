package com.getjob.backend.payment.client;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

import java.math.BigDecimal;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class NotchPayCreatePaymentRequest {

    private BigDecimal amount;

    private String currency;

    private Customer customer;

    private String reference;

    private String callback;

    private String description;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Customer {
        private String name;
        private String email;
        private String phone;
    }
}
