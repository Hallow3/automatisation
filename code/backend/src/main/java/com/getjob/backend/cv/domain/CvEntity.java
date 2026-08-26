package com.getjob.backend.cv.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "cv")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CvEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "candidate_id", nullable = false)
    private Integer candidateId;

    @Column(name = "template_id")
    private Long templateId;

    @Column(nullable = false)
    private String title;

    @Column(name = "content_json", columnDefinition = "json")
    private String contentJson;

    @Column(nullable = false)
    private String status;

    @Column(name = "interview_status")
    private String interviewStatus;

    @Column(name = "pdf_minio_key")
    private String pdfMinioKey;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
