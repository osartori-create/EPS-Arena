// src/js/modules/badminton/badminton-maniere.js
// Mode "Avec la manière" : cases à cocher, points dangereux/centraux

import { 
    currentTerrain, matchSchedule, playersList, terrainsConfig,
    renderMatchSetup, renderClassement
} from './badminton-common.js';

const SEUIL_MANIERE = 8;

let matchPoints = { p1: 0, p2: 0 };
let stats = {
    p1: { danger: 0, center: 0 },
    p2: { danger: 0, center: 0 }
};
let checkboxes = {
    p1: { danger: Array(10).fill(false), center: Array(10).fill(false) },
    p2: { danger: Array(10).fill(false), center: Array(10).fill(false) }
};

// ============================================================
// INITIALISATION DU MODE
// ============================================================

export async function init(classe, config) {
    console.log('📊 [Maniere] Mode "Avec la manière" initialisé');

    // Surcharger selectMatchFromList
    window.selectMatchFromList = function(matchId) {
        const match = matchSchedule.find(m => m.id === matchId);
        if (!match || match.s1 !== null) return;
        window.currentMatchId = matchId;
        matchPoints = { p1: 0, p2: 0 };
        stats = { p1: { danger: 0, center: 0 }, p2: { danger: 0, center: 0 } };
        checkboxes = {
            p1: { danger: Array(10).fill(false), center: Array(10).fill(false) },
            p2: { danger: Array(10).fill(false), center: Array(10).fill(false) }
        };
        renderCourtInterface();
    };

    return () => {
        console.log('🧹 [Maniere] Nettoyage');
        window.selectMatchFromList = function(matchId) {
            console.warn('⚠️ selectMatchFromList appelée sans mode actif');
        };
    };
}

// ============================================================
// RENDU DES CASES À COCHER
// ============================================================

function renderCourtInterface() {
    const container = document.getElementById('court-zone');
    if (!container) return;

    const currentMatch = matchSchedule.find(m => m.id === window.currentMatchId);
    if (!currentMatch) {
        container.innerHTML = `<div class="text-center py-10"><p class="text-2xl font-black text-slate-500">Sélectionnez un match</p></div>`;
        return;
    }

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
            <button onclick="window.endMatchManiere()" class="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-xl font-black text-sm">🏁 Valider le match</button>
        </div>
    `;

    updateScores();
}

// ============================================================
// GESTION DES CASES À COCHER
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
// FIN DE MATCH
// ============================================================

window.endMatchManiere = function() {
    const currentMatch = matchSchedule.find(m => m.id === window.currentMatchId);
    if (!currentMatch) return;

    const p1 = currentMatch.p1;
    const p2 = currentMatch.p2;
    const score1 = matchPoints.p1;
    const score2 = matchPoints.p2;

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
        const matchIndex = matchSchedule.findIndex(m => m.id === window.currentMatchId);
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
        window.currentMatchId = null;
        renderMatchSetup();
        return;
    }

    const winnerAvecManiere = winnerScore >= SEUIL_MANIERE;
    const loserAvecManiere = loserScore >= SEUIL_MANIERE;

    let ptsWinner = winnerAvecManiere ? 5 : 3;
    let ptsLoser = loserAvecManiere ? 2 : 1;

    const matchIndex = matchSchedule.findIndex(m => m.id === window.currentMatchId);
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

    window.currentMatchId = null;
    renderMatchSetup();
};

function saveMatchResult(p1, p2, score1, score2, pts1, pts2, avecManiere1, avecManiere2, winner = null, loser = null) {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const currentClasse = document.querySelector('#class-select')?.value || '';
    const resultRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/badminton/results/${window.currentMatchId}`);

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
        .then(() => console.log('✅ [Maniere] Résultat sauvegardé'))
        .catch(err => alert("Erreur envoi : " + err.message));
}