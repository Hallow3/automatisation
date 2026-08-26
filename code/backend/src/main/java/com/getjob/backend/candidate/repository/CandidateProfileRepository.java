package com.getjob.backend.candidate.repository;

import com.getjob.backend.candidate.domain.CandidateProfileEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CandidateProfileRepository extends JpaRepository<CandidateProfileEntity, Integer> {
    Optional<CandidateProfileEntity> findByCandidateId(Integer candidateId);
}
