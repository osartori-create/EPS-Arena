// src/js/modules/escalade/escalade-voies-firebase.js
// Communication Firebase pour le module « Suivi des réalisations ».
//
// ⚠️ RGPD — RÈGLES STRICTES APPLIQUÉES ICI :
//   1. JAMAIS de nom, prénom, date de naissance, photo, sexe, ni identifiant
//      réel d'élève (`id`) dans Firebase.
//   2. Seul un CODE ANONYME circule : le « numéro personnel » de l'élève
//      (= codeAutoEval, stocké en local). Il n'est pas rattaché à une identité
//      sur le réseau.
//   3. La correspondance code → nom/prénom est gérée UNIQUEMENT en local
//      (localStorage) côté professeur, jamais transmise.
//   4. La configuration (secteurs, voies) est une donnée NON personnelle.
//   5. La photo du mur n'est autorisée que si AUCUN élève n'y est identifiable.

import { getEtab } from '../../core/firebase-service.js';
import { db, ref, onValue, push, set, update, remove } from '../../core/firebase-service.js';
import { construireSecteursDefaut } from './escalade-voies-config.js';

// ============================================================
// CHEMINS FIREBASE
// ============================================================
function getBasePath(classe) {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    return `${getEtab()}/profs/${profCode}/${classe}/escalade-suivi`;
}

export function getConfigPath(classe) {
    return `${getBasePath(classe)}/config`;
}

export function getMonteesPath(classe) {
    return `${getBasePath(classe)}/montees`;
}

// ============================================================
// CONFIGURATION (secteurs + voies + photo du mur, non personnelles)
// ============================================================
export function listenSuiviConfig(classe, callback) {
    const configRef = ref(db, getConfigPath(classe));
    return onValue(configRef, (snap) => {
        const data = snap.val() || {};
        if (!data.secteurs) data.secteurs = construireSecteursDefaut();
        if (!data.blocs) data.blocs = {};
        if (!data.voies) data.voies = {};
        if (!data.couleurs) data.couleurs = {};
        callback(data);
    });
}

export async function getSuiviConfigSnapshot(classe) {
    return new Promise((resolve) => {
        const refConfig = ref(db, getConfigPath(classe));
        onValue(refConfig, (snap) => resolve(snap.val() || null), { onlyOnce: true });
    });
}

export function setSuiviConfig(classe, configData) {
    const configRef = ref(db, getConfigPath(classe));
    return set(configRef, configData);
}

export function updateSuiviConfig(classe, updates) {
    const configRef = ref(db, getConfigPath(classe));
    return update(configRef, updates);
}

// ============================================================
// MONTÉES (résultats bruts, anonymisés par un code)
//
// Chaque montée ne contient QUE des champs non identifiants :
//   { code, voieId, secteur, couleur, cotation, reussie,
//     maitrise, ressenti, hauteur, timestamp }
// ============================================================
export function listenMontees(classe, callback) {
    const monteesRef = ref(db, getMonteesPath(classe));
    return onValue(monteesRef, (snap) => {
        callback(snap.val() || {});
    });
}

export function addMontee(classe, monteeData) {
    // Garde-fou RGPD : on ne pousse que les clés autorisées.
    // Aucun champ nominatif ne doit parvenir jusqu'ici.
    const clesAutorisees = [
        'code', 'voieId', 'secteur', 'couleur', 'cotation',
        'reussie', 'maitrise', 'ressenti', 'hauteur', 'timestamp'
    ];
    const sanitized = {};
    clesAutorisees.forEach(k => {
        if (monteeData && monteeData[k] !== undefined) sanitized[k] = monteeData[k];
    });

    const monteesRef = ref(db, getMonteesPath(classe));
    return push(monteesRef, sanitized);
}

// ============================================================
// FILTRE DES MONTÉES PAR CODE (kiosk : uniquement celles de l'élève)
// ============================================================
export function filtrerMonteesParCode(montees, code) {
    return Object.values(montees || {}).filter(m => m.code === code);
}

// ============================================================
// MODIFICATION / SUPPRESSION D'UNE MONTÉE (par sa clé push)
// ============================================================
const CLES_MONTEE_AUTORISEES = [
    'code', 'voieId', 'secteur', 'couleur', 'cotation',
    'reussie', 'maitrise', 'ressenti', 'hauteur', 'timestamp'
];

function sanitizeMontee(source) {
    const out = {};
    CLES_MONTEE_AUTORISEES.forEach(k => {
        if (source && source[k] !== undefined) out[k] = source[k];
    });
    return out;
}

export function deleteMontee(classe, key) {
    return remove(ref(db, `${getMonteesPath(classe)}/${key}`));
}

export function updateMontee(classe, key, updates) {
    return update(ref(db, `${getMonteesPath(classe)}/${key}`), sanitizeMontee(updates));
}
