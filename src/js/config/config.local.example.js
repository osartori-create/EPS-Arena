// src/js/config/config.local.example.js
//
// ════════════════════════════════════════════════════════════════
//  MODÈLE DE CONFIGURATION LOCALE (à COPIER, jamais à versionner)
// ════════════════════════════════════════════════════════════════
//
//  Pour personnaliser EPS-Arena pour VOTRE établissement :
//   1. Copier ce fichier en  src/js/config/config.local.js
//      (le fichier  config.local.js  est ignoré par Git).
//   2. Renseigner votre code RNE et l'URL de votre projet Firebase.
//   3. Charger ce fichier DANS maitre.html AVANT les modules ES,
//      par exemple juste avant le <script type="module"> principal.
//
//  ⚠️ Ne jamais versionner config.local.js (il contient vos données
//     d'établissement). Ce fichier-exemple est volontairement public.
// ════════════════════════════════════════════════════════════════

window.EPS_ARENA_CONFIG = {
  // Code RNE de votre établissement (ex: '0123456X').
  // Sert de racine aux chemins : etablissements/<RNE>/profs/...
  rne: '0680013V',

  // URL de la Realtime Database Firebase de votre projet.
  firebaseDatabaseURL: 'https://eps-arena-default-rtdb.europe-west1.firebasedatabase.app/'
};