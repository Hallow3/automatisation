package com.getjob.backend.opportunity.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ActionResponseDto {
    private boolean success;
    private String message;

    public ActionResponseDto(boolean success) {
        this.success = success;
        this.message = success ? "Operation completed successfully" : "Operation failed";
    }
}
