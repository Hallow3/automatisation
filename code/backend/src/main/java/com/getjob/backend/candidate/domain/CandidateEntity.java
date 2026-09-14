package com.getjob.backend.candidate.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "candidate")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CandidateEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "full_name")
    private String fullName;

    @Column(unique = true)
    private String email;

    /** Mot de passe hashé avec BCrypt. Nullable pour les comptes créés avant l'auth. */
    @Column(name = "password_hash")
    private String passwordHash;

    /**
     * Rôle Spring Security : "ROLE_USER" ou "ROLE_ADMIN".
     * Stocké en clair, préfixé ROLE_ comme attendu par Spring.
     */
    @Column(nullable = false)
    @Builder.Default
    private String role = "ROLE_USER";

    /**
     * Compte activé. false = compte non vérifié ou désactivé.
     */
    @Column(nullable = false)
    @Builder.Default
    private boolean enabled = false;

    @Column(name = "verification_code")
    private String verificationCode;

    @Column(name = "verification_code_expires_at")
    private Instant verificationCodeExpiresAt;

    @Column(name = "reset_password_code")
    private String resetPasswordCode;

    @Column(name = "reset_password_expires_at")
    private Instant resetPasswordExpiresAt;

    private String phone;

    @Column(name = "whatsapp_number")
    private String whatsappNumber;

    @Column(name = "target_role")
    private String targetRole;

    private String city;

    @Column(name = "ai_interviews_used", nullable = false)
    @Builder.Default
    private Integer aiInterviewsUsed = 0;

    @Column(name = "ai_interviews_reset_date")
    private java.time.LocalDate aiInterviewsResetDate;

    @Column(name = "pro_credits", nullable = false)
    @Builder.Default
    private Integer proCredits = 0;

    @Column(name = "is_pro_agent", nullable = false)
    @Builder.Default
    private boolean isProAgent = false;

    @Column(name = "agent_shop_name")
    private String agentShopName;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;
}
