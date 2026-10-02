package com.getjob.backend.cv.interview.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.getjob.backend.ai.service.GeminiLiveTokenService;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CvWriterServiceTest {

    @Test
    void keepsAccountIdentityAndOptionalDetailsWhenWriterOmitsThem() {
        GeminiLiveTokenService tokenService = mock(GeminiLiveTokenService.class);
        when(tokenService.generateStructuredContent(anyString(), anyString())).thenReturn("""
                {"identity":{"fullName":"Mohamed","email":"wrong@example.com"},"summary":"Profil rédigé"}
                """);
        CvWriterService writer = new CvWriterService(tokenService, new ObjectMapper());
        Map<String, Object> source = Map.of(
                "identity", Map.of("fullName", "Mohamed Bryant Waffo", "email", "user@example.com"),
                "personalQualities", List.of("Autonomie"),
                "interests", List.of("Lecture")
        );

        Map<String, Object> result = writer.finalizeCv(source);

        @SuppressWarnings("unchecked")
        Map<String, Object> identity = (Map<String, Object>) result.get("identity");
        assertEquals("Mohamed Bryant Waffo", identity.get("fullName"));
        assertEquals("user@example.com", identity.get("email"));
        assertEquals(List.of("Autonomie"), result.get("personalQualities"));
        assertEquals(List.of("Lecture"), result.get("interests"));
    }
}
