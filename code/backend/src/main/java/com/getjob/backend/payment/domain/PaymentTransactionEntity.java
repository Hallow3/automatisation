package com.getjob.backend.payment.domain;

import com.getjob.backend.candidate.domain.CandidateEntity;
import com.getjob.backend.cv.domain.CvEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "payment_transaction")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentTransactionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String reference;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "candidate_id", nullable = false)
    private CandidateEntity candidate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cv_id")
    private CvEntity cv;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private PaymentType type;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 8)
    private String currency;

    @Column(name = "country_code", nullable = false, length = 4)
    private String countryCode;

    @Column(nullable = false, length = 32)
    private String operator;

    @Column(name = "phone_number", length = 32)
    private String phoneNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    @Builder.Default
    private PaymentStatus status = PaymentStatus.PENDING;

    @Column(length = 32)
    @Builder.Default
    private String gateway = "NOTCHPAY";

    @Column(name = "credits_granted", nullable = false)
    @Builder.Default
    private Integer creditsGranted = 0;

    @Column(name = "external_transaction_id", length = 128)
    private String externalTransactionId;

    @Column(name = "client_name", length = 128)
    private String clientName;

    @Column(name = "client_phone", length = 32)
    private String clientPhone;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
