package com.getjob.backend.opportunity.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.getjob.backend.ai.service.GeminiLiveTokenService;
import com.getjob.backend.application.domain.ApplicationEntity;
import com.getjob.backend.application.repository.ApplicationRepository;
import com.getjob.backend.candidate.domain.CandidateEntity;
import com.getjob.backend.candidate.domain.CandidateProfileEntity;
import com.getjob.backend.candidate.repository.CandidateProfileRepository;
import com.getjob.backend.candidate.repository.CandidateRepository;
import com.getjob.backend.joboffer.domain.JobOfferEntity;
import com.getjob.backend.joboffer.repository.JobOfferRepository;
import com.getjob.backend.opportunity.domain.OpportunityStatus;
import com.getjob.backend.opportunity.dto.ActionResponseDto;
import com.getjob.backend.opportunity.dto.OpportunityDto;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OpportunityServiceTest {

    @Mock
    private ApplicationRepository applicationRepository;

    @Mock
    private JobOfferRepository jobOfferRepository;

    @Mock
    private CandidateRepository candidateRepository;

    @Mock
    private CandidateProfileRepository candidateProfileRepository;

    @Mock
    private GeminiLiveTokenService geminiLiveTokenService;

    @Mock
    private ObjectMapper objectMapper;

    @InjectMocks
    private OpportunityService opportunityService;

    private JobOfferEntity offer1;
    private JobOfferEntity offer2;
    private CandidateEntity candidateA;
    private CandidateEntity candidateB;

    @BeforeEach
    void setUp() {
        offer1 = JobOfferEntity.builder()
                .id(101)
                .title("Développeur Java Spring")
                .company("FallaTech")
                .city("Douala")
                .source("CamerJob")
                .scrapedAt(Instant.now())
                .rawData("{\"skills\":[\"Java\",\"Spring\"]}")
                .build();

        offer2 = JobOfferEntity.builder()
                .id(102)
                .title("Comptable Général")
                .company("Finances SA")
                .city("Yaoundé")
                .source("Doopinet")
                .scrapedAt(Instant.now())
                .rawData("{\"skills\":[\"Comptabilité\"]}")
                .build();

        candidateA = CandidateEntity.builder()
                .id(1)
                .email("brayant@fallajobs.com")
                .fullName("Brayant Waffo")
                .targetRole("Développeur Java")
                .city("Douala")
                .build();

        candidateB = CandidateEntity.builder()
                .id(2)
                .email("autre@fallajobs.com")
                .fullName("Autre Candidat")
                .targetRole("Comptable")
                .city("Yaoundé")
                .build();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void testGetAllOpportunities_AnonymousVisitor_ReturnsPublicOffersWithoutPrivateData() {
        // GIVEN: Aucun utilisateur connecté dans le SecurityContext
        SecurityContextHolder.clearContext();
        when(jobOfferRepository.findAll(any(org.springframework.data.domain.Sort.class)))
                .thenReturn(List.of(offer1, offer2));

        // WHEN
        List<OpportunityDto> result = opportunityService.getAllOpportunities();

        // THEN
        assertThat(result).hasSize(2);
        OpportunityDto publicDto = result.get(0);
        assertThat(publicDto.getId()).startsWith("offer_");
        assertThat(publicDto.getScore()).isNull(); // Pas de score personnel pour anonyme
        assertThat(publicDto.getCoverLetterAvailable()).isFalse();
        assertThat(publicDto.getCoverLetterText()).isNull();
        assertThat(publicDto.getMatchExplanation()).contains("Offre publique disponible");

        // Aucune requête de candidature privée ne doit être exécutée
        verify(applicationRepository, never()).findByCandidateId(anyInt());
    }

    @Test
    void testGetAllOpportunities_AuthenticatedCandidate_StrictIsolationAndFiltering() {
        // GIVEN: Candidat A est authentifié
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("brayant@fallajobs.com", "credentials", Collections.emptyList())
        );
        when(candidateRepository.findByEmail("brayant@fallajobs.com")).thenReturn(Optional.of(candidateA));

        // Candidat A a une candidature active sur offer1
        ApplicationEntity appA = ApplicationEntity.builder()
                .id(501)
                .candidateId(candidateA.getId())
                .jobOfferId(offer1.getId())
                .score(92)
                .status("qualified")
                .coverLetterText("Lettre confidentielle de Brayant")
                .build();

        when(applicationRepository.findByCandidateId(candidateA.getId())).thenReturn(List.of(appA));
        when(jobOfferRepository.findAllById(anySet())).thenReturn(List.of(offer1));
        when(jobOfferRepository.findAll()).thenReturn(List.of(offer1, offer2));

        // WHEN
        List<OpportunityDto> result = opportunityService.getAllOpportunities();

        // THEN
        assertThat(result).isNotEmpty();
        OpportunityDto myApp = result.stream()
                .filter(o -> o.getJobOfferId().equals(offer1.getId().toString()))
                .findFirst().orElseThrow();

        assertThat(myApp.getId()).isEqualTo("501");
        assertThat(myApp.getScore()).isEqualTo(92);
        assertThat(myApp.getCoverLetterText()).isEqualTo("Lettre confidentielle de Brayant");

        // Vérification de la stricte isolation : aucune donnée de Candidat B n'a été lue
        verify(applicationRepository).findByCandidateId(candidateA.getId());
        verify(applicationRepository, never()).findByCandidateId(candidateB.getId());
    }

    @Test
    void testGetAllOpportunities_AuthenticatedCandidate_ExcludesDismissedOffers() {
        // GIVEN: Candidat A a ignoré (dismissed) l'offre 1
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("brayant@fallajobs.com", "credentials", Collections.emptyList())
        );
        when(candidateRepository.findByEmail("brayant@fallajobs.com")).thenReturn(Optional.of(candidateA));

        ApplicationEntity dismissedApp = ApplicationEntity.builder()
                .id(502)
                .candidateId(candidateA.getId())
                .jobOfferId(offer1.getId())
                .status("dismissed")
                .build();

        when(applicationRepository.findByCandidateId(candidateA.getId())).thenReturn(List.of(dismissedApp));
        when(jobOfferRepository.findAll()).thenReturn(List.of(offer1, offer2));

        // WHEN
        List<OpportunityDto> result = opportunityService.getAllOpportunities();

        // THEN: offer1 ne doit ABSOLUMENT PAS être dans la liste du candidat
        boolean containsDismissed = result.stream()
                .anyMatch(o -> o.getJobOfferId().equals(offer1.getId().toString()));
        assertThat(containsDismissed).isFalse();
    }

    @Test
    void testGetOpportunityById_AnonymousVisitor_CannotAccessPrivateApplicationId() {
        // GIVEN: Visiteur anonyme
        SecurityContextHolder.clearContext();

        // WHEN: Demande d'un ID de candidature privée ("app_501")
        Optional<OpportunityDto> result = opportunityService.getOpportunityById("app_501");

        // THEN: Doit être refusé / vide
        assertThat(result).isEmpty();
        verify(applicationRepository, never()).findById(anyInt());
    }

    @Test
    void testGetOpportunityById_AnonymousVisitor_CanAccessPublicOffer() {
        // GIVEN: Visiteur anonyme
        SecurityContextHolder.clearContext();
        when(jobOfferRepository.findById(101)).thenReturn(Optional.of(offer1));

        // WHEN: Demande de l'offre publique "offer_101"
        Optional<OpportunityDto> result = opportunityService.getOpportunityById("offer_101");

        // THEN
        assertThat(result).isPresent();
        assertThat(result.get().getTitle()).isEqualTo("Développeur Java Spring");
        assertThat(result.get().getScore()).isNull();
    }

    @Test
    void testGetOpportunityById_CandidateCannotAccessOtherCandidateApplication() {
        // GIVEN: Candidat A connecté
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("brayant@fallajobs.com", "credentials", Collections.emptyList())
        );
        when(candidateRepository.findByEmail("brayant@fallajobs.com")).thenReturn(Optional.of(candidateA));

        // Candidature appartenant au Candidat B (ID 2)
        ApplicationEntity appCandidateB = ApplicationEntity.builder()
                .id(888)
                .candidateId(candidateB.getId()) // ID = 2
                .jobOfferId(offer2.getId())
                .coverLetterText("Lettre secrète du candidat B")
                .build();

        when(applicationRepository.findById(888)).thenReturn(Optional.of(appCandidateB));

        // WHEN: Candidat A tente d'accéder à "app_888"
        Optional<OpportunityDto> result = opportunityService.getOpportunityById("app_888");

        // THEN: Étanche ! Candidat A ne voit rien (Optional.empty)
        assertThat(result).isEmpty();
    }

    @Test
    void testDismissOpportunity_Anonymous_ReturnsFailure() {
        // GIVEN: Anonyme
        SecurityContextHolder.clearContext();

        // WHEN
        ActionResponseDto result = opportunityService.dismissOpportunity("offer_101");

        // THEN: Doit échouer avec message d'accès non autorisé
        assertThat(result.isSuccess()).isFalse();
        assertThat(result.getMessage()).contains("aucun candidat authentifié");
    }
}
