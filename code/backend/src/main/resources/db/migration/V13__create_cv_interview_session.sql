-- Migration V13 — Table de persistance de session d'entretien vocal et machine à états (Spec V2)
-- Architecture découplée : persistance de la State Machine, transcription et données partielles

CREATE TABLE IF NOT EXISTS cv_interview_session (
    id VARCHAR(64) NOT NULL,
    cv_id BIGINT UNSIGNED NOT NULL,
    candidate_id INT NOT NULL,
    current_state VARCHAR(32) NOT NULL DEFAULT 'IDENTITY',
    section_index INT NOT NULL DEFAULT 0,
    turns_in_section INT NOT NULL DEFAULT 0,
    section_status VARCHAR(32) NOT NULL DEFAULT 'IN_PROGRESS',
    section_transcript JSON NULL,
    full_transcript JSON NULL,
    section_partial_data JSON NULL,
    cv_data_so_far JSON NULL,
    interview_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    last_activity_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_interview_session_cv (cv_id),
    INDEX idx_interview_session_candidate (candidate_id),
    INDEX idx_interview_session_status (interview_status),

    CONSTRAINT fk_interview_session_cv
        FOREIGN KEY (cv_id) REFERENCES cv(id) ON DELETE CASCADE,
    CONSTRAINT fk_interview_session_candidate
        FOREIGN KEY (candidate_id) REFERENCES candidate(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
