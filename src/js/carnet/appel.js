// src/js/carnet/appel.js
// Carnet — Appel (présences / absences / inaptitudes)
// ⚠️ Données nominatives → localStorage uniquement (RGPD), jamais Firebase.
// Clé : eps_arena_appel_<classe>  →  { [date AAAA-MM-JJ]: { [eleveId]: statut } }

import { getExistingEleves } from '../services/admin-service.js';
import { getCurrentClasse } from '../core/live-engine.js';

const STORAGE_PREFIX = 'eps_arena_appel_';

// Statuts d'exception. Par défaut, tous les élèves sont « présent ».
const STATUTS = [
    { id: 'absent', label: 'Absent', icon: '❌', couleur: '#ef4444' },
    { id: 'retard', label: 'Retard', icon: '⏰', couleur: '#f59e0b' },
    { id: 'oubli_tenue', label: 'Oubli tenue', icon: '👕', couleur: '#3b82f6' },
    { id: 'inapte', label: 'Inapte', icon: '🩹', couleur: '#8b5cf6' },
];

let currentClasse = '';
let currentDate = '';

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

export function initAppelInterface() {
    currentClasse = getCurrentClasse();
    currentDate = formaterDate(new Date());
    render();
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

    const nb = { absent: 0, retard: 0, oubli_tenue: 0, inapte: 0 };
    Object.values(statutsDuJour).forEach(s => { if (nb[s] !== undefined) nb[s]++; });
    const nbPresent = eleves.length - nb.absent - nb.retard - nb.oubli_tenue - nb.inapte;

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
                    ${STATUTS.map(s => `<span class="px-3 py-1 rounded-full text-xs font-black" style="background-color:${s.couleur}; color:#ffffff;">${s.label} : ${nb[s.id]}</span>`).join('')}
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="text-xs text-slate-400 uppercase border-b border-slate-700">
                                <th class="p-2 text-left">Élève</th>
                                ${STATUTS.map(s => `<th class="p-2 text-center" title="${s.label}"><span class="block text-base">${s.icon}</span><span class="block text-[9px] mt-0.5">${s.label}</span></th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${eleves.map(e => {
                                const statut = statutsDuJour[e.id];
                                return `
                                    <tr class="border-b border-slate-800">
                                        <td class="p-2 font-bold text-white">${e.prenom} ${e.nom}</td>
                                        ${STATUTS.map(s => `
                                            <td class="p-2 text-center">
                                                <button onclick="window.appelSetStatut('${e.id}', '${s.id}')"
                                                        class="w-10 h-10 rounded-xl text-lg transition-all active:scale-95"
                                                        style="background-color: ${statut === s.id ? s.couleur : '#334155'}; color: #ffffff; ${statut === s.id ? 'box-shadow: 0 0 0 2px ' + s.couleur + ';' : ''}"
                                                        title="${s.label}">
                                                    ${s.icon}
                                                </button>
                                            </td>
                                        `).join('')}
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

window.appelSetStatut = function(eleveId, statut) {
    if (!currentClasse) return;
    const appel = lireAppel();
    if (!appel[currentDate]) appel[currentDate] = {};
    if (appel[currentDate][eleveId] === statut) {
        delete appel[currentDate][eleveId];
    } else {
        appel[currentDate][eleveId] = statut;
    }
    ecrireAppel(appel);
    render();
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

