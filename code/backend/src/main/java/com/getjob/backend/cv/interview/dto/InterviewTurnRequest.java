package com.getjob.backend.cv.interview.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InterviewTurnRequest {
    private String sessionId;
    private String cvId;
    private String userTurn;
    private String aiTurn;
}
