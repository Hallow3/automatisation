package com.getjob.backend.cv.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.getjob.backend.ai.service.GeminiLiveTokenService;
import com.getjob.backend.candidate.domain.CandidateEntity;
import com.getjob.backend.candidate.domain.CandidateProfileEntity;
import com.getjob.backend.candidate.repository.CandidateProfileRepository;
import com.getjob.backend.candidate.repository.CandidateRepository;
import com.getjob.backend.cv.domain.CvEntity;
import com.getjob.backend.cv.domain.CvTemplateEntity;
import com.getjob.backend.cv.dto.CvDto;
import com.getjob.backend.cv.repository.CvRepository;
import com.getjob.backend.cv.repository.CvTemplateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class CvService {

    private final CvRepository cvRepository;
    private final CvTemplateRepository cvTemplateRepository;
    private final CandidateRepository candidateRepository;
    private final CandidateProfileRepository candidateProfileRepository;
    private final GeminiLiveTokenService tokenService;
    private final ObjectMapper objectMapper;

    // ── Résolution du candidat connecté ──────────────────────────────────────

    /**
     * Résout le candidat correspondant à l'utilisateur connecté.
     *
     * L'email dans le SecurityContext est l'identifiant Spring Security.
     * On charge le CandidateEntity correspondant depuis la DB.
     *
     * Jamais de valeur hardcodée — si le contexte est absent,
     * c'est une configuration Spring Security incorrecte.
     */
    private CandidateEntity resolveCurrentCandidate() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            throw new AccessDeniedException("Aucun utilisateur authentifié dans le contexte.");
        }
        String email = auth.getName();
        return candidateRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalStateException(
                        "Candidat introuvable pour l'email authentifié : " + email));
    }

    // ── CVs ───────────────────────────────────────────────────────────────────

    public List<CvDto> getAllCvs() {
        Integer candidateId = resolveCurrentCandidate().getId();
        return cvRepository.findByCandidateId(candidateId)
                .stream()
                .filter(this::isCvValidAndDisplayable)
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    public Optional<CvDto> getCvById(String id) {
        return findCvEntityForCurrentUser(id).map(this::mapToDto);
    }

    @Transactional
    public CvDto createCv(CvDto dto) {
        CandidateEntity candidate = resolveCurrentCandidate();
        Long templateId = parseTemplateCodeToId(dto.getTemplate());

        String contentJson = dto.getContentJson();
        if (contentJson == null || contentJson.isBlank()) {
            contentJson = buildInitialContentJson(candidate);
        }

        CvEntity cvEntity = CvEntity.builder()
                .candidateId(candidate.getId())
                .templateId(templateId)
                .title(dto.getTitle() != null && !dto.getTitle().isBlank() ? dto.getTitle() : "Nouveau CV")
                .contentJson(contentJson)
                .status(dto.getStatus() != null ? dto.getStatus() : "DRAFT")
                .interviewStatus("DRAFT")
                .build();

        return mapToDto(cvRepository.save(cvEntity));
    }

    @Transactional
    public void deleteCv(String id) {
        // findCvEntityForCurrentUser vérifie l'appartenance avant la suppression
        findCvEntityForCurrentUser(id).ifPresent(entity -> cvRepository.deleteById(entity.getId()));
    }

    public List<Map<String, Object>> getTemplates() {
        List<CvTemplateEntity> activeTemplates = cvTemplateRepository.findByActiveTrue();
        if (activeTemplates.isEmpty()) {
            return List.of(
                    Map.of("id", "moderne", "name", "Moderne Épuré", "description", "Header sombre, sidebar colorée, accent cyan.", "pages", 1),
                    Map.of("id", "split", "name", "Deux Colonnes", "description", "Sidebar sombre avec barres de compétences.", "pages", 1),
                    Map.of("id", "classique", "name", "Classique Pro", "description", "Format institutionnel sobre, une colonne.", "pages", 2)
            );
        }
        return activeTemplates.stream()
                .map(t -> Map.of(
                        "id", (Object) t.getCode(),
                        "name", t.getName(),
                        "description", t.getDescription() != null ? t.getDescription() : "",
                        "pages", t.getPageHint() != null ? t.getPageHint() : "1"
                ))
                .collect(Collectors.toList());
    }

    // ── Session d'entretien ───────────────────────────────────────────────────

    public Map<String, String> createInterviewSession(String cvId) {
        CandidateEntity candidate = resolveCurrentCandidate();
        log.info("Création de session d'entretien pour candidate_id={} (email: {})", candidate.getId(), candidate.getEmail());

        // ── Vérification des quotas journaliers par candidat (Chantier A) ────────
        java.time.LocalDate today = java.time.LocalDate.now();
        if (candidate.getAiInterviewsResetDate() == null || !candidate.getAiInterviewsResetDate().equals(today)) {
            candidate.setAiInterviewsUsed(0);
            candidate.setAiInterviewsResetDate(today);
        }

        final int MAX_DAILY_AI_INTERVIEWS = 3;
        if (candidate.getAiInterviewsUsed() >= MAX_DAILY_AI_INTERVIEWS) {
            log.warn("Quota IA atteint pour candidate_id={}", candidate.getId());
            throw new ResponseStatusException(
                    HttpStatus.TOO_MANY_REQUESTS,
                    "QUOTA_REACHED:Vous avez atteint votre limite de 3 entretiens vocaux IA pour aujourd'hui. Vos crédits se réinitialiseront demain à minuit."
            );
        }

        candidate.setAiInterviewsUsed(candidate.getAiInterviewsUsed() + 1);
        candidateRepository.save(candidate);

        Optional<CvEntity> existingCv = findCvEntityForCurrentUser(cvId);
        String returnCvId = "new";

        if (existingCv.isPresent()) {
            CvEntity cvEntity = existingCv.get();
            cvEntity.setInterviewStatus("IN_PROGRESS");
            cvRepository.save(cvEntity);
            returnCvId = cvEntity.getId().toString();
        }

        Map<String, String> tokenInfo = tokenService.createEphemeralToken();
        tokenInfo.put("cvId", returnCvId);
        return tokenInfo;
    }

    @Transactional
    public CvDto updateDraft(String cvId, Object draftData) {
        CandidateEntity candidate = resolveCurrentCandidate();
        log.info("Mise à jour draft candidate_id={} cvId={}", candidate.getId(), cvId);

        // Si le draft est vide / sans contenu significatif et qu'aucun CV n'existe pour cet ID, ne pas créer de CV fantôme
        if (!isDraftMeaningful(draftData) && findCvEntityForCurrentUser(cvId).isEmpty()) {
            return CvDto.builder()
                    .id("new")
                    .title("Nouveau CV")
                    .status("DRAFT")
                    .build();
        }

        CvEntity cv = findCvEntityForCurrentUser(cvId).orElseGet(() -> {
            CvEntity newCv = CvEntity.builder()
                    .candidateId(candidate.getId())
                    .templateId(parseTemplateCodeToId("moderne"))
                    .title("CV Entretien IA")
                    .contentJson(buildInitialContentJson(candidate))
                    .status("DRAFT")
                    .interviewStatus("IN_PROGRESS")
                    .build();
            return cvRepository.save(newCv);
        });

        try {
            cv.setContentJson(objectMapper.writeValueAsString(draftData));
            cv.setInterviewStatus("DRAFT_UPDATED");
            return mapToDto(cvRepository.save(cv));
        } catch (Exception e) {
            log.error("Erreur sérialisation draft CV candidate_id={} : {}", candidate.getId(), e.getMessage());
            throw new RuntimeException("Format de draft CV invalide", e);
        }
    }

    @Transactional
    public Map<String, Object> completeInterview(String cvId) {
        CandidateEntity candidate = resolveCurrentCandidate();
        log.info("Finalisation entretien candidate_id={} cvId={}", candidate.getId(), cvId);

        CvEntity cv = findCvEntityForCurrentUser(cvId)
                .orElseThrow(() -> new RuntimeException("CV non trouvé ou non autorisé : " + cvId));

        cv.setStatus("DRAFT_READY");
        cv.setInterviewStatus("COMPLETED");
        CvEntity saved = cvRepository.save(cv);

        syncCandidateProfile(saved);

        return Map.of(
                "cvId", cvId,
                "status", "DRAFT_READY",
                "updatedAt", saved.getUpdatedAt() != null
                        ? saved.getUpdatedAt().toString()
                        : Instant.now().toString()
        );
    }

    @Transactional
    public CvDto synthesizeCvFromTranscript(String cvId, String transcriptText) {
        CandidateEntity candidate = resolveCurrentCandidate();
        log.info("Synthèse IA du CV à partir du transcript pour candidate_id={} cvId={}", candidate.getId(), cvId);

        CvEntity cv = findCvEntityForCurrentUser(cvId).orElseGet(() -> {
            CvEntity newCv = CvEntity.builder()
                    .candidateId(candidate.getId())
                    .templateId(parseTemplateCodeToId("moderne"))
                    .title("CV Entretien IA")
                    .contentJson(buildInitialContentJson(candidate))
                    .status("DRAFT")
                    .interviewStatus("COMPLETED")
                    .build();
            return cvRepository.save(newCv);
        });

        if (transcriptText == null || transcriptText.trim().length() < 10) {
            return mapToDto(cv);
        }

        String systemInstruction = """
            Tu es un expert senior en recrutement et rédaction de CV professionnels.
            À partir de la transcription d'un entretien vocal entre un recruteur IA et un candidat,
            extrais et structure TOUTES les informations professionnelles réelles fournies par le candidat.
            
            Règles strictes :
            - Ne pas inventer de faits non mentionnés.
            - Reformuler de façon professionnelle et percutante avec des verbes d'action.
            - Produire obligatoirement un JSON valide respectant strictement ce schéma :
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
                  "context": string,
                  "description": string,
                  "technologies": [string]
                }
              ]
            }
            """.trim();

        String prompt = "Voici la transcription complète de l'entretien :\n\n" + transcriptText;

        try {
            String jsonResult = tokenService.generateStructuredContent(systemInstruction, prompt);
            if (jsonResult != null && !jsonResult.isBlank()) {
                objectMapper.readTree(jsonResult);
                cv.setContentJson(jsonResult);
                cv.setInterviewStatus("COMPLETED");
                cv.setStatus("DRAFT_READY");
                CvEntity saved = cvRepository.save(cv);
                syncCandidateProfile(saved);
                log.info("Synthèse IA réussie pour candidate_id={} cv_id={}", candidate.getId(), saved.getId());
                return mapToDto(saved);
            }
        } catch (Exception e) {
            log.error("Erreur lors de la synthèse IA du CV : {}", e.getMessage());
        }

        return mapToDto(cv);
    }

    // ── Helpers privés ────────────────────────────────────────────────────────

    /**
     * Cherche un CV par ID en s'assurant qu'il appartient au candidat connecté.
     *
     * Sécurité : un utilisateur ne peut jamais accéder au CV d'un autre.
     * Si le CV existe mais appartient à quelqu'un d'autre, on retourne empty()
     * (pas d'information sur l'existence du CV pour un attaquant).
     */
    private Optional<CvEntity> findCvEntityForCurrentUser(String id) {
        if (id == null || id.isBlank()) return Optional.empty();

        Integer candidateId = resolveCurrentCandidate().getId();
        String cleanId = id.replace("cv_", "").trim();

        if ("latest".equalsIgnoreCase(cleanId)) {
            return cvRepository.findByCandidateId(candidateId)
                    .stream()
                    .max(Comparator.comparing(CvEntity::getId));
        }

        if ("new".equalsIgnoreCase(cleanId) || "default".equalsIgnoreCase(cleanId)) {
            return Optional.empty();
        }

        try {
            Long cvLongId = Long.parseLong(cleanId);
            return cvRepository.findById(cvLongId)
                    .filter(cv -> candidateId.equals(cv.getCandidateId()));
        } catch (NumberFormatException e) {
            log.warn("ID CV non reconnu comme existant : '{}'. Traité comme un nouveau CV.", id);
            return Optional.empty();
        }
    }

    private boolean isDraftMeaningful(Object draftData) {
        if (draftData == null) return false;
        try {
            String json = draftData instanceof String s ? s : objectMapper.writeValueAsString(draftData);
            if (json == null || json.isBlank() || json.equals("{}")) return false;
            com.fasterxml.jackson.databind.JsonNode root = objectMapper.readTree(json);
            
            if (root.has("experiences") && root.get("experiences").isArray() && root.get("experiences").size() > 0) {
                return true;
            }
            if (root.has("education") && root.get("education").isArray() && root.get("education").size() > 0) {
                return true;
            }
            if (root.has("skills") && root.get("skills").isArray() && root.get("skills").size() > 0) {
                return true;
            }
            if (root.has("summary") && root.get("summary").asText("").trim().length() > 20) {
                return true;
            }
            if (root.has("projects") && root.get("projects").isArray() && root.get("projects").size() > 0) {
                return true;
            }
            return false;
        } catch (Exception e) {
            return false;
        }
    }

    private boolean isCvValidAndDisplayable(CvEntity cv) {
        if (cv == null) return false;
        // Si le CV n'est pas un entretien resté "IN_PROGRESS", on l'affiche
        if (!"IN_PROGRESS".equalsIgnoreCase(cv.getInterviewStatus())) {
            return true;
        }
        // Si le CV est resté "IN_PROGRESS", on ne l'affiche que s'il a extrait du contenu significatif
        return isDraftMeaningful(cv.getContentJson());
    }

    private void syncCandidateProfile(CvEntity cv) {
        try {
            Optional<CandidateProfileEntity> profileOpt =
                    candidateProfileRepository.findByCandidateId(cv.getCandidateId());

            CandidateProfileEntity profile = profileOpt.orElseGet(() ->
                    CandidateProfileEntity.builder()
                            .candidateId(cv.getCandidateId())
                            .cvGenerated(true)
                            .build()
            );

            if (cv.getContentJson() != null && !cv.getContentJson().isBlank()) {
                profile.setRawData(cv.getContentJson());
            }
            if (cv.getPdfMinioKey() != null && !cv.getPdfMinioKey().isBlank()) {
                profile.setCvMinioKey(cv.getPdfMinioKey());
            }
            profile.setCvGenerated(true);
            candidateProfileRepository.save(profile);
            log.info("candidate_profile synchronisé pour candidate_id={} cv_id={}",
                    cv.getCandidateId(), cv.getId());
        } catch (Exception e) {
            log.error("Erreur sync candidate_profile : {}", e.getMessage());
        }
    }

    private Long parseTemplateCodeToId(String code) {
        if (code == null) return null;
        return cvTemplateRepository.findByCode(code)
                .map(CvTemplateEntity::getId)
                .orElse(null);
    }

    private CvDto mapToDto(CvEntity entity) {
        String templateCode = "moderne";
        String templateLabel = "Moderne Épuré";
        if (entity.getTemplateId() != null) {
            Optional<CvTemplateEntity> tOpt = cvTemplateRepository.findById(entity.getTemplateId());
            if (tOpt.isPresent()) {
                templateCode = tOpt.get().getCode();
                templateLabel = tOpt.get().getName();
            }
        }

        return CvDto.builder()
                .id(entity.getId().toString())
                .title(entity.getTitle() != null ? entity.getTitle() : "CV sans titre")
                .template(templateCode)
                .templateLabel(templateLabel)
                .status(entity.getStatus() != null ? entity.getStatus() : "DRAFT")
                .contentJson(entity.getContentJson())
                .createdAt(entity.getCreatedAt() != null ? entity.getCreatedAt().toString() : null)
                .updatedAt(entity.getUpdatedAt() != null ? entity.getUpdatedAt().toString() : null)
                .build();
    }

    private String buildInitialContentJson(CandidateEntity candidate) {
        try {
            Map<String, Object> initial = new HashMap<>();
            Map<String, String> identity = new HashMap<>();
            identity.put("fullName", candidate.getFullName() != null ? candidate.getFullName() : "");
            identity.put("email", candidate.getEmail() != null ? candidate.getEmail() : "");
            identity.put("phone", candidate.getPhone() != null ? candidate.getPhone() : "");
            identity.put("city", candidate.getCity() != null ? candidate.getCity() : "");
            initial.put("identity", identity);
            initial.put("headline", candidate.getTargetRole() != null ? candidate.getTargetRole() : "");
            initial.put("summary", "");
            initial.put("experiences", List.of());
            initial.put("education", List.of());
            initial.put("skills", List.of());
            initial.put("languages", List.of());
            return objectMapper.writeValueAsString(initial);
        } catch (Exception e) {
            log.error("Erreur création contentJson initial : {}", e.getMessage());
            return "{}";
        }
    }

    @Transactional
    public CvDto aiEditCv(String cvId, String userPrompt, Object currentData) {
        CandidateEntity candidate = resolveCurrentCandidate();
        CvEntity cv = findCvEntityForCurrentUser(cvId).orElseGet(() -> {
            CvEntity newCv = CvEntity.builder()
                    .candidateId(candidate.getId())
                    .templateId(parseTemplateCodeToId("moderne"))
                    .title("CV Modifié par IA")
                    .contentJson(buildInitialContentJson(candidate))
                    .status("DRAFT")
                    .interviewStatus("COMPLETED")
                    .build();
            return cvRepository.save(newCv);
        });

        String currentJson = "";
        try {
            if (currentData != null) {
                currentJson = objectMapper.writeValueAsString(currentData);
            } else {
                currentJson = cv.getContentJson() != null ? cv.getContentJson() : "{}";
            }
        } catch (Exception e) {
            currentJson = cv.getContentJson() != null ? cv.getContentJson() : "{}";
        }

        String systemInstruction = """
            Tu es un expert RH de premier plan spécialisé dans l'optimisation de CV professionnels.
            Tu reçois le CV actuel d'un candidat au format JSON et une consigne d'amélioration formulée par l'utilisateur.
            
            Consigne de l'utilisateur : %s
            
            Règles strictes :
            - Applique précisément la demande de l'utilisateur sur les sections concernées (ex: reformuler les expériences avec des verbes d'action et réalisations, optimiser le profil, corriger l'orthographe, ajouter des compétences pertinentes).
            - Conserve intactes les informations factuelles existantes non ciblées par la modification.
            - Renvoie STRICTEMENT un JSON valide respectant ce schéma exact :
            {
              "identity": { "fullName": string, "email": string, "phone": string, "city": string },
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
              ]
            }
            """.formatted(userPrompt != null ? userPrompt : "Améliore ce CV");

        String userContent = "Voici le CV actuel à perfectionner :\n" + currentJson;

        String structuredJson = tokenService.generateStructuredContent(systemInstruction, userContent);
        if (structuredJson != null && !structuredJson.isBlank()) {
            cv.setContentJson(structuredJson);
            cvRepository.save(cv);
        }

        return mapToDto(cv);
    }

    @Transactional
    public CvDto importCvFromFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Aucun fichier fourni.");
        }

        CandidateEntity candidate = resolveCurrentCandidate();

        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "cv_import.pdf";
        String contentType = file.getContentType();
        if (contentType == null || contentType.isBlank()) {
            if (filename.toLowerCase().endsWith(".pdf")) contentType = "application/pdf";
            else if (filename.toLowerCase().endsWith(".png")) contentType = "image/png";
            else if (filename.toLowerCase().endsWith(".jpg") || filename.toLowerCase().endsWith(".jpeg")) contentType = "image/jpeg";
            else contentType = "application/pdf";
        }

        try {
            byte[] bytes = file.getBytes();

            String systemInstruction = """
                Tu es un expert RH de haut niveau. Analyse ce CV existant et extrais l'intégralité des informations réelles du candidat.
                Règles strictes :
                - Ne pas inventer de données absentes du document.
                - Organiser et structurer rigoureusement le contenu.
                - Renvoyer EXCLUSIVEMENT un JSON valide respectant ce schéma :
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
                  ]
                }
                """;

            String userPrompt = "Extrais et structure rigoureusement l'ensemble des données de ce CV au format JSON demandé.";

            String structuredJson = tokenService.generateStructuredContentFromDocument(systemInstruction, userPrompt, bytes, contentType);
            if (structuredJson == null || structuredJson.isBlank()) {
                structuredJson = buildInitialContentJson(candidate);
            }

            CvEntity cv = CvEntity.builder()
                    .candidateId(candidate.getId())
                    .templateId(parseTemplateCodeToId("moderne"))
                    .title("CV Importé (" + filename + ")")
                    .contentJson(structuredJson)
                    .status("DRAFT")
                    .interviewStatus("COMPLETED")
                    .build();

            CvEntity saved = cvRepository.save(cv);
            return mapToDto(saved);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.error("Erreur lors de l'import du CV : {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Échec du traitement du fichier CV.");
        }
    }
}
