package com.getjob.backend.cv.interview.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.getjob.backend.candidate.domain.CandidateEntity;
import com.getjob.backend.candidate.repository.CandidateRepository;
import com.getjob.backend.cv.interview.domain.CvInterviewSessionEntity;
import com.getjob.backend.cv.interview.dto.InterviewTurnRequest;
import com.getjob.backend.cv.interview.dto.SectionPatchDto;
import com.getjob.backend.cv.interview.repository.CvInterviewSessionRepository;
import com.getjob.backend.cv.repository.CvRepository;
import com.getjob.backend.cv.service.CvDraftValidator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CvInterviewOrchestratorServiceTest {
    @Mock private CvInterviewSessionRepository sessionRepository;
    @Mock private CvRepository cvRepository;
    @Mock private CandidateRepository candidateRepository;
    @Mock private InterviewStateMachineService stateMachine;
    @Mock private InterviewObserverService observerService;
    @Mock private CvWriterService cvWriterService;
    @Mock private CvDraftValidator cvDraftValidator;
    @Spy private ObjectMapper objectMapper = new ObjectMapper();
    @InjectMocks private CvInterviewOrchestratorService service;

    @Test
    void writerFailureKeepsLastTurnWithoutAdvancingSection() {
        CandidateEntity candidate = CandidateEntity.builder().id(15).build();
        CvInterviewSessionEntity session = CvInterviewSessionEntity.builder()
                .id("sess_37").cvId(37L).candidateId(15).currentState("EXPERIENCE")
                .sectionIndex(0).turnsInSection(2).sectionStatus("IN_PROGRESS")
                .fullTranscript("[]").sectionTranscript("[]").sectionPartialData("{}")
                .cvDataSoFar("{\"identity\":{\"fullName\":\"Candidate\"}}")
                .interviewStatus("ACTIVE").build();
        when(sessionRepository.findLockedById("sess_37")).thenReturn(Optional.of(session));
        when(observerService.observeSection(eq("EXPERIENCE"), eq(0), any(), any()))
                .thenReturn(SectionPatchDto.builder().patch(Map.of()).observerUnavailable(true).build());

        var response = service.processTurn(InterviewTurnRequest.builder()
                .sessionId("sess_37").cvId("37").userTurn("J'ai travaillé chez RBA Group")
                .build(), candidate);

        assertThat(response.getInterviewStatus()).isEqualTo("OBSERVER_UNAVAILABLE");
        assertThat(session.getCurrentState()).isEqualTo("EXPERIENCE");
        assertThat(session.getTurnsInSection()).isEqualTo(2);
        assertThat(session.getFullTranscript()).contains("RBA Group");
        assertThat(session.getSectionTranscript()).contains("RBA Group");
        verify(sessionRepository).save(session);
        verifyNoInteractions(cvWriterService);
    }
}
