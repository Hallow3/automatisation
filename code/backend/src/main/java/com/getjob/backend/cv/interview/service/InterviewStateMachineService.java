package com.getjob.backend.cv.interview.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Pattern;

/**
 * Machine à états finis déterministe pour le parcours d'entretien vocal CV (Spec V2).
 * Contrôle l'ordre strict des sections, les critères de complétude, les plafonds de tours (max_turns),
 * et la validation d'arrêt utilisateur.
 */
@Service
@Slf4j
public class InterviewStateMachineService {

    public static final List<String> SECTION_ORDER = List.of(
            "IDENTITY",
            "TARGET",
            "EXPERIENCE",
            "PROJECTS",
            "EDUCATION",
            "SKILLS",
            "LANGUAGES",
            "FINALIZE",
            "REVIEW",
            "DONE"
    );

    public static final Map<String, Integer> MAX_TURNS = Map.of(
            "IDENTITY", 3,
            "TARGET", 4,
            "EXPERIENCE", 6,
            "PROJECTS", 4,
            "EDUCATION", 4,
            "SKILLS", 4,
            "LANGUAGES", 3
    );

    // Expressions explicites d'arrêt utilisateur
    private static final List<Pattern> EXPLICIT_STOP_PATTERNS = List.of(
            Pattern.compile("(?i)\\b(arr[eê]te(r)?|stop|quitter|arr[eê]ter l'entretien|on peut arr[eê]ter)\\b"),
            Pattern.compile("(?i)\\b(je veux (arr[eê]ter|quitter)|arr[eê]te l'entretien|je pr[eé]f[eè]re arr[eê]ter)\\b"),
            Pattern.compile("(?i)\\b(continuer plus tard|reprendre plus tard|on continue plus tard|finir plus tard)\\b"),
            Pattern.compile("(?i)\\b(c'est bon[,\\s]+stop|pause|mettre en pause|je dois y aller|je dois couper)\\b")
    );

    // Expressions de suite ou de refus d'élément (qui NE SONT PAS des arrêts de l'entretien)
    private static final List<Pattern> CONTINUATION_NOT_STOP_PATTERNS = List.of(
            Pattern.compile("(?i)\\b(rien d'autre|rien de plus|c'est tout pour|pas d'autre|pas d'autres)\\b"),
            Pattern.compile("(?i)\\b(passer [aà] la suite|on peut encha[iî]ner|suite|section suivante)\\b"),
            Pattern.compile("(?i)\\b(je n'ai pas de projet|aucun projet|pas de projet|pas de dipl[oô]me)\\b"),
            Pattern.compile("(?i)\\b(je ne sais pas|aucune id[eé]e|je sais pas trop)\\b"),
            Pattern.compile("(?i)\\b(c'est bon pour moi|pour moi c'est bon|c'est tout)\\b")
    );

    public int getMaxTurnsForState(String state) {
        return MAX_TURNS.getOrDefault(state, 4);
    }

    public int getMinTurnsForState(String state) {
        return switch (state) {
            case "EXPERIENCE", "EDUCATION" -> 2;
            default -> 1;
        };
    }

    public String getNextSection(String currentState) {
        int idx = SECTION_ORDER.indexOf(currentState);
        if (idx >= 0 && idx < SECTION_ORDER.size() - 1) {
            return SECTION_ORDER.get(idx + 1);
        }
        return "DONE";
    }

    /**
     * Valide si une intention d'arrêt est explicite et légitime selon les règles de la spec V2 (Section 14).
     */
    public boolean isValidUserStopIntent(String userIntentExcerpt, String lastUserTurn) {
        String combined = ((userIntentExcerpt != null ? userIntentExcerpt : "") + " " +
                (lastUserTurn != null ? lastUserTurn : "")).trim();

        if (combined.isBlank()) {
            return false;
        }

        // Vérifier d'abord si c'est une fausse alerte (continuation ou refus de section)
        for (Pattern notStop : CONTINUATION_NOT_STOP_PATTERNS) {
            if (notStop.matcher(combined).find()) {
                log.info("Refus d'arrêt : l'intention détectée est une continuation ou un passage de section: '{}'", combined);
                return false;
            }
        }

        // Vérifier si un motif d'arrêt explicite est présent
        for (Pattern stopPattern : EXPLICIT_STOP_PATTERNS) {
            if (stopPattern.matcher(combined).find()) {
                log.info("Arrêt utilisateur validé : motif explicite trouvé dans '{}'", combined);
                return true;
            }
        }

        return false;
    }

    /**
     * Génère le bloc de contrôle textuel strict [INTERVIEW_STATE] envoyé à Gemini Live (Spec V2, Section 6 & 12).
     */
    public String buildControlMessage(
            String currentState,
            int sectionIndex,
            int turnsInSection,
            Map<String, Object> partialData,
            List<String> missingFields
    ) {
        int maxTurns = getMaxTurnsForState(currentState);
        int remaining = Math.max(0, maxTurns - turnsInSection);

        // Copie des champs manquants pour enrichissement déterministe
        List<String> effectiveMissing = new ArrayList<>(missingFields != null ? missingFields : Collections.emptyList());

        // Injection déterministe des dates si absentes du partial data
        if ("EXPERIENCE".equals(currentState) && partialData != null) {
            boolean hasStartDate = partialData.containsKey("startDate") && !partialData.get("startDate").toString().isBlank();
            boolean hasPeriod = (partialData.containsKey("period") && !partialData.get("period").toString().isBlank()) ||
                                (partialData.containsKey("periode") && !partialData.get("periode").toString().isBlank());
            if (!hasStartDate && !hasPeriod) {
                boolean alreadyListed = effectiveMissing.stream().anyMatch(m -> m.toLowerCase().contains("date") || m.toLowerCase().contains("période"));
                if (!alreadyListed) {
                    effectiveMissing.add(0, "Dates ou période d'exercice (année de début et année de fin, ou poste actuel)");
                }
            }
        } else if ("EDUCATION".equals(currentState) && partialData != null) {
            boolean hasYear = (partialData.containsKey("year") && !partialData.get("year").toString().isBlank()) ||
                              (partialData.containsKey("annee") && !partialData.get("annee").toString().isBlank());
            if (!hasYear) {
                boolean alreadyListed = effectiveMissing.stream().anyMatch(m -> m.toLowerCase().contains("année") || m.toLowerCase().contains("date"));
                if (!alreadyListed) {
                    effectiveMissing.add(0, "Année d'obtention ou période de la formation");
                }
            }
        }

        StringBuilder sb = new StringBuilder();
        sb.append("[INTERVIEW_STATE]\n\n");

        String displaySection = currentState;
        if ("EXPERIENCE".equals(currentState)) {
            displaySection = "EXPERIENCE #" + (sectionIndex + 1);
        }
        sb.append("Section active : ").append(displaySection).append("\n\n");

        sb.append("Objectif :\n");
        sb.append(getSectionObjective(currentState)).append("\n\n");

        sb.append("Informations déjà connues :\n");
        if (partialData == null || partialData.isEmpty()) {
            sb.append("- Aucune information pour le moment.\n");
        } else {
            partialData.forEach((k, v) -> {
                if (v != null && !v.toString().isBlank()) {
                    sb.append("- ").append(k).append(" : ").append(v).append("\n");
                }
            });
        }
        sb.append("\n");

        sb.append("Informations importantes encore manquantes :\n");
        if (effectiveMissing.isEmpty()) {
            if ("EXPERIENCE".equals(currentState)) {
                sb.append("- Expérience bien documentée. Demande au candidat s'il a une autre expérience professionnelle à valoriser.\n");
            } else {
                sb.append("- Section bien renseignée. Prépare la transition en douceur.\n");
            }
        } else {
            for (String mf : effectiveMissing) {
                sb.append("- ").append(mf).append("\n");
            }
        }
        sb.append("\n");

        if (remaining == 1) {
            sb.append("Dernier tour recommandé sur cette section.\n");
            sb.append("Demande uniquement l'information manquante ayant le plus de valeur pour le CV.\n\n");
        }

        if ("IDENTITY".equals(currentState)) {
            sb.append("RÈGLE STRICTE IDENTITY :\n");
            sb.append("- Le Nom complet et l'Email du candidat sont DÉJÀ renseignés et confirmés sur son compte.\n");
            sb.append("- NE LUI DEMANDE PAS son nom ni son email !\n");
            sb.append("- Demande-lui UNIQUEMENT sa ville de résidence ou son téléphone s'ils ne sont pas encore précisés, ou enchaîne.\n\n");
        }

        sb.append("Instruction :\n");
        sb.append("- Continue naturellement l'entretien avec ta voix posée et professionnelle.\n");
        sb.append("- Pose UNE SEULE question à la fois.\n");
        sb.append("- Ne lis JAMAIS ce bloc de guidage [INTERVIEW_STATE] à voix haute.\n");
        sb.append("- Ne change pas de section toi-même.\n");
        sb.append("- Ne conclus JAMAIS l'entretien de toi-même.\n");

        return sb.toString();
    }

    private String getSectionObjective(String state) {
        return switch (state) {
            case "IDENTITY" -> "Vérifier uniquement la ville de résidence et le téléphone du candidat. Le nom complet et l'email sont DÉJÀ renseignés par défaut : ne JAMAIS les redemander ni les altérer.";
            case "TARGET" -> "Identifier précisément le titre du poste visé, le domaine ou le défi professionnel souhaité.";
            case "EXPERIENCE" -> "Comprendre cette expérience professionnelle : entreprise, rôle exact, dates indispensables (début et fin), responsabilités clés, technologies et réalisations concrètes (avec chiffres si possible).";
            case "PROJECTS" -> "Identifier 1 ou 2 projets personnels, universitaires ou réalisations marquantes illustrant le savoir-faire.";
            case "EDUCATION" -> "Connaître le dernier diplôme ou la formation clé obtenue (établissement, spécialité, année d'obtention).";
            case "SKILLS" -> "Faire ressortir 4 à 8 compétences techniques et relationnelles phares confirmées par le parcours.";
            case "LANGUAGES" -> "Noter les langues maîtrisées et le niveau pratique estimé (courant, intermédiaire, etc.).";
            case "FINALIZE" -> "Toutes les sections ont été parcourues. Annoncer au candidat la finalisation et la préparation de son CV structuré.";
            case "REVIEW" -> "CV structuré et rédigé. Inviter le candidat à le parcourir.";
            default -> "Poursuivre l'échange professionnel avec rigueur et bienveillance.";
        };
    }
}
