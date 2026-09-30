// src/js/core/firebase-service.js
// Service centralisé d'accès à Firebase Realtime Database (temps réel séance).
//
// ════════════════════════════════════════════════════════════════
//  RÈGLE : AUCUN chemin ne doit plus être construit en dur dans les
//  modules. Toujours utiliser getEtab() / getProfBasePath() / getPath().
// ════════════════════════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-app.js";
import { getDatabase, ref, onValue, push, set, update, remove } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-database.js";
import { FIREBASE_CONFIG, getRNE, getEtabPath } from "../config/firebase-config.js";

const app = initializeApp(FIREBASE_CONFIG);
export const db = getDatabase(app);
export { ref, onValue, push, set, update, remove };

// Ré-export des helpers de configuration (source unique du RNE).
export { getRNE, getEtabPath };

// ------------------------------------------------------------------
// HELPERS DE CHEMINS — source de vérité unique
// ------------------------------------------------------------------

/**
 * Racine établissement : "etablissements/<RNE>".
 * Remplace tous les anciens "etablissements/0680013V" écrits en dur.
 */
export function getEtab() {
    return getEtabPath();
}

/**
 * Code prof courant (défini au login, stocké en localStorage).
 */
export function getProfCode() {
    return localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
}

/**
 * Racine du prof : "etablissements/<RNE>/profs/<code>" (ou .../profs/<code>/<classe>).
 * @param {string} classe  - optionnel : ajoute le segment de classe.
 */
export function getProfBasePath(classe) {
    const base = `${getEtab()}/profs/${getProfCode()}`;
    return classe ? `${base}/${classe}` : base;
}

/**
 * Construit un chemin complet à partir de segments.
 * @param {...string} segments - ex: getPath('live', 'passages')
 */
export function getPath(...segments) {
    return [getProfBasePath(), ...segments].join('/');
}

// ------------------------------------------------------------------
// HELPERS D'ACCÈS MÉTIER (chemins connus et stables)
// ------------------------------------------------------------------

/** Chemin unifié hiérarchique pour les performances d'escalade. */
export function getPerformancePath(classe, activite) {
    return `${getProfBasePath()}/${classe}/${activite}/montees`;
}

/** Écoute des données élèves (escalade + orientshow). */
export function listenToActivityData(classe, callback) {
    const refEscalade = ref(db, getPerformancePath(classe, 'escalade'));
    const refOrientShow = ref(db, getOrientShowPassagesPath(classe));

    const unsubEscalade = onValue(refEscalade, (snap) => callback('escalade', snap.val() || {}));
    const unsubOrientShow = onValue(refOrientShow, (snap) => callback('orientshow', snap.val() || {}));

    return () => {
        unsubEscalade();
        unsubOrientShow();
    };
}

/** Écoute de la configuration (avec la classe en paramètre). */
export function listenConfig(classe, callback) {
    const refConfig = ref(db, `${getProfBasePath()}/${classe}/config`);
    return onValue(refConfig, (snapshot) => callback(snapshot.val() || {}));
}

// ------------------------------------------------------------------
// FONCTIONS STANDARD (live / passages)
// ------------------------------------------------------------------

export function listenPassages(callback) {
    const refPassages = ref(db, getPath('live', 'passages'));
    return onValue(refPassages, (snapshot) => callback(snapshot.val() || {}));
}

export function sendPassage(passageData) {
    const refPassages = ref(db, getPath('live', 'passages'));
    return push(refPassages, passageData);
}

// ------------------------------------------------------------------
// CHEMIN ORIENTSHOW
// ------------------------------------------------------------------

export function getOrientShowConfigPath(classe) {
    return `${getProfBasePath()}/${classe}/orientshow/config`;
}

export function getOrientShowPassagesPath(classe) {
    return `${getProfBasePath()}/${classe}/orientshow/passages`;
}

export function sendOrientShowPassage(classe, passageData) {
    const refPassages = ref(db, getOrientShowPassagesPath(classe));
    return push(refPassages, passageData);
}

export function listenOrientShowPassages(classe, callback) {
    const refPassages = ref(db, getOrientShowPassagesPath(classe));
    return onValue(refPassages, (snapshot) => callback(snapshot.val() || {}));
}

export function listenOrientShowConfig(classe, callback) {
    const refConfig = ref(db, getOrientShowConfigPath(classe));
    return onValue(refConfig, (snapshot) => callback(snapshot.val() || {}));
}

export function setOrientShowConfig(classe, configData) {
    const refConfig = ref(db, getOrientShowConfigPath(classe));
    return set(refConfig, configData);
}

// ------------------------------------------------------------------
// CHEMIN BADMINTON
// ------------------------------------------------------------------

export function getBadmintonResultsPath(classe) {
    return `${getProfBasePath()}/${classe}/badminton/results`;
}