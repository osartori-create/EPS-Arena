// src/js/modules/badminton/badminton-ui.js
// Rendu des écrans

import { SEUIL_MANIERE } from './badminton-utils.js';

export function renderTerrainSelection(container, terrainsConfig, onSelect) {
    let html = `<div class="bg-slate-800 p-6 rounded-2xl border border-slate-700 text-center w-full max-w-5xl mx-auto">
        <h2 class="text-3xl font-black text-white mb-6">🏸 Choisis ton terrain</h2>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-6">`;
    Object.keys(terrainsConfig).forEach(terrain => {
        html += `<button onclick="window.selectBadmintonTerrain(${terrain})" class="bg-blue-600 p-10 rounded-2xl font-black text-4xl text-white active:scale-95 transition-transform shadow-lg">Terrain ${terrain}</button>`;
    });
    html += `</div></div>`;
    container.innerHTML = html;
}

export function renderMatchSetup(container, terrain, schedule, players, onSelectMatch) {
    if (players.length < 2) {
        container.innerHTML = `<div class="text-center bg-slate-800 p-10 rounded-3xl border border-slate-700 w-full max-w-4xl mx-auto">
            <p class="text-2xl font-black text-white">En attente d'autres joueurs sur ce terrain...</p>
        </div>`;
        return;
    }

    let html = `
        <div class="flex flex-col lg:flex-row gap-6 w-full max-w-7xl mx-auto">
            <div class="w-full lg:w-1/3 bg-slate-800 p-6 rounded-2xl border border-slate-700">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-xl font-black text-white">Terrain ${terrain}</h2>
                    <button onclick="window.retourTerrains()" class="bg-red-600 px-3 py-1 rounded-lg text-xs font-black text-white">←</button>
                </div>
                <h3 class="text-xs font-bold text-slate-400 uppercase mb-2">Programmation</h3>
                <div class="space-y-2 max-h-64 overflow-y-auto pr-2">
                    ${schedule.map(match => {
                        const isPlayed = match.pts1 !== null;
                        const scoreDisplay = isPlayed ? `${match.pts1} - ${match.pts2}` : 'À jouer';
                        const playedStyle = isPlayed ? 'line-through opacity-60' : '';
                        const clickAction = isPlayed ? '' : `onclick="window.selectMatch('${match.id}')"`;
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
}

export function renderClassement(container, standings) {
    let html = `<h3 class="text-xs font-bold text-slate-400 uppercase mb-2">Classement</h3><div class="space-y-2">`;
    standings.forEach(([player, data], idx) => {
        html += `<div class="bg-slate-900 p-2 rounded-lg border border-slate-700 flex justify-between items-center">
            <span class="font-black text-white">${idx + 1}. ${player}</span>
            <span class="text-xs text-slate-400">${data.pts} pts | ${data.wins}V-${data.losses}D</span>
        </div>`;
    });
    html += `</div>`;
    container.innerHTML = html;
}

export function renderCourtInterface(container, p1, p2, checkboxes, matchPoints, onCheckboxChange) {
    function renderCheckboxes(player) {
        let html = '';
        // Zone dangereuse
        html += `<div class="mb-4">
            <p class="text-sm font-bold text-slate-400">Points gagnés en zone dangereuse</p>
            <div class="grid grid-cols-5 gap-2 mt-2">`;
        for (let i = 0; i < 10; i++) {
            const checked = checkboxes[player].danger[i] ? 'checked' : '';
            html += `<label class="flex items-center justify-center bg-slate-700 rounded-lg p-2 cursor-pointer hover:bg-slate-600 transition">
                <input type="checkbox" class="w-6 h-6 accent-blue-500" data-player="${player}" data-zone="danger" data-index="${i}" ${checked}>
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
                <input type="checkbox" class="w-6 h-6 accent-green-500" data-player="${player}" data-zone="center" data-index="${i}" ${checked}>
                <span class="ml-1 text-xs text-slate-300">${i+1}</span>
            </label>`;
        }
        html += `</div></div>`;

        // Totaux
        const totalDanger = checkboxes[player].danger.filter(Boolean).length;
        const totalCenter = checkboxes[player].center.filter(Boolean).length;
        const total = totalDanger + totalCenter;
        html += `
            <div class="mt-4 flex justify-between text-sm text-slate-400">
                <span>Dangereuse : <span class="font-bold text-white">${totalDanger}</span></span>
                <span>Centrale : <span class="font-bold text-white">${totalCenter}</span></span>
                <span class="text-yellow-400 font-bold">Total : ${total}</span>
            </div>
        `;
        return html;
    }

    container.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <div class="text-center w-1/3">
                <h3 class="text-2xl font-black text-white">${p1}</h3>
                <div class="text-xs text-slate-400">Score : <span id="score-p1">${matchPoints.p1}</span></div>
            </div>
            <div class="text-center w-1/3">
                <h3 class="text-2xl font-black text-white">vs</h3>
                <div class="text-xs text-slate-400">Seuil "Avec la manière" : <span class="text-yellow-400 font-bold">${SEUIL_MANIERE} pts</span></div>
            </div>
            <div class="text-center w-1/3">
                <h3 class="text-2xl font-black text-white">${p2}</h3>
                <div class="text-xs text-slate-400">Score : <span id="score-p2">${matchPoints.p2}</span></div>
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
            <button onclick="window.endMatch()" class="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-xl font-black text-sm">🏁 Valider le match</button>
            <button onclick="window.retourTerrains()" class="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl font-bold text-sm">← Terrain</button>
        </div>
    `;
}