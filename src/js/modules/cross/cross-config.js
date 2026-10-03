// src/js/modules/cross/cross-config.js
// Helpers de stockage et chemins — dépend de config/firebase-config.js

import { getEtab } from '../../core/firebase-service.js';

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

// ════════════════════════════════════════════════════════════
// ISOLATION DU MODULE CROSS
// Les élèves du module CROSS ne sont JAMAIS stockés dans les clés
// partagées ``eps_arena_eleves_*`` utilisées par l'administration
// et les autres activités. Le CROSS possède son propre espace pour
// que les données bidons / simulations soient sans effet de bord.
// ════════════════════════════════════════════════════════════
export const ELEVES_CROSS_PREFIX = 'eps_arena_cross_eleves_';
export const BACKUP_CROSS_PREFIX = 'eps_arena_cross_backup_';
export const ROSTER_LOCAL_KEY = 'eps_arena_cross_roster_local';

// ============================================================
// PATHS FIREBASE
// ============================================================
export function getProfCode() {
    return localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
}

export function getCrossBasePath() {
    return `${getEtab()}/profs/${getProfCode()}/cross`;
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
// STOCKAGE LOCAL ISOLÉ DES ÉLÈVES CROSS
// ============================================================
/**
 * Clé de stockage des élèves d'une classe dans l'espace isolé du CROSS.
 */
export function getCrossElevesKey(classe) {
    return `${ELEVES_CROSS_PREFIX}${classe}`;
}

/**
 * Lit la liste des élèves CROSS d'une classe.
 */
export function getExistingElevesCross(classe) {
    return JSON.parse(localStorage.getItem(getCrossElevesKey(classe)) || '[]');
}

/**
 * Écrit la liste des élèves CROSS d'une classe (triée alphabétiquement).
 */
export function saveElevesCross(classe, eleves) {
    const sorted = [...eleves].sort((a, b) => {
        const nomA = a.nom ? a.nom.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';
        const nomB = b.nom ? b.nom.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';
        const cmp = nomA.localeCompare(nomB);
        if (cmp !== 0) return cmp;
        const preA = a.prenom ? a.prenom.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';
        const preB = b.prenom ? b.prenom.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';
        return preA.localeCompare(preB);
    });
    localStorage.setItem(getCrossElevesKey(classe), JSON.stringify(sorted));
}

/**
 * Attribue un codeAutoEval aux élèves CROSS qui n'en ont pas (équivalent
 * de migrerCodesAutoEval de l'administration, mais dans l'espace isolé).
 */
export function setVmaEleveCross(classe, eleveId, vma) {
    const eleves = getExistingElevesCross(classe);
    const eleve = eleves.find(el => el.id === eleveId);
    if (!eleve) return false;
    eleve.vma = parseFloat(vma) || 0;
    saveElevesCross(classe, eleves);
    return true;
}

export function migrerCodesAutoEvalCross(classeName) {
    const eleves = getExistingElevesCross(classeName);
    if (eleves.length === 0) return false;

    const sansCode = eleves.filter(e => e.codeAutoEval === undefined || e.codeAutoEval === null);
    if (sansCode.length === 0) return false;

    sansCode.sort((a, b) => {
        const nomA = (a.nom || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const nomB = (b.nom || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const cmp = nomA.localeCompare(nomB);
        if (cmp !== 0) return cmp;
        return (a.prenom || '').toUpperCase().localeCompare((b.prenom || '').toUpperCase());
    });

    const codesUtilises = () => new Set(
        eleves.map(e => parseInt(e.codeAutoEval)).filter(n => !isNaN(n))
    );
    sansCode.forEach(e => {
        const codes = codesUtilises();
        let code = 1;
        while (codes.has(code)) code++;
        e.codeAutoEval = code;
    });

    saveElevesCross(classeName, eleves);
    console.log(`[Cross] Codes auto-éval attribués à ${sansCode.length} élève(s)`);
    return true;
}

// ============================================================
// ROSTER LOCAL (affichage des noms sur les iPads de course)
// ============================================================
/**
 * Construit le roster local : { dossard: { nom, prenom, classe, sexe, vma } }.
 * Ne contient AUCUNE photo et n'est jamais envoyé dans Firebase.
 * Seuls les élèves présents ou inaptes sont inclus.
 */
export function construireRosterCross() {
    const eleves = getTousLesElevesCross();
    const roster = {};
    eleves.forEach(e => {
        if (!e.dossard) return;
        if (e.statut !== 'present' && e.statut !== 'inapte') return;
        roster[String(e.dossard)] = {
            nom: e.nom || '',
            prenom: e.prenom || '',
            classe: e.classe || '',
            sexe: e.sexe || '',
            vma: e.vma || null
        };
    });
    return roster;
}

/**
 * Génère le contenu JSON du roster (métadonnées + données).
 */
export function genererRosterJSON() {
    const roster = construireRosterCross();
    return {
        version: 1,
        dateExport: Date.now(),
        profCode: getProfCode(),
        nbDossards: Object.keys(roster).length,
        roster
    };
}

/**
 * Lit le roster local chargé sur cet appareil.
 * @returns {Object} map dossard → { nom, prenom, classe, sexe, vma }
 */
export function loadRosterLocal() {
    try {
        const raw = localStorage.getItem(ROSTER_LOCAL_KEY);
        if (!raw) return {};
        const data = JSON.parse(raw);
        if (data && data.roster && typeof data.roster === 'object') return data.roster;
        if (data && typeof data === 'object' && data.roster === undefined) return data;
        return {};
    } catch (e) {
        return {};
    }
}

/**
 * Enregistre le roster local (format importé depuis un fichier JSON).
 * @param {Object} data - { roster: {...}, ... } ou { dossard: {...} }
 */
export function sauverRosterLocal(data) {
    const roster = data && data.roster ? data.roster : data;
    localStorage.setItem(ROSTER_LOCAL_KEY, JSON.stringify({
        version: 1,
        dateImport: Date.now(),
        roster
    }));
}

/**
 * Supprime le roster local de l'appareil.
 */
export function effacerRosterLocal() {
    localStorage.removeItem(ROSTER_LOCAL_KEY);
}

// ============================================================
// SAUVEGARDE / RESTAURATION AUTOMATIQUES DU CROSS
// ============================================================
/**
 * Sauvegarde l'intégralité des clés CROSS (préfixe ``eps_arena_cross_``)
 * dans une clé versionnée. Appelée avant toute manipulation destructive
 * (simulation de cross complet, réinitialisation, etc.).
 */
export function sauvegarderDonneesCross(label = '') {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (key.startsWith(BACKUP_CROSS_PREFIX)) continue;
        if (key.startsWith('eps_arena_cross_')) {
            data[key] = localStorage.getItem(key);
        }
    }

    const id = Date.now();
    const cleSauvegarde = `${BACKUP_CROSS_PREFIX}${id}`;
    localStorage.setItem(cleSauvegarde, JSON.stringify({
        label,
        date: id,
        dateLisible: new Date(id).toLocaleString('fr-FR'),
        data
    }));
    return cleSauvegarde;
}

/**
 * Liste les sauvegardes CROSS disponibles (de la plus récente à la plus ancienne).
 */
export function listerSauvegardesCross() {
    const resultats = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(BACKUP_CROSS_PREFIX)) continue;
        try {
            const raw = JSON.parse(localStorage.getItem(key));
            resultats.push({ key, ...raw });
        } catch (e) { /* ignore */ }
    }
    resultats.sort((a, b) => b.date - a.date);
    return resultats;
}

/**
 * Efface toutes les clés CROSS courantes (données, classes, dossards,
 * statuts, élèves isolés) sans toucher aux sauvegardes.
 */
export function viderDonneesCross() {
    for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith('eps_arena_cross_') && !k.startsWith(BACKUP_CROSS_PREFIX)) {
            localStorage.removeItem(k);
        }
    }
}

/**
 * Restaure une sauvegarde CROSS précédemment créée.
 * @returns {number} nombre de clés restaurées.
 */
export function restaurerSauvegardeCross(key) {
    const raw = localStorage.getItem(key);
    if (!raw) return 0;
    const backup = JSON.parse(raw);
    if (!backup || !backup.data) return 0;

    // Nettoyage des clés CROSS courantes avant la restauration.
    for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith('eps_arena_cross_') && !k.startsWith(BACKUP_CROSS_PREFIX)) {
            localStorage.removeItem(k);
        }
    }

    let nb = 0;
    Object.entries(backup.data).forEach(([k, v]) => {
        if (typeof v === 'string') {
            localStorage.setItem(k, v);
            nb++;
        }
    });
    return nb;
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
        const eleves = getExistingElevesCross(classe);
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