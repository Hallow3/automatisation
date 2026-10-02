package com.getjob.backend.monitoring;

import com.getjob.backend.candidate.repository.CandidateRepository;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

@Component
public class CandidateMetrics {
    public CandidateMetrics(MeterRegistry registry, CandidateRepository candidates) {
        registry.gauge("fallajobs_users_registered", candidates, CandidateRepository::count);
        registry.gauge("fallajobs_users_verified", candidates, CandidateRepository::countByEnabledTrue);
    }
}
