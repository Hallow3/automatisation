# 🧭 GUIDE D'ONBOARDING — FALLAJOBS

Bienvenue sur le projet **FallaJobs**.  
Ce guide est conçu pour permettre à tout nouvel ingénieur, contributeur ou agent IA d'être opérationnel en moins de 10 minutes sur la codebase.

---

## ⚡ 1. Résumé en 60 Secondes

| Axe | Détail |
| :--- | :--- |
| **Produit** | Plateforme SaaS B2B/B2C d'accélération de carrière assistée par IA. |
| **Piliers Clés** | 1. Coach vocal d'entretien pour création de CV (Gemini 3.1 Live).<br>2. Galerie & Éditeur de CV A4 haute fidélité (9 templates Word/ATS).<br>3. Agrégation d'offres d'emploi & scoring d'affinité algorithmique (45-95%).<br>4. Rédaction IA de lettres de motivation personnalisées (Gemini 2.0 Flash).<br>5. Paiement programmatique Mobile Money (NotchPay) avec résilience WhatsApp. |
| **Backend** | Spring Boot 3.3.2, Java 17/21, Spring Security 6 (JWT HttpOnly), Flyway V1 -> V14, MySQL 8. |
| **Frontend** | Angular 18 (100% Standalone, Signals), Tailwind CSS v3, Web Audio API (PCM 16k/24k). |
| **IA & Audio** | Google Gemini 3.1 Flash Live (WebSocket), Gemini 2.0 Flash (REST multimodal/texte). |
| **Paiements** | NotchPay API (`POST /payments`), Webhook HMAC-SHA256, Idempotence, WhatsApp fallback. |

---

## 🚀 2. Démarrage Rapide (Quickstart)

### 2.1. Prérequis
- **Java 17 ou 21** (`java -version`)
- **Maven 3.8+** (`mvn -version`)
- **Node.js 20+** et **npm 10+** (`node -v`, `npm -v`)
- **MySQL 8.0** en local ou via Docker
- Optionnel : **Chromium / Google Chrome** installé pour le moteur de génération PDF côté serveur.

### 2.2. Configuration de l'Environnement

1. **Backend** : Copier le fichier d'exemple et renseigner les clés :
   ```bash
   cp backend/.env.example backend/.env
   ```
   Variables critiques à vérifier dans `backend/.env` :
   - `DB_HOST=localhost`, `DB_PORT=3308` (ou `3306`), `DB_NAME=emploi`, `DB_USERNAME=root`, `DB_PASSWORD=...`
   - `JWT_SECRET` (clé base64 de 256 bits minimum)
   - `GEMINI_API_KEYS` (une ou plusieurs clés séparées par des virgules)
   - `NOTCHPAY_PUBLIC_KEY`, `NOTCHPAY_PRIVATE_KEY`, `NOTCHPAY_WEBHOOK_SECRET`
   - `WHATSAPP_SUPPORT_PHONE=237698765588`

2. **Frontend** :
   Le fichier `dashboard/src/environments/environment.development.ts` pointe par défaut sur :
   - `apiUrl: 'http://localhost:8081/api/v1'`

### 2.3. Lancement des Services

#### Terminal 1 — Backend Spring Boot :
```bash
cd backend
mvn spring-boot:run
```
> Le serveur démarre sur le port **8081** (`http://localhost:8081`). Les migrations Flyway V1 à V14 s'exécutent automatiquement au démarrage.

#### Terminal 2 — Frontend Angular :
```bash
cd dashboard
npm install
npm start
```
> L'application est accessible sur `http://localhost:4200/`.

---

## 🧩 3. Cartographie de la Codebase

### 3.1. Structure Backend (`backend/src/main/java/com/getjob/backend/`)
- `ai/` : Service de gestion des jetons éphémères Gemini Live 3.1 (`GeminiLiveTokenService.java`) avec rotation de clés.
- `auth/` : Sécurité Spring Security 6, JWT en cookie HttpOnly, filtres `JwtAuthenticationFilter` et `RateLimitFilter`.
- `candidate/` : Profils candidats, contrôleur `/api/v1/candidate/profile`, synchronisation de données.
- `cv/` : Cycle de vie des CVs, validation des brouillons (`CvDraftValidator`), et export PDF headless (`CvPdfExportService`).
- `cv/interview/` : Sous-système d'orchestration vocal V2 (State Machine déterministe, Observer LLM, Writer Service, persistance des sessions).
- `opportunity/` : Moteur de matching et scoring d'affinité (45% - 95%), rédaction de lettres de motivation IA.
- `application/` : Gestion et suivi des candidatures (pipeline Kanban).
- `payment/` : Intégration NotchPay programmatique, client HTTP dédié (`NotchPayClient`), circuit breaker (`NotchPayCircuitBreaker`), webhook HMAC-SHA256 et repli WhatsApp.
- `common/exception/` : Gestionnaire d'erreurs global `GlobalExceptionHandler` au format standard RFC 7807 (`ProblemDetail`).

### 3.2. Structure Frontend (`dashboard/src/app/`)
- `features/landing/` : Page d'accueil éditoriale minimaliste (inspiration Anthropic, canvas animé, connecteurs SVG "corde molle").
- `features/cv-builder/` : Créateur de CV split-screen avec prévisualisation A4 en temps réel et chat d'optimisation IA.
- `features/cvs/` :
  - `pages/cv-list/` : Galerie de gestion des CVs avec badges de déverrouillage et pastilles de crédits.
  - `pages/cv-interview/` : Interface d'entretien vocal interactif avec orbe réactif et audit de cohérence en direct.
  - `pages/cv-print/` : Rendu A4 dédié à l'exportation PDF par Chromium headless.
- `features/opportunities/` : Liste et détails des opportunités d'emploi avec justification d'affinité.
- `features/applications/` : Tableau et Kanban de suivi des candidatures.
- `core/prompts/cv-interview/` : Prompts modulaires pour l'IA d'entretien vocal (Bray).
- `core/services/` :
  - `cv-interview-api.service.ts` : API d'orchestration vocale V2 (session, tour de parole, arrêt anticipé, remboursement).
  - `gemini-live-ws-client.service.ts` : Communication WebSocket audio bidirectionnelle avec Gemini Live (tool `request_end_interview`).
  - `audio-pcm-engine.service.ts` : Capture micro PCM 16kHz via Worklet et lecture PCM 24kHz.
  - `interview-session-cache.service.ts` : Cache de résilience locale (10 min) en cas de déconnexion.
  - `payment.service.ts` : Tunnel NotchPay, crédits pro synchronisés et modales de repli WhatsApp.

---

## 💡 4. Les 5 Grands Flux Métier

### 1. Entretien Vocal IA Découplé (Architecture V2)
- Le candidat démarre une session vocale (`POST /api/v1/cvs/{id}/interview/session`) : 1 crédit Pro est débité avec garantie de remboursement immédiat (`/interview/refund`) en cas d'interruption technique.
- La reprise d'une session en cours (< 15 min) est gratuite quel que soit le format de route (`new`, `cv_default`, ou id numérique).
- Le frontend ouvre un WebSocket direct `wss://generativelanguage.googleapis.com/...` en PCM 16kHz entrant et 24kHz sortant, guidé par le persona *Bray*.
- À chaque fin de tour de parole, le frontend synchronise la transcription avec le backend (`POST /interview/v2/turn`).
- La State Machine backend (`InterviewStateMachineService`) progresse à travers 10 sections strictes et réinjecte des instructions contextuelles `[INTERVIEW_STATE]`.
- L'Observateur LLM extrait les informations factuelles en tâche de fond et consolide le CV sans impacter la latence vocale.
- Clôture : si le candidat exprime son souhait de quitter, Gemini Live appelle `request_end_interview`, validé de façon déterministe par le backend.

### 2. Double Moteur d'Export PDF (100% Gratuit)
- **Serveur (Headless Chromium)** : Via `POST /api/v1/cvs/{id}/download-ticket`, puis `GET /api/v1/cvs/{id}/download?token=...`. Un sémaphore borne la concurrence à 2 instances Chromium simultanées pour préserver le processeur et la mémoire. L'exportation est 100% gratuite et sans restriction de paiement.
- **Client (jsPDF / html2canvas)** : Génération vectorielle immédiate dans le navigateur.

### 3. Tunnel de Paiement NotchPay & Fallback WhatsApp
- Initiation via `POST /api/v1/payments/initiate` avec référence unique `PAY-XXXX`.
- Redirection vers l'`authorization_url` NotchPay pour paiement Mobile Money (Orange, MTN) ou carte.
- Le webhook `POST /webhooks/notchpay` vérifie la signature `X-Notch-Signature` HMAC-SHA256 sur corps brut, stocke l'ID dans `notchpay_webhook_event`, et effectue un appel de double vérification sortant `GET /payments/{reference}`.
- **Résilience** : En cas de panne de l'API NotchPay ou de circuit breaker ouvert (`NotchPayCircuitBreaker`), le candidat bascule vers WhatsApp (`+237 698 76 55 88`) avec un message pré-rempli et la commande prend le statut `FALLBACK_WHATSAPP`.

### 4. Matching d'Opportunités & Lettres de Motivation
- Calcul dynamique du score de pertinence entre 45% et 95% lors de la consultation (`computeMatchingScore`).
- Bouton *Préparer* : appel à Gemini 2.0 Flash pour rédiger une lettre de motivation sur-mesure enregistrée dans la table `application` (`cover_letter_text LONGTEXT`, Flyway V9).

### 5. Multi-Tenancy & Sécurité Absolue
- Authentification par cookie `jwt_token` HttpOnly et SameSite (inaccessible en JavaScript = zéro faille XSS).
- Tout accès aux données est filtré par le candidat authentifié résolu dans le `SecurityContextHolder` (zéro IDOR).
- Rate limiting en mémoire avec purge horaire programmée sur les routes critiques d'authentification et d'IA.

---

## 📐 5. Standards d'Ingénierie Non-Négociables

1. **Mobile-First Impératif** ([`MOBILE_FIRST_STANDARDS.md`](file:///D:/automatisation/code/MOBILE_FIRST_STANDARDS.md)) :
   - Tout composant, modal ou tableau doit être parfait sur 360px de large.
   - Aucun débordement horizontal (`overflow-x`).
   - Dual layout obligatoire : cartes fluides sur mobile (`block md:hidden`), tableau sur desktop (`hidden md:block`).
2. **Posture Senior Engineer** ([`SKILL.md`](file:///D:/automatisation/code/SKILL.md)) :
   - Analyser systématiquement les dépendances et risques de régression avant de toucher au code.
   - Ne jamais introduire de données factices (*dummy data*) en dur.
   - Ne jamais dégrader l'architecture existante.
3. **Format des Erreurs API (RFC 7807)** :
   - Toutes les erreurs backend retournent un `ProblemDetail` standardisé (`status`, `title`, `detail`, `timestamp`).

---

## 🛠️ 6. Commandes Utiles & Vérifications

```bash
# Vérification de la compilation backend (0 erreur tolérée)
cd backend
mvn clean test-compile

# Lancement des tests unitaires backend
mvn test

# Compilation du frontend Angular en configuration production (0 erreur tolérée)
cd dashboard
npm run build

# Vérification TypeScript stricte
npx tsc --noEmit
```

---

## 📚 7. Documents de Référence

- [**`CONTEXTE_PROJET.md`**](file:///D:/automatisation/code/CONTEXTE_PROJET.md) : Spécification technique exhaustive, diagrammes d'architecture complets, catalogue REST et modèles de CV.
- [**`CHANGELOG.md`**](file:///D:/automatisation/code/CHANGELOG.md) : Historique versionné détaillé des développements (V1.0.0 à V1.2.0).
- [**`MOBILE_FIRST_STANDARDS.md`**](file:///D:/automatisation/code/MOBILE_FIRST_STANDARDS.md) : Charte technique et directives design Mobile-First.
- [**`SKILL.md`**](file:///D:/automatisation/code/SKILL.md) : Référentiel d'ingénierie senior et règles d'or opérationnelles.
