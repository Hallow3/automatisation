package com.getjob.backend.monitoring;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Gauge;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/** Rolling 24-hour counts from persisted terminal sessions, including sessions before a restart. */
@Component
@RequiredArgsConstructor
@Slf4j
public class InterviewMetrics {
    private static final String[] REASONS = {
            "COMPLETED", "AI_UNAVAILABLE", "HEARTBEAT_TIMEOUT", "ORPHAN_TIMEOUT",
            "USER_HANGUP", "CREDIT_LIMIT_REACHED"
    };

    private final JdbcTemplate jdbc;
    private final MeterRegistry registry;
    private final Map<String, AtomicInteger> counts = new ConcurrentHashMap<>();

    @PostConstruct
    void register() {
        for (String reason : REASONS) {
            AtomicInteger count = new AtomicInteger();
            counts.put(reason, count);
            Gauge.builder("fallajobs_interview_ended_24h", count, AtomicInteger::get)
                    .tag("reason", reason).register(registry);
        }
        refresh();
    }

    @Scheduled(fixedDelay = 30000)
    void refresh() {
        try {
            Map<String, Integer> latest = new ConcurrentHashMap<>();
            jdbc.query("select termination_reason, count(*) as total from cv_interview_session " +
                            "where ended_at >= ? and ended_at <= ? and termination_reason is not null " +
                            "group by termination_reason",
                    ps -> {
                        ps.setTimestamp(1, Timestamp.from(Instant.now().minus(24, ChronoUnit.HOURS)));
                        ps.setTimestamp(2, Timestamp.from(Instant.now()));
                    },
                    (RowCallbackHandler) rs -> latest.put(rs.getString("termination_reason"), rs.getInt("total")));
            counts.forEach((reason, count) -> count.set(latest.getOrDefault(reason, 0)));
        } catch (Exception e) {
            log.warn("Unable to refresh interview metrics: {}", e.getMessage());
        }
    }
}
