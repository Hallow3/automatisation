-- Migration V9 — Stockage réel de la lettre de motivation générée par l'IA (en remplacement des fausses clés MinIO)
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'application' 
      AND COLUMN_NAME = 'cover_letter_text'
);

SET @sql = IF(@col_exists = 0, 
    'ALTER TABLE application ADD COLUMN cover_letter_text LONGTEXT DEFAULT NULL', 
    'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

