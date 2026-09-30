# EPS-Arena

Application web d'**EPS** pour animer les séances en temps réel et consolider les résultats des élèves, conçue pour être **simplement partagée entre enseignants**.

- **Temps réel pendant la séance** : un kiosk élève (tablette/iPad) envoie un clic ou une mesure, et l'affichage TV, le Live prof et les bilans se mettent à jour quasi instantanément sur tous les appareils.
- **Archivage long terme** : les résultats consolidés (indices de nage, vitesses, classements, badges…) peuvent être exportés et archivés dans **Grist**.
- **Zéro serveur à gérer** : l'application est 100 % frontend (JavaScript vanilla, modules ES) et s'appuie sur des services managés.

---

## 📦 Aperçu des activités

| Activité | Écriture temps réel | Export / archivage |
|---|---|---|
| 🏊 Natation | ✅ | ✅ Excel / Grist |
| ⛰️ Escalade (classique, Bloc Contest, suivi) | ✅ | ✅ Excel / Grist |
| 🏃 Demi-fond (3×5 min, enchaînement) | ✅ | ✅ Excel / Grist |
| 🏸 Badminton | ✅ | ✅ Excel / Grist |
| 🏆 Tournoi (ATP, élimination) | ✅ | ✅ Excel / Grist |
| 🏁 Relais (10 s, 2 zones) | ✅ | ✅ Excel / Grist |
| 🏋️ PPG | ✅ | ✅ Excel / Grist |
| 🧭 Course d'orientation / OrientShow | ✅ | ✅ Excel / Grist |
| 📊 Évaluation (VMA, sprint, force) | ✅ | Excel |
| 🏹 Arcathlon | ✅ | ✅ Excel / Grist |
| 🏃 Cross | ✅ | ✅ Excel / Grist |

---

## 🧱 Architecture

Architecture **à deux vitesses**, volontairement découplée :

- **Moteur temps réel `onValue`** : Firebase Realtime Database.
  - Chemin hiérarchique : `etablissements/<RNE>/profs/<codeProf>/<classe>/<activite>/...`
  - Écritures kiosk `push/set/update`, lectures en direct (`onValue`) côté TV, Live prof et bilans.
- **Service central** : `src/js/core/firebase-service.js`
  - Point d'entrée unique du SDK Firebase.
  - Helpers de chemins : `getEtab()`, `getProfBasePath()`, `getPath()`.
- **Archivage** : `src/js/services/archive-service.js`
  - Normalise les données en lignes « élève × résultat ».
  - Pousse vers **Grist** via son API REST.
  - Repli automatique en **export Excel local** si Grist n'est pas configuré.

```
EPS-Arena/
├── maitre.html                 → Interface professeur
├── eleve.html                  → Kiosk élève
├── src/js/
│   ├── config/                 → firebase-config.js (RNE dynamique)
│   ├── core/                   → firebase-service.js, live-engine.js
│   ├── services/               → archive-service.js, export-service.js…
│   └── modules/                → un dossier par activité
└── libs/                       → dépendances locales (xlsx)
```

---

## 🚀 Démarrage rapide

### 1. Ouvrir l'application

- **Professeur** : `maitre.html`
- **Élève** : `eleve.html`

### 2. Au premier lancement

L'application demande le **code RNE** de l'établissement (isolé en `localStorage`), puis le **code prof** habituel.

### 3. Configuration de ton établissement (optionnel)

Par défaut, l'app pointe vers la base Firebase de démonstration. Pour utiliser **ton** projet :

1. Copie `src/js/config/config.local.example.js` en `src/js/config/config.local.js` (ce fichier est ignoré par Git) ;
2. Renseigne ton `rne` et ton `firebaseDatabaseURL`.

> ⚠️ `config.local.js` contient des informations propres à ton établissement : **ne le versionne jamais**.

---

## 🗄️ Archivage vers Grist

1. En fin de séance, dans l'onglet **Live**, clique sur **« 🗄️ Archiver Grist »**.
2. À la première utilisation, une fenêtre te demande l'identifiant du **document Grist**, la **table** et ton **jeton d'accès**.
3. Ces informations restent dans le navigateur (`localStorage`), **jamais dans le code**.

Sans configuration Grist, l'export retombe automatiquement en **fichier Excel**.

> 🔐 Le jeton Grist saisi est stocké **côté navigateur** uniquement. Pour un usage partagé renforcé, il est prévu de passer par **n8n** comme proxy de secret (voir feuille de route).

---

## 🛠️ Aspects techniques

- **Frontend uniquement** : HTML/CSS/JS, modules ES, aucune étape de build.
- **Firebase Realtime Database** : temps réel `onValue` (kiosk → TV → Live prof → bilans).
- **Grist** : archivage long terme par API REST (`POST /docs/{docId}/tables/{tableId}/records`).
- **Exports** : CSV iDoceo et Excel (via SheetJS) définis dans `export-service.js`.

---

## 📚 Feuille de route

- ✅ Dématérialisation du RNE (`getEtab()`) — l'app est réutilisable par établissement.
- ✅ Centralisation des imports Firebase dans `firebase-service.js`.
- ✅ Couche `archive-service.js` + archivage natation (pilote).
- ✅ Archivage généralisé aux autres activités.
- ✅ Saisie du RNE au premier lancement.
- ⏳ **n8n** en proxy de secret pour l'archivage Grist (sécurité renforcée).
- ⏳ Supabase Realtime (si besoin de full open-source/self-hostable).

---

## 🧑‍🏫 Licence & partage

Le code est hébergé sur **Forge** (forge.apps.education.fr) pour la communauté enseignante. Les données élèves (noms, photos) restent en local sur les appareils (IndexedDB) — aucun envoi de données personnelles hors de l'établissement.