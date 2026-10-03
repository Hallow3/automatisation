package com.getjob.backend.candidate.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "candidate_configuration")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CandidateConfigurationEntity {
    @Id
    @Column(name = "candidate_id", nullable = false)
    private Integer candidateId;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "candidate_id", referencedColumnName = "id", insertable = false, updatable = false,
            foreignKey = @ForeignKey(name = "fk_candidate_configuration_candidate"))
    private CandidateEntity candidate;

    @Column(name = "target_role", nullable = false, length = 150)
    @Builder.Default private String targetRole = "";

    @Column(name = "target_city", nullable = false, length = 100)
    @Builder.Default private String targetCity = "";

    @Column(name = "salary_expectations", nullable = false, length = 120)
    @Builder.Default private String salaryExpectations = "";

    @Column(name = "whatsapp_number", nullable = false, length = 30)
    @Builder.Default private String whatsappNumber = "";

    @Column(name = "search_enabled", nullable = false)
    @Builder.Default private boolean searchEnabled = false;

    @Column(name = "auto_apply_enabled", nullable = false)
    @Builder.Default private boolean autoApplyEnabled = false;

    @Column(name = "cover_letter_enabled", nullable = false)
    @Builder.Default private boolean coverLetterEnabled = false;

    @Column(name = "whatsapp_enabled", nullable = false)
    @Builder.Default private boolean whatsappEnabled = false;

    @Column(name = "daily_credit_budget", nullable = false)
    @Builder.Default private int dailyCreditBudget = 1;

    @Column(name = "mailbox_provider", nullable = false, length = 20)
    @Builder.Default private String mailboxProvider = "";

    @Column(name = "mailbox_address", nullable = false, length = 254)
    @Builder.Default private String mailboxAddress = "";

    @Column(name = "mailbox_connected", nullable = false)
    @Builder.Default private boolean mailboxConnected = false;

    @Column(name = "email_new_opportunities", nullable = false)
    @Builder.Default private boolean emailNewOpportunities = true;

    @Column(name = "email_weekly_report", nullable = false)
    @Builder.Default private boolean emailWeeklyReport = false;

    @Column(name = "interview_reminders", nullable = false)
    @Builder.Default private boolean interviewReminders = true;
}
