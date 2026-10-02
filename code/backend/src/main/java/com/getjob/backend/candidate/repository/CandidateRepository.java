package com.getjob.backend.candidate.repository;

import com.getjob.backend.candidate.domain.CandidateEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CandidateRepository extends JpaRepository<CandidateEntity, Integer> {

    Optional<CandidateEntity> findByEmail(String email);

    boolean existsByEmail(String email);

    long countByEnabledTrue();

    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true)
    @org.springframework.data.jpa.repository.Query("UPDATE CandidateEntity c SET c.proCredits = c.proCredits - 1 WHERE c.id = :candidateId AND c.proCredits > 0")
    int decrementProCreditIfAvailable(@org.springframework.data.repository.query.Param("candidateId") Integer candidateId);

    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true)
    @org.springframework.data.jpa.repository.Query("UPDATE CandidateEntity c SET c.proCredits = c.proCredits - :amount WHERE c.id = :candidateId AND c.proCredits >= :amount")
    int decrementProCreditsIfAvailable(@org.springframework.data.repository.query.Param("candidateId") Integer candidateId, @org.springframework.data.repository.query.Param("amount") int amount);

    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true)
    @org.springframework.data.jpa.repository.Query("UPDATE CandidateEntity c SET c.proCredits = COALESCE(c.proCredits, 0) + :amount WHERE c.id = :candidateId")
    int incrementProCredits(@org.springframework.data.repository.query.Param("candidateId") Integer candidateId, @org.springframework.data.repository.query.Param("amount") int amount);

    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true)
    @org.springframework.data.jpa.repository.Query("UPDATE CandidateEntity c SET c.proCredits = CASE WHEN c.proCredits >= :amount THEN c.proCredits - :amount ELSE 0 END WHERE c.id = :candidateId")
    int debitProCreditsBounded(@org.springframework.data.repository.query.Param("candidateId") Integer candidateId, @org.springframework.data.repository.query.Param("amount") int amount);
}
