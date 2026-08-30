// src/js/modules/badminton/badminton-kiosk.js
// Interface élève : Sélection Terrain -> Liste Round Robin -> Terrain 3D
// Inspiré et adapté de BadZ Impact (Webjéjé) et du module EPS-Arena.
// Licence Creative Commons Attribution (CC BY).

import { db, ref, onValue, update } from '../../core/firebase-service.js';

let currentClasse = '';
let currentTerrain = '';
let playersList = [];
let matchSchedule = [];
let currentMatch = null;
let matchPoints = { p1: 0, p2: 0 };
let ratioData = { p1: { middle: 0, extreme: 0 }, p2: { middle: 0, extreme: 0 } };
let terrainsConfig = {};
let historyStack = [];
let redoStack = [];
let resultsListenerAttached = false;

let middleZoneSize = 33;
let isFrontBackLayout = true;
let centerPoints = 1;
let otherPoints = 3;

export function initBadmintonKiosk(classe) {
    currentClasse = classe;
    currentTerrain = '';
    resultsListenerAttached = false;

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
            renderMatchSetup();
        }
    });

    // IMPORTANT : On n'attache l'écouteur qu'une seule fois
    if (!resultsListenerAttached) {
        listenForScoreUpdates();
        resultsListenerAttached = true;
    }
}

// --- 1. SÉLECTION DU TERRAIN ---
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

// --- 2. GESTION DU MATCH (Liste Round Robin) ---
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

    generateRoundRobin();

    let html = `
        <div class="flex flex-col lg:flex-row gap-6 w-full max-w-7xl mx-auto">
            
            <!-- Colonne Gauche : Liste des matchs + Classement -->
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

                <!-- TABLEAU DE CLASSEMENT -->
                <div id="classement" class="mt-6"></div>
            </div>

            <!-- Colonne Droite : Terrain 3D -->
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
    console.log("🎮 Match sélectionné :", matchId);
    const match = matchSchedule.find(m => m.id === matchId);
    if (!match || match.s1 !== null) {
        console.warn("⚠️ Match déjà joué ou introuvable !");
        return;
    }
    
    currentMatch = match;
    matchPoints = { p1: 0, p2: 0 };
    ratioData = { p1: { middle: 0, extreme: 0 }, p2: { middle: 0, extreme: 0 } };
    historyStack = [];
    redoStack = [];
    
    renderCourtInterface();
};

// ÉCOUTE DES RÉSULTATS (Mise à jour de la liste et du classement)
function listenForScoreUpdates() {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const resultsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/badminton/results`);
    
    onValue(resultsRef, (snap) => {
        const data = snap.val() || {};
        console.log("📡 Données Firebase reçues :", data);

        matchSchedule.forEach(m => {
            const result = data[m.id];
            if (result && result.terrain === currentTerrain) {
                m.s1 = result.s1;
                m.s2 = result.s2;
            }
        });

        // Mise à jour de la liste des matchs
        const list = document.querySelector('#badminton-content .space-y-2');
        if (list) {
            list.innerHTML = matchSchedule.map(match => {
                const isPlayed = match.s1 !== null;
                const scoreDisplay = isPlayed ? `${match.s1} - ${match.s2}` : 'À jouer';
                const playedStyle = isPlayed ? 'line-through opacity-60' : '';
                const clickAction = isPlayed ? '' : `onclick="selectMatchFromList('${match.id}')"`;
                return `<button ${clickAction} 
                            class="w-full text-left p-3 rounded-lg border-2 transition-colors ${playedStyle} ${isPlayed ? 'bg-slate-700 border-slate-500 text-slate-300' : 'bg-slate-900 border-blue-500 text-white hover:bg-blue-900'}">
                            <div class="flex justify-between items-center font-black">
                                <span>${match.p1} vs ${match.p2}</span>
                                <span class="text-sm">${scoreDisplay}</span>
                            </div>
                        </button>`;
            }).join('');
        }
        renderClassement();
    });
}

// CALCUL ET AFFICHAGE DU CLASSEMENT
function renderClassement() {
    const container = document.getElementById('classement');
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

// --- 3. INTERFACE DU TERRAIN 3D ---
function renderCourtInterface() {
    const container = document.getElementById('court-zone');

    const controlsStyle = `
        <style>
            #middle-zone-slider {
                -webkit-appearance: none; appearance: none;
                width: 100%; height: 10px;
                background: #e2e8f0; border-radius: 9999px; outline: none;
                box-shadow: inset 0 1px 3px rgba(0,0,0,0.2);
            }
            #middle-zone-slider::-webkit-slider-thumb {
                -webkit-appearance: none; appearance: none;
                width: 26px; height: 26px;
                background: #3b82f6; border-radius: 50%;
                cursor: pointer; border: 4px solid #ffffff;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            }
            #middle-zone-slider::-moz-range-thumb {
                width: 26px; height: 26px;
                background: #3b82f6; border-radius: 50%;
                cursor: pointer; border: 4px solid #ffffff;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            }
            .switch {
                position: relative; display: inline-block; width: 60px; height: 30px;
            }
            .switch input { opacity: 0; width: 0; height: 0; }
            .slider-toggle {
                position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
                background-color: #94a3b8; transition: .4s; border-radius: 34px;
            }
            .slider-toggle:before {
                position: absolute; content: ""; height: 22px; width: 22px;
                left: 4px; bottom: 4px; background-color: white;
                transition: .4s; border-radius: 50%;
            }
            input:checked + .slider-toggle { background-color: #3b82f6; }
            input:checked + .slider-toggle:before { transform: translateX(30px); }
        </style>
    `;

    const zoneHtml = isFrontBackLayout ? `
        <div class="flex flex-col h-full">
            <div class="zone front bg-green-700" data-player="p1" data-points="${otherPoints}">${otherPoints} pts</div>
            <div class="zone middle bg-teal-400" data-player="p1" data-points="${centerPoints}">${centerPoints} pt</div>
            <div class="zone back bg-green-700" data-player="p1" data-points="${otherPoints}">${otherPoints} pts</div>
        </div>` : `
        <div class="flex flex-row h-full">
            <div class="zone left bg-green-700" data-player="p1" data-points="${otherPoints}">${otherPoints} pts</div>
            <div class="zone center bg-teal-400" data-player="p1" data-points="${centerPoints}">${centerPoints} pt</div>
            <div class="zone right bg-green-700" data-player="p1" data-points="${otherPoints}">${otherPoints} pts</div>
        </div>`;

    container.innerHTML = controlsStyle + `
        <div class="flex justify-between items-center mb-4">
            <div class="text-center w-1/3">
                <h3 class="text-3xl font-black text-white">${currentMatch.p1}</h3>
            </div>
            <div class="text-center w-1/3">
                <h3 id="score-display" class="text-5xl font-black text-yellow-400">0 - 0</h3>
            </div>
            <div class="text-center w-1/3">
                <h3 class="text-3xl font-black text-white">${currentMatch.p2}</h3>
            </div>
        </div>

        <div class="bg-slate-800 p-3 rounded-xl border border-slate-700 mb-4 flex gap-4 items-center justify-between">
            <div class="flex items-center gap-2 flex-1">
                <label class="text-xs font-bold text-slate-400">Zone : <span id="zone-size-display">${middleZoneSize}%</span></label>
                <input type="range" id="middle-zone-slider" min="20" max="60" value="${middleZoneSize}" class="w-full">
            </div>

            <div class="flex items-center gap-3">
                <label class="text-xs font-bold text-slate-400">${isFrontBackLayout ? 'Avant/Arrière' : 'Gauche/Droite'}</label>
                <label class="switch">
                    <input type="checkbox" id="layout-switch" ${!isFrontBackLayout ? 'checked' : ''}>
                    <span class="slider-toggle"></span>
                </label>
            </div>

            <div class="flex gap-2">
                <select id="center-points" class="bg-slate-900 text-white p-1 rounded text-xs">
                    <option value="1">Centre : 1</option><option value="2">Centre : 2</option><option value="3">Centre : 3</option>
                </select>
                <select id="other-points" class="bg-slate-900 text-white p-1 rounded text-xs">
                    <option value="1">Extérieur : 1</option><option value="2">Extérieur : 2</option><option value="3" selected>Extérieur : 3</option>
                </select>
            </div>
        </div>

        <div id="court" class="court-container relative w-full mx-auto mb-4 shadow-2xl" style="background-color: #15803d; height: 55vh; border-radius: 15px; transform: perspective(1000px) rotateX(10deg);">
            <div class="absolute inset-0 flex">
                <div class="half-court w-1/2 h-full relative p-0">
                    ${zoneHtml}
                    <div id="ratio-p1" class="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs font-bold">0%</div>
                </div>
                <div class="w-1 h-full bg-black"></div>
                <div class="half-court w-1/2 h-full relative p-0">
                    ${zoneHtml.replace(/p1/g, 'p2')}
                    <div id="ratio-p2" class="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs font-bold">0%</div>
                </div>
            </div>
        </div>

        <div class="flex justify-center gap-4">
            <button onclick="undoImpact()" class="bg-slate-600 text-white px-4 py-2 rounded-xl font-bold">↩ Annuler</button>
            <button onclick="resetCourt()" class="bg-red-600 text-white px-4 py-2 rounded-xl font-bold">Reset</button>
            <button onclick="endMatch()" class="bg-emerald-600 text-white px-6 py-2 rounded-xl font-black">🏁 Terminer Match</button>
            <button onclick="window.retourTerrains()" class="bg-slate-700 text-white px-6 py-2 rounded-xl font-bold">← Terrain</button>
        </div>
    `;

    document.getElementById('middle-zone-slider').addEventListener('input', updateZoneSize);
    document.getElementById('center-points').addEventListener('change', updateZonePoints);
    document.getElementById('other-points').addEventListener('change', updateZonePoints);
    document.getElementById('court').addEventListener('click', handleImpact);
    document.getElementById('court').addEventListener('touchstart', handleTouch, { passive: false });

    document.getElementById('layout-switch').addEventListener('change', (e) => {
        isFrontBackLayout = !e.target.checked;
        renderCourtInterface();
    });

    updateZoneSize();
}

// --- 4. INTERACTIONS ---
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

function updateZonePoints() {
    centerPoints = parseInt(document.getElementById('center-points').value);
    otherPoints = parseInt(document.getElementById('other-points').value);
    
    document.querySelectorAll('.zone').forEach(zone => {
        const isMiddle = zone.classList.contains('middle') || zone.classList.contains('center');
        const points = isMiddle ? centerPoints : otherPoints;
        zone.setAttribute('data-points', points);
        zone.innerText = points + ' pt' + (points > 1 ? 's' : '');
    });
}

function handleImpact(e) {
    const court = document.getElementById('court');
    const rect = court.getBoundingClientRect();
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const target = e.target.closest('.zone');
    if (!target) return;

    const player = target.dataset.player;
    const points = parseInt(target.dataset.points);
    const isMiddle = target.classList.contains('middle') || target.classList.contains('center');

    const impact = document.createElement('div');
    impact.className = 'impact absolute w-3 h-3 bg-yellow-400 rounded-full';
    impact.style.left = x + 'px';
    impact.style.top = y + 'px';
    court.appendChild(impact);

    matchPoints[player] += points;
    ratioData[player][isMiddle ? 'middle' : 'extreme']++;

    document.getElementById('score-display').innerText = `${matchPoints.p2} - ${matchPoints.p1}`;
    
    const p1Total = ratioData.p1.extreme + ratioData.p1.middle;
    const p2Total = ratioData.p2.extreme + ratioData.p2.middle;
    document.getElementById('ratio-p1').innerText = (p1Total > 0 ? Math.round((ratioData.p1.extreme / p1Total) * 100) : 0) + '%';
    document.getElementById('ratio-p2').innerText = (p2Total > 0 ? Math.round((ratioData.p2.extreme / p2Total) * 100) : 0) + '%';

    historyStack.push({ element: impact, player, points, isMiddle });
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

function undoImpact() {
    if (historyStack.length === 0) return;
    const last = historyStack.pop();
    redoStack.push(last);
    last.element.remove();
    
    matchPoints[last.player] -= last.points;
    ratioData[last.player][last.isMiddle ? 'middle' : 'extreme']--;
    
    document.getElementById('score-display').innerText = `${matchPoints.p2} - ${matchPoints.p1}`;
    
    const p1Total = ratioData.p1.extreme + ratioData.p1.middle;
    const p2Total = ratioData.p2.extreme + ratioData.p2.middle;
    document.getElementById('ratio-p1').innerText = (p1Total > 0 ? Math.round((ratioData.p1.extreme / p1Total) * 100) : 0) + '%';
    document.getElementById('ratio-p2').innerText = (p2Total > 0 ? Math.round((ratioData.p2.extreme / p2Total) * 100) : 0) + '%';
}

function resetCourt() {
    document.querySelectorAll('#court .impact').forEach(el => el.remove());
    matchPoints = { p1: 0, p2: 0 };
    ratioData = { p1: { middle: 0, extreme: 0 }, p2: { middle: 0, extreme: 0 } };
    
    document.getElementById('score-display').innerText = '0 - 0';
    document.getElementById('ratio-p1').innerText = '0%';
    document.getElementById('ratio-p2').innerText = '0%';
    
    historyStack = [];
    redoStack = [];
}

window.undoImpact = undoImpact;
window.resetCourt = resetCourt;

// --- 5. FIN DE MATCH (ENVOI FIREBASE) ---
window.endMatch = function() {
    if (!currentMatch) {
        console.error("❌ Aucun match en cours !");
        return;
    }
    
    // On inverse les scores (p2 - p1) comme demandé pour l'affichage
    const p1 = currentMatch.p1;
    const p2 = currentMatch.p2;
    const s1 = matchPoints.p2;
    const s2 = matchPoints.p1;

    if (confirm(`Valider le score ${s1} - ${s2} ?`)) {
        console.log("📤 Envoi du résultat à Firebase :", { terrain: currentTerrain, p1, p2, s1, s2 });

        const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
        const resultRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/badminton/results/${currentMatch.id}`);
        
        update(resultRef, { terrain: currentTerrain, p1, p2, s1, s2, timestamp: Date.now() })
        .then(() => {
            console.log("✅ Résultat envoyé avec succès !");
            
            // Mise à jour locale
            const matchIndex = matchSchedule.findIndex(m => m.id === currentMatch.id);
            if (matchIndex !== -1) {
                matchSchedule[matchIndex].s1 = s1;
                matchSchedule[matchIndex].s2 = s2;
            } else {
                matchSchedule.push({ ...currentMatch, s1, s2 });
            }
            
            currentMatch = null;
            renderMatchSetup(); // Retour à la liste, qui se grisera grâce à l'écoute Firebase
        })
        .catch(err => console.error("❌ Erreur envoi Firebase :", err));
    }
};