package com.getjob.backend.candidate.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AutomationSettingsDto {
    private boolean searchEnabled;
    private boolean autoApplyEnabled;
    private boolean coverLetterEnabled;
    private boolean whatsappEnabled;
    private int dailyCreditBudget;
    private String mailboxProvider;
    private String mailboxAddress;
    // Aucune autorisation d'envoi ne peut être déduite d'une simple adresse saisie.
    private boolean mailboxConnected;
}
