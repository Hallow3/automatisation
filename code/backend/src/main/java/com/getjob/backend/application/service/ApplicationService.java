package com.getjob.backend.application.service;

import com.getjob.backend.application.domain.ApplicationEntity;
import com.getjob.backend.application.dto.ApplicationDto;
import com.getjob.backend.application.repository.ApplicationRepository;
import com.getjob.backend.candidate.domain.CandidateEntity;
import com.getjob.backend.candidate.repository.CandidateRepository;
import com.getjob.backend.joboffer.domain.JobOfferEntity;
import com.getjob.backend.joboffer.repository.JobOfferRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ApplicationService {

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

    public List<ApplicationDto> getApplications() {
        Integer candidateId = resolveCurrentCandidateId();
        List<ApplicationEntity> applications = applicationRepository.findByCandidateId(candidateId);
        return mapApplicationsToDtos(applications);
    }

    public org.springframework.data.domain.Page<ApplicationDto> getApplications(org.springframework.data.domain.Pageable pageable) {
        Integer candidateId = resolveCurrentCandidateId();
        org.springframework.data.domain.Page<ApplicationEntity> page = applicationRepository.findByCandidateId(candidateId, pageable);
        List<ApplicationDto> dtoList = mapApplicationsToDtos(page.getContent());
        return new org.springframework.data.domain.PageImpl<>(dtoList, pageable, page.getTotalElements());
    }

    public Optional<ApplicationDto> getApplicationById(String id) {
        try {
            Integer appId = Integer.parseInt(id);
            Integer candidateId = resolveCurrentCandidateId();
            return applicationRepository.findById(appId)
                    .filter(app -> candidateId.equals(app.getCandidateId()))
                    .map(app -> toDto(app, app.getJobOfferId() != null ? jobOfferRepository.findById(app.getJobOfferId()).orElse(null) : null));
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }

    private List<ApplicationDto> mapApplicationsToDtos(List<ApplicationEntity> applications) {
        if (applications == null || applications.isEmpty()) {
            return List.of();
        }
        List<Integer> offerIds = applications.stream()
                .map(ApplicationEntity::getJobOfferId)
                .filter(java.util.Objects::nonNull)
                .distinct()
                .toList();

        Map<Integer, JobOfferEntity> offerMap = jobOfferRepository.findAllById(offerIds).stream()
                .collect(Collectors.toMap(JobOfferEntity::getId, o -> o, (existing, replace) -> existing));

        return applications.stream()
                .map(app -> toDto(app, offerMap.get(app.getJobOfferId())))
                .toList();
    }

    private ApplicationDto toDto(ApplicationEntity app, JobOfferEntity offer) {
        String company = (offer != null && offer.getCompany() != null) ? offer.getCompany() : "Entreprise";
        String title = (offer != null && offer.getTitle() != null) ? offer.getTitle() : "Poste";

        return ApplicationDto.builder()
                .id(app.getId().toString())
                .opportunityId(app.getId().toString())
                .company(company)
                .title(title)
                .status(app.getStatus() != null ? app.getStatus().toUpperCase() : "APPLIED")
                .channel(app.getApplicationChannel() != null ? app.getApplicationChannel() : "EMAIL")
                .appliedAt(app.getAppliedAt() != null ? app.getAppliedAt().toString() : null)
                .lastActivityAt(app.getLastActivityAt() != null ? app.getLastActivityAt().toString() : null)
                .build();
    }
}
