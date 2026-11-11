// src/js/carnet/plan.js
// Plans de classe (type iDoceo) — plusieurs plans par classe, glisser-déposer,
// colonnes colorées par groupe, création de groupes depuis une sélection d'élèves.
// Données (localStorage, RGPD) : eps_arena_plans_<classe> = { actif, plans: [{ id, nom, lignes, colonnes, placements, colonnesGroupes }] }

import { getExistingEleves, getPhotoUrl } from '../services/admin-service.js';
import { getCurrentClasse } from '../core/live-engine.js';
import { lireGroupes, getGroupesEleve, creerGroupe, ajouterElevesGroupe, retirerEleveGroupe, retirerEleveDeTousGroupes, supprimerGroupe } from './groupes.js';
import { lireAppelClasse, ecrireAppelClasse, STATUTS } from './appel.js';

const KEY = 'eps_arena_plans_';
const KEY_LEGACY = 'eps_arena_plan_';

let currentClasse = '';
let data = { actif: '', plans: [] };
let dragEleveId = '';
let modeSelection = false;
let selection = new Set();
let modeVue = 'grille';
let modeAppel = false;
const photosCache = {};

function lireData(classe) {
    let d = JSON.parse(localStorage.getItem(KEY + classe) || 'null');
    if (!d || !Array.isArray(d.plans) || d.plans.length === 0) {
        const legacy = JSON.parse(localStorage.getItem(KEY_LEGACY + classe) || 'null');
        if (legacy && typeof legacy === 'object') {
            d = { actif: 'p1', plans: [{ id: 'p1', nom: 'Plan 1', lignes: legacy.lignes || 5, colonnes: legacy.colonnes || 4, placements: legacy.placements || {}, colonnesGroupes: {} }] };
        } else {
            d = { actif: 'p1', plans: [{ id: 'p1', nom: 'Plan 1', lignes: 5, colonnes: 4, placements: {}, colonnesGroupes: {} }] };
        }
        ecrireData(classe, d);
    }
    if (!d.plans.find(p => p.id === d.actif)) d.actif = d.plans[0].id;
    return d;
}
function ecrireData(classe, d) { localStorage.setItem(KEY + classe, JSON.stringify(d)); }
function getPlanActif() { return data.plans.find(p => p.id === data.actif) || data.plans[0]; }
function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
function formaterDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const j = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${j}`;
}
async function chargerPhotos(eleves) {
    await Promise.all(eleves.map(async e => {
        if (photosCache[e.id] !== undefined) return;
        try { photosCache[e.id] = await getPhotoUrl(e.id); } catch (err) { photosCache[e.id] = null; }
    }));
}

export async function initPlanInterface() {
    currentClasse = getCurrentClasse();
    data = lireData(currentClasse);
    modeSelection = false;
    selection = new Set();
    await chargerPhotos(getExistingEleves(currentClasse));
    render();
}

function render() {
    const container = document.getElementById('viewPlan');
    if (!container) return;
    if (!currentClasse) {
        container.innerHTML = '<p class="text-slate-500 text-center py-10">Sélectionne une classe.</p>';
        return;
    }
    const plan = getPlanActif();
    if (!plan) {
        container.innerHTML = `
            <div class="bg-slate-800 p-10 rounded-2xl border border-slate-700 text-center text-slate-400">
                <p class="font-bold">Aucun plan.</p>
                <button onclick="window.planNouveau()" class="mt-3 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl font-black text-xs text-white">➕ Créer un plan</button>
            </div>`;
        return;
    }
    if (modeVue === 'zones') {
        renderZones();
        return;
    }

    const eleves = getExistingEleves(currentClasse);
    eleves.sort((a, b) => (a.nom || '').localeCompare(b.nom || '') || (a.prenom || '').localeCompare(b.prenom || ''));
    const groupes = lireGroupes(currentClasse);

    const placeParId = {};
    Object.entries(plan.placements).forEach(([pos, id]) => { placeParId[id] = pos; });
    const nonPlaces = eleves.filter(e => !placeParId[e.id]);
    const aPlacer = nonPlaces.filter(e => getGroupesEleve(currentClasse, e.id).length === 0);
    const enGroupeNonPlaces = nonPlaces.filter(e => getGroupesEleve(currentClasse, e.id).length > 0);

    const avatar = (e, taille) => photosCache[e.id]
        ? `<img src="${photosCache[e.id]}" class="${taille} rounded-full object-cover shrink-0">`
        : `<div class="${taille} rounded-full bg-slate-700 flex items-center justify-center shrink-0">👤</div>`;

    const couleurEleve = (e) => {
        const gs = getGroupesEleve(currentClasse, e.id);
        return gs.length ? gs[0].couleur : null;
    };

    const cellules = [];
    for (let r = 0; r < plan.lignes; r++) {
        for (let c = 0; c < plan.colonnes; c++) {
            const pos = `${r}-${c}`;
            const id = plan.placements[pos] || '';
            cellules.push({ pos, r, c, e: id ? eleves.find(x => x.id === id) : null });
        }
    }

    const colonnesGroupes = plan.colonnesGroupes || {};
    const groupesParColonne = [];
    for (let c = 0; c < plan.colonnes; c++) {
        const gid = colonnesGroupes[c] || '';
        groupesParColonne.push(groupes.find(x => x.id === gid) || null);
    }
    const styleColonne = (c) => groupesParColonne[c] ? `background-color:${hexToRgba(groupesParColonne[c].couleur, 0.14)};` : '';

    const statutsJour = modeAppel ? (lireAppelClasse(currentClasse)[formaterDate(new Date())] || {}) : {};
    let resumeAppel = '';
    if (modeAppel) {
        let nbPresent = 0, nbAbsent = 0, nbRetard = 0, nbInapte = 0, nbOubli = 0;
        eleves.forEach(e => {
            const f = statutsJour[e.id] || {};
            const n = (f.absent ? 1 : 0) + (f.retard ? 1 : 0) + (f.inapte ? 1 : 0) + (f.oubli_tenue ? 1 : 0);
            if (n === 0) nbPresent++;
            if (f.absent) nbAbsent++;
            if (f.retard) nbRetard++;
            if (f.inapte) nbInapte++;
            if (f.oubli_tenue) nbOubli++;
        });
        const dateFr = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
        resumeAppel = `
            <div class="bg-slate-800 p-3 rounded-2xl border border-slate-700 flex gap-2 flex-wrap items-center text-xs">
                <span class="font-black text-white uppercase">🗓️ Appel du ${dateFr}</span>
                <span class="px-2 py-0.5 rounded-full font-black" style="background-color:#22c55e;color:#fff;">Présents : ${nbPresent}</span>
                <span class="px-2 py-0.5 rounded-full font-black" style="background-color:#ef4444;color:#fff;">Absents : ${nbAbsent}</span>
                <span class="px-2 py-0.5 rounded-full font-black" style="background-color:#f59e0b;color:#fff;">Retards : ${nbRetard}</span>
                <span class="px-2 py-0.5 rounded-full font-black" style="background-color:#8b5cf6;color:#fff;">Inaptes : ${nbInapte}</span>
                <span class="px-2 py-0.5 rounded-full font-black" style="background-color:#3b82f6;color:#fff;">Oublis : ${nbOubli}</span>
            </div>`;
    }

    const badgesAppel = (e) => {
        if (!modeAppel) return '';
        const f = statutsJour[e.id] || {};
        const actifs = STATUTS.filter(s => f[s.id] === true);
        if (actifs.length === 0) return '<span class="text-[10px] text-emerald-400 font-black">✓</span>';
        return actifs.map(s => `<span title="${s.label}" class="text-sm">${s.icon}</span>`).join('');
    };

    const htmlHaut = `
        <div class="space-y-4">
            <div class="flex gap-2">
                <button onclick="window.planMode('grille')" class="px-3 py-1.5 rounded-xl font-black text-xs ${modeVue === 'grille' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}">🪑 Grille</button>
                <button onclick="window.planMode('zones')" class="px-3 py-1.5 rounded-xl font-black text-xs ${modeVue === 'zones' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}">🗂️ Zones groupes</button>
                <button onclick="window.planToggleAppel()" class="px-3 py-1.5 rounded-xl font-black text-xs ${modeAppel ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'}">🗓️ Appel</button>
            </div>
            ${resumeAppel}
            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <div class="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h3 class="font-black text-blue-400 uppercase text-sm">🪑 Plans de classe</h3>
                        <p class="text-xs text-slate-400 mt-1">Classe ${currentClasse} · plusieurs plans, colonnes colorées par groupe.</p>
                    </div>
                    <div class="flex items-center gap-2 flex-wrap">
                        <select onchange="window.planSelect(this.value)" class="bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm font-bold text-white">
                            ${data.plans.map(p => `<option value="${p.id}" ${p.id === plan.id ? 'selected' : ''}>${p.nom}</option>`).join('')}
                        </select>
                        <button onclick="window.planNouveau()" class="bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-xl font-black text-xs text-white">➕ Plan</button>
                        <button onclick="window.planRenommer()" class="bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-xl font-black text-xs text-white">✏️</button>
                        <button onclick="window.planSupprimer()" class="bg-red-700 hover:bg-red-600 px-3 py-1.5 rounded-xl font-black text-xs text-white">🗑️</button>
                    </div>
                </div>
                <div class="flex flex-wrap items-center gap-2 mt-4">
                    <label class="text-xs font-bold text-slate-400">Lignes</label>
                    <input type="number" id="plan-lignes" value="${plan.lignes}" min="1" max="15" class="w-16 bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm font-bold text-white">
                    <label class="text-xs font-bold text-slate-400">Colonnes</label>
                    <input type="number" id="plan-colonnes" value="${plan.colonnes}" min="1" max="15" class="w-16 bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm font-bold text-white">
                    <button onclick="window.planResize()" class="bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-xl font-black text-xs text-white">Appliquer</button>
                </div>
                <div class="flex gap-2 flex-wrap mt-4 items-center">
                    <button onclick="window.planAutoRemplir('aleatoire')" class="bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-xl font-black text-xs text-white">🔀 Auto-remplir (aléatoire)</button>
                    <button onclick="window.planAutoRemplir('groupe')" class="bg-purple-600 hover:bg-purple-500 px-3 py-1.5 rounded-xl font-black text-xs text-white">👥 Auto-remplir (par groupe)</button>
                    <button onclick="window.planVider()" class="bg-red-700 hover:bg-red-600 px-3 py-1.5 rounded-xl font-black text-xs text-white">🗑️ Vider</button>
                    <button onclick="window.planNouveauGroupe()" class="bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-xl font-black text-xs text-white">➕ Groupe</button>
                    <button onclick="window.planToggleSelection()" class="px-3 py-1.5 rounded-xl font-black text-xs ${modeSelection ? 'bg-amber-500 text-slate-900' : 'bg-slate-700 text-white'}">${modeSelection ? '✖ Fin sélection' : '🖱️ Sélection'}</button>
                    ${modeSelection ? `
                        ${groupes.length ? `<select id="plan-groupe-cible" class="bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-xs font-bold text-white">
                            ${groupes.map(g => `<option value="${g.id}">${g.nom}</option>`).join('')}
                        </select>
                        <button onclick="window.planAjouterAuGroupe()" class="bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-xl font-black text-xs text-white">➕ Ajouter au groupe (${selection.size})</button>` : ''}
                        <button onclick="window.planGroupeDepuisSelection()" class="bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-xl font-black text-xs text-white">🆕 Nouveau groupe (${selection.size})</button>
                    ` : ''}
                </div>
            </div>
    `;

    const htmlPool = `
            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <h4 class="text-xs font-black text-slate-400 uppercase mb-3">Élèves à placer (${aPlacer.length})</h4>
                <div class="flex gap-2 flex-wrap" ondragover="window.planDragOver(event)" ondrop="window.planDropPool(event)">
                    ${aPlacer.map(e => `
                        <div draggable="true" ondragstart="window.planDragStart(event, '${e.id}', '')" onclick="window.planClicEleve('${e.id}')" class="px-2 py-1.5 rounded-xl text-xs font-bold text-white cursor-grab hover:scale-105 transition flex items-center gap-2 ${selection.has(e.id) ? 'ring-2 ring-amber-400' : ''}" style="background-color:#334155;">
                            ${avatar(e, 'w-7 h-7')}
                            <span>${e.prenom} ${e.nom}</span>
                        </div>
                    `).join('')}
                    ${aPlacer.length === 0 ? '<span class="text-xs text-slate-500">Tous les élèves sont placés ou dans un groupe.</span>' : ''}
                </div>
                ${enGroupeNonPlaces.length ? `
                    <h4 class="text-xs font-black text-slate-400 uppercase mt-4 mb-2">Dans un groupe (${enGroupeNonPlaces.length})</h4>
                    <div class="flex gap-2 flex-wrap">
                        ${enGroupeNonPlaces.map(e => `
                            <div draggable="true" ondragstart="window.planDragStart(event, '${e.id}', '')" onclick="window.planClicEleve('${e.id}')" class="px-2 py-1.5 rounded-xl text-xs font-bold text-white cursor-grab hover:scale-105 transition flex items-center gap-2 ${selection.has(e.id) ? 'ring-2 ring-amber-400' : ''}" style="background-color:${couleurEleve(e) || '#334155'};">
                                ${avatar(e, 'w-7 h-7')}
                                <span>${e.prenom} ${e.nom}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
    `;

    const htmlGrid = `
            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <div class="grid gap-2 mb-2" style="grid-template-columns: repeat(${plan.colonnes}, minmax(0, 1fr));">
                    ${groupesParColonne.map((g, c) => `
                        <div>
                            <select onchange="window.planSetColonneGroupe(${c}, this.value)" class="w-full bg-slate-900 border border-slate-600 rounded px-1 py-1 text-[10px] font-bold text-white">
                                <option value="">—</option>
                                ${groupes.map(x => `<option value="${x.id}" ${colonnesGroupes[c] === x.id ? 'selected' : ''}>${x.nom}</option>`).join('')}
                            </select>
                            ${g ? `<div class="text-[9px] text-center mt-0.5 font-bold truncate" style="color:${g.couleur};">${g.nom}</div>` : ''}
                        </div>
                    `).join('')}
                </div>
                <div class="grid gap-2" style="grid-template-columns: repeat(${plan.colonnes}, minmax(0, 1fr));">
                    ${cellules.map(cell => `
                        <div ondragover="window.planDragOver(event)" ondrop="window.planDrop(event, '${cell.pos}')" class="min-h-[92px] rounded-xl border-2 border-dashed border-slate-700 p-1.5 flex items-center justify-center ${cell.e ? '' : 'bg-slate-900/40'}" style="${styleColonne(cell.c)}">
                            ${cell.e ? `
                                <div draggable="true" ondragstart="window.planDragStart(event, '${cell.e.id}', '${cell.pos}')" onclick="${modeAppel ? `window.planAppelOuvrir('${cell.e.id}', event)` : `window.planClicEleve('${cell.e.id}')`}" class="w-full text-center cursor-grab ${selection.has(cell.e.id) ? 'ring-2 ring-amber-400 rounded-lg' : ''}" title="${modeAppel ? 'Cliquer pour faire l\'appel' : 'Glisser pour déplacer · cliquer pour retirer / sélectionner'}">
                                    <div class="rounded-lg px-1 py-1.5" style="border-left: 4px solid ${couleurEleve(cell.e) || '#475569'}; background-color:${couleurEleve(cell.e) ? hexToRgba(couleurEleve(cell.e), 0.28) : '#1e293b'};">
                                        ${avatar(cell.e, 'w-9 h-9 mx-auto')}
                                        <div class="font-bold text-white text-[11px] truncate mt-1">${cell.e.prenom} ${cell.e.nom}</div>
                                        <div class="flex gap-0.5 justify-center mt-0.5">
                                            ${getGroupesEleve(currentClasse, cell.e.id).map(g => `<span class="w-2 h-2 rounded-full inline-block" style="background-color:${g.couleur};" title="${g.nom}"></span>`).join('')}
                                        </div>
                                        ${badgesAppel(cell.e)}
                                    </div>
                                </div>
                            ` : '<span class="text-[10px] text-slate-600">déposer ici</span>'}
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    container.innerHTML = htmlHaut + htmlPool + htmlGrid;
}

function renderZones() {
    const container = document.getElementById('viewPlan');
    if (!container) return;
    const eleves = getExistingEleves(currentClasse);
    eleves.sort((a, b) => (a.nom || '').localeCompare(b.nom || '') || (a.prenom || '').localeCompare(b.prenom || ''));
    const groupes = lireGroupes(currentClasse);

    const enGroupe = new Set(groupes.flatMap(g => g.eleves));
    const sansGroupe = eleves.filter(e => !enGroupe.has(e.id));

    const avatar = (e, taille) => photosCache[e.id]
        ? `<img src="${photosCache[e.id]}" class="${taille} rounded-full object-cover shrink-0">`
        : `<div class="${taille} rounded-full bg-slate-700 flex items-center justify-center shrink-0">👤</div>`;

    const chip = (e, groupeId) => `
        <div draggable="true" ondragstart="window.planDragStart(event, '${e.id}')" class="flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-bold text-white cursor-grab" style="background-color:#1e293b;">
            ${avatar(e, 'w-7 h-7')}
            <span>${e.prenom} ${e.nom}</span>
            ${groupeId ? `<button onclick="window.planZonesRetirerEleve('${groupeId}', '${e.id}')" class="ml-auto text-red-400 hover:text-red-300 font-black">✖</button>` : ''}
        </div>`;

    container.innerHTML = `
        <div class="space-y-4">
            <div class="flex gap-2">
                <button onclick="window.planMode('grille')" class="px-3 py-1.5 rounded-xl font-black text-xs ${modeVue === 'grille' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}">🪑 Grille</button>
                <button onclick="window.planMode('zones')" class="px-3 py-1.5 rounded-xl font-black text-xs ${modeVue === 'zones' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}">🗂️ Zones groupes</button>
                <button onclick="window.planNouveauGroupe()" class="ml-auto bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-xl font-black text-xs text-white">➕ Groupe</button>
            </div>

            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <h4 class="text-xs font-black text-slate-400 uppercase mb-3">Élèves sans groupe (${sansGroupe.length})</h4>
                <div class="flex gap-2 flex-wrap" ondragover="window.planDragOver(event)" ondrop="window.planZonesDropReserve(event)">
                    ${sansGroupe.map(e => chip(e, '')).join('')}
                    ${sansGroupe.length === 0 ? '<span class="text-xs text-slate-500">Tous les élèves sont dans un groupe.</span>' : ''}
                </div>
            </div>

            <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                ${groupes.map(g => `
                    <div class="bg-slate-800 rounded-2xl border-2 overflow-hidden" style="border-color:${g.couleur};">
                        <div class="p-3 flex items-center gap-2" style="background-color:${hexToRgba(g.couleur, 0.2)};">
                            <span class="w-3 h-3 rounded-full" style="background-color:${g.couleur};"></span>
                            <span class="font-bold text-white text-sm">${g.nom}</span>
                            <span class="text-xs text-slate-400">(${g.eleves.length})</span>
                            <button onclick="window.planZonesSupprimerGroupe('${g.id}')" class="ml-auto text-red-400 hover:text-red-300 font-black">✖</button>
                        </div>
                        <div class="p-2 min-h-[80px] flex flex-col gap-1" ondragover="window.planDragOver(event)" ondrop="window.planZonesDropGroupe(event, '${g.id}')">
                            ${g.eleves.map(id => { const e = eleves.find(x => x.id === id); return e ? chip(e, g.id) : ''; }).join('')}
                            ${g.eleves.length === 0 ? '<span class="text-[10px] text-slate-600 text-center py-3">glisse des élèves ici</span>' : ''}
                        </div>
                    </div>
                `).join('')}
                ${groupes.length === 0 ? '<p class="text-slate-500 text-sm col-span-full text-center py-4">Aucun groupe. Crée un groupe avec le bouton ➕ Groupe.</p>' : ''}
            </div>
        </div>
    `;
}

window.planMode = function(mode) {
    modeVue = mode;
    render();
};

window.planZonesDropGroupe = function(e, groupeId) {
    e.preventDefault();
    const id = dragEleveId;
    if (!id) return;
    ajouterElevesGroupe(currentClasse, groupeId, [id]);
    dragEleveId = '';
    render();
};

window.planZonesDropReserve = function(e) {
    e.preventDefault();
    const id = dragEleveId;
    if (!id) return;
    retirerEleveDeTousGroupes(currentClasse, id);
    dragEleveId = '';
    render();
};

window.planZonesRetirerEleve = function(groupeId, eleveId) {
    retirerEleveGroupe(currentClasse, groupeId, eleveId);
    render();
};

window.planZonesSupprimerGroupe = function(groupeId) {
    if (confirm('Supprimer ce groupe ?')) {
        supprimerGroupe(currentClasse, groupeId);
        render();
    }
};

window.planSelect = function(id) {
    data.actif = id;
    ecrireData(currentClasse, data);
    render();
};

window.planNouveau = function() {
    const nom = prompt('Nom du nouveau plan ?');
    if (nom && nom.trim()) {
        const id = 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1000);
        data.plans.push({ id, nom: nom.trim(), lignes: 5, colonnes: 4, placements: {}, colonnesGroupes: {} });
        data.actif = id;
        ecrireData(currentClasse, data);
        render();
    }
};

window.planRenommer = function() {
    const plan = getPlanActif();
    if (!plan) return;
    const nom = prompt('Renommer le plan :', plan.nom);
    if (nom && nom.trim()) {
        plan.nom = nom.trim();
        ecrireData(currentClasse, data);
        render();
    }
};

window.planSupprimer = function() {
    const plan = getPlanActif();
    if (!plan) return;
    if (confirm(`Supprimer le plan « ${plan.nom} » ?`)) {
        data.plans = data.plans.filter(p => p.id !== plan.id);
        data.actif = data.plans[0] ? data.plans[0].id : '';
        ecrireData(currentClasse, data);
        render();
    }
};

window.planResize = function() {
    const plan = getPlanActif();
    if (!plan) return;
    const lignes = parseInt(document.getElementById('plan-lignes').value) || 5;
    const colonnes = parseInt(document.getElementById('plan-colonnes').value) || 4;
    if (lignes < 1 || colonnes < 1 || lignes > 15 || colonnes > 15) { alert('Taille invalide (1–15).'); return; }
    const newPlacements = {};
    Object.entries(plan.placements).forEach(([pos, id]) => {
        const [r, c] = pos.split('-').map(Number);
        if (r < lignes && c < colonnes) newPlacements[pos] = id;
    });
    plan.lignes = lignes;
    plan.colonnes = colonnes;
    plan.placements = newPlacements;
    ecrireData(currentClasse, data);
    render();
};

window.planSetColonneGroupe = function(c, groupeId) {
    const plan = getPlanActif();
    if (!plan) return;
    if (!plan.colonnesGroupes) plan.colonnesGroupes = {};
    if (groupeId) plan.colonnesGroupes[c] = groupeId; else delete plan.colonnesGroupes[c];
    ecrireData(currentClasse, data);
    render();
};

window.planToggleSelection = function() {
    modeSelection = !modeSelection;
    if (!modeSelection) selection = new Set();
    render();
};

window.planClicEleve = function(id) {
    const plan = getPlanActif();
    if (!plan) return;
    if (modeSelection) {
        if (selection.has(id)) selection.delete(id); else selection.add(id);
        render();
    } else {
        const oldPos = Object.keys(plan.placements).find(p => plan.placements[p] === id) || '';
        if (oldPos) delete plan.placements[oldPos];
        ecrireData(currentClasse, data);
        render();
    }
};

window.planGroupeDepuisSelection = function() {
    if (selection.size === 0) { alert("Sélectionne d'abord des élèves (mode Sélection)."); return; }
    const nom = prompt(`Nom du groupe (${selection.size} élève(s) sélectionné(s)) ?`);
    if (!nom || !nom.trim()) return;
    const id = creerGroupe(currentClasse, nom.trim());
    ajouterElevesGroupe(currentClasse, id, [...selection]);
    modeSelection = false;
    selection = new Set();
    render();
};

window.planAjouterAuGroupe = function() {
    if (selection.size === 0) { alert("Sélectionne d'abord des élèves (mode Sélection)."); return; }
    const sel = document.getElementById('plan-groupe-cible');
    const groupeId = sel ? sel.value : '';
    if (!groupeId) { alert('Aucun groupe cible.'); return; }
    ajouterElevesGroupe(currentClasse, groupeId, [...selection]);
    modeSelection = false;
    selection = new Set();
    render();
};

window.planNouveauGroupe = function() {
    const nom = prompt('Nom du nouveau groupe ?');
    if (nom && nom.trim()) {
        creerGroupe(currentClasse, nom.trim());
        render();
    }
};

window.planDragStart = function(e, id) {
    dragEleveId = id;
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
};

window.planDragOver = function(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
};

window.planDrop = function(e, pos) {
    e.preventDefault();
    const plan = getPlanActif();
    if (!plan) return;
    const id = dragEleveId;
    if (!id) return;
    const oldPos = Object.keys(plan.placements).find(p => plan.placements[p] === id) || '';
    const occupant = plan.placements[pos] || '';
    if (oldPos) delete plan.placements[oldPos];
    plan.placements[pos] = id;
    if (occupant && occupant !== id && oldPos) {
        plan.placements[oldPos] = occupant;
    }
    ecrireData(currentClasse, data);
    dragEleveId = '';
    render();
};

window.planDropPool = function(e) {
    e.preventDefault();
    const plan = getPlanActif();
    if (!plan) return;
    const id = dragEleveId;
    if (!id) return;
    const oldPos = Object.keys(plan.placements).find(p => plan.placements[p] === id) || '';
    if (oldPos) delete plan.placements[oldPos];
    ecrireData(currentClasse, data);
    dragEleveId = '';
    render();
};

window.planAutoRemplir = function(mode) {
    const plan = getPlanActif();
    if (!plan) return;
    const eleves = getExistingEleves(currentClasse);
    const places = new Set(Object.values(plan.placements));
    let pool = eleves.filter(e => !places.has(e.id));
    if (mode === 'groupe') {
        pool.sort((a, b) => {
            const ga = getGroupesEleve(currentClasse, a.id)[0];
            const gb = getGroupesEleve(currentClasse, b.id)[0];
            const na = ga ? ga.nom : 'zzz';
            const nb = gb ? gb.nom : 'zzz';
            return na.localeCompare(nb) || (a.nom || '').localeCompare(b.nom || '');
        });
    } else {
        pool = shuffle(pool);
    }
    let i = 0;
    for (let r = 0; r < plan.lignes && i < pool.length; r++) {
        for (let c = 0; c < plan.colonnes && i < pool.length; c++) {
            const pos = `${r}-${c}`;
            if (plan.placements[pos]) continue;
            plan.placements[pos] = pool[i].id;
            i++;
        }
    }
    ecrireData(currentClasse, data);
    render();
};

window.planVider = function() {
    const plan = getPlanActif();
    if (!plan) return;
    if (confirm('Retirer tous les élèves de la grille ?')) {
        plan.placements = {};
        ecrireData(currentClasse, data);
        render();
    }
};

// ============================================================
// APPEL DEPUIS LE PLAN DE CLASSE
// ============================================================
let popoverState = null;

window.planToggleAppel = function() {
    modeAppel = !modeAppel;
    render();
};

function ouvrirPopover(eleveId, x, y) {
    document.getElementById('plan-appel-popover')?.remove();
    const eleve = getExistingEleves(currentClasse).find(e => e.id === eleveId);
    if (!eleve) return;
    const flags = (lireAppelClasse(currentClasse)[formaterDate(new Date())] || {})[eleveId] || {};

    const popover = document.createElement('div');
    popover.id = 'plan-appel-popover';
    popover.className = 'fixed z-50 bg-slate-900 border-2 border-slate-600 rounded-2xl p-3 shadow-2xl';
    popover.style.left = Math.min(x, window.innerWidth - 240) + 'px';
    popover.style.top = Math.min(y, window.innerHeight - 280) + 'px';
    popover.innerHTML = `
        <div class="text-sm font-black text-white mb-2">${eleve.prenom} ${eleve.nom}</div>
        ${STATUTS.map(s => {
            const actif = flags[s.id] === true;
            return `<button onclick="window.planAppelToggleFlag('${eleveId}', '${s.id}')" class="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold ${actif ? 'text-white' : 'text-slate-300'}" style="background-color:${actif ? s.couleur : '#1e293b'};">
                <span>${s.icon}</span><span>${s.label}</span>${actif ? '<span class="ml-auto">✓</span>' : ''}
            </button>`;
        }).join('')}
        <button onclick="window.planAppelFermer()" class="mt-2 w-full px-3 py-1.5 rounded-xl text-xs font-black bg-slate-700 hover:bg-slate-600 text-white">Fermer</button>
    `;
    document.body.appendChild(popover);
    setTimeout(() => {
        document.addEventListener('click', function h(e) {
            if (!popover.contains(e.target)) {
                popover.remove();
                document.removeEventListener('click', h);
            }
        });
    }, 0);
}

window.planAppelOuvrir = function(eleveId, event) {
    popoverState = { eleveId, x: event.clientX, y: event.clientY };
    ouvrirPopover(eleveId, event.clientX, event.clientY);
};

window.planAppelToggleFlag = function(eleveId, flagId) {
    const date = formaterDate(new Date());
    const appel = lireAppelClasse(currentClasse);
    if (!appel[date]) appel[date] = {};
    const entree = { ...(appel[date][eleveId] || {}) };
    entree[flagId] = !entree[flagId];
    if (Object.values(entree).some(v => v)) {
        appel[date][eleveId] = entree;
    } else {
        delete appel[date][eleveId];
    }
    if (Object.keys(appel[date]).length === 0) delete appel[date];
    ecrireAppelClasse(currentClasse, appel);
    render();
    if (popoverState && popoverState.eleveId === eleveId) {
        ouvrirPopover(popoverState.eleveId, popoverState.x, popoverState.y);
    }
};

window.planAppelFermer = function() {
    document.getElementById('plan-appel-popover')?.remove();
};