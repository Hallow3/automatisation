package com.getjob.backend.cv.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.getjob.backend.ai.service.GeminiLiveTokenService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.Map;

/**
 * Service spécialisé dans les interactions IA textuelles et multimodales pour les CVs.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class CvAiOperationsService {

    private final GeminiLiveTokenService tokenService;
    private final ObjectMapper objectMapper;

    /**
     * Effectue une retouche textuelle ciblée via Gemini 3.1.
     */
    public Map<String, Object> executeAiEdit(String action, String text, String roleTarget) {
        if (text == null || text.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le texte à améliorer est obligatoire.");
        }

        String systemPrompt = """
            Tu es un rédacteur professionnel de CV d'élite et expert en recrutement.
            Ta mission est d'améliorer des sections de CV pour leur donner un maximum d'impact,
            sans jamais inventer de faits ni de chiffres qui ne sont pas suggérés par l'utilisateur.
            
            Format de réponse attendu : strictement un objet JSON avec les clés suivantes :
            {
              "improvedText": "le texte reformulé",
              "explanation": "brève explication du choix de rédaction (1 phrase)"
            }
            """;

        String userPrompt = String.format("""
            Action demandée : %s
            Métier / Rôle visé : %s
            Texte d'origine :
            \"\"\"
            %s
            \"\"\"
            """, action != null ? action : "improve", roleTarget != null ? roleTarget : "Général", text);

        try {
            String jsonResult = tokenService.generateStructuredContent(systemPrompt, userPrompt);
            @SuppressWarnings("unchecked")
            Map<String, Object> parsed = objectMapper.readValue(jsonResult, Map.class);
            return parsed;
        } catch (Exception e) {
            log.error("[CvAiOperations] Erreur lors de l'appel IA edit:", e);
            Map<String, Object> fallback = new HashMap<>();
            fallback.put("improvedText", text);
            fallback.put("explanation", "Impossible de contacter l'assistant IA.");
            return fallback;
        }
    }

    /**
     * Extrait le contenu d'un document CV (PDF, PNG, JPG) en JSON structuré via Gemini 3.1 Vision.
     */
    public Map<String, Object> parseDocumentToJson(byte[] fileBytes, String contentType) {
        String systemPrompt = """
            Tu es un système de parsing de CV haute précision (ATS).
            Extrais l'intégralité des informations du document fourni et structure-les STRICTEMENT dans ce format JSON :
            {
              "identity": {
                "fullName": "Prénom Nom",
                "email": "email@example.com",
                "phone": "+33...",
                "city": "Ville, Pays"
              },
              "headline": "Titre du poste / Métier",
              "summary": "Court paragraphe de présentation ou profil",
              "skills": ["Compétence 1", "Compétence 2"],
              "experiences": [
                {
                  "company": "Nom de l'entreprise",
                  "position": "Intitulé du poste",
                  "startDate": "Mois Année",
                  "endDate": "Mois Année ou Présent",
                  "context": "Contexte de la mission",
                  "responsibilities": ["Responsabilité 1", "Responsabilité 2"],
                  "achievements": ["Résultat ou accomplissement"],
                  "technologies": ["Outil 1", "Outil 2"]
                }
              ],
              "education": [
                {
                  "school": "École ou Université",
                  "degree": "Diplôme obtenu",
                  "startDate": "Année",
                  "endDate": "Année"
                }
              ],
              "languages": [
                {
                  "language": "Français",
                  "level": "Langue maternelle / Courant / B2"
                }
              ]
            }
            """;

        try {
            String jsonResult = tokenService.generateStructuredContentFromDocument(
                    systemPrompt,
                    "Extrais toutes les informations de ce CV de manière fidèle et exhaustive.",
                    fileBytes,
                    contentType
            );
            @SuppressWarnings("unchecked")
            Map<String, Object> parsed = objectMapper.readValue(jsonResult, Map.class);
            return parsed;
        } catch (Exception e) {
            log.error("[CvAiOperations] Erreur lors du parsing multimodal du document:", e);
            throw new ResponseStatusException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "Impossible d'extraire le contenu du document fourni. Format ou qualité illisible."
            );
        }
    }
}