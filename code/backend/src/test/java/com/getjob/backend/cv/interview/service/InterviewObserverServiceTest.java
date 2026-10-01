package com.getjob.backend.cv.interview.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.getjob.backend.ai.service.GeminiLiveTokenService;
import com.getjob.backend.cv.interview.dto.SectionPatchDto;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InterviewObserverServiceTest {

    @Mock
    private GeminiLiveTokenService tokenService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void blankTranscriptReturnsSafeEmptyPatchWithoutCallingGemini() {
        InterviewObserverService service = new InterviewObserverService(tokenService, objectMapper);

        SectionPatchDto result = service.observeSection("IDENTITY", 0, "  ", Map.of());

        assertThat(result.getPatch()).isEmpty();
        assertThat(result.getSection()).isEqualTo("IDENTITY");
        assertThat(result.getSection_index()).isEqualTo(0);
        assertThat(result.getObserverUnavailable()).isNull();
        verifyNoInteractions(tokenService);
    }

    @Test
    void parsesStrictJsonReturnedByGemini() {
        when(tokenService.generateStructuredContent(anyString(), anyString())).thenReturn("""
                {
                  "section": "EXPERIENCE",
                  "section_index": 1,
                  "patch": {"company": "Acme", "position": "Développeur"},
                  "missing_fields": ["dates"],
                  "completion_score": 0.65,
                  "ready_for_transition": false,
                  "user_wants_skip": false,
                  "user_has_more": true
                }
                """);
        InterviewObserverService service = new InterviewObserverService(tokenService, objectMapper);

        SectionPatchDto result = service.observeSection(
                "EXPERIENCE", 1, "J'ai travaillé chez Acme comme développeur.", Map.of());

        assertThat(result.getPatch()).containsEntry("company", "Acme");
        assertThat(result.getPatch()).containsEntry("position", "Développeur");
        assertThat(result.getMissing_fields()).containsExactly("dates");
        assertThat(result.getCompletion_score()).isEqualTo(0.65);
        assertThat(result.getUser_has_more()).isTrue();
        assertThat(result.getObserverUnavailable()).isNull();
    }

    @Test
    void acceptsMarkdownJsonWrapper() {
        when(tokenService.generateStructuredContent(anyString(), anyString())).thenReturn("""
                ```json
                {"section":"TARGET","section_index":0,"patch":{"headline":"Backend Java"},"missing_fields":[],"completion_score":1.0,"ready_for_transition":true,"user_wants_skip":false,"user_has_more":false}
                ```
                """);
        InterviewObserverService service = new InterviewObserverService(tokenService, objectMapper);

        SectionPatchDto result = service.observeSection("TARGET", 0, "Je vise un poste backend Java.", Map.of());

        assertThat(result.getPatch()).containsEntry("headline", "Backend Java");
        assertThat(result.getReady_for_transition()).isTrue();
    }

    @Test
    void GeminiFailureReturnsUnavailablePatchAndPreservesSection() {
        when(tokenService.generateStructuredContent(anyString(), anyString()))
                .thenThrow(new RuntimeException("quota exhausted"));
        InterviewObserverService service = new InterviewObserverService(tokenService, objectMapper);

        SectionPatchDto result = service.observeSection("EDUCATION", 2, "J'ai étudié à l'université.", Map.of());

        assertThat(result.getSection()).isEqualTo("EDUCATION");
        assertThat(result.getSection_index()).isEqualTo(2);
        assertThat(result.getPatch()).isEmpty();
        assertThat(result.getObserverUnavailable()).isTrue();
        assertThat(result.getReady_for_transition()).isFalse();
    }

    @Test
    void malformedJsonIsReportedAsUnavailableInsteadOfBreakingInterview() {
        when(tokenService.generateStructuredContent(anyString(), anyString())).thenReturn("not-json");
        InterviewObserverService service = new InterviewObserverService(tokenService, objectMapper);

        SectionPatchDto result = service.observeSection("SKILLS", 0, "Java et Spring.", Map.of());

        assertThat(result.getObserverUnavailable()).isTrue();
        assertThat(result.getPatch()).isEmpty();
    }
}
