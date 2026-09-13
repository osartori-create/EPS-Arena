// src/js/modules/demi-fond/variantes/trois-cinq-min/trois-cinq-min-interface.js
// UI Professeur pour le sous-module 3x5min
// ⚠️ RGPD : seules les codeAutoEval transitent

import { db, ref, set } from '../../../../core/firebase-service.js';
import { getPhotoUrl, getExistingEleves } from '../../../../services/admin-service.js';
import { getCurrentClasse, getLocalMapping, setLocalMapping } from '../../../../core/live-engine.js';
import { COULEURS_GROUPES, getCouleurGroupe, getGroupesKey, getConfigKey, getBasePath, getVMAEleve } from '../../demifond-common.js';
import { DEFAUT_PARAMS, SOUS_MODULE_ID, TITRE_AFFICHE, repartirEnGroupes } from './trois-cinq-min-core.js';

let currentClasse = '';
let currentContainer = null;
let sortableInstances = [];

// ============================================================
// INITIALISATION
// ============================================================
export function initTroisCinqMinInterface(container) {
    if (!container) return;
    currentContainer = container;
    currentClasse = getCurrentClasse();

    container.innerHTML = '';

    // 1. En-tête avec actions
    container.appendChild(createHeader());

    // 2. Bloc paramétrage
    container.appendChild(createParams());

    // 3. Bloc groupes (réserve + groupes)
    container.appendChild(createGroupesBlock());

    // 4. Boutons de contrôle de séquence
    container.appendChild(createSequenceControls());

    // 5. Bouton transmission (tout en bas)
    container.appendChild(createTransmissionButton());

    // Restaurer les valeurs sauvegardées
    setTimeout(() => {
        restaurerParams();
        loadAffectations();
    }, 100);
}

// ============================================================
// EN-TÊTE (boutons générer, import/export)
// ============================================================
function createHeader() {
    const div = document.createElement('div');
    div.className = 'bg-slate-800 p-4 rounded-2xl border border-slate-700';
    div.innerHTML = `
        <div class="flex justify-between items-center flex-wrap gap-2">
            <h3 class="font-black text-blue-400 uppercase text-sm">⏱️ ${TITRE_AFFICHE} — Configuration</h3>
            <div class="flex flex-wrap gap-2">
                <button onclick="window.troisCinqMinGenererGroupes()"
                        class="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-emerald-400 active:scale-95">
                    🔄 Générer Groupes
                </button>
                <button onclick="window.troisCinqMinExportConfig()"
                        class="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-indigo-400 active:scale-95">
                    ⬇️ Export JSON
                </button>
                <button onclick="document.getElementById('dmfImportJSON').click()"
                        class="bg-slate-600 hover:bg-slate-500 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-slate-400 active:scale-95">
                    ⬆️ Import JSON
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
                <input type="number" id="dmfNbGroupes" value="2" min="1" max="4"
                       class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-center">
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
// GROUPES (Réserve + 4 groupes)
// ============================================================
function createGroupesBlock() {
    const div = document.createElement('div');
    div.className = 'bg-slate-800 p-4 rounded-2xl border border-slate-700';
    div.innerHTML = `
        <h4 class="font-bold text-slate-400 uppercase text-xs mb-3">👥 Groupes (max 4)</h4>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div class="bg-slate-900 p-4 rounded-2xl border-2 border-dashed border-slate-600">
                <h5 class="font-bold text-slate-400 uppercase text-xs mb-3">Réserve</h5>
                <div class="flex gap-2">
                    <div class="flex-1">
                        <div class="text-xs font-bold text-blue-400 uppercase mb-1">👦 Garçons</div>
                        <div id="dmfReserveGarcons" class="flex flex-col gap-1 min-h-[100px] border border-blue-800/30 rounded-lg p-1"></div>
                    </div>
                    <div class="flex-1">
                        <div class="text-xs font-bold text-rose-400 uppercase mb-1">👩 Filles</div>
                        <div id="dmfReserveFilles" class="flex flex-col gap-1 min-h-[100px] border border-rose-800/30 rounded-lg p-1"></div>
                    </div>
                </div>
            </div>
            <div class="lg:col-span-2">
                <div id="dmfGroupesGrid" class="grid grid-cols-1 md:grid-cols-2 gap-3"></div>
            </div>
        </div>
    `;
    return div;
}

// ============================================================
// CONTRÔLES DE SÉQUENCE (GO / Pause / etc.)
// ============================================================
function createSequenceControls() {
    const div = document.createElement('div');
    div.className = 'bg-slate-800 p-4 rounded-2xl border-2 border-blue-500/40';
    div.innerHTML = `
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
        ? `<img src="${url}" class="w-9 h-9 rounded-full object-cover border-2 border-slate-500">`
        : `<div class="w-9 h-9 rounded-full bg-slate-400 flex items-center justify-center text-lg">👤</div>`;

    const vma = getVMAEleve(currentClasse, eleve.id);
    const vmaHtml = vma ? `<span class="text-[10px] text-emerald-400 font-bold">VMA ${vma}</span>` : `<span class="text-[10px] text-amber-400 font-bold">⚠️ VMA ?</span>`;

    const div = document.createElement('div');
    div.className = `p-2 rounded-lg border-2 cursor-grab active:cursor-grabbing flex items-center gap-2 ${bgClass}`;
    div.dataset.id = eleve.id;
    div.innerHTML = `
        ${photoHtml}
        <div class="flex flex-col leading-tight flex-1 min-w-0">
            <span class="font-black text-slate-900 text-xs truncate">${eleve.prenom}</span>
            <span class="text-[10px] font-bold text-slate-600 uppercase truncate">${eleve.nom}</span>
            ${vmaHtml}
        </div>
        <span class="num-badge bg-slate-900 text-white text-sm font-black px-2 py-0.5 rounded hidden"></span>
    `;
    return div;
}

// ============================================================
// GÉNÉRATION DES GROUPES
// ============================================================
window.troisCinqMinGenererGroupes = async function() {
    if (!currentClasse) return alert('Sélectionne une classe.');
    const eleves = getExistingEleves(currentClasse);
    if (eleves.length === 0) return alert('Aucun élève.');

    const nbGroupes = parseInt(document.getElementById('dmfNbGroupes')?.value) || 2;

    // Vérifier les VMA
    const sansVMA = eleves.filter(e => !getVMAEleve(currentClasse, e.id));
    if (sansVMA.length > 0) {
        if (!confirm(`${sansVMA.length} élève(s) n'ont pas de VMA.\nOn peut quand même les ajouter aux groupes, mais le critère Performance ne sera pas calculé.\n\nContinuer ?`)) return;
    }

    // Créer les groupes
    const groupes = repartirEnGroupes(eleves, nbGroupes);
    sauvegarderGroupes(groupes);

    await renderGroupes();

    // Afficher la réserve (ceux qui ne sont dans aucun groupe, tous placés normalement)
    await populateReserve(eleves, groupes);

    setTimeout(() => initSortable(), 100);
    alert(`✅ ${nbGroupes} groupes générés.`);
};

function sauvegarderGroupes(groupes) {
    localStorage.setItem(getGroupesKey(currentClasse, SOUS_MODULE_ID), JSON.stringify(groupes));
}

function chargerGroupes() {
    return JSON.parse(localStorage.getItem(getGroupesKey(currentClasse, SOUS_MODULE_ID)) || 'null');
}

async function renderGroupes() {
    const grid = document.getElementById('dmfGroupesGrid');
    if (!grid) return;

    const groupes = chargerGroupes() || {};
    const eleves = getExistingEleves(currentClasse);

    let html = '';
    COULEURS_GROUPES.slice(0, 4).forEach(couleur => {
        const membres = groupes[couleur.id] || [];
        html += `
            <div class="flex flex-col">
                <div class="header-col text-center py-2 rounded-t-lg font-black text-sm uppercase"
                     style="background:${couleur.bg}; color:${couleur.text}; border:2px solid ${couleur.border}; border-bottom:none;">
                    ${couleur.label} <span class="text-[10px] opacity-70">(${membres.length})</span>
                </div>
                <div class="groupe-members flex flex-col gap-1 p-2 rounded-b-lg min-h-[100px]"
                     data-couleur="${couleur.id}"
                     style="background:#0f172a; border:2px solid ${couleur.border}; border-top:none;">
                </div>
            </div>
        `;
    });
    grid.innerHTML = html;

    // Ajouter les cartes élèves
    for (const couleur of COULEURS_GROUPES) {
        const ids = groupes[couleur.id] || [];
        const cont = document.querySelector(`.groupe-members[data-couleur="${couleur.id}"]`);
        if (!cont) continue;
        for (const id of ids) {
            const eleve = eleves.find(e => e.id === id);
            if (eleve) cont.appendChild(await createEleveCard(eleve));
        }
    }

    updateNumBadges();
    saveAffectations();
}

async function populateReserve(eleves, groupes) {
    const garconsContainer = document.getElementById('dmfReserveGarcons');
    const fillesContainer = document.getElementById('dmfReserveFilles');
    if (!garconsContainer || !fillesContainer) return;

    garconsContainer.innerHTML = '';
    fillesContainer.innerHTML = '';

    // Récupérer tous les ids placés
    const placedIds = new Set();
    Object.values(groupes).forEach(arr => arr.forEach(id => placedIds.add(id)));

    // Ceux qui ne sont pas dans les groupes vont en réserve
    const nonPlaces = eleves.filter(e => !placedIds.has(e.id));

    const garcons = nonPlaces.filter(e => e.sexe === 'M').sort((a, b) => a.nom.localeCompare(b.nom));
    const filles = nonPlaces.filter(e => e.sexe === 'F').sort((a, b) => a.nom.localeCompare(b.nom));
    const autres = nonPlaces.filter(e => e.sexe !== 'M' && e.sexe !== 'F');

    for (const e of garcons) garconsContainer.appendChild(await createEleveCard(e));
    for (const e of filles) fillesContainer.appendChild(await createEleveCard(e));
    for (const e of autres) garconsContainer.appendChild(await createEleveCard(e));

    if (garconsContainer.children.length === 0) garconsContainer.innerHTML = '<p class="text-slate-500 text-xs">Aucun garçon</p>';
    if (fillesContainer.children.length === 0) fillesContainer.innerHTML = '<p class="text-slate-500 text-xs">Aucune fille</p>';
}

// ============================================================
// SORTABLE
// ============================================================
function initSortable() {
    if (typeof Sortable === 'undefined') return;
    sortableInstances.forEach(s => { try { s.destroy(); } catch (e) {} });
    sortableInstances = [];

    const garcons = document.getElementById('dmfReserveGarcons');
    const filles = document.getElementById('dmfReserveFilles');

    if (garcons) {
        garcons.__sortable = new Sortable(garcons, {
            group: 'demifond', animation: 150,
            onEnd: () => { saveAffectations(); updateNumBadges(); }
        });
        sortableInstances.push(garcons.__sortable);
    }
    if (filles) {
        filles.__sortable = new Sortable(filles, {
            group: 'demifond', animation: 150,
            onEnd: () => { saveAffectations(); updateNumBadges(); }
        });
        sortableInstances.push(filles.__sortable);
    }
    document.querySelectorAll('.groupe-members').forEach(el => {
        el.__sortable = new Sortable(el, {
            group: 'demifond', animation: 150,
            onEnd: () => { saveAffectations(); updateNumBadges(); }
        });
        sortableInstances.push(el.__sortable);
    });
}

function updateNumBadges() {
    // Les badges affichent le codeAutoEval de l'élève (pour info visuelle du prof)
    document.querySelectorAll('.groupe-members [data-id]').forEach(card => {
        const id = card.dataset.id;
        const eleves = getExistingEleves(currentClasse);
        const eleve = eleves.find(e => e.id === id);
        const badge = card.querySelector('.num-badge');
        if (badge && eleve?.codeAutoEval) {
            badge.textContent = `#${eleve.codeAutoEval}`;
            badge.classList.remove('hidden');
        }
    });
}

// ============================================================
// SAUVEGARDE
// ============================================================
function saveAffectations() {
    const groupes = {};
    COULEURS_GROUPES.forEach(c => { groupes[c.id] = []; });

    document.querySelectorAll('.groupe-members').forEach(container => {
        const couleur = container.dataset.couleur;
        container.querySelectorAll('[data-id]').forEach(card => {
            groupes[couleur].push(card.dataset.id);
        });
    });

    sauvegarderGroupes(groupes);
}

async function loadAffectations() {
    const groupes = chargerGroupes();
    if (!groupes || Object.values(groupes).every(arr => arr.length === 0)) {
        // Rien à charger, on génère par défaut
        await renderGroupes();
        await populateReserve(getExistingEleves(currentClasse), {});
        return;
    }
    await renderGroupes();
    await populateReserve(getExistingEleves(currentClasse), groupes);
    setTimeout(() => initSortable(), 100);
}

// ============================================================
// PARAMS : SAUVEGARDE / RESTAURATION
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

    // Vérifier qu'on a des groupes
    const groupes = chargerGroupes();
    if (!groupes || Object.values(groupes).every(arr => arr.length === 0)) {
        return alert('Génère d\'abord les groupes.');
    }

    // Construire le mapping local (RGPD)
    const eleves = getExistingEleves(currentClasse);
    const localMapping = {};
    COULEURS_GROUPES.forEach(c => {
        (groupes[c.id] || []).forEach(id => {
            const eleve = eleves.find(e => e.id === id);
            if (eleve?.codeAutoEval) {
                localMapping[`${currentClasse}_${c.id}_${eleve.codeAutoEval}`] = id;
            }
        });
    });
    // Fusionner avec le mapping existant
    const existing = getLocalMapping(currentClasse) || {};
    setLocalMapping(currentClasse, { ...existing, ...localMapping });

    // Préparer la config Firebase
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
        groupes: {}
    };

    COULEURS_GROUPES.forEach(c => {
        configData.groupes[c.id] = (groupes[c.id] || []).map(id => {
            const eleve = eleves.find(e => e.id === id);
            return eleve?.codeAutoEval || null;
        }).filter(Boolean);
    });

    try {
        await set(ref(db, `${getBasePath(currentClasse)}/config`), configData);
        await set(ref(db, `etablissements/0680013V/profs/${localStorage.getItem('eps_arena_profCode') || 'DEFAULT'}/${currentClasse}/config`), { activite: 'demi-fond' });

        // Lancer la séquence : état = course1
        await set(ref(db, `${getBasePath(currentClasse)}/commandes/sequence`), {
            etat: 'course1',
            courseNum: 1,
            timestampDebut: Date.now(),
            timestampMaj: Date.now()
        });

        const stateEl = document.getElementById('dmfSequenceState');
        if (stateEl) stateEl.innerHTML = 'État : <span class="font-black text-emerald-400">COURSE 1</span>';

        alert('🚀 GO ! La séquence démarre sur les iPads.');
    } catch (err) {
        console.error(err);
        alert('❌ Erreur : ' + err.message);
    }
};

window.troisCinqMinPauseManuelle = async function() {
    if (!currentClasse) return;
    try {
        const stateRef = ref(db, `${getBasePath(currentClasse)}/commandes/sequence`);
        await set(stateRef, {
            etat: 'pause_manuelle',
            timestampMaj: Date.now()
        });
        alert('⏸️ Séquence en pause manuelle.');
    } catch (err) { console.error(err); }
};

window.troisCinqMinReprendre = async function() {
    if (!currentClasse) return;
    try {
        const stateRef = ref(db, `${getBasePath(currentClasse)}/commandes/sequence`);
        await set(stateRef, {
            etat: 'course',
            timestampMaj: Date.now()
        });
        alert('▶️ Séquence reprise.');
    } catch (err) { console.error(err); }
};

window.troisCinqMinSkipCourse = async function() {
    if (!currentClasse) return;
    if (!confirm('Passer à la course suivante ?')) return;
    alert('⏭️ Skip envoyé. Les kiosques vont basculer.');
    // Le kiosque va détecter le changement de course
    // À implémenter dans la Livraison 2
};

window.troisCinqMinStop = async function() {
    if (!currentClasse) return;
    if (!confirm('Arrêter la séquence ?')) return;
    try {
        const stateRef = ref(db, `${getBasePath(currentClasse)}/commandes/sequence`);
        await set(stateRef, {
            etat: 'termine',
            timestampMaj: Date.now()
        });
        alert('🛑 Séquence terminée.');
    } catch (err) { console.error(err); }
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

    const eleves = getExistingEleves(currentClasse);
    const localMapping = {};
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
            }
        });
        configData.groupes[c.id] = codes;
    });

    const existing = getLocalMapping(currentClasse) || {};
    setLocalMapping(currentClasse, { ...existing, ...localMapping });

    try {
        const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
        await set(ref(db, `${getBasePath(currentClasse)}/config`), configData);
        await set(ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/config`), { activite: 'demi-fond' });
        await set(ref(db, `etablissements/0680013V/profs/${profCode}/active_classes/${currentClasse}`), true);

        // Réinitialiser la séquence
        await set(ref(db, `${getBasePath(currentClasse)}/commandes/sequence`), {
            etat: 'idle',
            timestampMaj: Date.now()
        });

        alert(`✅ Configuration transmise.\n${Object.keys(configData.groupes).length} groupes, ${Object.values(configData.groupes).reduce((a, b) => a + b.length, 0)} élèves.`);
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
        groupes: chargerGroupes() || {}
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
// CLEANUP
// ============================================================
export function cleanupTroisCinqMinInterface() {
    sortableInstances.forEach(s => { try { s.destroy(); } catch (e) {} });
    sortableInstances = [];
    currentContainer = null;
}