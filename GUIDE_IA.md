Si vous ouvrez une nouvelle discussion, il suffira de dire :
> *"Bonjour, je travaille sur EPS-Arena. Voici le contenu de mon GUIDE_IA.md : [collez le contenu]. Je veux ajouter [votre demande]."*



## 1. Description du projet
Application web EPS (Éducation Physique et Sportive) pour gérer des activités sportives en classe via des iPads. Deux interfaces principales : le Professeur (`maitre.html`) et l'Élève (`eleve.html`). L'application est **100% RGPD** : aucun nom ou photo d'élève ne doit être présent dans Firebase.

## 2. Architecture des dossiers (Exhaustive)
```text
C:.
|   eleve.html
|   eleve_ancien.html
|   GUIDE_IA.md
|   icon.svg
|   maitre.html
|   maitre_ancien.html
|   manifest.json
|   
\---src
    |   index.html
    |   
    +---css
    |       style.css
    |       
    \---js
        |   app.js
        |   
        +---config
        |       constants.js
        |       firebase-config.js
        |       index.js
        |       
        +---core
        |       firebase-service.js
        |       index.js
        |       live-engine.js
        |       state.js
        |       
        +---modules
        |   |   index.js
        |   |   
        |   +---co
        |   |       circuit-manager.js
        |   |       co-interface.js
        |   |       co-live.js
        |   |       matrice.js
        |   |       
        |   +---commun
        |   |       penalite.js
        |   |       timer.js
        |   |       tir.js
        |   |       
        |   +---eleve
        |   |       escalade-kiosk.js
        |   |       orientshow-kiosk.js
        |   |       
        |   +---escalade
        |   |       escalade-calculations.js
        |   |       escalade-controller.js
        |   |       escalade-interface.js
        |   |       escalade-live.js
        |   |       escalade-tv-ui.js
        |   |       
        |   +---multi
        |   |       multi-controller.js
        |   |       multi-live.js
        |   |       
        |   +---orientshow
        |   |       orientshow-interface.js
        |   |       orientshow-live.js
        |   |       orientshow-tv.js
        |   |       
        |   +---poursuite
        |   |       poursuite-controller.js
        |   |       
        |   +---sprint
        |   \---teams
        |           team-generator.js
        |           
        +---services
        |       admin-service.js
        |       index.js
        |       photo-service.js
        |       toast-service.js
        |       
        +---ui

3. Structure Firebase (TRÈS IMPORTANT - RGPD)
Chemin hiérarchique exact :

text
etablissements/0680013V/profs/{codeProf}/{classe}/{activite}/montees
CodeProf : Récupéré depuis localStorage.getItem('eps_arena_profCode') (défaut : DEFAULT).

Classe : Ex: "504", "305".

Activite : Ex: "escalade", "co", "multi".

Config : etablissements/0680013V/profs/{codeProf}/{classe}/config (contient uniquement des nombres, ex: {A: 3, B: 2, activite: "escalade"}).

Active Classes : etablissements/0680013V/profs/{codeProf}/active_classes (contient les classes actives, ex: {504: true, 305: true}).

RÈGLE STRICTE : Uniquement des codes et des nombres transitent sur Firebase. Aucun nom, prénom ou ID pseudonymisé (ex: BIANCHI_P) ne doit y figurer !

4. Mapping Local (RGPD - Stockage local)
Les noms et les photos sont liés aux codes uniquement via le localStorage du navigateur du Professeur.

Format du mapping : Objet plat, ex: {"504_A1": "BIANCHI_P", "504_A2": "DASILVALOUREIRO_T"}.

Fichier clé : src/js/core/live-engine.js (fonctions getEleveIdFromCode, getNomFromCode, getPhotoHtml).

Où est stocké le mapping ? : localStorage.getItem('eps_arena_local_mapping_{classe}').

Important : Le mapping est créé lors de la Transmission (transmettreConfig) et stocké UNIQUEMENT sur l'appareil du professeur.

5. Conventions de code
Modulaire ES6 : Utilisation d'import et export.

Fonctions globales : Les fonctions appelées par les boutons HTML (onclick) sont exposées sur window (ex: window.transmettreConfig, window.generateTeams).

Calcul des points escalade : Centralisé dans src/js/modules/escalade/escalade-calculations.js (fonctions calculateClimbingPoints et coeffToCotation). Ne jamais dupliquer ce calcul !

Écoute des données : live-engine.js écoute les performances (via listenToActivityData) et notifie via des événements window.dispatchEvent(new CustomEvent('live-data-updated', ...)).

6. Modules existants et fonctionnalités clés
Escalade : Module le plus complet.

escalade-interface.js : Grille A, B, C... (nombre de groupes dynamique basé sur les élèves ÷ 3, ou sur la sauvegarde JSON).

escalade-live.js : Rendu du Live + clic sur élève pour ouvrir le bilan (nombre de montées, distance, difficulté moyenne en cotation, etc.).

escalade-tv-ui.js : Rendu de la Montagne pour l'onglet TV (ordre alphabétique horizontal, hauteur verticale proportionnelle aux points).

CO : Réserves + postes (ex: A1, C4) via co-interface.js et matrice.js.

Multi/Sprint : Génération d'équipes via team-generator.js.

7. Fichiers critiques à NE PAS casser
src/js/core/live-engine.js : Cœur de l'écoute et du mapping.

src/js/core/firebase-service.js : Chemins hiérarchiques et fonctions de base.

src/js/ui/prof/activities.js : Gestion des activités, transmission, purge.

src/js/ui/prof/layout.js : Navigation entre les onglets (Admin, Activités, Live, TV).

src/js/modules/escalade/escalade-interface.js : Grille Escalade (attention aux instances Sortable : el.__sortable doit contenir l'instance réelle, pas un booléen).

src/js/modules/escalade/escalade-live.js : Photos + fiche bilan.

src/js/modules/escalade/escalade-tv-ui.js : Rendu TV (conflits évités en ne le chargeant que depuis layout.js ou live.js).

8. Astuces de débogage
Connexion grise/rouge : Vérifier la console (F12) pour l'erreur SyntaxError ou ReferenceError. Le problème vient souvent d'un import manquant ou d'un chemin Firebase incorrect.

Photos manquantes dans le Live : Vérifier que le localMapping est bien au format plat ({"504_A1": "ID"}) et que getEleveIdFromCode cherche la bonne clé.

Glisser-déposer cassé : Vérifier que initEscaladeInterface détruit bien les anciennes instances el.__sortable (avec destroy()) avant de recréer les colonnes.



