// src/js/modules/badminton/badminton-kiosk.js
// Interface élève : Sélection Terrain -> Liste Round Robin -> Terrain 3D
// Adapté de BadZ Impact (Webjéjé) avec la logique de rendu 9 zones.

import { db, ref, onValue, update } from '../../core/firebase-service.js';

let currentClasse = '';
let currentTerrain = '';
let playersList = [];
let matchSchedule = [];
let currentMatch = null;
let matchPoints = { p1: 0, p2: 0 };
let ratioData = { 
    p1: { center: 0, extreme: 0, corner: 0, other: 0, fault: 0 }, 
    p2: { center: 0, extreme: 0, corner: 0, other: 0, fault: 0 } 
};
let terrainsConfig = {};
let historyStack = [];
let redoStack = [];
let resultsListenerAttached = false;

// Paramètres synchronisés avec Firebase
let badmintonMode = 'frontback';
let badmintonCenterSize = 33;
let badmintonCenterPoints = 1;
let badmintonOtherPoints = 3;
let badmintonCornerPoints = 5;
let badmintonFaultPoints = 1;
let badmintonFaultPenalty = true;

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

        console.log("📡 [Élève] Config reçue :", config);

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
        html += `<button onclick="selectBadmintonTerrain(${terrain})" 
                    class="bg-blue-600 p-10 rounded-2xl font-black text-4xl text-white active:scale-95 transition-transform shadow-lg">
                    Terrain ${terrain}
                </button>`;
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

    if (matchSchedule.length === 0) {
        generateRoundRobin();
    }

    let html = `
        <div class="flex flex-col lg:flex-row gap-6 w-full max-w-7xl mx-auto">
            <div class="w-full lg:w-1/3 bg-slate-800 p-6 rounded-2xl border border-slate-700">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-xl font-black text-white">Terrain ${currentTerrain}</h2>
                    <button onclick="window.retourTerrains()" class="bg-red-600 px-3 py-1 rounded-lg text-xs font-black text-white">← Terrain</button>
                </div>
                <h3 class="text-xs font-bold text-slate-400 uppercase mb-2">Programmation</h3>
                <div class="space-y-2 max-h-64 overflow-y-auto pr-2">
                    ${matchSchedule.map(match => {
                        const isPlayed = match.s1 !== null;
                        const scoreDisplay = isPlayed ? `${match.s1} - ${match.s2}` : 'À jouer';
                        const playedStyle = isPlayed ? 'line-through opacity-60' : '';
                        const clickAction = isPlayed ? '' : `onclick="selectMatchFromList('${match.id}')"`;
                        return `
                            <button ${clickAction} 
                                class="w-full text-left p-3 rounded-lg border-2 transition-colors ${playedStyle} ${isPlayed ? 'bg-slate-700 border-slate-500 text-slate-300' : 'bg-slate-900 border-blue-500 text-white hover:bg-blue-900'}">
                                <div class="flex justify-between items-center font-black">
                                    <span>${match.p1} vs ${match.p2}</span>
                                    <span class="text-sm">${scoreDisplay}</span>
                                </div>
                            </button>`;
                    }).join('')}
                </div>
                <div id="classement" class="mt-6"></div>
            </div>
            <div class="w-full lg:w-2/3 bg-slate-900 p-6 rounded-2xl border border-slate-700" id="court-zone">
                <div class="text-center py-10">
                    <p class="text-2xl font-black text-slate-500">Cliquez sur un match pour jouer</p>
                </div>
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
    ratioData = { 
        p1: { center: 0, extreme: 0, corner: 0, other: 0, fault: 0 }, 
        p2: { center: 0, extreme: 0, corner: 0, other: 0, fault: 0 } 
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
        if (m.s1 > m.s2) {
            standings[m.p1].pts += 3;
            standings[m.p1].wins++;
            standings[m.p1].diff += (m.s1 - m.s2);
            standings[m.p2].losses++;
            standings[m.p2].pts += 1;
            standings[m.p2].diff -= (m.s1 - m.s2);
        } else {
            standings[m.p2].pts += 3;
            standings[m.p2].wins++;
            standings[m.p2].diff += (m.s2 - m.s1);
            standings[m.p1].losses++;
            standings[m.p1].pts += 1;
            standings[m.p1].diff -= (m.s2 - m.s1);
        }
    });

    const sorted = Object.entries(standings).sort((a, b) => b[1].pts - a[1].pts || b[1].diff - a[1].diff);
    
    let html = `<h3 class="text-xs font-bold text-slate-400 uppercase mb-2">Classement</h3>
                <div class="space-y-2">`;
    sorted.forEach(([player, data], idx) => {
        html += `<div class="bg-slate-900 p-2 rounded-lg border border-slate-700 flex justify-between items-center">
                    <span class="font-black text-white">${idx + 1}. ${player}</span>
                    <span class="text-xs text-slate-400">${data.pts} pts | ${data.wins} V - ${data.losses} D</span>
                </div>`;
    });
    html += `</div>`;
    container.innerHTML = html;
}

// ============================================================
// 3. RENDU DU TERRAIN (BASÉ SUR WEBJÉJÉ)
// ============================================================

function renderCourtInterface() {
    const container = document.getElementById('court-zone');
    if (!container) return;

    console.log("🎨 Rendu du terrain, mode :", badmintonMode);

    // Générer le HTML du terrain avec la fonction Webjéjé
    const courtHTML = generateCourtHTML();

    // Construction du HTML complet avec score, slider, boutons
    container.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <div class="text-center w-1/3">
                <h3 class="text-3xl font-black text-white">${currentMatch.p1}</h3>
                <div id="ratio-p1" class="text-xs text-slate-400">Ratio : 0%</div>
            </div>
            <div class="text-center w-1/3">
                <h3 id="score-display" class="text-5xl font-black text-yellow-400">${matchPoints.p2} - ${matchPoints.p1}</h3>
            </div>
            <div class="text-center w-1/3">
                <h3 class="text-3xl font-black text-white">${currentMatch.p2}</h3>
                <div id="ratio-p2" class="text-xs text-slate-400">Ratio : 0%</div>
            </div>
        </div>

        <!-- Slider -->
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

        <!-- Boutons Faute (entre slider et terrain) -->
        <div class="flex justify-between items-center gap-4 mb-3">
            <button onclick="window.faultPlayer('p1')" class="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-xl font-bold text-sm transition-colors shadow-lg">
                🟥 Faute ${currentMatch.p1}
            </button>
            <button onclick="window.faultPlayer('p2')" class="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-xl font-bold text-sm transition-colors shadow-lg">
                🟥 Faute ${currentMatch.p2}
            </button>
        </div>

        <!-- Terrain -->
        <div id="court" class="relative w-full mx-auto mb-4" style="background: #1a3a2a; border-radius: 15px; padding: 8px;">
            ${courtHTML}
        </div>

        <!-- Boutons d'action -->
        <div class="flex flex-wrap justify-center gap-3">
            <button onclick="undoImpact()" class="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors">
                ↩ Annuler
            </button>
            <button onclick="resetCourt()" class="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors">
                Reset
            </button>
            <button onclick="endMatch()" class="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-xl font-black text-sm transition-colors">
                🏁 Terminer Match
            </button>
            <button onclick="window.retourTerrains()" class="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors">
                ← Terrain
            </button>
        </div>
    `;

    // Attacher les événements du slider
    const slider = document.getElementById('middle-zone-slider');
    const display = document.getElementById('zone-size-display');

    slider.addEventListener('input', function() {
        display.innerText = this.value + '%';
    });

    slider.addEventListener('mouseup', function() {
        const newVal = parseInt(this.value);
        if (newVal !== badmintonCenterSize) {
            badmintonCenterSize = newVal;
            renderCourtInterface();
        }
    });

    slider.addEventListener('touchend', function() {
        const newVal = parseInt(this.value);
        if (newVal !== badmintonCenterSize) {
            badmintonCenterSize = newVal;
            renderCourtInterface();
        }
    });

    // Attacher les événements du terrain
    document.getElementById('court').addEventListener('click', handleImpact);
    document.getElementById('court').addEventListener('touchstart', handleTouch, { passive: false });
}

// ============================================================
// 3b. GÉNÉRATION DU TERRAIN (CODE WEBJÉJÉ ADAPTÉ)
// ============================================================

function generateCourtHTML() {
    const m = badmintonMode;
    const is9 = m === '4corners';
    const cSize = badmintonCenterSize;
    const sideSize = (100 - cSize) / 2;

    // Déterminer la disposition des zones (Webjéjé)
    let pClass = is9 ? 'layout-grid' : (m === 'leftright' ? 'layout-row' : 'layout-col');
    
    // Styles pour les zones 3x3
    const style3Z = (i) => m === 'frontback' ? 
        (i === 1 ? `width:100%;height:${cSize}%` : `width:100%;height:${sideSize}%`) : 
        (i === 1 ? `width:${cSize}%;height:100%` : `width:${sideSize}%;height:100%`);
    
    const style9Z = (i) => `width:${(i % 3 === 1) ? cSize : sideSize}%;height:${(Math.floor(i / 3) === 1) ? cSize : sideSize}%`;

    // Génération des zones pour un joueur
    const genZones = (playerCode) => {
        let zones = '';
        if (!is9) {
            // Mode 3 zones
            const points = [badmintonOtherPoints, badmintonCenterPoints, badmintonOtherPoints];
            const types = ['extreme', 'center', 'extreme'];
            const colors = ['zone-extreme', 'zone-center', 'zone-extreme'];
            for (let i = 0; i < 3; i++) {
                zones += `<div class="zone ${colors[i]}" data-points="${points[i]}" data-player="${playerCode}" data-type="${types[i]}" style="${style3Z(i)}">${points[i]}</div>`;
            }
        } else {
            // Mode 9 zones (4 corners + fautes)
            // Grille 3x3 : corner, other, corner / other, center, other / corner, other, corner
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

    // Génération des zones Fautes (pour le mode 9 zones)
    let faultHtml = '';
    if (is9) {
        const fPt = badmintonFaultPenalty ? badmintonFaultPoints : 0;
        const faultLabel = badmintonFaultPenalty ? `F ${fPt}` : 'F 0';
        // Fautes selon le code Webjéjé
        faultHtml = `
            <div class="fault-area fault-top fault-p1-top" data-points="${fPt}" data-player="p2" data-type="fault">${faultLabel}</div>
            <div class="fault-area fault-top fault-p2-top" data-points="${fPt}" data-player="p1" data-type="fault">${faultLabel}</div>
            <div class="fault-area fault-bottom fault-p1-bot" data-points="${fPt}" data-player="p2" data-type="fault">${faultLabel}</div>
            <div class="fault-area fault-bottom fault-p2-bot" data-points="${fPt}" data-player="p1" data-type="fault">${faultLabel}</div>
            <div class="fault-area fault-left" data-points="${fPt}" data-player="p2" data-type="fault">${faultLabel}</div>
            <div class="fault-area fault-right" data-points="${fPt}" data-player="p1" data-type="fault">${faultLabel}</div>
        `;
    }

    return `<div class="court-wrapper ${is9 ? 'mode-9zones' : 'mode-3zones'}">
        <div class="court">
            <div class="player-area ${pClass}" id="area-p1">${genZones('p1')}</div>
            <div class="net"></div>
            <div class="player-area ${pClass}" id="area-p2">${genZones('p2')}</div>
        </div>
        ${faultHtml}
    </div>`;
}

// ============================================================
// 4. INTERACTIONS (IMPACTS, SCORES, UNDO)
// ============================================================

function handleImpact(e) {
    const court = document.getElementById('court');
    if (!court) return;
    
    const target = e.target.closest('.zone, .fault-area');
    if (!target) {
        console.warn('Clic hors zone');
        return;
    }

    const player = target.dataset.player || 'p1';
    const points = parseInt(target.dataset.points) || 0;
    const type = target.dataset.type || 'extreme';

    // Logique Webjéjé : le marqueur est l'adversaire du côté de la zone
    const scoringPlayer = player === 'p1' ? 'p2' : 'p1';

    console.log(`🎯 Impact : zone ${player}, type ${type}, points ${points} → ${scoringPlayer} marque`);

    // Si c'est une faute et que les fautes ne sont pas pénalisées
    const isFault = type === 'fault';
    const finalPoints = (isFault && !badmintonFaultPenalty) ? 0 : points;

    // Marquer l'impact visuellement
    const wrapper = court.querySelector('.court-wrapper');
    const rect = wrapper.getBoundingClientRect();
    const impact = document.createElement('div');
    impact.className = 'impact';
    impact.style.left = (e.clientX - rect.left) + 'px';
    impact.style.top = (e.clientY - rect.top) + 'px';
    wrapper.appendChild(impact);

    // Mettre à jour les scores
    matchPoints[scoringPlayer] += finalPoints;
    // Stats : du côté du joueur qui a frappé
    if (!ratioData[player][type]) ratioData[player][type] = 0;
    ratioData[player][type]++;

    document.getElementById('score-display').innerText = `${matchPoints.p2} - ${matchPoints.p1}`;
    updateRatios();

    historyStack.push({ element: impact, player: scoringPlayer, points: finalPoints, type, zonePlayer: player });
    redoStack = [];
}

function handleTouch(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    handleImpact({
        clientX: touch.clientX,
        clientY: touch.clientY,
        target: element
    });
}

// Bouton "Faute joueur"
window.faultPlayer = function(player) {
    const scoringPlayer = player === 'p1' ? 'p2' : 'p1';
    const fPt = badmintonFaultPenalty ? badmintonFaultPoints : 0;
    
    if (fPt === 0) {
        alert('Les fautes ne sont pas pénalisées (case décochée)');
        return;
    }

    matchPoints[scoringPlayer] += fPt;
    if (!ratioData[player]['fault']) ratioData[player]['fault'] = 0;
    ratioData[player]['fault']++;

    document.getElementById('score-display').innerText = `${matchPoints.p2} - ${matchPoints.p1}`;
    updateRatios();

    // Impact visuel (au centre du terrain)
    const wrapper = document.querySelector('.court-wrapper');
    if (wrapper) {
        const rect = wrapper.getBoundingClientRect();
        const impact = document.createElement('div');
        impact.className = 'impact';
        impact.style.left = (rect.width / 2 - 10) + 'px';
        impact.style.top = (rect.height / 2 - 10) + 'px';
        wrapper.appendChild(impact);
        historyStack.push({ element: impact, player: scoringPlayer, points: fPt, type: 'fault_btn', zonePlayer: player });
        redoStack = [];
    }
};

function updateRatios() {
    const p1Total = ratioData.p1.extreme + ratioData.p1.center + (ratioData.p1.corner || 0) + (ratioData.p1.other || 0) + (ratioData.p1.fault || 0);
    const p2Total = ratioData.p2.extreme + ratioData.p2.center + (ratioData.p2.corner || 0) + (ratioData.p2.other || 0) + (ratioData.p2.fault || 0);
    const p1Ext = p1Total > 0 ? Math.round(((ratioData.p1.extreme + (ratioData.p1.corner || 0)) / p1Total) * 100) : 0;
    const p2Ext = p2Total > 0 ? Math.round(((ratioData.p2.extreme + (ratioData.p2.corner || 0)) / p2Total) * 100) : 0;
    document.getElementById('ratio-p1').innerText = p1Ext + '%';
    document.getElementById('ratio-p2').innerText = p2Ext + '%';
}

function undoImpact() {
    if (historyStack.length === 0) return;
    const last = historyStack.pop();
    redoStack.push(last);
    last.element.remove();
    
    matchPoints[last.player] -= last.points;
    if (ratioData[last.zonePlayer] && ratioData[last.zonePlayer][last.type] > 0) {
        ratioData[last.zonePlayer][last.type]--;
    }
    
    document.getElementById('score-display').innerText = `${matchPoints.p2} - ${matchPoints.p1}`;
    updateRatios();
}

function resetCourt() {
    document.querySelectorAll('.impact').forEach(el => el.remove());
    matchPoints = { p1: 0, p2: 0 };
    ratioData = { 
        p1: { center: 0, extreme: 0, corner: 0, other: 0, fault: 0 }, 
        p2: { center: 0, extreme: 0, corner: 0, other: 0, fault: 0 } 
    };
    document.getElementById('score-display').innerText = '0 - 0';
    document.getElementById('ratio-p1').innerText = '0%';
    document.getElementById('ratio-p2').innerText = '0%';
    historyStack = [];
    redoStack = [];
}

window.undoImpact = undoImpact;
window.resetCourt = resetCourt;

// ============================================================
// 5. FIN DE MATCH
// ============================================================

window.endMatch = function() {
    if (!currentMatch) return;
    
    const p1 = currentMatch.p1;
    const p2 = currentMatch.p2;
    const s1 = matchPoints.p2;
    const s2 = matchPoints.p1;

    if (confirm(`Valider le score ${s1} - ${s2} ?`)) {
        const stats = {
            p1: { 
                extreme: ratioData.p1.extreme, 
                center: ratioData.p1.center,
                corner: ratioData.p1.corner || 0,
                other: ratioData.p1.other || 0,
                fault: ratioData.p1.fault || 0,
                total: matchPoints.p1 
            },
            p2: { 
                extreme: ratioData.p2.extreme, 
                center: ratioData.p2.center,
                corner: ratioData.p2.corner || 0,
                other: ratioData.p2.other || 0,
                fault: ratioData.p2.fault || 0,
                total: matchPoints.p2 
            }
        };

        const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
        const resultRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/badminton/results/${currentMatch.id}`);
        
        update(resultRef, { 
            terrain: currentTerrain, 
            p1, p2, s1, s2, 
            stats: stats,
            mode: badmintonMode,
            centerSize: badmintonCenterSize,
            centerPoints: badmintonCenterPoints,
            otherPoints: badmintonOtherPoints,
            cornerPoints: badmintonCornerPoints,
            faultPoints: badmintonFaultPoints,
            faultPenalty: badmintonFaultPenalty,
            timestamp: Date.now() 
        })
        .then(() => {
            const matchIndex = matchSchedule.findIndex(m => m.id === currentMatch.id);
            if (matchIndex !== -1) {
                matchSchedule[matchIndex].s1 = s1;
                matchSchedule[matchIndex].s2 = s2;
            }
            
            import('./badminton-charts.js').then(module => {
                const matchData = {
                    stats: stats,
                    mode: badmintonMode
                };
                module.renderBadmintonStatsModal(matchData, p1, p2);
            });
            
            currentMatch = null;
            renderMatchSetup();
        })
        .catch(err => alert("Erreur envoi : " + err.message));
    }
};

// ============================================================
// ÉCOUTE DES SCORES
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
        if (document.getElementById('court-zone') && !document.getElementById('court')) {
            renderMatchSetup();
        } else {
            renderClassement();
        }
    });
}