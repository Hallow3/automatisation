package com.getjob.backend.joboffer.repository;

import com.getjob.backend.joboffer.domain.JobOfferEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JobOfferRepository extends JpaRepository<JobOfferEntity, Integer> {
}
