package com.getjob.backend.payment.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class NotchPayPaymentResponse {

    private String status;

    private String message;

    private Integer code;

    @JsonProperty("authorization_url")
    private String authorizationUrl;

    private Map<String, Object> transaction;

    private Map<String, Object> data;

    /**
     * Résout l'URL d'autorisation quel que soit le niveau d'imbrication retourné par NotchPay.
     */
    public String resolveAuthorizationUrl() {
        if (authorizationUrl != null && !authorizationUrl.isBlank()) {
            return authorizationUrl;
        }
        if (transaction != null && transaction.get("authorization_url") != null) {
            return String.valueOf(transaction.get("authorization_url"));
        }
        if (data != null && data.get("authorization_url") != null) {
            return String.valueOf(data.get("authorization_url"));
        }
        return null;
    }
}
