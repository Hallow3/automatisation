package com.getjob.backend.cv.interview.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

public class RequestEndInterviewDto {

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class Request {
        private String sessionId;
        private String cvId;
        private String reason;
        private String userIntentExcerpt;
        private String lastUserTurn;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class Response {
        private boolean approved;
        private String reason;
        private String status;
        private String instruction;
    }
}
