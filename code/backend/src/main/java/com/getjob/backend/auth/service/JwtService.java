package com.getjob.backend.auth.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;

/**
 * Service responsable de la création, validation et lecture des tokens JWT.
 *
 * — Le token est signé avec HMAC-SHA256 (HS256).
 * — La clé secrète est injectée depuis la configuration (jamais dans le code).
 * — La durée de vie est de 24h (configurable).
 * — Ce service ne gère PAS le cookie : c'est le rôle de AuthController.
 */
@Service
@Slf4j
public class JwtService {

    /**
     * Clé secrète HMAC-SHA256.
     * Doit faire au moins 32 caractères (256 bits).
     * À définir dans application.yml via la variable d'env JWT_SECRET.
     */
    @Value("${jwt.secret}")
    private String secret;

    /** Durée de validité en millisecondes. 86400000 = 24h. */
    @Value("${jwt.expiration-ms:86400000}")
    private long expirationMs;

    // ── Génération ────────────────────────────────────────────────────────────

    /**
     * Génère un token JWT pour l'utilisateur donné.
     * Claims inclus : sub (email), candidateId, role, iat, exp.
     */
    public String generateToken(UserDetails userDetails, Integer candidateId) {
        Map<String, Object> extraClaims = new HashMap<>();
        extraClaims.put("candidateId", candidateId);
        // Le rôle est déjà dans les authorities, on l'ajoute aussi en claim
        // pour pouvoir le lire sans charger la DB à chaque requête.
        extraClaims.put("role", userDetails.getAuthorities().stream()
                .findFirst()
                .map(Object::toString)
                .orElse("ROLE_USER"));
        return buildToken(extraClaims, userDetails);
    }

    private String buildToken(Map<String, Object> extraClaims, UserDetails userDetails) {
        return Jwts.builder()
                .claims(extraClaims)
                .subject(userDetails.getUsername())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expirationMs))
                .signWith(getSigningKey())
                .compact();
    }

    // ── Validation ────────────────────────────────────────────────────────────

    /**
     * Retourne true si le token est valide pour cet utilisateur et non expiré.
     */
    public boolean isTokenValid(String token, UserDetails userDetails) {
        try {
            final String username = extractUsername(token);
            return username.equals(userDetails.getUsername()) && !isTokenExpired(token);
        } catch (JwtException | IllegalArgumentException e) {
            log.warn("Token JWT invalide : {}", e.getMessage());
            return false;
        }
    }

    public boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }

    // ── Extraction des claims ─────────────────────────────────────────────────

    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public Integer extractCandidateId(String token) {
        return extractClaim(token, claims -> claims.get("candidateId", Integer.class));
    }

    public Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }

    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    private SecretKey getSigningKey() {
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(keyBytes);
    }
}
