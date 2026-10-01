package com.getjob.backend.cv.interview.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.getjob.backend.cv.interview.repository.CvInterviewSessionRepository;
import com.getjob.backend.cv.repository.CvRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CvInterviewStreamServiceTest {

    @Mock private InterviewObserverService observerService;
    @Mock private CvInterviewSessionRepository sessionRepository;
    @Mock private CvRepository cvRepository;
    @Mock private org.springframework.transaction.PlatformTransactionManager transactionManager;

    private CvInterviewStreamService service;

    @AfterEach
    void cleanup() {
        if (service != null) {
            ((ConcurrentHashMap<?, ?>) ReflectionTestUtils.getField(service, "emitters")).clear();
        }
    }

    @Test
    void createEmitterRegistersConnectionAndReplacesPreviousConnection() {
        service = new CvInterviewStreamService(
                observerService, sessionRepository, cvRepository, new ObjectMapper(), transactionManager);

        SseEmitter first = service.createEmitter("sess_1");
        SseEmitter second = service.createEmitter("sess_1");

        @SuppressWarnings("unchecked")
        ConcurrentHashMap<String, SseEmitter> emitters =
                (ConcurrentHashMap<String, SseEmitter>) ReflectionTestUtils.getField(service, "emitters");
        assertThat(emitters).containsEntry("sess_1", second);
        assertThat(emitters).doesNotContainValue(first);
    }

    @Test
    void publishSnapshotForUnknownSessionDoesNothing() {
        service = new CvInterviewStreamService(
                observerService, sessionRepository, cvRepository, new ObjectMapper(), transactionManager);

        service.publishCvSnapshot("missing", Map.of("headline", "Backend Java"));

        verifyNoInteractions(observerService, sessionRepository, cvRepository, transactionManager);
    }

    @Test
    void missingSessionIsIgnoredWhenProcessingAsyncSegment() {
        service = new CvInterviewStreamService(
                observerService, sessionRepository, cvRepository, new ObjectMapper(), transactionManager);
        when(sessionRepository.findById("missing")).thenReturn(java.util.Optional.empty());

        service.processSegmentAsync("42", "missing", "Mon expérience");

        verify(sessionRepository).findById("missing");
        verifyNoInteractions(observerService, cvRepository, transactionManager);
    }

    @Test
    void publishSnapshotKeepsLiveEmitterRegistered() {
        service = new CvInterviewStreamService(
                observerService, sessionRepository, cvRepository, new ObjectMapper(), transactionManager);
        service.createEmitter("sess_2");
        service.publishCvSnapshot("sess_2", Map.of("headline", "Backend Java"));

        @SuppressWarnings("unchecked")
        ConcurrentHashMap<String, SseEmitter> emitters =
                (ConcurrentHashMap<String, SseEmitter>) ReflectionTestUtils.getField(service, "emitters");
        assertThat(emitters).containsKey("sess_2");
    }
}
