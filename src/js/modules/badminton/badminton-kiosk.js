// src/js/modules/badminton/badminton-kiosk.js
// Interface élève : Sélection Terrain -> Joueur -> Match visuel sur terrain
// Inspiré et adapté de BadZ Impact (Webjéjé) et du module EPS-Arena.
// Licence Creative Commons Attribution (CC BY).

import { db, ref, onValue, update, push } from '../../core/firebase-service.js';

let currentClasse = '';
let currentTerrain = '';
let currentCode = ''; // Ma lettre (A, B, C...)
let opponentCode = ''; // Lettre adverse
let playersList = [];
let matchSchedule = [];
let currentMatch = null;
let matchPoints = { p1: 0, p2: 0 }; // Scores du match en cours
let ratioData = { p1: { middle: 0, extreme: 0 }, p2: { middle: 0, extreme: 0 } }; // Ratios
let terrainsConfig = {};

export function initBadmintonKiosk(classe) {
    currentClasse = classe;
    currentTerrain = '';
    currentCode = '';
    opponentCode = '';
    
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const configRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/config`);

    onValue(configRef, (snap) => {
        const config = snap.val() || {};
        if (config.activite !== 'badminton') return;

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
    findNextMatch();
};

window.resetBadmintonSelection = function() {
    currentTerrain = '';
    currentCode = '';
    opponentCode = '';
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

function findNextMatch() {
    // On cherche un match concernant l'élève, sinon on regarde les autres pour patienter
    let match = matchSchedule.find(m => (m.p1 === currentCode || m.p2 === currentCode) && m.s1 === null);
    if (!match) match = matchSchedule.find(m => m.s1 === null);

    if (!match) {
        renderStandings();
        document.getElementById('badminton-content').innerHTML = `
            <div class="text-center bg-slate-800 p-10 rounded-3xl border border-slate-700">
                <div class="text-6xl mb-4">🏆</div>
                <p class="text-2xl font-black text-white">Tous les matchs sont terminés !</p>
                <p class="text-slate-400 mt-2">Regardez le classement ci-dessous.</p>
            </div>` + document.getElementById('badminton-content').innerHTML;
        return;
    }

    currentMatch = match;
    opponentCode = match.p1 === currentCode ? match.p2 : match.p1;
    matchPoints = { p1: 0, p2: 0 };
    ratioData = { p1: { middle: 0, extreme: 0 }, p2: { middle: 0, extreme: 0 } };
    
    renderCourtInterface();
}

// --- 4. INTERFACE DU TERRAIN (Inspirée de BadZ) ---
function renderCourtInterface() {
    const container = document.getElementById('badminton-content');
    let html = `
        <div class="flex justify-between items-center mb-4">
            <div class="text-center">
                <h3 class="text-xl font-black text-white">${currentCode}</h3>
                <p class="text-xs text-slate-400">Vous</p>
            </div>
            <div class="text-center">
                <h3 class="text-3xl font-black text-yellow-400">${matchPoints.p1} - ${matchPoints.p2}</h3>
                <p class="text-xs text-slate-400">Score du match</p>
            </div>
            <div class="text-center">
                <h3 class="text-xl font-black text-white">${opponentCode}</h3>
                <p class="text-xs text-slate-400">Adversaire</p>
            </div>
        </div>

        <div id="court-container" class="relative w-full max-w-2xl mx-auto mb-6 border-4 border-slate-600 rounded-2xl overflow-hidden shadow-2xl" style="aspect-ratio: 2/1; background: #166534;">
            <div class="absolute top-0 bottom-0 left-1/2 w-1 bg-black z-10"></div>
            <div class="grid grid-cols-2 h-full">
                <div id="left-side" class="relative border-r border-black/50">
                    <div class="absolute inset-0 flex flex-col">
                        <div onclick="handleImpact('p1', 'extreme')" class="flex-1 bg-green-700/30 hover:bg-green-700/60 transition-colors cursor-pointer flex items-center justify-center text-3xl font-black text-white">3 pts</div>
                        <div onclick="handleImpact('p1', 'middle')" class="flex-1 bg-teal-500/40 hover:bg-teal-500/70 transition-colors cursor-pointer flex items-center justify-center text-3xl font-black text-white">1 pt</div>
                        <div onclick="handleImpact('p1', 'extreme')" class="flex-1 bg-green-700/30 hover:bg-green-700/60 transition-colors cursor-pointer flex items-center justify-center text-3xl font-black text-white">3 pts</div>
                    </div>
                    <div id="p1-ratio" class="absolute bottom-2 left-2 bg-black/70 text-white px-3 py-1 rounded-lg text-xs font-bold">0%</div>
                </div>
                <div id="right-side" class="relative border-l border-black/50">
                    <div class="absolute inset-0 flex flex-col">
                        <div onclick="handleImpact('p2', 'extreme')" class="flex-1 bg-green-700/30 hover:bg-green-700/60 transition-colors cursor-pointer flex items-center justify-center text-3xl font-black text-white">3 pts</div>
                        <div onclick="handleImpact('p2', 'middle')" class="flex-1 bg-teal-500/40 hover:bg-teal-500/70 transition-colors cursor-pointer flex items-center justify-center text-3xl font-black text-white">1 pt</div>
                        <div onclick="handleImpact('p2', 'extreme')" class="flex-1 bg-green-700/30 hover:bg-green-700/60 transition-colors cursor-pointer flex items-center justify-center text-3xl font-black text-white">3 pts</div>
                    </div>
                    <div id="p2-ratio" class="absolute bottom-2 right-2 bg-black/70 text-white px-3 py-1 rounded-lg text-xs font-bold">0%</div>
                </div>
            </div>
            <div class="absolute top-0 left-0 right-0 bg-black/60 text-white py-2 text-center font-black">BadZ Impact</div>
        </div>
        
        <div class="flex justify-center gap-4">
            <button onclick="endMatch()" class="bg-red-600 hover:bg-red-700 text-white font-black py-3 px-6 rounded-2xl">🏁 Terminer le match</button>
            <button onclick="resetBadmintonSelection()" class="bg-slate-600 hover:bg-slate-500 text-white font-bold py-3 px-4 rounded-2xl">Quitter</button>
        </div>

        <div id="classement-terrain" class="mt-6 bg-slate-800 p-4 rounded-2xl border border-slate-700">
            <h3 class="font-black text-blue-400 uppercase text-sm mb-2">Classement</h3>
            <div id="classement-content" class="space-y-2"></div>
        </div>
    `;

    container.innerHTML = html;
    renderStandings();
}

// --- 5. GESTION DES CLICS (Impacts) ---
window.handleImpact = function(player, zone) {
    if (currentMatch.p1 !== currentCode && currentMatch.p2 !== currentCode) {
        // Ce n'est pas notre match, on ne peut pas cliquer pour l'autre
        return;
    }
    
    // On s'assure que le joueur qui clique est bien celui qui joue
    // (Dans une vraie interface, on pourrait autoriser les 2 joueurs à cliquer sur leur propre côté. Ici, seul le joueur connecté peut cliquer)
    if (player === 'p1' && currentMatch.p1 !== currentCode) return;
    if (player === 'p2' && currentMatch.p2 !== currentCode) return;

    let pts = zone === 'middle' ? 1 : 3;
    
    // Mise à jour des scores et ratios
    matchPoints[player] += pts;
    ratioData[player][zone]++;

    // Créer un effet visuel (point jaune clignotant)
    const sideId = player === 'p1' ? 'left-side' : 'right-side';
    const side = document.getElementById(sideId);
    const impact = document.createElement('div');
    impact.className = 'absolute w-4 h-4 bg-yellow-400 rounded-full shadow-lg transform -translate-x-1/2 -translate-y-1/2';
    impact.style.left = Math.random() * 80 + 10 + '%';
    impact.style.top = Math.random() * 80 + 10 + '%';
    side.appendChild(impact);
    setTimeout(() => impact.remove(), 700);

    // Mise à jour de l'affichage
    document.querySelector('.text-3xl.font-black.text-yellow-400').innerText = `${matchPoints.p1} - ${matchPoints.p2}`;
    
    const p1Total = ratioData.p1.extreme + ratioData.p1.middle;
    const p2Total = ratioData.p2.extreme + ratioData.p2.middle;
    document.getElementById('p1-ratio').innerText = `${p1Total > 0 ? Math.round((ratioData.p1.extreme / p1Total) * 100) : 0}%`;
    document.getElementById('p2-ratio').innerText = `${p2Total > 0 ? Math.round((ratioData.p2.extreme / p2Total) * 100) : 0}%`;
};

// --- 6. FIN DE MATCH ET ENVOI ---
window.endMatch = function() {
    if (!currentMatch) return;
    if (confirm(`Valider le score ${matchPoints.p1} - ${matchPoints.p2} ?`)) {
        // On envoie le score à Firebase
        const p1 = currentMatch.p1;
        const p2 = currentMatch.p2;
        const s1 = matchPoints.p1;
        const s2 = matchPoints.p2;

        const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
        const resultRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/badminton/results/${currentMatch.id}`);
        
        update(resultRef, { terrain: currentTerrain, p1, p2, s1, s2, timestamp: Date.now() })
        .then(() => {
            currentMatch.s1 = s1;
            currentMatch.s2 = s2;
            findNextMatch(); // On passe au match suivant
            listenForScoreUpdates();
        })
        .catch(err => alert("Erreur envoi : " + err.message));
    }
};

// --- 7. ÉCOUTE DES SCORES (synchronisation entre iPads) ---
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
        renderStandings();
    });
}

// --- 8. CLASSEMENT DU TERRAIN ---
function renderStandings() {
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