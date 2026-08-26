-- Migration script for shared MySQL DB `emploi` (V1)

-- 1. Extend application status
ALTER TABLE application
    MODIFY status ENUM(
        'pending_ai',
        'review',
        'qualified',
        'rejected',
        'applied',
        'answered',
        'interview',
        'closed',
        'dismissed'
    ) NOT NULL DEFAULT 'review';

-- Helper procedure to safely add columns if missing
DROP PROCEDURE IF EXISTS add_column_if_missing;

CREATE PROCEDURE add_column_if_missing(
    IN p_table VARCHAR(64),
    IN p_column VARCHAR(64),
    IN p_column_def TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = p_table 
          AND COLUMN_NAME = p_column
    ) THEN
        SET @sql = CONCAT('ALTER TABLE ', p_table, ' ADD COLUMN ', p_column, ' ', p_column_def);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END;

CALL add_column_if_missing('application', 'application_channel', "ENUM('EMAIL','ATS_URL','MANUAL') NULL AFTER applied_at");
CALL add_column_if_missing('application', 'last_activity_at', "DATETIME NULL AFTER application_channel");
CALL add_column_if_missing('job_offer', 'url', "VARCHAR(1500) NULL AFTER city");

DROP PROCEDURE IF EXISTS add_column_if_missing;

-- 3. Create cv_template table
CREATE TABLE IF NOT EXISTS cv_template (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(100) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description VARCHAR(500) DEFAULT NULL,
    page_hint VARCHAR(50) DEFAULT NULL,
    thumbnail_url VARCHAR(500) DEFAULT NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uk_cv_template_code (code),
    KEY idx_cv_template_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 4. Create cv table
CREATE TABLE IF NOT EXISTS cv (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    candidate_id INT NOT NULL,
    template_id BIGINT UNSIGNED DEFAULT NULL,

    title VARCHAR(255) NOT NULL,

    content_json JSON DEFAULT NULL,

    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    interview_status VARCHAR(50) DEFAULT NULL,

    pdf_minio_key VARCHAR(500) DEFAULT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    KEY idx_cv_candidate (candidate_id),
    KEY idx_cv_candidate_status (candidate_id, status),
    KEY idx_cv_template (template_id),

    CONSTRAINT fk_cv_candidate
        FOREIGN KEY (candidate_id)
        REFERENCES candidate(id),

    CONSTRAINT fk_cv_template
        FOREIGN KEY (template_id)
        REFERENCES cv_template(id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
