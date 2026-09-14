package com.getjob.backend.auth.dto;

/**
 * Réponse retournée après un login ou register réussi.
 *
 * Le token JWT est posé dans un cookie HttpOnly par le contrôleur.
 * Ce DTO contient uniquement les infos publiques de l'utilisateur
 * dont Angular a besoin pour afficher l'interface (nom, email).
 *
 * NE PAS inclure le token JWT dans ce DTO — il ne doit pas être
 * lisible depuis JavaScript (protection XSS).
 */
public record AuthResponse(
        Integer id,
        String fullName,
        String email,
        String role,
        String phone,
        String city,
        String targetRole,
        Integer proCredits
) {}
