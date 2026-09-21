package com.getjob.backend.cv.interview.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.getjob.backend.ai.service.GeminiLiveTokenService;
import com.getjob.backend.cv.interview.dto.SectionPatchDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * LLM Observateur et Extracteur silencieux (Spec V2, Section 8 & 9).
 * Analyse les tours de transcription en tâche de fond via Gemini 2.0 Flash,
 * extrait les données factuelles structurées en JSON strict,
 * et évalue la complétude de la section active.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class InterviewObserverService {

    private final GeminiLiveTokenService tokenService;
    private final ObjectMapper objectMapper;

    /**
     * Analyse la transcription récente de la section active pour produire un patch d'enrichissement.
     */
    public SectionPatchDto observeSection(
            String currentState,
            int sectionIndex,
            String sectionTranscriptText,
            Map<String, Object> currentPartialData
    ) {
        if (sectionTranscriptText == null || sectionTranscriptText.isBlank()) {
            return buildEmptyPatch(currentState, sectionIndex);
        }

        try {
            String systemInstruction = """
                Tu es un extracteur de données factuelles strict pour la création de CV professionnels.
                Tu observes la transcription d'un entretien vocal entre un recruteur et un candidat.
                Ton rôle est d'analyser uniquement la section active et de produire un objet JSON strictement typé.
                
                RÈGLES ABSOLUES :
                1. N'invente AUCUN fait, chiffre ou date non mentionné par le candidat.
                2. Extrais les faits confirmés dans "patch".
                3. Identifie dans "missing_fields" les informations importantes non encore fournies pour cette section.
                4. Évalue "completion_score" entre 0.0 (vide) et 1.0 (très complet).
                5. Définis "ready_for_transition" à true si les critères minimaux de la section sont atteints.
                6. Définis "user_wants_skip" à true si le candidat indique explicitement n'avoir rien à fournir (ex: "je n'ai pas de projet", "aucun diplôme", "on passe").
                7. Définis "user_has_more" à true si en section EXPERIENCE le candidat confirme avoir une autre expérience à détailler.
                
                Schéma JSON attendu :
                {
                  "section": "%s",
                  "section_index": %d,
                  "patch": {},
                  "missing_fields": [],
                  "completion_score": 0.0,
                  "ready_for_transition": false,
                  "user_wants_skip": false,
                  "user_has_more": false
                }
                """.formatted(currentState, sectionIndex);

            String userPrompt = """
                Section active : %s (index: %d)
                Données partielles actuelles : %s
                
                Transcription des échanges de cette section :
                ---
                %s
                ---
                
                Produis le JSON strict d'analyse pour cette section.
                """.formatted(
                    currentState,
                    sectionIndex,
                    currentPartialData != null ? objectMapper.writeValueAsString(currentPartialData) : "{}",
                    sectionTranscriptText
            );

            String jsonResult = tokenService.generateStructuredContent(systemInstruction, userPrompt);
            if (jsonResult != null && !jsonResult.isBlank()) {
                // Nettoyer d'éventuels backticks markdown
                String cleaned = jsonResult.trim();
                if (cleaned.startsWith("```json")) {
                    cleaned = cleaned.substring(7);
                } else if (cleaned.startsWith("```")) {
                    cleaned = cleaned.substring(3);
                }
                if (cleaned.endsWith("```")) {
                    cleaned = cleaned.substring(0, cleaned.length() - 3);
                }
                return objectMapper.readValue(cleaned.trim(), SectionPatchDto.class);
            }
        } catch (Exception e) {
            log.warn("[InterviewObserverService] Erreur lors de l'observation LLM pour {}: {}", currentState, e.getMessage());
        }

        return buildEmptyPatch(currentState, sectionIndex);
    }

    private SectionPatchDto buildEmptyPatch(String state, int index) {
        return SectionPatchDto.builder()
                .section(state)
                .section_index(index)
                .patch(new HashMap<>())
                .missing_fields(new ArrayList<>())
                .completion_score(0.0)
                .ready_for_transition(false)
                .user_wants_skip(false)
                .user_has_more(false)
                .build();
    }
}
