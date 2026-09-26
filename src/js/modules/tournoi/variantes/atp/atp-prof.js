// src/js/modules/tournoi/variantes/atp/atp-prof.js
import { db, ref, onValue, push, set, remove } from '../../../../core/firebase-service.js';
import { getPhotoUrl } from '../../../../services/admin-service.js';
import { getExistingEleves } from '../../../../services/admin-service.js';
import {
    recalculerTout, trierClassement, genererSnapshot,
    calculerMatch, BAREME_DEFAUT, POINTS_INITIAUX,
    getMedaille, formatEcart, getPalier
} from './atp-core.js';
import {
    initTournoiCore, cleanupTournoiCore,
    getJoueursPath, getHistoriquePath, getConfigPath,
    getCurrentClasse, getCurrentVariant
} from '../../tournoi-core.js';

let currentClasse = '';
let currentEleves = [];      // [{id, nom, prenom, codeAutoEval}]
let currentMatchs = {};
let currentConfig = {};
let currentJoueursMap = {};
let unsubs = [];

// ============================================================
// UTILITAIRES
// ============================================================
function getATPBasePath(classe) {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    return `etablissements/0680013V/profs/${profCode}/${classe}/tournoi/atp`;
}

function getBareme(config) {
    if (config?.bareme && Array.isArray(config.bareme) && config.bareme.length > 0) {
        return config.bareme;
    }
    return BAREME_DEFAUT;
}

function elevesParCode(eleves) {
    const map = {};
    eleves.forEach(e => {
        if (e.codeAutoEval !== undefined && e.codeAutoEval !== null) {
            map[String(e.codeAutoEval)] = e;
        }
    });
    return map;
}

// ============================================================
// POINT D'ENTRÉE
// ============================================================
export function initProf(classe) {
    currentClasse = classe;
    currentEleves = getExistingEleves(classe);
     // ✅ Nouveau : on vide le conteneur tout de suite
    const container = document.getElementById('tournoi-prof-container');
    if (container) {
        container.innerHTML = '<p class="text-slate-500 text-center py-8">⏳ Chargement du tournoi ATP...</p>';
    }

    // Le core est initialisé par le dispatcher (avec variant 'atp')
    // Mais on s'assure qu'il l'est :
    if (getCurrentClasse() !== classe || getCurrentVariant() !== 'atp') {
        initTournoiCore(classe, 'atp');
    }


    // Écoute des changements de matchs + config
    unsubs.forEach(u => { try { u(); } catch(e) {} });
    unsubs = [];

    const baseATP = getATPBasePath(classe);
    const matchsRef = ref(db, `${baseATP}/matchs`);
    const configRef = ref(db, `${baseATP}/config`);

    unsubs.push(onValue(matchsRef, snap => {
        currentMatchs = snap.val() || {};
        recalculerEtRendre();
    }));

    unsubs.push(onValue(configRef, snap => {
        currentConfig = snap.val() || {};
        recalculerEtRendre();
    }));

    // Rendu initial
    recalculerEtRendre();

    return () => {
        unsubs.forEach(u => { try { u(); } catch(e) {} });
        unsubs = [];
    };
}

function recalculerEtRendre() {
    // ✅ Relit systématiquement les élèves (le live fait ça ; le prof ne doit
    // pas rester figé sur une liste capturée avant l'import).
    currentEleves = getExistingEleves(currentClasse) || [];
    const codes = currentEleves.map(e => String(e.codeAutoEval)).filter(Boolean);
    const bareme = getBareme(currentConfig);
    currentJoueursMap = recalculerTout(codes, currentMatchs, bareme);
    rendreProf();
}

// ============================================================
// RENDU PRINCIPAL
// ============================================================
async function rendreProf() {
    const container = document.getElementById('tournoi-prof-container');
    if (!container) return;

    if (currentEleves.length === 0) {
        container.innerHTML = `
            <div class="bg-slate-800 p-6 rounded-2xl border border-slate-700 text-center">
                <p class="text-slate-400">Aucun élève dans cette classe.</p>
                <p class="text-xs text-slate-500 mt-2">Importe d'abord les élèves dans Administration.</p>
            </div>`;
        return;
    }

    const codesSansAutoEval = currentEleves.filter(e => e.codeAutoEval === undefined || e.codeAutoEval === null);
    if (codesSansAutoEval.length > 0) {
        container.innerHTML = `
            <div class="bg-amber-900/20 border-2 border-amber-500 p-6 rounded-2xl text-center">
                <p class="text-lg font-black text-amber-400 mb-2">⚠️ Codes élèves manquants</p>
                <p class="text-sm text-slate-300">${codesSansAutoEval.length} élève(s) n'ont pas de code auto-éval.</p>
                <p class="text-xs text-slate-500 mt-2">Va dans Administration → 🔢 Codes élèves pour les attribuer.</p>
            </div>`;
        return;
    }

    const elevesMap = elevesParCode(currentEleves);
    const classement = trierClassement(currentJoueursMap, elevesMap);

    // Header + boutons
    let html = `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 mb-4">
            <div class="flex justify-between items-center flex-wrap gap-2 mb-2">
                <div>
                    <h3 class="font-black text-blue-400 uppercase text-sm">🎾 Tournoi ATP</h3>
                    <p class="text-xs text-slate-400">Classe : ${currentClasse} · ${currentEleves.length} élèves · ${Object.keys(currentMatchs).length} match(s)</p>
                </div>
                <div class="flex gap-2 flex-wrap">
                    <button onclick="window.atpOpenSaisieManuelle()" 
        class="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-xl font-black text-xs text-slate-300 active:scale-95 border border-slate-600"
        title="Dépannage : saisir un match manuellement">
    🛠️ Saisie manuelle
</button>
                    <button onclick="window.atpOuvrirBareme()" class="bg-purple-600 hover:bg-purple-500 px-3 py-2 rounded-xl font-black text-xs text-white active:scale-95">
                        ⚙️ Barème
                    </button>
                    <button onclick="window.atpArchiver()" class="bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-xl font-black text-xs text-white active:scale-95">
                        📦 Archiver
                    </button>
                    <button onclick="window.atpVoirArchives()" class="bg-slate-600 hover:bg-slate-500 px-3 py-2 rounded-xl font-black text-xs text-white active:scale-95">
                        📁 Archives
                    </button>
                    <button onclick="window.atpReset()" class="bg-red-600 hover:bg-red-500 px-3 py-2 rounded-xl font-black text-xs text-white active:scale-95">
                        🔄 Reset
                    </button>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
    `;

    // Colonne gauche : classement
    html += `
            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <h4 class="font-black text-white text-sm uppercase mb-3">🏆 Classement</h4>
                <div class="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
    `;

    for (const item of classement) {
        const eleve = item.eleve;
        const couleur = item.rang === 1 ? 'border-yellow-500' :
                        item.rang === 2 ? 'border-slate-400' :
                        item.rang === 3 ? 'border-amber-600' : 'border-slate-700';

        html += `
            <div class="flex items-center gap-3 bg-slate-900 p-2 rounded-xl border-2 ${couleur}">
                <div class="text-2xl min-w-[42px] text-center font-black text-slate-300">${getMedaille(item.rang)}</div>
                <div class="atp-photo w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-lg" data-id="${eleve ? eleve.id : ''}">👤</div>
                <div class="flex-1 min-w-0">
                    <div class="font-bold text-white text-sm truncate">${eleve ? eleve.prenom + ' ' + eleve.nom : 'Code ' + item.code}</div>
                    <div class="text-[10px] text-slate-500">#${item.code} · ${item.victoires}V-${item.defaites}D · diff ${formatEcart(item.diffPoints)}</div>
                </div>
                <div class="text-right">
                    <div class="text-2xl font-black ${item.points >= 100 ? 'text-emerald-400' : 'text-red-400'}">${item.points}</div>
                    <div class="text-[9px] text-slate-500 uppercase">pts</div>
                </div>
            </div>
        `;
    }

    html += `</div></div>`;

    // Colonne droite : derniers matchs
    html += `
            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <h4 class="font-black text-white text-sm uppercase mb-3">📋 Derniers matchs</h4>
                <div class="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
    `;

    const matchsArr = Object.entries(currentMatchs)
        .map(([key, m]) => ({ ...m, _key: key }))
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        .slice(0, 50);

    if (matchsArr.length === 0) {
        html += `<p class="text-slate-500 text-sm text-center py-6">Aucun match enregistré.</p>`;
    } else {
        for (const m of matchsArr) {
            const eV = elevesMap[String(m.codeV)];
            const eP = elevesMap[String(m.codeP)];
            const nomV = eV ? `${eV.prenom} ${eV.nom}` : `Code ${m.codeV}`;
            const nomP = eP ? `${eP.prenom} ${eP.nom}` : `Code ${m.codeP}`;
            const date = new Date(m.timestamp || 0).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

            html += `
                <div class="bg-slate-900 p-3 rounded-xl border border-slate-700">
                    <div class="flex justify-between items-start gap-2">
                        <div class="flex-1 min-w-0">
                            <div class="text-sm">
                                <span class="font-black text-emerald-400">${nomV}</span>
                                <span class="text-slate-400 mx-1">bat</span>
                                <span class="font-black text-red-400">${nomP}</span>
                            </div>
                            <div class="text-xs text-slate-400 mt-0.5">
                                <span class="font-mono">${m.scoreV} - ${m.scoreP}</span>
                                <span class="mx-2">·</span>
                                <span>écart ${formatEcart(m.ecart)}</span>
                                <span class="mx-2">·</span>
                                <span class="text-emerald-400 font-bold">${formatEcart(m.ptsV)}</span>
                                <span class="text-slate-500">/</span>
                                <span class="text-red-400 font-bold">${formatEcart(m.ptsP)}</span>
                            </div>
                            <div class="text-[10px] text-slate-500 mt-0.5">${date}</div>
                        </div>
                        <div class="flex gap-1 flex-shrink-0">
                            <button onclick="window.atpModifierMatch('${m._key}')" class="bg-blue-600 hover:bg-blue-500 px-2 py-1 rounded-lg text-xs font-black text-white">✏️</button>
                            <button onclick="window.atpSupprimerMatch('${m._key}')" class="bg-red-600 hover:bg-red-500 px-2 py-1 rounded-lg text-xs font-black text-white">🗑️</button>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    html += `</div></div></div>`;
    container.innerHTML = html;

    // Chargement des photos en arrière-plan (non bloquant).
    chargerPhotosProf();
}

async function chargerPhotosProf() {
    const placeholders = document.querySelectorAll('#tournoi-prof-container .atp-photo[data-id]');
    await Promise.all(Array.from(placeholders).map(async el => {
        const id = el.dataset.id;
        if (!id) return;
        try {
            const url = await getPhotoUrl(id);
            if (url) {
                el.innerHTML = `<img src="${url}" class="w-10 h-10 rounded-full object-cover border-2 border-slate-600">`;
            }
        } catch (e) { /* photo absente : on garde l'avatar 👤 */ }
    }));
}

// ============================================================
// MODALE : SAISIE MANUELLE
// ============================================================
window.atpOpenSaisieManuelle = function(matchKey = null, prefill = null) {
    const elevesOptions = currentEleves
        .filter(e => e.codeAutoEval)
        .sort((a, b) => (a.nom || '').localeCompare(b.nom || ''))
        .map(e => `<option value="${e.codeAutoEval}" ${prefill?.codeV == e.codeAutoEval ? 'selected' : ''}>#${e.codeAutoEval} — ${e.prenom} ${e.nom}</option>`)
        .join('');

    const elevesOptionsP = currentEleves
        .filter(e => e.codeAutoEval)
        .sort((a, b) => (a.nom || '').localeCompare(b.nom || ''))
        .map(e => `<option value="${e.codeAutoEval}" ${prefill?.codeP == e.codeAutoEval ? 'selected' : ''}>#${e.codeAutoEval} — ${e.prenom} ${e.nom}</option>`)
        .join('');

    const modal = document.createElement('div');
    modal.id = 'atp-modal-saisie';
    modal.className = 'fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-lg">
            <h3 class="text-xl font-black text-blue-400 uppercase mb-4">${matchKey ? '✏️ Modifier le match' : '➕ Saisir un match'}</h3>
            <div class="space-y-4">
                <div>
                    <label class="text-xs font-bold text-emerald-400 uppercase block mb-1">Vainqueur</label>
                    <select id="atp-sel-v" class="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-white">
                        <option value="">-- Choisir --</option>
                        ${elevesOptions}
                    </select>
                </div>
                <div>
                    <label class="text-xs font-bold text-red-400 uppercase block mb-1">Perdant</label>
                    <select id="atp-sel-p" class="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-white">
                        <option value="">-- Choisir --</option>
                        ${elevesOptionsP}
                    </select>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase block mb-1">Score vainqueur</label>
                        <input type="number" id="atp-sc-v" min="0" max="99" value="${prefill?.scoreV ?? ''}"
                               class="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-white text-center text-2xl font-black">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase block mb-1">Score perdant</label>
                        <input type="number" id="atp-sc-p" min="0" max="99" value="${prefill?.scoreP ?? ''}"
                               class="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-white text-center text-2xl font-black">
                    </div>
                </div>
            </div>
            <div class="flex gap-3 mt-6">
                <button onclick="document.getElementById('atp-modal-saisie').remove()" class="flex-1 bg-slate-700 py-3 rounded-xl font-black text-white">Annuler</button>
                <button onclick="window.atpValiderSaisie('${matchKey || ''}')" class="flex-1 bg-emerald-600 py-3 rounded-xl font-black text-white">✅ Enregistrer</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
};

window.atpValiderSaisie = async function(matchKey) {
    const codeV = document.getElementById('atp-sel-v').value;
    const codeP = document.getElementById('atp-sel-p').value;
    const scoreV = parseInt(document.getElementById('atp-sc-v').value);
    const scoreP = parseInt(document.getElementById('atp-sc-p').value);

    if (!codeV || !codeP) return alert('Choisis un vainqueur et un perdant.');
    if (codeV === codeP) return alert('Le vainqueur et le perdant doivent être différents.');
    if (isNaN(scoreV) || isNaN(scoreP)) return alert('Saisis les deux scores.');
    if (scoreV <= scoreP) return alert('Le score du vainqueur doit être supérieur à celui du perdant.');

    // Recalcul pour avoir les points AVANT match
    const joueursTemp = { ...currentJoueursMap };
    const joueurV = joueursTemp[String(codeV)] || { points: POINTS_INITIAUX };
    const joueurP = joueursTemp[String(codeP)] || { points: POINTS_INITIAUX };

    // Si on modifie un match existant, il faut le retirer du calcul d'abord
    let matchsPourCalcul = { ...currentMatchs };
    if (matchKey) delete matchsPourCalcul[matchKey];

    const bareme = getBareme(currentConfig);
    const codes = currentEleves.map(e => String(e.codeAutoEval)).filter(Boolean);
    const joueursRecalcules = recalculerTout(codes, matchsPourCalcul, bareme);

    const jV = joueursRecalcules[String(codeV)] || { points: POINTS_INITIAUX };
    const jP = joueursRecalcules[String(codeP)] || { points: POINTS_INITIAUX };
    const { ecart, ptsV, ptsP } = calculerMatch(jV, jP, bareme);

    const payload = {
        codeV: String(codeV),
        codeP: String(codeP),
        scoreV, scoreP,
        ecart, ptsV, ptsP,
        timestamp: matchKey ? (currentMatchs[matchKey]?.timestamp || Date.now()) : Date.now(),
        modifier: matchKey ? Date.now() : undefined
    };

    const baseATP = getATPBasePath(currentClasse);
    try {
        if (matchKey) {
            await set(ref(db, `${baseATP}/matchs/${matchKey}`), payload);
        } else {
            await push(ref(db, `${baseATP}/matchs`), payload);
        }
        document.getElementById('atp-modal-saisie')?.remove();
    } catch (err) {
        console.error(err);
        alert('❌ Erreur : ' + err.message);
    }
};

// ============================================================
// MODIFIER / SUPPRIMER UN MATCH
// ============================================================
window.atpModifierMatch = function(matchKey) {
    const m = currentMatchs[matchKey];
    if (!m) return;
    window.atpOpenSaisieManuelle(matchKey, m);
};

window.atpSupprimerMatch = async function(matchKey) {
    if (!confirm('Supprimer ce match ? Le classement sera recalculé.')) return;
    const baseATP = getATPBasePath(currentClasse);
    try {
        await remove(ref(db, `${baseATP}/matchs/${matchKey}`));
    } catch (err) {
        alert('❌ Erreur : ' + err.message);
    }
};

// ============================================================
// MODALE BARÈME
// ============================================================
window.atpOuvrirBareme = function() {
    const bareme = getBareme(currentConfig);
    let lignes = '';
    bareme.forEach((p, i) => {
        lignes += `
            <tr class="border-b border-slate-700">
                <td class="p-2"><input type="number" id="atp-b-min-${i}" value="${p.ecartMin}" class="w-20 bg-slate-900 border border-slate-600 rounded p-1 text-center text-white"></td>
                <td class="p-2 text-slate-500 text-center">→</td>
                <td class="p-2"><input type="number" id="atp-b-max-${i}" value="${p.ecartMax}" class="w-20 bg-slate-900 border border-slate-600 rounded p-1 text-center text-white"></td>
                <td class="p-2"><input type="number" id="atp-b-v-${i}" value="${p.ptsV}" class="w-16 bg-slate-900 border border-slate-600 rounded p-1 text-center text-emerald-400 font-bold"></td>
                <td class="p-2"><input type="number" id="atp-b-p-${i}" value="${p.ptsP}" class="w-16 bg-slate-900 border border-slate-600 rounded p-1 text-center text-red-400 font-bold"></td>
            </tr>`;
    });

    const modal = document.createElement('div');
    modal.id = 'atp-modal-bareme';
    modal.className = 'fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-2xl">
            <h3 class="text-xl font-black text-purple-400 uppercase mb-4">⚙️ Barème ATP</h3>
            <p class="text-xs text-slate-400 mb-4">Écart = points du vainqueur − points du perdant (avant match)</p>
            <table class="w-full text-sm">
                <thead>
                    <tr class="text-slate-400 text-xs uppercase border-b border-slate-600">
                        <th class="p-2 text-left">Écart min</th>
                        <th></th>
                        <th class="p-2 text-left">Écart max</th>
                        <th class="p-2 text-center">Pts V</th>
                        <th class="p-2 text-center">Pts P</th>
                    </tr>
                </thead>
                <tbody>${lignes}</tbody>
            </table>
            <div class="flex gap-3 mt-6">
                <button onclick="document.getElementById('atp-modal-bareme').remove()" class="flex-1 bg-slate-700 py-3 rounded-xl font-black text-white">Annuler</button>
                <button onclick="window.atpResetBareme()" class="bg-amber-600 px-4 py-3 rounded-xl font-black text-sm text-white">↺ Défaut</button>
                <button onclick="window.atpSauverBareme()" class="flex-1 bg-purple-600 py-3 rounded-xl font-black text-white">💾 Enregistrer</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
};

window.atpSauverBareme = async function() {
    const bareme = [];
    let i = 0;
    while (document.getElementById(`atp-b-min-${i}`)) {
        bareme.push({
            ecartMin: parseInt(document.getElementById(`atp-b-min-${i}`).value),
            ecartMax: parseInt(document.getElementById(`atp-b-max-${i}`).value),
            ptsV: parseInt(document.getElementById(`atp-b-v-${i}`).value),
            ptsP: parseInt(document.getElementById(`atp-b-p-${i}`).value)
        });
        i++;
    }

    // Vérif cohérence
    bareme.sort((a, b) => a.ecartMin - b.ecartMin);
    for (let j = 0; j < bareme.length - 1; j++) {
        if (bareme[j].ecartMax >= bareme[j+1].ecartMin) {
            return alert('❌ Les plages se chevauchent. Vérifie les bornes.');
        }
    }

    const baseATP = getATPBasePath(currentClasse);
    try {
        await set(ref(db, `${baseATP}/config/bareme`), bareme);
        document.getElementById('atp-modal-bareme')?.remove();
    } catch (err) {
        alert('❌ Erreur : ' + err.message);
    }
};

window.atpResetBareme = function() {
    if (!confirm('Revenir au barème par défaut ?')) return;
    const baseATP = getATPBasePath(currentClasse);
    set(ref(db, `${baseATP}/config/bareme`), BAREME_DEFAUT).then(() => {
        document.getElementById('atp-modal-bareme')?.remove();
    });
};

// ============================================================
// ARCHIVAGE
// ============================================================
window.atpArchiver = async function() {
    const commentaire = prompt('Commentaire (optionnel) :', `Fin séance ${new Date().toLocaleDateString('fr-FR')}`);
    if (commentaire === null) return;

    // ✅ Recalcul à la volée (ne dépend jamais d'un état d'écran périmé).
    const codes = currentEleves.map(e => String(e.codeAutoEval)).filter(Boolean);
    const joueurs = recalculerTout(codes, currentMatchs, getBareme(currentConfig));
    const snapshot = genererSnapshot(joueurs);
    const baseATP = getATPBasePath(currentClasse);

    try {
        await push(ref(db, `${baseATP}/archives`), {
            timestamp: Date.now(),
            commentaire: commentaire || '',
            snapshot
        });
        alert('✅ Classement archivé !');
    } catch (err) {
        alert('❌ Erreur : ' + err.message);
    }
};

window.atpVoirArchives = function() {
    const baseATP = getATPBasePath(currentClasse);
    onValue(ref(db, `${baseATP}/archives`), snap => {
        const archives = snap.val() || {};
        const arr = Object.entries(archives)
            .map(([k, v]) => ({ ...v, _key: k }))
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        const elevesMap = elevesParCode(currentEleves);

        let html = '';
        if (arr.length === 0) {
            html = '<p class="text-slate-500 text-center py-6">Aucune archive.</p>';
        } else {
            arr.forEach(a => {
                const date = new Date(a.timestamp).toLocaleString('fr-FR');
                // Top 3 de l'archive
                const top3 = Object.entries(a.snapshot || {})
                    .map(([code, pts]) => ({ code, pts, eleve: elevesMap[code] }))
                    .sort((x, y) => y.pts - x.pts)
                    .slice(0, 3);

                html += `
                    <div class="bg-slate-900 p-3 rounded-xl border border-slate-700 mb-2">
                        <div class="flex justify-between items-center mb-2">
                            <div>
                                <div class="text-sm font-bold text-white">${a.commentaire || 'Archive'}</div>
                                <div class="text-[10px] text-slate-500">${date}</div>
                            </div>
                            <button onclick="window.atpExporterArchive('${a._key}')" class="bg-emerald-600 hover:bg-emerald-500 px-2 py-1 rounded text-xs font-black text-white">📄</button>
                            <button onclick="window.atpSupprimerArchive('${a._key}')" class="bg-red-600 hover:bg-red-500 px-2 py-1 rounded text-xs font-black text-white">🗑️</button>
                        </div>
                        <div class="text-xs text-slate-400">
                            ${top3.map((t, i) => `${getMedaille(i+1)} ${t.eleve ? t.eleve.prenom + ' ' + t.eleve.nom : 'Code ' + t.code} (${t.pts} pts)`).join(' · ')}
                        </div>
                    </div>`;
            });
        }

        const modal = document.createElement('div');
        modal.id = 'atp-modal-archives';
        modal.className = 'fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-lg max-h-[80vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-black text-blue-400 uppercase">📁 Archives</h3>
                    <button onclick="document.getElementById('atp-modal-archives').remove()" class="bg-slate-700 px-3 py-1.5 rounded-xl font-black text-xs text-white">✖</button>
                </div>
                ${html}
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    }, { onlyOnce: true });
};

window.atpExporterArchive = function(key) {
    if (!currentClasse) return alert('Sélectionnez une classe.');
    const baseATP = getATPBasePath(currentClasse);
    onValue(ref(db, `${baseATP}/archives/${key}`), snap => {
        const a = snap.val();
        if (!a) return alert('Archive introuvable.');
        const elevesMap = elevesParCode(currentEleves);
        const lignes = Object.entries(a.snapshot || {})
            .map(([code, pts]) => ({ code, pts: Number(pts) || 0, eleve: elevesMap[String(code)] }))
            .sort((x, y) => y.pts - x.pts);

        let csv = '\uFEFF"Rang";"Code";"Nom de famille";"Prénom";"Points"\n';
        lignes.forEach((l, i) => {
            csv += `"${i+1}";"${l.code}";"${l.eleve?.nom || ''}";"${l.eleve?.prenom || ''}";"${l.pts}"\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `ATP_Archive_${currentClasse}_${new Date(a.timestamp).toISOString().slice(0,10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, { onlyOnce: true });
};

window.atpSupprimerArchive = async function(key) {
    if (!confirm('Supprimer cette archive ?')) return;
    const baseATP = getATPBasePath(currentClasse);
    await remove(ref(db, `${baseATP}/archives/${key}`));
    document.getElementById('atp-modal-archives')?.remove();
    setTimeout(() => window.atpVoirArchives(), 100);
};

// ============================================================
// RESET
// ============================================================
window.atpReset = async function() {
    if (!confirm('⚠️ Supprimer TOUS les matchs de cette classe ?\nLe classement repartira à 100 pts pour tout le monde.')) return;
    if (!confirm('✅ Dernière confirmation ?')) return;

    const baseATP = getATPBasePath(currentClasse);
    try {
        await remove(ref(db, `${baseATP}/matchs`));
        alert('✅ Matchs supprimés.');
    } catch (err) {
        alert('❌ Erreur : ' + err.message);
    }
};

// ============================================================
// NETTOYAGE
// ============================================================
export function cleanup() {
    unsubs.forEach(u => { try { u(); } catch(e) {} });
    unsubs = [];
    currentEleves = [];
    currentMatchs = {};
    currentConfig = {};
    currentJoueursMap = {};
}

// Exposition
window.atpInitProf = initProf;