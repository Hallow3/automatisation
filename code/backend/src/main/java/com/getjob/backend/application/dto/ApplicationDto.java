package com.getjob.backend.application.dto;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ApplicationDto {
    private String id;
    private String opportunityId;
    private String company;
    private String title;
    private String status;
    private String channel;
    private String appliedAt;
    private String lastActivityAt;
}
