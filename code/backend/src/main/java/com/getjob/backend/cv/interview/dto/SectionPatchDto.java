package com.getjob.backend.cv.interview.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
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
@JsonIgnoreProperties(ignoreUnknown = true)
public class SectionPatchDto {
    private String section;
    private Integer section_index;
    private Map<String, Object> patch;
    private List<String> missing_fields;
    private Double completion_score;
    private Boolean ready_for_transition;
    private Boolean user_wants_skip;
    private Boolean user_has_more;
}
