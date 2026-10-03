package com.getjob.backend.candidate.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.getjob.backend.candidate.domain.CandidateEntity;
import com.getjob.backend.candidate.domain.CandidateProfileEntity;
import com.getjob.backend.candidate.dto.AutomationSettingsDto;
import com.getjob.backend.candidate.dto.CandidateProfileDto;
import com.getjob.backend.candidate.repository.CandidateProfileRepository;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CandidateProfileServiceTest {
    @Mock CandidateRepository candidateRepository;
    @Mock CandidateProfileRepository profileRepository;

    private final ObjectMapper mapper = new ObjectMapper();
    private CandidateProfileService service;

    @BeforeEach
    void setUp() {
        service = new CandidateProfileService(candidateRepository, profileRepository, mapper);
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
    void forgedMailboxConnectionIsNeverAccepted() throws Exception {
        when(profileRepository.findByCandidateId(7)).thenReturn(Optional.empty());
        AutomationSettingsDto requested = AutomationSettingsDto.builder()
                .searchEnabled(true)
                .autoApplyEnabled(true)
                .dailyCreditBudget(5)
                .mailboxProvider("GMAIL")
                .mailboxAddress("candidate@gmail.com")
                .mailboxConnected(true)
                .build();

        CandidateProfileDto saved = service.updateProfile(CandidateProfileDto.builder().automation(requested).build());

        assertThat(saved.getAutomation().isMailboxConnected()).isFalse();
        org.mockito.ArgumentCaptor<CandidateProfileEntity> captor = org.mockito.ArgumentCaptor.forClass(CandidateProfileEntity.class);
        verify(profileRepository).save(captor.capture());
        assertThat(mapper.readTree(captor.getValue().getRawData()).path("automation").path("mailboxConnected").asBoolean()).isFalse();
    }

    @Test
    void budgetOutsideAllowedRangeIsRejected() {
        when(profileRepository.findByCandidateId(7)).thenReturn(Optional.empty());
        AutomationSettingsDto requested = AutomationSettingsDto.builder().dailyCreditBudget(6).build();

        assertThatThrownBy(() -> service.updateProfile(CandidateProfileDto.builder().automation(requested).build()))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
    }
}
