package com.getjob.backend.cv.interview.repository;

import com.getjob.backend.cv.interview.domain.CvInterviewSessionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CvInterviewSessionRepository extends JpaRepository<CvInterviewSessionEntity, String> {

    Optional<CvInterviewSessionEntity> findFirstByCvIdOrderByCreatedAtDesc(Long cvId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from CvInterviewSessionEntity s where s.id = :id")
    Optional<CvInterviewSessionEntity> findLockedById(@Param("id") String id);

    Optional<CvInterviewSessionEntity> findFirstByCvIdAndInterviewStatusInOrderByCreatedAtDesc(Long cvId, List<String> statuses);

    List<CvInterviewSessionEntity> findByCandidateIdOrderByCreatedAtDesc(Integer candidateId);

    List<CvInterviewSessionEntity> findByInterviewStatusAndLastHeartbeatAtBefore(String interviewStatus, java.time.Instant threshold);
}
