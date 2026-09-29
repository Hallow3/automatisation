package com.getjob.backend.cv.interview.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

public class HeartbeatDto {

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class Request {
        private String sessionId;
        private String cvId;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class Response {
        private String sessionId;
        private String status; // "ACTIVE" | "EXPIRED"
        private long elapsedSeconds;
        private long remainingSeconds;
        private int remainingCredits;
        private String message;
    }
}
