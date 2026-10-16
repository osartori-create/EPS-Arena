// src/js/modules/scan-camera/scan-camera-config.js
// Helpers de stockage local et chemins Firebase du module Scan Caméra.
//
// ════════════════════════════════════════════════════════════════
//  RGPD — ce qui part sur Firebase est strictement anonyme :
//    • markerId   (nombre, ex. 1, 17, 42)
//    • response   ('A' | 'B' | 'C' | 'D')
//    • questionId / sessionId / timestamp
//  La traduction markerId → élève se fait UNIQUEMENT en local (prof).
//  Aucun nom, prénom ou identifiant d'élève ne transite sur le réseau.
// ════════════════════════════════════════════════════════════════

import { getProfBasePath } from '../../core/firebase-service.js';

// ============================================================
// CLÉS DE STOCKAGE (toujours préfixées eps_arena_*)
// ============================================================
export const KEYS = {
    SESSION: 'eps_arena_scancam_session',   // config de la session en cours
    MAPPING: 'eps_arena_scancam_mapping'    // { [classe]: { markerId: eleveId } }
};

// ============================================================
// PATHS FIREBASE
// ============================================================
export function getScanCameraBasePath() {
    return `${getProfBasePath()}/scancamera`;
}

export function getSessionPath(sessionId) {
    return `${getScanCameraBasePath()}/sessions/${sessionId}`;
}

export function getSessionConfigPath(sessionId) {
    return `${getSessionPath(sessionId)}/config`;
}

export function getResponsesPath(sessionId) {
    return `${getSessionPath(sessionId)}/responses`;
}

// ============================================================
// CONFIG DE SESSION (locale, appareil du prof)
// ============================================================
export function getSessionConfig() {
    const raw = localStorage.getItem(KEYS.SESSION);
    return raw ? JSON.parse(raw) : null;
}

export function setSessionConfig(config) {
    localStorage.setItem(KEYS.SESSION, JSON.stringify(config));
}

// ============================================================
// MAPPING LOCAL markerId ↔ eleveId (jamais envoyé sur Firebase)
// ============================================================
export function getMapping(classe) {
    const all = JSON.parse(localStorage.getItem(KEYS.MAPPING) || '{}');
    return (all && all[classe]) || {};
}

export function setMapping(classe, map) {
    const all = JSON.parse(localStorage.getItem(KEYS.MAPPING) || '{}');
    all[classe] = map || {};
    localStorage.setItem(KEYS.MAPPING, JSON.stringify(all));
}

export function getEleveIdForMarker(classe, markerId) {
    return getMapping(classe)[String(markerId)] || null;
}

export function getMarkerIdForEleve(classe, eleveId) {
    const map = getMapping(classe);
    for (const [markerId, id] of Object.entries(map)) {
        if (id === eleveId) return Number(markerId);
    }
    return null;
}

// ============================================================
// IDENTIFIANT DE SESSION
// ============================================================
export function newSessionId() {
    return `s${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
}
