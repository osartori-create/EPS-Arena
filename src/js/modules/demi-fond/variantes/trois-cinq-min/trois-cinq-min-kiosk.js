// src/js/modules/demi-fond/variantes/trois-cinq-min/trois-cinq-min-kiosk.js
// Kiosque observateur - 3x5min R=3'

import { db, ref, onValue, set, push } from '../../../../core/firebase-service.js';
import { COULEURS_GROUPES, getCouleurGroupe, getBasePath } from '../../demifond-common.js';

// ============================================================
// ÉTAT GLOBAL
// ============================================================
let state = {
    classe: '',
    couleur: null,          // 'BLEU' | 'ROUGE' | 'VERT' | 'JAUNE' | null
    config: null,           // Config Firebase
    sequence: null,         // État de la séquence Firebase
    codes: [],              // Codes des élèves du groupe couleur
    timestampsParEleve: {}, // { code: [t1, t2, ...] } (relatif au début de la course)
    partielsParEleve: {},   // { code: 6 }
    abandonsParEleve: {},   // { code: 'blessure' | 'mental' }
    lastClickAt: {},        // { code: Date.now() } pour anti-double-clic

    phase: 'choix',         // 'choix' | 'attente' | 'course' | 'pause' | 'bilan'
    courseNum: 1,
    timestampDebut: null,   // Timestamp absolu du début de la course actuelle
    derniereCourseEnvoyee: 0,

    // UI
    dernierClic: null,      // { code, timestamp } pour annulation
    feedbackMsg: null,
    feedbackTimeout: null,

    // Abandon modal
    modaleAbandon: false,
    modaleAbandonCode: null,

    // Audio
    audioCtx: null,

    // Timers
    tickInterval: null,
    uiRefreshInterval: null
};

let configListener = null;
let sequenceListener = null;

// ============================================================
// INITIALISATION
// ============================================================
export function initTroisCinqMinKiosk(classe) {
    state.classe = classe;
    state.couleur = null;
    state.phase = 'choix';
    state.courseNum = 1;
    state.timestampsParEleve = {};
    state.partielsParEleve = {};
    state.abandonsParEleve = {};
    state.lastClickAt = {};
    state.dernierClic = null;
    state.derniereCourseEnvoyee = 0;
    state.timestampDebut = null;

    const container = document.getElementById('demi-fond-module');
    if (!container) return;

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const basePath = getBasePath(classe);

    // Écoute config
    if (configListener) configListener();
    configListener = onValue(ref(db, `${basePath}/config`), (snap) => {
        state.config = snap.val() || null;
        render();
    });

    // Écoute séquence
    if (sequenceListener) sequenceListener();
    sequenceListener = onValue(ref(db, `${basePath}/commandes/sequence`), (snap) => {
        const seq = snap.val();
        if (!seq) return;

        const ancienEtat = state.sequence?.etat;
        state.sequence = seq;

        // GO initial
        if (seq.etat === 'course1' && state.phase === 'attente' && state.couleur) {
            demarrerCourse(1, seq.timestampDebut);
        }
        // Skip manuel du prof
        else if (seq.etat === 'course' && seq.forceSkip && state.phase === 'pause') {
            // Le prof a forcé le passage à la course suivante
            const nextNum = (seq.courseNum || state.courseNum + 1);
            demarrerCourse(nextNum, seq.timestampMaj);
        }
        // Stop
        else if (seq.etat === 'termine') {
            state.phase = 'bilan';
            render();
        }
        // Pause manuelle
        else if (seq.etat === 'pause_manuelle') {
            if (state.tickInterval) clearInterval(state.tickInterval);
            state.phase = 'pause_manuelle';
            render();
        }

        render();
    });

    // Timer global de séquence
    if (state.tickInterval) clearInterval(state.tickInterval);
    state.tickInterval = setInterval(tick, 500);

    // Timer UI (compte à rebours anti-double-clic)
    if (state.uiRefreshInterval) clearInterval(state.uiRefreshInterval);
    state.uiRefreshInterval = setInterval(refreshButtons, 200);

    render();

    // Retourner la fonction de cleanup
    return cleanupTroisCinqMinKiosk;
}

// ============================================================
// TICK - Vérifie l'état temporel et transitionne
// ============================================================
function tick() {
    if (!state.timestampDebut || !state.config) return;

    const elapsed = (Date.now() - state.timestampDebut) / 1000;
    const duree = state.config.duree;
    const pause = state.config.pause;

    // Calcul de la phase et de la course en cours
    let phase, courseNum;

    if (elapsed < duree) {
        phase = 'course'; courseNum = 1;
    } else if (elapsed < duree + pause) {
        phase = 'pause'; courseNum = 1;
    } else if (elapsed < 2 * duree + pause) {
        phase = 'course'; courseNum = 2;
    } else if (elapsed < 2 * duree + 2 * pause) {
        phase = 'pause'; courseNum = 2;
    } else if (elapsed < 3 * duree + 2 * pause) {
        phase = 'course'; courseNum = 3;
    } else {
        phase = 'bilan'; courseNum = 3;
    }

    // Détection de transition
    if (state.phase !== phase || state.courseNum !== courseNum) {
        const anciennePhase = state.phase;
        const ancienneCourse = state.courseNum;

        // Transition Course → Pause ou Bilan : on envoie les résultats
        if (anciennePhase === 'course' && phase !== 'course') {
            envoyerResultatsCourse(ancienneCourse);
        }

        // Transition Pause → Course suivante : on prépare une nouvelle course
        if (anciennePhase === 'pause' && phase === 'course' && courseNum !== ancienneCourse) {
            preparerNouvelleCourse(courseNum);
        }

        state.phase = phase;
        state.courseNum = courseNum;
        render();
    }
}

// ============================================================
// DÉMARRAGE COURSE
// ============================================================
function demarrerCourse(num, timestampDebut) {
    state.phase = 'course';
    state.courseNum = num;
    state.timestampDebut = timestampDebut || Date.now();
    state.dernierClic = null;

    // Reset des clics de cette course
    const nouveauxTimestamps = {};
    state.codes.forEach(code => { nouveauxTimestamps[code] = []; });
    state.timestampsParEleve = nouveauxTimestamps;
    state.lastClickAt = {};

    render();
}

function preparerNouvelleCourse(num) {
    // Reset des données de la course
    state.timestampsParEleve = {};
    state.partielsParEleve = {};
    state.abandonsParEleve = {};
    state.lastClickAt = {};
    state.dernierClic = null;
    state.codes.forEach(code => {
        state.timestampsParEleve[code] = [];
    });
}

// ============================================================
// ENVOI FIREBASE
// ============================================================
async function envoyerResultatsCourse(courseNum) {
    if (state.derniereCourseEnvoyee >= courseNum) return;
    state.derniereCourseEnvoyee = courseNum;

    const basePath = getBasePath(state.classe);

    try {
        for (const code of state.codes) {
            const timestamps = state.timestampsParEleve[code] || [];
            const partiel = state.partielsParEleve[code] || 0;
            const abandon = state.abandonsParEleve[code] || null;

            if (timestamps.length === 0 && !abandon && !partiel) continue;

            await set(ref(db, `${basePath}/observations/course-${courseNum}/${code}`), {
                timestamps: timestamps.map(t => t - state.timestampDebut), // relatif au départ
                partiel,
                abandon,
                duree: state.config.duree,
                tour: state.config.tour,
                plots: state.config.plots,
                timestamp: Date.now()
            });
        }
        console.log(`[DemiFond] Résultats course ${courseNum} envoyés (${state.codes.length} élèves)`);
    } catch (err) {
        console.error('[DemiFond] Erreur envoi résultats:', err);
    }
}

// ============================================================
// RENDER
// ============================================================
function render() {
    const container = document.getElementById('demi-fond-module');
    if (!container) return;

    if (!state.config) {
        container.innerHTML = `<div class="text-center py-10 text-slate-400">
            <p class="text-xl">⏳ En attente de la configuration du professeur...</p>
        </div>`;
        return;
    }

    if (state.modaleAbandon) {
        renderModaleAbandon(container);
        return;
    }

    switch (state.phase) {
        case 'choix':           renderChoixCouleur(container); break;
        case 'attente':         renderAttente(container); break;
        case 'course':          renderCourse(container); break;
        case 'pause':           renderPause(container); break;
        case 'pause_manuelle':  renderPauseManuelle(container); break;
        case 'bilan':           renderBilan(container); break;
        default:                renderChoixCouleur(container);
    }
}

// ============================================================
// ÉCRAN 1 : CHOIX COULEUR
// ============================================================
function renderChoixCouleur(container) {
    // Filtrer les couleurs qui ont au moins 1 élève
    const couleursDispo = COULEURS_GROUPES.filter(c => {
        const codes = state.config?.groupes?.[c.id] || [];
        return codes.length > 0;
    });

    let html = `
        <div class="max-w-2xl mx-auto text-center">
            <div class="py-6">
                <h1 class="text-3xl font-black text-white mb-2">🏃 1/2 Fond</h1>
                <p class="text-slate-400">Choisis ta couleur d'observateur</p>
            </div>
            <div class="grid grid-cols-2 gap-4">
    `;

    couleursDispo.forEach(c => {
        const nb = (state.config.groupes[c.id] || []).length;
        html += `
            <button onclick="window.dmfKioskChoixCouleur('${c.id}')"
                    class="p-10 rounded-3xl font-black text-2xl active:scale-95 transition-all shadow-2xl"
                    style="background:${c.bg}; color:${c.text}; border:4px solid ${c.border};">
                ${c.label}
                <div class="text-sm font-normal opacity-80 mt-2">${nb} élève(s)</div>
            </button>
        `;
    });

    html += `</div>
        <button onclick="window.retourMenuDemiFond()"
                class="w-full mt-6 bg-slate-700 hover:bg-slate-600 py-3 rounded-2xl font-black text-sm text-white active:scale-95">
            ← Retour au menu général
        </button>
    </div>`;

    container.innerHTML = html;
}

window.dmfKioskChoixCouleur = function(couleurId) {
    state.couleur = couleurId;
    state.codes = state.config?.groupes?.[couleurId] || [];
    state.phase = 'attente';
    initAudioContext();
    render();
};

// ============================================================
// ÉCRAN 2 : ATTENTE
// ============================================================
function renderAttente(container) {
    const couleur = getCouleurGroupe(state.couleur);

    container.innerHTML = `
        <div class="min-h-[60vh] flex flex-col items-center justify-center p-8"
             style="background:${couleur.bg}15;">
            <div class="text-8xl mb-6 animate-pulse">⏳</div>
            <h2 class="text-3xl font-black text-white mb-3">En attente du signal</h2>
            <p class="text-slate-300 mb-8">Groupe <span style="color:${couleur.bg}" class="font-black">${couleur.label}</span></p>
            <div class="bg-slate-800/80 backdrop-blur p-6 rounded-3xl border-2 max-w-md text-center"
                 style="border-color:${couleur.border};">
                <p class="text-slate-300 text-sm">Prépare-toi. Le prof va lancer la séquence.</p>
                <p class="text-slate-400 text-xs mt-2">Tu cliqueras sur le numéro de chaque coureur quand il repassera devant toi.</p>
            </div>
            <button onclick="window.dmfKioskRetourChoixCouleur()"
                    class="mt-8 bg-slate-700 hover:bg-slate-600 px-6 py-3 rounded-2xl font-black text-xs uppercase text-white active:scale-95">
                ← Changer de couleur
            </button>
        </div>
    `;
}

window.dmfKioskRetourChoixCouleur = function() {
    state.couleur = null;
    state.codes = [];
    state.phase = 'choix';
    render();
};

// ============================================================
// ÉCRAN 3 : COURSE
// ============================================================
function renderCourse(container) {
    const couleur = getCouleurGroupe(state.couleur);
    const elapsed = (Date.now() - state.timestampDebut) / 1000;
    const restant = Math.max(0, state.config.duree - elapsed);
    const min = Math.floor(restant / 60);
    const sec = Math.floor(restant % 60);

    // Grille adaptative selon le nombre de codes
    const nbCodes = state.codes.length;
    let cols;
    if (nbCodes <= 6) cols = 3;
    else if (nbCodes <= 12) cols = 4;
    else cols = 5;

    let gridHtml = '';
    state.codes.forEach(code => {
        const nb = (state.timestampsParEleve[code] || []).length;
        const lastClick = state.lastClickAt[code] || 0;
        const ecoule = Date.now() - lastClick;
        const antiClic = state.config.antiDoubleClic || 30000;
        const bloqué = ecoule < antiClic;
        const restantSec = bloqué ? Math.ceil((antiClic - ecoule) / 1000) : 0;

        // Style du bouton
        let btnStyle = '';
        let disabled = '';

        if (state.abandonsParEleve[code]) {
            btnStyle = 'background:#7f1d1d; color:#fca5a5; border-color:#991b1b; opacity:0.5;';
            disabled = 'disabled';
        } else if (bloqué) {
            btnStyle = `background:${couleur.bg}40; color:#ffffff80; border-color:${couleur.border}40;`;
        } else {
            btnStyle = `background:${couleur.bg}; color:${couleur.text}; border-color:${couleur.border};`;
        }

        gridHtml += `
            <button id="dmf-btn-${code}"
                    ${disabled}
                    onclick="window.dmfKioskClickCoureur('${code}')"
                    class="rounded-2xl font-black border-4 active:scale-95 transition-all flex flex-col items-center justify-center relative"
                    style="${btnStyle} min-height:110px;">
                <span class="text-4xl">${code}</span>
                <span class="text-xs opacity-70 mt-1">${nb} tour${nb > 1 ? 's' : ''}</span>
                ${state.abandonsParEleve[code] ? '<span class="text-[10px] mt-1">🚫 ABANDON</span>' : ''}
                ${bloqué && !state.abandonsParEleve[code] ? `<span class="text-[10px] mt-1">⏱ ${restantSec}s</span>` : ''}
            </button>
        `;
    });

    container.innerHTML = `
        <div class="p-4" style="background:${couleur.bg}10; min-height:100vh;">
            <!-- Bandeau haut : chrono + course -->
            <div class="flex justify-between items-center bg-slate-900/90 backdrop-blur p-4 rounded-2xl mb-3 border-2"
                 style="border-color:${couleur.border};">
                <div>
                    <div class="text-[10px] font-bold uppercase text-slate-400">Groupe</div>
                    <div class="text-xl font-black" style="color:${couleur.bg};">${couleur.label}</div>
                </div>
                <div class="text-center">
                    <div class="text-[10px] font-bold uppercase text-slate-400">Course ${state.courseNum} / 3</div>
                    <div class="text-2xl font-black text-white">${state.codes.length} coureurs</div>
                </div>
                <div class="text-right">
                    <div class="text-[10px] font-bold uppercase text-slate-400">Temps restant</div>
                    <div id="dmf-chrono-restant" class="text-3xl font-mono font-black text-yellow-400">${min}:${String(sec).padStart(2, '0')}</div>
                </div>
            </div>

            <!-- Bandeau feedback (si un clic récent) -->
            ${state.feedbackMsg ? `
                <div class="text-center py-3 mb-3 bg-emerald-500 text-white rounded-2xl font-black text-2xl animate-pulse">
                    ${state.feedbackMsg}
                </div>
            ` : ''}

            <!-- Grille des numéros -->
            <div class="grid gap-3 mb-3" style="grid-template-columns: repeat(${cols}, minmax(0, 1fr));">
                ${gridHtml}
            </div>

            <!-- Boutons bas -->
            <div class="flex gap-2">
                <button onclick="window.dmfKioskAnnulerDernier()"
                        class="flex-1 bg-slate-700 hover:bg-slate-600 py-4 rounded-2xl font-black text-white active:scale-95 ${state.dernierClic ? '' : 'opacity-40 cursor-not-allowed'}"
                        ${state.dernierClic ? '' : 'disabled'}>
                    ↩ Annuler dernier clic
                </button>
                <button onclick="window.dmfKioskOuvrirAbandon()"
                        class="flex-1 bg-red-800 hover:bg-red-700 py-4 rounded-2xl font-black text-white active:scale-95">
                    🚨 Abandon
                </button>
            </div>
        </div>
    `;
}

window.dmfKioskClickCoureur = function(code) {
    if (state.phase !== 'course') return;
    if (state.abandonsParEleve[code]) return;

    const antiClic = state.config.antiDoubleClic || 30000;
    const lastClick = state.lastClickAt[code] || 0;
    if (Date.now() - lastClick < antiClic) return;

    // Enregistrer le timestamp
    if (!state.timestampsParEleve[code]) state.timestampsParEleve[code] = [];
    const t = Date.now();
    state.timestampsParEleve[code].push(t);
    state.lastClickAt[code] = t;
    state.dernierClic = { code, timestamp: t };

    // Feedback : vibration + son + visuel
    if (navigator.vibrate) navigator.vibrate(80);
    playBeep();

    // Feedback visuel temporaire
    state.feedbackMsg = `✓ ${code}`;
    if (state.feedbackTimeout) clearTimeout(state.feedbackTimeout);
    state.feedbackTimeout = setTimeout(() => {
        state.feedbackMsg = null;
        render();
    }, 400);

    render();
};

window.dmfKioskAnnulerDernier = function() {
    if (!state.dernierClic) return;
    const { code } = state.dernierClic;

    // Retirer le dernier timestamp de cet élève
    const arr = state.timestampsParEleve[code] || [];
    arr.pop();
    state.timestampsParEleve[code] = arr;

    // Reset lastClickAt pour cet élève
    delete state.lastClickAt[code];

    state.dernierClic = null;
    render();
};

// ============================================================
// MODALE ABANDON
// ============================================================
window.dmfKioskOuvrirAbandon = function() {
    state.modaleAbandon = true;
    state.modaleAbandonCode = null;
    render();
};

function renderModaleAbandon(container) {
    let contenu;
    if (!state.modaleAbandonCode) {
        // Étape 1 : choisir le code
        contenu = `
            <div class="text-center">
                <h3 class="text-2xl font-black text-white mb-3">Qui abandonne ?</h3>
                <p class="text-slate-400 text-sm mb-6">Clique sur son numéro</p>
                <div class="grid grid-cols-3 gap-3 mb-6">
                    ${state.codes.filter(c => !state.abandonsParEleve[c]).map(code => `
                        <button onclick="window.dmfKioskAbandonSelectCode('${code}')"
                                class="bg-red-800 hover:bg-red-700 text-white font-black text-3xl py-6 rounded-2xl active:scale-95 border-4 border-red-900">
                            ${code}
                        </button>
                    `).join('')}
                </div>
                <button onclick="window.dmfKioskFermerAbandon()"
                        class="w-full bg-slate-700 hover:bg-slate-600 py-3 rounded-2xl font-black text-white">
                    Annuler
                </button>
            </div>
        `;
    } else {
        // Étape 2 : choisir la raison
        contenu = `
            <div class="text-center">
                <h3 class="text-2xl font-black text-white mb-3">Élève ${state.modaleAbandonCode}</h3>
                <p class="text-slate-400 text-sm mb-6">Raison de l'abandon ?</p>
                <div class="flex flex-col gap-3">
                    <button onclick="window.dmfKioskAbandonConfirmer('blessure')"
                            class="bg-red-700 hover:bg-red-600 text-white font-black text-lg py-5 rounded-2xl active:scale-95">
                        🩹 Blessure / Physique
                    </button>
                    <button onclick="window.dmfKioskAbandonConfirmer('mental')"
                            class="bg-orange-700 hover:bg-orange-600 text-white font-black text-lg py-5 rounded-2xl active:scale-95">
                        🧠 Mental / Motivation
                    </button>
                    <button onclick="window.dmfKioskRetourChoixCodeAbandon()"
                            class="bg-slate-700 hover:bg-slate-600 py-3 rounded-2xl font-black text-white">
                        ← Retour
                    </button>
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-6">
            <div class="bg-slate-900 p-6 rounded-3xl border-4 border-red-700 max-w-md w-full">
                ${contenu}
            </div>
        </div>
    `;
}

window.dmfKioskAbandonSelectCode = function(code) {
    state.modaleAbandonCode = code;
    render();
};

window.dmfKioskRetourChoixCodeAbandon = function() {
    state.modaleAbandonCode = null;
    render();
};

window.dmfKioskAbandonConfirmer = function(raison) {
    const code = state.modaleAbandonCode;
    if (!code) return;

    state.abandonsParEleve[code] = raison;
    state.modaleAbandon = false;
    state.modaleAbandonCode = null;
    render();
};

window.dmfKioskFermerAbandon = function() {
    state.modaleAbandon = false;
    state.modaleAbandonCode = null;
    render();
};

// ============================================================
// ÉCRAN 4 : PAUSE + SAISIE PARTIELS
// ============================================================
function renderPause(container) {
    const couleur = getCouleurGroupe(state.couleur);
    const elapsed = (Date.now() - state.timestampDebut) / 1000;
    const pauseDebut = state.config.duree + (state.courseNum - 1) * (state.config.duree + state.config.pause);
    const elapsedPause = elapsed - pauseDebut;
    const restant = Math.max(0, state.config.pause - elapsedPause);
    const min = Math.floor(restant / 60);
    const sec = Math.floor(restant % 60);

    // Filtrer les élèves non-abandonnés
    const elevesActifs = state.codes.filter(c => !state.abandonsParEleve[c]);

    let html = `
        <div class="p-4" style="background:${couleur.bg}10; min-height:100vh;">
            <div class="flex justify-between items-center bg-slate-900/90 backdrop-blur p-4 rounded-2xl mb-4 border-2"
                 style="border-color:${couleur.border};">
                <div>
                    <div class="text-[10px] font-bold uppercase text-slate-400">Pause</div>
                    <div class="text-xl font-black text-white">Course ${state.courseNum} terminée</div>
                </div>
                <div class="text-right">
                    <div class="text-[10px] font-bold uppercase text-slate-400">Reprise dans</div>
                    <div class="text-3xl font-mono font-black text-yellow-400">${min}:${String(sec).padStart(2, '0')}</div>
                </div>
            </div>

            <div class="bg-slate-800 p-4 rounded-2xl border-2 border-slate-700 mb-4">
                <h3 class="font-black text-white text-lg mb-1">📝 Saisie des plots partiels</h3>
                <p class="text-slate-400 text-sm mb-4">
                    Pour chaque élève, indique combien de plots supplémentaires il a parcourus dans son dernier tour
                    (0 = il venait de finir un tour, 8 = il était presque au bout).
                </p>
                <div class="space-y-3">
    `;

    elevesActifs.forEach(code => {
        const nbTours = (state.timestampsParEleve[code] || []).length;
        const partiel = state.partielsParEleve[code] || 0;

        html += `
            <div class="bg-slate-900 p-3 rounded-xl border border-slate-700">
                <div class="flex justify-between items-center mb-2">
                    <div>
                        <span class="font-black text-2xl" style="color:${couleur.bg};">${code}</span>
                        <span class="text-xs text-slate-400 ml-2">${nbTours} tour${nbTours > 1 ? 's' : ''} complet${nbTours > 1 ? 's' : ''}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-xs text-slate-400">Partiel :</span>
                        <span id="dmf-partiel-${code}" class="text-xl font-black text-white w-8 text-center">${partiel}</span>
                    </div>
                </div>
                <div class="flex gap-1">
                    ${[0,1,2,3,4,5,6,7,8].map(n => `
                        <button onclick="window.dmfKioskSetPartiel('${code}', ${n})"
                                class="flex-1 py-2 rounded-lg font-black text-sm border-2 active:scale-95 ${partiel === n ? 'bg-blue-600 text-white border-blue-400' : 'bg-slate-800 text-slate-300 border-slate-700'}">
                            ${n}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    });

    html += `
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

window.dmfKioskSetPartiel = function(code, valeur) {
    state.partielsParEleve[code] = valeur;
    render();
};

// ============================================================
// ÉCRAN 5 : PAUSE MANUELLE
// ============================================================
function renderPauseManuelle(container) {
    const couleur = getCouleurGroupe(state.couleur);
    container.innerHTML = `
        <div class="min-h-[60vh] flex flex-col items-center justify-center p-8" style="background:${couleur.bg}15;">
            <div class="text-7xl mb-6">⏸️</div>
            <h2 class="text-3xl font-black text-white mb-3">Pause manuelle</h2>
            <p class="text-slate-300 mb-8">Le prof a mis la séquence en pause.</p>
            <div class="bg-slate-800/80 p-6 rounded-3xl border-2" style="border-color:${couleur.border};">
                <p class="text-slate-400 text-sm">Attends la reprise...</p>
            </div>
        </div>
    `;
}

// ============================================================
// ÉCRAN 6 : BILAN
// ============================================================
function renderBilan(container) {
    const couleur = getCouleurGroupe(state.couleur);
    container.innerHTML = `
        <div class="min-h-[60vh] flex flex-col items-center justify-center p-8" style="background:${couleur.bg}15;">
            <div class="text-7xl mb-6">🏆</div>
            <h2 class="text-3xl font-black text-white mb-3">Séquence terminée !</h2>
            <p class="text-slate-300 mb-8">Les résultats ont été enregistrés.</p>
            <div class="bg-slate-800/80 p-6 rounded-3xl border-2 max-w-md text-center" style="border-color:${couleur.border};">
                <p class="text-slate-300 text-sm">
                    ${state.phase === 'bilan' ? '🏁 La consultation des bilans arrive dans la prochaine mise à jour.' : 'En attente...'}
                </p>
            </div>
            <button onclick="window.retourMenuDemiFond()"
                    class="mt-8 bg-slate-700 hover:bg-slate-600 px-8 py-3 rounded-2xl font-black text-sm uppercase text-white active:scale-95">
                ← Quitter
            </button>
        </div>
    `;
}

// ============================================================
// UI REFRESH (anti-double-clic)
// ============================================================
function refreshButtons() {
    if (state.phase !== 'course') return;
    if (!state.config) return;

    const antiClic = state.config.antiDoubleClic || 30000;
    const couleur = getCouleurGroupe(state.couleur);
    let needFullRender = false;

    state.codes.forEach(code => {
        const btn = document.getElementById(`dmf-btn-${code}`);
        if (!btn) return;

        const lastClick = state.lastClickAt[code] || 0;
        const ecoule = Date.now() - lastClick;
        const bloqué = ecoule < antiClic;
        const abandon = state.abandonsParEleve[code];

        if (abandon) {
            // Rien à faire
        } else if (bloqué) {
            // ✅ Mettre à jour le texte du compteur (sans re-render)
            const restantSec = Math.ceil((antiClic - ecoule) / 1000);
            const spans = btn.querySelectorAll('span');
            const dernier = spans[spans.length - 1];
            if (dernier && dernier.textContent.startsWith('⏱')) {
                dernier.textContent = `⏱ ${restantSec}s`;
            }
        } else {
            // ✅ Le bouton était bloqué et vient de se débloquer
            if (btn.disabled) {
                needFullRender = true;
            }
        }
    });

    // Rafraîchir le chrono du bandeau
    const chronoEl = document.getElementById('dmf-chrono-restant');
    if (chronoEl && state.timestampDebut) {
        const elapsed = (Date.now() - state.timestampDebut) / 1000;
        const restant = Math.max(0, state.config.duree - elapsed);
        const min = Math.floor(restant / 60);
        const sec = Math.floor(restant % 60);
        chronoEl.textContent = `${min}:${String(sec).padStart(2, '0')}`;
    }

    // ✅ Re-render complet UNIQUEMENT quand un bouton se débloque
    if (needFullRender) render();
}

// ============================================================
// AUDIO
// ============================================================
function initAudioContext() {
    if (state.audioCtx) return;
    try {
        state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.warn('[DemiFond] AudioContext non disponible');
    }
}

function playBeep() {
    if (!state.audioCtx) return;
    try {
        if (state.audioCtx.state === 'suspended') {
            state.audioCtx.resume();
        }
        const osc = state.audioCtx.createOscillator();
        const gain = state.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 900;
        gain.gain.setValueAtTime(0.15, state.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, state.audioCtx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(state.audioCtx.destination);
        osc.start();
        osc.stop(state.audioCtx.currentTime + 0.1);
    } catch (e) {}
}

// ============================================================
// RETOUR / CLEANUP
// ============================================================
window.retourMenuDemiFond = function() {
    cleanupTroisCinqMinKiosk();
    const container = document.getElementById('demi-fond-module');
    if (container) {
        container.innerHTML = '';
        container.classList.add('hidden');
    }
    if (typeof window.resetToLogin === 'function') window.resetToLogin();
};

export function cleanupTroisCinqMinKiosk() {
    if (configListener) { configListener(); configListener = null; }
    if (sequenceListener) { sequenceListener(); sequenceListener = null; }
    if (state.tickInterval) { clearInterval(state.tickInterval); state.tickInterval = null; }
    if (state.uiRefreshInterval) { clearInterval(state.uiRefreshInterval); state.uiRefreshInterval = null; }
    if (state.feedbackTimeout) { clearTimeout(state.feedbackTimeout); state.feedbackTimeout = null; }
    state = {
        classe: '', couleur: null, config: null, sequence: null, codes: [],
        timestampsParEleve: {}, partielsParEleve: {}, abandonsParEleve: {}, lastClickAt: {},
        phase: 'choix', courseNum: 1, timestampDebut: null, derniereCourseEnvoyee: 0,
        dernierClic: null, feedbackMsg: null, feedbackTimeout: null,
        modaleAbandon: false, modaleAbandonCode: null, audioCtx: null,
        tickInterval: null, uiRefreshInterval: null
    };
}