// src/js/modules/natation/natation-longue-interface.js
// UI Professeur du mode « Longue distance » (épreuve de nage 6-9 min)
// Inspiration directe du sous-module 1/2 fond 3×5 min (groupes, couleurs, vagues).

import { getEtab } from '../../core/firebase-service.js';
import { db, ref, set, onValue } from '../../core/firebase-service.js';
import { getPhotoUrl } from '../../services/admin-service.js';
import { getCurrentClasse } from '../../core/live-engine.js';
import {
    COULEURS_GROUPES, getGroupesKey, getConfigKey, getStatutsKey,
    getBasePath, setMapping, getElevesNumerotes, getStatuts,
    creerSessionId, getSessionActivePath, getSessionsPath
} from './natation-longue-common.js';
import { DEFAUT_PARAMS, TITRE_AFFICHE, repartirEnGroupes } from './natation-longue-core.js';

let currentClasse = '';
let currentContainer = null;
let _profSessionListener = null;
let _profSessionsListener = null;

// ============================================================
// INITIALISATION
// ============================================================
export function initNatationLongueInterface(container) {
    if (!container) return;
    currentContainer = container;
    currentClasse = getCurrentClasse();

    container.innerHTML = '';

    container.appendChild(createHeader());
    container.appendChild(createParams());
    container.appendChild(createSequenceControls());
    container.appendChild(createGroupesBlock());
    container.appendChild(createTransmissionButton());

    setTimeout(() => {
        restaurerParams();
        loadAffectations();
        ecouterSessionActive();
        ecouterSessions();
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
            <h3 class="font-black text-blue-400 uppercase text-sm">🏊 ${TITRE_AFFICHE} — Configuration</h3>
            <div class="flex flex-wrap gap-2">
                <button onclick="window.nlGenererGroupes()"
                        class="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-emerald-400 active:scale-95"
                        title="Répartit aléatoirement les élèves présents dans les vagues">
                    🔄 Répartition aléatoire
                </button>
                <button onclick="window.nlRepartirParNiveau()"
                        class="bg-cyan-600 hover:bg-cyan-500 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-cyan-400 active:scale-95"
                        title="Répartit les élèves par niveau de nage (indice de nage) si les données existent">
                    🏊 Par niveau
                </button>
                <button onclick="window.nlViderGroupes()"
                        class="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-slate-500 active:scale-95"
                        title="Remet tous les élèves dans la réserve">
                    🗑️ Vider les vagues
                </button>
                <button onclick="window.nlNouvelleSession()"
                        class="bg-violet-600 hover:bg-violet-500 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-violet-400 active:scale-95"
                        title="Crée une nouvelle épreuve horodatée sans écraser les précédentes">
                    🆕 Nouvelle épreuve
                </button>
                <button onclick="window.nlExportConfig()"
                        class="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-indigo-400 active:scale-95">
                    ⬇️ Export JSON
                </button>
                <button onclick="document.getElementById('nlImportJSON').click()"
                        class="bg-slate-600 hover:bg-slate-500 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-slate-400 active:scale-95">
                    ⬆️ Import JSON
                </button>
                <input type="file" id="nlImportJSON" class="hidden" accept=".json" onchange="window.nlImportConfig(event)">
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
        <h4 class="font-black text-blue-400 uppercase text-xs mb-3">⚙️ Paramétrage de l'épreuve</h4>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
                <label class="block font-bold text-slate-400 uppercase mb-1">Durée (min)</label>
                <input type="number" id="nlDuree" value="${Math.round(DEFAUT_PARAMS.duree / 60)}" min="6" max="9" step="1"
                       class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-center">
            </div>
            <div>
                <label class="block font-bold text-slate-400 uppercase mb-1">Distance / clic (m)</label>
                <input type="number" id="nlDistanceClic" value="${DEFAUT_PARAMS.distanceParClic}" min="25" max="100" step="25"
                       class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-center">
            </div>
            <div>
                <label class="block font-bold text-slate-400 uppercase mb-1">Anti-double-clic (s)</label>
                <input type="number" id="nlAntiDouble" value="${DEFAUT_PARAMS.antiDoubleClic}" min="2" max="60" step="1"
                       class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-center">
            </div>
            <div>
                <label class="block font-bold text-slate-400 uppercase mb-1">Nombre de vagues</label>
                <select id="nlNbVagues" class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-center">
                    <option value="1">1 vague</option>
                    <option value="2" selected>2 vagues</option>
                    <option value="3">3 vagues</option>
                    <option value="4">4 vagues</option>
                </select>
            </div>
        </div>
        <p class="text-slate-500 text-[10px] mt-2">💡 Chaque « passage » au kiosk = un aller-retour = ${DEFAUT_PARAMS.distanceParClic} m. Le partiel de fin de vague se saisit en mètres (0 à ${DEFAUT_PARAMS.distanceParClic - 1} m).</p>
    `;

    ['nlDuree', 'nlDistanceClic', 'nlAntiDouble', 'nlNbVagues'].forEach(id => {
        const el = div.querySelector('#' + id);
        if (el) el.addEventListener('change', () => {
            saveParams();
            renderSequenceButtons();
            if (id === 'nlNbVagues') loadAffectations();
        });
    });
    return div;
}

function getParams() {
    return {
        duree: (parseInt(document.getElementById('nlDuree')?.value) || 7) * 60,
        longueurBassin: DEFAUT_PARAMS.longueurBassin,
        distanceParClic: parseInt(document.getElementById('nlDistanceClic')?.value) || DEFAUT_PARAMS.distanceParClic,
        antiDoubleClic: parseInt(document.getElementById('nlAntiDouble')?.value) || DEFAUT_PARAMS.antiDoubleClic,
        nbVagues: parseInt(document.getElementById('nlNbVagues')?.value) || DEFAUT_PARAMS.nbVagues
    };
}

function saveParams() {
    if (!currentClasse) return;
    localStorage.setItem(getConfigKey(currentClasse), JSON.stringify(getParams()));
}

function restaurerParams() {
    if (!currentClasse) return;
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(getConfigKey(currentClasse)) || 'null'); } catch (e) {}
    if (!saved) return;
    if (saved.duree) { const el = document.getElementById('nlDuree'); if (el) el.value = Math.round(saved.duree / 60); }
    if (saved.distanceParClic) { const el = document.getElementById('nlDistanceClic'); if (el) el.value = saved.distanceParClic; }
    if (saved.antiDoubleClic) { const el = document.getElementById('nlAntiDouble'); if (el) el.value = saved.antiDoubleClic; }
    if (saved.nbVagues) { const el = document.getElementById('nlNbVagues'); if (el) el.value = saved.nbVagues; }
    renderSequenceButtons();
}

// ============================================================
// COMMANDES DE VAGUE (séquence)
// ============================================================
function createSequenceControls() {
    const div = document.createElement('div');
    div.className = 'bg-slate-800 p-4 rounded-2xl border border-slate-700';
    div.innerHTML = `
        <h4 class="font-black text-blue-400 uppercase text-xs mb-3">🎬 Vagues (une couleur = une vague)</h4>
        <div class="flex flex-wrap items-center gap-2 mb-3">
            <label class="text-xs font-bold text-slate-400 uppercase">Épreuve :</label>
            <select id="nlSessionSelect" onchange="window.nlChoisirSession(this.value)"
                    class="bg-slate-900 border border-slate-600 rounded p-2 text-white text-xs font-bold flex-1 min-w-[200px]"></select>
            <button onclick="window.nlNouvelleSession()"
                    class="bg-violet-600 hover:bg-violet-500 px-3 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-violet-400 active:scale-95">🆕 Nouvelle</button>
        </div>
        <div id="nlSequenceButtons" class="grid grid-cols-2 md:grid-cols-4 gap-3"></div>
    `;
    return div;
}

function renderSequenceButtons() {
    const container = document.getElementById('nlSequenceButtons');
    if (!container) return;
    const nbVagues = parseInt(document.getElementById('nlNbVagues')?.value) || DEFAUT_PARAMS.nbVagues;
    let html = '';
    COULEURS_GROUPES.slice(0, nbVagues).forEach(c => {
        html += `
            <div class="rounded-xl p-3 border-2" style="border-color:${c.border}; background:${c.bg}12;">
                <div class="text-center font-black text-sm uppercase mb-2" style="color:${c.bg};">${c.label}</div>
                <button onclick="window.nlLancerVague('${c.id}')"
                        class="w-full bg-emerald-600 hover:bg-emerald-500 py-2 rounded-lg font-black text-xs uppercase text-white active:scale-95 mb-1">▶ Lancer</button>
                <button onclick="window.nlTerminerVague('${c.id}')"
                        class="w-full bg-red-600 hover:bg-red-500 py-2 rounded-lg font-black text-xs uppercase text-white active:scale-95">⏹ Terminer</button>
            </div>
        `;
    });
    container.innerHTML = html;
}

async function ecouterSessionActive() {
    if (_profSessionListener) _profSessionListener();
    if (!currentClasse) return;
    _profSessionListener = onValue(ref(db, getSessionActivePath(currentClasse)), (snap) => {
        const sid = snap.val() || '';
        const select = document.getElementById('nlSessionSelect');
        if (select && sid) select.value = sid;
    });
}

async function ecouterSessions() {
    if (_profSessionsListener) _profSessionsListener();
    if (!currentClasse) return;
    _profSessionsListener = onValue(ref(db, getSessionsPath(currentClasse)), (snap) => {
        const sessions = snap.val() || {};
        const select = document.getElementById('nlSessionSelect');
        if (!select) return;
        const ids = Object.keys(sessions).sort().reverse();
        select.innerHTML = ids.length
            ? ids.map(id => `<option value="${id}">${id}</option>`).join('')
            : '<option value="">— aucune épreuve —</option>';
    });
}

window.nlChoisirSession = async function(sessionId) {
    if (!currentClasse || !sessionId) return;
    await set(ref(db, getSessionActivePath(currentClasse)), sessionId);
};

// ============================================================
// GROUPES + RÉSERVES (drag & drop)
// ============================================================
function createGroupesBlock() {
    const div = document.createElement('div');
    div.className = 'bg-slate-800 p-4 rounded-2xl border border-slate-700';
    div.innerHTML = `
        <h4 class="font-black text-blue-400 uppercase text-xs mb-1">👥 Vagues (groupes)</h4>
        <p class="text-slate-400 text-[10px] mb-3">Glisse les élèves de la réserve vers une vague. Chaque élève nage dans <strong class="text-white">une seule</strong> vague.</p>
        <div id="nlGroupesGrid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4"></div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="border border-slate-600 rounded-lg p-2">
                <div class="text-xs font-bold text-slate-400 uppercase mb-1">👦 Présents — Garçons</div>
                <div id="nlReserveGarcons" class="flex flex-col gap-1 min-h-[60px]"></div>
            </div>
            <div class="border border-slate-600 rounded-lg p-2">
                <div class="text-xs font-bold text-slate-400 uppercase mb-1">👧 Présentes — Filles</div>
                <div id="nlReserveFilles" class="flex flex-col gap-1 min-h-[60px]"></div>
            </div>
            <div class="border border-red-800/40 rounded-lg p-2">
                <div class="text-xs font-bold text-red-400 uppercase mb-1">🚫 Absents</div>
                <div id="nlReserveAbsents" class="flex flex-col gap-1 min-h-[60px]"></div>
            </div>
            <div class="border border-orange-800/40 rounded-lg p-2">
                <div class="text-xs font-bold text-orange-400 uppercase mb-1">⚠️ Inaptes</div>
                <div id="nlReserveInaptes" class="flex flex-col gap-1 min-h-[60px]"></div>
            </div>
        </div>
    `;
    return div;
}

function renderGroupesGrid() {
    const grid = document.getElementById('nlGroupesGrid');
    if (!grid) return;
    const nbVagues = parseInt(document.getElementById('nlNbVagues')?.value) || DEFAUT_PARAMS.nbVagues;
    const groupes = getGroupes();
    let html = '';
    COULEURS_GROUPES.slice(0, nbVagues).forEach(couleur => {
        const membres = groupes[couleur.id] || [];
        html += `
            <div class="flex flex-col">
                <div class="text-center py-2 rounded-t-lg font-black text-sm uppercase"
                     style="background:${couleur.bg}; color:${couleur.text}; border:2px solid ${couleur.border}; border-bottom:none;">
                    ${couleur.label} <span id="nlCount-${couleur.id}" class="text-[10px] opacity-70">(${membres.length})</span>
                </div>
                <div class="nl-groupe-members flex flex-col gap-1 p-2 rounded-b-lg min-h-[80px]"
                     data-couleur="${couleur.id}"
                     style="background:#0f172a; border:2px solid ${couleur.border}; border-top:none;">
                </div>
            </div>
        `;
    });
    grid.innerHTML = html;
}

function getGroupes() {
    try {
        const raw = localStorage.getItem(getGroupesKey(currentClasse));
        return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
}

function saveGroupes(groupes) {
    localStorage.setItem(getGroupesKey(currentClasse), JSON.stringify(groupes));
}

function saveStatuts(statuts) {
    localStorage.setItem(getStatutsKey(currentClasse), JSON.stringify(statuts));
}

async function createEleveCard(eleve) {
    const card = document.createElement('div');
    card.className = 'nl-eleve-card bg-slate-900 border-2 border-slate-700 rounded-lg p-2 flex items-center gap-2 cursor-grab';
    card.dataset.id = eleve.id;
    card.dataset.numero = String(eleve.numero);
    const photoUrl = await getPhotoUrl(eleve.id).catch(() => null);
    const photoHtml = photoUrl
        ? `<img src="${photoUrl}" class="w-9 h-9 rounded-full object-cover border border-slate-500 flex-shrink-0">`
        : `<div class="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-sm flex-shrink-0">👤</div>`;
    card.innerHTML = `
        ${photoHtml}
        <div class="min-w-0 flex-1">
            <div class="text-xs font-bold text-white truncate">${eleve.prenom} ${eleve.nom}</div>
            <div class="text-[10px] text-yellow-400 font-black">N° ${eleve.numero}</div>
        </div>
    `;
    return card;
}

// ============================================================
// CHARGEMENT DES AFFECTATIONS + SORTABLE
// ============================================================
async function loadAffectations() {
    if (!currentClasse) return;
    renderGroupesGrid();

    const elevesNumerotes = getElevesNumerotes(currentClasse);
    const groupes = getGroupes();
    const statuts = getStatuts(currentClasse);

    // Remplit les groupes
    for (const couleur of COULEURS_GROUPES) {
        const cont = document.querySelector(`.nl-groupe-members[data-couleur="${couleur.id}"]`);
        if (!cont) continue;
        const ids = groupes[couleur.id] || [];
        for (const id of ids) {
            const eleve = elevesNumerotes.find(e => e.id === id);
            if (eleve) cont.appendChild(await createEleveCard(eleve));
        }
    }

    // Remplit les réserves
    const placed = new Set();
    Object.values(groupes).forEach(arr => arr.forEach(id => placed.add(id)));

    const resGarcons = document.getElementById('nlReserveGarcons');
    const resFilles = document.getElementById('nlReserveFilles');
    const resAbsents = document.getElementById('nlReserveAbsents');
    const resInaptes = document.getElementById('nlReserveInaptes');
    [resGarcons, resFilles, resAbsents, resInaptes].forEach(r => { if (r) r.innerHTML = ''; });

    for (const e of elevesNumerotes) {
        if (placed.has(e.id)) continue;
        const statut = statuts[e.id] || 'present';
        if (statut === 'absent') { if (resAbsents) resAbsents.appendChild(await createEleveCard(e)); }
        else if (statut === 'inapte') { if (resInaptes) resInaptes.appendChild(await createEleveCard(e)); }
        else if (e.sexe === 'F') { if (resFilles) resFilles.appendChild(await createEleveCard(e)); }
        else { if (resGarcons) resGarcons.appendChild(await createEleveCard(e)); }
    }

    setTimeout(initSortable, 50);
}

function initSortable() {
    if (typeof Sortable === 'undefined') {
        console.warn('[Natation Longue] Sortable non disponible');
        return;
    }
    const containers = [
        ...document.querySelectorAll('.nl-groupe-members'),
        document.getElementById('nlReserveGarcons'),
        document.getElementById('nlReserveFilles'),
        document.getElementById('nlReserveAbsents'),
        document.getElementById('nlReserveInaptes')
    ].filter(Boolean);

    containers.forEach(cont => {
        if (cont._sortable) cont._sortable.destroy();
        cont._sortable = new Sortable(cont, {
            group: 'nl-vagues',
            animation: 150,
            onEnd: saveAffectationsFromDOM
        });
    });
}

function saveAffectationsFromDOM() {
    if (!currentClasse) return;
    const groupes = {};
    document.querySelectorAll('.nl-groupe-members').forEach(cont => {
        const couleur = cont.dataset.couleur;
        groupes[couleur] = [...cont.querySelectorAll('.nl-eleve-card')].map(el => el.dataset.id);
    });
    saveGroupes(groupes);

    const statuts = {};
    document.querySelectorAll('#nlReserveAbsents .nl-eleve-card').forEach(el => { statuts[el.dataset.id] = 'absent'; });
    document.querySelectorAll('#nlReserveInaptes .nl-eleve-card').forEach(el => { statuts[el.dataset.id] = 'inapte'; });
    saveStatuts(statuts);
    updateCounts();
}

function updateCounts() {
    document.querySelectorAll('.nl-groupe-members').forEach(cont => {
        const couleur = cont.dataset.couleur;
        const span = document.getElementById('nlCount-' + couleur);
        if (span) span.textContent = '(' + cont.querySelectorAll('.nl-eleve-card').length + ')';
    });
}

// ============================================================
// TRANSMISSION
// ============================================================
function createTransmissionButton() {
    const div = document.createElement('div');
    div.className = 'bg-slate-800 p-4 rounded-2xl border border-slate-700 flex flex-wrap items-center gap-3';
    const btn = document.createElement('button');
    btn.className = 'bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-xl font-black text-sm uppercase text-white border-2 border-blue-400 active:scale-95';
    btn.textContent = '📡 Transmettre aux iPads';
    btn.onclick = () => transmettreNatationLongue();
    const hint = document.createElement('p');
    hint.className = 'text-slate-400 text-xs';
    hint.textContent = 'Envoie la configuration (vagues, durée, distances) aux tablettes. Les résultats bruts restent anonymes (numéros).';
    div.appendChild(btn);
    div.appendChild(hint);
    return div;
}

export async function transmettreNatationLongue() {
    const classe = currentClasse || getCurrentClasse();
    if (!classe) return alert('Sélectionnez une classe.');

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const baseProf = `${getEtab()}/profs/${profCode}`;
    const params = getParams();
    saveParams();

    const elevesNumerotes = getElevesNumerotes(classe);
    const groupesIds = getGroupes();

    // Mapping numéro → id (local, RGPD)
    const mapping = {};
    elevesNumerotes.forEach(e => { mapping[String(e.numero)] = e.id; });
    setMapping(classe, mapping);

    // Convertit les ids en numéros (anonymes) pour Firebase
    const groupes = {};
    COULEURS_GROUPES.slice(0, params.nbVagues).forEach(c => {
        groupes[c.id] = (groupesIds[c.id] || [])
            .map(id => elevesNumerotes.find(e => e.id === id)?.numero)
            .filter(n => n !== undefined);
    });

    const configData = {
        mode: 'longue',
        duree: params.duree,
        longueurBassin: params.longueurBassin,
        distanceParClic: params.distanceParClic,
        antiDoubleClic: params.antiDoubleClic,
        nbVagues: params.nbVagues,
        groupes
    };

    try {
        await set(ref(db, `${getBasePath(classe)}/config`), configData);
        await set(ref(db, `${baseProf}/${classe}/natation/config`), { activite: 'natation', mode: 'longue' });
        await set(ref(db, `${baseProf}/${classe}/config`), { activite: 'natation', mode: 'longue' });
        await set(ref(db, `${baseProf}/active_classes/${classe}`), true);
        alert('✅ Configuration « Longue distance » transmise aux iPads !');
    } catch (e) {
        console.error(e);
        alert('Erreur lors de la transmission.');
    }
}

// ============================================================
// EXPORT / IMPORT JSON (local, RGPD)
// ============================================================
export function exporterNatationLongue() {
    const classe = currentClasse || getCurrentClasse();
    if (!classe) return alert('Sélectionnez une classe.');
    const data = {
        version: 1,
        classe,
        activite: 'natation-longue',
        date: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
        params: getParams(),
        groupes: getGroupes(),
        statuts: getStatuts(classe),
        mapping: JSON.parse(localStorage.getItem(`eps_arena_natation_longue_mapping_${classe}`) || '{}')
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${classe}_natation_longue_${data.date}.json`;
    a.click();
}

export function importerNatationLongue(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.classe) throw new Error('Format invalide');
            if (data.params) localStorage.setItem(getConfigKey(data.classe), JSON.stringify(data.params));
            if (data.groupes) localStorage.setItem(getGroupesKey(data.classe), JSON.stringify(data.groupes));
            if (data.statuts) localStorage.setItem(getStatutsKey(data.classe), JSON.stringify(data.statuts));
            if (data.mapping) localStorage.setItem(`eps_arena_natation_longue_mapping_${data.classe}`, JSON.stringify(data.mapping));
            alert('✅ Configuration « Longue distance » importée !');
            initNatationLongueInterface(currentContainer);
        } catch (err) {
            alert('❌ Erreur import : ' + err.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// ============================================================
// FONCTIONS GLOBALES (appels depuis les boutons HTML)
// ============================================================
window.nlGenererGroupes = function() {
    if (!currentClasse) return alert('Sélectionnez une classe.');
    const statuts = getStatuts(currentClasse);
    const nbVagues = parseInt(document.getElementById('nlNbVagues')?.value) || DEFAUT_PARAMS.nbVagues;
    const elevesNumerotes = getElevesNumerotes(currentClasse);
    const presents = elevesNumerotes.filter(e => !(statuts[e.id] === 'absent' || statuts[e.id] === 'inapte'));
    const groupesNumeros = repartirEnGroupes(presents.map(e => e.numero), nbVagues);

    const numToId = {};
    elevesNumerotes.forEach(e => { numToId[String(e.numero)] = e.id; });
    const groupesIds = {};
    COULEURS_GROUPES.forEach(c => {
        groupesIds[c.id] = (groupesNumeros[c.id] || []).map(n => numToId[String(n)]).filter(Boolean);
    });
    saveGroupes(groupesIds);
    loadAffectations();
};

window.nlRepartirParNiveau = function() {
    if (!currentClasse) return alert('Sélectionnez une classe.');
    const statuts = getStatuts(currentClasse);
    const nbVagues = parseInt(document.getElementById('nlNbVagues')?.value) || DEFAUT_PARAMS.nbVagues;
    const elevesNumerotes = getElevesNumerotes(currentClasse);
    const presents = elevesNumerotes.filter(e => !(statuts[e.id] === 'absent' || statuts[e.id] === 'inapte'));

    const avecIndice = presents.filter(e => Number(e.indiceNage) > 0);
    const sansIndice = presents.filter(e => !(Number(e.indiceNage) > 0));

    if (avecIndice.length === 0) {
        alert('Aucun indice de nage disponible pour ces élèves.\n\nEnregistre d\'abord des résultats dans le mode « Indice de nage » puis clique « 📡 Transmettre » (l\'indice est alors écrit sur chaque fiche élève).');
        return;
    }

    // Du meilleur nageur (indice le plus élevé) au moins bon.
    avecIndice.sort((a, b) => Number(b.indiceNage) - Number(a.indiceNage));

    // Bandes homogènes : vague 1 = meilleurs, dernière vague = moins bons.
    const groupesIds = {};
    COULEURS_GROUPES.forEach(c => { groupesIds[c.id] = []; });
    const taille = Math.ceil(avecIndice.length / nbVagues);
    avecIndice.forEach((e, i) => {
        const idx = Math.min(nbVagues - 1, Math.floor(i / taille));
        groupesIds[COULEURS_GROUPES[idx].id].push(e.id);
    });

    saveGroupes(groupesIds);
    loadAffectations();

    const msg = sansIndice.length > 0
        ? `\n⚠️ ${sansIndice.length} élève(s) sans indice de nage laissé(s) en réserve (à affecter manuellement).`
        : '';
    alert(`🏊 Répartition par niveau effectuée pour ${avecIndice.length} élève(s) sur ${nbVagues} vague(s).${msg}`);
};

window.nlViderGroupes = function() {
    if (!currentClasse) return;
    if (!confirm('Remettre tous les élèves dans la réserve ?')) return;
    saveGroupes({});
    loadAffectations();
};

window.nlNouvelleSession = async function() {
    if (!currentClasse) return alert('Sélectionnez une classe.');
    if (!confirm('Créer une nouvelle épreuve horodatée ? Les résultats précédents sont conservés.')) return;
    const sessionId = creerSessionId();
    await set(ref(db, getSessionActivePath(currentClasse)), sessionId);
    await set(ref(db, `${getSessionsPath(currentClasse)}/${sessionId}/meta`), { creeLe: Date.now() });
    alert(`✅ Nouvelle épreuve créée : ${sessionId}`);
};

window.nlLancerVague = async function(couleurId) {
    if (!currentClasse) return alert('Sélectionnez une classe.');
    const sessionRef = ref(db, getSessionActivePath(currentClasse));
    const snap = await new Promise(resolve => onValue(sessionRef, resolve, { onlyOnce: true }));
    let sessionId = snap.val();
    if (!sessionId) {
        sessionId = creerSessionId();
        await set(sessionRef, sessionId);
        await set(ref(db, `${getSessionsPath(currentClasse)}/${sessionId}/meta`), { creeLe: Date.now() });
    }
    await set(ref(db, `${getBasePath(currentClasse)}/commandes/sequence`), {
        etat: 'course',
        vague: couleurId,
        timestampDebut: Date.now(),
        action: 'go',
        actionTimestamp: Date.now()
    });
    alert(`▶️ Vague ${couleurId} lancée (${Math.round(getParams().duree / 60)} min)`);
};

window.nlTerminerVague = async function(couleurId) {
    if (!currentClasse) return alert('Sélectionnez une classe.');
    await set(ref(db, `${getBasePath(currentClasse)}/commandes/sequence`), {
        etat: 'termine',
        vague: couleurId,
        action: 'termine',
        actionTimestamp: Date.now()
    });
};

window.nlExportConfig = function() {
    exporterNatationLongue();
};

window.nlImportConfig = function(event) {
    importerNatationLongue(event);
};

