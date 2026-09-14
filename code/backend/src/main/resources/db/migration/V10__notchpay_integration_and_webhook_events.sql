-- Migration V10 — Intégration de la passerelle NotchPay, Idempotence Webhook et Fallback WhatsApp

-- 1. Élargir la colonne status pour supporter FALLBACK_WHATSAPP
ALTER TABLE payment_transaction MODIFY COLUMN status VARCHAR(32) NOT NULL DEFAULT 'PENDING';

-- 2. Ajouter la colonne gateway (NOTCHPAY par défaut)
DROP PROCEDURE IF EXISTS add_payment_gateway_column;
DELIMITER //
CREATE PROCEDURE add_payment_gateway_column()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'payment_transaction'
          AND COLUMN_NAME = 'gateway'
    ) THEN
        ALTER TABLE payment_transaction ADD COLUMN gateway VARCHAR(32) NOT NULL DEFAULT 'NOTCHPAY' AFTER client_phone;
    END IF;
END //
DELIMITER ;
CALL add_payment_gateway_column();
DROP PROCEDURE IF EXISTS add_payment_gateway_column;

-- 3. Table d'idempotence des événements Webhook NotchPay (evt_...)
CREATE TABLE IF NOT EXISTS notchpay_webhook_event (
    event_id VARCHAR(128) PRIMARY KEY,
    event_type VARCHAR(64) NOT NULL,
    reference VARCHAR(64) NULL,
    status VARCHAR(32) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_notch_ref (reference),
    INDEX idx_notch_type (event_type)
);
