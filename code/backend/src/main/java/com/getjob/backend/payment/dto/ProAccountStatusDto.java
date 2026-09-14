package com.getjob.backend.payment.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProAccountStatusDto {

    private boolean isProAgent;
    private Integer proCredits;
    private String agentShopName;
    private long totalUnlockedCvs;
}
