package com.getjob.backend.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record VerifyEmailRequest(
    @NotBlank(message = "L'adresse email est requise")
    @Email(message = "Format d'adresse email invalide")
    String email,

    @NotBlank(message = "Le code de validation est requis")
    @Size(min = 4, max = 10, message = "Le code doit comporter entre 4 et 10 caractères")
    String code
) {}
