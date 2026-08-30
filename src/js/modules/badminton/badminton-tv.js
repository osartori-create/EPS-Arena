// src/js/modules/badminton/badminton-tv.js
// Mode TV plein écran pour le Badminton

import { db, ref, onValue } from '../../core/firebase-service.js';
import { getLocalMapping } from '../../core/live-engine.js';

let currentClasse = '';
let currentUnsub = null;

export function renderBadmintonTV() {
    const container = document.getElementById('tvGlobe');
    if (!container) return;

    // Force le mode plein écran TV
    const tvView = document.getElementById('viewTV');
    if (tvView) {
        tvView.style.display = 'block';
        tvView.style.height = '100vh';
        tvView.style.padding = '0';
        tvView.style.margin = '0';
    }

    container.style.height = '100vh';
    container.style.width = '100%';
    container.style.backgroundColor = '#0f172a';
    container.style.overflow = 'hidden';
    container.style.padding = '20px';

    const activeClasse = document.getElementById('selectClasse').value;
    if (!activeClasse) {
        container.innerHTML = '<p style="text-align:center; color:#64748b;">Choisissez une classe.</p>';
        return;
    }

    currentClasse = activeClasse;
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';

    const configRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/config`);
    onValue(configRef, (snap) => {
        const config = snap.val() || {};
        if (config.activite !== 'badminton') return;

        let terrainsConfig = {};
        for (let key in config) {
            if (!isNaN(parseInt(key))) {
                terrainsConfig[parseInt(key)] = config[key];
            }
        }

        if (currentUnsub) currentUnsub();
        const resultsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/badminton/results`);
        currentUnsub = onValue(resultsRef, (snap) => {
            const data = snap.val() || {};
            renderTVGrid(terrainsConfig, data);
        });
    });
}

function renderTVGrid(terrainsConfig, data) {
    const container = document.getElementById('tvGlobe');
    const mapping = getLocalMapping(currentClasse) || {};
    const lettres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

    // Grille adaptative pour grand écran (2, 3 ou 4 colonnes selon la taille)
    let html = '<div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 h-full w-full">';

    for (let t in terrainsConfig) {
        const terrain = t;
        const nbPlayers = terrainsConfig[t];
        const playersList = lettres.slice(0, nbPlayers);

        let terrainData = {};
        playersList.forEach(p => terrainData[p] = { pts: 0, wins: 0, losses: 0, diff: 0, total: 0, middle: 0, extreme: 0 });

        Object.values(data).forEach(m => {
            if (String(m.terrain) !== String(terrain)) return;

            if (m.s1 > m.s2) {
                terrainData[m.p1].pts += 3; terrainData[m.p1].wins++; terrainData[m.p1].diff += (m.s1 - m.s2);
                terrainData[m.p2].losses++; terrainData[m.p2].diff -= (m.s1 - m.s2);
            } else {
                terrainData[m.p2].pts += 3; terrainData[m.p2].wins++; terrainData[m.p2].diff += (m.s2 - m.s1);
                terrainData[m.p1].losses++; terrainData[m.p1].diff -= (m.s2 - m.s1);
            }

            if (m.stats) {
                let p1Stats = m.stats.p1 || { extreme: 0, middle: 0, total: 0 };
                let p2Stats = m.stats.p2 || { extreme: 0, middle: 0, total: 0 };
                terrainData[m.p1].extreme += p1Stats.extreme;
                terrainData[m.p1].middle += p1Stats.middle;
                terrainData[m.p1].total += p1Stats.total;
                terrainData[m.p2].extreme += p2Stats.extreme;
                terrainData[m.p2].middle += p2Stats.middle;
                terrainData[m.p2].total += p2Stats.total;
            }
        });

        const sortedPlayers = Object.entries(terrainData).sort((a, b) => b[1].pts - a[1].pts || b[1].diff - a[1].diff);

        // Cartes géantes pour la TV
        html += `
            <div class="bg-slate-800 rounded-3xl border-4 border-slate-600 p-6 flex flex-col shadow-2xl">
                <div class="bg-blue-600 rounded-2xl p-3 text-center mb-6">
                    <h3 class="text-5xl font-black text-white">TERRAIN ${terrain}</h3>
                </div>
                <div class="flex-1 space-y-3">
                    ${sortedPlayers.map(([player, stats], idx) => {
                        const pctBonus = stats.total > 0 ? Math.round((stats.extreme / stats.total) * 100) : 0;
                        let bonusColor = 'text-red-400';
                        if (pctBonus > 60) bonusColor = 'text-emerald-400';
                        else if (pctBonus > 40) bonusColor = 'text-amber-400';

                        const mappingKey = `${currentClasse}_${terrain}_${player}`;
                        const eleveId = mapping[mappingKey];
                        const nomEleve = eleveId ? (JSON.parse(localStorage.getItem(`eps_arena_eleves_${currentClasse}`) || '[]').find(e => e.id === eleveId)?.prenom || player) : player;

                        return `
                            <div class="flex justify-between items-center bg-slate-900 rounded-xl p-4 ${idx === 0 ? 'border-4 border-yellow-500' : 'border border-slate-700'}">
                                <div class="flex items-center gap-4 text-2xl font-bold">
                                    <span class="text-slate-500">${idx + 1}.</span>
                                    <span class="text-white">${nomEleve}</span>
                                    <span class="text-sm text-blue-400">(${player})</span>
                                </div>
                                <div class="flex items-center gap-6 text-2xl font-black">
                                    <span class="text-yellow-400">${stats.pts} pts</span>
                                    <span class="text-blue-400">${stats.wins}V - ${stats.losses}D</span>
                                    <span class="${bonusColor}">🎯 ${pctBonus}%</span>
                                </div>
                            </div>`;
                    }).join('')}
                </div>
            </div>`;
    }

    html += '</div>';
    container.innerHTML = html;
}