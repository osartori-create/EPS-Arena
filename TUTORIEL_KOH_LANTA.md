# 🏝️ Tutoriel EPS-Arena : préparer et lancer le module « Koh Lanta » (Natation)

Ce guide accompagne un collègue depuis le **premier lancement** (code RNE) jusqu'à l'utilisation complète du module Koh Lanta en séance.

---

## 1. Premier lancement : le code RNE

Au premier lancement de **l'interface professeur** (`maitre.html`) ou de **l'interface élève** (`eleve.html`), une fenêtre demande le **code RNE** de l'établissement (8 caractères, ex. `0680013V`).

- C'est ce code qui **isole vos données** de celles des autres établissements.
- Il est mémorisé dans le navigateur de la machine (localStorage). Vous ne le saisissez qu'une fois par appareil.
- Si besoin, il est possible de pré-remplir ce code dans le fichier de configuration locale `src/js/config/config.local.js` (champ `rne`).

> 💡 Si vous changez d'établissement ou d'appareil, re-saisissez le bon RNE au premier lancement.

---

## 2. Créer une classe

Onglet **👨‍🏫 Administration** :

1. Cliquer sur **« + Classe »**.
2. Saisir le nom de la classe (ex. `5A`).
3. La classe apparaît dans le sélecteur **« Classe »** en haut à droite.

---

## 3. Charger la liste des élèves

Toujours dans l'onglet **Administration**, plusieurs possibilités :

- **📥 Import iDoceo** : importer directement un fichier iDoceo (liste d'élèves).
- **+ Élève** : ajouter les élèves un par un (nom, prénom, sexe, etc.).
- **🗑 Purger** : vider la liste si besoin.

La liste s'affiche sous forme de cartes dans l'onglet Administration.

---

## 4. Ajouter les photos (recommandé)

1. Préparer un dossier **ZIP** contenant les photos des élèves (les noms des fichiers doivent correspondre aux élèves).
2. Dans l'onglet **Administration**, cliquer sur **« 📸 Import ZIP Photos »**.
3. Sélectionner le fichier ZIP.

Les photos s'affichent maintenant sur les cartes élèves (et plus tard dans le Live, la TV et le bilan).

---

## 5. Configurer le module Natation en mode « Koh Lanta »

1. Aller dans l'onglet **⚙️ Activités**.
2. Cliquer sur la discipline **🏊 Natation**.
3. Dans l'écran de réglages, utiliser le sélecteur **« Mode »** :
   - **🏊 Indice de nage** (activité classique)
   - **🏝️ Koh Lanta** ← à choisir
4. Le titre devient **« 🏝️ Natation – Koh Lanta »** et les options propres à l'indice de nage (distance, barème, organisation, export iDoceo) sont masquées.
5. Sélectionner la bonne classe en haut de page.
6. Cliquer sur **« 📡 Transmettre »** (bouton dans l'en-tête du module Natation, ou bouton global **« 📡 Transmettre aux iPads »**).
7. Une confirmation indique que le mode est activé pour les iPads.

---

## 6. Utiliser le module Koh Lanta côté élèves (iPad / tablette juge)

Sur la tablette, ouvrir **`eleve.html`** :

1. Sélectionner la **classe**.
2. L'interface **Koh Lanta** s'affiche automatiquement (mode juge).

### 6.1. Choisir un nageur
- Un écran plein de **grands numéros** s'affiche.
- Toucher le numéro du nageur qui passe.
- Les numéros déjà passés sont marqués d'une coche ✅ (verts).

### 6.2. Lancer le parcours
- Écran unique organisé autour d'un **gros chrono central**.
- Appuyer sur **▶ TOP DÉPART** pour lancer le chrono global.
- Le chrono tourne pendant tout l'enchaînement :
  1. **🍽️ NAF** (12,5 m) → renseigner le nombre de coups de bras.
  2. **🪼 Méduses** (12,5 m) → renseigner le nombre de méduses touchées (1 méduse = +5 s).
  3. **🌀 Tunnels** → choisir **Corde** ou **Sans aide** (+ nombre de remontées).
  4. **🛟 Remorquage** → choisir **Cerceau**, **Mannequin** ou **Mannequin + clapot**.

> Les 4 zones restent éditables à tout moment, même après l'arrêt du chrono : on peut affiner les saisies sans se presser.

### 6.3. Terminer le passage
- Quand tout est saisi, appuyer sur **⏹ ARRIVÉE** pour stopper le chrono.
- Appuyer sur **✅ VALIDER LE SCORE**.
- L'écran de **score décomposé** s'affiche (temps, coups, méduses, tunnel, remorquage).
- **💾 ENREGISTRER L'ESSAI** pour sauvegarder.

### 6.4. Enchaîner les passages
- **🔄 NOUVEL ESSAI** : repartir pour un second passage du même nageur.
- **👤 CHANGER DE NAGEUR** : revenir à la liste des numéros.

---

## 7. Voir les résultats côté professeur

### 7.1. Classement Live
Onglet **⚙️ Activités → Natation → 📊 Live** :

- Classement **du meilleur au moins bon** (le score le plus bas gagne ; il peut être négatif).
- **Clic sur un élève** : ouvre sa **fiche détaillée** avec **toutes les réalisations**.
- Depuis la fiche, chaque réalisation peut être **✏️ modifiée** ou **🗑️ supprimée**.

### 7.2. Écran TV
Onglet **⚙️ Activités → Natation → 📺 TV** :

- Affichage type « montagne » sur fond **plage** (ciel azur / sable doré).
- Chaque nageur est représenté par sa **photo**, son **numéro** et son **score**.
- Le plus bas score est affiché le plus haut.
- Si la classe est grande, le bandeau **défile automatiquement** pour montrer progressivement tous les nageurs.

---

## 8. Consultation individuelle : le « Bilan élève »

Sur la tablette (interface élève), on peut basculer de la saisie à la consultation :

1. Appuyer sur **« 👤 Bilan élève »**.
2. Choisir le **numéro** du nageur.
3. Le bilan s'affiche :
   - 🥇 meilleur score,
   - dernière performance,
   - 📈 **évolution** entre les passages,
   - 📋 **détail** de chaque passage (temps, coups, méduses, tunnel, remorquage).
4. **⚖️ Mode Juge** pour revenir à la saisie.

---

## Synthèse rapide

| Étape | Action |
|---|---|
| 1. RNE | Saisir le code établissement au premier lancement |
| 2. Classe | Administration → + Classe |
| 3. Élèves | Import iDoceo ou + Élève |
| 4. Photos | Import ZIP Photos |
| 5. Mode | Activités → Natation → Mode 🏝️ Koh Lanta → 📡 Transmettre |
| 6. Élèves | Tablette → classe → chrono + 4 zones → Enregistrer |
| 7. Prof | Live (classement + fiche modifiable) / TV (montagne plage) |
| 8. Bilan | Tablette → 👤 Bilan élève → numéro |