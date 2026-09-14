package com.getjob.backend.candidate.controller;

import com.getjob.backend.candidate.dto.CandidateProfileDto;
import com.getjob.backend.candidate.service.CandidateProfileService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/candidate/profile")
@RequiredArgsConstructor
@Slf4j
public class CandidateProfileController {

    private final CandidateProfileService profileService;

    /**
     * Récupère le profil complet du candidat connecté.
     */
    @GetMapping
    public ResponseEntity<CandidateProfileDto> getProfile() {
        return ResponseEntity.ok(profileService.getProfile());
    }

    /**
     * Met à jour le profil du candidat connecté.
     */
    @PutMapping
    public ResponseEntity<CandidateProfileDto> updateProfile(
            @RequestBody CandidateProfileDto dto
    ) {
        return ResponseEntity.ok(profileService.updateProfile(dto));
    }
}
