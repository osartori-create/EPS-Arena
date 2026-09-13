# GUIDE_IA.md — EPS-Arena

---

## 1. Description du projet

Application web EPS (Éducation Physique et Sportive) pour gérer des activités sportives en classe via des iPads. Deux interfaces principales : le Professeur (`maitre.html`) et l'Élève (`eleve.html`). L'application est **100% RGPD** : aucun nom ou photo d'élève ne doit être présent dans Firebase.

---

## 2. Architecture des dossiers (Exhaustive)
C:.
│ eleve.html
│ GUIDE_IA.md
│ hub-icon.svg
│ icon.svg
│ maitre.html
│ manifest.json
│
├───libs
│ xlsx.full.min.js # SheetJS (local, pour l'import XLSX)
│
└───src
│ index.html
│
├───css
│ evaluation.css
│ style.css
│
└───js
│ app.js
│
├───config
│ constants.js
│ firebase-config.js
│ index.js
│ orientshow-default-codes.js
│
├───core
│ firebase-service.js
│ index.js
│ live-engine.js
│ state.js
│
├───modules
│ │ index.js
│ │ registry.js
│ │
│ ├───arcathlon
│ │ arcathlon-interface.js
│ │ arcathlon-kiosk.js
│ │ index.js
│ │
│ ├───badminton
│ │ badminton-charts.js
│ │ badminton-common.js
│ │ badminton-core.js
│ │ badminton-dispatcher.js
│ │ badminton-events.js
│ │ badminton-firebase.js
│ │ badminton-interface.js
│ │ badminton-kiosk.js
│ │ badminton-live.js
│ │ badminton-maniere.js
│ │ badminton-registry.js
│ │ badminton-stats.js
│ │ badminton-terrain.js
│ │ badminton-tv.js
│ │ badminton-ui-prof.js
│ │ badminton-ui.js
│ │ badminton-utils.js
│ │ index.js
│ │
│ ├───co
│ │ │ circuit-manager.js
│ │ │ co-detail.js
│ │ │ co-interface.js
│ │ │ co-kiosk.js
│ │ │ co-live.js
│ │ │ co-prof.js
│ │ │ matrice.js
│ │ │
│ │ ├───classique
│ │ │ classique-prof.js
│ │ │
│ │ └───orientshow
│ │ orientshow-interface.js
│ │ orientshow-prof.js
│ │
│ ├───commun
│ │ calculateur.js
│ │ convertisseur.js
│ │ penalite.js
│ │ timer.js
│ │ tir.js
│ │
│ ├───demi-fond
│ │ │ index.js # Registre + dispatch
│ │ │ demifond-common.js # Helpers (couleurs, VMA, paths)
│ │ │ demifond-interface.js # UI Prof (dispatch sous-module)
│ │ │ demifond-kiosk.js # UI Élève (dispatch)
│ │ │ demifond-live.js # Live prof (dispatch)
│ │ │ demifond-tv.js # TV (dispatch)
│ │ │
│ │ └───variantes
│ │ └───trois-cinq-min # Sous-module 3×5min R=3'
│ │ index.js
│ │ trois-cinq-min-core.js
│ │ trois-cinq-min-interface.js
│ │ trois-cinq-min-kiosk.js
│ │ trois-cinq-min-bilan.js
│ │ trois-cinq-min-live.js
│ │ trois-cinq-min-tv.js
│ │
│ ├───eleve
│ │ escalade-kiosk.js
│ │ orientshow-kiosk.js
│ │
│ ├───escalade
│ │ escalade-blocs-core.js
│ │ escalade-blocs-firebase.js
│ │ escalade-calculations.js
│ │ escalade-controller.js
│ │ escalade-interface.js
│ │ escalade-kiosk-blocs.js
│ │ escalade-live.js
│ │ escalade-prof-blocs.js
│ │ escalade-prof.js
│ │ escalade-tv-ui.js
│ │
│ ├───evaluation
│ │ evaluation-fiche.js
│ │ evaluation-graphiques.js
│ │ evaluation-interface.js
│ │ evaluation-resultats.js
│ │ evaluation-saisie.js
│ │ evaluation-saut.js
│ │ evaluation-sprint.js
│ │ evaluation-stockage.js
│ │ evaluation-sync.js
│ │ evaluation-templates.js
│ │ evaluation-utils.js
│ │ evaluation-vma.js
│ │ index.js
│ │
│ ├───grilles
│ │ │ grilles-core.js # Modèle + calculs
│ │ │ grilles-export.js # Export iDoeceo XLS
│ │ │ grilles-import.js # Import XLSX
│ │ │ grilles-interface.js # UI Prof
│ │ │ grilles-kiosk.js # UI Élève (auto-éval)
│ │ │ index.js
│ │ │
│ │ └───connecteurs
│ │ arcathlon.js
│ │ demi-fond.js
│ │ escalade.js
│ │ relais.js
│ │
│ ├───multi
│ │ multi-controller.js
│ │ multi-live.js
│ │ multi-prof.js
│ │
│ ├───natation
│ │ index.js
│ │ natation-interface.js
│ │ natation-kiosk.js
│ │ natation-live.js
│ │ natation-organisation.js
│ │ natation-relais.js
│ │ natation-tv.js
│ │
│ ├───orientshow
│ │ orientshow-interface.js
│ │ orientshow-live.js
│ │ orientshow-tv.js
│ │
│ ├───poursuite
│ │ poursuite-controller.js
│ │
│ ├───relais
│ │ │ index.js
│ │ │ relais-core.js # Modèle + calculs 10s/2zones
│ │ │ relais-interface.js # UI Prof
│ │ │ relais-kiosk.js # UI Élève
│ │ │ relais-live.js # Live prof
│ │ │ relais-tv.js # TV
│ │ │
│ │ └───variantes
│ │ └───relais-2zones
│ │
│ ├───sprint
│ ├───teams
│ │ team-generator.js
│ │
│ └───tournoi
│ │ tournoi-core.js
│ │ tournoi-dispatcher.js
│ │ tournoi-registry.js
│ │
│ └───variantes
│ └───elimination
│ elimination-core.js
│ elimination-kiosk.js
│ elimination-live.js
│ elimination-prof.js
│ elimination-tv.js
│ index.js
│
├───services
│ admin-service.js
│ export-idocéo.js
│ export-service.js
│ import-service.js
│ index.js
│ photo-service.js
│ toast-service.js
│
├───ui
│ │ action-ui.js
│ │ dashboard-ui.js
│ │ index.js
│ │ login-ui.js
│ │
│ ├───eleve
│ │ eleve-actions.js
│ │ eleve-app.js
│ │
│ └───prof
│ activities.js
│ layout.js
│ live.js
│
└───utils
format.js
index.js
validation.js

text

---

## 3. Structure Firebase (TRÈS IMPORTANT - RGPD)

### 3.1. Chemin hiérarchique de base
etablissements/0680013V/profs/{codeProf}/{classe}/{activite}/montees

text

- **CodeProf** : Récupéré depuis `localStorage.getItem('eps_arena_profCode')` (défaut : DEFAULT).
- **Classe** : Ex: "504", "305".
- **Activite** : Ex: "escalade", "co", "multi", "arcathlon", "relais", "demi-fond", "grilles".

### 3.2. Config racine
etablissements/0680013V/profs/{codeProf}/{classe}/config
Contenu : {A: 3, B: 2, activite: "escalade"} (uniquement des nombres)

text

⚠️ **Exception escalade** : la config escalade est stockée à la **racine** `{classe}/config` (pas dans un sous-dossier `escalade/`).

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
commandes/
depart

text

**Relais** :
etablissements/.../{classe}/relais/
config # { sousActivite, mode, nbPlots, distances2zones, groupes }
vitesses # { "0_a": { arret, lance }, "0_b": {...} }
mesures-10s/{pushId}
mesures-2zones/{pushId}

text

**Grilles (évaluation)** :
etablissements/.../{classe}/grilles/
config # { actif, grilleId, periode }
auto_evaluations/{pushId} # { code, grilleId, periode, notes, timestamp }

text

**Demi-fond (1/2 Fond)** :
etablissements/.../{classe}/demi-fond/ # ⚠️ TIRET, pas underscore
config/
{
sousModule: "3x5min",
duree: 300, pause: 180, nbCourses: 3,
tour: 200, plots: 8,
antiDoubleClic: 30000,
cibleVMA: 0.90,
vmaParCode: { "1": 11, "2": 10.3, ... }, # VMA indexée par codeAutoEval
groupes: {
BLEU: [1, 5, 12, ...], # codeAutoEval
ROUGE: [...], VERT: [...], JAUNE: [...]
}
}
commandes/
sequence/ # { etat, timestampDebut, action, actionTimestamp, pauseDebut }
observations/
course-1/{code} # { timestamps: [...], partiel: 6, abandon: null|"blessure"|"mental", duree, tour, plots }
course-2/{code}
course-3/{code}

text

⚠️ **IMPORTANT** : le nom du dossier Firebase est `demi-fond` (avec **tiret**), alors que l'identifiant d'activité utilisé dans le code (registre, grilles) est `demi_fond` (avec **underscore**). Un mapping est nécessaire dans `grilles-interface.js`.

### 3.5. Règle RGPD stricte

**Uniquement des codes et des nombres transitent sur Firebase.**

Aucun nom, prénom ou ID pseudonymisé (ex: `BASTID_A`) ne doit y figurer. Les clés des observations sont les `codeAutoEval` (1, 2, 3...).

---

## 4. Mapping Local (RGPD - Stockage local)

Les noms et les photos sont liés aux codes uniquement via le `localStorage` du navigateur du Professeur.

**Format du mapping** : Objet plat, ex: `{"504_A1": "BASTID_A", "504_A2": "DUPONT_P"}`.

**Fichier clé** : `src/js/core/live-engine.js` (fonctions `getEleveIdFromCode`, `getNomFromCode`, `getPhotoHtml`).

**Où est stocké le mapping ?** : `localStorage.getItem('eps_arena_local_mapping_{classe}')`.

### 4.1. Codes élèves stables (codeAutoEval)

Chaque élève possède un **`codeAutoEval`** unique et permanent (1, 2, 3...) stocké dans `eps_arena_eleves_{classe}` sous `.codeAutoEval`.

- **Jamais réutilisé**, même si l'élève change de groupe ou est absent
- **Attribué automatiquement** à l'import (ZIP ou CSV) selon l'ordre alphabétique
- **Utilisé pour** : auto-évaluations des grilles, tournoi élimination, module 1/2 Fond
- **Communiqué à l'élève** par le prof (liste imprimable dans Administration → 🔢 Codes élèves)

**Fonctions clés dans `admin-service.js`** :
- `migrerCodesAutoEval(classe)` : attribue les codes manquants
- `getCodeAutoEval(classe, eleveId)` : récupère le code d'un élève
- `getEleveFromCodeAutoEval(classe, code)` : récupère l'élève d'un code

⚠️ À ne PAS confondre avec les codes de groupe (`G1a`, `A1`, `BLEU_1`) qui servent pour les activités collectives.

### 4.2. Mapping spécifique demi-fond

Pour le 1/2 Fond, un mapping supplémentaire est créé : `{classe}_BLEU_1 → eleveId`. Il est fusionné dans le mapping principal sous des clés du type `504_BLEU_1`.

Fonctions : `getLocalMapping(classe)` dans `live-engine.js`.

---

## 5. Conventions de code

### 5.1. Structure des modules

- **Modulaire ES6** : Utilisation d'`import` et `export`.
- **Fonctions globales** : Les fonctions appelées par les boutons HTML (`onclick`) sont exposées sur `window`.
- **Imports dynamiques** : Les modules Live et TV sont chargés dynamiquement via `import('...')` pour éviter de faire planter l'app en cas d'erreur.

### 5.2. Règles de masquage des vues

NE JAMAIS utiliser `el.style.display = 'none'` pour cacher les vues standard (cela écrase la classe `hidden` de Tailwind). Utiliser uniquement `classList.add('hidden')`.

### 5.3. Gestion des données

**Comparaison de données** : Toujours utiliser `String(...)` ou `parseInt(...)` lors de la comparaison de données Firebase (types peuvent différer).

### 5.4. Flux et transitions (RÈGLE D'OR pour les modules à phases)

- **Transitions automatiques** : Ne jamais laisser l'utilisateur cliquer pour démarrer une phase qui doit être automatique.
- **Démarrage auto des courses** : après la première course, toutes les suivantes doivent démarrer automatiquement (délai 100-300ms).
- **Fin des courses** : l'utilisateur doit cliquer sur « Arrivée » pour terminer chaque course.

### 5.5. Gestion des boutons

- **Présence constante** : le bouton principal doit être toujours présent.
- **Mise à jour dynamique** du texte et de l'état `disabled`.
- **Utiliser `onclick`** directement dans le HTML (pas `addEventListener`).

### 5.6. Interdits JavaScript

- ❌ **`await` dans un `forEach`** → Utiliser `for...of` ou retirer le `await`
- ❌ **Doublons de déclaration de fonctions** → Vérifier avant copier-coller
- ❌ **`style.display = 'none'` sur vues Tailwind** → Utiliser `classList.add('hidden')`
- ❌ **Variables non déclarées dans une fonction** → Vérifier tous les paramètres (ex: `code` dans `analyser()`)
- ⚠️ **Tiret (`-`) vs underscore (`_`)** : respecter strictement les noms de dossiers Firebase

---

## 6. Modules existants

### Escalade

- `escalade-interface.js` : Grille A, B, C...
- `escalade-live.js` : Live + bilan élève
- `escalade-tv-ui.js` : Montagne pour TV
- Connecteur grilles : `connecteurs/escalade.js`

### Badminton

- `badminton-kiosk.js` : Terrain 3D, impacts
- `badminton-live.js` : Grille par terrain
- `badminton-tv.js` : Podium

### Arcathlon

- `arcathlon-interface.js` : Équipes (3 par équipe)
- `arcathlon-kiosk.js` : Course → Tir → Pénalités → Finale
- Connecteur grilles : `connecteurs/arcathlon.js`

### Relais

- `relais-interface.js` : Groupes + Import CSV
- `relais-kiosk.js` : Menu 3 boutons (vitesses / courir / classement)
- 2 sous-activités : `relais10s` (zone) et `relais2zones` (chrono 4 clics)
- Connecteur grilles : `connecteurs/relais.js`

### Grilles d'évaluation

- `grilles-core.js` : Modèle + calcul note /100 et /20
- `grilles-import.js` : Import XLSX (SheetJS local)
- `grilles-export.js` : Export iDoeceo (notes + rubrique)
- `grilles-interface.js` : Bibliothèque + passation + auto-évals
- `grilles-kiosk.js` : Auto-évaluation anonyme par codeAutoEval
- **Connecteurs** : Relais, Arcathlon, Escalade, Demi-fond

### 1/2 Fond (nouveau)

Module à sous-modules. Un seul sous-module actuellement : **3×5min R=3'**.

**Structure du dossier** :
demi-fond/
├── index.js # Registre + dispatch
├── demifond-common.js # Helpers (couleurs, VMA, paths)
├── demifond-interface.js # Dispatch vers sous-module
├── demifond-kiosk.js # Dispatch vers sous-module
├── demifond-live.js # Dispatch Live
├── demifond-tv.js # Dispatch TV
└── variantes/trois-cinq-min/
├── trois-cinq-min-core.js # Calculs (distance, vitesse, CV, allure, perf)
├── trois-cinq-min-interface.js # UI Prof (groupes, contrôles séquence)
├── trois-cinq-min-kiosk.js # UI Élève (observateur)
├── trois-cinq-min-bilan.js # Bilan élève (SVG + indicateurs)
├── trois-cinq-min-live.js # Live prof spécifique
└── trois-cinq-min-tv.js # TV spécifique

text

**Dispositif** : carré de 50m, plots tous les 25m (8 plots/tour), 1 tour = 200m.

**Flux de la séquence (1 GO = tout automatique)** :
t=0 🚀 GO (prof)
t=0-300 ▶️ Course 1 (5min) → clics observateur à chaque tour
t=300-480 ⏸️ Pause 1 (3min) → saisie plots partiels par élève
t=480-780 ▶️ Course 2 (5min)
t=780-960 ⏸️ Pause 2 (3min)
t=960-1260 ▶️ Course 3 (5min)
t=1260+ 📝 Saisie finale (plots partiels C3) puis 🏆 Bilan

text

**Contrôles prof** : GO / Pause / Reprendre / Skip / Stop

**Anti-double-clic** : 30s par défaut, paramétrable (compte à rebours visuel sur bouton)

**Abandons** : 2 raisons possibles (blessure / mental), enregistrées par course

**VMA** : récupérée depuis `eleves.vma` ou fallback sur palier Luc Léger, transmise dans `vmaParCode` de la config Firebase

**Connecteur grilles** : `connecteurs/demi-fond.js` → remplit Allure + Performance + Régularité

---

## 7. Fichiers critiques à NE PAS casser

- `src/js/core/live-engine.js` : Cœur de l'écoute et du mapping
- `src/js/core/firebase-service.js` : Chemins hiérarchiques
- `src/js/ui/prof/activities.js` : Switch disciplines + switchActivitySubTab + transmettreConfig
- `src/js/ui/prof/layout.js` : Navigation entre onglets
- `src/js/modules/escalade/escalade-interface.js` : Grille (Sortable)
- `src/js/modules/arcathlon/arcathlon-kiosk.js` : Flux complexe
- `src/js/modules/relais/relais-kiosk.js` : Aiguillage sous-activités
- `src/js/modules/demi-fond/variantes/trois-cinq-min/trois-cinq-min-kiosk.js` : Flux observateur + séquence auto
- `src/js/modules/grilles/grilles-interface.js` : Nombreuses fonctions window.grilles* + ACTIVITES_AVEC_CONNECTEUR
- `src/js/modules/grilles/connecteurs/*.js` : Chaque connecteur lit un chemin Firebase spécifique

---

## 8. Arcathlon – Leçons apprises

| Problème | Cause | Solution |
|---|---|---|
| Flux bloqué | Bouton « Arrivée » masqué en finale | Toujours présent, activé par `startCourse()` |
| Chronos erronés | Chrono réinitialisé à chaque phase | Accumuler dans `state.tempsTotalSerie` |
| Bouton « Fin de tir » inactif | `addEventListener` sur bouton recréé | Utiliser `onclick` direct |
| Tirs validés incomplets | Pas de vérif. du nombre de flèches | `state.shots.every(s => s !== 0)` |
| Vitesse sur pénalités | Distance totale utilisée | Vitesse = course uniquement |

---

## 9. Grilles d'évaluation — Conventions et bonnes pratiques

### 9.1. Modèle de données

```json
{
  "id": "relais_c4",
  "activite": "relais",
  "niveau": "C4",
  "titre": "Relais-vitesse C4 sur 10 secondes",
  "figee": false,
  "periodes": ["Début", "Milieu", "Fin"],
  "criteres": [
    {
      "id": "performance_donneur",
      "nom": "Barême performance - Donneur",
      "ponderation": 40,
      "type": "auto",
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
Toujours 4 niveaux : 4/3/2/1

Couleurs : 4 → #22c55e (vert) · 3 → #84cc16 · 2 → #eab308 · 1 → #ef4444

Pondération : % explicite ou 0 pour équipondéré

Note finale :

noteSur100 = (Σ(val × poids) / Σ(poids)) × 25

noteSur20 = noteSur100 / 5

Grille figée = immuable

Auto-évaluations indicatives (non validées par défaut)

RGPD : auto-évaluations anonymisées par codeAutoEval

9.3. Types de critères
type: "auto" : pré-remplissable par un connecteur

type: "prof" : saisie manuelle

type: "eleve" : utilisé côté kiosque élève

9.4. Pattern matching critère → donnée auto
La fonction matcherCritere(critere, data) utilise le contenu des descripteurs en priorité (plus fiable que le nom) :

javascript
// Exemple pour demi-fond :
const tousDesc = (critere.niveaux || []).map(n => (n.descripteur || '').toLowerCase()).join(' ');
if (tousDesc.includes('croissante') || tousDesc.includes('constante')) return data['allure'];
if (tousDesc.includes('km/h') && tousDesc.includes('c3')) return data['performance'];
if (tousDesc.includes('coefficient de variation')) return data['regularite'];
9.5. Connecteurs — Chemins Firebase
Activité	Chemin config	Source données
Relais	{classe}/relais/config	relais/mesures-10s + relais/mesures-2zones
Arcathlon	{classe}/arcathlon/config	arcathlon/passages/{mode}
Escalade	{classe}/config (racine)	escalade/montees
Demi-fond	{classe}/demi-fond/config (tiret)	demi-fond/observations/course-{1,2,3}
⚠️ Mapping activité → chemin Firebase obligatoire dans grilles-interface.js :

javascript
const cheminFirebase = {
    'demi_fond': 'demi-fond',
    'demi-fond': 'demi-fond',
    'escalade': null  // à la racine
};
9.6. Seuils par connecteur
Relais : écart V_th vs V_réelle (performance_donneur) / % transmission (qualité)

Arcathlon : écart VMA 1ère série / total scoreTir

Escalade :

grimpeur (C3) : 2 tops ≥ 5a → 4 · 2 tops 4a-4c → 3 · hauteur 3-9m → 2 · <3m → 1

grimpeur_voies (C4) : 2ème meilleure cotation ≥ 5c / ≥ 5a / ≥ 4a / échec

Demi-fond :

Allure : V3 − V1 ≥ +0.5 → 4 · stable (|Δ|<0.5) → 3 · V3 − V1 ≤ −0.5 → 2 · abandon → 1

Performance (seuils par sexe sur la vitesse Course 3) :

Filles : ≥ 12 → 4 · ≥ 9.5 → 3 · ≥ 7.5 → 2 · < 7.5 → 1

Garçons : ≥ 13.5 → 4 · ≥ 11 → 3 · ≥ 9 → 2 · < 9 → 1

Régularité (CV moyen) : < 5% → 4 · 5-10% → 3 · 10-15% → 2 · > 15% → 1

9.7. Import XLSX — Règles
SheetJS local (libs/xlsx.full.min.js) — fonctionne hors ligne

Détection activité : chercher le mot-clé n'importe où dans le nom (ex: demi-fond, badminton, escalade)

Détection niveau : regex sans \b car è + _ n'est pas une frontière de mot : (C[1-5]|[3-6]e|[3-6]ème)

Ordre des niveaux : [4, 3, 2, 1] de gauche à droite

Pondération : extraite du nom du critère (ex: "20%")

9.8. Stockage localStorage
Clé	Contenu
eps_arena_grilles_bibliotheque	Liste des grilles
eps_arena_grilles_evaluations	Évaluations prof (classe/grille/période/élève)
eps_arena_grilles_dernier_eleve	Dernier niveau "Élève" par classe/élève
10. 1/2 Fond — Bonnes pratiques
10.1. Chemins et noms
Élément	Valeur
Identifiant activité (registre)	demi-fond
Identifiant sous-module	3x5min
Dossier Firebase	demi-fond (tiret)
Dossier code source	demi-fond (tiret)
Clé localStorage	eps_arena_demifond_${sousModule}_${classe}
10.2. Format du fichier config Firebase
json
{
  "sousModule": "3x5min",
  "duree": 300,
  "pause": 180,
  "nbCourses": 3,
  "tour": 200,
  "plots": 8,
  "antiDoubleClic": 30000,
  "cibleVMA": 0.9,
  "enchainementAuto": true,
  "vmaParCode": { "1": 11, "2": 10.3 },
  "groupes": {
    "BLEU": [1, 5, 12],
    "ROUGE": [2, 6, 13],
    "VERT": [3, 7, 14],
    "JAUNE": [4, 8, 15]
  }
}
10.3. États de la séquence
Le champ sequence.etat peut prendre les valeurs :

État	Description
idle	En attente de GO
actif	Séquence en cours (course ou pause, calculé par timestamp)
pause_manuelle	Pause déclenchée par le prof
termine	Séquence terminée (Stop manuel ou fin auto)
Le champ sequence.action permet de détecter les changements : go, pause, reprendre, skip, stop.

10.4. Calculs clés
Distance (course complète ou partielle) :

javascript
const distanceParPlot = tour / plots;  // 200 / 8 = 25m
const distance = nbTours * tour + partiel * distanceParPlot;
Vitesse moyenne :

javascript
vitesse = (distance / duree) * 3.6;  // km/h
Coefficient de variation (régularité) :

javascript
// Sur les temps de tour (en secondes)
const ecartType = Math.sqrt(variance);
const cv = (ecartType / moyenne) * 100;  // en %
Allure : comparaison V3 vs V1 avec seuil ±0.5 km/h.

10.5. Structure d'une observation Firebase
json
{
  "timestamps": [58234, 118432, 178125, 240003],
  "partiel": 6,
  "abandon": null,
  "duree": 300,
  "tour": 200,
  "plots": 8,
  "timestamp": 1789315752337
}
timestamps : temps écoulés (en ms depuis le départ) au moment de chaque clic observateur

partiel : nombre de plots supplémentaires (0-8) dans le dernier tour

abandon : null (course normale) | "blessure" | "mental"

10.6. Points d'attention
Timer prof : utilise sequence.timestampDebut (fixe depuis le GO initial). Ne JAMAIS recalculer pendant la séquence.

Course en cours : identifiée par courseNum = 1 + floor(elapsed / (duree + pause))

Anti-double-clic : par élève, avec lastClickAt[code]

Skip manuel : recalcule timestampDebut pour positionner au début de la course suivante

Reprendre : décale timestampDebut du temps écoulé depuis pauseDebut pour ne pas "consommer" la pause

VMA par élève : indexée par codeAutoEval dans vmaParCode pour éviter d'exposer les IDs sur Firebase

10.7. Détection d'abandon automatique
Si une course se termine sans aucun clic, elle est ignorée dans les calculs. Le Live ne l'affiche pas comme "abandon" formel (nécessite une action explicite du kiosque).

11. Astuces de débogage
Erreur 404 sur import : vérifier le nombre de ../ (un fichier dans variantes/trois-cinq-min/ a besoin de 4 niveaux)

Connexion grise/rouge : vérifier la console pour SyntaxError ou ReferenceError

Photos manquantes dans le Live : le localMapping doit être au format plat {"504_A1": "ID"}

Glisser-déposer cassé : détruire les anciennes instances el.__sortable (avec .destroy())

Page blanche : layout.js ne doit PAS utiliser style.display = 'none' sur les vues principales

</div> en trop dans maitre.html : les vues s'affichent partout → vérifier la structure HTML

Erreur matcherCritere has already been declared : doublon → écrase le fichier entier

"Config X non transmise" dans les connecteurs : vérifier le chemin Firebase (escalade racine, relais/arcathlon/demi-fond sous-dossier)

Kiosque élève "En attente de l'activité" : l'activité n'est pas dans la liste des config.activite reconnues dans eleve-app.js

Await dans forEach : interdit → utiliser for...of

Erreur TS 1308 : fonction parente manque async

ReferenceError: code is not defined : paramètre manquant dans une fonction (ex: analyser(cours, config, sexe, code))

Tiret vs underscore Firebase : demi_fond (code) ≠ demi-fond (Firebase). Mapping obligatoire dans grilles-interface.js

Codes 0 dans les observations : signe qu'un élève n'a pas de codeAutoEval → migrer via Administration → 🔢 Codes élèves

Activité détectée comme "arena" ou autre : le parser XLSX ne reconnaît pas le mot-clé → vérifier la liste activitesMap

Vue Live/TV qui s'affiche sous le paramétrage : switchActivitySubTab doit cacher viewActivities pour le demi-fond

Bouton 🤖 Auto grisé : normal si l'activité n'a pas de connecteur (ACTIVITES_AVEC_CONNECTEUR)

Firebase écrit trop de noms : vérifier qu'aucune donnée nominative n'est envoyée (RGPD absolu)

12. Glossaire
Arcathlon
Série : Course → Tir → Pénalités

Grande boucle : La course de la série

Petite boucle : Un tour de pénalité

Course finale : Dernière course sans tir

Handicap : Délai de départ (mode poursuite)

Relais
Sous-activité : relais10s ou relais2zones

V_théorique : (V_arrêté relayé + V_lancé relayeur) / 2

Score 10s : 5 + (V_réelle − V_théorique)

% transmission : (V_transmission / V_moyenne_3zones) × 100

Paliers transmission : 100% → 5pts · 90% → 4pts · 80% → 3pts · 70% → 2pts · 60% → 1pt

Efficacité individuelle (option B) : moyenne relayé + moyenne relayeur

Grilles
Grille critériée : Tableau critères × niveaux

Niveau : 4/3/2/1

Critère auto : Pré-remplissable

Grille figée : Verrouillée après 1ère éval

Auto-évaluation : Réponse anonyme via codeAutoEval

Connecteur : Module qui lit les données d'une activité et calcule les niveaux auto

Pattern matching : Association critère ↔ donnée dans matcherCritere

Vue compacte : Chiffre + couleur (type iDoceo)

Remplir auto global : Bouton 🤖 qui remplit tous les critères auto

1/2 Fond
Sous-module : Version paramétrable de l'épreuve (actuellement 3x5min)

Séquence : Enchaînement automatique des 3 courses + 2 pauses

Course partielle : Un tour partiellement terminé (mesuré en plots)

Partiel : Nombre de plots parcourus dans le dernier tour (0 à 8)

Allure : Profil de vitesse entre les 3 courses (croissante/constante/décroissante)

Régularité : CV des temps de tour intra-course

Performance : Vitesse moyenne de la Course 3 (comparée aux seuils par sexe)

Observateur : Élève (souvent inapte) qui clique sur les numéros à chaque tour

Anti-double-clic : Délai minimum entre 2 clics d'un même élève (30s par défaut)

Bilan : Rendu visuel post-séquence (graphique + 4 indicateurs)

Dernière mise à jour : ajout du module 1/2 Fond (sous-module 3×5min R=3'), du connecteur demi-fond, mapping tiret/underscore, nouvelles astuces de débogage, glossaire demi-fond.

text

---

## ✅ Récapitulatif de la mise à jour

| Section | Modification |
|---|---|
| **2. Architecture** | Ajout du dossier `demi-fond/` complet |
| **3.4 Firebase** | Chemins demi-fond (avec avertissement tiret/underscore) |
| **3.5 RGPD** | Note sur les clés `codeAutoEval` |
| **4.1 codeAutoEval** | Ajout "module 1/2 Fond" dans les utilisations |
| **4.2 Mapping demi-fond** | Clés `{classe}_BLEU_1` |
| **5.6 Interdits JS** | Tiret/underscore, variables non déclarées |
| **6. Modules** | Section 1/2 Fond complète |
| **7. Critiques** | Ajout demi-fond kiosk + grilles |
| **9.5 Connecteurs** | Ajout demi-fond + mapping cheminFirebase |
| **9.6 Seuils** | Ajout seuils demi-fond (allure, perf par sexe, régularité) |
| **9.7 Import XLSX** | Note sur regex sans `\b` |
| **10. 1/2 Fond** | **NOUVELLE SECTION** complète (chemins, format, états, calculs, points d'attention) |
| **11. Débogage** | 8 nouvelles astuces (code non défini, tiret/underscore, codes 0, etc.) |
| **12. Glossaire** | Ajout glossaire 1/2 Fond |

Le fichier fait maintenant **~850 lignes** et couvre **100% de l'état actuel** de l'application.