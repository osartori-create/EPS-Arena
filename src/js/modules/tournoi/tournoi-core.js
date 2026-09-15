// src/js/modules/tournoi/tournoi-core.js
import { db, ref, onValue, set, update, push } from '../../core/firebase-service.js';

let currentClasse = '';
let currentVariant = null;          // null = racine (legacy élimination), 'atp' = sous-dossier
let joueurs = {};
let historique = [];
let config = {};

let unsubJoueurs = null;
let unsubHistorique = null;
let unsubConfig = null;

// ============================================================
// CHEMINS
// ============================================================
function getProfBasePath() {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    return `etablissements/0680013V/profs/${profCode}`;
}

/**
 * Chemin racine du tournoi.
 * @param {string} classe
 * @param {string|null} variant - 'atp', 'elimination', ou null (racine)
 */
export function getBasePath(classe, variant = null) {
    const root = `${getProfBasePath()}/${classe}/tournoi`;
    return variant ? `${root}/${variant}` : root;
}

export function getJoueursPath(classe, variant = null) {
    return `${getBasePath(classe, variant)}/joueurs`;
}

export function getHistoriquePath(classe, variant = null) {
    return `${getBasePath(classe, variant)}/historique`;
}

export function getConfigPath(classe, variant = null) {
    return `${getBasePath(classe, variant)}/config`;
}

// ============================================================
// INITIALISATION
// ============================================================
/**
 * @param {string} classe
 * @param {string|null} variant - Nom de la variante ('atp', etc.). Null = racine.
 */
export function initTournoiCore(classe, variant = null) {
    currentClasse = classe;
    currentVariant = variant;
    joueurs = {};
    historique = [];
    config = {};

    if (unsubJoueurs) { unsubJoueurs(); unsubJoueurs = null; }
    if (unsubHistorique) { unsubHistorique(); unsubHistorique = null; }
    if (unsubConfig) { unsubConfig(); unsubConfig = null; }

    unsubJoueurs = onValue(ref(db, getJoueursPath(classe, variant)), snap => {
        joueurs = snap.val() || {};
        window.dispatchEvent(new CustomEvent('tournoi-updated'));
    });
    unsubHistorique = onValue(ref(db, getHistoriquePath(classe, variant)), snap => {
        historique = snap.val() || [];
        window.dispatchEvent(new CustomEvent('tournoi-updated'));
    });
    unsubConfig = onValue(ref(db, getConfigPath(classe, variant)), snap => {
        config = snap.val() || {};
        window.dispatchEvent(new CustomEvent('tournoi-updated'));
    });
}

export function cleanupTournoiCore() {
    if (unsubJoueurs) { unsubJoueurs(); unsubJoueurs = null; }
    if (unsubHistorique) { unsubHistorique(); unsubHistorique = null; }
    if (unsubConfig) { unsubConfig(); unsubConfig = null; }
}

// ============================================================
// ACCESSEURS
// ============================================================
export function getJoueurs() { return joueurs; }
export function getHistorique() { return historique; }
export function getConfig() { return config; }
export function getCurrentClasse() { return currentClasse; }
export function getCurrentVariant() { return currentVariant; }

// ============================================================
// MUTATEURS
// ============================================================
export function setJoueurs(data, variant = currentVariant) {
    set(ref(db, getJoueursPath(currentClasse, variant)), data);
}

export function setHistorique(data, variant = currentVariant) {
    set(ref(db, getHistoriquePath(currentClasse, variant)), data);
}

export function setConfig(data, variant = currentVariant) {
    set(ref(db, getConfigPath(currentClasse, variant)), data);
}

export function updateJoueur(code, data, variant = currentVariant) {
    update(ref(db, getJoueursPath(currentClasse, variant)), { [code]: data });
}

export function ajouterHistorique(entry, variant = currentVariant) {
    push(ref(db, getHistoriquePath(currentClasse, variant)), entry);
}

export function supprimerHistorique(key, variant = currentVariant) {
    set(ref(db, `${getHistoriquePath(currentClasse, variant)}/${key}`), null);
}

// ============================================================
// EXPORT / IMPORT JSON
// ============================================================
export function exportTournoiData() {
    if (!currentClasse) return alert('Sélectionnez une classe.');
    const data = {
        version: 2,
        classe: currentClasse,
        variant: currentVariant,
        date: new Date().toISOString().slice(0,10).replace(/-/g,''),
        joueurs,
        historique,
        config
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tournoi_${currentVariant || 'root'}_${currentClasse}_${data.date}.json`;
    a.click();
}

export function importTournoiData(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.classe) throw new Error('Format invalide.');
            setJoueurs(data.joueurs || {});
            setHistorique(data.historique || {});
            setConfig(data.config || {});
            alert('✅ Tournoi importé avec succès !');
        } catch (err) {
            alert('❌ Erreur d\'import : ' + err.message);
        }
    };
    reader.readAsText(file);
}