// src/js/modules/escalade/escalade-contrats-firebase.js
// Communication Firebase du module « Contrats » escalade.
//
// ⚠️ RGPD :
//   - Jamais de nom, prénom, date de naissance, photo, sexe ni identifiant
//     réel d'élève dans Firebase.
//   - Seul un CODE ANONYME circule (codeAutoEval, numéro personnel).
//   - La correspondance code -> nom est résolue UNIQUEMENT en local.
//   - La configuration (rôles, contrats, dégaines, erreurs) est NON personnelle.

import { getEtab } from '../../core/firebase-service.js';
import { db, ref, onValue, push, set } from '../../core/firebase-service.js';

function getBasePath(classe) {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    return `${getEtab()}/profs/${profCode}/${classe}/escalade-contrats`;
}

export function getConfigPath(classe) {
    return `${getBasePath(classe)}/config`;
}

export function getEvaluationsPath(classe) {
    return `${getBasePath(classe)}/evaluations`;
}

// ============================================================
// CONFIGURATION (non personnelle)
// ============================================================
export function listenContratsConfig(classe, callback) {
    return onValue(ref(db, getConfigPath(classe)), (snap) => callback(snap.val() || {}));
}

export function getContratsConfigSnapshot(classe) {
    return new Promise((resolve) => {
        onValue(ref(db, getConfigPath(classe)), (snap) => resolve(snap.val() || null), { onlyOnce: true });
    });
}

export function setContratsConfig(classe, configData) {
    return set(ref(db, getConfigPath(classe)), configData);
}

// ============================================================
// ÉVALUATIONS (relais kiosk -> prof, anonymisées par un code)
// ============================================================
export function listenContratsEvaluations(classe, callback) {
    return onValue(ref(db, getEvaluationsPath(classe)), (snap) => callback(snap.val() || {}));
}

export function addContratsEvaluation(classe, data) {
    const clesAutorisees = ['code', 'role', 'contrat', 'notes', 'degaines', 'erreurs', 'cotationChiffre', 'cotationLettre', 'score', 'scoreParlant', 'epreuves', 'valide', 'seance', 'timestamp'];
    const sanitized = {};
    clesAutorisees.forEach(k => {
        if (data[k] !== undefined) sanitized[k] = data[k];
    });
    return push(ref(db, getEvaluationsPath(classe)), sanitized);
}
