// src/js/modules/tournoi/tournoi-core.js
// Cœur commun à toutes les variantes

import { db, ref, onValue, set, update, push } from '../../core/firebase-service.js';

let currentClasse = '';
let joueurs = {};
let historique = [];
let config = {};

// ============================================================
// CHEMINS FIREBASE
// ============================================================

function getBasePath(classe) {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    return `etablissements/0680013V/profs/${profCode}/${classe}/tournoi`;
}

function getJoueursPath(classe) {
    return `${getBasePath(classe)}/joueurs`;
}

function getHistoriquePath(classe) {
    return `${getBasePath(classe)}/historique`;
}

function getConfigPath(classe) {
    return `${getBasePath(classe)}/config`;
}

// ============================================================
// INITIALISATION
// ============================================================

export function initTournoiCore(classe) {
    currentClasse = classe;
    joueurs = {};
    historique = {};
    config = {};

    const joueursRef = ref(db, getJoueursPath(classe));
    onValue(joueursRef, (snap) => {
        joueurs = snap.val() || {};
        window.dispatchEvent(new CustomEvent('tournoi-updated', { detail: { joueurs, historique, config } }));
    });

    const historiqueRef = ref(db, getHistoriquePath(classe));
    onValue(historiqueRef, (snap) => {
        historique = snap.val() || {};
        window.dispatchEvent(new CustomEvent('tournoi-updated', { detail: { joueurs, historique, config } }));
    });

    const configRef = ref(db, getConfigPath(classe));
    onValue(configRef, (snap) => {
        config = snap.val() || {};
        window.dispatchEvent(new CustomEvent('tournoi-updated', { detail: { joueurs, historique, config } }));
    });
}

// ============================================================
// GETTERS
// ============================================================

export function getJoueurs() { return joueurs; }
export function getHistorique() { return historique; }
export function getConfig() { return config; }
export function getCurrentClasse() { return currentClasse; }

// ============================================================
// SETTERS POUR LES VARIANTES
// ============================================================

export function setJoueurs(data) {
    const joueursRef = ref(db, getJoueursPath(currentClasse));
    set(joueursRef, data);
}

export function setHistorique(data) {
    const historiqueRef = ref(db, getHistoriquePath(currentClasse));
    set(historiqueRef, data);
}

export function setConfig(data) {
    const configRef = ref(db, getConfigPath(currentClasse));
    set(configRef, data);
}

export function updateJoueur(code, data) {
    const joueursRef = ref(db, getJoueursPath(currentClasse));
    update(joueursRef, { [code]: data });
}

export function ajouterHistorique(entry) {
    const historiqueRef = ref(db, getHistoriquePath(currentClasse));
    push(historiqueRef, entry);
}

// ============================================================
// EXPORT / IMPORT JSON (commun)
// ============================================================

export function exportTournoiData() {
    if (!currentClasse) return alert('Sélectionnez une classe.');
    const data = {
        version: 1,
        classe: currentClasse,
        date: new Date().toISOString().slice(0,10).replace(/-/g,''),
        joueurs: joueurs,
        historique: historique,
        config: config
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tournoi_${currentClasse}_${data.date}.json`;
    a.click();
}

export function importTournoiData(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.classe) throw new Error('Format invalide.');
            const classe = data.classe;
            setJoueurs(data.joueurs || {});
            setHistorique(data.historique || []);
            setConfig(data.config || {});
            alert('✅ Tournoi importé avec succès !');
        } catch (err) {
            alert('❌ Erreur d\'import : ' + err.message);
        }
    };
    reader.readAsText(file);
}