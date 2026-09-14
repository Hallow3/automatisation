-- ==============================================================================
-- GETJOB AI — Schéma Complet Consolidé MySQL (One-Shot V1 -> V9)
-- ==============================================================================
-- Ce script recrée l'intégralité de la base de données 'emploi' avec TOUTES
-- les tables finales et l'historique Flyway déjà validé (prêt à l'emploi).
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS emploi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE emploi;

-- 1. Table candidate (avec auth, quotas, et crédits pro V4-V8)
CREATE TABLE IF NOT EXISTS candidate (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(255),
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(50),
  whatsapp_number VARCHAR(50),
  target_role VARCHAR(255),
  city VARCHAR(255),
  password_hash VARCHAR(255) NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'ROLE_CANDIDATE',
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  ai_interviews_used INT NOT NULL DEFAULT 0,
  ai_interviews_reset_date DATE NULL,
  verification_code VARCHAR(6) NULL,
  verification_expires_at DATETIME NULL,
  reset_password_code VARCHAR(6) NULL,
  reset_password_expires_at DATETIME NULL,
  pro_credits INT NOT NULL DEFAULT 0,
  is_pro_agent TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Table candidate_profile
CREATE TABLE IF NOT EXISTS candidate_profile (
  id INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id INT NOT NULL,
  raw_data JSON,
  cv_minio_key VARCHAR(500),
  cv_generated BOOLEAN DEFAULT FALSE,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (candidate_id) REFERENCES candidate(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Table job_offer
CREATE TABLE IF NOT EXISTS job_offer (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source VARCHAR(100),
  external_id VARCHAR(255),
  title VARCHAR(255),
  company VARCHAR(255),
  city VARCHAR(255),
  url VARCHAR(1500) NULL,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  raw_data JSON,
  scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_offer (source, external_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Table application (avec statut enrichi et cover_letter_text V9)
CREATE TABLE IF NOT EXISTS application (
  id INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id INT NOT NULL,
  job_offer_id INT NOT NULL,
  score INT,
  rule_score INT,
  ai_score INT NULL,
  status ENUM('pending_ai','review','qualified','rejected','applied','answered','interview','closed','dismissed') NOT NULL DEFAULT 'review',
  decision_reason VARCHAR(255) NULL,
  evaluation_details JSON NULL,
  evaluated_at DATETIME NULL,
  cover_letter_minio_key VARCHAR(500),
  cover_letter_text LONGTEXT NULL,
  cv_used_minio_key VARCHAR(500),
  applied_at DATETIME NULL,
  application_channel ENUM('EMAIL','ATS_URL','MANUAL') NULL,
  last_activity_at DATETIME NULL,
  FOREIGN KEY (candidate_id) REFERENCES candidate(id) ON DELETE CASCADE,
  FOREIGN KEY (job_offer_id) REFERENCES job_offer(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Table cv_template
CREATE TABLE IF NOT EXISTS cv_template (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  description VARCHAR(500) DEFAULT NULL,
  page_hint VARCHAR(50) DEFAULT NULL,
  thumbnail_url VARCHAR(500) DEFAULT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_cv_template_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Table cv
CREATE TABLE IF NOT EXISTS cv (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  candidate_id INT NOT NULL,
  template_id BIGINT UNSIGNED DEFAULT NULL,
  title VARCHAR(255) NOT NULL,
  content_json JSON DEFAULT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  interview_status VARCHAR(50) DEFAULT NULL,
  pdf_minio_key VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_cv_candidate (candidate_id),
  KEY idx_cv_candidate_status (candidate_id, status),
  KEY idx_cv_template (template_id),
  CONSTRAINT fk_cv_candidate FOREIGN KEY (candidate_id) REFERENCES candidate(id) ON DELETE CASCADE,
  CONSTRAINT fk_cv_template FOREIGN KEY (template_id) REFERENCES cv_template(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Table payment_transactions (V8)
CREATE TABLE IF NOT EXISTS payment_transactions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  candidate_id INT NOT NULL,
  cv_id BIGINT UNSIGNED NULL,
  reference VARCHAR(100) NOT NULL UNIQUE,
  provider VARCHAR(50) NOT NULL DEFAULT 'NOKASH',
  operator VARCHAR(50) NULL,
  phone_number VARCHAR(50) NULL,
  amount_fcfa INT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  payment_type VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  KEY idx_pay_candidate (candidate_id),
  KEY idx_pay_cv (cv_id),
  KEY idx_pay_status (status),
  CONSTRAINT fk_payment_candidate FOREIGN KEY (candidate_id) REFERENCES candidate(id) ON DELETE CASCADE,
  CONSTRAINT fk_payment_cv FOREIGN KEY (cv_id) REFERENCES cv(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Tables annexes (scraping n8n, messagerie, notifications)
CREATE TABLE IF NOT EXISTS conversation (
  id INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  email_thread_id VARCHAR(255),
  last_message_at DATETIME,
  FOREIGN KEY (application_id) REFERENCES application(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS message (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  direction ENUM('incoming','outgoing'),
  content TEXT,
  classification VARCHAR(50),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversation(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notification (
  id INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id INT NOT NULL,
  application_id INT NULL,
  channel VARCHAR(50) DEFAULT 'whatsapp',
  content TEXT,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (candidate_id) REFERENCES candidate(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS company (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255),
  normalized_name VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS company_alias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  alias_normalized VARCHAR(255),
  FOREIGN KEY (company_id) REFERENCES company(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS company_email (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  email VARCHAR(255),
  email_type VARCHAR(50),
  source VARCHAR(100),
  is_verified BOOLEAN DEFAULT FALSE,
  confidence_score INT DEFAULT 50,
  FOREIGN KEY (company_id) REFERENCES company(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS execution_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  workflow_name VARCHAR(255),
  node_name VARCHAR(255),
  candidate_id INT NULL,
  application_id INT NULL,
  status ENUM('success','error'),
  input_summary TEXT,
  output_summary TEXT,
  error_message TEXT NULL,
  duration_ms INT,
  ai_tokens_used INT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Index de performance (V7)
CREATE INDEX IF NOT EXISTS idx_application_status ON application(status);
CREATE INDEX IF NOT EXISTS idx_application_candidate ON application(candidate_id);
CREATE INDEX IF NOT EXISTS idx_app_job_offer ON application(job_offer_id);
CREATE INDEX IF NOT EXISTS idx_job_offer_scraped ON job_offer(scraped_at);
CREATE INDEX IF NOT EXISTS idx_candidate_email ON candidate(email);
CREATE INDEX IF NOT EXISTS idx_cv_interview_status ON cv(interview_status);
