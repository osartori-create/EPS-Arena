// src/js/modules/badminton/badminton-maniere.js
// Mode "Avec la manière" : cases à cocher, points dangereux/centraux
// Version avec arrêt automatique à 11 points, bonus ET seuil "Avec la manière" paramétrables
// Colorisation garantie avec appearance: none

import { 
    currentTerrain, matchSchedule, playersList, terrainsConfig,
    renderMatchSetup, renderClassement, currentClasse
} from './badminton-common.js';

import { db, ref, update } from '../../core/firebase-service.js';

// ============================================================
// CONSTANTES
// ============================================================

const SEUIL_GAGNANT = 11;
let BONUS_MANIERE = 5;

// ============================================================
// ÉTAT
// ============================================================

let matchPoints = { p1: 0, p2: 0 };
let stats = {
    p1: { danger: 0, center: 0 },
    p2: { danger: 0, center: 0 }
};
let checkboxes = {
    p1: { danger: Array(10).fill(false), center: Array(10).fill(false) },
    p2: { danger: Array(10).fill(false), center: Array(10).fill(false) }
};
let matchTermine = false;

// ============================================================
// INITIALISATION DU MODE
// ============================================================

export async function init(classe, config) {
    console.log('📊 [Maniere] Mode "Avec la manière" initialisé');

    if (config && config.bonusManiere) {
        BONUS_MANIERE = Math.max(3, Math.min(8, parseInt(config.bonusManiere) || 5));
        console.log(`📊 [Maniere] Bonus ET Seuil "Avec la manière" : ${BONUS_MANIERE} pts`);
    }

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
        matchTermine = false;
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
// RENDU DES CASES À COCHER (AVEC APPEARANCE: NONE)
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

    // ✅ Styles avec appearance: none pour garantir la couleur
    function getDangerStyle(index, checked) {
        const isBonus = (index + 1) >= BONUS_MANIERE;
        const baseStyle = 'appearance: none; -webkit-appearance: none; width: 2.5rem; height: 2.5rem; border-radius: 0.5rem; cursor: pointer; transition: all 0.15s;';
        if (checked) {
            return baseStyle + (isBonus 
                ? 'background-color: #34d399; border: 2px solid #ffffff; opacity: 1;' 
                : 'background-color: #059669; border: 2px solid #ffffff; opacity: 1;');
        } else {
            return baseStyle + (isBonus 
                ? 'background-color: #064e3b; border: 2px solid #34d399; opacity: 0.7;' 
                : 'background-color: #1a2e3a; border: 2px solid #065f46; opacity: 0.7;');
        }
    }

    function getCenterStyle(index, checked) {
        const isRouge = (index + 1) >= 7;
        const baseStyle = 'appearance: none; -webkit-appearance: none; width: 2.5rem; height: 2.5rem; border-radius: 0.5rem; cursor: pointer; transition: all 0.15s;';
        if (checked) {
            return baseStyle + (isRouge 
                ? 'background-color: #f87171; border: 2px solid #ffffff; opacity: 1;' 
                : 'background-color: #dc2626; border: 2px solid #ffffff; opacity: 1;');
        } else {
            return baseStyle + (isRouge 
                ? 'background-color: #7f1d1d; border: 2px solid #f87171; opacity: 0.7;' 
                : 'background-color: #2a1a1a; border: 2px solid #7f1d1d; opacity: 0.7;');
        }
    }

    function renderCheckboxes(player, playerId) {
        let html = '';
        
        // Zone dangereuse (VERT)
        html += `<div class="mb-4">
            <p class="text-sm font-bold text-emerald-400 uppercase mb-2">🟢 Points gagnés en zone dangereuse (Bonus : ${BONUS_MANIERE} pts)</p>
            <div class="grid grid-cols-5 gap-2">`;
        for (let i = 0; i < 10; i++) {
            const checked = checkboxes[player].danger[i] ? 'checked' : '';
            const style = getDangerStyle(i, checked);
            html += `
                <div class="flex items-center justify-center">
                    <input type="checkbox" 
                           style="${style}"
                           data-player="${player}" data-zone="danger" data-index="${i}" 
                           ${checked} 
                           onchange="window.updateCheckbox(this)">
                    <span class="absolute text-[10px] font-bold text-white/70 pointer-events-none" style="text-shadow: 0 0 4px rgba(0,0,0,0.8);">${i+1}</span>
                </div>
            `;
        }
        html += `</div>
            <div class="flex justify-between text-[10px] text-slate-500 mt-1 px-1">
                <span>1</span>
                <span class="text-emerald-400">🔹 Bonus & "Avec la manière" à partir de ${BONUS_MANIERE}</span>
                <span>10</span>
            </div>
        </div>`;

        // Zone centrale (ROUGE)
        html += `<div>
            <p class="text-sm font-bold text-red-400 uppercase mb-2">🔴 Points gagnés en zone centrale</p>
            <div class="grid grid-cols-5 gap-2">`;
        for (let i = 0; i < 10; i++) {
            const checked = checkboxes[player].center[i] ? 'checked' : '';
            const style = getCenterStyle(i, checked);
            html += `
                <div class="flex items-center justify-center">
                    <input type="checkbox" 
                           style="${style}"
                           data-player="${player}" data-zone="center" data-index="${i}" 
                           ${checked} 
                           onchange="window.updateCheckbox(this)">
                    <span class="absolute text-[10px] font-bold text-white/70 pointer-events-none" style="text-shadow: 0 0 4px rgba(0,0,0,0.8);">${i+1}</span>
                </div>
            `;
        }
        html += `</div>
            <div class="flex justify-between text-[10px] text-slate-500 mt-1 px-1">
                <span>1</span>
                <span class="text-red-400">🔹 Zone rouge à partir de 7</span>
                <span>10</span>
            </div>
        </div>`;

        // Compteurs
        const totalDanger = checkboxes[player].danger.filter(Boolean).length;
        const totalCenter = checkboxes[player].center.filter(Boolean).length;
        const total = totalDanger + totalCenter;
        
        html += `
            <div class="mt-4 grid grid-cols-3 gap-2 text-center text-sm font-bold">
                <div class="bg-emerald-900/30 p-2 rounded-lg border border-emerald-500">
                    <span class="text-emerald-400">Dangereuse</span><br>
                    <span id="danger-counter-${playerId}" class="text-2xl text-white">${totalDanger}</span>
                </div>
                <div class="bg-red-900/30 p-2 rounded-lg border border-red-500">
                    <span class="text-red-400">Centrale</span><br>
                    <span id="center-counter-${playerId}" class="text-2xl text-white">${totalCenter}</span>
                </div>
                <div class="bg-yellow-900/30 p-2 rounded-lg border border-yellow-500">
                    <span class="text-yellow-400">Total</span><br>
                    <span id="total-counter-${playerId}" class="text-2xl text-yellow-400">${total}</span>
                </div>
            </div>
        `;
        return html;
    }

    container.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <div class="text-center w-1/3">
                <h3 class="text-2xl font-black text-white">${p1}</h3>
                <div class="text-xs text-slate-400">Score : <span id="score-p1" class="font-bold text-yellow-400 text-lg">0</span></div>
            </div>
            <div class="text-center w-1/3">
                <h3 class="text-2xl font-black text-white">vs</h3>
                <div class="text-xs text-slate-400">Seuil "Avec la manière" : <span class="text-yellow-400 font-bold">${BONUS_MANIERE} pts</span></div>
                <div class="text-xs text-emerald-400">Bonus : <span class="font-bold">${BONUS_MANIERE}</span> pts</div>
                <div class="text-xs text-slate-500">🏆 Victoire à <span class="font-bold text-yellow-400">${SEUIL_GAGNANT}</span> pts</div>
            </div>
            <div class="text-center w-1/3">
                <h3 class="text-2xl font-black text-white">${p2}</h3>
                <div class="text-xs text-slate-400">Score : <span id="score-p2" class="font-bold text-yellow-400 text-lg">0</span></div>
            </div>
        </div>

        <div class="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-4">
            <p class="text-xs text-slate-400 text-center">Cliquez sur les cases pour enregistrer les points (10 essais max par zone)</p>
            <p class="text-xs text-slate-500 text-center mt-1">🟢 Cases vertes = bonus "Avec la manière" (≥ ${BONUS_MANIERE}) | 🔴 Zone rouge à partir de 7</p>
            <p class="text-xs text-yellow-400 text-center mt-1">🏆 "Avec la manière" = score ≥ ${BONUS_MANIERE} pts</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <h4 class="text-lg font-black text-white text-center mb-2">${p1}</h4>
                ${renderCheckboxes('p1', 'p1')}
            </div>
            <div class="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <h4 class="text-lg font-black text-white text-center mb-2">${p2}</h4>
                ${renderCheckboxes('p2', 'p2')}
            </div>
        </div>

        <div class="flex flex-wrap justify-center gap-3 mt-4">
            <button onclick="window.resetMatch()" class="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors">🔄 Reset</button>
            <button onclick="window.endMatchManiere()" class="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-xl font-black text-sm transition-colors">🏁 Valider le match</button>
        </div>
    `;

    updateScores();
}

// ============================================================
// GESTION DES CASES À COCHER (AVEC APPEARANCE: NONE)
// ============================================================

window.updateCheckbox = function(checkbox) {
    if (matchTermine) return;

    const player = checkbox.dataset.player;
    const zone = checkbox.dataset.zone;
    const index = parseInt(checkbox.dataset.index);
    
    checkboxes[player][zone][index] = checkbox.checked;
    
    const isDanger = zone === 'danger';
    const isBonus = isDanger && (index + 1) >= BONUS_MANIERE;
    const isRouge = !isDanger && (index + 1) >= 7;
    
    const baseStyle = 'appearance: none; -webkit-appearance: none; width: 2.5rem; height: 2.5rem; border-radius: 0.5rem; cursor: pointer; transition: all 0.15s;';
    let style = baseStyle;
    if (isDanger) {
        if (checkbox.checked) {
            style += isBonus 
                ? 'background-color: #34d399; border: 2px solid #ffffff; opacity: 1;' 
                : 'background-color: #059669; border: 2px solid #ffffff; opacity: 1;';
        } else {
            style += isBonus 
                ? 'background-color: #064e3b; border: 2px solid #34d399; opacity: 0.7;' 
                : 'background-color: #1a2e3a; border: 2px solid #065f46; opacity: 0.7;';
        }
    } else {
        if (checkbox.checked) {
            style += isRouge 
                ? 'background-color: #f87171; border: 2px solid #ffffff; opacity: 1;' 
                : 'background-color: #dc2626; border: 2px solid #ffffff; opacity: 1;';
        } else {
            style += isRouge 
                ? 'background-color: #7f1d1d; border: 2px solid #f87171; opacity: 0.7;' 
                : 'background-color: #2a1a1a; border: 2px solid #7f1d1d; opacity: 0.7;';
        }
    }
    
    checkbox.style.cssText = style;
    
    updateScores();
};

// ============================================================
// MISE À JOUR DES SCORES ET COMPTEURS
// ============================================================

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

    const counters = [
        { id: 'danger-counter-p1', value: dangerP1 },
        { id: 'center-counter-p1', value: centerP1 },
        { id: 'total-counter-p1', value: matchPoints.p1 },
        { id: 'danger-counter-p2', value: dangerP2 },
        { id: 'center-counter-p2', value: centerP2 },
        { id: 'total-counter-p2', value: matchPoints.p2 }
    ];
    
    counters.forEach(c => {
        const el = document.getElementById(c.id);
        if (el) el.innerText = c.value;
    });

    if (!matchTermine && (matchPoints.p1 >= SEUIL_GAGNANT || matchPoints.p2 >= SEUIL_GAGNANT)) {
        matchTermine = true;
        setTimeout(() => {
            window.endMatchManiere();
        }, 500);
    }
}

// ============================================================
// RESET
// ============================================================

window.resetMatch = function() {
    if (matchTermine) {
        matchTermine = false;
    }
    checkboxes = {
        p1: { danger: Array(10).fill(false), center: Array(10).fill(false) },
        p2: { danger: Array(10).fill(false), center: Array(10).fill(false) }
    };
    renderCourtInterface();
};

// ============================================================
// FIN DE MATCH (avec seuil = BONUS_MANIERE)
// ============================================================

window.endMatchManiere = function() {
    const currentMatch = matchSchedule.find(m => m.id === window.currentMatchId);
    if (!currentMatch) return;

    if (matchTermine && matchSchedule.find(m => m.id === window.currentMatchId)?.s1 !== null) {
        return;
    }

    const p1 = currentMatch.p1;
    const p2 = currentMatch.p2;
    const score1 = matchPoints.p1;
    const score2 = matchPoints.p2;

    const estArretAuto = (score1 >= SEUIL_GAGNANT || score2 >= SEUIL_GAGNANT);
    let messageAuto = '';
    if (estArretAuto) {
        const gagnant = score1 >= SEUIL_GAGNANT ? p1 : p2;
        messageAuto = `🏆 ${gagnant} a atteint ${SEUIL_GAGNANT} points ! Match terminé automatiquement.`;
    }

    let winner, loser, winnerScore, loserScore;
    if (score1 > score2) {
        winner = p1; loser = p2; winnerScore = score1; loserScore = score2;
    } else if (score2 > score1) {
        winner = p2; loser = p1; winnerScore = score2; loserScore = score1;
    } else {
        const avecManiere1 = score1 >= BONUS_MANIERE;
        const avecManiere2 = score2 >= BONUS_MANIERE;
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
        const msg = `${messageAuto}\n\nMatch nul ! ${p1} ${score1} pts, ${p2} ${score2} pts`;
        alert(msg);
        window.currentMatchId = null;
        matchTermine = false;
        renderMatchSetup();
        return;
    }

    const winnerAvecManiere = winnerScore >= BONUS_MANIERE;
    const loserAvecManiere = loserScore >= BONUS_MANIERE;

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

    const msg = `
        ${messageAuto}
        🏆 Match terminé !
        ${p1} : ${score1} pts ${score1 >= BONUS_MANIERE ? '✅ avec manière' : '❌ sans manière'}
        ${p2} : ${score2} pts ${score2 >= BONUS_MANIERE ? '✅ avec manière' : '❌ sans manière'}
        Points classement : ${winner} = ${ptsWinner} pts, ${loser} = ${ptsLoser} pts
    `;
    alert(msg);

    window.currentMatchId = null;
    matchTermine = false;
    renderMatchSetup();
};

// ============================================================
// SAUVEGARDE FIREBASE
// ============================================================

function saveMatchResult(p1, p2, score1, score2, pts1, pts2, avecManiere1, avecManiere2, winner = null, loser = null) {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const classe = currentClasse || document.querySelector('#class-select')?.value || '';
    const resultRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/badminton/results/${window.currentMatchId}`);

    const data = {
        terrain: currentTerrain,
        p1, p2,
        score1, score2,
        pts1, pts2,
        avecManiere1, avecManiere2,
        bonusManiere: BONUS_MANIERE,
        winner: winner || (score1 > score2 ? p1 : p2),
        loser: loser || (score1 > score2 ? p2 : p1),
        timestamp: Date.now()
    };

    update(resultRef, data)
        .then(() => console.log('✅ [Maniere] Résultat sauvegardé'))
        .catch(err => alert("Erreur envoi : " + err.message));
}