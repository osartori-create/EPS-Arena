// src/js/carnet/appel.js
// Carnet — Appel (présences / absences / inaptitudes)
// ⚠️ Données nominatives → localStorage uniquement (RGPD), jamais Firebase.
// Clé : eps_arena_appel_<classe>  →  { [date AAAA-MM-JJ]: { [eleveId]: statut } }

import { getExistingEleves, getPhotoUrl } from '../services/admin-service.js';
import { getCurrentClasse } from '../core/live-engine.js';
import { setClasseInaptitude, getInaptitude, sauvegarderInaptitude, libelleInaptitude, ouvrirModalInaptitude } from './inaptitude.js';

const STORAGE_PREFIX = 'eps_arena_appel_';

// Tous les statuts sont des flags indépendants et cumulables.
// Présent = aucun flag coché.
const STATUTS = [
    { id: 'absent', label: 'Absent', icon: '❌', couleur: '#ef4444' },
    { id: 'inapte', label: 'Inapte', icon: '🩹', couleur: '#8b5cf6' },
    { id: 'retard', label: 'Retard', icon: '⏰', couleur: '#f59e0b' },
    { id: 'oubli_tenue', label: 'Oubli tenue', icon: '👕', couleur: '#3b82f6' },
];

let currentClasse = '';
let currentDate = '';
const photosCache = {};

function formaterDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const j = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${j}`;
}

function lireAppel() {
    return JSON.parse(localStorage.getItem(STORAGE_PREFIX + currentClasse) || '{}');
}

function ecrireAppel(data) {
    localStorage.setItem(STORAGE_PREFIX + currentClasse, JSON.stringify(data));
}

export async function initAppelInterface() {
    currentClasse = getCurrentClasse();
    currentDate = formaterDate(new Date());
    migrerDonneesAppel();
    await chargerPhotos(getExistingEleves(currentClasse));
    render();
}

// Convertit les anciennes données (chaînes) vers le nouveau format objet.
function migrerDonneesAppel() {
    const appel = lireAppel();
    let modifie = false;
    Object.values(appel).forEach(jour => {
        Object.keys(jour).forEach(eleveId => {
            const avant = jour[eleveId];
            const apres = migrerEntree(avant);
            if (apres !== avant) {
                jour[eleveId] = apres;
                modifie = true;
            }
        });
    });
    if (modifie) ecrireAppel(appel);
}

async function chargerPhotos(eleves) {
    await Promise.all(eleves.map(async e => {
        if (photosCache[e.id] !== undefined) return;
        try { photosCache[e.id] = await getPhotoUrl(e.id); } catch (err) { photosCache[e.id] = null; }
    }));
}

function render() {
    const container = document.getElementById('viewPresences');
    if (!container) return;

    if (!currentClasse) {
        container.innerHTML = '<p class="text-slate-500 text-center py-10">Sélectionne une classe.</p>';
        return;
    }

    const eleves = getExistingEleves(currentClasse);
    eleves.sort((a, b) => (a.nom || '').localeCompare(b.nom || '') || (a.prenom || '').localeCompare(b.prenom || ''));

    if (eleves.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-center py-10">Aucun élève dans cette classe. Importe d\'abord tes élèves (Administration).</p>';
        return;
    }

    const appel = lireAppel();
    const statutsDuJour = appel[currentDate] || {};

    const photos = photosCache;

    // Compteurs
    let nbPresent = 0, nbAbsent = 0, nbInapte = 0, nbRetard = 0, nbOubli = 0;
    eleves.forEach(e => {
        const entree = statutsDuJour[e.id];
        const n = (entree?.absent ? 1 : 0) + (entree?.inapte ? 1 : 0) + (entree?.retard ? 1 : 0) + (entree?.oubli_tenue ? 1 : 0);
        if (n === 0) nbPresent++;
        if (entree?.absent) nbAbsent++;
        if (entree?.inapte) nbInapte++;
        if (entree?.retard) nbRetard++;
        if (entree?.oubli_tenue) nbOubli++;
    });

    const dateFr = new Date(currentDate + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    container.innerHTML = `
        <div class="space-y-4">
            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <div class="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <div>
                        <h3 class="font-black text-blue-400 uppercase text-sm">✅ Appel — Présences</h3>
                        <p class="text-xs text-slate-400">Classe ${currentClasse} · ${eleves.length} élèves</p>
                        <p class="text-sm font-bold text-slate-300 mt-1">${dateFr}</p>
                        <p class="text-[11px] text-slate-500 mt-1">💡 Présent par défaut — marque uniquement les exceptions.</p>
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="window.appelChangerDate(-1)" class="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-xl font-black text-white">←</button>
                        <input type="date" id="appel-date" value="${currentDate}" onchange="window.appelChangerDate(0)" class="bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm font-bold text-white">
                        <button onclick="window.appelChangerDate(1)" class="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-xl font-black text-white">→</button>
                    </div>
                </div>

                <div class="flex gap-2 flex-wrap mb-4">
                    <span class="px-3 py-1 rounded-full text-xs font-black" style="background-color:#22c55e; color:#ffffff;">Présent : ${nbPresent}</span>
                    <span class="px-3 py-1 rounded-full text-xs font-black" style="background-color:#ef4444; color:#ffffff;">Absent : ${nbAbsent}</span>
                    <span class="px-3 py-1 rounded-full text-xs font-black" style="background-color:#8b5cf6; color:#ffffff;">Inapte : ${nbInapte}</span>
                    <span class="px-3 py-1 rounded-full text-xs font-black" style="background-color:#f59e0b; color:#ffffff;">Retard : ${nbRetard}</span>
                    <span class="px-3 py-1 rounded-full text-xs font-black" style="background-color:#3b82f6; color:#ffffff;">Oubli tenue : ${nbOubli}</span>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="text-xs text-slate-400 uppercase border-b border-slate-700">
                                <th class="p-2 text-left">Élève</th>
                                <th class="p-2 text-center" title="Absent">❌</th>
                                <th class="p-2 text-center" title="Inapte">🩹</th>
                                <th class="p-2 text-center" title="Retard">⏰</th>
                                <th class="p-2 text-center" title="Oubli tenue">👕</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${eleves.map(e => {
                                const entree = statutsDuJour[e.id];
                                const absent = entree?.absent === true;
                                const inapte = entree?.inapte === true;
                                const retard = entree?.retard === true;
                                const oubli = entree?.oubli_tenue === true;

                                const photoHtml = photos[e.id]
                                    ? `<img src="${photos[e.id]}" class="w-10 h-10 rounded-full object-cover border-2 border-slate-600 shrink-0">`
                                    : `<div class="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-lg shrink-0">👤</div>`;

                                const badges = [];
                                if (absent) badges.push(`<span class="px-2 py-0.5 rounded-full text-[10px] font-black" style="background-color:#ef4444; color:#ffffff;">Absent</span>`);
                                if (inapte) {
                                    const lib = libelleInaptitude(getInaptitude(e.id)) || 'Inapte';
                                    badges.push(`<span class="px-2 py-0.5 rounded-full text-[10px] font-black" style="background-color:#8b5cf6; color:#ffffff;" title="${lib}">${lib}</span>`);
                                }
                                if (retard) badges.push(`<span class="px-2 py-0.5 rounded-full text-[10px] font-black" style="background-color:#f59e0b; color:#ffffff;">Retard</span>`);
                                if (oubli) badges.push(`<span class="px-2 py-0.5 rounded-full text-[10px] font-black" style="background-color:#3b82f6; color:#ffffff;">Oubli tenue</span>`);
                                if (badges.length === 0) badges.push(`<span class="px-2 py-0.5 rounded-full text-[10px] font-black" style="background-color:#22c55e; color:#ffffff;">Présent</span>`);

                                return `
                                    <tr class="border-b border-slate-800">
                                        <td class="p-2">
                                            <div class="flex items-center gap-2">
                                                ${photoHtml}
                                                <div class="font-bold text-white leading-tight">${e.prenom} ${e.nom}</div>
                                                <div class="flex gap-1 flex-wrap">${badges.join('')}</div>
                                            </div>
                                        </td>
                                        <td class="p-2 text-center">
                                            <button onclick="window.appelToggleStatut('${e.id}', 'absent')" class="w-9 h-9 rounded-xl text-lg transition-all active:scale-95" style="background-color: ${absent ? '#ef4444' : '#334155'}; color: #ffffff; ${absent ? 'box-shadow: 0 0 0 2px #ef4444;' : ''}" title="Absent">❌</button>
                                        </td>
                                        <td class="p-2 text-center">
                                            <button onclick="window.appelOuvrirInaptitude('${e.id}')" class="w-9 h-9 rounded-xl text-lg transition-all active:scale-95" style="background-color: ${inapte ? '#8b5cf6' : '#334155'}; color: #ffffff; ${inapte ? 'box-shadow: 0 0 0 2px #8b5cf6;' : ''}" title="Inapte">🩹</button>
                                        </td>
                                        <td class="p-2 text-center">
                                            <button onclick="window.appelToggleStatut('${e.id}', 'retard')" class="w-9 h-9 rounded-xl text-lg transition-all active:scale-95" style="background-color: ${retard ? '#f59e0b' : '#334155'}; color: #ffffff; ${retard ? 'box-shadow: 0 0 0 2px #f59e0b;' : ''}" title="Retard">⏰</button>
                                        </td>
                                        <td class="p-2 text-center">
                                            <button onclick="window.appelToggleStatut('${e.id}', 'oubli_tenue')" class="w-9 h-9 rounded-xl text-lg transition-all active:scale-95" style="background-color: ${oubli ? '#3b82f6' : '#334155'}; color: #ffffff; ${oubli ? 'box-shadow: 0 0 0 2px #3b82f6;' : ''}" title="Oubli tenue">👕</button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

// Migration : anciens formats (chaîne simple, ou objet { presence }) → objet flags.
function migrerEntree(entree) {
    if (typeof entree === 'string') {
        switch (entree) {
            case 'absent': return { absent: true };
            case 'inapte': return { inapte: true };
            case 'retard': return { retard: true };
            case 'oubli_tenue': return { oubli_tenue: true };
            default: return {};
        }
    }
    if (entree && typeof entree === 'object' && entree.presence) {
        const nouveau = { ...entree };
        delete nouveau.presence;
        if (entree.presence === 'absent') nouveau.absent = true;
        else if (entree.presence === 'inapte') nouveau.inapte = true;
        return nouveau;
    }
    return entree;
}

function majEleve(eleveId, mutate) {
    const appel = lireAppel();
    if (!appel[currentDate]) appel[currentDate] = {};
    let entree = appel[currentDate][eleveId] || {};
    entree = migrerEntree(entree);
    mutate(entree);
    if (Object.keys(entree).length === 0) {
        delete appel[currentDate][eleveId];
    } else {
        appel[currentDate][eleveId] = entree;
    }
    ecrireAppel(appel);
}

window.appelToggleStatut = function(eleveId, statutId) {
    if (!currentClasse) return;
    majEleve(eleveId, (entree) => {
        if (entree[statutId]) {
            delete entree[statutId];
        } else {
            entree[statutId] = true;
        }
    });
    render();
};

window.appelOuvrirInaptitude = function(eleveId) {
    if (!currentClasse) return;
    const eleve = getExistingEleves(currentClasse).find(e => e.id === eleveId);
    if (!eleve) return;
    setClasseInaptitude(currentClasse);
    ouvrirModalInaptitude(eleve, (data) => {
        sauvegarderInaptitude(eleveId, data);
        majEleve(eleveId, (entree) => { entree.inapte = true; });
        render();
    });
};

window.appelChangerDate = function(delta) {
    if (delta === 0) {
        const input = document.getElementById('appel-date');
        if (input && input.value) currentDate = input.value;
    } else {
        const d = new Date(currentDate + 'T12:00:00');
        d.setDate(d.getDate() + delta);
        currentDate = formaterDate(d);
    }
    render();
};

