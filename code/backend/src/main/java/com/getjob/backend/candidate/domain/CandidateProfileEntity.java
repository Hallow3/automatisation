package com.getjob.backend.candidate.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "candidate_profile")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CandidateProfileEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "candidate_id", nullable = false, unique = true)
    private Integer candidateId;

    @Column(name = "raw_data", columnDefinition = "json")
    private String rawData;

    @Column(name = "cv_minio_key")
    private String cvMinioKey;

    @Column(name = "cv_generated")
    private Boolean cvGenerated;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
