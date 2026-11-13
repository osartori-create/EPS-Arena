// src/js/modules/natation/natation-longue-kiosk.js
// Kiosk élève du mode « Longue distance » (épreuve de nage 6-9 min)
// Grille de numéros : +50 m (configurable) par clic, anti-double-clic,
// saisie du partiel en mètres en fin de vague.

import { db, ref, onValue, set } from '../../core/firebase-service.js';
import { COULEURS_GROUPES, getCouleurGroupe, getBasePath, getSessionActivePath, getSessionObsPath, formatDuree } from './natation-longue-common.js';

// ============================================================
// ÉTAT GLOBAL
// ============================================================
let state = {
    classe: '',
    couleur: null,
    config: null,
    sequence: null,
    sessionId: null,
    codes: [],
    timestampsParEleve: {},
    partielsParEleve: {},
    abandonsParEleve: {},
    lastClickAt: {},
    phase: 'choix',          // choix | attente | course | saisie_finale | bilan
    timestampDebut: null,
    audioCtx: null,
    tickInterval: null
};

let configListener = null;
let sequenceListener = null;
let sessionListener = null;
let historiqueClics = [];

// Styles injectés une fois : évite le zoom involontaire (double-tap, éclaboussures)
// et la sélection de texte sur les boutons du kiosk.
function injecterStyles() {
    if (document.getElementById('nl-kiosk-styles')) return;
    const style = document.createElement('style');
    style.id = 'nl-kiosk-styles';
    style.textContent = '#natation-module button{ touch-action:manipulation; -webkit-user-select:none; user-select:none; -webkit-tap-highlight-color:transparent; }@keyframes nl-blink{0%,49%{opacity:1}50%,100%{opacity:0.25}}.nl-chrono-alerte{animation:nl-blink 1s step-start infinite;}';
    document.head.appendChild(style);
}

// ============================================================
// INITIALISATION
// ============================================================
export function initNatationLongueKiosk(classe) {
    state.classe = classe;
    state.couleur = null;
    state.phase = 'choix';
    state.timestampsParEleve = {};
    state.partielsParEleve = {};
    state.abandonsParEleve = {};
    state.lastClickAt = {};
    historiqueClics = [];
    state.timestampDebut = null;

    const container = document.getElementById('natation-module');
    if (!container) return;

    injecterStyles();

    const basePath = getBasePath(classe);

    if (configListener) configListener();
    configListener = onValue(ref(db, `${basePath}/config`), (snap) => {
        state.config = snap.val() || null;
        render();
    });

    if (sessionListener) sessionListener();
    sessionListener = onValue(ref(db, getSessionActivePath(classe)), (snap) => {
        state.sessionId = snap.val() || null;
    });

    if (sequenceListener) sequenceListener();
    sequenceListener = onValue(ref(db, `${basePath}/commandes/sequence`), (snap) => {
        const seq = snap.val();
        if (!seq) return;
        const ancienneAction = state.sequence?.actionTimestamp;
        state.sequence = seq;
        if (!seq.actionTimestamp || seq.actionTimestamp === ancienneAction) return;

        if (seq.etat === 'course' && seq.vague === state.couleur) {
            state.phase = 'course';
            state.timestampDebut = seq.timestampDebut;
            state.timestampsParEleve = {};
            state.partielsParEleve = {};
            state.abandonsParEleve = {};
            state.lastClickAt = {};
            historiqueClics = [];
            render();
        } else if (seq.etat === 'termine' && seq.vague === state.couleur && state.phase === 'course') {
            state.phase = 'saisie_finale';
            render();
        }
    });

    demarrerTicks();
    return cleanupNatationLongueKiosk;
}

// ============================================================
// RENDU PRINCIPAL
// ============================================================
function render() {
    const container = document.getElementById('natation-module');
    if (!container) return;

    if (!state.config) {
        container.innerHTML = `<div class="text-center py-10 text-slate-400">
            <p class="text-xl">⏳ En attente de la configuration du professeur...</p>
        </div>`;
        return;
    }

    switch (state.phase) {
        case 'choix':         renderChoixCouleur(container); break;
        case 'attente':       renderAttente(container); break;
        case 'course':        renderCourse(container); break;
        case 'saisie_finale': renderSaisieFinale(container); break;
        case 'bilan':         renderBilan(container); break;
        default:              renderChoixCouleur(container);
    }
}

// ============================================================
// ÉCRAN 1 : CHOIX DE LA VAGUE (couleur)
// ============================================================
function renderChoixCouleur(container) {
    const couleursDispo = COULEURS_GROUPES.filter(c => (state.config?.groupes?.[c.id] || []).length > 0);

    let html = `
        <div class="max-w-2xl mx-auto text-center">
            <div class="py-6">
                <h1 class="text-3xl font-black text-white mb-2">🏊 Natation — Longue distance</h1>
                <p class="text-slate-400">Choisis la vague (couleur) à observer</p>
            </div>
            <div class="grid grid-cols-2 gap-4">
    `;
    couleursDispo.forEach(c => {
        const nb = (state.config.groupes[c.id] || []).length;
        html += `
            <button onclick="window.nlKioskChoixCouleur('${c.id}')"
                    class="p-10 rounded-3xl font-black text-2xl active:scale-95 transition-all shadow-2xl"
                    style="background:${c.bg}; color:${c.text}; border:4px solid ${c.border};">
                ${c.label}
                <div class="text-sm font-normal opacity-80 mt-2">${nb} élève(s)</div>
            </button>
        `;
    });
    html += `</div>
        <button onclick="window.nlKioskRetour()"
                class="w-full mt-6 bg-slate-700 hover:bg-slate-600 py-3 rounded-2xl font-black text-sm text-white active:scale-95">← Retour au menu général</button>
    </div>`;
    container.innerHTML = html;
}

window.nlKioskChoixCouleur = function(couleurId) {
    state.couleur = couleurId;
    state.codes = (state.config?.groupes?.[couleurId] || []).map(String);
    state.timestampsParEleve = {};
    state.partielsParEleve = {};
    state.abandonsParEleve = {};
    state.lastClickAt = {};
    historiqueClics = [];
    initAudioContext();
    if (state.sequence && state.sequence.etat === 'course' && state.sequence.vague === couleurId) {
        state.phase = 'course';
        state.timestampDebut = state.sequence.timestampDebut;
    } else {
        state.phase = 'attente';
    }
    render();
};

// ============================================================
// ÉCRAN 2 : ATTENTE
// ============================================================
function renderAttente(container) {
    const couleur = getCouleurGroupe(state.couleur);
    container.innerHTML = `
        <div class="min-h-[70vh] flex flex-col items-center justify-center p-8" style="background:${couleur.bg}15;">
            <div class="text-8xl mb-6 animate-pulse">⏳</div>
            <h2 class="text-3xl font-black text-white mb-3">En attente du signal</h2>
            <p class="text-slate-300 mb-8">Vague <span style="color:${couleur.bg}" class="font-black">${couleur.label}</span></p>
            <button onclick="window.nlKioskRetour()" class="bg-slate-700 hover:bg-slate-600 px-6 py-3 rounded-2xl font-black text-sm text-white active:scale-95">← Retour</button>
        </div>
    `;
}

// ============================================================
// ÉCRAN 3 : COURSE (grille de numéros)
// ============================================================
function renderCourse(container) {
    const couleur = getCouleurGroupe(state.couleur);
    const distanceParClic = state.config?.distanceParClic || 50;

    let btns = '';
    state.codes.forEach(num => {
        const nb = (state.timestampsParEleve[num] || []).length;
        btns += `
            <button id="nl-btn-${num}" onclick="window.nlKioskClickNumero('${num}')"
                    class="rounded-2xl font-black border-4 active:scale-95 transition-all flex flex-col items-center justify-center relative"
                    style="background:${couleur.bg}; color:${couleur.text}; border-color:${couleur.border}; min-height:110px;">
                <span class="text-4xl">${num}</span>
                <span class="text-sm font-bold opacity-90">${nb} passage${nb > 1 ? 's' : ''} · ${nb * distanceParClic} m</span>
            </button>
        `;
    });

    container.innerHTML = `
        <div class="p-4" style="background:${couleur.bg}10; min-height:100vh; display:flex; flex-direction:column;">
            <div class="text-center mb-4 rounded-2xl py-3 sticky top-0 z-10" style="background:#ffffff; border:3px solid ${couleur.border};">
                <div style="color:#64748b; font-size:0.7rem; font-weight:800; text-transform:uppercase;">Temps restant</div>
                <div id="nl-chrono-restant" style="font-size:4rem; font-weight:900; color:#0f172a; line-height:1; font-family:ui-monospace, SFMono-Regular, Menlo, monospace;">${formatDuree(state.config?.duree || 420)}</div>
            </div>
            <div class="text-center font-black mb-3" style="color:${couleur.bg}; font-size:1rem;">Vague ${couleur.label} · +${distanceParClic} m / passage</div>
            <div class="grid grid-cols-3 md:grid-cols-4 gap-3">${btns}</div>
            <button onclick="window.nlKioskAnnulerDernier()" class="w-full mt-3 py-3 rounded-xl font-black text-sm border-2 active:scale-95" style="background:#fef3c7; color:#92400e; border-color:#f59e0b;">↩️ Annuler le dernier clic</button>
            <p class="text-slate-400 text-xs mt-4 text-center">Clique sur le numéro de l'élève à chaque retour au mur (aller-retour = ${distanceParClic} m).</p>
        </div>
    `;
    refreshButtons();
}

// ============================================================
// CLIC + ANTI-DOUBLE-CLIC + CHRONO
// ============================================================
window.nlKioskClickNumero = function(num) {
    if (state.phase !== 'course') return;
    if (state.abandonsParEleve[num]) return;
    const antiClic = (state.config?.antiDoubleClic || 10) * 1000;
    const last = state.lastClickAt[num] || 0;
    if (Date.now() - last < antiClic) return;

    state.lastClickAt[num] = Date.now();
    if (!state.timestampsParEleve[num]) state.timestampsParEleve[num] = [];
    state.timestampsParEleve[num].push(Date.now());
    historiqueClics.push(num);
    playBeep();
    pousserObservation(num);
    refreshButtons();
};

window.nlKioskAnnulerDernier = function() {
    if (state.phase !== 'course') return;
    const num = historiqueClics.pop();
    if (num === undefined || num === null) return;
    const arr = state.timestampsParEleve[num] || [];
    if (arr.length > 0) arr.pop();
    state.lastClickAt[num] = 0;
    pousserObservation(num);
    playBeep();
    refreshButtons();
};

function pousserObservation(num) {
    if (!state.sessionId || !state.couleur) return;
    const obsPath = `${getSessionObsPath(state.classe, state.sessionId)}/${state.couleur}/${num}`;
    set(ref(db, obsPath), {
        timestamps: state.timestampsParEleve[num] || [],
        partiel: state.partielsParEleve[num] || 0,
        abandon: state.abandonsParEleve[num] || null
    }).catch(err => console.error('[Natation Longue] Erreur push observation :', err));
}

function refreshButtons() {
    if (state.phase !== 'course' || !state.config) return;
    const antiClic = (state.config.antiDoubleClic || 10) * 1000;
    const distanceParClic = state.config.distanceParClic || 50;
    const couleur = getCouleurGroupe(state.couleur);

    state.codes.forEach(num => {
        const btn = document.getElementById(`nl-btn-${num}`);
        if (!btn) return;
        if (state.abandonsParEleve[num]) return;

        const last = state.lastClickAt[num] || 0;
        const ecoule = Date.now() - last;
        const bloque = ecoule < antiClic;
        const spans = btn.querySelectorAll('span');
        const dernier = spans[spans.length - 1];
        if (!dernier) return;

        if (bloque) {
            btn.disabled = true;
            btn.style.background = '#15803d';
            btn.style.borderColor = '#22c55e';
            btn.style.color = '#ffffff';
            const restant = Math.ceil((antiClic - ecoule) / 1000);
            dernier.textContent = `✓ ${restant}s`;
        } else {
            btn.disabled = false;
            btn.style.background = couleur.bg;
            btn.style.borderColor = couleur.border;
            btn.style.color = couleur.text;
            const nb = (state.timestampsParEleve[num] || []).length;
            dernier.textContent = `${nb} passage${nb > 1 ? 's' : ''} · ${nb * distanceParClic} m`;
        }
    });

    const chronoEl = document.getElementById('nl-chrono-restant');
    if (chronoEl && state.timestampDebut) {
        const restant = Math.max(0, state.config.duree - (Date.now() - state.timestampDebut) / 1000);
        chronoEl.textContent = formatDuree(restant);
        if (restant > 0 && restant <= 30) {
            chronoEl.style.color = '#dc2626';
            chronoEl.classList.add('nl-chrono-alerte');
        } else {
            chronoEl.style.color = '#0f172a';
            chronoEl.classList.remove('nl-chrono-alerte');
        }
    }
}

function demarrerTicks() {
    if (state.tickInterval) clearInterval(state.tickInterval);
    state.tickInterval = setInterval(() => {
        if (state.phase === 'course' && state.timestampDebut && state.config) {
            const elapsed = (Date.now() - state.timestampDebut) / 1000;
            if (elapsed >= state.config.duree) {
                state.phase = 'saisie_finale';
                render();
            } else {
                refreshButtons();
            }
        }
    }, 500);
}

// ============================================================
// ÉCRAN 4 : SAISIE DU PARTIEL (mètres supplémentaires)
// ============================================================
function renderSaisieFinale(container) {
    const couleur = getCouleurGroupe(state.couleur);
    const distanceParClic = state.config?.distanceParClic || 50;
    const elevesActifs = state.codes;

    let html = `
        <div class="p-4" style="background:${couleur.bg}10; min-height:100vh;">
            <div class="bg-slate-900/90 p-4 rounded-2xl mb-4 border-2" style="border-color:${couleur.border};">
                <div class="text-[10px] font-bold uppercase text-slate-400">Fin de la vague</div>
                <div class="text-xl font-black text-white">${couleur.label} — Vague terminée</div>
            </div>
            <div class="bg-slate-800 p-4 rounded-2xl border-2 border-slate-700 mb-4">
                <h3 class="font-black text-white text-lg mb-1">📝 Mètres supplémentaires (partiel)</h3>
                <p class="text-slate-400 text-sm mb-2">Mètres parcourus <strong class="text-white">après</strong> le dernier clic (0 à ${distanceParClic - 1} m). Si l'élève venait de toucher le mur au clic, c'est <strong class="text-amber-300">0</strong>.</p>
                <div class="space-y-2">
    `;

    elevesActifs.forEach(num => {
        const nb = (state.timestampsParEleve[num] || []).length;
        const partiel = state.partielsParEleve[num] || 0;
        html += `
            <div class="bg-slate-900 p-3 rounded-xl border border-slate-700 flex items-center gap-3">
                <div class="text-2xl font-black w-12 text-center" style="color:${couleur.bg};">#${num}</div>
                <div class="flex-1 text-sm text-slate-400">${nb} passage${nb > 1 ? 's' : ''} = ${nb * distanceParClic} m</div>
                <input type="number" id="nl-partiel-${num}" value="${partiel}" min="0" max="${distanceParClic - 1}" step="5"
                       class="w-20 bg-slate-900 border border-slate-600 rounded p-2 text-white text-center font-black">
                <span class="text-slate-400 text-sm">m</span>
            </div>
        `;
    });

    html += `
                </div>
                <button onclick="window.nlKioskValiderPartiels()"
                        class="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 py-3 rounded-xl font-black text-white text-sm active:scale-95">✅ Valider la vague</button>
            </div>
        </div>
    `;
    container.innerHTML = html;
}


window.nlKioskValiderPartiels = function() {
    const distanceParClic = state.config?.distanceParClic || 50;
    state.codes.forEach(num => {
        if (state.abandonsParEleve[num]) return;
        const input = document.getElementById(`nl-partiel-${num}`);
        let val = parseInt(input?.value) || 0;
        val = Math.max(0, Math.min(distanceParClic - 1, val));
        state.partielsParEleve[num] = val;
        pousserObservation(num);
    });
    state.phase = 'bilan';
    render();
};

// ============================================================
// ÉCRAN 5 : BILAN DE LA VAGUE
// ============================================================
function renderBilan(container) {
    const couleur = getCouleurGroupe(state.couleur);
    const distanceParClic = state.config?.distanceParClic || 50;

    const rows = state.codes.map(num => {
        const nb = (state.timestampsParEleve[num] || []).length;
        const partiel = state.partielsParEleve[num] || 0;
        return { num, nb, partiel, distance: nb * distanceParClic + partiel };
    }).sort((a, b) => b.distance - a.distance);

    let html = `
        <div class="p-4" style="background:${couleur.bg}10; min-height:100vh;">
            <div class="bg-slate-900/90 p-4 rounded-2xl mb-4 border-2" style="border-color:${couleur.border};">
                <div class="text-[10px] font-bold uppercase text-slate-400">Résultats de la vague</div>
                <div class="text-xl font-black text-white">${couleur.label}</div>
            </div>
            <div class="space-y-2">
    `;
    rows.forEach(r => {
        html += `
            <div class="bg-slate-800 p-3 rounded-xl border-2 flex items-center gap-3" style="border-color:${couleur.border};">
                <div class="text-2xl font-black w-12 text-center" style="color:${couleur.bg};">#${r.num}</div>
                <div class="flex-1 text-sm text-slate-300">${r.nb} passage${r.nb > 1 ? 's' : ''} + ${r.partiel} m</div>
                <div class="text-xl font-black text-yellow-400">${r.distance} m</div>
            </div>
        `;
    });
    html += `
            </div>
            <button onclick="window.nlKioskAutreVague()"
                    class="w-full mt-4 bg-blue-600 hover:bg-blue-500 py-3 rounded-2xl font-black text-sm text-white active:scale-95">🔄 Autre vague</button>
            <button onclick="window.nlKioskRetour()"
                    class="w-full mt-3 bg-slate-700 hover:bg-slate-600 py-3 rounded-2xl font-black text-sm text-white active:scale-95">← Retour au menu général</button>
        </div>
    `;
    container.innerHTML = html;
}

// ============================================================
// AUDIO
// ============================================================
function initAudioContext() {
    if (!state.audioCtx) {
        try { state.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
}

function playBeep() {
    if (!state.audioCtx) return;
    try {
        if (state.audioCtx.state === 'suspended') state.audioCtx.resume();
        const osc = state.audioCtx.createOscillator();
        const gain = state.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 1400;
        gain.gain.setValueAtTime(0.2, state.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, state.audioCtx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(state.audioCtx.destination);
        osc.start();
        osc.stop(state.audioCtx.currentTime + 0.12);
    } catch (e) {}
}

// ============================================================
// NAVIGATION + NETTOYAGE
// ============================================================
window.nlKioskAutreVague = function() {
    state.phase = 'choix';
    state.couleur = null;
    render();
};

window.nlKioskRetour = function() {
    cleanupNatationLongueKiosk();
    const container = document.getElementById('natation-module');
    if (container) {
        container.innerHTML = '';
        container.classList.add('hidden');
    }
    if (typeof window.resetToLogin === 'function') window.resetToLogin();
};

export function cleanupNatationLongueKiosk() {
    if (configListener) { configListener(); configListener = null; }
    if (sequenceListener) { sequenceListener(); sequenceListener = null; }
    if (sessionListener) { sessionListener(); sessionListener = null; }
    if (state.tickInterval) { clearInterval(state.tickInterval); state.tickInterval = null; }
    if (state.audioCtx) { try { state.audioCtx.close(); } catch (e) {} state.audioCtx = null; }
}







