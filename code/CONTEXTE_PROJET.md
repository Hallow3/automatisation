# ðŸš€ CONTEXTE GLOBAL & RÃ‰FÃ‰RENTIEL TECHNIQUE EXHAUSTIF â€” FALLAJOBS

> **Date de mise Ã  jour** : 1 octobre 2026  
> **Version active** : 1.4.0  
> **Statut global** : DÃ©ployÃ© en production (VPS fallajobs.com) & qualifiÃ©  
> **Auteurs & Maintenance** : Ã‰quipe d'ingÃ©nierie FallaJobs

### Ã‰tat de rÃ©fÃ©rence au 1 octobre 2026

- Production dÃ©ployÃ©e sur le commit `62df259`.
- Frontend Angular et backend Spring Boot reconstruits avec Docker ; les deux conteneurs sont `healthy` et `/actuator/health` retourne `UP`.
- ModÃ¨le vocal configurÃ© : `gemini-3.8-live`, voix `Charon`, langue `fr-FR`.
- La voix est guidÃ©e vers une intonation inspirÃ©e du franÃ§ais camerounais contemporain. Gemini Live ne dispose pas d'une voix native `fr-CM` garantie.
- Gemini Live ne reÃ§oit qu'un seul outil : `request_end_interview`. Les mises Ã  jour CV, les audits et la finalisation sont exÃ©cutÃ©s cÃ´tÃ© backend.
- Le CV se met Ã  jour aprÃ¨s chaque tour vocal finalisÃ© via `POST /interview/v2/turn`. Le canal SSE est disponible, mais le frontend ne pousse pas encore les segments partiels vers `/push-transcript`.
- Les tests backend passent : **33 tests, 0 Ã©chec**. Le build Angular production passe avec les budgets `anyComponentStyle` Ã  `8 kB` (warning) et `12 kB` (erreur).

---

## ðŸ“‘ TABLE DES MATIÃˆRES
1. [Vision, Mission & Proposition de Valeur](#1-vision-mission--proposition-de-valeur)
2. [Architecture SystÃ¨me Globale & Diagrammes](#2-architecture-systÃ¨me-globale--diagrammes)
3. [Architecture Backend (Spring Boot 3.3 / Java 17-21)](#3-architecture-backend-spring-boot-33--java-17-21)
4. [Architecture Frontend (Angular 18 / Tailwind CSS)](#4-architecture-frontend-angular-18--tailwind-css)
5. [Intelligence Artificielle, Audio Temps RÃ©el & Prompts](#5-intelligence-artificielle-audio-temps-rÃ©el--prompts)
6. [SchÃ©ma de DonnÃ©es & Persistance (MySQL / Flyway V1 -> V14)](#6-schÃ©ma-de-donnÃ©es--persistance-mysql--flyway-v1---v14)
7. [RÃ©fÃ©rentiel Complet des Endpoints REST & Contrats](#7-rÃ©fÃ©rentiel-complet-des-endpoints-rest--contrats)
8. [Catalogue des ModÃ¨les de CV (Microsoft Word & ATS)](#8-catalogue-des-modÃ¨les-de-cv-microsoft-word--ats)
9. [SÃ©curitÃ©, Multi-Tenancy & ConformitÃ© OWASP](#9-sÃ©curitÃ©-multi-tenancy--conformitÃ©-owasp)
10. [Audit de PrÃ©paration Production & DÃ©cisions ClÃ©s](#10-audit-de-prÃ©paration-production--dÃ©cisions-clÃ©s)
11. [Variables d'Environnement & DÃ©ploiement](#11-variables-denvironnement--dÃ©ploiement)
12. [RÃ¨gles d'Or d'IngÃ©nierie & Normes de QualitÃ©](#12-rÃ¨gles-dor-dingÃ©nierie--normes-de-qualitÃ©)

---

## ðŸŽ¯ 1. Vision, Mission & Proposition de Valeur

### 1.1. ProblÃ©matique MÃ©tier
La recherche d'emploi et la crÃ©ation d'un CV percutant reprÃ©sentent des obstacles majeurs pour des millions de candidats :
- **BarriÃ¨re de la rÃ©daction** : DifficultÃ© Ã  formuler ses expÃ©riences avec des verbes d'action, Ã  quantifier ses rÃ©alisations et Ã  structurer un document clair.
- **Fracture numÃ©rique et mobile** : Des candidats trÃ¨s qualifiÃ©s manquent d'un ordinateur ou d'une maÃ®trise des outils bureautiques (Word/Canva) pour concevoir un CV moderne et lisible par les robots ATS (*Applicant Tracking Systems*).
- **Processus de candidature fragmentÃ©** : Dispersions entre la recherche d'offres sur de multiples plateformes, l'adaptation du CV et le suivi des statuts de candidature.

### 1.2. La Solution FallaJobs
FallaJobs unifie l'ensemble du cycle de recherche d'emploi en un espace de travail personnel assistÃ© par IA :
1. **Coach Vocal Interactif (Google Gemini 3.8 Live)** : Un entretien audio direct via WebSocket oÃ¹ l'IA pose des questions bienveillantes, analyse les rÃ©ponses vocales du candidat en temps rÃ©el et structure automatiquement son CV sans saisie manuelle.
2. **DÃ©tection Proactive d'Anomalies (`audit_cv_integrity`)** : Outil algorithmique dÃ©terministe cÃ´tÃ© client analysant chevauchements de dates, inversions chronologiques, doublons et incomplÃ©tudes pendant l'entretien vocal, permettant Ã  l'IA d'interroger le candidat en cas de doute.
3. **Ã‰diteur & Galerie de CV Haute FidÃ©litÃ© (Style Microsoft Word)** : Rendu fidÃ¨le A4 multipages physique, personnalisation typographique et chromatique, Ã©dition assistÃ©e par chat IA, et double moteur d'export PDF 100% gratuit et sans contrainte (Chromium headless cÃ´tÃ© serveur avec jeton Ã©phÃ©mÃ¨re + jsPDF vectoriel cÃ´tÃ© client).
4. **Analyseur Multimodal de Documents (OCR)** : Import de CV existants (PDF, PNG, JPG) via Gemini 2.0 Flash avec extraction et restructuration JSON sans perte. ContrÃ´le d'Ã©ligibilitÃ© rÃ©servÃ© aux comptes avec au moins 2 crÃ©dits Pro (sans dÃ©bit lors de l'import).
5. **Moteur d'OpportunitÃ©s & Scoring d'AffinitÃ© Dynamique** : AgrÃ©gation d'offres, calcul algorithmique du score de correspondance rÃ©el (45% Ã  95% basÃ© sur les compÃ©tences et intitulÃ©s), gÃ©nÃ©ration automatique de lettres de motivation personnalisÃ©es (persistÃ©es en base MySQL) et suivi Kanban des candidatures.
6. **Passerelle de Paiement Programmatique SÃ©curisÃ©e (NotchPay) & Fallback WhatsApp** :
   - Sessions crÃ©Ã©es via l'API programmatique `POST https://api.notchpay.co/payments` (500 FCFA unitaire / 1 200 FCFA pack 3 CVs).
   - Redirection vers l'`authorization_url` hÃ©bergÃ© NotchPay pour Mobile Money (Orange Money, MTN MoMo) ou carte bancaire.
   - Validation stricte par webhook signÃ© HMAC-SHA256 (`X-Notch-Signature`) calculÃ© sur corps brut, table d'idempotence `notchpay_webhook_event` (`evt_...`), et double vÃ©rification sortante obligatoire `GET /payments/{reference}`.
   - RÃ©silience avec client HTTP dÃ©diÃ©, timeouts courts, retry exponentiel et circuit breaker autonome (`NotchPayCircuitBreaker`).
   - Bascule assistÃ©e automatique sur WhatsApp (`+237 698 76 55 88`) avec message prÃ©-rempli et statut tracÃ© `FALLBACK_WHATSAPP` en cas de panne de la passerelle.

---

## ðŸ—ï¸ 2. Architecture SystÃ¨me Globale & Diagrammes

### 2.1. Diagramme de Flux et Composants

```mermaid
graph TD
    subgraph Client [Frontend SPA - Angular 18]
        Landing["Landing Page Ã‰ditoriale (Inspiration Anthropic)"]
        UI["Composants UI & Signaux (Tailwind CSS / Signals)"]
        AudioEngine["Audio Pcm Engine (Worklet 16kHz / Playback 24kHz)"]
        AuditEngine["CvAuditEngineService (audit_cv_integrity)"]
        CVEditor["Ã‰diteur Split-Screen & Assistant Chat IA"]
        PaymentMod["Modal & Service NotchPay + WhatsApp Fallback"]
    end

    subgraph Backend [Backend API - Spring Boot 3.3]
        Sec["Spring Security 6 (JWT Cookie HttpOnly + RateLimitFilter)"]
        CVService["CvService & CvDraftValidator (State Machine)"]
        CVPdf["CvPdfExportService (Chromium Headless & Semaphore 2)"]
        OppService["OpportunityService & ApplicationService"]
        PayService["PaymentService & Webhook Verifier (HMAC-SHA256)"]
        NotchResil["NotchPayClient & CircuitBreaker"]
        AIToken["GeminiLiveTokenService (Rotation & Failover)"]
        GlobalEx["GlobalExceptionHandler (RFC 7807)"]
    end

    subgraph Persistance [Base de DonnÃ©es]
        MySQL[(MySQL 8.0 / HikariCP Pool)]
        Migrations[Flyway DB Migrations V1 -> V10]
    end

    subgraph External [Services Externes & IA Google]
        GeminiWS["Google Gemini 3.8 Live (gemini-3.8-live)"]
        GeminiREST["Google Gemini 3.5 Flash Lite REST (gemini-3.5-flash-lite)"]
        NotchPay["Passerelle NotchPay (API POST /payments & Webhook HMAC)"]
        WhatsApp["Support WhatsApp (+237 698 76 55 88)"]
        GoogleOAuth["Google Identity Services (ID Token Verifier)"]
        SMTP["Serveur SMTP (Emails de vÃ©rification & Reset)"]
    end

    Landing --> UI
    UI -->|REST + Cookie JWT HttpOnly| Sec
    PaymentMod -->|Initie Checkout| PayService
    AudioEngine -->|WebSocket Direct + Token Ã‰phÃ©mÃ¨re| GeminiWS
    AuditEngine -.->|Inspection Brouillon| AudioEngine
    Sec --> CVService
    Sec --> CVPdf
    Sec --> OppService
    Sec --> PayService
    PayService --> NotchResil
    NotchResil -->|API POST /payments| NotchPay
    NotchResil -.->|Fallback DÃ©fensif| WhatsApp
    CVService --> AIToken
    CVService --> MySQL
    OppService --> AIToken
    OppService --> MySQL
    PayService --> MySQL
    NotchPay -->|Webhook SignÃ© X-Notch-Signature| PayService
    AIToken -->|Auth Token Request| GeminiWS
    AIToken -->|Generate Content REST| GeminiREST
    Sec --> GoogleOAuth
    Sec --> SMTP
```

### 2.2. Flux de DonnÃ©es de l'Entretien Vocal IA & Audit d'IntÃ©gritÃ©

```mermaid
sequenceDiagram
    autonumber
    actor Candidate as Candidat
    participant Front as Frontend (Angular)
    participant Back as Backend (Spring Boot)
    participant GeminiAPI as Google Gemini Live WS

    Candidate->>Front: Clic "DÃ©marrer l'entretien vocal"
    Front->>Back: POST /api/v1/cvs/{id}/interview/session
    Back->>Back: Quota check (3/jour) + RÃ©solution CV (Anti-IDOR)
    Back->>GeminiAPI: POST /v1beta/auth_tokens (x-goog-api-key serveur)
    GeminiAPI-->>Back: Token Ã©phÃ©mÃ¨re (auth_tokens/xxx, uses=3)
    Back-->>Front: { token: "auth_tokens/xxx", cvId: "42", model: "gemini-3.8-live" }
    
    Front->>GeminiAPI: wss://generativelanguage.googleapis.com/.../BidiGenerateContentConstrained
    GeminiAPI-->>Front: setupComplete
    Front->>GeminiAPI: ClientContent (Audio Micro PCM 16kHz)
    GeminiAPI-->>Front: ServerContent (Audio Voix PCM 24kHz)
    
    GeminiAPI-->>Front: turnComplete après la réponse de Bray
    Front->>Back: POST /api/v2/interview/cv/42/turn
    Back->>Back: InterviewObserverService + CvInterviewOrchestratorService
    Back->>Back: CvDraftValidator.validateDraft()
    Back-->>Front: cvDataSoFar + controlMessage
    Front->>Front: Fusion du patch dans currentDraft()
    Note over GeminiAPI,Candidate: Gemini Live ne modifie pas directement la base ; le backend reste l'autorité des écritures
    
    Candidate->>Front: Clic "Terminer l'entretien"
    Front->>Back: POST /api/v1/cvs/42/interview/complete
    Back->>Back: Garde isDraftMeaningful() -> Status COMPLETED / DRAFT_READY
    Back->>Back: Synchronisation candidate_profile
    Back-->>Front: Redirection vers /cv-builder?id=42
```

### 2.3. Flux de Paiement Programmatique NotchPay & Fallback WhatsApp

```mermaid
sequenceDiagram
    autonumber
    actor Candidate as Candidat
    participant Front as Frontend (Angular)
    participant Back as Backend (Spring Boot)
    participant NotchPay as API NotchPay
    participant WhatsApp as WhatsApp Support

    Candidate->>Front: Clic "DÃ©verrouiller le CV" (500 FCFA ou Pack 1 200 FCFA)
    Front->>Back: POST /api/v1/payments/initiate { cvId, packId, type }
    Back->>Back: CrÃ©ation PaymentTransactionEntity (PENDING, ref PAY-XXXX)
    
    alt API NotchPay disponible (Circuit Breaker CLOSED)
        Back->>NotchPay: POST /payments (ref, amount, XAF, customer, callback)
        NotchPay-->>Back: { status: "ACCEPTED", authorization_url: "https://checkout.notchpay.co/..." }
        Back-->>Front: { checkoutUrl: "https://...", reference: "PAY-XXXX" }
        Front->>NotchPay: Redirection vers authorization_url
        Candidate->>NotchPay: Paiement Mobile Money (MTN / Orange) ou Carte
        
        NotchPay->>Back: POST /webhooks/notchpay (X-Notch-Signature HMAC-SHA256)
        Back->>Back: VÃ©rification signature brute + Idempotence (evt_...)
        Back->>NotchPay: GET /payments/{reference} (Double vÃ©rification obligatoire)
        NotchPay-->>Back: { status: "complete", amount: 500 }
        Back->>Back: Mise Ã  jour Transaction -> SUCCESS
        Back->>Back: DÃ©verrouillage CV (CvUnlock) ou incrÃ©mentation proCredits (+2)
        Back-->>NotchPay: HTTP 200 OK
        
        NotchPay-->>Front: Redirection return_url (?payment=success&ref=PAY-XXXX)
        Front->>Back: GET /api/v1/payments/status/PAY-XXXX
        Back-->>Front: { status: "SUCCESS", isUnlocked: true }
    else Panne API NotchPay ou Circuit Breaker OPEN
        Back->>Back: DÃ©tection Ã©chec transitoire ou circuit ouvert
        Back-->>Front: { fallbackWhatsApp: true, whatsAppUrl: "https://wa.me/237698765588?text=..." }
        Front->>Candidate: Modale empathique "Finaliser via WhatsApp"
        Candidate->>Front: Confirmation "Continuer sur WhatsApp"
        Front->>Back: POST /api/v1/payments/fallback-whatsapp/PAY-XXXX
        Back->>Back: Transaction status -> FALLBACK_WHATSAPP
        Front->>WhatsApp: Ouverture de la conversation avec message prÃ©-rempli
    end
```

### 2.4. Flux d'Export PDF Haute DÃ©finition (Headless Chromium)

```mermaid
sequenceDiagram
    autonumber
    actor Candidate as Candidat
    participant Front as Frontend (Angular)
    participant Back as Backend (Spring Boot)
    participant Chromium as Moteur Chromium Headless

    Candidate->>Front: Clic "TÃ©lÃ©charger en PDF HD" (100% gratuit)
    Front->>Back: POST /api/v1/cvs/42/download-ticket?template=moderne
    Back->>Back: ContrÃ´le Anti-IDOR (Export 100% gratuit, aucun contrÃ´le de paiement)
    Back->>Back: GÃ©nÃ©ration ticket Ã©phÃ©mÃ¨re (TTL 300s)
    Back-->>Front: { downloadUrl: "/api/v1/cvs/42/download?token=xxx", token: "xxx" }
    
    Front->>Back: GET /api/v1/cvs/42/download?token=xxx (Nouvel onglet)
    Back->>Back: Consommation du ticket + acquisition sÃ©maphore (max 2 Chromium)
    Back->>Back: GÃ©nÃ©ration Print Token Ã©phÃ©mÃ¨re (TTL 60s)
    Back->>Chromium: Lancement headless Chromium sur URL /print/cv/42?token=yyy
    Chromium->>Back: GET /api/v1/cvs/42/print-data?token=yyy
    Back-->>Chromium: CvDto (JSON complet sans cookies de session)
    Chromium->>Chromium: Rendu HTML/CSS A4 physique
    Chromium-->>Back: Flux PDF vectoriel 100% net
    Back->>Back: LibÃ©ration sÃ©maphore
    Back-->>Front: Stream PDF (Content-Disposition: attachment; filename="CV_42.pdf")
```

---

## â˜• 3. Architecture Backend (Spring Boot 3.3 / Java 17-21)

### 3.1. Structure des Packages
```text
backend/src/main/java/com/getjob/backend/
â”œâ”€â”€ BackendApplication.java                      # Point d'entrÃ©e Spring Boot
â”œâ”€â”€ ai/
â”‚   â””â”€â”€ service/
â”‚       â””â”€â”€ GeminiLiveTokenService.java          # Gestionnaire pool de clÃ©s, jetons Ã©phÃ©mÃ¨res Gemini 3.1 & Vision
â”œâ”€â”€ application/                                 # Module de suivi des candidatures
â”‚   â”œâ”€â”€ controller/ApplicationController.java
â”‚   â”œâ”€â”€ domain/ApplicationEntity.java
â”‚   â”œâ”€â”€ dto/ApplicationDto.java
â”‚   â”œâ”€â”€ repository/ApplicationRepository.java
â”‚   â””â”€â”€ service/ApplicationService.java
â”œâ”€â”€ auth/                                        # SÃ©curitÃ©, JWT & Authentification
â”‚   â”œâ”€â”€ controller/AuthController.java
â”‚   â”œâ”€â”€ dto/ (LoginRequest, RegisterRequest, GoogleAuthRequest, VerifyEmailRequest, etc.)
â”‚   â”œâ”€â”€ filter/JwtAuthenticationFilter.java      # Validation JWT via cookie HttpOnly
â”‚   â”œâ”€â”€ filter/RateLimitFilter.java              # Limiteur en mÃ©moire avec purge horaire @Scheduled
â”‚   â””â”€â”€ service/ (AuthService, JwtService, CandidateUserDetailsService, AuthEmailService)
â”œâ”€â”€ candidate/                                   # Gestion profils et paramÃ¨tres candidats
â”‚   â”œâ”€â”€ controller/CandidateProfileController.java
â”‚   â”œâ”€â”€ domain/CandidateEntity.java, CandidateProfileEntity.java
â”‚   â”œâ”€â”€ dto/CandidateProfileDto.java
â”‚   â”œâ”€â”€ repository/CandidateRepository.java, CandidateProfileRepository.java
â”‚   â””â”€â”€ service/CandidateProfileService.java
â”œâ”€â”€ common/
â”‚   â””â”€â”€ exception/GlobalExceptionHandler.java     # RFC 7807 ProblemDetail unifiÃ©
â”œâ”€â”€ config/                                      # Configurations Spring
â”‚   â”œâ”€â”€ AsyncConfig.java                         # Pool mailTaskExecutor dÃ©diÃ©
â”‚   â”œâ”€â”€ CorsConfig.java                          # CORS strict avec credentials
â”‚   â”œâ”€â”€ DataInitializer.java                    # Initialisation des rÃ´les et modÃ¨les
â”‚   â”œâ”€â”€ FlywayConfig.java                        # Migration automatique Flyway
â”‚   â”œâ”€â”€ RestTemplateConfig.java                  # Pool HTTP client, timeouts (3s connect / 10s read)
â”‚   â””â”€â”€ SecurityConfig.java                      # Spring Security 6 stateless
â”œâ”€â”€ cv/                                          # Module CV, Ã‰dition, Validation & Export
â”‚   â”œâ”€â”€ controller/CvController.java
â”‚   â”œâ”€â”€ domain/CvEntity.java, CvTemplateEntity.java
â”‚   â”œâ”€â”€ dto/CvDto.java
â”‚   â”œâ”€â”€ repository/CvRepository.java, CvTemplateRepository.java
â”‚   â””â”€â”€ service/
â”‚       â”œâ”€â”€ CvAiOperationsService.java           # OpÃ©rations IA texte/multimodal
â”‚       â”œâ”€â”€ CvDraftValidator.java                # RÃ¨gles et plafonds dÃ©fensifs du brouillon
â”‚       â”œâ”€â”€ CvPdfExportService.java              # Headless Chromium, sÃ©maphore, tokens Ã©phÃ©mÃ¨res
â”‚       â””â”€â”€ CvService.java                       # Orchestration complÃ¨te du cycle de vie CV
â”œâ”€â”€ joboffer/                                    # Catalogue des offres d'emploi
â”‚   â”œâ”€â”€ domain/JobOfferEntity.java
â”‚   â””â”€â”€ repository/JobOfferRepository.java
â”œâ”€â”€ opportunity/                                 # Matching dynamique & Lettres IA
â”‚   â”œâ”€â”€ controller/OpportunityController.java
â”‚   â”œâ”€â”€ domain/ (ApplicationChannel, OpportunityStatus)
â”‚   â”œâ”€â”€ dto/ (OpportunityDto, ActionResponseDto)
â”‚   â””â”€â”€ service/OpportunityService.java          # Algorithme 45-95% & rÃ©daction Gemini 2.0 Flash
â”œâ”€â”€ payment/                                     # Passerelle NotchPay, RÃ©silience & CrÃ©dits Pro
â”‚   â”œâ”€â”€ client/NotchPayClient.java               # Client HTTP NotchPay avec retries et timeouts
â”‚   â”œâ”€â”€ controller/PaymentController.java        # Endpoints checkout, webhooks, fallback WhatsApp
â”‚   â”œâ”€â”€ domain/ (PaymentTransactionEntity, CvUnlockEntity, NotchPayWebhookEventEntity)
â”‚   â”œâ”€â”€ dto/ (InitiatePaymentRequestDto, InitiatePaymentResponseDto, CvUnlockStatusDto, etc.)
â”‚   â”œâ”€â”€ repository/ (PaymentTransactionRepository, CvUnlockRepository, NotchPayWebhookEventRepository)
â”‚   â”œâ”€â”€ resilience/NotchPayCircuitBreaker.java   # Circuit breaker autonome (Ã©tat CLOSED, OPEN, HALF_OPEN)
â”‚   â””â”€â”€ service/PaymentService.java              # VÃ©rification HMAC, double vÃ©rification GET, crÃ©dits pro
â””â”€â”€ realtime/
    â””â”€â”€ controller/RealtimeVoiceController.java  # Point d'initialisation session vocale
```

### 3.2. FonctionnalitÃ©s & Garanties ClÃ©s du Backend
- **Ã‰radication IDOR (*Insecure Direct Object References*)** :
  - Tout accÃ¨s Ã  un CV, une candidature ou une transaction extrait le candidat connectÃ© via `SecurityContextHolder`.
  - Pas d'argument `candidateId` manipulable en query param.
- **RÃ©silience NotchPay & Circuit Breaker** :
  - Timeouts : Connect 3s, Read 5s.
  - Retry exponentiel (2-3 tentatives) exclusivement sur erreurs transitoires (timeouts, HTTP 5xx). ZÃ©ro retry sur 4xx.
  - Bascule en `OPEN` aprÃ¨s 3 Ã©checs consÃ©cutifs, redirigeant instantanÃ©ment vers le fallback WhatsApp.
- **SÃ©curitÃ© Webhook NotchPay** :
  - Signature `X-Notch-Signature` HMAC-SHA256 validÃ©e sur le corps brut (*raw body*).
  - Table Flyway V10 `notchpay_webhook_event` garantissant l'idempotence des `evt_...`.
  - Double vÃ©rification API sortante obligatoire : `GET https://api.notchpay.co/payments/{reference}`.
- **Validation DÃ©fensive du Brouillon (`CvDraftValidator`)** :
  - Plafonds : 20 expÃ©riences max, 50 compÃ©tences max, 10 formations max, rÃ©sumÃ© < 2000 caractÃ¨res.
  - Nettoyage des formes juridiques (`SARL`, `Inc`, etc.).
- **Scoring Dynamique RÃ©el des Offres (45% Ã  95%)** :
  - BasÃ© sur la comparaison rÃ©elle des compÃ©tences et intitulÃ©s du profil du candidat avec l'offre.
  - Justification textuelle dynamique dans `decisionReason`.
- **GÃ©nÃ©ration RÃ©elle de Lettres de Motivation (Gemini 2.0 Flash)** :
  - PersistÃ©e dans la table `application` (`cover_letter_text LONGTEXT`, Migration Flyway V9).
- **Protection des Quotas & Reprise de Session** :
  - 3 sessions vocales complÃ¨tes par jour et par candidat.
  - DÃ©tection de session active (`isResumingActiveSession`) Ã©vitant tout double dÃ©compte en cas de reconnexion aprÃ¨s coupure rÃ©seau.
  - Import OCR accessible aux comptes possÃ©dant â‰¥ 2 crÃ©dits Pro (sans dÃ©bit lors de l'import).

---

## ðŸ…°ï¸ 4. Architecture Frontend (Angular 18 / Tailwind CSS)

### 4.1. Principes d'IngÃ©nierie Frontend
- **100% Standalone Components & Signals** : Utilisation exclusive de l'API moderne Angular 18 (`signal()`, `computed()`, `inject()`).
- **ConformitÃ© Mobile-First Stricte** :
  - Respect scrupuleux de [`MOBILE_FIRST_STANDARDS.md`](file:///D:/automatisation/code/MOBILE_FIRST_STANDARDS.md) : aucun dÃ©bordement horizontal (`overflow-x`), conteneurs avec `min-w-0` et `truncate`/`break-words`.
  - Dual layout obligatoire sur les tableaux : vue cartes fluides sur mobile (`block md:hidden`), tableau complet sur desktop (`hidden md:block`).
  - Topbar Ã©purÃ©e, boutons d'actions tactiles confortables (â‰¥ 36px).

### 4.2. Arborescence du Frontend
```text
dashboard/src/app/
â”œâ”€â”€ app.routes.ts                                # Table de routage avec Landing en route racine ('')
â”œâ”€â”€ core/
â”‚   â”œâ”€â”€ guards/auth.guard.ts                     # Protection des routes authentifiÃ©es
â”‚   â”œâ”€â”€ interceptors/auth.interceptor.ts         # withCredentials: true sur toutes les requÃªtes
â”‚   â”œâ”€â”€ models/ (auth, cv, opportunity, application, payment)
â”‚   â”œâ”€â”€ prompts/cv-interview/                    # Prompts modulaires pour l'entretien vocal
â”‚   â”‚   â”œâ”€â”€ draft-tool-rules.prompt.ts           # RÃ¨gles de mise Ã  jour du brouillon
â”‚   â”‚   â”œâ”€â”€ identity-and-guardrails.prompt.ts    # IdentitÃ©, bienveillance et limites
â”‚   â”‚   â”œâ”€â”€ interview-algorithm.prompt.ts        # Algorithme en 5 Ã©tapes et dÃ©clenchement d'audit
â”‚   â”‚   â”œâ”€â”€ recruiter-persona.prompt.ts          # Persona Bray (recruteur expert)
â”‚   â”‚   â””â”€â”€ index.ts                             # Assemblage du System Prompt
â”‚   â”œâ”€â”€ services/
â”‚   â”‚   â”œâ”€â”€ audio-pcm-engine.service.ts          # Worklet micro 16kHz & restitution 24kHz
â”‚   â”‚   â”œâ”€â”€ auth.service.ts                      # Gestion d'Ã©tat d'authentification
â”‚   â”‚   â”œâ”€â”€ candidate-profile-api.service.ts     # Communication profil candidat avec backend
â”‚   â”‚   â”œâ”€â”€ cv-api.service.ts                    # CRUD des CVs
â”‚   â”‚   â”œâ”€â”€ cv-audit-engine.service.ts           # Moteur d'audit dÃ©terministe audit_cv_integrity
â”‚   â”‚   â”œâ”€â”€ cv-editor.service.ts                 # Ã‰tat rÃ©actif du CV et auto-sauvegarde
â”‚   â”‚   â”œâ”€â”€ cv-interview-api.service.ts          # RÃ©servation de sessions vocales
â”‚   â”‚   â”œâ”€â”€ gemini-live-ws-client.service.ts     # Client WebSocket audio Gemini 3.1 Live
â”‚   â”‚   â”œâ”€â”€ interview-session-cache.service.ts   # Cache local de rÃ©silience (10 min) aprÃ¨s dÃ©connexion
â”‚   â”‚   â”œâ”€â”€ opportunity-api.service.ts           # Offres d'emploi & lettres IA
â”‚   â”‚   â”œâ”€â”€ payment.service.ts                   # Tunnel NotchPay, crÃ©dits pro & fallback WhatsApp
â”‚   â”‚   â””â”€â”€ pdf-export.service.ts                # Rendu PDF client avec filigrane sÃ©curisÃ©
â”‚   â””â”€â”€ utils/ui-mapping.ts                      # Traduction des statuts techniques en franÃ§ais
â”œâ”€â”€ features/
â”‚   â”œâ”€â”€ landing/                                 # Page d'accueil Ã©ditoriale (style Anthropic)
â”‚   â”‚   â”œâ”€â”€ landing.component.ts                 # Canvas dÃ©gradÃ© ambiant organique 60 FPS
â”‚   â”‚   â”œâ”€â”€ landing.component.html               # 4 Ã©tapes, connecteurs SVG "corde molle", mÃ©tiers
â”‚   â”‚   â””â”€â”€ landing.component.css                # Teintes ivoire #FAF9F5, Newsreader serif
â”‚   â”œâ”€â”€ auth/auth.component.ts                   # Connexion, Inscription, Reset MDP, Google Sign-In
â”‚   â”œâ”€â”€ dashboard/pages/dashboard-home/          # KPIs dynamiques, opportunitÃ©s prioritaires
â”‚   â”œâ”€â”€ opportunities/pages/                     # Liste d'offres et vue dÃ©taillÃ©e avec lettre IA
â”‚   â”œâ”€â”€ applications/pages/application-list/     # Suivi candidatures (Kanban & Liste)
â”‚   â”œâ”€â”€ cvs/pages/
â”‚   â”‚   â”œâ”€â”€ cv-list/                             # Galerie des CVs, pastilles crÃ©dits, bouton import
â”‚   â”‚   â”œâ”€â”€ cv-interview/                        # Orbe vocal rÃ©actif, transcription, score d'audit live
â”‚   â”‚   â””â”€â”€ cv-print/                            # Rendu A4 Ã©purÃ© pour Chromium headless
â”‚   â”œâ”€â”€ cv-builder/pages/cv-builder-main/        # Galerie Word, Ã©diteur split-screen, chat IA
â”‚   â”œâ”€â”€ profile/pages/profile-main/              # Profil candidat & barre de complÃ©tion
â”‚   â”œâ”€â”€ settings/pages/settings-main/            # ParamÃ¨tres du compte et compte pro
â”‚   â”œâ”€â”€ documents/documents.component.ts         # Historique des fichiers gÃ©nÃ©rÃ©s
â”‚   â””â”€â”€ activity/activity.component.ts           # Timeline d'activitÃ© chronologique
â”œâ”€â”€ layout/
â”‚   â”œâ”€â”€ app-shell/                               # Coquille principale responsive
â”‚   â”œâ”€â”€ sidebar/                                 # Navigation latÃ©rale claire avec statut
â”‚   â””â”€â”€ topbar/                                  # En-tÃªte Ã©purÃ© avec solde crÃ©dits pro et profil
â””â”€â”€ shared/components/
    â”œâ”€â”€ button/, card/, status-badge/, score-badge/, modal/, pagination/, feedback/
    â”œâ”€â”€ agent-pack-modal/                        # Modale de recharge des crÃ©dits pour comptes pro
    â”œâ”€â”€ payment-modal/                           # Modale de paiement NotchPay & fallback WhatsApp
    â”œâ”€â”€ cv-preview/                              # PrÃ©visualisation A4 multipages physique
    â”œâ”€â”€ cv-thumbnail/                            # Vignettes vectorielles des templates
    â””â”€â”€ cv-templates/                            # Composants de rendu des templates Word/ATS
```

### 4.3. Design System V2 & Tokens Visuels
- **Palette** :
  - `brand-navy` (950: `#071A2F`, 900: `#0B223D`, 800: `#12345A`, 700: `#194574`, 100: `#DCE4F0`, 50: `#EEF2F8`)
  - `brand-orange` (700: `#C2410C`, 600: `#EA580C`, 500: `#F97316`, 400: `#FB923C`, 100: `#FFEDD5`, 50: `#FFF7ED`)
  - `surface` (page: `#F6F8FB`, card: `#FFFFFF`, soft: `#F0F4F8`, preview: `#E8EDF3`)
  - `text` (primary: `#102033`, secondary: `#5D6B7A`, muted: `#5F6E7D`)
- **Motifs CSS lÃ©gers** : `.pattern-dot-grid`, `.pattern-orange-glow`, `.pattern-navy-grid`.
- **RÃ¨gles Typographiques** : Remplacement systÃ©matique de tous les textes clairs sur fonds clairs par des ratios de contraste WCAG AA â‰¥ 4.5:1.

---

## ðŸ¤– 5. Intelligence Artificielle, Audio Temps RÃ©el & Prompts

### 5.1. Audio Gemini 3.8 Live (`gemini-3.8-live`)
- **Microphone (Entrant)** : Audio capture `AudioContext` Ã  `16 000 Hz`, encodÃ© en PCM 16-bit linÃ©aire mono via `AudioWorklet`.
- **SynthÃ¨se Vocale (Sortant)** : Audio reÃ§u en PCM 16-bit Ã  `24 000 Hz`, dÃ©codÃ© et chaÃ®nÃ© sans coupure (*gapless playback*).
- **Sas Acoustique Anti-Larsen** : Coupure micro automatique pendant la parole de l'IA (`state === 'AI_SPEAKING'`) avec cooldown de 400 ms.
- **Buffer de Transcription Ligne par Ligne** : Regroupement des fragments audio de transcription dans `lineBuffers` avec dÃ©coupage sur ponctuation (`.`, `?`, `!`, `\n`) pour un affichage textuel stable et fluide.

### 5.2. Architecture DÃ©couplÃ©e Chat Vocal V2 (production â€” octobre 2026)
L'architecture cible Ã©limine la surcharge cognitive de Gemini Live en dissociant 4 responsabilitÃ©s distinctes :
1. **Gemini Live (Moteur Vocal)** :
   - CentrÃ© Ã  100% sur la voix naturelle, l'Ã©coute, le ton chaleureux et fraternel (persona *Bray*).
   - Ne maintient aucun schÃ©ma JSON complexe en direct et n'a plus la responsabilitÃ© de clore l'entretien de faÃ§on autonome.
   - Unique outil de fonction exposÃ© : `request_end_interview` (appelÃ© uniquement si le candidat demande explicitement Ã  arrÃªter).
2. **State Machine DÃ©terministe Backend (`InterviewStateMachineService`)** :
   - Ordonnancement strict des 10 Ã©tapes : `IDENTITY` âž” `TARGET` âž” `EXPERIENCE` âž” `PROJECTS` âž” `EDUCATION` âž” `SKILLS` âž” `LANGUAGES` âž” `FINALIZE` âž” `REVIEW` âž” `DONE`.
   - Plafonds de tours par section (`max_turns`) et validation d'arrÃªt : refuse toute conclusion prÃ©maturÃ©e sur de simples expressions d'enchaÃ®nement (Â« *je n'ai pas de projet* Â», Â« *c'est tout pour cette partie* Â»).
3. **Observateur / Extracteur Asynchrone (`InterviewObserverService`)** :
   - OpÃ¨re en tÃ¢che de fond sur les transcriptions textuelles via le modÃ¨le REST configurÃ© (`gemini-3.5-flash-lite`).
   - DÃ©duit les informations factuelles sans perturber la latence audio et injecte des consignes de guidage contextuelles `[INTERVIEW_STATE]`.
4. **Consolidation CV (`CvWriterService`)** :
   - Fusionne les donnÃ©es validÃ©es dans `CvData` pour prÃ©visualisation temps rÃ©el et sauvegarde en base.

### 5.3. Cycle de Vie, MonÃ©tisation & RÃ©silience des CrÃ©dits
- **Consultation Libre & Ã‰tat Initial `IDLE`** : L'accÃ¨s Ã  l'interface d'entretien vocal (`/cvs/interview`) n'effectue aucun appel de rÃ©servation ni aucun prÃ©lÃ¨vement de crÃ©dit. L'utilisateur dÃ©couvre l'environnement et configure son audio sans coÃ»t.
- **DÃ©bit Atomique sur Action Explicite (`startInterviewFlow()`)** : Le dÃ©bit d'1 crÃ©dit Pro et la crÃ©ation de session backend (`POST /api/v1/cvs/{id}/interview/session`) ne sont dÃ©clenchÃ©s **que** sur validation dÃ©libÃ©rÃ©e (Â« Commencer l'entretien Â») via `decrementProCreditIfAvailable()`.
- **Reprise Gratuite SÃ©curisÃ©e (< 15 min)** : Toute reconnexion ou rafraÃ®chissement d'un CV en cours (y compris avec identifiant `'new'` ou `'cv_default'`) rÃ©active la session active sans prÃ©lever de crÃ©dit supplÃ©mentaire.
- **Garantie de Remboursement Automatique (`refundAbortedInterviewSession`)** :
   - Si la session vocale est interrompue techniquement (fermeture anormale, erreur micro, abandon avant usage signifiant), le crÃ©dit Pro est immÃ©diatement rÃ©crÃ©ditÃ© en base, le quota d'interviews dÃ©crÃ©mentÃ©, et le statut positionnÃ© Ã  `ABORTED`.
- **BanniÃ¨re d'Ã‰puisement Mobile-First Ã‰purÃ©e** : Remplacement de l'alerte surdimensionnÃ©e par une carte discrÃ¨te, aux couleurs de la marque (`brand-navy` / `brand-orange`), sans aucun conflit de contraste, guidant vers l'acquisition de crÃ©dits.


---

## ðŸ—„ï¸ 6. SchÃ©ma de DonnÃ©es & Persistance (MySQL / Flyway V1 -> V10)

```mermaid
erDiagram
    CANDIDATES ||--o| CANDIDATE_PROFILES : "a pour profil"
    CANDIDATES ||--o{ CVS : "possÃ¨de"
    CANDIDATES ||--o{ APPLICATIONS : "postule via"
    CANDIDATES ||--o{ PAYMENT_TRANSACTIONS : "rÃ¨gle via"
    CANDIDATES ||--o{ CV_UNLOCKS : "dÃ©verrouille"
    JOB_OFFERS ||--o{ APPLICATIONS : "reÃ§oit"
    CV_TEMPLATES ||--o{ CVS : "style"
    CVS ||--o{ PAYMENT_TRANSACTIONS : "concerne"
    CVS ||--o{ CV_UNLOCKS : "est dÃ©verrouillÃ© par"

    CANDIDATES {
        int id PK
        varchar full_name
        varchar email UK
        varchar password_hash
        varchar role
        boolean enabled
        varchar verification_code
        timestamp verification_expires_at
        varchar reset_password_code
        timestamp reset_password_expires_at
        int ai_interviews_used
        date ai_interviews_reset_date
        int pro_credits
        boolean is_pro_agent
        varchar pro_shop_name
        timestamp created_at
    }

    CANDIDATE_PROFILES {
        int id PK
        int candidate_id FK
        text raw_data
        boolean cv_generated
        timestamp updated_at
    }

    CVS {
        bigint id PK
        int candidate_id FK
        bigint template_id FK
        varchar title
        varchar status
        varchar interview_status
        longtext content_json
        timestamp created_at
        timestamp updated_at
    }

    PAYMENT_TRANSACTIONS {
        bigint id PK
        int candidate_id FK
        bigint cv_id FK
        varchar reference UK
        varchar gateway
        varchar provider
        varchar operator
        varchar phone_number
        int amount_fcfa
        varchar status
        varchar payment_type
        timestamp created_at
        timestamp completed_at
    }

    CV_UNLOCKS {
        bigint id PK
        int candidate_id FK
        bigint cv_id FK
        varchar unlock_type
        bigint payment_transaction_id FK
        timestamp unlocked_at
    }

    NOTCHPAY_WEBHOOK_EVENTS {
        bigint id PK
        varchar event_id UK
        varchar event_type
        varchar reference
        timestamp received_at
    }

    APPLICATIONS {
        int id PK
        int candidate_id FK
        int job_offer_id FK
        varchar status
        int score
        varchar decision_reason
        varchar application_channel
        longtext cover_letter_text
        timestamp applied_at
        timestamp last_activity_at
    }
```

### 6.1. RÃ©fÃ©rentiel des Migrations Flyway
- **V1 - V7** : SchÃ©ma initial, authentification, quotas, vÃ©rification email, index de performance.
- **V8** (`V8__create_payment_and_pro_credit_tables.sql`) : Table `payment_transactions`, `cv_unlocks`, colonnes `pro_credits` et `is_pro_agent`.
- **V9** (`V9__add_cover_letter_text_to_application.sql`) : Colonne `cover_letter_text LONGTEXT` pour les lettres de motivation rÃ©digÃ©es par Gemini 2.0 Flash.
- **V10** (`V10__notchpay_integration_and_webhook_events.sql`) : Ã‰largissement du statut transaction Ã  `VARCHAR(32)` (`FALLBACK_WHATSAPP`), ajout de `gateway` (`NOTCHPAY`), et crÃ©ation de la table d'idempotence `notchpay_webhook_event`.
- **V11** (`V11__add_city_and_target_role_to_candidate.sql`) : Ajout des colonnes `city` (`VARCHAR(100)`) et `target_role` (`VARCHAR(150)`) sur la table `candidate`.
- **V12** (`V12__grant_initial_free_credit_to_candidates.sql`) : Passage de la valeur par dÃ©faut de `candidate.pro_credits` Ã  `1` et attribution rÃ©troactive d'1 crÃ©dit de bienvenue aux candidats Ã  solde nul sans achat prÃ©alable.
- **V13** (`V13__create_cv_interview_session.sql`) : CrÃ©ation de la table `cv_interview_session` dÃ©diÃ©e Ã  l'orchestration V2 (Ã©tat State Machine, section index, tours, transcriptions partielles/totales JSON, snapshot `cv_data_so_far`).
- **V14** (`V14__restore_aborted_interview_credits.sql`) : Nettoyage des sessions orphelines `IN_PROGRESS` (> 1h) vers `ABORTED` et restitution d'1 crÃ©dit de rÃ©gularisation pour les sessions interrompues.

---

## ðŸ“¡ 7. RÃ©fÃ©rentiel Complet des Endpoints REST & Contrats

### 7.1. Authentification & Compte (`/api/v1/auth`)
| MÃ©thode | Route | SÃ©curitÃ© | Description & Payload |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Public | Inscription : `{ fullName, email, password }` â†’ envoi email code 6 chiffres |
| `POST` | `/api/v1/auth/verify-email` | Public | Validation email : `{ email, code }` â†’ pose cookie JWT `jwt_token` |
| `POST` | `/api/v1/auth/resend-verification` | Public | Renvoi d'un nouveau code : `{ email }` |
| `POST` | `/api/v1/auth/login` | Public | Connexion : `{ email, password }` â†’ pose cookie JWT `jwt_token` |
| `POST` | `/api/v1/auth/google` | Public | Google Sign-In cryptographiquement validÃ© avec fallback `tokeninfo` : `{ credential }` |
| `POST` | `/api/v1/auth/forgot-password` | Public | Demande reset : `{ email }` â†’ code par email |
| `POST` | `/api/v1/auth/reset-password` | Public | RÃ©initialisation : `{ email, token, newPassword }` |
| `POST` | `/api/v1/auth/logout` | Public | DÃ©connexion : suppression serveur du cookie `jwt_token` et purge cache local |
| `GET` | `/api/v1/auth/me` | AuthentifiÃ© | Profil courant : retourne `AuthResponse` connectÃ© (solde crÃ©dits synchronisÃ©) |

### 7.2. Profil Candidat (`/api/v1/candidate/profile`)
| MÃ©thode | Route | SÃ©curitÃ© | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/candidate/profile` | AuthentifiÃ© | RÃ©cupÃ¨re le profil complet du candidat connectÃ© |
| `PUT` | `/api/v1/candidate/profile` | AuthentifiÃ© | Met Ã  jour le profil (titre, bio, compÃ©tences, coordonnÃ©es) |

### 7.3. Gestion des CVs, IA & Export PDF (`/api/v1/cvs`)
| MÃ©thode | Route | SÃ©curitÃ© | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/cvs` | AuthentifiÃ© | Liste paginÃ©e des CVs du candidat (`?page=0&size=10`) |
| `GET` | `/api/v1/cvs/{id}` | AuthentifiÃ© | DÃ©tail d'un CV spÃ©cifique (Anti-IDOR) |
| `POST` | `/api/v1/cvs` | AuthentifiÃ© | CrÃ©ation d'un CV : `{ title, template, contentJson? }` |
| `DELETE` | `/api/v1/cvs/{id}` | AuthentifiÃ© | Suppression d'un CV appartenant au candidat |
| `GET` | `/api/v1/cv-templates` | Public | Liste des modÃ¨les de CV actifs disponibles |
| `POST` | `/api/v1/cvs/{id}/interview/session` | AuthentifiÃ© | DÃ©marre la session vocale Gemini 3.1 Live & rÃ©serve le token Ã©phÃ©mÃ¨re (dÃ©bit atomique 1 crÃ©dit) |
| `POST` | `/api/v1/cvs/{id}/interview/refund` | AuthentifiÃ© | Restitution immÃ©diate d'1 crÃ©dit Pro en cas d'interruption technique ou fermeture anormale |
| `POST` | `/api/v1/cvs/{id}/interview/v2/session` | AuthentifiÃ© | Initialise ou reprend une session d'orchestration vocale V2 persistante |
| `POST` | `/api/v1/cvs/{id}/interview/v2/turn` | AuthentifiÃ© | Synchronise un tour de parole utilisateur/IA et injecte le bloc de guidage `[INTERVIEW_STATE]` |
| `POST` | `/api/v1/cvs/{id}/interview/v2/request-end` | AuthentifiÃ© | Validation stricte et dÃ©terministe de la demande d'arrÃªt utilisateur anticipÃ©e |
| `PUT` | `/api/v1/cvs/{id}/draft` | AuthentifiÃ© | Mise Ã  jour du brouillon JSON (validÃ© par `CvDraftValidator`) |
| `POST` | `/api/v1/cvs/{id}/interview/complete` | AuthentifiÃ© | Finalise l'entretien vocal et synchronise le profil |
| `POST` | `/api/v1/cvs/{id}/synthesize` | AuthentifiÃ© | SynthÃ¨se IA complÃ¨te Ã  partir d'une transcription textuelle |
| `POST` | `/api/v1/cvs/{id}/ai-edit` | AuthentifiÃ© | AmÃ©lioration ciblÃ©e du CV par prompt IA (1 crÃ©dit Pro) : `{ prompt, currentData? }` |
| `POST` | `/api/v1/cvs/import` | AuthentifiÃ© | Import multimodal OCR (contrÃ´le `proCredits >= 2`, 0 dÃ©bit) |
| `POST` | `/api/v1/cvs/{id}/download-ticket` | AuthentifiÃ© | GÃ©nÃ¨re un ticket temporaire (TTL 300s) pour tÃ©lÃ©chargement direct |
| `GET` | `/api/v1/cvs/{id}/download` | Public (Ticket) | TÃ©lÃ©chargement PDF Chromium sans cookie via ticket Ã©phÃ©mÃ¨re |
| `GET` | `/api/v1/cvs/{id}/pdf` | AuthentifiÃ© | Export PDF Chromium direct avec cookie de session |
| `GET` | `/api/v1/cvs/{id}/print-data` | Interne (Token) | Fournit les donnÃ©es CV au Chromium headless via token d'impression (TTL 60s) |

### 7.4. OpportunitÃ©s & Candidatures (`/api/v1/opportunities`, `/api/v1/applications`)
| MÃ©thode | Route | SÃ©curitÃ© | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/opportunities` | AuthentifiÃ© | Liste paginÃ©e avec matching algorithmique rÃ©el (45-95%) |
| `GET` | `/api/v1/opportunities/{id}` | AuthentifiÃ© | DÃ©tail complet d'une offre avec justification du score |
| `POST` | `/api/v1/opportunities/{id}/dismiss` | AuthentifiÃ© | Ignore et masque l'offre pour le candidat |
| `POST` | `/api/v1/opportunities/{id}/prepare` | AuthentifiÃ© | GÃ©nÃ¨re la lettre de motivation personnalisÃ©e via Gemini 2.0 Flash |
| `GET` | `/api/v1/opportunities/{id}/cover-letter` | AuthentifiÃ© | RÃ©cupÃ¨re la lettre gÃ©nÃ©rÃ©e (`{ content }`) |
| `POST` | `/api/v1/opportunities/{id}/apply` | AuthentifiÃ© | Marque l'opportunitÃ© comme postulÃ©e (`applied`) |
| `GET` | `/api/v1/applications` | AuthentifiÃ© | Liste des candidatures (Kanban / Liste) |
| `GET` | `/api/v1/applications/{id}` | AuthentifiÃ© | Fiche dÃ©taillÃ©e d'une candidature avec lettre associÃ©e |

### 7.5. Passerelle NotchPay, Webhook & Comptes Pro (`/api/v1/payments`)
| MÃ©thode | Route | SÃ©curitÃ© | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/payments/initiate` | AuthentifiÃ© | Initie un paiement NotchPay avec rÃ©silience. Renvoie `{ checkoutUrl, reference }` ou `{ fallbackWhatsApp: true, whatsAppUrl }` |
| `POST` | `/webhooks/notchpay` ou `/api/v1/payments/webhooks/notchpay` | Public (HMAC) | Webhook officiel NotchPay : signature HMAC-SHA256 sur corps brut, idempotence (`evt_...`), double vÃ©rification sortante GET |
| `POST` | `/api/v1/payments/fallback-whatsapp/{reference}` | AuthentifiÃ© | Enregistre le basculement d'une commande vers WhatsApp (`FALLBACK_WHATSAPP`) |
| `GET` | `/api/v1/payments/status/{reference}` | AuthentifiÃ© | Consultation du statut rÃ©el d'une transaction de paiement |
| `GET` | `/api/v1/payments/unlocked-cvs` | AuthentifiÃ© | Liste des IDs de CVs dÃ©verrouillÃ©s pour le candidat |
| `GET` | `/api/v1/payments/cvs/{cvId}/status` | AuthentifiÃ© | VÃ©rifie si un CV spÃ©cifique est dÃ©verrouillÃ© en HD |
| `POST` | `/api/v1/payments/use-pro-credit` | AuthentifiÃ© | DÃ©duit 1 crÃ©dit pro pour dÃ©verrouiller un CV |
| `GET` | `/api/v1/payments/pro-status` | AuthentifiÃ© | Ã‰tat du compte pro (solde de crÃ©dits, total dÃ©verrouillÃ©s, Ã©tablissement) |
| `PUT` | `/api/v1/payments/pro-shop` | AuthentifiÃ© | Met Ã  jour le nom de l'Ã©tablissement cybercafÃ© / secrÃ©tariat |

---

## ðŸŽ¨ 8. Catalogue des ModÃ¨les de CV (Microsoft Word & ATS)

| Code ModÃ¨le | Nom Commercial | Accent Couleur | Structure & Typographie | Cible MÃ©tier |
| :--- | :--- | :--- | :--- | :--- |
| `word-bloc` | **CV Bloc de couleur** | `#243b53` (Ardoise) | En-tÃªte ardoise + 2 colonnes Ã©quilibrÃ©es | Tech, Chefs de Projet, Design |
| `word-soigne` | **CV SoignÃ© & Ã‰nergique** | `#dc2626` (Rouge vif) | Monogramme rond + timeline rouge | Direction, Management, Vente |
| `word-violet` | **CV CrÃ©atif Magenta** | `#6b21a8` (Pourpre) | Sidebar violette + avatar & compÃ©tences | UI/UX, MÃ©dias, Communication |
| `word-cadre` | **CV Cadre & Conseil** | `#d97706` (DorÃ© ambrÃ©) | Double encadrement raffinÃ© et filets dorÃ©s | Conseil, Audit, Finance |
| `word-navy` | **CV Bleu Nuit ExÃ©cutif** | `#1e3a8a` (Bleu marine) | Bandeau sombre supÃ©rieur + monogramme | Directeurs, IngÃ©nieurs, PMO |
| `word-minimal` | **CV Minimaliste Filets** | `#1e293b` (Anthracite) | En-tÃªte centrÃ© Ã©purÃ© avec double filet | Juridique, RH, Administration |
| `word-peyton` | **CV Typographique Bleu** | `#2563eb` (Bleu roi) | Titres stylisÃ©s majuscules + lecture fluide | Marketing, Vente B2B |
| `word-sidebar` | **CV Moderne en colonnes** | `#0284c7` (Bleu ciel) | Colonne latÃ©rale grise avec timeline | DÃ©veloppeurs, SystÃ¨mes/RÃ©seaux |
| `word-ats` | **CV Classique ATS** | `#000000` (Noir pur) | 100% textuel sans colonnes, optimisÃ© parseurs | Banques, Grandes Administrations |

---

## ðŸ”’ 9. SÃ©curitÃ©, Multi-Tenancy & ConformitÃ© OWASP

1. **Isolation stricte Multi-Tenancy (Anti-IDOR)** :
   - Tous les modÃ¨les de donnÃ©es (CV, Candidature, Paiement, DÃ©verrouillage) sont indexÃ©s et filtrÃ©s par le `candidate_id` rÃ©solu dans le token JWT.
2. **Cookies `HttpOnly` & `SameSite`** :
   - Le jeton JWT est inaccessible depuis le script client (`document.cookie`), Ã©liminant le risque de vol par XSS.
3. **SÃ©curisation Google Sign-In** :
   - Validation cryptographique stricte par `GoogleIdTokenVerifier` avec contrÃ´le de l'audience `client_id`.
4. **Hachage BCrypt (Facteur 12)** :
   - Stockage sÃ©curisÃ© des mots de passe.
5. **IntÃ©gritÃ© Cryptographique des Paiements (NotchPay)** :
   - Validation de signature HMAC-SHA256 sur corps brut.
   - Idempotence absolue par `notchpay_webhook_event`.
   - Double vÃ©rification systÃ©matique `GET /payments/{reference}` avant tout dÃ©verrouillage de ressource.
6. **Export PDF 100% Gratuit & Protection Anti-IDOR** :
   - L'exportation PDF est entiÃ¨rement gratuite et sans aucune contrainte de facturation ou de dÃ©verrouillage prÃ©alable.
   - AccÃ¨s au PDF HD serveur protÃ©gÃ© par vÃ©rification de propriÃ©tÃ© du compte (Anti-IDOR) et jetons d'impression Ã©phÃ©mÃ¨res.

---

## ðŸ“‹ 10. Audit de PrÃ©paration Production & DÃ©cisions ClÃ©s

*(SynthÃ¨se exhaustive de l'audit de prÃ©paration pour le dÃ©ploiement pilote ~50 utilisateurs)*

### âœ… P0 : SÃ©curitÃ© & Bloquants Critiques â€” 100% RÃ‰SOLU & VÃ‰RIFIÃ‰
| Point de SÃ©curitÃ© | Statut | ImplÃ©mentation |
| :--- | :--- | :--- |
| Validation cryptographique Google Sign-In | **RÃ©solu** | `GoogleIdTokenVerifier` avec contrÃ´le strict d'audience |
| Ã‰radication des fallbacks `candidateId=1` & IDOR | **RÃ©solu** | RÃ©solution systÃ©matique via `SecurityContextHolder` / JWT |
| Gestion des erreurs standardisÃ©e (RFC 7807) | **RÃ©solu** | `GlobalExceptionHandler` configurÃ© (400, 403, 404, 409, 429) |
| Externalisation des secrets & `.gitignore` | **RÃ©solu** | Fichiers `.env`, `.env.example`, `.gitignore` racine et backend Ã©tanches |
| Passerelle NotchPay & Fallback WhatsApp | **RÃ©solu** | API programmatique, webhook HMAC, idempotence, double vÃ©rification GET, circuit breaker et repli WhatsApp assistÃ© |
| Export PDF gratuit & protection Anti-IDOR | **RÃ©solu** | Export PDF 100% gratuit sans contrainte, contrÃ´le strict de propriÃ©tÃ© du CV (Anti-IDOR) |

### âš ï¸ P1 : ScalabilitÃ© & FiabilitÃ© â€” 100% RÃ‰SOLU
| Point de ScalabilitÃ© | DÃ©cision | ImplÃ©mentation |
| :--- | :--- | :--- |
| Pagination `/opportunities` & `/applications` | **Garder** | Spring Data Pageable + suppression de l'injection massive Ã  la lecture |
| Rate Limiting Auth & IA | **Garder** | `RateLimitFilter` avec purge mÃ©moire horaire `@Scheduled` |
| Scoring dynamique des opportunitÃ©s | **Garder** | Algorithme d'affinitÃ© compÃ©tences/intitulÃ©s (45% Ã  95%) |
| GÃ©nÃ©ration rÃ©elle de lettres de motivation | **Garder** | Gemini 2.0 Flash + persistance MySQL (Migration Flyway V9) |
| ModÃ¨les Gemini officiels | **Garder** | `gemini-3.8-live` (Audio Live) et `gemini-3.5-flash-lite` (observation texte) |
| Pool asynchrone d'envoi d'e-mails | **Garder** | `AsyncConfig` avec pool dÃ©diÃ© `mailTaskExecutor` |
| Index MySQL & Migrations de schÃ©ma | **Garder** | Migrations Flyway V1 Ã  V10 appliquÃ©es |

### ðŸ•“ P2 : Frontend & Rendu Visuel â€” 100% VALIDÃ‰
| Composant | Statut |
| :--- | :--- |
| Profils & ParamÃ¨tres reliÃ©s au backend MySQL | **RÃ©solu** via `CandidateProfileApiService` et `CandidateProfileController` |
| Orbe vocal & visualiseur d'ondes | **RÃ©solu** : Animation connectÃ©e aux signaux `isAiSpeaking` et `isUserSpeaking` |
| Sas semi-duplex anti-larsen | **RÃ©solu** : Coupure micro pendant la parole IA + cooldown 400ms |
| Transcription temps rÃ©el ligne par ligne | **RÃ©solu** : Buffering par ponctuation dans `lineBuffers` |
| Moteur d'audit proactif d'intÃ©gritÃ© | **RÃ©solu** : `CvAuditEngineService` (`audit_cv_integrity`) |
| Landing page Ã©ditoriale | **RÃ©solu** : Style Anthropic, canvas animÃ©, 4 Ã©tapes avec courbes, zÃ©ro lien factice |
| Compilation TypeScript & Build Production | **VÃ©rifiÃ©** : 0 erreur (`npm run build` et `tsc --noEmit` code retour 0) |

---

## âš™ï¸ 11. Variables d'Environnement & DÃ©ploiement

### 11.1. Variables Requises (`backend/.env`)
```properties
# Port et serveur
SERVER_PORT=8081
FRONTEND_URL=http://localhost:4200

# Base de donnÃ©es MySQL
DB_HOST=localhost
DB_PORT=3308
DB_NAME=emploi
DB_USERNAME=root
DB_PASSWORD=secret_db_password

# SÃ©curitÃ© & JWT (ClÃ© de 256 bits minimum)
JWT_SECRET=votre_cle_secrete_jwt_super_securisee_256_bits_base64
JWT_EXPIRATION_MS=86400000
JWT_COOKIE_SECURE=false # Mettre Ã  true en production HTTPS

# Google OAuth
GOOGLE_CLIENT_ID=votre_google_client_id.apps.googleusercontent.com

# Pool de clÃ©s Google Gemini (rotation et failover)
GEMINI_API_KEYS=cle_gemini_1,cle_gemini_2,cle_gemini_3
GEMINI_LIVE_MODEL=gemini-3.8-live
GEMINI_MODEL=gemini-3.5-flash-lite

# Passerelle NotchPay & WhatsApp (Mobile Money & Cartes)
NOTCHPAY_PUBLIC_KEY=pk.live_xxxxxxxxxxxx
NOTCHPAY_PRIVATE_KEY=sk.live_xxxxxxxxxxxx
NOTCHPAY_WEBHOOK_SECRET=votre_secret_webhook_notchpay
NOTCHPAY_BASE_URL=https://api.notchpay.co
PAYMENT_RETURN_URL=http://localhost:4200/cv-builder?payment=success
WHATSAPP_SUPPORT_PHONE=237698765588

# Serveur SMTP (Envoi de codes de validation)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=votre_email@gmail.com
MAIL_PASSWORD=mot_de_passe_application_gmail
MAIL_FROM=no-reply@getjob.ai

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:4200,https://app.getjob.ai
```

### 11.2. Commandes de Validation
- **Backend** : `mvn clean test-compile` dans `backend/`
- **Frontend** : `ng build --configuration production` dans `dashboard/`
- **TypeScript strict** : `npx tsc --noEmit` dans `dashboard/`

### 11.3. Infrastructure & DÃ©ploiement en Production (VPS Docker)
- **Topologie Serveur** :
  - **HÃ´te** : Serveur VPS de production (`72.62.236.147`) sous Ubuntu/Debian.
  - **Proxy Inverse** : Nginx avec terminaison TLS / SSL Let's Encrypt (`https://fallajobs.com`).
  - **Conteneurs Applicatifs** :
    - `fallajobs-backend` : Image Spring Boot 3.3 / Java 21, exposÃ©e sur le port `8081` interne (healthcheck `/actuator/health`).
    - `fallajobs-frontend` : Image Angular 18 Nginx Alpine, exposÃ©e sur le port `8082` interne.
  - **RÃ©seau Docker** : `app-network` (bridge externe mutualisÃ©).
- **Fichier des AccÃ¨s Confidentiels (`DEPLOY_ACCESS.md`)** :
  - Un fichier dÃ©diÃ© `DEPLOY_ACCESS.md` situÃ© Ã  la racine du projet contient l'ensemble des accÃ¨s SSH, chemins de rÃ©pertoires, mots de passe et procÃ©dures pas-Ã -pas de maintenance.
  - Ce fichier est strictement exclu du contrÃ´le de version via les rÃ¨gles `.gitignore` (`DEPLOY_ACCESS*.md`, `*deploy_access*`). Ne jamais le commiter.

---

## ðŸ† 12. RÃ¨gles d'Or d'IngÃ©nierie & Normes de QualitÃ©

1. **ZÃ©ro DonnÃ©e Factice (*No Mock/Dummy Data*)** : Toutes les informations proviennent d'appels REST rÃ©els ou s'affichent via des Ã©tats vides ergonomiques incitant Ã  l'action.
2. **PrioritÃ© Mobile-First Absolue** : Tout Ã©cran doit Ãªtre impeccable sur Ã©crans Ã©troits (360px-430px) sans aucun dÃ©bordement horizontal.
3. **Robustesse DÃ©fensive des Tiers** : Tout appel externe (NotchPay, Gemini) est protÃ©gÃ© par timeouts, quotas et repli gracieux (WhatsApp).
4. **Cloisonnement Strict du Code** : Ne jamais modifier le code source de production hors d'une tÃ¢che explicite et validÃ©e.

