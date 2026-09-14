package com.getjob.backend.payment.dto;

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
public class NotchPayWebhookPayload {

    private String id;

    @JsonProperty("event_id")
    private String eventId;

    private String event;

    private String type;

    private Map<String, Object> data;

    public String resolveEventId() {
        if (id != null && !id.isBlank()) return id.trim();
        if (eventId != null && !eventId.isBlank()) return eventId.trim();
        if (data != null && data.get("id") != null) return "evt_" + data.get("id");
        return null;
    }

    public String resolveEventType() {
        if (event != null && !event.isBlank()) return event.trim().toLowerCase();
        if (type != null && !type.isBlank()) return type.trim().toLowerCase();
        return "unknown";
    }

    public String resolveReference() {
        if (data != null && data.get("reference") != null) {
            return String.valueOf(data.get("reference")).trim();
        }
        return null;
    }

    public String resolveStatus() {
        if (data != null && data.get("status") != null) {
            return String.valueOf(data.get("status")).trim().toLowerCase();
        }
        return null;
    }

    public BigDecimal resolveAmount() {
        if (data != null && data.get("amount") != null) {
            try {
                return new BigDecimal(data.get("amount").toString());
            } catch (Exception ignored) {}
        }
        return null;
    }

    public String resolveCurrency() {
        if (data != null && data.get("currency") != null) {
            return String.valueOf(data.get("currency")).toUpperCase();
        }
        return "XAF";
    }

    public String resolveExternalTransactionId() {
        if (data != null && data.get("transaction_id") != null) {
            return String.valueOf(data.get("transaction_id"));
        }
        if (data != null && data.get("id") != null) {
            return String.valueOf(data.get("id"));
        }
        return null;
    }
}
