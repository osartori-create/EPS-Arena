// src/js/modules/relais/relais-live.js
// Live prof : filtré par sousActivite

import { db, ref, onValue, remove } from '../../core/firebase-service.js';
import { getCurrentClasse, getLocalMapping } from '../../core/live-engine.js';
import { getPhotoUrl } from '../../services/admin-service.js';
import {
    calculerEfficaciteIndividuelle,
    calculerCompositionsEfficaces,
    calculerScoreEquipe,
    getMeilleurEssaiParPaire,
    getScoreCouleur,
    getScoreCouleurTransmission,
    getLabelTransmission
} from './relais-core.js';

let currentUnsubs = [];

export function renderRelaisLive() {
    const container = document.getElementById('live-content');
    if (!container) return;

    const classe = getCurrentClasse();
    if (!classe) {
        container.innerHTML = '<p class="text-slate-500 text-center">Sélectionnez une classe.</p>';
        return;
    }

    currentUnsubs.forEach(u => { try { u(); } catch (e) {} });
    currentUnsubs = [];

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const basePath = `etablissements/0680013V/profs/${profCode}/${classe}/relais`;

    let config = null, m10 = {}, m2z = {}, vitesses = {};
    let loaded = 0;

    function check() {
        if (loaded >= 4) {
            const mesures = (config?.sousActivite === 'relais2zones') ? m2z : m10;
            renderAll(container, classe, config, mesures, vitesses);
        }
    }

    currentUnsubs.push(onValue(ref(db, `${basePath}/config`), s => { config = s.val(); loaded++; check(); }, { onlyOnce: true }));
    currentUnsubs.push(onValue(ref(db, `${basePath}/mesures-10s`), s => { m10 = s.val() || {}; loaded++; check(); }));
    currentUnsubs.push(onValue(ref(db, `${basePath}/mesures-2zones`), s => { m2z = s.val() || {}; loaded++; check(); }));
    currentUnsubs.push(onValue(ref(db, `${basePath}/vitesses`), s => { vitesses = s.val() || {}; loaded++; check(); }));
}

function getEleveIdFromMapping(classe, groupeIdx, lettre) {
    const mapping = getLocalMapping(classe) || {};
    return mapping[`${classe}_${groupeIdx}_${lettre}`] || null;
}

function getNomComplet(classe, eleveId, fallback) {
    if (!eleveId) return fallback || '?';
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');
    const e = eleves.find(el => el.id === eleveId);
    return e ? `${e.prenom} ${e.nom}` : (fallback || eleveId);
}

async function renderAll(container, classe, config, mesures, vitesses) {
    if (!config || !config.groupes) {
        container.innerHTML = '<p class="text-slate-500 text-center">Configuration non transmise.</p>';
        return;
    }

    const is2Zones = config.sousActivite === 'relais2zones';
    const mesuresArray = Object.entries(mesures).map(([key, val]) => ({ ...val, _key: key }));

    const mode = config.mode || 'essai';
    const bannerHtml = mode === 'competition'
        ? `<div class="bg-yellow-500 text-black text-center font-black uppercase py-2 rounded-xl mb-4 text-sm">🏆 Mode compétition — ${is2Zones ? 'Relais 2 zones' : 'Relais 10s'}</div>`
        : `<div class="bg-emerald-500 text-white text-center font-black uppercase py-2 rounded-xl mb-4 text-sm">🌱 Mode essai — ${is2Zones ? 'Relais 2 zones' : 'Relais 10s'}</div>`;

    let html = bannerHtml;

    if (mesuresArray.length === 0) {
        html += '<p class="text-slate-500 text-center">Aucun essai enregistré pour l\'instant.</p>';
        container.innerHTML = html;
        window._relaisLiveData = { classe, config, mesures, vitesses };
        return;
    }

    // ============================================================
    // SYNTHÈSE PAR ÉQUIPE
    // ============================================================
    html += `<h3 class="font-black text-blue-400 uppercase text-sm mb-3">🏆 Synthèse par équipe <span class="text-slate-500 normal-case font-normal">(cliquez pour le détail)</span></h3>`;
    html += `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">`;

    const equipesData = [];
    for (const [idx, groupe] of Object.entries(config.groupes)) {
        const mg = mesuresArray.filter(m => String(m.groupeIdx) === String(idx));
        const meilleur = getMeilleurEssaiParPaire(mg);
        const scoreEquipe = calculerScoreEquipe(mg);
        const nbEssais = Object.keys(meilleur).length;
        const nbPaires = (groupe.membres.length) * (groupe.membres.length - 1);
        equipesData.push({ idx, groupe, mesuresGroupe: mg, scoreEquipe, nbEssais, nbPaires });
    }
    equipesData.sort((a, b) => b.scoreEquipe - a.scoreEquipe);

    for (let i = 0; i < equipesData.length; i++) {
        const eq = equipesData[i];
        const medaille = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : `${i + 1}.`));
        html += `
            <div onclick="window.openRelaisGroupeDetail('${eq.idx}')"
                 class="bg-slate-800 p-4 rounded-2xl border-2 border-slate-700 cursor-pointer hover:border-blue-500 transition-all active:scale-95">
                <div class="flex justify-between items-center mb-2">
                    <h4 class="font-black text-lg text-white">${medaille} Groupe ${eq.groupe.numero}</h4>
                    <span class="text-2xl font-black text-yellow-400">${eq.scoreEquipe.toFixed(1)}</span>
                </div>
                <p class="text-xs text-slate-400">${eq.nbEssais} / ${eq.nbPaires} paires mesurées</p>
                <div class="mt-2 text-xs text-slate-500">${eq.groupe.membres.map(m => m.lettre).join(' · ')}</div>
                <div class="mt-2 text-[10px] text-blue-400 font-bold">🔍 Voir le détail →</div>
            </div>
        `;
    }
    html += `</div>`;

    // ============================================================
    // APERÇU PAR ÉQUIPE
    // ============================================================
    html += `<h3 class="font-black text-blue-400 uppercase text-sm mb-3 mt-6">📊 Aperçu par équipe</h3><div class="space-y-4">`;

    for (const eq of equipesData) {
        const groupe = eq.groupe;
        const groupeIdx = eq.idx;
        const membres = groupe.membres;
        const efficacite = calculerEfficaciteIndividuelle(eq.mesuresGroupe, membres);
        const compositions = calculerCompositionsEfficaces(eq.mesuresGroupe);

        html += `<div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
            <div class="flex justify-between items-center mb-3">
                <h4 class="font-black text-white">Groupe ${groupe.numero}</h4>
                <button onclick="window.openRelaisGroupeDetail('${groupeIdx}')"
                        class="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded-lg font-black text-xs text-white">🔍 Détail</button>
            </div>`;

        // Efficacité individuelle
        html += `<div class="mb-4"><p class="text-xs font-bold text-slate-400 uppercase mb-2">Efficacité individuelle</p><div class="space-y-1">`;
        const effArray = Object.values(efficacite).filter(e => e.moyenneGlobale !== null).sort((a, b) => b.moyenneGlobale - a.moyenneGlobale);
        for (const eff of effArray) {
            const eleveId = getEleveIdFromMapping(classe, groupeIdx, eff.membre.lettre);
            const nomComplet = getNomComplet(classe, eleveId, eff.membre.lettre);
            const photoUrl = eleveId ? await getPhotoUrl(eleveId) : null;
            const photoHtml = photoUrl
                ? `<img src="${photoUrl}" class="w-7 h-7 rounded-full object-cover border border-slate-600">`
                : `<div class="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs">👤</div>`;
            const couleurGlobale = getScoreCouleur(eff.moyenneGlobale);
            html += `
                <div class="flex items-center gap-2 bg-slate-900 p-2 rounded-lg">
                    ${photoHtml}
                    <span class="text-xs font-black text-blue-400 w-6">${eff.membre.lettre}</span>
                    <span class="text-sm font-bold text-white flex-1">${nomComplet}</span>
                    <span class="text-[10px] text-slate-500">relayé:</span>
                    <span class="text-xs font-bold text-yellow-400 w-10 text-right">${eff.moyenneCommeRelaye !== null ? eff.moyenneCommeRelaye.toFixed(1) : '--'}</span>
                    <span class="text-[10px] text-slate-500">relayeur:</span>
                    <span class="text-xs font-bold text-cyan-400 w-10 text-right">${eff.moyenneCommeRelayeur !== null ? eff.moyenneCommeRelayeur.toFixed(1) : '--'}</span>
                    <span class="text-sm font-black px-2 py-0.5 rounded" style="background:${couleurGlobale}; color:white;">${eff.moyenneGlobale.toFixed(1)}</span>
                </div>`;
        }
        if (effArray.length === 0) html += `<p class="text-slate-500 text-xs italic">Aucune donnée</p>`;
        html += `</div></div>`;

        // Compositions
        if (compositions.length > 0) {
            html += `<div><p class="text-xs font-bold text-slate-400 uppercase mb-2">🎯 Compositions les plus efficaces</p><div class="flex flex-wrap gap-2">`;
            for (const comp of compositions) {
                const couleur = getScoreCouleur(comp.meilleurScore);
                html += `<div class="bg-slate-900 px-3 py-1.5 rounded-lg border" style="border-color: ${couleur}">
                    <span class="font-black text-white">${comp.pairId}</span>
                    <span class="text-xs ml-2 font-bold" style="color: ${couleur}">${comp.meilleurScore.toFixed(1)}</span>
                    <span class="text-[10px] text-slate-500 ml-1">(${comp.nbEssais} essai${comp.nbEssais > 1 ? 's' : ''})</span>
                </div>`;
            }
            html += `</div></div>`;
        }
        html += `</div>`;
    }
    html += `</div>`;

    container.innerHTML = html;
    window._relaisLiveData = { classe, config, mesures, vitesses };
}

// ============================================================
// MODALE DÉTAIL
// ============================================================
window.openRelaisGroupeDetail = function(groupeIdx) {
    const data = window._relaisLiveData;
    if (!data) return;
    const { classe, config, mesures } = data;
    const groupe = config.groupes[groupeIdx];
    if (!groupe) return;

    const is2Zones = config.sousActivite === 'relais2zones';
    const mesuresArray = Object.entries(mesures).map(([key, val]) => ({ ...val, _key: key }));
    const mg = mesuresArray.filter(m => String(m.groupeIdx) === String(groupeIdx));

    const existing = document.getElementById('relais-detail-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'relais-detail-modal';
    overlay.className = 'fixed inset-0 bg-black/95 z-50 flex items-start justify-center p-4 overflow-y-auto';
    overlay.innerHTML = `
        <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-4xl my-8">
            <div class="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
                <div>
                    <h2 class="text-2xl font-black text-blue-400 uppercase">Groupe ${groupe.numero}</h2>
                    <p class="text-xs text-slate-400">${groupe.membres.length} élèves · ${mg.length} essai(s) · ${is2Zones ? '2 zones' : '10s'}</p>
                </div>
                <button onclick="document.getElementById('relais-detail-modal').remove()"
                        class="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-xl font-black text-sm text-white">✖ Fermer</button>
            </div>
            <div class="mb-4"><h3 class="text-xs font-bold text-slate-400 uppercase mb-2">👥 Membres</h3><div class="flex flex-wrap gap-2" id="relais-modal-membres"></div></div>
            <div class="mb-4"><h3 class="text-xs font-bold text-slate-400 uppercase mb-2">📋 Tous les essais (${mg.length})</h3><div id="relais-modal-essais" class="space-y-2 max-h-[60vh] overflow-y-auto pr-2"></div></div>
        </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    renderModalMembres(groupeIdx, groupe, classe);
    renderModalEssais(mg, groupeIdx, is2Zones);
};

async function renderModalMembres(groupeIdx, groupe, classe) {
    const container = document.getElementById('relais-modal-membres');
    if (!container) return;
    for (const m of groupe.membres) {
        const eleveId = getEleveIdFromMapping(classe, groupeIdx, m.lettre);
        const nomComplet = getNomComplet(classe, eleveId, m.lettre);
        const photoUrl = eleveId ? await getPhotoUrl(eleveId) : null;
        const photoHtml = photoUrl
            ? `<img src="${photoUrl}" class="w-10 h-10 rounded-full object-cover border-2 border-slate-600">`
            : `<div class="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-lg">👤</div>`;
        const div = document.createElement('div');
        div.className = 'flex items-center gap-2 bg-slate-800 p-2 rounded-xl border border-slate-700';
        div.innerHTML = `${photoHtml}<div>
            <div class="text-xs font-black text-blue-400 uppercase">Lettre ${m.lettre}</div>
            <div class="text-sm font-bold text-white">${nomComplet}</div>
        </div>`;
        container.appendChild(div);
    }
}

function renderModalEssais(mesuresGroupe, groupeIdx, is2Zones) {
    const container = document.getElementById('relais-modal-essais');
    if (!container) return;
    if (mesuresGroupe.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-sm italic">Aucun essai enregistré.</p>';
        return;
    }

    mesuresGroupe.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    let html = '';
    for (const m of mesuresGroupe) {
        const couleur = is2Zones ? getScoreCouleurTransmission(m.pourcentageTransmission) : getScoreCouleur(m.score);
        const date = m.timestamp ? new Date(m.timestamp).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '--';

        let detail = '';
        if (is2Zones) {
            detail = `
                <span>Z1 : <b class="text-white">${m.vitesses?.z1 || '--'}</b></span>
                <span>Trans : <b class="text-blue-400">${m.vitesses?.trans || '--'}</b></span>
                <span>Z2 : <b class="text-white">${m.vitesses?.z2 || '--'}</b></span>
                <span>${m.pourcentageTransmission}% → <b style="color:${couleur}">${m.score} pt${m.score > 1 ? 's' : ''}</b></span>
            `;
        } else {
            detail = `
                <span>V. réelle : <b class="text-emerald-400">${m.vReelle} km/h</b></span>
                <span>V. théorique : <b class="text-yellow-400">${m.vTheorique?.toFixed(1)} km/h</b></span>
                <span>Écart : <b class="${m.ecart >= 0 ? 'text-emerald-400' : 'text-red-400'}">${m.ecart >= 0 ? '+' : ''}${m.ecart?.toFixed(1)}</b></span>
            `;
        }

        html += `
            <div class="bg-slate-800 p-3 rounded-xl border-l-4 flex items-center gap-3" style="border-color: ${couleur}">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                        <span class="font-black text-white text-lg">${m.pairId}</span>
                        <span class="text-xs text-slate-500">${date}</span>
                    </div>
                    <div class="flex flex-wrap gap-3 mt-1 text-xs text-slate-400">${detail}</div>
                </div>
                <div class="text-right">
                    <div class="text-2xl font-black" style="color: ${couleur}">${is2Zones ? m.score + ' pt' : m.score.toFixed(1)}</div>
                </div>
                <button onclick="window.supprimerRelaisEssai('${m._key}', '${groupeIdx}')"
                        class="bg-red-600 hover:bg-red-700 w-9 h-9 rounded-lg font-black text-white active:scale-95" title="Supprimer">🗑️</button>
            </div>`;
    }
    container.innerHTML = html;
}

window.supprimerRelaisEssai = async function(mesureKey, groupeIdx) {
    if (!mesureKey) return;
    if (!confirm('Supprimer cet essai définitivement ?')) return;

    const data = window._relaisLiveData;
    if (!data) return;
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const sub = data.config.sousActivite === 'relais2zones' ? 'mesures-2zones' : 'mesures-10s';
    const path = `etablissements/0680013V/profs/${profCode}/${data.classe}/relais/${sub}/${mesureKey}`;

    try {
        await remove(ref(db, path));
        const modal = document.getElementById('relais-detail-modal');
        if (modal) modal.remove();
    } catch (err) {
        console.error(err);
        alert('❌ Erreur.');
    }
};