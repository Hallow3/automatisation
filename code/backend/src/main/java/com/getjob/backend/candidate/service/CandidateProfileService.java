package com.getjob.backend.candidate.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.getjob.backend.candidate.domain.CandidateEntity;
import com.getjob.backend.candidate.domain.CandidateProfileEntity;
import com.getjob.backend.candidate.dto.CandidateProfileDto;
import com.getjob.backend.candidate.repository.CandidateProfileRepository;
import com.getjob.backend.candidate.repository.CandidateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@Service
@Slf4j
@RequiredArgsConstructor
public class CandidateProfileService {

    private final CandidateRepository candidateRepository;
    private final CandidateProfileRepository candidateProfileRepository;
    private final ObjectMapper objectMapper;

    /**
     * Résout l'entité CandidateEntity correspondant à l'utilisateur connecté via le SecurityContext.
     */
    public CandidateEntity resolveCurrentCandidate() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            throw new AccessDeniedException("Aucun utilisateur authentifié dans le contexte.");
        }
        String email = auth.getName();
        return candidateRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Candidat non trouvé pour l'email : " + email));
    }

    /**
     * Récupère le profil complet du candidat connecté.
     */
    @Transactional(readOnly = true)
    public CandidateProfileDto getProfile() {
        CandidateEntity candidate = resolveCurrentCandidate();
        Optional<CandidateProfileEntity> profileOpt = candidateProfileRepository.findByCandidateId(candidate.getId());

        Map<String, Object> rawDataMap = new HashMap<>();
        if (profileOpt.isPresent() && profileOpt.get().getRawData() != null && !profileOpt.get().getRawData().isBlank()) {
            try {
                rawDataMap = objectMapper.readValue(profileOpt.get().getRawData(), new TypeReference<>() {});
            } catch (Exception e) {
                log.warn("Erreur de désérialisation du rawData pour candidateId={}: {}", candidate.getId(), e.getMessage());
            }
        }

        return mapToDto(candidate, rawDataMap);
    }

    /**
     * Met à jour le profil du candidat connecté.
     */
    @Transactional
    public CandidateProfileDto updateProfile(CandidateProfileDto dto) {
        CandidateEntity candidate = resolveCurrentCandidate();

        // 1. Mise à jour des champs de premier niveau sur CandidateEntity
        if (dto.getFullName() != null && !dto.getFullName().isBlank()) {
            candidate.setFullName(dto.getFullName().trim());
        }
        if (dto.getPhone() != null) {
            candidate.setPhone(dto.getPhone().trim());
        }
        if (dto.getCity() != null) {
            candidate.setCity(dto.getCity().trim());
        }
        if (dto.getHeadline() != null) {
            candidate.setTargetRole(dto.getHeadline().trim());
        }
        candidateRepository.save(candidate);

        // 2. Mise à jour de CandidateProfileEntity (JSON rawData)
        CandidateProfileEntity profile = candidateProfileRepository.findByCandidateId(candidate.getId())
                .orElseGet(() -> CandidateProfileEntity.builder()
                        .candidateId(candidate.getId())
                        .cvGenerated(false)
                        .build());

        Map<String, Object> rawDataMap = new HashMap<>();
        if (profile.getRawData() != null && !profile.getRawData().isBlank()) {
            try {
                rawDataMap = objectMapper.readValue(profile.getRawData(), new TypeReference<>() {});
            } catch (Exception e) {
                log.warn("Impossible de parser le rawData existant, initialisation d'un nouveau conteneur : {}", e.getMessage());
            }
        }

        // Fusion des champs spécifiques de profil
        if (dto.getAvailability() != null) rawDataMap.put("availability", dto.getAvailability());
        if (dto.getExperienceLevel() != null) rawDataMap.put("experienceLevel", dto.getExperienceLevel());
        if (dto.getSalaryExpectations() != null) rawDataMap.put("salaryExpectations", dto.getSalaryExpectations());
        if (dto.getContractTypes() != null) rawDataMap.put("contractTypes", dto.getContractTypes());
        if (dto.getTargetLocations() != null) rawDataMap.put("targetLocations", dto.getTargetLocations());
        if (dto.getRemotePreference() != null) rawDataMap.put("remotePreference", dto.getRemotePreference());
        if (dto.getMobility() != null) rawDataMap.put("mobility", dto.getMobility());
        if (dto.getSkills() != null) rawDataMap.put("skills", dto.getSkills());
        if (dto.getAiInstructions() != null) rawDataMap.put("aiInstructions", dto.getAiInstructions());
        if (dto.getNotifications() != null) rawDataMap.put("notifications", dto.getNotifications());

        try {
            profile.setRawData(objectMapper.writeValueAsString(rawDataMap));
        } catch (Exception e) {
            log.error("Erreur de sérialisation JSON pour candidateId={}: {}", candidate.getId(), e.getMessage());
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Erreur lors de la sauvegarde du profil");
        }

        candidateProfileRepository.save(profile);
        log.info("Profil sauvegardé avec succès pour candidateId={}", candidate.getId());

        return mapToDto(candidate, rawDataMap);
    }

    @SuppressWarnings("unchecked")
    private CandidateProfileDto mapToDto(CandidateEntity candidate, Map<String, Object> rawData) {
        List<String> contractTypes = rawData.get("contractTypes") instanceof List<?> list
                ? (List<String>) list
                : List.of("CDI", "Temps plein");

        List<String> targetLocations = rawData.get("targetLocations") instanceof List<?> list
                ? (List<String>) list
                : Collections.emptyList();

        List<String> skills = rawData.get("skills") instanceof List<?> list
                ? (List<String>) list
                : Collections.emptyList();

        Map<String, Object> notifications = rawData.get("notifications") instanceof Map<?, ?> notif
                ? (Map<String, Object>) notif
                : Map.of("emailNewOpportunities", true, "emailWeeklyReport", false, "interviewReminders", true);

        return CandidateProfileDto.builder()
                .candidateId(candidate.getId())
                .fullName(candidate.getFullName())
                .email(candidate.getEmail())
                .phone(candidate.getPhone() != null ? candidate.getPhone() : "")
                .city(candidate.getCity() != null ? candidate.getCity() : "")
                .headline(candidate.getTargetRole() != null ? candidate.getTargetRole() : "")
                .availability((String) rawData.getOrDefault("availability", "Disponible"))
                .experienceLevel((String) rawData.getOrDefault("experienceLevel", ""))
                .salaryExpectations((String) rawData.getOrDefault("salaryExpectations", ""))
                .contractTypes(contractTypes)
                .targetLocations(targetLocations)
                .remotePreference((String) rawData.getOrDefault("remotePreference", ""))
                .mobility((String) rawData.getOrDefault("mobility", ""))
                .skills(skills)
                .aiInstructions((String) rawData.getOrDefault("aiInstructions", ""))
                .notifications(notifications)
                .proCredits(candidate.getProCredits() != null ? candidate.getProCredits() : 0)
                .isProAgent(candidate.isProAgent())
                .agentShopName(candidate.getAgentShopName())
                .build();
    }
}
