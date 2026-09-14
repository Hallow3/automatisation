package com.getjob.backend.candidate.repository;

import com.getjob.backend.candidate.domain.CandidateEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CandidateRepository extends JpaRepository<CandidateEntity, Integer> {

    Optional<CandidateEntity> findByEmail(String email);

    boolean existsByEmail(String email);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("UPDATE CandidateEntity c SET c.proCredits = c.proCredits - 1 WHERE c.id = :candidateId AND c.proCredits > 0")
    int decrementProCreditIfAvailable(@org.springframework.data.repository.query.Param("candidateId") Integer candidateId);
}
