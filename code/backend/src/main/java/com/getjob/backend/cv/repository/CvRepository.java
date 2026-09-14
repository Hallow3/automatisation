package com.getjob.backend.cv.repository;

import com.getjob.backend.cv.domain.CvEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

@Repository
public interface CvRepository extends JpaRepository<CvEntity, Long> {
    List<CvEntity> findByCandidateId(Integer candidateId);
    Page<CvEntity> findByCandidateId(Integer candidateId, Pageable pageable);
    Optional<CvEntity> findByIdAndCandidateId(Long id, Integer candidateId);
}
