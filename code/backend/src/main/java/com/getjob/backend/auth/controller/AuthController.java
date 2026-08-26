package com.getjob.backend.auth.controller;

import com.getjob.backend.auth.dto.AuthResponse;
import com.getjob.backend.auth.dto.LoginRequest;
import com.getjob.backend.auth.dto.RegisterRequest;
import com.getjob.backend.auth.service.AuthService;
import com.getjob.backend.auth.service.AuthService.TokenWithResponse;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.Map;

/**
 * Contrôleur d'authentification.
 *
 * ── Stratégie Cookie HttpOnly ────────────────────────────────────────────────
 *
 * Pourquoi HttpOnly ?
 *   Le token JWT est posé dans un cookie marqué HttpOnly. Cela signifie que
 *   JavaScript (Angular) ne peut PAS le lire via document.cookie.
 *   Même si un script malveillant s'exécute dans le navigateur (attaque XSS),
 *   il ne peut pas voler le token.
 *
 * Comment Angular sait qu'on est connecté ?
 *   Le body de /login et /register retourne l'objet AuthResponse (id, nom, email, rôle).
 *   Angular stocke cet objet dans un signal/BehaviorSubject pour l'affichage.
 *   Sur toutes les requêtes API suivantes, Angular envoie withCredentials: true
 *   (via un HttpInterceptor), ce qui fait que le navigateur joint automatiquement
 *   le cookie au header de chaque requête. Spring valide le cookie → accès accordé.
 *
 * Pourquoi Secure = false en dev ?
 *   Secure = true exige HTTPS. En localhost (HTTP), il faut Secure = false.
 *   En production, mettre jwt.cookie.secure=true dans les variables d'env.
 *
 * ── Endpoints ────────────────────────────────────────────────────────────────
 *   POST /api/v1/auth/register  → créer un compte
 *   POST /api/v1/auth/login     → se connecter
 *   POST /api/v1/auth/logout    → supprimer le cookie
 *   GET  /api/v1/auth/me        → profil de l'utilisateur connecté
 */
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Slf4j
public class AuthController {

    /** Nom du cookie JWT. Doit être le même partout. */
    public static final String JWT_COOKIE_NAME = "jwt_token";

    @Value("${jwt.cookie.secure:false}")
    private boolean cookieSecure;

    @Value("${jwt.expiration-ms:86400000}")
    private long expirationMs;

    private final AuthService authService;

    // ── Register ──────────────────────────────────────────────────────────────

    /**
     * Crée un compte candidat et envoie un code de validation d'email.
     * Ne connecte PAS l'utilisateur tant que l'email n'a pas été validé.
     */
    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> register(
            @Valid @RequestBody RegisterRequest request) {
        Map<String, Object> result = authService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    // ── Validation de l'email ──────────────────────────────────────────────────

    /**
     * Valide le compte avec le code à 6 chiffres et connecte l'utilisateur.
     */
    @PostMapping("/verify-email")
    public ResponseEntity<AuthResponse> verifyEmail(
            @Valid @RequestBody com.getjob.backend.auth.dto.VerifyEmailRequest request,
            HttpServletResponse response) {
        TokenWithResponse result = authService.verifyEmail(request);
        addJwtCookie(response, result.token());
        return ResponseEntity.ok(result.authResponse());
    }

    /**
     * Renvoie un code de confirmation d'email.
     */
    @PostMapping("/resend-verification")
    public ResponseEntity<Map<String, String>> resendVerification(
            @Valid @RequestBody com.getjob.backend.auth.dto.ResendVerificationRequest request) {
        return ResponseEntity.ok(authService.resendVerificationCode(request));
    }

    // ── Login ─────────────────────────────────────────────────────────────────

    /**
     * Authentifie un utilisateur.
     * Pose le cookie JWT + retourne le profil.
     */
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletResponse response) {

        TokenWithResponse result = authService.login(request);
        addJwtCookie(response, result.token());
        return ResponseEntity.ok(result.authResponse());
    }

    // ── Google Sign-In ───────────────────────────────────────────────────────

    @PostMapping("/google")
    public ResponseEntity<AuthResponse> loginWithGoogle(
            @Valid @RequestBody com.getjob.backend.auth.dto.GoogleAuthRequest request,
            HttpServletResponse response) {
        TokenWithResponse result = authService.loginWithGoogle(request);
        addJwtCookie(response, result.token());
        return ResponseEntity.ok(result.authResponse());
    }

    // ── Mot de passe oublié & Réinitialisation ─────────────────────────────────

    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, String>> forgotPassword(
            @Valid @RequestBody com.getjob.backend.auth.dto.ForgotPasswordRequest request) {
        return ResponseEntity.ok(authService.forgotPassword(request));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, String>> resetPassword(
            @Valid @RequestBody com.getjob.backend.auth.dto.ResetPasswordRequest request) {
        return ResponseEntity.ok(authService.resetPassword(request));
    }

    // ── Logout ────────────────────────────────────────────────────────────────

    /**
     * Déconnecte l'utilisateur en supprimant le cookie JWT.
     * Le cookie est écrasé par un cookie vide avec maxAge=0.
     */
    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(HttpServletResponse response) {
        Cookie cookie = new Cookie(JWT_COOKIE_NAME, "");
        cookie.setHttpOnly(true);
        cookie.setSecure(cookieSecure);
        cookie.setPath("/");
        cookie.setMaxAge(0);
        response.addCookie(cookie);
        return ResponseEntity.ok(Map.of("message", "Déconnexion réussie."));
    }

    // ── Me ────────────────────────────────────────────────────────────────────

    /**
     * Retourne le profil de l'utilisateur actuellement connecté.
     *
     * Angular appelle cet endpoint au démarrage pour vérifier si la session
     * est encore valide (cookie non expiré). Si le cookie est expiré ou absent,
     * Spring Security retourne 401 et Angular redirige vers /login.
     */
    @GetMapping("/me")
    public ResponseEntity<AuthResponse> me(
            @AuthenticationPrincipal UserDetails userDetails) {

        // Le JwtAuthenticationFilter a déjà chargé l'utilisateur dans le contexte.
        // On recharge depuis la DB pour avoir les infos complètes à jour.
        AuthResponse profile = authService.getProfile(userDetails.getUsername());
        return ResponseEntity.ok(profile);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Pose le cookie JWT dans la réponse HTTP.
     *
     * Attributs :
     *   HttpOnly  → JavaScript ne peut pas lire le cookie (protection XSS)
     *   Secure    → Uniquement sur HTTPS (false en dev, true en prod)
     *   Path=/    → Cookie envoyé sur toutes les routes
     *   SameSite=Strict → Cookie envoyé uniquement si la requête vient du même domaine
     *                     (protection CSRF basique)
     *   MaxAge    → Durée de vie en secondes (même durée que le token JWT)
     */
    private void addJwtCookie(HttpServletResponse response, String token) {
        // L'API Servlet Cookie ne supporte pas SameSite → on passe par Set-Cookie header
        int maxAgeSeconds = (int) (expirationMs / 1000);
        String cookieValue = String.format(
                "%s=%s; Max-Age=%d; Path=/; HttpOnly; SameSite=Strict%s",
                JWT_COOKIE_NAME,
                token,
                maxAgeSeconds,
                cookieSecure ? "; Secure" : ""
        );
        response.addHeader("Set-Cookie", cookieValue);
    }
}
