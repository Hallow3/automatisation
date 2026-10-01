package com.getjob.backend.ai.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GeminiLiveTokenServiceTest {

    @Mock private RestTemplate restTemplate;
    private GeminiLiveTokenService service;

    @BeforeEach
    void setUp() {
        service = new GeminiLiveTokenService(restTemplate);
        ReflectionTestUtils.setField(service, "geminiApiKeysRaw", "key-a,key-b");
        ReflectionTestUtils.setField(service, "geminiApiKeySingle", "");
        ReflectionTestUtils.setField(service, "geminiModel", "gemini-live-test");
        ReflectionTestUtils.setField(service, "geminiTextModel", "gemini-text-test");
        service.init();
    }

    @Test
    void rotatesToNextKeyWhenFirstKeyIsRateLimited() {
        Map<String, Object> response = Map.of(
                "candidates", List.of(Map.of(
                        "content", Map.of("parts", List.of(Map.of("text", "{\"ok\":true}")))
                ))
        );
        when(restTemplate.postForObject(anyString(), any(), eq(Map.class)))
                .thenThrow(HttpClientErrorException.create(HttpStatus.TOO_MANY_REQUESTS, "Too Many Requests", null, null, null))
                .thenReturn(response);

        String result = service.generateStructuredContent("system", "user");

        assertThat(result).isEqualTo("{\"ok\":true}");
        verify(restTemplate, times(2)).postForObject(anyString(), any(), eq(Map.class));
        assertThat(service.getFirstAvailableKey()).isEqualTo("key-a");
    }

    @Test
    void allFailedKeysBecomeServiceUnavailable() {
        when(restTemplate.postForObject(anyString(), any(), eq(Map.class)))
                .thenThrow(HttpClientErrorException.create(HttpStatus.TOO_MANY_REQUESTS, "Too Many Requests", null, null, null));

        assertThatThrownBy(() -> service.generateStructuredContent("system", "user"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Service IA temporairement indisponible");
        verify(restTemplate, times(2)).postForObject(anyString(), any(), eq(Map.class));
    }

    @Test
    void configuredModelsAreExposedSeparatelyForLiveAndTextCalls() {
        assertThat(service.getModel()).isEqualTo("gemini-live-test");
        assertThat(service.getTextModel()).isEqualTo("gemini-text-test");
        assertThat(service.getKeyCount()).isEqualTo(2);
    }

    @Test
    void emptyGeminiPoolFailsClearly() {
        ReflectionTestUtils.setField(service, "geminiApiKeysRaw", "");
        ReflectionTestUtils.setField(service, "geminiApiKeySingle", "");
        service.init();

        assertThatThrownBy(service::createEphemeralToken)
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("aucune clé API configurée");
    }
}
