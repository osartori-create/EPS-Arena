Si vous ouvrez une nouvelle discussion, il suffira de dire :
> *"Bonjour, je travaille sur EPS-Arena. Voici le contenu de mon GUIDE_IA.md : [collez le contenu]. Je veux ajouter [votre demande]."*

## 1. Description du projet
Application web EPS (Éducation Physique et Sportive) pour gérer des activités sportives en classe via des iPads. Deux interfaces principales : le Professeur (`maitre.html`) et l'Élève (`eleve.html`). L'application est **100% RGPD** : aucun nom ou photo d'élève ne doit être présent dans Firebase.

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
        │   ├───badminton
        │   │   │   badminton-interface.js (Configuration des terrains - Prof)
        │   │   │   badminton-kiosk.js (Interface élève - Module "Impacts")
        │   │   │   badminton-live.js (Live Prof - Photos, classement)
        │   │   │   badminton-stats.js (Fiche élève modifiable)
        │   │   │   badminton-tv.js (Affichage plein écran TV)
        │   │   │       
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
Activite : Ex: "escalade", "co", "multi".
Config : etablissements/0680013V/profs/{codeProf}/{classe}/config (contient uniquement des nombres, ex: {A: 3, B: 2, activite: "escalade"}).
Active Classes : etablissements/0680013V/profs/{codeProf}/active_classes (contient les classes actives, ex: {504: true, 305: true}).
Structure spécifique au Badminton (Module Impacts) :

text
Badminton Config : etablissements/0680013V/profs/{codeProf}/{classe}/config (ex: {1: 5, 2: 4, activite: "badminton"})
Badminton Results : etablissements/0680013V/profs/{codeProf}/{classe}/badminton/results
RÈGLE STRICTE : Uniquement des codes et des nombres transitent sur Firebase. Aucun nom, prénom ou ID pseudonymisé (ex: BIANCHI_P) ne doit y figurer !

4. Mapping Local (RGPD - Stockage local)
Les noms et les photos sont liés aux codes uniquement via le localStorage du navigateur du Professeur.

Format du mapping : Objet plat, ex: {"504_A1": "BIANCHI_P", "504_A2": "DASILVALOUREIRO_T"}.

Format spécifique au Badminton :

text
{"504_1_A": "IDélève", "504_1_B": "IDélève"} (Clé : Classe_Terrain_Lettre)
Fichier clé : src/js/core/live-engine.js (fonctions getEleveIdFromCode, getNomFromCode, getPhotoHtml).

Où est stocké le mapping ? : localStorage.getItem('eps_arena_local_mapping_{classe}').

Important : Le mapping est créé lors de la Transmission (transmettreConfig) et stocké UNIQUEMENT sur l'appareil du professeur.

5. Conventions de code
Modulaire ES6 : Utilisation d'import et export.

Fonctions globales : Les fonctions appelées par les boutons HTML (onclick) sont exposées sur window (ex: window.transmettreConfig, window.generateTeams).

Calcul des points escalade : Centralisé dans src/js/modules/escalade/escalade-calculations.js (fonctions calculateClimbingPoints et coeffToCotation). Ne jamais dupliquer ce calcul !

Nouvelles conventions (Badminton, Live, TV) :

Imports dynamiques : Les modules Live et TV sont chargés dynamiquement via import('...') (ex: import('../../modules/badminton/badminton-live.js')) pour éviter de faire planter toute l'application si un module spécifique a une erreur. Le routage se fait via renderLive(discipline) ou switchActivitySubTab().

Masquage des vues : Ne JAMAIS utiliser el.style.display = 'none' pour cacher les vues standard (cela écrase la classe hidden de Tailwind et rend la page blanche). Utiliser uniquement classList.add('hidden').

Comparaison de données : Toujours utiliser String(...) ou parseInt(...) lors de la comparaison de données Firebase (car les types peuvent différer : nombre vs chaîne).

6. Modules existants et fonctionnalités clés
Escalade : Module le plus complet.

escalade-interface.js : Grille A, B, C... (nombre de groupes dynamique basé sur les élèves ÷ 3, ou sur la sauvegarde JSON).

escalade-live.js : Rendu du Live + clic sur élève pour ouvrir le bilan (nombre de montées, distance, difficulté moyenne en cotation, etc.).

escalade-tv-ui.js : Rendu de la Montagne pour l'onglet TV (ordre alphabétique horizontal, hauteur verticale proportionnelle aux points).

Badminton (Module "Impacts") :

badminton-kiosk.js (Élève) : Terrain 3D, sélection de matchs, Round Robin, saisie des impacts (stats % bonus).

badminton-live.js (Prof) : Grille de cartes par terrain, photos, classement (Victoire = 3pts / Défaite = 1pt), fiche élève modifiable (Stats).

badminton-tv.js (TV) : Affichage plein écran avec photos et podium.

Barème : Victoire = 3pts, Défaite = 1pt. (À changer dans les 3 fichiers si souhaité : kiosk, live, tv)

Navigation restructurée :

Onglets principaux : Administration, Activités, Outils.

Le Live et la TV sont maintenant des SOUS-ONGLETS dans l'onglet Activités (sélecteur "Réglages / Live / TV").

Le professeur choisit son activité (ex : Badminton), puis clique sur le sous-onglet Live ou TV pour voir les résultats.

7. Fichiers critiques à NE PAS casser
src/js/core/live-engine.js : Cœur de l'écoute et du mapping.

src/js/core/firebase-service.js : Chemins hiérarchiques et fonctions de base.

src/js/ui/prof/activities.js : Gestion des activités, transmission, purge, logique des sous-onglets (switchActivitySubTab).

src/js/ui/prof/layout.js : Navigation entre les onglets (Admin, Activités, Outils) - Attention aux bugs d'affichage style.display.

src/js/modules/escalade/escalade-interface.js : Grille Escalade (attention aux instances Sortable : el.__sortable doit contenir l'instance réelle, pas un booléen).

src/js/modules/badminton/badminton-live.js : Le Live Badminton ne doit pas être importé statiquement, mais dynamiquement.

src/js/modules/badminton/badminton-stats.js : Ne doit pas être importé directement dans live.js, car il dépend de la sélection de l'élève (import dynamique requis).

8. Astuces de débogage
Connexion grise/rouge : Vérifier la console (F12) pour l'erreur SyntaxError ou ReferenceError. Le problème vient souvent d'un import manquant ou d'un chemin Firebase incorrect.

Photos manquantes dans le Live : Vérifier que le localMapping est bien au format plat ({"504_A1": "ID"}) et que getEleveIdFromCode cherche la bonne clé.

Glisser-déposer cassé : Vérifier que initEscaladeInterface détruit bien les anciennes instances el.__sortable (avec destroy()) avant de recréer les colonnes.

Pièges récents à éviter :

Page blanche sur l'onglet Activités : Vérifier qu'aucune erreur dans app.js (imports cassés) et surtout que layout.js n'utilise PAS style.display = 'none' sur les vues principales.

Fiche élève vide ("Aucun match joué") : C'est un bug de type de données ! Utiliser String(m.terrain) === String(terrain) au lieu de m.terrain === terrain, car Firebase peut stocker le terrain comme un nombre (1) alors que le JavaScript le lit comme une chaîne ("1") dans les boucles.

Bug d'initialisation : Ajouter window.switchDiscipline('multi'); à la toute fin de initActivities() pour que l'onglet soit correctement affiché au chargement