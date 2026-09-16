## 1. Vue d'ensemble

**EPS-Arena** est une application web progressive (PWA) destinée aux professeurs
d'EPS pour gérer leurs classes, évaluer leurs élèves, organiser leurs activités
sportives et piloter des kiosks élèves sur tablettes (iPads).

**Aucune installation.** C'est une webapp statique (HTML/CSS/JS) qui communique
avec Firebase Realtime Database pour la synchronisation temps réel prof ↔ élèves.

**Public cible** : un professeur d'EPS qui veut :

- Gérer ses classes et ses élèves sur son appareil (données locales)
- Évaluer les aptitudes physiques (Luc Léger, saut, sprint…)
- Organiser des séances sportives avec un iPad kiosk en salle
- Piloter un cross d'établissement
- Exporter vers iDoceo / Excel

---

## 2. Principes non négociables

Ces règles sont **fondatrices**. Toute contribution doit les respecter.

### 2.1 RGPD — séparation stricte local / cloud

**Ce qui reste UNIQUEMENT sur l'appareil du professeur (localStorage + IndexedDB)** :
- Noms, prénoms, dates de naissance, sexes des élèves
- Photos
- Notes, évaluations détaillées, bilans nominatifs
- Toute donnée identifiant un élève

**Ce qui peut transiter vers Firebase** :
- Codes anonymes : lettres (`A1`, `B2`), numéros de dossard, codes auto-éval
- Résultats bruts sans lien nominatif
- Statuts non identifiants (`present`, `absent`, `inapte`)
- Configurations de séances

**Règle d'or** : un élève ne doit JAMAIS être identifiable par ce qui transite
sur le réseau. Les kiosks élèves reçoivent des codes, jamais des noms.

### 2.2 Local-first

Le professeur doit pouvoir travailler **sans connexion** pour tout ce qui ne
nécessite pas de synchronisation temps réel : gestion des élèves, évaluation,
génération de groupes. Firebase n'est là que pour le **temps réel** (kiosks,
live, transmission).

### 2.3 Modularité

Chaque activité sportive est un **module autonome** dans `src/js/modules/`.
Un module expose une interface standard :

```js
{
  id: 'escalade',
  label: '🧗 Escalade',
  initProf,      // (classe) → initialise l'UI prof
  initKiosk,     // (classe, code) → initialise le kiosk élève
  generateTeams, // (classe) → génère les équipes
  transmettre,   // (classe) → envoie la config sur Firebase
  renderLive,    // (classe) → affiche le live prof
  renderTV,      // (classe) → affiche le mode TV
  isDefault      // true = module actif par défaut
}
Les modules s'enregistrent via registerModule() (src/js/modules/registry.js).

2.4 Pas de dépendance npm
Tout est chargé par CDN dans maitre.html / eleve.html :

Tailwind CSS (styles)

PapaParse (CSV)

JSZip (ZIP photos)

Sortable.js (drag & drop)

Chart.js (graphiques)

SheetJS (Excel, local dans libs/)

QRCode.js (QR codes kiosks)

Pas de bundler, pas de TypeScript, pas de Webpack. Du ES6 modules natifs.

3. Architecture technique
3.1 Points d'entrée
Fichier	Rôle	Utilisateur
maitre.html	Interface professeur complète	Prof sur PC
eleve.html	Kiosk élève (paramétrable par URL)	Élève sur iPad
manifest.json	PWA manifest	iOS/Android
3.2 Structure des dossiers
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
        │   │       badminton-export.js
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
        │   ├───cross
        │   │       cross-config.js
        │   │       cross-core.js
        │   │       cross-course.js
        │   │       cross-import.js
        │   │       cross-interface.js
        │   │       cross-kiosk.js
        │   │       cross-prep.js
        │   │       cross-scan.js
        │   │       cross-transmit.js
        │   │       index.js
        │   │       
        │   ├───demi-fond
        │   │   │   demifond-common.js
        │   │   │   demifond-interface.js
        │   │   │   demifond-kiosk.js
        │   │   │   demifond-live.js
        │   │   │   demifond-tv.js
        │   │   │   index.js
        │   │   │   
        │   │   └───variantes
        │   │       └───trois-cinq-min
        │   │               index.js
        │   │               trois-cinq-min-bilan.js
        │   │               trois-cinq-min-core.js
        │   │               trois-cinq-min-interface.js
        │   │               trois-cinq-min-kiosk.js
        │   │               trois-cinq-min-live.js
        │   │               trois-cinq-min-tv.js
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
        │   │           demi-fond.js
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
        │   ├───ppg
        │   │       index.js
        │   │       ppg-core.js
        │   │       ppg-export.js
        │   │       ppg-interface.js
        │   │       ppg-kiosk.js
        │   │       ppg-live.js
        │   │       ppg-tv.js
        │   │       
        │   ├───relais
        │   │   │   index.js
        │   │   │   relais-core.js
        │   │   │   relais-export.js
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
        │       │   tournoi-export.js
        │       │   tournoi-prof.js
        │       │   tournoi-registry.js
        │       │   
        │       └───variantes
        │           ├───atp
        │           │       atp-core.js
        │           │       atp-kiosk.js
        │           │       atp-live.js
        │           │       atp-prof.js
        │           │       atp-tv.js
        │           │       index.js
        │           │       
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
        │       sync-service.js
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



text
/src/js/
├── app.js                  → point d'entrée prof
├── config/                 → constantes, Firebase config, barèmes
├── core/                   → services techniques (Firebase, state, live)
├── modules/                → modules sportifs (1 par activité)
├── services/               → services transverses (import, export, sync)
├── ui/                     → interfaces (prof / eleve / layout)
└── utils/                  → utilitaires génériques
3.3 Structure Firebase
Toutes les données sont sous :

text
etablissements/{RNE}/profs/{profCode}/{classe}/{activite}/...
RNE = code établissement (codé en dur : 0680013V)

profCode = nom du prof en majuscules (MARTIN, DUPONT) → isolation
automatique entre utilisateurs

classe = code de classe (ex : 301, 507)

activite = identifiant du module (escalade, cross, natation…)

Point critique : le profCode crée une branche isolée. Un inspecteur qui
tape DUPONT ne voit que profs/DUPONT/... et est totalement isolé.

3.4 Champs sensibles à ne PAS pousser sur Firebase
Champ local	Sur Firebase ?
nom	❌ jamais
prenom	❌ jamais
dateNaissance	❌ jamais
photo (URL)	❌ jamais
id (élève)	❌ jamais
dossard	✅ oui
classe	✅ oui
sexe	✅ oui
vma	✅ oui
statut	✅ oui
Si une fonction pousse nom ou prenom sur Firebase, c'est un bug RGPD.

4. Conventions de code
4.1 Langue
Code : anglais pour les identifiants (getEleves, renderPodium)

Commentaires : français

Interface utilisateur : français, tutoiement (le prof est un utilisateur
quotidien, on peut être familier)

4.2 Style
Indentation : 4 espaces

Guillemets : simples '...' sauf si contient une apostrophe

Point-virgules : oui

Fonctions : camelCase

Constantes : UPPER_SNAKE_CASE

Noms de fichiers : kebab-case (ex : cross-core.js)

4.3 Gestion des erreurs
try / catch pour tout appel Firebase ou parsing

console.error pour les erreurs techniques

afficherToast() (dans chaque module) pour les erreurs UX

Jamais d'alert() pour signaler une erreur métier — un toast suffit

4.4 Stockage local
localStorage : données structurées (élèves, config, statuts)

Toujours préfixer par eps_arena_

Exemple : eps_arena_eleves_301, eps_arena_cross_dossards

IndexedDB : photos (EPS_Arena_LocalDB)

4.5 Nommage des modules
Chaque module respecte ces fichiers types :

text
modules/mon-module/
├── index.js                  → registerModule()
├── mon-module-core.js        → logique pure, testable
├── mon-module-interface.js   → UI prof
├── mon-module-kiosk.js       → UI élève (si applicable)
├── mon-module-live.js        → vue live prof
├── mon-module-tv.js          → vue TV
├── mon-module-export.js      → export Excel/iDoceo
└── mon-module-config.js      → storage keys, helpers
Tous les fichiers ne sont pas obligatoires. Un module minimal a index.js +
core.js + interface.js.

5. Les 11 modules sportifs
Module	État	Kiosk	Notes
multi	✅	✅	Multi-activités avec équipes
co	✅	✅	Course d'orientation (Classique + OrientShow)
escalade	✅	✅	Classique + Bloc Contest
badminton	✅	✅	Terrain + Avec la manière
arcathlon	✅	✅	Sprint, Poursuite, Relais
evaluation	✅	❌	Luc Léger, saut, sprint (prof only)
tournoi	✅	✅	Élimination + ATP
natation	✅	✅	Indice de nage
relais	✅	✅	Relais 10s + 2 zones
demi-fond	✅	✅	3×5min R=3'
ppg	✅	✅	Programme personnalisé
cross	✅	✅	Nouveau — voir section 6
grilles	✅	✅	Auto-évaluation par grilles
teams	✅	❌	Génération d'équipes transversale
6. Le module Cross (nouveau)
6.1 Objectif
Gérer un cross d'établissement de 700+ élèves répartis en 4 courses :

Course	Public	Distance
course1	Filles 6e + 5e	2400 m annoncés (2500 m contrat)
course2	Garçons 6e + 5e	idem
course3	Filles 4e + 3e	idem
course4	Garçons 4e + 3e	idem
6.2 Barème (note /20)
Motricité /13 : basée sur le %VMA tenu (palier max atteint dès 75 %)

Performance /7 : basée sur le rang en % du peloton

Le %VMA est calculé sur 2500 m (formule : (2500 × 3.6) / (temps_s × VMA)).

6.3 Classement par classe
Moyenne des rangs dans la catégorie (rang parmi les 6e, rang parmi les 5e)

Plus petit = meilleur

Exclus : absents, inaptes, abandons

Compteur de transparence affiché

6.4 Fichiers du module
text
modules/cross/
├── index.js               → registerModule()
├── cross-core.js          → moteur pur (barème, calculs, classements)
├── cross-config.js        → storage keys, chemins Firebase
├── cross-import.js        → import CSV établissement + Excel dossards
├── cross-prep.js          → onglet Préparation
├── cross-course.js        → onglet Course (GO + scan)
├── cross-transmit.js      → transmission Firebase (RGPD)
├── cross-kiosk.js         → kiosks paramétrables par URL
├── cross-scan.js          → gestion douchette USB
├── cross-interface.js     → sélecteur d'onglet interne
└── cross-dossards-pdf.js  → génération PDF dossards (à venir)
6.5 URLs des kiosks
Les URL sont générées avec QR codes dans l'onglet Cross → Course → Diffusion :

text
eleve.html?mode=cross-podium&course=course1&prof=DUPONT
eleve.html?mode=cross-classement&course=course1&prof=DUPONT
eleve.html?mode=cross-classe&prof=DUPONT
eleve.html?mode=cross-consult&course=course1&prof=DUPONT
eleve.html?mode=cross-clic&course=course1&prof=DUPONT
6.6 Structure Firebase Cross
text
profs/{profCode}/cross/
├── config/
│   ├── courses/       → array des 4 courses
│   ├── eleves/        → { dossard: { classe, sexe, vma, statut } }  ← RGPD OK
│   └── meta/          → { dateTransmission, nbEleves, nbClasses }
└── courses/
    ├── course1/
    │   ├── go/        → { timestamp, profCode }
    │   ├── arrivees/  → { pushId: { dossard, timestamp, source } }
    │   └── clics/     → { pushId: { timestamp } }
    └── ...
Aucun nom, aucun prénom dans cette structure.

6.7 Contraintes spécifiques
Distance contrat = 2500 m (pour le calcul %VMA)

Distance affichée = 2400 m (sur le dossard)

Distance réelle = ~2300 m (terrain)

Rang calculé par niveau (les 5e contre les 5e, les 6e contre les 6e)

Deux podiums par course (un par niveau)

Enchaînement des courses : séquentiel tolérant (on peut lancer la course
suivante avant la fin de la précédente, manuellement)

6.8 Dossards
Format : EAN-13 (12 chiffres + clé de contrôle)

Association dossard → eleveId stockée localement (eps_arena_cross_dossards)

Le scan reçoit une chaîne, on normalise pour trouver le dossard (voir
normaliserScan() dans cross-core.js)

7. Services transverses
7.1 admin-service.js
Gestion des élèves (getExistingEleves, saveEleves)

Photos (IndexedDB via getPhotoUrl, savePhoto)

Import ZIP photos et CSV iDoceo

Codes auto-éval (codeAutoEval) — entiers 1, 2, 3… uniques par classe

7.2 export-service.js
Export Excel multi-feuilles (exporterVersExcel)

Export CSV iDoceo (exporterVersIDoceo)

Colonnes typées (col(label, cle))

7.3 sync-service.js
Export/import de tout le localStorage en un fichier JSON

Exclut eps_arena_profCode (chaque appareil garde le sien)

Utilisé pour transférer PC ↔ iPad via Nextcloud

7.4 live-engine.js
Centralise les listeners Firebase pour les données temps réel

Expose getCurrentClasse(), getStudentsMap(), getNomFromCode()

8. Comment travailler sur ce projet (instructions IA)
8.1 Avant de coder
Relire la section 2 (principes). Si une idée viole le RGPD, la refuser.

Chercher l'existant. Une fonction similaire existe probablement déjà
dans un autre module — ne pas réinventer.

Identifier le module concerné. Ne pas mettre de logique sportive dans
core/ ou services/.

Vérifier les conventions de la section 4.

8.2 Pendant qu'on code
Ne jamais pousser nom, prenom, dateNaissance sur Firebase

Toujours préfixer le localStorage par eps_arena_

Ne pas ajouter de dépendance npm — utiliser un CDN

Ne pas introduire de framework (React, Vue…)

Utiliser les helpers existants (getExistingEleves, afficherToast,
exporterVersExcel…)

Écrire en français dans les commentaires et l'UI

8.3 Choses à ne PAS faire
❌ Créer une nouvelle branche Firebase hors profs/{profCode}/...

❌ Modifier firebase-config.js sans raison (le RNE est fixé)

❌ Utiliser eval(), innerHTML avec du contenu non maîtrisé

❌ Mélanger logique métier et DOM dans le même fichier

❌ Casser les URLs des kiosks existants (rétrocompatibilité)

8.4 Tester
Pas de framework de test. Les tests se font en console :

js
import('./src/js/modules/cross/cross-core.js').then(m => {
    console.log(m.calculerNoteEleve({ tempsSec: 1234, vma: 12, rang: 47, nbArrivants: 100 }));
});
Les fonctions pures (*-core.js) sont conçues pour ça.

9. Fichiers sensibles
Fichier	Sensibilité	Pourquoi
firebase-service.js	🔴 Élevée	Toutes les règles RGPD passent ici
admin-service.js	🔴 Élevée	Manipule les données élèves
sync-service.js	🟠 Moyenne	Exporte tout le localStorage
cross-transmit.js	🔴 Élevée	Frontière RGPD
*-kiosk.js	🟠 Moyenne	Ce que voient les élèves
firebase-config.js	🟠 Moyenne	RNE + config Firebase
Toute modification sur ces fichiers doit être revue avant commit.

10. Ressources utiles
Firebase
Console : https://console.firebase.google.com/project/eps-arena

Structure : etablissements/0680013V/profs/{profCode}/...

Bibliothèques CDN
Tailwind : https://cdn.tailwindcss.com

PapaParse : https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.2/papaparse.min.js

JSZip : https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js

Sortable : https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js

Chart.js : https://cdn.jsdelivr.net/npm/chart.js

QRCode : https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js

SheetJS : local, libs/xlsx.full.min.js

Codes de classe
Format : 3XX (3e), 4XX (4e), 5XX (5e), 6XX (6e) où XX = A, B, C…
Le premier chiffre indique le niveau.

11. Historique des modifications
Date	Version	Changements
2024	0.x	Démarrage du projet, modules Escalade, CO, Multi
2025	0.5	Ajout Badminton, Natation, PPG, Relais, Tournoi, Demi-fond
2025	0.8	Ajout Grilles, module Évaluation
2026	1.0	Ajout module Cross avec kiosks podium, consultation
2026	1.1	QR codes des kiosks, transmission RGPD
12. En cas de doute
RGPD : en cas de doute, ne rien envoyer sur Firebase. On peut toujours
ajouter un canal plus tard.

Architecture : suivre le modèle d'un module existant. Ne pas innover sans
raison.

UX : penser iPad kiosk (grands boutons, peu de texte, tactile).

Performance : le prof peut avoir 30 classes × 25 élèves = 750 élèves.
Utiliser des Map / Set, filtrer avant de boucler.

Fin du guide. Pour toute question, contacter le mainteneur du projet.