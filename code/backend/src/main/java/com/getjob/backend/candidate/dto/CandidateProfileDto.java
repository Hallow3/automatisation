package com.getjob.backend.candidate.dto;

import lombok.*;

import java.util.List;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CandidateProfileDto {
    private Integer candidateId;
    private String fullName;
    private String email;
    private String phone;
    private String city;
    private String headline;
    private String availability;
    private String experienceLevel;
    private String salaryExpectations;
    private List<String> contractTypes;
    private List<String> targetLocations;
    private String remotePreference;
    private String mobility;
    private List<String> skills;
    private String aiInstructions;
    private Map<String, Object> notifications;
    private Integer proCredits;
    private boolean isProAgent;
    private String agentShopName;
}
