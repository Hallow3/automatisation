package com.getjob.backend.payment.domain;

import com.getjob.backend.candidate.domain.CandidateEntity;
import com.getjob.backend.cv.domain.CvEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "cv_unlock")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CvUnlockEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cv_id", nullable = false, unique = true)
    private CvEntity cv;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "candidate_id", nullable = false)
    private CandidateEntity candidate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "transaction_id")
    private PaymentTransactionEntity transaction;

    @Enumerated(EnumType.STRING)
    @Column(name = "unlock_method", nullable = false, length = 32)
    private UnlockMethod unlockMethod;

    @Column(name = "client_name", length = 128)
    private String clientName;

    @Column(name = "unlocked_at", insertable = false, updatable = false)
    private Instant unlockedAt;
}
