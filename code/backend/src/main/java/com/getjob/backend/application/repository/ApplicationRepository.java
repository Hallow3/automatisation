package com.getjob.backend.application.repository;

import com.getjob.backend.application.domain.ApplicationEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ApplicationRepository extends JpaRepository<ApplicationEntity, Integer> {
    List<ApplicationEntity> findByCandidateId(Integer candidateId);
    Optional<ApplicationEntity> findByCandidateIdAndJobOfferId(Integer candidateId, Integer jobOfferId);
}
