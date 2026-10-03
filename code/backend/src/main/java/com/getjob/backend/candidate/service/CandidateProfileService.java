package com.getjob.backend.candidate.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.getjob.backend.candidate.domain.CandidateEntity;
import com.getjob.backend.candidate.domain.CandidateConfigurationEntity;
import com.getjob.backend.candidate.domain.CandidateProfileEntity;
import com.getjob.backend.candidate.dto.CandidateProfileDto;
import com.getjob.backend.candidate.dto.AutomationSettingsDto;
import com.getjob.backend.candidate.repository.CandidateProfileRepository;
import com.getjob.backend.candidate.repository.CandidateConfigurationRepository;
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
    private final CandidateConfigurationRepository candidateConfigurationRepository;
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

        CandidateConfigurationEntity configuration = candidateConfigurationRepository.findById(candidate.getId()).orElse(null);
        return mapToDto(candidate, rawDataMap, configuration);
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
        if (dto.getWhatsappNumber() != null) {
            candidate.setWhatsappNumber(dto.getWhatsappNumber().trim());
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

        CandidateConfigurationEntity configuration = candidateConfigurationRepository.findById(candidate.getId()).orElse(null);
        if (configuration == null) configuration = newConfiguration(candidate, rawDataMap);
        if (dto.getHeadline() != null) configuration.setTargetRole(candidate.getTargetRole());
        if (dto.getCity() != null) configuration.setTargetCity(candidate.getCity());
        if (dto.getSalaryExpectations() != null) configuration.setSalaryExpectations(dto.getSalaryExpectations().trim());
        if (dto.getWhatsappNumber() != null) configuration.setWhatsappNumber(candidate.getWhatsappNumber());

        // Les autres champs de profil restent dans candidate_profile.raw_data.
        if (dto.getAvailability() != null) rawDataMap.put("availability", dto.getAvailability());
        if (dto.getExperienceLevel() != null) rawDataMap.put("experienceLevel", dto.getExperienceLevel());
        if (dto.getContractTypes() != null) rawDataMap.put("contractTypes", dto.getContractTypes());
        if (dto.getTargetLocations() != null) rawDataMap.put("targetLocations", dto.getTargetLocations());
        if (dto.getRemotePreference() != null) rawDataMap.put("remotePreference", dto.getRemotePreference());
        if (dto.getMobility() != null) rawDataMap.put("mobility", dto.getMobility());
        if (dto.getSkills() != null) rawDataMap.put("skills", dto.getSkills());
        if (dto.getAiInstructions() != null) rawDataMap.put("aiInstructions", dto.getAiInstructions());
        if (dto.getNotifications() != null) {
            Map<String, Object> notifications = dto.getNotifications();
            if (notifications.get("emailNewOpportunities") instanceof Boolean value) configuration.setEmailNewOpportunities(value);
            if (notifications.get("emailWeeklyReport") instanceof Boolean value) configuration.setEmailWeeklyReport(value);
            if (notifications.get("interviewReminders") instanceof Boolean value) configuration.setInterviewReminders(value);
        }
        if (dto.getAutomation() != null) {
            AutomationSettingsDto settings = dto.getAutomation();
            if (settings.isSearchEnabled() && (configuration.getTargetRole() == null || configuration.getTargetRole().isBlank()
                    || configuration.getTargetCity() == null || configuration.getTargetCity().isBlank())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le poste et la ville sont nécessaires pour la recherche automatique.");
            }
            if (settings.isWhatsappEnabled() && (configuration.getWhatsappNumber() == null || configuration.getWhatsappNumber().isBlank())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Un numéro WhatsApp est nécessaire pour les notifications.");
            }
            if (settings.getDailyCreditBudget() < 1 || settings.getDailyCreditBudget() > 5) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le budget quotidien doit être compris entre 1 et 5 crédits.");
            }
            String provider = settings.getMailboxProvider() == null ? "" : settings.getMailboxProvider().trim().toUpperCase(Locale.ROOT);
            if (!provider.isEmpty() && !Set.of("GMAIL", "OUTLOOK").contains(provider)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fournisseur de messagerie non reconnu.");
            }
            String address = settings.getMailboxAddress() == null ? "" : settings.getMailboxAddress().trim();
            if (provider.isEmpty() != address.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choisissez le type de boîte mail et son adresse.");
            }
            if (!address.isEmpty() && !address.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Adresse de messagerie invalide.");
            }
            configuration.setSearchEnabled(settings.isSearchEnabled());
            configuration.setAutoApplyEnabled(settings.isAutoApplyEnabled());
            configuration.setCoverLetterEnabled(settings.isCoverLetterEnabled());
            configuration.setWhatsappEnabled(settings.isWhatsappEnabled());
            configuration.setDailyCreditBudget(settings.getDailyCreditBudget());
            // Une adresse modifiée invalide une autorisation de messagerie antérieure.
            if (!provider.equals(configuration.getMailboxProvider()) || !address.equals(configuration.getMailboxAddress())) {
                configuration.setMailboxConnected(false);
            }
            configuration.setMailboxProvider(provider);
            configuration.setMailboxAddress(address);
        }

        try {
            profile.setRawData(objectMapper.writeValueAsString(rawDataMap));
        } catch (Exception e) {
            log.error("Erreur de sérialisation JSON pour candidateId={}: {}", candidate.getId(), e.getMessage());
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Erreur lors de la sauvegarde du profil");
        }

        candidateProfileRepository.save(profile);
        candidateConfigurationRepository.save(configuration);
        log.info("Profil sauvegardé avec succès pour candidateId={}", candidate.getId());

        return mapToDto(candidate, rawDataMap, configuration);
    }

    private CandidateConfigurationEntity newConfiguration(CandidateEntity candidate, Map<String, Object> rawData) {
        String legacySalary = rawData.get("salaryExpectations") instanceof String value ? value : "";
        return CandidateConfigurationEntity.builder()
                .candidateId(candidate.getId())
                .targetRole(candidate.getTargetRole() != null ? candidate.getTargetRole() : "")
                .targetCity(candidate.getCity() != null ? candidate.getCity() : "")
                .salaryExpectations(legacySalary)
                .whatsappNumber(candidate.getWhatsappNumber() != null ? candidate.getWhatsappNumber() : "")
                .build();
    }

    @SuppressWarnings("unchecked")
    private CandidateProfileDto mapToDto(CandidateEntity candidate, Map<String, Object> rawData, CandidateConfigurationEntity configuration) {
        List<String> contractTypes = rawData.get("contractTypes") instanceof List<?> list
                ? (List<String>) list
                : List.of("CDI", "Temps plein");

        List<String> targetLocations = rawData.get("targetLocations") instanceof List<?> list
                ? (List<String>) list
                : Collections.emptyList();

        List<String> skills = rawData.get("skills") instanceof List<?> list
                ? (List<String>) list
                : Collections.emptyList();

        Map<String, Object> notifications = configuration != null
                ? Map.of("emailNewOpportunities", configuration.isEmailNewOpportunities(),
                        "emailWeeklyReport", configuration.isEmailWeeklyReport(),
                        "interviewReminders", configuration.isInterviewReminders())
                : Map.of("emailNewOpportunities", true, "emailWeeklyReport", false, "interviewReminders", true);
        AutomationSettingsDto automationSettings = AutomationSettingsDto.builder()
                .searchEnabled(configuration != null && configuration.isSearchEnabled())
                .autoApplyEnabled(configuration != null && configuration.isAutoApplyEnabled())
                .coverLetterEnabled(configuration != null && configuration.isCoverLetterEnabled())
                .whatsappEnabled(configuration != null && configuration.isWhatsappEnabled())
                .dailyCreditBudget(configuration != null ? configuration.getDailyCreditBudget() : 1)
                .mailboxProvider(configuration != null ? configuration.getMailboxProvider() : "")
                .mailboxAddress(configuration != null ? configuration.getMailboxAddress() : "")
                .mailboxConnected(configuration != null && configuration.isMailboxConnected())
                .build();

        return CandidateProfileDto.builder()
                .candidateId(candidate.getId())
                .fullName(candidate.getFullName())
                .email(candidate.getEmail())
                .phone(candidate.getPhone() != null ? candidate.getPhone() : "")
                .city(configuration != null ? configuration.getTargetCity() : candidate.getCity() != null ? candidate.getCity() : "")
                .headline(configuration != null ? configuration.getTargetRole() : candidate.getTargetRole() != null ? candidate.getTargetRole() : "")
                .availability((String) rawData.getOrDefault("availability", "Disponible"))
                .experienceLevel((String) rawData.getOrDefault("experienceLevel", ""))
                .salaryExpectations(configuration != null ? configuration.getSalaryExpectations() : (String) rawData.getOrDefault("salaryExpectations", ""))
                .contractTypes(contractTypes)
                .targetLocations(targetLocations)
                .remotePreference((String) rawData.getOrDefault("remotePreference", ""))
                .mobility((String) rawData.getOrDefault("mobility", ""))
                .skills(skills)
                .aiInstructions((String) rawData.getOrDefault("aiInstructions", ""))
                .notifications(notifications)
                .automation(automationSettings)
                .whatsappNumber(configuration != null ? configuration.getWhatsappNumber() : candidate.getWhatsappNumber() != null ? candidate.getWhatsappNumber() : "")
                .proCredits(candidate.getProCredits() != null ? candidate.getProCredits() : 0)
                .isProAgent(candidate.isProAgent())
                .agentShopName(candidate.getAgentShopName())
                .build();
    }
}
