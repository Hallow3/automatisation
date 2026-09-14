package com.getjob.backend.common.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ProblemDetail> handleResponseStatusException(ResponseStatusException ex) {
        log.warn("ResponseStatusException: status={}, reason={}", ex.getStatusCode(), ex.getReason());
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(ex.getStatusCode(), ex.getReason() != null ? ex.getReason() : "Erreur requête");
        problem.setTitle("Erreur de requête");
        problem.setProperty("timestamp", Instant.now());
        return ResponseEntity.status(ex.getStatusCode()).body(problem);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ProblemDetail> handleValidationExceptions(MethodArgumentNotValidException ex) {
        log.warn("Erreur de validation des champs DTO : {}", ex.getMessage());
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Données de formulaire invalides");
        problem.setTitle("Validation Failure");
        problem.setType(URI.create("urn:problem-type:validation-error"));
        problem.setProperty("timestamp", Instant.now());

        Map<String, String> fieldErrors = new HashMap<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            fieldErrors.put(error.getField(), error.getDefaultMessage());
        }
        problem.setProperty("errors", fieldErrors);

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(problem);
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ProblemDetail> handleBadCredentials(BadCredentialsException ex) {
        log.warn("Tentative de connexion échouée : identifiants incorrects");
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, "Email ou mot de passe incorrect");
        problem.setTitle("Authentication Failed");
        problem.setProperty("timestamp", Instant.now());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(problem);
    }

    @ExceptionHandler(org.springframework.security.authentication.DisabledException.class)
    public ResponseEntity<ProblemDetail> handleDisabledException(org.springframework.security.authentication.DisabledException ex) {
        log.warn("Tentative de connexion sur un compte non vérifié : {}", ex.getMessage());
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.FORBIDDEN,
                "EMAIL_NOT_VERIFIED: Votre adresse email n'a pas encore été validée. Veuillez saisir le code de confirmation envoyé à votre adresse email."
        );
        problem.setTitle("Email Verification Required");
        problem.setType(URI.create("urn:problem-type:email-not-verified"));
        problem.setProperty("timestamp", Instant.now());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(problem);
    }

    @ExceptionHandler(org.springframework.security.authentication.LockedException.class)
    public ResponseEntity<ProblemDetail> handleLockedException(org.springframework.security.authentication.LockedException ex) {
        log.warn("Tentative de connexion sur un compte verrouillé : {}", ex.getMessage());
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.FORBIDDEN,
                "Votre compte a été suspendu ou verrouillé. Veuillez contacter le support."
        );
        problem.setTitle("Account Locked");
        problem.setType(URI.create("urn:problem-type:account-locked"));
        problem.setProperty("timestamp", Instant.now());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(problem);
    }

    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    public ResponseEntity<ProblemDetail> handleDataIntegrityViolation(org.springframework.dao.DataIntegrityViolationException ex) {
        log.warn("Violation d'intégrité de données (contrainte d'unicité ou clé étrangère) : {}", ex.getMessage());
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.CONFLICT,
                "Une ressource avec ces identifiants existe déjà ou une contrainte de données n'est pas respectée."
        );
        problem.setTitle("Data Conflict");
        problem.setType(URI.create("urn:problem-type:conflict"));
        problem.setProperty("timestamp", Instant.now());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(problem);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ProblemDetail> handleIllegalArgument(IllegalArgumentException ex) {
        log.warn("Erreur d'argument ou règle métier non respectée : {}", ex.getMessage());
        String msg = ex.getMessage() != null ? ex.getMessage().toLowerCase() : "";
        HttpStatus status = (msg.contains("existe déjà") || msg.contains("already exists") || msg.contains("conflict"))
                ? HttpStatus.CONFLICT
                : HttpStatus.BAD_REQUEST;

        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, ex.getMessage() != null ? ex.getMessage() : "Requête invalide");
        problem.setTitle("Validation or Conflict Error");
        problem.setProperty("timestamp", Instant.now());
        return ResponseEntity.status(status).body(problem);
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ProblemDetail> handleIllegalState(IllegalStateException ex) {
        log.warn("État applicatif invalide ou étape non validée : {}", ex.getMessage());
        HttpStatus status = ex.getMessage() != null && ex.getMessage().contains("EMAIL_NOT_VERIFIED")
                ? HttpStatus.FORBIDDEN
                : HttpStatus.BAD_REQUEST;

        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, ex.getMessage() != null ? ex.getMessage() : "État invalide");
        problem.setTitle("Invalid State");
        problem.setProperty("timestamp", Instant.now());
        return ResponseEntity.status(status).body(problem);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ProblemDetail> handleAccessDenied(AccessDeniedException ex) {
        log.warn("Accès refusé : {}", ex.getMessage());
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN, "Vous n'avez pas les droits nécessaires pour accéder à cette ressource");
        problem.setTitle("Access Denied");
        problem.setProperty("timestamp", Instant.now());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(problem);
    }

    @ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class)
    public ResponseEntity<ProblemDetail> handleMaxUploadSizeExceeded(org.springframework.web.multipart.MaxUploadSizeExceededException ex) {
        log.warn("Fichier uploadé trop volumineux : {}", ex.getMessage());
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.PAYLOAD_TOO_LARGE,
                "Le fichier envoyé dépasse la taille maximale autorisée (8 Mo)."
        );
        problem.setTitle("Payload Too Large");
        problem.setType(URI.create("urn:problem-type:payload-too-large"));
        problem.setProperty("timestamp", Instant.now());
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(problem);
    }

    @ExceptionHandler(jakarta.validation.ConstraintViolationException.class)
    public ResponseEntity<ProblemDetail> handleConstraintViolation(jakarta.validation.ConstraintViolationException ex) {
        log.warn("Violation de contrainte : {}", ex.getMessage());
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Paramètre ou requête invalide : " + ex.getMessage());
        problem.setTitle("Constraint Violation");
        problem.setType(URI.create("urn:problem-type:constraint-violation"));
        problem.setProperty("timestamp", Instant.now());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(problem);
    }

    @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class)
    public ResponseEntity<ProblemDetail> handleHttpMessageNotReadable(org.springframework.http.converter.HttpMessageNotReadableException ex) {
        log.warn("Corps de requête illisible ou JSON malformé : {}", ex.getMessage());
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Corps de requête illisible ou format JSON invalide");
        problem.setTitle("Malformed JSON Request");
        problem.setType(URI.create("urn:problem-type:malformed-json"));
        problem.setProperty("timestamp", Instant.now());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(problem);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ProblemDetail> handleGenericException(Exception ex) {
        log.error("Exception inattendue capturée : ", ex);
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR, "Une erreur interne est survenue. Veuillez réessayer plus tard.");
        problem.setTitle("Internal Server Error");
        problem.setProperty("timestamp", Instant.now());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(problem);
    }
}
