package com.getjob.backend.cv.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.getjob.backend.ai.service.GeminiLiveTokenService;
import com.getjob.backend.candidate.domain.CandidateEntity;
import com.getjob.backend.candidate.repository.CandidateProfileRepository;
import com.getjob.backend.candidate.repository.CandidateRepository;
import com.getjob.backend.cv.domain.CvEntity;
import com.getjob.backend.cv.interview.domain.CvInterviewSessionEntity;
import com.getjob.backend.cv.interview.repository.CvInterviewSessionRepository;
import com.getjob.backend.cv.repository.CvRepository;
import com.getjob.backend.cv.repository.CvTemplateRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CvServiceSynthesisTest {
    @Mock private CvRepository cvRepository;
    @Mock private CvInterviewSessionRepository interviewSessionRepository;
    @Mock private CvTemplateRepository cvTemplateRepository;
    @Mock private CandidateRepository candidateRepository;
    @Mock private CandidateProfileRepository candidateProfileRepository;
    @Mock private GeminiLiveTokenService tokenService;
    @Mock private ObjectMapper objectMapper;
    @Mock private CvDraftValidator cvDraftValidator;
    @Mock private CvAiOperationsService cvAiOperationsService;
    @InjectMocks private CvService service;

    @AfterEach
    void clearSecurity() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void quotaFailureKeepsSavedTranscriptAndDoesNotReportSuccess() throws Exception {
        CandidateEntity candidate = CandidateEntity.builder().id(15).email("candidate@example.com").build();
        CvEntity cv = CvEntity.builder().id(37L).candidateId(15).interviewStatus("DRAFT_UPDATED")
                .contentJson("{\"identity\":{\"fullName\":\"Candidate\"}}").build();
        CvInterviewSessionEntity session = CvInterviewSessionEntity.builder().id("sess_37").cvId(37L)
                .candidateId(15).fullTranscript("[{\"role\":\"user\",\"text\":\"Je suis développeur Java et Angular depuis plusieurs années et j'ai construit une application de gestion pour mon entreprise.\"}]").build();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(candidate.getEmail(), "", List.of()));
        when(candidateRepository.findByEmail(candidate.getEmail())).thenReturn(Optional.of(candidate));
        when(cvRepository.findById(37L)).thenReturn(Optional.of(cv));
        when(interviewSessionRepository.findFirstByCvIdOrderByCreatedAtDesc(37L)).thenReturn(Optional.of(session));
        when(objectMapper.readTree(session.getFullTranscript()))
                .thenReturn(new ObjectMapper().readTree(session.getFullTranscript()));
        when(tokenService.generateStructuredContent(anyString(), anyString()))
                .thenThrow(new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Quota épuisé"));

        assertThatThrownBy(() -> service.synthesizeCvFromTranscript("37", ""))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode())
                        .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
        verify(cvRepository, never()).save(any());
    }

    @Test
    void recruiterSpeechAloneCannotProduceACv() {
        CandidateEntity candidate = CandidateEntity.builder().id(15).email("candidate@example.com").build();
        CvEntity cv = CvEntity.builder().id(37L).candidateId(15).interviewStatus("IN_PROGRESS").build();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(candidate.getEmail(), "", List.of()));
        when(candidateRepository.findByEmail(candidate.getEmail())).thenReturn(Optional.of(candidate));
        when(cvRepository.findById(37L)).thenReturn(Optional.of(cv));
        when(interviewSessionRepository.findFirstByCvIdOrderByCreatedAtDesc(37L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.synthesizeCvFromTranscript("37",
                "Recruteur: Parlez-moi de votre expérience, vos compétences et votre formation.\nCandidat: Bonjour"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
        verifyNoInteractions(tokenService);
        verify(cvRepository, never()).save(any());
    }

    @Test
    void exhaustedWriterQuotaPreventsStartingAChargedInterview() {
        CandidateEntity candidate = CandidateEntity.builder().id(15).email("candidate@example.com")
                .proCredits(10).build();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(candidate.getEmail(), "", List.of()));
        when(candidateRepository.findByEmail(candidate.getEmail())).thenReturn(Optional.of(candidate));
        when(tokenService.generatePlainTextContent(anyString(), anyString()))
                .thenThrow(new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Quota épuisé"));

        assertThatThrownBy(() -> service.createInterviewSession("new", null))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode())
                        .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
        verify(cvRepository, never()).save(any());
        verify(tokenService, never()).createEphemeralToken();
    }
}
