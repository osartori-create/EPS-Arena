# EPS-Arena — Guide IA

## 1. Vue d'ensemble

**EPS-Arena** est une PWA statique (HTML/CSS/JS + Firebase Realtime Database)
pour les professeurs d'EPS. Aucune installation, aucun build, aucun framework.

**Public cible** : un prof d'EPS qui gère ses classes, évalue ses élèves,
organise des séances (avec kiosks iPad) et pilote un cross d'établissement.

**Deux points d'entrée** :
- `maitre.html` — interface professeur (PC)
- `eleve.html` — kiosk élève (iPad, paramétrable par URL)
- `manifest.json` — PWA

---

## 2. Principes non négociables

### 2.1 RGPD — séparation stricte local / cloud

**Uniquement en local (localStorage + IndexedDB)** :
- Noms, prénoms, dates de naissance, sexes, photos
- Notes, évaluations, bilans nominatifs
- Toute donnée identifiant un élève

**Peut transiter vers Firebase** :
- Codes anonymes (`A1`, dossards, codes auto-éval)
- Résultats bruts sans lien nominatif
- Statuts (`present`, `absent`, `inapte`)
- Configurations de séances

**Règle d'or** : un élève ne doit JAMAIS être identifiable par ce qui
circule sur le réseau.

### 2.2 Local-first

Le prof doit pouvoir travailler sans connexion pour tout ce qui ne
nécessite pas de temps réel (élèves, évaluations, groupes).
Firebase n'est là que pour la **synchronisation temps réel**.

### 2.3 Modularité

Chaque activité est un **module autonome** dans `src/js/modules/`.
Interface standard exposée via `registerModule()` :

```js
{
  id, label, icon,
  initProf(classe), initKiosk(classe, code),
  generateTeams(classe), transmettre(classe),
  renderLive(classe), renderTV(classe),
  isDefault, cleanup
}
2.4 Pas de dépendance npm
Tout est chargé par CDN dans maitre.html / eleve.html :
Tailwind, PapaParse, JSZip, Sortable.js, Chart.js, QRCode.js,
jsPDF, JsBarcode. SheetJS en local (libs/xlsx.full.min.js).

ES6 modules natifs, pas de bundler, pas de TypeScript.

3. Architecture
3.1 Arborescence
text
/src/js/
├── app.js                  → point d'entrée prof
├── config/                 → constantes, Firebase config, barèmes
├── core/                   → Firebase, state, live-engine
├── modules/                → modules sportifs (1 par activité)
├── services/               → admin, import, export, sync, toast
├── ui/                     → layouts et interfaces
└── utils/                  → helpers génériques
3.2 Structure Firebase
text
etablissements/0680013V/profs/{profCode}/{classe}/{activite}/...
RNE = 0680013V (codé en dur)

profCode = nom du prof en majuscules → isolation totale entre profs

classe = code de classe (301, 506, 608…)

activite = identifiant de module

Le profCode crée une branche isolée : un autre prof ne voit rien.

3.3 Champs sensibles
Champ local	Sur Firebase ?
nom, prenom	❌ jamais
dateNaissance, photo, id	❌ jamais
dossard, classe, sexe, vma, statut	✅ oui
Pousser nom ou prenom sur Firebase = bug RGPD.

4. Conventions de code
Langue : code en anglais, commentaires et UI en français (tutoiement)

Indentation : 4 espaces

Guillemets : simples '...' (sauf apostrophe → backticks)

Point-virgules : oui

Nommage : camelCase (fonctions), UPPER_SNAKE_CASE (constantes),
kebab-case (fichiers)

localStorage : toujours préfixé eps_arena_*
(ex: eps_arena_eleves_301, eps_arena_cross_dossards)

IndexedDB : EPS_Arena_LocalDB (photos)

Erreurs : try/catch pour Firebase, afficherToast() pour l'UX
(jamais alert() pour une erreur métier)

5. Les modules sportifs
Module	Kiosk	Notes
multi	✅	Multi-activités avec équipes
co	✅	CO classique + OrientShow
escalade	✅	Classique + Bloc Contest
badminton	✅	Terrain + Avec la manière
arcathlon	✅	Sprint, Poursuite, Relais
evaluation	❌	Luc Léger, saut, sprint (prof only)
tournoi	✅	Élimination + ATP
natation	✅	Indice de nage
relais	✅	Relais 10s + 2 zones
demi-fond	✅	3×5min R=3' + Enchaînement (séries à durées libres)
ppg	✅	Programme personnalisé
cross	✅	Voir section 6
grilles	✅	Auto-évaluation par grilles
teams	❌	Génération d'équipes transversale
6. Le module Cross
6.1 Objectif
Gérer un cross d'établissement (700+ élèves, 4 courses).

Course	Public
course1	6e + 5e Filles
course2	6e + 5e Garçons
course3	4e + 3e Filles
course4	4e + 3e Garçons
6.2 Barème (note /20)
Motricité /13 : %VMA tenu sur 2500 m (distance contrat).
Formule : (2500 × 3.6) / (temps_s × VMA) × 100

Performance /7 : rang en % du peloton de sa catégorie

6.3 Classement par classe
Moyenne des rangs catégorie (plus petit = meilleur), avec rangs séparés
Filles / Garçons. Exclus : absents, inaptes, abandons.

6.4 Structure Firebase Cross
text
profs/{profCode}/cross/
├── config/
│   ├── courses/     → array des 4 courses
│   ├── eleves/      → { dossard: { classe, sexe, vma, statut } }  ← RGPD OK
│   └── meta/        → { dateTransmission, nbEleves, nbClasses }
└── courses/
    ├── course1/
    │   ├── go/             → { timestamp, profCode }
    │   ├── arrivees/       → { pushId: { dossard, timestamp, source } }
    │   ├── clics/          → { pushId: { timestamp } }
    │   └── modifications/  → { dossard: { tempsModifie, penaliteSecondes,
    │                          penalitePoints, statut, commentaire } }
    └── ...
Aucun nom, aucun prénom dans cette structure.

6.5 URLs des kiosks
text
eleve.html?mode=cross-podium&course=course1&prof=DUPONT
eleve.html?mode=cross-classement&course=course1&prof=DUPONT
eleve.html?mode=cross-classe&prof=DUPONT
eleve.html?mode=cross-consult&course=course1&prof=DUPONT
eleve.html?mode=cross-clic&course=course1&prof=DUPONT
6.6 Dossards
Format EAN-13 (12 chiffres + clé de contrôle)

generateEan13(numero) produit le code complet

Le scan reçoit une chaîne, on la normalise via normaliserScan()
(gère les zéros de tête perdus, les clés de contrôle, etc.)

Douchette USB PC uniquement (module cross-scan.js)

Les dossards sont imprimés par cross-dossards.js (jsPDF + JsBarcode)

A4 portrait, 2 dossards paysage empilés

Pictogramme 🏃 si VMA ≥ 12

Contrat calculé (temps cible à 80 % VMA)

6.7 Modifications prof
Le prof peut, sur chaque élève :

Modifier son temps manuellement

Ajouter une pénalité (temps en secondes ou points sur /20)

Déclarer un abandon ou une blessure (exclu du classement)

Ajouter un commentaire

Les modifications sont stockées séparément des arrivées brutes
(traçabilité conservée). Fonctions dans cross-modifications.js.

6.8 Signalétique sonore (scan)
Trois sons distincts via Web Audio API :

Scan valide : bip aigu court (1400 Hz)

Erreur de catégorie (mauvais sexe/niveau) : alarme 2 tons × 3

Dossard inconnu / doublon / absent : bip grave (220 Hz)

6.9 Export Excel
Un fichier .xlsx avec 6 feuilles :

1 feuille par course (rang, temps, %VMA, points, statut, commentaire)

Classement par classe (rang moyen global, Filles, Garçons)

Notes moyennes par classe

7. Services transverses
admin-service.js : élèves, photos (IndexedDB), codes auto-éval

export-service.js : Excel multi-feuilles, CSV iDoceo

sync-service.js : export/import complet du localStorage (JSON)

import-service.js : import CSV iDoceo

live-engine.js : listeners Firebase centralisés

toast-service.js : notifications UX

8. Instructions IA
Avant de coder
Relire la section 2 (principes). Refuser toute idée qui viole le RGPD.

Chercher l'existant — une fonction similaire existe probablement déjà.

Identifier le bon module — pas de logique sportive dans core/ ou services/.

Vérifier les conventions de la section 4.

Pendant
❌ Jamais nom, prenom, dateNaissance sur Firebase

❌ Jamais de dépendance npm — utiliser un CDN

❌ Jamais de framework (React, Vue…)

❌ Jamais de nouvelle branche Firebase hors profs/{profCode}/

❌ Jamais eval() ni innerHTML avec du contenu non maîtrisé

✅ Préfixer tout localStorage par eps_arena_

✅ Utiliser les helpers existants (getExistingEleves, afficherToast,
exporterVersExcel, migrerCodesAutoEval…)

✅ Commentaires et UI en français

Tester
Pas de framework de test. Tests en console :

js
import('./src/js/modules/cross/cross-core.js').then(m => {
    console.log(m.calculerNoteEleve({ tempsSec: 1234, vma: 12, rang: 47, nbArrivants: 100 }));
});
Les fonctions pures (*-core.js) sont conçues pour ça.

9. Fichiers sensibles
Fichier	Sensibilité	Pourquoi
firebase-service.js	🔴 Élevée	Toutes les règles RGPD
admin-service.js	🔴 Élevée	Données élèves
sync-service.js	🟠 Moyenne	Exporte tout le localStorage
cross-transmit.js	🔴 Élevée	Frontière RGPD
*-kiosk.js	🟠 Moyenne	Ce que voient les élèves
firebase-config.js	🟠 Moyenne	RNE + config Firebase
Toute modification sur ces fichiers doit être revue avant commit.

10. Ressources
Firebase : console https://console.firebase.google.com/project/eps-arena
Structure : etablissements/0680013V/profs/{profCode}/...

CDN utilisés :

Tailwind, PapaParse, JSZip, Sortable.js, Chart.js

QRCode.js, jsPDF, JsBarcode

SheetJS (local)

Codes de classe : format 3XX (3e), 4XX (4e), 5XX (5e), 6XX (6e).
Le premier chiffre indique le niveau.

11. Historique
Version	Changements
0.x	Démarrage : Escalade, CO, Multi
0.5	Badminton, Natation, PPG, Relais, Tournoi, Demi-fond
0.8	Grilles, Évaluation
1.0	Cross : kiosks, podium, consultation
1.1	QR codes des kiosks, transmission RGPD
1.2	Dossards PDF, import CSV, signaux sonores, modifications prof, export Excel