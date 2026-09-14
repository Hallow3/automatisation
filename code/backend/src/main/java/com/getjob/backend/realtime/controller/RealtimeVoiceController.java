package com.getjob.backend.realtime.controller;

import com.getjob.backend.cv.service.CvService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/voice")
@RequiredArgsConstructor
@Slf4j
public class RealtimeVoiceController {

    private final CvService cvService;

    /**
     * Crée une session vocale temps réel sécurisée, sous contrôle du quota journalier (3/jour).
     */
    @PostMapping("/session")
    public ResponseEntity<Map<String, String>> createSession() {
        log.info("POST /api/v1/voice/session -> sécurisation via CvService.createInterviewSession");
        Map<String, String> tokenInfo = cvService.createInterviewSession("latest");
        return ResponseEntity.ok(tokenInfo);
    }
}
