# CHANGELOG — Suivi de Développement & Intégration

## [1.2.0] - 2026-09-13

### 💳 Migration vers NotchPay (Paiements Programmatiques) & Résilience avec Fallback WhatsApp

#### 1. Remplacement Intégral de Nokash par NotchPay
- **API Programmatique `POST https://api.notchpay.co/payments`** : Création programmatique de sessions de paiement avec référence interne unique (`PAY-XXXX`), montant (500 ou 1 200 FCFA), devises `XAF`, coordonnées du client et URL de retour.
- **Redirection Automatique** : Redirection fluide vers `authorization_url` hébergé par NotchPay pour paiement sécurisé Mobile Money (Orange, MTN) ou carte bancaire.
- **Sécurité Webhook & Idempotence** :
  - Endpoint `POST /webhooks/notchpay` (et alias `/api/v1/payments/webhooks/notchpay`).
  - Validation cryptographique stricte par signature HMAC-SHA256 (`X-Notch-Signature`) calculée sur le corps brut (*raw body*).
  - Gestion de l'idempotence via la nouvelle table Flyway V10 `notchpay_webhook_event` stockant les identifiants d'événements (`evt_...`).
  - **Double vérification obligatoire** : Appel sortant `GET https://api.notchpay.co/payments/{reference}` pour contrôler le statut et le montant effectif avant tout déverrouillage ou crédit pro.

#### 2. Couche de Résilience & Observabilité ([`NotchPayClient.java`](file:///D:/automatisation/code/backend/src/main/java/com/getjob/backend/payment/client/NotchPayClient.java))
- **Timeouts Dédiés** : Connect timeout 3 000ms, Read timeout 5 000ms.
- **Retry avec Backoff Exponentiel** : 2 à 3 tentatives uniquement sur erreurs transitoires (timeouts réseau, erreurs 5xx). Zéro retry sur erreurs client 4xx.
- **Circuit Breaker Autonome ([`NotchPayCircuitBreaker.java`](file:///D:/automatisation/code/backend/src/main/java/com/getjob/backend/payment/resilience/NotchPayCircuitBreaker.java))** : Bascule en état `OPEN` après 3 échecs consécutifs, évitant de surcharger une API en panne et basculant instantanément les nouveaux paiements vers le fallback WhatsApp.
- **Traçabilité & Métriques** : Logs structurés `[NOTCHPAY_METRICS]` traçant la durée, le code HTTP et le statut de chaque appel.

#### 3. Fallback Défensif : Paiement Assisté par WhatsApp
- **Zéro Blocage Candidat** : En cas d'indisponibilité de NotchPay ou de circuit breaker ouvert, l'utilisateur se voit proposer une finalisation directe sur WhatsApp (`+237 698 76 55 88`).
- **Pré-remplissage Contextuel** : Message prêt à l'envoi avec référence de commande, montant, forfait et nom du candidat.
- **Traçabilité Métier (`FALLBACK_WHATSAPP`)** : Nouveau statut de commande et endpoint `POST /api/v1/payments/fallback-whatsapp/{reference}`.
- **Expérience Utilisateur Empathique** : Modales réactives et ergonomiques conformes aux standards `Mobile-First`.

#### 4. Migration Base de Données Flyway V10 ([`V10__notchpay_integration_and_webhook_events.sql`](file:///D:/automatisation/code/backend/src/main/resources/db/migration/V10__notchpay_integration_and_webhook_events.sql))
- Élargissement de la colonne `status` de `payment_transaction` à `VARCHAR(32)` pour intégrer `FALLBACK_WHATSAPP`.
- Ajout de la colonne `gateway` (`NOTCHPAY`).
- Création de la table d'idempotence `notchpay_webhook_event`.

---

## [1.1.0] - 2026-09-12

### ✨ Nouvelle Landing Page Éditoriale & Expérience d'Accueil (Inspiration Anthropic)

#### 1. Page d'Accueil par Défaut (`path: ''`) & Navigation Préservée ([`app.routes.ts`](file:///D:/automatisation/code/dashboard/src/app/app.routes.ts))
- **Route Racine Publique** : La racine `/` dirige désormais vers `LandingComponent` avec `pathMatch: 'full'` au lieu de rediriger directement vers `/dashboard` (ou `/login`).
- **Structure Interne Intacte** : Tous les chemins applicatifs (`/dashboard`, `/opportunities`, `/cvs`, `/cv-builder`, `/settings`, etc.) restent inchangés et sécurisés par l'`authGuard`.
- **Bouton d'Action Intelligent** : Le header redirige automatiquement les utilisateurs connectés vers leur tableau de bord personnel (`/dashboard`) et propose un accès « Connexion / Commencer » aux nouveaux visiteurs.

#### 2. Direction Artistique & Minimalisme Éditorial ([`landing.component.html`](file:///D:/automatisation/code/dashboard/src/app/features/landing/landing.component.html) & [`landing.component.css`](file:///D:/automatisation/code/dashboard/src/app/features/landing/landing.component.css))
- **Inspiration Anthropic** : Teintes ivoire chaud (`#FAF9F5`), typographie à empattements éditoriale (`Newsreader` serif), texte anthracite doux (`#141413`) et accents terracotta (`#CC785C`).
- **Respiration & Clarté** : Mise en page épurée axée sur la conviction, la promesse d'émancipation par le travail et l'absence de jargon superflu.

#### 3. Vitrine Vidéo & Animation Ambiante Canvas ([`landing.component.ts`](file:///D:/automatisation/code/dashboard/src/app/features/landing/landing.component.ts))
- **Animation Ambiante Canvas Organique** : Reproduction de l'effet de dégradé céleste/terracotta ondoyant en arrière-plan avec gradients radiaux et variations sinusoïdales à 60 FPS.
- **Cadre Vidéo Prêt à l'Emploi** : Structure `<video>` intégrée pour accueillir la vidéo finale de présentation, avec fallback visuel élégant sur `warman_preview.jpg`, bouton play stylisé avec onde de pulsation et pastille de démonstration.

#### 4. Parcours en 4 Étapes avec Flèches « Corde Molle » (Slack Rope Curves)
- **Diagramme de Flux** : Décomposition claire du parcours candidat :
  1. *Étape 01 : Préparer son CV d'élite* (vocal ou import).
  2. *Étape 02 : Configurer ses critères d'ambition*.
  3. *Étape 03 : Laisser Warman chercher 24h/24*.
  4. *Étape 04 : Recevoir les offres directement sur WhatsApp*.
- **Connecteurs « Corde Molle » SVG** : Flèches en courbes de Bézier affaissées sous l'effet de la gravité (`M 0,15 C 16,42 32,42 46,20`), pointillés dynamiques animés et perle de lumière glissante.

#### 5. Section Métiers Démocratisée : « Vendre le Rêve à Tous »
- **Inclusivité Totale** : Mise en avant de 5 grands secteurs (Tech & Numérique, Commerce & Vente, Ingénierie & BTP, Santé & Services, Finance & Administration) pour briser l'idée reçue que Warman ne s'adresse qu'aux développeurs.
- **Témoignages & Cas d'Usage Réels** : Focus sur la réussite sans « piston », la formalisation automatique même sans expérience de rédaction de CV, et la recherche en toute discrétion.

#### 6. Pied de Page Garanti Zéro Lien Factice
- **Liens 100% Vérifiés & Opérationnels** : Liens internes directs vers `/opportunities`, `/cv-builder`, `/cvs/interview`, `/login`, assistance WhatsApp directe et adresse e-mail de contact.

---

## [1.0.9] - 2026-09-12

### 💳 Contrôle d'Éligibilité OCR : Réservé aux Comptes avec ≥ 2 Crédits Pro (0 Débit)

#### 1. Sécurisation Backend ([`CvService.java`](file:///D:/automatisation/code/backend/src/main/java/com/getjob/backend/cv/service/CvService.java))
- **Condition de Solde Strict (`proCredits >= 2`)** : L'endpoint `POST /api/v1/cvs/import` vérifie que le candidat connecté possède au moins 2 crédits Pro (`candidate.getProCredits() >= 2`).
- **Zéro Déduction** : Aucun crédit n'est déduit lors de l'import. Les 2 crédits restent intégralement disponibles pour déverrouiller et exporter les CV ultérieurement.
- **Réponse HTTP 402** : Si le solde est insuffisant (< 2), renvoie l'erreur `INSUFFICIENT_CREDITS`.

#### 2. Contrôle Ergonomique Frontend ([`cv-list.component.ts`](file:///D:/automatisation/code/dashboard/src/app/features/cvs/pages/cv-list/cv-list.component.ts) & [`cv-builder-main.component.ts`](file:///D:/automatisation/code/dashboard/src/app/features/cv-builder/pages/cv-builder-main/cv-builder-main.component.ts))
- **Vérification Amont (`handleImportClick`)** : Avant même d'ouvrir l'explorateur de fichiers, le frontend contrôle le solde. Si le candidat possède moins de 2 crédits, la modale de recharge des packs s'ouvre automatiquement.
- **Badge & Indicateur Visuel** : Ajout d'une pastille discrète `2 cr` sur les boutons « Importer » dans la liste des CVs et dans le créateur.

---

## [1.0.8] - 2026-09-12

### 📄 Pipeline OCR Multimodal & Édition / Chat IA sur CV Téléversé

#### 1. Intégrité Complète de l'Extraction OCR vers les Templates ([`cv-editor.service.ts`](file:///D:/automatisation/code/dashboard/src/app/core/services/cv-editor.service.ts))
- **Préservation Intégrale des Réalisations** : `newExperience()` fusionne désormais de façon dédoublonnée à la fois les missions (`responsibilities`) et les accomplissements chiffrés (`achievements`), sans perte d'information.
- **Enrichissement Automatique des Compétences** : Les technologies et outils identifiés par l'OCR dans chaque bloc d'expérience sont automatiquement injectés et fusionnés dans la section globale des compétences (`skills`).

#### 2. Flux Complet Téléversement ➔ Template ➔ Édition Manuelle ➔ Chat IA
- **Bouton d'importation** : Disponible sur la liste des CVs (`/cvs`) et dans le créateur (`/cv-builder`).
- **Analyse OCR Gemini** : Extraction multimodale sans perte depuis PDF ou Image.
- **Remplissage automatique du Template** : Redirection directe vers l'éditeur avec prévisualisation en temps réel sur le template choisi.
- **Édition bivalente** :
  - Modification manuelle directe sur tous les champs (auto-sauvegarde).
  - Onglet **« Assistant IA »** permettant de chatter avec Gemini pour optimiser les phrases, chiffrer les réalisations et perfectionner le CV en direct.

---

## [1.0.7] - 2026-09-12

### 🔍 Nouvel Outil Déterministe `audit_cv_integrity` : Détection Proactive des Anomalies & Incohérences

#### 1. Moteur d'Audit Algorithmique Temps Réel ([`cv-audit-engine.service.ts`](file:///D:/automatisation/code/dashboard/src/app/core/services/cv-audit-engine.service.ts))
- **Chevauchements Chronologiques (`OVERLAP`)** : Analyse fine des intervalles de dates (années/mois) entre toutes les expériences. Détecte les cumuls suspects (> 2 mois d'intersection simultanée) et formule une question orale prête pour Bray (*« J'ai remarqué que tes postes chez X et Y se croisent... Était-ce un freelance ou une coquille de dates ? »*).
- **Dates Inversées (`CHRONOLOGY`)** : Détection des anomalies où `startDate > endDate`.
- **Détection des Doublons (`DUPLICATE`)** : Repérage des expériences dupliquées (même entreprise/poste) et compétences redondantes (ex: *React* et *React.js*).
- **Incomplétudes (`INCOMPLETE`)** : Signalement des expériences sans réalisations concrètes (`achievements` vides), sans technologies (`technologies` vides), ou diplômes sans années d'obtention.
- **Score Global de Cohérence** : Notation dynamique de 0 à 100% avec pénalités pondérées selon la criticité.

#### 2. Déclaration du Tool Multimodal Gemini Live ([`gemini-live-ws-client.service.ts`](file:///D:/automatisation/code/dashboard/src/app/core/services/gemini-live-ws-client.service.ts))
- Ajout de la fonction déclarative `audit_cv_integrity` dans le handshake `setup` de Gemini Live, avec exécution instantanée en mémoire côté client sans appel réseau supplémentaire.

#### 3. Guidance Proactive de l'IA & Élimination des Doutes ([`interview-algorithm.prompt.ts`](file:///D:/automatisation/code/dashboard/src/app/core/prompts/cv-interview/interview-algorithm.prompt.ts))
- L'algorithme d'entretien ordonne à Bray de déclencher systématiquement `audit_cv_integrity` dès que les expériences principales sont réunies ou avant de proposer la finalisation.
- En cas d'anomalie détectée, Bray prend l'initiative de poser une question bienveillante et constructive pour clarifier la situation avant de figer le CV.

#### 4. Affichage Visuel Live pour le Candidat ([`cv-interview.component.html`](file:///D:/automatisation/code/dashboard/src/app/features/cvs/pages/cv-interview/cv-interview.component.html))
- Intégration d'une carte d'audit en direct dans l'interface d'entretien affichant le score de cohérence (ex: 95%) et les points d'éclaircissement en cours de traitement.

---

## [1.0.6] - 2026-09-12

### 🛡️ Stabilisation de l'Entretien Vocal & Fiabilisation du CV (Version 1.0.6)

#### 1. Mise à Jour Rétroactive des Sections sans Régression (`mergeDraft` In-Memory)
- **Préservation des Acquis** : L'IA peut modifier à n'importe quel moment une expérience, formation ou compétence évoquée 10 minutes plus tôt.
- **Algorithme de Fusion Atomique** : `mergeDraft()` applique une mise à jour ciblée (par `company + position` pour les expériences, `school + degree` pour les formations, union `Set` pour les compétences) sans écraser ni démultiplier les éléments déjà validés.

#### 2. Datation Strictement Obligatoire des Expériences & Formations
- **Règles Strictes de Validation** : Dans [`draft-tool-rules.prompt.ts`](file:///D:/automatisation/code/dashboard/src/app/core/prompts/cv-interview/draft-tool-rules.prompt.ts) et [`interview-algorithm.prompt.ts`](file:///D:/automatisation/code/dashboard/src/app/core/prompts/cv-interview/interview-algorithm.prompt.ts), interdiction formelle d'appeler `update_cv_draft` pour une expérience sans dates (`startDate` et `endDate` ou « Présent »).
- **Relance Systématique** : Si le candidat omet de situer une expérience ou un diplôme dans le temps, Bray lui demande systématiquement la période avant d'intégrer la section dans le CV.

#### 3. Résilience Réseau & Reprise Immédiate sans Perte après Coupure
- **Sauvegarde Continue & Cache Local (10 min)** : Le brouillon et la transcription sont synchronisés en continu dans [`InterviewSessionCacheService.ts`](file:///D:/automatisation/code/dashboard/src/app/core/services/interview-session-cache.service.ts).
- **Accueil de Reprise Intelligent** : En cas de reconnexion, `buildStartTrigger` génère une salutation fraternelle adaptée (« Rebonjour [Prénom] ! Rassure-toi, toutes nos notes sont bien sauvegardées... ») et réinjecte le résumé des acquis pour que Bray sache immédiatement où en était l'échange.
- **Protection Anti-Double Décompte du Quota Backend** : Dans [`CvService.java`](file:///D:/automatisation/code/backend/src/main/java/com/getjob/backend/cv/service/CvService.java), détection de session active (`isResumingActiveSession`). Reconnecter après une coupure ne consomme aucun quota additionnel et n'est jamais bloqué même si le candidat est à sa 3e session du jour.

#### 4. Gestion Bienveillante des Voix Inaudibles & Bruits Parasites
- **Zéro Hallucination** : Si le son coupe ou est incompréhensible, l'IA ne devine pas. Elle demande gentiment : « Excuse-moi [Prénom], le son a légèrement coupé / je n'ai pas bien entendu ta dernière phrase. Peux-tu me la répéter s'il te plaît ? ».

#### 5. Transparence Totale des Quotas & Gratuité de l'Édition Manuelle
- **Création & Édition Manuelle 100% Gratuites** : L'éditeur de CV manuel (`/cv-builder`) ne consomme ni les 3 entretiens vocaux IA quotidiens, ni les `proCredits`. Les `proCredits` sont réservés à l'exportation PDF finale sans filigrane / déverrouillage de template Pro.

---

## [1.0.5] - 2026-09-12

### 👤 Salutation Nominative Personnalisée : « Bonjour [Prénom] ! »

#### 1. Accueil Personnalisé Dès la Première Seconde
- **Extraction automatique du prénom** : Ajout de la méthode `extractCandidateFirstName()` dans [`gemini-live.service.ts`](file:///D:/automatisation/code/dashboard/src/app/core/services/gemini-live.service.ts) analysant le compte connecté (`authService.currentUser()`) ou le brouillon courant.
- **Instruction impérative au démarrage** : La fonction `buildStartTrigger(firstName)` dans [`index.ts`](file:///D:/automatisation/code/dashboard/src/app/core/prompts/cv-interview/index.ts) ordonne explicitement à l'IA d'ouvrir l'entretien par « Bonjour [Prénom] ! » plutôt qu'un « Bonjour » impersonnel.
- **Injection dans l'identité du candidat (`setup`)** : Le prénom est transmis lors du handshake initial dans [`gemini-live-ws-client.service.ts`](file:///D:/automatisation/code/dashboard/src/app/core/services/gemini-live-ws-client.service.ts) pour que Bray s'adresse au candidat par son prénom de manière naturelle et respectueuse tout au long de la conversation.

---

## [1.0.4] - 2026-09-12

### 🌍 Personnalisation Vocale : Voix Africaine Chaleureuse, Modèle Charon & Calibrage Acoustique Posé

#### 1. Transition vers la Voix `Charon`
- Remplacement du profil vocal de base `Puck` par **`Charon`** dans [`gemini-live-ws-client.service.ts`](file:///D:/automatisation/code/dashboard/src/app/core/services/gemini-live-ws-client.service.ts). Cette voix offre un timbre masculin plus grave, mature, chaleureux et posé, idéal pour une posture d'aîné ou de mentor professionnel.

#### 2. Prosodie Africaine Francophone & Posture de Mentor
- Mise à jour du System Prompt dans [`recruiter-persona.prompt.ts`](file:///D:/automatisation/code/dashboard/src/app/core/prompts/cv-interview/recruiter-persona.prompt.ts) et du déclencheur d'accueil dans [`index.ts`](file:///D:/automatisation/code/dashboard/src/app/core/prompts/cv-interview/index.ts) :
  - Intonation naturelle, chantante, chaleureuse et posée d'Afrique francophone (style subsaharien / ouest-africain moderne, élégant, convivial et respectueux).
  - Posture de grand frère recruteur senior ou mentor d'élite, alliant bienveillance sincère et exigence professionnelle.
  - Débit de parole détendu, réfléchi et articulé, avec respirations naturelles.

#### 3. Calibrage du Débit & Égalisation Acoustique Chaleureuse
- **Débit à 0.96x** dans [`AudioPcmEngineService.ts`](file:///D:/automatisation/code/dashboard/src/app/core/services/audio-pcm-engine.service.ts) avec synchronisation mathématique du pointeur temporel `nextPlayTime += duration / 0.96` pour éviter toute précipitation.
- **Filtre acoustique Warm EQ (`BiquadFilterNode`)** : Rehaussement subtil des bas-médiums (+2.5 dB à 320 Hz) pour donner de la rondeur, du corps et une présence studio naturelle à la voix diffusée.

---

## [1.0.3] - 2026-09-12

### 🎙️ Résolution Définitive des Voix Parallèles Gemini Live au Lancement de l'Entretien

#### 1. Sas Acoustique Initial & Verrouillage du Microphone au Handshake
- **Cause racine** : Lors du handshake WebSocket (`onSetupComplete`), le frontend passait immédiatement l'état à `'LISTENING'` et envoyait le prompt textuel `CV_INTERVIEW_START_TRIGGER`. Pendant les 1 à 2 secondes où Google préparait l'accueil oral de Bray, le microphone était actif et envoyait des chunks audio continus (`realtimeInput`) à Google. Le modèle Gemini Live recevant simultanément le prompt textuel et le flux audio ambiant du micro déclenchait **deux générations concurrentes**. De plus, les premiers mots de l'IA diffusés par les haut-parleurs étaient captés par le micro avant la mise à jour de l'état, provoquant un feedback acoustique immédiat.
- **Solution implémentée (`gemini-live.service.ts`)** :
  - Mise en place d'un sas acoustique hermétique au démarrage (`initialGreetingPending = true`).
  - Le microphone est **physiquement verrouillé et muté côté client** dès la connexion et pendant toute la durée où l'IA génère et énonce son accueil introductif.
  - Le micro ne s'ouvre pour écouter le candidat qu'**après** la fin effective de la lecture audio des haut-parleurs (`onAudioEnd`) suivie d'un délai d'extinction de réverbération de 400 ms.

#### 2. Verrou d'Exclusion Mutuelle Anti-Double Session (`isSessionStarting`)
- Ajout d'un mutex booléen strict empêchant tout déclenchement concurrent de `startSession()` lors de double-clics, navigations rapides ou cycles de vie Angular.

---

## [1.0.2] - 2026-09-12

### 🛡️ Blindage Backend Production Ready : Monétisation, Anti-IDOR, Concurrence BDD & Isolation Transactions

#### 1. Monétisation & Éradication du Crédit Gratuit
- **Solde Initial à 0** : Suppression définitive du crédit gratuit par défaut dans `CandidateEntity` (`proCredits = 0`) et dans le mapper `toAuthResponse()` (`candidate.getProCredits() != null ? candidate.getProCredits() : 0`). Tout déverrouillage de CV en haute définition requiert désormais obligatoirement un achat effectif via Nokash (500 FCFA) ou un pack pro.

#### 2. Sécurisation Webhook & Contrôle Cryptographique HMAC-SHA256
- **Vérification Multi-Format en Temps Constant** : Implémentation de `verifyWebhookSignature` dans `PaymentService` prenant en charge à la fois la comparaison en temps constant (`MessageDigest.isEqual`) et le calcul HMAC-SHA256 (format hexadécimal et base64) de la référence avec `NOKASH_WEBHOOK_SECRET`.
- **Idempotence & Verrouillage Pessimiste** : Utilisation de `findByReferenceForUpdate` avec `PESSIMISTIC_WRITE` dans `PaymentTransactionRepository` pour garantir qu'aucun callback dupliqué ou concurrent ne puisse double-créditer un candidat.

#### 3. Protection Anti-IDOR & Atomicité des Crédits Pro
- **Contrôle d'Appartenance Strict du CV** : Vérification systématique que `cv.getCandidateId().equals(candidateId)` dans `initiatePayment` et `useProCredit`. Aucune transaction ou déverrouillage ne peut être initié sur le CV d'un tiers.
- **Déduction Atomique en Base de Données** : Implémentation de `decrementProCreditIfAvailable` avec `UPDATE candidate SET proCredits = proCredits - 1 WHERE id = :id AND proCredits > 0` pour éliminer toute faille de concurrence (race condition) et de double dépense lors de clics simultanés.

#### 4. Résolution de l'Erreur 500 sur Login Non Vérifié & Sécurisation Google OAuth
- **Capture Propre de `DisabledException`** : Ajout d'un intercepteur dans `AuthService.login()` et d'un gestionnaire dédié dans `GlobalExceptionHandler` renvoyant une réponse RFC 7807 403 Forbidden explicite (`EMAIL_NOT_VERIFIED`) avec réémission automatique d'un code de validation si expiré.
- **Validation d'Audience Google Obligatoire** : Rejet immédiat avec HTTP 503 si `GOOGLE_CLIENT_ID` n'est pas configuré, empêchant l'acceptation de jetons Google ID tiers non autorisés.

#### 5. Libération des Connexions HikariCP & Anti-Starvation
- **Isolation des Appels IA Hors Transactions SQL** : Suppression de `@Transactional` sur `synthesizeCvFromTranscript`, `aiEditCv`, `importCvFromFile` (`CvService`) et `prepareApplication` (`OpportunityService`). Les appels réseau vers l'API Google Gemini (3 à 25s) ne bloquent plus aucune connexion MySQL dans le pool HikariCP. La persistance est isolée dans des méthodes transactionnelles courtes et ciblées.
- **Génération Texte Fluide (Lettres de Motivation)** : Ajout de `generatePlainTextContent` dans `GeminiLiveTokenService` pour générer des lettres de motivation en texte clair sans conflit avec le mode JSON.

#### 6. Sécurisation des Routes Vocales & Hygiène de Production
- **Bridage de `RealtimeVoiceController`** : Suppression de la route `GET /session` avec effets de bord et délégation de `POST /session` à `CvService.createInterviewSession("latest")` pour appliquer le quota journalier de 3 entretiens par candidat.
- **Détection IP Proxy dans `RateLimitFilter`** : Extraction prioritaire de `X-Forwarded-For` pour éviter les faux positifs de blocage massif derrière un reverse proxy Nginx ou Docker.
- **Flyway & Logging** : Configuration conditionnelle de `flyway.repair()` via `spring.flyway.repair-on-migrate: false` et passage du niveau de log applicatif à `INFO` par défaut.
- **Uniformisation de la Marque** : Remplacement des mentions résiduelles `JobPilot` par `GetJob AI` dans `AuthEmailService` et les modèles d'environnement.

---

## [1.0.1] - 2026-09-12

### 🎙️ Audio Live & Transcription Ligne par Ligne : Résolution Multi-Voix, Écho et Rendu Textuel Fluide

#### 1. Résolution du Chevauchement de Voix Multiples (Anti-Larsen & Isolation WebSocket)
- **Boucle Acoustique de Rétroaction (Effet Larsen Virtuel)** :
  - *Cause racine* : Lorsque l'IA parlait, sa voix diffusée par les haut-parleurs de l'ordinateur était recapturée à 16 kHz par le micro et renvoyée en continu à Gemini Live via `sendAudioChunk()`. Le VAD serveur de Google (`START_OF_ACTIVITY_INTERRUPTS`) interprétait le son des haut-parleurs comme une interruption humaine, coupait le tour en cours et déclenchait une nouvelle réponse en parallèle, provoquant une cascade de voix simultanées.
  - *Solution fonctionnelle* : Mise en place d'un sas acoustique semi-duplex dynamique. Dès que l'IA prend la parole (`state === 'AI_SPEAKING'`), la transmission des paquets audio microphone vers le WebSocket est totalement coupée. Lorsque l'IA termine sa phrase, un délai d'extinction (hangover cooldown de 400 ms) est appliqué pour absorber la réverbération de la pièce avant de réouvrir le canal microphone.
- **Fuites de Connexions WebSocket (Zombie Sockets)** :
  - *Cause racine* : En cas de reconnexion, de retry utilisateur ou de cycle de vie Angular (double `ngOnInit` / HMR), l'ancienne socket WebSocket n'était pas fermée avant la création de la nouvelle, entraînant la coexistence de plusieurs flux audio joués concurremment dans le même `AudioContext`.
  - *Solution fonctionnelle* : Appel strict et systématique à `this.disconnect()` dans `GeminiLiveWsClientService.connect()` et `this.stopSession()` au début de `GeminiLiveService.startSession()`, avec purge intégrale des écouteurs d'événements.
- **Interruption Nette & Purge des Chunks Résiduels** :
  - *Cause racine* : Lors d'une interruption (`onInterrupted`), des chunks audio en transit sur le réseau continuaient d'arriver et de se chaîner au playback.
  - *Solution fonctionnelle* : Réinitialisation immédiate du pointeur temporel `nextPlayTime = 0`, détachement des callbacks `onended` et arrêt forcé de tous les `AudioBufferSourceNode` actifs dans `AudioPcmEngineService.interruptPlayback()`.
- **Câblage Réel du Bouton Mute** :
  - *Cause racine* : Le signal `isMuted` n'était que visuel dans `CvInterviewComponent`.
  - *Solution fonctionnelle* : Liaison bidirectionnelle avec `geminiService.setMuted()` et `audioEngine.setMuted()`, bloquant l'émission de paquets audio dès l'activation du mode muet.

#### 2. Restauration de la Transcription en Direct (Input & Output ASR)
- *Cause racine* : Lors de la migration vers `gemini-live-ws-client.service.ts`, les blocs de configuration `inputAudioTranscription: {}` et `outputAudioTranscription: {}` avaient été omis du payload de `setup`, et les messages `serverContent.inputTranscription` et `serverContent.outputTranscription` n'étaient plus interceptés.
- *Solution fonctionnelle* : Réintégration des déclarations de transcription dans le handshake WebSocket et traitement dédié dans `handleServerMessage()`.

#### 3. Rendu de la Transcription Ligne par Ligne (Éradication du Sautillement Mot par Mot)
- *Cause racine* : La transcription brute envoyée par l'API arrivait par micro-fragments (1 à 2 mots) et déclenchait une mise à jour immédiate du signal Angular `transcript`, entraînant un clignotement permanent de l'interface et un comportement de machine à écrire saccadé.
- *Solution fonctionnelle* : Implémentation d'un buffer de lignes (`lineBuffers`) avec découpage syntaxique sur la ponctuation forte (`.`, `?`, `!`, `:`, `\n`). Les phrases ne sont affichées dans la bulle de discussion que lorsqu'elles sont complètes, avec un flush de secours temporisé à 800 ms lors des pauses d'élocution. Ajout de `whitespace-pre-line` dans le template HTML pour une mise en page aérée et naturelle.

---

## [1.0.0-rc1] - 2026-09-11

### 🛡️ Sécurisation Intégrale, Liens de Paiement Nokash, Gemini 2.0 Officiel & Vrai Scoring d'Opportunités

#### 1. Sécurisation & Intégration Réelle des Liens de Paiement Nokash
- **Liens de Paiement Hébergés Prédéfinis** : Redirection transparente vers la page de paiement officielle avec montants configurés :
  - **1 CV (Unitaire)** : 500 FCFA (`PAYMENT_LINK_PACK_1`).
  - **Pack 3 CVs** : 1 200 FCFA (`PAYMENT_LINK_PACK_3`, remise de 20%).
- **Sécurisation Cryptographique du Webhook (`X-Signature`)** :
  - Validation de la signature HMAC-SHA256 sur l'endpoint `/api/v1/payments/webhook` à l'aide de `NOKASH_WEBHOOK_SECRET`.
  - Contrôle strict du statut transmis (`SUCCESS` ou `PAID`) avant déverrouillage ou allocation de crédits pro.
- **Éradication des Fautes de Sécurité & Contournements Client** :
  - Suppression définitive du bypass hors-ligne (`catchError` qui accordait les déverrouillages gratuitement en cas d'erreur réseau).
  - Élimination de l'endpoint de simulation d'approbation `/verify/{reference}` au profit d'un endpoint de consultation en lecture seule `/api/v1/payments/status/{reference}`.
  - Initialisation défensive du solde de crédits pro à 0 en cas de profil non initialisé.
- **Protection des Clés & Secrets** :
  - Ajout des chemins `ressources/clé nokash/` et `clés.txt` dans le `.gitignore` racine et backend.
  - Centralisation des configurations de paiement dans `.env` et `.env.example`.

#### 2. Protection Renforcée de l'Export PDF & Filigrane Inamovible
- **Verrouillage par Défaut** : `isUnlocked` initialisé à `false` par défaut dans `PdfExportService.ts`.
- **Validation Serveur Obligatoire** : Interrogation systématique de `paymentService.isCvUnlocked(cvId)` depuis `CvListComponent` et `CvBuilderMainComponent` avant tout export non filigrané.
- **Neutralisation du Contournement par Impression** : Désactivation de l'appel `window.print()` lorsque le CV n'a pas été déverrouillé côté serveur.

#### 3. Modèles Google Gemini (Live 3.1 & Multimodal Flash)
- **Modèle Live Audio 3.1** :
  - WebSocket Audio Bidirectionnel : `gemini-3.1-flash-live-preview` (modèle Google Gemini Live de référence retenu pour les sessions vocales interactives).
  - Génération Textuelle & Multimodale : `gemini-2.0-flash`.
- **Alignement Fullstack** : Configuration synchronisée dans `application.yml`, `GeminiLiveTokenService.java`, `.env`, `.env.example`, et le fallback WebSocket de `gemini-live.service.ts`.

#### 4. Algorithme Dynamique de Scoring d'Opportunités & Élimination du Spam BD
- **Suppression du Score Statique de 85%** : Calcul dynamique de l'affinité compétences/intitulés entre le profil du candidat et chaque offre (`computeMatching`), produisant un score réaliste entre 45% et 95%.
- **Éradication de l'Injection Massive de Candidatures** : Suppression définitive de `ensureInitialApplicationsForCandidate()` qui spammait des dizaines d'enregistrements d'applications en base de données lors d'une simple requête `GET /api/v1/opportunities`.

#### 5. Vraie Génération de Lettres de Motivation & Persistance MySQL (Flyway V9)
- **Migration Flyway V9** : Création de `V9__add_cover_letter_text_to_application.sql` ajoutant la colonne `cover_letter_text LONGTEXT` à la table `application`.
- **Génération IA Réelle** : Appel à `geminiLiveTokenService.generateStructuredContent` lors de `prepareApplication` pour générer une lettre personnalisée stockée directement en base de données.
- **Endpoint Dédié** : `GET /api/v1/opportunities/{id}/cover-letter` renvoyant le texte réel pour affichage dans la vue de détail.
- **Suppression des Fausses Références MinIO** : Abandon de l'infrastructure S3/MinIO fictive au profit du stockage relationnel optimisé.

#### 6. Stabilisation Frontend & Visualiseur Réactif
- **Nettoyage de `CvInterviewComponent`** : Suppression des méthodes dupliquées `ngOnInit` et `setupAudioVisualizer`.
- **Visualiseur d'Ondes Réactif** : Visualiseur animé réagissant en temps réel aux signaux `isAiSpeaking()` et `isUserSpeaking()`.
- **Validation TypeScript** : Compilation `npx tsc --noEmit` validée avec 0 erreur.

---

## [0.9.4] - 2026-09-01

### 💳 Simplification Intégrale des Forfaits & Tunnel de Paiement (Focus Cameroun : 1 CV / 3 CVs)

#### 1. Simplification du Parcours & Forfaits (Mobile-First)
- **Ciblage Exclusif Cameroun (+237, FCFA)** : Élimination du sélecteur multi-pays superflu et focalisation sur les paiements locaux.
- **Deux Offres Épurées** :
  - **1 CV (Unitaire)** : 500 FCFA (Déverrouillage immédiat du CV).
  - **Pack 3 CVs** : 1 200 FCFA (Remise `-20%`, 400 FCFA/CV, 1 CV déverrouillé + 2 crédits pour les prochaines versions).
- **Opérateurs Mobile Money Dédiés** :
  - Emplacements et badges de marque réservés pour **Orange Money** (`#ff7900`) et **MTN Mobile Money** (`#ffcc00`).
- **Préremplissage Indicatif Local** : Préfixe `🇨🇲 +237` fixe avec saisie du numéro national (`6XX XX XX XX`).

#### 2. Alignement Backend Spring Boot (`PaymentService.java`)
- Tarification standardisée en `FCFA` / `XAF` : `PRICE_PACK_1_FCFA = 500` et `PRICE_PACK_3_FCFA = 1200`.
- Déverrouillage automatique du CV et crédit des packs restants sur `CandidateEntity.proCredits`.

#### 3. Refonte Modales Frontend Angular 18 (`PaymentModalComponent`, `AgentPackModalComponent`, `PaymentService.ts`)
- Interface allégée, fluide et ergonomique sans surcharge d'options.

---

## [0.9.3] - 2026-09-01

### 🧹 Assainissement & Persistance Réelle du Profil Candidat (Base de Données MySQL)

#### 1. Couche Backend Spring Boot (`CandidateProfileController`, `CandidateProfileService`, `CandidateProfileDto`)
- **Nouveaux Endpoints REST Sécurisés** :
  - `GET /api/v1/candidate/profile` : charge le profil consolidé du candidat connecté (`CandidateEntity` + JSON `rawData` de `candidate_profile`).
  - `PUT /api/v1/candidate/profile` : met à jour en base MySQL les critères de recherche (objectifs, salaire, contrats, localisation, compétences, instructions IA, notifications).
- **Multi-Tenancy & IDOR** : Résolution stricte de l'utilisateur connecté via `SecurityContextHolder`.

#### 2. Couche Frontend Angular 18 (`CandidateProfileApiService`, `ProfileMainComponent`, `SettingsMainComponent`)
- **Éradication du Stockage Local Simulé** : Suppression des clés `localStorage` obsolètes (`jobpilot_profile_*`, `jobpilot_settings_*`) au profit d'appels HTTP réactifs vers l'API REST.
- **Service API Centralisé** : [`CandidateProfileApiService.ts`](file:///D:/automatisation/code/dashboard/src/app/core/services/candidate-profile-api.service.ts) pour `ProfileMainComponent` et `SettingsMainComponent`.
- **Suppression des Fichiers Morts / Orphelins** : Suppression définitive de `mock-api.interceptor.ts` et `openai-realtime.service.ts`.

---

## [0.9.2] - 2026-08-31

### 🏗️ Refonte Architecturale Majeure : Rendu PDF ATS, Découpage Modulaire & Résilience Cache

#### 1. Moteur d'Export PDF Nativement ATS & Vectoriel (`PdfExportService.ts`)
- **Couche Texte Vectorielle Native** : Injection d'une couche typographique vectorielle invisible indexable et sélectionnable (`3 Tr` mode PDF natif) sur chaque page A4 pour garantir la compatibilité à 100% avec les parseurs ATS (Applicant Tracking Systems).
- **Rendu Haute Résolution** : Augmentation de l'échelle à `scale = 2.5` assurant une netteté d'impression optimale.
- **Sécurité Préservée** : Maintien du filigrane anti-fraude non déverrouillé (`500 FCFA REQUIS`).

#### 2. Découpage Modulaire Frontend & Nettoyage Monolithe
- **Éclatement de `gemini-live.service.ts`** (passé de 1 817 lignes à 260 lignes) :
  - [`AudioPcmEngineService.ts`](file:///D:/automatisation/code/dashboard/src/app/core/services/audio-pcm-engine.service.ts) : Isolation complète de la capture micro (PCM 16k mono) et de la lecture continue gapless (PCM 24k).
  - [`GeminiLiveWsClientService.ts`](file:///D:/automatisation/code/dashboard/src/app/core/services/gemini-live-ws-client.service.ts) : Gestionnaire du cycle de vie WebSocket, handshake `setup`, régulation de bande passante et routage des frames.
  - [`GeminiLiveService.ts`](file:///D:/automatisation/code/dashboard/src/app/core/services/gemini-live.service.ts) : Façade réactive fournissant exactement les mêmes Signals et méthodes publiques sans rupture de contrat.

#### 3. Résilience Réseau & Cache Local 10 Minutes (`InterviewSessionCacheService.ts`)
- **Persistance Continue** : Sauvegarde automatique du draft et des tours de parole de l'entretien dans le `localStorage`.
- **Règles d'Éviction Automatique** : Purge systématique des contextes et échanges datant de plus de 10 minutes à l'initialisation et au démarrage de session.
- **Reconnexion Transparente** : Restauration immédiate de l'état en cas de rafraîchissement de page ou micro-coupure réseau.

#### 4. Architecture Modulaire des Prompts & Guardrails XML (`core/prompts/cv-interview/`)
- **Structure par Dossier Extensible** :
  - `identity-and-guardrails.prompt.ts` : Balises XML strictes (`<identity>`, `<security_guardrails>`), neutralisation d'injections et protection de l'assistant Bray.
  - `recruiter-persona.prompt.ts` : Posture et style conversationnel.
  - `interview-algorithm.prompt.ts` : Calibration selon le profil (junior, confirmé, reconversion) et critères de fin.
  - `draft-tool-rules.prompt.ts` : Spécifications et conditions minimales pour l'outil `update_cv_draft`.
  - `index.ts` : Consolidation et export sans impact sur les consommateurs existants.

#### 5. Découpage Backend Spring Boot (`CvAiOperationsService.java`, `CvService.java`)
- **Service IA Dédié** : Extraction des opérations IA (`executeAiEdit`, `parseDocumentToJson`) dans `CvAiOperationsService.java`.
- **Façade Métier Épurée** : Maintien de l'ensemble des endpoints REST et règles de sécurité / multi-tenancy.

---

## [0.9.1] - 2026-08-31

### 🤖 Migration Globale vers Google Gemini 3.1 (Live & Multimodal Flash)

#### 1. Couche Backend Spring Boot (`GeminiLiveTokenService.java`, `application.yml`, `.env`)
- **Modèle Live Audio 3.1** : Configuration par défaut et runtime basculés vers `gemini-3.1-flash-live-preview` (`GEMINI_LIVE_MODEL`).
- **Modèle Restructuration & Vision 3.1** : Configuration dynamique du modèle textuel / multimodal (`GEMINI_MODEL: gemini-3.1-flash-preview`), supprimant tout nom de modèle hardcodé dans `generateStructuredContent` et `generateStructuredContentFromDocument`.
- **Alignement des Templates d'Environnement** : Mise à jour de `.env`, `.env.example` et `.env.production.example` avec les variables `GEMINI_LIVE_MODEL` et `GEMINI_MODEL`.

#### 2. Couche Frontend Angular 18 (`gemini-live.service.ts`)
- **Mise à jour du Fallback Frontend** : Remplacement de l'ancien fallback `gemini-2.0-flash-exp` par `gemini-3.1-flash-live-preview` pour les connexions WebSocket temps réel bidirectionnelles.

#### 3. Documentation & Référentiel Technique
- **`CONTEXTE_PROJET.md`** : Mise à jour exhaustive des flux de diagrammes de séquence et d'architecture pour refléter l'utilisation exclusive de Gemini 3.1.

---

## [0.9.0] - 2026-08-30

### 💳 Module de Paiement Mobile Money B2C & Portefeuille de Crédits Guichet Cybercafé B2B2C

#### 1. Modèle de Données & Migration Flyway V8 (`db/migration/V8__create_payment_and_pro_credit_tables.sql`)
- **Portefeuille de Crédits Pro sur `candidate`** :
  - `pro_credits` (`INT NOT NULL DEFAULT 0`) : solde disponible pour les gérants de cybercafés et secrétariats publics.
  - `is_pro_agent` (`BOOLEAN DEFAULT FALSE`) : statut agent / gérant de guichet.
  - `agent_shop_name` (`VARCHAR(150)`) : nom de l'établissement (ex: *Cybercafé Le Savoir*).
- **Table `payment_transaction`** :
  - Enregistrement des transactions financières : `reference` unique (`PAY-XXXX`), `candidate_id`, `cv_id`, `type` (`SINGLE_CV`, `PRO_PACK`), `amount`, `currency`, `country_code`, `operator` (`WAVE`, `ORANGE`, `MTN`, `MOOV`, `FREE`, `CARD`), `phone_number`, `status` (`PENDING`, `SUCCESS`, `FAILED`, `CANCELLED`), `credits_granted`.
  - Clés étrangères strictes et index de performance sur `reference`, `candidate_id`, `status`.
- **Table `cv_unlock`** :
  - Traçabilité des CVs déverrouillés en HD : `cv_id`, `candidate_id`, `transaction_id`, `unlock_method` (`SINGLE_PAYMENT`, `PRO_CREDIT`, `ADMIN_GRANT`), `client_name`, `unlocked_at`.

#### 2. Couche Backend Spring Boot 3.3 (Java 21)
- **Entités & Repositories JPA (`com.getjob.backend.payment.*`)** :
  - `PaymentTransactionEntity`, `CvUnlockEntity`, enums `PaymentType`, `PaymentStatus`, `UnlockMethod`.
  - `PaymentTransactionRepository` et `CvUnlockRepository` avec filtrage strict par `candidateId` connecté pour éliminer tout risque d'IDOR / fuite de données.
- **Service Métier (`PaymentService.java`)** :
  - **Tarif unitaire fixe** : **500 FCFA** (ou 0,80 € / $0.90) par déverrouillage de CV.
  - **Packs Pro Cybercafé** : Pack 20 CVs (7 500 FCFA / -25%), Pack 100 CVs (25 000 FCFA / -50%), Pack 500 CVs (90 000 FCFA / -64%).
  - **Idempotence stricte (`useProCredit`)** : Vérifie l'existence préalable dans `cv_unlock` avant toute déduction. Un CV déjà déverrouillé consomme strictement 0 crédit supplémentaire.
  - **Atomicité transactionnelle (`@Transactional`)** : Rollback automatique en cas d'interruption réseau ou serveur.
- **Contrôleur REST (`PaymentController.java`)** :
  - `POST /api/v1/payments/initiate` : initie la demande de débit Mobile Money.
  - `POST /api/v1/payments/webhook` : endpoint public sécurisé pour les notifications d'agrégateurs (Wave, Orange, MTN, CinetPay, PayTech).
  - `POST /api/v1/payments/verify/{reference}` : validation et confirmation de paiement.
  - `POST /api/v1/payments/use-pro-credit` : consommation d'un crédit pro pour un CV client.
  - `GET /api/v1/payments/unlocked-cvs` : liste sécurisée des IDs de CVs déverrouillés pour le candidat connecté.
  - `GET /api/v1/payments/cvs/{cvId}/status` : statut de déverrouillage unitaire vérifié côté serveur.
  - `GET /api/v1/payments/pro-status` : consultation du solde de crédits et profil cybercafé.
  - `PUT /api/v1/payments/pro-shop` : personnalisation du nom de l'établissement.
- **Sécurité (`SecurityConfig.java`)** :
  - Autorisation publique de `POST /api/v1/payments/webhook` ; tous les autres endpoints sont strictement verrouillés par JWT.

#### 3. Couche Frontend Angular 18 (Signals & Standalone)
- **Service Réactif (`PaymentService.ts`)** :
  - Détection automatique du pays par fuseau horaire avec bascule manuelle (Côte d'Ivoire, Sénégal, Cameroun, Bénin/Togo, France/Euro, International).
  - Synchronisation en direct avec la base MySQL (`syncWithBackend()`, `fetchUnlockedCvs()`, `fetchProStatus()`).
  - Cache local résilient (`localStorage`) assurant la continuité d'expérience hors-ligne.
- **Modale de Paiement Mobile Money B2C (`PaymentModalComponent`)** :
  - Design mobile-first épuré, compact et sans émoticônes.
  - Sélection d'opérateur, saisie du numéro mobile avec indicatif, étape d'attente du push USSD et téléchargement automatique dès validation.
- **Modale d'Achat de Packs Pro Cybercafé (`AgentPackModalComponent`)** :
  - Affichage des 3 packs de volume avec prix dégressifs, solde actuel et achat par Mobile Money.
- **Intégration dans l'Éditeur & Liste des CVs (`CvBuilderMainComponent`, `CvListComponent`)** :
  - Détection automatique du mode guichet : si `isProMode` et `proCredits > 0`, déduction de 1 crédit pro et export immédiat sans modale client.
  - Bandeau guichet cybercafé compact et notifications d'utilisation de crédits.
- **Sécurisation de l'Export PDF (`PdfExportService.ts`)** :
  - Application d'un filigrane rouge de sécurité indélébile (`APERÇU NON DÉVERROUILLÉ — GETJOB.AFRICA`) en cas de tentative d'export forcé sans déverrouillage valide.
  - Export HD vectoriel immaculé dès déverrouillage.
- **Barre Supérieure (`TopbarComponent`)** :
  - Compteur de crédits pro et bouton de rechargement rapide.

#### ✅ Vérification des Builds — 30 août 2026
- **Backend Spring Boot** : `mvn test-compile` → **BUILD SUCCESS** (67 sources compilées, 0 erreur)
- **Frontend Angular 18** : `ng build` → **BUILD SUCCESS** (0 erreur)

---

## [0.8.0] - 2026-08-29

### 🎨 Refonte Galerie Modèles CV (Format Microsoft Word) & Éradication des Dummy Data

#### 1. Refonte Complète de la Galerie de Modèles de CV (`/cv-builder`)
- **Format & Grille Compacte Microsoft Word** :
  - Remplacement de la grille 3 colonnes massive par une grille dense et compacte de **6 colonnes** (`w-[145px]`, ratio A4 proportionné).
  - Suppression de l'encombrement visuel des cartes et affichage épuré des titres et catégories sous chaque document.
  - Feuilles de document A4 flottantes sur fond gris neutre avec bordures fines et ombres portées réalistes (`shadow-sm` vers `shadow-md` au survol).
- **Création de Véritables Modèles Haute Fidélité (Style Word)** :
  - **`word-bloc` — CV Bloc de couleur (*Jean Hansson*)** : En-tête bleu ardoise `#243b53`, 2 colonnes équilibrées (Profil/Expérience + bloc coordonnées et compétences).
  - **`word-soigne` — CV Soigné & Énergique (*VN Rouge*)** : Badge initiales rond rouge + ruban rouge, timeline professionnelle et icônes sociales.
  - **`word-violet` — CV Créatif Magenta (*Aline Dupuy*)** : Sidebar violette complète (`#6b21a8`) avec avatar, compétences clés et formation.
  - **`word-cadre` — CV Cadre & Conseil (*Marie Berthelette*)** : Encadré doré et mise en page raffinée à double colonne.
  - **`word-navy` — CV Bleu Nuit Exécutif (*M/B*)** : Bandeau bleu nuit `#1e3a8a` avec monogramme blanc et double colonne ATS.
  - **`word-minimal` — CV Minimaliste Filets (*Prénom Nom*)** : En-tête centré avec double filet noir & bronze et mise en page sobre.
  - **`word-peyton` — CV Typographique Bleu (*Peyton Davis*)** : En-tête moderne bleu roi et sections aérées.
  - **`word-sidebar` — CV Moderne en colonnes** : Colonne latérale grise avec compétences immédiates et timeline de projets.
  - **`word-ats` — CV Classique ATS** : Format pur texte 100% compatible avec les parseurs institutionnels.

#### 2. Éradication des Dummy Data & Branchement API Dynamique
- **Page Profil (`/profile`)** : Remplacement des données statiques (*Léa Bernard*, *Product Designer*) par le profil réel connecté (`AuthService.currentUser()`), calcul dynamique de la complétion et chargement du dernier CV réel.
- **Accueil Dashboard (`/dashboard`)** : Dynamisation des compteurs et statistiques (initialisés à 0 et alimentés par les vraies offres et candidatures) avec composant *empty-state* soigné.
- **Topbar & Sidebar** : Suppression des faux badges mockés (`7`, `12`), suppression des fausses notifications et affichage des vraies initiales utilisateur.
- **Documents (`/documents`)** : Remplacement des 3 faux PDFs statiques par la liste réelle des CVs issus de `CvApiService.getCvs()`.
- **Activité (`/activity`)** : Remplacement des 5 faux événements en dur par le flux réel des opportunités et candidatures.
- **Paramètres (`/settings`)** : Persistence des réglages utilisateur dans le `localStorage`.

#### ✅ Vérification builds — 29 août 2026
- **Backend Spring Boot** : `mvn test-compile` → **BUILD SUCCESS** (52 sources compilées)
- **Frontend Angular 18** : `ng build` → **BUILD SUCCESS** (0 erreur)

---

## [0.7.2] - 2026-08-29

### 🛡️ Préparation Production : Blindage Merge Expériences, Probes Actuator & Guide Environnement

#### 1. Blindage Anti-Doublons du Merge d'Expériences & Formations (`gemini-live.service.ts`)
- **Fuzzy Matching Tolérant (`mergeExperiences`)** : Ajout d'une recherche hiérarchique :
  - Correspondance exacte sur la clé composite (`company|position|startDate`).
  - Repli par correspondance souple sur `company` et `position` lorsque les dates sont absentes, partielles ou ajoutées au tour suivant, évitant la duplication d'expériences incomplètes.
  - Préservation des champs existants (non-écrasement des dates, contextes ou descriptions déjà renseignés par des valeurs vides).
- **Consolidation du Merge Formation (`mergeEducation`)** : Fusion tolérante sur `school` et `degree` sans duplication lors de l'ajout ultérieur de l'année d'obtention.

#### 2. Sécurisation des Sondes de Santé Production (`SecurityConfig.java`)
- **Autorisation Publique des Probes Actuator** : Ajout de `.requestMatchers(HttpMethod.GET, "/actuator/health", "/actuator/info").permitAll()` évitant les rejets 401 sur les healthchecks d'orchestration (Docker, Kubernetes, reverse proxy Nginx).

#### 3. Modèle de Configuration Production (`backend/.env.production.example`)
- **Création du template d'environnement de production** : Documentation claire des variables requises (`JWT_COOKIE_SECURE=true`, génération de secrets 256 bits, pool `GEMINI_API_KEYS`, SMTP et CORS HTTPS).

---

## [0.7.1] - 2026-08-28

### 🛠️ Correctifs Critiques : WebSocket Gemini Live 1008, Quotas Vocaux & Déduplication de CV

#### 1. Correction de l'erreur WebSocket 1008 (`GeminiLiveTokenService.java`)
- **Correction du paramètre `uses`** : Passage de `uses: 0` à `uses: 3` dans la requête backend de génération du jeton éphémère (`/v1beta/auth_tokens`). La valeur `0` interdisait toute utilisation du jeton éphémère par Google Gemini Live API, provoquant immédiatement la fermeture de la connexion WebSocket avec le code de violation de politique `1008`.

#### 2. Consommation Équitable des Quotas Journaliers (`CvService.java`)
- **Découplage de la déduction de quota à l'initialisation** : La tentative de connexion à la session vocale n'incrémente plus le compteur `aiInterviewsUsed` prématurément.
- **Incrémentation conditionnelle (`consumeInterviewQuotaIfNeeded`)** : Le quota d'entretien (limite journalière 3/3) n'est consommé que lorsque l'entretien enregistre effectivement du contenu professionnel significatif (`updateDraft`), lors de la synthèse IA (`synthesizeCvFromTranscript`), ou lors de la finalisation (`completeInterview`).
- **Tolérance aux erreurs & reconnexions** : Tout échec technique de connexion (code 1008, micro refusé, fermeture réseau) ne pénalise plus l'utilisateur.

#### 3. Élimination de la Persistance Multiple et en Boucle de CV (`CvService.java`, `gemini-live.service.ts`, `cv-interview.component.ts`)
- **Génération & persistance immédiate d'un ID numérique de CV** : `createInterviewSession` réutilise un brouillon `IN_PROGRESS` existant ou insère un enregistrement persistant unique avec son identifiant réel en base (ex: `"42"`) au lieu de propager le placeholder `"new"`.
- **Maintien de l'ID courant côté frontend (`gemini-live.service.ts`)** : Mise à jour immédiate de `currentCvId` lors des retours de `saveDraft`, `synthesize` et `completeInterview`. Évite la création d'un nouveau CV à chaque invocation du tool `update_cv_draft` par Gemini Live.
- **Résolution sans 404 lors du clic sur "Terminer"** : La complétion et la redirection vers l'éditeur de CV ciblent désormais l'identifiant réel persistant.

#### ✅ Vérification builds — 28 août 2026
- **Backend Spring Boot** : `mvn test-compile` → **BUILD SUCCESS** (52 sources compilées)
- **Frontend Angular 18** : `npm run build` → **BUILD SUCCESS** (0 erreur)

---

## [0.7.0] - 2026-08-26

### 🛡️ Phase 0 Complète (P0 Bloquants) + Option B Gemini Live Déterministe

#### 1. Configuration & Sécurisation Globale (Chantier 1)
- **Nettoyage & Fail-Fast Config (`application.yml`)** :
  - Suppression de toutes les valeurs par défaut sensibles.
  - Ajout des limites multipart : `max-file-size: 8MB`, `max-request-size: 10MB`.
  - Ajout de `server.forward-headers-strategy: native` pour fiabiliser la détection des adresses IP clientes (`X-Forwarded-For`).
  - Intégration de Spring Boot Actuator (`management.endpoints.web.exposure.include: health,info`).

#### 2. Suppression Définitive du Mock Vocal & Bean RestTemplate (Chantier 2)
- **Contrôleur Voix Réel (`RealtimeVoiceController.java`)** :
  - Remplacement total de l'ancien mock OpenAI (`client_secret` simulé) par la génération de vrais jetons éphémères Gemini Live via `geminiLiveTokenService.createEphemeralToken()` sur `POST` et `GET` `/api/v1/voice/session`.
- **Bean HTTP Centralisé (`RestTemplateConfig.java`)** :
  - Création d'un bean Spring `RestTemplate` avec timeouts stricts (3s connect, 10s read) et injection propre via `@RequiredArgsConstructor` dans `GeminiLiveTokenService.java`.

#### 3. Pagination Complète & Élimination N+1 DB (Chantier 3)
- **Pagination REST (`Pageable` & `Page<T>`)** :
  - Support de la pagination optionnelle (`page`, `size`) sur `GET /api/v1/opportunities`, `GET /api/v1/cvs`, `GET /api/v1/applications` avec tri par défaut décroissant.
  - Rétrocompatibilité totale préservée pour les appels sans paramètres de pagination.
- **Suppression de la boucle N+1 (`OpportunityService.java`)** :
  - Élimination des écritures en base systématiques (`save`) lors des appels `GET`.
  - Récupération en batch des offres associées via `jobOfferRepository.findAllById(offerIds)` évitant les requêtes unitaires répétitives.

#### 4. Rate Limiter Étendu, Éviction Mémoire & Gestion d'Upload (Chantier 4)
- **Couverture Étendue (`RateLimitFilter.java`)** :
  - Extension du rate limiting aux endpoints d'authentification (`/auth/google`), de sessions vocales (`/voice/session`, `/cvs/*/interview/session`) et d'IA (`/cvs/import`, `/cvs/*/ai-edit`, `/cvs/*/synthesize`).
  - Purge automatique programmée (`@Scheduled(fixedRate = 3600000)`) des compteurs inactifs depuis plus d'une heure pour éliminer tout risque de fuite mémoire.
  - Correction de l'ordre de la chaîne de filtres Spring Security (`RateLimitFilter` exécuté avant `JwtAuthenticationFilter`).
- **Handlers Globaux d'Exceptions (`GlobalExceptionHandler.java`)** :
  - Gestion de `MaxUploadSizeExceededException` retournant HTTP 413 (`Payload Too Large`).
  - Gestion de `ConstraintViolationException` et `HttpMessageNotReadableException` retournant HTTP 400 (`Bad Request`).
- **Garde d'Upload CV (`CvService.java`)** :
  - Rejet strict des fichiers > 8 Mo (HTTP 413) et vérification de la whitelist des formats autorisés (`application/pdf`, `image/png`, `image/jpeg`).

#### 5. Option B — Gemini Live Déterministe & Résilient
- **Backend — Validation & State Machine (`CvDraftValidator.java` & `CvService.java`)** :
  - Création du composant `CvDraftValidator` : vérification structurelle JSON, plafonnement strict à 20 expériences, 50 compétences et résumé < 2000 caractères avec levée de ProblemDetail HTTP 422 (`UNPROCESSABLE_ENTITY`).
  - State Machine sur `updateDraft` interdisant les modifications de brouillons sur des états clos (HTTP 409 `CONFLICT`).
  - Garde `isDraftMeaningful()` dans `completeInterview` bloquant la finalisation si le brouillon est vide (HTTP 400 `CV_INCOMPLETE`).
- **Frontend — Nettoyage & Reconnexion (`gemini-live.service.ts`)** :
  - Nettoyage des suffixes légaux d'entreprises (`Inc`, `SARL`, `SAS`, `LLC`, `GmbH`, `Ltd`, `SA`) dans `normalizeKey`.
  - Déduplication robuste dans `experienceKey` évitant la multiplication d'expériences incomplètes.
  - File d'attente avec 3 tentatives (`persistDraftWithRetry`) et resynchronisation automatique depuis le serveur en cas de rejet 422/409.
  - Régulation du débit audio sortant (`ws.bufferedAmount < 1MB`).
  - Ajout de `getCv` dans `CvInterviewApiService` pour les besoins de synchronisation.

#### ✅ Vérification builds — 26 août 2026
- **Backend Spring Boot** : `mvn test-compile` → **BUILD SUCCESS** (52 sources compilées)
- **Frontend Angular 18** : `ng build` → **BUILD SUCCESS** (0 erreur)

---

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
