// src/js/modules/badminton/badminton-events.js
// Gestionnaires d'événements (cases à cocher, boutons)

import { calculerPointsMatch } from './badminton-core.js';
import { getDefaultCheckboxes } from './badminton-utils.js';
import { saveBadmintonResult } from './badminton-firebase.js';

let currentState = {};

export function initEventHandlers(state) {
    currentState = state;
    // L'état est partagé avec le contrôleur
}

export function handleCheckboxChange(checkbox) {
    const player = checkbox.dataset.player;
    const zone = checkbox.dataset.zone;
    const index = parseInt(checkbox.dataset.index);
    currentState.checkboxes[player][zone][index] = checkbox.checked;
    updateScores();
}

export function updateScores(state) {
    const dangerP1 = state.checkboxes.p1.danger.filter(Boolean).length;
    const centerP1 = state.checkboxes.p1.center.filter(Boolean).length;
    const dangerP2 = state.checkboxes.p2.danger.filter(Boolean).length;
    const centerP2 = state.checkboxes.p2.center.filter(Boolean).length;

    state.matchPoints.p1 = dangerP1 + centerP1;
    state.matchPoints.p2 = dangerP2 + centerP2;

    document.getElementById('score-p1').innerText = state.matchPoints.p1;
    document.getElementById('score-p2').innerText = state.matchPoints.p2;
}

export function resetMatch(state) {
    state.checkboxes = {
        p1: getDefaultCheckboxes(),
        p2: getDefaultCheckboxes()
    };
    state.matchPoints = { p1: 0, p2: 0 };
    updateScores(state);
    // Re-rendre l'interface
    if (state.uiRenderer) state.uiRenderer();
}

export function endMatch(state, matchId, terrain, classe, onComplete) {
    if (!matchId) return;
    const p1 = state.currentMatch.p1;
    const p2 = state.currentMatch.p2;
    const score1 = state.matchPoints.p1;
    const score2 = state.matchPoints.p2;

    const result = calculerPointsMatch(score1, score2);

    const data = {
        terrain: terrain,
        p1, p2,
        score1, score2,
        pts1: result.pts1,
        pts2: result.pts2,
        avecManiere1: result.avecManiere1,
        avecManiere2: result.avecManiere2,
        winner: result.winner,
        loser: result.loser,
        timestamp: Date.now()
    };

    saveBadmintonResult(classe, matchId, data)
        .then(() => {
            // Mettre à jour le match dans le schedule
            const match = state.schedule.find(m => m.id === matchId);
            if (match) {
                match.score1 = score1;
                match.score2 = score2;
                match.pts1 = result.pts1;
                match.pts2 = result.pts2;
                match.style1 = result.avecManiere1 ? 'avec' : 'sans';
                match.style2 = result.avecManiere2 ? 'avec' : 'sans';
                match.s1 = result.pts1; // compatibilité
                match.s2 = result.pts2;
            }
            if (onComplete) onComplete();
        })
        .catch(err => alert("Erreur envoi : " + err.message));
}