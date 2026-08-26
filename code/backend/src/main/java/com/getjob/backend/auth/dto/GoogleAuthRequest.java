package com.getjob.backend.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record GoogleAuthRequest(
    @NotBlank(message = "Le jeton d'authentification Google (credential) est requis")
    String credential,

    String email,
    String fullName,
    String pictureUrl
) {}

