package com.getjob.backend.cv.interview.service;

import com.getjob.backend.candidate.domain.CandidateEntity;
import com.getjob.backend.candidate.repository.CandidateRepository;
import com.getjob.backend.cv.domain.CvEntity;
import com.getjob.backend.cv.interview.domain.CvInterviewSessionEntity;
import com.getjob.backend.cv.interview.repository.CvInterviewSessionRepository;
import com.getjob.backend.cv.repository.CvRepository;
import com.getjob.backend.cv.service.CvDraftValidator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CvInterviewBillingServiceTest {
    @Mock CandidateRepository candidateRepository;
    @Mock CvInterviewSessionRepository sessionRepository;
    @Mock CvRepository cvRepository;
    @Mock CvDraftValidator cvDraftValidator;
    @InjectMocks CvInterviewBillingService billingService;

    @Test
    void completionBillsOnceWithoutReplacingFinalCvWithStaleDraft() {
        CandidateEntity candidate = CandidateEntity.builder().id(15).proCredits(2).build();
        CvInterviewSessionEntity session = CvInterviewSessionEntity.builder()
                .id("sess_1").cvId(37L).candidateId(15)
                .cvDataSoFar("{\"summary\":\"stale\"}").build();
        CvEntity cv = CvEntity.builder().id(37L).status("DRAFT_READY")
                .interviewStatus("COMPLETED").contentJson("{\"summary\":\"final\"}").build();
        when(sessionRepository.findById("sess_1")).thenReturn(Optional.of(session));
        when(candidateRepository.findById(15)).thenReturn(Optional.of(candidate));
        when(cvRepository.findById(37L)).thenReturn(Optional.of(cv));

        CvInterviewBillingService.LiveSessionState state = billingService.startSession("sess_1", 37L, candidate);
        state.setStartedAt(Instant.now().minusSeconds(20));
        billingService.terminateAndBill("sess_1", "COMPLETED");

        verify(candidateRepository).debitProCreditsBounded(15, 1);
        assertEquals("{\"summary\":\"final\"}", cv.getContentJson());
        assertEquals("COMPLETED", cv.getInterviewStatus());
        billingService.terminateAndBill("sess_1", "COMPLETED");
        verify(candidateRepository, times(1)).debitProCreditsBounded(15, 1);
    }
}
