package com.getjob.backend.joboffer.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "job_offer")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JobOfferEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    private String source;

    @Column(name = "external_id")
    private String externalId;

    private String title;
    private String company;
    private String city;
    private String url;

    @Column(name = "contact_email")
    private String contactEmail;

    @Column(name = "contact_phone")
    private String contactPhone;

    @Column(name = "raw_data", columnDefinition = "json")
    private String rawData;

    @Column(name = "scraped_at")
    private Instant scrapedAt;
}
