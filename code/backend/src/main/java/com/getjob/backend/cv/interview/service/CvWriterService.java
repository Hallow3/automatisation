package com.getjob.backend.cv.interview.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.getjob.backend.ai.service.GeminiLiveTokenService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Service de rédaction et finalisation du CV (Spec V2, Section 16 & 17).
 * Rédige le résumé professionnel (summary), enrichit la formulation des réalisations
 * avec des verbes d'action percutants, en respectant rigoureusement les faits déclarés
 * (zéro hallucination de métriques ou d'expériences).
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class CvWriterService {

    private final GeminiLiveTokenService tokenService;
    private final ObjectMapper objectMapper;

    /**
     * Rédige et affine le CV complet à partir des données collectées.
     */
    public Map<String, Object> finalizeCv(Map<String, Object> rawCvData) {
        if (rawCvData == null || rawCvData.isEmpty()) {
            return rawCvData;
        }

        try {
            String systemInstruction = """
                Tu es un expert senior en recrutement et rédacteur d'élite de CV professionnels.
                À partir des données brutes consolidées recueillies lors d'un entretien, produis la version finale structurée du CV.
                La longueur du CV doit refléter uniquement les faits recueillis, même si le document reste court.
                
                RÈGLES STRICTES D'INTÉGRITÉ ET DE VERBOSITÉ :
                1. Rédige un résumé professionnel uniquement si les faits recueillis permettent de le faire. Reste concis et laisse-le vide si nécessaire.
                2. Pour chaque expérience confirmée, conserve seulement le contexte et les responsabilités effectivement décrits par le candidat. Une expérience peut n'avoir aucune puce.
                3. Ne crée pas de nouvelles responsabilités pour atteindre une longueur cible. Reformule seulement les faits fournis.
                4. N'INVENTE STRICTEMENT AUCUN FAIT, AUCUN CHIFFRE, AUCUN POURCENTAGE qui n'a pas été fourni dans les données sources.
                5. Conserve tous les noms d'entreprises, postes, dates, technologies, diplômes et compétences.
                6. Produis obligatoirement un JSON valide respectant la structure standard :
                {
                  "identity": {
                    "fullName": string,
                    "email": string,
                    "phone": string,
                    "city": string
                  },
                  "headline": string,
                  "summary": string,
                  "skills": [string],
                  "experiences": [
                    {
                      "company": string,
                      "position": string,
                      "startDate": string,
                      "endDate": string,
                      "context": string,
                      "responsibilities": [string],
                      "achievements": [string],
                      "technologies": [string]
                    }
                  ],
                  "education": [
                    {
                      "school": string,
                      "degree": string,
                      "year": string,
                      "details": string
                    }
                  ],
                  "languages": [
                    {
                      "lang": string,
                      "level": string
                    }
                  ],
                  "personalQualities": [string],
                  "interests": [string],
                  "projects": [
                    {
                      "name": string,
                      "role": string,
                      "description": string,
                      "technologies": [string]
                    }
                  ]
                }
                """;

            String userPrompt = "Voici les données brutes consolidées du CV à rédiger et peaufiner :\n" +
                    objectMapper.writeValueAsString(rawCvData);

            String responseJson = tokenService.generateStructuredContent(systemInstruction, userPrompt);
            if (responseJson != null && !responseJson.isBlank()) {
                String cleaned = responseJson.trim();
                if (cleaned.startsWith("```json")) {
                    cleaned = cleaned.substring(7);
                } else if (cleaned.startsWith("```")) {
                    cleaned = cleaned.substring(3);
                }
                if (cleaned.endsWith("```")) {
                    cleaned = cleaned.substring(0, cleaned.length() - 3);
                }
                @SuppressWarnings("unchecked")
                Map<String, Object> polished = objectMapper.readValue(cleaned.trim(), Map.class);
                // Le rédacteur peut reformuler le CV, mais pas réécrire l'identité confirmée.
                if (rawCvData.get("identity") instanceof Map<?, ?> identity) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> polishedIdentity = polished.get("identity") instanceof Map<?, ?> map
                            ? (Map<String, Object>) map : new java.util.HashMap<>();
                    for (String key : java.util.List.of("fullName", "email")) {
                        if (identity.get(key) != null) polishedIdentity.put(key, identity.get(key));
                    }
                    polished.put("identity", polishedIdentity);
                }
                for (String key : java.util.List.of("personalQualities", "interests")) {
                    if (!polished.containsKey(key) && rawCvData.containsKey(key)) {
                        polished.put(key, rawCvData.get(key));
                    }
                }
                return polished;
            }
        } catch (Exception e) {
            log.error("[CvWriterService] Erreur lors de la rédaction finale du CV: {}", e.getMessage());
        }

        // Filet de sécurité défensif : renvoyer les données existantes sans casser
        return rawCvData;
    }
}
