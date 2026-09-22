// src/js/modules/demi-fond/variantes/trois-cinq-min/trois-cinq-min-kiosk.js
// Kiosque observateur - 3x5min R=3'

import { db, ref, onValue, set, push } from '../../../../core/firebase-service.js';
import { COULEURS_GROUPES, getCouleurGroupe, getBasePath } from '../../demifond-common.js';

// ============================================================
// ÉTAT GLOBAL
// ============================================================
let state = {
    classe: '',
    couleur: null,
    config: null,
    sequence: null,
    codes: [],
    timestampsParEleve: {},
    partielsParEleve: {},
    abandonsParEleve: {},
    lastClickAt: {},

    phase: 'choix',
    courseNum: 1,
    timestampDebut: null,
    derniereCourseEnvoyee: 0,

    dernierClic: null,
    feedbackMsg: null,
    feedbackTimeout: null,

    modaleAbandon: false,
    modaleAbandonCode: null,

    audioCtx: null,

    tickInterval: null,
    uiRefreshInterval: null,
    bilanCodeActif: null,   // ✅ AJOUT
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

    const basePath = getBasePath(classe);

    // Écoute config
    if (configListener) configListener();
    configListener = onValue(ref(db, `${basePath}/config`), (snap) => {
        state.config = snap.val() || null;
        render();
    });

    // Écoute séquence
    if (sequenceListener) sequenceListener();
    sequenceListener = onValue(ref(db, `${basePath}/commandes/sequence`), async (snap) => {
    const seq = snap.val();
    if (!seq) return;

    const ancienneAction = state.sequence?.actionTimestamp;
    state.sequence = seq;

    // Nouvelle action détectée
    if (seq.actionTimestamp && seq.actionTimestamp !== ancienneAction) {
        console.log('[DemiFond] Action reçue :', seq.action);

        // Toujours synchroniser le timestampDebut
        state.timestampDebut = seq.timestampDebut;

        // Terminé
        if (seq.etat === 'termine') {
            state.phase = 'bilan';
            render();
            return;
        }

        // Pause manuelle
        if (seq.etat === 'pause_manuelle') {
            state.phase = 'pause_manuelle';
            render();
            return;
        }

        // GO ou SKIP : reset complet
        if (seq.action === 'go' || seq.action === 'skip') {
            // Si un SKIP survient pendant une pause, la course qui vient de se
            // terminer attend encore d'être envoyée (partiels saisis pendant la pause).
            if (seq.action === 'skip' && state.phase === 'pause') {
                await envoyerResultatsCourse(state.courseNum);
            }
            state.timestampsParEleve = {};
            state.partielsParEleve = {};
            state.abandonsParEleve = {};
            state.lastClickAt = {};
            state.dernierClic = null;
            state.derniereCourseEnvoyee = 0;
            state.codes.forEach(code => { state.timestampsParEleve[code] = []; });
        }

        // Reprendre ou GO ou SKIP : forcer un tick pour recalculer la phase
        if (state.couleur) {
            // Forcer un état "neutre" pour que tick() recalculle
            state.phase = '__tick__';
            tick();
            render();
        }
        return;
    }

    // Aucune action mais état = termine (ex: kiosque connecté après la fin)
    if (seq.etat === 'termine' && state.phase !== 'bilan') {
        state.phase = 'bilan';
        render();
    }
});

    // Timer global de séquence
    if (state.tickInterval) clearInterval(state.tickInterval);
    state.tickInterval = setInterval(tick, 500);

    // Timer UI (compte à rebours anti-double-clic + chronos)
    if (state.uiRefreshInterval) clearInterval(state.uiRefreshInterval);
    state.uiRefreshInterval = setInterval(refreshButtons, 200);

    render();

    return cleanupTroisCinqMinKiosk;
}

// ============================================================
// TICK - Vérifie l'état temporel et transitionne
// ============================================================
function tick() {
    if (!state.timestampDebut || !state.config) return;
    if (state.phase === 'pause_manuelle') return;
    if (state.phase === 'bilan') return;

    const elapsed = (Date.now() - state.timestampDebut) / 1000;
    const duree = state.config.duree;
    const pause = state.config.pause;

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
        // ✅ Fin de la course 3 : on passe en saisie finale (pas directement au bilan)
        phase = 'saisie_finale'; courseNum = 3;
    }

    if (state.phase !== phase || state.courseNum !== courseNum) {
        const anciennePhase = state.phase;
        const ancienneCourse = state.courseNum;

        // Transition Course → Pause : la saisie des plots partiels se fait pendant
        // la pause, on n'envoie donc PAS encore les résultats (sinon partiel = 0).
        if (anciennePhase === 'course' && phase === 'pause') {
            // Rien à envoyer ici : on attend la saisie des partiels pendant la pause.
        }

        // Pause → Course suivante : envoyer les résultats de la course terminée
        // (avec les partiels saisis pendant la pause), puis préparer la suivante.
        if (anciennePhase === 'pause' && phase === 'course' && courseNum !== ancienneCourse) {
            envoyerResultatsCourse(ancienneCourse);
            preparerNouvelleCourse(courseNum);
        }

                // Course 3 terminée → saisie finale (les résultats seront envoyés après validation)
        if (anciennePhase === 'course' && phase === 'saisie_finale') {
            // Rien à envoyer ici, on attend la validation
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

    const nouveauxTimestamps = {};
    state.codes.forEach(code => { nouveauxTimestamps[code] = []; });
    state.timestampsParEleve = nouveauxTimestamps;
    state.lastClickAt = {};

    render();
}

function preparerNouvelleCourse(num) {
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

    // ✅ SNAPSHOT immédiat (avant tout await) : évite qu'un reset concurrent
    // (preparerNouvelleCourse) ne vide les tableaux pendant l'envoi asynchrone.
    const timestampDebut = state.timestampDebut;
    const duree = state.config.duree;
    const tour = state.config.tour;
    const plots = state.config.plots;
    const snapshot = state.codes.map(code => ({
        code,
        timestamps: (state.timestampsParEleve[code] || []).slice(),
        partiel: state.partielsParEleve[code] || 0,
        abandon: state.abandonsParEleve[code] || null
    }));

    let envoyes = 0;
    for (const { code, timestamps, partiel, abandon } of snapshot) {
        if (timestamps.length === 0 && !abandon && !partiel) continue;
        try {
            await set(ref(db, `${basePath}/observations/course-${courseNum}/${code}`), {
                timestamps: timestamps.map(t => t - timestampDebut),
                partiel,
                abandon,
                duree,
                tour,
                plots,
                timestamp: Date.now()
            });
            envoyes++;
        } catch (err) {
            // Une écriture échouée (wifi) ne doit pas empêcher les autres élèves.
            console.error(`[DemiFond] Échec envoi course ${courseNum}/${code}:`, err);
        }
    }
    console.log(`[DemiFond] Résultats course ${courseNum} envoyés (${envoyes}/${snapshot.length} élèves)`);
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
        case 'saisie_finale':   renderSaisieFinale(container); break;
        case 'pause_manuelle':  renderPauseManuelle(container); break;
        case 'bilan':           renderBilan(container); break;
        default:                renderChoixCouleur(container);
    }
}

// ============================================================
// ÉCRAN 1 : CHOIX COULEUR
// ============================================================
function renderChoixCouleur(container) {
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

    // ✅ Calcul du temps restant avec prise en compte de la course en cours
    const elapsedTotal = (Date.now() - state.timestampDebut) / 1000;
    const courseDebut = (state.courseNum - 1) * (state.config.duree + state.config.pause);
    const elapsed = elapsedTotal - courseDebut;
    const restant = Math.max(0, state.config.duree - elapsed);
    const min = Math.floor(restant / 60);
    const sec = Math.floor(restant % 60);

    // Grille adaptative
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

        let btnStyle = '';
        let disabled = '';

        if (state.abandonsParEleve[code]) {
            btnStyle = 'background:#7f1d1d; color:#fca5a5; border-color:#991b1b; opacity:0.5;';
            disabled = 'disabled';
        } else if (bloqué) {
            btnStyle = `background:${couleur.bg}40; color:#ffffff80; border-color:${couleur.border}40;`;
            disabled = 'disabled';   // ✅ FIX : bloqué = disabled
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

            ${state.feedbackMsg ? `
                <div class="text-center py-3 mb-3 bg-emerald-500 text-white rounded-2xl font-black text-2xl animate-pulse">
                    ${state.feedbackMsg}
                </div>
            ` : ''}

            <div class="grid gap-3 mb-3" style="grid-template-columns: repeat(${cols}, minmax(0, 1fr));">
                ${gridHtml}
            </div>

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

    if (!state.timestampsParEleve[code]) state.timestampsParEleve[code] = [];
    const t = Date.now();
    state.timestampsParEleve[code].push(t);
    state.lastClickAt[code] = t;
    state.dernierClic = { code, timestamp: t };

    if (navigator.vibrate) navigator.vibrate(80);
    playBeep();

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

    const arr = state.timestampsParEleve[code] || [];
    arr.pop();
    state.timestampsParEleve[code] = arr;

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

    // ✅ Calcul du temps restant de pause
    const elapsedTotal = (Date.now() - state.timestampDebut) / 1000;
    const pauseDebut = state.config.duree + (state.courseNum - 1) * (state.config.duree + state.config.pause);
    const elapsedPause = elapsedTotal - pauseDebut;
    const restant = Math.max(0, state.config.pause - elapsedPause);
    const min = Math.floor(restant / 60);
    const sec = Math.floor(restant % 60);

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
                    <div id="dmf-chrono-pause" class="text-3xl font-mono font-black text-yellow-400">${min}:${String(sec).padStart(2, '0')}</div>
                </div>
            </div>

            <div class="bg-slate-800 p-4 rounded-2xl border-2 border-slate-700 mb-4">
                <h3 class="font-black text-white text-lg mb-1">📝 Saisie des plots partiels</h3>
                <p class="text-slate-400 text-sm mb-4">
                    Pour chaque élève, indique combien de plots supplémentaires il a parcourus dans son dernier tour
                    (0 = il venait de finir un tour, ${state.config.plots || 8} = il était presque au bout).
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
                    ${listePlots().map(n => `
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

// ============================================================
// ÉCRAN 4BIS : SAISIE FINALE (après course 3)
// ============================================================
function renderSaisieFinale(container) {
    const couleur = getCouleurGroupe(state.couleur);

    const elevesActifs = state.codes.filter(c => !state.abandonsParEleve[c]);

    let html = `
        <div class="p-4" style="background:${couleur.bg}10; min-height:100vh;">
            <div class="flex justify-between items-center bg-slate-900/90 backdrop-blur p-4 rounded-2xl mb-4 border-2"
                 style="border-color:${couleur.border};">
                <div>
                    <div class="text-[10px] font-bold uppercase text-slate-400">Fin de séquence</div>
                    <div class="text-xl font-black text-white">Course 3 terminée</div>
                </div>
                <div class="text-right">
                    <div class="text-[10px] font-bold uppercase text-slate-400">Étape</div>
                    <div class="text-lg font-black text-yellow-400">Saisie finale</div>
                </div>
            </div>

            <div class="bg-slate-800 p-4 rounded-2xl border-2 border-slate-700 mb-4">
                <h3 class="font-black text-white text-lg mb-1">📝 Saisie des plots partiels — Course 3</h3>
                <p class="text-slate-400 text-sm mb-4">
                    Pour chaque élève, indique combien de plots supplémentaires il a parcourus dans son dernier tour.
                </p>
                <div class="space-y-3">
    `;

    if (elevesActifs.length === 0) {
        html += `<p class="text-slate-500 text-center text-sm">Aucun élève actif.</p>`;
    } else {
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
                            <span class="text-xl font-black text-white w-8 text-center">${partiel}</span>
                        </div>
                    </div>
                    <div class="flex gap-1">
                        ${listePlots().map(n => `
                            <button onclick="window.dmfKioskSetPartiel('${code}', ${n})"
                                    class="flex-1 py-2 rounded-lg font-black text-sm border-2 active:scale-95 ${partiel === n ? 'bg-blue-600 text-white border-blue-400' : 'bg-slate-800 text-slate-300 border-slate-700'}">
                                ${n}
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;
        });
    }

    html += `
                </div>
            </div>

            <button onclick="window.dmfKioskTerminerSequence()"
                    class="w-full bg-emerald-600 hover:bg-emerald-500 py-5 rounded-2xl font-black text-xl text-white active:scale-95 transition-all shadow-xl">
                ✅ Voir les bilans
            </button>
        </div>
    `;

    container.innerHTML = html;
}

window.dmfKioskTerminerSequence = async function() {
    // Envoyer les résultats de la course 3
    await envoyerResultatsCourse(3);
    state.phase = 'bilan';
    render();
};

window.dmfKioskSetPartiel = function(code, valeur) {
    state.partielsParEleve[code] = valeur;
    render();
};

function listePlots() {
    const plots = state.config?.plots || 8;
    return Array.from({ length: plots + 1 }, (_, i) => i);
}

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

    // Si un code est sélectionné → afficher son bilan
    if (state.bilanCodeActif) {
        renderBilanEleve(container, state.bilanCodeActif);
        return;
    }

    // Sinon → liste des numéros
    let html = `
        <div class="p-4" style="background:${couleur.bg}10; min-height:100vh;">
            <div class="text-center py-4 mb-4">
                <div class="text-6xl mb-2">🏆</div>
                <h2 class="text-3xl font-black text-white mb-1">Séquence terminée !</h2>
                <p class="text-slate-300">Clique sur un numéro pour afficher son bilan</p>
            </div>

            <div class="grid grid-cols-3 gap-3 mb-4">
    `;

    state.codes.forEach(code => {
        const abandon = state.abandonsParEleve[code];
        const bgStyle = abandon
            ? 'background:#7f1d1d; color:#fca5a5; border-color:#991b1b;'
            : `background:${couleur.bg}; color:${couleur.text}; border-color:${couleur.border};`;

        html += `
            <button onclick="window.dmfKioskAfficherBilan('${code}')"
                    class="rounded-2xl font-black border-4 active:scale-95 transition-all"
                    style="${bgStyle} min-height:100px;">
                <span class="text-4xl">${code}</span>
                ${abandon ? '<div class="text-[10px] mt-1">🚫 ABANDON</div>' : ''}
            </button>
        `;
    });

    html += `
            </div>

            <button onclick="window.retourMenuDemiFond()"
                    class="w-full bg-slate-700 hover:bg-slate-600 py-3 rounded-2xl font-black text-sm uppercase text-white active:scale-95">
                ← Quitter
            </button>
        </div>
    `;

    container.innerHTML = html;
}

window.dmfKioskAfficherBilan = async function(code) {
    state.bilanCodeActif = code;
    render();
};

window.dmfKioskBilanRetour = function() {
    state.bilanCodeActif = null;
    render();
};

async function renderBilanEleve(container, code) {
    const couleur = getCouleurGroupe(state.couleur);

    // Afficher un écran de chargement
    container.innerHTML = `
        <div class="p-8 text-center" style="background:${couleur.bg}10; min-height:100vh;">
            <div class="text-4xl animate-pulse mt-20">⏳</div>
            <p class="text-slate-300 mt-4">Chargement du bilan...</p>
        </div>
    `;

    try {
        const { chargerObservations, calculerBilan, rendreBilanHTML } = await import('./trois-cinq-min-bilan.js');
        const observations = await chargerObservations(state.classe, code);

        const vma = state.config?.vmaParCode?.[code] || null;
        const bilan = calculerBilan(observations, state.config, vma);
        bilan.code = code;

        const html = rendreBilanHTML(bilan, state.couleur);

        container.innerHTML = `
            <div class="p-4" style="background:${couleur.bg}10; min-height:100vh;">
                ${html}
            </div>
        `;
    } catch (err) {
        console.error('[DemiFond] Erreur bilan:', err);
        container.innerHTML = `
            <div class="p-8 text-center" style="background:${couleur.bg}10; min-height:100vh;">
                <div class="text-4xl mt-20">❌</div>
                <p class="text-red-400 mt-4">Erreur lors du chargement du bilan</p>
                <p class="text-slate-500 text-sm mt-2">${err.message}</p>
                <button onclick="window.dmfKioskBilanRetour()"
                        class="mt-6 bg-slate-700 hover:bg-slate-600 px-6 py-3 rounded-2xl font-black text-sm text-white active:scale-95">
                    ← Retour
                </button>
            </div>
        `;
    }
}

// ============================================================
// UI REFRESH (anti-double-clic + chronos)
// ============================================================
function refreshButtons() {
    // ---------- Phase COURSE ----------
    if (state.phase === 'course' && state.config) {
        const antiClic = state.config.antiDoubleClic || 30000;
        const couleur = getCouleurGroupe(state.couleur);

        state.codes.forEach(code => {
            const btn = document.getElementById(`dmf-btn-${code}`);
            if (!btn) return;

            const lastClick = state.lastClickAt[code] || 0;
            const ecoule = Date.now() - lastClick;
            const bloqué = ecoule < antiClic;
            const abandon = state.abandonsParEleve[code];

            if (abandon) return;

            const spans = btn.querySelectorAll('span');
            const dernier = spans[spans.length - 1];
            if (!dernier) return;

            if (bloqué) {
                const restantSec = Math.ceil((antiClic - ecoule) / 1000);
                if (dernier.textContent.startsWith('⏱')) {
                    dernier.textContent = `⏱ ${restantSec}s`;
                }
            } else {
                // ✅ Débloqué : retirer le "⏱" et restaurer le texte
                if (dernier.textContent.startsWith('⏱')) {
                    const nb = (state.timestampsParEleve[code] || []).length;
                    dernier.textContent = `${nb} tour${nb > 1 ? 's' : ''}`;
                }
                if (btn.disabled) {
                    btn.disabled = false;
                    btn.style.cssText = `background:${couleur.bg}; color:${couleur.text}; border-color:${couleur.border}; min-height:110px;`;
                }
            }
        });

        // Chrono course (avec gestion de la course en cours)
        const chronoEl = document.getElementById('dmf-chrono-restant');
        if (chronoEl && state.timestampDebut) {
            const elapsedTotal = (Date.now() - state.timestampDebut) / 1000;
            const courseDebut = (state.courseNum - 1) * (state.config.duree + state.config.pause);
            const elapsed = elapsedTotal - courseDebut;
            const restant = Math.max(0, state.config.duree - elapsed);
            const min = Math.floor(restant / 60);
            const sec = Math.floor(restant % 60);
            chronoEl.textContent = `${min}:${String(sec).padStart(2, '0')}`;
        }
    }

    // ---------- Phase PAUSE ----------
    const pauseEl = document.getElementById('dmf-chrono-pause');
    if (pauseEl && state.timestampDebut && state.config) {
        const elapsedTotal = (Date.now() - state.timestampDebut) / 1000;
        const pauseDebut = state.config.duree + (state.courseNum - 1) * (state.config.duree + state.config.pause);
        const elapsedPause = elapsedTotal - pauseDebut;
        const restant = Math.max(0, state.config.pause - elapsedPause);
        const min = Math.floor(restant / 60);
        const sec = Math.floor(restant % 60);
        pauseEl.textContent = `${min}:${String(sec).padStart(2, '0')}`;
    }
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
        tickInterval: null, uiRefreshInterval: null, bilanCodeActif: null
    };
}