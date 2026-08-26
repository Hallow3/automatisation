package com.getjob.backend.cv.domain;

import lombok.*;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Cv {
    private String id;
    private String title;
    private String template;
    private String templateLabel;
    private String status;
    private String contentJson;
    private Instant createdAt;
    private Instant updatedAt;
}
