// src/js/modules/demi-fond/variantes/enchainement/enchainement-kiosk.js
// Kiosque observateur — Enchaînement (séries à durées variables).

import { db, ref, onValue, set } from '../../../../core/firebase-service.js';
import { COULEURS_GROUPES, getCouleurGroupe, getBasePath } from '../../demifond-common.js';
import { calculerPhaseActive, construirePlan } from './enchainement-core.js';

let state = {
    classe: '', couleur: null, config: null, sequence: null,
    codes: [], timestampsParEleve: {}, partielsParEleve: {}, abandonsParEleve: {}, lastClickAt: {},
    phase: 'choix', courseNum: 1, timestampDebut: null, derniereCourseEnvoyee: 0,
    dernierClic: null, feedbackMsg: null, feedbackTimeout: null,
    modaleAbandon: false, modaleAbandonCode: null,
    audioCtx: null, tickInterval: null, uiRefreshInterval: null, bilanCodeActif: null
};
let configListener = null;
let sequenceListener = null;

export function initEnchainementKiosk(classe) {
    state.classe = classe; state.couleur = null; state.phase = 'choix'; state.courseNum = 1;
    state.timestampsParEleve = {}; state.partielsParEleve = {}; state.abandonsParEleve = {}; state.lastClickAt = {};
    state.dernierClic = null; state.derniereCourseEnvoyee = 0; state.timestampDebut = null;

    const container = document.getElementById('demi-fond-module');
    if (!container) return;

    const basePath = getBasePath(classe);
    if (configListener) configListener();
    configListener = onValue(ref(db, `${basePath}/config`), (snap) => { state.config = snap.val() || null; render(); });

    if (sequenceListener) sequenceListener();
    sequenceListener = onValue(ref(db, `${basePath}/commandes/sequence`), (snap) => {
        const seq = snap.val();
        if (!seq) return;
        const ancienneAction = state.sequence?.actionTimestamp;
        state.sequence = seq;
        if (seq.actionTimestamp && seq.actionTimestamp !== ancienneAction) {
            state.timestampDebut = seq.timestampDebut;
            if (seq.etat === 'termine') { state.phase = 'bilan'; render(); return; }
            if (seq.etat === 'pause_manuelle') { state.phase = 'pause_manuelle'; render(); return; }
            if (seq.action === 'go' || seq.action === 'skip') {
                state.timestampsParEleve = {}; state.partielsParEleve = {}; state.abandonsParEleve = {}; state.lastClickAt = {}; state.dernierClic = null; state.derniereCourseEnvoyee = 0;
                state.codes.forEach(code => { state.timestampsParEleve[code] = []; });
            }
            if (state.couleur) { state.phase = '__tick__'; tick(); render(); }
            return;
        }
        if (seq.etat === 'termine' && state.phase !== 'bilan') { state.phase = 'bilan'; render(); }
    });

    if (state.tickInterval) clearInterval(state.tickInterval);
    state.tickInterval = setInterval(tick, 500);
    if (state.uiRefreshInterval) clearInterval(state.uiRefreshInterval);
    state.uiRefreshInterval = setInterval(refreshButtons, 200);
    render();
    return cleanupEnchainementKiosk;
}

function tick() {
    if (!state.timestampDebut || !state.config) return;
    if (state.phase === 'pause_manuelle' || state.phase === 'bilan') return;
    const elapsed = (Date.now() - state.timestampDebut) / 1000;
    const phaseInfo = calculerPhaseActive(elapsed, state.config);

    let phase, courseNum;
    if (phaseInfo.type === 'termine') { phase = 'saisie_finale'; courseNum = state.config.durees.length; }
    else if (phaseInfo.type === 'course') { phase = 'course'; courseNum = phaseInfo.courseNum; }
    else { phase = 'pause'; courseNum = phaseInfo.courseNum; }

    if (state.phase !== phase || state.courseNum !== courseNum) {
        const anciennePhase = state.phase, ancienneCourse = state.courseNum;
        if (anciennePhase === 'course' && phase === 'pause') envoyerResultatsCourse(ancienneCourse);
        if (anciennePhase === 'pause' && phase === 'course' && courseNum !== ancienneCourse) preparerNouvelleCourse(courseNum);
        state.phase = phase; state.courseNum = courseNum;
        render();
    }
}

function preparerNouvelleCourse() {
    state.timestampsParEleve = {}; state.partielsParEleve = {}; state.abandonsParEleve = {}; state.lastClickAt = {}; state.dernierClic = null;
    state.codes.forEach(code => { state.timestampsParEleve[code] = []; });
}

async function envoyerResultatsCourse(courseNum) {
    if (state.derniereCourseEnvoyee >= courseNum) return;
    state.derniereCourseEnvoyee = courseNum;
    const basePath = getBasePath(state.classe);
    const duree = state.config.durees[courseNum - 1] || state.config.duree;
    try {
        for (const code of state.codes) {
            const timestamps = state.timestampsParEleve[code] || [];
            const partiel = state.partielsParEleve[code] || 0;
            const abandon = state.abandonsParEleve[code] || null;
            if (timestamps.length === 0 && !abandon && !partiel) continue;
            await set(ref(db, `${basePath}/observations/course-${courseNum}/${code}`), {
                timestamps: timestamps.map(t => t - state.timestampDebut),
                partiel, abandon,
                duree, tour: state.config.tour, plots: state.config.plots, timestamp: Date.now()
            });
        }
        console.log(`[Enchainement] Résultats série ${courseNum} envoyés`);
    } catch (err) { console.error(err); }
}

function render() {
    const container = document.getElementById('demi-fond-module');
    if (!container) return;
    if (!state.config) { container.innerHTML = `<div class="text-center py-10 text-slate-400"><p class="text-xl">⏳ En attente de la configuration du professeur...</p></div>`; return; }
    if (state.modaleAbandon) { renderModaleAbandon(container); return; }
    switch (state.phase) {
        case 'choix': renderChoixCouleur(container); break;
        case 'attente': renderAttente(container); break;
        case 'course': renderCourse(container); break;
        case 'pause': renderPause(container); break;
        case 'saisie_finale': renderSaisieFinale(container); break;
        case 'pause_manuelle': renderPauseManuelle(container); break;
        case 'bilan': renderBilan(container); break;
        default: renderChoixCouleur(container);
    }
}

function renderChoixCouleur(container) {
    const couleursDispo = COULEURS_GROUPES.filter(c => (state.config?.groupes?.[c.id] || []).length > 0);
    let html = `<div class="max-w-2xl mx-auto text-center"><div class="py-6"><h1 class="text-3xl font-black text-white mb-2">🏃 1/2 Fond</h1><p class="text-slate-400">Choisis ta couleur d'observateur</p></div><div class="grid grid-cols-2 gap-4">`;
    couleursDispo.forEach(c => {
        const nb = (state.config.groupes[c.id] || []).length;
        html += `<button onclick="window.enchainementKioskChoixCouleur('${c.id}')" class="p-10 rounded-3xl font-black text-2xl active:scale-95 transition-all shadow-2xl" style="background:${c.bg};color:${c.text};border:4px solid ${c.border};">${c.label}<div class="text-sm font-normal opacity-80 mt-2">${nb} élève(s)</div></button>`;
    });
    html += `</div><button onclick="window.retourMenuDemiFond()" class="w-full mt-6 bg-slate-700 py-3 rounded-2xl font-black text-sm text-white">← Retour au menu général</button></div>`;
    container.innerHTML = html;
}

window.enchainementKioskChoixCouleur = function(couleurId) { state.couleur = couleurId; state.codes = state.config?.groupes?.[couleurId] || []; state.phase = 'attente'; initAudioContext(); render(); };

function renderAttente(container) {
    const couleur = getCouleurGroupe(state.couleur);
    container.innerHTML = `<div class="min-h-[60vh] flex flex-col items-center justify-center p-8" style="background:${couleur.bg}15;"><div class="text-8xl mb-6 animate-pulse">⏳</div><h2 class="text-3xl font-black text-white mb-3">En attente du signal</h2><p class="text-slate-300 mb-8">Groupe <span style="color:${couleur.bg}" class="font-black">${couleur.label}</span></p><button onclick="window.enchainementKioskRetourChoixCouleur()" class="mt-8 bg-slate-700 px-6 py-3 rounded-2xl font-black text-xs uppercase text-white">← Changer de couleur</button></div>`;
}
window.enchainementKioskRetourChoixCouleur = function() { state.couleur = null; state.codes = []; state.phase = 'choix'; render(); };

function renderCourse(container) {
    const couleur = getCouleurGroupe(state.couleur);
    const duree = state.config.durees[state.courseNum - 1] || 300;
    const { plan } = construirePlan(state.config);
    const coursePhase = plan.find(p => p.type === 'course' && p.index === state.courseNum);
    const elapsedTotal = (Date.now() - state.timestampDebut) / 1000;
    const elapsed = elapsedTotal - (coursePhase?.debut || 0);
    const restant = Math.max(0, duree - elapsed);
    const min = Math.floor(restant / 60), sec = Math.floor(restant % 60);

    const nbCodes = state.codes.length;
    let cols = nbCodes <= 6 ? 3 : (nbCodes <= 12 ? 4 : 5);
    let gridHtml = '';
    state.codes.forEach(code => {
        const nb = (state.timestampsParEleve[code] || []).length;
        const lastClick = state.lastClickAt[code] || 0;
        const ecoule = Date.now() - lastClick;
        const antiClic = state.config.antiDoubleClic || 30000;
        const bloqué = ecoule < antiClic;
        const restantSec = bloqué ? Math.ceil((antiClic - ecoule) / 1000) : 0;
        let btnStyle = '', disabled = '';
        if (state.abandonsParEleve[code]) { btnStyle = 'background:#7f1d1d;color:#fca5a5;border-color:#991b1b;opacity:0.5;'; disabled = 'disabled'; }
        else if (bloqué) { btnStyle = `background:${couleur.bg}40;color:#ffffff80;border-color:${couleur.border}40;`; disabled = 'disabled'; }
        else { btnStyle = `background:${couleur.bg};color:${couleur.text};border-color:${couleur.border};`; }
        gridHtml += `<button id="ench-btn-${code}" ${disabled} onclick="window.enchainementKioskClickCoureur('${code}')" class="rounded-2xl font-black border-4 active:scale-95 transition-all flex flex-col items-center justify-center relative" style="${btnStyle} min-height:110px;"><span class="text-4xl">${code}</span><span class="text-xs opacity-70 mt-1">${nb} tour${nb>1?'s':''}</span>${state.abandonsParEleve[code]?'<span class="text-[10px] mt-1">🚫 ABANDON</span>':''}${bloqué&&!state.abandonsParEleve[code]?`<span class="text-[10px] mt-1">⏱ ${restantSec}s</span>`:''}</button>`;
    });
    container.innerHTML = `<div class="p-4" style="background:${couleur.bg}10;min-height:100vh;"><div class="flex justify-between items-center bg-slate-900/90 backdrop-blur p-4 rounded-2xl mb-3 border-2" style="border-color:${couleur.border};"><div><div class="text-[10px] uppercase text-slate-400">Groupe</div><div class="text-xl font-black" style="color:${couleur.bg};">${couleur.label}</div></div><div class="text-center"><div class="text-[10px] uppercase text-slate-400">Série ${state.courseNum} / ${state.config.durees.length}</div><div class="text-2xl font-black text-white">${state.codes.length} coureurs</div></div><div class="text-right"><div class="text-[10px] uppercase text-slate-400">Temps restant</div><div id="ench-chrono-restant" class="text-3xl font-mono font-black text-yellow-400">${min}:${String(sec).padStart(2,'0')}</div></div></div>${state.feedbackMsg?`<div class="text-center py-3 mb-3 bg-emerald-500 text-white rounded-2xl font-black text-2xl animate-pulse">${state.feedbackMsg}</div>`:''}<div class="grid gap-3 mb-3" style="grid-template-columns: repeat(${cols}, minmax(0,1fr));">${gridHtml}</div><div class="flex gap-2"><button onclick="window.enchainementKioskAnnulerDernier()" class="flex-1 bg-slate-700 py-4 rounded-2xl font-black text-white ${state.dernierClic?'':'opacity-40 cursor-not-allowed'}" ${state.dernierClic?'':'disabled'}>↩ Annuler dernier clic</button><button onclick="window.enchainementKioskOuvrirAbandon()" class="flex-1 bg-red-800 py-4 rounded-2xl font-black text-white">🚨 Abandon</button></div></div>`;
}

window.enchainementKioskClickCoureur = function(code) {
    if (state.phase !== 'course') return;
    if (state.abandonsParEleve[code]) return;
    const antiClic = state.config.antiDoubleClic || 30000;
    if (Date.now() - (state.lastClickAt[code] || 0) < antiClic) return;
    if (!state.timestampsParEleve[code]) state.timestampsParEleve[code] = [];
    const t = Date.now();
    state.timestampsParEleve[code].push(t); state.lastClickAt[code] = t; state.dernierClic = { code, timestamp: t };
    if (navigator.vibrate) navigator.vibrate(80);
    playBeep();
    state.feedbackMsg = `✓ ${code}`;
    if (state.feedbackTimeout) clearTimeout(state.feedbackTimeout);
    state.feedbackTimeout = setTimeout(() => { state.feedbackMsg = null; render(); }, 400);
    render();
};
window.enchainementKioskAnnulerDernier = function() { if (!state.dernierClic) return; const { code } = state.dernierClic; const arr = state.timestampsParEleve[code] || []; arr.pop(); state.timestampsParEleve[code] = arr; delete state.lastClickAt[code]; state.dernierClic = null; render(); };

window.enchainementKioskOuvrirAbandon = function() { state.modaleAbandon = true; state.modaleAbandonCode = null; render(); };
function renderModaleAbandon(container) {
    let contenu;
    if (!state.modaleAbandonCode) {
        contenu = `<div class="text-center"><h3 class="text-2xl font-black text-white mb-3">Qui abandonne ?</h3><div class="grid grid-cols-3 gap-3 mb-6">${state.codes.filter(c=>!state.abandonsParEleve[c]).map(code=>`<button onclick="window.enchainementKioskAbandonSelectCode('${code}')" class="bg-red-800 text-white font-black text-3xl py-6 rounded-2xl border-4 border-red-900">${code}</button>`).join('')}</div><button onclick="window.enchainementKioskFermerAbandon()" class="w-full bg-slate-700 py-3 rounded-2xl font-black text-white">Annuler</button></div>`;
    } else {
        contenu = `<div class="text-center"><h3 class="text-2xl font-black text-white mb-3">Élève ${state.modaleAbandonCode}</h3><div class="flex flex-col gap-3"><button onclick="window.enchainementKioskAbandonConfirmer('blessure')" class="bg-red-700 text-white font-black text-lg py-5 rounded-2xl">🩹 Blessure / Physique</button><button onclick="window.enchainementKioskAbandonConfirmer('mental')" class="bg-orange-700 text-white font-black text-lg py-5 rounded-2xl">🧠 Mental / Motivation</button><button onclick="window.enchainementKioskRetourChoixCodeAbandon()" class="bg-slate-700 py-3 rounded-2xl font-black text-white">← Retour</button></div></div>`;
    }
    container.innerHTML = `<div class="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-6"><div class="bg-slate-900 p-6 rounded-3xl border-4 border-red-700 max-w-md w-full">${contenu}</div></div>`;
}
window.enchainementKioskAbandonSelectCode = function(code) { state.modaleAbandonCode = code; render(); };
window.enchainementKioskRetourChoixCodeAbandon = function() { state.modaleAbandonCode = null; render(); };
window.enchainementKioskAbandonConfirmer = function(raison) { const code = state.modaleAbandonCode; if (!code) return; state.abandonsParEleve[code] = raison; state.modaleAbandon = false; state.modaleAbandonCode = null; render(); };
window.enchainementKioskFermerAbandon = function() { state.modaleAbandon = false; state.modaleAbandonCode = null; render(); };

function renderPause(container) {
    const couleur = getCouleurGroupe(state.couleur);
    const { plan } = construirePlan(state.config);
    const pausePhase = plan.find(p => p.type === 'pause' && p.index === state.courseNum);
    const elapsedTotal = (Date.now() - state.timestampDebut) / 1000;
    const restant = Math.max(0, (pausePhase?.debut || 0) + (pausePhase?.duree || 0) - elapsedTotal);
    const min = Math.floor(restant / 60), sec = Math.floor(restant % 60);
    const elevesActifs = state.codes.filter(c => !state.abandonsParEleve[c]);
    let html = `<div class="p-4" style="background:${couleur.bg}10;min-height:100vh;"><div class="flex justify-between items-center bg-slate-900/90 p-4 rounded-2xl mb-4 border-2" style="border-color:${couleur.border};"><div><div class="text-[10px] uppercase text-slate-400">Pause</div><div class="text-xl font-black text-white">Série ${state.courseNum} terminée</div></div><div class="text-right"><div class="text-[10px] uppercase text-slate-400">Reprise dans</div><div id="ench-chrono-pause" class="text-3xl font-mono font-black text-yellow-400">${min}:${String(sec).padStart(2,'0')}</div></div></div><div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 mb-4"><h3 class="font-black text-white text-lg mb-1">📝 Saisie des plots partiels</h3><div class="space-y-3">`;
    elevesActifs.forEach(code => {
        const nbTours = (state.timestampsParEleve[code] || []).length;
        const partiel = state.partielsParEleve[code] || 0;
        html += `<div class="bg-slate-900 p-3 rounded-xl border border-slate-700"><div class="flex justify-between items-center mb-2"><div><span class="font-black text-2xl" style="color:${couleur.bg};">${code}</span><span class="text-xs text-slate-400 ml-2">${nbTours} tour${nbTours>1?'s':''}</span></div><div class="flex items-center gap-2"><span class="text-xs text-slate-400">Partiel :</span><span class="text-xl font-black text-white">${partiel}</span></div></div><div class="flex gap-1">${[0,1,2,3,4,5,6,7,8].map(n=>`<button onclick="window.enchainementKioskSetPartiel('${code}',${n})" class="flex-1 py-2 rounded-lg font-black text-sm border-2 ${partiel===n?'bg-blue-600 text-white border-blue-400':'bg-slate-800 text-slate-300 border-slate-700'}">${n}</button>`).join('')}</div></div>`;
    });
    html += `</div></div></div>`;
    container.innerHTML = html;
}

function renderSaisieFinale(container) {
    const couleur = getCouleurGroupe(state.couleur);
    const elevesActifs = state.codes.filter(c => !state.abandonsParEleve[c]);
    let html = `<div class="p-4" style="background:${couleur.bg}10;min-height:100vh;"><div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 mb-4"><h3 class="font-black text-white text-lg mb-1">📝 Saisie des plots partiels — Dernière série</h3><div class="space-y-3">`;
    elevesActifs.forEach(code => {
        const nbTours = (state.timestampsParEleve[code] || []).length;
        const partiel = state.partielsParEleve[code] || 0;
        html += `<div class="bg-slate-900 p-3 rounded-xl border border-slate-700"><div class="flex justify-between items-center mb-2"><div><span class="font-black text-2xl" style="color:${couleur.bg};">${code}</span><span class="text-xs text-slate-400 ml-2">${nbTours} tour${nbTours>1?'s':''}</span></div></div><div class="flex gap-1">${[0,1,2,3,4,5,6,7,8].map(n=>`<button onclick="window.enchainementKioskSetPartiel('${code}',${n})" class="flex-1 py-2 rounded-lg font-black text-sm border-2 ${partiel===n?'bg-blue-600 text-white border-blue-400':'bg-slate-800 text-slate-300 border-slate-700'}">${n}</button>`).join('')}</div></div>`;
    });
    html += `</div></div><button onclick="window.enchainementKioskTerminerSequence()" class="w-full bg-emerald-600 py-5 rounded-2xl font-black text-xl text-white">✅ Voir les bilans</button></div>`;
    container.innerHTML = html;
}

window.enchainementKioskSetPartiel = function(code, valeur) { state.partielsParEleve[code] = valeur; render(); };
window.enchainementKioskTerminerSequence = async function() { await envoyerResultatsCourse(state.config.durees.length); state.phase = 'bilan'; render(); };

function renderPauseManuelle(container) {
    const couleur = getCouleurGroupe(state.couleur);
    container.innerHTML = `<div class="min-h-[60vh] flex flex-col items-center justify-center p-8" style="background:${couleur.bg}15;"><div class="text-7xl mb-6">⏸️</div><h2 class="text-3xl font-black text-white mb-3">Pause manuelle</h2><p class="text-slate-300">Le prof a mis la séquence en pause.</p></div>`;
}

function renderBilan(container) {
    const couleur = getCouleurGroupe(state.couleur);
    if (state.bilanCodeActif) { renderBilanEleve(container, state.bilanCodeActif); return; }
    let html = `<div class="p-4" style="background:${couleur.bg}10;min-height:100vh;"><div class="text-center py-4 mb-4"><div class="text-6xl mb-2">🏆</div><h2 class="text-3xl font-black text-white mb-1">Séquence terminée !</h2><p class="text-slate-300">Clique sur un numéro pour afficher son bilan</p></div><div class="grid grid-cols-3 gap-3 mb-4">`;
    state.codes.forEach(code => {
        const abandon = state.abandonsParEleve[code];
        const bgStyle = abandon ? 'background:#7f1d1d;color:#fca5a5;border-color:#991b1b;' : `background:${couleur.bg};color:${couleur.text};border-color:${couleur.border};`;
        html += `<button onclick="window.enchainementKioskAfficherBilan('${code}')" class="rounded-2xl font-black border-4 active:scale-95" style="${bgStyle} min-height:100px;"><span class="text-4xl">${code}</span>${abandon?'<div class="text-[10px] mt-1">🚫 ABANDON</div>':''}</button>`;
    });
    html += `</div><button onclick="window.retourMenuDemiFond()" class="w-full bg-slate-700 py-3 rounded-2xl font-black text-sm uppercase text-white">← Quitter</button></div>`;
    container.innerHTML = html;
}
window.enchainementKioskAfficherBilan = function(code) { state.bilanCodeActif = code; render(); };
window.enchainementKioskBilanRetour = function() { state.bilanCodeActif = null; render(); };

async function renderBilanEleve(container, code) {
    const couleur = getCouleurGroupe(state.couleur);
    container.innerHTML = `<div class="p-8 text-center" style="background:${couleur.bg}10;min-height:100vh;"><div class="text-4xl animate-pulse mt-20">⏳</div><p class="text-slate-300 mt-4">Chargement du bilan...</p></div>`;
    try {
        const { chargerObservations, calculerBilan, rendreBilanHTML } = await import('./enchainement-bilan.js');
        const observations = await chargerObservations(state.classe, code, state.config.durees.length);
        const vma = state.config?.vmaParCode?.[code] || null;
        const sexe = state.config?.sexesParCode?.[code] || null;
        const bilan = calculerBilan(observations, state.config, vma, sexe);
        bilan.code = code;
        container.innerHTML = `<div class="p-4" style="background:${couleur.bg}10;min-height:100vh;">${rendreBilanHTML(bilan, state.couleur)}</div>`;
    } catch (err) {
        container.innerHTML = `<div class="p-8 text-center" style="background:${couleur.bg}10;min-height:100vh;"><div class="text-4xl mt-20">❌</div><p class="text-red-400 mt-4">Erreur bilan</p><button onclick="window.enchainementKioskBilanRetour()" class="mt-6 bg-slate-700 px-6 py-3 rounded-2xl font-black text-white">← Retour</button></div>`;
    }
}

function refreshButtons() {
    if (state.phase === 'course' && state.config) {
        const antiClic = state.config.antiDoubleClic || 30000;
        const couleur = getCouleurGroupe(state.couleur);
        state.codes.forEach(code => {
            const btn = document.getElementById(`ench-btn-${code}`);
            if (!btn) return;
            const ecoule = Date.now() - (state.lastClickAt[code] || 0);
            const bloqué = ecoule < antiClic;
            if (state.abandonsParEleve[code]) return;
            const spans = btn.querySelectorAll('span');
            const dernier = spans[spans.length - 1];
            if (!dernier) return;
            if (bloqué) { const restantSec = Math.ceil((antiClic - ecoule) / 1000); if (dernier.textContent.startsWith('⏱')) dernier.textContent = `⏱ ${restantSec}s`; }
            else { if (dernier.textContent.startsWith('⏱')) { const nb = (state.timestampsParEleve[code] || []).length; dernier.textContent = `${nb} tour${nb>1?'s':''}`; } if (btn.disabled) { btn.disabled = false; btn.style.cssText = `background:${couleur.bg};color:${couleur.text};border-color:${couleur.border};min-height:110px;`; } }
        });
        const chronoEl = document.getElementById('ench-chrono-restant');
        if (chronoEl && state.timestampDebut) {
            const duree = state.config.durees[state.courseNum - 1] || 300;
            const { plan } = construirePlan(state.config);
            const coursePhase = plan.find(p => p.type === 'course' && p.index === state.courseNum);
            const elapsedTotal = (Date.now() - state.timestampDebut) / 1000;
            const restant = Math.max(0, duree - (elapsedTotal - (coursePhase?.debut || 0)));
            const m = Math.floor(restant / 60), s = Math.floor(restant % 60);
            chronoEl.textContent = `${m}:${String(s).padStart(2,'0')}`;
        }
    }
}

function initAudioContext() { if (state.audioCtx) return; try { state.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
function playBeep() { if (!state.audioCtx) return; try { if (state.audioCtx.state === 'suspended') state.audioCtx.resume(); const osc = state.audioCtx.createOscillator(); const gain = state.audioCtx.createGain(); osc.type = 'sine'; osc.frequency.value = 900; gain.gain.setValueAtTime(0.15, state.audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, state.audioCtx.currentTime + 0.1); osc.connect(gain); gain.connect(state.audioCtx.destination); osc.start(); osc.stop(state.audioCtx.currentTime + 0.1); } catch (e) {} }

window.retourMenuDemiFond = function() { cleanupEnchainementKiosk(); const container = document.getElementById('demi-fond-module'); if (container) { container.innerHTML = ''; container.classList.add('hidden'); } if (typeof window.resetToLogin === 'function') window.resetToLogin(); };

export function cleanupEnchainementKiosk() {
    if (configListener) { configListener(); configListener = null; }
    if (sequenceListener) { sequenceListener(); sequenceListener = null; }
    if (state.tickInterval) { clearInterval(state.tickInterval); state.tickInterval = null; }
    if (state.uiRefreshInterval) { clearInterval(state.uiRefreshInterval); state.uiRefreshInterval = null; }
    if (state.feedbackTimeout) { clearTimeout(state.feedbackTimeout); state.feedbackTimeout = null; }
}