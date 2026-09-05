// src/js/modules/badminton/badminton-kiosk.js
// Interface élève : Sélection Terrain -> Liste Round Robin -> Terrain 3D
// Code terrain adapté de BadZ Impact (Webjéjé) – structure et CSS exacts.

import { db, ref, onValue, update } from '../../core/firebase-service.js';

let currentClasse = '';
let currentTerrain = '';
let playersList = [];
let matchSchedule = [];
let currentMatch = null;
let matchPoints = { p1: 0, p2: 0 };
let stats = {
    p1: { center: 0, extreme: 0, corner: 0, other: 0, fault: 0 },
    p2: { center: 0, extreme: 0, corner: 0, other: 0, fault: 0 }
};
let terrainsConfig = {};
let history = [];
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

// ============================================================
// CSS Webjéjé (exact)
// ============================================================
const WEBJEJE_CSS = `
    .court-wrapper {
    position: relative;
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    background-color: #8B4513; /* Couleur bois pour le cadre */
    padding: 35px 30px; /* Plus de padding pour accueillir les fautes */
    transition: padding 0.3s ease;
    border-radius: 4px;
}

/* Le terrain lui-même */
.court {
    width: 100%;
    aspect-ratio: 2 / 1;
    background-color: #107C10;
    position: relative;
    border: 2px solid #ffffff;
    display: flex;
    overflow: hidden;
}

/* Filet */
.net {
    width: 4px;
    height: 100%;
    background-color: #ffffff;
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
    pointer-events: none;
}

/* Chaque moitié de terrain */
.player-area {
    width: 50%;
    height: 100%;
    position: relative;
    display: flex;
    overflow: visible; /* Permet aux fautes de déborder */
}
#area-p1 { border-right: 2px solid #fff; }
#area-p2 { border-left: 2px solid #fff; }

/* Dispositions des zones */
.layout-col { flex-direction: column; }
.layout-row { flex-direction: row; }
.layout-grid { flex-wrap: wrap; }

/* Zones de jeu */
.zone {
    border: 1px solid rgba(255, 255, 255, 0.4);
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 14px;
    font-weight: 700;
    color: white;
    cursor: pointer;
    position: relative;
    text-align: center;
    user-select: none;
    transition: opacity 0.15s;
}
.zone:hover { opacity: 0.8; }
.zone-extreme { background-color: rgba(232, 17, 35, 0.4); }
.zone-center { background-color: rgba(0, 120, 215, 0.4); }
.zone-corner { background-color: rgba(216, 59, 1, 0.4); }
.zone-other { background-color: rgba(136, 23, 152, 0.35); }

/* ============================================================
   ZONES DE FAUTE - PLUS LARGES ET À L'EXTÉRIEUR
   ============================================================ */

.fault-area {
    position: absolute;
    background-color: rgba(232, 17, 35, 0.75);
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 14px;
    font-weight: 700;
    color: white;
    cursor: pointer;
    z-index: 5;
    border: 1px solid rgba(255, 255, 255, 0.2);
    transition: opacity 0.15s;
    border-radius: 2px;
}
.fault-area:hover { opacity: 0.8; }

/* Fautes en haut et en bas - sur toute la largeur de la moitié */
.fault-top, .fault-bottom {
    width: 100%;
    height: 28px; /* Plus épais */
    left: 0;
}
.fault-top { top: -30px; } /* Décalé vers l'extérieur */
.fault-bottom { bottom: -30px; }

/* Fautes à gauche et à droite - sur toute la hauteur de la moitié */
.fault-left, .fault-right {
    width: 28px; /* Plus large */
    height: 100%;
    top: 0;
}
.fault-left { left: -30px; }
.fault-right { right: -30px; }

/* Pour le mode 9 zones uniquement */
.mode-9zones .fault-area { display: flex; }
.mode-3zones .fault-area { display: none; }

/* Points d'impact */
.impact {
    position: absolute;
    width: 14px;
    height: 14px;
    background-color: #FFB900;
    border: 2px solid #fff;
    transform: translate(-50%, -50%);
    z-index: 20;
    pointer-events: none;
    border-radius: 50%;
    box-shadow: 0 0 12px rgba(255, 185, 0, 0.6);
}
`;

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
        if (config.activite !== 'badminton') return;

        badmintonMode = config.mode || 'frontback';
        badmintonCenterSize = config.centerSize || 33;
        badmintonCenterPoints = config.centerPoints || 1;
        badmintonOtherPoints = config.otherPoints || 3;
        badmintonCornerPoints = config.cornerPoints || 5;
        badmintonFaultPoints = config.faultPoints || 1;
        badmintonFaultPenalty = config.faultPenalty !== undefined ? config.faultPenalty : true;

        terrainsConfig = {};
        for (let key in config) {
            if (!isNaN(parseInt(key))) {
                terrainsConfig[parseInt(key)] = config[key];
            }
        }

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
    let html = `<div class="bg-slate-800 p-6 rounded-2xl border border-slate-700 text-center w-full max-w-5xl mx-auto">
        <h2 class="text-3xl font-black text-white mb-6">🏸 Choisis ton terrain</h2>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-6">`;
    Object.keys(terrainsConfig).forEach(terrain => {
        html += `<button onclick="selectBadmintonTerrain(${terrain})" class="bg-blue-600 p-10 rounded-2xl font-black text-4xl text-white active:scale-95 transition-transform shadow-lg">Terrain ${terrain}</button>`;
    });
    html += `</div></div>`;
    container.innerHTML = html;
}

window.selectBadmintonTerrain = function(terrain) {
    currentTerrain = terrain;
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
    const nbPlayers = terrainsConfig[currentTerrain] || 0;
    const lettres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    playersList = lettres.slice(0, nbPlayers);
    if (playersList.length < 2) {
        container.innerHTML = `<div class="text-center bg-slate-800 p-10 rounded-3xl border border-slate-700 w-full max-w-4xl mx-auto">
            <p class="text-2xl font-black text-white">En attente d'autres joueurs sur ce terrain...</p>
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
    stats = { p1: { center: 0, extreme: 0, corner: 0, other: 0, fault: 0 }, p2: { center: 0, extreme: 0, corner: 0, other: 0, fault: 0 } };
    history = [];
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
        if (m.s1 > m.s2) {
            standings[m.p1].pts += 3; standings[m.p1].wins++; standings[m.p1].diff += (m.s1 - m.s2);
            standings[m.p2].losses++; standings[m.p2].pts += 1; standings[m.p2].diff -= (m.s1 - m.s2);
        } else {
            standings[m.p2].pts += 3; standings[m.p2].wins++; standings[m.p2].diff += (m.s2 - m.s1);
            standings[m.p1].losses++; standings[m.p1].pts += 1; standings[m.p1].diff -= (m.s2 - m.s1);
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
// 3. TERRAIN (CODE WEBJÉJÉ EXACT)
// ============================================================

function renderCourtInterface() {
    const container = document.getElementById('court-zone');
    if (!container) return;

    const courtHTML = generateCourtHTML();

    container.innerHTML = `
        <style>${WEBJEJE_CSS}</style>
        <div class="flex justify-between items-center mb-4">
            <div class="text-center w-1/3"><h3 class="text-3xl font-black text-white">${currentMatch.p1}</h3><div id="ratio-p1" class="text-xs text-slate-400">Ratio : 0%</div></div>
            <div class="text-center w-1/3"><h3 id="score-display" class="text-5xl font-black text-yellow-400">${matchPoints.p1} - ${matchPoints.p2}</h3></div>
            <div class="text-center w-1/3"><h3 class="text-3xl font-black text-white">${currentMatch.p2}</h3><div id="ratio-p2" class="text-xs text-slate-400">Ratio : 0%</div></div>
        </div>
        <div class="bg-slate-800 p-3 rounded-xl border border-slate-700 mb-3">
            <div class="flex items-center gap-2"><label class="text-xs font-bold text-slate-400">Zone centrale : <span id="zone-size-display">${badmintonCenterSize}%</span></label>
            <input type="range" id="middle-zone-slider" min="20" max="60" value="${badmintonCenterSize}" step="1" class="w-full"></div>
            <div class="flex justify-center gap-4 mt-2 text-xs text-slate-400 flex-wrap">
                <span><span class="inline-block w-3 h-3 bg-blue-500 rounded-sm"></span> Centre ${badmintonCenterPoints}pt</span>
                <span><span class="inline-block w-3 h-3 bg-purple-500 rounded-sm"></span> Zone ${badmintonOtherPoints}pt</span>
                <span><span class="inline-block w-3 h-3 bg-orange-500 rounded-sm"></span> Coin ${badmintonCornerPoints}pt</span>
                <span><span class="inline-block w-3 h-3 bg-red-500 rounded-sm"></span> Faute ${badmintonFaultPenalty ? badmintonFaultPoints+'pt' : '0pt'}</span>
            </div>
        </div>
        <div class="flex justify-between items-center gap-4 mb-3">
            <button onclick="window.faultPlayer('p1')" class="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-xl font-bold text-sm transition-colors shadow-lg">🟥 Faute ${currentMatch.p1}</button>
            <button onclick="window.faultPlayer('p2')" class="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-xl font-bold text-sm transition-colors shadow-lg">🟥 Faute ${currentMatch.p2}</button>
        </div>
        <div id="court">${courtHTML}</div>
        <div class="flex flex-wrap justify-center gap-3 mt-3">
            <button onclick="undoImpact()" class="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-xl font-bold text-sm">↩ Annuler</button>
            <button onclick="resetCourt()" class="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-xl font-bold text-sm">Reset</button>
            <button onclick="endMatch()" class="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-xl font-black text-sm">🏁 Terminer</button>
            <button onclick="window.retourTerrains()" class="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl font-bold text-sm">← Terrain</button>
        </div>
    `;

    // Slider
    const slider = document.getElementById('middle-zone-slider');
    const display = document.getElementById('zone-size-display');
    slider.addEventListener('input', function() { display.innerText = this.value + '%'; });
    const reRender = () => { const newVal = parseInt(slider.value); if (newVal !== badmintonCenterSize) { badmintonCenterSize = newVal; renderCourtInterface(); } };
    slider.addEventListener('change', reRender);
    slider.addEventListener('mouseup', reRender);
    slider.addEventListener('touchend', reRender);

    // Écouteurs d'événements (délégués sur #court)
    const court = document.getElementById('court');
    if (court) {
        // Nettoyer les anciens écouteurs
        const newCourt = court.cloneNode(true);
        court.parentNode.replaceChild(newCourt, court);
        // Attacher les écouteurs sur le nouveau #court
        newCourt.addEventListener('click', handleImpact);
        newCourt.addEventListener('touchstart', handleTouch, { passive: false });
    }
}

// ============================================================
// 4. GÉNÉRATION DU TERRAIN (Webjéjé exact)
// ============================================================

function generateCourtHTML() {
    const m = badmintonMode;
    const is9 = m === '4corners';
    const cSize = badmintonCenterSize;
    const sideSize = (100 - cSize) / 2;

    let pClass = is9 ? 'layout-grid' : (m === 'leftright' ? 'layout-row' : 'layout-col');

    const style3Z = (i) => m === 'frontback' ? 
        (i === 1 ? `width:100%;height:${cSize}%` : `width:100%;height:${sideSize}%`) : 
        (i === 1 ? `width:${cSize}%;height:100%` : `width:${sideSize}%;height:100%`);

    const style9Z = (i) => `width:${(i % 3 === 1) ? cSize : sideSize}%;height:${(Math.floor(i / 3) === 1) ? cSize : sideSize}%`;

    const genZones = (playerCode) => {
        let zones = '';
        if (!is9) {
            const points = [badmintonOtherPoints, badmintonCenterPoints, badmintonOtherPoints];
            const types = ['extreme', 'center', 'extreme'];
            const colors = ['zone-extreme', 'zone-center', 'zone-extreme'];
            for (let i = 0; i < 3; i++) {
                zones += `<div class="zone ${colors[i]}" data-points="${points[i]}" data-player="${playerCode}" data-type="${types[i]}" style="${style3Z(i)}">${points[i]}</div>`;
            }
        } else {
            const types = ['corner', 'other', 'corner', 'other', 'center', 'other', 'corner', 'other', 'corner'];
            const pointsMap = {
                center: badmintonCenterPoints,
                other: badmintonOtherPoints,
                corner: badmintonCornerPoints
            };
            const colorsMap = {
                center: 'zone-center',
                other: 'zone-other',
                corner: 'zone-corner'
            };
            for (let i = 0; i < 9; i++) {
                const type = types[i];
                const pts = pointsMap[type] || 0;
                const color = colorsMap[type] || '';
                zones += `<div class="zone ${color}" data-points="${pts}" data-player="${playerCode}" data-type="${type}" style="${style9Z(i)}">${pts}</div>`;
            }
        }
        return zones;
    };

    // ✅ PLUS AUCUNE ZONE DE FAUTE - UNIQUEMENT LA GRILLE
    return `<div class="court-wrapper ${is9 ? 'mode-9zones' : 'mode-3zones'}">
        <div class="court">
            <div class="player-area ${pClass}" id="area-p1">${genZones('p1')}</div>
            <div class="net"></div>
            <div class="player-area ${pClass}" id="area-p2">${genZones('p2')}</div>
        </div>
    </div>`;
}

// ============================================================
// 5. INTERACTIONS (Webjéjé exact)
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
    history.push({ impact, scoringPlayer, points, zoneType });
    redoStack = [];
    updateButtons();
}

function handleTouch(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    // Simuler un clic
    handleImpact({ target: element, clientX: touch.clientX, clientY: touch.clientY });
}

function applyScore(player, points, zoneType, multiplier) {
    matchPoints[player] += points * multiplier;
    if (!stats[player][zoneType]) stats[player][zoneType] = 0;
    stats[player][zoneType] += multiplier;
    updateDashboard();
}

function undoImpact() {
    if (history.length === 0) return;
    const last = history.pop();
    last.impact.remove();
    applyScore(last.scoringPlayer, last.points, last.zoneType, -1);
    redoStack.push(last);
    updateButtons();
}

function redoImpact() {
    if (redoStack.length === 0) return;
    const last = redoStack.pop();
    document.getElementById('court').querySelector('.court-wrapper').appendChild(last.impact);
    applyScore(last.scoringPlayer, last.points, last.zoneType, 1);
    history.push(last);
    updateButtons();
}

function resetCourt() {
    document.querySelectorAll('.impact').forEach(el => el.remove());
    matchPoints = { p1: 0, p2: 0 };
    stats = { p1: { center: 0, extreme: 0, corner: 0, other: 0, fault: 0 }, p2: { center: 0, extreme: 0, corner: 0, other: 0, fault: 0 } };
    history = [];
    redoStack = [];
    updateDashboard();
    updateButtons();
}

function updateButtons() {
    const undoBtn = document.querySelector('button[onclick="undoImpact()"]');
    const redoBtn = document.querySelector('button[onclick="redoImpact()"]');
    if (undoBtn) undoBtn.disabled = history.length === 0;
    if (redoBtn) redoBtn.disabled = redoStack.length === 0;
}

function updateDashboard() {
    document.getElementById('score-display').innerText = `${matchPoints.p1} - ${matchPoints.p2}`;
    const ratio1 = calcRatio('p1');
    const ratio2 = calcRatio('p2');
    document.getElementById('ratio-p1').innerText = `Ratio : ${ratio1}%`;
    document.getElementById('ratio-p2').innerText = `Ratio : ${ratio2}%`;
}

function calcRatio(player) {
    const s = stats[player];
    const total = s.center + (badmintonMode === '4corners' ? (s.fault + s.other + s.corner) : s.extreme);
    if (total === 0) return 0;
    const ext = (badmintonMode === '4corners') ? (s.corner + s.other + s.fault) : s.extreme;
    return Math.round((ext / total) * 100);
}

window.faultPlayer = function(player) {
    const scoringPlayer = player === 'p1' ? 'p2' : 'p1';
    const fPt = badmintonFaultPenalty ? badmintonFaultPoints : 0;
    if (fPt === 0) return alert('Les fautes ne sont pas pénalisées');
    applyScore(scoringPlayer, fPt, 'fault', 1);
    // Ajouter un impact visuel au centre
    const wrapper = document.querySelector('.court-wrapper');
    if (wrapper) {
        const rect = wrapper.getBoundingClientRect();
        const impact = document.createElement('div');
        impact.className = 'impact';
        impact.style.left = (rect.width/2) + 'px';
        impact.style.top = (rect.height/2) + 'px';
        wrapper.appendChild(impact);
        history.push({ impact, scoringPlayer, points: fPt, zoneType: 'fault' });
        redoStack = [];
        updateButtons();
    }
};

// ============================================================
// 6. FIN DE MATCH
// ============================================================

window.endMatch = function() {
    if (!currentMatch) return;
    const p1 = currentMatch.p1;
    const p2 = currentMatch.p2;
    const s1 = matchPoints.p1;
    const s2 = matchPoints.p2;
    if (confirm(`Valider le score ${s1} - ${s2} ?`)) {
        const statsData = {
            p1: { extreme: stats.p1.extreme || 0, center: stats.p1.center || 0, corner: stats.p1.corner || 0, other: stats.p1.other || 0, fault: stats.p1.fault || 0, total: matchPoints.p1 },
            p2: { extreme: stats.p2.extreme || 0, center: stats.p2.center || 0, corner: stats.p2.corner || 0, other: stats.p2.other || 0, fault: stats.p2.fault || 0, total: matchPoints.p2 }
        };
        const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
        const resultRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/badminton/results/${currentMatch.id}`);
        update(resultRef, {
            terrain: currentTerrain, p1, p2, s1, s2,
            stats: statsData,
            mode: badmintonMode,
            centerSize: badmintonCenterSize,
            centerPoints: badmintonCenterPoints,
            otherPoints: badmintonOtherPoints,
            cornerPoints: badmintonCornerPoints,
            faultPoints: badmintonFaultPoints,
            faultPenalty: badmintonFaultPenalty,
            timestamp: Date.now()
        }).then(() => {
            const matchIndex = matchSchedule.findIndex(m => m.id === currentMatch.id);
            if (matchIndex !== -1) { matchSchedule[matchIndex].s1 = s1; matchSchedule[matchIndex].s2 = s2; }
            import('./badminton-charts.js').then(module => module.renderBadmintonStatsModal({ stats: statsData, mode: badmintonMode }, p1, p2));
            currentMatch = null;
            renderMatchSetup();
        }).catch(err => alert("Erreur envoi : " + err.message));
    }
};

// ============================================================
// 7. ÉCOUTE DES SCORES
// ============================================================

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
        if (document.getElementById('court-zone') && !document.getElementById('court')) renderMatchSetup();
        else renderClassement();
    });
}