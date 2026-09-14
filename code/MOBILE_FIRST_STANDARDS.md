# CHARTE TECHNIQUE & DIRECTIVES DESIGN MOBILE-FIRST

> **RÈGLE FONDAMENTALE ABSOLUE (NON-NÉGOCIABLE)** :  
> L'application GetJob Dashboard est pensée et construite **Mobile-First**.  
> Tout composant, écran, modal ou tableau doit être impeccable, aéré, sans débordement horizontal (`overflow-x` indésirable), avec un nombre d'icônes maîtrisé et une typographie parfaitement calibrée sur écrans étroits (360px - 430px).

---

## 1. Directives de Typographie & Gestion des Textes

1. **Zéro Débordement (`truncate` / `break-words`)** :
   - Tout titre, nom d'entreprise, document ou libellé dynamique doit être encadré par `min-w-0` sur son conteneur flex/grid et posséder la classe `truncate` ou `break-words`.
   - Ne jamais laisser un titre long pousser des icônes ou boutons hors de l'écran.

2. **Échelle Typographique Mobile Adaptée** :
   - Titres de page : `text-lg sm:text-xl font-bold` (au lieu de `text-2xl` rigide).
   - Sous-titres : `text-xs sm:text-sm text-slate-500` avec `truncate`.
   - Badges et métadonnées : `text-2xs` (`10px` / `11px`) pour éviter d'occuper la moitié de la largeur d'écran.

---

## 2. Tableaux vs Cartes Mobiles (Dual Layout Obligatoire)

1. **Interdiction Formelle des `<table>` bruts non responsives sur Mobile** :
   - Ne jamais afficher un `<table>` complet avec 5+ colonnes directement sur écran mobile (`< md`).
   - Utiliser systématiquement le **pattern Dual Layout** :
     - **Vue Mobile (`block md:hidden`)** : Liste verticale de cartes compactes (`divide-y divide-slate-100` ou cartes espacées), affichant l'icône, le titre, les badges et le bouton d'action pleine largeur ou aligné.
     - **Vue Desktop (`hidden md:block overflow-x-auto`)** : Tableau complet avec en-têtes et colonnes espacées.

2. **Écrans concernés par ce pattern** :
   - `documents.component.html` (Documents générés)
   - `application-list.component.html` (Mes candidatures)
   - `opportunity-list.component.html` (Opportunités détectées)

---

## 3. Header & Topbar (Épuration Maximale)

1. **Composants d'En-tête Compacts sur `< sm`** :
   - Le message de salutation (`Bonjour ...`) doit être tronqué sur mobile (`max-w-[130px] sm:max-w-[200px] md:max-w-none`).
   - Le badge de crédits pro doit être compact (`0 cr.` ou `15 cr.`) sur `< sm`, et n'afficher le texte complet `+ Recharger` que sur `sm:inline`.
   - Ne jamais surcharger la barre supérieure avec des boutons longs qui écrasent le menu hamburger ou l'avatar.

2. **Modales et Menus Déroulants** :
   - Les popovers et menus doivent avoir `max-w-[calc(100vw-24px)]` pour ne jamais dépasser de la fenêtre du smartphone.

---

## 4. Sobriété des Icônes & Éléments Graphiques

1. **Éviter la Saturation Visuelle** :
   - Pas plus d'une icône d'action principale par bloc/ligne sur mobile.
   - Privilégier des boutons d'action explicites avec icône discrète (14px/16px) et libellé clair.
   - Les boutons d'action sur mobile doivent respecter une hauteur tactile confortable (`h-8` à `h-9`, 32px à 36px minimum).

---

## 5. Checklist de Validation Mobile avant toute Clôture

- [ ] L'écran à 360px de large n'a **aucun scroll horizontal** non sollicité.
- [ ] Aucun texte ne dépasse ni ne force un retour à la ligne disgracieux (ex: "Curriculum \n Vitae").
- [ ] Les éléments de la Topbar respirent et ne se chevauchent pas.
- [ ] Les listes / tableaux sont présentés sous forme de cartes fluides sur mobile.
- [ ] Le build frontend (`npm run build`) et backend passent à 100%.