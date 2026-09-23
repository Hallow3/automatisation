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
                L'objectif est un CV DENSE et COMPLET qui remplit 2 pages A4.
                
                RÈGLES STRICTES D'INTÉGRITÉ ET DE VERBOSITÉ :
                1. Rédige un résumé professionnel percutant ("summary") de 4 à 6 phrases détaillant le positionnement, la valeur ajoutée, les domaines de compétence et les ambitions du candidat.
                2. Pour CHAQUE expérience, rédige OBLIGATOIREMENT un champ "context" de 2 à 3 phrases décrivant le contexte de l'entreprise, le périmètre du poste et les enjeux. Exemple : "Au sein d'une PME de 50 personnes spécialisée dans la logistique, j'ai pris en charge l'ensemble du pôle informatique avec pour mission de moderniser l'infrastructure et d'accompagner la croissance."
                3. Pour CHAQUE expérience, liste AU MINIMUM 5 responsabilités/réalisations dans "responsibilities", chacune commençant par un verbe d'action fort (Concevoir, Développer, Piloter, Optimiser, Gérer, Mettre en œuvre, Coordonner, Assurer, Superviser, Implanter).
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
