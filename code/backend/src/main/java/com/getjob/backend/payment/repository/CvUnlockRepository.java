package com.getjob.backend.payment.repository;

import com.getjob.backend.payment.domain.CvUnlockEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CvUnlockRepository extends JpaRepository<CvUnlockEntity, Long> {
    Optional<CvUnlockEntity> findByCvId(Long cvId);
    Optional<CvUnlockEntity> findByCvIdAndCandidateId(Long cvId, Integer candidateId);
    boolean existsByCvId(Long cvId);
    boolean existsByCvIdAndCandidateId(Long cvId, Integer candidateId);
    List<CvUnlockEntity> findByCandidateIdOrderByUnlockedAtDesc(Integer candidateId);
}
