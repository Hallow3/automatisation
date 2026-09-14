package com.getjob.backend.cv.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
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

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

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
    private final CvDraftValidator cvDraftValidator;
    private final CvAiOperationsService cvAiOperationsService;

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

    public Page<CvDto> getCvs(Pageable pageable) {
        Integer candidateId = resolveCurrentCandidate().getId();
        Page<CvEntity> page = cvRepository.findByCandidateId(candidateId, pageable);
        List<CvDto> dtoList = page.getContent().stream()
                .filter(this::isCvValidAndDisplayable)
                .map(this::mapToDto)
                .collect(Collectors.toList());
        return new PageImpl<>(dtoList, pageable, page.getTotalElements());
    }

    public Optional<CvDto> getCvById(String id) {
        return findCvEntityForCurrentUser(id).map(this::mapToDto);
    }

    /**
     * Récupère un CV par identifiant sans filtrage de session candidate.
     * Strictement réservé aux processus internes validés (ex: rendu Chromium headless sécurisé par jeton éphémère).
     */
    public Optional<CvDto> getCvByIdUnrestricted(String id) {
        if (id == null || id.isBlank()) return Optional.empty();
        String cleanId = id.replace("cv_", "").trim();
        try {
            Long cvLongId = Long.parseLong(cleanId);
            return cvRepository.findById(cvLongId).map(entity -> {
                CvDto dto = mapToDto(entity);
                enrichCvDtoWithCandidate(dto, entity.getCandidateId());
                return dto;
            });
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
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

    @Transactional
    public Map<String, String> createInterviewSession(String cvId) {
        CandidateEntity candidate = resolveCurrentCandidate();
        log.info("Création de session d'entretien pour candidate_id={} (email: {})", candidate.getId(), candidate.getEmail());

        Optional<CvEntity> existingCv = findCvEntityForCurrentUser(cvId);
        boolean isResumingActiveSession = existingCv.isPresent() &&
                ("IN_PROGRESS".equalsIgnoreCase(existingCv.get().getInterviewStatus()) ||
                 "DRAFT_UPDATED".equalsIgnoreCase(existingCv.get().getInterviewStatus()));

        // ── Vérification des quotas journaliers par candidat (Chantier A) ────────
        java.time.LocalDate today = java.time.LocalDate.now();
        if (candidate.getAiInterviewsResetDate() == null || !candidate.getAiInterviewsResetDate().equals(today)) {
            candidate.setAiInterviewsUsed(0);
            candidate.setAiInterviewsResetDate(today);
            candidateRepository.save(candidate);
        }

        final int MAX_DAILY_AI_INTERVIEWS = 3;
        if (!isResumingActiveSession && candidate.getAiInterviewsUsed() >= MAX_DAILY_AI_INTERVIEWS) {
            log.warn("Quota IA atteint pour candidate_id={}", candidate.getId());
            throw new ResponseStatusException(
                    HttpStatus.TOO_MANY_REQUESTS,
                    "QUOTA_REACHED:Vous avez atteint votre limite de 3 entretiens vocaux IA pour aujourd'hui. Vos crédits se réinitialiseront demain à minuit."
            );
        }

        CvEntity cvEntity;

        if (existingCv.isPresent()) {
            cvEntity = existingCv.get();
            if (!"DRAFT_UPDATED".equalsIgnoreCase(cvEntity.getInterviewStatus())) {
                cvEntity.setInterviewStatus("IN_PROGRESS");
                cvEntity = cvRepository.save(cvEntity);
            }
        } else {
            // Réutilisation d'un CV IN_PROGRESS non encore alimenté pour éviter la prolifération de CVs vides
            Optional<CvEntity> pendingCv = cvRepository.findByCandidateId(candidate.getId()).stream()
                    .filter(c -> "IN_PROGRESS".equalsIgnoreCase(c.getInterviewStatus()) && !isDraftMeaningful(c.getContentJson()))
                    .findFirst();

            if (pendingCv.isPresent()) {
                cvEntity = pendingCv.get();
            } else {
                CvEntity newCv = CvEntity.builder()
                        .candidateId(candidate.getId())
                        .templateId(parseTemplateCodeToId("moderne"))
                        .title("CV Entretien IA")
                        .contentJson(buildInitialContentJson(candidate))
                        .status("DRAFT")
                        .interviewStatus("IN_PROGRESS")
                        .build();
                cvEntity = cvRepository.save(newCv);
            }
        }

        String returnCvId = cvEntity.getId().toString();
        Map<String, String> tokenInfo = tokenService.createEphemeralToken();
        tokenInfo.put("cvId", returnCvId);
        return tokenInfo;
    }

    private void consumeInterviewQuotaIfNeeded(CandidateEntity candidate, CvEntity cv) {
        if ("IN_PROGRESS".equalsIgnoreCase(cv.getInterviewStatus())) {
            java.time.LocalDate today = java.time.LocalDate.now();
            if (candidate.getAiInterviewsResetDate() == null || !candidate.getAiInterviewsResetDate().equals(today)) {
                candidate.setAiInterviewsUsed(0);
                candidate.setAiInterviewsResetDate(today);
            }
            candidate.setAiInterviewsUsed(candidate.getAiInterviewsUsed() + 1);
            candidateRepository.save(candidate);
            log.info("Quota entretien IA incrémenté pour candidate_id={} (utilisés aujourd'hui: {}/3)",
                    candidate.getId(), candidate.getAiInterviewsUsed());
        }
    }

    @Transactional
    public CvDto updateDraft(String cvId, Object draftData) {
        CandidateEntity candidate = resolveCurrentCandidate();
        log.info("Mise à jour draft candidate_id={} cvId={}", candidate.getId(), cvId);

        // Validation stricte du schéma et des limites
        cvDraftValidator.validateDraft(draftData);

        CvEntity cv = findCvEntityForCurrentUser(cvId).orElseGet(() -> {
            // Chercher d'abord un CV IN_PROGRESS existant pour ce candidat
            return cvRepository.findByCandidateId(candidate.getId()).stream()
                    .filter(c -> "IN_PROGRESS".equalsIgnoreCase(c.getInterviewStatus()))
                    .findFirst()
                    .orElseGet(() -> {
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
        });

        // State machine : contrôle des états modifiables
        if (cv.getInterviewStatus() != null && !Set.of("DRAFT", "IN_PROGRESS", "DRAFT_UPDATED", "COMPLETED").contains(cv.getInterviewStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "L'état actuel du CV (" + cv.getInterviewStatus() + ") ne permet pas la modification du brouillon.");
        }

        if (isDraftMeaningful(draftData)) {
            consumeInterviewQuotaIfNeeded(candidate, cv);
        }

        try {
            JsonNode rootNode = objectMapper.valueToTree(draftData);
            if (rootNode != null && rootNode.hasNonNull("template")) {
                String tCode = rootNode.get("template").asText();
                Long tid = parseTemplateCodeToId(tCode);
                if (tid != null) {
                    cv.setTemplateId(tid);
                }
            }
            cv.setContentJson(objectMapper.writeValueAsString(draftData));
            cv.setInterviewStatus("DRAFT_UPDATED");
            return mapToDto(cvRepository.save(cv));
        } catch (ResponseStatusException rse) {
            throw rse;
        } catch (Exception e) {
            log.error("Erreur sérialisation draft CV candidate_id={} : {}", candidate.getId(), e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Format de draft CV invalide : " + e.getMessage());
        }
    }

    @Transactional
    public Map<String, Object> completeInterview(String cvId) {
        CandidateEntity candidate = resolveCurrentCandidate();
        log.info("Finalisation entretien candidate_id={} cvId={}", candidate.getId(), cvId);

        CvEntity cv = findCvEntityForCurrentUser(cvId).orElseGet(() -> {
            return cvRepository.findByCandidateId(candidate.getId()).stream()
                    .filter(c -> "IN_PROGRESS".equalsIgnoreCase(c.getInterviewStatus()) || "DRAFT_UPDATED".equalsIgnoreCase(c.getInterviewStatus()))
                    .max(Comparator.comparing(CvEntity::getId))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "CV non trouvé ou non autorisé : " + cvId));
        });

        if (!cvDraftValidator.isDraftMeaningful(cv.getContentJson()) && !isDraftMeaningful(cv.getContentJson())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CV_INCOMPLETE: Le brouillon de CV ne contient pas assez d'informations pour être finalisé.");
        }

        consumeInterviewQuotaIfNeeded(candidate, cv);

        cv.setStatus("DRAFT_READY");
        cv.setInterviewStatus("COMPLETED");
        CvEntity saved = cvRepository.save(cv);

        syncCandidateProfile(saved);

        return Map.of(
                "cvId", saved.getId().toString(),
                "status", "DRAFT_READY",
                "updatedAt", saved.getUpdatedAt() != null
                        ? saved.getUpdatedAt().toString()
                        : Instant.now().toString()
        );
    }

    public CvDto synthesizeCvFromTranscript(String cvId, String transcriptText) {
        CandidateEntity candidate = resolveCurrentCandidate();
        log.info("Synthèse IA du CV à partir du transcript pour candidate_id={} cvId={}", candidate.getId(), cvId);

        CvEntity cv = findCvEntityForCurrentUser(cvId).orElseGet(() -> {
            return cvRepository.findByCandidateId(candidate.getId()).stream()
                    .filter(c -> "IN_PROGRESS".equalsIgnoreCase(c.getInterviewStatus()) || "DRAFT_UPDATED".equalsIgnoreCase(c.getInterviewStatus()))
                    .max(Comparator.comparing(CvEntity::getId))
                    .orElseGet(() -> {
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
        });

        if (transcriptText == null || transcriptText.trim().length() < 10) {
            return mapToDto(cv);
        }

        consumeInterviewQuotaIfNeeded(candidate, cv);

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

        // Appel IA hors transaction SQL pour préserver le pool HikariCP
        try {
            String jsonResult = tokenService.generateStructuredContent(systemInstruction, prompt);
            if (jsonResult != null && !jsonResult.isBlank()) {
                objectMapper.readTree(jsonResult);
                CvEntity saved = persistSynthesizedCv(cv, jsonResult);
                log.info("Synthèse IA réussie pour candidate_id={} cv_id={}", candidate.getId(), saved.getId());
                return mapToDto(saved);
            }
        } catch (Exception e) {
            log.error("Erreur lors de la synthèse IA du CV : {}", e.getMessage());
        }

        return mapToDto(cv);
    }

    @Transactional
    public CvEntity persistSynthesizedCv(CvEntity cv, String jsonResult) {
        cv.setContentJson(jsonResult);
        cv.setInterviewStatus("COMPLETED");
        cv.setStatus("DRAFT_READY");
        CvEntity saved = cvRepository.save(cv);
        syncCandidateProfile(saved);
        return saved;
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
        if (code == null || code.isBlank()) return null;
        String normalized = code.equalsIgnoreCase("classic") ? "classique" : code.equalsIgnoreCase("modern") ? "moderne" : code;
        return cvTemplateRepository.findByCode(normalized)
                .or(() -> cvTemplateRepository.findByCode(code))
                .map(CvTemplateEntity::getId)
                .orElse(null);
    }

    private void enrichCvDtoWithCandidate(CvDto dto, Integer candidateId) {
        if (candidateId == null) return;
        candidateRepository.findById(candidateId).ifPresent(candidate -> {
            try {
                String contentJson = dto.getContentJson();
                JsonNode rootNode = (contentJson != null && !contentJson.isBlank())
                        ? objectMapper.readTree(contentJson)
                        : objectMapper.createObjectNode();

                if (rootNode instanceof ObjectNode obj) {
                    boolean modified = false;
                    JsonNode identityNode = obj.get("identity");
                    ObjectNode identityObj;
                    if (identityNode instanceof ObjectNode existingIdentity) {
                        identityObj = existingIdentity;
                    } else {
                        identityObj = objectMapper.createObjectNode();
                        obj.set("identity", identityObj);
                        modified = true;
                    }

                    if ((!identityObj.hasNonNull("fullName") || identityObj.get("fullName").asText().isBlank())
                            && candidate.getFullName() != null && !candidate.getFullName().isBlank()) {
                        identityObj.put("fullName", candidate.getFullName());
                        modified = true;
                    }
                    if ((!identityObj.hasNonNull("email") || identityObj.get("email").asText().isBlank())
                            && candidate.getEmail() != null && !candidate.getEmail().isBlank()) {
                        identityObj.put("email", candidate.getEmail());
                        modified = true;
                    }
                    if ((!identityObj.hasNonNull("phone") || identityObj.get("phone").asText().isBlank())
                            && candidate.getPhone() != null && !candidate.getPhone().isBlank()) {
                        identityObj.put("phone", candidate.getPhone());
                        modified = true;
                    }
                    if ((!identityObj.hasNonNull("city") || identityObj.get("city").asText().isBlank())
                            && candidate.getCity() != null && !candidate.getCity().isBlank()) {
                        identityObj.put("city", candidate.getCity());
                        modified = true;
                    }
                    if ((!obj.hasNonNull("headline") || obj.get("headline").asText().isBlank())
                            && candidate.getTargetRole() != null && !candidate.getTargetRole().isBlank()) {
                        obj.put("headline", candidate.getTargetRole());
                        modified = true;
                    }

                    if (modified) {
                        dto.setContentJson(objectMapper.writeValueAsString(obj));
                    }
                }
            } catch (Exception e) {
                log.warn("Impossible d'enrichir contentJson avec le candidat : {}", e.getMessage());
            }
        });
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
            return saveCvEntity(newCv);
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

        // Appel IA hors transaction SQL
        String structuredJson = tokenService.generateStructuredContent(systemInstruction, userContent);
        if (structuredJson != null && !structuredJson.isBlank()) {
            cv = persistEditedCv(cv, structuredJson);
        }

        return mapToDto(cv);
    }

    @Transactional
    public CvEntity persistEditedCv(CvEntity cv, String structuredJson) {
        cv.setContentJson(structuredJson);
        return cvRepository.save(cv);
    }

    @Transactional
    public CvEntity saveCvEntity(CvEntity cv) {
        return cvRepository.save(cv);
    }

    public CvDto importCvFromFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Aucun fichier fourni.");
        }

        if (file.getSize() > 8 * 1024 * 1024) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Le fichier dépasse la taille maximale autorisée de 8 Mo.");
        }

        CandidateEntity candidate = resolveCurrentCandidate();

        // Éligibilité : requis au minimum 2 crédits Pro pour bénéficier de l'importation OCR IA
        if (candidate.getProCredits() == null || candidate.getProCredits() < 2) {
            log.warn("Tentative d'importation OCR sans solde suffisant pour candidate_id={} (crédits: {})",
                    candidate.getId(), candidate.getProCredits());
            throw new ResponseStatusException(
                    HttpStatus.PAYMENT_REQUIRED,
                    "INSUFFICIENT_CREDITS:L'analyse et l'importation de CV par OCR IA nécessitent un compte disposant d'au moins 2 crédits Pro. Veuillez recharger votre compte."
            );
        }

        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "cv_import.pdf";
        String contentType = file.getContentType();
        if (contentType == null || contentType.isBlank()) {
            if (filename.toLowerCase().endsWith(".pdf")) contentType = "application/pdf";
            else if (filename.toLowerCase().endsWith(".png")) contentType = "image/png";
            else if (filename.toLowerCase().endsWith(".jpg") || filename.toLowerCase().endsWith(".jpeg")) contentType = "image/jpeg";
            else contentType = "application/octet-stream";
        }

        if (!java.util.List.of("application/pdf", "image/png", "image/jpeg", "image/jpg").contains(contentType.toLowerCase())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Format de fichier non supporté. Formats acceptés : PDF, PNG, JPG.");
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

            // Appel IA multimodal lourd (peut durer 15-25s) exécuté HORS transaction SQL
            String structuredJson = tokenService.generateStructuredContentFromDocument(systemInstruction, userPrompt, bytes, contentType);
            if (structuredJson == null || structuredJson.isBlank()) {
                structuredJson = buildInitialContentJson(candidate);
            }

            CvEntity saved = persistImportedCv(candidate, filename, structuredJson);
            return mapToDto(saved);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.error("Erreur lors de l'import du CV : {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Échec du traitement du fichier CV.");
        }
    }

    @Transactional
    public CvEntity persistImportedCv(CandidateEntity candidate, String filename, String structuredJson) {
        CvEntity cv = CvEntity.builder()
                .candidateId(candidate.getId())
                .templateId(parseTemplateCodeToId("moderne"))
                .title("CV Importé (" + filename + ")")
                .contentJson(structuredJson)
                .status("DRAFT")
                .interviewStatus("COMPLETED")
                .build();
        return cvRepository.save(cv);
    }
}
