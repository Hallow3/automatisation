package com.getjob.backend.cv.interview.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InterviewTurnResponse {
    private String sessionId;
    private String cvId;
    private String currentState;
    private Integer sectionIndex;
    private Integer turnsInSection;
    private String sectionStatus;
    private String interviewStatus;
    private String controlMessage;
    private Map<String, Object> cvDataSoFar;
    private Double completionScore;
    private List<String> missingFields;
    private Boolean sectionTransitionOccurred;
}
