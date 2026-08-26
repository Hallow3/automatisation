-- Migration V4 — Ajout des colonnes d'authentification sur la table candidate
-- MySQL 8.0 : ALTER TABLE ADD COLUMN ne supporte pas IF NOT EXISTS
-- On utilise une procédure pour vérifier avant d'ajouter

DROP PROCEDURE IF EXISTS add_auth_columns;

CREATE PROCEDURE add_auth_columns()
BEGIN
    -- password_hash
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'candidate'
          AND COLUMN_NAME = 'password_hash'
    ) THEN
        ALTER TABLE candidate ADD COLUMN password_hash VARCHAR(255) NULL AFTER email;
    END IF;

    -- role
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'candidate'
          AND COLUMN_NAME = 'role'
    ) THEN
        ALTER TABLE candidate ADD COLUMN role VARCHAR(50) NOT NULL DEFAULT 'ROLE_USER' AFTER password_hash;
    END IF;

    -- enabled
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'candidate'
          AND COLUMN_NAME = 'enabled'
    ) THEN
        ALTER TABLE candidate ADD COLUMN enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER role;
    END IF;

    -- Index unique sur email (si pas déjà présent)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'candidate'
          AND INDEX_NAME = 'uk_candidate_email'
    ) THEN
        ALTER TABLE candidate ADD CONSTRAINT uk_candidate_email UNIQUE (email);
    END IF;
END;

CALL add_auth_columns();

DROP PROCEDURE IF EXISTS add_auth_columns;
