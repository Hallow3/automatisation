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
                
                RÈGLES STRICTES D'INTÉGRITÉ :
                1. Rédige un résumé professionnel percutant ("summary") de 2 à 4 phrases résumant le positionnement du candidat.
                2. Améliore la formulation des responsabilités et réalisations dans chaque expérience avec des verbes d'action forts.
                3. N'INVENTE STRICTEMENT AUCUN FAIT, AUCUN CHIFFRE, AUCUN POURCENTAGE qui n'a pas été fourni dans les données sources.
                4. Conserve tous les noms d'entreprises, postes, dates, technologies, diplômes et compétences.
                5. Produis obligatoirement un JSON valide respectant la structure standard :
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
                return polished;
            }
        } catch (Exception e) {
            log.error("[CvWriterService] Erreur lors de la rédaction finale du CV: {}", e.getMessage());
        }

        // Filet de sécurité défensif : renvoyer les données existantes sans casser
        return rawCvData;
    }
}
