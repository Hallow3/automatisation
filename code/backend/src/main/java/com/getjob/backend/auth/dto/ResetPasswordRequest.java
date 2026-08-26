package com.getjob.backend.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ResetPasswordRequest(
    @NotBlank(message = "L'adresse email est requise")
    @Email(message = "Format d'adresse email invalide")
    String email,

    String token,

    @NotBlank(message = "Le nouveau mot de passe est requis")
    @Size(min = 8, message = "Le mot de passe doit comporter au moins 8 caractères")
    String newPassword
) {}
