## 1. Description du projet

Application web EPS (Éducation Physique et Sportive) pour gérer des activités sportives en classe via des iPads. Deux interfaces principales : le Professeur (`maitre.html`) et l'Élève (`eleve.html`). L'application est **100% RGPD** : aucun nom ou photo d'élève ne doit être présent dans Firebase.

---

## 2. Architecture des dossiers (Exhaustive)

```text
C:.
│   eleve.html
│   GUIDE_IA.md
│   hub-icon.svg
│   icon.svg
│   maitre.html
│   manifest.json
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
        │   │   
        │   ├───arcathlon
        │   │       arcathlon-interface.js
        │   │       arcathlon-kiosk.js
        │   │       index.js
        │   │       
        │   ├───badminton
        │   │       badminton-interface.js
        │   │       badminton-kiosk.js
        │   │       badminton-live.js
        │   │       badminton-stats.js
        │   │       badminton-tv.js
        │   │       
        │   ├───co
        │   │       circuit-manager.js
        │   │       co-interface.js
        │   │       co-live.js
        │   │       matrice.js
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
        │   │       escalade-calculations.js
        │   │       escalade-controller.js
        │   │       escalade-interface.js
        │   │       escalade-live.js
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
        │   │       evaluation-templates.js
        │   │       evaluation-utils.js
        │   │       evaluation-vma.js
        │   │       index.js
        │   │       
        │   ├───multi
        │   │       multi-controller.js
        │   │       multi-live.js
        │   │       
        │   ├───orientshow
        │   │       orientshow-interface.js
        │   │       orientshow-live.js
        │   │       orientshow-tv.js
        │   │       
        │   ├───poursuite
        │   │       poursuite-controller.js
        │   │       
        │   ├───sprint
        │   └───teams
        │           team-generator.js
        │           
        ├───services
        │       admin-service.js
        │       export-idocéo.js
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
3. Structure Firebase (TRÈS IMPORTANT - RGPD)
Chemin hiérarchique exact :

text
etablissements/0680013V/profs/{codeProf}/{classe}/{activite}/montees
CodeProf : Récupéré depuis localStorage.getItem('eps_arena_profCode') (défaut : DEFAULT).

Classe : Ex: "504", "305".

Activite : Ex: "escalade", "co", "multi", "arcathlon".

Config :

text
etablissements/0680013V/profs/{codeProf}/{classe}/config
Contenu : {A: 3, B: 2, activite: "escalade"} (uniquement des nombres).

Active Classes :

text
etablissements/0680013V/profs/{codeProf}/active_classes
Contenu : {504: true, 305: true}.

Structure spécifique à Arcathlon :

text
etablissements/0680013V/profs/{codeProf}/{classe}/arcathlon/
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
RÈGLE STRICTE : Uniquement des codes et des nombres transitent sur Firebase. Aucun nom, prénom ou ID pseudonymisé (ex: BIANCHI_P) ne doit y figurer !

4. Mapping Local (RGPD - Stockage local)
Les noms et les photos sont liés aux codes uniquement via le localStorage du navigateur du Professeur.

Format du mapping : Objet plat, ex: {"504_A1": "BIANCHI_P", "504_A2": "DASILVALOUREIRO_T"}.

Fichier clé : src/js/core/live-engine.js (fonctions getEleveIdFromCode, getNomFromCode, getPhotoHtml).

Où est stocké le mapping ? : localStorage.getItem('eps_arena_local_mapping_{classe}').

Important : Le mapping est créé lors de la Transmission (transmettreConfig) et stocké UNIQUEMENT sur l'appareil du professeur.

5. Conventions de code
5.1. Structure des modules
Modulaire ES6 : Utilisation d'import et export.

Fonctions globales : Les fonctions appelées par les boutons HTML (onclick) sont exposées sur window (ex: window.transmettreConfig, window.generateTeams).

Imports dynamiques : Les modules Live et TV sont chargés dynamiquement via import('...') pour éviter de faire planter toute l'application si un module spécifique a une erreur. Le routage se fait via renderLive(discipline) ou switchActivitySubTab().

5.2. Règles de masquage des vues
NE JAMAIS utiliser el.style.display = 'none' pour cacher les vues standard (cela écrase la classe hidden de Tailwind et rend la page blanche). Utiliser uniquement classList.add('hidden').

5.3. Gestion des données
Comparaison de données : Toujours utiliser String(...) ou parseInt(...) lors de la comparaison de données Firebase (car les types peuvent différer : nombre vs chaîne).

5.4. Flux et transitions (RÈGLE D'OR pour les modules à phases)
NE JAMAIS laisser l'utilisateur cliquer pour démarrer une phase qui doit être automatique. Chaque transition entre les phases d'une même série doit être automatique (sauf le début de la première course et la fin de chaque effort de course).

Démarrage automatique des courses : après la première course (série 1), toutes les courses suivantes (séries 2, 3, …, finale) doivent démarrer automatiquement (avec un délai de 100-300ms pour laisser le temps à l'interface de se mettre à jour). Ne pas attendre un clic de l'utilisateur.

Fin des courses : l'utilisateur doit cliquer sur « Arrivée » pour terminer chaque course (y compris la finale). C'est le seul clic autorisé pendant une course.

Transitions Course → Tir : automatique. Pas de clic.

Transitions Tir → Pénalités : automatique si des pénalités sont dues.

Transitions Pénalités → Course suivante : automatique. Le dernier clic sur un tour de pénalité déclenche la série suivante (ou la finale).

Gestion des chronos : le chrono de phase (gauche) affiche le temps de la phase en cours (course, tir ou pénalité). Le chrono total (droite) affiche le temps cumulé depuis le début de l'épreuve. Les chronos ne doivent jamais s'arrêter entre les phases d'une même série.

5.5. Gestion des tirs
Validation obligatoire : l'utilisateur doit indiquer le résultat de chaque flèche (réussi ou raté) avant que le bouton « Fin de tir » ne devienne actif. Le bouton doit être désactivé tant que toutes les flèches ne sont pas cliquées.

Feedback visuel : un message doit guider l'utilisateur (« Indiquez toutes les flèches » ou « Toutes les flèches sont indiquées »).

Mise à jour dynamique du bouton : dans la fonction window.toggleShot, mettre à jour le texte et l'état disabled du bouton #giantBtn.

5.6. Gestion des pénalités
Règle simple : une pénalité = 1 tour de pénalité par flèche manquée.

Déroulement : la première pénalité démarre automatiquement après le tir. Chaque clic sur « Tour X » termine la boucle en cours et démarre automatiquement la suivante (si elle existe). Le dernier clic déclenche la série suivante (ou la finale).

Chronométrage : chaque tour de pénalité est chronométré individuellement. Le temps est enregistré dans un tableau tempsPenalites.

5.7. Gestion des boutons
Présence constante : le bouton principal doit être toujours présent en phase course (y compris pour les séries suivantes et la finale). Il doit afficher « Arrivée » lorsque la course est en cours.

Mise à jour dynamique : le texte et l'état (disabled) du bouton doivent être mis à jour dynamiquement dans window.toggleShot et renderPhase, sans avoir besoin de re-rendre toute la page.

Utiliser onclick : pour éviter les problèmes d'écouteurs non rattachés, utiliser onclick="window.onGiantAction()" directement dans le HTML plutôt que addEventListener.

5.8. Détection de fraude
Seuils : une alerte est déclenchée si la vitesse calculée est > 25 km/h ou > 1.5 × VMA de référence. La vitesse doit être calculée uniquement sur le temps de course (les pénalités ne sont pas incluses dans le calcul de la vitesse).

Stockage : le champ alerteTriche est enregistré dans Firebase avec le passage.

5.9. Enregistrement dans Firebase
Structure des passages pour Arcathlon :

json
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

6. Modules existants et fonctionnalités clés
Escalade
escalade-interface.js : Grille A, B, C... (nombre de groupes dynamique basé sur les élèves ÷ 3, ou sur la sauvegarde JSON).

escalade-live.js : Rendu du Live + clic sur élève pour ouvrir le bilan (nombre de montées, distance, difficulté moyenne en cotation, etc.).

escalade-tv-ui.js : Rendu de la Montagne pour l'onglet TV (ordre alphabétique horizontal, hauteur verticale proportionnelle aux points).

Badminton (Module "Impacts")
badminton-kiosk.js (Élève) : Terrain 3D, sélection de matchs, Round Robin, saisie des impacts (stats % bonus).

badminton-live.js (Prof) : Grille de cartes par terrain, photos, classement (Victoire = 3pts / Défaite = 1pt), fiche élève modifiable (Stats).

badminton-tv.js (TV) : Affichage plein écran avec photos et podium.

Arcathlon (NOUVEAU)
arcathlon-interface.js : Génération des équipes (3 par équipe, quartiles de VMA), paramètres (mode, nb séries, nb flèches, longueurs), transmission Firebase.

arcathlon-kiosk.js : Interface élève avec flux : Course → Tir → Pénalités → (série suivante) → ... → Course finale. Gestion des chronos, tirs, pénalités, détection de fraude.

arcathlon-live.js : Rendu des résultats, classements, graphiques, export CSV (à venir).

arcathlon-tv.js : Affichage plein écran (à venir).

arcathlon-utils.js : Fonctions de calcul (points VMA, bonus de tir, temps bonifié, etc.).

7. Fichiers critiques à NE PAS casser
src/js/core/live-engine.js : Cœur de l'écoute et du mapping.

src/js/core/firebase-service.js : Chemins hiérarchiques et fonctions de base.

src/js/ui/prof/activities.js : Gestion des activités, transmission, purge, logique des sous-onglets (switchActivitySubTab).

src/js/ui/prof/layout.js : Navigation entre les onglets (Admin, Activités, Outils) - Attention aux bugs d'affichage style.display.

src/js/modules/escalade/escalade-interface.js : Grille Escalade (attention aux instances Sortable : el.__sortable doit contenir l'instance réelle, pas un booléen).

src/js/modules/arcathlon/arcathlon-kiosk.js : Interface élève Arcathlon (flux complexe, ne pas modifier sans comprendre les transitions automatiques).

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

9. Astuces de débogage
Connexion grise/rouge : Vérifier la console (F12) pour l'erreur SyntaxError ou ReferenceError. Le problème vient souvent d'un import manquant ou d'un chemin Firebase incorrect.

Photos manquantes dans le Live : Vérifier que le localMapping est bien au format plat ({"504_A1": "ID"}) et que getEleveIdFromCode cherche la bonne clé.

Glisser-déposer cassé : Vérifier que initEscaladeInterface détruit bien les anciennes instances el.__sortable (avec destroy()) avant de recréer les colonnes.

Page blanche sur l'onglet Activités : Vérifier qu'aucune erreur dans app.js (imports cassés) et surtout que layout.js n'utilise PAS style.display = 'none' sur les vues principales.

Fiche élève vide ("Aucun match joué") : C'est un bug de type de données ! Utiliser String(m.terrain) === String(terrain) au lieu de m.terrain === terrain, car Firebase peut stocker le terrain comme un nombre (1) alors que le JavaScript le lit comme une chaîne ("1") dans les boucles.

Bug d'initialisation : Ajouter window.switchDiscipline('multi'); à la toute fin de initActivities() pour que l'onglet soit correctement affiché au chargement.

Logs pour déboguer Arcathlon : Activer les console.log dans arcathlon-kiosk.js pour suivre le flux : onGiantAction, startCourse, finishCourse, finishTir, terminerSerie, savePassage.

10. Glossaire Arcathlon
Série : Un bloc composé de Course → Tir → Pénalités (éventuelles).

Grande boucle : La course de la série (distance = distanceTotale).

Petite boucle : Un tour de pénalité (distance = longueurPenalite).

Course finale : Dernière course sans tir ni pénalité, déclenchée automatiquement après la dernière série.

Temps de phase : Temps écoulé dans la phase en cours (course, tir, pénalité).

Temps total épreuve : Temps cumulé depuis le début de la première série.

Vitesse : Calculée uniquement sur la grande boucle (distanceCourse / tempsCourse).

Handicap : Délai de départ (en ms) appliqué au début de la première course (utilisé en mode « poursuite »).