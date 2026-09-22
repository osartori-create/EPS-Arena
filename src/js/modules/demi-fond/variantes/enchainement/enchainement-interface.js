// src/js/modules/demi-fond/variantes/enchainement/enchainement-interface.js
// UI Professeur du sous-module "Enchaînement" (séries à durées variables).

import { db, ref, set, onValue } from '../../../../core/firebase-service.js';
import { getPhotoUrl, getExistingEleves, migrerCodesAutoEval } from '../../../../services/admin-service.js';
import { getCurrentClasse, getLocalMapping, setLocalMapping } from '../../../../core/live-engine.js';
import { COULEURS_GROUPES, getCouleurGroupe, getGroupesKey, getConfigKey, getBasePath, getVMAEleve } from '../../demifond-common.js';
import { DEFAUT_PARAMS, SOUS_MODULE_ID, TITRE_AFFICHE, construirePlan, calculerPhaseActive } from './enchainement-core.js';
import { repartirEnGroupes } from '../trois-cinq-min/trois-cinq-min-core.js';

let currentClasse = '';
let currentContainer = null;
let sortableInstances = [];
let _profChronoInterval = null;
let _profSequenceListener = null;

function getStatutsKey(classe) { return `eps_arena_demifond_statuts_${classe}`; }
function getStatuts(classe) { return JSON.parse(localStorage.getItem(getStatutsKey(classe)) || '{}'); }

// ============================================================
// INITIALISATION
// ============================================================
export function initEnchainementInterface(container) {
    if (!container) return;
    currentContainer = container;
    currentClasse = getCurrentClasse();
    if (currentClasse) migrerCodesAutoEval(currentClasse);

    container.innerHTML = '';
    container.appendChild(createHeader());
    container.appendChild(createParams());
    container.appendChild(createSequenceControls());
    container.appendChild(createGroupesBlock());
    container.appendChild(createTransmissionButton());

    setTimeout(() => {
        restaurerParams();
        loadAffectations();
    }, 100);
}

function createHeader() {
    const div = document.createElement('div');
    div.className = 'bg-slate-800 p-4 rounded-2xl border border-slate-700';
    div.innerHTML = `
        <div class="flex justify-between items-center flex-wrap gap-2">
            <h3 class="font-black text-blue-400 uppercase text-sm">${TITRE_AFFICHE} — Configuration</h3>
            <div class="flex flex-wrap gap-2">
                <button onclick="window.enchainementGenererGroupes()" class="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-emerald-400 active:scale-95">🔄 Répartition aléatoire</button>
                <button onclick="window.enchainementViderGroupes()" class="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-slate-500 active:scale-95">🗑️ Vider les groupes</button>
                <button onclick="window.enchainementExportConfig()" class="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-indigo-400 active:scale-95">⬇️ Export JSON</button>
                <button onclick="document.getElementById('dmfEnchImportJSON').click()" class="bg-slate-600 hover:bg-slate-500 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-slate-400 active:scale-95">⬆️ Import JSON</button>
                <input type="file" id="dmfEnchImportJSON" class="hidden" accept=".json" onchange="window.enchainementImportConfig(event)">
            </div>
        </div>
    `;
    return div;
}

function createParams() {
    const div = document.createElement('div');
    div.className = 'bg-slate-800 p-4 rounded-2xl border border-slate-700';
    div.innerHTML = `
        <h4 class="font-black text-blue-400 uppercase text-xs mb-3">⚙️ Paramétrage des séries</h4>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs mb-3">
            <div>
                <label class="block font-bold text-slate-400 uppercase mb-1">Nb de séries</label>
                <select id="enchNbCourses" class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-center" onchange="window.enchainementChangeNbCourses()">
                    <option value="2" selected>2 séries</option>
                    <option value="3">3 séries</option>
                    <option value="4">4 séries</option>
                    <option value="5">5 séries</option>
                    <option value="6">6 séries</option>
                </select>
            </div>
            <div>
                <label class="block font-bold text-slate-400 uppercase mb-1">Pause entre séries (s)</label>
                <input type="number" id="enchPause" value="${DEFAUT_PARAMS.pause}" min="30" max="900" step="30" class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-center">
            </div>
            <div>
                <label class="block font-bold text-slate-400 uppercase mb-1">Anti-double-clic (s)</label>
                <input type="number" id="enchAntiDouble" value="30" min="10" max="90" step="5" class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-center">
            </div>
        </div>
        <div class="mb-3">
            <label class="block font-bold text-slate-400 uppercase mb-1">Durée de chaque série (secondes)</label>
            <div id="enchDureesList" class="grid grid-cols-2 md:grid-cols-6 gap-3"></div>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <div>
                <label class="block font-bold text-slate-400 uppercase mb-1">Longueur tour (m)</label>
                <input type="number" id="enchTour" value="${DEFAUT_PARAMS.tour}" min="50" max="500" step="10" class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-center">
            </div>
            <div>
                <label class="block font-bold text-slate-400 uppercase mb-1">Plots par tour</label>
                <input type="number" id="enchPlots" value="${DEFAUT_PARAMS.plots}" min="1" max="16" class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-center">
            </div>
            <div>
                <label class="block font-bold text-slate-400 uppercase mb-1">Nb groupes (1-4)</label>
                <select id="enchNbGroupes" class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-center" onchange="window.enchainementChangeNbGroupes()">
                    <option value="1">1 groupe</option>
                    <option value="2" selected>2 groupes</option>
                    <option value="3">3 groupes</option>
                    <option value="4">4 groupes</option>
                </select>
            </div>
        </div>
    `;
    return div;
}

function renderDureesInputs() {
    const list = document.getElementById('enchDureesList');
    if (!list) return;
    const nb = parseInt(document.getElementById('enchNbCourses')?.value) || 2;
    const current = JSON.parse(localStorage.getItem(getConfigKey(currentClasse, SOUS_MODULE_ID)) || 'null');
    const durees = current?.durees || DEFAUT_PARAMS.durees;

    let html = '';
    for (let i = 0; i < nb; i++) {
        const val = durees[i] ?? 300;
        html += `
            <div>
                <label class="block font-bold text-slate-400 uppercase mb-1">Série ${i + 1} (s)</label>
                <input type="number" id="enchDuree-${i + 1}" value="${val}" min="60" max="1800" step="30" class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-center">
            </div>
        `;
    }
    list.innerHTML = html;
}

function createSequenceControls() {
    const div = document.createElement('div');
    div.className = 'space-y-3';

    const chronoDiv = document.createElement('div');
    chronoDiv.className = 'bg-slate-900 p-4 rounded-2xl border-2 border-blue-500/40';
    chronoDiv.innerHTML = `
        <div class="flex justify-between items-center">
            <div><div class="text-[10px] uppercase text-slate-400 font-bold">Phase actuelle</div><div id="ench-prof-phase" class="text-2xl font-black text-white">—</div></div>
            <div class="text-center"><div class="text-[10px] uppercase text-slate-400 font-bold">Séquence</div><div id="ench-prof-seq" class="text-lg font-black text-slate-300">idle</div></div>
            <div class="text-right"><div class="text-[10px] uppercase text-slate-400 font-bold">Temps restant</div><div id="ench-prof-temps" class="text-4xl font-mono font-black text-yellow-400">--:--</div></div>
        </div>
    `;
    div.appendChild(chronoDiv);

    const btns = document.createElement('div');
    btns.className = 'bg-slate-800 p-4 rounded-2xl border-2 border-blue-500/40';
    btns.innerHTML = `
        <h4 class="font-black text-blue-400 uppercase text-xs mb-3">🚀 Contrôle de la séquence</h4>
        <div class="flex flex-wrap gap-2">
            <button onclick="window.enchainementGo()" class="flex-1 min-w-[140px] bg-emerald-600 hover:bg-emerald-500 py-4 rounded-2xl font-black text-base uppercase text-white border-4 border-emerald-400 active:scale-95">🚀 GO</button>
            <button onclick="window.enchainementPauseManuelle()" class="bg-amber-600 hover:bg-amber-500 px-4 py-4 rounded-2xl font-black text-sm uppercase text-white active:scale-95">⏸️ Pause</button>
            <button onclick="window.enchainementReprendre()" class="bg-blue-600 hover:bg-blue-500 px-4 py-4 rounded-2xl font-black text-sm uppercase text-white active:scale-95">▶️ Reprendre</button>
            <button onclick="window.enchainementSkipCourse()" class="bg-slate-600 hover:bg-slate-500 px-4 py-4 rounded-2xl font-black text-sm uppercase text-white active:scale-95">⏭️ Skip</button>
            <button onclick="window.enchainementStop()" class="bg-red-600 hover:bg-red-500 px-4 py-4 rounded-2xl font-black text-sm uppercase text-white active:scale-95">🛑 Stop</button>
        </div>
    `;
    div.appendChild(btns);
    setTimeout(() => initProfChrono(), 100);
    return div;
}

function initProfChrono() {
    if (!currentClasse) return;
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const seqRef = ref(db, `${getBasePath(currentClasse)}/commandes/sequence`);
    let currentSeq = null;
    if (_profSequenceListener) _profSequenceListener();
    _profSequenceListener = onValue(seqRef, (snap) => {
        currentSeq = snap.val();
        const seqEl = document.getElementById('ench-prof-seq');
        if (seqEl && currentSeq) seqEl.textContent = currentSeq.etat || '—';
    });

    if (_profChronoInterval) clearInterval(_profChronoInterval);
    _profChronoInterval = setInterval(() => {
        const phaseEl = document.getElementById('ench-prof-phase');
        const tempsEl = document.getElementById('ench-prof-temps');
        if (!phaseEl || !tempsEl) return;
        const config = JSON.parse(localStorage.getItem(getConfigKey(currentClasse, SOUS_MODULE_ID)) || 'null');
        if (!config || !currentSeq || !currentSeq.timestampDebut || currentSeq.etat === 'idle' || currentSeq.etat === 'termine') {
            phaseEl.textContent = currentSeq?.etat === 'termine' ? '🏆 TERMINÉ' : '—';
            tempsEl.textContent = '--:--';
            return;
        }
        const elapsed = (Date.now() - currentSeq.timestampDebut) / 1000;
        const phase = calculerPhaseActive(elapsed, config);
        if (phase.type === 'termine') {
            phaseEl.textContent = '🏆 TERMINÉ';
            tempsEl.textContent = '--:--';
            return;
        }
        phaseEl.textContent = phase.type === 'course' ? `🏃 SÉRIE ${phase.courseNum}` : `⏸️ PAUSE ${phase.courseNum}`;
        const m = Math.floor(phase.restant / 60);
        const s = Math.floor(phase.restant % 60);
        tempsEl.textContent = `${m}:${String(s).padStart(2, '0')}`;
    }, 500);
}

function createGroupesBlock() {
    const div = document.createElement('div');
    div.className = 'bg-slate-800 p-4 rounded-2xl border border-slate-700';
    div.innerHTML = `
        <h4 class="font-bold text-slate-400 uppercase text-xs mb-3">👥 Répartition des élèves</h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div class="bg-slate-900 p-3 rounded-2xl border-2 border-dashed border-red-700/50"><div class="text-xs font-bold text-red-400 uppercase mb-2">🚫 Absents</div><div id="enchReserveAbsents" class="dmf-reserve flex flex-col gap-1 min-h-[60px] border border-red-800/30 rounded-lg p-1"></div></div>
            <div class="bg-slate-900 p-3 rounded-2xl border-2 border-dashed border-orange-700/50"><div class="text-xs font-bold text-orange-400 uppercase mb-2">⚠️ Inaptes</div><div id="enchReserveInaptes" class="dmf-reserve flex flex-col gap-1 min-h-[60px] border border-orange-800/30 rounded-lg p-1"></div></div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div class="bg-slate-900 p-3 rounded-2xl border-2 border-dashed border-blue-700/50"><div class="text-xs font-bold text-blue-400 uppercase mb-2">👦 Présents - Garçons</div><div id="enchReserveGarcons" class="dmf-reserve flex flex-col gap-1 min-h-[80px] border border-blue-800/30 rounded-lg p-1"></div></div>
            <div class="bg-slate-900 p-3 rounded-2xl border-2 border-dashed border-rose-700/50"><div class="text-xs font-bold text-rose-400 uppercase mb-2">👩 Présentes - Filles</div><div id="enchReserveFilles" class="dmf-reserve flex flex-col gap-1 min-h-[80px] border border-rose-800/30 rounded-lg p-1"></div></div>
        </div>
        <div id="enchGroupesGrid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3"></div>
    `;
    return div;
}

function createTransmissionButton() {
    const div = document.createElement('div');
    div.innerHTML = `
        <button onclick="window.enchainementTransmettre()" class="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-black text-base uppercase tracking-widest text-white border-4 border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.5)] active:scale-[0.98]">📡 Transmettre aux iPads Élèves</button>
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
    const photoHtml = url ? `<img src="${url}" class="w-8 h-8 rounded-full object-cover border-2 border-slate-500">` : `<div class="w-8 h-8 rounded-full bg-slate-400 flex items-center justify-center text-base">👤</div>`;
    const vma = getVMAEleve(currentClasse, eleve.id);
    const vmaHtml = vma ? `<span class="text-[9px] text-emerald-600 font-bold">VMA ${vma}</span>` : `<span class="text-[9px] text-amber-600 font-bold">⚠️ VMA ?</span>`;
    const div = document.createElement('div');
    div.className = `dmf-eleve-card p-2 rounded-lg border-2 cursor-grab active:cursor-grabbing flex items-center gap-2 ${bgClass}`;
    div.dataset.id = eleve.id;
    div.innerHTML = `${photoHtml}<div class="flex flex-col leading-tight flex-1 min-w-0"><span class="font-black text-slate-900 text-xs truncate">${eleve.prenom}</span><span class="text-[10px] font-bold text-slate-600 uppercase truncate">${eleve.nom}</span>${vmaHtml}</div><span class="num-badge bg-slate-900 text-white text-[10px] font-black px-1.5 py-0.5 rounded hidden"></span>`;
    return div;
}

// ============================================================
// SAUVEGARDE / CHARGEMENT
// ============================================================
function sauvegarderGroupes(groupes) { localStorage.setItem(getGroupesKey(currentClasse, SOUS_MODULE_ID), JSON.stringify(groupes)); }
function chargerGroupes() { const g = JSON.parse(localStorage.getItem(getGroupesKey(currentClasse, SOUS_MODULE_ID)) || 'null'); if (!g) return {}; COULEURS_GROUPES.forEach(c => { if (!g[c.id]) g[c.id] = []; }); return g; }

function sauvegarderParams() {
    const nb = parseInt(document.getElementById('enchNbCourses')?.value) || 2;
    const durees = [];
    for (let i = 0; i < nb; i++) durees.push(parseInt(document.getElementById(`enchDuree-${i + 1}`)?.value) || 300);
    const params = {
        durees,
        pause: parseInt(document.getElementById('enchPause')?.value) || DEFAUT_PARAMS.pause,
        antiDoubleClic: (parseInt(document.getElementById('enchAntiDouble')?.value) || 30) * 1000,
        tour: parseInt(document.getElementById('enchTour')?.value) || DEFAUT_PARAMS.tour,
        plots: parseInt(document.getElementById('enchPlots')?.value) || DEFAUT_PARAMS.plots,
        nbGroupes: parseInt(document.getElementById('enchNbGroupes')?.value) || 2,
        seuilsPerformance: DEFAUT_PARAMS.seuilsPerformance
    };
    localStorage.setItem(getConfigKey(currentClasse, SOUS_MODULE_ID), JSON.stringify(params));
    return params;
}

function restaurerParams() {
    const saved = JSON.parse(localStorage.getItem(getConfigKey(currentClasse, SOUS_MODULE_ID)) || 'null');
    const $ = id => document.getElementById(id);
    if (saved?.pause) $('enchPause').value = saved.pause;
    if (saved?.antiDoubleClic) $('enchAntiDouble').value = saved.antiDoubleClic / 1000;
    if (saved?.tour) $('enchTour').value = saved.tour;
    if (saved?.plots) $('enchPlots').value = saved.plots;
    if (saved?.nbGroupes) $('enchNbGroupes').value = saved.nbGroupes;
    if (saved?.durees?.length) $('enchNbCourses').value = saved.durees.length;
    setTimeout(() => renderDureesInputs(), 0);
}

// ============================================================
// RENDU GROUPES / RÉSERVES
// ============================================================
async function renderGroupesEtReserve() {
    const groupes = chargerGroupes();
    const eleves = getExistingEleves(currentClasse);
    const statuts = getStatuts(currentClasse);
    const nbGroupes = parseInt(document.getElementById('enchNbGroupes')?.value) || 2;

    const grid = document.getElementById('enchGroupesGrid');
    if (grid) {
        let html = '';
        COULEURS_GROUPES.slice(0, nbGroupes).forEach(couleur => {
            const membres = groupes[couleur.id] || [];
            html += `<div class="flex flex-col"><div class="header-col text-center py-2 rounded-t-lg font-black text-sm uppercase" style="background:${couleur.bg};color:${couleur.text};border:2px solid ${couleur.border};border-bottom:none;">${couleur.label} <span class="text-[10px] opacity-70">(${membres.length})</span></div><div class="dmf-groupe-members flex flex-col gap-1 p-2 rounded-b-lg min-h-[80px]" data-couleur="${couleur.id}" style="background:#0f172a;border:2px solid ${couleur.border};border-top:none;"></div></div>`;
        });
        grid.innerHTML = html;
        for (const couleur of COULEURS_GROUPES.slice(0, nbGroupes)) {
            const ids = groupes[couleur.id] || [];
            const cont = grid.querySelector(`.dmf-groupe-members[data-couleur="${couleur.id}"]`);
            if (!cont) continue;
            for (const id of ids) { const eleve = eleves.find(e => e.id === id); if (eleve) cont.appendChild(await createEleveCard(eleve)); }
        }
    }

    const placedInGroups = new Set();
    Object.values(groupes).forEach(arr => arr.forEach(id => placedInGroups.add(id)));
    ['enchReserveGarcons', 'enchReserveFilles', 'enchReserveAbsents', 'enchReserveInaptes'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });

    for (const e of eleves) {
        if (placedInGroups.has(e.id)) continue;
        const statut = statuts[e.id] || 'present';
        let target = null;
        if (statut === 'absent') target = document.getElementById('enchReserveAbsents');
        else if (statut === 'inapte') target = document.getElementById('enchReserveInaptes');
        else target = (e.sexe === 'F') ? document.getElementById('enchReserveFilles') : document.getElementById('enchReserveGarcons');
        if (target) target.appendChild(await createEleveCard(e));
    }

    document.querySelectorAll('.dmf-reserve, .dmf-groupe-members').forEach(el => {});
    updateNumBadges();
    setTimeout(() => initSortable(), 50);
}

function updateNumBadges() {
    const eleves = getExistingEleves(currentClasse);
    document.querySelectorAll('.dmf-eleve-card').forEach(card => {
        const id = card.dataset.id;
        const eleve = eleves.find(e => e.id === id);
        const badge = card.querySelector('.num-badge');
        if (badge && eleve?.codeAutoEval) { badge.textContent = `#${eleve.codeAutoEval}`; badge.classList.remove('hidden'); }
    });
}

function initSortable() {
    if (typeof Sortable === 'undefined') return;
    sortableInstances.forEach(s => { try { s.destroy(); } catch (e) {} });
    sortableInstances = [];
    document.querySelectorAll('.dmf-reserve, .dmf-groupe-members').forEach(el => {
        const s = new Sortable(el, { group: 'demifond-enchainement', animation: 150, onEnd: () => { saveAffectations(); updateNumBadges(); setTimeout(() => renderGroupesEtReserve(), 50); } });
        sortableInstances.push(s);
    });
}

function saveAffectations() {
    const groupes = {};
    COULEURS_GROUPES.forEach(c => { groupes[c.id] = []; });
    document.querySelectorAll('.dmf-groupe-members').forEach(container => {
        const couleur = container.dataset.couleur;
        container.querySelectorAll('.dmf-eleve-card').forEach(card => groupes[couleur].push(card.dataset.id));
    });
    sauvegarderGroupes(groupes);
    const statuts = {};
    document.querySelectorAll('#enchReserveAbsents .dmf-eleve-card').forEach(card => statuts[card.dataset.id] = 'absent');
    document.querySelectorAll('#enchReserveInaptes .dmf-eleve-card').forEach(card => statuts[card.dataset.id] = 'inapte');
    localStorage.setItem(getStatutsKey(currentClasse), JSON.stringify(statuts));
}

async function loadAffectations() { await renderGroupesEtReserve(); }

// ============================================================
// ACTIONS GLOBALES
// ============================================================
window.enchainementChangeNbCourses = () => { renderDureesInputs(); };
window.enchainementChangeNbGroupes = () => { renderGroupesEtReserve(); };
window.enchainementGenererGroupes = async function() {
    if (!currentClasse) return alert('Sélectionne une classe.');
    const eleves = getExistingEleves(currentClasse);
    const nbGroupes = parseInt(document.getElementById('enchNbGroupes')?.value) || 2;
    const statuts = getStatuts(currentClasse);
    const presents = eleves.filter(e => (statuts[e.id] || 'present') === 'present');
    if (presents.length === 0) return alert('Aucun élève présent.');
    const groupes = repartirEnGroupes(presents, nbGroupes);
    COULEURS_GROUPES.forEach(c => { if (!groupes[c.id]) groupes[c.id] = []; });
    sauvegarderGroupes(groupes);
    await renderGroupesEtReserve();
    alert(`✅ ${nbGroupes} groupes générés (${presents.length} élèves).`);
};
window.enchainementViderGroupes = async function() { if (!confirm('Remettre tous les élèves dans la réserve ?')) return; sauvegarderGroupes({}); await renderGroupesEtReserve(); };

function construireConfigData() {
    const params = sauvegarderParams();
    const groupes = chargerGroupes();
    migrerCodesAutoEval(currentClasse);
    const eleves = getExistingEleves(currentClasse);
    const localMapping = {};
    const vmaParCode = {};
    const sexesParCode = {};
    const configData = {
        sousModule: SOUS_MODULE_ID,
        durees: params.durees,
        pause: params.pause,
        nbCourses: params.durees.length,
        tour: params.tour,
        plots: params.plots,
        antiDoubleClic: params.antiDoubleClic,
        seuilsPerformance: params.seuilsPerformance,
        vmaParCode: {},
        sexesParCode: {},
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
                if (eleve.sexe === 'F' || eleve.sexe === 'M') sexesParCode[eleve.codeAutoEval] = eleve.sexe;
            }
        });
        configData.groupes[c.id] = codes;
    });
    configData.vmaParCode = vmaParCode;
    configData.sexesParCode = sexesParCode;
    setLocalMapping(currentClasse, { ...(getLocalMapping(currentClasse) || {}), ...localMapping });
    return { configData, groupes, params };
}

window.enchainementTransmettre = async function() {
    if (!currentClasse) return alert('Sélectionne une classe.');
    const groupes = chargerGroupes();
    if (Object.values(groupes).every(arr => arr.length === 0)) return alert('Génère d\'abord les groupes.');
    const { configData } = construireConfigData();
    try {
        await set(ref(db, `${getBasePath(currentClasse)}/config`), configData);
        await set(ref(db, `${getBasePath(currentClasse)}/commandes/sequence`), { etat: 'idle', timestampMaj: Date.now() });
        const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
        await set(ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/config`), { activite: 'demi-fond' });
        await set(ref(db, `etablissements/0680013V/profs/${profCode}/active_classes/${currentClasse}`), true);
        const nbEleves = Object.values(configData.groupes).reduce((a, b) => a + b.length, 0);
        alert(`✅ Configuration transmise.\n${configData.durees.length} séries · ${nbEleves} élèves · ${Object.keys(configData.vmaParCode).length} VMA connues.`);
    } catch (err) { console.error(err); alert('❌ Erreur : ' + err.message); }
};

window.enchainementGo = async function() {
    if (!currentClasse) return alert('Sélectionne une classe.');
    const groupes = chargerGroupes();
    if (Object.values(groupes).every(arr => arr.length === 0)) return alert('Génère d\'abord les groupes.');
    const { configData } = construireConfigData();
    try {
        await set(ref(db, `${getBasePath(currentClasse)}/config`), configData);
        await set(ref(db, `${getBasePath(currentClasse)}/commandes/sequence`), { etat: 'actif', timestampDebut: Date.now(), action: 'go', actionTimestamp: Date.now() });
        alert('🚀 GO ! La séquence démarre.');
    } catch (err) { console.error(err); alert('❌ Erreur : ' + err.message); }
};

window.enchainementPauseManuelle = async function() { await majSequence('', s => ({ ...s, etat: 'pause_manuelle', pauseDebut: Date.now(), action: 'pause', actionTimestamp: Date.now() }), '⏸️ Séquence en pause.'); };
window.enchainementReprendre = async function() {
    await majSequence('', async (seq) => {
        if (seq.etat !== 'pause_manuelle' || !seq.pauseDebut) { alert('Aucune pause manuelle en cours.'); return null; }
        const dureePause = Date.now() - seq.pauseDebut;
        return { ...seq, etat: 'actif', timestampDebut: (seq.timestampDebut || Date.now()) + dureePause, pauseDebut: null, action: 'reprendre', actionTimestamp: Date.now() };
    }, '▶️ Séquence reprise.');
};
window.enchainementSkipCourse = async function() {
    if (!confirm('Passer à la série suivante ?')) return;
    const config = JSON.parse(localStorage.getItem(getConfigKey(currentClasse, SOUS_MODULE_ID)) || 'null');
    if (!config) return;
    const { plan } = construirePlan(config);
    await majSequence('', (seq) => {
        const elapsed = seq.timestampDebut ? (Date.now() - seq.timestampDebut) / 1000 : 0;
        let prochaineCourse = plan.find(p => p.type === 'course' && p.debut + p.duree > elapsed);
        if (!prochaineCourse) return { ...seq, etat: 'actif', action: 'skip', actionTimestamp: Date.now() };
        const nouveauDebut = Date.now() - prochaineCourse.debut * 1000;
        return { ...seq, etat: 'actif', timestampDebut: nouveauDebut, action: 'skip', actionTimestamp: Date.now() };
    }, `⏭️ Passage à la série suivante.`);
};
window.enchainementStop = async function() {
    if (!confirm('Arrêter la séquence ?')) return;
    await majSequence('', (seq) => ({ ...seq, etat: 'termine', action: 'stop', actionTimestamp: Date.now() }), '🛑 Séquence terminée.');
};

async function majSequence(etatAttendu, transformer, message) {
    if (!currentClasse) return;
    const seqRef = ref(db, `${getBasePath(currentClasse)}/commandes/sequence`);
    await new Promise(resolve => onValue(seqRef, async (snap) => {
        const seq = snap.val() || {};
        if (etatAttendu && seq.etat !== etatAttendu) { resolve(); return; }
        const nouveau = await transformer(seq);
        if (nouveau) await set(seqRef, nouveau);
        resolve();
    }, { onlyOnce: true }));
    if (message) alert(message);
}

// ============================================================
// EXPORT / IMPORT
// ============================================================
window.enchainementExportConfig = function() {
    if (!currentClasse) return alert('Sélectionne une classe.');
    const data = { version: 1, classe: currentClasse, sousModule: SOUS_MODULE_ID, date: new Date().toISOString().slice(0, 10).replace(/-/g, ''), params: JSON.parse(localStorage.getItem(getConfigKey(currentClasse, SOUS_MODULE_ID)) || '{}'), groupes: chargerGroupes() || {}, statuts: getStatuts(currentClasse) || {} };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${currentClasse}_enchainement_${data.date}.json`;
    a.click();
};
window.enchainementImportConfig = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.classe) throw new Error('Format invalide');
            localStorage.setItem(getGroupesKey(data.classe, SOUS_MODULE_ID), JSON.stringify(data.groupes || {}));
            localStorage.setItem(getConfigKey(data.classe, SOUS_MODULE_ID), JSON.stringify(data.params || {}));
            if (data.statuts) localStorage.setItem(getStatutsKey(data.classe), JSON.stringify(data.statuts));
            const select = document.getElementById('selectClasse');
            if (select && select.value !== data.classe) { select.value = data.classe; select.dispatchEvent(new Event('change')); }
            else initEnchainementInterface(document.getElementById('demifond-submodule-container'));
            alert('✅ Configuration importée !');
        } catch (err) { alert('❌ Erreur : ' + err.message); }
    };
    reader.readAsText(file);
    event.target.value = '';
};