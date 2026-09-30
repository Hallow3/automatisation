package com.getjob.backend.cv.interview.controller;

import com.getjob.backend.candidate.domain.CandidateEntity;
import com.getjob.backend.candidate.repository.CandidateRepository;
import com.getjob.backend.cv.interview.dto.RequestEndInterviewDto;
import com.getjob.backend.cv.interview.service.CvInterviewBillingService;
import com.getjob.backend.cv.interview.service.CvInterviewOrchestratorService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CvInterviewControllerTest {
    @Mock private CvInterviewOrchestratorService orchestratorService;
    @Mock private CandidateRepository candidateRepository;
    @Mock private CvInterviewBillingService billingService;
    @InjectMocks private CvInterviewController controller;

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void rejectedEndRequestDoesNotTerminateOrBillTheSession() {
        CandidateEntity candidate = CandidateEntity.builder().id(7).email("candidate@example.com").build();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(candidate.getEmail(), "", java.util.List.of()));
        when(candidateRepository.findByEmail(candidate.getEmail())).thenReturn(Optional.of(candidate));
        RequestEndInterviewDto.Request request = RequestEndInterviewDto.Request.builder()
                .sessionId("sess_123").build();
        when(orchestratorService.handleRequestEndInterview(request, candidate))
                .thenReturn(RequestEndInterviewDto.Response.builder().approved(false).status("CONTINUE").build());

        var response = controller.requestEndInterview("42", request);

        assertThat(response.getBody().isApproved()).isFalse();
        verifyNoInteractions(billingService);
    }
}
