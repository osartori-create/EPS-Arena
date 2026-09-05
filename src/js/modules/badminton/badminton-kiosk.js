// src/js/modules/badminton/badminton-kiosk.js
// Interface élève : Sélection Terrain -> Liste Round Robin -> Terrain 3D
// Adapté de BadZ Impact (Webjéjé) et du module EPS-Arena.

import { db, ref, onValue, update } from '../../core/firebase-service.js';

let currentClasse = '';
let currentTerrain = '';
let playersList = [];
let matchSchedule = [];
let currentMatch = null;
let matchPoints = { p1: 0, p2: 0 };
let ratioData = { 
    p1: { middle: 0, extreme: 0, corner: 0, fault: 0 }, 
    p2: { middle: 0, extreme: 0, corner: 0, fault: 0 } 
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
let badmintonCornerPoints = 3;
let badmintonFaultPoints = 1;
let badmintonFaultPenalty = true;
let middleZoneSize = 33;
let isFrontBackLayout = true;
let centerPoints = 1;
let otherPoints = 3;
let cornerPoints = 3;
let faultPoints = 1;

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

        console.log("📡 [Élève] Config Badminton reçue :", config); // ✅ LOG AJOUTÉ

        // Mise à jour des paramètres
        badmintonMode = config.mode || 'frontback';
        badmintonCenterSize = config.centerSize || 33;
        badmintonCenterPoints = config.centerPoints || 1;
        badmintonOtherPoints = config.otherPoints || 3;
        badmintonCornerPoints = config.cornerPoints || 3;
        badmintonFaultPoints = config.faultPoints || 1;
        badmintonFaultPenalty = config.faultPenalty !== undefined ? config.faultPenalty : true;

        // Synchroniser les variables locales
        middleZoneSize = badmintonCenterSize;
        centerPoints = badmintonCenterPoints;
        otherPoints = badmintonOtherPoints;
        cornerPoints = badmintonCornerPoints;
        faultPoints = badmintonFaultPoints;
        isFrontBackLayout = badmintonMode === 'frontback';

        console.log("🏸 [Élève] Mode appliqué :", badmintonMode); // ✅ LOG AJOUTÉ

        // Récupérer les terrains
        terrainsConfig = {};
        for (let key in config) {
            if (!isNaN(parseInt(key))) {
                terrainsConfig[parseInt(key)] = config[key];
            }
        }

        // ✅ FORCER LE RE-RENDU APRÈS MISE À JOUR DES PARAMÈTRES
        requestAnimationFrame(() => {
            if (currentTerrain) {
                renderMatchSetup();
            } else {
                renderTerrainSelection();
            }
        });
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
// 2. GESTION DU MATCH (Round Robin)
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
        console.log("🛠️ Génération du Round Robin...");
        generateRoundRobin();
    } else {
        console.log("♻️ Round Robin existant conservé, scores :", matchSchedule.map(m => `${m.p1}-${m.p2}: ${m.s1}-${m.s2}`));
    }

    let html = `
        <div class="flex flex-col lg:flex-row gap-6 w-full max-w-7xl mx-auto">
            <div class="w-full lg:w-1/3 bg-slate-800 p-6 rounded-2xl border border-slate-700">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-xl font-black text-white">Terrain ${currentTerrain}</h2>
                    <button onclick="window.retourTerrains()" class="bg-red-600 px-3 py-1 rounded-lg text-xs font-black text-white">← Terrain</button>
                </div>
                <h3 class="text-xs font-bold text-slate-400 uppercase mb-2">Programmation (Round Robin)</h3>
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
        p1: { middle: 0, extreme: 0, corner: 0, fault: 0 }, 
        p2: { middle: 0, extreme: 0, corner: 0, fault: 0 } 
    };
    historyStack = [];
    redoStack = [];
    
    renderCourtInterface();
};

// ============================================================
// ÉCOUTE FIREBASE POUR LES SCORES
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

// ============================================================
// CLASSEMENT
// ============================================================

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
// 3. INTERFACE DU TERRAIN (VERSION UNIQUE ET CORRIGÉE)
// ============================================================

function renderCourtInterface() {
    const container = document.getElementById('court-zone');
    if (!container) return;

    const mode = badmintonMode;
    const centerSize = badmintonCenterSize;
    const cPoints = badmintonCenterPoints;
    const oPoints = badmintonOtherPoints;
    const coPoints = badmintonCornerPoints || 3;
    const fPoints = badmintonFaultPoints || 1;
    const fPenalty = badmintonFaultPenalty;

    const sideSize = (100 - centerSize) / 2;

    // Génération des zones selon le mode
    let zonesHtml = '';
    if (mode === '4corners') {
        // 9 zones : 3x3
        const types = [
            ['corner', 'other', 'corner'],
            ['other', 'center', 'other'],
            ['corner', 'other', 'corner']
        ];
        const pointsMap = {
            center: cPoints,
            corner: coPoints,
            other: oPoints
        };
        const colorsMap = {
            center: 'bg-blue-500',
            corner: 'bg-orange-500',
            other: 'bg-purple-500'
        };
        zonesHtml = types.map(row => 
            row.map(type => {
                const pts = pointsMap[type] || 0;
                const color = colorsMap[type] || 'bg-slate-500';
                return `<div class="zone ${color} flex-1 flex items-center justify-center text-white font-black text-sm cursor-pointer hover:opacity-80"
                          data-points="${pts}" data-type="${type}">${pts}</div>`;
            }).join('')
        ).map(row => `<div class="flex flex-1">${row}</div>`).join('');

        // Ajout des zones Fautes (sur les côtés)
        const faultColor = fPenalty ? 'bg-yellow-500 text-black' : 'bg-yellow-300 text-black opacity-50';
        const faultLabel = fPenalty ? `⚠️ ${fPoints}` : '⚠️ 0';
        const faultZones = `
            <div class="fault-area absolute top-0 left-0 w-1/6 h-full ${faultColor} flex items-center justify-center text-xs font-black cursor-pointer"
                 data-points="${fPenalty ? fPoints : 0}" data-type="fault">${faultLabel}</div>
            <div class="fault-area absolute top-0 right-0 w-1/6 h-full ${faultColor} flex items-center justify-center text-xs font-black cursor-pointer"
                 data-points="${fPenalty ? fPoints : 0}" data-type="fault">${faultLabel}</div>
            <div class="fault-area absolute bottom-0 left-0 w-full h-1/6 ${faultColor} flex items-center justify-center text-xs font-black cursor-pointer"
                 data-points="${fPenalty ? fPoints : 0}" data-type="fault">${faultLabel}</div>
            <div class="fault-area absolute top-0 left-0 w-full h-1/6 ${faultColor} flex items-center justify-center text-xs font-black cursor-pointer"
                 data-points="${fPenalty ? fPoints : 0}" data-type="fault">${faultLabel}</div>
        `;
        zonesHtml += faultZones;
    } else {
        // Mode 3 zones (frontback ou leftright)
        const isFrontBack = mode === 'frontback';
        const zones = [
            { type: 'extreme', size: sideSize, color: 'bg-red-500' },
            { type: 'center', size: centerSize, color: 'bg-blue-500' },
            { type: 'extreme', size: sideSize, color: 'bg-red-500' }
        ];
        zonesHtml = zones.map(z => {
            const pts = z.type === 'center' ? cPoints : oPoints;
            const style = isFrontBack ? `height:${z.size}%; width:100%` : `width:${z.size}%; height:100%`;
            return `<div class="zone ${z.color} flex items-center justify-center text-white font-black text-sm cursor-pointer hover:opacity-80"
                      style="${style}" data-points="${pts}" data-type="${z.type}">${pts}</div>`;
        }).join('');
        
        if (isFrontBack) {
            zonesHtml = `<div class="flex flex-col w-full h-full">${zonesHtml}</div>`;
        } else {
            zonesHtml = `<div class="flex w-full h-full">${zonesHtml}</div>`;
        }
    }

    // Construction du HTML complet
    container.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <div class="text-center w-1/3">
                <h3 class="text-3xl font-black text-white">${currentMatch.p1}</h3>
            </div>
            <div class="text-center w-1/3">
                <h3 id="score-display" class="text-5xl font-black text-yellow-400">${matchPoints.p2} - ${matchPoints.p1}</h3>
            </div>
            <div class="text-center w-1/3">
                <h3 class="text-3xl font-black text-white">${currentMatch.p2}</h3>
            </div>
        </div>

        <div class="bg-slate-800 p-3 rounded-xl border border-slate-700 mb-4">
            <div class="flex items-center gap-2">
                <label class="text-xs font-bold text-slate-400">Zone : <span id="zone-size-display">${centerSize}%</span></label>
                <input type="range" id="middle-zone-slider" min="20" max="60" value="${centerSize}" class="w-full">
            </div>
        </div>

        <div id="court" class="court-container relative w-full mx-auto mb-4 shadow-2xl" 
             style="background-color: #15803d; height: 55vh; border-radius: 15px; transform: perspective(1000px) rotateX(10deg);">
            <div class="absolute inset-0 flex">
                <div class="half-court w-1/2 h-full relative p-0">
                    ${zonesHtml.replace(/p1/g, 'p1')}
                    <div id="ratio-p1" class="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs font-bold">0%</div>
                </div>
                <div class="w-1 h-full bg-black"></div>
                <div class="half-court w-1/2 h-full relative p-0">
                    ${zonesHtml.replace(/p1/g, 'p2')}
                    <div id="ratio-p2" class="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs font-bold">0%</div>
                </div>
            </div>
        </div>

        <div class="flex justify-center gap-4 flex-wrap">
            <button onclick="undoImpact()" class="bg-slate-600 text-white px-4 py-2 rounded-xl font-bold">↩ Annuler</button>
            <button onclick="resetCourt()" class="bg-red-600 text-white px-4 py-2 rounded-xl font-bold">Reset</button>
            <button onclick="endMatch()" class="bg-emerald-600 text-white px-6 py-2 rounded-xl font-black">🏁 Terminer Match</button>
            <button onclick="window.retourTerrains()" class="bg-slate-700 text-white px-6 py-2 rounded-xl font-bold">← Terrain</button>
        </div>
    `;

    // Attacher les événements
    document.getElementById('middle-zone-slider').addEventListener('input', updateZoneSize);
    document.getElementById('court').addEventListener('click', handleImpact);
    document.getElementById('court').addEventListener('touchstart', handleTouch, { passive: false });

    updateZoneSize();
}

// ============================================================
// 4. INTERACTIONS (ZONES, SLIDER, IMPACTS)
// ============================================================

function updateZoneSize() {
    const slider = document.getElementById('middle-zone-slider');
    if (!slider) return;

    middleZoneSize = parseInt(slider.value);
    document.getElementById('zone-size-display').innerText = middleZoneSize + '%';
    
    const sideSize = (100 - middleZoneSize) / 2;

    document.querySelectorAll('#court .half-court').forEach((half) => {
        const zones = half.querySelectorAll('.zone');
        zones.forEach(zone => { zone.style.flex = 'none'; });

        if (isFrontBackLayout) {
            zones[0].style.height = sideSize + '%';
            zones[1].style.height = middleZoneSize + '%';
            zones[2].style.height = sideSize + '%';
            zones[0].style.width = '100%';
            zones[1].style.width = '100%';
            zones[2].style.width = '100%';
        } else {
            zones[0].style.width = sideSize + '%';
            zones[1].style.width = middleZoneSize + '%';
            zones[2].style.width = sideSize + '%';
            zones[0].style.height = '100%';
            zones[1].style.height = '100%';
            zones[2].style.height = '100%';
        }
    });
}

function handleImpact(e) {
    const court = document.getElementById('court');
    const rect = court.getBoundingClientRect();
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const target = e.target.closest('.zone, .fault-area');
    if (!target) return;

    const player = target.dataset.player || 'p1';
    const points = parseInt(target.dataset.points) || 0;
    const type = target.dataset.type || 'extreme';

    // Si c'est une faute et que les fautes ne sont pas pénalisées, points = 0
    const isFault = type === 'fault';
    const finalPoints = (isFault && !badmintonFaultPenalty) ? 0 : points;

    // Marquer l'impact
    const impact = document.createElement('div');
    impact.className = 'impact absolute w-3 h-3 bg-yellow-400 rounded-full';
    impact.style.left = x + 'px';
    impact.style.top = y + 'px';
    court.appendChild(impact);

    // Mettre à jour les scores
    matchPoints[player] += finalPoints;
    if (!ratioData[player][type]) ratioData[player][type] = 0;
    ratioData[player][type]++;

    // Mettre à jour l'affichage
    document.getElementById('score-display').innerText = `${matchPoints.p2} - ${matchPoints.p1}`;
    updateRatios();

    // Historique
    historyStack.push({ element: impact, player, points: finalPoints, type });
    redoStack = [];
}

function handleTouch(e) {
    e.preventDefault();
    const touch = e.touches[0];
    handleImpact({
        clientX: touch.clientX,
        clientY: touch.clientY,
        target: document.elementFromPoint(touch.clientX, touch.clientY)
    });
}

function updateRatios() {
    const p1Total = ratioData.p1.extreme + ratioData.p1.middle + (ratioData.p1.corner || 0) + (ratioData.p1.fault || 0);
    const p2Total = ratioData.p2.extreme + ratioData.p2.middle + (ratioData.p2.corner || 0) + (ratioData.p2.fault || 0);
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
    if (ratioData[last.player][last.type] > 0) ratioData[last.player][last.type]--;
    
    document.getElementById('score-display').innerText = `${matchPoints.p2} - ${matchPoints.p1}`;
    updateRatios();
}

function resetCourt() {
    document.querySelectorAll('#court .impact').forEach(el => el.remove());
    matchPoints = { p1: 0, p2: 0 };
    ratioData = { 
        p1: { middle: 0, extreme: 0, corner: 0, fault: 0 }, 
        p2: { middle: 0, extreme: 0, corner: 0, fault: 0 } 
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
// 5. FIN DE MATCH (ENVOI FIREBASE)
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
                middle: ratioData.p1.middle,
                corner: ratioData.p1.corner || 0,
                fault: ratioData.p1.fault || 0,
                total: matchPoints.p1 
            },
            p2: { 
                extreme: ratioData.p2.extreme, 
                middle: ratioData.p2.middle,
                corner: ratioData.p2.corner || 0,
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
            
            // ✅ Afficher les graphiques après le match
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