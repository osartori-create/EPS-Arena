// src/js/modules/demi-fond/variantes/trois-cinq-min/trois-cinq-min-live.js
// Live prof : vue temps réel par couleur + détail par élève

import { db, ref, onValue } from '../../../../core/firebase-service.js';
import { getCurrentClasse, getLocalMapping } from '../../../../core/live-engine.js';
import { getPhotoUrl, getExistingEleves } from '../../../../services/admin-service.js';
import { COULEURS_GROUPES, getCouleurGroupe, getBasePath, getVMAEleve } from '../../demifond-common.js';
import { calculerDistance, calculerVitesse, calculerRegularite } from './trois-cinq-min-core.js';

let unsubs = [];
let cache = {
    classe: '',
    config: null,
    sequence: null,
    observations: { course1: {}, course2: {}, course3: {} },
    eleves: [],
    mapping: {}
};

// ============================================================
// RENDU PRINCIPAL
// ============================================================
export function renderTroisCinqMinLive() {
    const container = document.getElementById('live-content');
    if (!container) return;

    const classe = getCurrentClasse();
    if (!classe) {
        container.innerHTML = '<p class="text-slate-500 text-center">Sélectionnez une classe.</p>';
        return;
    }

    // Cleanup
    unsubs.forEach(u => { try { u(); } catch (e) {} });
    unsubs = [];

    cache = {
        classe,
        config: null,
        sequence: null,
        observations: { course1: {}, course2: {}, course3: {} },
        eleves: getExistingEleves(classe),
        mapping: getLocalMapping(classe) || {}
    };

    const basePath = getBasePath(classe);

    // 4 listeners : config, sequence, 3 cours
    let ready = 0;
    const total = 5;

    function checkReady() {
        ready++;
        if (ready >= total) {
            render();
        }
    }

    unsubs.push(onValue(ref(db, `${basePath}/config`), snap => {
        cache.config = snap.val();
        checkReady();
    }));
    unsubs.push(onValue(ref(db, `${basePath}/commandes/sequence`), snap => {
        cache.sequence = snap.val();
        checkReady();
    }));

    for (let i = 1; i <= 3; i++) {
        unsubs.push(onValue(ref(db, `${basePath}/observations/course-${i}`), snap => {
            cache.observations[`course${i}`] = snap.val() || {};
            if (ready >= total) render();  // re-render si déjà prêt
            else checkReady();
        }));
    }

    return () => {
        unsubs.forEach(u => { try { u(); } catch (e) {} });
        unsubs = [];
    };
}

// ============================================================
// RENDU PRINCIPAL
// ============================================================
function render() {
    const container = document.getElementById('live-content');
    if (!container) return;

    const { config, sequence, observations, eleves, mapping, classe } = cache;

    if (!config) {
        container.innerHTML = '<p class="text-slate-500 text-center py-8">⏳ En attente de la configuration...</p>';
        return;
    }

    // ============================================================
    // BANDEAU SÉQUENCE
    // ============================================================
    const seqInfo = getSequenceInfo(sequence, config);

    let html = `
        <div class="bg-slate-800 p-4 rounded-2xl border-2 border-blue-500/40 mb-4">
            <div class="flex justify-between items-center flex-wrap gap-3">
                <div>
                    <div class="text-[10px] uppercase text-slate-400 font-bold">Phase actuelle</div>
                    <div class="text-xl font-black text-white">${seqInfo.label}</div>
                </div>
                <div class="text-center">
                    <div class="text-[10px] uppercase text-slate-400 font-bold">État</div>
                    <div class="text-lg font-black ${seqInfo.etatColor}">${sequence?.etat || 'idle'}</div>
                </div>
                <div class="text-right">
                    <div class="text-[10px] uppercase text-slate-400 font-bold">Temps restant</div>
                    <div class="text-3xl font-mono font-black text-yellow-400" id="dmf-live-chrono">${seqInfo.restant}</div>
                </div>
            </div>
        </div>
    `;

    // ============================================================
    // STATS GLOBALES
    // ============================================================
    const stats = calculerStatsGlobales(observations, config, eleves, mapping);
    html += `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div class="bg-slate-800 p-3 rounded-2xl border border-slate-700 text-center">
                <div class="text-[10px] uppercase text-slate-400 font-bold">Élèves suivis</div>
                <div class="text-2xl font-black text-white">${stats.nbSuivis}</div>
            </div>
            <div class="bg-slate-800 p-3 rounded-2xl border border-slate-700 text-center">
                <div class="text-[10px] uppercase text-slate-400 font-bold">Abandons</div>
                <div class="text-2xl font-black ${stats.nbAbandons > 0 ? 'text-red-400' : 'text-emerald-400'}">${stats.nbAbandons}</div>
            </div>
            <div class="bg-slate-800 p-3 rounded-2xl border border-slate-700 text-center">
                <div class="text-[10px] uppercase text-slate-400 font-bold">Distance cumulée classe</div>
                <div class="text-2xl font-black text-blue-400">${stats.distanceTotale.toLocaleString('fr-FR')} m</div>
            </div>
            <div class="bg-slate-800 p-3 rounded-2xl border border-slate-700 text-center">
                <div class="text-[10px] uppercase text-slate-400 font-bold">Vitesse moyenne classe</div>
                <div class="text-2xl font-black text-yellow-400">${stats.vitesseMoyenne.toFixed(1)} <span class="text-sm">km/h</span></div>
            </div>
        </div>
    `;

    // ============================================================
    // VUE PAR COULEUR
    // ============================================================
    html += `<div class="space-y-4">`;

    COULEURS_GROUPES.forEach(couleur => {
        const codes = config.groupes?.[couleur.id] || [];
        if (codes.length === 0) return;

        html += `
            <div class="bg-slate-900 rounded-2xl border-2 overflow-hidden" style="border-color:${couleur.border};">
                <div class="px-4 py-2 font-black text-sm uppercase flex justify-between items-center"
                     style="background:${couleur.bg}; color:${couleur.text};">
                    <span>${couleur.label}</span>
                    <span class="text-xs opacity-80">${codes.length} élève(s)</span>
                </div>
                <div class="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        `;

        codes.forEach(code => {
            html += renderEleveCard(code, couleur, observations, config, eleves, mapping);
        });

        html += `</div></div>`;
    });

    html += `</div>`;

    container.innerHTML = html;

    // Lancer le timer pour le chrono
    demarrerChronoTimerLive();
}

// ============================================================
// CARTE ÉLÈVE
// ============================================================
function renderEleveCard(code, couleur, observations, config, eleves, mapping) {
    const eleveId = mapping[`${cache.classe}_${couleur.id}_${code}`];
    const eleve = eleves.find(e => e.id === eleveId);
    const vma = eleve ? getVMAEleve(cache.classe, eleve.id) : null;

    // Calculs
    const cours = [1, 2, 3].map(n => {
        const obs = observations[`course${n}`]?.[String(code)];
        if (!obs) return null;
        const distance = calculerDistance(obs.timestamps || [], obs.partiel || 0, config.tour, config.plots);
        const vitesse = obs.abandon ? 0 : calculerVitesse(distance, config.duree);
        return {
            distance: Math.round(distance),
            vitesse,
            abandon: obs.abandon,
            nbTours: (obs.timestamps || []).length,
            partiel: obs.partiel || 0
        };
    });

    const distanceTotale = cours.reduce((s, c) => s + (c?.distance || 0), 0);
    const coursTerminees = cours.filter(c => c && !c.abandon).length;
    const vitesseMoyenne = coursTerminees > 0
        ? cours.filter(c => c && !c.abandon).reduce((s, c) => s + c.vitesse, 0) / coursTerminees
        : 0;

    const abandonne = cours.some(c => c?.abandon);

    // Photo (asynchrone → on utilise une promise + innerHTML différé)
    const photoContainerId = `dmf-photo-${code}`;

    let coursHtml = '';
    for (let i = 0; i < 3; i++) {
        const c = cours[i];
        if (!c) {
            coursHtml += `
                <div class="text-center p-1 rounded bg-slate-800 border border-slate-700">
                    <div class="text-[9px] text-slate-500 font-bold">C${i + 1}</div>
                    <div class="text-xs text-slate-500">—</div>
                </div>
            `;
        } else if (c.abandon) {
            coursHtml += `
                <div class="text-center p-1 rounded bg-red-900/40 border border-red-700">
                    <div class="text-[9px] text-red-400 font-bold">C${i + 1}</div>
                    <div class="text-xs text-red-300 font-black">🚫</div>
                </div>
            `;
        } else {
            coursHtml += `
                <div class="text-center p-1 rounded bg-slate-800 border border-slate-700">
                    <div class="text-[9px] text-slate-400 font-bold">C${i + 1}</div>
                    <div class="text-xs font-black" style="color:${couleur.bg};">${c.vitesse.toFixed(1)}</div>
                    <div class="text-[9px] text-slate-500">${c.distance}m</div>
                </div>
            `;
        }
    }

    return `
        <div class="bg-slate-800 p-2 rounded-xl border ${abandonne ? 'border-red-700/60' : 'border-slate-700'} flex items-center gap-2">
            <div id="${photoContainerId}" class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-slate-700 flex items-center justify-center text-lg">
                <span>👤</span>
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-baseline mb-0.5">
                    <span class="font-black text-white text-xs truncate">${eleve ? eleve.prenom + ' ' + eleve.nom : '?'}</span>
                    <span class="text-[10px] font-black" style="color:${couleur.bg};">#${code}</span>
                </div>
                <div class="grid grid-cols-3 gap-1 mb-0.5">
                    ${coursHtml}
                </div>
                <div class="flex justify-between text-[10px]">
                    <span class="text-slate-400">Total : <span class="text-white font-black">${distanceTotale} m</span></span>
                    <span class="text-slate-400">Moy : <span class="text-yellow-400 font-black">${vitesseMoyenne.toFixed(1)} km/h</span></span>
                    ${vma ? `<span class="text-slate-400">VMA : <span class="text-emerald-400 font-black">${vma}</span></span>` : ''}
                </div>
            </div>
        </div>
    `;
}

// ============================================================
// CHARGEMENT ASYNCHRONE DES PHOTOS
// ============================================================
async function chargerPhotos() {
    const { mapping, eleves, classe, config } = cache;
    if (!config) return;

    const promises = [];

    COULEURS_GROUPES.forEach(couleur => {
        const codes = config.groupes?.[couleur.id] || [];
        codes.forEach(code => {
            const eleveId = mapping[`${classe}_${couleur.id}_${code}`];
            if (!eleveId) return;
            const containerId = `dmf-photo-${code}`;
            const container = document.getElementById(containerId);
            if (!container) return;

            promises.push(
                getPhotoUrl(eleveId).then(url => {
                    if (url && container) {
                        container.innerHTML = `<img src="${url}" class="w-full h-full object-cover rounded-full">`;
                    }
                }).catch(() => {})
            );
        });
    });

    await Promise.all(promises);
}

// Override du render pour charger les photos après
const _originalRender = render;
render = function() {
    _originalRender();
    setTimeout(() => chargerPhotos(), 50);
};

// ============================================================
// HELPERS
// ============================================================
function getSequenceInfo(sequence, config) {
    if (!sequence || !sequence.timestampDebut || sequence.etat === 'idle') {
        return { label: '—', restant: '--:--', etatColor: 'text-slate-400' };
    }

    if (sequence.etat === 'termine') {
        return { label: '🏆 Terminé', restant: '--:--', etatColor: 'text-emerald-400' };
    }

    if (sequence.etat === 'pause_manuelle') {
        return { label: '⏸️ Pause manuelle', restant: '--:--', etatColor: 'text-amber-400' };
    }

    const elapsed = (Date.now() - sequence.timestampDebut) / 1000;
    const duree = config.duree;
    const pause = config.pause;

    let label, restant, color;
    if (elapsed < duree) { label = '🏃 Course 1'; restant = duree - elapsed; color = 'text-blue-400'; }
    else if (elapsed < duree + pause) { label = '⏸️ Pause 1'; restant = duree + pause - elapsed; color = 'text-amber-400'; }
    else if (elapsed < 2 * duree + pause) { label = '🏃 Course 2'; restant = 2 * duree + pause - elapsed; color = 'text-blue-400'; }
    else if (elapsed < 2 * duree + 2 * pause) { label = '⏸️ Pause 2'; restant = 2 * duree + 2 * pause - elapsed; color = 'text-amber-400'; }
    else if (elapsed < 3 * duree + 2 * pause) { label = '🏃 Course 3'; restant = 3 * duree + 2 * pause - elapsed; color = 'text-blue-400'; }
    else { label = '🏆 Terminé'; restant = 0; color = 'text-emerald-400'; }

    const m = Math.floor(restant / 60);
    const s = Math.floor(restant % 60);
    return { label, restant: `${m}:${String(s).padStart(2, '0')}`, etatColor: color };
}

function calculerStatsGlobales(observations, config, eleves, mapping) {
    let nbSuivis = 0;
    let nbAbandons = 0;
    let distanceTotale = 0;
    let vitesseSum = 0;
    let nbVitesses = 0;

    Object.values(config.groupes || {}).flat().forEach(code => {
        const c1 = observations.course1?.[String(code)];
        const c2 = observations.course2?.[String(code)];
        const c3 = observations.course3?.[String(code)];
        if (!c1 && !c2 && !c3) return;

        nbSuivis++;

        [c1, c2, c3].forEach(obs => {
            if (!obs) return;
            if (obs.abandon) { nbAbandons++; return; }
            const distance = calculerDistance(obs.timestamps || [], obs.partiel || 0, config.tour, config.plots);
            const vitesse = calculerVitesse(distance, config.duree);
            distanceTotale += distance;
            vitesseSum += vitesse;
            nbVitesses++;
        });
    });

    return {
        nbSuivis,
        nbAbandons,
        distanceTotale: Math.round(distanceTotale),
        vitesseMoyenne: nbVitesses > 0 ? vitesseSum / nbVitesses : 0
    };
}

let _chronoTimer = null;
function demarrerChronoTimerLive() {
    if (_chronoTimer) clearInterval(_chronoTimer);
    _chronoTimer = setInterval(() => {
        const el = document.getElementById('dmf-live-chrono');
        if (!el || !cache.config || !cache.sequence) return;
        const info = getSequenceInfo(cache.sequence, cache.config);
        el.textContent = info.restant;
    }, 500);
}