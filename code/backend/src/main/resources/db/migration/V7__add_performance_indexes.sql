-- Migration V7 — Ajout d'index de performance pour la montée en charge (application, cv, job_offer)
DROP PROCEDURE IF EXISTS add_perf_indexes;

CREATE PROCEDURE add_perf_indexes()
BEGIN
    -- Index sur application(candidate_id, status)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'application'
          AND INDEX_NAME = 'idx_application_candidate_status'
    ) THEN
        ALTER TABLE application ADD INDEX idx_application_candidate_status (candidate_id, status);
    END IF;

    -- Index sur job_offer(scraped_at)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'job_offer'
          AND INDEX_NAME = 'idx_job_offer_scraped'
    ) THEN
        ALTER TABLE job_offer ADD INDEX idx_job_offer_scraped (scraped_at);
    END IF;

    -- Index sur cv(candidate_id, created_at)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'cv'
          AND INDEX_NAME = 'idx_cv_candidate_created'
    ) THEN
        ALTER TABLE cv ADD INDEX idx_cv_candidate_created (candidate_id, created_at);
    END IF;
END;

CALL add_perf_indexes();
DROP PROCEDURE IF EXISTS add_perf_indexes;
