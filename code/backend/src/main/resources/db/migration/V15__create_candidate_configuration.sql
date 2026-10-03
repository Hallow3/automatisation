-- Une configuration au plus par candidat ; aucune ligne orpheline possible.
CREATE TABLE candidate_configuration (
    candidate_id INT NOT NULL,
    target_role VARCHAR(150) NOT NULL DEFAULT '',
    target_city VARCHAR(100) NOT NULL DEFAULT '',
    salary_expectations VARCHAR(120) NOT NULL DEFAULT '',
    whatsapp_number VARCHAR(30) NOT NULL DEFAULT '',
    search_enabled TINYINT(1) NOT NULL DEFAULT 0,
    auto_apply_enabled TINYINT(1) NOT NULL DEFAULT 0,
    cover_letter_enabled TINYINT(1) NOT NULL DEFAULT 0,
    whatsapp_enabled TINYINT(1) NOT NULL DEFAULT 0,
    daily_credit_budget TINYINT UNSIGNED NOT NULL DEFAULT 1,
    mailbox_provider VARCHAR(20) NOT NULL DEFAULT '',
    mailbox_address VARCHAR(254) NOT NULL DEFAULT '',
    mailbox_connected TINYINT(1) NOT NULL DEFAULT 0,
    email_new_opportunities TINYINT(1) NOT NULL DEFAULT 1,
    email_weekly_report TINYINT(1) NOT NULL DEFAULT 0,
    interview_reminders TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (candidate_id),
    CONSTRAINT fk_candidate_configuration_candidate
        FOREIGN KEY (candidate_id) REFERENCES candidate(id) ON DELETE CASCADE,
    CONSTRAINT chk_candidate_configuration_budget CHECK (daily_credit_budget BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Reprendre les choix enregistrés avant la création de cette table.
INSERT INTO candidate_configuration (
    candidate_id, target_role, target_city, salary_expectations, whatsapp_number,
    search_enabled, auto_apply_enabled, cover_letter_enabled, whatsapp_enabled,
    daily_credit_budget, mailbox_provider, mailbox_address, mailbox_connected,
    email_new_opportunities, email_weekly_report, interview_reminders
)
SELECT
    c.id,
    COALESCE(c.target_role, ''),
    COALESCE(c.city, ''),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(cp.raw_data, '$.salaryExpectations')), 'null'), ''), 120),
    LEFT(COALESCE(c.whatsapp_number, ''), 30),
    IF(JSON_UNQUOTE(JSON_EXTRACT(cp.raw_data, '$.automation.searchEnabled')) = 'true', 1, 0),
    IF(JSON_UNQUOTE(JSON_EXTRACT(cp.raw_data, '$.automation.autoApplyEnabled')) = 'true', 1, 0),
    IF(JSON_UNQUOTE(JSON_EXTRACT(cp.raw_data, '$.automation.coverLetterEnabled')) = 'true', 1, 0),
    IF(JSON_UNQUOTE(JSON_EXTRACT(cp.raw_data, '$.automation.whatsappEnabled')) = 'true', 1, 0),
    LEAST(5, GREATEST(1, COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(cp.raw_data, '$.automation.dailyCreditBudget')) AS UNSIGNED), 1))),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(cp.raw_data, '$.automation.mailboxProvider')), 'null'), ''), 20),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(cp.raw_data, '$.automation.mailboxAddress')), 'null'), ''), 254),
    0,
    IF(JSON_UNQUOTE(JSON_EXTRACT(cp.raw_data, '$.notifications.emailNewOpportunities')) = 'false', 0, 1),
    IF(JSON_UNQUOTE(JSON_EXTRACT(cp.raw_data, '$.notifications.emailWeeklyReport')) = 'true', 1, 0),
    IF(JSON_UNQUOTE(JSON_EXTRACT(cp.raw_data, '$.notifications.interviewReminders')) = 'false', 0, 1)
FROM candidate c
LEFT JOIN candidate_profile cp ON cp.candidate_id = c.id;
