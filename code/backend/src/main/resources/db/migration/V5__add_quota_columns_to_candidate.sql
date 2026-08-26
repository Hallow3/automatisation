-- Migration V5 — Ajout des colonnes de suivi des quotas IA sur candidate
DROP PROCEDURE IF EXISTS add_quota_columns;

CREATE PROCEDURE add_quota_columns()
BEGIN
    -- ai_interviews_used
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'candidate'
          AND COLUMN_NAME = 'ai_interviews_used'
    ) THEN
        ALTER TABLE candidate ADD COLUMN ai_interviews_used INT NOT NULL DEFAULT 0;
    END IF;

    -- ai_interviews_reset_date
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'candidate'
          AND COLUMN_NAME = 'ai_interviews_reset_date'
    ) THEN
        ALTER TABLE candidate ADD COLUMN ai_interviews_reset_date DATE NULL;
    END IF;
END;

CALL add_quota_columns();

DROP PROCEDURE IF EXISTS add_quota_columns;
