package com.getjob.backend.cv.repository;

import com.getjob.backend.cv.domain.CvTemplateEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CvTemplateRepository extends JpaRepository<CvTemplateEntity, Long> {
    Optional<CvTemplateEntity> findByCode(String code);
    List<CvTemplateEntity> findByActiveTrue();
}
