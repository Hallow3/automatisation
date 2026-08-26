package com.getjob.backend.cv.controller;

import com.getjob.backend.cv.dto.CvDto;
import com.getjob.backend.cv.service.CvService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class CvController {

    private final CvService cvService;

    @GetMapping("/cvs")
    public ResponseEntity<List<CvDto>> getCvs() {
        return ResponseEntity.ok(cvService.getAllCvs());
    }

    @GetMapping("/cvs/{id}")
    public ResponseEntity<CvDto> getCv(@PathVariable String id) {
        return cvService.getCvById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/cvs")
    public ResponseEntity<CvDto> createCv(@RequestBody CvDto cv) {
        return ResponseEntity.ok(cvService.createCv(cv));
    }

    @DeleteMapping("/cvs/{id}")
    public ResponseEntity<Void> deleteCv(@PathVariable String id) {
        cvService.deleteCv(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/cv-templates")
    public ResponseEntity<List<Map<String, Object>>> getTemplates() {
        return ResponseEntity.ok(cvService.getTemplates());
    }

    @PostMapping("/cvs/{id}/interview/session")
    public ResponseEntity<Map<String, String>> createInterviewSession(@PathVariable String id) {
        return ResponseEntity.ok(cvService.createInterviewSession(id));
    }

    @PutMapping("/cvs/{id}/draft")
    public ResponseEntity<CvDto> updateDraft(@PathVariable String id, @RequestBody Object draftData) {
        return ResponseEntity.ok(cvService.updateDraft(id, draftData));
    }

    @PostMapping("/cvs/{id}/interview/complete")
    public ResponseEntity<Map<String, Object>> completeInterview(@PathVariable String id) {
        return ResponseEntity.ok(cvService.completeInterview(id));
    }

    @PostMapping("/cvs/{id}/synthesize")
    public ResponseEntity<CvDto> synthesizeFromTranscript(@PathVariable String id, @RequestBody Map<String, Object> payload) {
        String transcript = (String) payload.get("transcript");
        return ResponseEntity.ok(cvService.synthesizeCvFromTranscript(id, transcript));
    }

    @PostMapping("/cvs/{id}/ai-edit")
    public ResponseEntity<CvDto> aiEditCv(
            @PathVariable String id,
            @RequestBody Map<String, Object> payload
    ) {
        String prompt = (String) payload.get("prompt");
        Object currentData = payload.get("currentData");
        return ResponseEntity.ok(cvService.aiEditCv(id, prompt, currentData));
    }

    @PostMapping("/cvs/import")
    public ResponseEntity<CvDto> importCv(
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file
    ) {
        return ResponseEntity.ok(cvService.importCvFromFile(file));
    }
}
