package com.getjob.backend.payment.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

import java.math.BigDecimal;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class NotchPayVerificationResponse {

    private String status;

    private String message;

    private Map<String, Object> transaction;

    private Map<String, Object> payment;

    private Map<String, Object> data;

    public String resolvePaymentStatus() {
        if (transaction != null && transaction.get("status") != null) {
            return String.valueOf(transaction.get("status")).trim().toLowerCase();
        }
        if (payment != null && payment.get("status") != null) {
            return String.valueOf(payment.get("status")).trim().toLowerCase();
        }
        if (data != null && data.get("status") != null) {
            return String.valueOf(data.get("status")).trim().toLowerCase();
        }
        if (status != null) {
            return status.trim().toLowerCase();
        }
        return "unknown";
    }

    public BigDecimal resolveAmount() {
        Object rawAmount = null;
        if (transaction != null && transaction.get("amount") != null) {
            rawAmount = transaction.get("amount");
        } else if (payment != null && payment.get("amount") != null) {
            rawAmount = payment.get("amount");
        } else if (data != null && data.get("amount") != null) {
            rawAmount = data.get("amount");
        }

        if (rawAmount != null) {
            try {
                return new BigDecimal(rawAmount.toString());
            } catch (Exception ignored) {}
        }
        return null;
    }

    public String resolveCurrency() {
        if (transaction != null && transaction.get("currency") != null) {
            return String.valueOf(transaction.get("currency")).toUpperCase();
        }
        if (payment != null && payment.get("currency") != null) {
            return String.valueOf(payment.get("currency")).toUpperCase();
        }
        if (data != null && data.get("currency") != null) {
            return String.valueOf(data.get("currency")).toUpperCase();
        }
        return "XAF";
    }

    public String resolveExternalId() {
        if (transaction != null && transaction.get("id") != null) {
            return String.valueOf(transaction.get("id"));
        }
        if (payment != null && payment.get("id") != null) {
            return String.valueOf(payment.get("id"));
        }
        if (data != null && data.get("id") != null) {
            return String.valueOf(data.get("id"));
        }
        return null;
    }

    public boolean isComplete() {
        String s = resolvePaymentStatus();
        return "complete".equals(s) || "paid".equals(s) || "success".equals(s) || "successful".equals(s);
    }
}
