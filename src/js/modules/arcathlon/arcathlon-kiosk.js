// src/js/modules/arcathlon/arcathlon-kiosk.js
// Interface élève – Sélection équipe, phases, chrono, tirs, pénalités, enregistrement Firebase

import { db, ref, onValue, push, set } from '../../core/firebase-service.js';

// --------------------------------------------------------------
// ÉTAT LOCAL
// --------------------------------------------------------------
const state = {
    classe: '',
    code: '',              // ex: EQ1_Rouge
    equipeId: '',
    maillot: '',
    config: null,
    equipes: [],
    serieActuelle: 1,
    nbSeries: 3,
    phase: 'course',       // course | tir | penalite
    running: false,
    phaseStart: null,
    phaseAccum: 0,
    timerId: null,
    tempsCourse: 0,
    tempsPenalite: 0,
    tempsTotal: 0,
    nbFleches: 2,
    shots: [],
    penReq: 0,
    penDone: 0,
    departSignal: false,   // pour mode poursuite
    handicapMs: 0,
    vmaRef: 0,
    distanceTotale: 0,
    longueurPenalite: 30,
    mode: 'sprint'
};

let configListener = null;

// --------------------------------------------------------------
// 1. INITIALISATION (appelée par eleve-app.js)
// --------------------------------------------------------------
export function initArcathlonKiosk(classe, code) {
    state.classe = classe;
    state.code = code;
    state.serieActuelle = 1;
    state.phase = 'course';
    state.running = false;
    state.phaseAccum = 0;
    state.tempsCourse = 0;
    state.tempsPenalite = 0;
    state.tempsTotal = 0;
    state.shots = [];
    state.penReq = 0;
    state.penDone = 0;
    state.departSignal = false;

    // Écouter la config Firebase
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
            state.distanceTotale = config.distanceTotale || 100;
            state.longueurPenalite = config.longueurPenalite || 30;
            state.equipes = config.equipes || {};
            state.handicapMs = (config.handicaps && config.handicaps[code]) || 0;
            state.vmaRef = (config.vmaReference && config.vmaReference[code]) || 12;

            // Trouver l'équipe et le maillot
            for (const [eqId, eqData] of Object.entries(state.equipes)) {
                const membre = eqData.membres.find(m => m.code === code);
                if (membre) {
                    state.equipeId = eqId;
                    state.maillot = membre.maillot;
                    break;
                }
            }

            // Afficher l'interface
            renderPhase();
        } else {
            document.getElementById('arcathlon-module').innerHTML = `
                <div class="text-center py-10 text-slate-400">
                    <p class="text-2xl">⏳ En attente de la configuration...</p>
                </div>
            `;
        }
    });

    // Écoute du départ (mode poursuite)
    if (state.mode === 'poursuite') {
        const departRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/arcathlon/commandes/depart`);
        onValue(departRef, (snap) => {
            const data = snap.val();
            if (data && data.timestamp) {
                state.departSignal = true;
                const delai = data.delai || 0;
                const now = Date.now();
                const departTime = data.timestamp + (delai * 1000);
                const remaining = Math.max(0, Math.round((departTime - now) / 1000));
                if (remaining > 0) {
                    showDepartCountdown(remaining);
                } else {
                    startCourse();
                }
            }
        });
    }

    // Masquer les autres modules
    document.querySelectorAll('#activity-screen .module').forEach(el => el.classList.add('hidden'));
    const module = document.getElementById('arcathlon-module');
    if (module) module.classList.remove('hidden');
}

// --------------------------------------------------------------
// 2. AFFICHAGE DE LA PHASE
// --------------------------------------------------------------
function renderPhase() {
    const container = document.getElementById('arcathlon-module');
    if (!container) return;

    // Déterminer la couleur du maillot pour le style
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

    // Panneau de phase
    const phaseLabels = {
        'course': { label: 'COURSE', panel: 'panel-course', btn: 'btn-course', btnText: state.mode === 'poursuite' && !state.departSignal ? '⏳ Attente départ...' : 'Démarrer la course' },
        'tir': { label: 'TIR', panel: 'panel-tir', btn: 'btn-tir', btnText: 'Fin de tir' },
        'penalite': { label: 'PÉNALITÉ', panel: 'panel-pen', btn: 'btn-pen', btnText: 'Effectuer les tours' }
    };
    const phaseInfo = phaseLabels[state.phase] || phaseLabels.course;

    container.innerHTML = `
        <div class="flex flex-col gap-4 max-w-4xl mx-auto">
            <!-- En-tête : Équipe / Maillot / Série -->
            <div class="flex justify-between items-center bg-slate-800 p-3 rounded-2xl border border-slate-700">
                <div>
                    <span class="text-xs uppercase text-slate-400 font-bold">Équipe</span>
                    <div class="text-xl font-black text-white">${state.equipeId}</div>
                </div>
                <div class="text-center">
                    <span class="text-xs uppercase text-slate-400 font-bold">Maillot</span>
                    <div class="text-xl font-black ${colorClass}">${state.maillot}</div>
                </div>
                <div class="text-right">
                    <span class="text-xs uppercase text-slate-400 font-bold">Série</span>
                    <div class="text-xl font-black text-yellow-400">${state.serieActuelle} / ${state.nbSeries}</div>
                </div>
            </div>

            <!-- Panneau Phase -->
            <div class="phase-panel ${phaseInfo.panel} p-4 rounded-2xl">
                <div class="flex justify-between items-center">
                    <div>
                        <div class="phase-title text-2xl font-black uppercase tracking-wider">${phaseInfo.label}</div>
                        <div id="phaseClock" class="text-4xl font-mono font-black mt-1">00:00.00</div>
                    </div>
                    <div class="text-right">
                        <div class="text-xs text-slate-600 font-bold">Temps total</div>
                        <div id="totalClock" class="text-xl font-mono font-bold text-slate-700">00:00.00</div>
                        ${state.handicapMs > 0 ? `<div class="text-xs text-amber-600 font-bold">Handicap +${(state.handicapMs/1000).toFixed(1)}s</div>` : ''}
                    </div>
                </div>
            </div>

            <!-- Bouton d'action principal -->
            <button id="giantBtn" class="btn-action ${phaseInfo.btn} w-full py-6 rounded-2xl font-black text-xl uppercase shadow-xl active:scale-95 transition-transform">
                ${phaseInfo.btnText}
            </button>

            <!-- Contenu de la phase -->
            <div id="phaseContent" class="bg-slate-800 p-4 rounded-2xl border border-slate-700 min-h-[200px]">
                ${renderPhaseContent()}
            </div>

            <!-- Bouton retour -->
            <button onclick="window.retourMenuArcathlon()" class="bg-slate-700 px-4 py-2 rounded-xl font-bold text-xs text-white active:scale-95">
                ← Retour
            </button>
        </div>
    `;

    // Ajouter les styles CSS manquants
    injectStyles();

    // Attacher les événements
    document.getElementById('giantBtn').addEventListener('click', onGiantAction);

    // Démarrer le chrono si on est en phase course et que le mode est sprint
    if (state.phase === 'course' && state.mode === 'sprint' && !state.running) {
        // En sprint, on démarre immédiatement
        startCourse();
    }

    // Mettre à jour le chrono
    updateClock();
}

// --------------------------------------------------------------
// 3. CONTENU DE LA PHASE
// --------------------------------------------------------------
function renderPhaseContent() {
    if (state.phase === 'course') {
        return `
            <div class="text-center py-4">
                <p class="text-slate-400">Course de ${state.distanceTotale}m</p>
                <p class="text-xs text-slate-500 mt-2">Objectif VMA : ${state.vmaRef} km/h</p>
                ${state.handicapMs > 0 ? `<p class="text-xs text-amber-400 mt-1">⏱ Handicap de ${(state.handicapMs/1000).toFixed(1)}s</p>` : ''}
            </div>
        `;
    }

    if (state.phase === 'tir') {
        const shotsHtml = state.shots.map((s, i) => `
            <button class="shot-btn ${s === 1 ? 'bg-emerald-600' : s === -1 ? 'bg-red-600' : 'bg-slate-700'} w-16 h-16 rounded-xl font-black text-2xl border-2 border-slate-600 active:scale-95 transition-all"
                    data-index="${i}"
                    onclick="window.toggleShot(${i})">
                ${s === 1 ? '✓' : s === -1 ? '✗' : i + 1}
            </button>
        `).join('');

        return `
            <div class="flex flex-col items-center gap-3">
                <div class="flex gap-3 flex-wrap justify-center">
                    ${shotsHtml}
                </div>
                <div class="flex gap-4 text-sm">
                    <span class="text-emerald-400">✅ ${state.shots.filter(s => s === 1).length}</span>
                    <span class="text-red-400">❌ ${state.shots.filter(s => s === -1).length}</span>
                    <span class="text-slate-400">Score : <strong class="text-yellow-400">${calculateTirScore()}</strong></span>
                </div>
                <button onclick="window.undoShot()" class="bg-slate-700 px-4 py-2 rounded-xl font-bold text-xs text-white active:scale-95">
                    ↩ Annuler dernière
                </button>
            </div>
        `;
    }

    if (state.phase === 'penalite') {
        const penButtons = Array.from({ length: state.penReq }, (_, i) => `
            <button class="penalty-btn ${i < state.penDone ? 'bg-emerald-600 border-emerald-400' : 'bg-slate-700 border-slate-600'} w-20 h-14 rounded-xl font-black text-sm border-2 active:scale-95 transition-all"
                    data-index="${i}"
                    onclick="window.validatePenalty(${i})"
                    ${i < state.penDone ? 'disabled' : ''}>
                ${i < state.penDone ? '✓' : `Tour ${i+1}`}
            </button>
        `).join('');

        return `
            <div class="flex flex-col items-center gap-3">
                <p class="text-sm text-slate-400">Cliquez sur chaque tour après l'avoir couru</p>
                <div class="flex gap-2 flex-wrap justify-center">
                    ${penButtons}
                </div>
                <div class="text-sm text-slate-400">
                    ${state.penDone} / ${state.penReq} tours effectués
                </div>
            </div>
        `;
    }

    return '<p class="text-slate-400 text-center">Phase en cours...</p>';
}

// --------------------------------------------------------------
// 4. CHRONO
// --------------------------------------------------------------
let clockInterval = null;

function startClock() {
    if (clockInterval) return;
    state.running = true;
    state.phaseStart = performance.now();
    clockInterval = requestAnimationFrame(updateClock);
}

function stopClock() {
    state.running = false;
    if (clockInterval) {
        cancelAnimationFrame(clockInterval);
        clockInterval = null;
    }
    // Sauvegarder le temps écoulé
    if (state.phaseStart) {
        const now = performance.now();
        state.phaseAccum += (now - state.phaseStart);
        state.phaseStart = null;
        // Accumuler dans le temps total de la phase
        if (state.phase === 'course') {
            state.tempsCourse = state.phaseAccum;
        } else if (state.phase === 'penalite') {
            state.tempsPenalite = state.phaseAccum;
        }
        state.tempsTotal = state.tempsCourse + state.tempsPenalite;
    }
}

function resetClock() {
    stopClock();
    state.phaseAccum = 0;
    state.phaseStart = null;
    state.tempsCourse = 0;
    state.tempsPenalite = 0;
    state.tempsTotal = 0;
    updateClockDisplay(0);
}

function updateClock() {
    if (!state.running) return;
    const now = performance.now();
    const elapsed = state.phaseAccum + (state.phaseStart ? (now - state.phaseStart) : 0);
    const total = state.tempsCourse + state.tempsPenalite + (state.phase === 'course' ? elapsed : 0);
    updateClockDisplay(elapsed, total);
    clockInterval = requestAnimationFrame(updateClock);
}

function updateClockDisplay(phaseMs, totalMs) {
    const phaseEl = document.getElementById('phaseClock');
    const totalEl = document.getElementById('totalClock');
    if (phaseEl) phaseEl.textContent = formatTime(phaseMs || state.phaseAccum);
    if (totalEl) {
        const total = totalMs || state.tempsTotal + state.phaseAccum;
        totalEl.textContent = formatTime(total);
    }
}

function formatTime(ms) {
    ms = Math.max(0, Math.round(ms));
    const cs = Math.floor((ms % 1000) / 10);
    const s = Math.floor(ms / 1000) % 60;
    const m = Math.floor(ms / 60000);
    const pad = (n, l = 2) => String(n).padStart(l, '0');
    return `${pad(m)}:${pad(s)}.${pad(cs)}`;
}

// --------------------------------------------------------------
// 5. ACTIONS PAR PHASE
// --------------------------------------------------------------
function onGiantAction() {
    if (state.phase === 'course') {
        if (state.mode === 'poursuite' && !state.departSignal) {
            showToast('⏳ En attente du départ du professeur...', 2000);
            return;
        }
        if (!state.running) {
            startCourse();
        } else {
            finishCourse();
        }
    } else if (state.phase === 'tir') {
        finishTir();
    } else if (state.phase === 'penalite') {
        showToast('Cliquez sur les tours de pénalité', 1500);
    }
}

function startCourse() {
    if (state.running) return;
    // Appliquer le handicap (décalage du chrono)
    if (state.handicapMs > 0) {
        state.phaseAccum = state.handicapMs;
    }
    startClock();
    updateGiantButton('course', '🏁 Arrivée');
}

function finishCourse() {
    stopClock();
    state.tempsCourse = state.phaseAccum;
    state.tempsTotal = state.tempsCourse + state.tempsPenalite;

    // Vérifier si c'est la dernière série (pas de tir)
    if (state.serieActuelle >= state.nbSeries) {
        // Dernière série : on enregistre directement
        savePassage();
        return;
    }

    // Passer au tir
    state.phase = 'tir';
    state.shots = Array(state.nbFleches).fill(0);
    state.phaseAccum = 0;
    state.phaseStart = null;
    renderPhase();
    startClock();
    updateGiantButton('tir', 'Fin de tir');
}

// --------------------------------------------------------------
// 6. TIRS
// --------------------------------------------------------------
window.toggleShot = function(index) {
    if (state.phase !== 'tir') return;
    if (index < 0 || index >= state.shots.length) return;
    // Cycle : 0 → 1 → -1 → 0
    const current = state.shots[index];
    if (current === 0) state.shots[index] = 1;
    else if (current === 1) state.shots[index] = -1;
    else state.shots[index] = 0;
    renderPhaseContent(); // rafraîchir les cases
};

window.undoShot = function() {
    if (state.phase !== 'tir') return;
    for (let i = state.shots.length - 1; i >= 0; i--) {
        if (state.shots[i] !== 0) {
            state.shots[i] = 0;
            renderPhaseContent();
            return;
        }
    }
    showToast('Aucune flèche à annuler', 1500);
};

function calculateTirScore() {
    // Les flèches réussies valent 5, manquées 0
    return state.shots.filter(s => s === 1).length * 5;
}

function finishTir() {
    stopClock();
    const score = calculateTirScore();

    // Calcul des pénalités selon barème
    if (score < 7) state.penReq = 3;
    else if (score < 12) state.penReq = 2;
    else if (score < 16) state.penReq = 1;
    else state.penReq = 0;

    state.penDone = 0;

    if (state.penReq > 0) {
        state.phase = 'penalite';
        state.phaseAccum = 0;
        state.phaseStart = null;
        renderPhase();
        startClock();
        updateGiantButton('penalite', 'Effectuer les tours');
    } else {
        // Pas de pénalité → fin de série
        savePassage();
    }
}

// --------------------------------------------------------------
// 7. PÉNALITÉS
// --------------------------------------------------------------
window.validatePenalty = function(index) {
    if (state.phase !== 'penalite') return;
    if (index >= state.penReq || index < state.penDone) return;
    state.penDone++;
    // Mettre à jour l'affichage des boutons
    const btns = document.querySelectorAll('.penalty-btn');
    if (btns[index]) {
        btns[index].classList.remove('bg-slate-700', 'border-slate-600');
        btns[index].classList.add('bg-emerald-600', 'border-emerald-400');
        btns[index].textContent = '✓';
        btns[index].disabled = true;
    }
    // Mettre à jour le compteur
    const counter = document.querySelector('.text-sm.text-slate-400');
    if (counter) {
        counter.textContent = `${state.penDone} / ${state.penReq} tours effectués`;
    }
    // Si tous les tours sont faits
    if (state.penDone >= state.penReq) {
        stopClock();
        state.tempsPenalite = state.phaseAccum;
        state.tempsTotal = state.tempsCourse + state.tempsPenalite;
        savePassage();
    }
};

// --------------------------------------------------------------
// 8. SAUVEGARDE DU PASSAGE
// --------------------------------------------------------------
function savePassage() {
    stopClock();

    // Calcul de la vitesse
    const distanceKm = (state.distanceTotale + (state.penDone * state.longueurPenalite)) / 1000;
    const tempsHeures = state.tempsTotal / 1000 / 3600;
    const vitesse = tempsHeures > 0 ? distanceKm / tempsHeures : 0;

    // Points VMA
    let ptsVMA = 0;
    if (vitesse >= state.vmaRef + 1) ptsVMA = 3;
    else if (vitesse >= state.vmaRef - 0.5) ptsVMA = 2;
    else if (vitesse >= state.vmaRef - 1) ptsVMA = 1;

    // Bonus de tir
    const score = calculateTirScore();
    let bonus = 0;
    if (score < 7) bonus = 0;
    else if (score < 12) bonus = -10;
    else if (score < 16) bonus = -15;
    else bonus = -20;

    const tempsBonifie = (state.tempsTotal / 1000) + bonus;

    const passageData = {
        code: state.code,
        equipe: state.equipeId,
        maillot: state.maillot,
        serie: state.serieActuelle,
        mode: state.mode,
        tempsCourse: Math.round(state.tempsCourse),
        tempsPenalite: Math.round(state.tempsPenalite),
        tempsTotal: Math.round(state.tempsTotal),
        tempsBonifie: Math.round(tempsBonifie * 10) / 10,
        vitesse: Math.round(vitesse * 10) / 10,
        ptsVMA: ptsVMA,
        scoreTir: score,
        bonus: bonus,
        penalites: state.penDone,
        handicap: state.handicapMs,
        timestamp: Date.now()
    };

    // Envoi Firebase
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const path = `etablissements/0680013V/profs/${profCode}/${state.classe}/arcathlon/passages/${state.mode}`;
    const passageRef = ref(db, path);
    push(passageRef, passageData)
        .then(() => {
            showToast(`✅ Série ${state.serieActuelle} enregistrée !`, 2000);
            // Passer à la série suivante ou terminer
            if (state.serieActuelle < state.nbSeries) {
                state.serieActuelle++;
                state.phase = 'course';
                state.phaseAccum = 0;
                state.phaseStart = null;
                state.tempsCourse = 0;
                state.tempsPenalite = 0;
                state.tempsTotal = 0;
                state.shots = [];
                state.penReq = 0;
                state.penDone = 0;
                renderPhase();
                if (state.mode === 'sprint') {
                    startCourse();
                } else {
                    updateGiantButton('course', state.departSignal ? 'Démarrer la course' : '⏳ Attente départ...');
                }
            } else {
                // Fin de toutes les séries
                document.getElementById('arcathlon-module').innerHTML = `
                    <div class="text-center py-20">
                        <div class="text-6xl mb-6">🏆</div>
                        <p class="text-3xl font-black text-emerald-400">Terminé !</p>
                        <p class="text-slate-400 mt-2">Bravo, toutes les séries sont effectuées.</p>
                        <button onclick="window.retourMenuArcathlon()" class="mt-6 bg-blue-600 px-6 py-3 rounded-xl font-black text-white active:scale-95">
                            ← Retour
                        </button>
                    </div>
                `;
            }
        })
        .catch(err => {
            console.error('Erreur enregistrement :', err);
            showToast('❌ Erreur réseau, réessayez', 3000);
        });
}

// --------------------------------------------------------------
// 9. UTILITAIRES
// --------------------------------------------------------------
function updateGiantButton(phase, text) {
    const btn = document.getElementById('giantBtn');
    if (!btn) return;
    btn.textContent = text;
    btn.className = `btn-action ${phase === 'course' ? 'btn-course' : phase === 'tir' ? 'btn-tir' : 'btn-pen'} w-full py-6 rounded-2xl font-black text-xl uppercase shadow-xl active:scale-95 transition-transform`;
}

function showToast(message, duration = 3000) {
    const existing = document.querySelector('.arcathlon-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'arcathlon-toast fixed top-20 left-1/2 -translate-x-1/2 bg-slate-900 border-2 border-slate-600 px-6 py-3 rounded-2xl font-bold text-white text-center z-50 shadow-2xl';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
}

function showDepartCountdown(seconds) {
    const container = document.getElementById('arcathlon-module');
    if (!container) return;
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50';
    overlay.innerHTML = `
        <div class="text-8xl font-black text-yellow-400">${seconds}s</div>
        <p class="text-xl text-slate-400 mt-4">Départ dans...</p>
    `;
    document.body.appendChild(overlay);

    let count = seconds;
    const interval = setInterval(() => {
        count--;
        if (count <= 0) {
            clearInterval(interval);
            overlay.innerHTML = `
                <div class="text-8xl font-black text-emerald-400">GO ! 🚀</div>
            `;
            setTimeout(() => {
                overlay.remove();
                state.departSignal = true;
                startCourse();
            }, 1000);
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
        @keyframes phasePulse {
            0% { transform: scale(1); opacity: 0.95; }
            50% { transform: scale(1.1); opacity: 0.7; }
            100% { transform: scale(1); opacity: 0.95; }
        }
        .btn-course { background: linear-gradient(180deg, #5b57f1, #4f46e5); color: #fff; }
        .btn-tir { background: linear-gradient(180deg, #ffcc80, #f59e0b); color: #1b1200; }
        .btn-pen { background: linear-gradient(180deg, #b197ff, #9f86ff); color: #1b1200; }
        .shot-btn { transition: all 0.15s; cursor: pointer; }
        .penalty-btn { transition: all 0.15s; cursor: pointer; }
        .penalty-btn:disabled { opacity: 0.7; cursor: default; }
    `;
    document.head.appendChild(style);
}

// --------------------------------------------------------------
// 10. RETOUR
// --------------------------------------------------------------
window.retourMenuArcathlon = function() {
    // Nettoyer les listeners
    if (configListener) {
        configListener();
        configListener = null;
    }
    stopClock();
    if (clockInterval) {
        cancelAnimationFrame(clockInterval);
        clockInterval = null;
    }
    // Retour à l'écran de sélection
    const module = document.getElementById('arcathlon-module');
    if (module) {
        module.innerHTML = `
            <div class="text-center py-10 text-slate-400">
                <p class="text-2xl">↩ Retour au choix du maillot</p>
                <button onclick="window.resetToLogin()" class="mt-4 bg-blue-600 px-6 py-3 rounded-xl font-black text-white active:scale-95">
                    Choisir un maillot
                </button>
            </div>
        `;
    }
    // Dans eleve-app.js, on a une fonction resetToLogin pour revenir à l'écran de sélection
    if (typeof window.resetToLogin === 'function') {
        window.resetToLogin();
    }
};

// Exposer les fonctions globales pour les boutons HTML
window.toggleShot = window.toggleShot;
window.undoShot = window.undoShot;
window.validatePenalty = window.validatePenalty;
window.retourMenuArcathlon = window.retourMenuArcathlon;

console.log('✅ Arcathlon kiosque chargé');