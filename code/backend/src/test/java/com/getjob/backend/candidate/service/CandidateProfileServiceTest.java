package com.getjob.backend.candidate.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.getjob.backend.candidate.domain.CandidateEntity;
import com.getjob.backend.candidate.domain.CandidateConfigurationEntity;
import com.getjob.backend.candidate.domain.CandidateProfileEntity;
import com.getjob.backend.candidate.domain.CandidateProfileEntity;
import com.getjob.backend.candidate.dto.AutomationSettingsDto;
import com.getjob.backend.candidate.dto.CandidateProfileDto;
import com.getjob.backend.candidate.repository.CandidateProfileRepository;
import com.getjob.backend.candidate.repository.CandidateConfigurationRepository;
import com.getjob.backend.candidate.repository.CandidateRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CandidateProfileServiceTest {
    @Mock CandidateRepository candidateRepository;
    @Mock CandidateProfileRepository profileRepository;
    @Mock CandidateConfigurationRepository configurationRepository;

    private final ObjectMapper mapper = new ObjectMapper();
    private CandidateProfileService service;

    @BeforeEach
    void setUp() {
        service = new CandidateProfileService(candidateRepository, profileRepository, configurationRepository, mapper);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("candidate@example.com", null, java.util.List.of()));
        when(candidateRepository.findByEmail("candidate@example.com"))
                .thenReturn(Optional.of(CandidateEntity.builder().id(7).email("candidate@example.com")
                        .targetRole("Comptable").city("Douala").build()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void configurationIsSavedAndReadFromItsOwnTable() throws Exception {
        when(profileRepository.findByCandidateId(7)).thenReturn(Optional.empty());
        when(configurationRepository.findById(7)).thenReturn(Optional.empty());
        AutomationSettingsDto requested = AutomationSettingsDto.builder()
                .searchEnabled(true)
                .autoApplyEnabled(true)
                .coverLetterEnabled(true)
                .whatsappEnabled(true)
                .dailyCreditBudget(5)
                .mailboxProvider("GMAIL")
                .mailboxAddress("candidate@gmail.com")
                .mailboxConnected(true)
                .build();

        CandidateProfileDto saved = service.updateProfile(CandidateProfileDto.builder()
                .headline("Comptable senior")
                .city("Yaoundé")
                .salaryExpectations("400 000 FCFA / mois")
                .whatsappNumber("+237699123456")
                .notifications(Map.of("emailNewOpportunities", false, "emailWeeklyReport", true))
                .automation(requested)
                .build());

        assertThat(saved.getAutomation().isMailboxConnected()).isFalse();
        org.mockito.ArgumentCaptor<CandidateConfigurationEntity> captor = org.mockito.ArgumentCaptor.forClass(CandidateConfigurationEntity.class);
        verify(configurationRepository).save(captor.capture());
        CandidateConfigurationEntity stored = captor.getValue();
        assertThat(stored.getCandidateId()).isEqualTo(7);
        assertThat(stored.getTargetRole()).isEqualTo("Comptable senior");
        assertThat(stored.getTargetCity()).isEqualTo("Yaoundé");
        assertThat(stored.getSalaryExpectations()).isEqualTo("400 000 FCFA / mois");
        assertThat(stored.getWhatsappNumber()).isEqualTo("+237699123456");
        assertThat(stored.getDailyCreditBudget()).isEqualTo(5);
        assertThat(stored.isSearchEnabled()).isTrue();
        assertThat(stored.isAutoApplyEnabled()).isTrue();
        assertThat(stored.isCoverLetterEnabled()).isTrue();
        assertThat(stored.isWhatsappEnabled()).isTrue();
        assertThat(stored.isEmailNewOpportunities()).isFalse();
        assertThat(stored.isEmailWeeklyReport()).isTrue();
        assertThat(stored.isMailboxConnected()).isFalse();

        when(configurationRepository.findById(7)).thenReturn(Optional.of(stored));
        when(profileRepository.findByCandidateId(7)).thenReturn(Optional.of(CandidateProfileEntity.builder()
                .candidateId(7)
                .rawData("{\"salaryExpectations\":\"ancienne valeur\",\"automation\":{\"dailyCreditBudget\":1}}")
                .build()));
        CandidateProfileDto reloaded = service.getProfile();
        assertThat(reloaded.getHeadline()).isEqualTo("Comptable senior");
        assertThat(reloaded.getSalaryExpectations()).isEqualTo("400 000 FCFA / mois");
        assertThat(reloaded.getAutomation().getMailboxAddress()).isEqualTo("candidate@gmail.com");
        assertThat(reloaded.getAutomation().getDailyCreditBudget()).isEqualTo(5);
        assertThat(reloaded.getNotifications().get("emailWeeklyReport")).isEqualTo(true);
    }

    @Test
    void budgetOutsideAllowedRangeIsRejected() {
        when(profileRepository.findByCandidateId(7)).thenReturn(Optional.empty());
        when(configurationRepository.findById(7)).thenReturn(Optional.empty());
        AutomationSettingsDto requested = AutomationSettingsDto.builder().dailyCreditBudget(6).build();

        assertThatThrownBy(() -> service.updateProfile(CandidateProfileDto.builder().automation(requested).build()))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
    }
}
