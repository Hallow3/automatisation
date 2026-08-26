# EXPRESSION DE BESOIN V2 — Plateforme intelligente de candidatures

> Document de référence produit, fonctionnel et technique destiné à l’IA ou à l’équipe chargée de réaliser la plateforme de bout en bout.

---

# 0. Règle de lecture et ordre de priorité

Avant toute modification, l’agent doit lire et respecter, dans cet ordre :

1. `SKILL.md`
2. `AGENTS.md` s’il existe
3. `DESIGN.md` s’il existe
4. la présente expression de besoin
5. les README et documentations techniques
6. le dossier `resources/` ou `ressources/`
7. les références Google `design.md`
8. les composants / inspirations Uiverse présents dans les ressources
9. le code frontend existant
10. le code backend existant
11. les contrats et workflows n8n existants
12. les migrations et le schéma de données existants

L’agent ne doit pas traiter la demande comme un nouveau projet vide.

Le produit existe déjà partiellement. Il faut **auditer, réutiliser, compléter et sécuriser l’existant**, sans reconstruire inutilement ce qui fonctionne déjà.

---

# 1. Vision produit

La plateforme doit devenir un **workspace personnel de recherche d’emploi et de candidature assisté par IA**.

Elle doit permettre à un candidat de :

1. créer et maintenir un profil professionnel structuré ;
2. créer un ou plusieurs CV professionnels ;
3. créer son CV au travers d’un entretien vocal naturel ;
4. recevoir automatiquement les opportunités correspondant à son profil ;
5. comprendre pourquoi une offre lui correspond ;
6. examiner les opportunités proposées ;
7. préparer une candidature ;
8. consulter et modifier les documents générés ;
9. choisir explicitement s’il souhaite postuler ;
10. envoyer ou poursuivre une candidature selon le canal disponible ;
11. suivre ses candidatures ;
12. suivre ultérieurement les réponses des recruteurs ;
13. disposer à terme de statistiques utiles sur sa recherche d’emploi.

La plateforme ne doit pas ressembler à :

- un simple job board ;
- un tableau d’administration générique ;
- une démonstration IA ;
- une collection de composants sans cohérence.

Elle doit donner l’impression d’un **produit SaaS mature, fiable, professionnel et orienté action**.

---

# 2. Existant à préserver

Le projet dispose déjà de workflows n8n qui prennent en charge tout ou partie des traitements suivants :

- recherche d’offres sur plusieurs sources ;
- collecte d’alertes et sources parallèles ;
- normalisation ;
- déduplication ;
- résolution d’entreprise ;
- recherche / résolution de contacts ;
- fallback entreprise ;
- scoring et qualification candidat/offre ;
- routage IA mutualisé ;
- génération de lettre de motivation ;
- génération de documents PDF ;
- stockage documentaire ;
- orchestration des traitements.

## Règle absolue

**Ne pas réimplémenter ces workflows dans Angular ou Spring Boot.**

Le dashboard et le backend doivent devenir la **couche produit et métier** autour de ces automatisations.

---

# 3. Architecture cible

```text
Sources d'offres
      ↓
n8n
Collecte / Normalisation / Qualification / Automatisation
      ↓
Base de données existante
      ↓
Spring Boot
API métier / Sécurité / Orchestration applicative
      ↓
Angular
Dashboard utilisateur
```

Pour les intégrations externes :

```text
Angular
   ↓
Spring Boot
   ├── Base relationnelle
   ├── n8n
   ├── MinIO / stockage documentaire
   ├── OpenAI Realtime
   └── autres fournisseurs IA ou services internes
```

## Frontière obligatoire

Angular ne doit pas :

- accéder directement à la base ;
- exposer les clés API ;
- appeler directement MinIO avec des credentials techniques ;
- appeler directement les workflows n8n métier ;
- connaître les IDs de workflows n8n ;
- manipuler les statuts techniques internes de la base ;
- exposer les payloads bruts des workflows.

Spring Boot est la frontière applicative et sécuritaire.

n8n reste le moteur d’automatisation.

---

# 4. Stack cible

## Frontend

- Angular ;
- TypeScript strict ;
- Angular Router ;
- Reactive Forms si nécessaire ;
- Tailwind CSS ;
- composants Angular réutilisables ;
- architecture par features ;
- services API typés ;
- responsive design ;
- accessibilité ;
- HTML séparé du TypeScript.

## Backend

- Java ;
- Spring Boot ;
- Maven ;
- API REST ;
- validation ;
- authentification ;
- autorisation objet par objet ;
- DTO métier ;
- services applicatifs ;
- gestion d’erreurs centralisée ;
- migrations versionnées ;
- tests unitaires et d’intégration.

## Automatisation

- n8n existant.

## Données

- base relationnelle existante ;
- schéma à auditer avant toute création de nouvelle table.

## Documents

- MinIO ou stockage documentaire existant.

## IA

- routeur IA existant pour les besoins mutualisés ;
- OpenAI Realtime API pour l’entretien vocal ;
- architecture suffisamment abstraite pour ne pas coupler toute la plateforme à un seul fournisseur.

---

# 5. Principes d’ingénierie obligatoires

## 5.1 Réutilisabilité

La réutilisabilité est une exigence de premier niveau.

Avant toute création :

1. rechercher l’existant ;
2. vérifier si l’existant peut être étendu ;
3. éviter la duplication ;
4. créer des composants configurables lorsque cela réduit réellement la maintenance ;
5. ne pas sur-abstraire un bloc utilisé une seule fois.

## 5.2 Séparation des responsabilités

Préférer :

```text
Page
  ↓
Feature components
  ↓
Shared UI components
  ↓
Services / Use cases
  ↓
API
```

Les pages orchestrent.

Les composants présentent.

Les services communiquent avec l’API.

La logique métier complexe ne doit pas vivre dans les templates Angular.

## 5.3 Pas de régression

Avant de modifier un composant partagé ou CORE :

- identifier ses consommateurs ;
- comprendre ses entrées/sorties ;
- conserver le comportement par défaut ;
- privilégier une extension configurable ;
- ajouter les tests nécessaires.

---

# 6. Contraintes Angular obligatoires

## 6.1 Séparation HTML / TypeScript

Chaque composant doit privilégier :

```text
component-name/
├── component-name.component.ts
├── component-name.component.html
├── component-name.component.css
└── component-name.component.spec.ts
```

Même pour un composant standalone :

- TypeScript dans `.ts` ;
- template dans `.html` ;
- CSS spécifique dans `.css` ;
- styling courant via Tailwind dans le HTML.

Ne pas utiliser par défaut :

```ts
template: `...`
styles: [`...`]
```

Une exception doit être rare, justifiée et documentée.

## 6.2 Interdictions frontend

Ne pas :

- utiliser Angular Material sauf instruction explicite ;
- mélanger HTML et TypeScript ;
- mettre du CSS inline dans le TypeScript ;
- créer de gros composants monolithiques ;
- dupliquer du markup ;
- utiliser `any` sans justification ;
- coder les URLs d’API dans les composants ;
- injecter directement des mocks dans les composants finaux ;
- exposer des JSON techniques au client ;
- appeler n8n directement depuis les composants ;
- appeler la base directement ;
- inventer un nouveau design system sans analyser les ressources.

---

# 7. Architecture Angular recommandée

À adapter à l’existant, sans réécriture mécanique :

```text
src/app/
├── core/
│   ├── api/
│   ├── auth/
│   ├── guards/
│   ├── interceptors/
│   ├── models/
│   └── services/
│
├── shared/
│   ├── components/
│   │   ├── button/
│   │   ├── badge/
│   │   ├── card/
│   │   ├── status-badge/
│   │   ├── score-badge/
│   │   ├── skill-chip/
│   │   ├── modal/
│   │   ├── confirm-dialog/
│   │   ├── empty-state/
│   │   ├── error-state/
│   │   ├── skeleton/
│   │   └── ...
│   ├── directives/
│   ├── pipes/
│   └── utils/
│
├── layout/
│   ├── app-shell/
│   ├── sidebar/
│   ├── topbar/
│   └── mobile-navigation/
│
└── features/
    ├── dashboard/
    ├── opportunities/
    ├── applications/
    ├── cvs/
    ├── profile/
    └── settings/
```

---

# 8. Ressources UI/UX obligatoires

Avant de créer la moindre page visuelle, inspecter entièrement :

```text
resources/
```

ou :

```text
ressources/
```

Le dossier contient notamment :

- les références Google `design.md` ;
- les conventions visuelles disponibles ;
- certains composants ou inspirations Uiverse ;
- d’éventuelles ressources supplémentaires.

## 8.1 Google design.md

L’agent doit :

1. identifier les fichiers Markdown de référence ;
2. lire les principes utiles ;
3. les utiliser pour guider :
   - couleurs ;
   - typographie ;
   - espacements ;
   - surfaces ;
   - formes ;
   - états ;
   - interactions ;
   - accessibilité ;
   - hiérarchie visuelle ;
4. respecter les tokens existants ;
5. éviter les nouveaux tokens arbitraires.

Si `DESIGN.md` existe au niveau projet, il est prioritaire.

## 8.2 Uiverse

Les composants Uiverse sont une matière première.

Pour chaque composant réutilisé :

- analyser HTML/CSS ;
- adapter à Angular ;
- convertir vers Tailwind lorsque pertinent ;
- supprimer styles inutiles ;
- supprimer animations excessives ;
- rendre accessible ;
- rendre responsive ;
- harmoniser avec le design global ;
- en faire un composant réellement réutilisable.

Le produit ne doit pas révéler visuellement que les composants viennent de sources différentes.

---

# 9. Philosophie UI/UX

Le dashboard doit être :

- professionnel ;
- calme visuellement ;
- moderne ;
- lisible ;
- orienté productivité ;
- accessible ;
- cohérent.

Éviter :

- gradients gratuits ;
- glassmorphism excessif ;
- grosses ombres ;
- animations permanentes ;
- badges de toutes les couleurs ;
- coins excessivement arrondis ;
- gigantesques cartes KPI ;
- look de template admin générique ;
- surcharge visuelle.

Une seule action primaire doit dominer dans un contexte donné.

---

# 10. Responsive et accessibilité

Tester au minimum :

```text
mobile
tablet
desktop
large desktop
```

Vérifier :

- navigation ;
- cartes ;
- filtres ;
- listes ;
- modales ;
- CTA ;
- textes longs ;
- titres longs ;
- entreprises manquantes ;
- scores ;
- tags.

Accessibilité minimale :

- contraste suffisant ;
- focus visible ;
- navigation clavier ;
- labels explicites ;
- sémantique HTML ;
- ARIA lorsque nécessaire ;
- information jamais portée uniquement par la couleur.

Préférer :

```html
<button>
<nav>
<main>
<section>
<header>
<aside>
```

aux `<div>` cliquables.

---

# 11. Utilisateurs

## 11.1 Candidat

Utilisateur principal.

Il peut :

- gérer son profil ;
- gérer ses CV ;
- créer un CV via entretien vocal ;
- consulter les opportunités ;
- consulter le détail d’une offre ;
- comprendre le matching ;
- préparer une candidature ;
- consulter sa lettre ;
- confirmer une candidature ;
- suivre ses candidatures.

## 11.2 Administrateur / exploitant

À anticiper dans l’architecture.

Il pourra ultérieurement :

- superviser les automatisations ;
- consulter les erreurs ;
- analyser les volumes ;
- diagnostiquer les problèmes de collecte ;
- gérer certaines données de référence.

---

# 12. Authentification et sécurité

Chaque utilisateur ne doit accéder qu’à ses propres ressources.

Le backend doit déduire l’identité réelle de l’utilisateur authentifié.

Ne jamais faire confiance à un `candidateId` fourni librement par Angular.

Exemple de contrôle obligatoire :

```text
Utilisateur A
NE DOIT JAMAIS
pouvoir accéder à :

/cvs/{cvDeB}
/applications/{applicationDeB}
/opportunities/{opportuniteDeB}
/documents/{documentDeB}
```

même s’il connaît ou devine l’ID.

Prévoir :

- authentification ;
- autorisation objet par objet ;
- validation des entrées ;
- protection des secrets ;
- CORS ;
- contrôle des uploads ;
- URLs documentaires temporaires ;
- logs sans données sensibles inutiles ;
- conformité OWASP.

---

# 13. Dashboard principal

## Objectif

Présenter ce qui nécessite l’attention de l’utilisateur.

Le dashboard doit privilégier l’action.

Afficher notamment :

- nouvelles opportunités ;
- offres à examiner ;
- candidatures prêtes ;
- candidatures envoyées ;
- éventuelles actions en attente ;
- futurs retours recruteurs.

Navigation principale :

```text
Tableau de bord
Mes opportunités
Mes candidatures
Mes CV
Mon profil
Paramètres
```

Masquer les fonctionnalités non disponibles plutôt que présenter des pages factices.

---

# 14. Mes opportunités

Route indicative :

```text
/opportunities
```

## 14.1 Informations

Une carte d’opportunité peut afficher :

- intitulé ;
- entreprise ;
- localisation ;
- source ;
- date / fraîcheur ;
- deadline ;
- score ;
- statut ;
- compétences correspondantes ;
- canal ;
- disponibilité de la lettre ;
- CTA principal.

## 14.2 Filtres

Prévoir :

```text
Toutes
Nouvelles
À examiner
Prêtes à postuler
Postulées
Ignorées
```

Recherche texte si utile.

## 14.3 États

Gérer :

```text
loading
empty
error
success
partial
```

Le chargement initial privilégie les skeletons.

---

# 15. Détail d’une opportunité

Route indicative :

```text
/opportunities/:id
```

Afficher :

- poste ;
- entreprise ;
- localisation ;
- source ;
- date ;
- deadline ;
- description ;
- missions ;
- prérequis ;
- URL originale.

## Matching expliqué

Présenter en langage utilisateur :

- score global ;
- compétences correspondantes ;
- expérience ;
- localisation ;
- forces du profil ;
- points de vigilance éventuels.

Ne jamais exposer sous forme brute :

```text
rule_score
ai_score
raw_data
workflow_id
node_id
JSON technique
```

---

# 16. Cycle de vie d’une opportunité / candidature

Le backend doit contrôler les transitions métier.

Exemple conceptuel :

```text
REVIEW
  ↓
QUALIFIED
  ↓
PREPARING
  ↓
READY_TO_APPLY
  ↓
SUBMISSION_REQUESTED
  ↓
SUBMITTED
```

Transitions alternatives :

```text
DISMISSED
FAILED
```

Les noms exacts doivent être alignés avec le modèle existant.

Le frontend ne doit pas pouvoir envoyer arbitrairement :

```http
PATCH /application
{
  "status": "SUBMITTED"
}
```

Préférer des intentions métier :

```http
POST /api/v1/opportunities/{id}/prepare
POST /api/v1/opportunities/{id}/dismiss
POST /api/v1/opportunities/{id}/submit
```

Le backend valide la transition.

---

# 17. Préparation et confirmation d’une candidature

Avant envoi, afficher :

- offre ;
- CV choisi ;
- lettre ;
- destinataire ou URL ATS ;
- objet ;
- aperçu message ;
- pièces jointes.

Le candidat doit confirmer explicitement l’envoi.

Canaux à prévoir :

```text
EMAIL
ATS_URL
MANUAL
```

Une offre sans email mais avec URL officielle de candidature reste exploitable.

---

# 18. Mes candidatures

Route indicative :

```text
/applications
```

Afficher :

- entreprise ;
- poste ;
- date de candidature ;
- canal ;
- CV utilisé ;
- lettre utilisée ;
- statut ;
- dernière activité.

États futurs :

```text
Envoyée
Réponse reçue
Entretien
Refus
Offre
Sans réponse
```

L’architecture doit permettre le futur suivi des réponses recruteurs.

---

# 19. Module CV — Vision globale

Le module CV doit permettre :

1. sélection d’un template ;
2. création par entretien vocal ;
3. sauvegarde progressive ;
4. historique des CV ;
5. prévisualisation ;
6. édition assistée par IA ;
7. génération PDF ;
8. utilisation d’un CV dans une candidature.

Le CV ne doit jamais être réduit à un simple bloc HTML.

---

# 20. Phase CV 1 — Sélection du template

Afficher 2 à 3 templates au démarrage.

Chaque template affiche :

- miniature ;
- nom ;
- style ;
- nombre de pages conseillé ;
- description ;
- état sélectionné.

Exemples :

```text
Moderne et épuré
Classique professionnel
Tech / Senior
```

Les templates doivent être :

- versionnés ;
- réutilisables ;
- séparés des données ;
- compatibles avec le même modèle de CV structuré.

---

# 21. Phase CV 2 — Entretien vocal IA

## 21.1 Objectif

Créer le CV via un entretien conversationnel naturel.

L’expérience doit se rapprocher d’un entretien humain, pas d’un formulaire vocal rigide.

## 21.2 Architecture vocale

Utiliser OpenAI Realtime API via WebRTC.

Architecture :

```text
Angular
   ↓
Spring Boot
   ↓
Création / autorisation de session Realtime
   ↓
Angular ↔ OpenAI Realtime via WebRTC
```

La clé OpenAI standard reste uniquement côté serveur.

## 21.3 Comportement de l’IA

L’IA doit :

- se présenter ;
- expliquer l’objectif ;
- poser une question à la fois ;
- rebondir naturellement ;
- éviter les questions déjà répondues ;
- demander des précisions ;
- accepter les interruptions ;
- reformuler ;
- détecter les informations manquantes ;
- conclure lorsque les informations sont suffisantes.

## 21.4 Informations à collecter

Au minimum :

- identité ;
- coordonnées ;
- titre professionnel ;
- résumé ;
- expériences ;
- responsabilités ;
- réalisations ;
- compétences techniques ;
- compétences transversales ;
- formations ;
- certifications ;
- langues ;
- projets ;
- liens professionnels.

## 21.5 Transcript

Afficher en temps réel :

```text
Connexion
Écoute
Utilisateur parle
IA réfléchit
IA parle
Interruption
Erreur
```

Le transcript sert à l’expérience utilisateur.

Il n’est pas la source de vérité du CV.

---

# 22. CV Draft structuré

Le CV est construit progressivement sous forme structurée.

Exemple conceptuel :

```json
{
  "identity": {},
  "headline": "",
  "summary": "",
  "experiences": [],
  "education": [],
  "skills": [],
  "languages": [],
  "certifications": [],
  "projects": [],
  "links": []
}
```

La source de vérité est ce modèle structuré.

Préférer des opérations métier explicites :

```text
update_identity
update_headline
update_summary
add_experience
update_experience
remove_experience
add_education
add_skill
remove_skill
add_language
add_certification
add_project
complete_interview
```

à une fonction générique incontrôlée `update_cv`.

Chaque opération doit être validée par la couche applicative.

---

# 23. Sauvegarde progressive de l’entretien

Une déconnexion ou un rafraîchissement ne doit pas faire perdre tout l’entretien.

Prévoir :

- draft persistant ;
- statut de session ;
- dernière étape connue ;
- reprise possible ;
- idempotence raisonnable des mises à jour.

---

# 24. Mes CV

Route indicative :

```text
/cvs
```

Chaque CV affiche :

- nom ;
- template ;
- miniature ;
- date de création ;
- date de modification ;
- statut ;
- actions.

Actions :

```text
Ouvrir
Modifier
Renommer
Dupliquer
Télécharger PDF
Supprimer
```

La suppression exige une confirmation.

---

# 25. Édition assistée par IA

Route indicative :

```text
/cvs/:id/edit
```

Desktop :

```text
┌──────────────────────────┬──────────────────────────┐
│                          │                          │
│      Aperçu du CV        │       Chat IA           │
│                          │                          │
└──────────────────────────┴──────────────────────────┘
```

Exemples d’instructions :

```text
Ajoute Docker dans mes compétences.
Résume mon expérience chez X.
Mets davantage en avant Spring Boot.
Corrige cette formulation.
Passe le thème en bleu.
```

## Règle essentielle

Ne pas demander à l’IA de régénérer sauvagement tout le HTML du CV à chaque instruction.

Préférer :

```text
Instruction utilisateur
        ↓
IA
        ↓
Opération structurée
        ↓
ResumeContent / ResumeDraft
        ↓
Template Renderer
        ↓
Preview
```

Le rendu HTML est une projection.

Le modèle structuré reste la source de vérité.

---

# 26. Historique des modifications du CV

Conserver suffisamment d’informations pour :

- savoir ce qui a changé ;
- retracer les modifications ;
- permettre ultérieurement undo / redo ;
- conserver le chat ;
- restaurer une version si nécessaire.

---

# 27. Génération PDF

Le PDF doit :

- refléter le template sélectionné ;
- correspondre à la preview ;
- respecter le format A4 ;
- gérer plusieurs pages ;
- gérer proprement les sauts de page ;
- éviter les blocs coupés lorsque possible.

Architecture :

```text
ResumeContent
      +
ResumeTemplate
      ↓
Renderer
      ↓
HTML
      ↓
Service PDF
      ↓
PDF
      ↓
MinIO
```

---

# 28. Profil candidat

Route indicative :

```text
/profile
```

Le profil peut être alimenté par :

- CV ;
- entretien vocal ;
- saisie manuelle ;
- import futur.

Il sert à la qualification des opportunités.

Prévoir :

- identité ;
- localisation ;
- rôles cibles ;
- compétences ;
- expérience ;
- langues ;
- préférences ;
- disponibilité.

---

# 29. Paramètres

Prévoir :

```text
Compte
Préférences
Notifications
Recherche d'emploi
IA / voix
Confidentialité
```

À terme : connexion de la messagerie utilisateur pour le suivi recruteur.

---

# 30. Futur — Suivi email recruteur

Objectifs :

- connecter la messagerie ;
- identifier les réponses liées aux candidatures ;
- mettre à jour les statuts ;
- détecter :
  - demande d’entretien ;
  - refus ;
  - demande d’information ;
  - proposition ;
- notifier l’utilisateur ;
- proposer une réponse ;
- ne pas envoyer automatiquement sans consentement explicite.

---

# 31. Futur — Statistiques

À terme :

- opportunités reçues ;
- opportunités retenues ;
- candidatures envoyées ;
- taux de réponse ;
- entretiens ;
- répartition par rôle ;
- répartition par source.

Éviter les statistiques décoratives.

---

# 32. Backend Spring Boot — rôle exact

Spring Boot est le backend applicatif du produit.

Il est responsable de :

```text
Authentification / Autorisation
Candidate Profile
Opportunities
Applications
CV / Resume
Resume Templates
Resume Versions
Documents
Realtime Voice sessions
AI orchestration côté produit
n8n Integration
Notifications futures
```

n8n n’est pas le backend du dashboard.

n8n est un moteur d’automatisation spécialisé.

---

# 33. Architecture backend recommandée

Adapter au projet existant.

Exemple :

```text
backend/
└── src/main/java/.../
    ├── config/
    ├── security/
    ├── common/
    │   ├── error/
    │   ├── validation/
    │   └── audit/
    │
    ├── opportunity/
    │   ├── api/
    │   ├── application/
    │   ├── domain/
    │   └── infrastructure/
    │
    ├── application/
    │   ├── api/
    │   ├── application/
    │   ├── domain/
    │   └── infrastructure/
    │
    ├── resume/
    │   ├── api/
    │   ├── application/
    │   ├── domain/
    │   └── infrastructure/
    │
    ├── candidate/
    ├── document/
    ├── realtime/
    ├── automation/
    └── notification/
```

Cette structure est indicative.

Ne pas créer une architecture hexagonale artificielle si le projet actuel possède déjà une organisation claire.

---

# 34. Modèle de domaine backend

L’agent doit d’abord inspecter les tables existantes.

Ne pas créer un nouveau modèle parallèle si les structures existantes peuvent être étendues proprement.

Entités / agrégats conceptuels à couvrir :

```text
User
Candidate
CandidateProfile
JobOffer
Opportunity / Application
Resume
ResumeContent
ResumeVersion
ResumeTemplate
ResumeDocument
CoverLetterDocument
RealtimeInterview
ApplicationEvent
```

Les noms exacts doivent respecter l’existant.

---

# 35. Modèle CV backend

Séparer au minimum conceptuellement :

## Resume

Métadonnées générales du CV.

## ResumeContent

Données professionnelles structurées.

## ResumeTemplate

Template visuel.

## ResumeVersion

Historique des versions.

## ResumeDocument

PDF généré et informations de stockage.

Ne pas fusionner ces responsabilités dans une seule colonne HTML.

---

# 36. API métier — principes

Toute API doit définir :

- méthode ;
- route ;
- request ;
- response ;
- validation ;
- autorisation ;
- erreurs ;
- idempotence lorsque nécessaire.

Ne pas exposer directement les entités JPA.

Utiliser des DTO.

Les contrôleurs doivent rester fins.

---

# 37. API indicative — Opportunités

```http
GET /api/v1/opportunities
GET /api/v1/opportunities/{id}

POST /api/v1/opportunities/{id}/dismiss
POST /api/v1/opportunities/{id}/prepare
POST /api/v1/opportunities/{id}/submit

GET /api/v1/opportunities/{id}/cover-letter
```

Ajouter pagination et filtres côté serveur lorsque nécessaire.

---

# 38. API indicative — Candidatures

```http
GET /api/v1/applications
GET /api/v1/applications/{id}

GET /api/v1/applications/{id}/timeline
GET /api/v1/applications/{id}/documents
```

Les actions métier doivent utiliser des endpoints explicites si elles modifient un état critique.

---

# 39. API indicative — CV

```http
GET    /api/v1/cvs
POST   /api/v1/cvs
GET    /api/v1/cvs/{id}
PATCH  /api/v1/cvs/{id}
DELETE /api/v1/cvs/{id}

GET    /api/v1/cv-templates

POST   /api/v1/cvs/{id}/duplicate
POST   /api/v1/cvs/{id}/render
POST   /api/v1/cvs/{id}/export/pdf
POST   /api/v1/cvs/{id}/ai/edit
```

---

# 40. API indicative — Realtime

Exemple :

```http
POST /api/v1/cvs/{id}/interview/session
POST /api/v1/cvs/{id}/interview/resume
POST /api/v1/cvs/{id}/interview/complete
```

Spring doit :

1. vérifier l’utilisateur ;
2. vérifier la propriété du CV ;
3. charger / créer le draft ;
4. préparer les instructions ;
5. créer une session OpenAI Realtime sécurisée ;
6. ne retourner au client que les données temporaires nécessaires ;
7. ne jamais retourner la clé OpenAI principale.

---

# 41. Intégration Spring ↔ n8n

Créer une abstraction dédiée.

Conceptuellement :

```java
public interface AutomationGateway {

    PreparationResult prepareApplication(
        Long candidateId,
        Long opportunityId
    );

    SubmissionResult submitApplication(
        Long applicationId
    );
}
```

L’implémentation technique connaît :

- webhook ;
- workflow ;
- authentification ;
- timeout ;
- retries ;
- correlation ID.

Le domaine ne doit pas connaître :

```text
workflowId
nodeId
executionId
```

sauf journal technique / audit.

---

# 42. Contrats n8n

Toute interaction Spring ↔ n8n doit être documentée :

- nom logique du traitement ;
- endpoint ;
- auth ;
- request ;
- response ;
- codes d’erreur ;
- correlation ID ;
- caractère synchrone ou asynchrone ;
- timeout ;
- stratégie retry ;
- idempotency key ;
- état métier associé.

Ne pas dépendre d’un payload implicite non versionné.

---

# 43. Intégration du routeur IA existant

Le routeur IA mutualisé doit rester générique.

Conserver le principe :

```text
provider + call_profile
```

Exemples :

```text
structured_json
document_html
classification
plain_text
```

Toute évolution du CORE doit préserver les consommateurs existants.

---

# 44. Intégration MinIO / documents

Angular ne doit pas recevoir de credentials MinIO.

Préférer :

```text
Angular
   ↓
Spring
   ↓
MinIO
```

Spring peut :

- streamer un fichier ;
- ou générer une URL présignée à durée limitée.

Exemples :

```http
GET /api/v1/cvs/{id}/pdf
GET /api/v1/applications/{id}/cover-letter
```

Les documents doivent être liés à leur propriétaire métier.

---

# 45. Base de données et migrations

Avant toute évolution :

1. inspecter le schéma actuel ;
2. inspecter les tables utilisées par n8n ;
3. inspecter les contraintes ;
4. inspecter les index ;
5. vérifier les données existantes ;
6. identifier les migrations déjà utilisées.

Les migrations doivent être :

- versionnées ;
- reproductibles ;
- non destructives par défaut ;
- compatibles avec les workflows existants.

Ne pas renommer une colonne utilisée par n8n sans stratégie de migration et compatibilité.

---

# 46. Transactions

Une transaction doit représenter une unité métier cohérente.

Ne pas maintenir une transaction DB ouverte pendant :

- un appel IA long ;
- un appel n8n long ;
- une génération PDF ;
- un upload externe.

Prévoir les échecs partiels et la reprise.

---

# 47. Traitements asynchrones

Les opérations longues peuvent devenir asynchrones.

Exemples :

- génération de lettre ;
- rendu PDF ;
- préparation de candidature ;
- envoi ;
- analyse IA.

Prévoir si nécessaire des statuts :

```text
PENDING
PROCESSING
READY
FAILED
```

Angular peut rafraîchir ou utiliser un mécanisme événementiel approprié.

Ne pas bloquer une requête HTTP très longtemps sans nécessité.

---

# 48. Idempotence

Les actions sensibles doivent éviter les doubles exécutions.

Exemples :

```text
préparer une candidature
envoyer une candidature
générer un PDF
finaliser un entretien
```

Prévoir :

- idempotency key ;
- vérification du statut courant ;
- verrou métier raisonnable ;
- déduplication.

Un double clic ne doit pas envoyer deux candidatures.

---

# 49. Gestion des erreurs

Distinguer :

- erreur utilisateur ;
- validation ;
- droit d’accès ;
- ressource inexistante ;
- indisponibilité réseau ;
- indisponibilité IA ;
- rate limit ;
- erreur n8n ;
- erreur PDF ;
- erreur stockage ;
- conflit métier.

Les erreurs techniques sont loguées.

Le client reçoit un message métier.

Exemple :

```text
Impossible de préparer votre lettre pour le moment.
Votre opportunité a été conservée.
Vous pourrez réessayer.
```

et non :

```text
429 TPM exceeded
```

---

# 50. Résilience

Pour les services externes :

- timeout ;
- retry ciblé ;
- backoff ;
- rate limiting ;
- idempotence ;
- correlation ID ;
- circuit breaker si justifié ;
- fallback si réellement utile.

Ne pas retry automatiquement une opération non idempotente sans protection.

---

# 51. Observabilité

Prévoir :

- correlation ID ;
- logs structurés ;
- erreurs contextualisées ;
- durée des appels externes ;
- état des traitements longs ;
- métriques si nécessaire.

Les logs ne doivent pas contenir :

- secrets ;
- tokens ;
- contenu complet de CV sans nécessité ;
- données personnelles inutiles.

---

# 52. État frontend et appels API

Créer des abstractions métier typées.

Exemple :

```text
OpportunityApiService
ResumeApiService
ApplicationApiService
RealtimeSessionService
```

Pour les opportunités :

```ts
getOpportunities()
getOpportunity(id)
dismissOpportunity(id)
prepareApplication(id)
submitApplication(id)
getCoverLetter(id)
```

Les URLs sont centralisées dans la configuration.

Prévoir :

- loading ;
- empty ;
- error ;
- retry ;
- pagination ;
- refresh ;
- cache raisonnable.

---

# 53. Modèles TypeScript

Créer des interfaces / unions explicites.

Exemple :

```ts
export interface Opportunity {
  id: number;
  jobOfferId: number;
  title: string;
  company: string | null;
  city: string | null;
  source: string;
  score: number;
  status: OpportunityStatus;
  publishedAt?: string | null;
  deadline?: string | null;
  applicationChannel?: ApplicationChannel;
  coverLetterAvailable: boolean;
  matchedSkills: string[];
  matchExplanation?: string | null;
}
```

Créer des types adaptés pour :

```text
OpportunityStatus
ApplicationChannel
OpportunityFilter
ResumeStatus
InterviewStatus
ApplicationStatus
```

Ne pas exposer directement les enums DB dans les templates.

---

# 54. États UI

Toute page importante gère :

```text
loading
empty
error
success
partial
```

Toute action asynchrone doit fournir un feedback.

Exemples :

```text
Préparation...
Lettre prête
Candidature en cours d'envoi...
Candidature envoyée
Échec — Réessayer
```

Ne jamais laisser l’utilisateur se demander si son action a fonctionné.

---

# 55. Performance frontend

Prévoir :

- lazy loading ;
- tracking Angular adapté ;
- pas de recalcul lourd dans les templates ;
- pas de subscriptions non maîtrisées ;
- pagination ;
- optimisation des previews ;
- chargement progressif des documents ;
- pas d’appels API redondants.

---

# 56. Tests

## Angular

Tester :

- services API ;
- composants critiques ;
- mappings ;
- filtres ;
- états ;
- navigation ;
- interactions ;
- permissions visuelles.

## Spring Boot

Tester :

- services métier ;
- contrôleurs ;
- sécurité ;
- isolation des utilisateurs ;
- transitions d’état ;
- validations ;
- persistence ;
- intégrations avec stubs/mocks appropriés.

## Parcours minimum

Tester :

```text
0 offre
1 offre
plusieurs offres
offre sans entreprise
offre sans ville
offre ATS sans email
lettre indisponible
erreur IA
rate limit
erreur PDF
erreur MinIO
double clic sur Postuler
accès à la ressource d'un autre utilisateur
CV incomplet
déconnexion entretien vocal
reprise entretien vocal
finalisation entretien
```

---

# 57. Méthode de travail obligatoire de l’agent

Ne pas commencer par coder toutes les pages.

## Étape 1 — Audit

Inspecter :

- structure projet ;
- Angular ;
- Spring ;
- `package.json` ;
- `pom.xml` ;
- routes ;
- composants ;
- services ;
- modèles ;
- DB / migrations ;
- ressources UI ;
- Google design.md ;
- Uiverse ;
- n8n ;
- MinIO ;
- contrats existants.

Produire un court compte rendu.

## Étape 2 — Cartographie

Produire :

```text
Existant réutilisable
Écarts à combler
Contrats existants
Risques
Dépendances
```

## Étape 3 — Architecture

Définir :

- routes ;
- features ;
- composants partagés ;
- domaine backend ;
- API ;
- DTO ;
- états ;
- tables à étendre ;
- intégrations.

## Étape 4 — Design foundation

Identifier :

- tokens ;
- couleurs ;
- typo ;
- spacing ;
- radius ;
- boutons ;
- badges ;
- cards ;
- inputs ;
- skeletons ;
- états.

## Étape 5 — Implémentation verticale

Privilégier une fonctionnalité de bout en bout :

```text
DB
↓
Spring
↓
API
↓
Angular
↓
Tests
```

plutôt que construire tous les écrans avant toute intégration.

## Étape 6 — Validation

- tests ;
- build ;
- responsive ;
- accessibilité ;
- erreurs ;
- sécurité ;
- régression.

## Étape 7 — Nettoyage

Supprimer :

- duplication ;
- mocks devenus inutiles ;
- code mort ;
- logs temporaires ;
- TODO évitables ;
- classes inutiles.

---

# 58. Stratégie en cas d’information manquante

Si une information manque mais ne bloque pas :

- faire une hypothèse raisonnable ;
- isoler cette hypothèse ;
- documenter ;
- garder la solution facilement remplaçable.

Si une API manque :

- définir d’abord le contrat ;
- créer une abstraction ;
- utiliser éventuellement un mock isolé ;
- ne pas mettre le mock directement dans le composant final.

Si une information critique bloque réellement, poser une question ciblée.

---

# 59. Priorité produit

Toujours prioriser :

```text
1. Compréhension immédiate
2. Action utilisateur claire
3. Fiabilité
4. Sécurité
5. Réutilisabilité
6. Maintenabilité
7. Accessibilité
8. Performance
9. Effets visuels
```

Une interface spectaculaire mais difficile à utiliser est un échec.

---

# 60. Roadmap fonctionnelle

## MVP 1 — Opportunités et candidature

```text
Dashboard
Mes opportunités
Détail opportunité
Matching expliqué
Préparation candidature
Consultation lettre
Confirmation
Postuler
Mes candidatures
```

## MVP 2 — CV intelligent

```text
Templates
Création CV
Entretien vocal
CV Draft
Mes CV
Preview
Export PDF
```

## MVP 3 — Édition IA

```text
Chat d'édition
Opérations structurées
Historique
Versions
Amélioration templates
```

## MVP 4 — Suivi recruteur

```text
Connexion email
Détection réponses
Mise à jour statuts
Notifications
Suggestions de réponse
```

## MVP 5 — Statistiques

```text
Taux de réponse
Entretiens
Répartition sources
Répartition rôles
Performance candidatures
```

---

# 61. Critères d’acceptation globaux

Le produit n’est pas considéré terminé tant que :

- Angular compile ;
- Spring Boot compile ;
- tests critiques passent ;
- HTML et TypeScript sont séparés ;
- Tailwind est utilisé correctement ;
- le design respecte les ressources ;
- les composants sont réutilisables ;
- les pages sont responsive ;
- les états loading / empty / error existent ;
- le frontend n’accède pas directement à la DB ;
- le frontend n’appelle pas directement n8n métier ;
- les clés ne sont pas exposées ;
- les utilisateurs sont isolés ;
- les documents sont sécurisés ;
- les workflows existants sont préservés ;
- les contrats n8n ne sont pas cassés ;
- le parcours opportunité → candidature fonctionne ;
- le parcours CV du lot livré fonctionne ;
- la non-régression a été vérifiée.

---

# 62. Livrables attendus

À terme, le projet doit contenir au minimum :

```text
Dashboard layout
Navigation responsive
Opportunities page
Opportunity detail page
Application preparation
Application tracking
Resume templates
Voice interview
Resume draft
Resume list
Resume editor
Document preview
PDF export
Typed API services
Typed models
Reusable UI components
Reusable states
Security
Backend business APIs
n8n gateway
MinIO integration
Realtime integration
Tests
Documentation
```

---

# 63. Documentation et suivi

Mettre à jour selon l’organisation du repository :

```text
SKILL.md
AGENTS.md
DESIGN.md
README.md
docs/
CHANGELOG.md
```

Pour chaque lot :

- checklist ;
- réalisé ;
- reste à faire ;
- fichiers importants ;
- décisions ;
- tests ;
- risques.

Une autre IA doit pouvoir reprendre le projet sans reconstituer le contexte depuis zéro.

---

# 64. Parcours cible final

```text
Profil candidat
      ↓
Création / enrichissement du CV
      ↓
Workflows recherchent les opportunités
      ↓
Qualification automatique
      ↓
Dashboard affiche les meilleures opportunités
      ↓
Utilisateur analyse le matching
      ↓
Préparation candidature
      ↓
CV + lettre + canal
      ↓
Confirmation utilisateur
      ↓
Candidature envoyée
      ↓
Suivi
      ↓
Réponse recruteur
      ↓
Entretien / Refus / Offre
```

---

# 65. Instruction finale à l’agent

Tu dois construire le produit **de bout en bout**, en réutilisant au maximum l’existant.

Tu ne dois pas :

- reconstruire les workflows n8n ;
- ignorer le backend ;
- créer uniquement une maquette Angular ;
- réécrire une architecture saine ;
- casser les contrats existants ;
- exposer les détails techniques internes au candidat.

Tu dois :

1. comprendre l’existant ;
2. identifier les frontières ;
3. construire les couches manquantes ;
4. implémenter verticalement ;
5. tester ;
6. documenter ;
7. vérifier la sécurité et la non-régression ;
8. poursuivre jusqu’à obtenir une fonctionnalité réellement exploitable.

Le résultat attendu est un **produit SaaS complet, cohérent et maintenable**, et non une démonstration UI.
