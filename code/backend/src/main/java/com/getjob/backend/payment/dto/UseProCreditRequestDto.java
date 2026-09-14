package com.getjob.backend.payment.dto;

import jakarta.validation.constraints.NotNull;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UseProCreditRequestDto {

    @NotNull(message = "L'identifiant du CV est obligatoire")
    private Long cvId;

    private String clientName;

    private String clientPhone;
}
