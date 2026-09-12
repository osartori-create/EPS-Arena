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
        // Enrichir les mesures avec leur clé Firebase
    const mesuresArrayWithKeys = Object.entries(mesures).map(([key, val]) => ({ ...val, _key: key }));

    const mode = config.mode || 'essai';
    const bannerHtml = mode === 'competition'
        ? `<div class="bg-yellow-500 text-black text-center font-black uppercase py-2 rounded-xl mb-4 text-sm">🏆 Mode compétition</div>`
        : `<div class="bg-emerald-500 text-white text-center font-black uppercase py-2 rounded-xl mb-4 text-sm">🌱 Mode essai</div>`;

    let html = bannerHtml;

    if (mesuresArrayWithKeys.length === 0) {
        html += '<p class="text-slate-500 text-center">Aucun essai enregistré pour l\'instant.</p>';
        container.innerHTML = html;
        return;
    }

    // ============================================================
    // SYNTHÈSE PAR ÉQUIPE (cliquable)
    // ============================================================
    html += `<h3 class="font-black text-blue-400 uppercase text-sm mb-3">🏆 Synthèse par équipe <span class="text-slate-500 normal-case font-normal">(cliquez pour le détail)</span></h3>`;
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
            <div onclick="window.openRelaisGroupeDetail('${eq.idx}')"
                 class="bg-slate-800 p-4 rounded-2xl border-2 border-slate-700 cursor-pointer hover:border-blue-500 hover:bg-slate-750 transition-all active:scale-95">
                <div class="flex justify-between items-center mb-2">
                    <h4 class="font-black text-lg text-white">${medaille} Groupe ${eq.groupe.numero}</h4>
                    <span class="text-2xl font-black text-yellow-400">${eq.scoreEquipe.toFixed(1)}</span>
                </div>
                <p class="text-xs text-slate-400">${eq.nbEssais} / ${eq.nbPaires} paires mesurées</p>
                <div class="mt-2 text-xs text-slate-500">
                    ${eq.groupe.membres.map(m => m.lettre).join(' · ')}
                </div>
                <div class="mt-2 text-[10px] text-blue-400 font-bold">🔍 Voir le détail →</div>
            </div>
        `;
    }
    html += `</div>`;

    // ============================================================
    // DÉTAIL PAR ÉQUIPE (aperçu condensé, inchangé)
    // ============================================================
    html += `<h3 class="font-black text-blue-400 uppercase text-sm mb-3 mt-6">📊 Aperçu par équipe</h3>`;
    html += `<div class="space-y-4">`;

    for (const eq of equipesData) {
        const groupe = eq.groupe;
        const groupeIdx = eq.idx;
        const membres = groupe.membres;
        const efficacite = calculerEfficaciteIndividuelle(eq.mesuresGroupe, membres);
        const compositions = calculerCompositionsEfficaces(eq.mesuresGroupe);

        html += `
            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <div class="flex justify-between items-center mb-3">
                    <h4 class="font-black text-white">Groupe ${groupe.numero}</h4>
                    <button onclick="window.openRelaisGroupeDetail('${groupeIdx}')"
                            class="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded-lg font-black text-xs text-white active:scale-95">
                        🔍 Détail complet
                    </button>
                </div>
        `;

        // Efficacité individuelle
        html += `<div class="mb-4">
            <p class="text-xs font-bold text-slate-400 uppercase mb-2">Efficacité individuelle (option B)</p>
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

    // ✅ Stocker les données en global pour la modale
    window._relaisLiveData = { classe, config, mesures, vitesses };
}

// ============================================================
// MODALE DÉTAIL GROUPE (clic sur groupe)
// ============================================================
window.openRelaisGroupeDetail = function(groupeIdx) {
    const data = window._relaisLiveData;
    if (!data) { console.warn('Données Live non chargées'); return; }
    const { classe, config, mesures } = data;

    const groupe = config.groupes[groupeIdx];
    if (!groupe) return;

    const mesuresArrayWithKeys = Object.values(mesures);
    const mesuresGroupe = mesuresArrayWithKeys.filter(m => String(m.groupeIdx) === String(groupeIdx));

    // Modale
    const existingModal = document.getElementById('relais-detail-modal');
    if (existingModal) existingModal.remove();

    const overlay = document.createElement('div');
    overlay.id = 'relais-detail-modal';
    overlay.className = 'fixed inset-0 bg-black/95 z-50 flex items-start justify-center p-4 overflow-y-auto';

    overlay.innerHTML = `
        <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-4xl my-8">
            <div class="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
                <div>
                    <h2 class="text-2xl font-black text-blue-400 uppercase">Groupe ${groupe.numero}</h2>
                    <p class="text-xs text-slate-400">${groupe.membres.length} élèves · ${mesuresGroupe.length} essai(s)</p>
                </div>
                <button onclick="document.getElementById('relais-detail-modal').remove()"
                        class="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-xl font-black text-sm text-white">
                    ✖ Fermer
                </button>
            </div>

            <div class="mb-4">
                <h3 class="text-xs font-bold text-slate-400 uppercase mb-2">👥 Membres</h3>
                <div class="flex flex-wrap gap-2" id="relais-modal-membres"></div>
            </div>

            <div class="mb-4">
                <div class="flex justify-between items-center mb-2">
                    <h3 class="text-xs font-bold text-slate-400 uppercase">📋 Tous les essais (${mesuresGroupe.length})</h3>
                </div>
                <div id="relais-modal-essais" class="space-y-2 max-h-[60vh] overflow-y-auto pr-2"></div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    // Fermer au clic sur le fond
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    // Remplir les membres
    renderModalMembres(groupeIdx, groupe, classe);

    // Remplir les essais
    renderModalEssais(mesuresGroupe, groupeIdx);
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
        div.innerHTML = `
            ${photoHtml}
            <div>
                <div class="text-xs font-black text-blue-400 uppercase">Lettre ${m.lettre}</div>
                <div class="text-sm font-bold text-white">${nomComplet}</div>
                <div class="text-[10px] text-slate-500">Sexe : ${m.sexe || '?'}</div>
            </div>
        `;
        container.appendChild(div);
    }
}

function renderModalEssais(mesuresGroupe, groupeIdx) {
    const container = document.getElementById('relais-modal-essais');
    if (!container) return;

    if (mesuresGroupe.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-sm italic">Aucun essai enregistré pour ce groupe.</p>';
        return;
    }

    // Trier par timestamp desc
    mesuresGroupe.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    let html = '';
    for (const m of mesuresGroupe) {
        const couleur = getScoreCouleur(m.score);
        const date = m.timestamp ? new Date(m.timestamp).toLocaleString('fr-FR', { 
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
        }) : '--';

        html += `
            <div class="bg-slate-800 p-3 rounded-xl border-l-4 flex items-center gap-3" style="border-color: ${couleur}">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                        <span class="font-black text-white text-lg">${m.pairId}</span>
                        <span class="text-xs text-slate-500">${date}</span>
                    </div>
                    <div class="flex flex-wrap gap-3 mt-1 text-xs text-slate-400">
                        <span>V. réelle : <span class="text-emerald-400 font-bold">${m.vReelle} km/h</span></span>
                        <span>V. théorique : <span class="text-yellow-400 font-bold">${m.vTheorique.toFixed(1)} km/h</span></span>
                        <span>Écart : <span class="${m.ecart >= 0 ? 'text-emerald-400' : 'text-red-400'} font-bold">${m.ecart >= 0 ? '+' : ''}${m.ecart.toFixed(1)}</span></span>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-2xl font-black" style="color: ${couleur}">${m.score.toFixed(1)}</div>
                </div>
                <button onclick="window.supprimerRelaisEssai('${m._key}', '${groupeIdx}')"
                        class="bg-red-600 hover:bg-red-700 w-9 h-9 rounded-lg font-black text-white active:scale-95"
                        title="Supprimer cet essai">
                    🗑️
                </button>
            </div>
        `;
    }
    container.innerHTML = html;
}

// ============================================================
// SUPPRESSION D'UN ESSAI
// ============================================================
window.supprimerRelaisEssai = async function(mesureKey, groupeIdx) {
    if (!mesureKey) {
        // Fallback : la clé n'est pas toujours exposée. On va la retrouver
        console.warn('Clé de mesure manquante');
        alert('Impossible de supprimer : clé introuvable. Recharge le Live.');
        return;
    }

    if (!confirm('Supprimer cet essai définitivement ?')) return;

    const data = window._relaisLiveData;
    if (!data) return;
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const path = `etablissements/0680013V/profs/${profCode}/${data.classe}/relais/mesures/${mesureKey}`;

    try {
        const { remove } = await import('../../core/firebase-service.js');
        await remove(ref(db, path));
        console.log('✅ Essai supprimé :', mesureKey);

        // Fermer la modale : le listener Firebase va relancer le rendu automatiquement
        const modal = document.getElementById('relais-detail-modal');
        if (modal) modal.remove();
    } catch (err) {
        console.error(err);
        alert('❌ Erreur lors de la suppression.');
    }
};