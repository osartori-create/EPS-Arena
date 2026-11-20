// src/js/modules/natation/natation-progression.js
// Historique de progression d'un élève (natation) : distance longue et indice de nage,
// par « épreuve du jour » (date). Lecture seule Firebase (données par numéro, anonymes).

import { db, ref, onValue, getEtab } from '../../core/firebase-service.js';
import {
    getBasePath, getSessionsPath, getSessionObsPath, COULEURS_GROUPES
} from './natation-longue-common.js';
import { calculerDistance } from './natation-longue-core.js';

function lireOnce(path) {
    return new Promise(resolve => onValue(ref(db, path), snap => resolve(snap.val()), { onlyOnce: true }));
}

// Position alphabétique (numéro) d'un élève — identique à getElevesNumerotes.
function getNumeroEleve(classe, eleveId) {
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');
    eleves.sort((a, b) => (a.nom || '').localeCompare(b.nom || '') || (a.prenom || '').localeCompare(b.prenom || ''));
    const idx = eleves.findIndex(e => e.id === eleveId);
    return idx >= 0 ? idx + 1 : null;
}

// Distance natation longue (m) par épreuve (jour).
export async function chargerProgressionDistance(classe, eleveId) {
    const numero = getNumeroEleve(classe, eleveId);
    if (numero === null) return [];
    const sessions = await lireOnce(getSessionsPath(classe)) || {};
    const config = await lireOnce(`${getBasePath(classe)}/config`) || {};
    const distanceParClic = config.distanceParClic || 50;

    const parDate = {};
    for (const sessionId of Object.keys(sessions).sort()) {
        const observations = await lireOnce(getSessionObsPath(classe, sessionId)) || {};
        for (const c of COULEURS_GROUPES) {
            const obs = observations[c.id]?.[String(numero)];
            if (!obs || obs.abandon) continue;
            const distance = calculerDistance(obs.timestamps, obs.partiel, distanceParClic);
            if (!parDate[sessionId] || distance > parDate[sessionId].distance) {
                parDate[sessionId] = { date: sessionId, distance };
            }
        }
    }
    return Object.values(parDate).sort((a, b) => a.date.localeCompare(b.date));
}

// Indice de nage par épreuve (jour).
export async function chargerProgressionIndice(classe, eleveId) {
    const numero = getNumeroEleve(classe, eleveId);
    if (numero === null) return [];
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const base = `${getEtab()}/profs/${profCode}/${classe}/natation/indice/sessions`;
    const sessions = await lireOnce(base) || {};

    const points = [];
    for (const date of Object.keys(sessions).sort()) {
        const indices = await lireOnce(`${base}/${date}/indices`) || {};
        const v = indices[String(numero)];
        if (v !== undefined && v !== null && !Number.isNaN(Number(v))) {
            points.push({ date, indice: Number(v) });
        }
    }
    return points;
}
