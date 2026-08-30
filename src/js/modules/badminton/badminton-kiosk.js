// src/js/modules/badminton/badminton-kiosk.js
// Interface élève : Sélection Terrain -> Terrain 3D avec impacts persistants
// Reprend intégralement la logique de BadZ Impact (Webjéjé) et l'intègre au Round Robin EPS-Arena.
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

// Variables pour la configuration du terrain
let middleZoneSize = 33;
let isFrontBackLayout = true; // Thème : Avant/Arrière (vrai) ou Gauche/Droite (faux)
let centerPoints = 1;
let otherPoints = 3;

export function initBadmintonKiosk(classe) {
    currentClasse = classe;
    currentTerrain = '';
    
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
            // Si on revient sur l'écran, on regénère la configuration du terrain
            checkAndSetupTerrain();
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
    checkAndSetupTerrain();
};

window.resetBadmintonSelection = function() {
    currentTerrain = '';
    renderTerrainSelection();
};

// --- 2. PRÉPARATION DU TERRAIN (Joueurs & Matchs) ---
function checkAndSetupTerrain() {
    const nbPlayers = terrainsConfig[currentTerrain] || 0;
    const lettres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    playersList = lettres.slice(0, nbPlayers);

    if (playersList.length < 2) {
        document.getElementById('badminton-content').innerHTML = `
            <div class="text-center bg-slate-800 p-10 rounded-3xl border border-slate-700">
                <p class="text-2xl font-black text-white">En attente d'autres joueurs sur ce terrain...</p>
            </div>`;
        return;
    }

    generateRoundRobin();
    findNextMatch();
}

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
    let match = matchSchedule.find(m => m.s1 === null);
    
    if (!match) {
        renderStandings();
        document.getElementById('badminton-content').innerHTML = `
            <div class="text-center bg-slate-800 p-10 rounded-3xl border border-slate-700 mb-4">
                <div class="text-6xl mb-4">🏆</div>
                <p class="text-2xl font-black text-white">Tous les matchs sont terminés !</p>
            </div>` + document.getElementById('badminton-content').innerHTML;
        return;
    }

    currentMatch = match;
    matchPoints = { p1: 0, p2: 0 };
    ratioData = { p1: { middle: 0, extreme: 0 }, p2: { middle: 0, extreme: 0 } };
    historyStack = [];
    redoStack = [];
    
    renderCourtInterface();
}

// --- 3. INTERFACE DU TERRAIN (Basée sur le code Webjéjé) ---
function renderCourtInterface() {
    const container = document.getElementById('badminton-content');

    // Génération du HTML du terrain avec les zones selon le layout
    const zoneHtml = isFrontBackLayout ? `
        <div class="flex flex-col h-full">
            <div class="zone front flex-1" data-player="p1" data-points="${otherPoints}">${otherPoints} pts</div>
            <div class="zone middle flex-1" data-player="p1" data-points="${centerPoints}">${centerPoints} pt</div>
            <div class="zone back flex-1" data-player="p1" data-points="${otherPoints}">${otherPoints} pts</div>
        </div>` : `
        <div class="flex flex-row h-full">
            <div class="zone left flex-1" data-player="p1" data-points="${otherPoints}">${otherPoints} pts</div>
            <div class="zone center flex-1" data-player="p1" data-points="${centerPoints}">${centerPoints} pt</div>
            <div class="zone right flex-1" data-player="p1" data-points="${otherPoints}">${otherPoints} pts</div>
        </div>`;

    container.innerHTML = `
        <!-- Barre de titre et score -->
        <div class="flex justify-between items-center mb-4">
            <div class="text-center w-1/3">
                <h3 class="text-xl font-black text-white">${currentMatch.p1}</h3>
                <p class="text-xs text-slate-400">Joueur 1</p>
            </div>
            <div class="text-center w-1/3">
                <h3 id="score-display" class="text-3xl font-black text-yellow-400">0 - 0</h3>
            </div>
            <div class="text-center w-1/3">
                <h3 class="text-xl font-black text-white">${currentMatch.p2}</h3>
                <p class="text-xs text-slate-400">Joueur 2</p>
            </div>
        </div>

        <!-- Contrôles (Slider + Layout + Points) -->
        <div class="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-4">
            <div class="flex items-center justify-between mb-2">
                <label class="text-xs font-bold text-slate-400">Largeur zone centrale : <span id="zone-size-display">${middleZoneSize}%</span></label>
                <input type="range" id="middle-zone-slider" min="20" max="60" value="${middleZoneSize}" class="w-1/2">
            </div>
            <div class="flex items-center justify-between">
                <button onclick="toggleLayout()" class="bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-black">Changer Layout</button>
                <div class="flex gap-2">
                    <label class="text-xs text-slate-400">Centre: 
                        <select id="center-points" class="bg-slate-900 text-white p-1 rounded">
                            <option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option>
                        </select>
                    </label>
                    <label class="text-xs text-slate-400">Ext: 
                        <select id="other-points" class="bg-slate-900 text-white p-1 rounded">
                            <option value="1">1</option><option value="2">2</option><option value="3" selected>3</option><option value="4">4</option><option value="5">5</option>
                        </select>
                    </label>
                </div>
            </div>
        </div>

        <!-- Le terrain 3D -->
        <div id="court" class="court-container relative w-full max-w-2xl mx-auto mb-4 shadow-2xl" style="background-color: #4CAF50; aspect-ratio: 2/1; border-radius: 15px; transform: perspective(1000px) rotateX(10deg);">
            <div class="absolute inset-0 flex">
                <div class="w-1/2 h-full relative p-0">
                    ${zoneHtml}
                    <div id="ratio-p1" class="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs font-bold">0%</div>
                </div>
                <div class="w-1 h-full bg-black"></div>
                <div class="w-1/2 h-full relative p-0">
                    ${zoneHtml.replace(/p1/g, 'p2')}
                    <div id="ratio-p2" class="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs font-bold">0%</div>
                </div>
            </div>
            <!-- Impacts persistants injectés ici -->
        </div>

        <div class="flex justify-center gap-4 mb-4">
            <button onclick="undoImpact()" class="bg-slate-600 text-white px-4 py-2 rounded-xl font-bold">↩ Annuler</button>
            <button onclick="resetCourt()" class="bg-red-600 text-white px-4 py-2 rounded-xl font-bold">Reset</button>
            <button onclick="endMatch()" class="bg-emerald-600 text-white px-6 py-2 rounded-xl font-black">🏁 Terminer Match</button>
        </div>

        <div id="classement-terrain" class="mt-4 bg-slate-800 p-4 rounded-2xl border border-slate-700">
            <h3 class="font-black text-blue-400 uppercase text-sm mb-2">Classement</h3>
            <div id="classement-content" class="space-y-2"></div>
        </div>
    `;

    // Écouteurs pour les sliders et selects
    document.getElementById('middle-zone-slider').addEventListener('input', updateZoneSize);
    document.getElementById('center-points').addEventListener('change', updateZonePoints);
    document.getElementById('other-points').addEventListener('change', updateZonePoints);
    document.getElementById('court').addEventListener('click', handleImpact);
    // Support tactile
    document.getElementById('court').addEventListener('touchstart', handleTouch, { passive: false });

    // Initialisation des tailles
    updateZoneSize();
    renderStandings();
}

// --- 4. GESTION DES INTERACTIONS (Sliders, Layout, Impacts) ---
function updateZoneSize() {
    const slider = document.getElementById('middle-zone-slider');
    if (!slider) return;
    
    middleZoneSize = parseInt(slider.value);
    document.getElementById('zone-size-display').innerText = middleZoneSize + '%';
    const sideSize = (100 - middleZoneSize) / 2;

    document.querySelectorAll('#court .w-1/2').forEach((half) => {
        // Applique la taille en fonction du layout (vertical ou horizontal)
        const zones = half.querySelectorAll('.zone');
        if (isFrontBackLayout) {
            zones[0].style.height = sideSize + '%';
            zones[1].style.height = middleZoneSize + '%';
            zones[2].style.height = sideSize + '%';
        } else {
            zones[0].style.width = sideSize + '%';
            zones[1].style.width = middleZoneSize + '%';
            zones[2].style.width = sideSize + '%';
        }
    });
}

function toggleLayout() {
    isFrontBackLayout = !isFrontBackLayout;
    // On régénère simplement l'interface
    renderCourtInterface();
}

function updateZonePoints() {
    centerPoints = parseInt(document.getElementById('center-points').value);
    otherPoints = parseInt(document.getElementById('other-points').value);
    
    document.querySelectorAll('.zone').forEach(zone => {
        const player = zone.dataset.player;
        const isMiddle = zone.classList.contains('middle') || zone.classList.contains('center');
        const points = isMiddle ? centerPoints : otherPoints;
        zone.setAttribute('data-points', points);
        zone.innerText = points + ' pt' + (points > 1 ? 's' : '');
    });
}

function handleImpact(e) {
    const court = document.getElementById('court');
    const rect = court.getBoundingClientRect();
    
    // Calcul position relative au clic
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // On cherche la zone cliquée
    const target = e.target.closest('.zone');
    if (!target) return;

    const player = target.dataset.player;
    const points = parseInt(target.dataset.points);
    const isMiddle = target.classList.contains('middle') || target.classList.contains('center');

    // Création d'un impact persistant
    const impact = document.createElement('div');
    impact.className = 'impact absolute w-3 h-3 bg-yellow-400 rounded-full';
    impact.style.left = x + 'px';
    impact.style.top = y + 'px';
    court.appendChild(impact);

    // Mise à jour du score et du ratio
    matchPoints[player] += points;
    ratioData[player][isMiddle ? 'middle' : 'extreme']++;

    // Mise à jour de l'affichage
    document.getElementById('score-display').innerText = `${matchPoints.p1} - ${matchPoints.p2}`;
    
    const p1Total = ratioData.p1.extreme + ratioData.p1.middle;
    const p2Total = ratioData.p2.extreme + ratioData.p2.middle;
    document.getElementById('ratio-p1').innerText = (p1Total > 0 ? Math.round((ratioData.p1.extreme / p1Total) * 100) : 0) + '%';
    document.getElementById('ratio-p2').innerText = (p2Total > 0 ? Math.round((ratioData.p2.extreme / p2Total) * 100) : 0) + '%';

    // Gestion de l'historique (Annuler)
    historyStack.push({ element: impact, player, points, isMiddle });
    redoStack = [];
    updateUndoRedoButtons();
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
    
    document.getElementById('score-display').innerText = `${matchPoints.p1} - ${matchPoints.p2}`;
    
    const p1Total = ratioData.p1.extreme + ratioData.p1.middle;
    const p2Total = ratioData.p2.extreme + ratioData.p2.middle;
    document.getElementById('ratio-p1').innerText = (p1Total > 0 ? Math.round((ratioData.p1.extreme / p1Total) * 100) : 0) + '%';
    document.getElementById('ratio-p2').innerText = (p2Total > 0 ? Math.round((ratioData.p2.extreme / p2Total) * 100) : 0) + '%';
    
    updateUndoRedoButtons();
}

function resetCourt() {
    // Supprime tous les impacts
    document.querySelectorAll('#court .impact').forEach(el => el.remove());
    matchPoints = { p1: 0, p2: 0 };
    ratioData = { p1: { middle: 0, extreme: 0 }, p2: { middle: 0, extreme: 0 } };
    
    document.getElementById('score-display').innerText = '0 - 0';
    document.getElementById('ratio-p1').innerText = '0%';
    document.getElementById('ratio-p2').innerText = '0%';
    
    historyStack = [];
    redoStack = [];
    updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
    // (Les boutons undo/redo sont gérés visuellement via la présence de l'historique)
}

// --- 5. FIN DE MATCH ET ENVOI ---
window.endMatch = function() {
    if (!currentMatch) return;
    if (confirm(`Valider le score ${matchPoints.p1} - ${matchPoints.p2} ?`)) {
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
            findNextMatch();
        })
        .catch(err => alert("Erreur envoi : " + err.message));
    }
};

// --- 6. CLASSEMENT ---
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
        html += `<div class="flex items-center justify-between p-2 rounded-xl border ${player === currentMatch?.p1 || player === currentMatch?.p2 ? 'bg-slate-900 border-slate-600' : 'bg-slate-900 border-slate-700'}">
                    <div class="flex items-center gap-3">
                        <span class="font-black text-slate-500 w-6">${idx + 1}</span>
                        <span class="font-black text-xl text-white">${player}</span>
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