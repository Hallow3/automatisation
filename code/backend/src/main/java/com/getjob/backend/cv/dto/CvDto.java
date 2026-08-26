package com.getjob.backend.cv.dto;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CvDto {
    private String id;
    private String title;
    private String template;
    private String templateLabel;
    private String status;
    private String contentJson;
    private String createdAt;
    private String updatedAt;
}
