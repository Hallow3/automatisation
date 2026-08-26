# CHANGELOG — Suivi de Développement & Intégration

## [0.6.0] - 2026-08-24

### 🔒 Sécurité Multi-Tenancy (P0), Google ID Token Cryptographique, Rate Limiting & Optimisation DB

#### 1. Sécurité & Contrôle d'Accès Multi-Tenancy (P0)
- **Vérification Cryptographique Google Sign-In** :
  - Intégration de `google-api-client` (`GoogleIdTokenVerifier`) dans `AuthService.java`.
  - Validation cryptographique stricte de la signature du jeton `credential` Google ID Token, extraction vérifiée de l'e-mail et du nom.
  - Sécurisation du DTO `GoogleAuthRequest` avec obligation du `credential`.
  - Intégration Google Identity Services dans `auth.component.ts` avec One Tap / popup sécurisé sans simulation `window.prompt`.
- **Élimination des Failles Multi-Tenancy & IDOR** :
  - Suppression complète de tous les fallbacks `candidateId = 1` dans `OpportunityService.java` et `ApplicationService.java` au profit d'une levée stricte d'`AccessDeniedException`.
  - Suppression du `findAll()` non filtré dans `OpportunityService.getAllOpportunities()`.
  - Filtrage strict par propriétaire `app.getCandidateId().equals(candidateId)` sur `getApplicationById`, `getOpportunityById`, `dismissOpportunity`, `prepareApplication`, `submitApplication`.
- **Gestionnaire Global d'Exceptions (`GlobalExceptionHandler`)** :
  - Capture dédiée de `IllegalArgumentException` (HTTP 400 ou 409 Conflict si compte existant).
  - Capture dédiée de `IllegalStateException` (HTTP 400 ou 403 Forbidden si `EMAIL_NOT_VERIFIED`).
- **Sérialiseur JSON JJWT (`jjwt-jackson`)** :
  - Ajout du module d'implémentation de runtime `jjwt-jackson` dans `pom.xml` pour satisfaire le `ServiceLoader` de JJWT 0.12+ lors de la sérialisation / désérialisation des claims JWT.

#### 2. Scalabilité & Optimisation Système ~50 Utilisateurs (P1)
- **Rate Limiter Anti-Bruteforce (`RateLimitFilter`)** :
  - Filtre en mémoire avec sliding window (15 requêtes/minute par IP) sur `/api/v1/auth/*` renvoyant HTTP 429 (`TOO_MANY_REQUESTS`) en ProblemDetail RFC 7807.
- **Thread Pool Asynchrone Dédié (`AsyncConfig`)** :
  - Création de `emailTaskExecutor` (`ThreadPoolTaskExecutor` 2-8 threads, queue 200) pour isoler les envois d'e-mails sans saturer le `ForkJoinPool` commun.
- **Ajustement Pool HikariCP & Index MySQL** :
  - Dimensionnement de HikariCP à `maximum-pool-size: 12` et `minimum-idle: 3`.
  - Migration Flyway `V7__add_performance_indexes.sql` ajoutant les index sur `application(candidate_id, status)`, `job_offer(scraped_at)` et `cv(candidate_id, created_at)`.

#### ✅ Vérification builds — 24 août 2026
- **Backend Spring Boot** : `mvn test-compile` → **BUILD SUCCESS** (50 sources compilées)
- **Frontend Angular 18** : `ng build` → **BUILD SUCCESS** (0 erreur)

---

## [0.5.0] - 2026-08-24

### 🔐 Validation d'Email Obligatoire, SMTP Gmail Réel, Google Sign-In, Reset Mot de passe & AI Orb

#### 1. Validation Obligatoire de l'Email & Sécurité Authentification (Chantier G)
- **Migration Flyway V6 (`V6__add_email_verification_columns.sql`)** :
  - Ajout des colonnes `verification_code`, `verification_code_expires_at`, `reset_password_code`, `reset_password_expires_at` sur la table `candidate`.
- **Inscription (`Register`)** :
  - Création du compte candidat avec statut non activé (`enabled = false`).
  - Génération d'un code de sécurité à 6 chiffres (validité 15 min).
  - Redirection immédiate vers l'écran de validation sans émission de session prématurée.
- **Blocage Strict à la Connexion (`Login`)** :
  - Rejet automatique (`EMAIL_NOT_VERIFIED`) pour tout utilisateur n'ayant pas validé son email, avec renvoi d'un nouveau code et redirection vers l'écran de validation avec email pré-rempli.
- **Nouveaux Endpoints Backend** :
  - `POST /api/v1/auth/verify-email` : vérification du code à 6 chiffres, activation du compte (`enabled = true`), émission du cookie JWT HttpOnly et connexion directe.
  - `POST /api/v1/auth/resend-verification` : renvoi d'un nouveau code de validation à la demande.
- **Envoi Réel d'E-mails (SMTP Gmail)** :
  - Ajout de `spring-boot-starter-mail` (`jakarta.mail`).
  - Configuration sécurisée STARTTLS sur `smtp.gmail.com:587`.
  - Service `AuthEmailService.java` envoyant de façon asynchrone (`CompletableFuture.runAsync`) des templates HTML JobPilot soignés pour la validation de compte et la réinitialisation de mot de passe.
- **Continuer avec Google (`Google Sign-In`)** :
  - Bouton officiel Google avec logo SVG 4 couleurs.
  - Endpoint `POST /api/v1/auth/google` avec création automatique et activation d'office (`enabled = true`).
- **Mot de Passe Oublié (`Forgot & Reset Password`)** :
  - Endpoints `POST /api/v1/auth/forgot-password` et `POST /api/v1/auth/reset-password` avec code de sécurité à 6 chiffres et activation automatique après validation.
- **Boutons de Déconnexion (Logout)** :
  - Ajout du bouton logout dans la Sidebar et dans le menu dropdown du Topbar.
- **Correctif Intercepteur HTTP (`auth.interceptor.ts`)** :
  - Exclusion stricte de toutes les requêtes `/auth/*` du traitement des 401 pour éliminer définitivement les redirections parasites `?reason=session_expired`.

#### 2. Expérience Vocale IA & Quotas
- **AI Orb Vivante 3D (`cv-interview.component`)** :
  - Remplacement du cercle statique du micro par une sphère animée fluide 3D avec aura ambiante, morphing CSS et états réactifs (écoute cyan, parole IA violette/rose, veille).
- **Gestion des Quotas Vocaux (3/3)** :
  - Détection HTTP 429 `QUOTA_REACHED` et affichage d'une bannière explicative avec accès direct à l'éditeur manuel de CV.

#### 3. Galerie de Modèles CV & Moteur Multi-Pages A4
- **12 Modèles Professionnels** : Classique, Moderne, Minimaliste, Exécutif, Créatif, Compact, Élégant, Tech, Corporate, Startup, Senior, Académique.
- **Moteur de Découpage A4** : Largeur fixe 794px, budget hauteur 1025px / 1060px et pagination dynamique multi-pages.

#### ✅ Vérification builds — 24 août 2026
- **Backend Spring Boot** : `mvn test-compile` → **BUILD SUCCESS**
- **Frontend Angular 18** : `ng build` → **BUILD SUCCESS** (0 erreur)

---

## [0.4.0] - 2026-08-24

### 🚀 Intégration complète des chantiers prioritaires (C, B, E, D, G, A, F) & Correctifs Rendu/Export

#### 1. Correctifs Rendu, Réactivité & Export Direct
- **Aperçu Live A4** : Fixation de la largeur A4 standard (`794px`) avec scroll automatique (`overflow-auto`) et conteneur centré (`min-h-[700px]`), résolvant l'écrasement visuel vertical en ruban étroit.
- **Réactivité Formulaire en Direct** : Conservation du singleton `FormGroup` et synchronisation réactive instantanée via `computed(() => this.editor.cvData())`. Chaque frappe au clavier met à jour l'aperçu en direct sans latence.
- **Export PDF direct autonome** : Installation et intégration de `jsPDF` + `html2canvas` dans `PdfExportService`. Téléchargement direct d'un fichier `.pdf` A4 vectoriel/HD sur mobile et desktop sans boîte de dialogue d'impression navigateur.

#### 2. Les 7 Chantiers Implémentés
- **Chantier C (Mode Formulaire / Questionnaire IA Guidé)** : Parcours étape par étape interactif (5 étapes : Coordonnées, Expériences, Formation, Compétences/Langues, Pitch) pour créer son CV sans micro.
- **Chantier B (Assistant IA Textuel dans l'Éditeur)** : Remplacement du mock simulé par l'endpoint `POST /api/v1/cvs/{id}/ai-edit` avec Gemini 2.0 Flash (chiffrage de réalisations, réécriture orientée impact, correction).
- **Chantier E (Global Exception Handler)** : Implémentation de `GlobalExceptionHandler.java` (`@RestControllerAdvice`) normalisant toutes les réponses d'erreur HTTP au format standard RFC 7807 (`ProblemDetail`).
- **Chantier D (Import & Extraction de CV existant)** : Endpoint `POST /api/v1/cvs/import` avec analyse multimodale Gemini 2.0 Flash (PDF / Images) et bouton d'importation direct sur l'accueil et le builder.
- **Chantier G (Sécurité Auth & Placeholders Config)** : Configuration externalisée des variables d'environnement Google OAuth et Mail SMTP (`application.yml`).
- **Chantier A (Gestion des Quotas & Limite Utilisateur)** : Migration Flyway `V5` ajoutant `ai_interviews_used` et `ai_interviews_reset_date` sur `candidate`, avec blocage HTTP 429 (`QUOTA_REACHED`) à 3 sessions/jour.
- **Chantier F (Optimisation DB & HikariCP)** : Configuration du pool de connexions (`maximum-pool-size: 25`, timeouts optimisés) et désactivation de `show-sql` en production.

---

### 🎙️ Fix Streaming Chat, Synthèse CV de secours conditionnelle, Support 2 Pages A4 & Export PDF à la volée

#### 1. Frontend (Angular 18)
- **`GeminiLiveService`** :
  - Remplacement de l'instanciation de bulles individuelles par `appendTranscriptChunk()` et `finalizeCurrentTurn()`. Les chunks textuels de Gemini Live sont désormais concaténés en direct par tour de parole sans fragmentation visuelle.
  - Implémentation du filet de sécurité `isDraftEmptyOrIncomplete()` : si le draft est incomplet après l'entretien vocal, le transcript est transmis à `POST /api/v1/cvs/{id}/synthesize` pour une extraction structurée intégrale.
- **`CvEditorService` & `CvInterviewComponent`** :
  - Normalisation tolérante des types : supporte `languages` sous forme de chaînes ou d'objets (`{lang, level}`), gestion des alias (`role`/`position`, `startDate`/`endDate`/`period`, `responsibilities`/`bullets`).
- **`CvPreviewComponent` (Support Multi-Pages & 2 Pages A4)** :
  - Suppression du ratio fixe bloquant. Intégration des règles CSS `break-inside: avoid` et `break-after: avoid` sur `.cv-section`, `.cv-section-title` et `.cv-item` pour éviter toute coupure de texte entre les pages 1 et 2.
- **`PdfExportService` & Boutons d'export** :
  - Création du service d'export PDF à la volée (`exportCvPdf`) sans stockage MinIO.
  - Branchement du bouton *"Télécharger le PDF"* dans `CvListComponent` et `CvBuilderMainComponent`.

#### 2. Backend (Spring Boot 3.3)
- **`GeminiLiveTokenService`** :
  - Ajout de `generateStructuredContent()` avec rotation automatique de clés et failover en mode JSON (`responseMimeType: "application/json"`).
- **`CvService` & `CvController`** :
  - Ajout de l'endpoint `POST /api/v1/cvs/{id}/synthesize` effectuant la synthèse structurée des faits du transcript via Gemini 2.0 Flash.
- **`OpportunityService` & `ApplicationService`** :
  - Correction de la faille multi-tenancy : suppression de `DEFAULT_CANDIDATE_ID = 1` au profit de `resolveCurrentCandidateId()`.

#### ✅ Vérification builds — 24 août 2026
- **Backend** : `mvn compile -DskipTests` → **BUILD SUCCESS**
- **Frontend** : `ng build` → **BUILD SUCCESS** (0 erreur TypeScript)

---

### 🧹 Suppression définitive des dummy data (Jean Dupont) & Intégration profil réel

#### Backend (Spring Boot)
- **`AuthResponse`** : ajout des champs `phone`, `city`, `targetRole` au DTO pour transmettre les coordonnées de base du candidat connecté.
- **`AuthService`** : projection des champs `phone`, `city`, `targetRole` dans `toAuthResponse` pour `GET /api/v1/auth/me` et `POST /api/v1/auth/login`.
- **`CvService`** : création de la méthode `buildInitialContentJson(candidate)` qui initialise `contentJson` avec les informations réelles de la table `candidate` (`fullName`, `email`, `phone`, `city`, `headline`) lors de `createCv`, `createInterviewSession` et `updateDraft`.

#### Frontend (Angular 18)
- **`auth.model.ts`** : ajout des champs `phone?`, `city?`, `targetRole?` dans `AuthUser`.
- **`CvPreviewComponent`** : suppression totale de `MOCK_CV_DATA` ("Jean Dupont", "TechCorp Solutions", etc.). Création de `createDefaultCvData(user)` et initialisation par défaut avec `EMPTY_CV_DATA`.
- **`cv-preview.component.html`** : affichage conditionnel avec `*ngIf` sur chaque section pour éviter les entêtes ou lignes vides si un champ n'est pas encore renseigné.
- **`CvEditorService`** : injection de `AuthService`. Initialisation du formulaire `_buildForm()`, `patchFromData()` et conversion `toCvData()` basées sur les données réelles du candidat connecté au lieu de dummy data.
- **`CvBuilderMainComponent`** : initialisation du preview et de l'éditeur avec `createDefaultCvData(this.authService.currentUser())` et chargement immédiat du profil en cas d'entretien prématuré ou draft vide.
- **`CvInterviewComponent`** : `getCvPreviewData()` utilise `this.authService.currentUser()` et ne génère plus de placeholders fictifs.
- **`GeminiLiveService`** : `createEmptyDraft()` pré-remplit l'identité avec les coordonnées du candidat connecté dès l'ouverture de la session vocale.
- **`CvListComponent`** : utilisation de `getCvData(cv)` alimenté par `rawContentJson` ou `createDefaultCvData(authService.currentUser())` pour le rendu des miniatures.

#### ✅ Vérification builds — 20 août 2026
- **Backend** : `mvn clean package -DskipTests` → **BUILD SUCCESS**
- **Frontend** : `ng build` → **BUILD SUCCESS** (0 erreur TypeScript)

---

## [0.2.1] - 2026-08-15

### 🧹 Nettoyage — Données fictives & dummy data

#### Frontend (Angular 18)
- **`GeminiLiveService`** : `startSimulatedSession()` ne pousse plus de données fictives dans le draft (`headline: "Développeur Full Stack"`, `identity: { fullName: "Mohamed B." }`). Mode simulé désormais neutre : accueil vocal uniquement, aucune donnée injectée.
- **`GeminiLiveService`** : `simulateUserAnswer()` ne pousse plus skills/expériences fictifs (TechCorp SaaS, Angular, etc.). La réponse simulée se limite à la transcription + question suivante.
- **`CvApiService`** : ajout de la méthode `saveDraft(id, draft)` manquante (utilisée par `CvEditorService` pour l'auto-save).
- **`CvBuilderMainComponent`** : ajout du champ `templateLabel?` dans l'interface `CvHistoryItem` + mapping depuis `cv.templateLabel` dans `ngOnInit`.

#### Backend (Spring Boot)
- **`V3__seed_default_candidate.sql`** : seed `"Mohamed B."` (id=1) supprimé. Le script est désormais vide avec un commentaire explicatif : obsolète depuis V4, chaque candidat est créé via `POST /api/v1/auth/register`.

#### ✅ Vérification builds — 15 août 2026
- **Backend** : `mvn clean package -DskipTests` → **BUILD SUCCESS** (41 fichiers, 30s)
- **Frontend** : `ng build` → **BUILD SUCCESS** (Angular 18, aucune erreur TypeScript)

> ⚠️ **Note Flyway** : si la DB a déjà appliqué l'ancienne V3 (avec le INSERT), le checksum ne correspondra plus. Exécuter `REPAIR` Flyway ou supprimer la ligne dans `flyway_schema_history` avant le démarrage.

---

## [0.2.0] - 2026-08-14

### 🔐 Module 1 — Authentification JWT + Cookie HttpOnly (COMPLET)

#### Backend (Spring Boot)
- **Migration Flyway V4** : ajout colonnes `password_hash`, `role`, `enabled` + index unique `email` sur la table `candidate`.
- **Dépendances** : ajout `spring-boot-starter-security` + `jjwt` 0.12.6 (api/impl/jackson).
- **`JwtService`** : génération HS256, validation, extraction claims (`email`, `candidateId`). Clé secrète via `JWT_SECRET` (variable d'env).
- **`CandidateUserDetailsService`** : implémentation `UserDetailsService` Spring Security basée sur `CandidateEntity` (identifiant = email).
- **`AuthService`** : register (BCrypt 12), login (via `AuthenticationManager`), getProfile.
- **`AuthController`** : `POST /api/v1/auth/register`, `POST /login`, `POST /logout`, `GET /me`. Cookie `jwt_token` posé via header `Set-Cookie` avec `HttpOnly; SameSite=Strict`.
- **`SecurityConfig`** : STATELESS, CSRF désactivé (SameSite=Strict), 401 JSON, routes publiques `/auth/**`.
- **`JwtAuthenticationFilter`** : lecture cookie → validation token → injection `SecurityContext`.
- **`CorsConfig`** : `allowCredentials(true)`, origines explicites (plus de wildcard), configurable via `CORS_ALLOWED_ORIGINS`.
- **`CvService`** : `DEFAULT_CANDIDATE_ID` supprimé, remplacé par `resolveCurrentCandidate()` depuis `SecurityContextHolder`. Contrôle d'appartenance sur chaque accès CV.
- **`application.yml`** : clé Gemini déplacée vers `GEMINI_API_KEY` (env var), JWT configuré via env vars.
- **`CandidateEntity`** : ajout champs `passwordHash`, `role`, `enabled`.
- **`CandidateRepository`** : ajout `findByEmail()`, `existsByEmail()`.

#### Frontend (Angular 18)
- **`auth.model.ts`** : interfaces `AuthUser`, `LoginRequest`, `RegisterRequest`.
- **`AuthService`** : signals (`currentUser`, `isAuthenticated`), `login()`, `register()`, `logout()`, `checkSession()` (pour `APP_INITIALIZER`), `handleUnauthorized()` (pour interceptor).
- **`authInterceptor`** : `withCredentials: true` sur toutes les requêtes + redirection `/login?reason=session_expired` sur 401.
- **`authGuard`** : `CanActivateFn`, redirige `/login?returnUrl=...` si non authentifié.
- **`AuthComponent`** (`features/auth/`) : page login/register complète. Onglets, Reactive Forms, validation inline, gestion d'erreurs, message session expirée, boutons OAuth Google/LinkedIn (placeholders désactivés).
- **`app.routes.ts`** : `/login` public, toutes les autres routes protégées par `authGuard`. Fix ordre routes `cvs/interview` avant `cvs/:id/interview`.
- **`app.config.ts`** : `APP_INITIALIZER` → `checkSession()`, `withInterceptors([authInterceptor])`.

#### Sécurité
- Token JWT non exposé en JavaScript (cookie HttpOnly uniquement).
- Pas de clé API en clair dans le code source.
- Contrôle d'accès niveau ressource (CV appartenant à l'utilisateur connecté uniquement).
- Fallback dangereux (envoi clé Gemini) supprimé de `GeminiLiveTokenService`.

#### Variables d'environnement requises
```
JWT_SECRET=<min 32 chars>
JWT_COOKIE_SECURE=false   # true en production (HTTPS)
CORS_ALLOWED_ORIGINS=http://localhost:4200
GEMINI_API_KEY=<votre clé>
```

#### ✅ Vérification builds — 15 août 2026
- **Backend** : `mvn clean package -DskipTests` → **BUILD SUCCESS** (41 fichiers, Java 17 target / JDK 20, Maven 3.9.2). Warning non bloquant : unchecked cast dans `GeminiLiveTokenService` (pré-existant).
- **Frontend** : `npm run build` → **BUILD SUCCESS** (Angular 18, Node 23.6.0). Template fix appliqué : les `[class.border-*]` avec `/` dans les noms Tailwind remplacés par `[style.borderColor]` pour compatibilité parser Angular.
- Prochaine étape : démarrage réel avec DB MySQL et variables d'env configurées.

#### ⚠️ Avant le premier démarrage
1. Créer le fichier `.env` ou setter les variables d'env :
   ```
   JWT_SECRET=une_chaine_de_au_moins_32_caracteres_obligatoire
   GEMINI_API_KEY=ta_vraie_cle_gemini
   JWT_COOKIE_SECURE=false
   CORS_ALLOWED_ORIGINS=http://localhost:4200
   DB_HOST=localhost
   DB_PORT=3308
   DB_NAME=emploi
   DB_USERNAME=root
   DB_PASSWORD=
   ```
2. La migration Flyway V4 s'exécutera automatiquement au démarrage et ajoutera `password_hash`, `role`, `enabled` sur la table `candidate`.
3. La migration V3 (seed candidat ID=1) reste valide — ne pas la supprimer.



## [0.1.0] - 2026-08-10

### 🚀 Backend (Spring Boot 3.3 / Java 17)
- **Création du Backend Spring Boot** (`code/backend`) suivant l'architecture définie dans `SKILL.md` et `PROMPT_DASHBOARD_AI.md`.
- **CORS Configured** : Autorisation explicite pour les requêtes frontend (`http://localhost:4200` et patterns locaux).
- **Module Opportunités API REST** (`/api/v1/opportunities`) :
  - `GET /api/v1/opportunities` (liste)
  - `GET /api/v1/opportunities/{id}` (détail)
  - `POST /api/v1/opportunities/{id}/dismiss` (ignorer)
  - `POST /api/v1/opportunities/{id}/prepare` (préparer candidature)
  - `POST /api/v1/opportunities/{id}/submit` (postuler)
  - `GET /api/v1/opportunities/{id}/cover-letter` (lettre de motivation)
- **Module Candidatures API REST** (`/api/v1/applications`).
- **Module CVs API REST** (`/api/v1/cvs`, `/api/v1/cv-templates`).
- **Module Realtime Voice Authorization** (`/api/v1/voice/session`) : Gestion sécurisée des sessions OpenAI Realtime WebRTC.
- **Base H2 & DataInitializer** : Seeding automatique des opportunités, CVs et candidatures initiales au démarrage.

### 🎨 Frontend (Angular 18 / Tailwind CSS)
- **Correction des Fuites de Mémoire** : Intégration de `DestroyRef` et `takeUntilDestroyed` dans `CvBuilderMainComponent`.
- **Intégration Backend Realtime** : Mise à jour de `OpenaiRealtimeService` pour appeler le backend Spring Boot `/api/v1/voice/session`, nettoyage propre des flux WebRTC (`RTCPeerConnection`, `RTCDataChannel`, tracks), et génération d'IDs avec `crypto.randomUUID()`.
- **Désactivation du Interceptor Mock** : Pointage de l'environnement de développement vers `http://localhost:8080/api/v1`.

### 🛡️ Sécurité & Validation
- **Spring Security** : Contourné/désactivé en mode dev selon l'instruction explicite de démarrage sans authentification bloquante.
- **Vérification des Builds** :
  - Backend Spring Boot (`mvn clean package -DskipTests`) : **BUILD SUCCESS**
  - Frontend Angular (`npm run build`) : **BUILD SUCCESS**
