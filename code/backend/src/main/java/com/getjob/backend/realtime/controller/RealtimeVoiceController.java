package com.getjob.backend.realtime.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/voice")
@RequiredArgsConstructor
public class RealtimeVoiceController {

    @Value("${openai.api-key:mock_key}")
    private String openAiApiKey;

    @PostMapping("/session")
    public ResponseEntity<Map<String, Object>> createSession() {
        // Ephemeral session token endpoint matching section 21.2 & 40 of PROMPT_DASHBOARD_AI.md
        // Protects secret key on server, issues ephemeral client secret to Angular WebRTC client
        Map<String, Object> response = Map.of(
                "client_secret", Map.of("value", "ephemeral_token_simulated_" + System.currentTimeMillis()),
                "model", "gpt-4o-realtime-preview"
        );
        return ResponseEntity.ok(response);
    }
}
