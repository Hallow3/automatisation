# Refonte du chat vocal → CV — Spec d'implémentation V2

## 0. Contexte et problème actuel

Architecture actuelle : Gemini Live gère simultanément trop de responsabilités :

- conversation vocale temps réel avec l'utilisateur ;
- compréhension du contenu ;
- décision de progression dans l'entretien ;
- remplissage du CV ;
- tool calling métier ;
- décision de fin d'entretien.

### Symptômes observés

- coupures pendant certaines prises de parole longues ;
- coût Gemini élevé ;
- tool calling CV peu fiable ;
- dérive du comportement quand le system prompt devient trop gros ;
- CV parfois trop superficiel ;
- tendance du modèle à vouloir conclure trop vite ;
- mélange entre conversation naturelle et logique de construction du CV.

### Cause principale

Gemini Live porte trop de responsabilités dans une seule session.

La refonte doit donc conserver ce que Gemini Live fait très bien — **la voix, l'écoute, le naturel, la prosodie et l'interruption en temps réel** — tout en retirant du Live les responsabilités de structuration et de construction du CV.

---

# 1. Principe directeur

> **Gemini Live reste le moteur vocal. Le backend contrôle l'entretien. La structuration du CV est découplée.**

L'architecture cible repose sur 4 responsabilités distinctes :

1. **Gemini Live**
   - comprend la voix ;
   - parle avec une voix naturelle ;
   - mène la conversation ;
   - pose les questions ;
   - rebondit sur les réponses ;
   - peut être interrompu par l'utilisateur ;
   - ne construit pas directement le CV.

2. **State Machine**
   - contrôle la section active ;
   - contrôle l'ordre des étapes ;
   - décide si une étape peut être quittée ;
   - garantit que toutes les sections prévues sont parcourues ;
   - refuse toute fin automatique prématurée.

3. **LLM Observateur / Extracteur**
   - travaille sur la transcription texte ;
   - extrait les faits ;
   - maintient un état partiel ;
   - identifie les informations manquantes ;
   - produit des structures JSON validables ;
   - ne parle jamais directement à l'utilisateur.

4. **Merge en code**
   - valide ;
   - fusionne ;
   - écrit dans `CvData` ;
   - conserve l'intégrité des données.

---

# 2. Règles produit NON NÉGOCIABLES

## 2.1 Gemini Live est obligatoire

Il n'existe **aucun fallback TTS/STT alternatif**.

Ne pas introduire :

- Whisper comme moteur principal ;
- ElevenLabs ;
- Google TTS classique ;
- navigateur SpeechSynthesis ;
- autre pipeline STT + LLM + TTS.

La voix Gemini Live fait partie de l'expérience produit.

### Si Gemini Live est indisponible

L'entretien est considéré comme temporairement indisponible.

Le client doit afficher un état propre :

```text
Entretien vocal temporairement indisponible

Le service vocal n'est pas disponible pour le moment.
Votre progression a été conservée.

Réessayer
Retour à mes CV
```

Aucune conversation dégradée avec une autre voix.

Si une session existait déjà, sa progression doit rester persistée afin de permettre une reprise ultérieure.

---

## 2.2 L'entretien ne se termine jamais automatiquement avant la fin du parcours

Gemini Live ne doit **jamais** décider de terminer l'entretien simplement parce qu'il considère avoir "assez d'informations".

Par défaut, la State Machine doit parcourir toutes les étapes configurées.

Ordre cible :

```text
IDENTITY
   ↓
TARGET
   ↓
EXPERIENCE[0..n]
   ↓
PROJECTS
   ↓
EDUCATION
   ↓
SKILLS
   ↓
LANGUAGES
   ↓
FINALIZE
   ↓
REVIEW
   ↓
DONE
```

Certaines sections peuvent être marquées :

```text
COMPLETE
COMPLETE_WITH_GAPS
SKIPPED
```

mais elles doivent être traitées explicitement avant de poursuivre.

---

## 2.3 Exception unique : arrêt demandé explicitement par l'utilisateur

Gemini Live peut mettre fin à l'entretien **uniquement si l'utilisateur exprime explicitement une volonté d'arrêter**.

Exemples valides :

```text
"Je veux arrêter."
"On peut terminer l'entretien."
"Je préfère continuer plus tard."
"Arrête l'entretien."
"Je veux quitter."
"C'est bon, stop."
```

Exemples NON valides :

```text
"Je n'ai rien d'autre à dire sur cette expérience."
"Je ne sais pas."
"On peut passer à la suite."
"C'est tout pour cette partie."
"Je n'ai pas de projet."
```

Ces phrases doivent seulement faire progresser la section courante.

---

# 3. Architecture cible

```text
┌────────────────────────────────────────────┐
│                  ANGULAR                   │
│                                            │
│ Micro                                      │
│ Playback Gemini                            │
│ Barge-in                                   │
│ Transcript UI                              │
│ CV draft preview                           │
└────────────────────┬───────────────────────┘
                     │
                     │ audio bidirectionnel
                     ▼
┌────────────────────────────────────────────┐
│               GEMINI LIVE                  │
│                                            │
│ - voix naturelle                           │
│ - compréhension orale                      │
│ - conversation                             │
│ - relances                                 │
│ - interruption                             │
│ - transcription input/output               │
│                                            │
│ PAS de modification directe du CvData      │
└────────────────────┬───────────────────────┘
                     │
                     │ input transcription
                     ▼
┌────────────────────────────────────────────┐
│              ORCHESTRATEUR                 │
│                                            │
│ session_id                                 │
│ current_state                              │
│ section_index                              │
│ turns_in_section                           │
│ section_partial_data                       │
│ cv_data_so_far                             │
│ interview_status                           │
└──────────────┬──────────────────┬───────────┘
               │                  │
               ▼                  ▼
       ┌──────────────┐   ┌──────────────────┐
       │ State Machine│   │ LLM Observateur  │
       │              │   │ / Extracteur     │
       │ transitions  │   │                  │
       │ garde-fous   │   │ JSON strict      │
       │ ordre        │   │ partial patch    │
       └──────┬───────┘   └────────┬─────────┘
              │                    │
              └──────────┬─────────┘
                         ▼
                  Validation code
                         │
                         ▼
                      CvData
                         │
                         ▼
                    CV Writer
                         │
                         ▼
                      REVIEW
```

---

# 4. Gemini Live — responsabilité exacte

Gemini Live est le seul composant qui parle à l'utilisateur.

Il doit :

- accueillir l'utilisateur ;
- expliquer brièvement le fonctionnement ;
- poser une seule question à la fois ;
- rebondir naturellement ;
- demander des précisions lorsque les réponses sont vagues ;
- chercher des faits concrets ;
- chercher des résultats quantifiés lorsqu'ils existent ;
- ne jamais inventer une donnée ;
- rester dans la section active ;
- suivre les instructions de contrôle envoyées par l'orchestrateur ;
- pouvoir être interrompu par l'utilisateur ;
- ne jamais annoncer spontanément que l'entretien est terminé.

Gemini Live ne doit plus :

- modifier `CvData` ;
- créer ou modifier une expérience via tool call ;
- décider seul de l'étape suivante ;
- considérer le CV terminé ;
- sauter plusieurs sections ;
- générer le document final pendant la conversation.

---

# 5. System prompt Gemini Live

Le system prompt Live doit rester court et stable.

Exemple :

```text
Tu es un recruteur senior et coach CV.
Tu mènes un entretien vocal naturel en français afin de recueillir
les informations nécessaires à la construction d'un CV professionnel.

STYLE DE CONVERSATION
- Parle naturellement.
- Une seule question à la fois.
- Utilise des phrases courtes adaptées à l'oral.
- Rebondis sur ce que dit réellement le candidat.
- Lorsqu'une réponse est vague, demande un détail concret.
- Cherche notamment le contexte, le rôle personnel, les actions,
  les technologies, les responsabilités et les résultats.
- Demande des chiffres uniquement lorsqu'ils peuvent réellement exister.
- N'invente jamais de chiffre ni de fait.

CONTRÔLE DE L'ENTRETIEN
- L'application t'indique toujours la section active.
- Ne change jamais toi-même de section.
- Ne considère jamais l'entretien terminé simplement parce que
  tu penses avoir suffisamment d'informations.
- L'entretien doit continuer jusqu'à ce que l'application indique FINALIZE
  puis REVIEW.
- Tu peux demander l'arrêt de la session uniquement lorsque
  l'utilisateur exprime explicitement qu'il souhaite arrêter,
  quitter ou continuer plus tard.

IMPORTANT
- "Je n'ai rien d'autre sur cette expérience",
  "je ne sais pas",
  "on peut passer à la suite"
  ou "je n'ai pas de projet"
  ne signifient PAS arrêter l'entretien.
- Dans ces cas, poursuis simplement selon la section indiquée par l'application.

Tu ne construis pas directement le CV.
Tu conduis uniquement une excellente conversation.
```

---

# 6. Messages de contrôle envoyés à Gemini Live

L'orchestrateur peut envoyer à Gemini Live un message texte de contrôle.

Exemple :

```text
[INTERVIEW_STATE]

Section active : EXPERIENCE #1

Objectif :
Comprendre précisément cette expérience professionnelle.

Informations déjà connues :
- entreprise : VINCI Energies
- technologie principale : Talend
- périmètre : environ 600 collaborateurs dans 6 pays

Informations importantes encore manquantes :
- rôle personnel exact
- responsabilités principales
- résultat concret

Instruction :
Continue naturellement l'entretien.
Pose une seule question.
Ne change pas de section.
Ne conclus pas l'entretien.
```

Gemini Live ne doit pas lire ce bloc à voix haute.

---

# 7. Transcription Gemini Live

Activer :

```text
inputAudioTranscription
outputAudioTranscription
```

La transcription de l'utilisateur sert de source au moteur de structuration.

Le transcript complet reste disponible pour :

- affichage ;
- debug ;
- reprise de session ;
- extraction ;
- audit qualité.

Aucun moteur STT local n'est nécessaire.

---

# 8. LLM Observateur — état partiel silencieux

Pendant la conversation, un modèle texte séparé observe les tours utilisateur.

Il ne parle jamais.

Son rôle est de produire un patch structuré.

Exemple :

```json
{
  "section": "EXPERIENCE",
  "section_index": 1,
  "patch": {
    "company": "VINCI Energies",
    "role": "Développeur / consultant data",
    "technologies": [
      "Talend"
    ],
    "context": "Centralisation de données RH",
    "scope": {
      "employees": 600,
      "countries": 6
    }
  },
  "missing_fields": [
    "main_responsibilities",
    "measurable_result"
  ],
  "completion_score": 0.72
}
```

`patch` est un état de travail.

Il ne remplace pas directement les données définitives du CV.

---

# 9. Extraction finale d'une section

Lorsqu'une section est prête à être quittée :

```text
section transcript
      +
partial section
      ↓
LLM Extracteur
      ↓
JSON strict
      ↓
validation Pydantic/Zod
      ↓
merge code
      ↓
CvData
```

Caractéristiques :

- température faible ;
- aucune conversation ;
- aucun tool calling ;
- contexte limité à la section ;
- retry maximum 1 fois si validation du schéma échoue.

---

# 10. State Machine

La State Machine est l'autorité sur le parcours.

```text
IDENTITY
TARGET
EXPERIENCE
PROJECTS
EDUCATION
SKILLS
LANGUAGES
FINALIZE
REVIEW
DONE
```

Elle contrôle :

```text
current_state
state_index
turns_in_section
section_status
missing_fields
completion_score
```

---

# 11. Critères de transition

Le LLM peut suggérer qu'une section est suffisamment renseignée.

Mais la décision finale appartient au code.

Exemple EXPERIENCE :

```text
poste connu
+
entreprise connue
+
période connue ou explicitement inconnue
+
au moins une responsabilité/contribution
```

Si ces critères sont respectés :

```text
COMPLETE
```

Si les données sont exploitables mais certaines informations restent inconnues :

```text
COMPLETE_WITH_GAPS
```

Si l'utilisateur indique explicitement ne pas avoir d'élément pour cette section :

```text
SKIPPED
```

Puis seulement la State Machine passe à l'état suivant.

---

# 12. Max turns par section

Ne jamais rester bloqué indéfiniment.

Configuration indicative :

```json
{
  "IDENTITY": 3,
  "TARGET": 4,
  "EXPERIENCE": 6,
  "PROJECTS": 4,
  "EDUCATION": 4,
  "SKILLS": 4,
  "LANGUAGES": 3
}
```

À `max_turns - 1` :

```text
[INTERVIEW_STATE]

Dernier tour recommandé sur cette section.

Demande uniquement l'information manquante
ayant le plus de valeur pour le CV.
```

Si `max_turns` est atteint :

- si données exploitables → `COMPLETE_WITH_GAPS` ;
- si utilisateur indique qu'il n'a rien à fournir → `SKIPPED` ;
- sinon poser une courte question de décision :
  - continuer cette section ;
  - ou passer à la suite.

`max_turns` ne signifie jamais `DONE`.

---

# 13. Gestion des expériences multiples

L'état EXPERIENCE est une boucle.

```text
EXPERIENCE[0]
       ↓
"avez-vous une autre expérience ?"
       ↓
oui → EXPERIENCE[1]
       ↓
oui → EXPERIENCE[2]
       ↓
non → PROJECTS
```

Dire :

```text
"Non, c'est tout pour mes expériences."
```

signifie :

```text
passer à PROJECTS
```

et NON :

```text
terminer l'entretien
```

---

# 14. Gestion de la demande d'arrêt utilisateur

C'est la seule voie de sortie anticipée de l'entretien.

## 14.1 Outil Live autorisé

Tous les anciens tools de modification du CV doivent être retirés.

Le seul tool Live autorisé peut être :

```text
request_end_interview
```

Payload minimal :

```json
{
  "reason": "user_requested_stop",
  "user_intent_excerpt": "Je préfère arrêter ici et reprendre plus tard."
}
```

Gemini Live ne doit appeler ce tool que lorsque la demande d'arrêt vient explicitement de l'utilisateur.

---

## 14.2 Validation backend OBLIGATOIRE

L'appel du tool ne suffit jamais.

Le backend vérifie le dernier tour utilisateur.

Règle :

```text
Gemini appelle request_end_interview
        ↓
backend vérifie :
la dernière intention utilisateur
exprime-t-elle explicitement
STOP / QUIT / LATER ?
        ↓
oui                 non
 ↓                    ↓
autoriser         refuser tool
 ↓                    ↓
sauvegarder       continuer
 ↓
USER_STOPPED
```

Ainsi Gemini ne peut pas clôturer l'entretien parce qu'il estime le CV complet.

---

## 14.3 Confirmation facultative mais recommandée

Pour les formulations ambiguës :

```text
Utilisateur :
"Bon je crois que c'est bon."
```

Gemini doit demander :

```text
"Tu souhaites arrêter complètement l'entretien maintenant,
ou simplement passer à la section suivante ?"
```

Aucun arrêt avant clarification.

Pour une formulation explicite :

```text
"Arrête l'entretien."
```

pas besoin d'insister.

---

# 15. États globaux d'entretien

```text
CREATED
CONNECTING
ACTIVE
USER_STOPPED
TEMPORARILY_UNAVAILABLE
FINALIZING
REVIEW
COMPLETED
ERROR
```

Important :

```text
USER_STOPPED ≠ COMPLETED
```

Un entretien arrêté volontairement conserve son CV partiel et peut être repris.

---

# 16. Finalisation normale

L'entretien ne passe à `FINALIZE` qu'après parcours de toutes les sections.

```text
IDENTITY        ✓
TARGET          ✓
EXPERIENCE      ✓
PROJECTS        ✓ / SKIPPED
EDUCATION       ✓
SKILLS          ✓
LANGUAGES       ✓
        ↓
FINALIZE
```

À ce moment seulement :

```text
CvData structuré
      ↓
CV Writer
      ↓
rédaction professionnelle
      ↓
SUMMARY
      ↓
amélioration des expériences
      ↓
REVIEW
```

Gemini Live peut alors dire naturellement :

```text
"Nous avons parcouru toutes les sections.
Je vais maintenant préparer une première version structurée de votre CV."
```

---

# 17. CV Writer final

Le SUMMARY n'est pas une section que l'utilisateur doit rédiger lui-même.

Le CV Writer prend :

- identité ;
- objectif ;
- expériences ;
- projets ;
- formation ;
- compétences ;
- langues.

Il produit :

- résumé professionnel ;
- formulation professionnelle des expériences ;
- formulation des réalisations ;
- cohérence éditoriale.

Règle fondamentale :

> Reformuler les faits, jamais en inventer.

Exemple :

Données :

```text
Talend
VINCI Energies
600 employés
6 pays
centralisation RH
```

Sortie acceptable :

```text
Conception et industrialisation de flux Talend pour la synchronisation
et la centralisation de données RH concernant environ 600 collaborateurs
répartis dans six pays.
```

Le CV Writer ne doit pas inventer :

```text
+30 % de productivité
```

si cette donnée n'a jamais été fournie.

---

# 18. Session persistante

Conserver côté serveur :

```json
{
  "session_id": "...",
  "cv_id": "...",
  "current_state": "EXPERIENCE",
  "section_index": 1,
  "turns_in_section": 3,
  "section_status": "IN_PROGRESS",
  "section_transcript": [],
  "section_partial_data": {},
  "cv_data_so_far": {},
  "interview_status": "ACTIVE",
  "last_activity_at": "..."
}
```

MySQL suffit dans un premier temps.

Redis n'est pas requis.

---

# 19. Coupure réseau / reconnexion Gemini

Gemini Live reste la seule voie vocale.

Le système doit implémenter correctement :

- détection déconnexion WebSocket ;
- session resumption lorsque disponible ;
- gestion `GoAway` ;
- contexte Live compressé lorsque nécessaire ;
- restauration de l'état applicatif depuis la session serveur.

Si Gemini Live ne peut pas être reconnecté :

```text
interview_status = TEMPORARILY_UNAVAILABLE
```

Afficher :

```text
La conversation vocale a été interrompue.

Votre progression a été enregistrée.
Réessayez pour reprendre l'entretien.
```

Ne jamais basculer sur un autre TTS/STT.

---

# 20. Barge-in

Le comportement naturel actuel doit être conservé.

Pendant que Gemini parle :

```text
utilisateur commence à parler
        ↓
Gemini signale interruption
        ↓
stop immédiat playback
        ↓
vider audio buffer de l'ancien tour
        ↓
écouter nouveau tour
```

L'utilisateur doit pouvoir interrompre naturellement l'assistant.

---

# 21. Inactivité

L'inactivité n'est PAS une autorisation de terminer le CV.

Après timeout :

```text
"Vous êtes toujours là ?"
```

Puis éventuellement :

```text
session mise en pause
```

mais jamais :

```text
COMPLETED
```

Une session inactive peut être :

```text
PAUSED
```

ou rester `ACTIVE` selon l'implémentation.

---

# 22. Plan d'implémentation

## Phase 1 — Stabiliser Gemini Live

- [ ] conserver Gemini Live comme unique pipeline vocal ;
- [ ] vérifier `inputAudioTranscription` ;
- [ ] vérifier `outputAudioTranscription` ;
- [ ] conserver le barge-in ;
- [ ] fiabiliser buffer audio ;
- [ ] gérer reconnexion ;
- [ ] gérer session resumption ;
- [ ] gérer GoAway ;
- [ ] configurer context compression si nécessaire.

Objectif :

> voix naturelle stable avant toute refonte métier.

---

## Phase 2 — Retirer la construction du CV du Live

- [ ] retirer les tools CV actuels ;
- [ ] retirer les décisions de complétion globale du prompt Live ;
- [ ] conserver uniquement `request_end_interview` ;
- [ ] implémenter validation backend de cet arrêt ;
- [ ] réduire fortement le system prompt Live.

---

## Phase 3 — State Machine

- [ ] implémenter les états ;
- [ ] implémenter les transitions ;
- [ ] gérer EXPERIENCE[n] ;
- [ ] implémenter COMPLETE / COMPLETE_WITH_GAPS / SKIPPED ;
- [ ] ajouter max turns ;
- [ ] garantir le parcours obligatoire de toutes les sections.

---

## Phase 4 — Observateur / Extracteur

- [ ] lire les input transcriptions ;
- [ ] produire `section_patch` ;
- [ ] conserver `section_partial_data` ;
- [ ] extraire la section terminée ;
- [ ] validation Zod/Pydantic ;
- [ ] merge en code ;
- [ ] retry extraction maximum 1 fois.

---

## Phase 5 — Session persistante

- [ ] persister state machine ;
- [ ] persister transcript ;
- [ ] persister partial state ;
- [ ] persister CvData ;
- [ ] reprendre après coupure ;
- [ ] reprendre après `USER_STOPPED`.

---

## Phase 6 — CV Writer

- [ ] générer le résumé ;
- [ ] améliorer les formulations ;
- [ ] préserver strictement les faits ;
- [ ] préparer REVIEW ;
- [ ] conserver les templates/PDF existants.

---

# 23. Ce qui ne change PAS

- Gemini Live reste la voix.
- Le schéma final `CvData` reste la cible.
- Les templates CV existants restent compatibles.
- Le preview CV reste compatible.
- L'export PDF reste compatible.
- L'utilisateur peut interrompre la voix de l'IA.
- L'IA continue à rebondir naturellement.
- L'IA continue à demander des détails.
- Aucun fallback vocal n'est introduit.

---

# 24. Métriques à suivre

## Qualité

- taux de sections `COMPLETE_WITH_GAPS` ;
- taux de sections `SKIPPED` ;
- nombre moyen de tours par section ;
- taux d'extractions invalides ;
- nombre de corrections manuelles dans REVIEW.

## Technique

- nombre de coupures Gemini Live ;
- taux de reprise de session réussie ;
- durée moyenne des sessions ;
- délai transcription → mise à jour du draft ;
- erreurs WebSocket.

## Produit

- taux d'entretiens complétés ;
- taux d'arrêts explicites utilisateur ;
- taux de reprise après `USER_STOPPED` ;
- coût Gemini par CV finalisé.

---

# 25. Règles finales de sécurité fonctionnelle

Ces invariants doivent être garantis dans le code :

```text
1. Gemini Live ne modifie jamais directement CvData.

2. Gemini Live ne change jamais directement la State Machine.

3. Une suggestion du LLM n'est jamais une transition automatique sans validation code.

4. Toutes les sections doivent être parcourues avant FINALIZE.

5. Le manque d'information dans une section ne termine jamais l'entretien.

6. Le max_turns d'une section ne termine jamais l'entretien.

7. Une coupure réseau ne termine jamais l'entretien.

8. Une indisponibilité Gemini ne déclenche aucun fallback vocal.

9. La seule sortie anticipée autorisée est une demande explicite utilisateur.

10. Même dans ce cas, request_end_interview est validé par le backend.

11. USER_STOPPED conserve la progression et reste reprenable.

12. COMPLETED n'est atteint qu'après FINALIZE + REVIEW.
```

---

# 26. Résultat attendu

L'expérience cible est :

```text
Utilisateur
     ↕
Gemini Live
conversation vocale naturelle
     ↕
transcription
     ↓
Observateur silencieux
     ↓
State Machine
     ↓
CvData progressif
     ↓
CV Writer
     ↓
Review
     ↓
CV final
```

Le candidat doit avoir l'impression de parler avec un recruteur humain.

Pendant ce temps, la plateforme doit construire silencieusement un CV structuré et robuste.

La conversation reste naturelle.

La logique métier devient déterministe.

Et surtout :

> **Gemini ne termine jamais l'entretien parce qu'il "pense avoir fini".  
> Il ne peut demander une sortie anticipée que lorsque l'utilisateur souhaite explicitement arrêter.**
