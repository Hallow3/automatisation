-- Plateforme emploi — schéma MySQL socle
-- À exécuter dans la base de données dédiée (ex: CREATE DATABASE emploi; USE emploi;)

CREATE DATABASE IF NOT EXISTS emploi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE emploi;

CREATE TABLE IF NOT EXISTS candidate (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(255),
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(50),
  whatsapp_number VARCHAR(50),
  target_role VARCHAR(255),
  city VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS candidate_profile (
  id INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id INT NOT NULL,
  raw_data JSON,
  cv_minio_key VARCHAR(500),
  cv_generated BOOLEAN DEFAULT FALSE,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (candidate_id) REFERENCES candidate(id)
);

CREATE TABLE IF NOT EXISTS job_offer (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source VARCHAR(100),
  external_id VARCHAR(255),
  title VARCHAR(255),
  company VARCHAR(255),
  city VARCHAR(255),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  raw_data JSON,
  scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_offer (source, external_id)
);

CREATE TABLE IF NOT EXISTS application (
  id INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id INT NOT NULL,
  job_offer_id INT NOT NULL,
  score INT,
  rule_score INT,
  ai_score INT NULL,
  status ENUM('qualified','review','rejected','applied','answered','interview','closed') DEFAULT 'qualified',
  decision_reason VARCHAR(255) NULL,
  evaluation_details JSON NULL,
  evaluated_at DATETIME NULL,
  cover_letter_minio_key VARCHAR(500),
  cv_used_minio_key VARCHAR(500),
  applied_at DATETIME NULL,
  FOREIGN KEY (candidate_id) REFERENCES candidate(id),
  FOREIGN KEY (job_offer_id) REFERENCES job_offer(id)
);

CREATE TABLE IF NOT EXISTS conversation (
  id INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  email_thread_id VARCHAR(255),
  last_message_at DATETIME,
  FOREIGN KEY (application_id) REFERENCES application(id)
);

CREATE TABLE IF NOT EXISTS message (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  direction ENUM('incoming','outgoing'),
  content TEXT,
  classification VARCHAR(50),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversation(id)
);

CREATE TABLE IF NOT EXISTS notification (
  id INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id INT NOT NULL,
  application_id INT NULL,
  channel VARCHAR(50) DEFAULT 'whatsapp',
  content TEXT,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (candidate_id) REFERENCES candidate(id)
);

-- Index sur les accès fréquents
CREATE INDEX IF NOT EXISTS idx_application_status ON application(status);
CREATE INDEX IF NOT EXISTS idx_application_candidate ON application(candidate_id);
CREATE INDEX IF NOT EXISTS idx_job_offer_scraped ON job_offer(scraped_at);
CREATE INDEX IF NOT EXISTS idx_candidate_email ON candidate(email);

-- Tables company directory (utilisées par les workflows n8n de scraping)
CREATE TABLE IF NOT EXISTS company (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255),
  normalized_name VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS company_alias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  alias_normalized VARCHAR(255),
  FOREIGN KEY (company_id) REFERENCES company(id)
);

CREATE TABLE IF NOT EXISTS company_email (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  email VARCHAR(255),
  email_type VARCHAR(50),
  source VARCHAR(100),
  is_verified BOOLEAN DEFAULT FALSE,
  confidence_score INT DEFAULT 50,
  FOREIGN KEY (company_id) REFERENCES company(id)
);

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
);
