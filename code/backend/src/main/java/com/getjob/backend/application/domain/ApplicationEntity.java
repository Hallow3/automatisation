package com.getjob.backend.application.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "application")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ApplicationEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "candidate_id", nullable = false)
    private Integer candidateId;

    @Column(name = "job_offer_id", nullable = false)
    private Integer jobOfferId;

    private Integer score;

    @Column(name = "rule_score", columnDefinition = "TINYINT")
    private Byte ruleScore;

    @Column(name = "ai_score", columnDefinition = "TINYINT")
    private Byte aiScore;

    @Column(name = "status", nullable = false, columnDefinition = "ENUM")
    private String status;

    @Column(name = "decision_reason", columnDefinition = "TEXT")
    private String decisionReason;

    @Column(name = "evaluation_details", columnDefinition = "json")
    private String evaluationDetails;

    @Column(name = "evaluated_at")
    private Instant evaluatedAt;

    @Column(name = "cover_letter_minio_key")
    private String coverLetterMinioKey;

    @Column(name = "cv_used_minio_key")
    private String cvUsedMinioKey;

    @Column(name = "applied_at")
    private Instant appliedAt;

    @Column(name = "application_channel", columnDefinition = "ENUM")
    private String applicationChannel;

    @Column(name = "last_activity_at")
    private Instant lastActivityAt;
}
