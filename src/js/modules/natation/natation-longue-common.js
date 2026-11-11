// src/js/modules/natation/natation-longue-common.js
// Helpers partagés du mode « Longue distance » (épreuve de nage 6-9 min)

import { getEtab } from '../../core/firebase-service.js';
import { getExistingEleves } from '../../services/admin-service.js';

// ============================================================
// COULEURS DES GROUPES (vagues) — identiques au 1/2 fond
// ============================================================
export const COULEURS_GROUPES = [
    { id: 'BLEU',  label: 'Bleu',  bg: '#3b82f6', text: '#ffffff', border: '#1e40af' },
    { id: 'ROUGE', label: 'Rouge', bg: '#ef4444', text: '#ffffff', border: '#991b1b' },
    { id: 'VERT',  label: 'Vert',  bg: '#22c55e', text: '#ffffff', border: '#166534' },
    { id: 'JAUNE', label: 'Jaune', bg: '#eab308', text: '#000000', border: '#854d0e' }
];

export function getCouleurGroupe(id) {
    return COULEURS_GROUPES.find(c => c.id === id) || COULEURS_GROUPES[0];
}

// ============================================================
// CLÉS LOCALSTORAGE (RGPD : statuts + mapping restent locaux)
// ============================================================
export function getStatutsKey(classe) {
    return `eps_arena_natation_longue_statuts_${classe}`;
}

export function getGroupesKey(classe) {
    return `eps_arena_natation_longue_groupes_${classe}`;
}

export function getConfigKey(classe) {
    return `eps_arena_natation_longue_config_${classe}`;
}

export function getMappingKey(classe) {
    return `eps_arena_natation_longue_mapping_${classe}`;
}

export function getMapping(classe) {
    return JSON.parse(localStorage.getItem(getMappingKey(classe)) || '{}');
}

export function setMapping(classe, mapping) {
    localStorage.setItem(getMappingKey(classe), JSON.stringify(mapping));
}

export function getStatuts(classe) {
    return JSON.parse(localStorage.getItem(getStatutsKey(classe)) || '{}');
}

// ============================================================
// FIREBASE PATHS (anonymes : numéros uniquement)
// ============================================================
export function getBasePath(classe) {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    return `${getEtab()}/profs/${profCode}/${classe}/natation/longue`;
}

export function creerSessionId(now = new Date()) {
    const p = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}T${p(now.getHours())}-${p(now.getMinutes())}-${p(now.getSeconds())}`;
}

export function getSessionsPath(classe) {
    return `${getBasePath(classe)}/sessions`;
}

export function getSessionActivePath(classe) {
    return `${getBasePath(classe)}/sessionActive`;
}

export function getSessionObsPath(classe, sessionId) {
    return `${getBasePath(classe)}/sessions/${sessionId}/observations`;
}

export function getSessionModifsPath(classe, sessionId) {
    return `${getBasePath(classe)}/sessions/${sessionId}/modifications`;
}

// ============================================================
// NUMÉROTATION DES ÉLÈVES (identique au module natation : tri
// alphabétique puis numéro = position + 1)
// ============================================================
export function getElevesNumerotes(classe) {
    const eleves = getExistingEleves(classe);
    return [...eleves]
        .sort((a, b) => (a.nom || '').localeCompare(b.nom || '') || (a.prenom || '').localeCompare(b.prenom || ''))
        .map((e, idx) => ({ ...e, numero: idx + 1 }));
}

export function getEleveParNumero(classe, numero) {
    const map = getMapping(classe);
    const id = map[String(numero)];
    if (id) {
        const e = getExistingEleves(classe).find(x => x.id === id);
        if (e) return e;
    }
    return getElevesNumerotes(classe).find(e => String(e.numero) === String(numero)) || null;
}

// ============================================================
// FORMATAGE
// ============================================================
export function formatDuree(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}
