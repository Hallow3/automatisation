package com.getjob.backend.candidate.repository;

import com.getjob.backend.candidate.domain.CandidateEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CandidateRepository extends JpaRepository<CandidateEntity, Integer> {

    Optional<CandidateEntity> findByEmail(String email);

    boolean existsByEmail(String email);
}
