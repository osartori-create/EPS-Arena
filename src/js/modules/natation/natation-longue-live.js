// src/js/modules/natation/natation-longue-live.js
// Live professeur du mode « Longue distance » : classement global de la
// session (toutes vagues), sélecteur d'épreuve + modification des données.

import { db, ref, onValue, set, remove } from '../../core/firebase-service.js';
import { getCurrentClasse } from '../../core/live-engine.js';
import {
    getBasePath, getSessionActivePath, getSessionsPath,
    getSessionObsPath, getSessionModifsPath, getStatuts, getCouleurGroupe
} from './natation-longue-common.js';
import { agregerResultats } from './natation-longue-bilan.js';

let unsubs = [];
let obsUnsubs = [];
let cache = {
    classe: '',
    config: null,
    sessionId: null,
    viewSessionId: null,
    sessions: {},
    observations: null,
    modifications: null,
    statuts: {}
};

// ============================================================
// INITIALISATION (listeners)
// ============================================================
export function renderNatationLongueLive() {
    const container = document.getElementById('live-content');
    if (!container) return;

    const classe = getCurrentClasse();
    if (!classe) {
        container.innerHTML = '<p class="text-slate-500 text-center">Sélectionnez une classe.</p>';
        return;
    }

    unsubs.forEach(u => { try { u(); } catch (e) {} });
    obsUnsubs.forEach(u => { try { u(); } catch (e) {} });
    unsubs = [];
    obsUnsubs = [];

    cache = {
        classe,
        config: null,
        sessionId: null,
        viewSessionId: null,
        sessions: {},
        observations: null,
        modifications: null,
        statuts: getStatuts(classe)
    };

    const basePath = getBasePath(classe);

    unsubs.push(onValue(ref(db, `${basePath}/config`), snap => { cache.config = snap.val(); render(); }));
    unsubs.push(onValue(ref(db, getSessionsPath(classe)), snap => {
        cache.sessions = snap.val() || {};
        render();
    }));

    const ecouterSession = (sessionId) => {
        obsUnsubs.forEach(u => { try { u(); } catch (e) {} });
        obsUnsubs = [];
        cache.viewSessionId = sessionId;
        cache.observations = null;
        cache.modifications = null;
        if (sessionId) {
            obsUnsubs.push(onValue(ref(db, getSessionObsPath(classe, sessionId)), snap => {
                cache.observations = snap.val() || {};
                render();
            }));
            obsUnsubs.push(onValue(ref(db, getSessionModifsPath(classe, sessionId)), snap => {
                cache.modifications = snap.val() || {};
                render();
            }));
        }
        render();
    };

    unsubs.push(onValue(ref(db, getSessionActivePath(classe)), snap => {
        cache.sessionId = snap.val() || null;
        // Si aucune épreuve n'est sélectionnée manuellement, on suit l'épreuve active.
        if (!cache.viewSessionId) ecouterSession(cache.sessionId);
        else render();
    }));

    return () => {
        unsubs.forEach(u => { try { u(); } catch (e) {} });
        obsUnsubs.forEach(u => { try { u(); } catch (e) {} });
        unsubs = [];
        obsUnsubs = [];
    };
}

// ============================================================
// RENDU
// ============================================================
function render() {
    const container = document.getElementById('live-content');
    if (!container) return;

    if (!cache.config) {
        container.innerHTML = '<p class="text-slate-500 text-center py-8">⏳ En attente de la configuration (transmets-la depuis l\'onglet Natation → Longue distance).</p>';
        return;
    }

    const sessionOptions = Object.keys(cache.sessions).sort().reverse()
        .map(id => `<option value="${id}" ${id === cache.viewSessionId ? 'selected' : ''}>${id}</option>`)
        .join('');

    const resultats = agregerResultats(cache.classe, cache.observations || {}, cache.modifications || {}, cache.config, cache.statuts);

    let rows = '';
    resultats.forEach((r, i) => {
        const couleur = getCouleurGroupe(r.couleur.id);
        const statutBadge = r.exclu
            ? (r.statut === 'absent' ? '🚫 Absent' : r.statut === 'inapte' ? '⚠️ Inapte' : r.modifStatut === 'blessure' ? '🤕 Blessure' : r.abandon ? '🚫 Abandon' : 'Exclu')
            : '';
        rows += `
            <tr class="${r.exclu ? 'opacity-50' : ''}">
                <td class="p-2 font-black text-slate-400">${i + 1}</td>
                <td class="p-2">
                    <span class="inline-block w-3 h-3 rounded-full mr-2 align-middle" style="background:${couleur.bg};"></span>
                    <span class="font-black text-white">#${r.numero}</span>
                </td>
                <td class="p-2 text-white">${r.nom}</td>
                <td class="p-2 text-slate-300">${r.exclu ? statutBadge : `${r.passages} × ${cache.config.distanceParClic} + ${r.partiel} m`}</td>
                <td class="p-2 font-black text-yellow-400">${r.exclu ? '—' : r.distance + ' m'}</td>
                <td class="p-2 text-slate-300">${r.exclu ? '' : r.vitesse.toFixed(1) + ' km/h'}</td>
                <td class="p-2 text-right">
                    <button onclick="window.nlLiveEditer('${r.numero}')"
                            class="bg-blue-600 text-white text-xs px-2 py-1 rounded-lg font-black hover:bg-blue-700 active:scale-95" title="Modifier">✏️</button>
                </td>
            </tr>
        `;
    });

    container.innerHTML = `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
            <div class="flex justify-between items-center flex-wrap gap-2 mb-3">
                <h3 class="font-black text-blue-400 uppercase text-sm">🏊 Longue distance — Résultats</h3>
                <div class="flex items-center gap-2">
                    <label class="text-xs font-bold text-slate-400">Épreuve :</label>
                    <select id="nl-live-session" class="bg-slate-900 border border-slate-600 rounded p-1 text-white text-xs font-bold">
                        ${sessionOptions || '<option value="">Aucune</option>'}
                    </select>
                </div>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="text-left text-slate-400 text-xs uppercase border-b border-slate-700">
                            <th class="p-2">Rang</th><th class="p-2">Élève</th><th class="p-2">Nom</th>
                            <th class="p-2">Détail</th><th class="p-2">Distance</th><th class="p-2">Vitesse</th><th class="p-2"></th>
                        </tr>
                    </thead>
                    <tbody>${rows || '<tr><td colspan="7" class="p-4 text-center text-slate-500">Aucun résultat pour cette épreuve.</td></tr>'}</tbody>
                </table>
            </div>
        </div>
    `;

    const select = document.getElementById('nl-live-session');
    if (select) {
        select.onchange = () => {
            const sid = select.value;
            cache.viewSessionId = sid;
            obsUnsubs.forEach(u => { try { u(); } catch (e) {} });
            obsUnsubs = [];
            cache.observations = null;
            cache.modifications = null;
            if (sid) {
                obsUnsubs.push(onValue(ref(db, getSessionObsPath(cache.classe, sid)), snap => {
                    cache.observations = snap.val() || {};
                    render();
                }));
                obsUnsubs.push(onValue(ref(db, getSessionModifsPath(cache.classe, sid)), snap => {
                    cache.modifications = snap.val() || {};
                    render();
                }));
            }
            render();
        };
    }
}

// ============================================================
// MODIFICATION DES DONNÉES (stockée séparément des brutes)
// ============================================================
window.nlLiveEditer = function(numero) {
    const resultats = agregerResultats(cache.classe, cache.observations || {}, cache.modifications || {}, cache.config, cache.statuts);
    const r = resultats.find(x => String(x.numero) === String(numero));
    const modif = cache.modifications?.[numero] || {};

    const overlay = document.createElement('div');
    overlay.id = 'nl-live-modif-overlay';
    overlay.className = 'fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4';
    overlay.innerHTML = `
        <div class="bg-slate-900 p-5 rounded-2xl border-2 border-slate-700 max-w-md w-full">
            <h3 class="text-lg font-black text-white mb-1">Modifier — #${numero}</h3>
            <p class="text-sm text-slate-400 mb-3">${r ? `${r.nom} · brut : ${r.distanceBrute} m` : ''}</p>
            <div class="space-y-3 text-sm">
                <div>
                    <label class="text-xs font-bold text-slate-400 uppercase">Distance imposée (m, vide = auto)</label>
                    <input type="number" id="nl-modif-distance" value="${modif.distance ?? ''}" min="0" step="5"
                           class="w-full bg-slate-800 border border-slate-600 rounded-xl p-2 text-white text-center font-black">
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-400 uppercase">Pénalité (m à soustraire)</label>
                    <input type="number" id="nl-modif-penalite" value="${modif.penalite ?? ''}" min="0" step="5"
                           class="w-full bg-slate-800 border border-slate-600 rounded-xl p-2 text-white text-center font-black">
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-400 uppercase">Statut</label>
                    <select id="nl-modif-statut" class="w-full bg-slate-800 border border-slate-600 rounded-xl p-2 text-white font-black">
                        <option value="">Aucun</option>
                        <option value="abandon" ${modif.statut === 'abandon' ? 'selected' : ''}>🚫 Abandon</option>
                        <option value="blessure" ${modif.statut === 'blessure' ? 'selected' : ''}>🤕 Blessure</option>
                    </select>
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-400 uppercase">Commentaire</label>
                    <input type="text" id="nl-modif-commentaire" value="${modif.commentaire || ''}"
                           class="w-full bg-slate-800 border border-slate-600 rounded-xl p-2 text-white">
                </div>
            </div>
            <div class="flex gap-2 mt-5">
                <button onclick="window.nlLiveSupprimerModif('${numero}')" class="bg-red-900/40 text-red-300 px-4 py-2 rounded-xl font-black text-xs border border-red-700">🗑️ Effacer</button>
                <button onclick="window.nlLiveFermerModif()" class="flex-1 bg-slate-700 py-2 rounded-xl font-black text-white text-sm active:scale-95">Annuler</button>
                <button onclick="window.nlLiveSauverModif('${numero}')" class="flex-1 bg-emerald-600 py-2 rounded-xl font-black text-white text-sm active:scale-95">💾 Enregistrer</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
};

window.nlLiveSauverModif = async function(numero) {
    if (!cache.viewSessionId) return window.nlLiveFermerModif();
    const distance = document.getElementById('nl-modif-distance')?.value;
    const penalite = document.getElementById('nl-modif-penalite')?.value;
    const statut = document.getElementById('nl-modif-statut')?.value;
    const commentaire = document.getElementById('nl-modif-commentaire')?.value;

    const modif = {};
    if (distance !== '' && distance !== null && distance !== undefined) modif.distance = Math.max(0, Number(distance));
    if (penalite !== '' && penalite !== null && penalite !== undefined) modif.penalite = Math.max(0, Number(penalite));
    if (statut) modif.statut = statut;
    if (commentaire) modif.commentaire = commentaire;

    const path = `${getSessionModifsPath(cache.classe, cache.viewSessionId)}/${numero}`;
    if (Object.keys(modif).length === 0) {
        await remove(ref(db, path));
    } else {
        await set(ref(db, path), modif);
    }
    window.nlLiveFermerModif();
};

window.nlLiveSupprimerModif = async function(numero) {
    if (!cache.viewSessionId) return;
    if (!confirm('Supprimer toutes les modifications pour cet élève ?')) return;
    await remove(ref(db, `${getSessionModifsPath(cache.classe, cache.viewSessionId)}/${numero}`));
    window.nlLiveFermerModif();
};

window.nlLiveFermerModif = function() {
    const overlay = document.getElementById('nl-live-modif-overlay');
    if (overlay) overlay.remove();
};


