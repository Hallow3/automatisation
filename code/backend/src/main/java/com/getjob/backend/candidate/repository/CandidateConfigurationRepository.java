package com.getjob.backend.candidate.repository;

import com.getjob.backend.candidate.domain.CandidateConfigurationEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CandidateConfigurationRepository extends JpaRepository<CandidateConfigurationEntity, Integer> {
}
