package com.getjob.backend.cv.interview.repository;

import com.getjob.backend.cv.interview.domain.CvInterviewSessionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CvInterviewSessionRepository extends JpaRepository<CvInterviewSessionEntity, String> {

    Optional<CvInterviewSessionEntity> findFirstByCvIdOrderByCreatedAtDesc(Long cvId);

    Optional<CvInterviewSessionEntity> findFirstByCvIdAndInterviewStatusInOrderByCreatedAtDesc(Long cvId, List<String> statuses);

    List<CvInterviewSessionEntity> findByCandidateIdOrderByCreatedAtDesc(Integer candidateId);
}
