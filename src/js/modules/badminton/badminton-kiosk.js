// src/js/modules/badminton/badminton-kiosk.js
// Module Badminton – Saisie "Avec la manière" (cases à cocher)

import { db, ref, onValue, update } from '../../core/firebase-service.js';

let currentClasse = '';
let currentTerrain = '';
let playersList = [];
let matchSchedule = [];
let currentMatch = null;

let matchPoints = { p1: 0, p2: 0 };
let stats = {
    p1: { danger: 0, center: 0 },
    p2: { danger: 0, center: 0 }
};

let checkboxes = {
    p1: { danger: Array(10).fill(false), center: Array(10).fill(false) },
    p2: { danger: Array(10).fill(false), center: Array(10).fill(false) }
};

let terrainsConfig = {};
let historyStack = [];
let redoStack = [];
let resultsListenerAttached = false;

// Paramètres
let badmintonMode = 'frontback';
let badmintonCenterSize = 33;
let badmintonCenterPoints = 1;
let badmintonOtherPoints = 3;
let badmintonCornerPoints = 5;
let badmintonFaultPoints = 1;
let badmintonFaultPenalty = true;

const SEUIL_MANIERE = 8;

// ============================================================
// INIT
// ============================================================

export function initBadmintonKiosk(classe) {
    currentClasse = classe;
    currentTerrain = '';
    resultsListenerAttached = false;

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const configRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/config`);

    onValue(configRef, (snap) => {
        const config = snap.val() || {};
        console.log("📡 [Kiosk] Config reçue de Firebase :", config);

        if (config.activite !== 'badminton') {
            console.warn("⚠️ Activité non badminton, ignorée");
            return;
        }

        // Mise à jour des paramètres
        badmintonMode = config.mode || 'frontback';
        badmintonCenterSize = config.centerSize || 33;
        // (autres paramètres inutilisés pour les cases à cocher)

        // Remplir terrainsConfig
        terrainsConfig = {};
        for (let key in config) {
            if (!isNaN(parseInt(key))) {
                const numKey = parseInt(key);
                terrainsConfig[numKey] = config[key];
                console.log(`✅ Terrain ${numKey} : ${config[key]} joueurs`);
            }
        }
        console.log("📋 TerrainsConfig final :", terrainsConfig);

        if (currentTerrain) {
            renderMatchSetup();
        } else {
            renderTerrainSelection();
        }
    });

    if (!resultsListenerAttached) {
        listenForScoreUpdates();
        resultsListenerAttached = true;
    }
}

// ============================================================
// 1. SÉLECTION DU TERRAIN
// ============================================================

function renderTerrainSelection() {
    const container = document.getElementById('badminton-content');
    if (!container) return;

    console.log("🎯 renderTerrainSelection avec terrainsConfig :", terrainsConfig);

    let html = `<div class="bg-slate-800 p-6 rounded-2xl border border-slate-700 text-center w-full max-w-5xl mx-auto">
        <h2 class="text-3xl font-black text-white mb-6">🏸 Choisis ton terrain</h2>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-6">`;

    Object.keys(terrainsConfig).forEach(terrain => {
        const numTerrain = parseInt(terrain);
        html += `<button onclick="selectBadmintonTerrain(${numTerrain})" class="bg-blue-600 p-10 rounded-2xl font-black text-4xl text-white active:scale-95 transition-transform shadow-lg">
                    Terrain ${numTerrain}
                </button>`;
    });

    html += `</div></div>`;
    container.innerHTML = html;
}

window.selectBadmintonTerrain = function(terrain) {
    currentTerrain = terrain;
    console.log(`🟢 Terrain sélectionné : ${terrain}`);
    renderMatchSetup();
};

window.retourTerrains = function() {
    currentTerrain = '';
    renderTerrainSelection();
};

// ============================================================
// 2. ROUND ROBIN & CLASSEMENT
// ============================================================

function generateRoundRobin() {
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
                matchSchedule.push({ id: `${currentTerrain}_${r}_${i}`, p1, p2, s1: null, s2: null });
            }
        }
        arr.push(arr.shift());
    }
}

function renderMatchSetup() {
    const container = document.getElementById('badminton-content');
    if (!container) return;

    // 🔍 LOG : Voir les variables critiques
    console.log("🔍 renderMatchSetup - currentTerrain :", currentTerrain);
    console.log("🔍 renderMatchSetup - terrainsConfig :", terrainsConfig);

    const nbPlayers = terrainsConfig[currentTerrain] || 0;
    console.log(`🔍 Nombre de joueurs pour le terrain ${currentTerrain} : ${nbPlayers}`);

    const lettres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    playersList = lettres.slice(0, nbPlayers);
    console.log(`🔍 Liste des joueurs : ${playersList.join(', ')}`);

    if (playersList.length < 2) {
        container.innerHTML = `<div class="text-center bg-slate-800 p-10 rounded-3xl border border-slate-700 w-full max-w-4xl mx-auto">
            <p class="text-2xl font-black text-white">En attente d'autres joueurs sur ce terrain...</p>
            <p class="text-sm text-slate-400 mt-4">(Config reçue : ${JSON.stringify(terrainsConfig)})</p>
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
                        const clickAction = isPlayed ? '' : `onclick="selectMatchFromList('${match.id}')"`;
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

window.selectMatchFromList = function(matchId) {
    const match = matchSchedule.find(m => m.id === matchId);
    if (!match || match.s1 !== null) return;
    currentMatch = match;
    matchPoints = { p1: 0, p2: 0 };
    stats = { p1: { danger: 0, center: 0 }, p2: { danger: 0, center: 0 } };
    checkboxes = {
        p1: { danger: Array(10).fill(false), center: Array(10).fill(false) },
        p2: { danger: Array(10).fill(false), center: Array(10).fill(false) }
    };
    historyStack = [];
    redoStack = [];
    renderCourtInterface();
};

function renderClassement() {
    const container = document.getElementById('classement');
    if (!container) return;
    const standings = {};
    playersList.forEach(p => standings[p] = { pts: 0, wins: 0, losses: 0, diff: 0 });
    matchSchedule.forEach(m => {
        if (m.s1 === null) return;
        standings[m.p1].pts += m.s1 || 0;
        standings[m.p2].pts += m.s2 || 0;
        // On pourrait compter les victoires si on avait les scores réels
        // On les stocke dans m.score1 et m.score2
        if (m.score1 !== undefined && m.score2 !== undefined) {
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
    const sorted = Object.entries(standings).sort((a, b) => b[1].pts - a[1].pts || b[1].diff - a[1].diff);
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
// 3. RENDU DU PANNEAU DE SAISIE (cases à cocher)
// ============================================================

function renderCourtInterface() {
    const container = document.getElementById('court-zone');
    if (!container) return;

    const p1 = currentMatch.p1;
    const p2 = currentMatch.p2;

    function renderCheckboxes(player) {
        let html = '';
        // Zone dangereuse
        html += `<div class="mb-4">
            <p class="text-sm font-bold text-slate-400">Points gagnés en zone dangereuse</p>
            <div class="grid grid-cols-5 gap-2 mt-2">`;
        for (let i = 0; i < 10; i++) {
            const checked = checkboxes[player].danger[i] ? 'checked' : '';
            html += `<label class="flex items-center justify-center bg-slate-700 rounded-lg p-2 cursor-pointer hover:bg-slate-600 transition">
                <input type="checkbox" class="w-6 h-6 accent-blue-500" data-player="${player}" data-zone="danger" data-index="${i}" ${checked} onchange="window.updateCheckbox(this)">
                <span class="ml-1 text-xs text-slate-300">${i+1}</span>
            </label>`;
        }
        html += `</div></div>`;

        // Zone centrale
        html += `<div>
            <p class="text-sm font-bold text-slate-400">Points gagnés en zone centrale</p>
            <div class="grid grid-cols-5 gap-2 mt-2">`;
        for (let i = 0; i < 10; i++) {
            const checked = checkboxes[player].center[i] ? 'checked' : '';
            html += `<label class="flex items-center justify-center bg-slate-700 rounded-lg p-2 cursor-pointer hover:bg-slate-600 transition">
                <input type="checkbox" class="w-6 h-6 accent-green-500" data-player="${player}" data-zone="center" data-index="${i}" ${checked} onchange="window.updateCheckbox(this)">
                <span class="ml-1 text-xs text-slate-300">${i+1}</span>
            </label>`;
        }
        html += `</div></div>`;

        const totalDanger = checkboxes[player].danger.filter(Boolean).length;
        const totalCenter = checkboxes[player].center.filter(Boolean).length;
        const total = totalDanger + totalCenter;
        html += `
            <div class="mt-4 flex justify-between text-sm text-slate-400">
                <span>Zone dangereuse : <span class="font-bold text-white">${totalDanger}</span></span>
                <span>Zone centrale : <span class="font-bold text-white">${totalCenter}</span></span>
                <span class="text-yellow-400 font-bold">Total : ${total}</span>
            </div>
        `;
        return html;
    }

    container.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <div class="text-center w-1/3">
                <h3 class="text-2xl font-black text-white">${p1}</h3>
                <div id="ratio-p1" class="text-xs text-slate-400">Score : <span id="score-p1">0</span></div>
            </div>
            <div class="text-center w-1/3">
                <h3 class="text-2xl font-black text-white">vs</h3>
                <div class="text-xs text-slate-400">Seuil "Avec la manière" : <span class="text-yellow-400 font-bold">${SEUIL_MANIERE} pts</span></div>
            </div>
            <div class="text-center w-1/3">
                <h3 class="text-2xl font-black text-white">${p2}</h3>
                <div id="ratio-p2" class="text-xs text-slate-400">Score : <span id="score-p2">0</span></div>
            </div>
        </div>

        <div class="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-4">
            <p class="text-xs text-slate-400 text-center">Cochez les points gagnés dans chaque zone (10 essais maximum par zone)</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <h4 class="text-lg font-black text-white text-center mb-2">${p1}</h4>
                ${renderCheckboxes('p1')}
            </div>
            <div class="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <h4 class="text-lg font-black text-white text-center mb-2">${p2}</h4>
                ${renderCheckboxes('p2')}
            </div>
        </div>

        <div class="flex flex-wrap justify-center gap-3 mt-4">
            <button onclick="window.resetMatch()" class="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-xl font-bold text-sm">🔄 Reset</button>
            <button onclick="window.endMatch()" class="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-xl font-black text-sm">🏁 Valider le match</button>
            <button onclick="window.retourTerrains()" class="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl font-bold text-sm">← Terrain</button>
        </div>
    `;

    updateScores();
}

// ============================================================
// 4. GESTION DES CASES À COCHER
// ============================================================

window.updateCheckbox = function(checkbox) {
    const player = checkbox.dataset.player;
    const zone = checkbox.dataset.zone;
    const index = parseInt(checkbox.dataset.index);
    checkboxes[player][zone][index] = checkbox.checked;
    updateScores();
};

function updateScores() {
    const dangerP1 = checkboxes.p1.danger.filter(Boolean).length;
    const centerP1 = checkboxes.p1.center.filter(Boolean).length;
    const dangerP2 = checkboxes.p2.danger.filter(Boolean).length;
    const centerP2 = checkboxes.p2.center.filter(Boolean).length;

    matchPoints.p1 = dangerP1 + centerP1;
    matchPoints.p2 = dangerP2 + centerP2;

    stats.p1.danger = dangerP1;
    stats.p1.center = centerP1;
    stats.p2.danger = dangerP2;
    stats.p2.center = centerP2;

    document.getElementById('score-p1').innerText = matchPoints.p1;
    document.getElementById('score-p2').innerText = matchPoints.p2;
}

window.resetMatch = function() {
    checkboxes = {
        p1: { danger: Array(10).fill(false), center: Array(10).fill(false) },
        p2: { danger: Array(10).fill(false), center: Array(10).fill(false) }
    };
    updateScores();
    renderCourtInterface();
};

// ============================================================
// 5. FIN DE MATCH (avec calcul "Avec la manière")
// ============================================================

window.endMatch = function() {
    if (!currentMatch) return;

    const p1 = currentMatch.p1;
    const p2 = currentMatch.p2;
    const score1 = matchPoints.p1;
    const score2 = matchPoints.p2;

    // Déterminer le gagnant et le perdant
    let winner, loser, winnerScore, loserScore;
    if (score1 > score2) {
        winner = p1; loser = p2; winnerScore = score1; loserScore = score2;
    } else if (score2 > score1) {
        winner = p2; loser = p1; winnerScore = score2; loserScore = score1;
    } else {
        // Match nul
        const avecManiere1 = score1 >= SEUIL_MANIERE;
        const avecManiere2 = score2 >= SEUIL_MANIERE;
        const pts1 = avecManiere1 ? 2 : 1;
        const pts2 = avecManiere2 ? 2 : 1;
        const matchIndex = matchSchedule.findIndex(m => m.id === currentMatch.id);
        if (matchIndex !== -1) {
            matchSchedule[matchIndex].s1 = pts1;
            matchSchedule[matchIndex].s2 = pts2;
            matchSchedule[matchIndex].score1 = score1;
            matchSchedule[matchIndex].score2 = score2;
            matchSchedule[matchIndex].style1 = avecManiere1 ? 'avec' : 'sans';
            matchSchedule[matchIndex].style2 = avecManiere2 ? 'avec' : 'sans';
        }
        saveMatchResult(p1, p2, score1, score2, pts1, pts2, avecManiere1, avecManiere2);
        alert(`Match nul ! ${p1} ${score1} pts, ${p2} ${score2} pts`);
        currentMatch = null;
        renderMatchSetup();
        return;
    }

    const winnerAvecManiere = winnerScore >= SEUIL_MANIERE;
    const loserAvecManiere = loserScore >= SEUIL_MANIERE;

    let ptsWinner, ptsLoser;
    if (winnerAvecManiere) {
        ptsWinner = 5;
    } else {
        ptsWinner = 3;
    }
    if (loserAvecManiere) {
        ptsLoser = 2;
    } else {
        ptsLoser = 1;
    }

    const matchIndex = matchSchedule.findIndex(m => m.id === currentMatch.id);
    if (matchIndex !== -1) {
        matchSchedule[matchIndex].s1 = (winner === p1) ? ptsWinner : ptsLoser;
        matchSchedule[matchIndex].s2 = (winner === p2) ? ptsWinner : ptsLoser;
        matchSchedule[matchIndex].score1 = score1;
        matchSchedule[matchIndex].score2 = score2;
        matchSchedule[matchIndex].style1 = (winner === p1) ? (winnerAvecManiere ? 'avec' : 'sans') : (loserAvecManiere ? 'avec' : 'sans');
        matchSchedule[matchIndex].style2 = (winner === p2) ? (winnerAvecManiere ? 'avec' : 'sans') : (loserAvecManiere ? 'avec' : 'sans');
    }

    saveMatchResult(p1, p2, score1, score2, ptsWinner, ptsLoser, winnerAvecManiere, loserAvecManiere, winner, loser);

    const message = `
        🏆 Match terminé !
        ${p1} : ${score1} pts ${score1 >= SEUIL_MANIERE ? '✅ avec manière' : '❌ sans manière'}
        ${p2} : ${score2} pts ${score2 >= SEUIL_MANIERE ? '✅ avec manière' : '❌ sans manière'}
        Points classement : ${winner} = ${ptsWinner} pts, ${loser} = ${ptsLoser} pts
    `;
    alert(message);

    currentMatch = null;
    renderMatchSetup();
};

function saveMatchResult(p1, p2, score1, score2, pts1, pts2, avecManiere1, avecManiere2, winner = null, loser = null) {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const resultRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/badminton/results/${currentMatch.id}`);

    const data = {
        terrain: currentTerrain,
        p1, p2,
        score1, score2,
        pts1, pts2,
        avecManiere1, avecManiere2,
        winner: winner || (score1 > score2 ? p1 : p2),
        loser: loser || (score1 > score2 ? p2 : p1),
        timestamp: Date.now()
    };

    update(resultRef, data)
        .then(() => console.log('✅ Résultat sauvegardé'))
        .catch(err => alert("Erreur envoi : " + err.message));
}

// ============================================================
// 6. ÉCOUTE DES SCORES
// ============================================================

function listenForScoreUpdates() {
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