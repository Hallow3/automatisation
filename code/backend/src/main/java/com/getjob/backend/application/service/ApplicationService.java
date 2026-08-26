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
        return applications.stream()
                .map(this::mapToDto)
                .flatMap(Optional::stream)
                .collect(Collectors.toList());
    }

    public Optional<ApplicationDto> getApplicationById(String id) {
        try {
            Integer appId = Integer.parseInt(id);
            Integer candidateId = resolveCurrentCandidateId();
            return applicationRepository.findById(appId)
                    .filter(app -> candidateId.equals(app.getCandidateId()))
                    .flatMap(this::mapToDto);
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }

    private Optional<ApplicationDto> mapToDto(ApplicationEntity app) {
        Optional<JobOfferEntity> offerOpt = jobOfferRepository.findById(app.getJobOfferId());
        String company = offerOpt.map(JobOfferEntity::getCompany).orElse("Entreprise");
        String title = offerOpt.map(JobOfferEntity::getTitle).orElse("Poste");

        ApplicationDto dto = ApplicationDto.builder()
                .id(app.getId().toString())
                .opportunityId(app.getId().toString())
                .company(company)
                .title(title)
                .status(app.getStatus().toUpperCase())
                .channel(app.getApplicationChannel() != null ? app.getApplicationChannel() : "EMAIL")
                .appliedAt(app.getAppliedAt() != null ? app.getAppliedAt().toString() : null)
                .lastActivityAt(app.getLastActivityAt() != null ? app.getLastActivityAt().toString() : null)
                .build();

        return Optional.of(dto);
    }
}
