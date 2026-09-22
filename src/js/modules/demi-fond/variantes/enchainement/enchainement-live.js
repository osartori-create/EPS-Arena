// src/js/modules/demi-fond/variantes/enchainement/enchainement-live.js
// Live prof : vue temps réel par couleur + détail par élève (séries variables).

import { db, ref, onValue } from '../../../../core/firebase-service.js';
import { getCurrentClasse, getLocalMapping } from '../../../../core/live-engine.js';
import { getPhotoUrl, getExistingEleves } from '../../../../services/admin-service.js';
import { COULEURS_GROUPES, getBasePath, getVMAEleve } from '../../demifond-common.js';
import { calculerDistance, calculerVitesse, calculerPhaseActive } from './enchainement-core.js';

let unsubs = [];
let cache = null;
let _chronoTimer = null;

export function renderEnchainementLive() {
    const container = document.getElementById('live-content');
    if (!container) return;

    const classe = getCurrentClasse();
    if (!classe) { container.innerHTML = '<p class="text-slate-500 text-center">Sélectionnez une classe.</p>'; return; }

    unsubs.forEach(u => { try { u(); } catch (e) {} });
    unsubs = [];

    const nbCourses = 6; // plafond d'écoute (on écoute course-1..6, config pilote le réel)
    cache = {
        classe,
        config: null,
        sequence: null,
        observations: {},
        eleves: getExistingEleves(classe),
        mapping: getLocalMapping(classe) || {}
    };

    const basePath = getBasePath(classe);
    const total = 2 + nbCourses;
    let ready = 0;
    function checkReady() { ready++; if (ready >= total) render(); }

    unsubs.push(onValue(ref(db, `${basePath}/config`), snap => { cache.config = snap.val(); checkReady(); }));
    unsubs.push(onValue(ref(db, `${basePath}/commandes/sequence`), snap => { cache.sequence = snap.val(); checkReady(); }));
    for (let i = 1; i <= nbCourses; i++) {
        unsubs.push(onValue(ref(db, `${basePath}/observations/course-${i}`), snap => {
            cache.observations[`course${i}`] = snap.val() || {};
            if (ready >= total) render(); else checkReady();
        }));
    }

    return () => { unsubs.forEach(u => { try { u(); } catch (e) {} }); unsubs = []; if (_chronoTimer) clearInterval(_chronoTimer); };
}

function render() {
    const container = document.getElementById('live-content');
    if (!container) return;
    const { config, sequence, observations, eleves, mapping, classe } = cache;
    if (!config) { container.innerHTML = '<p class="text-slate-500 text-center py-8">⏳ En attente de la configuration...</p>'; return; }

    const nbCourses = (config.durees || []).length;
    const phaseInfo = getPhaseInfo(sequence, config);

    let html = `
        <div class="bg-slate-800 p-4 rounded-2xl border-2 border-blue-500/40 mb-4">
            <div class="flex justify-between items-center flex-wrap gap-3">
                <div><div class="text-[10px] uppercase text-slate-400 font-bold">Phase actuelle</div><div class="text-xl font-black text-white">${phaseInfo.label}</div></div>
                <div class="text-center"><div class="text-[10px] uppercase text-slate-400 font-bold">État</div><div class="text-lg font-black">${sequence?.etat || 'idle'}</div></div>
                <div class="text-right"><div class="text-[10px] uppercase text-slate-400 font-bold">Temps restant</div><div class="text-3xl font-mono font-black text-yellow-400" id="ench-live-chrono">${phaseInfo.restant}</div></div>
            </div>
        </div>
    `;

    html += `<div class="space-y-4">`;
    COULEURS_GROUPES.forEach(couleur => {
        const codes = config.groupes?.[couleur.id] || [];
        if (codes.length === 0) return;
        html += `<div class="bg-slate-900 rounded-2xl border-2 overflow-hidden" style="border-color:${couleur.border};"><div class="px-4 py-2 font-black text-sm uppercase flex justify-between items-center" style="background:${couleur.bg};color:${couleur.text};"><span>${couleur.label}</span><span class="text-xs opacity-80">${codes.length} élève(s)</span></div><div class="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">`;
        codes.forEach(code => { html += renderEleveCard(code, couleur, observations, config, eleves, mapping, nbCourses); });
        html += `</div></div>`;
    });
    html += `</div>`;

    container.innerHTML = html;
    demarrerChrono();
    chargerPhotos();
}

function renderEleveCard(code, couleur, observations, config, eleves, mapping, nbCourses) {
    const eleveId = mapping[`${cache.classe}_${couleur.id}_${code}`];
    const eleve = eleves.find(e => e.id === eleveId);
    const vma = eleve ? getVMAEleve(cache.classe, eleve.id) : null;

    const cours = [];
    let distanceTotale = 0, vitesseSum = 0, nbTerminees = 0;
    for (let n = 1; n <= nbCourses; n++) {
        const obs = observations[`course${n}`]?.[String(code)];
        const duree = config.durees[n - 1];
        if (!obs) { cours.push(null); continue; }
        const distance = calculerDistance(obs.timestamps || [], obs.partiel || 0, config.tour, config.plots);
        const vitesse = obs.abandon ? 0 : calculerVitesse(distance, duree);
        distanceTotale += distance;
        if (!obs.abandon) { vitesseSum += vitesse; nbTerminees++; }
        cours.push({ distance: Math.round(distance), vitesse, abandon: obs.abandon });
    }
    const vitesseMoyenne = nbTerminees > 0 ? vitesseSum / nbTerminees : 0;
    const abandonne = cours.some(c => c?.abandon);

    let coursHtml = '<div class="grid grid-cols-3 gap-1 mb-0.5">';
    cours.forEach((c, i) => {
        if (!c) coursHtml += `<div class="text-center p-1 rounded bg-slate-800"><div class="text-[9px] text-slate-500">S${i+1}</div><div class="text-xs text-slate-500">—</div></div>`;
        else if (c.abandon) coursHtml += `<div class="text-center p-1 rounded bg-red-900/40"><div class="text-[9px] text-red-400">S${i+1}</div><div class="text-xs text-red-300">🚫</div></div>`;
        else coursHtml += `<div class="text-center p-1 rounded bg-slate-800"><div class="text-[9px] text-slate-400">S${i+1}</div><div class="text-xs font-black" style="color:${couleur.bg};">${c.vitesse.toFixed(1)}</div><div class="text-[9px] text-slate-500">${c.distance}m</div></div>`;
    });
    coursHtml += '</div>';

    return `<div class="bg-slate-800 p-2 rounded-xl border ${abandonne ? 'border-red-700/60' : 'border-slate-700'} flex items-center gap-2"><div id="ench-live-photo-${code}" class="w-10 h-10 rounded-full overflow-hidden bg-slate-700 flex items-center justify-center">👤</div><div class="flex-1 min-w-0"><div class="flex justify-between mb-0.5"><span class="font-black text-white text-xs">${eleve ? eleve.prenom + ' ' + eleve.nom : '?'}</span><span class="text-[10px]" style="color:${couleur.bg};">#${code}</span></div>${coursHtml}<div class="flex justify-between text-[10px]"><span class="text-slate-400">Total <span class="text-white font-black">${Math.round(distanceTotale)} m</span></span><span class="text-slate-400">Moy <span class="text-yellow-400 font-black">${vitesseMoyenne.toFixed(1)} km/h</span></span>${vma ? `<span class="text-slate-400">VMA <span class="text-emerald-400">${vma}</span></span>` : ''}</div></div></div>`;
}

function getPhaseInfo(sequence, config) {
    if (!sequence || !sequence.timestampDebut || sequence.etat === 'idle') return { label: '—', restant: '--:--' };
    if (sequence.etat === 'termine') return { label: '🏆 Terminé', restant: '--:--' };
    if (sequence.etat === 'pause_manuelle') return { label: '⏸️ Pause manuelle', restant: '--:--' };
    const elapsed = (Date.now() - sequence.timestampDebut) / 1000;
    const phase = calculerPhaseActive(elapsed, config);
    if (phase.type === 'termine') return { label: '🏆 Terminé', restant: '--:--' };
    const label = phase.type === 'course' ? `🏃 Série ${phase.courseNum}` : `⏸️ Pause ${phase.courseNum}`;
    const m = Math.floor(phase.restant / 60), s = Math.floor(phase.restant % 60);
    return { label, restant: `${m}:${String(s).padStart(2, '0')}` };
}

function demarrerChrono() {
    if (_chronoTimer) clearInterval(_chronoTimer);
    _chronoTimer = setInterval(() => {
        const el = document.getElementById('ench-live-chrono');
        if (!el || !cache.config || !cache.sequence) return;
        el.textContent = getPhaseInfo(cache.sequence, cache.config).restant;
    }, 500);
}

async function chargerPhotos() {
    const { mapping, eleves, classe, config } = cache;
    if (!config) return;
    const promises = [];
    COULEURS_GROUPES.forEach(couleur => {
        const codes = config.groupes?.[couleur.id] || [];
        codes.forEach(code => {
            const eleveId = mapping[`${classe}_${couleur.id}_${code}`];
            const container = document.getElementById(`ench-live-photo-${code}`);
            if (!eleveId || !container) return;
            promises.push(getPhotoUrl(eleveId).then(url => { if (url && container) container.innerHTML = `<img src="${url}" class="w-full h-full object-cover rounded-full">`; }).catch(() => {}));
        });
    });
    await Promise.all(promises);
}