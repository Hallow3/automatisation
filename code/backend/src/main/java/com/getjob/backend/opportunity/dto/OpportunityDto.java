package com.getjob.backend.opportunity.dto;

import com.getjob.backend.opportunity.domain.ApplicationChannel;
import com.getjob.backend.opportunity.domain.OpportunityStatus;
import lombok.*;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OpportunityDto {
    private String id;
    private String jobOfferId;
    private String title;
    private String company;
    private String city;
    private String source;
    private Integer score;
    private OpportunityStatus status;
    private String publishedAt;
    private String deadline;
    private ApplicationChannel applicationChannel;
    private Boolean coverLetterAvailable;
    private String coverLetterText;
    private List<String> matchedSkills;

    private String matchExplanation;
    private String description;
}
