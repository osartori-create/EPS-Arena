// src/js/config/firebase-config.js
//
// ════════════════════════════════════════════════════════════════
//  CONFIGURATION FIREBASE — SANS IDENTIFIANT EN DUR
// ════════════════════════════════════════════════════════════════
//
//  Le code RNE de l'établissement et l'URL Firebase ne doivent PLUS
//  apparaître en dur dans les modules. Ils se règlent à l'exécution :
//
//  1. localStorage['eps_arena_etabCode']  (prioritaire, à la volée)
//  2. window.EPS_ARENA_CONFIG (fichier config.local.js, gitignoré)
//  3. valeur par défaut ci-dessous (établissement d'origine)
//
//  Exemple de src/js/config/config.local.js (NE PAS versionner) :
//    window.EPS_ARENA_CONFIG = {
//      rne: '0123456X',
//      firebaseDatabaseURL: 'https://mon-projet-default-rtdb.europe-west1.firebasedatabase.app/'
//    };
// ════════════════════════════════════════════════════════════════

export const DEFAULT_RNE = '0680013V';
const DEFAULT_DB_URL = 'https://eps-arena-default-rtdb.europe-west1.firebasedatabase.app/';

function getLocalConfig() {
    if (typeof window !== 'undefined' && window.EPS_ARENA_CONFIG) {
        return window.EPS_ARENA_CONFIG;
    }
    return {};
}

// Code RNE de l'établissement (configurable, jamais en dur dans les modules).
export function getRNE() {
    if (typeof window !== 'undefined') {
        const fromStorage = localStorage.getItem('eps_arena_etabCode');
        if (fromStorage) return fromStorage;
    }
    const cfg = getLocalConfig();
    return cfg.rne || DEFAULT_RNE;
}

// Racine des chemins par établissement : "etablissements/<RNE>".
export function getEtabPath() {
    return `etablissements/${getRNE()}`;
}

export const FIREBASE_CONFIG = {
    databaseURL: getLocalConfig().firebaseDatabaseURL || DEFAULT_DB_URL
};

// ------------------------------------------------------------------
// DB_PATHS : conservé pour compatibilité ascendante.
// Privilégier getEtabPath() / getEtab() pour tout nouveau code.
// ------------------------------------------------------------------
export const DB_PATHS = {
    ETAB: getEtabPath()
};