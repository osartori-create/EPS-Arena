// src/js/modules/cross/cross-config.js
// Helpers de stockage et chemins — dépend de live-engine.js et admin-service.js

import { getCurrentClasse } from '../../core/live-engine.js';

// ============================================================
// CLÉS DE STOCKAGE
// ============================================================
export const KEYS = {
    CONFIG:          'eps_arena_cross_config',              // { nom, annee, date }
    CLASSES:         'eps_arena_cross_classes',             // ["301","302",...]
    DOSSARDS:        'eps_arena_cross_dossards',            // { "17": "eleveId", ... }
    DOSSARDS_INV:    'eps_arena_cross_dossards_inv',        // { "eleveId": "17", ... }
    STATUTS:         'eps_arena_cross_statuts',             // { "eleveId": "present|absent|inapte|abandon" }
    COURSE_ACTIVE:   'eps_arena_cross_course_active'        // "course1" | "course2" | ...
};

// ============================================================
// PATHS FIREBASE
// ============================================================
export function getProfCode() {
    return localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
}

export function getCrossBasePath() {
    return `etablissements/0680013V/profs/${getProfCode()}/cross`;
}

export function getCoursePath(courseId) {
    return `${getCrossBasePath()}/courses/${courseId}`;
}

// ============================================================
// CONFIG GÉNÉRALE DU CROSS
// ============================================================
export function getCrossConfig() {
    const raw = localStorage.getItem(KEYS.CONFIG);
    return raw ? JSON.parse(raw) : null;
}

export function setCrossConfig(config) {
    localStorage.setItem(KEYS.CONFIG, JSON.stringify(config));
}

// ============================================================
// CLASSES PARTICIPANTES
// ============================================================
export function getClassesParticipantes() {
    const raw = localStorage.getItem(KEYS.CLASSES);
    return raw ? JSON.parse(raw) : [];
}

export function setClassesParticipantes(list) {
    localStorage.setItem(KEYS.CLASSES, JSON.stringify(list));
}

// ============================================================
// DOSSARDS
// ============================================================
export function getDossards() {
    const raw = localStorage.getItem(KEYS.DOSSARDS);
    return raw ? JSON.parse(raw) : {};
}

export function setDossards(map) {
    localStorage.setItem(KEYS.DOSSARDS, JSON.stringify(map));
    // index inverse
    const inv = {};
    Object.entries(map).forEach(([dossard, eleveId]) => { inv[eleveId] = dossard; });
    localStorage.setItem(KEYS.DOSSARDS_INV, JSON.stringify(inv));
}

export function getDossardByEleveId(eleveId) {
    const raw = localStorage.getItem(KEYS.DOSSARDS_INV);
    const inv = raw ? JSON.parse(raw) : {};
    return inv[eleveId] || null;
}

export function setDossardPourEleve(eleveId, dossard) {
    const map = getDossards();
    // Retire l'ancienne association de cet élève si elle existe
    Object.keys(map).forEach(d => {
        if (map[d] === eleveId) delete map[d];
    });
    map[String(dossard)] = eleveId;
    setDossards(map);
}

export function getEleveIdByDossard(dossard) {
    const map = getDossards();
    return map[String(dossard)] || null;
}

// ============================================================
// STATUTS
// ============================================================
export function getStatutsCross() {
    const raw = localStorage.getItem(KEYS.STATUTS);
    return raw ? JSON.parse(raw) : {};
}

export function setStatutsCross(map) {
    localStorage.setItem(KEYS.STATUTS, JSON.stringify(map));
}

// ============================================================
// ÉLÈVES AGRÉGÉS (toutes classes confondues)
// ============================================================
/**
 * Retourne une liste plate de tous les élèves des classes participantes,
 * enrichis de leur code classe.
 * @returns {Array} [{ eleveId, nom, prenom, classe, sexe, vma, dossard, statut }]
 */
export function getTousLesElevesCross() {
    const classes = getClassesParticipantes();
    const dossards = getDossards();
    const statuts = getStatutsCross();
    const out = [];
    const vus = new Set();

    classes.forEach(classe => {
        const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');
        eleves.forEach(e => {
            if (vus.has(e.id)) return;
            vus.add(e.id);

            // Dossard associé ?
            let dossard = null;
            for (const [d, id] of Object.entries(dossards)) {
                if (id === e.id) { dossard = parseInt(d, 10); break; }
            }

            out.push({
                eleveId: e.id,
                nom: e.nom || '',
                prenom: e.prenom || '',
                classe: classe,
                sexe: e.sexe || '',
                vma: parseFloat(e.vma) || null,
                dossard: dossard,
                statut: statuts[e.id] || 'present'
            });
        });
    });

    out.sort((a, b) => {
        if (a.classe !== b.classe) return a.classe.localeCompare(b.classe);
        const nA = `${a.nom} ${a.prenom}`.toUpperCase();
        const nB = `${b.nom} ${b.prenom}`.toUpperCase();
        return nA.localeCompare(nB);
    });

    return out;
}

/**
 * Retourne le prochain dossard libre (1..N), N = nb élèves + marge.
 */
export function getProchainDossardLibre() {
    const map = getDossards();
    let d = 1;
    while (map[String(d)]) d++;
    return d;
}