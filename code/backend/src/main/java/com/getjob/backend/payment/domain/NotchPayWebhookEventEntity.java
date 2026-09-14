package com.getjob.backend.payment.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "notchpay_webhook_event")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NotchPayWebhookEventEntity {

    @Id
    @Column(name = "event_id", length = 128, nullable = false)
    private String eventId;

    @Column(name = "event_type", length = 64, nullable = false)
    private String eventType;

    @Column(length = 64)
    private String reference;

    @Column(length = 32)
    private String status;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;
}
