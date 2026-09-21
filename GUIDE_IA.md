1. Description du projet
Application web EPS (Éducation Physique et Sportive) pour gérer des activités sportives en classe via des iPads. Deux interfaces principales : le Professeur (maitre.html) et l'Élève (eleve.html). L'application est 100% RGPD : aucun nom ou photo d'élève ne doit être présent dans Firebase.

Architecture : modules ES6, dispatch par activité, Firebase Realtime Database pour les échanges iPad ↔ PC, localStorage + IndexedDB pour les données nominatives.

2. Architecture des dossiers (exhaustive)
text
EPS-Arena/
│ eleve.html
│ GUIDE_IA.md
│ hub-icon.svg
│ icon.svg
│ maitre.html
│ manifest.json
│
├───libs/
│ xlsx.full.min.js                # SheetJS (import/export XLSX)
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
│ constants.js                    # BAREME_ESCALADE, PALIER_VMA
│ firebase-config.js              # FIREBASE_CONFIG, DB_PATHS
│ index.js
│ orientshow-default-codes.js
│
├───core/
│ firebase-service.js             # Chemins Firebase, listeners
│ index.js
│ live-engine.js                  # Mapping codes → élèves (RGPD)
│ state.js
│
├───modules/
│ │ index.js
│ │ registry.js                   # Registre des modules
│ │
│ ├───arcathlon/                  # Course → Tir → Pénalités
│ ├───badminton/                  # 2 modes : terrain + manière
│ │ badminton-charts.js
│ │ badminton-common.js
│ │ badminton-core.js
│ │ badminton-dispatcher.js
│ │ badminton-events.js
│ │ badminton-export.js           # Export Excel
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
│ ├───co/                         # CO classique + OrientShow
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
│ ├───commun/                     # Timer, calculateur, tir
│ │
│ ├───demi-fond/                  # 3×5min R=3'
│ │ demifond-common.js
│ │ demifond-interface.js
│ │ demifond-kiosk.js
│ │ demifond-live.js
│ │ demifond-tv.js
│ │ index.js
│ │ variantes/trois-cinq-min/
│ │
│ ├───eleve/                      # Kiosques élèves transverses
│ │
│ ├───escalade/                   # Grimpe + Bloc Contest
│ │
│ ├───evaluation/                 # Évaluation des aptitudes
│ │
│ ├───grilles/                    # Grilles critériées
│ │ connecteurs/                  # Relais, Arcathlon, Escalade, Demi-fond
│ │
│ ├───multi/                      # Multi-activités (équipes)
│ │
│ ├───natation/                   # Indice de nage + Organisation + Relais
│ │ natation-interface.js
│ │ natation-kiosk.js
│ │ natation-live.js
│ │ natation-organisation.js
│ │ natation-relais.js
│ │ natation-tv.js
│ │
│ ├───orientshow/                 # Sous-module CO (ré-exports)
│ │
│ ├───ppg/                        # PPG / Échauffement
│ │ index.js                      # Registre du module
│ │ ppg-core.js                   # Bibliothèque, calcul points, tri
│ │ ppg-interface.js              # Config séance prof + aperçu
│ │ ppg-kiosk.js                  # Saisie élève
│ │ ppg-live.js                   # Live prof (classement + dates)
│ │ ppg-tv.js                     # TV podium + top 20
│ │ ppg-export.js                 # Excel (séance + historique)
│ │
│ ├───poursuite/
│ │
│ ├───relais/                     # Relais 10s / 2 zones
│ │ relais-core.js
│ │ relais-interface.js
│ │ relais-kiosk.js
│ │ relais-live.js
│ │ relais-tv.js
│ │ relais-export.js
│ │
│ ├───teams/                      # Générateur d'équipes
│ │
│ └───tournoi/                    # Élimination + ATP
│ tournoi-core.js                 # Core partagé, variant-aware
│ tournoi-dispatcher.js           # Charge la bonne variante
│ tournoi-export.js               # Export Excel (élimination)
│ tournoi-prof.js                 # Sélecteur de variante (prof)
│ tournoi-registry.js             # Registre des variantes
│ variantes/
│ elimination/
│ atp/
│ index.js
│ atp-core.js
│ atp-prof.js
│ atp-kiosk.js
│ atp-live.js
│ atp-tv.js
│
├───services/
│ admin-service.js                # Gestion élèves + photos + codes
│ export-service.js               # ⭐ Service centralisé d'export
│ export-idocéo.js
│ import-service.js
│ photo-service.js
│ sync-service.js                 # ⭐ Sync entre appareils
│ toast-service.js
│ index.js
│
├───ui/
│ │ action-ui.js
│ │ dashboard-ui.js              # Onglet Admin
│ │ index.js
│ │ login-ui.js
│ │
│ ├───eleve/
│ │ eleve-actions.js
│ │ eleve-app.js                 # Point d'entrée élève
│ │
│ └───prof/
│ activities.js                  # ⭐ Switch disciplines + imports
│ layout.js                      # Navigation onglets
│ live.js                        # Live + exports CO
│
└───utils/
format.js
index.js
validation.js
3. Structure Firebase (TRÈS IMPORTANT - RGPD)
3.1. Chemin hiérarchique de base
text
etablissements/0680013V/profs/{codeProf}/{classe}/{activite}/...
CodeProf : localStorage.getItem('eps_arena_profCode') (défaut : DEFAULT)

Classe : ex. "504", "305", "506"

Activite : ex. escalade, co, multi, arcathlon, relais, demi-fond, grilles, badminton, natation, tournoi, ppg

3.2. Config racine
text
etablissements/0680013V/profs/{codeProf}/{classe}/config
Contenu : { activite: "badminton", ... }
⚠️ Exception escalade : la config escalade est stockée à la racine {classe}/config (pas dans escalade/config).

3.3. Classes actives
text
etablissements/0680013V/profs/{codeProf}/active_classes
Contenu : { 504: true, 305: true }
3.4. Chemins spécifiques par activité
Arcathlon :

text
{classe}/arcathlon/config/
{classe}/arcathlon/passages/sprint/{pushId}
{classe}/arcathlon/passages/poursuite/{pushId}
{classe}/arcathlon/commandes/depart
Badminton :

text
{classe}/config                          # { activite: 'badminton', mode: 'terrain'|'maniere', ... }
{classe}/badminton/results/{matchId}
Le champ mode est soit 'terrain', soit 'maniere' — c'est le mode de jeu, pas le type de terrain. Le type de terrain (frontback / leftright / 4corners) est dans config.terrainType.

Relais :

text
{classe}/relais/config                   # { sousActivite, mode, distances2zones, groupes }
{classe}/relais/vitesses                 # { "0_a": { arret, lance } }
{classe}/relais/mesures-10s/{pushId}
{classe}/relais/mesures-2zones/{pushId}
Grilles (évaluation) :

text
{classe}/grilles/config                  # { actif, grilleId, periode }
{classe}/grilles/auto_evaluations/{pushId}
Demi-fond (⚠️ TIRET, pas underscore) :

text
{classe}/demi-fond/config                # ⚠️ tiret
{classe}/demi-fond/commandes/sequence
{classe}/demi-fond/observations/course-{1,2,3}/{code}
Natation :

text
{classe}/natation/config
{classe}/natation/temps/{numero}
{classe}/natation/coups/{numero}
{classe}/natation/historique/{numero}
{classe}/natation/organisation/reference/{numero}
{classe}/natation/organisation/equipes
{classe}/natation/organisation/courses/{timestamp}
Tournoi (2 variantes) :

text
{classe}/tournoi/config                  # { mode: "elimination" | "atp" }
{classe}/tournoi/elimination/joueurs/{code}
{classe}/tournoi/elimination/historique
{classe}/tournoi/atp/joueurs/{code}
{classe}/tournoi/atp/matchs/{pushId}
{classe}/tournoi/atp/archives/{pushId}
{classe}/tournoi/atp/config              # Barème éditable
⚠️ Compatibilité rétroactive : les anciennes données elimination stockées à la racine (tournoi/joueurs) ne sont pas migrées automatiquement. Migration manuelle possible.

PPG :

text
{classe}/ppg/config                      # { ateliers: [...] } (bibliothèque)
{classe}/ppg/seance/{date}               # { ateliers: [...], timestamp }
{classe}/ppg/observations/{date}/{code}
    → {
        _meta: { code, timestamp, source },
        corde:  { p1, p2, best, niveau: null },
        pompes: { p1, p2, best, niveau: 1-4 }
      }
⚠️ Format Firebase à plat (post-refacto) : perfs à la racine, pas de wrapper .perfs. Le lecteur agregerSeance tolère les 2 formats (rétrocompat).

3.5. Règle RGPD stricte
Uniquement des codes et des nombres transitent sur Firebase.

Aucun nom, prénom, ID pseudonymisé (ex. BASTID_A) ne doit y figurer. Les clés des observations sont les codeAutoEval (1, 2, 3...) ou des codes de position (0_a, 1_b).

4. Mapping Local (RGPD)
Les noms et photos sont liés aux codes uniquement via le localStorage du navigateur du Professeur.

Format : objet plat, ex. {"504_A1": "BASTID_A", "504_BLEU_1": "id-eleve"}.

Fichier clé : src/js/core/live-engine.js (getEleveIdFromCode, getNomFromCode, getPhotoHtml, getLocalMapping, setLocalMapping).

Clé de stockage : eps_arena_local_mapping_{classe}.

4.1. Codes élèves stables (codeAutoEval)
Chaque élève possède un codeAutoEval unique et permanent (1, 2, 3...) stocké dans eps_arena_eleves_{classe} sous .codeAutoEval.

Jamais réutilisé, même si l'élève change de groupe ou est absent

Attribué automatiquement à l'import (ZIP ou CSV) selon l'ordre alphabétique

Utilisé pour : auto-évaluations des grilles, tournoi élimination, tournoi ATP, module 1/2 Fond, module PPG, module Cross (à venir)

Communiqué à l'élève par le prof (liste imprimable dans Administration → 🔢 Codes élèves)

Fonctions clés dans admin-service.js :

migrerCodesAutoEval(classe) : attribue les codes manquants

getCodeAutoEval(classe, eleveId) : récupère le code d'un élève

getEleveFromCodeAutoEval(classe, code) : récupère l'élève d'un code

⚠️ Ne pas confondre avec les codes de groupe (G1a, A1, BLEU_1) qui servent pour les activités collectives.

5. Conventions de code
5.1. Structure des modules
Modulaire ES6 : import / export

Fonctions globales : les fonctions appelées par les boutons HTML (onclick) sont exposées sur window

Imports dynamiques : les modules Live et TV sont chargés via import('...') pour éviter de faire planter l'app en cas d'erreur

5.2. Règles de masquage des vues
NE JAMAIS utiliser el.style.display = 'none' pour cacher les vues standard (écrase la classe hidden de Tailwind). Utiliser classList.add('hidden').

⚠️ Exception : viewTV utilise encore style.display car c'est une zone spéciale 100vh.

Nouvelle règle : toujours déclarer les conteneurs de discipline dans maitre.html (pattern view{Activité}Settings avec class="hidden space-y-4"). Éviter la création dynamique qui peut générer des conflits avec Tailwind.

5.3. Gestion des données
Comparaison de données Firebase : toujours utiliser String(...) ou parseInt(...) (types peuvent différer).

Format d'écriture : privilégier un format "à plat" avec _meta pour les métadonnées (voir PPG). Éviter les wrappers inutiles (perfs, data…) qui obligent chaque lecteur à déballer.

5.4. Flux et transitions (RÈGLE D'OR)
Transitions automatiques : ne jamais laisser l'utilisateur cliquer pour démarrer une phase automatique

Démarrage auto : après la première course, toutes les suivantes démarrent automatiquement (délai 100-300ms)

Fin : l'utilisateur clique sur « Arrivée » / « Terminer »

5.5. Boutons
Présence constante : le bouton principal doit être toujours présent

Mise à jour dynamique du texte et de l'état disabled

onclick direct dans le HTML (pas addEventListener sur des éléments recréés)

5.6. Interdits JavaScript
❌ await dans un forEach → utiliser for...of

❌ Doublons de déclaration de fonctions → vérifier avant copier-coller

❌ style.display = 'none' sur vues Tailwind → classList.add('hidden')

❌ Variables non déclarées dans une fonction → vérifier tous les paramètres

⚠️ Tiret vs underscore : demi_fond (code) ≠ demi-fond (Firebase). Mapping obligatoire dans grilles-interface.js

❌ Chemins Firebase avec .., #, $, [, ] : interdits. Construire les chemins absolus depuis la racine du profCode

❌ Exports inexistants dans un index.js : vérifier avant d'écrire export { X } from './sub.js'

6. Modules existants
Badminton — 2 modes de jeu séparés
Badminton possède deux jeux pédagogiquement distincts, sélectionnables dans l'interface prof via un sélecteur de mode.

Mode	Kiosque	Classement	Bonus manière	Type terrain
Terrain	Clic sur zones 3D	V/D (3/1/0 pts)	❌	✅ (frontback/leftright/4corners)
Avec la manière	Cases à cocher	5/3/2/1 pts	✅ (≥ 8 pts zone dangereuse)	❌
Fichiers clés :

badminton-registry.js : registre terrain / maniere

badminton-dispatcher.js : charge le bon module selon config.mode

badminton-terrain.js : mode terrain (clic, chrono, V/D)

badminton-maniere.js : mode manière (cases à cocher, bonus)

badminton-common.js : rendu commun (terrains, round-robin, classement)

badminton-ui-prof.js : sélecteur de mode prof + masquage conditionnel

badminton-live.js : Live mode-aware (titre selon config.mode)

Chrono en mode Terrain : la durée (config.dureeMatch, en secondes) est paramétrable côté prof, visible côté élève, avec bip + pulsation dans les 10 dernières secondes. Le chrono n'arrête pas le match automatiquement — c'est le prof (ou l'élève) qui clique "Terminer".

Sélecteur de mode prof : 2 gros boutons dans viewBadmintonSettings, gérés par badminton-ui-prof.js. Les blocs conditionnels .badminton-terrain-only et .badminton-maniere-only sont automatiquement masqués/affichés selon le mode.

Config Firebase :

js
{
  activite: 'badminton',
  mode: 'terrain' | 'maniere',                          // le mode de jeu
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

Tournoi — 2 variantes
Le module tournoi propose deux variantes pédagogiques sélectionnables côté prof via un sélecteur de variante (dans tournoi-prof.js, inséré dynamiquement dans viewTournoiSettings).

Variante	Logique	Kiosque	Classement
Élimination	Comptage des éliminations	Élève clique "je suis éliminé"	Nb éliminations croissant
ATP	Classement continu par points (badminton, ping)	Élève saisit un match (code V, code P, scores)	Points décroissants + tie-breaks
Fichiers clés :

tournoi-registry.js : registre elimination / atp

tournoi-dispatcher.js : lit config.mode dans Firebase et charge la bonne variante

tournoi-core.js : core partagé, prend un variant optionnel en paramètre

tournoi-prof.js : sélecteur UI + délégation à la variante active

variantes/elimination/ : module existant

variantes/atp/ : nouveau module (voir ci-dessous)

Sélecteur prof : 2 gros boutons dans viewTournoiSettings. Le changement écrit {classe}/tournoi/config/mode → le listener recharge la variante automatiquement.

Chemins Firebase : tournoi/config à la racine (partagé), données dans tournoi/atp/* ou tournoi/elimination/* selon la variante active.

Variante ATP — détails
Logique du classement continu type ATP/tennis de table :

Chaque joueur démarre à 100 points (paramétrable dans le barème)

À chaque match V/D, on calcule l'écart de classement avant match (pts_v − pts_p)

On applique un barème (éditable dans l'interface prof)

Le vainqueur gagne des points, le perdant en perd (points négatifs autorisés)

Le classement est recalculé entièrement à chaque modification de match (rejouer l'historique)

Barème par défaut (6 paliers) :

Écart (V − P)	Pts V	Pts P
−50 à −11	1	−1
−10 à −5	2	−2
−4 à −1	3	−3
0 à 4	4	−4
5 à 10	5	−5
11 à 50	6	−6
Tie-breaks du classement (dans l'ordre) :

Points décroissants

Victoires décroissantes

Différentiel points marqués/encaissés

Ordre alphabétique (nom prénom)

Saisie kiosk : code élève + code adversaire + score (2 nombres : mes points / ses points). Match sec (pas de sets).

Anti-triche : cooldown 3 minutes par code (localStorage côté iPad).

Archives : bouton "Archiver le classement du jour" → snapshot stocké dans tournoi/atp/archives/{pushId}.

Modification prof : liste des matchs avec bouton ✏️ pour éditer (recalcule les points à partir des matchs restants) et 🗑️ pour supprimer (recalcul automatique du classement).

PPG / Échauffement
Module dédié au moment de préparation physique en début de cours (échauffement structuré). Objectif : garder trace des performances et permettre un suivi de progression.

Structure temporelle : 3 ateliers simultanés, 2 passages par atelier, rotation à chaque bip, 45" travail / 15" repos. Durée totale : 5'45". Le timer reste externe (téléphone du prof, module commun/timer.js).

Ateliers : bibliothèque figée + possibilité d'ajouter des ateliers personnalisés via bouton ➕.

Atelier	Type	Unité	Points
🪢 Corde à sauter	quantitatif	sauts	1 pt/saut
💪 Pompes	niveaux (N1-N4)	reps	1×N pts/rep
🧘 Gainage	quantitatif	secondes	1 pt/s
🔥 Burpees	quantitatif	reps	1 pt/rep
🦵 Squats	quantitatif	reps	1 pt/rep
🦿 Fentes bulgares	quantitatif	reps	1 pt/rep
Niveaux pompes : N1 (rambarde) = ×1, N2 (banc) = ×2, N3 (genoux) = ×3, N4 (pieds) = ×4. L'élève choisit librement son niveau à chaque séance — recommandation prof orale mais libre arbitre.

Mesure : meilleur des 2 passages par atelier.

Flux :

Prof → onglet PPG → choisit 1 à 3 ateliers → "Enregistrer la séance"

Prof → "📡 Transmettre aux iPads" (publie {activite: 'ppg'})

Élèves → 3 iPads en kiosk, saisie après les 6 passages

L'élève saisit son codeAutoEval, ses perfs, valide → écran de confirmation 3s

Suivi :

Live prof : classement du jour + navigation par date + liste des manquants

TV : podium top 3 + liste 4-20e en temps réel

Score global : affichage séparé par atelier, pas d'agrégat global (contrainte pédagogique)

Progression : à terme, courbe par élève × atelier

Fichiers clés :

ppg-core.js : bibliothèque d'ateliers, calcul des points, tri classement

ppg-interface.js : config séance prof (slots 1-3) + aperçu résultats

ppg-kiosk.js : saisie élève + anti-triche 30s

ppg-live.js : Live prof + navigation date

ppg-tv.js : podium + barres

ppg-export.js : Excel 2 feuilles (Séance du jour + Historique complet)

Format Firebase à plat :

js
{
  _meta: { code, timestamp, source },
  corde:  { p1: 58, p2: 65, best: 65, niveau: null },
  pompes: { p1: 5, p2: 6, best: 6, niveau: 3 }
}
Remplacement d'atelier d'une séance à l'autre : naturel, chaque séance a sa propre config ppg/seance/{date}.

7. Fichiers critiques à NE PAS casser
core/live-engine.js : écoute des données + mapping local

core/firebase-service.js : chemins hiérarchiques

ui/prof/activities.js : switch disciplines + switchActivitySubTab + transmettreConfig + maps liveModules et tvModules

ui/prof/layout.js : navigation entre onglets

modules/escalade/escalade-interface.js : grille (Sortable)

modules/arcathlon/arcathlon-kiosk.js : flux complexe

modules/relais/relais-kiosk.js : aiguillage sous-activités

modules/demi-fond/variantes/trois-cinq-min/trois-cinq-min-kiosk.js : flux observateur + séquence auto

modules/grilles/grilles-interface.js : nombreuses fonctions window.grilles*

modules/grilles/connecteurs/*.js : chaque connecteur lit un chemin Firebase spécifique

services/export-service.js : conventions d'export centralisées

services/sync-service.js : sync local ↔ fichier (Web Share sur iPad)

modules/tournoi/tournoi-registry.js : ajout variantes

modules/tournoi/tournoi-core.js : signature initTournoiCore(classe, variant) obligatoire pour ATP

modules/tournoi/tournoi-prof.js : sélecteur de variante + délégation

modules/tournoi/variantes/atp/atp-core.js : logique ATP (barème, recalcul, tri)

modules/ppg/ppg-core.js : agregerSeance tolérant 2 formats

modules/ppg/ppg-kiosk.js : écriture à plat (pas de wrapper)

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
Le sélecteur est généré par initBadmintonModeSelector() de badminton-ui-prof.js. Appelé depuis activities.js dans la branche disc === 'badminton'.

Les blocs conditionnels dans maitre.html doivent porter les classes :

.badminton-terrain-only : visible seulement en mode Terrain

.badminton-maniere-only : visible seulement en mode Manière

11.3. Chrono de match (mode Terrain)
Démarre à selectMatchFromList() (clic sur un match)

Se met en alerte (jaune pulsé) à 10s restantes

Se met en termine (rouge pulsé) à 0s

Joue 3 bips à 0s (Web Audio API)

Ne force PAS la fin du match — c'est purement indicatif

11.4. Cache fantôme
badminton-common.js fait un reset complet du state à initBadmintonCommon() + pose un listener Firebase sur les results qui resynchronise matchSchedule en temps réel.

11.5. Axe Avant/Arrière vs Gauche/Droite
Dans generateCourtHTML() :

frontback → layout-row (côte à côte)

leftright → layout-col (empilé)

12. Sync entre appareils (iPad ↔ PC)
12.1. Principe
Un fichier JSON unique contient toutes les clés eps_arena_* du localStorage (sauf profCode). Exporté/importé manuellement via Nextcloud.

Pas de WebDAV automatique : Nextcloud EN bloque le CORS. Le serveur ne sert pas de HTML non plus.

12.2. Workflow
iPad (fin de journée) → onglet 🔁 Sync → 📤 Télécharger la sauvegarde → feuille de partage iOS → Enregistrer dans Fichiers → Nextcloud/EPS-Arena/

PC (le soir) → le client Nextcloud synchronise → onglet 🔁 Sync → 📂 Choisir un fichier → sélectionner le .json → confirmer → reload

12.3. Fichier clé
src/js/services/sync-service.js :

exporterToutesLesDonnees(appareil) : Web Share API sur iPad, download sur PC

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
Identité (Nom)	aucun	Nom de famille
Identité (Prénom)	aucun	Prénom
Toute donnée	aucun	Endurance (palier), VMA (km/h)
⚠️ Ne JAMAIS préfixer une colonne (identité ou donnée) avec "!" : iDoceo rejette ces en-têtes lors de l'import guidé. Utiliser des en-têtes sans signe distinctif. Pour le nom, privilégier "Nom de famille" (reconnu nativement par iDoceo).

⚠️ !groupe, !Sexe, !Statut sont inutiles dans EPS-Arena (identité = Nom de famille + Prénom seuls).

13.2. API services/export-service.js
js
import {
    colonnesIdentite,   // → [{ nom: 'Nom de famille', cle: 'nom' }, { nom: 'Prénom', cle: 'prenom' }]
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
PPG	Excel (XLSX)	exporterPPGExcel
13.7. Ajouter un nouveau module d'export
Créer src/js/modules/{module}/{module}-export.js

Importer les helpers du service

Construire lignes (avec nom + prenom + donnees) puis appeler exporterVersIDoceo ou exporterVersExcel

Exposer window.exporterXxxExcel = exporterXxxExcel

Ajouter import '../../modules/{module}/{module}-export.js'; dans ui/prof/activities.js

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
Kiosque élève "En attente"	Activité absente de config.activite reconnues	Vérifier la liste dans eleve-app.js
await dans forEach	Interdit	for...of
ReferenceError: code is not defined	Paramètre manquant	Vérifier signature de analyser()
Tiret vs underscore	demi_fond (code) ≠ demi-fond (Firebase)	Mapping dans grilles-interface.js
Codes 0 dans observations	Pas de codeAutoEval	Administration → 🔢 Codes élèves
Activité détectée comme "arena"	Parser XLSX ne reconnaît pas le mot-clé	Vérifier activitesMap
Vue Live/TV s'affiche sous le paramétrage	switchActivitySubTab ne cache pas	Cacher viewActivities
Bouton 🤖 Auto grisé	Activité sans connecteur	Vérifier ACTIVITES_AVEC_CONNECTEUR
Firebase écrit trop de noms	Données nominatives envoyées	Vérifier RGPD absolu
Identifier 'X' has already been declared	Doublon de fonction	Ctrl+F pour trouver les 2, supprimer
X is not defined sur un bouton	Module non importé	Vérifier import dans activities.js
Cannot access 'X' before initialization	let déclaré après utilisation	Déplacer en haut du fichier (fix TDZ)
Fichier non téléchargé sur iPad	PWA bloque a.click()	Utiliser Web Share API
CORS bloqué Nextcloud	nuage.app bloque Access-Control-Allow-Origin	Solution fichier manuel uniquement
Badminton reste sur "manière"	Live pas mode-aware	badminton-live.js doit lire config.mode
does not provide an export named 'cleanup'	index.js importe un export qui n'existe pas	Vérifier que l'index n'importe que ce qui est réellement exporté. Cas type : atp/index.js importait cleanup depuis atp-kiosk.js qui n'en expose pas
Variable ref not defined dans un module kiosk	Import ref retiré par erreur lors d'un "nettoyage"	Vérifier que import { db, ref, onValue, push } from '...firebase-service.js' est bien complet
Chemin Firebase atp/../config interdit	.. et # sont interdits dans les chemins Firebase	Construire les chemins absolus depuis la racine du profCode, jamais avec ..
Live affiche « Chargement... » figé	Inversion entre liveModules et tvModules dans activities.js	Vérifier que 'ppg': () => import('.../ppg-live.js').then(m => m.renderPPGLive()) est dans liveModules, pas ppg-tv.js
Live et TV visibles en même temps	Reset incomplet des style.display	Forcer viewTV.style.display = 'none' dans le bloc subTab === 'live' et inversement
Score PPG à 0 malgré saisie kiosk	Lecture du mauvais format (wrapper perfs vs à plat)	Utiliser agregerSeance qui est tolérant, ou lire obs[atelierId] avec fallback obs.perfs[atelierId]
Conflit viewPPGSettings caché	Conteneur non déclaré dans maitre.html → création dynamique avec classe hidden	Déclarer tous les conteneurs de discipline dans maitre.html
Choix forcé de 3 ateliers PPG	Validation trop stricte dans ppgValiderSeance	Autoriser 1 à 3 ateliers (filtrer les slots vides)
Module ATP ne s'affiche pas	Format init as default dans variantes/atp/index.js	Le dispatcher cherche module.default?.init || module.init — vérifier l'export
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

Tournoi — variante ATP
Classement continu : chaque joueur a un nombre de points persistant d'un cycle à l'autre

Barème : table de correspondance écart → pts V / pts P, éditable en config

Écart de classement : points_vainqueur − points_perdant, évalué avant le match

Recalcul complet : à chaque modif de l'historique, on rejoue tous les matchs dans l'ordre chronologique

Archive : snapshot manuel du classement à un instant T

Tie-breaks : points > victoires > diff points > alphabétique

PPG / Échauffement
Séance : configuration du jour, liste d'1 à 3 ateliers

Passage : 45" de travail sur un atelier. Il y a 6 passages par séance (3 ateliers × 2 tours)

Meilleur (best) : max(p1, p2) sur les 2 passages d'un même atelier

Niveau : pour les ateliers à niveaux (pompes), multiplicateur de points (N1=×1 → N4=×4)

Bibliothèque : liste figée d'ateliers standards + possibilité d'en ajouter

Format à plat : perfs écrites à la racine de l'observation (pas de wrapper)

Score séparé par atelier : pas d'agrégat global, choix pédagogique

Cross établissement (à venir)
Événement annuel, 4 courses séparées (F/G × 6-5 / 4-3), 2 composantes de note (contrat temps + classement), saisie des arrivées par douchette code-barres, iPads podiums/classements en direct.

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

17. Roadmap / Chantiers en cours
En production
✅ Toutes les activités historiques (Arcathlon, Badminton 2 modes, CO/OrientShow, Escalade, Grilles, Multi, Natation, Relais, 1/2 Fond, Tournoi élimination)

✅ Tournoi ATP (batch complet : core, prof, kiosk, live, tv)

✅ PPG / Échauffement (batch complet : core, prof, kiosk, live, tv, export Excel)

Chantiers ouverts (non planifiés)
Tournoi ATP — export Excel (Matchs + Classement) à ajouter

Tournoi ATP — import CSV initial de classement (basé sur le fichier atptournoi_pc.xls)

PPG — courbe de progression par élève × atelier (inspirée de Tracker Sportif Pro)

PPG — édition/suppression d'observations côté prof

PPG — bouton Export Excel dans l'interface prof (actuellement seulement window.exporterPPGExcel())

Cross établissement — module complet à concevoir (prochaine grande feature)

Décisions techniques actées
Séparation des données tournoi par variante : tournoi/atp/* et tournoi/elimination/* (pas de mélange à la racine)

Format Firebase PPG à plat (pas de wrapper perfs) avec rétrocompat sur lecture

Sélecteur de variante tournoi dans tournoi-prof.js, rien dans maitre.html

Timer PPG externe (téléphone du prof), pas de timer intégré

Conteneurs de discipline déclarés dans maitre.html (pattern systématique view{Activité}Settings)

18. Récapitulatif des mises à jour
Section	Modif
2. Architecture	Ajout modules/ppg/* et modules/tournoi/variantes/atp/*, tournoi-prof.js
3.4 Firebase	Ajout chemins tournoi/atp/*, refonte tournoi/*, ajout ppg/*
5. Conventions	Ajout règles format à plat + chemins Firebase interdits + exports index
6. Modules	Ajout détaillé Tournoi (2 variantes) + PPG
7. Fichiers critiques	Ajout tournoi-registry, tournoi-core (variant), tournoi-prof, atp-core, ppg-core, ppg-kiosk, activities.js
14. Débogage	11 nouvelles lignes (import cassé, ref manquant, chemin interdit, inversion Live/TV, format de données PPG, etc.)
15. Glossaire	Ajout ATP + PPG + Cross (placeholder)
17. Roadmap	NOUVELLE SECTION : ce qui est fait, chantiers ouverts, décisions techniques
18. Récap	NOUVELLE SECTION
Dernière mise à jour : refonte Tournoi (variante ATP ajoutée), nouveau module PPG / Échauffement complet, préparation du chantier Cross établissement.