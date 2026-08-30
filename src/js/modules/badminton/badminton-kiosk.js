// src/js/modules/badminton/badminton-kiosk.js
// Interface élève : Sélection Terrain -> Joueur -> Tournoi Round Robin
// Inspiré et adapté de BadZ Impact (Webjéjé) et du module EPS-Arena.
// Licence Creative Commons Attribution (CC BY).

import { db, ref, onValue, update } from '../../core/firebase-service.js';

let currentClasse = '';
let currentTerrain = '';
let currentCode = '';
let playersList = [];
let matchSchedule = [];
let terrainsConfig = {};

export function initBadmintonKiosk(classe) {
    currentClasse = classe;
    currentTerrain = ''; // On réinitialise la sélection
    currentCode = '';
    
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const configRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/config`);

    onValue(configRef, (snap) => {
        const config = snap.val() || {};
        if (config.activite !== 'badminton') return;

        // On récupère le nombre de joueurs par terrain
        terrainsConfig = {};
        for (let key in config) {
            if (!isNaN(parseInt(key))) {
                terrainsConfig[parseInt(key)] = config[key];
            }
        }

        if (!currentTerrain) {
            renderTerrainSelection();
        } else {
            checkAndRenderPlayerSelection();
        }
    });
}

// --- 1. SÉLECTION DU TERRAIN ---
function renderTerrainSelection() {
    const container = document.getElementById('badminton-content');
    if (!container) return;

    let html = `<div class="bg-slate-800 p-6 rounded-2xl border border-slate-700 text-center">
        <h2 class="text-2xl font-black text-white mb-4">🏸 Choisis ton terrain</h2>
        <div class="grid grid-cols-2 gap-4">`;

    Object.keys(terrainsConfig).forEach(terrain => {
        html += `<button onclick="selectBadmintonTerrain(${terrain})" 
                    class="bg-blue-600 p-6 rounded-2xl font-black text-2xl text-white active:scale-95 transition-transform">
                    Terrain ${terrain}
                </button>`;
    });

    html += `</div></div>`;
    container.innerHTML = html;
}

window.selectBadmintonTerrain = function(terrain) {
    currentTerrain = terrain;
    checkAndRenderPlayerSelection();
};

// --- 2. SÉLECTION DU JOUEUR ---
function checkAndRenderPlayerSelection() {
    const container = document.getElementById('badminton-content');
    if (!container) return;

    const nbPlayers = terrainsConfig[currentTerrain] || 0;
    const lettres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    playersList = lettres.slice(0, nbPlayers);

    let html = `<div class="bg-slate-800 p-6 rounded-2xl border border-slate-700 text-center">
        <h2 class="text-xl font-black text-white mb-4">Terrain ${currentTerrain} - Choisis ton joueur</h2>
        <div class="grid grid-cols-2 gap-4">`;

    playersList.forEach(letter => {
        html += `<button onclick="selectBadmintonPlayer('${letter}')" 
                    class="bg-indigo-600 p-6 rounded-2xl font-black text-3xl text-white active:scale-95 transition-transform">
                    Joueur ${letter}
                </button>`;
    });

    html += `</div>
        <button onclick="resetBadmintonSelection()" class="mt-4 w-full bg-slate-600 py-2 rounded-xl font-bold text-white text-sm active:scale-95">← Changer de terrain</button>
    </div>`;

    container.innerHTML = html;
}

window.selectBadmintonPlayer = function(letter) {
    currentCode = letter;
    generateRoundRobin();
    renderGameInterface();
    listenForScoreUpdates();
};

window.resetBadmintonSelection = function() {
    currentTerrain = '';
    currentCode = '';
    renderTerrainSelection();
};

// --- 3. GÉNÉRATION DU ROUND ROBIN ---
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

// --- 4. INTERFACE DE JEU ---
function renderGameInterface() {
    const container = document.getElementById('badminton-content');
    container.innerHTML = `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 mb-4 text-center">
            <p class="text-sm text-slate-400">Terrain ${currentTerrain} - Vous êtes le joueur <span class="text-blue-400 font-black text-2xl">${currentCode}</span></p>
        </div>
        <div id="match-display" class="bg-slate-900 p-6 rounded-3xl border-4 border-blue-500 text-center mb-4"></div>
        <div id="classement-terrain" class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
            <h3 class="font-black text-blue-400 uppercase text-sm mb-2">Classement</h3>
            <div id="classement-content" class="space-y-2"></div>
        </div>
    `;
    displayNextMatch();
}

function displayNextMatch() {
    const display = document.getElementById('match-display');
    if (!display) return;

    let match = matchSchedule.find(m => (m.p1 === currentCode || m.p2 === currentCode) && m.s1 === null);
    if (!match) match = matchSchedule.find(m => m.s1 === null);

    if (!match) {
        display.innerHTML = `<div class="text-5xl mb-4">🏆</div><p class="text-xl font-black text-white mb-4">Tous les matchs sont terminés !</p><p class="text-slate-400">Consultez le classement.</p>`;
        updateStandings();
        return;
    }

    if (match.p1 !== currentCode && match.p2 !== currentCode) {
        display.innerHTML = `<p class="text-lg font-black text-white mb-2">Match en cours :</p><p class="text-4xl font-black text-yellow-400">${match.p1} vs ${match.p2}</p><p class="text-slate-400 mt-2">Ce n'est pas votre match, patientez...</p>`;
    } else {
        const opponent = match.p1 === currentCode ? match.p2 : match.p1;
        display.innerHTML = `
            <p class="text-lg font-black text-white mb-2">Votre prochain match :</p>
            <p class="text-4xl font-black text-yellow-400 mb-4">Vous (${currentCode}) vs ${opponent}</p>
            <div class="grid grid-cols-2 gap-4 mb-6">
                <div>
                    <label class="text-xs font-bold text-slate-400 uppercase">Votre score</label>
                    <input type="number" id="score-me" min="0" max="30" placeholder="21" class="w-full bg-slate-950 text-center text-4xl font-black text-white border-2 border-slate-600 rounded-xl p-2 mt-1">
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-400 uppercase">Score adverse</label>
                    <input type="number" id="score-opp" min="0" max="30" placeholder="0" class="w-full bg-slate-950 text-center text-4xl font-black text-white border-2 border-slate-600 rounded-xl p-2 mt-1">
                </div>
            </div>
            <button onclick="submitScore('${match.id}', '${match.p1}', '${match.p2}')" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-5 rounded-3xl text-xl uppercase active:scale-95 transition-transform">✅ Valider le score</button>
        `;
    }
}

// --- 5. ENVOI DU SCORE ---
window.submitScore = function(matchId, p1, p2) {
    const scoreMe = parseInt(document.getElementById('score-me').value);
    const scoreOpp = parseInt(document.getElementById('score-opp').value);

    if (isNaN(scoreMe) || isNaN(scoreOpp) || scoreMe < 0 || scoreOpp < 0) {
        alert("Veuillez saisir des scores valides.");
        return;
    }

    if (p1 !== currentCode && p2 !== currentCode) {
        alert("Vous ne pouvez pas valider ce match !");
        return;
    }

    let s1, s2;
    if (p1 === currentCode) {
        s1 = scoreMe; s2 = scoreOpp;
    } else {
        s1 = scoreOpp; s2 = scoreMe;
    }

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const resultRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/badminton/results/${matchId}`);
    
    update(resultRef, { terrain: currentTerrain, p1, p2, s1, s2, timestamp: Date.now() })
    .then(() => {
        const match = matchSchedule.find(m => m.id === matchId);
        if (match) { match.s1 = s1; match.s2 = s2; }
        displayNextMatch();
        updateStandings();
    })
    .catch(err => alert("Erreur envoi : " + err.message));
};

// --- 6. CLASSEMENT EN DIRECT ---
function listenForScoreUpdates() {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const resultsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/badminton/results`);
    
    onValue(resultsRef, (snap) => {
        const data = snap.val() || {};
        matchSchedule.forEach(m => {
            const result = data[m.id];
            if (result && result.terrain === currentTerrain) {
                m.s1 = result.s1;
                m.s2 = result.s2;
            }
        });
        if (document.getElementById('match-display') && !document.querySelector('#match-display input')) {
            displayNextMatch();
        }
        updateStandings();
    });
}

function updateStandings() {
    const container = document.getElementById('classement-content');
    if (!container) return;

    const standings = {};
    playersList.forEach(p => standings[p] = { pts: 0, wins: 0, losses: 0, diff: 0 });

    matchSchedule.forEach(m => {
        if (m.s1 === null) return;
        if (m.s1 > m.s2) {
            standings[m.p1].pts += 3; standings[m.p1].wins++; standings[m.p1].diff += (m.s1 - m.s2);
            standings[m.p2].losses++; standings[m.p2].diff -= (m.s1 - m.s2);
        } else {
            standings[m.p2].pts += 3; standings[m.p2].wins++; standings[m.p2].diff += (m.s2 - m.s1);
            standings[m.p1].losses++; standings[m.p1].diff -= (m.s2 - m.s1);
        }
    });

    const sorted = Object.entries(standings).sort((a, b) => b[1].pts - a[1].pts || b[1].diff - a[1].diff);
    let html = '';
    sorted.forEach(([player, data], idx) => {
        const isMe = player === currentCode ? 'bg-blue-900 border-blue-500' : 'bg-slate-900 border-slate-700';
        html += `<div class="flex items-center justify-between p-2 rounded-xl border ${isMe}">
                    <div class="flex items-center gap-3">
                        <span class="font-black text-slate-500 w-6">${idx + 1}</span>
                        <span class="font-black text-xl text-white">${player}</span>
                        ${isMe ? '<span class="text-[10px] text-blue-300">(Vous)</span>' : ''}
                    </div>
                    <div class="flex gap-4 text-xs font-black">
                        <span class="text-emerald-400">${data.wins} V</span>
                        <span class="text-red-400">${data.losses} D</span>
                        <span class="text-yellow-400">${data.pts} pts</span>
                    </div>
                </div>`;
    });
    container.innerHTML = html;
}