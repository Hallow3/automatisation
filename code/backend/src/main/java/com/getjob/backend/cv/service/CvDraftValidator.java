package com.getjob.backend.cv.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * Validateur déterministe pour les ébauches de CV (CV Drafts) produites par Gemini Live ou le formulaire.
 * Empêche l'injection de JSON corrompu ou de volumétrie excessive.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class CvDraftValidator {

    private final ObjectMapper objectMapper;

    private static final int MAX_EXPERIENCES = 20;
    private static final int MAX_SUMMARY_LENGTH = 2000;
    private static final int MAX_SKILLS = 50;

    /**
     * Valide les données de draft et lève une ResponseStatusException HTTP 422 (UNPROCESSABLE_ENTITY)
     * en cas de non-conformité.
     */
    public void validateDraft(Object draftData) {
        if (draftData == null) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Le contenu du CV (draft) ne peut pas être vide.");
        }

        try {
            JsonNode rootNode = objectMapper.valueToTree(draftData);
            if (rootNode == null || rootNode.isNull() || rootNode.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Le format JSON du draft est vide ou invalide.");
            }

            // Vérification de la longueur du résumé professionnel
            JsonNode summaryNode = rootNode.get("summary");
            if (summaryNode != null && !summaryNode.isNull() && summaryNode.isTextual()) {
                if (summaryNode.asText().length() > MAX_SUMMARY_LENGTH) {
                    throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                            "Le résumé professionnel dépasse la limite autorisée de " + MAX_SUMMARY_LENGTH + " caractères.");
                }
            }

            // Vérification de l'intitulé de poste
            JsonNode headlineNode = rootNode.get("headline");
            if (headlineNode != null && !headlineNode.isNull() && headlineNode.isTextual()) {
                if (headlineNode.asText().length() > 150) {
                    throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                            "L'intitulé professionnel dépasse la limite autorisée de 150 caractères.");
                }
            }

            // Vérification des données d'identité
            JsonNode identityNode = rootNode.get("identity");
            if (identityNode != null && identityNode.isObject()) {
                if (identityNode.hasNonNull("fullName") && identityNode.get("fullName").asText().length() > 100) {
                    throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Le nom complet dépasse la limite autorisée de 100 caractères.");
                }
                if (identityNode.hasNonNull("email") && identityNode.get("email").asText().length() > 120) {
                    throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "L'adresse email dépasse la limite autorisée de 120 caractères.");
                }
                if (identityNode.hasNonNull("phone") && identityNode.get("phone").asText().length() > 50) {
                    throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Le numéro de téléphone dépasse la limite autorisée de 50 caractères.");
                }
                if (identityNode.hasNonNull("city") && identityNode.get("city").asText().length() > 100) {
                    throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "La localisation dépasse la limite autorisée de 100 caractères.");
                }
            }

            // Vérification du nombre et contenu des expériences
            JsonNode expNode = rootNode.get("experiences");
            if (expNode != null && expNode.isArray()) {
                if (expNode.size() > MAX_EXPERIENCES) {
                    throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                            "Le nombre d'expériences professionnelles ne peut pas dépasser " + MAX_EXPERIENCES + ".");
                }
                for (JsonNode exp : expNode) {
                    if (exp.hasNonNull("company") && exp.get("company").asText().length() > 120) {
                        throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Le nom d'entreprise ne peut pas dépasser 120 caractères.");
                    }
                    if (exp.hasNonNull("position") && exp.get("position").asText().length() > 120) {
                        throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "L'intitulé de poste ne peut pas dépasser 120 caractères.");
                    }
                    if (exp.hasNonNull("description") && exp.get("description").asText().length() > 1200) {
                        throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "La description du poste ne peut pas dépasser 1200 caractères.");
                    }
                }
            }

            // Vérification du nombre de compétences
            JsonNode skillsNode = rootNode.get("skills");
            if (skillsNode != null && skillsNode.isArray()) {
                if (skillsNode.size() > MAX_SKILLS) {
                    throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                            "Le nombre de compétences ne peut pas dépasser " + MAX_SKILLS + ".");
                }
            }

        } catch (ResponseStatusException rse) {
            throw rse;
        } catch (Exception ex) {
            log.warn("Erreur lors de la validation du draft CV : {}", ex.getMessage());
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Données de CV non exploitables : " + ex.getMessage());
        }
    }

    /**
     * Vérifie si le draft contient des informations substantielles (non vide).
     */
    public boolean isDraftMeaningful(String contentJson) {
        if (contentJson == null || contentJson.isBlank()) {
            return false;
        }
        try {
            JsonNode root = objectMapper.readTree(contentJson);
            if (root == null || root.isEmpty()) return false;

            boolean hasIdentity = root.has("identity") && (
                    root.get("identity").hasNonNull("fullName") ||
                    root.get("identity").hasNonNull("email")
            );

            boolean hasHeadline = root.hasNonNull("headline") && !root.get("headline").asText().isBlank();
            boolean hasSummary = root.hasNonNull("summary") && !root.get("summary").asText().isBlank();
            boolean hasExperiences = root.has("experiences") && root.get("experiences").isArray() && root.get("experiences").size() > 0;
            boolean hasEducation = root.has("education") && root.get("education").isArray() && root.get("education").size() > 0;
            boolean hasSkills = root.has("skills") && root.get("skills").isArray() && root.get("skills").size() > 0;

            return hasIdentity || hasHeadline || hasSummary || hasExperiences || hasEducation || hasSkills;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Analyse un draft finalisé et retourne les avertissements de complétude (sans lever d'exception).
     * Permet d'alerter le candidat en REVIEW sur les éventuels manques (dates, diplômes, compétences).
     */
    public List<String> checkCompletenessWarnings(Object draftData) {
        List<String> warnings = new ArrayList<>();
        if (draftData == null) {
            warnings.add("Aucune donnée de CV renseignée.");
            return warnings;
        }

        try {
            JsonNode root = objectMapper.valueToTree(draftData);
            if (root == null || root.isEmpty()) {
                warnings.add("Le contenu du CV est vide.");
                return warnings;
            }

            // 1. Identité
            JsonNode identityNode = root.get("identity");
            if (identityNode == null || !identityNode.hasNonNull("fullName") || identityNode.get("fullName").asText().isBlank()) {
                warnings.add("Le nom complet est manquant.");
            }

            // 2. Expériences & dates
            JsonNode expNode = root.get("experiences");
            if (expNode == null || !expNode.isArray() || expNode.isEmpty()) {
                warnings.add("Aucune expérience professionnelle n'a été ajoutée.");
            } else {
                int idx = 1;
                for (JsonNode exp : expNode) {
                    String title = exp.hasNonNull("position") ? exp.get("position").asText() : "Poste #" + idx;
                    boolean hasStart = exp.hasNonNull("startDate") && !exp.get("startDate").asText().isBlank();
                    boolean hasPeriod = exp.hasNonNull("period") && !exp.get("period").asText().isBlank();
                    if (!hasStart && !hasPeriod) {
                        warnings.add("Date ou période manquante pour l'expérience : " + title);
                    }
                    boolean hasBullets = (exp.has("responsibilities") && exp.get("responsibilities").isArray() && exp.get("responsibilities").size() > 0) ||
                                         (exp.hasNonNull("description") && !exp.get("description").asText().isBlank());
                    if (!hasBullets) {
                        warnings.add("Aucune responsabilité ou réalisation détaillée pour : " + title);
                    }
                    idx++;
                }
            }

            // 3. Formation
            JsonNode eduNode = root.get("education");
            if (eduNode == null || !eduNode.isArray() || eduNode.isEmpty()) {
                warnings.add("Aucune formation ou diplôme renseigné.");
            }

            // 4. Compétences
            JsonNode skillsNode = root.get("skills");
            if (skillsNode == null || !skillsNode.isArray() || skillsNode.size() < 2) {
                warnings.add("Moins de 2 compétences renseignées.");
            }

        } catch (Exception e) {
            log.warn("Erreur lors de l'analyse de complétude : {}", e.getMessage());
        }

        return warnings;
    }
}
