package com.getjob.backend.opportunity.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.getjob.backend.ai.service.GeminiLiveTokenService;
import com.getjob.backend.application.domain.ApplicationEntity;
import com.getjob.backend.application.repository.ApplicationRepository;
import com.getjob.backend.candidate.domain.CandidateEntity;
import com.getjob.backend.candidate.domain.CandidateProfileEntity;
import com.getjob.backend.candidate.dto.CandidateProfileDto;
import com.getjob.backend.candidate.repository.CandidateProfileRepository;
import com.getjob.backend.candidate.repository.CandidateRepository;
import com.getjob.backend.joboffer.domain.JobOfferEntity;
import com.getjob.backend.joboffer.repository.JobOfferRepository;
import com.getjob.backend.opportunity.domain.ApplicationChannel;
import com.getjob.backend.opportunity.domain.OpportunityStatus;
import com.getjob.backend.opportunity.dto.ActionResponseDto;
import com.getjob.backend.opportunity.dto.OpportunityDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class OpportunityService {

    private final ApplicationRepository applicationRepository;
    private final JobOfferRepository jobOfferRepository;
    private final CandidateRepository candidateRepository;
    private final CandidateProfileRepository candidateProfileRepository;
    private final GeminiLiveTokenService geminiLiveTokenService;
    private final ObjectMapper objectMapper;

    private Optional<Integer> resolveOptionalCandidateId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return Optional.empty();
        }
        String email = auth.getName();
        return candidateRepository.findByEmail(email).map(CandidateEntity::getId);
    }

    private Integer resolveCurrentCandidateId() {
        return resolveOptionalCandidateId()
                .orElseThrow(() -> new AccessDeniedException("Accès non autorisé : aucun candidat authentifié."));
    }

    @Transactional(readOnly = true)
    public List<OpportunityDto> getAllOpportunities() {
        Optional<Integer> candidateIdOpt = resolveOptionalCandidateId();
        if (candidateIdOpt.isEmpty()) {
            return getPublicOpportunities();
        }
        return getCandidateOpportunities(candidateIdOpt.get());
    }

    @Transactional(readOnly = true)
    public Page<OpportunityDto> getAllOpportunities(Pageable pageable) {
        Optional<Integer> candidateIdOpt = resolveOptionalCandidateId();
        if (candidateIdOpt.isEmpty()) {
            return getPublicOpportunities(pageable);
        }
        return getCandidateOpportunities(candidateIdOpt.get(), pageable);
    }

    private List<OpportunityDto> getPublicOpportunities() {
        List<JobOfferEntity> publicOffers = jobOfferRepository.findAll(
                org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "id")
        );
        return publicOffers.stream()
                .limit(30)
                .map(this::buildPublicOpportunityDto)
                .toList();
    }

    private Page<OpportunityDto> getPublicOpportunities(Pageable pageable) {
        Page<JobOfferEntity> offerPage = jobOfferRepository.findAll(pageable);
        List<OpportunityDto> dtoList = offerPage.getContent().stream()
                .map(this::buildPublicOpportunityDto)
                .toList();
        return new PageImpl<>(dtoList, pageable, offerPage.getTotalElements());
    }

    private List<OpportunityDto> getCandidateOpportunities(Integer candidateId) {
        CandidateProfileDto profile = getCandidateProfile(candidateId);
        List<ApplicationEntity> candidateApps = applicationRepository.findByCandidateId(candidateId);

        Set<Integer> dismissedOfferIds = new HashSet<>();
        Set<Integer> rejectedOfferIds = new HashSet<>();
        Map<Integer, ApplicationEntity> appMap = new HashMap<>();

        for (ApplicationEntity app : candidateApps) {
            if (app.getJobOfferId() == null) continue;
            String status = app.getStatus() != null ? app.getStatus().toLowerCase() : "";
            if ("dismissed".equals(status)) {
                dismissedOfferIds.add(app.getJobOfferId());
            } else if ("rejected".equals(status)) {
                rejectedOfferIds.add(app.getJobOfferId());
            } else {
                appMap.put(app.getJobOfferId(), app);
            }
        }

        List<OpportunityDto> results = new ArrayList<>();
        Set<Integer> processedOfferIds = new HashSet<>();

        // 1. Offres associées à des candidatures actives du candidat
        if (!appMap.isEmpty()) {
            List<JobOfferEntity> activeOffers = jobOfferRepository.findAllById(appMap.keySet());
            for (JobOfferEntity offer : activeOffers) {
                processedOfferIds.add(offer.getId());
                results.add(buildOpportunityDto(offer, appMap.get(offer.getId()), profile));
            }
        }

        // 2. Offres disponibles du catalogue global non ignorées/rejetées et pertinentes pour le profil
        List<JobOfferEntity> allOffers = jobOfferRepository.findAll();
        for (JobOfferEntity offer : allOffers) {
            if (processedOfferIds.contains(offer.getId())
                    || dismissedOfferIds.contains(offer.getId())
                    || rejectedOfferIds.contains(offer.getId())) {
                continue;
            }

            OpportunityDto candidateDto = buildOpportunityDto(offer, null, profile);
            if (candidateDto.getScore() != null && candidateDto.getScore() >= 50) {
                results.add(candidateDto);
            }
        }

        results.sort((a, b) -> {
            int scoreA = a.getScore() != null ? a.getScore() : 0;
            int scoreB = b.getScore() != null ? b.getScore() : 0;
            return Integer.compare(scoreB, scoreA);
        });

        return results;
    }

    private Page<OpportunityDto> getCandidateOpportunities(Integer candidateId, Pageable pageable) {
        List<OpportunityDto> all = getCandidateOpportunities(candidateId);
        int start = (int) pageable.getOffset();
        if (start >= all.size()) {
            return new PageImpl<>(Collections.emptyList(), pageable, all.size());
        }
        int end = Math.min(start + pageable.getPageSize(), all.size());
        List<OpportunityDto> paged = all.subList(start, end);
        return new PageImpl<>(paged, pageable, all.size());
    }

    private OpportunityDto buildPublicOpportunityDto(JobOfferEntity offer) {
        return OpportunityDto.builder()
                .id("offer_" + offer.getId())
                .jobOfferId(offer.getId().toString())
                .title(offer.getTitle() != null ? offer.getTitle() : "Offre d'emploi")
                .company(offer.getCompany() != null ? offer.getCompany() : "Entreprise")
                .city(offer.getCity() != null ? offer.getCity() : "Cameroun")
                .source(offer.getSource() != null ? offer.getSource() : "GetJob Scanner")
                .score(null)
                .status(OpportunityStatus.QUALIFIED)
                .publishedAt(offer.getScrapedAt() != null ? offer.getScrapedAt().toString() : Instant.now().toString())
                .deadline(null)
                .applicationChannel(determineChannel(offer, null))
                .coverLetterAvailable(false)
                .coverLetterText(null)
                .matchedSkills(List.of())
                .matchExplanation("Offre publique disponible. Connectez-vous pour calculer votre affinité personnalisée et postuler en 1 clic.")
                .description(extractDescription(offer))
                .build();
    }

    @Transactional
    public Optional<OpportunityDto> getOpportunityById(String id) {
        if (id == null || id.isBlank()) return Optional.empty();
        Optional<Integer> candidateIdOpt = resolveOptionalCandidateId();

        // ── Visiteur public non authentifié ───────────────────────────────────
        if (candidateIdOpt.isEmpty()) {
            Integer offerId = null;
            if (id.startsWith("offer_") || id.startsWith("job_")) {
                try {
                    offerId = Integer.parseInt(id.replace("offer_", "").replace("job_", ""));
                } catch (NumberFormatException ignored) {}
            } else if (!id.startsWith("app_")) {
                try {
                    offerId = Integer.parseInt(id);
                } catch (NumberFormatException ignored) {}
            }
            if (offerId != null) {
                return jobOfferRepository.findById(offerId).map(this::buildPublicOpportunityDto);
            }
            return Optional.empty();
        }

        // ── Candidat authentifié ──────────────────────────────────────────────
        Integer candidateId = candidateIdOpt.get();
        CandidateProfileDto profile = getCandidateProfile(candidateId);

        // 1. Si préfixé explicitement comme offre (ex: offer_123 ou job_123)
        if (id.startsWith("offer_") || id.startsWith("job_")) {
            try {
                int offerId = Integer.parseInt(id.replace("offer_", "").replace("job_", ""));
                return jobOfferRepository.findById(offerId).map(offer -> {
                    ApplicationEntity app = applicationRepository.findByCandidateIdAndJobOfferId(candidateId, offer.getId()).orElse(null);
                    return buildOpportunityDto(offer, app, profile);
                });
            } catch (NumberFormatException e) {
                return Optional.empty();
            }
        }

        // 2. Si préfixé explicitement comme candidature (ex: app_123)
        if (id.startsWith("app_")) {
            try {
                int appId = Integer.parseInt(id.replace("app_", ""));
                return applicationRepository.findById(appId)
                        .filter(app -> candidateId.equals(app.getCandidateId()))
                        .flatMap(app -> jobOfferRepository.findById(app.getJobOfferId())
                                .map(offer -> buildOpportunityDto(offer, app, profile)));
            } catch (NumberFormatException e) {
                return Optional.empty();
            }
        }

        // 3. Identifiant numérique sans préfixe
        try {
            int targetId = Integer.parseInt(id);
            Optional<ApplicationEntity> appOpt = applicationRepository.findById(targetId)
                    .filter(app -> candidateId.equals(app.getCandidateId()));
            if (appOpt.isPresent()) {
                ApplicationEntity app = appOpt.get();
                return jobOfferRepository.findById(app.getJobOfferId())
                        .map(offer -> buildOpportunityDto(offer, app, profile));
            }

            Optional<JobOfferEntity> offerOpt = jobOfferRepository.findById(targetId);
            if (offerOpt.isPresent()) {
                JobOfferEntity offer = offerOpt.get();
                ApplicationEntity app = applicationRepository.findByCandidateIdAndJobOfferId(candidateId, offer.getId()).orElse(null);
                return Optional.of(buildOpportunityDto(offer, app, profile));
            }
        } catch (NumberFormatException e) {
            log.debug("ID d'opportunité non numérique : {}", id);
        }
        return Optional.empty();
    }

    private Integer parseTargetId(String id) {
        if (id == null || id.isBlank()) {
            throw new IllegalArgumentException("Identifiant manquant");
        }
        String clean = id.replace("offer_", "").replace("job_", "").replace("app_", "").trim();
        return Integer.parseInt(clean);
    }

    @Transactional
    public ActionResponseDto dismissOpportunity(String id) {
        try {
            Integer targetId = parseTargetId(id);
            Integer candidateId = resolveCurrentCandidateId();

            ApplicationEntity app = getOrCreateApplication(candidateId, targetId);
            app.setStatus("dismissed");
            app.setLastActivityAt(Instant.now());
            applicationRepository.save(app);
            return new ActionResponseDto(true, "Opportunité ignorée");
        } catch (Exception e) {
            return new ActionResponseDto(false, "Impossible d'ignorer l'opportunité : " + e.getMessage());
        }
    }

    public ActionResponseDto prepareApplication(String id) {
        try {
            Integer targetId = parseTargetId(id);
            Integer candidateId = resolveCurrentCandidateId();

            ApplicationEntity app = getOrCreateApplication(candidateId, targetId);
            JobOfferEntity offer = jobOfferRepository.findById(app.getJobOfferId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Offre introuvable"));

            // Génération IA réelle hors transaction BDD (anti-starvation du pool de connexions HikariCP)
            if (app.getCoverLetterText() == null || app.getCoverLetterText().isBlank()) {
                String letter = generateAiCoverLetter(candidateId, offer);
                app.setCoverLetterText(letter);
                app.setCoverLetterMinioKey("db://application/" + app.getId() + "/cover_letter.txt");
            }

            app.setLastActivityAt(Instant.now());
            saveApplication(app);

            return new ActionResponseDto(true, "Lettre de motivation préparée avec succès");
        } catch (Exception e) {
            log.error("Erreur lors de la préparation de la candidature : {}", e.getMessage());
            return new ActionResponseDto(false, "Erreur préparation : " + e.getMessage());
        }
    }

    @Transactional
    public void saveApplication(ApplicationEntity app) {
        applicationRepository.save(app);
    }

    @Transactional
    public ActionResponseDto submitApplication(String id) {
        try {
            Integer targetId = parseTargetId(id);
            Integer candidateId = resolveCurrentCandidateId();

            ApplicationEntity app = getOrCreateApplication(candidateId, targetId);
            app.setStatus("applied");
            app.setAppliedAt(Instant.now());
            app.setLastActivityAt(Instant.now());

            JobOfferEntity offer = jobOfferRepository.findById(app.getJobOfferId()).orElse(null);
            if (app.getApplicationChannel() == null && offer != null) {
                app.setApplicationChannel(determineChannel(offer, app).name());
            }

            applicationRepository.save(app);
            return new ActionResponseDto(true, "Candidature enregistrée avec succès");
        } catch (Exception e) {
            return new ActionResponseDto(false, "Erreur soumission : " + e.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public String getCoverLetterText(String id) {
        try {
            Integer targetId = parseTargetId(id);
            Integer candidateId = resolveCurrentCandidateId();

            Optional<ApplicationEntity> app = applicationRepository.findById(targetId)
                    .filter(a -> candidateId.equals(a.getCandidateId()));

            if (app.isPresent()) {
                return app.get().getCoverLetterText();
            }

            return applicationRepository.findByCandidateIdAndJobOfferId(candidateId, targetId)
                    .map(ApplicationEntity::getCoverLetterText)
                    .orElse(null);
        } catch (Exception e) {
            return null;
        }
    }

    // ── Méthodes privées d'aide métier ──────────────────────────────────────────

    private ApplicationEntity getOrCreateApplication(Integer candidateId, Integer targetId) {
        Optional<ApplicationEntity> existingApp = applicationRepository.findById(targetId)
                .filter(a -> candidateId.equals(a.getCandidateId()));
        if (existingApp.isPresent()) {
            return existingApp.get();
        }

        return applicationRepository.findByCandidateIdAndJobOfferId(candidateId, targetId)
                .orElseGet(() -> ApplicationEntity.builder()
                        .candidateId(candidateId)
                        .jobOfferId(targetId)
                        .status("qualified")
                        .build());
    }

    private Map<Integer, ApplicationEntity> getCandidateApplicationsMap(Integer candidateId) {
        return applicationRepository.findByCandidateId(candidateId).stream()
                .filter(a -> a.getJobOfferId() != null)
                .collect(Collectors.toMap(ApplicationEntity::getJobOfferId, a -> a, (e, r) -> e));
    }

    private OpportunityDto buildOpportunityDto(JobOfferEntity offer, ApplicationEntity app, CandidateProfileDto profile) {
        MatchingResult matching = computeMatching(offer, profile);

        int score = (app != null && app.getScore() != null) ? app.getScore() : matching.score();
        String explanation = (app != null && app.getDecisionReason() != null) ? app.getDecisionReason() : matching.explanation();
        List<String> matchedSkills = (app != null && app.getEvaluationDetails() != null)
                ? parseMatchedSkills(app.getEvaluationDetails())
                : matching.matchedSkills();

        boolean hasCoverLetter = app != null && (
                (app.getCoverLetterText() != null && !app.getCoverLetterText().isBlank()) ||
                (app.getCoverLetterMinioKey() != null && !app.getCoverLetterMinioKey().isBlank())
        );

        String rawStatus = app != null ? app.getStatus() : "qualified";
        OpportunityStatus status = mapStatus(rawStatus, hasCoverLetter);

        String appId = app != null ? app.getId().toString() : "offer_" + offer.getId();
        ApplicationChannel channel = determineChannel(offer, app);

        return OpportunityDto.builder()
                .id(appId)
                .jobOfferId(offer.getId().toString())
                .title(offer.getTitle() != null ? offer.getTitle() : "Offre d'emploi")
                .company(offer.getCompany() != null ? offer.getCompany() : "Entreprise")
                .city(offer.getCity() != null ? offer.getCity() : "Cameroun")
                .source(offer.getSource() != null ? offer.getSource() : "GetJob Scanner")
                .score(score)
                .status(status)
                .publishedAt(offer.getScrapedAt() != null ? offer.getScrapedAt().toString() : Instant.now().toString())
                .deadline(null)
                .applicationChannel(channel)
                .coverLetterAvailable(hasCoverLetter)
                .coverLetterText(app != null ? app.getCoverLetterText() : null)
                .matchedSkills(matchedSkills)
                .matchExplanation(explanation)
                .description(extractDescription(offer))
                .build();
    }

    private record MatchingResult(int score, List<String> matchedSkills, String explanation) {}

    private MatchingResult computeMatching(JobOfferEntity offer, CandidateProfileDto profile) {
        if (profile == null) {
            return new MatchingResult(70, List.of("Généraliste"), "Opportunité qualifiée");
        }

        List<String> candidateSkills = profile.getSkills() != null ? profile.getSkills() : Collections.emptyList();
        String candidateRole = profile.getHeadline() != null ? profile.getHeadline().trim().toLowerCase() : "";

        String offerText = ((offer.getTitle() != null ? offer.getTitle() : "") + " "
                + (offer.getRawData() != null ? offer.getRawData() : "")).toLowerCase();

        List<String> matchedSkills = new ArrayList<>();
        for (String skill : candidateSkills) {
            if (skill != null && !skill.isBlank() && offerText.contains(skill.trim().toLowerCase())) {
                matchedSkills.add(skill.trim());
            }
        }

        int score = 45; // Score plancher réaliste
        if (!candidateRole.isBlank() && offerText.contains(candidateRole)) {
            score += 20;
        }

        score += Math.min(35, matchedSkills.size() * 10);
        score = Math.min(95, Math.max(45, score));

        String explanation;
        if (!matchedSkills.isEmpty()) {
            explanation = matchedSkills.size() + " compétence(s) clé(s) en adéquation : " + String.join(", ", matchedSkills);
        } else if (!candidateRole.isBlank() && offerText.contains(candidateRole)) {
            explanation = "Poste aligné sur votre profil cible (" + profile.getHeadline() + ")";
        } else {
            explanation = "Offre sectorielle recommandée pour votre profil";
        }

        return new MatchingResult(score, matchedSkills.isEmpty() ? List.of("Polyvalence", "Motivation") : matchedSkills, explanation);
    }

    private String generateAiCoverLetter(Integer candidateId, JobOfferEntity offer) {
        CandidateEntity candidate = candidateRepository.findById(candidateId).orElse(null);
        String candidateName = candidate != null ? candidate.getFullName() : "Candidat";
        String offerTitle = offer.getTitle() != null ? offer.getTitle() : "Poste";
        String company = offer.getCompany() != null ? offer.getCompany() : "l'entreprise";

        String prompt = "Rédige une lettre de motivation professionnelle, percutante et personnalisée en français pour le candidat "
                + candidateName + " qui postule au poste de " + offerTitle + " chez " + company + ".\n"
                + "Détails de l'offre : " + extractDescription(offer) + "\n"
                + "Rédige uniquement le corps de la lettre en texte clair.";

        try {
            String generated = geminiLiveTokenService.generatePlainTextContent(
                    "Tu es un expert en recrutement. Rédige une lettre de motivation percutante et personnalisée en français en texte clair.",
                    prompt
            );
            if (generated != null && !generated.isBlank()) {
                return generated;
            }
        } catch (Exception e) {
            log.warn("Appel IA lettre de motivation non abouti, application du modèle de repli : {}", e.getMessage());
        }

        return "Madame, Monsieur,\n\n"
                + "Vivement intéressé(e) par l'opportunité de rejoindre " + company + ", je vous adresse ma candidature pour le poste de " + offerTitle + ".\n\n"
                + "Mon parcours, ma rigueur et ma motivation me permettent d'être rapidement opérationnel(le) et d'apporter une contribution concrète à vos objectifs d'équipe.\n\n"
                + "Je me tiens à votre entière disposition pour convenir d'un entretien à votre convenance.\n\n"
                + "Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.\n\n"
                + candidateName;
    }

    private CandidateProfileDto getCandidateProfile(Integer candidateId) {
        Optional<CandidateProfileEntity> profileOpt = candidateProfileRepository.findByCandidateId(candidateId);
        if (profileOpt.isEmpty() || profileOpt.get().getRawData() == null || profileOpt.get().getRawData().isBlank()) {
            return candidateRepository.findById(candidateId)
                    .map(c -> CandidateProfileDto.builder()
                            .candidateId(c.getId())
                            .fullName(c.getFullName())
                            .headline(c.getTargetRole())
                            .skills(List.of())
                            .build())
                    .orElse(null);
        }

        try {
            Map<String, Object> map = objectMapper.readValue(profileOpt.get().getRawData(), new TypeReference<>() {});
            @SuppressWarnings("unchecked")
            List<String> skills = (List<String>) map.getOrDefault("skills", Collections.emptyList());
            String headline = (String) map.getOrDefault("headline", "");

            return CandidateProfileDto.builder()
                    .candidateId(candidateId)
                    .skills(skills)
                    .headline(headline)
                    .build();
        } catch (Exception e) {
            log.debug("Erreur parsing profil candidat: {}", e.getMessage());
            return null;
        }
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
        if (app != null && app.getApplicationChannel() != null) {
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

    private List<String> parseMatchedSkills(String evalDetails) {
        if (evalDetails == null || evalDetails.isBlank()) {
            return List.of("Compétences clés qualifiées");
        }
        try {
            @SuppressWarnings("unchecked")
            List<String> parsed = objectMapper.readValue(evalDetails, List.class);
            return parsed;
        } catch (Exception e) {
            return List.of(evalDetails);
        }
    }

    private String extractDescription(JobOfferEntity offer) {
        if (offer.getRawData() != null && !offer.getRawData().isBlank()) {
            return offer.getRawData();
        }
        return "Poste : " + (offer.getTitle() != null ? offer.getTitle() : "Opportunité")
                + " chez " + (offer.getCompany() != null ? offer.getCompany() : "l'entreprise")
                + " (" + (offer.getCity() != null ? offer.getCity() : "Cameroun") + ")";
    }
}
