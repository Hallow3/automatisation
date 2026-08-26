package com.getjob.backend.auth.filter;

import com.getjob.backend.auth.controller.AuthController;
import com.getjob.backend.auth.service.CandidateUserDetailsService;
import com.getjob.backend.auth.service.JwtService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Arrays;
import java.util.Optional;

/**
 * Filtre Spring Security — exécuté UNE FOIS par requête.
 *
 * Rôle :
 *   1. Extrait le token JWT depuis le cookie "jwt_token".
 *   2. Valide le token.
 *   3. Charge l'utilisateur depuis la DB.
 *   4. Pose l'Authentication dans le SecurityContext.
 *
 * Si le cookie est absent ou le token invalide, le filtre laisse passer la requête
 * sans authentification → Spring Security retournera 401 sur les routes protégées.
 *
 * ── Pourquoi lire le cookie et pas le header Authorization ? ─────────────────
 * Le choix du cookie HttpOnly signifie que JavaScript ne peut pas lire ni envoyer
 * le token manuellement. C'est le navigateur qui gère l'envoi automatique du cookie.
 * On lit donc le cookie côté Spring, pas un header.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final CandidateUserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        // 1. Extraire le token depuis les cookies
        String token = extractTokenFromCookie(request).orElse(null);

        // 2. Pas de cookie ou token vide → on passe sans authentifier
        if (token == null || token.isBlank()) {
            filterChain.doFilter(request, response);
            return;
        }

        // 3. Extraire l'email depuis le token (sans vérifier la signature encore)
        String email;
        try {
            email = jwtService.extractUsername(token);
        } catch (Exception e) {
            log.debug("Token JWT illisible : {}", e.getMessage());
            filterChain.doFilter(request, response);
            return;
        }

        // 4. Si un utilisateur est déjà authentifié dans le contexte, ne pas retraiter
        if (email != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            UserDetails userDetails;
            try {
                userDetails = userDetailsService.loadUserByUsername(email);
            } catch (Exception e) {
                log.debug("Utilisateur introuvable pour le token : {}", e.getMessage());
                filterChain.doFilter(request, response);
                return;
            }

            // 5. Valider le token (signature + expiration + correspondance email)
            if (jwtService.isTokenValid(token, userDetails)) {
                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(
                                userDetails,
                                null,
                                userDetails.getAuthorities()
                        );
                authentication.setDetails(
                        new WebAuthenticationDetailsSource().buildDetails(request)
                );
                // 6. Poser l'authentification dans le contexte Spring Security
                SecurityContextHolder.getContext().setAuthentication(authentication);
            } else {
                log.debug("Token JWT invalide ou expiré pour : {}", email);
            }
        }

        filterChain.doFilter(request, response);
    }

    /**
     * Lit le cookie "jwt_token" dans la requête.
     * Retourne Optional.empty() si absent.
     */
    private Optional<String> extractTokenFromCookie(HttpServletRequest request) {
        if (request.getCookies() == null) return Optional.empty();
        return Arrays.stream(request.getCookies())
                .filter(c -> AuthController.JWT_COOKIE_NAME.equals(c.getName()))
                .map(Cookie::getValue)
                .findFirst();
    }
}
