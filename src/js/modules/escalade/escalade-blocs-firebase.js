// src/js/modules/escalade/escalade-blocs-firebase.js
// Communication Firebase pour le module Bloc Contest

import { db, ref, onValue, push, set, update, remove } from '../../core/firebase-service.js';

// ============================================================
// Chemins Firebase
// ============================================================
function getBasePath(classe) {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    return `etablissements/0680013V/profs/${profCode}/${classe}/bloccontest`;
}

export function getConfigPath(classe) {
    return `${getBasePath(classe)}/config`;
}

export function getValidationsPath(classe) {
    return `${getBasePath(classe)}/validations`;
}

// ============================================================
// Lecture / Écriture de la configuration
// ============================================================
export function listenBlocConfig(classe, callback) {
    const configRef = ref(db, getConfigPath(classe));
    return onValue(configRef, (snap) => {
        callback(snap.val() || null);
    });
}

export function setBlocConfig(classe, configData) {
    const configRef = ref(db, getConfigPath(classe));
    return set(configRef, configData);
}

export function updateBlocConfig(classe, updates) {
    const configRef = ref(db, getConfigPath(classe));
    return update(configRef, updates);
}

// ============================================================
// Lecture / Écriture des validations
// ============================================================
export function listenValidations(classe, callback) {
    const validationsRef = ref(db, getValidationsPath(classe));
    return onValue(validationsRef, (snap) => {
        callback(snap.val() || {});
    });
}

export function addValidation(classe, validationData) {
    const validationsRef = ref(db, getValidationsPath(classe));
    return push(validationsRef, validationData);
}

export function removeValidation(classe, validationKey) {
    const validationRef = ref(db, `${getValidationsPath(classe)}/${validationKey}`);
    return remove(validationRef);
}

export function clearValidations(classe) {
    const validationsRef = ref(db, getValidationsPath(classe));
    return set(validationsRef, {});
}

// ============================================================
// Utilitaires : récupération des données brutes pour le calcul
// ============================================================
export async function getBlocConfigSnapshot(classe) {
    return new Promise((resolve) => {
        const refConfig = ref(db, getConfigPath(classe));
        onValue(refConfig, (snap) => resolve(snap.val() || null), { onlyOnce: true });
    });
}

export async function getValidationsSnapshot(classe) {
    return new Promise((resolve) => {
        const refValid = ref(db, getValidationsPath(classe));
        onValue(refValid, (snap) => resolve(snap.val() || {}), { onlyOnce: true });
    });
}