package com.getjob.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Configuration CORS pour les cookies cross-origin.
 *
 * ── Pourquoi cette config est importante avec les cookies ────────────────────
 *
 * Quand Angular envoie des requêtes avec `withCredentials: true` (pour joindre
 * le cookie jwt_token), le navigateur applique des règles CORS strictes :
 *
 *   1. Le serveur DOIT retourner `Access-Control-Allow-Credentials: true`
 *   2. `Access-Control-Allow-Origin` NE PEUT PAS être "*"
 *      → Il faut lister les origines autorisées explicitement.
 *
 * En dev : Angular tourne sur http://localhost:4200
 * En prod : à ajouter dans cors.allowed-origins via variables d'env
 */
@Configuration
public class CorsConfig {

    /**
     * Origines autorisées, séparées par des virgules.
     * Exemple en prod : CORS_ALLOWED_ORIGINS=https://app.getjob.fr,https://www.getjob.fr
     */
    @Value("${cors.allowed-origins:http://localhost:4200}")
    private String[] allowedOrigins;

    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/**")
                        // Origines explicites (pas de wildcard avec credentials)
                        .allowedOrigins(allowedOrigins)
                        .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                        .allowedHeaders("*")
                        // OBLIGATOIRE pour que le navigateur envoie et reçoive les cookies
                        .allowCredentials(true)
                        // Cache la réponse preflight 1h (réduit les requêtes OPTIONS)
                        .maxAge(3600);
            }
        };
    }
}
