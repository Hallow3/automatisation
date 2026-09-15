-- Migration V11: Add target_role and city to candidate table
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

CALL add_column_if_missing('candidate', 'target_role', "VARCHAR(150) NULL AFTER whatsapp_number");
CALL add_column_if_missing('candidate', 'city', "VARCHAR(100) NULL AFTER target_role");

DROP PROCEDURE IF EXISTS add_column_if_missing;
