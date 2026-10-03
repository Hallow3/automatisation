package com.getjob.backend.candidate.repository;

import com.getjob.backend.candidate.domain.CandidateConfigurationEntity;
import com.getjob.backend.candidate.domain.CandidateEntity;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DataJpaTest(properties = {
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect"
})
class CandidateConfigurationRepositoryTest {
    @Autowired TestEntityManager entityManager;
    @Autowired CandidateConfigurationRepository repository;

    @Test
    void configurationSurvivesFlushAndReloadForItsCandidate() {
        CandidateEntity candidate = entityManager.persistAndFlush(CandidateEntity.builder()
                .fullName("Test Candidat")
                .email("configuration-test@example.com")
                .build());
        CandidateConfigurationEntity configuration = CandidateConfigurationEntity.builder()
                .candidateId(candidate.getId())
                .targetRole("Comptable")
                .targetCity("Douala")
                .salaryExpectations("300 000 FCFA")
                .searchEnabled(true)
                .coverLetterEnabled(true)
                .dailyCreditBudget(4)
                .build();

        repository.saveAndFlush(configuration);
        entityManager.clear();

        CandidateConfigurationEntity reloaded = repository.findById(candidate.getId()).orElseThrow();
        assertThat(reloaded.getCandidateId()).isEqualTo(candidate.getId());
        assertThat(reloaded.getTargetRole()).isEqualTo("Comptable");
        assertThat(reloaded.getTargetCity()).isEqualTo("Douala");
        assertThat(reloaded.getSalaryExpectations()).isEqualTo("300 000 FCFA");
        assertThat(reloaded.isSearchEnabled()).isTrue();
        assertThat(reloaded.isCoverLetterEnabled()).isTrue();
        assertThat(reloaded.getDailyCreditBudget()).isEqualTo(4);
    }

    @Test
    void configurationCannotExistWithoutCandidate() {
        CandidateConfigurationEntity orphan = CandidateConfigurationEntity.builder().candidateId(999999).build();

        assertThatThrownBy(() -> repository.saveAndFlush(orphan))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }
}
