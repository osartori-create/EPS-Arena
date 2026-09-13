## 1. Description du projet

Application web EPS (Éducation Physique et Sportive) pour gérer des activités sportives en classe via des iPads. Deux interfaces principales : le Professeur (`maitre.html`) et l'Élève (`eleve.html`). L'application est **100% RGPD** : aucun nom ou photo d'élève ne doit être présent dans Firebase.

---

## 2. Architecture des dossiers (Exhaustive)

C:.
│   eleve.html
│   GUIDE_IA.md
│   hub-icon.svg
│   icon.svg
│   maitre.html
│   manifest.json
│   
├───libs
│       xlsx.full.min.js
│       
└───src
    │   index.html
    │   
    ├───css
    │       evaluation.css
    │       style.css
    │       
    └───js
        │   app.js
        │   
        ├───config
        │       constants.js
        │       firebase-config.js
        │       index.js
        │       orientshow-default-codes.js
        │       
        ├───core
        │       firebase-service.js
        │       index.js
        │       live-engine.js
        │       state.js
        │       
        ├───modules
        │   │   index.js
        │   │   registry.js
        │   │   
        │   ├───arcathlon
        │   │       arcathlon-interface.js
        │   │       arcathlon-kiosk.js
        │   │       index.js
        │   │       
        │   ├───badminton
        │   │       badminton-charts.js
        │   │       badminton-common.js
        │   │       badminton-core.js
        │   │       badminton-dispatcher.js
        │   │       badminton-events.js
        │   │       badminton-firebase.js
        │   │       badminton-interface.js
        │   │       badminton-kiosk.js
        │   │       badminton-live.js
        │   │       badminton-maniere.js
        │   │       badminton-registry.js
        │   │       badminton-stats.js
        │   │       badminton-terrain.js
        │   │       badminton-tv.js
        │   │       badminton-ui-prof.js
        │   │       badminton-ui.js
        │   │       badminton-utils.js
        │   │       index.js
        │   │       
        │   ├───co
        │   │   │   circuit-manager.js
        │   │   │   co-detail.js
        │   │   │   co-interface.js
        │   │   │   co-kiosk.js
        │   │   │   co-live.js
        │   │   │   co-prof.js
        │   │   │   matrice.js
        │   │   │   
        │   │   ├───classique
        │   │   │       classique-prof.js
        │   │   │       
        │   │   └───orientshow
        │   │           orientshow-interface.js
        │   │           orientshow-prof.js
        │   │           
        │   ├───commun
        │   │       calculateur.js
        │   │       convertisseur.js
        │   │       penalite.js
        │   │       timer.js
        │   │       tir.js
        │   │       
        │   ├───eleve
        │   │       escalade-kiosk.js
        │   │       orientshow-kiosk.js
        │   │       
        │   ├───escalade
        │   │       escalade-blocs-core.js
        │   │       escalade-blocs-firebase.js
        │   │       escalade-calculations.js
        │   │       escalade-controller.js
        │   │       escalade-interface.js
        │   │       escalade-kiosk-blocs.js
        │   │       escalade-live.js
        │   │       escalade-prof-blocs.js
        │   │       escalade-prof.js
        │   │       escalade-tv-ui.js
        │   │       
        │   ├───evaluation
        │   │       evaluation-fiche.js
        │   │       evaluation-graphiques.js
        │   │       evaluation-interface.js
        │   │       evaluation-resultats.js
        │   │       evaluation-saisie.js
        │   │       evaluation-saut.js
        │   │       evaluation-sprint.js
        │   │       evaluation-stockage.js
        │   │       evaluation-sync.js
        │   │       evaluation-templates.js
        │   │       evaluation-utils.js
        │   │       evaluation-vma.js
        │   │       index.js
        │   │       
        │   ├───grilles
        │   │   │   grilles-core.js
        │   │   │   grilles-export.js
        │   │   │   grilles-import.js
        │   │   │   grilles-interface.js
        │   │   │   grilles-kiosk.js
        │   │   │   index.js
        │   │   │   
        │   │   └───connecteurs
        │   │           arcathlon.js
        │   │           escalade.js
        │   │           relais.js
        │   │           
        │   ├───multi
        │   │       multi-controller.js
        │   │       multi-live.js
        │   │       multi-prof.js
        │   │       
        │   ├───natation
        │   │       index.js
        │   │       natation-interface.js
        │   │       natation-kiosk.js
        │   │       natation-live.js
        │   │       natation-organisation.js
        │   │       natation-relais.js
        │   │       natation-tv.js
        │   │       
        │   ├───orientshow
        │   │       orientshow-interface.js
        │   │       orientshow-live.js
        │   │       orientshow-tv.js
        │   │       
        │   ├───poursuite
        │   │       poursuite-controller.js
        │   │       
        │   ├───relais
        │   │   │   index.js
        │   │   │   relais-core.js
        │   │   │   relais-interface.js
        │   │   │   relais-kiosk.js
        │   │   │   relais-live.js
        │   │   │   relais-tv.js
        │   │   │   
        │   │   └───variantes
        │   │       └───relais-2zones
        │   ├───sprint
        │   ├───teams
        │   │       team-generator.js
        │   │       
        │   └───tournoi
        │       │   tournoi-core.js
        │       │   tournoi-dispatcher.js
        │       │   tournoi-registry.js
        │       │   
        │       └───variantes
        │           └───elimination
        │                   elimination-core.js
        │                   elimination-kiosk.js
        │                   elimination-live.js
        │                   elimination-prof.js
        │                   elimination-tv.js
        │                   index.js
        │                   
        ├───services
        │       admin-service.js
        │       export-idocéo.js
        │       export-service.js
        │       import-service.js
        │       index.js
        │       photo-service.js
        │       toast-service.js
        │       
        ├───ui
        │   │   action-ui.js
        │   │   dashboard-ui.js
        │   │   index.js
        │   │   login-ui.js
        │   │   
        │   ├───eleve
        │   │       eleve-actions.js
        │   │       eleve-app.js
        │   │       
        │   └───prof
        │           activities.js
        │           layout.js
        │           live.js
        │           
        └───utils
                format.js
                index.js
                validation.js
                
---

## 3. Structure Firebase (TRÈS IMPORTANT - RGPD)

### 3.1. Chemin hiérarchique de base
etablissements/0680013V/profs/{codeProf}/{classe}/{activite}/montees

text

- **CodeProf** : Récupéré depuis `localStorage.getItem('eps_arena_profCode')` (défaut : DEFAULT).
- **Classe** : Ex: "504", "305".
- **Activite** : Ex: "escalade", "co", "multi", "arcathlon", "relais", "grilles".

### 3.2. Config racine
etablissements/0680013V/profs/{codeProf}/{classe}/config
Contenu : {A: 3, B: 2, activite: "escalade"} (uniquement des nombres)

text

⚠️ **Exception escalade** : la config escalade est stockée à la **racine** `{classe}/config` (pas dans un sous-dossier `escalade/`). Voir `escalade-prof.js`.

### 3.3. Classes actives
etablissements/0680013V/profs/{codeProf}/active_classes
Contenu : {504: true, 305: true}

text

### 3.4. Chemins spécifiques par activité

**Arcathlon** :
etablissements/.../{classe}/arcathlon/
config/
{ mode: "sprint", nbSeries: 3, nbFleches: 2, ... }
passages/
sprint/{pushId}
poursuite/{pushId}
relais/{pushId}
killbill/{pushId}
mille/{pushId}
commandes/
depart

text

**Relais** :
etablissements/.../{classe}/relais/
config # { sousActivite, mode, nbPlots, distances2zones, groupes }
vitesses # { "0_a": { arret, lance }, "0_b": {...} }
mesures-10s/{pushId} # Essais relais 10s
mesures-2zones/{pushId} # Essais relais 2 zones

text

**Grilles (évaluation)** :
etablissements/.../{classe}/grilles/
config # { actif, grilleId, periode }
auto_evaluations/{pushId} # { code, grilleId, periode, notes, timestamp }

text

**Badminton** : `{classe}/badminton/results/{matchId}`

**Natation** : `{classe}/natation/{config,temps,coups,historique,organisation}`

### 3.5. Règle RGPD stricte

**Uniquement des codes et des nombres transitent sur Firebase.**

Aucun nom, prénom ou ID pseudonymisé (ex: `BIANCHI_P`) ne doit y figurer !

---

## 4. Mapping Local (RGPD - Stockage local)

Les noms et les photos sont liés aux codes uniquement via le `localStorage` du navigateur du Professeur.

**Format du mapping** : Objet plat, ex: `{"504_A1": "BIANCHI_P", "504_A2": "DASILVALOUREIRO_T"}`.

**Fichier clé** : `src/js/core/live-engine.js` (fonctions `getEleveIdFromCode`, `getNomFromCode`, `getPhotoHtml`).

**Où est stocké le mapping ?** : `localStorage.getItem('eps_arena_local_mapping_{classe}')`.

**Important** : Le mapping est créé lors de la Transmission (`transmettreConfig`) et stocké UNIQUEMENT sur l'appareil du professeur.

### 4.1. Codes élèves stables (codeAutoEval)

Chaque élève possède un **`codeAutoEval`** unique et permanent (1, 2, 3...) stocké dans `eps_arena_eleves_{classe}` sous `.codeAutoEval`.

- **Jamais réutilisé**, même si l'élève change de groupe ou est absent
- **Attribué automatiquement** à l'import (ZIP ou CSV) selon l'ordre alphabétique
- **Utilisé pour** : auto-évaluations des grilles, tournoi élimination
- **Communiqué à l'élève** par le prof (liste imprimable dans Administration → 🔢 Codes élèves)

**Fonctions clés dans `admin-service.js`** :
- `migrerCodesAutoEval(classe)` : attribue les codes manquants
- `getCodeAutoEval(classe, eleveId)` : récupère le code d'un élève
- `getEleveFromCodeAutoEval(classe, code)` : récupère l'élève d'un code

⚠️ À ne PAS confondre avec les codes de groupe (`G1a`, `A1`) qui servent pour les activités collectives (relais, escalade, etc.).

---

## 5. Conventions de code

### 5.1. Structure des modules

- **Modulaire ES6** : Utilisation d'`import` et `export`.
- **Fonctions globales** : Les fonctions appelées par les boutons HTML (`onclick`) sont exposées sur `window` (ex: `window.transmettreConfig`, `window.generateTeams`).
- **Imports dynamiques** : Les modules Live et TV sont chargés dynamiquement via `import('...')` pour éviter de faire planter toute l'application si un module spécifique a une erreur. Le routage se fait via `renderLive(discipline)` ou `switchActivitySubTab()`.

### 5.2. Règles de masquage des vues

NE JAMAIS utiliser `el.style.display = 'none'` pour cacher les vues standard (cela écrase la classe `hidden` de Tailwind et rend la page blanche). Utiliser uniquement `classList.add('hidden')`.

### 5.3. Gestion des données

**Comparaison de données** : Toujours utiliser `String(...)` ou `parseInt(...)` lors de la comparaison de données Firebase (car les types peuvent différer : nombre vs chaîne).

### 5.4. Flux et transitions (RÈGLE D'OR pour les modules à phases)

- **NE JAMAIS** laisser l'utilisateur cliquer pour démarrer une phase qui doit être automatique. Chaque transition entre les phases d'une même série doit être automatique (sauf le début de la première course et la fin de chaque effort de course).
- **Démarrage automatique des courses** : après la première course (série 1), toutes les courses suivantes (séries 2, 3, …, finale) doivent démarrer automatiquement (avec un délai de 100-300ms pour laisser le temps à l'interface de se mettre à jour). Ne pas attendre un clic de l'utilisateur.
- **Fin des courses** : l'utilisateur doit cliquer sur « Arrivée » pour terminer chaque course (y compris la finale). C'est le seul clic autorisé pendant une course.
- **Transitions Course → Tir** : automatique. Pas de clic.
- **Transitions Tir → Pénalités** : automatique si des pénalités sont dues.
- **Transitions Pénalités → Course suivante** : automatique. Le dernier clic sur un tour de pénalité déclenche la série suivante (ou la finale).
- **Gestion des chronos** : le chrono de phase (gauche) affiche le temps de la phase en cours (course, tir ou pénalité). Le chrono total (droite) affiche le temps cumulé depuis le début de l'épreuve. Les chronos ne doivent jamais s'arrêter entre les phases d'une même série.

### 5.5. Gestion des tirs

- **Validation obligatoire** : l'utilisateur doit indiquer le résultat de chaque flèche (réussi ou raté) avant que le bouton « Fin de tir » ne devienne actif. Le bouton doit être désactivé tant que toutes les flèches ne sont pas cliquées.
- **Feedback visuel** : un message doit guider l'utilisateur (« Indiquez toutes les flèches » ou « Toutes les flèches sont indiquées »).
- **Mise à jour dynamique du bouton** : dans la fonction `window.toggleShot`, mettre à jour le texte et l'état `disabled` du bouton `#giantBtn`.

### 5.6. Gestion des pénalités

- **Règle simple** : une pénalité = 1 tour de pénalité par flèche manquée.
- **Déroulement** : la première pénalité démarre automatiquement après le tir. Chaque clic sur « Tour X » termine la boucle en cours et démarre automatiquement la suivante (si elle existe). Le dernier clic déclenche la série suivante (ou la finale).
- **Chronométrage** : chaque tour de pénalité est chronométré individuellement. Le temps est enregistré dans un tableau `tempsPenalites`.

### 5.7. Gestion des boutons

- **Présence constante** : le bouton principal doit être toujours présent en phase course (y compris pour les séries suivantes et la finale). Il doit afficher « Arrivée » lorsque la course est en cours.
- **Mise à jour dynamique** : le texte et l'état (`disabled`) du bouton doivent être mis à jour dynamiquement dans `window.toggleShot` et `renderPhase`, sans avoir besoin de re-rendre toute la page.
- **Utiliser `onclick`** : pour éviter les problèmes d'écouteurs non rattachés, utiliser `onclick="window.onGiantAction()"` directement dans le HTML plutôt que `addEventListener`.

### 5.8. Détection de fraude

- **Seuils** : une alerte est déclenchée si la vitesse calculée est > 25 km/h ou > 1.5 × VMA de référence. La vitesse doit être calculée uniquement sur le temps de course (les pénalités ne sont pas incluses dans le calcul de la vitesse).
- **Stockage** : le champ `alerteTriche` est enregistré dans Firebase avec le passage.

### 5.9. Enregistrement dans Firebase (Arcathlon)

```json
{
  "code": "EQ1_Rouge",
  "equipe": "EQ1",
  "maillot": "Rouge",
  "serie": 1,
  "isFinale": false,
  "mode": "sprint",
  "tempsCourse": 3952,
  "tempsTir": 1500,
  "tempsPenalites": [5256],
  "tempsTotalSerie": 10708,
  "tempsBonifie": -5.8,
  "vitesseGrandeBoucle": 50.8,
  "vitesseMoyennePenalites": 12.3,
  "ptsVMA": 3,
  "scoreTir": 15,
  "bonus": -15,
  "penalites": 1,
  "handicap": 0,
  "distanceTotale": 130,
  "reussitesTir": 1,
  "alerteTriche": false,
  "timestamp": 1788111384823
}
Bilan final : cumuler les distances, points VMA, points Tir, temps total sur toutes les séries.

5.10. Interdits JavaScript
❌ await dans un forEach → Utiliser for...of ou retirer le await

❌ Doublons de déclaration de fonctions → Vérifier avant de copier-coller

❌ style.display = 'none' sur vues Tailwind → Utiliser classList.add('hidden')

6. Modules existants et fonctionnalités clés
Escalade
escalade-interface.js : Grille A, B, C... (nombre de groupes dynamique basé sur les élèves ÷ 3, ou sur la sauvegarde JSON).

escalade-live.js : Rendu du Live + clic sur élève pour ouvrir le bilan (nombre de montées, distance, difficulté moyenne en cotation, etc.).

escalade-tv-ui.js : Rendu de la Montagne pour l'onglet TV (ordre alphabétique horizontal, hauteur verticale proportionnelle aux points).

Badminton (Module "Impacts")
badminton-kiosk.js (Élève) : Terrain 3D, sélection de matchs, Round Robin, saisie des impacts (stats % bonus).

badminton-live.js (Prof) : Grille de cartes par terrain, photos, classement (Victoire = 3pts / Défaite = 1pt), fiche élève modifiable (Stats).

badminton-tv.js (TV) : Affichage plein écran avec photos et podium.

Arcathlon
arcathlon-interface.js : Génération des équipes (3 par équipe, quartiles de VMA), paramètres (mode, nb séries, nb flèches, longueurs), transmission Firebase.

arcathlon-kiosk.js : Interface élève avec flux : Course → Tir → Pénalités → (série suivante) → ... → Course finale. Gestion des chronos, tirs, pénalités, détection de fraude.

arcathlon-live.js : Rendu des résultats, classements, graphiques, export CSV (à venir).

arcathlon-tv.js : Affichage plein écran (à venir).

arcathlon-utils.js : Fonctions de calcul (points VMA, bonus de tir, temps bonifié, etc.).

Relais (2 sous-activités)
relais-interface.js (Prof) : Génération des groupes (drag & drop), import CSV iDoeceo pour les vitesses, sélecteur de sous-activité (relais10s ou relais2zones), transmission Firebase.

relais-kiosk.js (Élève) : Menu 3 boutons (saisir vitesses / courir un relais / voir classement). Le "courir" s'adapte à la sous-activité :

relais10s : saisie de la zone atteinte → score = 5 + (V_reelle − V_theorique)

relais2zones : chrono 4 clics → %transmission converti en points (grille par paliers)

relais-live.js (Prof) : Classement équipes + efficacité individuelle (option B : relayé/relayeur) + compositions efficaces + modale détail (suppression essais).

relais-tv.js : Barres de progression par équipe.

connecteurs/relais.js : Calcul auto des niveaux pour les grilles d'évaluation.

Grilles d'évaluation
Nouveau module transverse (5ᵉ onglet prof) pour gérer les grilles critériées de type bac EPS.

grilles-core.js : Modèle de données + calcul note finale (sur 100 et sur 20) + stockage localStorage.

grilles-import.js : Import XLSX (SheetJS) — détecte activité et niveau depuis le nom du fichier.

grilles-export.js : Export iDoeceo (notes détaillées + rubrique).

grilles-interface.js (Prof) : Bibliothèque + passation + vue compacte + remplissage auto + consultation des auto-évaluations.

grilles-kiosk.js (Élève) : Auto-évaluation anonyme par code numérique.

connecteurs/ : Relais, Arcathlon, Escalade — pré-remplissent les critères "auto".

7. Fichiers critiques à NE PAS casser
src/js/core/live-engine.js : Cœur de l'écoute et du mapping.

src/js/core/firebase-service.js : Chemins hiérarchiques et fonctions de base.

src/js/ui/prof/activities.js : Gestion des activités, transmission, purge, logique des sous-onglets (switchActivitySubTab).

src/js/ui/prof/layout.js : Navigation entre les onglets (Admin, Activités, Outils, Évaluations) - Attention aux bugs d'affichage style.display.

src/js/modules/escalade/escalade-interface.js : Grille Escalade (attention aux instances Sortable : el.__sortable doit contenir l'instance réelle, pas un booléen).

src/js/modules/arcathlon/arcathlon-kiosk.js : Interface élève Arcathlon (flux complexe, ne pas modifier sans comprendre les transitions automatiques).

src/js/modules/relais/relais-kiosk.js : Flux élève complexe avec 2 sous-activités (aiguillage par config.sousActivite).

src/js/modules/grilles/grilles-interface.js : Beaucoup de fonctions globales window.grilles* — attention aux doublons de déclaration.

src/js/modules/grilles/connecteurs/*.js : Chaque connecteur lit un chemin Firebase différent (voir 3.4).

8. Arcathlon – Leçons apprises et bonnes pratiques
8.1. Défis rencontrés
Problème	Cause	Solution
Flux bloqué	Le bouton « Arrivée » était masqué en phase finale car showBtn = false	Le bouton doit toujours être présent, même en phase finale. Il est désactivé au début, puis activé par startCourse().
Chronos erronés	Le chrono de phase était réinitialisé à chaque changement de phase	Le chrono doit être continu. Utiliser state.tempsTotalSerie pour accumuler le temps de la série, et state.tempsPhase pour afficher le temps de la phase en cours.
Bouton « Fin de tir » inactif	L'écouteur d'événements était attaché via addEventListener, mais le bouton était recréé	Utiliser onclick directement dans le HTML ou rattacher l'écouteur après chaque renderPhase().
Tirs validés sans toutes les flèches	Aucune vérification du nombre de flèches indiquées	Ajouter une vérification state.shots.every(s => s !== 0) avant d'activer « Fin de tir ».
Démarrage automatique manqué	startCourse() appelé mais le bouton n'était pas mis à jour	startCourse() doit modifier le texte du bouton (ex: passer de « Démarrer » à « Arrivée »).
Course finale sans bouton	La finale était considérée comme une phase spéciale sans bouton	La finale est une course comme les autres. Le bouton doit être présent et afficher « Arrivée » pendant la course.
Vitesse calculée sur les pénalités	La distance totale incluant les pénalités était utilisée pour la vitesse	La vitesse doit être calculée uniquement sur le temps de course et la distance de course. Les pénalités sont un malus distinct.
8.2. Checklist de développement pour un nouveau module à phases
□ Définir les transitions : chaque changement de phase doit être clairement documenté (automatique ou manuel).

□ Gérer les boutons : toujours présent, texte dynamique, état disabled approprié.

□ Tester les cas limites : 0 pénalité, 1 pénalité, 2 pénalités, dernière série, course finale.

□ Vérifier les cumuls : le temps total de l'épreuve est la somme des temps de toutes les séries + finale.

□ Valider les entrées : ne pas autoriser la validation d'un tir si toutes les flèches ne sont pas indiquées.

□ Ajouter des logs : en phase de développement, des console.log aux points clés (début/fin de phase, transition) facilitent le débogage.

□ Vérifier l'interface : le bouton doit être visible et cliquable sur iPad (taille, contraste).

□ Tester sur iPad : les interactions tactiles (clic, swipe) peuvent se comporter différemment du navigateur de bureau.

8.3. Points d'attention pour l'IA
Ne pas hésiter à poser des questions : si le flux n'est pas clair, demander une confirmation avant de coder.

Valider le flux avec l'utilisateur : avant d'écrire une ligne de code, décrire le flux attendu (étapes, clics, transitions) et le faire valider.

Privilégier la simplicité : dans le doute, utiliser des approches plus simples (ex: onclick direct plutôt que addEventListener).

Documenter les cas particuliers : chaque cas (0 pénalité, 1 pénalité, 2 pénalités, finale) doit être testé et documenté.

Ne pas supposer : si une transition semble évidente, vérifier que l'utilisateur la souhaite bien ainsi.

9. Grilles d'évaluation — Conventions et bonnes pratiques
9.1. Modèle de données d'une grille
json
{
  "id": "relais_c4",
  "activite": "relais",
  "niveau": "C4",
  "titre": "Relais-vitesse C4 sur 10 secondes",
  "dateCreation": 1234567890,
  "dateImport": 1234567890,
  "figee": false,
  "periodes": ["Début", "Milieu", "Fin"],
  "criteres": [
    {
      "id": "performance_donneur",
      "nom": "Barême performance - Donneur",
      "refs": "D2/CG2/CT1/AFC1",
      "ponderation": 40,
      "type": "auto",
      "source": "relais_performance",
      "niveaux": [
        { "valeur": 4, "descripteur": "..." },
        { "valeur": 3, "descripteur": "..." },
        { "valeur": 2, "descripteur": "..." },
        { "valeur": 1, "descripteur": "..." }
      ]
    }
  ]
}
9.2. Règles fondamentales
Toujours 4 niveaux : 4 = TRÈS BONNE MAÎTRISE · 3 = MAÎTRISE SATISFAISANTE · 2 = MAÎTRISE FRAGILE · 1 = MAÎTRISE INSUFFISANTE

Couleurs associées :

4 → #22c55e (vert)

3 → #84cc16 (vert clair)

2 → #eab308 (jaune)

1 → #ef4444 (rouge)

Pondération : % explicite (ex: 40) ou 0 pour équipondéré (100/N)

Calcul note finale :

noteSur100 = (Σ(val × poids) / Σ(poids)) × 25

noteSur20 = noteSur100 / 5

Grille figée : verrouillée après la 1ère évaluation prof (empêche modification)

Auto-évaluations indicatives, non validées par défaut

RGPD : auto-évaluations anonymisées par codeAutoEval, notes prof en localStorage uniquement

9.3. Types de critères
type: "auto" : pré-remplissable par un connecteur

type: "prof" : saisie manuelle par le prof

type: "eleve" : utilisé côté kiosque élève (auto-évaluation)

9.4. Pattern matching critère → donnée auto
Dans grilles-interface.js, la fonction matcherCritere(critere, data) fait le lien entre le nom du critère et les clés de données fournies par le connecteur :

javascript
function matcherCritere(critere, data) {
    if (!data) return undefined;
    const nomLower = (critere.nom || '').toLowerCase();

    // Projet (Arcathlon)
    if (nomLower.includes('projet')) {
        return data['projet'] ?? data['coureur_projet'];
    }

    // Performance / Tir (Arcathlon)
    if (nomLower.includes('performance') && nomLower.includes('tir')) {
        return data['performance_tir'] ?? data['tir'];
    }

    // Performance Donneur (Relais)
    if (nomLower.includes('performance') && nomLower.includes('donneur')) {
        return data['performance_donneur'];
    }

    // Transmission (Relais)
    if (nomLower.includes('transmission') || nomLower.includes('qualité')) {
        return data['qualite_de_transmission'];
    }

    // Grimpeur (Escalade)
    if (nomLower.includes('grimpeur')) {
        return data['grimpeur'] ?? data['grimpeur_c3'] ?? data['grimpeur_voies'];
    }

    return undefined;
}
Règle : chaque connecteur expose des clés normalisées (ex: performance_donneur, qualite_de_transmission, projet, grimpeur) que le matcher utilise.

9.5. Connecteurs — Chemins Firebase
Activité	Chemin config	Source données
Relais	{classe}/relais/config	relais/mesures-10s + relais/mesures-2zones
Arcathlon	{classe}/arcathlon/config	arcathlon/passages/{mode}
Escalade	{classe}/config (racine !)	escalade/montees
⚠️ L'escalade est un cas particulier : sa config est à la racine, pas dans un sous-dossier.

9.6. Règles de calcul par connecteur
Relais :

performance_donneur : écart min |V_réelle − V_théorique| sur les essais 10s → paliers 0/0.5/1.2/2.2 km/h

qualite_de_transmission : meilleur % transmission → paliers 100/90/80/<80

Arcathlon :

projet : écart |V_1ère série − VMA| → paliers 0.5/1/2 km/h

performance_tir : total scoreTir cumulé → paliers 15/12/7/<7

Escalade :

grimpeur (C3) : 2 tops ≥ 5a → 4 · 2 tops (4a-4c) → 3 · hauteur 3-9m → 2 · <3m → 1

grimpeur_voies (C4) : 2ème meilleure cotation → paliers 5c/5a/4a/échec

9.7. Import XLSX — Règles
SheetJS chargé localement (libs/xlsx.full.min.js) — l'app doit pouvoir fonctionner hors ligne

Détection activité/niveau : depuis le nom du fichier en priorité, puis la feuille en fallback

Ordre des niveaux : toujours [4, 3, 2, 1] de gauche à droite (4 = meilleur)

Extraction des pondérations : dans le nom du critère (ex: "Coureur (son projet) 20%")

Attention aux "50", "40" dans les headers → ne pas confondre avec les valeurs de niveau

9.8. Critère "Élève" transversal
Le critère "Élève" apparaît dans quasiment toutes les grilles. Lorsqu'il est saisi pour une activité :

Le dernier niveau est stocké via setDernierNiveauEleve(classe, eleveId, niveau, activite)

À l'ouverture d'une nouvelle grille, un bandeau d'info propose de pré-remplir

L'élève peut modifier manuellement

9.9. Stockage localStorage
Clé	Contenu
eps_arena_grilles_bibliotheque	Liste de toutes les grilles
eps_arena_grilles_evaluations	Évaluations prof par classe/grille/période/élève
eps_arena_grilles_dernier_eleve	Dernier niveau "Élève" par classe/élève
9.10. Points d'attention pour l'IA (Grilles)
Ne pas supposer les clés : toujours logger Object.keys(data) avant de faire un matching

Auto-éval toujours anonyme : ne jamais écrire de nom dans Firebase

Grille figée = immuable : ne pas modifier les critères d'une grille figée

Pondération 0 ≠ bug : c'est un choix (équipondéré)

Toujours propager le niveau "Élève" : mettre à jour setDernierNiveauEleve après chaque saisie

10. Astuces de débogage
Connexion grise/rouge : Vérifier la console (F12) pour l'erreur SyntaxError ou ReferenceError. Le problème vient souvent d'un import manquant ou d'un chemin Firebase incorrect.

Photos manquantes dans le Live : Vérifier que le localMapping est bien au format plat ({"504_A1": "ID"}) et que getEleveIdFromCode cherche la bonne clé.

Glisser-déposer cassé : Vérifier que initEscaladeInterface détruit bien les anciennes instances el.__sortable (avec .destroy()) avant de recréer les colonnes.

Page blanche sur l'onglet Activités : Vérifier qu'aucune erreur dans app.js (imports cassés) et surtout que layout.js n'utilise PAS style.display = 'none' sur les vues principales.

Fiche élève vide ("Aucun match joué") : C'est un bug de type de données ! Utiliser String(m.terrain) === String(terrain) au lieu de m.terrain === terrain, car Firebase peut stocker le terrain comme un nombre (1) alors que le JavaScript le lit comme une chaîne ("1") dans les boucles.

Bug d'initialisation : Ajouter window.switchDiscipline('multi'); à la toute fin de initActivities() pour que l'onglet soit correctement affiché au chargement.

Logs pour déboguer Arcathlon : Activer les console.log dans arcathlon-kiosk.js pour suivre le flux : onGiantAction, startCourse, finishCourse, finishTir, terminerSerie, savePassage.

Erreur "matcherCritere has already been declared" : Doublon de déclaration → vérifier grilles-interface.js. Le fichier doit être écrase en entier, pas patché partiellement.

"Config X non transmise" dans les connecteurs : Vérifier le chemin Firebase (escalade à la racine, relais/arcathlon en sous-dossier).

Vue Activités qui s'affiche partout : Vérifier qu'il n'y a pas de </div> en trop dans maitre.html qui ferme prématurément viewActivities.

Kiosque élève qui affiche "En attente de l'activité" : L'activité n'est pas dans la liste des config.activite reconnues dans eleve-app.js (voir initApp → onValue config).

Bouton 🤖 Tout remplir auto grisé : Normal si l'activité n'a pas de connecteur (voir ACTIVITES_AVEC_CONNECTEUR dans grilles-interface.js).

await dans forEach : Interdit en JS → utiliser for...of ou retirer le await.

Erreur TS 1308 : "Les expressions 'await' sont autorisées uniquement dans les fonctions asynchrones" → marquer la fonction parente async ou retirer await.

Firebase écrit trop de noms : Vérifier qu'aucune donnée nominative n'est envoyée (règle RGPD absolue).

11. Glossaire
Glossaire Arcathlon
Série : Un bloc composé de Course → Tir → Pénalités (éventuelles).

Grande boucle : La course de la série (distance = distanceTotale).

Petite boucle : Un tour de pénalité (distance = longueurPenalite).

Course finale : Dernière course sans tir ni pénalité, déclenchée automatiquement après la dernière série.

Temps de phase : Temps écoulé dans la phase en cours (course, tir, pénalité).

Temps total épreuve : Temps cumulé depuis le début de la première série.

Vitesse : Calculée uniquement sur la grande boucle (distanceCourse / tempsCourse).

Handicap : Délai de départ (en ms) appliqué au début de la première course (utilisé en mode « poursuite »).

Glossaire Relais
Sous-activité : relais10s ou relais2zones — le prof choisit avant transmission.

V_théorique : (V_arrêté relayé + V_lancé relayeur) / 2

Score 10s : 5 + (V_réelle − V_théorique) — de 1 à 9+

% transmission : (V_transmission / V_moyenne_3zones) × 100

Paliers transmission : 100% → 5pts · 90% → 4pts · 80% → 3pts · 70% → 2pts · 60% → 1pt · <60% → 0

Meilleur essai : par paire, on garde le meilleur score

Paire : Deux élèves qui courent ensemble (ex: a-b), 6 combinaisons possibles pour 3 élèves

Efficacité individuelle (option B) : moyenne des scores en tant que relayé + moyenne en tant que relayeur

Composition efficace : le classement des 6 paires par meilleur score

Glossaire Grilles
Grille critériée : Tableau critères × niveaux avec pondération

Niveau : 4/3/2/1 (Très bonne maîtrise → Insuffisante)

Critère auto : Pré-remplissable par un connecteur

Critère prof : Saisie manuelle par le prof

Période : Début / Milieu / Fin (paramétrable par grille)

Grille figée : Verrouillée après la 1ère évaluation prof

Auto-évaluation : Réponse anonyme de l'élève via codeAutoEval

Détection d'écart : Comparaison auto-éval élève vs éval prof

Connecteur : Module qui lit les données d'une activité et calcule les niveaux auto

Pattern matching : Association nom de critère ↔ clé de donnée dans matcherCritere

Vue compacte : Affichage type iDoceo (chiffre + couleur, sans descripteurs)

Vue détaillée : Affichage complet avec boutons 4/3/2/1 par élève

Remplir auto global : Bouton 🤖 qui remplit tous les critères auto de tous les élèves d'un coup

Dernière mise à jour : ajout des modules Relais et Grilles d'évaluation, codeAutoEval, connecteurs, conventions grilles, nouveaux glossaires.

text

---

## ✅ Ce qui a changé

| # | Modification |
|---|---|
| 1 | Architecture des dossiers : ajout `libs/`, `grilles/`, `relais/` |
| 2 | Firebase : chemins Relais + Grilles + note Escalade à la racine |
| 3 | Section 4.1 : `codeAutoEval` (stabilité, attribution, usage) |
| 4 | Section 5.10 : Interdits JS (await/forEach, doublons, style.display) |
| 5 | Section 6 : modules Relais + Grilles complets |
| 6 | Section 7 : 3 nouveaux fichiers critiques |
| 7 | **Section 9 (NOUVELLE)** : Grilles — Conventions complètes (modèle, règles, matching, connecteurs, stockage, bonnes pratiques IA) |
| 8 | Section 10 : 8 nouvelles astuces de débogage |
| 9 | Section 11 : Glossaires Relais + Grilles |
