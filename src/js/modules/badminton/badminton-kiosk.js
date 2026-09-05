// src/js/modules/badminton/badminton-kiosk.js
// Contrôleur principal du module Badminton

import { listenBadmintonConfig, listenBadmintonResults } from './badminton-firebase.js';
import { generateRoundRobin, calculerClassement } from './badminton-core.js';
import { renderTerrainSelection, renderMatchSetup, renderClassement, renderCourtInterface } from './badminton-ui.js';
import { initEventHandlers, handleCheckboxChange, updateScores, resetMatch, endMatch } from './badminton-events.js';
import { getDefaultCheckboxes, getDefaultMatchPoints } from './badminton-utils.js';

let state = {
    classe: '',
    terrain: '',
    players: [],
    schedule: [],
    currentMatch: null,
    matchPoints: { p1: 0, p2: 0 },
    checkboxes: {
        p1: getDefaultCheckboxes(),
        p2: getDefaultCheckboxes()
    },
    terrainsConfig: {},
    resultsListener: null
};

// ============================================================
// FONCTIONS GLOBALES (exposées sur window)
// ============================================================

window.selectBadmintonTerrain = function(terrain) {
    state.terrain = terrain;
    renderMatchSetupUI();
};

window.retourTerrains = function() {
    state.terrain = '';
    renderTerrainSelectionUI();
};

window.selectMatch = function(matchId) {
    const match = state.schedule.find(m => m.id === matchId);
    if (!match || match.pts1 !== null) return;
    state.currentMatch = match;
    state.matchPoints = getDefaultMatchPoints();
    state.checkboxes = {
        p1: getDefaultCheckboxes(),
        p2: getDefaultCheckboxes()
    };
    renderCourtUI();
};

window.resetMatch = function() {
    resetMatch(state);
};

window.endMatch = function() {
    if (!state.currentMatch) return;
    const message = `
        Valider le score ?
        ${state.currentMatch.p1} : ${state.matchPoints.p1} pts
        ${state.currentMatch.p2} : ${state.matchPoints.p2} pts
    `;
    if (!confirm(message)) return;

    endMatch(state, state.currentMatch.id, state.terrain, state.classe, () => {
        state.currentMatch = null;
        renderMatchSetupUI();
    });
};

// ============================================================
// RENDU (appelle les fonctions UI)
// ============================================================

function renderTerrainSelectionUI() {
    const container = document.getElementById('badminton-content');
    renderTerrainSelection(container, state.terrainsConfig);
}

function renderMatchSetupUI() {
    const container = document.getElementById('badminton-content');
    renderMatchSetup(container, state.terrain, state.schedule, state.players);
    // Recalculer et afficher le classement
    const standings = calculerClassement(state.schedule, state.players);
    const classementContainer = document.getElementById('classement');
    if (classementContainer) renderClassement(classementContainer, standings);
}

function renderCourtUI() {
    const container = document.getElementById('court-zone');
    if (!state.currentMatch) return;
    renderCourtInterface(
        container,
        state.currentMatch.p1,
        state.currentMatch.p2,
        state.checkboxes,
        state.matchPoints
    );
    // Attacher les événements sur les cases à cocher
    document.querySelectorAll('#court-zone input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', function() {
            handleCheckboxChange(this);
        });
    });
}

// ============================================================
// INIT
// ============================================================

export function initBadmintonKiosk(classe) {
    state.classe = classe;
    state.terrain = '';
    state.resultsListener = null;

    // Écouter la configuration
    listenBadmintonConfig(classe, (config) => {
        if (!config || config.activite !== 'badminton') return;

        // Récupérer les paramètres (si besoin)
        // On ne les utilise pas directement dans cette version

        state.terrainsConfig = {};
        for (let key in config) {
            if (!isNaN(parseInt(key))) {
                state.terrainsConfig[parseInt(key)] = config[key];
            }
        }

        // Initialiser la liste des joueurs pour le premier terrain
        // On va juste afficher la sélection des terrains
        renderTerrainSelectionUI();
    });

    // Écouter les résultats pour mettre à jour le classement
    if (state.resultsListener) state.resultsListener();
    state.resultsListener = listenBadmintonResults(classe, state.terrain, (results) => {
        // Mettre à jour le schedule avec les résultats
        state.schedule.forEach(m => {
            const result = results[m.id];
            if (result) {
                m.score1 = result.score1;
                m.score2 = result.score2;
                m.pts1 = result.pts1;
                m.pts2 = result.pts2;
                m.style1 = result.avecManiere1 ? 'avec' : 'sans';
                m.style2 = result.avecManiere2 ? 'avec' : 'sans';
                m.s1 = result.pts1;
                m.s2 = result.pts2;
            }
        });
        // Si on est sur l'écran des matchs, rafraîchir
        if (state.terrain) renderMatchSetupUI();
    });

    // Exposer les fonctions globales
    window.selectBadmintonTerrain = selectBadmintonTerrain;
    window.retourTerrains = retourTerrains;
    window.selectMatch = selectMatch;
    window.resetMatch = resetMatch;
    window.endMatch = endMatch;
}