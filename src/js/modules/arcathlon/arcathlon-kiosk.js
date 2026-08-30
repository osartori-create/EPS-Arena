// src/js/modules/arcathlon/arcathlon-kiosk.js
// Flux validé avec logs pour déboguer le bouton "Fin de tir"

import { db, ref, onValue, push } from '../../core/firebase-service.js';

// --------------------------------------------------------------
// ÉTAT
// --------------------------------------------------------------
const state = {
    classe: '',
    code: '',
    equipeId: '',
    maillot: '',
    config: null,
    nbSeries: 3,
    serieActuelle: 1,
    phase: 'course',          // 'course' | 'tir' | 'penalite' | 'finale' | 'termine'
    running: false,
    phaseStart: null,
    phaseAccum: 0,
    tempsPhase: 0,
    tempsTotalGlobal: 0,
    nbFleches: 2,
    shots: [],
    penReq: 0,
    penDone: 0,
    tempsPenalites: [],
    handicapMs: 0,
    vmaRef: 0,
    distanceCourse: 0,
    longueurPenalite: 30,
    mode: 'sprint',
    alerteTriche: false,
    reussitesTir: 0,
    cumulDistance: 0,
    cumulPointsVMA: 0,
    cumulPointsTir: 0,
    cumulTemps: 0,
    seriesTerminees: 0,
    tempsCourse: 0,
    tempsTir: 0,
    tempsTotalSerie: 0
};

let configListener = null;
let departListener = null;
let clockInterval = null;
let transitionTimer = null;

// --------------------------------------------------------------
// INIT
// --------------------------------------------------------------
export function initArcathlonKiosk(classe, code) {
    state.classe = classe;
    state.code = code;
    state.serieActuelle = 1;
    state.phase = 'course';
    state.running = false;
    state.phaseAccum = 0;
    state.tempsPhase = 0;
    state.tempsTotalGlobal = 0;
    state.tempsCourse = 0;
    state.tempsTir = 0;
    state.tempsTotalSerie = 0;
    state.shots = [];
    state.penReq = 0;
    state.penDone = 0;
    state.tempsPenalites = [];
    state.alerteTriche = false;
    state.reussitesTir = 0;
    state.cumulDistance = 0;
    state.cumulPointsVMA = 0;
    state.cumulPointsTir = 0;
    state.cumulTemps = 0;
    state.seriesTerminees = 0;

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const configRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/arcathlon/config`);

    if (configListener) configListener();
    configListener = onValue(configRef, (snap) => {
        const config = snap.val();
        if (config) {
            state.config = config;
            state.mode = config.mode || 'sprint';
            state.nbSeries = config.nbSeries || 3;
            state.nbFleches = config.nbFleches || 2;
            state.distanceCourse = config.distanceTotale || 100;
            state.longueurPenalite = config.longueurPenalite || 30;
            state.equipes = config.equipes || {};
            state.handicapMs = (config.handicaps && config.handicaps[code]) || 0;
            state.vmaRef = (config.vmaReference && config.vmaReference[code]) || 12;

            for (const [eqId, eqData] of Object.entries(state.equipes)) {
                const membre = eqData.membres.find(m => m.code === code);
                if (membre) {
                    state.equipeId = eqId;
                    state.maillot = membre.maillot;
                    break;
                }
            }
            renderPhase();
        } else {
            const container = document.getElementById('arcathlon-module');
            if (container) container.innerHTML = `<div class="text-center py-10 text-slate-400"><p class="text-2xl">⏳ En attente de la configuration...</p></div>`;
        }
    });

    if (state.mode === 'poursuite') {
        const departRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/arcathlon/commandes/depart`);
        if (departListener) departListener();
        departListener = onValue(departRef, (snap) => {
            const data = snap.val();
            if (data && data.timestamp) {
                state.departSignal = true;
                const delai = data.delai || 0;
                const now = Date.now();
                const departTime = data.timestamp + (delai * 1000);
                const remaining = Math.max(0, Math.round((departTime - now) / 1000));
                if (remaining > 0) showDepartCountdown(remaining);
                else startCourse();
            }
        });
    }

    document.querySelectorAll('#activity-screen .module').forEach(el => el.classList.add('hidden'));
    const module = document.getElementById('arcathlon-module');
    if (module) module.classList.remove('hidden');
}

// --------------------------------------------------------------
// AFFICHAGE
// --------------------------------------------------------------
function renderPhase() {
    const container = document.getElementById('arcathlon-module');
    if (!container) return;

    const colorMap = {
        'Rouge': 'text-red-400 border-red-600',
        'Jaune': 'text-yellow-400 border-yellow-600',
        'Bleu': 'text-blue-400 border-blue-600',
        'Vert': 'text-green-400 border-green-600',
        'Orange': 'text-orange-400 border-orange-600',
        'Violet': 'text-purple-400 border-purple-600',
        'Rose': 'text-pink-400 border-pink-600',
        'Cyan': 'text-cyan-400 border-cyan-600'
    };
    const colorClass = colorMap[state.maillot] || 'text-slate-400 border-slate-600';

    let phaseLabel = '', panelClass = '', btnClass = '', btnText = '';
    let showBtn = true;
    let btnDisabled = false;

    if (state.phase === 'course') {
        phaseLabel = state.serieActuelle === 1 ? 'DÉPART DE LA COURSE' : `COURSE SÉRIE ${state.serieActuelle}`;
        panelClass = 'panel-course';
        btnClass = 'btn-course';
        if (state.serieActuelle === 1 && !state.running) {
            btnText = 'Démarrer la course';
        } else if (state.running) {
            btnText = '🏁 Arrivée';
        } else {
            btnText = 'Démarrer la course';
        }
        showBtn = true;
    } else if (state.phase === 'tir') {
        phaseLabel = `TIR SÉRIE ${state.serieActuelle}`;
        panelClass = 'panel-tir';
        btnClass = 'btn-tir';
        const allShotsDone = state.shots.every(s => s !== 0);
        if (!allShotsDone) {
            btnText = 'Indiquez toutes les flèches';
            btnDisabled = true;
        } else {
            btnText = 'Fin de tir';
            btnDisabled = false;
        }
    } else if (state.phase === 'penalite') {
        phaseLabel = `PÉNALITÉ SÉRIE ${state.serieActuelle}`;
        panelClass = 'panel-pen';
        btnClass = 'btn-pen';
        btnText = 'Cliquez sur chaque tour de pénalité quand il est réalisé';
        btnDisabled = true;
        showBtn = true;
    } else if (state.phase === 'finale') {
        phaseLabel = '🏁 DERNIÈRE COURSE';
        panelClass = 'panel-course';
        btnClass = 'btn-course';
        if (state.running) {
            btnText = '🏁 Arrivée';
            btnDisabled = false;
        } else {
            btnText = 'Démarrage...';
            btnDisabled = true;
        }
        showBtn = true;
    } else if (state.phase === 'termine') {
        terminerEpreuve();
        return;
    }

    container.innerHTML = `
        <div class="flex flex-col gap-4 max-w-4xl mx-auto">
            <div class="flex justify-between items-center bg-slate-800 p-3 rounded-2xl border border-slate-700">
                <div><span class="text-xs uppercase text-slate-400 font-bold">Équipe</span><div class="text-xl font-black text-white">${state.equipeId}</div></div>
                <div class="text-center"><span class="text-xs uppercase text-slate-400 font-bold">Maillot</span><div class="text-xl font-black ${colorClass}">${state.maillot}</div></div>
                <div class="text-right">
                    <span class="text-xs uppercase text-slate-400 font-bold">Série</span>
                    <div class="text-xl font-black text-yellow-400">${state.phase === 'finale' ? 'Finale' : `${state.serieActuelle} / ${state.nbSeries}`}</div>
                </div>
            </div>

            <div class="phase-panel ${panelClass} p-4 rounded-2xl">
                <div class="flex justify-between items-center">
                    <div>
                        <div class="phase-title text-2xl font-black uppercase tracking-wider">${phaseLabel}</div>
                        <div id="phaseClock" class="text-4xl font-mono font-black mt-1">${formatTime(state.tempsPhase)}</div>
                    </div>
                    <div class="text-right">
                        <div class="text-xs text-slate-600 font-bold">Temps total épreuve</div>
                        <div id="totalClock" class="text-xl font-mono font-bold text-slate-700">${formatTime(state.tempsTotalGlobal)}</div>
                        ${state.handicapMs > 0 ? `<div class="text-xs text-amber-600 font-bold">Handicap +${(state.handicapMs/1000).toFixed(1)}s</div>` : ''}
                    </div>
                </div>
            </div>

            ${showBtn ? `<button id="giantBtn" class="btn-action ${btnClass} w-full py-6 rounded-2xl font-black text-xl uppercase shadow-xl active:scale-95 transition-transform" ${btnDisabled ? 'disabled' : ''} onclick="window.onGiantAction()">${btnText}</button>` :
            `<div class="text-center text-emerald-400 font-bold text-xl bg-slate-900 py-4 rounded-xl border border-emerald-500">🏃 Course en cours...</div>`}

            <div id="phaseContent" class="bg-slate-800 p-4 rounded-2xl border border-slate-700 min-h-[180px]">${renderPhaseContent()}</div>

            <button onclick="window.retourMenuArcathlon()" class="bg-slate-700 px-4 py-2 rounded-xl font-bold text-xs text-white active:scale-95">← Retour</button>
        </div>
    `;

    injectStyles();
    updateClockDisplay();

    // DÉMARRAGES AUTOMATIQUES
    if (state.phase === 'course' && state.serieActuelle > 1 && !state.running) {
        if (transitionTimer) clearTimeout(transitionTimer);
        transitionTimer = setTimeout(() => startCourse(), 100);
    }
    if (state.phase === 'finale' && !state.running) {
        if (transitionTimer) clearTimeout(transitionTimer);
        transitionTimer = setTimeout(() => startCourse(), 100);
    }
}

function renderPhaseContent() {
    if (state.phase === 'course' || state.phase === 'finale') {
        const label = state.phase === 'finale' ? 'Course finale' : `Course série ${state.serieActuelle}`;
        return `
            <div class="text-center py-4">
                <p class="text-slate-400">${label} : ${state.distanceCourse}m</p>
                <p class="text-xs text-slate-500 mt-2">Objectif VMA : ${state.vmaRef} km/h</p>
                ${state.handicapMs > 0 ? `<p class="text-xs text-amber-400 mt-1">⏱ Handicap de ${(state.handicapMs/1000).toFixed(1)}s</p>` : ''}
                ${state.running ? '<p class="text-emerald-400 font-bold mt-2">⏱ Course en cours...</p>' : '<p class="text-slate-500 mt-2">Préparez-vous...</p>'}
            </div>
        `;
    }
    if (state.phase === 'tir') {
        const shotsHtml = state.shots.map((s, i) => `
            <button class="shot-btn ${s === 1 ? 'bg-emerald-600' : s === -1 ? 'bg-red-600' : 'bg-slate-700'} w-16 h-16 rounded-xl font-black text-2xl border-2 border-slate-600 active:scale-95 transition-all"
                    data-index="${i}" onclick="window.toggleShot(${i})">${s === 1 ? '✓' : s === -1 ? '✗' : '?'}</button>
        `).join('');
        const reussites = state.shots.filter(s => s === 1).length;
        const manques = state.shots.filter(s => s === -1).length;
        const totalIndiques = reussites + manques;
        return `
            <div class="flex flex-col items-center gap-3">
                <div class="flex gap-3 flex-wrap justify-center">${shotsHtml}</div>
                <div class="flex gap-4 text-sm">
                    <span class="text-emerald-400">✅ ${reussites}</span>
                    <span class="text-red-400">❌ ${manques}</span>
                    <span class="text-slate-400">${totalIndiques} / ${state.nbFleches} indiquées</span>
                </div>
                <button onclick="window.undoShot()" class="bg-slate-700 px-4 py-2 rounded-xl font-bold text-xs text-white active:scale-95">↩ Annuler dernière</button>
                ${totalIndiques === state.nbFleches ? '<p class="text-emerald-400 font-bold text-sm">✅ Toutes les flèches sont indiquées</p>' : '<p class="text-yellow-400 font-bold text-sm">⚠️ Cliquez sur chaque flèche (réussi ou raté)</p>'}
            </div>
        `;
    }
    if (state.phase === 'penalite') {
        const penButtons = Array.from({ length: state.penReq }, (_, i) => `
            <button class="penalty-btn ${i < state.penDone ? 'bg-emerald-600 border-emerald-400' : 'bg-slate-700 border-slate-600'} w-20 h-14 rounded-xl font-black text-sm border-2 active:scale-95 transition-all"
                    data-index="${i}" onclick="window.validatePenalty(${i})" ${i < state.penDone ? 'disabled' : ''}>
                ${i < state.penDone ? '✓' : `Tour ${i+1}`}
            </button>
        `).join('');
        return `
            <div class="flex flex-col items-center gap-3">
                <p class="text-sm text-slate-400">Cliquez sur chaque tour après l'avoir couru</p>
                <div class="flex gap-2 flex-wrap justify-center">${penButtons}</div>
                <div class="text-sm text-slate-400">${state.penDone} / ${state.penReq} tours effectués</div>
            </div>
        `;
    }
    return '<p class="text-slate-400 text-center">Phase en cours...</p>';
}

// --------------------------------------------------------------
// CHRONO
// --------------------------------------------------------------
function startClock() {
    if (state.running) return;
    state.running = true;
    state.phaseStart = performance.now();
    if (!clockInterval) clockInterval = requestAnimationFrame(updateClock);
}

function stopClock() {
    if (!state.running) return;
    state.running = false;
    if (state.phaseStart) {
        state.phaseAccum += (performance.now() - state.phaseStart);
        state.phaseStart = null;
    }
    if (clockInterval) { cancelAnimationFrame(clockInterval); clockInterval = null; }
}

function updateClock() {
    if (!state.running) return;
    const now = performance.now();
    const elapsed = state.phaseAccum + (state.phaseStart ? (now - state.phaseStart) : 0);
    updateClockDisplay(elapsed);
    clockInterval = requestAnimationFrame(updateClock);
}

function updateClockDisplay(phaseMs) {
    const pMs = phaseMs !== undefined ? phaseMs : state.phaseAccum;
    const phaseEl = document.getElementById('phaseClock');
    const totalEl = document.getElementById('totalClock');
    if (phaseEl) phaseEl.textContent = formatTime(pMs);
    if (totalEl) {
        const total = state.tempsTotalGlobal + (state.running ? pMs : state.phaseAccum);
        totalEl.textContent = formatTime(total);
    }
}

function formatTime(ms) {
    ms = Math.max(0, Math.round(ms));
    const cs = Math.floor((ms % 1000) / 10);
    const s = Math.floor(ms / 1000) % 60;
    const m = Math.floor(ms / 60000);
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
}

// --------------------------------------------------------------
// ACTIONS
// --------------------------------------------------------------
window.onGiantAction = function() {
    console.log('🖱️ onGiantAction appelée, phase =', state.phase, 'running =', state.running);
    if (state.phase === 'course' || state.phase === 'finale') {
        if (state.mode === 'poursuite' && !state.departSignal) {
            showToast('⏳ En attente du départ du professeur...', 2000);
            return;
        }
        if (!state.running) startCourse();
        else finishCourse();
    } else if (state.phase === 'tir') {
        console.log('🎯 Phase TIR, shots =', state.shots);
        const allShotsDone = state.shots.every(s => s !== 0);
        if (!allShotsDone) {
            showToast('⚠️ Veuillez indiquer le résultat de chaque flèche (réussi ou raté)', 2000);
            return;
        }
        console.log('✅ Toutes les flèches indiquées, appel de finishTir()');
        finishTir();
    } else if (state.phase === 'penalite') {
        showToast('Cliquez sur les tours de pénalité', 1500);
    }
};

function startCourse() {
    if (state.running) return;
    console.log('▶️ startCourse() appelée, série =', state.serieActuelle);
    if (state.serieActuelle === 1 && state.handicapMs > 0) {
        state.phaseAccum = state.handicapMs;
    }
    startClock();
    const btn = document.getElementById('giantBtn');
    if (btn) {
        btn.textContent = '🏁 Arrivée';
        btn.disabled = false;
    }
    const content = document.getElementById('phaseContent');
    if (content) content.innerHTML = renderPhaseContent();
}

function finishCourse() {
    console.log('🏁 finishCourse() appelée');
    stopClock();
    const tempsCourse = state.phaseAccum;
    state.tempsCourse = tempsCourse;
    state.tempsPhase = 0;
    state.tempsTotalGlobal += tempsCourse;
    state.phaseAccum = 0;

    if (state.phase === 'finale') {
        savePassage(true);
        return;
    }

    state.phase = 'tir';
    state.shots = Array(state.nbFleches).fill(0);
    renderPhase();
    startClock();
    const btn = document.getElementById('giantBtn');
    if (btn) {
        btn.textContent = 'Indiquez toutes les flèches';
        btn.className = 'btn-action btn-tir w-full py-6 rounded-2xl font-black text-xl uppercase shadow-xl active:scale-95 transition-transform';
        btn.disabled = true;
    }
}

// --------------------------------------------------------------
// TIRS
// --------------------------------------------------------------
window.toggleShot = function(index) {
    if (state.phase !== 'tir') return;
    if (index < 0 || index >= state.shots.length) return;
    const current = state.shots[index];
    state.shots[index] = current === 0 ? 1 : (current === 1 ? -1 : 0);
    document.getElementById('phaseContent').innerHTML = renderPhaseContent();
    // Mettre à jour le bouton
    const allShotsDone = state.shots.every(s => s !== 0);
    const btn = document.getElementById('giantBtn');
    if (btn) {
        if (allShotsDone) {
            btn.textContent = 'Fin de tir';
            btn.disabled = false;
            console.log('🔘 Bouton "Fin de tir" activé');
        } else {
            btn.textContent = 'Indiquez toutes les flèches';
            btn.disabled = true;
        }
    }
};

window.undoShot = function() {
    if (state.phase !== 'tir') return;
    for (let i = state.shots.length - 1; i >= 0; i--) {
        if (state.shots[i] !== 0) {
            state.shots[i] = 0;
            document.getElementById('phaseContent').innerHTML = renderPhaseContent();
            const btn = document.getElementById('giantBtn');
            if (btn) {
                btn.textContent = 'Indiquez toutes les flèches';
                btn.disabled = true;
            }
            return;
        }
    }
    showToast('Aucune flèche à annuler', 1500);
};

function finishTir() {
    console.log('🎯 finishTir() appelée');
    stopClock();
    const tempsTir = state.phaseAccum;
    state.tempsTir = tempsTir;
    state.tempsTotalGlobal += tempsTir;
    state.phaseAccum = 0;

    const reussites = state.shots.filter(s => s === 1).length;
    state.reussitesTir = reussites;
    state.penReq = state.shots.filter(s => s === -1).length;
    state.penDone = 0;
    state.tempsPenalites = [];

    if (state.penReq > 0) {
        state.phase = 'penalite';
        renderPhase();
        startClock();
        const btn = document.getElementById('giantBtn');
        if (btn) {
            btn.textContent = 'Cliquez sur chaque tour de pénalité quand il est réalisé';
            btn.className = 'btn-action btn-pen w-full py-6 rounded-2xl font-black text-xl uppercase shadow-xl active:scale-95 transition-transform';
            btn.disabled = true;
        }
    } else {
        terminerSerie();
    }
}

// --------------------------------------------------------------
// PÉNALITÉS
// --------------------------------------------------------------
window.validatePenalty = function(index) {
    if (state.phase !== 'penalite') return;
    if (index >= state.penReq || index < state.penDone) return;

    stopClock();
    const tempsBoucle = state.phaseAccum;
    state.tempsPenalites.push(tempsBoucle);
    state.tempsTotalGlobal += tempsBoucle;
    state.phaseAccum = 0;

    state.penDone++;

    const btns = document.querySelectorAll('.penalty-btn');
    if (btns[index]) {
        btns[index].classList.remove('bg-slate-700', 'border-slate-600');
        btns[index].classList.add('bg-emerald-600', 'border-emerald-400');
        btns[index].textContent = '✓';
        btns[index].disabled = true;
    }
    document.getElementById('phaseContent').innerHTML = renderPhaseContent();

    if (state.penDone >= state.penReq) {
        terminerSerie();
    } else {
        startClock();
        const nextBtn = document.querySelector(`.penalty-btn:not(.disabled)`);
        if (nextBtn) {
            nextBtn.textContent = `Tour ${state.penDone + 1}`;
        }
    }
};

// --------------------------------------------------------------
// TERMINER UNE SÉRIE
// --------------------------------------------------------------
function terminerSerie() {
    console.log('📦 terminerSerie() appelée, série =', state.serieActuelle);
    savePassage(false);
    state.serieActuelle++;

    if (state.serieActuelle > state.nbSeries) {
        state.phase = 'finale';
        state.phaseAccum = 0;
        state.shots = [];
        state.penReq = 0;
        state.penDone = 0;
        state.tempsPenalites = [];
        renderPhase();
    } else {
        state.phase = 'course';
        state.phaseAccum = 0;
        state.shots = [];
        state.penReq = 0;
        state.penDone = 0;
        state.tempsPenalites = [];
        renderPhase();
    }
}

// --------------------------------------------------------------
// SAUVEGARDE
// --------------------------------------------------------------
function savePassage(isFinale) {
    stopClock();
    console.log('💾 savePassage() appelée, finale =', isFinale);

    const distanceKm = state.distanceCourse / 1000;
    const tempsCourseHeures = state.tempsCourse / 1000 / 3600;
    const vitesse = tempsCourseHeures > 0 ? distanceKm / tempsCourseHeures : 0;

    const distanceTotaleSerie = state.distanceCourse + (state.penDone * state.longueurPenalite);

    let ptsVMA = 0;
    if (vitesse >= state.vmaRef + 1) ptsVMA = 3;
    else if (vitesse >= state.vmaRef - 0.5) ptsVMA = 2;
    else if (vitesse >= state.vmaRef - 1) ptsVMA = 1;

    const scoreTir = isFinale ? 0 : state.reussitesTir * 5;
    let bonus = 0;
    if (scoreTir > 0) {
        if (scoreTir < 7) bonus = 0;
        else if (scoreTir < 12) bonus = -10;
        else if (scoreTir < 16) bonus = -15;
        else bonus = -20;
    }
    const tempsTotalSerie = state.tempsCourse + state.tempsTir + state.tempsPenalites.reduce((a, b) => a + b, 0);
    const tempsBonifie = (tempsTotalSerie / 1000) + bonus;

    state.alerteTriche = false;
    if (vitesse > 0 && (vitesse > 25 || vitesse > state.vmaRef * 1.5)) {
        state.alerteTriche = true;
    }

    let vitesseMoyennePenalites = 0;
    if (state.tempsPenalites.length > 0) {
        const totalTempsPenalites = state.tempsPenalites.reduce((a, b) => a + b, 0);
        const distancePenaliteKm = state.longueurPenalite / 1000;
        const tempsPenaliteHeures = totalTempsPenalites / 1000 / 3600;
        vitesseMoyennePenalites = tempsPenaliteHeures > 0 ? distancePenaliteKm / tempsPenaliteHeures : 0;
    }

    const passageData = {
        code: state.code,
        equipe: state.equipeId,
        maillot: state.maillot,
        serie: state.serieActuelle,
        isFinale: isFinale,
        mode: state.mode,
        tempsCourse: Math.round(state.tempsCourse),
        tempsTir: Math.round(state.tempsTir),
        tempsPenalites: state.tempsPenalites.map(t => Math.round(t)),
        tempsTotalSerie: Math.round(tempsTotalSerie),
        tempsBonifie: Math.round(tempsBonifie * 10) / 10,
        vitesseGrandeBoucle: Math.round(vitesse * 10) / 10,
        vitesseMoyennePenalites: Math.round(vitesseMoyennePenalites * 10) / 10,
        ptsVMA: ptsVMA,
        scoreTir: scoreTir,
        bonus: bonus,
        penalites: state.penDone,
        handicap: state.handicapMs,
        distanceTotale: Math.round(distanceTotaleSerie),
        reussitesTir: state.reussitesTir || 0,
        alerteTriche: state.alerteTriche,
        timestamp: Date.now()
    };

    state.cumulDistance += distanceTotaleSerie;
    state.cumulPointsVMA += ptsVMA;
    state.cumulPointsTir += scoreTir;
    state.cumulTemps += tempsTotalSerie;
    state.seriesTerminees++;

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const path = `etablissements/0680013V/profs/${profCode}/${state.classe}/arcathlon/passages/${state.mode}`;
    push(ref(db, path), passageData)
        .then(() => {
            if (isFinale) {
                terminerEpreuve();
            } else {
                showToast(`✅ Série ${state.serieActuelle} terminée`, 1500);
            }
        })
        .catch(err => {
            console.error('❌ Erreur enregistrement :', err);
            showToast('❌ Erreur réseau, réessayez', 3000);
        });
}

// --------------------------------------------------------------
// FIN DE L'ÉPREUVE
// --------------------------------------------------------------
function terminerEpreuve() {
    const container = document.getElementById('arcathlon-module');
    if (!container) return;
    const totalPts = state.cumulPointsVMA + state.cumulPointsTir;
    container.innerHTML = `
        <div class="text-center py-10">
            <div class="text-6xl mb-6">🏆</div>
            <p class="text-3xl font-black text-emerald-400">Terminé !</p>
            <p class="text-slate-400 mt-2">Bravo, toutes les ${state.nbSeries} séries sont effectuées.</p>
            <div class="mt-6 bg-slate-800 p-6 rounded-2xl border border-slate-700 max-w-md mx-auto text-left">
                <p class="text-lg font-bold text-white">Temps total : ${formatTime(state.cumulTemps)}</p>
                <p class="text-lg font-bold text-white">Distance totale : ${Math.round(state.cumulDistance)}m</p>
                <p class="text-lg font-bold text-yellow-400">Points VMA : ${state.cumulPointsVMA}</p>
                <p class="text-lg font-bold text-blue-400">Points Tir : ${state.cumulPointsTir}</p>
                <p class="text-lg font-bold text-emerald-400">Total : ${totalPts} pts</p>
            </div>
            <button onclick="window.retourMenuArcathlon()" class="mt-6 bg-blue-600 px-6 py-3 rounded-xl font-black text-white active:scale-95">← Retour</button>
        </div>
    `;
}

// --------------------------------------------------------------
// UTILITAIRES
// --------------------------------------------------------------
function showToast(message, duration = 1500) {
    const existing = document.querySelector('.arcathlon-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'arcathlon-toast fixed top-20 left-1/2 -translate-x-1/2 bg-slate-900 border-2 border-slate-600 px-6 py-3 rounded-2xl font-bold text-white text-center z-50 shadow-2xl';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
}

function showDepartCountdown(seconds) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50';
    overlay.innerHTML = `<div class="text-8xl font-black text-yellow-400">${seconds}s</div><p class="text-xl text-slate-400 mt-4">Départ dans...</p>`;
    document.body.appendChild(overlay);
    let count = seconds;
    const interval = setInterval(() => {
        count--;
        if (count <= 0) {
            clearInterval(interval);
            overlay.innerHTML = `<div class="text-8xl font-black text-emerald-400">GO ! 🚀</div>`;
            setTimeout(() => { overlay.remove(); state.departSignal = true; startCourse(); }, 1000);
        } else {
            overlay.querySelector('.text-8xl').textContent = `${count}s`;
        }
    }, 1000);
}

function injectStyles() {
    if (document.getElementById('arcathlon-styles')) return;
    const style = document.createElement('style');
    style.id = 'arcathlon-styles';
    style.textContent = `
        .phase-panel { border-radius: 16px; padding: 16px; }
        .panel-course { background: #cfe4ff; color: #0a0f1a; }
        .panel-tir { background: #ffe1b3; color: #0a0f1a; }
        .panel-pen { background: #e1d0ff; color: #0a0f1a; }
        .phase-title { animation: phasePulse 1.5s ease-in-out infinite; transform-origin: left center; }
        @keyframes phasePulse { 0% { transform: scale(1); opacity: 0.95; } 50% { transform: scale(1.1); opacity: 0.7; } 100% { transform: scale(1); opacity: 0.95; } }
        .btn-course { background: linear-gradient(180deg, #5b57f1, #4f46e5); color: #fff; }
        .btn-tir { background: linear-gradient(180deg, #ffcc80, #f59e0b); color: #1b1200; }
        .btn-pen { background: linear-gradient(180deg, #b197ff, #9f86ff); color: #1b1200; }
        .shot-btn, .penalty-btn { transition: all 0.15s; cursor: pointer; }
        .penalty-btn:disabled { opacity: 0.7; cursor: default; }
    `;
    document.head.appendChild(style);
}

window.retourMenuArcathlon = function() {
    if (configListener) configListener();
    if (departListener) departListener();
    stopClock();
    if (clockInterval) cancelAnimationFrame(clockInterval);
    if (transitionTimer) clearTimeout(transitionTimer);
    const module = document.getElementById('arcathlon-module');
    if (module) module.classList.add('hidden');
    if (typeof window.resetToLogin === 'function') window.resetToLogin();
};
window.toggleShot = window.toggleShot;
window.undoShot = window.undoShot;
window.validatePenalty = window.validatePenalty;
window.retourMenuArcathlon = window.retourMenuArcathlon;

console.log('✅ Arcathlon kiosque chargé (avec logs et onclick)');