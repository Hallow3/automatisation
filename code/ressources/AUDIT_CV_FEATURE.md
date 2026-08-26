# AUDIT — Fonctionnalité "Création de CV assistée par IA"
> État au 14 août 2026 · Périmètre : de l'auth jusqu'à la remise du CV finalisé

---

## TL;DR

La chaîne technique de base est en place (Spring Boot ↔ Gemini Live ↔ Angular).
Le prototype fonctionne en mode simulé. Il manque **7 blocs critiques** avant d'ouvrir
la feature à un vrai utilisateur : authentification, cloisonnement des données,
sécurisation du token Gemini, génération PDF, édition manuelle du CV, export et
gestion d'erreur utilisateur.

---

## 1. Cartographie de la chaîne actuelle

```
[Utilisateur]
     │
     ▼
[Angular — /cv-builder]
     │  sélection template + clic "démarrer l'entretien"
     │
     ▼
[Angular — /cvs/:id/interview]
     │  POST /api/v1/cvs/{cvId}/interview/session
     │
     ▼
[Spring Boot — CvController → CvService → GeminiLiveTokenService]
     │  POST https://generativelanguage.googleapis.com/v1beta/auth_tokens
     │  retourne { token, model, cvId }
     │
     ▼
[Angular — GeminiLiveService]
     │  WebSocket wss://generativelanguage.googleapis.com/...
     │  setup { model, systemInstruction, tools }
     │  audio PCM 16k → Gemini
     │  audio PCM 24k ← Gemini
     │  function calls ← Gemini (update_cv_draft, complete_interview)
     │
     ├─► PUT /api/v1/cvs/{cvId}/draft        (sauvegarde progressive)
     └─► POST /api/v1/cvs/{cvId}/interview/complete
              │
              ▼
         [Spring Boot — CvService]
              │  cv.status = DRAFT_READY
              │  cv.interview_status = COMPLETED
              │  sync → candidate_profile.raw_data
              │
              ▼
         [Angular — navigate /cv-builder?action=editor&cvId=...]
              │  chargement du CV finalisé
              ▼
         [CvPreview — rendu visuel du CV]
```

---

## 2. Ce qui fonctionne déjà

| Composant | État |
|---|---|
| Route `/cvs/:id/interview` | ✅ |
| Route `/cv-builder?action=editor` | ✅ |
| `GeminiLiveTokenService` — appel `v1beta/auth_tokens` | ✅ (payload corrigé) |
| WebSocket Gemini Live v1beta | ✅ |
| Setup du modèle `gemini-3.1-flash-live-preview` | ✅ |
| Microphone → AudioWorklet → PCM 16k | ✅ |
| Lecture audio PCM 24k en flux continu (enqueued) | ✅ |
| Interruption (barge-in) via VAD serveur | ✅ |
| Transcription input/output | ✅ |
| Function call `update_cv_draft` | ✅ |
| Function call `complete_interview` | ✅ |
| Sauvegarde progressive PUT `/draft` | ✅ |
| Finalisation POST `/interview/complete` | ✅ |
| Sync `candidate_profile.raw_data` | ✅ |
| Rendu visuel `CvPreviewComponent` (3 templates) | ✅ |
| Mode simulé (pas de clé Gemini réelle) | ✅ |
| Navigation post-entretien vers l'éditeur | ✅ |
| Retry x3 sur le chargement du CV après complétion | ✅ |

---

## 3. Ce qui reste à faire — par bloc critique

---

### BLOC 1 · Authentification & Identité utilisateur
**Priorité : BLOQUANT**

#### Situation actuelle
Il n'existe **aucune authentification**. Tous les endpoints sont ouverts.
Tout candidat est hardcodé sur `candidate_id = 1` ("Mohamed B.").
Spring Security est désactivé.

#### Problèmes concrets
- Impossible d'avoir deux utilisateurs différents.
- Toutes les données (CVs, drafts, profil) appartiennent à un seul compte fictif.
- La clé Gemini est exposée si quelqu'un appelle `/interview/session` sans être authentifié.

#### Ce qu'il faut faire
- [ ] Choisir et implémenter un mécanisme d'auth :
  - Option A (recommandée pour un SaaS solo rapide) : **JWT stateless** (Spring Security + `spring-boot-starter-oauth2-resource-server` ou implémentation maison).
  - Option B : délégation à un provider externe (Auth0, Supabase Auth, Firebase Auth) → Angular intercepte le token, Spring le valide.
- [ ] Créer un endpoint `POST /api/v1/auth/register` et `POST /api/v1/auth/login`.
- [ ] Protéger tous les endpoints `/api/v1/**` avec `@PreAuthorize` ou un filtre de sécurité.
- [ ] Injecter l'utilisateur authentifié dans chaque requête (via `SecurityContextHolder` ou un `@AuthenticationPrincipal`).
- [ ] Angular : ajouter un `HttpInterceptor` qui attache le Bearer token sur chaque requête.
- [ ] Créer les pages Login / Register dans Angular.
- [ ] Ajouter un `AuthGuard` sur les routes protégées.

---

### BLOC 2 · Cloisonnement des données (multi-tenant)
**Priorité : BLOQUANT**

#### Situation actuelle
`CvService` utilise `DEFAULT_CANDIDATE_ID = 1` partout en dur.
La table `cv` a bien une colonne `candidate_id` et une FK sur `candidate`,
mais elle n'est jamais filtrée par l'utilisateur connecté.

Conséquence : si deux personnes utilisent l'application, elles voient et écrasent
les mêmes CVs.

#### Ce qu'il faut faire
- [ ] Remplacer `DEFAULT_CANDIDATE_ID` par une résolution dynamique depuis le contexte de sécurité :
  ```java
  // Exemple Spring Security
  Integer candidateId = ((UserDetails) SecurityContextHolder
      .getContext().getAuthentication().getPrincipal()).getCandidateId();
  ```
- [ ] Toutes les requêtes `CvRepository`, `CandidateRepository`, `CandidateProfileRepository` doivent être filtrées par `candidateId`.
- [ ] Vérifier que `GET /cvs/{id}`, `PUT /cvs/{id}/draft`, `POST /cvs/{id}/interview/session` ne peuvent pas être appelés sur un CV qui n'appartient pas à l'utilisateur connecté (contrôle d'accès au niveau de la ressource).
- [ ] Supprimer les fallbacks `findAll()` dans `getAllCvs()` et `findCvEntity()`.
- [ ] Migrer `ensureDefaultCandidateExists()` : ce pattern n'a plus de sens avec de vrais utilisateurs — remplacer par une création de compte lors du register.

---

### BLOC 3 · Sécurité du token Gemini
**Priorité : BLOQUANT**

#### Situation actuelle
`GeminiLiveTokenService` contient un **fallback dangereux** :

```java
// Si la création du token éphémère échoue :
res.put("token", geminiApiKey);  // ← envoie la vraie clé API au browser
```

La clé Gemini est également **en clair dans `application.yml`** :
```yaml
gemini:
  api-key: ${GEMINI_API_KEY} # via variable d'environnement, jamais en clair
```

#### Ce qu'il faut faire
- [ ] **Supprimer immédiatement le fallback** qui retourne `geminiApiKey` au frontend.
- [ ] Remplacer par un retour d'erreur contrôlé :
  ```java
  throw new ResponseStatusException(
      HttpStatus.SERVICE_UNAVAILABLE,
      "Impossible de démarrer la session vocale."
  );
  ```
- [ ] Sortir la clé API de `application.yml` → la passer via variable d'environnement (`GEMINI_API_KEY`). Ne jamais committer une clé réelle dans le repo.
- [ ] Vérifier que le payload `auth_tokens` est bien `{ uses: 1, expireTime, newSessionExpireTime }` et non vide `{}` (un payload vide peut être rejeté selon les quotas Google).
- [ ] Ajouter une rotation / révocation du token côté Spring en cas d'erreur (log + alerte).

---

### BLOC 4 · Édition manuelle du CV après entretien
**Priorité : HAUTE**

#### Situation actuelle
La phase `editor` dans `cv-builder-main` affiche le `CvPreviewComponent` (rendu visuel),
mais il n'existe **aucun formulaire d'édition** pour modifier les champs du CV.
L'utilisateur ne peut que regarder le résultat — il ne peut rien corriger.

#### Ce qu'il faut faire
- [ ] Implémenter un formulaire d'édition dans la phase `editor` :
  - Champs : `identity` (nom, email, téléphone, ville), `headline`, `summary`.
  - Section expériences : ajout / suppression / édition inline.
  - Section compétences : tags ajoutables / supprimables.
  - Section formation : ajout / édition.
  - Section langues.
- [ ] Lier les modifications au `CvApiService.updateCv()` (endpoint `PUT /cvs/{id}` à créer, ou réutiliser `PUT /cvs/{id}/draft`).
- [ ] Afficher le `CvPreviewComponent` en live preview à côté du formulaire (layout split-screen).
- [ ] Permettre de changer de template depuis l'éditeur.

---

### BLOC 5 · Génération du PDF
**Priorité : HAUTE**

#### Situation actuelle
La colonne `pdf_minio_key` existe dans la table `cv`, mais aucun service ne génère
de PDF. Il n'existe pas de bouton "Télécharger" fonctionnel dans l'UI.

#### Ce qu'il faut faire
- [ ] Implémenter la génération PDF côté Spring Boot :
  - Option A : **iText / OpenPDF** (Java natif, PDF fidèle au template Angular).
  - Option B : déléguer au **workflow n8n** existant (déjà prévu pour la génération de documents PDF selon `PROMPT_DASHBOARD_AI.md`) → appel Spring → n8n → PDF → MinIO.
  - Option B est cohérente avec l'architecture globale et évite de dupliquer la logique.
- [ ] Endpoint `POST /api/v1/cvs/{id}/pdf/generate` → lance la génération, stocke en MinIO, met à jour `pdf_minio_key`.
- [ ] Endpoint `GET /api/v1/cvs/{id}/pdf` → retourne un lien signé (ou un stream) vers le PDF MinIO.
- [ ] Bouton "Télécharger PDF" dans `cv-builder-main` phase `editor`.
- [ ] Gérer les états : génération en cours / disponible / erreur.

---

### BLOC 6 · Gestion d'erreur utilisateur (UX)
**Priorité : HAUTE**

#### Situation actuelle
En cas d'échec de connexion Gemini Live, le service bascule silencieusement
en mode simulé (`startSimulatedSession()`). L'utilisateur ne sait pas que
l'IA réelle n'a pas pu se connecter.

En cas d'échec réseau sur `PUT /draft`, l'erreur est swallowed (`.catch(() => null)`).

Il n'y a pas de feedback visuel pour :
- la perte de connexion WebSocket en cours d'entretien
- l'échec de sauvegarde d'un draft
- l'expiration de la session Gemini

#### Ce qu'il faut faire
- [ ] Distinguer clairement dans l'UI : mode simulé (dev/no-key) vs mode live.
- [ ] Afficher un message d'erreur explicite si la session Gemini échoue (pas de bascule silencieuse en prod).
- [ ] Implémenter une logique de reconnexion WebSocket avec backoff (1s, 3s, 10s) et un message "Reconnexion en cours..." visible.
- [ ] Sur `PUT /draft`, afficher un indicateur de sauvegarde (✓ sauvegardé / ⚠ non sauvegardé).
- [ ] Sur fermeture de l'onglet pendant un entretien, proposer une confirmation (`beforeunload`).
- [ ] Gérer l'expiration du token éphémère Gemini (durée ≈ 30 min) : détecter la fermeture WebSocket avec code 1001/1008 et proposer de relancer la session.

---

### BLOC 7 · Persistance du template sélectionné
**Priorité : MOYENNE**

#### Situation actuelle
Le template (moderne / split / classique) est sélectionné dans `cv-builder-main`
mais n'est **jamais transmis** à l'endpoint `interview/session`.
La création du CV dans `CvService.createInterviewSession()` utilise toujours
`parseTemplateCodeToId("moderne")` par défaut.
Résultat : le template choisi par l'utilisateur est ignoré.

#### Ce qu'il faut faire
- [ ] Transmettre le `templateId` sélectionné dans le body du `POST /interview/session`.
- [ ] Mettre à jour `CvController` et `CvService` pour lire ce champ.
- [ ] Ajouter `template` dans la réponse `InterviewSessionResponse` Angular si nécessaire.

---

### BLOC 8 · Problèmes techniques mineurs mais bloquants à terme

#### 8.1 — Conflit de route Angular
La route `/cvs/interview` (sans `:id`) est définie **avant** `/cvs/:id/interview`.
Angular résoudra `/cvs/interview` comme si `interview` était un `:id`.
```typescript
// app.routes.ts — ordre actuel (incorrect)
{ path: 'cvs/interview', ... },      // jamais atteint
{ path: 'cvs/:id/interview', ... },  // "interview" est capturé comme id
```
- [ ] Inverser l'ordre : mettre `/cvs/interview` **avant** `/cvs/:id/interview`,
  ou supprimer la route sans `:id` si elle n'est pas utilisée.

#### 8.2 — ID CV côté client (`cv_` + timestamp)
```typescript
const newId = 'cv_' + Date.now();
this.router.navigate(['/cvs', newId, 'interview']);
```
L'ID généré côté Angular n'existe pas en base. `CvService.findCvEntity()` le
parse et crée un nouveau CV — mais le `cvId` retourné par `createInterviewSession`
est correct. Le vrai problème est que si la navigation échoue après `createSession`,
l'ID côté Angular et l'ID côté base divergent.

- [ ] Laisser le backend allouer l'ID. Angular ne devrait pas générer un fake ID.
  Naviguer vers `/cvs/new/interview` et laisser le backend créer le CV puis retourner le vrai `cvId`.

#### 8.3 — `@GeneratedValue` vs `id = 1` forcé
`CandidateEntity` a `@GeneratedValue(strategy = GenerationType.IDENTITY)` mais
`DataInitializer` / `V3` insèrent `id = 1` explicitement. Quand Hibernate essaie
de persister un nouveau `CandidateEntity` avec `id = 1` via `save()`, cela peut
provoquer un `EntityExistsException` si la séquence auto-incrément est à 0.

- [ ] Utiliser `saveIfAbsent` ou retirer le `@GeneratedValue` pour le candidat par défaut,
  ou mieux : supprimer ce pattern dès l'implémentation de l'auth.

#### 8.4 — `V1` et `V2` Flyway identiques
Les fichiers `V1__init_emploi_schema_updates.sql` et `V2__init_emploi_schema_updates.sql`
sont identiques. Flyway va échouer au démarrage si les deux ont des checksums différents
ou si V2 essaie de recréer des tables déjà créées par V1.

- [ ] Vérifier les checksums Flyway. Supprimer le doublon ou corriger V2 pour qu'il ne
  duplique pas V1.

#### 8.5 — `GeminiLiveService` partagé singleton
`GeminiLiveService` est `providedIn: 'root'`. Si l'utilisateur ouvre deux onglets
ou navigue vers l'entretien deux fois de suite, le singleton conserve l'état de
la session précédente (WebSocket ouvert, draft non réinitialisé).

- [ ] Vérifier que `resetDraft()` et `stopSession()` sont toujours appelés au début
  de `startSession()`. C'est déjà le cas pour le draft, vérifier le WebSocket.
  Ou passer le service en `providedIn: CvInterviewComponent` (scoped).

---

## 4. Feuille de route recommandée

```
Sprint 1 — SÉCURITÉ (bloquant pour production)
├── BLOC 3 : Supprimer fallback Gemini / externaliser la clé
├── BLOC 1 : Implémenter l'authentification JWT
└── BLOC 2 : Cloisonner les données par candidateId

Sprint 2 — FONCTIONNEL CŒUR
├── BLOC 8.1 : Fix route Angular
├── BLOC 8.2 : Fix ID CV
├── BLOC 7 : Transmission du template sélectionné
└── BLOC 4 : Formulaire d'édition manuelle du CV

Sprint 3 — COMPLET & EXPORTABLE
├── BLOC 5 : Génération PDF (via n8n ou iText)
└── BLOC 6 : Gestion d'erreur UX / reconnexion WebSocket

Sprint 4 — QUALITÉ
├── BLOC 8.3 : Fix GeneratedValue candidat
├── BLOC 8.4 : Fix Flyway V1/V2 doublons
└── BLOC 8.5 : Scope GeminiLiveService
```

---

## 5. Risques identifiés

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Clé Gemini exposée via fallback | Haute (code existant) | Critique | Supprimer le fallback immédiatement |
| Données d'un utilisateur visibles par un autre | Haute (pas d'auth) | Critique | Bloc 1 + Bloc 2 en priorité |
| Session Gemini refusée (payload vide `{}`) | Moyenne | Bloquant | Ajouter `uses`, `expireTime`, `newSessionExpireTime` |
| Flyway V1/V2 doublons → crash au démarrage | Haute | Bloquant | Vérifier et nettoyer les migrations |
| Route Angular `/cvs/interview` jamais atteinte | Haute | Fonctionnel | Réordonner les routes |
| Perte du draft si l'onglet est fermé | Moyenne | Fonctionnel | `beforeunload` + auto-save |
| Génération PDF absente = CV inutilisable | Certaine | Bloquant UX | Sprint 3 |

---

## 6. Ce qui n'est PAS dans le périmètre de ce rapport

- Workflow n8n (scoring, matching, lettre de motivation) → déjà fonctionnel
- Module Opportunités → hors scope
- Module Candidatures → hors scope
- Statistiques / analytics → hors scope
- Infrastructure de déploiement (Docker, CI/CD) → hors scope

---

*Rapport généré par analyse statique complète du code source — backend Spring Boot + frontend Angular 18.*

