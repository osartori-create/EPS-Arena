# GUIDE_IA.md — EPS-Arena

---

## 1. Description du projet

Application web EPS (Éducation Physique et Sportive) pour gérer des activités sportives en classe via des iPads. Deux interfaces principales : le Professeur (`maitre.html`) et l'Élève (`eleve.html`). L'application est **100% RGPD** : aucun nom ou photo d'élève ne doit être présent dans Firebase.

**Architecture** : modules ES6, dispatch par activité, Firebase Realtime Database pour les échanges iPad ↔ PC, localStorage + IndexedDB pour les données nominatives.

---

## 2. Architecture des dossiers (exhaustive)
EPS-Arena/
│ eleve.html
│ GUIDE_IA.md
│ hub-icon.svg
│ icon.svg
│ maitre.html
│ manifest.json
│
├───libs/
│ xlsx.full.min.js # SheetJS (import/export XLSX)
│
└───src/
│ index.html
│
├───css/
│ evaluation.css
│ style.css
│
└───js/
│ app.js
│
├───config/
│ constants.js # BAREME_ESCALADE, PALIER_VMA
│ firebase-config.js # FIREBASE_CONFIG, DB_PATHS
│ index.js
│ orientshow-default-codes.js
│
├───core/
│ firebase-service.js # Chemins Firebase, listeners
│ index.js
│ live-engine.js # Mapping codes → élèves (RGPD)
│ state.js
│
├───modules/
│ │ index.js
│ │ registry.js # Registre des modules
│ │
│ ├───arcathlon/ # Course → Tir → Pénalités
│ ├───badminton/ # 2 modes : terrain + manière
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
│ │ badminton-export.js # Export Excel
│ │ index.js
│ │
│ ├───co/ # CO classique + OrientShow
│ │ circuit-manager.js
│ │ co-detail.js
│ │ co-interface.js
│ │ co-kiosk.js
│ │ co-live.js
│ │ co-prof.js
│ │ matrice.js
│ │ classique/
│ │ orientshow/
│ │
│ ├───commun/ # Timer, calculateur, tir
│ │
│ ├───demi-fond/ # 3×5min R=3'
│ │ demifond-common.js
│ │ demifond-interface.js
│ │ demifond-kiosk.js
│ │ demifond-live.js
│ │ demifond-tv.js
│ │ index.js
│ │ variantes/trois-cinq-min/
│ │
│ ├───eleve/ # Kiosques élèves transverses
│ │
│ ├───escalade/ # Grimpe + Bloc Contest
│ │
│ ├───evaluation/ # Évaluation des aptitudes
│ │
│ ├───grilles/ # Grilles critériées
│ │ connecteurs/ # Relais, Arcathlon, Escalade, Demi-fond
│ │
│ ├───multi/ # Multi-activités (équipes)
│ │
│ ├───natation/ # Indice de nage + Organisation
│ │ natation-interface.js
│ │ natation-kiosk.js
│ │ natation-live.js
│ │ natation-organisation.js
│ │ natation-relais.js
│ │ natation-tv.js
│ │
│ ├───orientshow/ # Sous-module CO (ré-exports)
│ │
│ ├───poursuite/
│ │
│ ├───relais/ # Relais 10s / 2 zones
│ │ relais-core.js
│ │ relais-interface.js
│ │ relais-kiosk.js
│ │ relais-live.js
│ │ relais-tv.js
│ │ relais-export.js
│ │
│ ├───teams/ # Générateur d'équipes
│ │
│ └───tournoi/ # Élimination
│ tournoi-core.js
│ tournoi-dispatcher.js
│ tournoi-registry.js
│ tournoi-export.js
│ variantes/elimination/
│
├───services/
│ admin-service.js # Gestion élèves + photos
│ export-service.js # ⭐ Service centralisé d'export
│ export-idocéo.js
│ import-service.js
│ photo-service.js
│ sync-service.js # ⭐ Sync entre appareils
│ toast-service.js
│ index.js
│
├───ui/
│ │ action-ui.js
│ │ dashboard-ui.js # Onglet Admin
│ │ index.js
│ │ login-ui.js
│ │
│ ├───eleve/
│ │ eleve-actions.js
│ │ eleve-app.js # Point d'entrée élève
│ │
│ └───prof/
│ activities.js # ⭐ Switch disciplines + imports
│ layout.js # Navigation onglets
│ live.js # Live + exports CO
│
└───utils/
format.js
index.js
validation.js

text

---

## 3. Structure Firebase (TRÈS IMPORTANT - RGPD)

### 3.1. Chemin hiérarchique de base
etablissements/0680013V/profs/{codeProf}/{classe}/{activite}/...

text

- **CodeProf** : `localStorage.getItem('eps_arena_profCode')` (défaut : `DEFAULT`)
- **Classe** : ex. "504", "305", "506"
- **Activite** : ex. `escalade`, `co`, `multi`, `arcathlon`, `relais`, `demi-fond`, `grilles`, `badminton`, `natation`, `tournoi`

### 3.2. Config racine
etablissements/0680013V/profs/{codeProf}/{classe}/config
Contenu : { activite: "badminton", ... }

text

⚠️ **Exception escalade** : la config escalade est stockée à la **racine** `{classe}/config` (pas dans `escalade/config`).

### 3.3. Classes actives
etablissements/0680013V/profs/{codeProf}/active_classes
Contenu : { 504: true, 305: true }

text

### 3.4. Chemins spécifiques par activité

**Arcathlon** :
{classe}/arcathlon/config/
{classe}/arcathlon/passages/sprint/{pushId}
{classe}/arcathlon/passages/poursuite/{pushId}
{classe}/arcathlon/commandes/depart

text

**Badminton** :
{classe}/config # { activite: 'badminton', mode: 'terrain'|'maniere', ... }
{classe}/badminton/results/{matchId}

text
Le champ `mode` est **soit `'terrain'`, soit `'maniere'`** — c'est le **mode de jeu**, pas le type de terrain. Le type de terrain (`frontback` / `leftright` / `4corners`) est dans `config.terrainType`.

**Relais** :
{classe}/relais/config # { sousActivite, mode, distances2zones, groupes }
{classe}/relais/vitesses # { "0_a": { arret, lance } }
{classe}/relais/mesures-10s/{pushId}
{classe}/relais/mesures-2zones/{pushId}

text

**Grilles (évaluation)** :
{classe}/grilles/config # { actif, grilleId, periode }
{classe}/grilles/auto_evaluations/{pushId}

text

**Demi-fond (⚠️ TIRET, pas underscore)** :
{classe}/demi-fond/config # ⚠️ tiret
{classe}/demi-fond/commandes/sequence
{classe}/demi-fond/observations/course-{1,2,3}/{code}

text

**Natation** :
{classe}/natation/config
{classe}/natation/temps/{numero}
{classe}/natation/coups/{numero}
{classe}/natation/historique/{numero}
{classe}/natation/organisation/reference/{numero}
{classe}/natation/organisation/equipes
{classe}/natation/organisation/courses/{timestamp}

text

**Tournoi** :
{classe}/tournoi/config
{classe}/tournoi/joueurs/{codeAutoEval}
{classe}/tournoi/historique/{pushId}
{classe}/tournoi/exclus/{codeAutoEval}

text

### 3.5. Règle RGPD stricte

**Uniquement des codes et des nombres transitent sur Firebase.**

Aucun nom, prénom, ID pseudonymisé (ex. `BASTID_A`) ne doit y figurer. Les clés des observations sont les `codeAutoEval` (1, 2, 3...) ou des codes de position (`0_a`, `1_b`).

---

## 4. Mapping Local (RGPD)

Les noms et photos sont liés aux codes uniquement via le **localStorage du navigateur du Professeur**.

**Format** : objet plat, ex. `{"504_A1": "BASTID_A", "504_BLEU_1": "id-eleve"}`.

**Fichier clé** : `src/js/core/live-engine.js` (`getEleveIdFromCode`, `getNomFromCode`, `getPhotoHtml`, `getLocalMapping`, `setLocalMapping`).

**Clé de stockage** : `eps_arena_local_mapping_{classe}`.

### 4.1. Codes élèves stables (codeAutoEval)

Chaque élève possède un **`codeAutoEval`** unique et permanent (1, 2, 3...) stocké dans `eps_arena_eleves_{classe}` sous `.codeAutoEval`.

- **Jamais réutilisé**, même si l'élève change de groupe ou est absent
- **Attribué automatiquement** à l'import (ZIP ou CSV) selon l'ordre alphabétique
- **Utilisé pour** : auto-évaluations des grilles, tournoi élimination, module 1/2 Fond
- **Communiqué à l'élève** par le prof (liste imprimable dans Administration → 🔢 Codes élèves)

**Fonctions clés** dans `admin-service.js` :
- `migrerCodesAutoEval(classe)` : attribue les codes manquants
- `getCodeAutoEval(classe, eleveId)` : récupère le code d'un élève
- `getEleveFromCodeAutoEval(classe, code)` : récupère l'élève d'un code

⚠️ **Ne pas confondre** avec les codes de groupe (`G1a`, `A1`, `BLEU_1`) qui servent pour les activités collectives.

---

## 5. Conventions de code

### 5.1. Structure des modules

- **Modulaire ES6** : `import` / `export`
- **Fonctions globales** : les fonctions appelées par les boutons HTML (`onclick`) sont exposées sur `window`
- **Imports dynamiques** : les modules Live et TV sont chargés via `import('...')` pour éviter de faire planter l'app en cas d'erreur

### 5.2. Règles de masquage des vues

**NE JAMAIS utiliser `el.style.display = 'none'`** pour cacher les vues standard (écrase la classe `hidden` de Tailwind). Utiliser `classList.add('hidden')`.

⚠️ Exception : `viewTV` utilise encore `style.display` car c'est une zone spéciale 100vh.

### 5.3. Gestion des données

**Comparaison de données Firebase** : toujours utiliser `String(...)` ou `parseInt(...)` (types peuvent différer).

### 5.4. Flux et transitions (RÈGLE D'OR)

- **Transitions automatiques** : ne jamais laisser l'utilisateur cliquer pour démarrer une phase automatique
- **Démarrage auto** : après la première course, toutes les suivantes démarrent automatiquement (délai 100-300ms)
- **Fin** : l'utilisateur clique sur « Arrivée » / « Terminer »

### 5.5. Boutons

- **Présence constante** : le bouton principal doit être toujours présent
- **Mise à jour dynamique** du texte et de l'état `disabled`
- **`onclick` direct** dans le HTML (pas `addEventListener` sur des éléments recréés)

### 5.6. Interdits JavaScript

- ❌ `await` dans un `forEach` → utiliser `for...of`
- ❌ Doublons de déclaration de fonctions → vérifier avant copier-coller
- ❌ `style.display = 'none'` sur vues Tailwind → `classList.add('hidden')`
- ❌ Variables non déclarées dans une fonction → vérifier tous les paramètres
- ⚠️ **Tiret vs underscore** : `demi_fond` (code) ≠ `demi-fond` (Firebase). Mapping obligatoire dans `grilles-interface.js`

---

## 6. Modules existants

### Badminton — 2 modes de jeu séparés

Badminton possède **deux jeux pédagogiquement distincts**, sélectionnables dans l'interface prof via un **sélecteur de mode**.

| Mode | Kiosque | Classement | Bonus manière | Type terrain |
|---|---|---|---|---|
| **Terrain** | Clic sur zones 3D | V/D (3/1/0 pts) | ❌ | ✅ (`frontback`/`leftright`/`4corners`) |
| **Avec la manière** | Cases à cocher | 5/3/2/1 pts | ✅ (≥ 8 pts zone dangereuse) | ❌ |

**Fichiers clés** :
- `badminton-registry.js` : registre `terrain` / `maniere`
- `badminton-dispatcher.js` : charge le bon module selon `config.mode`
- `badminton-terrain.js` : mode terrain (clic, chrono, V/D)
- `badminton-maniere.js` : mode manière (cases à cocher, bonus)
- `badminton-common.js` : rendu commun (terrains, round-robin, classement)
- `badminton-ui-prof.js` : sélecteur de mode prof + masquage conditionnel
- `badminton-live.js` : Live mode-aware (titre selon `config.mode`)

**Chrono en mode Terrain** : la durée (`config.dureeMatch`, en secondes) est paramétrable côté prof, visible côté élève, avec bip + pulsation dans les 10 dernières secondes. Le chrono n'arrête pas le match automatiquement — c'est le prof (ou l'élève) qui clique "Terminer".

**Sélecteur de mode prof** : 2 gros boutons dans `viewBadmintonSettings`, gérés par `badminton-ui-prof.js`. Les blocs conditionnels `.badminton-terrain-only` et `.badminton-maniere-only` sont automatiquement masqués/affichés selon le mode.

**Config Firebase** :
```js
{
  activite: 'badminton',
  mode: 'terrain' | 'maniere',        // le mode de jeu
  terrainType: 'frontback' | 'leftright' | '4corners',  // si mode=terrain
  centerSize, centerPoints, otherPoints, cornerPoints, faultPoints, faultPenalty,
  dureeMatch,                          // si mode=terrain (secondes)
  bonusManiere, seuilVictoire,         // si mode=maniere
  1: 5, 2: 5, 3: 5, ...                // composition des terrains
}
Escalade
Classique : grille A, B, C... + hauteur + cotation + couleur

Bloc Contest : nouveau mode, validations drag & drop

Arcathlon
Flux : Course → Tir → Pénalités → Finale. Équipes de 3 (quartiles VMA).

Relais
2 sous-activités : relais10s (zone atteinte) et relais2zones (chrono 4 clics).

Natation
Indice de nage (vitesse × distance par cycle) + Organisation pédagogique (référence figée + équipes équilibrées avec rôles or/argent/bronze) + Relais (course par équipes).

Grilles d'évaluation
Voir section 9.

1/2 Fond
Voir section 10.

Tournoi
Variante élimination : chaque élève compte ses éliminations, TV affiche un classement visuel.

Sync entre appareils
Voir section 13.

7. Fichiers critiques à NE PAS casser
core/live-engine.js : écoute des données + mapping local

core/firebase-service.js : chemins hiérarchiques

ui/prof/activities.js : switch disciplines + switchActivitySubTab + transmettreConfig

ui/prof/layout.js : navigation entre onglets

modules/escalade/escalade-interface.js : grille (Sortable)

modules/arcathlon/arcathlon-kiosk.js : flux complexe

modules/relais/relais-kiosk.js : aiguillage sous-activités

modules/demi-fond/variantes/trois-cinq-min/trois-cinq-min-kiosk.js : flux observateur + séquence auto

modules/grilles/grilles-interface.js : nombreuses fonctions window.grilles*

modules/grilles/connecteurs/*.js : chaque connecteur lit un chemin Firebase spécifique

services/export-service.js : conventions d'export centralisées

services/sync-service.js : sync local ↔ fichier (Web Share sur iPad)

8. Leçons apprises (Arcathlon)
Problème	Cause	Solution
Flux bloqué	Bouton « Arrivée » masqué en finale	Toujours présent, activé par startCourse()
Chronos erronés	Chrono réinitialisé à chaque phase	Accumuler dans state.tempsTotalSerie
Bouton « Fin de tir » inactif	addEventListener sur bouton recréé	onclick direct
Tirs validés incomplets	Pas de vérif. du nombre de flèches	state.shots.every(s => s !== 0)
Vitesse sur pénalités	Distance totale utilisée	Vitesse = course uniquement
9. Grilles d'évaluation — Conventions
9.1. Modèle de données
json
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
4 niveaux : 4/3/2/1

Couleurs : 4 → #22c55e · 3 → #84cc16 · 2 → #eab308 · 1 → #ef4444

Pondération : % explicite ou 0 pour équipondéré

Note finale : noteSur100 = (Σ(val × poids) / Σ(poids)) × 25 ; noteSur20 = noteSur100 / 5

Grille figée = immuable

Auto-évaluations = anonymisées par codeAutoEval

9.3. Types de critères
type: "auto" : pré-remplissable par un connecteur

type: "prof" : saisie manuelle

type: "eleve" : côté kiosque élève

9.4. Pattern matching critère → donnée auto
La fonction matcherCritere(critere, data) utilise le contenu des descripteurs en priorité (plus fiable que le nom).

9.5. Connecteurs — Chemins Firebase
Activité	Chemin config	Source données
Relais	{classe}/relais/config	relais/mesures-10s + relais/mesures-2zones
Arcathlon	{classe}/arcathlon/config	arcathlon/passages/{mode}
Escalade	{classe}/config (racine)	escalade/montees
Demi-fond	{classe}/demi-fond/config (tiret)	demi-fond/observations/course-{1,2,3}
⚠️ Mapping activité → chemin Firebase obligatoire dans grilles-interface.js :

js
const cheminFirebase = {
    'demi_fond': 'demi-fond',
    'demi-fond': 'demi-fond',
    'escalade': null  // à la racine
};
9.6. Seuils par connecteur
Relais : écart V_th vs V_réelle (performance_donneur) / % transmission (qualité).

Arcathlon : écart VMA 1ère série / total scoreTir.

Escalade :

grimpeur (C3) : 2 tops ≥ 5a → 4 · 2 tops 4a-4c → 3 · hauteur 3-9m → 2 · <3m → 1

grimpeur_voies (C4) : 2ème meilleure cotation ≥ 5c / ≥ 5a / ≥ 4a / échec

Demi-fond :

Allure : V3 − V1 ≥ +0.5 → 4 · stable → 3 · V3 − V1 ≤ −0.5 → 2 · abandon → 1

Performance (seuils par sexe sur vitesse C3) : Filles ≥ 12 / ≥ 9.5 / ≥ 7.5 · Garçons ≥ 13.5 / ≥ 11 / ≥ 9

Régularité (CV moyen) : < 5% → 4 · 5-10% → 3 · 10-15% → 2 · > 15% → 1

9.7. Import XLSX
SheetJS local (libs/xlsx.full.min.js)

Détection activité : mot-clé n'importe où dans le nom du fichier

Détection niveau : regex sans \b car è + _ n'est pas une frontière de mot : (C[1-5]|[3-6]e|[3-6]ème)

Ordre des niveaux : [4, 3, 2, 1] de gauche à droite

Pondération : extraite du nom du critère (ex. "20%")

9.8. Stockage localStorage
Clé	Contenu
eps_arena_grilles_bibliotheque	Liste des grilles
eps_arena_grilles_evaluations	Évaluations prof
eps_arena_grilles_dernier_eleve	Dernier niveau "Élève" par classe/élève
10. 1/2 Fond — Bonnes pratiques
10.1. Chemins et noms
Élément	Valeur
Identifiant activité (registre)	demi-fond
Identifiant sous-module	3x5min
Dossier Firebase	demi-fond (tiret)
Dossier code source	demi-fond (tiret)
Clé localStorage	eps_arena_demifond_${sousModule}_${classe}
10.2. Config Firebase
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
  "vmaParCode": { "1": 11, "2": 10.3 },
  "groupes": { "BLEU": [1, 5, 12], "ROUGE": [2, 6, 13] }
}
10.3. États de la séquence
État	Description
idle	En attente de GO
actif	En cours
pause_manuelle	Pause déclenchée par le prof
termine	Terminée
Le champ sequence.action détecte les changements : go, pause, reprendre, skip, stop.

10.4. Calculs clés
Distance : nbTours * tour + partiel * (tour / plots)

Vitesse : (distance / duree) * 3.6 km/h

CV : (ecartType / moyenne) * 100 sur les temps de tour

10.5. Structure d'une observation
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
timestamps : temps écoulés (ms depuis le départ) à chaque clic observateur

partiel : plots supplémentaires dans le dernier tour (0-8)

abandon : null | "blessure" | "mental"

10.6. Points d'attention
Timer prof : utilise sequence.timestampDebut (fixe depuis le GO initial). Ne JAMAIS recalculer pendant la séquence.

Course en cours : identifiée par courseNum = 1 + floor(elapsed / (duree + pause))

Anti-double-clic : par élève, avec lastClickAt[code]

Skip manuel : recalcule timestampDebut pour positionner au début de la course suivante

Reprendre : décale timestampDebut du temps écoulé depuis pauseDebut

VMA par élève : indexée par codeAutoEval dans vmaParCode

11. Badminton — Détails et pièges
11.1. Séparation des modes
⚠️ Le champ config.mode contient le mode de jeu ('terrain' ou 'maniere'), PAS le type de terrain. Le type de terrain est dans config.terrainType.

Cette séparation a été introduite parce que les deux jeux sont pédagogiquement différents :

Terrain → V/D simple, clic sur zones

Manière → bonus 8 pts, cases à cocher

11.2. Sélecteur de mode prof
Le sélecteur est généré par initBadmintonModeSelector() de badminton-ui-prof.js. Il est appelé depuis activities.js dans la branche disc === 'badminton'.

Les blocs conditionnels dans maitre.html doivent porter les classes :

.badminton-terrain-only : visible seulement en mode Terrain

.badminton-maniere-only : visible seulement en mode Manière

11.3. Chrono de match (mode Terrain)
Démarre à selectMatchFromList() (clic sur un match)

Se met en alerte (jaune pulsé) à 10s restantes

Se met en termine (rouge pulsé) à 0s

Joue 3 bips à 0s (via Web Audio API)

Ne force PAS la fin du match — c'est purement indicatif

11.4. Cache fantôme
badminton-common.js fait un reset complet du state à initBadmintonCommon() + pose un listener Firebase sur les results qui resynchronise matchSchedule en temps réel. Cela évite que les anciens scores persistent après une purge Firebase.

11.5. Axe Avant/Arrière vs Gauche/Droite
Dans generateCourtHTML() :

frontback → layout-row (côte à côte)

leftright → layout-col (empilé)

Si un jour tu veux re-inverser, échange 'frontback' et 'leftright' dans les 2 lignes marquées ⬇️.

12. Sync entre appareils (iPad ↔ PC)
12.1. Principe
Un fichier JSON unique contient toutes les clés eps_arena_* du localStorage (sauf profCode). Il est exporté/importé manuellement via Nextcloud.

Pas de WebDAV automatique : Nextcloud EN bloque le CORS. Le serveur ne sert pas de HTML non plus.

12.2. Workflow
iPad (fin de journée) → onglet 🔁 Sync → 📤 Télécharger la sauvegarde → feuille de partage iOS → Enregistrer dans Fichiers → Nextcloud/EPS-Arena/

PC (le soir) → le client Nextcloud synchronise → onglet 🔁 Sync → 📂 Choisir un fichier → sélectionner le .json → confirmer → reload

12.3. Fichier clé
src/js/services/sync-service.js :

exporterToutesLesDonnees(appareil) : utilise Web Share API si disponible (iPad), sinon fallback download (PC)

importerFichierSync(file) : restaure tout, avec confirmation

resumerDonneesLocales() / resumerFichierSync(json) : résumés pour l'UI

12.4. Ce qui n'est PAS inclus
Photos élèves (IndexedDB) → gérées via Nextcloud dossier séparé

Audio Luc Léger (IndexedDB) → fichier local

eps_arena_profCode → volontairement exclu

12.5. PWA iPad
Sur iPad, si le fichier ne se télécharge pas via a.click(), c'est normal en mode PWA. Web Share API est indispensable. Si le code ne se met pas à jour après une modif : fermer complètement l'app (swipe up), ou la désinstaller/réinstaller depuis Safari.

13. Conventions d'export (iDoceo & Excel)
13.1. Règle d'or
Type de colonne	Préfixe	Exemple
Identité (Nom)	!	!Nom
Identité (Prénom)	!	!Prénom
Toute donnée	aucun	Endurance (palier), VMA (km/h)
⚠️ Ne JAMAIS préfixer une colonne de données avec ! : iDoceo attend un nombre et rejette le texte → colonnes vides.

⚠️ !groupe, !Sexe, !Statut sont inutiles dans EPS-Arena (identité = Nom + Prénom seuls).

13.2. API services/export-service.js
js
import {
    colonnesIdentite,   // → [{ nom: '!Nom', cle: 'nom' }, { nom: '!Prénom', cle: 'prenom' }]
    col,                // col('VMA (km/h)', 'vma') → { nom, cle } sans préfixe
    exporterVersIDoceo, // CSV iDoceo, BOM UTF-8, séparateur ;
    exporterVersExcel,  // XLSX multi-feuilles (SheetJS)
    exporterNotesEleves // Helper tout-en-un
} from '../../services/export-service.js';
13.3. Template module "notes par élève" (iDoceo)
js
import { colonnesIdentite, col, exporterVersIDoceo } from '../../services/export-service.js';

const colonnes = [
    ...colonnesIdentite(),
    col('Mesure 1', 'm1'),
    col('Mesure 2', 'm2')
];

const donnees = eleves.map(e => ({
    nom: e.nom,
    prenom: e.prenom,
    m1: mesure1,
    m2: mesure2
}));

exporterVersIDoceo('MonModule', classe, colonnes, donnees);
13.4. Template module "matchs" (Excel)
js
import { exporterVersExcel, col } from '../../services/export-service.js';

exporterVersExcel('MonModule', classe, [
    {
        nom: 'Matchs',
        colonnes: [col('Date', 'date'), col('Joueur 1', 'j1'), col('Score 1', 's1')],
        donnees: matchs.map(m => ({ date: ..., j1: ..., s1: ... }))
    },
    {
        nom: 'Classement',
        colonnes: [col('Joueur', 'nom'), col('Points', 'pts')],
        donnees: classement
    }
]);
13.5. Nom de fichier standard
EPS-Arena_{Module}_{Classe}_{YYYYMMDD}.{csv|xlsx}

Exemple : EPS-Arena_Evaluation_506_20260915.csv

13.6. Modules concernés
Module	Format	Fonction
Évaluation	iDoceo (CSV)	exporterVersIDoceo (dans evaluation-utils.js)
Natation	iDoceo (CSV)	exportNatationIDoceo
Escalade	iDoceo (CSV)	exportEscaladeIDoceo
CO	iDoceo (CSV)	window.exportCOiDoceo (dans ui/prof/live.js)
Grilles	iDoceo (CSV)	exporterNotesIDoceo
Badminton	Excel (XLSX)	exporterBadmintonExcel
Relais	Excel (XLSX)	exporterRelaisExcel
Tournoi	Excel (XLSX)	exporterTournoiExcel
13.7. Ajouter un nouveau module d'export
Créer src/js/modules/{module}/{module}-export.js

Importer les helpers du service

Construire lignes (avec nom + prenom + donnees) puis appeler exporterVersIDoceo ou exporterVersExcel

Exposer window.exporterXxxExcel = exporterXxxExcel

Ajouter la ligne import '../../modules/{module}/{module}-export.js'; dans ui/prof/activities.js

Ajouter un bouton dans l'UI prof du module

14. Astuces de débogage
Erreur	Cause	Solution
404 sur import	Mauvais nombre de ../	Un fichier dans variantes/trois-cinq-min/ a besoin de 4 niveaux
Connexion grise/rouge	SyntaxError / ReferenceError	Vérifier la console
Photos manquantes dans le Live	localMapping pas au format plat	{"504_A1": "ID"}
Glisser-déposer cassé	Anciennes instances Sortable	Détruire avec .destroy()
Page blanche	style.display = 'none' sur vues principales	Utiliser classList.add('hidden')
</div> en trop	Structure HTML cassée	Vérifier
matcherCritere has already been declared	Doublon	Écraser le fichier entier
"Config X non transmise"	Chemin Firebase erroné	escalade = racine, relais/arcathlon/demi-fond = sous-dossier
Kiosque élève "En attente"	Activité absente de config.activite reconnues dans eleve-app.js	Vérifier la liste
await dans forEach	Interdit	for...of
ReferenceError: code is not defined	Paramètre manquant	Vérifier signature de analyser()
Tiret vs underscore	demi_fond (code) ≠ demi-fond (Firebase)	Mapping dans grilles-interface.js
Codes 0 dans observations	Pas de codeAutoEval	Administration → 🔢 Codes élèves
Activité détectée comme "arena"	Parser XLSX ne reconnaît pas le mot-clé	Vérifier activitesMap
Vue Live/TV s'affiche sous le paramétrage	switchActivitySubTab ne cache pas	Cacher viewActivities
Bouton 🤖 Auto grisé	Activité sans connecteur	Vérifier ACTIVITES_AVEC_CONNECTEUR
Firebase écrit trop de noms	Données nominatives envoyées	Vérifier RGPD absolu
Identifier 'X' has already been declared	Doublon de fonction	Ctrl+F pour trouver les 2, supprimer
X is not defined sur un bouton	Module non importé	Vérifier import '.../X-export.js' dans activities.js
Cannot access 'X' before initialization	let déclaré après utilisation	Déplacer en haut du fichier (fix TDZ)
Fichier non téléchargé sur iPad	PWA bloque a.click()	Utiliser Web Share API
CORS bloqué Nextcloud	nuage.app bloque Access-Control-Allow-Origin	Solution fichier manuel uniquement
Badminton reste sur "manière"	Live pas mode-aware	badminton-live.js doit lire config.mode
15. Glossaire
Arcathlon
Série : Course → Tir → Pénalités

Grande boucle : la course de la série

Petite boucle : un tour de pénalité

Course finale : dernière course sans tir

Handicap : délai de départ (mode poursuite)

Relais
Sous-activité : relais10s ou relais2zones

V_théorique : (V_arrêté relayé + V_lancé relayeur) / 2

Score 10s : 5 + (V_réelle − V_théorique)

% transmission : (V_transmission / V_moyenne_3zones) × 100

Paliers transmission : 100% → 5pts · 90% → 4 · 80% → 3 · 70% → 2 · 60% → 1

Grilles
Grille critériée : tableau critères × niveaux

Niveau : 4/3/2/1

Critère auto : pré-remplissable

Grille figée : verrouillée après 1ère éval

Auto-évaluation : réponse anonyme via codeAutoEval

Connecteur : module qui lit les données d'une activité et calcule les niveaux auto

Pattern matching : association critère ↔ donnée dans matcherCritere

1/2 Fond
Sous-module : 3x5min R=3'

Séquence : enchaînement auto 3 courses + 2 pauses

Partiel : nombre de plots parcourus dans le dernier tour (0-8)

Allure : profil V1 → V2 → V3

Régularité : CV des temps de tour intra-course

Performance : vitesse moyenne de la Course 3 (seuils par sexe)

Observateur : élève (souvent inapte) qui clique les numéros à chaque tour

Anti-double-clic : délai minimum (30s par défaut)

Bilan : rendu post-séquence (graphique + indicateurs)

Badminton
Mode Terrain : clic sur zones 3D, V/D

Mode Manière : cases à cocher, bonus manière

Type de terrain : frontback (côte à côte) / leftright (empilé) / 4corners (9 zones)

Bonus manière : ≥ 8 pts en zone dangereuse

Chrono match : indicateur visuel, purement informatif

Sync
Fichier sync : JSON contenant toutes les clés eps_arena_*

Web Share API : partage natif iOS pour enregistrer dans Nextcloud

Nom standard : EPS-Arena_sync_{profCode}_{appareil}_{date}.json

16. Workflow de développement
16.1. Deux environnements
Environnement	Origine	profCode	Usage
Production iPad	https://osartori.github.io/...	Vrai code prof	Prise de mesures en classe
Test PC	http://127.0.0.1:5500 (VS Code)	TEST	Développement
⚠️ Le localStorage est lié à l'origine : c'est deux bases totalement séparées.

⚠️ Firebase est partagé : si tu utilises le même profCode sur les deux environnements, une purge sur PC efface tout côté iPad.

Solution : mettre TEST comme code prof sur VS Code, tu as un Firebase parallèle isolé.

16.2. Phase de test
Coder sur VS Code (profCode = TEST)

Tester avec des données fictives

Quand c'est stable, changer profCode pour le vrai code

Tester en production iPad

16.3. Rollback
Local : onglet 🔁 Sync → exporter avant, réimporter si besoin

Firebase : pas de rollback automatique. Utiliser la purge sélective dans Administration.

17. Récapitulatif des mises à jour
Section	Modif
2. Architecture	Ajout badminton-export.js, relais-export.js, tournoi-export.js, sync-service.js
3.4 Firebase	Ajout chemins natation, tournoi, badminton (2 modes)
6. Modules	Section Badminton détaillée (2 modes séparés)
11. Badminton	NOUVELLE SECTION : séparation modes, chrono, cache fantôme, axe
12. Sync	NOUVELLE SECTION : workflow iPad ↔ PC via Nextcloud
13. Export	NOUVELLE SECTION : conventions iDoceo + Excel
14. Débogage	8 nouvelles astuces (TDZ, boutons non définis, CORS, PWA…)
16. Workflow	NOUVELLE SECTION : environnements prod/test
Dernière mise à jour : refonte Badminton (2 modes séparés), conventions d'export centralisées, sync Nextcloud fichier, nouvelles astuces de débogage.

text

---

## 🎯 Ce qui a changé par rapport à ton guide actuel

**Sections ajoutées** :
- **11. Badminton** (nouvelle section complète)
- **12. Sync** (nouvelle section complète)
- **13. Export** (nouvelle section complète)
- **16. Workflow** (nouvelle section complète)

**Sections mises à jour** :
- **2. Architecture** : ajout des 4 nouveaux fichiers
- **3.4 Firebase** : ajout natation, tournoi, badminton
- **6. Modules** : Badminton détaillé
- **7. Fichiers critiques** : ajout `export-service.js` et `sync-service.js`
- **14. Débogage** : 8 nouvelles lignes (TDZ, import manquant, CORS, PWA…)

**Sections inchangées** :
- 1, 4, 5, 8, 9, 10, 15 (structurellement identiques, juste quelques ajustements)

---
