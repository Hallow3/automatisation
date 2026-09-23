package com.getjob.backend.cv.interview.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.getjob.backend.candidate.domain.CandidateEntity;
import com.getjob.backend.candidate.repository.CandidateRepository;
import com.getjob.backend.cv.domain.CvEntity;
import com.getjob.backend.cv.interview.domain.CvInterviewSessionEntity;
import com.getjob.backend.cv.interview.dto.InterviewTurnRequest;
import com.getjob.backend.cv.interview.dto.InterviewTurnResponse;
import com.getjob.backend.cv.interview.dto.RequestEndInterviewDto;
import com.getjob.backend.cv.interview.dto.SectionPatchDto;
import com.getjob.backend.cv.interview.repository.CvInterviewSessionRepository;
import com.getjob.backend.cv.repository.CvRepository;
import com.getjob.backend.cv.service.CvDraftValidator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.*;

/**
 * Orchestrateur central de l'entretien vocal CV (Spec V2, Section 3).
 * Découple complètement la voix (Gemini Live) de la structuration et de la State Machine.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class CvInterviewOrchestratorService {

    private final CvInterviewSessionRepository sessionRepository;
    private final CvRepository cvRepository;
    private final CandidateRepository candidateRepository;
    private final InterviewStateMachineService stateMachine;
    private final InterviewObserverService observerService;
    private final CvWriterService cvWriterService;
    private final CvDraftValidator cvDraftValidator;
    private final ObjectMapper objectMapper;

    /**
     * Initialise ou reprend une session d'entretien persistante liée à un CV.
     */
    @Transactional
    public InterviewTurnResponse initOrResumeSession(String cvIdStr, CandidateEntity candidate) {
        Long cvId = parseCvId(cvIdStr);
        CvEntity cv = cvRepository.findById(cvId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "CV introuvable : " + cvId));

        if (!cv.getCandidateId().equals(candidate.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Accès non autorisé à ce CV.");
        }

        // Vérifier si une session existe déjà pour ce CV
        Optional<CvInterviewSessionEntity> existingOpt = sessionRepository.findFirstByCvIdOrderByCreatedAtDesc(cvId);
        CvInterviewSessionEntity session;

        if (existingOpt.isPresent() &&
            !"COMPLETED".equalsIgnoreCase(existingOpt.get().getInterviewStatus()) &&
            !"DONE".equalsIgnoreCase(existingOpt.get().getInterviewStatus()) &&
            !"FINISHED".equalsIgnoreCase(existingOpt.get().getInterviewStatus())) {
            session = existingOpt.get();
            // Si la session était en USER_STOPPED ou TEMPORARILY_UNAVAILABLE, on la réactive
            if ("USER_STOPPED".equalsIgnoreCase(session.getInterviewStatus()) ||
                "TEMPORARILY_UNAVAILABLE".equalsIgnoreCase(session.getInterviewStatus())) {
                session.setInterviewStatus("ACTIVE");
                session = sessionRepository.save(session);
                log.info("[Orchestrator] Reprise de session existante id={} pour cv_id={}", session.getId(), cvId);
            }
        } else {
            // Création d'une nouvelle session persistante
            String sessionId = "sess_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
            Map<String, Object> initialCvData = loadInitialCvData(cv, candidate);

            session = CvInterviewSessionEntity.builder()
                    .id(sessionId)
                    .cvId(cvId)
                    .candidateId(candidate.getId())
                    .currentState("IDENTITY")
                    .sectionIndex(0)
                    .turnsInSection(0)
                    .sectionStatus("IN_PROGRESS")
                    .sectionTranscript("[]")
                    .fullTranscript("[]")
                    .sectionPartialData("{}")
                    .cvDataSoFar(writeJson(initialCvData))
                    .interviewStatus("ACTIVE")
                    .build();

            session = sessionRepository.save(session);
            log.info("[Orchestrator] Nouvelle session créée id={} pour cv_id={}", sessionId, cvId);
        }

        Map<String, Object> partialData = parseJsonMap(session.getSectionPartialData());
        String controlMessage = stateMachine.buildControlMessage(
                session.getCurrentState(),
                session.getSectionIndex(),
                session.getTurnsInSection(),
                partialData,
                Collections.emptyList()
        );

        return InterviewTurnResponse.builder()
                .sessionId(session.getId())
                .cvId(cvId.toString())
                .currentState(session.getCurrentState())
                .sectionIndex(session.getSectionIndex())
                .turnsInSection(session.getTurnsInSection())
                .sectionStatus(session.getSectionStatus())
                .interviewStatus(session.getInterviewStatus())
                .controlMessage(controlMessage)
                .cvDataSoFar(parseJsonMap(session.getCvDataSoFar()))
                .completionScore(0.0)
                .missingFields(Collections.emptyList())
                .sectionTransitionOccurred(false)
                .build();
    }

    /**
     * Traite un tour de parole (transcription texte utilisateur reçue de Gemini Live).
     */
    @Transactional
    public InterviewTurnResponse processTurn(InterviewTurnRequest request, CandidateEntity candidate) {
        CvInterviewSessionEntity session = sessionRepository.findById(request.getSessionId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session introuvable : " + request.getSessionId()));

        if (!session.getCandidateId().equals(candidate.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Accès non autorisé à cette session.");
        }

        // Si l'entretien est déjà terminé ou en revue, ne pas retraiter
        if ("REVIEW".equalsIgnoreCase(session.getInterviewStatus()) || "COMPLETED".equalsIgnoreCase(session.getInterviewStatus())) {
            return buildCurrentResponse(session, "Entretien déjà finalisé.", false, null, Collections.emptyList());
        }

        String currentState = session.getCurrentState();
        int sectionIndex = session.getSectionIndex() != null ? session.getSectionIndex() : 0;
        int turnsInSection = (session.getTurnsInSection() != null ? session.getTurnsInSection() : 0) + 1;
        session.setTurnsInSection(turnsInSection);

        // 1. Mettre à jour les transcripts (section et complet)
        List<Map<String, String>> fullTranscript = parseJsonList(session.getFullTranscript());
        List<Map<String, String>> sectionTranscript = parseJsonList(session.getSectionTranscript());

        if (request.getUserTurn() != null && !request.getUserTurn().isBlank()) {
            Map<String, String> userEntry = Map.of("role", "user", "text", request.getUserTurn().trim());
            fullTranscript.add(userEntry);
            sectionTranscript.add(userEntry);
        }
        if (request.getAiTurn() != null && !request.getAiTurn().isBlank()) {
            Map<String, String> aiEntry = Map.of("role", "ai", "text", request.getAiTurn().trim());
            fullTranscript.add(aiEntry);
            sectionTranscript.add(aiEntry);
        }

        session.setFullTranscript(writeJson(fullTranscript));

        // Formater le texte de transcription de la section pour l'observateur
        StringBuilder sectionText = new StringBuilder();
        for (Map<String, String> entry : sectionTranscript) {
            sectionText.append(entry.get("role")).append(": ").append(entry.get("text")).append("\n");
        }

        // 2. Appel de l'observateur LLM silencieux (gemini-3.5-flash-lite)
        Map<String, Object> currentPartial = parseJsonMap(session.getSectionPartialData());
        SectionPatchDto patchDto = observerService.observeSection(currentState, sectionIndex, sectionText.toString(), currentPartial);

        // 3. Fusion en code du patch dans l'état partiel et les données CV
        if (patchDto.getPatch() != null && !patchDto.getPatch().isEmpty()) {
            currentPartial.putAll(patchDto.getPatch());
        }
        session.setSectionPartialData(writeJson(currentPartial));

        Map<String, Object> cvDataSoFar = parseJsonMap(session.getCvDataSoFar());
        mergeSectionIntoCvData(currentState, sectionIndex, currentPartial, cvDataSoFar);
        session.setCvDataSoFar(writeJson(cvDataSoFar));

        // 4. Évaluation stricte des critères de transition (Spec V2, §11)
        int maxTurns = stateMachine.getMaxTurnsForState(currentState);
        int minTurns = stateMachine.getMinTurnsForState(currentState);
        boolean maxTurnsReached = turnsInSection >= maxTurns;
        boolean userWantsSkip = Boolean.TRUE.equals(patchDto.getUser_wants_skip());

        // Spec §11 : Le LLM peut suggérer une transition, mais la décision finale de complétude appartient au code !
        boolean isCompleteByCode = isSectionStrictlyComplete(currentState, currentPartial);
        boolean readyForTransition = Boolean.TRUE.equals(patchDto.getReady_for_transition()) && isCompleteByCode && (turnsInSection >= minTurns);

        // Si le LLM a suggéré une transition anticipée mais que les critères stricts (ex: dates) manquent :
        if (Boolean.TRUE.equals(patchDto.getReady_for_transition()) && !isCompleteByCode) {
            log.info("[Orchestrator] Refus de transition prématurée pour {} (tour {}/{}) : critères stricts non atteints dans {}",
                    currentState, turnsInSection, maxTurns, currentPartial.keySet());
            readyForTransition = false;
        }

        // Garde-fou sur maxTurnsReached : si une date ou info critique manque en EXPERIENCE, autoriser 1 tour de grâce ciblé
        if (maxTurnsReached && !isCompleteByCode && turnsInSection == maxTurns && !userWantsSkip && "EXPERIENCE".equals(currentState)) {
            log.info("[Orchestrator] Tour de grâce accordé pour EXPERIENCE #{} afin de collecter les dates manquantes", sectionIndex + 1);
            maxTurnsReached = false;
        }

        boolean transitionOccurred = false;

        if (readyForTransition || userWantsSkip || maxTurnsReached) {
            transitionOccurred = true;

            // Déterminer le statut de la section terminée
            if (userWantsSkip) {
                session.setSectionStatus("SKIPPED");
            } else if (readyForTransition || isCompleteByCode) {
                session.setSectionStatus("COMPLETE");
            } else {
                session.setSectionStatus("COMPLETE_WITH_GAPS");
            }

            // Gestion des boucles multi-éléments (EXPERIENCE, EDUCATION, PROJECTS)
            boolean hasMore = Boolean.TRUE.equals(patchDto.getUser_has_more());
            boolean isMultiState = "EXPERIENCE".equals(currentState) || "EDUCATION".equals(currentState) || "PROJECTS".equals(currentState);
            if (isMultiState && hasMore && sectionIndex < 4) {
                // Le candidat a un autre élément sur cette section : index + 1
                session.setSectionIndex(sectionIndex + 1);
                session.setTurnsInSection(0);
                session.setSectionStatus("IN_PROGRESS");
                session.setSectionTranscript("[]");
                session.setSectionPartialData("{}");
                log.info("[Orchestrator] Nouvel élément #{} pour {} (session id={})", session.getSectionIndex() + 1, currentState, session.getId());
            } else {
                // Passage à la section suivante
                String nextState = stateMachine.getNextSection(currentState);
                log.info("[Orchestrator] Transition d'état : {} -> {} (session id={})", currentState, nextState, session.getId());

                if ("FINALIZE".equals(nextState)) {
                    // Toutes les sections sont complétées -> Lancement du CV Writer
                    session.setCurrentState("FINALIZE");
                    session.setInterviewStatus("FINALIZING");
                    sessionRepository.save(session);

                    // Peaufiner le CV via CvWriterService
                    Map<String, Object> finalizedCvData = cvWriterService.finalizeCv(cvDataSoFar);

                    // Avertissements de complétude via CvDraftValidator
                    List<String> warnings = cvDraftValidator.checkCompletenessWarnings(finalizedCvData);
                    if (!warnings.isEmpty()) {
                        log.info("[Orchestrator] Avertissements de complétude pour session id={} : {}", session.getId(), warnings);
                    }

                    session.setCvDataSoFar(writeJson(finalizedCvData));
                    session.setCurrentState("REVIEW");
                    session.setInterviewStatus("REVIEW");

                    // Sauvegarder dans l'entité CV
                    persistCvContent(session.getCvId(), finalizedCvData, "REVIEW");
                } else {
                    session.setCurrentState(nextState);
                    session.setSectionIndex(0);
                    session.setTurnsInSection(0);
                    session.setSectionStatus("IN_PROGRESS");
                    session.setSectionTranscript("[]");
                    session.setSectionPartialData("{}");
                }
            }
        } else {
            session.setSectionTranscript(writeJson(sectionTranscript));
        }

        session = sessionRepository.save(session);

        // Sauvegarder le draft intermédiaire dans l'entité CV sans casser
        persistCvContent(session.getCvId(), cvDataSoFar, "IN_PROGRESS");

        // 5. Construire le message de contrôle [INTERVIEW_STATE] pour Gemini Live
        Map<String, Object> latestPartial = parseJsonMap(session.getSectionPartialData());
        String controlMessage = stateMachine.buildControlMessage(
                session.getCurrentState(),
                session.getSectionIndex() != null ? session.getSectionIndex() : 0,
                session.getTurnsInSection() != null ? session.getTurnsInSection() : 0,
                latestPartial,
                patchDto.getMissing_fields() != null ? patchDto.getMissing_fields() : Collections.emptyList()
        );

        return InterviewTurnResponse.builder()
                .sessionId(session.getId())
                .cvId(session.getCvId().toString())
                .currentState(session.getCurrentState())
                .sectionIndex(session.getSectionIndex())
                .turnsInSection(session.getTurnsInSection())
                .sectionStatus(session.getSectionStatus())
                .interviewStatus(session.getInterviewStatus())
                .controlMessage(controlMessage)
                .cvDataSoFar(cvDataSoFar)
                .completionScore(patchDto.getCompletion_score())
                .missingFields(patchDto.getMissing_fields())
                .sectionTransitionOccurred(transitionOccurred)
                .build();
    }

    /**
     * Valide de manière stricte la demande d'arrêt anticipé de l'entretien (Spec V2, Section 14).
     */
    @Transactional
    public RequestEndInterviewDto.Response handleRequestEndInterview(
            RequestEndInterviewDto.Request request,
            CandidateEntity candidate
    ) {
        CvInterviewSessionEntity session = sessionRepository.findById(request.getSessionId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session introuvable : " + request.getSessionId()));

        if (!session.getCandidateId().equals(candidate.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Accès non autorisé à cette session.");
        }

        boolean isValidStop = stateMachine.isValidUserStopIntent(request.getUserIntentExcerpt(), request.getLastUserTurn());

        if (isValidStop) {
            log.info("[Orchestrator] Arrêt utilisateur validé pour session id={} (cv_id={})", session.getId(), session.getCvId());
            session.setInterviewStatus("USER_STOPPED");
            sessionRepository.save(session);

            CvEntity cv = cvRepository.findById(session.getCvId()).orElse(null);
            if (cv != null) {
                cv.setInterviewStatus("USER_STOPPED");
                cvRepository.save(cv);
            }

            return RequestEndInterviewDto.Response.builder()
                    .approved(true)
                    .status("USER_STOPPED")
                    .reason("USER_REQUESTED_STOP")
                    .instruction("Entretien interrompu à la demande explicite de l'utilisateur. Sa progression a été sauvegardée.")
                    .build();
        } else {
            log.warn("[Orchestrator] Demande d'arrêt REFUSÉE pour session id={} : intention non explicite ('{}')",
                    session.getId(), request.getUserIntentExcerpt());

            return RequestEndInterviewDto.Response.builder()
                    .approved(false)
                    .status("CONTINUE")
                    .reason("NOT_EXPLICIT_STOP")
                    .instruction("L'utilisateur n'a pas demandé explicitement l'arrêt complet de l'entretien, mais souhaite continuer ou passer la section. Ne conclus pas l'entretien. Poursuis selon la section active.")
                    .build();
        }
    }

    // ── Helpers & Fusion en code ───────────────────────────────────────────────

    private boolean isSectionStrictlyComplete(String state, Map<String, Object> partial) {
        if (partial == null || partial.isEmpty()) {
            return false;
        }
        Map<String, Object> norm = normalizePartialKeys(state, partial);

        return switch (state) {
            case "IDENTITY" -> {
                Object name = norm.get("fullName");
                yield name != null && !name.toString().isBlank();
            }
            case "TARGET" -> {
                Object headline = norm.get("headline");
                yield headline != null && !headline.toString().isBlank();
            }
            case "EXPERIENCE" -> {
                boolean hasCompany = norm.get("company") != null && !norm.get("company").toString().isBlank();
                boolean hasPosition = norm.get("position") != null && !norm.get("position").toString().isBlank();
                boolean hasStartDate = norm.get("startDate") != null && !norm.get("startDate").toString().isBlank();
                boolean hasEndDate = norm.get("endDate") != null && !norm.get("endDate").toString().isBlank();
                boolean hasPeriod = norm.get("period") != null && !norm.get("period").toString().isBlank();
                boolean hasDates = hasStartDate || hasEndDate || hasPeriod;

                boolean hasContent = (norm.get("responsibilities") instanceof List<?> l && !l.isEmpty()) ||
                                     (norm.get("achievements") instanceof List<?> a && !a.isEmpty()) ||
                                     (norm.get("context") != null && !norm.get("context").toString().isBlank()) ||
                                     (norm.get("description") != null && !norm.get("description").toString().isBlank());

                yield hasCompany && hasPosition && hasDates && hasContent;
            }
            case "EDUCATION" -> {
                boolean hasSchool = norm.get("school") != null && !norm.get("school").toString().isBlank();
                boolean hasDegree = norm.get("degree") != null && !norm.get("degree").toString().isBlank();
                yield hasSchool && hasDegree;
            }
            case "PROJECTS" -> {
                yield (norm.get("name") != null && !norm.get("name").toString().isBlank()) ||
                      (norm.get("description") != null && !norm.get("description").toString().isBlank());
            }
            case "SKILLS" -> {
                if (norm.get("skills") instanceof List<?> list) {
                    yield list.size() >= 2;
                }
                yield false;
            }
            case "LANGUAGES" -> {
                if (norm.get("languages") instanceof List<?> list) {
                    yield !list.isEmpty();
                }
                yield false;
            }
            default -> true;
        };
    }

    private void mergeSectionIntoCvData(String section, int sectionIndex, Map<String, Object> partial, Map<String, Object> cvData) {
        Map<String, Object> norm = normalizePartialKeys(section, partial);

        switch (section) {
            case "IDENTITY" -> {
                @SuppressWarnings("unchecked")
                Map<String, Object> idMap = (Map<String, Object>) cvData.computeIfAbsent("identity", k -> new HashMap<String, Object>());
                if (norm.containsKey("fullName")) idMap.put("fullName", norm.get("fullName"));
                if (norm.containsKey("email")) idMap.put("email", norm.get("email"));
                if (norm.containsKey("phone")) idMap.put("phone", norm.get("phone"));
                if (norm.containsKey("city")) idMap.put("city", norm.get("city"));
            }
            case "TARGET" -> {
                if (norm.containsKey("headline")) {
                    cvData.put("headline", norm.get("headline"));
                }
            }
            case "EXPERIENCE" -> {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> exps = (List<Map<String, Object>>) cvData.computeIfAbsent("experiences", k -> new ArrayList<Map<String, Object>>());
                while (exps.size() <= sectionIndex) {
                    exps.add(new HashMap<>());
                }
                Map<String, Object> targetExp = exps.get(sectionIndex);
                targetExp.putAll(norm);
            }
            case "PROJECTS" -> {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> projects = (List<Map<String, Object>>) cvData.computeIfAbsent("projects", k -> new ArrayList<Map<String, Object>>());
                if (norm.get("projects") instanceof List<?> list && !list.isEmpty()) {
                    for (Object p : list) {
                        if (p instanceof Map<?, ?> pMap) {
                            @SuppressWarnings("unchecked")
                            Map<String, Object> casted = (Map<String, Object>) pMap;
                            if (!projects.contains(casted)) {
                                projects.add(new HashMap<>(casted));
                            }
                        }
                    }
                } else {
                    while (projects.size() <= sectionIndex) {
                        projects.add(new HashMap<>());
                    }
                    projects.get(sectionIndex).putAll(norm);
                }
            }
            case "EDUCATION" -> {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> edus = (List<Map<String, Object>>) cvData.computeIfAbsent("education", k -> new ArrayList<Map<String, Object>>());
                Object eduListObj = norm.containsKey("education") ? norm.get("education") : norm.get("formations");
                if (eduListObj instanceof List<?> list && !list.isEmpty()) {
                    for (Object e : list) {
                        if (e instanceof Map<?, ?> eMap) {
                            @SuppressWarnings("unchecked")
                            Map<String, Object> casted = (Map<String, Object>) eMap;
                            if (!edus.contains(casted)) {
                                edus.add(new HashMap<>(casted));
                            }
                        }
                    }
                } else {
                    while (edus.size() <= sectionIndex) {
                        edus.add(new HashMap<>());
                    }
                    edus.get(sectionIndex).putAll(norm);
                }
            }
            case "SKILLS" -> {
                Object skillsObj = norm.get("skills");
                if (skillsObj instanceof List<?> list) {
                    @SuppressWarnings("unchecked")
                    Set<String> set = new LinkedHashSet<>((List<String>) cvData.computeIfAbsent("skills", k -> new ArrayList<String>()));
                    for (Object item : list) {
                        if (item != null && !item.toString().isBlank()) {
                            set.add(item.toString().trim());
                        }
                    }
                    cvData.put("skills", new ArrayList<>(set));
                }
            }
            case "LANGUAGES" -> {
                Object langsObj = norm.get("languages");
                if (langsObj instanceof List<?> list) {
                    cvData.put("languages", list);
                }
            }
        }
    }

    private Map<String, Object> normalizePartialKeys(String section, Map<String, Object> partial) {
        Map<String, Object> norm = new HashMap<>(partial);
        if ("EXPERIENCE".equals(section)) {
            if (!norm.containsKey("company")) {
                Object c = firstNonNull(partial, "entreprise", "employeur", "societe");
                if (c != null) norm.put("company", c);
            }
            if (!norm.containsKey("position")) {
                Object p = firstNonNull(partial, "poste", "role", "title", "titre", "metier");
                if (p != null) norm.put("position", p);
            }
            if (!norm.containsKey("startDate")) {
                Object s = firstNonNull(partial, "debut", "dateDebut", "anneeDebut", "start");
                if (s != null) norm.put("startDate", s);
            }
            if (!norm.containsKey("endDate")) {
                Object e = firstNonNull(partial, "fin", "dateFin", "anneeFin", "end");
                if (e != null) norm.put("endDate", e);
            }
            // Découpage automatique si seule une chaîne de période est fournie (ex: "2021 - 2023" ou "2021 à présent")
            if (!norm.containsKey("startDate")) {
                Object p = firstNonNull(partial, "period", "periode", "dates", "annee", "duree");
                if (p instanceof String pStr && !pStr.isBlank()) {
                    String[] parts = pStr.split("(?i)\\s*(-|à|au|to)\\s*");
                    if (parts.length >= 1 && !parts[0].isBlank()) {
                        norm.put("startDate", parts[0].trim());
                    }
                    if (parts.length >= 2 && !parts[1].isBlank()) {
                        norm.put("endDate", parts[1].trim());
                    }
                }
            }
            if (!norm.containsKey("responsibilities")) {
                Object r = firstNonNull(partial, "missions", "taches", "responsabilites");
                if (r != null) norm.put("responsibilities", r);
            }
            if (!norm.containsKey("technologies")) {
                Object t = firstNonNull(partial, "outils", "competences", "stack");
                if (t != null) norm.put("technologies", t);
            }
        } else if ("EDUCATION".equals(section)) {
            if (!norm.containsKey("school")) {
                Object s = firstNonNull(partial, "ecole", "universite", "etablissement", "institution");
                if (s != null) norm.put("school", s);
            }
            if (!norm.containsKey("degree")) {
                Object d = firstNonNull(partial, "diplome", "formation", "filiere");
                if (d != null) norm.put("degree", d);
            }
            if (!norm.containsKey("year")) {
                Object y = firstNonNull(partial, "annee", "date", "periode", "promotion");
                if (y != null) norm.put("year", y);
            }
        }
        return norm;
    }

    private Object firstNonNull(Map<String, Object> map, String... keys) {
        for (String k : keys) {
            Object v = map.get(k);
            if (v != null && !v.toString().isBlank()) return v;
        }
        return null;
    }

    private void persistCvContent(Long cvId, Map<String, Object> cvData, String interviewStatus) {
        try {
            CvEntity cv = cvRepository.findById(cvId).orElse(null);
            if (cv != null) {
                cv.setContentJson(objectMapper.writeValueAsString(cvData));
                cv.setInterviewStatus(interviewStatus);
                cvRepository.save(cv);
            }
        } catch (Exception e) {
            log.warn("[Orchestrator] Échec sauvegarde CvEntity pour cv_id={}: {}", cvId, e.getMessage());
        }
    }

    private Map<String, Object> loadInitialCvData(CvEntity cv, CandidateEntity candidate) {
        // Toujours partir d'un brouillon vierge avec uniquement les coordonnées du candidat.
        // Ne jamais pré-remplir depuis un contentJson existant pour éviter la contamination
        // par les données d'un entretien ou import précédent.
        Map<String, Object> initial = new HashMap<>();
        Map<String, String> identity = new HashMap<>();
        identity.put("fullName", candidate.getFullName() != null ? candidate.getFullName() : "");
        identity.put("email", candidate.getEmail() != null ? candidate.getEmail() : "");
        identity.put("phone", candidate.getPhone() != null ? candidate.getPhone() : "");
        identity.put("city", candidate.getCity() != null ? candidate.getCity() : "");
        initial.put("identity", identity);
        initial.put("headline", candidate.getTargetRole() != null ? candidate.getTargetRole() : "");
        initial.put("summary", "");
        initial.put("experiences", new ArrayList<>());
        initial.put("education", new ArrayList<>());
        initial.put("skills", new ArrayList<>());
        initial.put("languages", new ArrayList<>());
        initial.put("projects", new ArrayList<>());
        return initial;
    }

    private InterviewTurnResponse buildCurrentResponse(
            CvInterviewSessionEntity session,
            String message,
            boolean transitioned,
            Double score,
            List<String> missing
    ) {
        return InterviewTurnResponse.builder()
                .sessionId(session.getId())
                .cvId(session.getCvId().toString())
                .currentState(session.getCurrentState())
                .sectionIndex(session.getSectionIndex())
                .turnsInSection(session.getTurnsInSection())
                .sectionStatus(session.getSectionStatus())
                .interviewStatus(session.getInterviewStatus())
                .controlMessage(message)
                .cvDataSoFar(parseJsonMap(session.getCvDataSoFar()))
                .completionScore(score != null ? score : 1.0)
                .missingFields(missing)
                .sectionTransitionOccurred(transitioned)
                .build();
    }

    private Long parseCvId(String idStr) {
        try {
            return Long.parseLong(idStr);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Format d'ID de CV invalide : " + idStr);
        }
    }

    private Map<String, Object> parseJsonMap(String json) {
        if (json == null || json.isBlank()) return new HashMap<>();
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            return new HashMap<>();
        }
    }

    private List<Map<String, String>> parseJsonList(String json) {
        if (json == null || json.isBlank()) return new ArrayList<>();
        try {
            return objectMapper.readValue(json, new TypeReference<List<Map<String, String>>>() {});
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private String writeJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            return "{}";
        }
    }
}
