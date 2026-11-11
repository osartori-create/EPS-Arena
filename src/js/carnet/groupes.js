// src/js/carnet/groupes.js
// Groupes d'élèves (type iDoceo) — un élève peut appartenir à plusieurs groupes.
// Données (localStorage, RGPD) : eps_arena_groupes_<classe> = [{ id, nom, couleur, eleves: [eleveId] }]

import { getExistingEleves, getPhotoUrl } from '../services/admin-service.js';
import { getCurrentClasse } from '../core/live-engine.js';

const PREFIX = 'eps_arena_groupes_';
const PALETTE = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16', '#06b6d4', '#a855f7', '#eab308'];

let currentClasse = '';
let groupeOuvert = '';

const photosCache = {};

// --- Données ---
export function lireGroupes(classe) {
    return JSON.parse(localStorage.getItem(PREFIX + classe) || '[]');
}
function ecrireGroupes(classe, groupes) {
    localStorage.setItem(PREFIX + classe, JSON.stringify(groupes));
}
export function getGroupesEleve(classe, eleveId) {
    return lireGroupes(classe).filter(g => g.eleves.includes(eleveId));
}
export function getGroupe(classe, id) {
    return lireGroupes(classe).find(g => g.id === id) || null;
}

// --- Mutations ---
export function creerGroupe(classe, nom) {
    const groupes = lireGroupes(classe);
    const id = 'g' + Date.now().toString(36) + Math.floor(Math.random() * 1000);
    groupes.push({ id, nom, couleur: PALETTE[groupes.length % PALETTE.length], eleves: [] });
    ecrireGroupes(classe, groupes);
    return id;
}
export function renommerGroupe(classe, id, nom) {
    const groupes = lireGroupes(classe);
    const g = groupes.find(x => x.id === id);
    if (g) { g.nom = nom; ecrireGroupes(classe, groupes); }
}
export function supprimerGroupe(classe, id) {
    ecrireGroupes(classe, lireGroupes(classe).filter(x => x.id !== id));
}
export function changerCouleurGroupe(classe, id) {
    const groupes = lireGroupes(classe);
    const g = groupes.find(x => x.id === id);
    if (g) {
        const idx = PALETTE.indexOf(g.couleur);
        g.couleur = PALETTE[(idx + 1) % PALETTE.length];
        ecrireGroupes(classe, groupes);
    }
}
export function toggleEleveGroupe(classe, id, eleveId) {
    const groupes = lireGroupes(classe);
    const g = groupes.find(x => x.id === id);
    if (g) {
        const i = g.eleves.indexOf(eleveId);
        if (i >= 0) g.eleves.splice(i, 1); else g.eleves.push(eleveId);
        ecrireGroupes(classe, groupes);
    }
}
export function ajouterElevesGroupe(classe, id, eleveIds) {
    const groupes = lireGroupes(classe);
    const g = groupes.find(x => x.id === id);
    if (g) {
        eleveIds.forEach(eid => { if (!g.eleves.includes(eid)) g.eleves.push(eid); });
        ecrireGroupes(classe, groupes);
    }
}
export function retirerEleveGroupe(classe, id, eleveId) {
    const groupes = lireGroupes(classe);
    const g = groupes.find(x => x.id === id);
    if (g) {
        g.eleves = g.eleves.filter(x => x !== eleveId);
        ecrireGroupes(classe, groupes);
    }
}
export function retirerEleveDeTousGroupes(classe, eleveId) {
    const groupes = lireGroupes(classe);
    groupes.forEach(g => { g.eleves = g.eleves.filter(x => x !== eleveId); });
    ecrireGroupes(classe, groupes);
}

async function chargerPhotos(eleves) {
    await Promise.all(eleves.map(async e => {
        if (photosCache[e.id] !== undefined) return;
        try { photosCache[e.id] = await getPhotoUrl(e.id); } catch (err) { photosCache[e.id] = null; }
    }));
}

// --- UI ---
export async function initGroupesInterface() {
    currentClasse = getCurrentClasse();
    await chargerPhotos(getExistingEleves(currentClasse));
    render();
}

function render() {
    const container = document.getElementById('viewGroupes');
    if (!container) return;
    if (!currentClasse) {
        container.innerHTML = '<p class="text-slate-500 text-center py-10">Sélectionne une classe.</p>';
        return;
    }
    const groupes = lireGroupes(currentClasse);
    const eleves = getExistingEleves(currentClasse);
    eleves.sort((a, b) => (a.nom || '').localeCompare(b.nom || '') || (a.prenom || '').localeCompare(b.prenom || ''));
    const autresGroupes = groupeOuvert ? groupes.filter(x => x.id !== groupeOuvert) : [];

    const avatar = (e, taille) => photosCache[e.id]
        ? `<img src="${photosCache[e.id]}" class="${taille} rounded-full object-cover shrink-0">`
        : `<div class="${taille} rounded-full bg-slate-700 flex items-center justify-center shrink-0">👤</div>`;

    container.innerHTML = `
        <div class="space-y-4">
            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h3 class="font-black text-blue-400 uppercase text-sm">👥 Groupes d'élèves</h3>
                    <p class="text-xs text-slate-400 mt-1">Classe ${currentClasse} · un élève peut appartenir à plusieurs groupes.</p>
                </div>
                <button onclick="window.groupeNouveau()" class="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl font-black text-xs uppercase text-white">➕ Nouveau groupe</button>
            </div>

            ${groupes.length === 0 ? `
                <div class="bg-slate-800 p-8 rounded-2xl border border-slate-700 text-center text-slate-400">
                    <p class="font-bold">Aucun groupe.</p>
                    <p class="text-xs mt-1">Crée un premier groupe pour organiser tes élèves (niveaux, équipes, besoins particuliers…).</p>
                </div>
            ` : `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    ${groupes.map(g => `
                        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                            <div class="flex items-center gap-3 mb-2">
                                <button onclick="window.groupeChangerCouleur('${g.id}')" class="w-5 h-5 rounded-full shrink-0 border border-white/40" style="background-color:${g.couleur};" title="Changer la couleur"></button>
                                <input value="${g.nom.replace(/"/g, '&quot;')}" onchange="window.groupeRenommer('${g.id}', this.value)" class="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm font-bold text-white">
                                <span id="groupe-count-${g.id}" class="text-xs font-bold text-slate-400 whitespace-nowrap">${g.eleves.length} élève(s)</span>
                                <button onclick="window.groupeSupprimer('${g.id}')" class="text-red-400 hover:text-red-300 font-black">✖</button>
                            </div>
                            <button onclick="window.groupeToggleMembres('${g.id}')" class="text-xs font-bold text-blue-300 hover:text-blue-200">👥 ${groupeOuvert === g.id ? 'Masquer' : 'Gérer'} les membres</button>
                            ${groupeOuvert === g.id ? `
                                <div class="mt-3 p-3 bg-slate-900/60 rounded-xl border border-slate-700 max-h-72 overflow-y-auto">
                                    ${autresGroupes.length ? `<div class="flex gap-2 flex-wrap mb-2 text-[10px] text-slate-400 items-center">
                                        <span class="font-bold uppercase text-slate-500">Autres groupes :</span>
                                        ${autresGroupes.map(x => `<span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full inline-block" style="background-color:${x.couleur};"></span>${x.nom}</span>`).join('')}
                                    </div>` : ''}
                                    ${eleves.map(e => {
                                        const coche = g.eleves.includes(e.id);
                                        const autres = getGroupesEleve(currentClasse, e.id).filter(x => x.id !== g.id);
                                        return `<label class="flex items-center gap-2 py-1 px-1 rounded hover:bg-slate-800 cursor-pointer text-sm">
                                            <input type="checkbox" ${coche ? 'checked' : ''} onchange="window.groupeToggleEleve('${g.id}', '${e.id}', this)">
                                            ${avatar(e, 'w-7 h-7')}
                                            <span class="${coche ? 'text-white font-bold' : 'text-slate-400'}">${e.prenom} ${e.nom}</span>
                                            ${autres.map(x => `<span class="w-3 h-3 rounded-full inline-block border border-white/30 shrink-0" style="background-color:${x.couleur};" title="${x.nom}"></span>`).join('')}
                                        </label>`;
                                    }).join('')}
                                    ${eleves.length === 0 ? '<p class="text-xs text-slate-500">Aucun élève dans cette classe.</p>' : ''}
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            `}
        </div>
    `;
}

window.groupeNouveau = function() {
    const nom = prompt('Nom du groupe ?');
    if (nom && nom.trim()) {
        creerGroupe(currentClasse, nom.trim());
        render();
    }
};

window.groupeRenommer = function(id, nom) {
    if (nom && nom.trim()) {
        renommerGroupe(currentClasse, id, nom.trim());
        render();
    }
};

window.groupeSupprimer = function(id) {
    if (confirm('Supprimer ce groupe ?')) {
        supprimerGroupe(currentClasse, id);
        render();
    }
};

window.groupeChangerCouleur = function(id) {
    changerCouleurGroupe(currentClasse, id);
    render();
};

window.groupeToggleMembres = function(id) {
    groupeOuvert = (groupeOuvert === id) ? '' : id;
    render();
};

window.groupeToggleEleve = function(id, eleveId, input) {
    toggleEleveGroupe(currentClasse, id, eleveId);
    const g = getGroupe(currentClasse, id);
    // Mise à jour légère (sans re-render) pour conserver la position de défilement.
    const badge = document.getElementById('groupe-count-' + id);
    if (badge && g) badge.textContent = g.eleves.length + ' élève(s)';
    if (input) {
        const label = input.closest('label');
        const span = label ? label.querySelector('span') : null;
        if (span && g) {
            span.className = g.eleves.includes(eleveId) ? 'text-white font-bold' : 'text-slate-400';
        }
    }
};