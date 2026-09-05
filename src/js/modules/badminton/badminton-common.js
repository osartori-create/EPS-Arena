// src/js/modules/badminton/badminton-common.js
// Code partagé entre tous les modes Badminton
// Round Robin, classement, Firebase, sélection des terrains

import { db, ref, onValue, update } from '../../core/firebase-service.js';

// ============================================================
// ÉTAT PARTAGÉ (toutes les variables exportées)
// ============================================================

export let currentClasse = '';
export let currentTerrain = '';
export let playersList = [];
export let matchSchedule = [];
export let terrainsConfig = {};
export let resultsListenerAttached = false;

// ============================================================
// INITIALISATION COMMUNE
// ============================================================

export function initBadmintonCommon(classe) {
    currentClasse = classe;
    currentTerrain = '';
    resultsListenerAttached = false;

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const configRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/config`);

    console.log(`🔍 [Common] initBadmintonCommon pour la classe : ${classe}`);

    onValue(configRef, (snap) => {
        const config = snap.val() || {};
        console.log("📡 [Common] Config reçue :", config);

        if (!config || Object.keys(config).length === 0) {
            console.warn("⚠️ [Common] Config vide");
            return;
        }

        if (config.activite !== 'badminton') {
            console.warn(`⚠️ [Common] Activité "${config.activite}" !== "badminton"`);
            return;
        }

        // Remplir terrainsConfig (clés numériques)
        terrainsConfig = {};
        for (let key in config) {
            if (!isNaN(parseInt(key))) {
                const numKey = parseInt(key);
                terrainsConfig[numKey] = config[key];
            }
        }
        console.log("📋 [Common] TerrainsConfig :", terrainsConfig);

        // Notifier le mode actif du changement de config
        window.dispatchEvent(new CustomEvent('badminton-config-updated', { 
            detail: { config, terrainsConfig } 
        }));

        // Si on a déjà un terrain sélectionné, re-rendu
        if (currentTerrain) {
            if (window.renderMatchSetup) window.renderMatchSetup();
        } else {
            if (window.renderTerrainSelection) window.renderTerrainSelection();
        }
    });
}

// ============================================================
// ROUND ROBIN
// ============================================================

export function generateRoundRobin() {
    matchSchedule = [];
    const n = playersList.length;
    let list = [...playersList];
    if (n % 2 !== 0) list.push('BYE');
    const totalRounds = list.length - 1;
    const half = list.length / 2;
    let arr = list.slice(1);

    for (let r = 0; r < totalRounds; r++) {
        let roundArr = [list[0], ...arr];
        for (let i = 0; i < half; i++) {
            let p1 = roundArr[i];
            let p2 = roundArr[list.length - 1 - i];
            if (p1 !== 'BYE' && p2 !== 'BYE') {
                matchSchedule.push({ 
                    id: `${currentTerrain}_${r}_${i}`, 
                    p1, p2, 
                    s1: null, s2: null,
                    score1: null, score2: null,
                    style1: null, style2: null
                });
            }
        }
        arr.push(arr.shift());
    }
    console.log(`📋 [Common] Round Robin : ${matchSchedule.length} matchs`);
    return matchSchedule;
}

// ============================================================
// CLASSEMENT
// ============================================================

export function renderClassement(containerId = 'classement') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const standings = {};
    playersList.forEach(p => standings[p] = { pts: 0, wins: 0, losses: 0, diff: 0 });

    matchSchedule.forEach(m => {
        if (m.s1 === null) return;
        standings[m.p1].pts += m.s1 || 0;
        standings[m.p2].pts += m.s2 || 0;
        if (m.score1 !== null && m.score2 !== null) {
            if (m.score1 > m.score2) {
                standings[m.p1].wins++;
                standings[m.p2].losses++;
                standings[m.p1].diff += (m.score1 - m.score2);
                standings[m.p2].diff -= (m.score1 - m.score2);
            } else if (m.score2 > m.score1) {
                standings[m.p2].wins++;
                standings[m.p1].losses++;
                standings[m.p2].diff += (m.score2 - m.score1);
                standings[m.p1].diff -= (m.score2 - m.score1);
            }
        }
    });

    const sorted = Object.entries(standings).sort((a, b) => 
        b[1].pts - a[1].pts || b[1].diff - a[1].diff
    );

    let html = `<h3 class="text-xs font-bold text-slate-400 uppercase mb-2">Classement</h3><div class="space-y-2">`;
    sorted.forEach(([player, data], idx) => {
        html += `<div class="bg-slate-900 p-2 rounded-lg border border-slate-700 flex justify-between items-center">
            <span class="font-black text-white">${idx + 1}. ${player}</span>
            <span class="text-xs text-slate-400">${data.pts} pts | ${data.wins}V-${data.losses}D</span>
        </div>`;
    });
    html += `</div>`;
    container.innerHTML = html;
}

// ============================================================
// SÉLECTION DU TERRAIN (commun)
// ============================================================

export function renderTerrainSelection() {
    const container = document.getElementById('badminton-content');
    if (!container) {
        console.warn("⚠️ [Common] Conteneur #badminton-content introuvable");
        return;
    }

    const keys = Object.keys(terrainsConfig);
    if (keys.length === 0) {
        container.innerHTML = `<div class="text-center bg-slate-800 p-10 rounded-3xl border border-slate-700">
            <p class="text-2xl font-black text-yellow-400">⏳ En attente de la configuration...</p>
            <p class="text-sm text-slate-400 mt-4">Vérifie que le professeur a transmis la configuration.</p>
        </div>`;
        return;
    }

    let html = `<div class="bg-slate-800 p-6 rounded-2xl border border-slate-700 text-center w-full max-w-5xl mx-auto">
        <h2 class="text-3xl font-black text-white mb-6">🏸 Choisis ton terrain</h2>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-6">`;

    keys.forEach(terrain => {
        const numTerrain = parseInt(terrain);
        html += `<button onclick="window.selectBadmintonTerrain(${numTerrain})" 
                    class="bg-blue-600 p-10 rounded-2xl font-black text-4xl text-white active:scale-95 transition-transform shadow-lg">
                    Terrain ${numTerrain}
                </button>`;
    });

    html += `</div></div>`;
    container.innerHTML = html;
}

// ============================================================
// AFFICHAGE DES MATCHS (commun)
// ============================================================

export function renderMatchSetup() {
    const container = document.getElementById('badminton-content');
    if (!container) return;

    const nbPlayers = terrainsConfig[currentTerrain] || 0;
    const lettres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    playersList = lettres.slice(0, nbPlayers);

    if (playersList.length < 2) {
        container.innerHTML = `<div class="text-center bg-slate-800 p-10 rounded-3xl border border-slate-700 w-full max-w-4xl mx-auto">
            <p class="text-2xl font-black text-yellow-400">⏳ En attente d'autres joueurs sur ce terrain...</p>
            <p class="text-sm text-slate-400 mt-4">(Config : ${JSON.stringify(terrainsConfig)})</p>
        </div>`;
        return;
    }

    if (matchSchedule.length === 0) generateRoundRobin();

    let html = `
        <div class="flex flex-col lg:flex-row gap-6 w-full max-w-7xl mx-auto">
            <div class="w-full lg:w-1/3 bg-slate-800 p-6 rounded-2xl border border-slate-700">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-xl font-black text-white">Terrain ${currentTerrain}</h2>
                    <button onclick="window.retourTerrains()" class="bg-red-600 px-3 py-1 rounded-lg text-xs font-black text-white">←</button>
                </div>
                <h3 class="text-xs font-bold text-slate-400 uppercase mb-2">Programmation</h3>
                <div class="space-y-2 max-h-64 overflow-y-auto pr-2">
                    ${matchSchedule.map(match => {
                        const isPlayed = match.s1 !== null;
                        const scoreDisplay = isPlayed ? `${match.s1} - ${match.s2}` : 'À jouer';
                        const playedStyle = isPlayed ? 'line-through opacity-60' : '';
                        const clickAction = isPlayed ? '' : `onclick="window.selectMatchFromList('${match.id}')"`;
                        return `<button ${clickAction} class="w-full text-left p-3 rounded-lg border-2 transition-colors ${playedStyle} ${isPlayed ? 'bg-slate-700 border-slate-500 text-slate-300' : 'bg-slate-900 border-blue-500 text-white hover:bg-blue-900'}">
                            <div class="flex justify-between items-center font-black"><span>${match.p1} vs ${match.p2}</span><span class="text-sm">${scoreDisplay}</span></div>
                        </button>`;
                    }).join('')}
                </div>
                <div id="classement" class="mt-6"></div>
            </div>
            <div class="w-full lg:w-2/3 bg-slate-900 p-6 rounded-2xl border border-slate-700" id="court-zone">
                <div class="text-center py-10"><p class="text-2xl font-black text-slate-500">Cliquez sur un match pour jouer</p></div>
            </div>
        </div>
    `;
    container.innerHTML = html;
    renderClassement();
}

// ============================================================
// FONCTIONS GLOBALES (exposées sur window)
// ============================================================

window.selectBadmintonTerrain = function(terrain) {
    currentTerrain = parseInt(terrain);
    renderMatchSetup();
    // Notifier le mode actif du changement de terrain
    window.dispatchEvent(new CustomEvent('badminton-terrain-selected', { 
        detail: { terrain: currentTerrain } 
    }));
};

window.retourTerrains = function() {
    currentTerrain = '';
    renderTerrainSelection();
};

// La fonction selectMatchFromList est redéfinie dans chaque mode
// On la définit ici comme placeholder, chaque mode la surchargera
window.selectMatchFromList = function(matchId) {
    console.warn('⚠️ selectMatchFromList doit être surchargée par le mode actif');
};

// ============================================================
// FIREBASE : ÉCOUTE DES SCORES
// ============================================================

export function listenForScoreUpdates() {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const resultsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/badminton/results`);
    
    onValue(resultsRef, (snap) => {
        const data = snap.val() || {};
        matchSchedule.forEach(m => {
            const result = data[m.id];
            if (result && result.terrain === currentTerrain) {
                m.s1 = result.pts1;
                m.s2 = result.pts2;
                m.score1 = result.score1;
                m.score2 = result.score2;
                m.style1 = result.avecManiere1 ? 'avec' : 'sans';
                m.style2 = result.avecManiere2 ? 'avec' : 'sans';
            }
        });
        if (document.getElementById('court-zone') && !document.getElementById('court')) {
            renderMatchSetup();
        } else {
            renderClassement();
        }
    });
}