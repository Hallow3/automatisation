package com.getjob.backend.cv.interview.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Entité de persistance de session d'entretien vocal (Spec V2).
 * Conserve l'état de la State Machine, la transcription, l'état partiel et les données CV consolidées.
 */
@Entity
@Table(name = "cv_interview_session")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CvInterviewSessionEntity {

    @Id
    @Column(length = 64, nullable = false)
    private String id;

    @Column(name = "cv_id", nullable = false)
    private Long cvId;

    @Column(name = "candidate_id", nullable = false)
    private Integer candidateId;

    @Column(name = "current_state", length = 32, nullable = false)
    private String currentState;

    @Column(name = "section_index", nullable = false)
    @Builder.Default
    private Integer sectionIndex = 0;

    @Column(name = "turns_in_section", nullable = false)
    @Builder.Default
    private Integer turnsInSection = 0;

    @Column(name = "section_status", length = 32, nullable = false)
    @Builder.Default
    private String sectionStatus = "IN_PROGRESS";

    @Column(name = "section_transcript", columnDefinition = "json")
    private String sectionTranscript;

    @Column(name = "full_transcript", columnDefinition = "json")
    private String fullTranscript;

    @Column(name = "section_partial_data", columnDefinition = "json")
    private String sectionPartialData;

    @Column(name = "cv_data_so_far", columnDefinition = "json")
    private String cvDataSoFar;

    @Column(name = "interview_status", length = 32, nullable = false)
    @Builder.Default
    private String interviewStatus = "ACTIVE";

    @Column(name = "last_activity_at", insertable = false, updatable = false)
    private Instant lastActivityAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;
}
