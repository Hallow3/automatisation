# PROMPT MAÎTRE — REFONTE UI/UX UNIFORME DE GETJOB.AI

## 0. Mission

Tu interviens sur une application **Angular + Tailwind CSS existante** appelée **GetJob.AI**.

L’application fonctionne déjà fonctionnellement. Le but de cette mission n’est **PAS** de réécrire le produit, de modifier les APIs, de toucher au backend ou de changer les workflows métier.

Ta mission est de **corriger et harmoniser toute l’interface UI/UX existante**, écran par écran, pour obtenir une application professionnelle, cohérente, moderne, lisible, vivante sans être surchargée, responsive et crédible comme produit SaaS B2B / carrière.

L’état actuel présente plusieurs incohérences visibles :

- textes blancs sur fonds blancs ou gris très clairs ;
- écrans noirs isolés au milieu d’une application claire ;
- accents cyan qui ne correspondent pas à la marque ;
- très grands espaces vides ;
- faible hiérarchie visuelle ;
- cartes parfois trop plates et sans personnalité ;
- états techniques affichés directement (`TO_REVIEW`, `DRAFT_READY`, `qualified_score`, etc.) ;
- certaines pages paraissent terminées, d’autres ressemblent à des prototypes ;
- manque de cohérence entre Dashboard, Opportunités, Candidatures, CV, entretien vocal, profil et paramètres ;
- densité parfois trop élevée sur certaines cartes, mais trop faible ailleurs ;
- beaucoup de gris et de blanc sans véritable identité de marque.

**Objectif final : toute l’application doit donner l’impression d’avoir été conçue par la même équipe, avec le même design system.**

---

# 1. Avant de coder

Avant toute modification :

1. Lire `SKILL.md` s’il existe.
2. Lire `AGENTS.md` s’il existe.
3. Lire `DESIGN.md` s’il existe.
4. Inspecter l’arborescence Angular.
5. Identifier le layout principal, la sidebar, la topbar, les composants partagés, les cards, badges, boutons, inputs, pages concernées, fichiers Tailwind/CSS globaux et les modèles/types UI existants.
6. Détecter la version de Tailwind (`package.json`) et choisir la méthode en conséquence :
   - **Tailwind v3** → déclarer les tokens dans `tailwind.config.js` (`theme.extend.colors`, `borderRadius`, `boxShadow`) ET en variables CSS `:root` (section 28) pour les usages hors classes utilitaires (SVG, motifs).
   - **Tailwind v4** → déclarer les tokens directement en CSS via `@theme { ... }`, sans recréer un `tailwind.config.js` si le projet n’en a plus.
   - Ne jamais coder une couleur en dur dans un template : toujours passer par la classe Tailwind générée ou `var(--brand-orange-500)`.
7. Détecter la bibliothèque d’icônes déjà installée et la réutiliser en priorité. N’en ajouter une nouvelle que si des icônes manquent réellement (orbe vocal, statuts d’automatisation) — dans ce cas utiliser `lucide-angular` (légère, style trait fin, MIT).
8. Vérifier la police actuelle : la garder si c’est déjà une sans-serif lisible et pro (Inter, Roboto, system-ui, SF Pro, Segoe UI). Sinon la remplacer partout par **Inter**, cohérente avec les références citées.
9. Réutiliser au maximum les composants existants.
10. Ne pas dupliquer un composant uniquement pour changer une couleur.
11. Ne modifier aucune API ou logique métier si ce n’est pas indispensable à l’affichage.
12. Conserver les routes existantes.
13. Ne pas casser la connexion Gemini Live ni les workflows CV.
14. Travailler sur une branche dédiée (ex. `feature/ui-ux-refonte`), committer à la fin de chaque page/étape avec un message clair (ex. `ui: refonte Dashboard - tokens + KPI cards`). Jamais un seul gros commit : ça doit rester revuable et « rollback-able » page par page.

## Règle de priorité en cas de conflit

- Si une valeur de ce document (couleur, radius, spacing, typo) diffère d’une valeur déjà utilisée dans le code existant, même de façon cohérente : **la valeur de ce document fait foi**. C’est l’objet même de la refonte, ce n’est pas une décision à prendre à chaque fois.
- Si une consigne est ambiguë sur un cas précis non couvert explicitement par ce document : privilégier l’option la plus proche des références citées (Linear/Attio/Ashby/Vercel/Stripe), rester cohérent avec le reste du document, et noter le choix fait dans le rapport final (section 30, Phase 4).

## Contraintes techniques

- Angular existant.
- Tailwind CSS.
- Séparation stricte `.ts` / `.html` / `.css`.
- Pas de template inline.
- Pas de style inline.
- Pas d’Angular Material si le projet ne l’utilise pas déjà.
- Pas de nouveau framework CSS.
- Pas de migration vers React/Next.
- Pas de refonte backend.
- Pas de microservice.
- Pas de dépendances lourdes uniquement pour de l’esthétique.
- Utiliser les icônes déjà présentes dans le projet si possible (voir détection, point 7).

---

# 2. Références visuelles

Ne copie aucun produit pixel par pixel.

Utilise ces références uniquement pour comprendre les principes :

## Linear

S’inspirer de Linear pour la hiérarchie visuelle, la densité maîtrisée, les bordures discrètes, la lisibilité des interfaces de travail, la cohérence des composants et les états hover/focus.

## Attio

S’inspirer d’Attio pour les dashboards, les cartes modulaires, les vues de données, les filtres et les layouts organisés.

## Ashby

S’inspirer d’Ashby pour les interfaces liées au recrutement, les pipelines, les statuts, les listes d’opportunités et les écrans orientés action.

## Vercel / Stripe

S’inspirer de Vercel / Stripe pour la précision des espacements, les bordures nettes, les états interactifs, les interfaces de paramètres et les dashboards opérationnels.

**Ne pas reprendre leur noir dominant. GetJob.AI reste principalement clair.**

---

# 3. Identité visuelle GetJob.AI

## 3.1 Couleurs principales

### Bleu nuit / bleu foncé

```css
--brand-navy-950: #071A2F;
--brand-navy-900: #0B223D;
--brand-navy-800: #12345A;
--brand-navy-700: #194574;
```

Le bleu foncé représente confiance, structure, professionnalisme, navigation, intelligence et actions principales.

### Orange

```css
--brand-orange-600: #EA580C;
--brand-orange-500: #F97316;
--brand-orange-400: #FB923C;
--brand-orange-100: #FFEDD5;
--brand-orange-50: #FFF7ED;
```

L’orange représente action, priorité, opportunité, énergie, accents visuels et étapes importantes.

### Neutres

```css
--surface-page: #F6F8FB;
--surface-card: #FFFFFF;
--surface-soft: #F0F4F8;
--text-primary: #102033;
--text-secondary: #5D6B7A;
--text-muted: #5F6E7D;
--border-default: #DDE4EC;
--border-strong: #C9D3DF;
```

**Correction** : `--text-muted` était à `#8793A1`, trop clair (contraste < 3:1, illisible en petite taille). Valeur corrigée ci-dessus, conforme WCAG AA (voir section 4). Utiliser `--border-strong` (pas `--border-default`) pour les bordures d’inputs et d’éléments interactifs — plus perceptible.

### Couleurs sémantiques uniquement

```css
--success: #15803D;
--warning: #D97706;
--danger: #DC2626;
--info: #2563EB;
```

Ne jamais utiliser le vert, rouge ou jaune comme couleurs décoratives générales. Ces couleurs sont réservées aux états.

### Teintes claires et variantes texte (manquantes dans la version initiale)

Le document parle plusieurs fois de « fond navy très léger » ou « texte orange foncé » sans donner de valeur exacte. Pour ne rien laisser à l’interprétation :

```css
--brand-navy-100: #DCE4F0;
--brand-navy-50:  #EEF2F8;
--brand-orange-700: #C2410C;

--success-bg:   #F0FDF4;
--success-100:  #DCFCE7;
--warning-bg:   #FFFBEB;
--warning-100:  #FEF3C7;
--warning-text: #B45309;
--danger-bg:    #FEF2F2;
--danger-100:   #FEE2E2;
--danger-text:  #B91C1C;
--info-bg:      #EFF6FF;
--info-100:     #DBEAFE;
```

- `--brand-navy-100` / `--brand-navy-50` = le « fond navy très léger » (état actif sidebar, bulles IA de l’entretien vocal, bandeaux).
- `--brand-orange-700` = le « texte orange foncé » sur fond `orange-50`/`orange-100`.
- `--success-bg` / `--warning-bg` / `--danger-bg` / `--info-bg` = fonds clairs pour les badges de statut (section 9), pendant du couple `orange-50` + `orange-600` déjà défini pour l’orange.
- `--warning-text` / `--danger-text` = à utiliser quand `warning`/`danger` servent de **texte** sur fond clair (les valeurs de base passent sous 4.5:1 en petite taille — voir section 4). `--warning`/`--danger` d’origine restent corrects pour icônes, bordures et remplissages.

---

# 4. Règles de contraste ABSOLUES

Corriger immédiatement toutes les erreurs de contraste actuelles.

Interdictions :

- texte blanc sur fond blanc ;
- texte blanc sur fond gris clair ;
- texte gris très clair sur fond blanc ;
- titre bleu très pâle illisible ;
- bouton avec texte sans contraste ;
- placeholder trop clair ;
- icône invisible ;
- badge dont texte et fond ont presque la même luminance.

Règle :

- sur fond clair → texte principal foncé ;
- sur fond bleu nuit → texte blanc ;
- sur fond orange → texte blanc ou bleu nuit selon contraste réel ;
- sur fond `orange-50` → texte orange foncé ;
- texte secondaire minimum autour de `#5D6B7A`.

Tous les écrans doivent rester lisibles sans sélectionner le texte avec la souris.

## Seuils numériques (WCAG 2.1 AA)

- Texte normal (< 24px, ou < 18.66px en gras) : ratio ≥ **4.5:1**.
- Texte large (≥ 24px, ou ≥ 18.66px en gras) : ratio ≥ **3:1**.
- Bordures d’éléments interactifs (input, checkbox) : ratio ≥ **3:1** contre leur fond.

Vérifié sur cette palette (calcul WCAG réel, pas une estimation visuelle) :

- `text-primary`, `text-secondary`, `success`, `info` sur `surface-page`/`surface-card`/blanc : conformes partout.
- Bouton Accent plein (`orange-600` fond + texte blanc) : ≈3.6:1 — conforme au seuil « texte large » mais pas au seuil « texte normal ». Compromis courant pour un CTA de marque saturée (garder `orange-600` par défaut). Si une conformité stricte sur le libellé est exigée, utiliser `orange-700` (≈5.2:1) comme fond, uniquement pour ce composant précis.
- `warning` et `danger` **utilisés comme texte** (pas comme icône/bordure/remplissage) : utiliser `--warning-text` / `--danger-text` plutôt que les valeurs de base, qui tombent sous 4.5:1 en petite taille.

---

# 5. Typographie et rythme

Police : voir détection et règle de fallback (Inter) en section 1, point 8.

Hiérarchie recommandée :

```text
Page title        28–32px / 700
Section title     18–20px / 650-700
Card title        15–17px / 600-700
Body              14–15px / 400-500
Secondary         13–14px
Caption           12px
```

Ne pas créer de titres énormes. Le produit est un outil de travail, pas une landing page.

Sur mobile (< 768px), réduire seulement les titres : Page title → 24–26px, Section title → 17–18px. Le corps de texte (Body/Secondary/Caption) ne change pas.

Espacements :

```text
4px   micro spacing
8px   proximité
12px  contrôle
16px  contenu standard
24px  séparation de groupes
32px  séparation de sections
40px  grandes sections
```

Correspondance avec les classes Tailwind par défaut (`spacing` = 0.25rem = 4px) :

```text
4px  → 1     8px  → 2     12px → 3     16px → 4
24px → 6     32px → 8     40px → 10
```

Utiliser ces classes (`p-4`, `gap-6`, `mb-8`…) plutôt que des valeurs arbitraires `p-[16px]`, sauf si la config Tailwind du projet a déjà redéfini l’échelle — dans ce cas suivre l’échelle existante du projet.

Éviter les pages avec des centaines de pixels de vide sans raison.

Largeur principale recommandée : `max-width: 1440px` avec marges fluides.

---

# 6. Rayons, bordures et ombres

Rayons :

```text
Inputs       8–10px
Buttons      9–10px
Cards        14–16px
Large panel  18px
```

Bordure standard :

```css
border: 1px solid var(--border-default);
```

Ombre légère :

```css
box-shadow:
  0 1px 2px rgba(15, 23, 42, 0.04),
  0 8px 24px rgba(15, 23, 42, 0.04);
```

Pas d’ombre noire énorme.

---

# 7. Motifs visuels pour rendre les cards vivantes

Créer 2 ou 3 motifs CSS réutilisables, sobres et subtils.

## Motif A — Dot grid

```css
background-image:
  radial-gradient(
    circle at 1px 1px,
    rgba(11, 34, 61, 0.08) 1px,
    transparent 0
  );
background-size: 18px 18px;
```

## Motif B — Orange glow

Pseudo-élément en haut à droite :

```css
background:
  radial-gradient(
    circle,
    rgba(249, 115, 22, 0.14),
    rgba(249, 115, 22, 0) 68%
  );
```

## Motif C — Navy grid

```css
background-image:
  linear-gradient(rgba(11, 34, 61, 0.035) 1px, transparent 1px),
  linear-gradient(90deg, rgba(11, 34, 61, 0.035) 1px, transparent 1px);
background-size: 24px 24px;
```

Règles : motifs à faible opacité, un motif maximum par card, jamais au détriment de la lisibilité. Les utiliser surtout pour KPI, empty state, bloc IA, automatisations, création CV et card sélectionnée.

---

# 8. Règles globales de composants

## Boutons

### Primary

Fond bleu nuit, texte blanc. Usage : Enregistrer, Voir le détail principal, Relancer, Continuer.

### Accent / Action business

Orange. Usage uniquement pour l’action la plus importante : Préparer, Candidater, Créer le CV, Générer, Démarrer l’entretien.

Ne pas avoir 5 boutons orange sur le même écran.

### Secondary

Fond blanc + bordure.

### Ghost

Retour, Ignorer, Annuler, actions secondaires.

### Destructive

Rouge uniquement pour suppression réelle.

## Champs de formulaire (inputs, select, textarea)

Absent du reste du document alors que Profil, Paramètres et l’éditeur de CV en dépendent. États obligatoires pour chaque champ :

```text
Default   fond blanc, border-default, text-primary
Focus     border-strong ou navy-700, ring 2px (navy-700 ou info à 30% d’opacité)
Erreur    border danger, texte d’aide danger-text 12–13px sous le champ
Disabled  fond surface-soft, text-muted, curseur not-allowed
```

Label toujours au-dessus du champ (jamais le placeholder comme seul label). Placeholder en `text-muted`, jamais plus clair que ça. Ne jamais supprimer le `outline` du focus sans le remplacer par le ring ci-dessus.

---

# 9. Badges et statuts

Ne jamais afficher les valeurs techniques du backend telles quelles.

Créer un mapping UI centralisé.

```text
TO_REVIEW       → À examiner
QUALIFIED       → Qualifiée
READY           → Prête
APPLIED         → Envoyée
INTERVIEW       → Entretien
DISMISSED       → Ignorée
REJECTED        → Non retenue
DRAFT           → Brouillon
DRAFT_READY     → Prêt à finaliser
COMPLETED       → Finalisé
qualified_score          → Bon potentiel
review_strong_role_match → Profil proche du poste
```

Les clés techniques peuvent exister dans le code mais **jamais apparaître dans l’interface**.

## Couleur par famille de statut

Pour ne pas laisser le choix de couleur au hasard :

```text
Neutre  (text-muted + surface-soft)     → DISMISSED, DRAFT
Warning (warning-text + warning-bg)     → TO_REVIEW
Info    (info + info-bg)                → QUALIFIED, APPLIED, DRAFT_READY
Success (success + success-bg)          → READY, INTERVIEW, COMPLETED
Danger  (danger-text + danger-bg)       → REJECTED
```

Un badge = fond clair de la famille + texte de la même famille — jamais de couleur de statut sur fond blanc, pour rester repérable en un coup d’œil dans une liste.

---

# 10. Sidebar globale

Conserver la structure si elle est fonctionnelle, mais la raffiner.

**Fond de la sidebar : clair** (`--surface-card` blanc ou `--surface-page`), pas de fond bleu nuit plein — cohérent avec « GetJob.AI reste principalement clair » (section 2). Le bleu nuit marque les textes/icônes actifs, pas la surface entière. Réutiliser le logo existant du projet tel quel, ne pas en recréer un.

Desktop : 220–240px.

```text
Logo + GetJob.AI

PRINCIPAL
- Tableau de bord
- Opportunités
- Candidatures
- Mes CV

COMPTE
- Profil
- Paramètres

SUIVI
- Documents
- Activité
```

État actif : fond navy très léger ou orange-50, texte navy-900, petit indicateur orange vertical ou icône teintée, bordure discrète.

Tablette (768–1023px) : sidebar réduite à icônes seules (64–72px), libellé en tooltip au survol, même logique d’état actif. Un bouton en bas de sidebar peut basculer entre icônes seules et texte+icônes si la place manque.

La carte basse “Recherche automatique” devient :

```text
● Automatisation active
3 recherches actives
Dernière analyse · 09:42
Voir l’activité →
```

Fond avec motif très léger.

---

# 11. Topbar

Identique sur toutes les pages.

```text
Recherche globale
                        Nouvelle recherche
                        Notifications
                        Avatar + nom
```

Hauteur 64–68px.

`Nouvelle recherche` peut être bleu nuit. L’orange est réservé aux actions directement liées à une opportunité/candidature/CV.

---

# 12. PAGE — TABLEAU DE BORD

La structure actuelle est une bonne base mais doit être plus vivante et hiérarchisée.

## Header

```text
Tableau de bord
Votre point quotidien : ce qui a été détecté automatiquement et ce qui attend votre décision.
```

À droite :

```text
Relancer l’analyse
Créer un CV
```

`Créer un CV` = orange. `Relancer l’analyse` = secondaire.

## Bandeau d’attention

`Candidatures prêtes pour validation` : fond orange très pâle, bordure orange douce, icône orange, texte bleu nuit, CTA à droite.

## KPI

5 cards maximum : Opportunités détectées, Opportunités qualifiées, À préparer, Entretiens, CV disponibles.

Chaque card : icône, valeur forte, label, petite évolution, motif discret, éventuellement fine barre orange/navy. Ne pas utiliser cinq couleurs différentes.

## À traiter en priorité

Structure :

```text
[Prête] [Doopinet]                    82%
Développeur Web Full Stack
PATEGOU Consulting
📍 Douala · publiée il y a X jours

Très bon match avec votre profil
Angular · Spring Boot · Java

Lettre prête
Ignorer     Voir le détail      Préparer
```

Ne jamais afficher `qualified_score` ou `review_strong_role_match`.

## Automatisations

Faire de cette zone une feature distinctive, sans ressembler à une console technique :

```text
Automatisations
● Actif
3 recherches actives
14 offres importées aujourd’hui
Dernière synchronisation 09:42

Qualification & scoring   Actif
Recherche LinkedIn        Actif
Veille plateformes        Actif
```

Fond légèrement teinté, motif discret.

---

# 13. PAGE — OPPORTUNITÉS

La grille actuelle de 3 colonnes est trop dense. Recommandation : 2 colonnes desktop ou liste pleine largeur. Trois colonnes uniquement sur très grand écran si chaque card garde au moins ~400px.

## Header

```text
Opportunités
9 opportunités détectées et analysées selon votre profil.
```

Actions : Actualiser, Nouvelle recherche.

## Toolbar filtres

```text
[Recherche...] [Score] [Statut] [Ville] [Source] [Date] [Réinitialiser]
```

## Tabs

```text
Toutes (9)
Nouvelles
À examiner
Prêtes (2)
Postulées
Ignorées
```

Tab actif : fond navy léger, texte navy, underline orange possible.

## Opportunity card

```text
[À examiner] [Doopinet]                     74%

OFFRE DE STAGE PRÉ-EMPLOI DÉVELOPPEUR...
Y-Note
📍 Yaoundé, Cameroun

✦ Pourquoi cette offre ?
Votre expérience Java/Spring correspond fortement au besoin.

Java · Spring Boot · Angular · +3

Lettre à générer
Ignorer | Voir le détail | Préparer
```

Titre maximum 2 lignes, ne pas tronquer agressivement. `Préparer` orange.

---

# 14. PAGE — CANDIDATURES

L’état vide actuel utilise beaucoup trop d’espace pour trop peu d’information.

## Header

```text
Mes candidatures
Suivez les candidatures envoyées et leurs prochaines étapes.
```

CTA : `Examiner les opportunités`.

## Empty state

Card centrée max-width ~620px :

```text
[icône dossier / motif]
Aucune candidature envoyée

Lorsque vous validerez une opportunité,
elle apparaîtra ici avec son statut et son historique.

Voir les opportunités
```

Dot-grid très léger.

## Avec données

Toolbar : recherche, statut, date, canal.

Table/list :

```text
Entreprise | Poste | Date | Canal | CV | Statut | Prochaine action
```

Une vue Pipeline peut être ajoutée uniquement si elle reste simple et utile.

---

# 15. PAGE — MES CV

La page actuelle paraît trop blanche et les previews sont peu intégrées.

## Header

```text
Mes CV
Créez et gérez les différentes versions de votre CV.
```

CTA orange : `+ Nouveau CV`.

## Cards

3 colonnes desktop, 2 tablette, 1 mobile.

```text
[Preview réelle]
CV Full Stack — FR
Moderne épuré
Mis à jour le 22 août 2026
[Prêt à finaliser]
Ouvrir   ⋯
```

Menu : Ouvrir, Modifier, Télécharger PDF, Renommer, Dupliquer, Supprimer.

Ne jamais afficher `DRAFT_READY` brut.

## New CV card

```text
+
Créer un nouveau CV
Entretien vocal ou saisie manuelle
```

Fond bleu léger + motif + accent orange.

---

# 16. PAGE — CHOIX DU TEMPLATE CV

L’écran noir actuel doit être entièrement harmonisé.

**Supprimer le full-page noir.**

Fond global : `#F6F8FB`.

Breadcrumb : `Mes CV / Nouveau CV / Choisir un modèle`.

## Template cards

```text
[Preview CV]
Moderne Épuré
1–2 pages
Lisible, moderne, polyvalent
```

```text
[Preview CV]
Deux Colonnes
1–2 pages
Compétences mises en avant
```

```text
[Preview CV]
Classique Pro
1 page
Sobre et institutionnel
```

Sélection : border orange 2px, badge orange `Sélectionné`, légère élévation, jamais cyan.

Footer : Retour, Remplir manuellement, Créer avec l’IA vocale. `Créer avec l’IA vocale` = orange.

---

# 17. PAGE — ENTRETIEN VOCAL IA

L’écran actuel est trop vide et donne peu de feedback. Il doit devenir un écran signature de GetJob.AI.

## Desktop

Deux colonnes 65/35 :

```text
┌────────────────────────────────┬──────────────────────┐
│ Entretien vocal                │ Votre CV se construit│
│ Voice UI                       │ en direct             │
│ Transcript                     │ Draft sections        │
└────────────────────────────────┴──────────────────────┘
```

## Header

```text
← Retour
Entretien vocal IA
Construisons votre CV à partir d’une conversation naturelle.
[Quitter]
```

## Voice card

Fond blanc, `● Connecté à Gemini Live` en haut.

Au centre : orb/microphone, anneaux animés subtils, bleu nuit dominant, orange quand l’IA parle, pas de cyan, pas d’animation agressive.

États : Connexion..., Je vous écoute, L’assistant répond, Interrompu, Analyse de votre réponse.

Message : `Parlez naturellement. Vous pouvez interrompre l’assistant à tout moment.`

## Transcript

```text
Conversation

IA
Parlez-moi du type de poste que vous recherchez...

Vous
Je suis développeur full stack...
```

IA = fond navy très léger. User = fond orange très léger. Texte toujours foncé.

## CV draft live

Panneau droit sticky :

```text
Votre CV se construit
✓ Identité
✓ Titre professionnel
● Expériences
○ Formation
○ Compétences
○ Langues
```

Afficher les informations connues afin que l’utilisateur voie que la conversation produit réellement son CV.

## Footer

`Terminer l’entretien` et `Quitter`, positionnés proprement, jamais perdus au milieu du viewport.

---

# 18. PAGE — ÉDITION & FINALISATION DU CV

Supprimer le grand thème noir actuel.

Structure :

```text
Page background : #F6F8FB

┌────────────────────────────────────────────┐
│ ← Mes CV   Édition & finalisation    Save  │
├──────────────────────┬─────────────────────┤
│ Formulaire           │ Aperçu              │
│ Sections scrollables │ A4 paper            │
└──────────────────────┴─────────────────────┘
```

## Colonne formulaire

Fond blanc. Sections : Identité, Titre & résumé, Expériences, Projets, Formation, Compétences, Langues. Utiliser accordéons ou cards sobres afin d’éviter 30 inputs visibles en même temps.

## Preview

Fond `#E8EDF3`. Document blanc A4 avec légère ombre. Toolbar : `Aperçu en temps réel`, zoom, `Changer de modèle`.

---

# 19. PAGE — PROFIL

La page actuelle est trop vide et manque de structure.

## Header profile card

```text
[Avatar]
Waffo Mohamed Brayant
Ingénieur logiciel
Douala, Cameroun
Disponible immédiatement

Profil complété à 82%
[Modifier mon profil]
```

Progress bar fine orange.

## Sections

Grid 2 colonnes : Objectif professionnel, Localisation & disponibilité, Types de contrat, Compétences, Liens, Préférences de recherche.

Compétences sous forme de chips cohérentes, pas de texte perdu dans la page.

---

# 20. PAGE — PARAMÈTRES

Corriger en priorité les textes blancs illisibles.

## Layout

Desktop : petit menu vertical settings + contenu, ou colonne unique si le nombre de paramètres reste faible.

## Notifications

```text
Notifications

Nouvelles opportunités
Recevoir une alerte lorsqu’une offre correspond à votre profil.
                                      [toggle]

Rappels de candidature
Recevoir un rappel après plusieurs jours sans réponse.
                                      [toggle]
```

## Intégrations

Chaque intégration devient une row/card :

```text
[n8n]
n8n Automation
Connecté
Automatise vos recherches et traitements.
                                      Configurer
```

```text
[LinkedIn]
LinkedIn
Non connecté
                                      Connecter
```

Ne pas laisser les textes flotter seuls.

## Compte

Card dédiée : plan actuel puis danger zone `Supprimer mon compte` séparée.

---

# 21. PAGE — DOCUMENTS

Utiliser une table/list claire :

```text
Document | Type | Opportunité | Date | Statut | Actions
```

Types : CV, Lettre de motivation, Autre.

---

# 22. PAGE — ACTIVITÉ

Créer une timeline claire :

```text
09:42  14 offres importées
09:44  2 offres qualifiées
10:02  Lettre générée pour PATEGOU Consulting
11:13  CV mis à jour
```

Icônes + trait vertical subtil. Pas de console technique.

---

# 23. Responsive

Points de rupture (breakpoints Tailwind par défaut — à confirmer si le projet en a redéfini dans `tailwind.config.js`) :

```text
Desktop  ≥ 1024px (lg)
Tablette 768–1023px (md–lg)
Mobile   < 768px (< md)
```

Desktop : sidebar fixe + topbar.

Tablette : sidebar compacte/collapsible.

Mobile : sidebar en drawer, cards en 1 colonne.

Opportunity cards : actions principales visibles.

CV editor mobile : tabs `Éditer | Aperçu`.

Entretien vocal mobile : Voice → Transcript → Draft. Ne pas maintenir le 65/35.

---

# 24. États loading / empty / error

Créer des composants cohérents.

Loading : skeletons, pas de spinner gigantesque au milieu d’une page vide.

Empty state : icône/illustration + titre + explication + CTA.

Error : message clair + `Réessayer`. Ne jamais afficher une stack trace ou une erreur backend brute.

---

# 25. Micro-interactions

Transitions 150–220ms.

Hover card : bordure plus visible, légère élévation, éventuellement `translateY(-1px)`.

Tous les boutons ont hover, active, focus-visible.

Pas de grosses animations.

Respecter `prefers-reduced-motion: reduce` : désactiver ou réduire fortement les transitions/animations (anneaux de l’orbe vocal inclus) pour les utilisateurs qui l’ont activé.

---

# 26. Accessibilité

Obligatoire : contraste lisible, focus-visible, labels de formulaires, aria-label quand nécessaire, hit targets confortables, états disabled visibles, navigation clavier.

Focus-visible : anneau 2px `--brand-navy-700` (ou `--info` sur fond navy), décalage 2px pour rester visible sur tous les fonds définis dans ce document.

Ne pas se fier uniquement à la couleur pour un statut.

---

# 27. Nettoyage des incohérences techniques visibles

Chercher dans le code et supprimer de l’interface utilisateur les chaînes brutes :

```text
TO_REVIEW
DRAFT_READY
qualified_score
review_strong_role_match
```

Créer des mappings UI partagés au lieu de remplacer manuellement dans chaque template.

Exemples :

```ts
getOpportunityStatusLabel(status: string): string
getCvStatusLabel(status: string): string
getMatchReasonLabel(reason: string): string
```

Ou réutiliser une structure centrale existante.

---

# 28. Design tokens centralisés

Ne pas coder les couleurs à la main partout.

```css
:root {
  /* Marque */
  --brand-navy-950: #071A2F;
  --brand-navy-900: #0B223D;
  --brand-navy-800: #12345A;
  --brand-navy-700: #194574;
  --brand-navy-100: #DCE4F0;
  --brand-navy-50:  #EEF2F8;

  --brand-orange-700: #C2410C;
  --brand-orange-600: #EA580C;
  --brand-orange-500: #F97316;
  --brand-orange-400: #FB923C;
  --brand-orange-100: #FFEDD5;
  --brand-orange-50:  #FFF7ED;

  /* Surfaces & texte */
  --surface-page: #F6F8FB;
  --surface-card: #FFFFFF;
  --surface-soft: #F0F4F8;
  --text-primary: #102033;
  --text-secondary: #5D6B7A;
  --text-muted: #5F6E7D;
  --border-default: #DDE4EC;
  --border-strong: #C9D3DF;

  /* États sémantiques */
  --success: #15803D;
  --success-bg: #F0FDF4;
  --success-100: #DCFCE7;
  --warning: #D97706;
  --warning-text: #B45309;
  --warning-bg: #FFFBEB;
  --warning-100: #FEF3C7;
  --danger: #DC2626;
  --danger-text: #B91C1C;
  --danger-bg: #FEF2F2;
  --danger-100: #FEE2E2;
  --info: #2563EB;
  --info-bg: #EFF6FF;
  --info-100: #DBEAFE;
}
```

**Correction** : le bloc initial omettait `navy-700`, `text-muted`, `border-strong` et les 4 couleurs sémantiques pourtant définies en section 3 — bloc complété ci-dessus, c’est la seule source de vérité à copier.

Adapter proprement à la version Tailwind existante (méthode détaillée en section 1, point 6). Ne pas remplacer toute la configuration Tailwind si ce n’est pas nécessaire.

---

# 29. Composants partagés à privilégier

Créer ou rationaliser uniquement si nécessaire :

```text
AppPageHeader
AppCard
AppButton
StatusBadge
ScoreBadge
EmptyState
SectionHeader
SearchFilterBar
OpportunityCard
CvCard
IntegrationRow
AutomationStatusCard
PageSkeleton
```

Ne pas créer 30 abstractions. Le but est la cohérence, pas l’architecture pour l’architecture.

Si un composant partagé existant a déjà une API (inputs/props) différente de celle impliquée ici : **étendre** cette API (inputs optionnels avec valeurs par défaut) plutôt que la réécrire — ne jamais casser un usage existant ailleurs dans l’app pour satisfaire une seule page.

---

# 30. Ordre d’implémentation

## Phase 1 — Fondations

1. tokens ;
2. typographie ;
3. surfaces ;
4. boutons ;
5. badges ;
6. sidebar ;
7. topbar ;
8. page container.

## Phase 2 — Composants principaux

1. cards ;
2. KPI ;
3. OpportunityCard ;
4. EmptyState ;
5. CvCard ;
6. formulaire ;
7. integration row.

## Phase 3 — Pages

1. Tableau de bord ;
2. Opportunités ;
3. Candidatures ;
4. Mes CV ;
5. Choix template ;
6. Entretien vocal ;
7. Éditeur CV ;
8. Profil ;
9. Paramètres ;
10. Documents ;
11. Activité.

## Phase 4 — QA et vérification

1. Build du projet (`ng build` ou équivalent) sans erreur.
2. Faire tourner la suite de tests existante (unitaires/e2e) si elle existe ; ne pas en écrire de nouvelle sauf demande explicite.
3. Si un outil de capture d’écran/navigateur est disponible dans l’environnement d’exécution : ouvrir chacune des 11 pages à 3 largeurs (mobile, tablette, desktop) et vérifier visuellement contre la checklist de la section 31.
4. Sans outil de capture : relire chaque template modifié en vérifiant explicitement contraste, responsive, scroll, overflow, états actifs, textes longs, états vides, données nulles, hover, focus et disabled.
5. Produire un court rapport final (dans la réponse, ou un fichier `RAPPORT_REFONTE.md`) listant : les fichiers modifiés par page, toute modification TypeScript effectuée et pourquoi, et les choix faits sur les points d’ambiguïté signalés en section 1 (« Règle de priorité »).

---

# 31. Critères d’acceptation visuelle

La refonte n’est PAS terminée tant que :

- aucun texte blanc n’est illisible sur fond clair ;
- aucune page n’utilise un full-page noir sans justification ;
- aucun accent cyan résiduel ne contredit la palette ;
- bleu nuit + orange sont clairement la signature du produit ;
- toutes les pages utilisent le même shell ;
- les boutons ont la même logique ;
- les statuts sont traduits ;
- les cards ont des rayons et bordures cohérents ;
- les pages vides ne semblent pas cassées ;
- la densité est maîtrisée ;
- les motifs restent subtils ;
- l’application ne semble pas touffue ;
- l’utilisateur identifie immédiatement l’action principale ;
- les pages CV font partie visuellement du même produit ;
- l’entretien vocal semble être une feature premium du produit ;
- la version mobile reste utilisable ;
- chaque badge de statut suit la correspondance couleur de la section 9 (pas de couleur choisie au hasard) ;
- tous les champs de formulaire ont des états default/focus/erreur/disabled visuellement distincts (section 8) ;
- le build passe et les tests existants, s’il y en a, passent toujours ;
- le rapport final (section 30, Phase 4) a été produit.

---

# 32. Résultat attendu

À la fin, GetJob.AI doit évoquer :

```text
Produit carrière sérieux
+
automatisation intelligente
+
outils de décision
+
SaaS B2B moderne
```

et non :

```text
template admin générique
+
pages indépendantes
+
prototype IA
```

L’utilisateur doit ressentir :

> “Le système travaille pour moi, me montre ce qui compte et me laisse décider.”

---

# 33. Important — Ne pas casser le produit

Ne change PAS :

- endpoints ;
- services Spring ;
- contrats backend ;
- fonctionnement n8n ;
- logique de scoring ;
- fonctionnement Gemini Live ;
- modèles métiers ;
- routes métier ;
- traitement des CV ;
- stockage MinIO.

Les changements doivent rester principalement :

```text
HTML
CSS / Tailwind
composants UI
mapping de labels UI
responsive
accessibilité
```

Si une modification TypeScript est nécessaire uniquement pour présenter correctement les données, elle doit rester petite et localisée.

---

# 34. Première action demandée

Avant d’écrire du code :

1. analyser les pages existantes ;
2. lister brièvement les incohérences trouvées ;
3. identifier les composants qui peuvent être mutualisés ;
4. présenter un mini-plan de modification ;
5. commencer l’implémentation par le design system global.

Ne propose pas une autre direction visuelle.

La direction est fixée :

```text
Fond clair
Bleu nuit
Orange
Cards vivantes avec motifs subtils
Interface aérée
Pas de noir plein écran
Pas de cyan
Pas de surcharge
```

Applique ensuite cette direction de manière uniforme sur toute l’application.
