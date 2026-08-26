-- Migration V6 — Ajout des colonnes de validation email et réinitialisation de mot de passe
DROP PROCEDURE IF EXISTS add_email_verification_columns;

CREATE PROCEDURE add_email_verification_columns()
BEGIN
    -- verification_code
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'candidate'
          AND COLUMN_NAME = 'verification_code'
    ) THEN
        ALTER TABLE candidate ADD COLUMN verification_code VARCHAR(20) NULL AFTER enabled;
    END IF;

    -- verification_code_expires_at
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'candidate'
          AND COLUMN_NAME = 'verification_code_expires_at'
    ) THEN
        ALTER TABLE candidate ADD COLUMN verification_code_expires_at DATETIME NULL AFTER verification_code;
    END IF;

    -- reset_password_code
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'candidate'
          AND COLUMN_NAME = 'reset_password_code'
    ) THEN
        ALTER TABLE candidate ADD COLUMN reset_password_code VARCHAR(20) NULL AFTER verification_code_expires_at;
    END IF;

    -- reset_password_expires_at
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'candidate'
          AND COLUMN_NAME = 'reset_password_expires_at'
    ) THEN
        ALTER TABLE candidate ADD COLUMN reset_password_expires_at DATETIME NULL AFTER reset_password_code;
    END IF;

    -- Activer par défaut tous les comptes existants déjà enregistrés
    UPDATE candidate SET enabled = TRUE WHERE enabled IS NULL;
END;

CALL add_email_verification_columns();
DROP PROCEDURE IF EXISTS add_email_verification_columns;
