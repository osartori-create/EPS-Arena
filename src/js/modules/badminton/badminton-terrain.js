// src/js/modules/badminton/badminton-terrain.js
// Mode "Terrain" : clic sur zones, classement V/D (3/1/0), chrono paramétrable

import {
    currentTerrain, matchSchedule, playersList, terrainsConfig,
    renderMatchSetup, renderClassement, renderTerrainSelection
} from './badminton-common.js';
import { db, ref, update } from '../../core/firebase-service.js';

// ============================================================
// ÉTAT
// ============================================================
let matchPoints = { p1: 0, p2: 0 };
let ratioData = {
    p1: { center: 0, extreme: 0, corner: 0, other: 0, fault: 0 },
    p2: { center: 0, extreme: 0, corner: 0, other: 0, fault: 0 }
};
let historyStack = [];
let redoStack = [];

let badmintonMode = 'frontback';
let badmintonCenterSize = 33;
let badmintonCenterPoints = 1;
let badmintonOtherPoints = 3;
let badmintonCornerPoints = 5;
let badmintonFaultPoints = 1;
let badmintonFaultPenalty = true;
let badmintonDureeMatch = 180; // secondes

// Chrono
let matchTimer = { interval: null, tempsRestant: 0, duree: 0, running: false };
let audioCtx = null;

// ============================================================
// CSS
// ============================================================
const WEBJEJE_CSS = `
    .court-wrapper { position: relative; width: 100%; max-width: 800px; margin: 0 auto; background-color: #8B4513; padding: 20px; }
    .court-wrapper.mode-3zones, .court-wrapper.mode-9zones { background-color: transparent; padding: 0; }
    .court { width: 100%; aspect-ratio: 2 / 1; background-color: #107C10; position: relative; border: 2px solid #ffffff; display: flex; }
    .net { width: 4px; height: 100%; background-color: #ffffff; position: absolute; left: 50%; transform: translateX(-50%); z-index: 10; pointer-events: none; }
    .player-area { width: 50%; height: 100%; position: relative; display: flex; }
    #area-p1 { border-right: 2px solid #fff; }
    #area-p2 { border-left: 2px solid #fff; }
    .layout-col { flex-direction: column; }
    .layout-row { flex-direction: row; }
    .layout-grid { flex-wrap: wrap; }
    .zone { border: 1px solid rgba(255, 255, 255, 0.4); display: flex; justify-content: center; align-items: center; font-size: 12px; font-weight: 600; color: white; cursor: pointer; position: relative; text-align: center; user-select: none; }
    .zone-extreme { background-color: rgba(232, 17, 35, 0.3); }
    .zone-center { background-color: rgba(0, 120, 215, 0.4); }
    .zone-corner { background-color: rgba(216, 59, 1, 0.4); }
    .zone-other { background-color: rgba(136, 23, 152, 0.3); }
    .fault-area { position: absolute; background-color: rgba(232, 17, 35, 0.6); display: flex; justify-content: center; align-items: center; font-size: 10px; color: white; cursor: pointer; font-weight: bold; }
    .fault-top, .fault-bottom { width: 45%; height: 20px; }
    .fault-left, .fault-right { width: 20px; height: calc(100% - 40px); top: 20px; }
    .fault-top { top: 0; } .fault-bottom { bottom: 0; }
    .fault-left { left: 0; } .fault-right { right: 0; }
    .fault-p1-top { left: 20px; } .fault-p2-top { right: 20px; }
    .fault-p1-bot { left: 20px; } .fault-p2-bot { right: 20px; }
    .impact { position: absolute; width: 12px; height: 12px; background-color: #FFB900; border: 2px solid #fff; transform: translate(-50%, -50%); z-index: 5; pointer-events: none; }
    .chrono-match { font-family: ui-monospace, monospace; font-variant-numeric: tabular-nums; }
    .chrono-match.alerte { color: #facc15; animation: pulse-chrono 1s ease-in-out infinite; }
    .chrono-match.termine { color: #ef4444; animation: pulse-chrono 0.5s ease-in-out infinite; }
    @keyframes pulse-chrono { 0%,100%{opacity:1;} 50%{opacity:0.4;} }
`;

// ============================================================
// AUDIO (bip de fin)
// ============================================================
function initAudio() {
    if (!audioCtx) {
        try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
        catch (e) {}
    }
}
function playBeep() {
    if (!audioCtx) return;
    try {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) {}
}

// ============================================================
// CHRONO
// ============================================================
function demarrerChrono() {
    stopChrono();
    if (badmintonDureeMatch <= 0) return;
    matchTimer.duree = badmintonDureeMatch;
    matchTimer.tempsRestant = badmintonDureeMatch;
    matchTimer.running = true;
    initAudio();
    updateChronoDisplay();

    matchTimer.interval = setInterval(() => {
        matchTimer.tempsRestant--;
        if (matchTimer.tempsRestant <= 0) {
            matchTimer.tempsRestant = 0;
            updateChronoDisplay();
            playBeep();
            setTimeout(playBeep, 250);
            setTimeout(playBeep, 500);
            stopChrono();
            return;
        }
        updateChronoDisplay();
    }, 1000);
}

function stopChrono() {
    if (matchTimer.interval) {
        clearInterval(matchTimer.interval);
        matchTimer.interval = null;
    }
    matchTimer.running = false;
}

function formatChrono(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function updateChronoDisplay() {
    const el = document.getElementById('chrono-match-display');
    if (!el) return;
    el.textContent = formatChrono(matchTimer.tempsRestant);
    el.className = 'chrono-match text-3xl font-black text-white';
    if (matchTimer.tempsRestant <= 10 && matchTimer.tempsRestant > 0) {
        el.classList.add('alerte');
    } else if (matchTimer.tempsRestant === 0) {
        el.classList.add('termine');
    }
}

// ============================================================
// INIT
// ============================================================
export async function init(classe, config) {
    console.log('🏸 [Terrain] Mode Terrain initialisé');

    badmintonMode = config.terrainType || 'frontback';
    badmintonCenterSize = config.centerSize || 33;
    badmintonCenterPoints = config.centerPoints || 1;
    badmintonOtherPoints = config.otherPoints || 3;
    badmintonCornerPoints = config.cornerPoints || 3;
    badmintonFaultPoints = config.faultPoints || 1;
    badmintonFaultPenalty = config.faultPenalty !== undefined ? config.faultPenalty : true;
    badmintonDureeMatch = config.dureeMatch || 180;

    window.selectMatchFromList = function(matchId) {
        const match = matchSchedule.find(m => m.id === matchId);
        if (!match || match.s1 !== null) return;
        window.currentMatchId = matchId;
        matchPoints = { p1: 0, p2: 0 };
        ratioData = {
            p1: { center: 0, extreme: 0, corner: 0, other: 0, fault: 0 },
            p2: { center: 0, extreme: 0, corner: 0, other: 0, fault: 0 }
        };
        historyStack = [];
        redoStack = [];
        renderCourtInterface();
        demarrerChrono(); // ✅ Démarre le chrono au lancement du match
    };

    setTimeout(() => {
        if (currentTerrain) renderMatchSetup();
        else renderTerrainSelection();
    }, 100);

    return () => {
        console.log('🧹 [Terrain] Nettoyage');
        stopChrono();
        window.selectMatchFromList = function(matchId) {
            console.warn('⚠️ selectMatchFromList sans mode actif');
        };
    };
}

// ============================================================
// RENDU DU TERRAIN
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
    const courtHTML = generateCourtHTML();

    container.innerHTML = `
        <style>${WEBJEJE_CSS}</style>

        <!-- CHRONO -->
        <div class="bg-slate-800 p-3 rounded-xl border-2 border-yellow-500/40 mb-3 flex justify-between items-center">
            <div>
                <div class="text-[10px] uppercase text-slate-400 font-bold">Match en cours</div>
                <div class="text-sm font-black text-white">${p1} vs ${p2}</div>
            </div>
            <div class="text-center">
                <div class="text-[10px] uppercase text-slate-400 font-bold">Temps restant</div>
                <div id="chrono-match-display" class="chrono-match text-3xl font-black text-white">${formatChrono(matchTimer.tempsRestant || badmintonDureeMatch)}</div>
            </div>
        </div>

        <div class="flex justify-between items-center mb-4">
            <div class="text-center w-1/3">
                <h3 class="text-3xl font-black text-white">${p1}</h3>
                <div id="ratio-p1" class="text-xs text-slate-400">Ratio : 0%</div>
            </div>
            <div class="text-center w-1/3">
                <h3 id="score-display" class="text-5xl font-black text-yellow-400">${matchPoints.p1} - ${matchPoints.p2}</h3>
            </div>
            <div class="text-center w-1/3">
                <h3 class="text-3xl font-black text-white">${p2}</h3>
                <div id="ratio-p2" class="text-xs text-slate-400">Ratio : 0%</div>
            </div>
        </div>

        <div class="bg-slate-800 p-3 rounded-xl border border-slate-700 mb-3">
            <div class="flex items-center gap-2">
                <label class="text-xs font-bold text-slate-400">Zone centrale : <span id="zone-size-display">${badmintonCenterSize}%</span></label>
                <input type="range" id="middle-zone-slider" min="20" max="60" value="${badmintonCenterSize}" step="1" class="w-full">
            </div>
            <div class="flex justify-center gap-4 mt-2 text-xs text-slate-400 flex-wrap">
                <span><span class="inline-block w-3 h-3 bg-blue-500 rounded-sm"></span> Centre ${badmintonCenterPoints}pt</span>
                <span><span class="inline-block w-3 h-3 bg-purple-500 rounded-sm"></span> Zone ${badmintonOtherPoints}pt</span>
                <span><span class="inline-block w-3 h-3 bg-orange-500 rounded-sm"></span> Coin ${badmintonCornerPoints}pt</span>
                <span><span class="inline-block w-3 h-3 bg-red-500 rounded-sm"></span> Faute ${badmintonFaultPenalty ? badmintonFaultPoints+'pt' : '0pt'}</span>
            </div>
        </div>

        <div class="flex justify-between items-center gap-4 mb-3">
            <button onclick="window.faultPlayer('p1')" class="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-xl font-bold text-sm transition-colors shadow-lg">🟥 Faute ${p1}</button>
            <button onclick="window.faultPlayer('p2')" class="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-xl font-bold text-sm transition-colors shadow-lg">🟥 Faute ${p2}</button>
        </div>

        <div id="court">${courtHTML}</div>

        <div class="flex flex-wrap justify-center gap-3 mt-3">
            <button onclick="undoImpact()" class="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-xl font-bold text-sm">↩ Annuler</button>
            <button onclick="resetCourt()" class="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-xl font-bold text-sm">Reset</button>
            <button onclick="endMatch()" class="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-xl font-black text-sm">🏁 Terminer le match</button>
        </div>
    `;

    // Slider
    const slider = document.getElementById('middle-zone-slider');
    const display = document.getElementById('zone-size-display');
    if (slider) {
        slider.addEventListener('input', function() { display.innerText = this.value + '%'; });
        slider.addEventListener('change', function() {
            const newVal = parseInt(this.value);
            if (newVal !== badmintonCenterSize) {
                badmintonCenterSize = newVal;
                renderCourtInterface();
            }
        });
    }

    // Écouteurs terrain
    const court = document.getElementById('court');
    if (court) {
        const newCourt = court.cloneNode(true);
        court.parentNode.replaceChild(newCourt, court);
        newCourt.addEventListener('click', handleImpact);
        newCourt.addEventListener('touchstart', handleTouch, { passive: false });
    }
}

// ============================================================
// GÉNÉRATION DU TERRAIN
// ============================================================
function generateCourtHTML() {
    const m = badmintonMode;
    const is9 = m === '4corners';
    const cSize = badmintonCenterSize;
    const sideSize = (100 - cSize) / 2;

    let pClass = is9 ? 'layout-grid' : (m === 'leftright' ? 'layout-row' : 'layout-col');
    const style3Z = (i) => m === 'frontback' ? (i===1 ? `width:100%;height:${cSize}%` : `width:100%;height:${sideSize}%`) : (i===1 ? `width:${cSize}%;height:100%` : `width:${sideSize}%;height:100%`);
    const style9Z = (i) => `width:${(i%3===1) ? cSize : sideSize}%;height:${(Math.floor(i/3)===1) ? cSize : sideSize}%`;

    const genZones = (playerCode) => {
        let zones = '';
        if (!is9) {
            const pts = [badmintonOtherPoints, badmintonCenterPoints, badmintonOtherPoints];
            const types = ['extreme', 'center', 'extreme'];
            const colors = ['zone-extreme', 'zone-center', 'zone-extreme'];
            for (let i=0; i<3; i++) {
                zones += `<div class="zone ${colors[i]}" data-points="${pts[i]}" data-player="${playerCode}" data-type="${types[i]}" style="${style3Z(i)}">${pts[i]}</div>`;
            }
        } else {
            const types = ['corner','other','corner','other','center','other','corner','other','corner'];
            const ptsMap = { center: badmintonCenterPoints, other: badmintonOtherPoints, corner: badmintonCornerPoints };
            const colorsMap = { center: 'zone-center', other: 'zone-other', corner: 'zone-corner' };
            for (let i=0; i<9; i++) {
                const type = types[i];
                const pts = ptsMap[type] || 0;
                const color = colorsMap[type] || '';
                zones += `<div class="zone ${color}" data-points="${pts}" data-player="${playerCode}" data-type="${type}" style="${style9Z(i)}">${pts}</div>`;
            }
        }
        return zones;
    };

    let faultHtml = '';
    if (is9) {
        const fPt = badmintonFaultPenalty ? badmintonFaultPoints : 0;
        const fLabel = badmintonFaultPenalty ? `F ${fPt}` : 'F 0';
        faultHtml = `
            <div class="fault-area fault-top fault-p1-top" data-points="${fPt}" data-player="p2" data-type="fault">${fLabel}</div>
            <div class="fault-area fault-top fault-p2-top" data-points="${fPt}" data-player="p1" data-type="fault">${fLabel}</div>
            <div class="fault-area fault-bottom fault-p1-bot" data-points="${fPt}" data-player="p2" data-type="fault">${fLabel}</div>
            <div class="fault-area fault-bottom fault-p2-bot" data-points="${fPt}" data-player="p1" data-type="fault">${fLabel}</div>
            <div class="fault-area fault-left" data-points="${fPt}" data-player="p2" data-type="fault">${fLabel}</div>
            <div class="fault-area fault-right" data-points="${fPt}" data-player="p1" data-type="fault">${fLabel}</div>
        `;
    }

    return `<div class="court-wrapper ${is9?'mode-9zones':'mode-3zones'}">
        <div class="court">
            <div class="player-area ${pClass}" id="area-p1">${genZones('p1')}</div>
            <div class="net"></div>
            <div class="player-area ${pClass}" id="area-p2">${genZones('p2')}</div>
        </div>
        ${faultHtml}
    </div>`;
}

// ============================================================
// INTERACTIONS
// ============================================================
function handleImpact(e) {
    const target = e.target.closest('.zone, .fault-area');
    if (!target) return;

    const wrapper = document.getElementById('court').querySelector('.court-wrapper');
    const rect = wrapper.getBoundingClientRect();
    const impact = document.createElement('div');
    impact.className = 'impact';
    impact.style.left = (e.clientX - rect.left) + 'px';
    impact.style.top = (e.clientY - rect.top) + 'px';
    wrapper.appendChild(impact);

    const points = parseInt(target.getAttribute('data-points')) || 0;
    const targetSide = target.getAttribute('data-player');
    const scoringPlayer = targetSide === 'p1' ? 'p2' : 'p1';
    const zoneType = target.getAttribute('data-type') || 'extreme';

    applyScore(scoringPlayer, points, zoneType, 1);
    historyStack.push({ impact, scoringPlayer, points, zoneType });
    redoStack = [];
}

function handleTouch(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    handleImpact({ target: element, clientX: touch.clientX, clientY: touch.clientY });
}

function applyScore(player, points, zoneType, multiplier) {
    matchPoints[player] += points * multiplier;
    if (!ratioData[player][zoneType]) ratioData[player][zoneType] = 0;
    ratioData[player][zoneType] += multiplier;
    updateDashboard();
}

function updateDashboard() {
    const el = document.getElementById('score-display');
    if (el) el.innerText = `${matchPoints.p1} - ${matchPoints.p2}`;
    const r1 = document.getElementById('ratio-p1');
    const r2 = document.getElementById('ratio-p2');
    if (r1) r1.innerText = `Ratio : ${calcRatio('p1')}%`;
    if (r2) r2.innerText = `Ratio : ${calcRatio('p2')}%`;
}

function calcRatio(player) {
    const s = ratioData[player];
    const total = s.center + (badmintonMode === '4corners' ? (s.fault + s.other + s.corner) : s.extreme);
    if (total === 0) return 0;
    const ext = (badmintonMode === '4corners') ? (s.corner + s.other + s.fault) : s.extreme;
    return Math.round((ext / total) * 100);
}

function undoImpact() {
    if (historyStack.length === 0) return;
    const last = historyStack.pop();
    last.impact.remove();
    applyScore(last.scoringPlayer, last.points, last.zoneType, -1);
    redoStack.push(last);
}

function resetCourt() {
    document.querySelectorAll('.impact').forEach(el => el.remove());
    matchPoints = { p1: 0, p2: 0 };
    ratioData = {
        p1: { center: 0, extreme: 0, corner: 0, other: 0, fault: 0 },
        p2: { center: 0, extreme: 0, corner: 0, other: 0, fault: 0 }
    };
    historyStack = [];
    redoStack = [];
    updateDashboard();
}

window.faultPlayer = function(player) {
    const scoringPlayer = player === 'p1' ? 'p2' : 'p1';
    const fPt = badmintonFaultPenalty ? badmintonFaultPoints : 0;
    if (fPt === 0) return alert('Les fautes ne sont pas pénalisées');
    applyScore(scoringPlayer, fPt, 'fault', 1);
    const wrapper = document.querySelector('.court-wrapper');
    if (wrapper) {
        const rect = wrapper.getBoundingClientRect();
        const impact = document.createElement('div');
        impact.className = 'impact';
        impact.style.left = (rect.width/2) + 'px';
        impact.style.top = (rect.height/2) + 'px';
        wrapper.appendChild(impact);
        historyStack.push({ impact, scoringPlayer, points: fPt, zoneType: 'fault' });
        redoStack = [];
    }
};

window.undoImpact = undoImpact;
window.resetCourt = resetCourt;

// ============================================================
// FIN DE MATCH — SIMPLIFIÉ, PAS DE "MANIÈRE"
// ============================================================
window.endMatch = function() {
    const currentMatch = matchSchedule.find(m => m.id === window.currentMatchId);
    if (!currentMatch) return;

    const p1 = currentMatch.p1;
    const p2 = currentMatch.p2;
    const s1 = matchPoints.p1;
    const s2 = matchPoints.p2;

    if (!confirm(`Valider le score ${s1} - ${s2} ?`)) return;

    stopChrono();

    // Calcul V/D + points classement (3 victoire / 1 défaite / 0 forfait)
    let winner, loser, pts1, pts2;
    if (s1 === s2) {
        // Match nul : 2 points chacun
        winner = null; loser = null;
        pts1 = 2; pts2 = 2;
    } else if (s1 > s2) {
        winner = p1; loser = p2;
        pts1 = 3; pts2 = 1;
    } else {
        winner = p2; loser = p1;
        pts1 = 1; pts2 = 3;
    }

    const matchIndex = matchSchedule.findIndex(m => m.id === window.currentMatchId);
    const statsSnapshot = { p1: { ...ratioData.p1 }, p2: { ...ratioData.p2 } };

    if (matchIndex !== -1) {
        matchSchedule[matchIndex].s1 = pts1;
        matchSchedule[matchIndex].s2 = pts2;
        matchSchedule[matchIndex].score1 = s1;
        matchSchedule[matchIndex].score2 = s2;
        matchSchedule[matchIndex].stats = statsSnapshot;
    }

    saveMatchResult(p1, p2, s1, s2, pts1, pts2, statsSnapshot, winner, loser);

    let msg = `🏆 Match terminé !\n\n${p1} : ${s1} pts\n${p2} : ${s2} pts\n\n`;
    if (winner) {
        msg += `Gagnant : ${winner} (+${winner === p1 ? pts1 : pts2} pts classement)`;
    } else {
        msg += `Match nul (+${pts1} pts chacun)`;
    }
    alert(msg);

    window.currentMatchId = null;
    renderMatchSetup();
};

function saveMatchResult(p1, p2, score1, score2, pts1, pts2, stats, winner = null, loser = null) {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const currentClasse = document.querySelector('#class-select')?.value || '';
    const resultRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/badminton/results/${window.currentMatchId}`);

    const data = {
        mode: 'terrain',
        terrain: currentTerrain,
        p1, p2,
        score1, score2,
        pts1, pts2,
        stats: stats || null,
        winner: winner || null,
        loser: loser || null,
        timestamp: Date.now()
    };

    update(resultRef, data)
        .then(() => console.log('✅ [Terrain] Résultat sauvegardé'))
        .catch(err => alert("Erreur envoi : " + err.message));
}