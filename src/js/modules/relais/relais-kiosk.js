// src/js/modules/relais/relais-kiosk.js
// Kiosque élève : menu + saisie vitesses + relais 10s OU relais 2 zones
// ⚠️ RGPD : aucune donnée nominative.

import { db, ref, onValue, push, set } from '../../core/firebase-service.js';
import {
    zoneToVitesse, calculerVTheorique, calculerScore, getScoreCouleur, getScoreLabel,
    getPairesGroupe, NB_PLOTS, calculerScoreEquipe,
    calculerPourcentageTransmission, calculerPointsTransmission,
    getScoreCouleurTransmission, getLabelTransmission, PALIERS_TRANSMISSION
} from './relais-core.js';

const state = {
    classe: '',
    config: null,
    vitesses: {},
    mesures: {},
    mode: 'menu',
    currentCode: null,
    currentGroupeIdx: null,
    currentPaire: null,
    currentVitesses: { arret: null, lance: null },
    currentZone: 0,
    lastFeedback: null,
    chrono: {
        clicks: 0,
        times: [],
        startTime: null,
        elapsedTime: 0,
        timerInterval: null
    }
};

let configListener = null;
let vitessesListener = null;
let mesuresListener = null;

// ============================================================
// INITIALISATION
// ============================================================
export function initRelaisKiosk(classe, code) {
    state.classe = classe;
    state.mode = 'menu';

    const container = document.getElementById('relais-module');
    if (!container) {
        console.error('[Relais Kiosk] Conteneur relais-module introuvable');
        return;
    }
    container.innerHTML = '';
    container.classList.remove('hidden');

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const basePath = `etablissements/0680013V/profs/${profCode}/${classe}/relais`;

    // ---------- CONFIG ----------
    if (configListener) configListener();
    configListener = onValue(ref(db, `${basePath}/config`), (snap) => {
        state.config = snap.val() || null;
        render();
    });

    // ---------- VITESSES ----------
    if (vitessesListener) vitessesListener();
    vitessesListener = onValue(ref(db, `${basePath}/vitesses`), (snap) => {
        state.vitesses = snap.val() || {};
        render();
    });

    // ---------- MESURES (écoute les 2 sous-dossiers) ----------
    if (mesuresListener) mesuresListener();

    let _m10 = {};
    let _m2z = {};

    const unsub10s = onValue(ref(db, `${basePath}/mesures-10s`), (snap) => {
        _m10 = snap.val() || {};
        // Si on est en mode 10s, on alimente state.mesures
        if (state.config?.sousActivite !== 'relais2zones') {
            state.mesures = _m10;
            if (state.mode === 'feedback' || state.mode === 'menu' || state.mode === 'classement') render();
        }
    });

    const unsub2z = onValue(ref(db, `${basePath}/mesures-2zones`), (snap) => {
        _m2z = snap.val() || {};
        // Si on est en mode 2 zones, on alimente state.mesures
        if (state.config?.sousActivite === 'relais2zones') {
            state.mesures = _m2z;
            if (state.mode === 'feedback' || state.mode === 'menu' || state.mode === 'classement') render();
        }
    });

    mesuresListener = () => {
        unsub10s();
        unsub2z();
    };
}

// ============================================================
// ROUTAGE
// ============================================================
function render() {
    const container = document.getElementById('relais-module');
    if (!container) return;

    if (!state.config) {
        container.innerHTML = `<div class="text-center py-10 text-slate-400"><p class="text-2xl">⏳ En attente de la configuration du professeur...</p></div>`;
        return;
    }

    switch (state.mode) {
        case 'menu':            renderMenu(container); break;
        case 'select-eleve':    renderSelectCode(container); break;
        case 'saisie-vitesses': renderSaisieVitesses(container); break;
        case 'select-groupe':   renderSelectGroupe(container); break;
        case 'select-paire':    renderSelectPaire(container); break;
        case 'saisie-zone':     renderSaisieZone(container); break;
        case 'chrono-2zones':   renderChrono2Zones(container); break;
        case 'feedback':        renderFeedback(container); break;
        case 'classement':      renderClassement(container); break;
    }
}

function getSousActivite() {
    return state.config?.sousActivite || 'relais10s';
}

function getBannerHtml() {
    const mode = state.config.mode || 'essai';
    if (mode === 'competition') {
        return `<div class="bg-yellow-500 text-black text-center font-black uppercase py-2 px-4 rounded-xl mb-4 text-sm tracking-wider">🏆 MODE COMPÉTITION</div>`;
    }
    return `<div class="bg-emerald-500 text-white text-center font-black uppercase py-2 px-4 rounded-xl mb-4 text-sm tracking-wider">🌱 MODE ESSAI</div>`;
}

// ============================================================
// MENU PRINCIPAL
// ============================================================
function renderMenu(container) {
    const sousActivite = getSousActivite();
    const mesuresArray = Object.values(state.mesures);
    const totalEssais = mesuresArray.length;

    container.innerHTML = `
        ${getBannerHtml()}
        <div class="space-y-4">
            <div class="text-center py-4">
                <h2 class="text-3xl font-black text-white mb-2">🏁 Relais</h2>
                <p class="text-slate-400 text-sm">${sousActivite === 'relais2zones' ? '⏱️ Mode 2 zones' : '🏁 Mode 10 secondes'}</p>
            </div>

            <button onclick="window.relaisKioskGoTo('select-eleve')"
                    class="w-full bg-blue-600 hover:bg-blue-500 py-6 rounded-3xl font-black text-xl text-white active:scale-95 transition-all shadow-xl">
                🏃 Saisir mes vitesses
                <p class="text-xs font-normal opacity-80 mt-1">Départ arrêté / Départ lancé</p>
            </button>

            <button onclick="window.relaisKioskGoTo('select-groupe')"
                    class="w-full bg-orange-600 hover:bg-orange-500 py-6 rounded-3xl font-black text-xl text-white active:scale-95 transition-all shadow-xl">
                🏁 Courir un relais
                <p class="text-xs font-normal opacity-80 mt-1">${sousActivite === 'relais2zones' ? 'Chrono 4 clics' : 'Choisir un groupe et une paire'}</p>
            </button>

            <button onclick="window.relaisKioskGoTo('classement')"
                    class="w-full bg-purple-600 hover:bg-purple-500 py-6 rounded-3xl font-black text-xl text-white active:scale-95 transition-all shadow-xl">
                🏆 Voir le classement
                <p class="text-xs font-normal opacity-80 mt-1">${totalEssais} essai${totalEssais > 1 ? 's' : ''} enregistré${totalEssais > 1 ? 's' : ''}</p>
            </button>

            <button onclick="window.retourMenuRelais()"
                    class="w-full bg-slate-700 hover:bg-slate-600 py-4 rounded-2xl font-black text-sm text-white active:scale-95 transition-all mt-4">
                ← Retour au menu général
            </button>
        </div>
    `;
}

// ============================================================
// SAISIE DES VITESSES
// ============================================================
function renderSelectCode(container) {
    const groupes = state.config.groupes || {};
    const codes = [];
    Object.entries(groupes).forEach(([idx, groupe]) => {
        groupe.membres.forEach(m => {
            codes.push({
                code: `${idx}_${m.lettre}`,
                label: `G${groupe.numero}${m.lettre}`,
                groupeIdx: idx,
                lettre: m.lettre
            });
        });
    });

    let html = `
        ${getBannerHtml()}
        <div class="space-y-3">
            <div class="flex justify-between items-center">
                <h2 class="text-xl font-black text-white">🏃 Saisir mes vitesses</h2>
                <button onclick="window.relaisKioskGoTo('menu')" class="bg-slate-700 px-3 py-1.5 rounded-xl font-black text-xs text-white active:scale-95">← Retour</button>
            </div>
            <p class="text-slate-400 text-sm">Demande à ton prof ton code (ex : G1a) et clique dessus.</p>
            <div class="grid grid-cols-3 md:grid-cols-4 gap-3">
    `;

    codes.forEach(c => {
        const v = state.vitesses[c.code] || {};
        const hasV = v.arret && v.lance;
        const bgClass = hasV ? 'bg-emerald-700 border-emerald-400' : 'bg-blue-700 border-blue-400';

        html += `
            <button onclick="window.relaisKioskSelectCode('${c.code}')"
                    class="${bgClass} p-5 rounded-2xl font-black text-2xl text-white border-2 active:scale-95 transition-all">
                ${c.label}
                ${hasV ? '<span class="block text-xs font-normal mt-1">✓ saisi</span>' : ''}
            </button>
        `;
    });

    html += `</div></div>`;
    container.innerHTML = html;
}

function renderSaisieVitesses(container) {
    const code = state.currentCode;
    if (!code) { window.relaisKioskGoTo('select-eleve'); return; }

    const v = state.vitesses[code] || {};
    const arret = state.currentVitesses.arret !== null ? state.currentVitesses.arret : (v.arret || null);
    const lance = state.currentVitesses.lance !== null ? state.currentVitesses.lance : (v.lance || null);

    const renderZoneSelector = (type, value) => {
        let html = `<div class="grid grid-cols-7 gap-1">`;
        for (let z = 1; z <= NB_PLOTS; z++) {
            const kmh = zoneToVitesse(z);
            const selected = value === kmh;
            html += `
                <button onclick="window.relaisKioskSetZone('${type}', ${z})"
                        class="py-3 rounded-lg font-black text-sm ${selected ? 'bg-blue-600 text-white ring-2 ring-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'} active:scale-95 transition-all">
                    ${kmh}
                </button>
            `;
        }
        html += `</div>`;
        return html;
    };

    container.innerHTML = `
        ${getBannerHtml()}
        <div class="space-y-4">
            <div class="flex justify-between items-center">
                <h2 class="text-xl font-black text-white">🏃 Code : ${code.replace('_', '')}</h2>
                <button onclick="window.relaisKioskGoTo('select-eleve')" class="bg-slate-700 px-3 py-1.5 rounded-xl font-black text-xs text-white active:scale-95">← Retour</button>
            </div>

            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <h3 class="font-bold text-white mb-1">🅰️ 5'' Départ arrêté</h3>
                <p class="text-xs text-slate-400 mb-3">Zone atteinte (km/h)</p>
                ${renderZoneSelector('arret', arret)}
                <p class="mt-2 text-sm font-bold ${arret ? 'text-emerald-400' : 'text-slate-500'}">
                    ${arret ? `✓ ${arret} km/h` : 'Aucune zone sélectionnée'}
                </p>
            </div>

            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <h3 class="font-bold text-white mb-1">🅱️ 5'' Départ lancé</h3>
                <p class="text-xs text-slate-400 mb-3">Zone atteinte (km/h)</p>
                ${renderZoneSelector('lance', lance)}
                <p class="mt-2 text-sm font-bold ${lance ? 'text-emerald-400' : 'text-slate-500'}">
                    ${lance ? `✓ ${lance} km/h` : 'Aucune zone sélectionnée'}
                </p>
            </div>

            <button onclick="window.relaisKioskValiderVitesses()"
                    class="w-full py-5 rounded-2xl font-black text-xl uppercase ${arret && lance ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}"
                    ${arret && lance ? '' : 'disabled'}>
                ✅ Enregistrer mes vitesses
            </button>
        </div>
    `;
}

// ============================================================
// SÉLECTION DU GROUPE
// ============================================================
function renderSelectGroupe(container) {
    const groupes = state.config.groupes || {};
    const mesuresArray = Object.values(state.mesures);

    const scoresParGroupe = {};
    Object.entries(groupes).forEach(([idx]) => {
        const mg = mesuresArray.filter(m => String(m.groupeIdx) === String(idx));
        scoresParGroupe[idx] = calculerScoreEquipe(mg);
    });

    const rangs = {};
    const sorted = Object.entries(scoresParGroupe).sort((a, b) => b[1] - a[1]);
    sorted.forEach(([idx], rank) => { rangs[idx] = rank + 1; });

    let html = `
        ${getBannerHtml()}
        <div class="space-y-4">
            <div class="flex justify-between items-center">
                <h2 class="text-xl font-black text-white">🏁 Choisis ton groupe</h2>
                <button onclick="window.relaisKioskGoTo('menu')" class="bg-slate-700 px-3 py-1.5 rounded-xl font-black text-xs text-white active:scale-95">← Retour</button>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
    `;

    Object.entries(groupes).forEach(([idx, groupe]) => {
        const membresStr = (groupe.membres || []).map(m => m.lettre).join(', ');
        const score = scoresParGroupe[idx] || 0;
        const rang = rangs[idx];
        const medaille = rang === 1 ? '🥇' : (rang === 2 ? '🥈' : (rang === 3 ? '🥉' : ''));

        html += `
            <button onclick="window.relaisKioskSelectGroupe(${idx})"
                    class="bg-slate-800 hover:bg-slate-700 border-2 border-slate-700 hover:border-blue-500 p-4 rounded-2xl active:scale-95 transition-all text-left relative">
                ${medaille ? `<span class="absolute top-2 right-2 text-xl">${medaille}</span>` : ''}
                <div class="text-2xl font-black text-yellow-400 mb-1">G${groupe.numero || (parseInt(idx) + 1)}</div>
                <div class="text-xs text-slate-400">Élèves : ${membresStr}</div>
                <div class="mt-2 text-lg font-black text-emerald-400">${score.toFixed(1)} pts</div>
            </button>
        `;
    });

    html += `</div></div>`;
    container.innerHTML = html;
}

// ============================================================
// SÉLECTION DE LA PAIRE
// ============================================================
function renderSelectPaire(container) {
    const groupeIdx = state.currentGroupeIdx;
    const groupe = state.config.groupes[groupeIdx];
    if (!groupe) { window.relaisKioskGoTo('select-groupe'); return; }

    const membres = groupe.membres;
    const paires = getPairesGroupe(membres);

    const mesuresArray = Object.values(state.mesures);
    const mesuresGroupe = mesuresArray.filter(m => String(m.groupeIdx) === String(groupeIdx));
    const scoreGroupe = calculerScoreEquipe(mesuresGroupe);

    let html = `
        ${getBannerHtml()}
        <div class="space-y-4">
            <div class="flex justify-between items-center">
                <div>
                    <h2 class="text-xl font-black text-white">Groupe ${groupe.numero}</h2>
                    <p class="text-xs text-slate-400">${scoreGroupe.toFixed(1)} pts cumulés</p>
                </div>
                <button onclick="window.relaisKioskGoTo('select-groupe')" class="bg-slate-700 px-3 py-1.5 rounded-xl font-black text-xs text-white active:scale-95">← Retour</button>
            </div>
            <p class="text-slate-400 text-sm">Quel binôme va courir ?</p>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
    `;

    paires.forEach((p, i) => {
        const codeRelaye = `${groupeIdx}_${p.relaye.lettre}`;
        const codeRelayeur = `${groupeIdx}_${p.relayeur.lettre}`;
        const vRelaye = state.vitesses[codeRelaye] || {};
        const vRelayeur = state.vitesses[codeRelayeur] || {};
        const pret = vRelaye.arret && vRelayeur.lance;

        const essaisPaire = mesuresGroupe.filter(m => m.pairId === p.pairId);
        const meilleur = essaisPaire.length > 0 ? Math.max(...essaisPaire.map(m => m.score)) : null;

        html += `
            <button onclick="window.relaisKioskSelectPaire(${i})"
                    class="bg-slate-800 hover:bg-slate-700 border-2 ${pret ? 'border-slate-700 hover:border-blue-500' : 'border-red-800'} p-4 rounded-2xl active:scale-95 transition-all text-left">
                <div class="text-3xl font-black text-white mb-1">${p.relaye.lettre} → ${p.relayeur.lettre}</div>
                ${meilleur !== null ? `<div class="mt-1 text-xs text-yellow-400 font-bold">🏆 Meilleur : ${meilleur.toFixed(1)} pts</div>` : ''}
                ${!pret ? `<div class="mt-1 text-xs text-red-400 font-bold">⚠️ Vitesses manquantes</div>` : ''}
            </button>
        `;
    });

    html += `</div></div>`;
    container.innerHTML = html;
}

// ============================================================
// SAISIE ZONE (10s)
// ============================================================
function renderSaisieZone(container) {
    const paire = state.currentPaire;
    if (!paire) { window.relaisKioskGoTo('select-groupe'); return; }

    const nbPlots = state.config.nbPlots || 14;
    const zone = state.currentZone;

    let gridHtml = `<div class="grid grid-cols-7 gap-2">`;
    for (let z = 1; z <= nbPlots; z++) {
        const kmh = zoneToVitesse(z);
        const selected = zone === z;
        gridHtml += `
            <button onclick="window.relaisKioskSetZoneRelais(${z})"
                    class="py-5 rounded-xl font-black text-lg ${selected ? 'bg-orange-600 text-white ring-4 ring-white scale-105' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'} active:scale-95 transition-all">
                ${kmh}
            </button>
        `;
    }
    gridHtml += `</div>`;

    container.innerHTML = `
        ${getBannerHtml()}
        <div class="space-y-4">
            <div class="flex justify-between items-center">
                <h2 class="text-2xl font-black text-white">${paire.label}</h2>
                <button onclick="window.relaisKioskGoTo('select-paire')" class="bg-slate-700 px-3 py-1.5 rounded-xl font-black text-xs text-white active:scale-95">← Retour</button>
            </div>

            <div class="bg-slate-800 p-3 rounded-2xl border border-slate-700 text-center text-sm">
                <p class="text-slate-400">Au 2ᵉ bip (10s), où se trouvait le témoin ?</p>
                <p class="text-xs text-slate-500 mt-1">Clique sur le plot atteint (km/h affichée)</p>
            </div>

            ${gridHtml}

            <div class="text-center text-3xl font-black ${zone > 0 ? 'text-emerald-400' : 'text-slate-500'} py-2">
                ${zone > 0 ? `${zoneToVitesse(zone)} km/h` : 'Aucune zone sélectionnée'}
            </div>

            <button onclick="window.relaisKioskValiderZone()"
                    class="w-full py-5 rounded-2xl font-black text-xl uppercase ${zone > 0 ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}"
                    ${zone > 0 ? '' : 'disabled'}>
                ✅ Valider cet essai
            </button>
        </div>
    `;
}

// ============================================================
// CHRONO 2 ZONES
// ============================================================
function renderChrono2Zones(container) {
    const paire = state.currentPaire;
    if (!paire) { window.relaisKioskGoTo('select-groupe'); return; }

    const d = state.config.distances2zones || { z1: 20, trans: 10, z2: 20 };
    const c = state.chrono;

    const grilleHtml = PALIERS_TRANSMISSION.map(p => `
        <div class="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg">
            <span class="font-black text-[10px]" style="color:${p.couleur}">${p.min}%+</span>
            <span class="text-[10px] text-slate-400">→</span>
            <span class="font-black text-xs" style="color:${p.couleur}">${p.points}</span>
        </div>
    `).join('');

    const chronoDisplay = formatChrono2Z(c.elapsedTime);

    container.innerHTML = `
        ${getBannerHtml()}
        <div class="space-y-4">
            <div class="flex justify-between items-center">
                <div>
                    <h2 class="text-2xl font-black text-white">${paire.label}</h2>
                    <p class="text-xs text-slate-400">Groupe ${state.config.groupes[state.currentGroupeIdx].numero}</p>
                </div>
                <button onclick="window.relaisKioskGoTo('select-paire')" class="bg-slate-700 px-3 py-1.5 rounded-xl font-black text-xs text-white active:scale-95">← Retour</button>
            </div>

            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 text-center">
                <div id="relais2z-chrono" class="text-6xl font-mono font-black text-yellow-400 mb-2 tabular-nums">${chronoDisplay}</div>
                <p class="text-xs text-slate-500 mb-3">secondes</p>

                <button id="relais2z-btn" onclick="window.relaisKiosk2ZonesClick()"
                        class="w-full bg-emerald-600 hover:bg-emerald-500 py-6 rounded-3xl font-black text-2xl text-white active:scale-95 transition-all shadow-xl">
                    ${c.clicks === 0 ? '▶ DÉMARRER' : (c.clicks === 4 ? '✅ TERMINÉ' : '⏱️ CLICKER (' + c.clicks + '/4)')}
                </button>
                <p class="text-xs text-slate-400 mt-2">
                    <strong class="text-white">4 clics :</strong> 1=Départ • 2=Fin Z1 • 3=Fin Z2 • 4=Arrivée
                </p>
            </div>

            <div class="bg-slate-800 p-3 rounded-2xl border border-slate-700">
                <div class="flex items-stretch h-20 rounded-xl overflow-hidden border-2 border-slate-600">
                    <div class="flex-[${d.z1}] bg-orange-500/80 flex flex-col items-center justify-center border-r-2 border-dashed border-white/50 relative">
                        <span class="text-[10px] font-bold text-white/70 uppercase absolute top-1">Z1 (${d.z1}m)</span>
                        <span id="relais2z-speed1" class="text-lg font-black text-white mt-3">--</span>
                        <span id="relais2z-time1" class="text-[10px] text-white/70">-- s</span>
                    </div>
                    <div class="flex-[${d.trans}] bg-blue-500/80 flex flex-col items-center justify-center border-r-2 border-dashed border-white/50 relative">
                        <span class="text-[10px] font-bold text-white/70 uppercase absolute top-1">Trans (${d.trans}m)</span>
                        <span id="relais2z-speed2" class="text-lg font-black text-white mt-3">--</span>
                        <span id="relais2z-time2" class="text-[10px] text-white/70">-- s</span>
                    </div>
                    <div class="flex-[${d.z2}] bg-green-600/80 flex flex-col items-center justify-center relative">
                        <span class="text-[10px] font-bold text-white/70 uppercase absolute top-1">Z2 (${d.z2}m)</span>
                        <span id="relais2z-speed3" class="text-lg font-black text-white mt-3">--</span>
                        <span id="relais2z-time3" class="text-[10px] text-white/70">-- s</span>
                    </div>
                </div>
            </div>

            <div class="bg-slate-800 p-3 rounded-2xl border border-slate-700">
                <p class="text-[10px] font-bold text-blue-400 uppercase mb-2">📊 Barème % transmission → points</p>
                <div class="flex flex-wrap gap-1">${grilleHtml}</div>
            </div>

            <div class="flex gap-3">
                <button onclick="window.relaisKiosk2ZonesReset()"
                        class="flex-1 bg-slate-700 hover:bg-slate-600 py-3 rounded-2xl font-black text-sm text-white active:scale-95 transition-all">
                    ↺ Réinitialiser
                </button>
            </div>
        </div>
    `;

    if (c.clicks >= 1 && c.clicks < 4) {
        startChronoLoop2Z();
    }
}

function formatChrono2Z(ms) {
    const sec = Math.floor(ms / 1000);
    const cs = Math.floor((ms % 1000) / 10);
    return `${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function startChronoLoop2Z() {
    const c = state.chrono;
    if (c.timerInterval) clearInterval(c.timerInterval);
    c.timerInterval = setInterval(() => {
        if (!c.startTime) return;
        c.elapsedTime = Date.now() - c.startTime;
        const el = document.getElementById('relais2z-chrono');
        if (el) el.textContent = formatChrono2Z(c.elapsedTime);
    }, 10);
}

window.relaisKiosk2ZonesClick = function() {
    const c = state.chrono;
    if (c.clicks >= 4) return;
    c.clicks++;

    if (c.clicks === 1) {
        c.startTime = Date.now();
        c.elapsedTime = 0;
        startChronoLoop2Z();
        const btn = document.getElementById('relais2z-btn');
        if (btn) btn.textContent = '⏱️ CLICKER (1/4)';
    } else if (c.clicks <= 4) {
        c.times.push(c.elapsedTime);
        const btn = document.getElementById('relais2z-btn');
        if (btn) btn.textContent = c.clicks === 4 ? '✅ TERMINÉ' : `⏱️ CLICKER (${c.clicks}/4)`;
    }

    if (c.clicks === 4) {
        if (c.timerInterval) clearInterval(c.timerInterval);
        finaliserChrono2Zones();
    }
};

window.relaisKiosk2ZonesReset = function() {
    const c = state.chrono;
    if (c.timerInterval) clearInterval(c.timerInterval);
    c.clicks = 0;
    c.times = [];
    c.startTime = null;
    c.elapsedTime = 0;
    c.timerInterval = null;
    render();
};

async function finaliserChrono2Zones() {
    const c = state.chrono;
    const d = state.config.distances2zones || { z1: 20, trans: 10, z2: 20 };
    const paire = state.currentPaire;
    const groupeIdx = state.currentGroupeIdx;

    const segments = [
        { t0: 0, t1: c.times[0], distance: d.z1 },
        { t0: c.times[0], t1: c.times[1], distance: d.trans },
        { t0: c.times[1], t1: c.times[2], distance: d.z2 }
    ];

    const vitesses = segments.map(s => {
        const dt = (s.t1 - s.t0) / 1000;
        return dt > 0 ? (s.distance / dt) * 3.6 : 0;
    });

    for (let i = 0; i < 3; i++) {
        const dt = (segments[i].t1 - segments[i].t0) / 1000;
        const sEl = document.getElementById(`relais2z-speed${i + 1}`);
        const tEl = document.getElementById(`relais2z-time${i + 1}`);
        if (sEl) sEl.textContent = `${vitesses[i].toFixed(1)} km/h`;
        if (tEl) tEl.textContent = `${dt.toFixed(2)} s`;
    }

    const pct = calculerPourcentageTransmission(vitesses[0], vitesses[1], vitesses[2]);
    const points = calculerPointsTransmission(pct);

    const codeRelaye = `${groupeIdx}_${paire.relaye.lettre}`;
    const codeRelayeur = `${groupeIdx}_${paire.relayeur.lettre}`;
    const vRelaye = state.vitesses[codeRelaye] || {};
    const vRelayeur = state.vitesses[codeRelayeur] || {};
    const vTheo = calculerVTheorique(vRelaye.arret, vRelayeur.lance);
    const vMoyenne3z = (vitesses[0] + vitesses[2]) / 2;

    const mesure = {
        sousActivite: 'relais2zones',
        groupeIdx,
        groupeNumero: state.config.groupes[groupeIdx].numero,
        pairId: paire.pairId,
        relayeLettre: paire.relaye.lettre,
        relayeurLettre: paire.relayeur.lettre,
        distances: { ...d },
        temps: {
            z1: Math.round(segments[0].t1 - segments[0].t0),
            trans: Math.round(segments[1].t1 - segments[1].t0),
            z2: Math.round(segments[2].t1 - segments[2].t0)
        },
        vitesses: {
            z1: Math.round(vitesses[0] * 10) / 10,
            trans: Math.round(vitesses[1] * 10) / 10,
            z2: Math.round(vitesses[2] * 10) / 10
        },
        vMoyenne3z: Math.round(vMoyenne3z * 10) / 10,
        vTheorique: vTheo ? Math.round(vTheo * 10) / 10 : null,
        pourcentageTransmission: pct,
        score: points,
        timestamp: Date.now()
    };

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const path = `etablissements/0680013V/profs/${profCode}/${state.classe}/relais/mesures-2zones`;

    try {
        await push(ref(db, path), mesure);
        state.lastFeedback = mesure;
        state.mode = 'feedback';
        state.chrono = { clicks: 0, times: [], startTime: null, elapsedTime: 0, timerInterval: null };
        render();
    } catch (err) {
        console.error(err);
        alert('❌ Erreur lors de l\'enregistrement.');
    }
}

// ============================================================
// FEEDBACK
// ============================================================
function renderFeedback(container) {
    const fb = state.lastFeedback;
    if (!fb) { state.mode = 'menu'; render(); return; }

    const is2Zones = fb.sousActivite === 'relais2zones';
    const couleur = is2Zones ? getScoreCouleurTransmission(fb.pourcentageTransmission) : getScoreCouleur(fb.score);
    const label = is2Zones ? getLabelTransmission(fb.pourcentageTransmission) : getScoreLabel(fb.score);

    let detailHtml = '';
    if (is2Zones) {
        detailHtml = `
            <div class="grid grid-cols-3 gap-2 mt-4">
                <div class="bg-slate-800 p-2 rounded-xl border border-orange-500/50">
                    <div class="text-[10px] text-slate-400">Z1</div>
                    <div class="text-base font-black text-white">${fb.vitesses.z1}</div>
                    <div class="text-[10px] text-slate-500">km/h</div>
                </div>
                <div class="bg-slate-800 p-2 rounded-xl border border-blue-500/50">
                    <div class="text-[10px] text-slate-400">Trans</div>
                    <div class="text-base font-black text-blue-400">${fb.vitesses.trans}</div>
                    <div class="text-[10px] text-slate-500">km/h</div>
                </div>
                <div class="bg-slate-800 p-2 rounded-xl border border-green-500/50">
                    <div class="text-[10px] text-slate-400">Z2</div>
                    <div class="text-base font-black text-white">${fb.vitesses.z2}</div>
                    <div class="text-[10px] text-slate-500">km/h</div>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-2 mt-3">
                <div class="bg-slate-800 p-2 rounded-xl border border-slate-700">
                    <div class="text-[10px] text-slate-400">% transmission</div>
                    <div class="text-2xl font-black" style="color:${couleur}">${fb.pourcentageTransmission}%</div>
                </div>
                <div class="bg-slate-800 p-2 rounded-xl border border-slate-700">
                    <div class="text-[10px] text-slate-400">Points</div>
                    <div class="text-2xl font-black" style="color:${couleur}">${fb.score}</div>
                </div>
            </div>
        `;
    } else {
        detailHtml = `
            <div class="grid grid-cols-2 gap-3 mt-4">
                <div class="bg-slate-800 p-3 rounded-xl border border-slate-700">
                    <div class="text-xs text-slate-400">V. théorique</div>
                    <div class="text-xl font-black text-yellow-400">${fb.vTheorique.toFixed(1)} km/h</div>
                </div>
                <div class="bg-slate-800 p-3 rounded-xl border border-slate-700">
                    <div class="text-xs text-slate-400">V. réelle</div>
                    <div class="text-xl font-black text-emerald-400">${fb.vReelle} km/h</div>
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        ${getBannerHtml()}
        <div class="space-y-4 text-center py-6">
            <div class="text-6xl mb-2">${fb.score >= 4 ? '🚀' : fb.score >= 3 ? '🌟' : fb.score >= 2 ? '👍' : '📈'}</div>
            <h2 class="text-3xl font-black text-white">${fb.pairId}</h2>
            <p class="text-slate-400 text-sm">Groupe ${fb.groupeNumero || (parseInt(fb.groupeIdx) + 1)}</p>

            <div class="bg-slate-800 p-5 rounded-3xl border-2 inline-block px-8" style="border-color: ${couleur}">
                <div class="text-sm text-slate-400 mb-1">Score</div>
                <div class="text-5xl font-black" style="color: ${couleur}">
                    ${is2Zones ? fb.score + ' pt' + (fb.score > 1 ? 's' : '') : fb.score.toFixed(1)}
                </div>
                <div class="text-lg font-bold mt-2" style="color: ${couleur}">${label}</div>
            </div>

            ${detailHtml}

            <div class="flex gap-3 mt-6">
                <button onclick="window.relaisKioskGoTo('select-paire')"
                        class="flex-1 bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-black text-white text-lg active:scale-95 transition-all">
                    🔄 Refaire
                </button>
                <button onclick="window.relaisKioskGoTo('select-groupe')"
                        class="flex-1 bg-slate-700 hover:bg-slate-600 py-4 rounded-2xl font-black text-white text-lg active:scale-95 transition-all">
                    🏁 Autre groupe
                </button>
            </div>

            <button onclick="window.relaisKioskGoTo('menu')"
                    class="w-full bg-slate-800 hover:bg-slate-700 py-3 rounded-2xl font-black text-white text-sm active:scale-95 transition-all mt-3">
                ← Menu principal
            </button>
        </div>
    `;
}

// ============================================================
// CLASSEMENT
// ============================================================
function renderClassement(container) {
    const groupes = state.config.groupes || {};
    const mesuresArray = Object.values(state.mesures);

    const equipes = Object.entries(groupes).map(([idx, groupe]) => {
        const mg = mesuresArray.filter(m => String(m.groupeIdx) === String(idx));
        return { idx, groupe, score: calculerScoreEquipe(mg), nbEssais: mg.length };
    }).sort((a, b) => b.score - a.score);

    const scoreMax = Math.max(...equipes.map(e => e.score), 1);

    let html = `
        ${getBannerHtml()}
        <div class="space-y-4">
            <div class="flex justify-between items-center">
                <h2 class="text-2xl font-black text-white">🏆 Classement</h2>
                <button onclick="window.relaisKioskGoTo('menu')" class="bg-slate-700 px-3 py-1.5 rounded-xl font-black text-xs text-white active:scale-95">← Retour</button>
            </div>
    `;

    if (equipes.length === 0) {
        html += `<p class="text-slate-500 text-center py-10">Aucun groupe.</p>`;
    } else {
        html += `<div class="space-y-3">`;
        equipes.forEach((eq, i) => {
            const pct = (eq.score / scoreMax) * 100;
            const medaille = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : `${i + 1}.`));
            const couleur = i === 0 ? 'from-yellow-500 to-yellow-700' : (i === 1 ? 'from-slate-400 to-slate-600' : (i === 2 ? 'from-amber-600 to-amber-800' : 'from-blue-600 to-blue-800'));

            html += `
                <div class="bg-slate-800 p-3 rounded-2xl border border-slate-700">
                    <div class="flex items-center gap-3 mb-2">
                        <span class="text-3xl min-w-[44px]">${medaille}</span>
                        <div class="flex-1">
                            <div class="font-black text-white text-lg">Groupe ${eq.groupe.numero}</div>
                            <div class="text-xs text-slate-400">${eq.nbEssais} essai${eq.nbEssais > 1 ? 's' : ''} · ${eq.groupe.membres.map(m => m.lettre).join(', ')}</div>
                        </div>
                        <div class="text-2xl font-black text-yellow-400">${eq.score.toFixed(1)}</div>
                    </div>
                    <div class="w-full h-3 bg-slate-900 rounded-full overflow-hidden">
                        <div class="h-full bg-gradient-to-r ${couleur} transition-all" style="width: ${pct}%"></div>
                    </div>
                </div>
            `;
        });
        html += `</div>`;
    }

    html += `</div>`;
    container.innerHTML = html;
}

// ============================================================
// ACTIONS
// ============================================================
window.relaisKioskGoTo = function(mode) {
    if (mode === 'menu' || mode === 'select-eleve' || mode === 'select-groupe') {
        state.currentCode = null;
        state.currentGroupeIdx = null;
        state.currentPaire = null;
        state.currentVitesses = { arret: null, lance: null };
        state.currentZone = 0;
        state.chrono = { clicks: 0, times: [], startTime: null, elapsedTime: 0, timerInterval: null };
    }
    state.mode = mode;
    render();
};

window.relaisKioskSelectCode = function(code) {
    state.currentCode = code;
    state.currentVitesses = { arret: null, lance: null };
    state.mode = 'saisie-vitesses';
    render();
};

window.relaisKioskSetZone = function(type, zone) {
    state.currentVitesses[type] = zoneToVitesse(zone);
    render();
};

window.relaisKioskValiderVitesses = async function() {
    const code = state.currentCode;
    const v = state.currentVitesses;
    if (!code || !v.arret || !v.lance) return;

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const path = `etablissements/0680013V/profs/${profCode}/${state.classe}/relais/vitesses/${code}`;

    try {
        await set(ref(db, path), { arret: v.arret, lance: v.lance, timestamp: Date.now() });
        alert(`✅ Vitesses enregistrées !\nArrêté : ${v.arret} km/h\nLancé : ${v.lance} km/h`);
        state.currentCode = null;
        state.currentVitesses = { arret: null, lance: null };
        state.mode = 'select-eleve';
        render();
    } catch (err) {
        console.error(err);
        alert('❌ Erreur.');
    }
};

window.relaisKioskSelectGroupe = function(groupeIdx) {
    state.currentGroupeIdx = parseInt(groupeIdx);
    state.mode = 'select-paire';
    render();
};

window.relaisKioskSelectPaire = function(paireIdx) {
    const groupe = state.config.groupes[state.currentGroupeIdx];
    if (!groupe) return;
    const paires = getPairesGroupe(groupe.membres);
    const paire = paires[paireIdx];
    if (!paire) return;

    const codeRelaye = `${state.currentGroupeIdx}_${paire.relaye.lettre}`;
    const codeRelayeur = `${state.currentGroupeIdx}_${paire.relayeur.lettre}`;
    const vRelaye = state.vitesses[codeRelaye] || {};
    const vRelayeur = state.vitesses[codeRelayeur] || {};

    if (!vRelaye.arret || !vRelayeur.lance) {
        alert(`⚠️ Vitesses manquantes :\n- ${paire.relaye.lettre.toUpperCase()} (arrêté)\n- ${paire.relayeur.lettre.toUpperCase()} (lancé)`);
        return;
    }

    state.currentPaire = paire;
    state.currentZone = 0;
    state.chrono = { clicks: 0, times: [], startTime: null, elapsedTime: 0, timerInterval: null };

    if (getSousActivite() === 'relais2zones') {
        state.mode = 'chrono-2zones';
    } else {
        state.mode = 'saisie-zone';
    }
    render();
};

window.relaisKioskSetZoneRelais = function(zone) {
    state.currentZone = zone;
    render();
};

window.relaisKioskValiderZone = async function() {
    const paire = state.currentPaire;
    const groupeIdx = state.currentGroupeIdx;
    const zone = state.currentZone;
    if (!paire || !zone) return;

    const codeRelaye = `${groupeIdx}_${paire.relaye.lettre}`;
    const codeRelayeur = `${groupeIdx}_${paire.relayeur.lettre}`;
    const vRelaye = state.vitesses[codeRelaye] || {};
    const vRelayeur = state.vitesses[codeRelayeur] || {};

    const vTheo = calculerVTheorique(vRelaye.arret, vRelayeur.lance);
    const vReelle = zoneToVitesse(zone);
    const score = calculerScore(vReelle, vTheo);
    const ecart = vReelle - vTheo;

    const mesure = {
        sousActivite: 'relais10s',
        groupeIdx,
        groupeNumero: state.config.groupes[groupeIdx].numero,
        pairId: paire.pairId,
        relayeLettre: paire.relaye.lettre,
        relayeurLettre: paire.relayeur.lettre,
        zoneAtteinte: zone,
        vReelle,
        vTheorique: Math.round(vTheo * 10) / 10,
        score: Math.round(score * 10) / 10,
        ecart: Math.round(ecart * 10) / 10,
        timestamp: Date.now()
    };

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const path = `etablissements/0680013V/profs/${profCode}/${state.classe}/relais/mesures-10s`;

    try {
        await push(ref(db, path), mesure);
        state.lastFeedback = mesure;
        state.mode = 'feedback';
        render();
    } catch (err) {
        console.error(err);
        alert('❌ Erreur.');
    }
};

// ============================================================
// NETTOYAGE
// ============================================================
window.retourMenuRelais = function() {
    if (configListener) { configListener(); configListener = null; }
    if (vitessesListener) { vitessesListener(); vitessesListener = null; }
    if (mesuresListener) { mesuresListener(); mesuresListener = null; }
    const container = document.getElementById('relais-module');
    if (container) {
        container.innerHTML = '';
        container.classList.add('hidden');
    }
    if (typeof window.resetToLogin === 'function') window.resetToLogin();
};

export function cleanupRelaisKiosk() {
    if (configListener) { configListener(); configListener = null; }
    if (vitessesListener) { vitessesListener(); vitessesListener = null; }
    if (mesuresListener) { mesuresListener(); mesuresListener = null; }
}