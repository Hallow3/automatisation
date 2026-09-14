-- Migration V8 — Création des tables de micro-paiement Mobile Money et de portefeuille de crédits pro (Guichet Cybercafé)

-- 1. Ajout des colonnes de crédits pro sur la table candidate
DROP PROCEDURE IF EXISTS add_pro_columns;

CREATE PROCEDURE add_pro_columns()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'candidate'
          AND COLUMN_NAME = 'pro_credits'
    ) THEN
        ALTER TABLE candidate ADD COLUMN pro_credits INT NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'candidate'
          AND COLUMN_NAME = 'is_pro_agent'
    ) THEN
        ALTER TABLE candidate ADD COLUMN is_pro_agent BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'candidate'
          AND COLUMN_NAME = 'agent_shop_name'
    ) THEN
        ALTER TABLE candidate ADD COLUMN agent_shop_name VARCHAR(150) NULL;
    END IF;
END;

CALL add_pro_columns();
DROP PROCEDURE IF EXISTS add_pro_columns;

-- 2. Table des transactions de paiement (Mobile Money, Carte, Packs)
CREATE TABLE IF NOT EXISTS payment_transaction (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    reference VARCHAR(64) NOT NULL UNIQUE,
    candidate_id INT NOT NULL,
    cv_id BIGINT UNSIGNED NULL,
    type VARCHAR(32) NOT NULL, -- 'SINGLE_CV', 'PRO_PACK'
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(8) NOT NULL, -- 'XOF', 'XAF', 'EUR', 'USD'
    country_code VARCHAR(4) NOT NULL, -- 'CI', 'SN', 'CM', 'BJ', 'FR', 'INTL'
    operator VARCHAR(32) NOT NULL, -- 'WAVE', 'ORANGE', 'MTN', 'MOOV', 'FREE', 'CARD'
    phone_number VARCHAR(32) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'
    credits_granted INT NOT NULL DEFAULT 0,
    external_transaction_id VARCHAR(128) NULL,
    client_name VARCHAR(128) NULL,
    client_phone VARCHAR(32) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_pay_candidate FOREIGN KEY (candidate_id) REFERENCES candidate(id) ON DELETE CASCADE,
    CONSTRAINT fk_pay_cv FOREIGN KEY (cv_id) REFERENCES cv(id) ON DELETE SET NULL,
    INDEX idx_pay_reference (reference),
    INDEX idx_pay_candidate (candidate_id),
    INDEX idx_pay_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Table des CV déverrouillés en HD (Particulier ou Guichet)
CREATE TABLE IF NOT EXISTS cv_unlock (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    cv_id BIGINT UNSIGNED NOT NULL UNIQUE,
    candidate_id INT NOT NULL,
    transaction_id BIGINT NULL,
    unlock_method VARCHAR(32) NOT NULL, -- 'SINGLE_PAYMENT', 'PRO_CREDIT', 'ADMIN_GRANT'
    client_name VARCHAR(128) NULL,
    unlocked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_unlock_cv FOREIGN KEY (cv_id) REFERENCES cv(id) ON DELETE CASCADE,
    CONSTRAINT fk_unlock_candidate FOREIGN KEY (candidate_id) REFERENCES candidate(id) ON DELETE CASCADE,
    CONSTRAINT fk_unlock_transaction FOREIGN KEY (transaction_id) REFERENCES payment_transaction(id) ON DELETE SET NULL,
    INDEX idx_unlock_cv (cv_id),
    INDEX idx_unlock_candidate (candidate_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
