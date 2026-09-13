// src/js/modules/demi-fond/variantes/trois-cinq-min/trois-cinq-min-interface.js
// UI Professeur pour le sous-module 3x5min

import { db, ref, set, onValue } from '../../../../core/firebase-service.js';
import { getPhotoUrl, getExistingEleves, migrerCodesAutoEval } from '../../../../services/admin-service.js';
import { getCurrentClasse, getLocalMapping, setLocalMapping } from '../../../../core/live-engine.js';
import { COULEURS_GROUPES, getCouleurGroupe, getGroupesKey, getConfigKey, getBasePath, getVMAEleve } from '../../demifond-common.js';
import { DEFAUT_PARAMS, SOUS_MODULE_ID, TITRE_AFFICHE, repartirEnGroupes } from './trois-cinq-min-core.js';

let currentClasse = '';
let currentContainer = null;
let sortableInstances = [];
let _profChronoInterval = null;
let _profSequenceListener = null;

// ============================================================
// STATUTS (Absent / Inapte stockés par position)
// ============================================================
function getStatutsKey(classe) {
    return `eps_arena_demifond_statuts_${classe}`;
}

function getStatuts(classe) {
    return JSON.parse(localStorage.getItem(getStatutsKey(classe)) || '{}');
}

// ============================================================
// INITIALISATION
// ============================================================
export function initTroisCinqMinInterface(container) {
    if (!container) return;
    currentContainer = container;
    currentClasse = getCurrentClasse();

    // ✅ Migration automatique des codes
    if (currentClasse) {
        migrerCodesAutoEval(currentClasse);
    }

    container.innerHTML = '';

    container.appendChild(createHeader());
    container.appendChild(createParams());
    container.appendChild(createSequenceControls());   // ✅ Déplacé avant les groupes
    container.appendChild(createGroupesBlock());
    container.appendChild(createTransmissionButton());

    setTimeout(() => {
        restaurerParams();
        loadAffectations();
    }, 100);
}

// ============================================================
// EN-TÊTE
// ============================================================
function createHeader() {
    const div = document.createElement('div');
    div.className = 'bg-slate-800 p-4 rounded-2xl border border-slate-700';
    div.innerHTML = `
        <div class="flex justify-between items-center flex-wrap gap-2">
            <h3 class="font-black text-blue-400 uppercase text-sm">⏱️ ${TITRE_AFFICHE} — Configuration</h3>
            <div class="flex flex-wrap gap-2">
                <button onclick="window.troisCinqMinGenererGroupes()"
                        class="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-emerald-400 active:scale-95"
                        title="Réinitialise tout et distribue aléatoirement les élèves présents">
                    🔄 Répartition aléatoire
                </button>
                <button onclick="window.troisCinqMinViderGroupes()"
                        class="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-slate-500 active:scale-95"
                        title="Remet tous les élèves dans la réserve">
                    🗑️ Vider les groupes
                </button>
                <button onclick="window.troisCinqMinExportConfig()"
                        class="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-indigo-400 active:scale-95">
                    ⬇️ Export JSON
                </button>
                <button onclick="document.getElementById('dmfImportJSON').click()"
                        class="bg-slate-600 hover:bg-slate-500 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-slate-400 active:scale-95">
                    ⬆️ Import JSON
                </button>
                <button onclick="window.troisCinqMinGenererTest()"
        class="bg-pink-600 hover:bg-pink-500 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-pink-400 active:scale-95">
    🧪 Test (données bidons)
</button>
<button onclick="window.troisCinqMinNettoyerTest()"
        class="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-slate-500 active:scale-95">
    🗑️ Nettoyer observations
</button>
                <input type="file" id="dmfImportJSON" class="hidden" accept=".json" onchange="window.troisCinqMinImportConfig(event)">
            </div>
        </div>
    `;
    return div;
}

// ============================================================
// PARAMÉTRAGE
// ============================================================
function createParams() {
    const div = document.createElement('div');
    div.className = 'bg-slate-800 p-4 rounded-2xl border border-slate-700';
    div.innerHTML = `
        <h4 class="font-black text-blue-400 uppercase text-xs mb-3">⚙️ Paramétrage</h4>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-3">
            <div>
                <label class="block font-bold text-slate-400 uppercase mb-1">Durée course (s)</label>
                <input type="number" id="dmfDuree" value="${DEFAUT_PARAMS.duree}" min="60" max="900" step="30"
                       class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-center">
            </div>
            <div>
                <label class="block font-bold text-slate-400 uppercase mb-1">Pause (s)</label>
                <input type="number" id="dmfPause" value="${DEFAUT_PARAMS.pause}" min="30" max="600" step="30"
                       class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-center">
            </div>
            <div>
                <label class="block font-bold text-slate-400 uppercase mb-1">Anti-double-clic (s)</label>
                <input type="number" id="dmfAntiDouble" value="30" min="10" max="90" step="5"
                       class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-center">
            </div>
            <div>
                <label class="block font-bold text-slate-400 uppercase mb-1">Cible VMA (%)</label>
                <input type="number" id="dmfCibleVMA" value="90" min="50" max="100" step="5"
                       class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-center">
            </div>
            <div>
                <label class="block font-bold text-slate-400 uppercase mb-1">Longueur tour (m)</label>
                <input type="number" id="dmfTour" value="${DEFAUT_PARAMS.tour}" min="50" max="500" step="10"
                       class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-center">
            </div>
            <div>
                <label class="block font-bold text-slate-400 uppercase mb-1">Plots par tour</label>
                <input type="number" id="dmfPlots" value="${DEFAUT_PARAMS.plots}" min="1" max="16"
                       class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-center">
            </div>
            <div>
                <label class="block font-bold text-slate-400 uppercase mb-1">Nb groupes (1-4)</label>
                <select id="dmfNbGroupes" class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-center" onchange="window.troisCinqMinChangeNbGroupes()">
                    <option value="1">1 groupe</option>
                    <option value="2" selected>2 groupes</option>
                    <option value="3">3 groupes</option>
                    <option value="4">4 groupes</option>
                </select>
            </div>
            <div class="flex items-end">
                <label class="flex items-center gap-2 font-bold text-slate-400 uppercase text-xs w-full cursor-pointer">
                    <input type="checkbox" id="dmfEnchainementAuto" class="w-4 h-4" checked>
                    Enchaînement auto
                </label>
            </div>
        </div>
    `;
    return div;
}

// ============================================================
// CONTRÔLE DE SÉQUENCE + CHRONO PROF
// ============================================================
function createSequenceControls() {
    const div = document.createElement('div');
    div.className = 'space-y-3';

    // ✅ BANDEAU CHRONO
    const chronoDiv = document.createElement('div');
    chronoDiv.className = 'bg-slate-900 p-4 rounded-2xl border-2 border-blue-500/40';
    chronoDiv.innerHTML = `
        <div class="flex justify-between items-center">
            <div>
                <div class="text-[10px] uppercase text-slate-400 font-bold">Phase actuelle</div>
                <div id="dmf-prof-phase" class="text-2xl font-black text-white">—</div>
            </div>
            <div class="text-center">
                <div class="text-[10px] uppercase text-slate-400 font-bold">Séquence</div>
                <div id="dmf-prof-seq" class="text-lg font-black text-slate-300">idle</div>
            </div>
            <div class="text-right">
                <div class="text-[10px] uppercase text-slate-400 font-bold">Temps restant</div>
                <div id="dmf-prof-temps" class="text-4xl font-mono font-black text-yellow-400">--:--</div>
            </div>
        </div>
    `;
    div.appendChild(chronoDiv);

    // ✅ BOUTONS
    const btns = document.createElement('div');
    btns.className = 'bg-slate-800 p-4 rounded-2xl border-2 border-blue-500/40';
    btns.innerHTML = `
        <h4 class="font-black text-blue-400 uppercase text-xs mb-3">🚀 Contrôle de la séquence</h4>
        <p class="text-[11px] text-slate-400 mb-3">Un seul GO lance la séquence complète (3 courses + pauses).</p>
        <div class="flex flex-wrap gap-2">
            <button onclick="window.troisCinqMinGo()"
                    class="flex-1 min-w-[140px] bg-emerald-600 hover:bg-emerald-500 py-4 rounded-2xl font-black text-base uppercase text-white border-4 border-emerald-400 active:scale-95 shadow-[0_0_15px_rgba(34,197,94,0.5)]">
                🚀 GO
            </button>
            <button onclick="window.troisCinqMinPauseManuelle()"
                    class="bg-amber-600 hover:bg-amber-500 px-4 py-4 rounded-2xl font-black text-sm uppercase text-white active:scale-95">
                ⏸️ Pause
            </button>
            <button onclick="window.troisCinqMinReprendre()"
                    class="bg-blue-600 hover:bg-blue-500 px-4 py-4 rounded-2xl font-black text-sm uppercase text-white active:scale-95">
                ▶️ Reprendre
            </button>
            <button onclick="window.troisCinqMinSkipCourse()"
                    class="bg-slate-600 hover:bg-slate-500 px-4 py-4 rounded-2xl font-black text-sm uppercase text-white active:scale-95">
                ⏭️ Skip
            </button>
            <button onclick="window.troisCinqMinStop()"
                    class="bg-red-600 hover:bg-red-500 px-4 py-4 rounded-2xl font-black text-sm uppercase text-white active:scale-95">
                🛑 Stop
            </button>
        </div>
        <div id="dmfSequenceState" class="mt-3 text-xs text-slate-400 text-center">
            État : <span class="font-black text-white">idle</span>
        </div>
    `;
    div.appendChild(btns);

    setTimeout(() => initProfChrono(), 100);
    return div;
}

// ============================================================
// CHRONO PROF (bandeau)
// ============================================================
function initProfChrono() {
    if (!currentClasse) return;

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const seqRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/demi-fond/commandes/sequence`);

    let currentSeq = null;

    if (_profSequenceListener) _profSequenceListener();
    _profSequenceListener = onValue(seqRef, (snap) => {
        currentSeq = snap.val();
        if (currentSeq) {
            const seqEl = document.getElementById('dmf-prof-seq');
            if (seqEl) seqEl.textContent = currentSeq.etat || '—';
        }
    });

    if (_profChronoInterval) clearInterval(_profChronoInterval);
    _profChronoInterval = setInterval(() => {
        const phaseEl = document.getElementById('dmf-prof-phase');
        const tempsEl = document.getElementById('dmf-prof-temps');
        if (!phaseEl || !tempsEl) return;

        const config = JSON.parse(localStorage.getItem(getConfigKey(currentClasse, SOUS_MODULE_ID)) || 'null');
        if (!config || !currentSeq || !currentSeq.timestampDebut || currentSeq.etat === 'idle' || currentSeq.etat === 'termine') {
            phaseEl.textContent = currentSeq?.etat === 'termine' ? '🏆 TERMINÉ' : '—';
            tempsEl.textContent = '--:--';
            return;
        }

        const elapsed = (Date.now() - currentSeq.timestampDebut) / 1000;
        const duree = config.duree;
        const pause = config.pause;

        let phaseLabel = '', restant = 0;

        if (elapsed < duree) {
            phaseLabel = '🏃 COURSE 1';
            restant = duree - elapsed;
        } else if (elapsed < duree + pause) {
            phaseLabel = '⏸️ PAUSE 1';
            restant = duree + pause - elapsed;
        } else if (elapsed < 2 * duree + pause) {
            phaseLabel = '🏃 COURSE 2';
            restant = 2 * duree + pause - elapsed;
        } else if (elapsed < 2 * duree + 2 * pause) {
            phaseLabel = '⏸️ PAUSE 2';
            restant = 2 * duree + 2 * pause - elapsed;
        } else if (elapsed < 3 * duree + 2 * pause) {
            phaseLabel = '🏃 COURSE 3';
            restant = 3 * duree + 2 * pause - elapsed;
        } else {
            phaseLabel = '🏆 TERMINÉ';
            restant = 0;
        }

        phaseEl.textContent = phaseLabel;
        const m = Math.floor(restant / 60);
        const s = Math.floor(restant % 60);
        tempsEl.textContent = `${m}:${String(s).padStart(2, '0')}`;
    }, 500);
}

// ============================================================
// GROUPES (Réserve + Groupes)
// ============================================================
function createGroupesBlock() {
    const div = document.createElement('div');
    div.className = 'bg-slate-800 p-4 rounded-2xl border border-slate-700';
    div.innerHTML = `
        <h4 class="font-bold text-slate-400 uppercase text-xs mb-3">👥 Répartition des élèves</h4>
        <p class="text-[10px] text-slate-500 mb-3">💡 Glisse un élève dans Absents ou Inaptes pour définir son statut.</p>

        <!-- ABSENTS / INAPTES -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div class="bg-slate-900 p-3 rounded-2xl border-2 border-dashed border-red-700/50">
                <div class="text-xs font-bold text-red-400 uppercase mb-2">🚫 Absents</div>
                <div id="dmfReserveAbsents" class="dmf-reserve flex flex-col gap-1 min-h-[60px] border border-red-800/30 rounded-lg p-1"></div>
            </div>
            <div class="bg-slate-900 p-3 rounded-2xl border-2 border-dashed border-orange-700/50">
                <div class="text-xs font-bold text-orange-400 uppercase mb-2">⚠️ Inaptes</div>
                <div id="dmfReserveInaptes" class="dmf-reserve flex flex-col gap-1 min-h-[60px] border border-orange-800/30 rounded-lg p-1"></div>
            </div>
        </div>

        <!-- PRÉSENTS -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div class="bg-slate-900 p-3 rounded-2xl border-2 border-dashed border-blue-700/50">
                <div class="text-xs font-bold text-blue-400 uppercase mb-2">👦 Présents - Garçons</div>
                <div id="dmfReserveGarcons" class="dmf-reserve flex flex-col gap-1 min-h-[80px] border border-blue-800/30 rounded-lg p-1"></div>
            </div>
            <div class="bg-slate-900 p-3 rounded-2xl border-2 border-dashed border-rose-700/50">
                <div class="text-xs font-bold text-rose-400 uppercase mb-2">👩 Présentes - Filles</div>
                <div id="dmfReserveFilles" class="dmf-reserve flex flex-col gap-1 min-h-[80px] border border-rose-800/30 rounded-lg p-1"></div>
            </div>
        </div>

        <!-- GROUPES -->
        <div id="dmfGroupesGrid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3"></div>
    `;
    return div;
}

// ============================================================
// BOUTON TRANSMISSION
// ============================================================
function createTransmissionButton() {
    const div = document.createElement('div');
    div.innerHTML = `
        <button onclick="window.troisCinqMinTransmettre()"
                class="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-black text-base uppercase tracking-widest text-white border-4 border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.5)] active:scale-[0.98]">
            📡 Transmettre aux iPads Élèves
        </button>
    `;
    return div;
}

// ============================================================
// CARTE ÉLÈVE
// ============================================================
async function createEleveCard(eleve) {
    const url = await getPhotoUrl(eleve.id);
    let bgClass = 'bg-slate-200 border-slate-400';
    if (eleve.sexe === 'M') bgClass = 'bg-blue-200 border-blue-400';
    else if (eleve.sexe === 'F') bgClass = 'bg-rose-200 border-rose-400';

    const photoHtml = url
        ? `<img src="${url}" class="w-8 h-8 rounded-full object-cover border-2 border-slate-500">`
        : `<div class="w-8 h-8 rounded-full bg-slate-400 flex items-center justify-center text-base">👤</div>`;

    const vma = getVMAEleve(currentClasse, eleve.id);
    const vmaHtml = vma
        ? `<span class="text-[9px] text-emerald-600 font-bold">VMA ${vma}</span>`
        : `<span class="text-[9px] text-amber-600 font-bold">⚠️ VMA ?</span>`;

    const div = document.createElement('div');
    div.className = `dmf-eleve-card p-2 rounded-lg border-2 cursor-grab active:cursor-grabbing flex items-center gap-2 ${bgClass}`;
    div.dataset.id = eleve.id;
    div.innerHTML = `
        ${photoHtml}
        <div class="flex flex-col leading-tight flex-1 min-w-0">
            <span class="font-black text-slate-900 text-xs truncate">${eleve.prenom}</span>
            <span class="text-[10px] font-bold text-slate-600 uppercase truncate">${eleve.nom}</span>
            ${vmaHtml}
        </div>
        <span class="num-badge bg-slate-900 text-white text-[10px] font-black px-1.5 py-0.5 rounded hidden"></span>
    `;
    return div;
}

// ============================================================
// GÉNÉRATION DES GROUPES (aléatoire)
// ============================================================
window.troisCinqMinGenererGroupes = async function() {
    if (!currentClasse) return alert('Sélectionne une classe.');
    const eleves = getExistingEleves(currentClasse);
    if (eleves.length === 0) return alert('Aucun élève.');

    const nbGroupes = parseInt(document.getElementById('dmfNbGroupes')?.value) || 2;
    const statuts = getStatuts(currentClasse);

    const presents = eleves.filter(e => (statuts[e.id] || 'present') === 'present');
    if (presents.length === 0) return alert('Aucun élève présent.');

    const sansVMA = presents.filter(e => !getVMAEleve(currentClasse, e.id));
    if (sansVMA.length > 0) {
        if (!confirm(`${sansVMA.length} élève(s) n'ont pas de VMA.\nContinuer quand même ?`)) return;
    }

    const groupes = repartirEnGroupes(presents, nbGroupes);

    COULEURS_GROUPES.forEach(c => {
        if (!groupes[c.id]) groupes[c.id] = [];
    });

    sauvegarderGroupes(groupes);
    await refreshAll();
    alert(`✅ ${nbGroupes} groupes générés (${presents.length} élèves).`);
};

window.troisCinqMinViderGroupes = async function() {
    if (!confirm('Remettre tous les élèves dans la réserve ?')) return;
    sauvegarderGroupes({});
    await refreshAll();
};

window.troisCinqMinChangeNbGroupes = function() {
    renderGroupesEtReserve();
};

// ============================================================
// SAUVEGARDE / CHARGEMENT
// ============================================================
function sauvegarderGroupes(groupes) {
    localStorage.setItem(getGroupesKey(currentClasse, SOUS_MODULE_ID), JSON.stringify(groupes));
}

function chargerGroupes() {
    const g = JSON.parse(localStorage.getItem(getGroupesKey(currentClasse, SOUS_MODULE_ID)) || 'null');
    if (!g) return {};
    COULEURS_GROUPES.forEach(c => {
        if (!g[c.id]) g[c.id] = [];
    });
    return g;
}

// ============================================================
// RENDU GLOBAL
// ============================================================
async function refreshAll() {
    await renderGroupesEtReserve();
}

async function renderGroupesEtReserve() {
    const groupes = chargerGroupes();
    const eleves = getExistingEleves(currentClasse);
    const statuts = getStatuts(currentClasse);
    const nbGroupes = parseInt(document.getElementById('dmfNbGroupes')?.value) || 2;

    // ---- GROUPES ----
    const grid = document.getElementById('dmfGroupesGrid');
    if (grid) {
        let html = '';
        COULEURS_GROUPES.slice(0, nbGroupes).forEach(couleur => {
            const membres = groupes[couleur.id] || [];
            html += `
                <div class="flex flex-col">
                    <div class="header-col text-center py-2 rounded-t-lg font-black text-sm uppercase"
                         style="background:${couleur.bg}; color:${couleur.text}; border:2px solid ${couleur.border}; border-bottom:none;">
                        ${couleur.label} <span class="text-[10px] opacity-70">(${membres.length})</span>
                    </div>
                    <div class="dmf-groupe-members flex flex-col gap-1 p-2 rounded-b-lg min-h-[80px]"
                         data-couleur="${couleur.id}"
                         style="background:#0f172a; border:2px solid ${couleur.border}; border-top:none;">
                    </div>
                </div>
            `;
        });
        grid.innerHTML = html;

        for (const couleur of COULEURS_GROUPES.slice(0, nbGroupes)) {
            const ids = groupes[couleur.id] || [];
            const cont = grid.querySelector(`.dmf-groupe-members[data-couleur="${couleur.id}"]`);
            if (!cont) continue;
            for (const id of ids) {
                const eleve = eleves.find(e => e.id === id);
                if (eleve) cont.appendChild(await createEleveCard(eleve));
            }
        }
    }

    // ---- RÉSERVES ----
    const placedInGroups = new Set();
    Object.values(groupes).forEach(arr => arr.forEach(id => placedInGroups.add(id)));

    const resGarcons = document.getElementById('dmfReserveGarcons');
    const resFilles = document.getElementById('dmfReserveFilles');
    const resAbsents = document.getElementById('dmfReserveAbsents');
    const resInaptes = document.getElementById('dmfReserveInaptes');

    if (resGarcons) resGarcons.innerHTML = '';
    if (resFilles) resFilles.innerHTML = '';
    if (resAbsents) resAbsents.innerHTML = '';
    if (resInaptes) resInaptes.innerHTML = '';

    for (const e of eleves) {
        const isPlaced = placedInGroups.has(e.id);
        if (isPlaced) continue;

        const statut = statuts[e.id] || 'present';

        if (statut === 'absent') {
            if (resAbsents) resAbsents.appendChild(await createEleveCard(e));
        } else if (statut === 'inapte') {
            if (resInaptes) resInaptes.appendChild(await createEleveCard(e));
        } else {
            if (e.sexe === 'F') {
                if (resFilles) resFilles.appendChild(await createEleveCard(e));
            } else {
                if (resGarcons) resGarcons.appendChild(await createEleveCard(e));
            }
        }
    }

    if (resGarcons && resGarcons.children.length === 0) resGarcons.innerHTML = '<p class="text-slate-500 text-xs italic">Aucun</p>';
    if (resFilles && resFilles.children.length === 0) resFilles.innerHTML = '<p class="text-slate-500 text-xs italic">Aucune</p>';
    if (resAbsents && resAbsents.children.length === 0) resAbsents.innerHTML = '<p class="text-slate-500 text-xs italic">Aucun</p>';
    if (resInaptes && resInaptes.children.length === 0) resInaptes.innerHTML = '<p class="text-slate-500 text-xs italic">Aucun</p>';

    updateNumBadges();
    setTimeout(() => initSortable(), 50);
}

// ============================================================
// SORTABLE
// ============================================================
function initSortable() {
    if (typeof Sortable === 'undefined') {
        console.warn('[DemiFond] Sortable non disponible');
        return;
    }

    sortableInstances.forEach(s => { try { s.destroy(); } catch (e) {} });
    sortableInstances = [];

    document.querySelectorAll('.dmf-reserve').forEach(el => {
        const s = new Sortable(el, {
            group: 'demifond-groups',
            animation: 150,
            onEnd: () => {
                saveAffectations();
                updateNumBadges();
                setTimeout(() => refreshAll(), 50);
            }
        });
        sortableInstances.push(s);
    });

    document.querySelectorAll('.dmf-groupe-members').forEach(el => {
        const s = new Sortable(el, {
            group: 'demifond-groups',
            animation: 150,
            onEnd: () => {
                saveAffectations();
                updateNumBadges();
                setTimeout(() => refreshAll(), 50);
            }
        });
        sortableInstances.push(s);
    });

    console.log(`[DemiFond] Sortable init : ${sortableInstances.length} instances`);
}

function updateNumBadges() {
    const eleves = getExistingEleves(currentClasse);
    document.querySelectorAll('.dmf-eleve-card').forEach(card => {
        const id = card.dataset.id;
        const eleve = eleves.find(e => e.id === id);
        const badge = card.querySelector('.num-badge');
        if (badge && eleve?.codeAutoEval) {
            badge.textContent = `#${eleve.codeAutoEval}`;
            badge.classList.remove('hidden');
        }
    });
}

// ============================================================
// SAUVEGARDE DES AFFECTATIONS
// ============================================================
function saveAffectations() {
    const groupes = {};
    COULEURS_GROUPES.forEach(c => { groupes[c.id] = []; });

    document.querySelectorAll('.dmf-groupe-members').forEach(container => {
        const couleur = container.dataset.couleur;
        container.querySelectorAll('.dmf-eleve-card').forEach(card => {
            groupes[couleur].push(card.dataset.id);
        });
    });

    sauvegarderGroupes(groupes);

    const statuts = {};
    document.querySelectorAll('#dmfReserveAbsents .dmf-eleve-card').forEach(card => {
        statuts[card.dataset.id] = 'absent';
    });
    document.querySelectorAll('#dmfReserveInaptes .dmf-eleve-card').forEach(card => {
        statuts[card.dataset.id] = 'inapte';
    });

    localStorage.setItem(getStatutsKey(currentClasse), JSON.stringify(statuts));
}

async function loadAffectations() {
    await renderGroupesEtReserve();
}

// ============================================================
// PARAMS
// ============================================================
function sauvegarderParams() {
    const params = {
        duree: parseInt(document.getElementById('dmfDuree')?.value) || DEFAUT_PARAMS.duree,
        pause: parseInt(document.getElementById('dmfPause')?.value) || DEFAUT_PARAMS.pause,
        antiDoubleClic: (parseInt(document.getElementById('dmfAntiDouble')?.value) || 30) * 1000,
        cibleVMA: (parseInt(document.getElementById('dmfCibleVMA')?.value) || 90) / 100,
        tour: parseInt(document.getElementById('dmfTour')?.value) || DEFAUT_PARAMS.tour,
        plots: parseInt(document.getElementById('dmfPlots')?.value) || DEFAUT_PARAMS.plots,
        nbGroupes: parseInt(document.getElementById('dmfNbGroupes')?.value) || 2,
        enchainementAuto: document.getElementById('dmfEnchainementAuto')?.checked !== false
    };
    localStorage.setItem(getConfigKey(currentClasse, SOUS_MODULE_ID), JSON.stringify(params));
    return params;
}

function restaurerParams() {
    const saved = JSON.parse(localStorage.getItem(getConfigKey(currentClasse, SOUS_MODULE_ID)) || 'null');
    if (!saved) return;
    const $ = id => document.getElementById(id);
    if (saved.duree) $('dmfDuree').value = saved.duree;
    if (saved.pause) $('dmfPause').value = saved.pause;
    if (saved.antiDoubleClic) $('dmfAntiDouble').value = saved.antiDoubleClic / 1000;
    if (saved.cibleVMA) $('dmfCibleVMA').value = Math.round(saved.cibleVMA * 100);
    if (saved.tour) $('dmfTour').value = saved.tour;
    if (saved.plots) $('dmfPlots').value = saved.plots;
    if (saved.nbGroupes) $('dmfNbGroupes').value = saved.nbGroupes;
    if (saved.enchainementAuto !== undefined) $('dmfEnchainementAuto').checked = saved.enchainementAuto;
}

// ============================================================
// CONTRÔLES DE SÉQUENCE
// ============================================================
window.troisCinqMinGo = async function() {
    if (!currentClasse) return alert('Sélectionne une classe.');
    const params = sauvegarderParams();
    const groupes = chargerGroupes();
    if (!groupes || Object.values(groupes).every(arr => arr.length === 0)) {
        return alert('Génère d\'abord les groupes.');
    }

    const eleves = getExistingEleves(currentClasse);
    const localMapping = {};
    const vmaParCode = {};
    const configData = {
        sousModule: SOUS_MODULE_ID,
        duree: params.duree,
        pause: params.pause,
        nbCourses: 3,
        tour: params.tour,
        plots: params.plots,
        antiDoubleClic: params.antiDoubleClic,
        cibleVMA: params.cibleVMA,
        enchainementAuto: params.enchainementAuto,
        vmaParCode: {},
        groupes: {}
    };

    COULEURS_GROUPES.forEach(c => {
        const ids = groupes[c.id] || [];
        const codes = [];
        ids.forEach(id => {
            const eleve = eleves.find(e => e.id === id);
            if (eleve?.codeAutoEval) {
                codes.push(eleve.codeAutoEval);
                localMapping[`${currentClasse}_${c.id}_${eleve.codeAutoEval}`] = id;
                const vma = getVMAEleve(currentClasse, id);
                if (vma) vmaParCode[eleve.codeAutoEval] = vma;
            }
        });
        configData.groupes[c.id] = codes;
    });
    configData.vmaParCode = vmaParCode;

    const existing = getLocalMapping(currentClasse) || {};
    setLocalMapping(currentClasse, { ...existing, ...localMapping });

    try {
        const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
        await set(ref(db, `${getBasePath(currentClasse)}/config`), configData);
        await set(ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/config`), { activite: 'demi-fond' });

        await set(ref(db, `${getBasePath(currentClasse)}/commandes/sequence`), {
            etat: 'actif',
            timestampDebut: Date.now(),
            action: 'go',
            actionTimestamp: Date.now()
        });

        const stateEl = document.getElementById('dmfSequenceState');
        if (stateEl) stateEl.innerHTML = 'État : <span class="font-black text-emerald-400">COURSE 1</span>';
        alert('🚀 GO ! La séquence démarre.');
    } catch (err) {
        console.error(err);
        alert('❌ Erreur : ' + err.message);
    }
};

window.troisCinqMinPauseManuelle = async function() {
    if (!currentClasse) return;
    const seqRef = ref(db, `${getBasePath(currentClasse)}/commandes/sequence`);
    onValue(seqRef, async (snap) => {
        const seq = snap.val() || {};
        await set(seqRef, {
            ...seq,
            etat: 'pause_manuelle',
            pauseDebut: Date.now(),
            action: 'pause',
            actionTimestamp: Date.now()
        });
        alert('⏸️ Séquence en pause.');
    }, { onlyOnce: true });
};

window.troisCinqMinReprendre = async function() {
    if (!currentClasse) return;
    const seqRef = ref(db, `${getBasePath(currentClasse)}/commandes/sequence`);
    onValue(seqRef, async (snap) => {
        const seq = snap.val() || {};
        if (seq.etat !== 'pause_manuelle' || !seq.pauseDebut) {
            alert('Aucune pause manuelle en cours.');
            return;
        }
        const dureePause = Date.now() - seq.pauseDebut;
        await set(seqRef, {
            ...seq,
            etat: 'actif',
            timestampDebut: (seq.timestampDebut || Date.now()) + dureePause,
            pauseDebut: null,
            action: 'reprendre',
            actionTimestamp: Date.now()
        });
        alert('▶️ Séquence reprise.');
    }, { onlyOnce: true });
};

window.troisCinqMinSkipCourse = async function() {
    if (!currentClasse) return;
    if (!confirm('Passer à la course suivante ?')) return;
    const seqRef = ref(db, `${getBasePath(currentClasse)}/commandes/sequence`);
    const config = JSON.parse(localStorage.getItem(getConfigKey(currentClasse, SOUS_MODULE_ID)) || 'null');
    if (!config) return;

    onValue(seqRef, async (snap) => {
        const seq = snap.val() || {};
        const elapsed = seq.timestampDebut ? (Date.now() - seq.timestampDebut) / 1000 : 0;
        const duree = config.duree;
        const pause = config.pause;

        let courseActuelle = 1;
        if (elapsed >= 2 * duree + pause) courseActuelle = 3;
        else if (elapsed >= duree + pause) courseActuelle = 2;

        const prochainNum = Math.min(courseActuelle + 1, 3);
        const nouveauDebutSec = (prochainNum - 1) * (duree + pause);
        const nouveauTimestamp = Date.now() - nouveauDebutSec * 1000;

        await set(seqRef, {
            ...seq,
            etat: 'actif',
            timestampDebut: nouveauTimestamp,
            action: 'skip',
            actionTimestamp: Date.now()
        });
        alert(`⏭️ Passage à la course ${prochainNum}.`);
    }, { onlyOnce: true });
};

window.troisCinqMinStop = async function() {
    if (!currentClasse) return;
    if (!confirm('Arrêter la séquence ?')) return;
    const seqRef = ref(db, `${getBasePath(currentClasse)}/commandes/sequence`);
    onValue(seqRef, async (snap) => {
        const seq = snap.val() || {};
        await set(seqRef, {
            ...seq,
            etat: 'termine',
            action: 'stop',
            actionTimestamp: Date.now()
        });
        alert('🛑 Séquence terminée.');
    }, { onlyOnce: true });
};

// ============================================================
// TRANSMISSION
// ============================================================
window.troisCinqMinTransmettre = async function() {
    if (!currentClasse) return alert('Sélectionne une classe.');
    const params = sauvegarderParams();
    const groupes = chargerGroupes();

    if (!groupes || Object.values(groupes).every(arr => arr.length === 0)) {
        return alert('Génère d\'abord les groupes.');
    }

    const localMapping = {};
    const vmaParCode = {};
    const configData = {
        sousModule: SOUS_MODULE_ID,
        duree: params.duree,
        pause: params.pause,
        nbCourses: 3,
        tour: params.tour,
        plots: params.plots,
        antiDoubleClic: params.antiDoubleClic,
        cibleVMA: params.cibleVMA,
        enchainementAuto: params.enchainementAuto,
        vmaParCode: {},
        groupes: {}
    };

        // ✅ S'assurer que tous les élèves ont un codeAutoEval
    migrerCodesAutoEval(currentClasse);
    const eleves = getExistingEleves(currentClasse);
    const sansCode = eleves.filter(e => !e.codeAutoEval);
    if (sansCode.length > 0) {
        alert(`⚠️ ${sansCode.length} élève(s) n'ont pas de code d'auto-évaluation.\n\nVa dans Administration → 🔢 Codes élèves pour les attribuer.`);
        return;
    }
    COULEURS_GROUPES.forEach(c => {
        const ids = groupes[c.id] || [];
        const codes = [];
        ids.forEach(id => {
            const eleve = eleves.find(e => e.id === id);
            if (eleve?.codeAutoEval) {
                codes.push(eleve.codeAutoEval);
                localMapping[`${currentClasse}_${c.id}_${eleve.codeAutoEval}`] = id;
                const vma = getVMAEleve(currentClasse, id);
                if (vma) vmaParCode[eleve.codeAutoEval] = vma;
            }
        });
        configData.groupes[c.id] = codes;
    });
    configData.vmaParCode = vmaParCode;

    const existing = getLocalMapping(currentClasse) || {};
    setLocalMapping(currentClasse, { ...existing, ...localMapping });

    try {
        const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
        await set(ref(db, `${getBasePath(currentClasse)}/config`), configData);
        await set(ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/config`), { activite: 'demi-fond' });
        await set(ref(db, `etablissements/0680013V/profs/${profCode}/active_classes/${currentClasse}`), true);
        await set(ref(db, `${getBasePath(currentClasse)}/commandes/sequence`), {
            etat: 'idle', timestampMaj: Date.now()
        });

        const nbEleves = Object.values(configData.groupes).reduce((a, b) => a + b.length, 0);
        const nbVMA = Object.keys(vmaParCode).length;
        alert(`✅ Configuration transmise.\n${Object.keys(configData.groupes).length} groupes · ${nbEleves} élèves · ${nbVMA} VMA connues.`);
    } catch (err) {
        console.error(err);
        alert('❌ Erreur : ' + err.message);
    }
};

// ============================================================
// EXPORT / IMPORT JSON
// ============================================================
window.troisCinqMinExportConfig = function() {
    if (!currentClasse) return alert('Sélectionne une classe.');
    const data = {
        version: 1,
        classe: currentClasse,
        sousModule: SOUS_MODULE_ID,
        date: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
        params: JSON.parse(localStorage.getItem(getConfigKey(currentClasse, SOUS_MODULE_ID)) || '{}'),
        groupes: chargerGroupes() || {},
        statuts: getStatuts(currentClasse) || {}
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${currentClasse}_3x5min_${data.date}.json`;
    a.click();
};

window.troisCinqMinImportConfig = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.classe) throw new Error('Format invalide');
            localStorage.setItem(getGroupesKey(data.classe, SOUS_MODULE_ID), JSON.stringify(data.groupes || {}));
            localStorage.setItem(getConfigKey(data.classe, SOUS_MODULE_ID), JSON.stringify(data.params || {}));
            if (data.statuts) {
                localStorage.setItem(getStatutsKey(data.classe), JSON.stringify(data.statuts));
            }

            const select = document.getElementById('selectClasse');
            if (select && select.value !== data.classe) {
                select.value = data.classe;
                select.dispatchEvent(new Event('change'));
            } else {
                initDemiFondInterface();
            }
            alert('✅ Configuration importée !');
        } catch (err) {
            alert('❌ Erreur : ' + err.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
};
// ============================================================
// GÉNÉRATION DE DONNÉES TEST
// ============================================================
window.troisCinqMinGenererTest = async function() {
    if (!currentClasse) return alert('Sélectionne une classe.');

    const groupes = chargerGroupes();
    if (!groupes || Object.values(groupes).every(arr => arr.length === 0)) {
        return alert('Génère d\'abord les groupes.');
    }

    if (!confirm('⚠️ Générer des observations bidons pour TOUS les élèves ?\n\nCela va simuler 3 courses complètes avec clics et partiels.\n\nLa configuration actuelle (durée, pause, plots) sera utilisée.')) {
        return;
    }

    const config = JSON.parse(localStorage.getItem(getConfigKey(currentClasse, SOUS_MODULE_ID)) || 'null') || DEFAUT_PARAMS;
    const eleves = getExistingEleves(currentClasse);
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const basePath = getBasePath(currentClasse);

    const duree = config.duree;
    const tour = config.tour;
    const plots = config.plots;

    let nbObservations = 0;

    // Pour chaque couleur
    for (const couleur of Object.keys(groupes)) {
        const codes = groupes[couleur] || [];
        if (codes.length === 0) continue;

        for (const code of codes) {
            // Générer des données réalistes selon le profil de l'élève
            const eleve = eleves.find(e => e.codeAutoEval === code);
            const vma = eleve ? getVMAEleve(currentClasse, eleve.id) : null;

            // Profil aléatoire : 20% très bon, 50% moyen, 30% faible
            const profil = Math.random();
            let vitesseCible; // en km/h
            if (profil < 0.2) vitesseCible = (vma || 13) * 0.95;      // très bon
            else if (profil < 0.7) vitesseCible = (vma || 12) * 0.85; // moyen
            else vitesseCible = (vma || 11) * 0.75;                   // faible

            // Parfois abandon (5%)
            const abandon = Math.random() < 0.05 ? (Math.random() < 0.5 ? 'blessure' : 'mental') : null;
            const abandonCourse = abandon ? (1 + Math.floor(Math.random() * 3)) : null;

            // 3 courses avec une variation d'allure
            for (let courseNum = 1; courseNum <= 3; courseNum++) {
                // Variation d'allure
                let facteur = 1;
                if (profil >= 0.2 && profil < 0.7) {
                    // Profil moyen : allure constante
                    facteur = 1;
                } else if (profil < 0.2) {
                    // Bon profil : allure croissante
                    facteur = 1 + (courseNum - 1) * 0.05;
                } else {
                    // Faible profil : allure décroissante
                    facteur = 1 - (courseNum - 1) * 0.08;
                }

                const vitesseCourse = vitesseCible * facteur;
                const distanceTotale = (vitesseCourse / 3.6) * duree;

                if (abandon && courseNum === abandonCourse) {
                    // Abandon : moitié du temps seulement
                    const distancePartielle = distanceTotale * (0.3 + Math.random() * 0.4);
                    await genererObservationCourse(basePath, courseNum, code, {
                        duree,
                        tour,
                        plots,
                        distance: distancePartielle,
                        abandon,
                        regulier: false
                    });
                    nbObservations++;
                } else if (abandon && courseNum > abandonCourse) {
                    // Après l'abandon, pas de course
                    continue;
                } else {
                    await genererObservationCourse(basePath, courseNum, code, {
                        duree,
                        tour,
                        plots,
                        distance: distanceTotale,
                        abandon: null,
                        regulier: profil >= 0.2 && profil < 0.7
                    });
                    nbObservations++;
                }
            }
        }
    }

    alert(`✅ ${nbObservations} observations générées.\n\nVa sur le kiosque élève, connecte-toi à une couleur, puis passe en mode "séquence terminée" pour tester le bilan.`);
};

async function genererObservationCourse(basePath, courseNum, code, options) {
    const { duree, tour, plots, distance, abandon, regulier } = options;

    if (abandon) {
        // Abandon : quelques tours puis arrêt
        const nbToursAvantAbandon = Math.max(1, Math.floor((distance / tour)));
        const timestamps = genererTimestamps(nbToursAvantAbandon, duree, tour, distance / nbToursAvantAbandon, regulier);
        const partiel = 0;

        await set(ref(db, `${basePath}/observations/course-${courseNum}/${code}`), {
            timestamps,
            partiel,
            abandon,
            duree,
            tour,
            plots,
            timestamp: Date.now()
        });
        return;
    }

    // Course normale : atteindre la distance cible
    const nbToursComplets = Math.floor(distance / tour);
    const distanceRestante = distance - (nbToursComplets * tour);
    const distanceParPlot = tour / plots;
    const partiel = Math.min(plots, Math.round(distanceRestante / distanceParPlot));

    // Générer les timestamps (temps de chaque tour)
    const tempsMoyenParTour = duree / (nbToursComplets + partiel / plots);
    const timestamps = [];
    let tempsCumule = 0;

    for (let i = 0; i < nbToursComplets; i++) {
        // Variation entre -10% et +10% si pas régulier, sinon -3% / +3%
        const variation = regulier
            ? (Math.random() - 0.5) * 0.06
            : (Math.random() - 0.5) * 0.2;
        const tempsTour = tempsMoyenParTour * (1 + variation);
        tempsCumule += tempsTour * 1000;
        if (tempsCumule < duree * 1000) {
            timestamps.push(Math.round(tempsCumule));
        }
    }

    await set(ref(db, `${basePath}/observations/course-${courseNum}/${code}`), {
        timestamps,
        partiel,
        abandon: null,
        duree,
        tour,
        plots,
        timestamp: Date.now()
    });
}

function genererTimestamps(nbTours, duree, tour, distanceParTour, regulier) {
    const timestamps = [];
    let tempsCumule = 0;
    const tempsMoyen = duree / nbTours;
    for (let i = 0; i < nbTours; i++) {
        const variation = regulier ? (Math.random() - 0.5) * 0.06 : (Math.random() - 0.5) * 0.2;
        tempsCumule += tempsMoyen * (1 + variation) * 1000;
        if (tempsCumule < duree * 1000) timestamps.push(Math.round(tempsCumule));
    }
    return timestamps;
}
window.troisCinqMinNettoyerTest = async function() {
    if (!currentClasse) return;
    if (!confirm('⚠️ Supprimer TOUTES les observations (courses 1, 2, 3) de cette classe ?\n\nCela effacera les données réelles ET les données de test.')) return;

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const basePath = getBasePath(currentClasse);

    try {
        await set(ref(db, `${basePath}/observations`), null);
        await set(ref(db, `${basePath}/commandes/sequence`), { etat: 'idle', timestampMaj: Date.now() });
        alert('✅ Observations nettoyées.');
    } catch (err) {
        console.error(err);
        alert('❌ Erreur : ' + err.message);
    }
};
// ============================================================
// CLEANUP
// ============================================================
export function cleanupTroisCinqMinInterface() {
    sortableInstances.forEach(s => { try { s.destroy(); } catch (e) {} });
    sortableInstances = [];
    if (_profChronoInterval) { clearInterval(_profChronoInterval); _profChronoInterval = null; }
    if (_profSequenceListener) { _profSequenceListener(); _profSequenceListener = null; }
    currentContainer = null;
}