package com.getjob.backend.config;

import com.getjob.backend.auth.filter.JwtAuthenticationFilter;
import com.getjob.backend.auth.service.CandidateUserDetailsService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Configuration Spring Security pour l'authentification JWT + cookie HttpOnly.
 *
 * ── Principes ────────────────────────────────────────────────────────────────
 *
 * STATELESS : Spring ne crée pas de session HTTP (pas de HttpSession).
 *   Le token JWT remplace la session. Chaque requête est authentifiée
 *   indépendamment via le cookie.
 *
 * CSRF désactivé : on utilise SameSite=Strict sur le cookie ET des requêtes
 *   cross-origin controlées par CORS. SameSite=Strict protège contre le CSRF
 *   en bloquant les requêtes initiées depuis un autre site.
 *   Note : si tu passes à SameSite=None (pour du cross-site), il faudra
 *   réactiver la protection CSRF.
 *
 * 401 au lieu de 302 : par défaut Spring redirige vers /login en HTML.
 *   On configure un point d'entrée qui retourne 401 JSON, car Angular
 *   gère la redirection côté client.
 *
 * ── Routes publiques ──────────────────────────────────────────────────────────
 *   POST /api/v1/auth/register   → création de compte
 *   POST /api/v1/auth/login      → connexion
 *   POST /api/v1/auth/logout     → déconnexion (cookie supprimé côté serveur)
 *
 * ── Routes protégées ─────────────────────────────────────────────────────────
 *   Tout le reste de /api/v1/** nécessite un cookie jwt_token valide.
 */
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthFilter;
    private final com.getjob.backend.auth.filter.RateLimitFilter rateLimitFilter;
    private final CandidateUserDetailsService userDetailsService;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // ── Désactivation CSRF ────────────────────────────────────────
                // Justification : SameSite=Strict sur le cookie + CORS strict
                // assurent la protection équivalente pour notre cas d'usage.
                .csrf(AbstractHttpConfigurer::disable)

                // ── Routes publiques et protégées ─────────────────────────────
                .authorizeHttpRequests(auth -> auth
                        // Auth endpoints : toujours publics
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/register").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/verify-email").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/resend-verification").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/login").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/logout").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/forgot-password").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/reset-password").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/google").permitAll()
                        // Tout le reste requiert une authentification
                        .anyRequest().authenticated()
                )

                // ── Pas de session HTTP (stateless JWT) ───────────────────────
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                )

                // ── 401 JSON au lieu de redirect HTML ─────────────────────────
                // Angular intercepte le 401 et redirige vers /login côté client.
                .exceptionHandling(ex ->
                        ex.authenticationEntryPoint(
                                new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)
                        )
                )

                // ── Provider d'authentification ───────────────────────────────
                .authenticationProvider(authenticationProvider())

                // ── Rate Limiter & Filtre JWT avant le filtre username/password de Spring ─────
                .addFilterBefore(rateLimitFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /**
     * Provider qui utilise CandidateUserDetailsService + BCrypt.
     * Spring AuthenticationManager délègue à ce provider pour vérifier
     * email + mot de passe lors du login.
     */
    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    /**
     * BCrypt avec force 12 (bon compromis sécurité/performance en 2026).
     * BCrypt est résistant aux attaques par dictionnaire et rainbow table.
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    /**
     * AuthenticationManager exposé en bean pour pouvoir l'injecter dans AuthService.
     */
    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config)
            throws Exception {
        return config.getAuthenticationManager();
    }
}
