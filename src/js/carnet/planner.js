// src/js/carnet/planner.js
// Emploi du temps & cycles (import planner iDoceo + éditeur).
// Données (localStorage, RGPD) :
//   eps_arena_periodes   = [{ id, nom, debut, fin }]
//   eps_arena_activites  = ["Natation", "Badminton", ...]
//   eps_arena_creneaux   = { [classe]: [{ jour, horaire }] }
//   eps_arena_cycles     = { [classe]: { [creneauKey]: { [periodeId]: activite } } }

import { getCurrentClasse } from '../core/live-engine.js';

const KEY_PERIODES = 'eps_arena_periodes';
const KEY_ACTIVITES = 'eps_arena_activites';
const KEY_CRENEAUX = 'eps_arena_creneaux';
const KEY_CYCLES = 'eps_arena_cycles';

const PERIODES_DEFAUT = [
    { id: 't1', nom: 'T1', debut: '2026-09-01', fin: '2026-11-22' },
    { id: 't2', nom: 'T2', debut: '2026-11-23', fin: '2027-02-21' },
    { id: 't3', nom: 'T3', debut: '2027-03-08', fin: '2027-06-30' },
];

const JOURS_ORDRE = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

let currentClasse = '';

function lirePeriodes() {
    let p = JSON.parse(localStorage.getItem(KEY_PERIODES) || 'null');
    if (!p || p.length === 0) { p = PERIODES_DEFAUT.slice(); ecrirePeriodes(p); }
    return p;
}
function ecrirePeriodes(p) { localStorage.setItem(KEY_PERIODES, JSON.stringify(p)); }

function lireActivites() { return JSON.parse(localStorage.getItem(KEY_ACTIVITES) || '[]'); }
function ecrireActivites(a) { localStorage.setItem(KEY_ACTIVITES, JSON.stringify(a)); }

function lireCreneaux() { return JSON.parse(localStorage.getItem(KEY_CRENEAUX) || '{}'); }
function ecrireCreneaux(c) { localStorage.setItem(KEY_CRENEAUX, JSON.stringify(c)); }

function lireCycles() { return JSON.parse(localStorage.getItem(KEY_CYCLES) || '{}'); }
function ecrireCycles(c) { localStorage.setItem(KEY_CYCLES, JSON.stringify(c)); }

function creneauKey(jour, horaire) { return `${jour} ${horaire}`.trim(); }

export function initPlannerInterface() {
    currentClasse = getCurrentClasse();
    render();
}

// ============================================================
// IMPORT DU PLANNER IDOCEO (XLSX)
// ============================================================
function parserPlannerXLSX(buf) {
    const XLSX = window.XLSX;
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    // Jour de semaine par colonne (ligne 0 = dates)
    const jours = {};
    rows[0].forEach((cell, j) => {
        if (j === 0 || !cell) return;
        const m = String(cell).toLowerCase().match(/^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/);
        if (m) jours[j] = m[1];
    });

    const result = {};
    rows.forEach((row, i) => {
        if (i === 0) return;
        row.forEach((cell, j) => {
            if (j === 0 || !cell) return;
            const txt = String(cell);
            if (txt.toLowerCase().includes('vie de classe')) return;
            const mClasse = txt.match(/\b(\d{3})\b/);
            if (!mClasse) return;
            const classe = mClasse[1];
            const jour = jours[j];
            if (!jour) return;
            const mHeure = txt.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
            const horaire = mHeure ? `${mHeure[1]} - ${mHeure[2]}` : '';
            if (!result[classe]) result[classe] = [];
            if (!result[classe].some(c => c.jour === jour && c.horaire === horaire)) {
                result[classe].push({ jour, horaire });
            }
        });
    });

    Object.keys(result).forEach(c => {
        result[c].sort((a, b) => (JOURS_ORDRE.indexOf(a.jour) - JOURS_ORDRE.indexOf(b.jour)) || a.horaire.localeCompare(b.horaire));
    });
    return result;
}

window.plannerImporterXLSX = function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.onchange = async (ev) => {
        const file = ev.target.files[0];
        if (!file) return;
        try {
            const buf = await file.arrayBuffer();
            const creneaux = parserPlannerXLSX(buf);
            ecrireCreneaux(creneaux);
            render();
            alert(`✅ Planner importé : ${Object.keys(creneaux).length} classe(s).`);
        } catch (err) {
            console.error(err);
            alert('❌ Import impossible : ' + err.message);
        }
    };
    input.click();
};

// ============================================================
// RENDU
// ============================================================
function render() {
    const container = document.getElementById('viewPlanner');
    if (!container) return;

    const periodes = lirePeriodes();
    const activites = lireActivites();
    const creneaux = lireCreneaux();
    const classes = Object.keys(creneaux).sort();

    container.innerHTML = `
        <div class="space-y-4">
            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <div class="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h3 class="font-black text-blue-400 uppercase text-sm">📅 Emploi du temps & cycles</h3>
                        <p class="text-xs text-slate-400 mt-1">Importe ton planner iDoceo puis associe une activité à chaque créneau et période.</p>
                    </div>
                    <button onclick="window.plannerImporterXLSX()" class="bg-purple-600 hover:bg-purple-500 px-4 py-3 rounded-xl font-black text-xs uppercase text-white active:scale-95">📥 Importer planner iDoceo</button>
                </div>
            </div>

            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <h4 class="font-black text-slate-400 uppercase text-sm mb-3">Périodes (partagées)</h4>
                <div class="space-y-2">
                    ${periodes.map(p => `
                        <div class="flex flex-wrap items-center gap-2">
                            <input value="${p.nom}" onchange="window.plannerSetPeriode('${p.id}', 'nom', this.value)" class="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs font-bold text-white w-16">
                            <input type="date" value="${p.debut}" onchange="window.plannerSetPeriode('${p.id}', 'debut', this.value)" class="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white">
                            <span class="text-slate-500 text-xs">→</span>
                            <input type="date" value="${p.fin}" onchange="window.plannerSetPeriode('${p.id}', 'fin', this.value)" class="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white">
                            <button onclick="window.plannerSupprimerPeriode('${p.id}')" class="bg-red-900/50 hover:bg-red-800 px-2 py-1 rounded-lg text-xs text-red-300 font-black">✖</button>
                        </div>
                    `).join('')}
                    <button onclick="window.plannerAjouterPeriode()" class="text-xs text-blue-400 hover:text-blue-300 font-bold">➕ Ajouter une période</button>
                </div>
            </div>

            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <h4 class="font-black text-slate-400 uppercase text-sm mb-3">Activités</h4>
                <div class="flex flex-wrap gap-2 mb-3">
                    ${activites.map(a => `
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-slate-700 text-white flex items-center gap-2">
                            ${a}
                            <button onclick="window.plannerSupprimerActivite('${a}')" class="text-red-300 hover:text-red-200 font-black">✖</button>
                        </span>
                    `).join('')}
                    ${activites.length === 0 ? '<span class="text-xs text-slate-500">Aucune activité. Ajoute-en ci-dessous.</span>' : ''}
                </div>
                <div class="flex gap-2">
                    <input id="planner-nouvelle-activite" placeholder="Nom de l'activité…" class="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white">
                    <button onclick="window.plannerAjouterActivite()" class="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl font-black text-xs text-white">Ajouter</button>
                </div>
            </div>

            ${classes.length === 0 ? `
                <div class="bg-slate-800 p-8 rounded-2xl border border-slate-700 text-center">
                    <p class="text-slate-400">📥 Importe d'abord ton planner iDoceo pour afficher les créneaux.</p>
                </div>
            ` : renderCyclesEditor(classes, creneaux[currentClasse] || [], periodes, activites)}
        </div>
    `;
}

function renderCyclesEditor(classes, creneauxClasse, periodes, activites) {
    const cycles = lireCycles();
    const cyclesClasse = cycles[currentClasse] || {};

    return `
        <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
            <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h4 class="font-black text-slate-400 uppercase text-sm">Cycles par classe</h4>
                <select onchange="window.plannerChoisirClasse(this.value)" class="bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-xs font-bold text-white">
                    ${classes.map(c => `<option value="${c}" ${c === currentClasse ? 'selected' : ''}>Classe ${c}</option>`).join('')}
                </select>
            </div>
            ${creneauxClasse.length === 0 ? `
                <p class="text-xs text-slate-500">Aucun créneau pour la classe ${currentClasse}. Vérifie l'import du planner.</p>
            ` : `
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="text-xs text-slate-400 uppercase border-b border-slate-700">
                                <th class="p-2 text-left">Créneau</th>
                                ${periodes.map(p => `<th class="p-2 text-center">${p.nom}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${creneauxClasse.map(c => {
                                const key = creneauKey(c.jour, c.horaire);
                                const cell = cyclesClasse[key] || {};
                                return `
                                    <tr class="border-b border-slate-800">
                                        <td class="p-2 text-white font-bold whitespace-nowrap">${c.jour} · ${c.horaire || '—'}</td>
                                        ${periodes.map(p => `
                                            <td class="p-1 text-center">
                                                <select onchange="window.plannerSetActivite('${key}', '${p.id}', this.value)" class="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-xs text-white">
                                                    <option value="" ${!cell[p.id] ? 'selected' : ''}>—</option>
                                                    ${activites.map(a => `<option value="${a}" ${cell[p.id] === a ? 'selected' : ''}>${a}</option>`).join('')}
                                                </select>
                                            </td>
                                        `).join('')}
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `}
        </div>
    `;
}

// ============================================================
// ACTIONS
// ============================================================
window.plannerChoisirClasse = function(classe) {
    currentClasse = classe;
    render();
};

window.plannerSetActivite = function(key, periodeId, activite) {
    const cycles = lireCycles();
    if (!cycles[currentClasse]) cycles[currentClasse] = {};
    if (!cycles[currentClasse][key]) cycles[currentClasse][key] = {};
    if (activite) cycles[currentClasse][key][periodeId] = activite;
    else delete cycles[currentClasse][key][periodeId];
    ecrireCycles(cycles);
};

window.plannerSetPeriode = function(id, field, value) {
    const p = lirePeriodes();
    const periode = p.find(x => x.id === id);
    if (periode) { periode[field] = value; ecrirePeriodes(p); }
};

window.plannerAjouterPeriode = function() {
    const p = lirePeriodes();
    p.push({ id: 'p' + Date.now(), nom: 'P' + (p.length + 1), debut: '', fin: '' });
    ecrirePeriodes(p);
    render();
};

window.plannerSupprimerPeriode = function(id) {
    ecrirePeriodes(lirePeriodes().filter(x => x.id !== id));
    render();
};

window.plannerAjouterActivite = function() {
    const input = document.getElementById('planner-nouvelle-activite');
    const nom = (input?.value || '').trim();
    if (!nom) return;
    const a = lireActivites();
    if (!a.includes(nom)) { a.push(nom); ecrireActivites(a); }
    render();
};

window.plannerSupprimerActivite = function(nom) {
    ecrireActivites(lireActivites().filter(x => x !== nom));
    render();
};
