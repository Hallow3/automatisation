package com.getjob.backend.opportunity.service;

import com.getjob.backend.application.domain.ApplicationEntity;
import com.getjob.backend.application.repository.ApplicationRepository;
import com.getjob.backend.candidate.domain.CandidateEntity;
import com.getjob.backend.candidate.repository.CandidateRepository;
import com.getjob.backend.joboffer.domain.JobOfferEntity;
import com.getjob.backend.joboffer.repository.JobOfferRepository;
import com.getjob.backend.opportunity.domain.ApplicationChannel;
import com.getjob.backend.opportunity.domain.OpportunityStatus;
import com.getjob.backend.opportunity.dto.ActionResponseDto;
import com.getjob.backend.opportunity.dto.OpportunityDto;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OpportunityService {

    private final ApplicationRepository applicationRepository;
    private final JobOfferRepository jobOfferRepository;
    private final CandidateRepository candidateRepository;

    private Integer resolveCurrentCandidateId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            throw new org.springframework.security.access.AccessDeniedException("Accès non autorisé : aucun candidat authentifié.");
        }
        String email = auth.getName();
        return candidateRepository.findByEmail(email)
                .map(CandidateEntity::getId)
                .orElseThrow(() -> new org.springframework.security.access.AccessDeniedException(
                        "Candidat introuvable pour l'adresse email authentifiée : " + email));
    }

    @Transactional
    public List<OpportunityDto> getAllOpportunities() {
        Integer candidateId = resolveCurrentCandidateId();
        List<ApplicationEntity> applications = applicationRepository.findByCandidateId(candidateId);

        Map<Integer, ApplicationEntity> appByJobOfferId = new HashMap<>();
        for (ApplicationEntity app : applications) {
            if (app.getJobOfferId() != null) {
                appByJobOfferId.putIfAbsent(app.getJobOfferId(), app);
            }
        }

        List<JobOfferEntity> allOffers = jobOfferRepository.findAll();
        List<OpportunityDto> result = new ArrayList<>();

        for (JobOfferEntity offer : allOffers) {
            ApplicationEntity app = appByJobOfferId.get(offer.getId());
            if (app == null) {
                app = ApplicationEntity.builder()
                        .candidateId(candidateId)
                        .jobOfferId(offer.getId())
                        .status("qualified")
                        .score(85)
                        .decisionReason("Opportunité détectée depuis la base de données")
                        .build();
                app = applicationRepository.save(app);
                appByJobOfferId.put(offer.getId(), app);
            }
            mapToOpportunityDto(app).ifPresent(result::add);
        }

        // Compléter avec les applications n'ayant pas de job_offer correspondant si nécessaire
        for (ApplicationEntity app : applications) {
            if (app.getJobOfferId() == null || !jobOfferRepository.existsById(app.getJobOfferId())) {
                mapToOpportunityDto(app).ifPresent(result::add);
            }
        }

        return result;
    }

    @Transactional
    public Optional<OpportunityDto> getOpportunityById(String id) {
        if (id == null || id.isBlank()) return Optional.empty();
        String cleanId = id.replace("job_", "").replace("app_", "");
        try {
            Integer targetId = Integer.parseInt(cleanId);
            Integer candidateId = resolveCurrentCandidateId();

            Optional<ApplicationEntity> appOpt = applicationRepository.findById(targetId)
                    .filter(app -> candidateId.equals(app.getCandidateId()));
            if (appOpt.isPresent()) {
                return mapToOpportunityDto(appOpt.get());
            }

            Optional<JobOfferEntity> offerOpt = jobOfferRepository.findById(targetId);
            if (offerOpt.isPresent()) {
                JobOfferEntity offer = offerOpt.get();
                ApplicationEntity app = applicationRepository.findByCandidateIdAndJobOfferId(candidateId, offer.getId())
                        .orElseGet(() -> applicationRepository.save(ApplicationEntity.builder()
                                .candidateId(candidateId)
                                .jobOfferId(offer.getId())
                                .status("qualified")
                                .score(85)
                                .build()));
                return mapToOpportunityDto(app);
            }
        } catch (NumberFormatException e) {
            // Ignorer si non numérique
        }
        return Optional.empty();
    }

    @Transactional
    public ActionResponseDto dismissOpportunity(String id) {
        try {
            Integer appId = Integer.parseInt(id);
            Integer candidateId = resolveCurrentCandidateId();
            return applicationRepository.findById(appId)
                    .filter(app -> candidateId.equals(app.getCandidateId()))
                    .map(app -> {
                        app.setStatus("dismissed");
                        app.setLastActivityAt(Instant.now());
                        applicationRepository.save(app);
                        return new ActionResponseDto(true, "Opportunity dismissed");
                    }).orElse(new ActionResponseDto(false, "Opportunity not found"));
        } catch (NumberFormatException e) {
            return new ActionResponseDto(false, "Invalid opportunity ID");
        }
    }

    @Transactional
    public ActionResponseDto prepareApplication(String id) {
        try {
            Integer appId = Integer.parseInt(id);
            Integer candidateId = resolveCurrentCandidateId();
            return applicationRepository.findById(appId)
                    .filter(app -> candidateId.equals(app.getCandidateId()))
                    .map(app -> {
                        if (app.getCoverLetterMinioKey() == null) {
                            app.setCoverLetterMinioKey("cover_letters/cover_letter_" + id + ".pdf");
                        }
                        app.setLastActivityAt(Instant.now());
                        applicationRepository.save(app);
                        return new ActionResponseDto(true, "Application prepared");
                    }).orElse(new ActionResponseDto(false, "Opportunity not found"));
        } catch (NumberFormatException e) {
            return new ActionResponseDto(false, "Invalid opportunity ID");
        }
    }

    @Transactional
    public ActionResponseDto submitApplication(String id) {
        try {
            Integer appId = Integer.parseInt(id);
            Integer candidateId = resolveCurrentCandidateId();
            return applicationRepository.findById(appId)
                    .filter(app -> candidateId.equals(app.getCandidateId()))
                    .map(app -> {
                        app.setStatus("applied");
                        app.setAppliedAt(Instant.now());
                        app.setLastActivityAt(Instant.now());
                        if (app.getApplicationChannel() == null) {
                            app.setApplicationChannel(determineChannel(app).name());
                        }
                        applicationRepository.save(app);
                        return new ActionResponseDto(true, "Application submitted");
                    }).orElse(new ActionResponseDto(false, "Opportunity not found"));
        } catch (NumberFormatException e) {
            return new ActionResponseDto(false, "Invalid opportunity ID");
        }
    }

    private Optional<OpportunityDto> mapToOpportunityDto(ApplicationEntity app) {
        Optional<JobOfferEntity> jobOfferOpt = jobOfferRepository.findById(app.getJobOfferId());
        if (jobOfferOpt.isEmpty()) {
            return Optional.empty();
        }

        JobOfferEntity offer = jobOfferOpt.get();
        boolean hasCoverLetter = app.getCoverLetterMinioKey() != null && !app.getCoverLetterMinioKey().isBlank();

        OpportunityStatus mappedStatus = mapStatus(app.getStatus(), hasCoverLetter);
        ApplicationChannel channel = determineChannel(offer, app);

        List<String> skills = parseMatchedSkills(app.getEvaluationDetails());
        String explanation = app.getDecisionReason() != null ? app.getDecisionReason() : "Correspondance qualifiée par l'IA";

        OpportunityDto dto = OpportunityDto.builder()
                .id(app.getId().toString())
                .jobOfferId(offer.getId().toString())
                .title(offer.getTitle() != null ? offer.getTitle() : "Offre de recrutement")
                .company(offer.getCompany() != null ? offer.getCompany() : "Confidentiel")
                .city(offer.getCity() != null ? offer.getCity() : "Non spécifié")
                .source(offer.getSource() != null ? offer.getSource() : "n8n Market Scanner")
                .score(app.getScore() != null ? app.getScore() : 80)
                .status(mappedStatus)
                .publishedAt(offer.getScrapedAt() != null ? offer.getScrapedAt().toString() : Instant.now().toString())
                .deadline(null)
                .applicationChannel(channel)
                .coverLetterAvailable(hasCoverLetter)
                .matchedSkills(skills)
                .matchExplanation(explanation)
                .description(extractDescription(offer))
                .build();

        return Optional.of(dto);
    }

    private OpportunityStatus mapStatus(String rawStatus, boolean hasCoverLetter) {
        if (rawStatus == null) return OpportunityStatus.QUALIFIED;
        switch (rawStatus.toLowerCase()) {
            case "pending_ai":
                return OpportunityStatus.PROCESSING;
            case "review":
                return OpportunityStatus.TO_REVIEW;
            case "qualified":
                return hasCoverLetter ? OpportunityStatus.READY_TO_APPLY : OpportunityStatus.QUALIFIED;
            case "applied":
                return OpportunityStatus.APPLIED;
            case "answered":
                return OpportunityStatus.ANSWERED;
            case "interview":
                return OpportunityStatus.INTERVIEW;
            case "closed":
                return OpportunityStatus.CLOSED;
            case "rejected":
                return OpportunityStatus.REJECTED;
            case "dismissed":
                return OpportunityStatus.DISMISSED;
            default:
                return OpportunityStatus.QUALIFIED;
        }
    }

    private ApplicationChannel determineChannel(JobOfferEntity offer, ApplicationEntity app) {
        if (app.getApplicationChannel() != null) {
            try {
                return ApplicationChannel.valueOf(app.getApplicationChannel().toUpperCase());
            } catch (Exception ignored) {}
        }
        if (offer.getContactEmail() != null && !offer.getContactEmail().isBlank()) {
            return ApplicationChannel.EMAIL;
        }
        if (offer.getUrl() != null && !offer.getUrl().isBlank()) {
            return ApplicationChannel.ATS_URL;
        }
        return ApplicationChannel.MANUAL;
    }

    private ApplicationChannel determineChannel(ApplicationEntity app) {
        Optional<JobOfferEntity> offerOpt = jobOfferRepository.findById(app.getJobOfferId());
        return offerOpt.map(offer -> determineChannel(offer, app)).orElse(ApplicationChannel.MANUAL);
    }

    private List<String> parseMatchedSkills(String evalDetails) {
        if (evalDetails == null || evalDetails.isBlank()) {
            return List.of("Java", "Spring Boot", "TypeScript", "Angular");
        }
        return List.of("Matching IA", "Compétences clés qualifiées");
    }

    private String extractDescription(JobOfferEntity offer) {
        if (offer.getRawData() != null && !offer.getRawData().isBlank()) {
            return offer.getRawData();
        }
        return "Description détaillée de l'offre d'emploi " + (offer.getTitle() != null ? offer.getTitle() : "");
    }
}
