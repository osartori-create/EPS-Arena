// src/js/modules/relais/relais-live.js
// Live prof : utilise le mapping local pour afficher les noms
// ⚠️ Les noms ne viennent JAMAIS de Firebase, uniquement du localStorage prof.

import { db, ref, onValue } from '../../core/firebase-service.js';
import { getCurrentClasse, getLocalMapping } from '../../core/live-engine.js';
import { getPhotoUrl } from '../../services/admin-service.js';
import {
    calculerEfficaciteIndividuelle,
    calculerCompositionsEfficaces,
    calculerScoreEquipe,
    getMeilleurEssaiParPaire,
    getScoreCouleur
} from './relais-core.js';

let currentUnsub = null;

export function renderRelaisLive() {
    const container = document.getElementById('live-content');
    if (!container) return;

    const classe = getCurrentClasse();
    if (!classe) {
        container.innerHTML = '<p class="text-slate-500 text-center">Sélectionnez une classe.</p>';
        return;
    }

    if (currentUnsub) { currentUnsub(); currentUnsub = null; }

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const basePath = `etablissements/0680013V/profs/${profCode}/${classe}/relais`;

    let config = null, mesures = {}, vitesses = {};
    let loaded = 0;

    function checkAndRender() {
        if (loaded >= 3) renderAll(container, classe, config, mesures, vitesses);
    }

    onValue(ref(db, `${basePath}/config`), snap => { config = snap.val(); loaded++; checkAndRender(); }, { onlyOnce: true });
    onValue(ref(db, `${basePath}/mesures`), snap => { mesures = snap.val() || {}; loaded++; checkAndRender(); });
    onValue(ref(db, `${basePath}/vitesses`), snap => { vitesses = snap.val() || {}; loaded++; checkAndRender(); });
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

    const mesuresArray = Object.values(mesures);

    const mode = config.mode || 'essai';
    const bannerHtml = mode === 'competition'
        ? `<div class="bg-yellow-500 text-black text-center font-black uppercase py-2 rounded-xl mb-4 text-sm">🏆 Mode compétition</div>`
        : `<div class="bg-emerald-500 text-white text-center font-black uppercase py-2 rounded-xl mb-4 text-sm">🌱 Mode essai</div>`;

    let html = bannerHtml;

    if (mesuresArray.length === 0) {
        html += '<p class="text-slate-500 text-center">Aucun essai enregistré pour l\'instant.</p>';
        container.innerHTML = html;
        return;
    }

    // ============================================================
    // SYNTHÈSE PAR ÉQUIPE
    // ============================================================
    html += `<h3 class="font-black text-blue-400 uppercase text-sm mb-3">🏆 Synthèse par équipe</h3>`;
    html += `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">`;

    const equipesData = [];

    for (const [idx, groupe] of Object.entries(config.groupes)) {
        const mesuresGroupe = mesuresArray.filter(m => String(m.groupeIdx) === String(idx));
        const meilleur = getMeilleurEssaiParPaire(mesuresGroupe);
        const scoreEquipe = calculerScoreEquipe(mesuresGroupe);
        const nbEssais = Object.keys(meilleur).length;
        const nbPaires = (groupe.membres.length) * (groupe.membres.length - 1);

        equipesData.push({ idx, groupe, mesuresGroupe, scoreEquipe, nbEssais, nbPaires });
    }

    equipesData.sort((a, b) => b.scoreEquipe - a.scoreEquipe);

    for (let i = 0; i < equipesData.length; i++) {
        const eq = equipesData[i];
        const medaille = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : `${i + 1}.`));

        html += `
            <div class="bg-slate-800 p-4 rounded-2xl border-2 border-slate-700">
                <div class="flex justify-between items-center mb-2">
                    <h4 class="font-black text-lg text-white">${medaille} Groupe ${eq.groupe.numero}</h4>
                    <span class="text-2xl font-black text-yellow-400">${eq.scoreEquipe.toFixed(1)}</span>
                </div>
                <p class="text-xs text-slate-400">${eq.nbEssais} / ${eq.nbPaires} paires mesurées</p>
                <div class="mt-2 text-xs text-slate-500">
                    ${eq.groupe.membres.map(m => m.lettre).join(' · ')}
                </div>
            </div>
        `;
    }
    html += `</div>`;

    // ============================================================
    // DÉTAIL PAR ÉQUIPE
    // ============================================================
    html += `<h3 class="font-black text-blue-400 uppercase text-sm mb-3 mt-6">📊 Détail par équipe</h3>`;
    html += `<div class="space-y-4">`;

    for (const eq of equipesData) {
        const groupe = eq.groupe;
        const groupeIdx = eq.idx;
        const membres = groupe.membres;
        const efficacite = calculerEfficaciteIndividuelle(eq.mesuresGroupe, membres);
        const compositions = calculerCompositionsEfficaces(eq.mesuresGroupe);

        html += `
            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <h4 class="font-black text-white mb-3">Groupe ${groupe.numero}</h4>
        `;

        // Efficacité individuelle
        html += `<div class="mb-4">
            <p class="text-xs font-bold text-slate-400 uppercase mb-2">Efficacité individuelle (option B : relayé / relayeur)</p>
            <div class="space-y-1">`;

        const effArray = Object.values(efficacite)
            .filter(e => e.moyenneGlobale !== null)
            .sort((a, b) => b.moyenneGlobale - a.moyenneGlobale);

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
                </div>
            `;
        }
        if (effArray.length === 0) {
            html += `<p class="text-slate-500 text-xs italic">Aucune donnée</p>`;
        }
        html += `</div></div>`;

        // Compositions efficaces
        if (compositions.length > 0) {
            html += `<div>
                <p class="text-xs font-bold text-slate-400 uppercase mb-2">🎯 Compositions les plus efficaces</p>
                <div class="flex flex-wrap gap-2">`;

            for (const comp of compositions) {
                const couleur = getScoreCouleur(comp.meilleurScore);
                html += `
                    <div class="bg-slate-900 px-3 py-1.5 rounded-lg border" style="border-color: ${couleur}">
                        <span class="font-black text-white">${comp.pairId}</span>
                        <span class="text-xs ml-2 font-bold" style="color: ${couleur}">${comp.meilleurScore.toFixed(1)}</span>
                        <span class="text-[10px] text-slate-500 ml-1">(${comp.nbEssais} essai${comp.nbEssais > 1 ? 's' : ''})</span>
                    </div>
                `;
            }
            html += `</div></div>`;
        }

        html += `</div>`;
    }
    html += `</div>`;

    container.innerHTML = html;
}