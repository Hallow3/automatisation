# SKILL.md — Référentiel d’ingénierie senior

## 0. Règle absolue

Ce fichier est **obligatoire**.

Avant toute analyse, modification, génération de code, correction ou implémentation :

1. lire ce `SKILL.md` entièrement ;
2. lire les instructions du projet (`AGENTS.md`, `DESIGN.md`, `MOBILE_FIRST_STANDARDS.md`, README, conventions, docs techniques) ;
3. inspecter le code existant avant de proposer une solution ;
4. évaluer l’impact global avant de modifier un fichier ;
5. appliquer STRICTEMENT la charte **Mobile-First** (`MOBILE_FIRST_STANDARDS.md`) : zéro débordement de texte, aucun tableau brut sans carte mobile sur petits écrans, icônes mesurées et header épuré ;
6. ne jamais traiter une demande comme un ticket isolé sans vérifier les régressions possibles.

Le but n’est pas seulement de “faire marcher” la demande.

Le résultat doit être :

- correct ;
- robuste ;
- maintenable ;
- sécurisé ;
- testable ;
- cohérent avec l’architecture existante ;
- sans régression ;
- exploitable en production.

---

# 1. Posture attendue

Agir comme un **Senior / Lead Engineer**.

Ne pas :

- bricoler une solution locale qui dégrade le système global ;
- modifier un composant CORE pour résoudre un cas spécifique sans analyser les consommateurs ;
- multiplier les workflows, services, abstractions ou couches sans nécessité ;
- contourner l’architecture existante ;
- dupliquer du code déjà disponible ;
- introduire une dépendance sans justification ;
- cacher un problème sous un fallback silencieux ;
- remplacer massivement l’existant uniquement par préférence personnelle.

Toujours chercher :

- la bonne abstraction ;
- le meilleur point d’extension ;
- la compatibilité descendante ;
- la réutilisabilité ;
- la lisibilité ;
- le coût de maintenance futur.

---

# 2. Analyse d’impact obligatoire

Avant chaque modification importante, identifier :

## Entrées

- qui appelle ce composant ?
- quels formats sont acceptés ?
- quels champs sont obligatoires ?
- quelles valeurs par défaut existent ?

## Sorties

- qui consomme la réponse ?
- quel contrat doit rester stable ?
- quelles erreurs sont attendues ?

## Dépendances

- services ;
- workflows ;
- composants ;
- tables ;
- API ;
- fichiers de configuration ;
- autres modules.

## Risques

- régression fonctionnelle ;
- rupture de contrat ;
- perte de données ;
- concurrence ;
- rate limiting ;
- performance ;
- sécurité ;
- observabilité.

Une modification d’un composant partagé ou `CORE` exige une attention renforcée.

---

# 3. Architecture

Respecter les principes :

- séparation des responsabilités ;
- faible couplage ;
- forte cohésion ;
- SOLID lorsque pertinent ;
- architecture lisible avant architecture “intelligente” ;
- pas d’abstraction prématurée ;
- pas de duplication volontaire.

Favoriser :

```text
UI
↓
services / use cases
↓
domain / business logic
↓
API / persistence / external systems
```

Les détails techniques ne doivent pas contaminer les couches métier.

---

# 4. Réutilisabilité

Avant de créer un nouveau composant, service, helper, workflow ou utilitaire :

1. chercher si l’équivalent existe ;
2. vérifier s’il peut être étendu proprement ;
3. préférer une extension configurable à une duplication ;
4. ne créer une nouvelle abstraction que si elle clarifie réellement le système.

Ne pas créer une abstraction générique inutile pour un seul usage.

La réutilisabilité doit réduire le coût de maintenance, pas augmenter artificiellement le nombre de fichiers.

---

# 5. Angular

## Obligatoire

- TypeScript strict ;
- composants Angular propres ;
- services pour les appels API ;
- routing clair ;
- Reactive Forms lorsque nécessaire ;
- typage explicite ;
- gestion claire des états async ;
- séparation HTML / TypeScript / CSS.

## Séparation des fichiers

Toujours préférer :

```text
component/
├── component.component.ts
├── component.component.html
├── component.component.css
└── component.component.spec.ts
```

Interdiction par défaut :

```ts
template: `...`
styles: [`...`]
```

Le HTML ne doit pas être mélangé au TypeScript.

## UI

Utiliser **Tailwind CSS**.

Ne pas introduire Angular Material sauf demande explicite.

Favoriser :

- composants réutilisables ;
- design cohérent ;
- responsive ;
- accessibilité ;
- states : loading / empty / error / success.

---

# 6. Flutter

Lorsque le projet contient Flutter :

- séparer UI, état, domaine et accès aux données ;
- éviter les widgets monolithiques ;
- favoriser les widgets réutilisables ;
- ne pas placer de logique métier complexe directement dans `build()` ;
- gérer correctement async, erreurs et lifecycle ;
- respecter le design system du projet ;
- prévoir responsive/adaptive lorsque nécessaire ;
- éviter la duplication entre écrans.

---

# 7. Java / Spring Boot

Respecter :

- Spring Boot ;
- Maven ;
- injection par constructeur ;
- DTO explicites ;
- validations ;
- gestion centralisée des erreurs ;
- transactions correctement délimitées ;
- repositories sans logique métier ;
- services métier cohérents ;
- contrôleurs fins.

Éviter :

- classes gigantesques ;
- méthodes aux responsabilités multiples ;
- logique métier dans les contrôleurs ;
- requêtes SQL dispersées sans raison ;
- `catch (Exception)` silencieux ;
- valeurs magiques.

Les classes doivent rester raisonnablement petites et lisibles.

---

# 8. API

Toute API doit définir clairement :

- méthode HTTP ;
- route ;
- request ;
- response ;
- codes d’erreur ;
- validations ;
- autorisations ;
- idempotence lorsque nécessaire.

Ne jamais exposer directement une structure interne parce qu’elle “existe déjà”.

Créer des DTO métier adaptés au consommateur.

Ne pas exposer :

- données techniques internes ;
- stack traces ;
- secrets ;
- informations inutiles ;
- structures DB brutes si elles ne correspondent pas au contrat produit.

---

# 9. Sécurité

Se référer aux bonnes pratiques **OWASP**.

Vérifier notamment :

- authentification ;
- autorisation ;
- validation des entrées ;
- injection SQL ;
- XSS ;
- CSRF lorsque pertinent ;
- exposition de secrets ;
- logs sensibles ;
- upload de fichiers ;
- contrôle d’accès objet par objet ;
- dépendances vulnérables ;
- configuration CORS ;
- gestion des tokens.

Ne jamais stocker un secret dans le code source.

---

# 10. 12-Factor

Lorsque pertinent, respecter les principes **12-Factor App** :

- configuration par environnement ;
- dépendances explicites ;
- services externes traités comme ressources attachées ;
- build/release/run séparés ;
- processus stateless lorsque possible ;
- logs comme flux d’événements ;
- parity dev/prod raisonnable.

Ne pas coder en dur :

- URLs d’environnement ;
- credentials ;
- ports spécifiques ;
- clés API ;
- secrets.

---

# 11. Base de données

Avant une modification :

- inspecter le schéma existant ;
- comprendre les contraintes ;
- identifier les index ;
- vérifier les relations ;
- analyser les données existantes.

Toute migration doit être :

- explicite ;
- reproductible ;
- compatible avec les données existantes ;
- réversible lorsque raisonnable.

Éviter :

- suppression destructive sans analyse ;
- modification de colonnes sans stratégie de migration ;
- requêtes N+1 ;
- index manquants sur les accès fréquents.

---

# 12. Transactions

Une transaction doit représenter une unité métier cohérente.

Ne pas :

- garder une transaction ouverte pendant des appels réseau longs ;
- mélanger plusieurs responsabilités dans la même transaction ;
- supposer qu’un appel externe est transactionnel avec la DB.

Prévoir les comportements en cas d’échec partiel.

---

# 13. Erreurs

Une erreur ne doit jamais être ignorée sans raison.

Toute erreur importante doit être :

- détectée ;
- contextualisée ;
- loguée correctement ;
- propagée ou transformée ;
- présentée proprement au consommateur.

Éviter :

```text
catch → return null
catch → continue
catch → succès artificiel
```

sauf décision métier explicite.

---

# 14. Appels externes

Pour les API, IA, services tiers, n8n, stockage, etc. :

prévoir selon le besoin :

- timeout ;
- retry ;
- backoff ;
- rate limiting ;
- idempotence ;
- circuit breaker ;
- fallback ;
- observabilité.

Ne pas ajouter un retry aveugle sur une opération non idempotente.

Les limitations de fournisseur doivent être traitées au bon niveau architectural.

---

# 15. Workflows / n8n

Les workflows existants sont des composants du système.

Avant de créer un nouveau workflow :

1. vérifier si un workflow existant peut être étendu ;
2. privilégier un nouveau profil, une nouvelle branche ou un paramètre lorsque cela reste lisible ;
3. éviter l’explosion du nombre de workflows ;
4. conserver les contrats des workflows `CORE`.

Un workflow `CORE` doit être modifié uniquement avec :

- compatibilité descendante ;
- valeur par défaut sûre ;
- analyse de tous les consommateurs ;
- possibilité d’extension future.

Exemple de principe :

```text
provider + call_profile
```

est préférable à plusieurs routeurs presque identiques lorsqu’un seul routeur peut rester lisible et stable.

---

# 16. Design System

Avant toute modification UI :

1. lire `DESIGN.md` s’il existe ;
2. inspecter `resources/` ou `ressources/` ;
3. lire les références Google design.md présentes ;
4. identifier les composants UI existants ;
5. identifier les composants Uiverse disponibles.

Ne pas inventer de nouveaux patterns visuels sans vérifier l’existant.

Les composants Uiverse doivent être :

- adaptés au design du produit ;
- convertis proprement ;
- simplifiés ;
- rendus accessibles ;
- rendus responsive ;
- intégrés comme composants réutilisables.

---

# 17. Tailwind CSS

Tailwind est la solution de styling par défaut pour Angular.

Favoriser les classes utilitaires dans le HTML.

Utiliser les fichiers CSS pour :

- cas spécifiques ;
- animations complexes ;
- intégrations externes ;
- règles difficilement exprimables proprement en Tailwind.

Éviter :

- duplication de longues chaînes ;
- valeurs arbitraires partout ;
- design incohérent ;
- multiplication de classes custom sans nécessité.

---

# 18. Accessibilité

Respecter au minimum WCAG AA lorsque possible.

Vérifier :

- contraste ;
- focus visible ;
- navigation clavier ;
- labels ;
- sémantique HTML ;
- `aria-*` pertinent ;
- zones cliquables ;
- messages d’erreur ;
- états non transmis uniquement par couleur.

Préférer :

```html
<button>
<nav>
<main>
<section>
<header>
<aside>
```

aux `<div>` génériques lorsque la sémantique existe.

---

# 19. Performance

Analyser avant optimisation.

Mais éviter les anti-patterns évidents :

- appels répétés inutiles ;
- N+1 ;
- recalcul permanent dans les templates ;
- DOM excessif ;
- bundles inutilement lourds ;
- subscriptions non nettoyées ;
- pagination absente sur gros volumes ;
- polling agressif.

Mesurer lorsque la performance est réellement un enjeu.

---

# 20. Observabilité

Pour les parcours importants, prévoir :

- logs utiles ;
- correlation ID ;
- erreurs contextualisées ;
- métriques lorsque pertinent ;
- état des appels externes.

Un log doit aider à comprendre un incident.

Éviter les logs :

- trop bavards ;
- contenant des secrets ;
- contenant des données personnelles inutiles.

---

# 21. Tests

Une fonctionnalité n’est pas terminée simplement parce qu’elle compile.

Ajouter les tests pertinents :

## Backend

- unitaires ;
- intégration ;
- repository si nécessaire ;
- API ;
- sécurité.

## Angular

- composants critiques ;
- services ;
- logique de mapping ;
- comportements principaux.

## Flutter

- unit ;
- widget ;
- intégration lorsque nécessaire.

Tester au minimum :

```text
happy path
données vides
données partielles
erreurs
limites
cas de régression identifiés
```

---

# 22. Non-régression

Avant de terminer :

1. build ;
2. tests ;
3. analyse des erreurs ;
4. vérification des parcours impactés ;
5. vérification des contrats existants.

Une modification locale ne doit pas casser un consommateur indirect.

---

# 23. Documentation

Les documents du projet doivent rester centralisés et utiles à toutes les IA / agents :

- Codex ;
- Gemini ;
- ChatGPT ;
- autres agents.

Références attendues selon projet :

```text
SKILL.md
AGENTS.md
DESIGN.md
README.md
docs/
CHANGELOG.md
```

Ne pas cacher les décisions importantes uniquement dans une conversation.

---

# 24. Suivi des travaux

Pour chaque demande/ticket réellement implémenté :

1. créer ou identifier l’action correspondante dans le suivi du projet ;
2. cocher ce qui est terminé ;
3. laisser explicitement ce qui reste à faire ;
4. mettre à jour le changelog ou fichier de suivi prévu ;
5. documenter les décisions structurantes.

Exemple :

```markdown
## Action — Dashboard opportunités

- [x] Architecture des composants
- [x] Liste des opportunités
- [x] États loading/empty/error
- [ ] API réelle
- [ ] Confirmation de candidature
```

Le suivi doit permettre à une autre IA ou un autre développeur de reprendre le travail sans perdre le contexte.

---

# 25. Git

Avant un changement important :

- comprendre la branche ;
- inspecter les fichiers modifiés ;
- éviter les changements hors périmètre ;
- ne pas écraser les travaux existants.

Les commits doivent être cohérents et compréhensibles.

Ne pas inclure :

- secrets ;
- fichiers temporaires ;
- builds locaux ;
- dépendances générées non prévues ;
- logs.

---

# 26. Dépendances

Avant d’ajouter une dépendance :

1. vérifier si le besoin peut être couvert nativement ;
2. vérifier la maintenance du package ;
3. vérifier compatibilité et licence ;
4. vérifier poids / sécurité ;
5. justifier son usage.

Ne pas ajouter une bibliothèque pour quelques lignes facilement maintenables.

---

# 27. Configuration

La configuration doit être centralisée.

Utiliser :

- variables d’environnement ;
- fichiers d’environnement ;
- configuration typée lorsque possible.

Ne pas disperser :

```text
URLs
ports
timeouts
feature flags
clés
```

dans le code.

---

# 28. Règles de qualité

Avant de considérer le travail terminé :

- pas de duplication évidente ;
- pas de code mort ;
- pas de TODO évitable ;
- pas de logs de debug ;
- pas de `any` gratuit ;
- pas de magic numbers ;
- noms clairs ;
- fonctions raisonnablement courtes ;
- composants non monolithiques ;
- erreurs gérées ;
- tests pertinents ;
- build passant.

---

# 29. Checklist avant modification

- [ ] J’ai lu `SKILL.md`.
- [ ] J’ai lu les instructions du projet.
- [ ] J’ai inspecté le code existant.
- [ ] J’ai identifié les consommateurs du composant.
- [ ] J’ai analysé l’impact.
- [ ] J’ai vérifié qu’une solution équivalente n’existe pas déjà.
- [ ] J’ai choisi le meilleur point d’extension.
- [ ] J’ai évalué la compatibilité descendante.
- [ ] J’ai identifié les risques sécurité/performance/régression.

---

# 30. Checklist avant livraison

- [ ] Le besoin fonctionnel est couvert.
- [ ] L’architecture reste cohérente.
- [ ] La solution est réutilisable lorsque pertinent.
- [ ] Aucune duplication évitable n’est introduite.
- [ ] Les erreurs sont gérées.
- [ ] La sécurité a été vérifiée.
- [ ] Les tests pertinents existent et passent.
- [ ] Le build passe.
- [ ] Les parcours impactés ont été vérifiés.
- [ ] La documentation a été mise à jour.
- [ ] Le suivi / changelog a été mis à jour.
- [ ] Aucun secret n’est exposé.
- [ ] Aucun changement hors périmètre n’a été introduit.

---

# 31. Format de travail attendu de l’agent

Avant un travail significatif, produire brièvement :

```text
Analyse
Impact
Plan
```

Puis implémenter.

À la fin, fournir :

```text
Réalisé
Tests / validations
Fichiers principaux modifiés
Décisions importantes
Reste à faire
Risques éventuels
```

Ne pas produire un long rapport inutile lorsque quelques lignes suffisent.

---

# 32. Références d’ingénierie

Les décisions doivent être compatibles avec les principes issus notamment de :

- OWASP — sécurité applicative ;
- 12-Factor App — applications cloud / configuration ;
- SOLID — conception objet ;
- Clean Code — lisibilité et maintenabilité ;
- WCAG — accessibilité ;
- documentation officielle Angular ;
- documentation officielle Spring ;
- documentation officielle Flutter ;
- documentation officielle des dépendances utilisées.

Ces références sont des guides, pas une raison pour sur-concevoir.

---

# 33. Principe final

Toujours privilégier :

```text
bonne architecture
> patch local

compatibilité
> facilité immédiate

réutilisabilité utile
> duplication

simplicité maîtrisée
> complexité brillante

maintenabilité
> vitesse de livraison brute
```

Une solution est réellement terminée lorsqu’elle répond au besoin **sans dégrader le système autour d’elle**.
