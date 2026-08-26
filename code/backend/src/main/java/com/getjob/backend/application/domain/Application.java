package com.getjob.backend.application.domain;

import lombok.*;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Application {
    private String id;
    private String opportunityId;
    private String company;
    private String title;
    private String status;
    private String channel;
    private Instant appliedAt;
    private Instant lastActivityAt;
}
