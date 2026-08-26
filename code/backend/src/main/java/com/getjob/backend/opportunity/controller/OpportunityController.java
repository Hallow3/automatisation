package com.getjob.backend.opportunity.controller;

import com.getjob.backend.opportunity.dto.ActionResponseDto;
import com.getjob.backend.opportunity.dto.OpportunityDto;
import com.getjob.backend.opportunity.service.OpportunityService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/opportunities")
@RequiredArgsConstructor
public class OpportunityController {

    private final OpportunityService service;

    @GetMapping
    public ResponseEntity<List<OpportunityDto>> getOpportunities() {
        return ResponseEntity.ok(service.getAllOpportunities());
    }

    @GetMapping("/{id}")
    public ResponseEntity<OpportunityDto> getOpportunity(@PathVariable String id) {
        return service.getOpportunityById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/dismiss")
    public ResponseEntity<ActionResponseDto> dismissOpportunity(@PathVariable String id) {
        return ResponseEntity.ok(service.dismissOpportunity(id));
    }

    @PostMapping("/{id}/prepare")
    public ResponseEntity<ActionResponseDto> prepareApplication(@PathVariable String id) {
        return ResponseEntity.ok(service.prepareApplication(id));
    }

    @PostMapping("/{id}/submit")
    public ResponseEntity<ActionResponseDto> submitApplication(@PathVariable String id) {
        return ResponseEntity.ok(service.submitApplication(id));
    }

    @GetMapping("/{id}/cover-letter")
    public ResponseEntity<Map<String, String>> getCoverLetter(@PathVariable String id) {
        return ResponseEntity.ok(Map.of("url", "/api/v1/documents/cover-letter-" + id + ".pdf"));
    }
}
