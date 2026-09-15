package com.getjob.backend.auth.service;

import com.getjob.backend.auth.dto.AuthResponse;
import com.getjob.backend.auth.dto.LoginRequest;
import com.getjob.backend.auth.dto.RegisterRequest;
import com.getjob.backend.candidate.domain.CandidateEntity;
import com.getjob.backend.candidate.repository.CandidateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.util.Collections;

/**
 * Service métier d'authentification.
 *
 * Responsabilités :
 *   - register : crée le compte candidat avec mot de passe hashé
 *   - login    : vérifie les credentials via AuthenticationManager, retourne le token
 *
 * Ce service ne gère PAS le cookie ni la réponse HTTP : c'est le rôle de AuthController.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class AuthService {

    @Value("${google.client-id:}")
    private String googleClientId;

    private final CandidateRepository candidateRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final CandidateUserDetailsService userDetailsService;
    private final AuthEmailService authEmailService;

    /**
     * Crée un nouveau compte candidat avec validation d'email requise.
     */
    @Transactional
    public java.util.Map<String, Object> register(RegisterRequest request) {
        String email = request.email().trim().toLowerCase();
        if (candidateRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("Un compte existe déjà pour cet email.");
        }

        String code = String.format("%06d", new java.security.SecureRandom().nextInt(1_000_000));

        CandidateEntity candidate = CandidateEntity.builder()
                .fullName(request.fullName().trim())
                .email(email)
                .passwordHash(passwordEncoder.encode(request.password()))
                .role("ROLE_USER")
                .enabled(false) // Validation d'email requise avant connexion
                .verificationCode(code)
                .verificationCodeExpiresAt(java.time.Instant.now().plus(15, java.time.temporal.ChronoUnit.MINUTES))
                .proCredits(1)
                .build();

        CandidateEntity saved = candidateRepository.save(candidate);
        log.info("Nouveau compte candidat créé (non vérifié) : id={} email={}", saved.getId(), saved.getEmail());

        authEmailService.sendEmailVerificationCode(saved.getEmail(), code);

        return java.util.Map.of(
                "message", "Votre compte a été créé. Un code de confirmation à 6 chiffres a été envoyé à votre adresse email.",
                "email", saved.getEmail(),
                "requiresVerification", true
        );
    }

    /**
     * Authentifie un candidat avec email + mot de passe.
     * Bloque la connexion si l'adresse email n'a pas été validée.
     */
    public TokenWithResponse login(LoginRequest request) {
        String email = request.email().trim().toLowerCase();

        // Vérifie les identifiants
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(email, request.password())
            );
        } catch (org.springframework.security.authentication.DisabledException | org.springframework.security.authentication.LockedException e) {
            CandidateEntity unverifiedCandidate = candidateRepository.findByEmail(email).orElse(null);
            if (unverifiedCandidate != null) {
                if (unverifiedCandidate.getVerificationCode() == null ||
                    unverifiedCandidate.getVerificationCodeExpiresAt() == null ||
                    java.time.Instant.now().isAfter(unverifiedCandidate.getVerificationCodeExpiresAt())) {
                    String newCode = String.format("%06d", new java.security.SecureRandom().nextInt(1_000_000));
                    unverifiedCandidate.setVerificationCode(newCode);
                    unverifiedCandidate.setVerificationCodeExpiresAt(java.time.Instant.now().plus(15, java.time.temporal.ChronoUnit.MINUTES));
                    candidateRepository.save(unverifiedCandidate);
                    authEmailService.sendEmailVerificationCode(unverifiedCandidate.getEmail(), newCode);
                }
            }
            throw new IllegalStateException("EMAIL_NOT_VERIFIED: Votre adresse email n'a pas encore été validée. Veuillez saisir le code de confirmation envoyé à " + email);
        }

        CandidateEntity candidate = candidateRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalStateException("Compte introuvable après authentification."));

        if (!candidate.isEnabled()) {
            throw new IllegalStateException("EMAIL_NOT_VERIFIED: Votre adresse email n'a pas encore été validée. Veuillez saisir le code de confirmation envoyé à " + candidate.getEmail());
        }

        UserDetails userDetails = userDetailsService.loadUserByUsername(candidate.getEmail());
        String token = jwtService.generateToken(userDetails, candidate.getId());
        AuthResponse response = toAuthResponse(candidate);

        log.info("Login réussi : id={} email={}", candidate.getId(), candidate.getEmail());
        return new TokenWithResponse(token, response);
    }

    /**
     * Valide l'adresse email d'un candidat à l'aide d'un code à 6 chiffres.
     */
    @Transactional
    public TokenWithResponse verifyEmail(com.getjob.backend.auth.dto.VerifyEmailRequest request) {
        String email = request.email().trim().toLowerCase();
        CandidateEntity candidate = candidateRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Compte introuvable pour cet email."));

        if (candidate.isEnabled()) {
            UserDetails userDetails = userDetailsService.loadUserByUsername(candidate.getEmail());
            String token = jwtService.generateToken(userDetails, candidate.getId());
            return new TokenWithResponse(token, toAuthResponse(candidate));
        }

        if (candidate.getVerificationCode() == null || !candidate.getVerificationCode().equals(request.code().trim())) {
            throw new IllegalArgumentException("Code de validation incorrect. Vérifiez le code reçu par email.");
        }

        if (candidate.getVerificationCodeExpiresAt() != null && java.time.Instant.now().isAfter(candidate.getVerificationCodeExpiresAt())) {
            throw new IllegalArgumentException("Le code de validation a expiré (validité 15 min). Veuillez demander un nouveau code.");
        }

        // Activation du compte
        candidate.setEnabled(true);
        candidate.setVerificationCode(null);
        candidate.setVerificationCodeExpiresAt(null);
        candidateRepository.save(candidate);

        log.info("Compte validé avec succès : id={} email={}", candidate.getId(), candidate.getEmail());

        UserDetails userDetails = userDetailsService.loadUserByUsername(candidate.getEmail());
        String token = jwtService.generateToken(userDetails, candidate.getId());
        return new TokenWithResponse(token, toAuthResponse(candidate));
    }

    /**
     * Renvoie un code de validation d'email.
     */
    @Transactional
    public java.util.Map<String, String> resendVerificationCode(com.getjob.backend.auth.dto.ResendVerificationRequest request) {
        String email = request.email().trim().toLowerCase();
        CandidateEntity candidate = candidateRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Compte introuvable pour cet email."));

        if (candidate.isEnabled()) {
            return java.util.Map.of("message", "Votre compte est déjà validé. Vous pouvez vous connecter directement.");
        }

        String code = String.format("%06d", new java.security.SecureRandom().nextInt(1_000_000));
        candidate.setVerificationCode(code);
        candidate.setVerificationCodeExpiresAt(java.time.Instant.now().plus(15, java.time.temporal.ChronoUnit.MINUTES));
        candidateRepository.save(candidate);

        authEmailService.sendEmailVerificationCode(candidate.getEmail(), code);
        return java.util.Map.of("message", "Un nouveau code de confirmation a été envoyé à votre adresse email.");
    }

    /**
     * Charge le profil de l'utilisateur connecté par son email.
     * Utilisé par GET /api/v1/auth/me.
     */
    public AuthResponse getProfile(String email) {
        CandidateEntity candidate = candidateRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalStateException("Compte introuvable : " + email));
        return toAuthResponse(candidate);
    }

    private AuthResponse toAuthResponse(CandidateEntity candidate) {
        return new AuthResponse(
                candidate.getId(),
                candidate.getFullName(),
                candidate.getEmail(),
                candidate.getRole(),
                candidate.getPhone(),
                candidate.getCity(),
                candidate.getTargetRole(),
                candidate.getProCredits() != null ? candidate.getProCredits() : 1
        );
    }

    /**
     * Traite une demande de réinitialisation de mot de passe.
     */
    @Transactional
    public java.util.Map<String, String> forgotPassword(com.getjob.backend.auth.dto.ForgotPasswordRequest request) {
        String email = request.email().trim().toLowerCase();
        candidateRepository.findByEmail(email).ifPresent(candidate -> {
            String code = String.format("%06d", new java.security.SecureRandom().nextInt(1_000_000));
            candidate.setResetPasswordCode(code);
            candidate.setResetPasswordExpiresAt(java.time.Instant.now().plus(15, java.time.temporal.ChronoUnit.MINUTES));
            candidateRepository.save(candidate);

            authEmailService.sendPasswordResetCode(candidate.getEmail(), code);
            log.info("Code de réinitialisation généré pour email={}", email);
        });
        return java.util.Map.of(
                "message",
                "Si un compte est associé à cette adresse, vous recevrez un code de réinitialisation."
        );
    }

    /**
     * Réinitialise le mot de passe d'un candidat et valide son compte.
     */
    @Transactional
    public java.util.Map<String, String> resetPassword(com.getjob.backend.auth.dto.ResetPasswordRequest request) {
        String email = request.email().trim().toLowerCase();
        CandidateEntity candidate = candidateRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Compte introuvable pour l'adresse fournie."));

        String tokenOrCode = request.token() != null ? request.token().trim() : "";
        if (tokenOrCode.isBlank() || candidate.getResetPasswordCode() == null || !candidate.getResetPasswordCode().equals(tokenOrCode)) {
            throw new IllegalArgumentException("Code de réinitialisation invalide ou absent.");
        }

        if (candidate.getResetPasswordExpiresAt() == null || java.time.Instant.now().isAfter(candidate.getResetPasswordExpiresAt())) {
            throw new IllegalArgumentException("Le code de réinitialisation a expiré.");
        }

        candidate.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        candidate.setEnabled(true); // Preuve d'accès à l'email = compte activé
        candidate.setResetPasswordCode(null);
        candidate.setResetPasswordExpiresAt(null);
        candidateRepository.save(candidate);

        log.info("Mot de passe mis à jour et compte validé pour candidat id={} email={}", candidate.getId(), candidate.getEmail());
        return java.util.Map.of("message", "Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter.");
    }

    /**
     * Vérifie la validité cryptographique du jeton d'identification Google ID Token.
     */
    private GoogleIdToken.Payload verifyGoogleToken(String idTokenString) {
        if (idTokenString == null || idTokenString.isBlank()) {
            throw new IllegalArgumentException("Le jeton de sécurité Google (credential) est manquant.");
        }
        if (googleClientId == null || googleClientId.isBlank()) {
            log.error("Google Sign-In rejeté : GOOGLE_CLIENT_ID non configuré sur le serveur.");
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "L'authentification Google n'est pas encore activée sur cette plateforme (configuration manquante)."
            );
        }

        try {
            GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(
                    new NetHttpTransport(),
                    GsonFactory.getDefaultInstance()
            )
            .setAudience(Collections.singletonList(googleClientId.trim()))
            .build();
            GoogleIdToken idToken = verifier.verify(idTokenString);

            if (idToken == null) {
                log.warn("Jeton Google ID invalide ou expiré.");
                throw new IllegalArgumentException("Le jeton d'authentification Google est invalide ou a expiré.");
            }

            GoogleIdToken.Payload payload = idToken.getPayload();
            if (payload.getEmail() == null || payload.getEmail().isBlank()) {
                throw new IllegalArgumentException("Adresse email introuvable dans le jeton d'authentification Google.");
            }

            return payload;
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            log.error("Erreur technique lors de la validation du token Google : {}", e.getMessage());
            throw new IllegalArgumentException("Échec de validation du jeton Google : " + e.getMessage());
        }
    }

    /**
     * Authentification ou inscription automatique sécurisée via Google Sign-In (vérifié cryptographiquement).
     */
    @Transactional
    public TokenWithResponse loginWithGoogle(com.getjob.backend.auth.dto.GoogleAuthRequest request) {
        GoogleIdToken.Payload payload = verifyGoogleToken(request.credential());
        String email = payload.getEmail().trim().toLowerCase();

        String verifiedName = (String) payload.get("name");
        String finalName = (verifiedName != null && !verifiedName.isBlank())
                ? verifiedName
                : (request.fullName() != null && !request.fullName().isBlank() ? request.fullName() : email.split("@")[0]);

        CandidateEntity candidate = candidateRepository.findByEmail(email).orElseGet(() -> {
            CandidateEntity newCandidate = CandidateEntity.builder()
                    .fullName(finalName)
                    .email(email)
                    .passwordHash(passwordEncoder.encode(java.util.UUID.randomUUID().toString()))
                    .role("ROLE_USER")
                    .enabled(true)
                    .proCredits(1)
                    .build();

            CandidateEntity saved = candidateRepository.save(newCandidate);
            log.info("Nouveau compte créé via Google Sign-In sécurisé : id={} email={}", saved.getId(), saved.getEmail());
            return saved;
        });

        // S'assurer que le compte vérifié par Google est activé
        if (!candidate.isEnabled()) {
            candidate.setEnabled(true);
            candidateRepository.save(candidate);
        }

        UserDetails userDetails = userDetailsService.loadUserByUsername(candidate.getEmail());
        String token = jwtService.generateToken(userDetails, candidate.getId());
        AuthResponse response = toAuthResponse(candidate);

        log.info("Google Sign-In sécurisé réussi : id={} email={}", candidate.getId(), candidate.getEmail());
        return new TokenWithResponse(token, response);
    }

    /**
     * Conteneur interne : token JWT + DTO réponse.
     * Permet au contrôleur de poser le cookie ET de retourner le DTO séparément.
     */
    public record TokenWithResponse(String token, AuthResponse authResponse) {}
}
