package com.getjob.backend.payment.dto;

import com.getjob.backend.payment.domain.UnlockMethod;
import lombok.*;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CvUnlockStatusDto {

    private Long cvId;
    private boolean unlocked;
    private UnlockMethod unlockMethod;
    private Instant unlockedAt;
    private String clientName;
}
