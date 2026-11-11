// src/js/carnet/appel.js
// Carnet — Appel (présences / absences / inaptitudes)
// ⚠️ Données nominatives → localStorage uniquement (RGPD), jamais Firebase.
// Clé : eps_arena_appel_<classe>  →  { [date AAAA-MM-JJ]: { [eleveId]: statut } }

import { getExistingEleves, getPhotoUrl } from '../services/admin-service.js';
import { getCurrentClasse } from '../core/live-engine.js';
import { setClasseInaptitude, getInaptitude, sauvegarderInaptitude, libelleInaptitude, ouvrirModalInaptitude } from './inaptitude.js';
import { getSeancesClasseDate, lirePeriodes } from './planner.js';
import { getToutesGrilles, getEvaluationsClasse, calculerNoteFinale } from '../modules/grilles/grilles-core.js';
import { exporterVersExcel } from '../services/export-service.js';
import { lireGroupes } from './groupes.js';
import { getLicenceParEleve } from './unss.js';
import './fiche-eleve.js'; // fiche élève tout-en-un (window.ouvrirFicheEleve)

const STORAGE_PREFIX = 'eps_arena_appel_';

// Tous les statuts sont des flags indépendants et cumulables.
// Présent = aucun flag coché.
export const STATUTS = [
    { id: 'absent', label: 'Absent', icon: '❌', couleur: '#ef4444' },
    { id: 'inapte', label: 'Inapte', icon: '🤕', couleur: '#8b5cf6' },
    { id: 'retard', label: 'Retard', icon: '⏰', couleur: '#f59e0b' },
    { id: 'oubli_tenue', label: 'Oubli tenue', icon: '👕', couleur: '#3b82f6' },
];

const STATS_FLAGS = [
    { id: 'absent', label: 'Absences', couleur: '#ef4444' },
    { id: 'retard', label: 'Retards', couleur: '#f59e0b' },
    { id: 'oubli_tenue', label: 'Oublis de tenue', couleur: '#3b82f6' },
    { id: 'inapte', label: 'Inaptitudes', couleur: '#8b5cf6' },
];

let currentClasse = '';
let currentDate = '';
let currentGroupe = '';
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

export function lireAppelClasse(classe) {
    return JSON.parse(localStorage.getItem(STORAGE_PREFIX + classe) || '{}');
}
export function ecrireAppelClasse(classe, data) {
    localStorage.setItem(STORAGE_PREFIX + classe, JSON.stringify(data));
}

export async function initAppelInterface() {
    currentClasse = getCurrentClasse();
    const dateDemandee = localStorage.getItem('eps_arena_appel_date_demandee');
    currentDate = dateDemandee || formaterDate(new Date());
    if (dateDemandee) localStorage.removeItem('eps_arena_appel_date_demandee');
    setClasseInaptitude(currentClasse);
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

    let eleves = getExistingEleves(currentClasse);
    eleves.sort((a, b) => (a.nom || '').localeCompare(b.nom || '') || (a.prenom || '').localeCompare(b.prenom || ''));
    const groupes = lireGroupes(currentClasse);
    if (currentGroupe) {
        const g = groupes.find(x => x.id === currentGroupe);
        if (g) eleves = eleves.filter(e => g.eleves.includes(e.id));
    }
    const unssParEleveId = new Set();
    eleves.forEach(e => { if (getLicenceParEleve({ ...e, classe: currentClasse })) unssParEleveId.add(e.id); });

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
    const seancesJour = getSeancesClasseDate(currentClasse, currentDate);

    container.innerHTML = `
        <div class="space-y-4">
            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <div class="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <div>
                        <h3 class="font-black text-blue-400 uppercase text-sm">✅ Appel — Présences</h3>
                        <p class="text-xs text-slate-400">Classe ${currentClasse} · ${eleves.length} élèves</p>
                        <p class="text-sm font-bold text-slate-300 mt-1">${dateFr}</p>
                        <p class="text-[11px] text-slate-500 mt-1">💡 Présent par défaut — marque uniquement les exceptions.</p>
                        <div class="flex gap-1 flex-wrap mt-2">
                            ${seancesJour.seances.length ? seancesJour.seances.map(s => `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 text-slate-200">${s.horaire || '—'} · ${s.activite || '—'}</span>`).join('') : `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 text-slate-400">Aucune séance planifiée ce jour</span>`}
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        ${groupes.length ? `<select onchange="window.appelFiltreGroupe(this.value)" class="bg-slate-900 border border-slate-600 rounded px-2 py-2 text-xs font-bold text-white">
                            <option value="">Tous les groupes</option>
                            ${groupes.map(g => `<option value="${g.id}" ${g.id === currentGroupe ? 'selected' : ''}>${g.nom}</option>`).join('')}
                        </select>` : ''}
                        <button onclick="window.appelChangerDate(-1)" class="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-xl font-black text-white">←</button>
                        <input type="date" id="appel-date" value="${currentDate}" onchange="window.appelChangerDate(0)" class="bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm font-bold text-white">
                        <button onclick="window.appelChangerDate(1)" class="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-xl font-black text-white">→</button>
                        <button onclick="window.appelVoirStats()" class="bg-cyan-700 hover:bg-cyan-600 px-3 py-2 rounded-xl font-black text-xs uppercase text-white">📊 Stats</button>
                        <button onclick="window.appelVoirBilan()" class="bg-emerald-700 hover:bg-emerald-600 px-3 py-2 rounded-xl font-black text-xs uppercase text-white">🧾 Bilan</button>
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
                                <th class="p-2 text-center" title="Inapte">🤕</th>
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
                                                <button onclick="window.appelOuvrirFiche('${e.id}')" class="font-bold text-white leading-tight hover:text-blue-400 cursor-pointer text-left">${e.prenom} ${e.nom}</button>
                                                ${unssParEleveId.has(e.id) ? '<span title="Licencié UNSS" class="text-xs">🏟️</span>' : ''}
                                                <div class="flex gap-1 flex-wrap">${badges.join('')}</div>
                                            </div>
                                        </td>
                                        <td class="p-2 text-center">
                                            <button onclick="window.appelToggleStatut('${e.id}', 'absent')" class="w-9 h-9 rounded-xl text-lg transition-all active:scale-95" style="background-color: ${absent ? '#ef4444' : '#334155'}; color: #ffffff; ${absent ? 'box-shadow: 0 0 0 2px #ef4444;' : ''}" title="Absent">❌</button>
                                        </td>
                                        <td class="p-2 text-center">
                                            <button onclick="window.appelOuvrirInaptitude('${e.id}')" class="w-9 h-9 rounded-xl text-lg transition-all active:scale-95" style="background-color: ${inapte ? '#8b5cf6' : '#334155'}; color: #ffffff; ${inapte ? 'box-shadow: 0 0 0 2px #8b5cf6;' : ''}" title="Inapte">🤕</button>
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

// ============================================================
// FICHE ÉLÈVE (carnet)
// ============================================================
window.appelOuvrirFiche = function(eleveId) {
    if (window.ouvrirFicheEleve) { window.ouvrirFicheEleve(eleveId, currentClasse); return; }
    if (!currentClasse) return;
    const eleve = getExistingEleves(currentClasse).find(e => e.id === eleveId);
    if (!eleve) return;

    const appel = lireAppel();
    const inapt = getInaptitude(eleveId);
    const lic = getLicenceParEleve({ ...eleve, classe: currentClasse });

    const totaux = { absent: 0, retard: 0, oubli_tenue: 0, inapte: 0 };
    const parActivite = {};
    Object.entries(appel).forEach(([date, jour]) => {
        const flags = jour[eleveId];
        if (!flags || typeof flags !== 'object') return;
        STATS_FLAGS.forEach(f => { if (flags[f.id]) totaux[f.id]++; });
        getSeancesClasseDate(currentClasse, date).seances.forEach(s => {
            if (!s.activite) return;
            if (!parActivite[s.activite]) parActivite[s.activite] = { absent: 0, retard: 0, oubli_tenue: 0, inapte: 0 };
            STATS_FLAGS.forEach(f => { if (flags[f.id]) parActivite[s.activite][f.id]++; });
        });
    });
    const activites = Object.keys(parActivite).sort();

    // Évaluations (grilles)
    const grilles = getToutesGrilles();
    const evalsClasse = getEvaluationsClasse(currentClasse);
    const periodes = [...new Set(grilles.flatMap(g => (g.periodes && g.periodes.length ? g.periodes : ['Début', 'Milieu', 'Fin'])))];
    const lignesEval = grilles.map(g => ({
        titre: g.titre || g.id,
        cellules: periodes.map(per => {
            const notes = evalsClasse[g.id]?.[per]?.[eleveId]?.notes;
            if (!notes) return null;
            const nf = calculerNoteFinale(notes, g.criteres);
            return nf.sur20 !== null ? nf.sur20 : null;
        })
    }));

    const photoHtml = photosCache[eleveId]
        ? `<img src="${photosCache[eleveId]}" class="w-16 h-16 rounded-full object-cover border-2 border-slate-600 shrink-0">`
        : `<div class="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center text-3xl shrink-0">👤</div>`;

    const overlay = document.createElement('div');
    overlay.id = 'appel-fiche-modal';
    overlay.className = 'fixed inset-0 bg-black/70 z-50 flex items-start justify-center p-4 overflow-y-auto';
    overlay.innerHTML = `
        <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-lg my-8">
            <div class="flex items-center gap-4 mb-4 border-b border-slate-700 pb-4">
                ${photoHtml}
                <div class="flex-1 min-w-0">
                    <h2 class="text-xl font-black text-white leading-tight">${eleve.prenom} ${eleve.nom}</h2>
                    <p class="text-xs text-slate-400">${eleve.sexe || '—'} · Code élève ${eleve.codeAutoEval ?? '—'}</p>
                </div>
                <button onclick="document.getElementById('appel-fiche-modal').remove()" class="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-xl font-black text-white text-sm shrink-0">✖</button>
            </div>

            <h3 class="text-xs font-black text-slate-400 uppercase mb-2">Récapitulatif</h3>
            <div class="flex gap-2 flex-wrap mb-4">
                ${STATS_FLAGS.map(f => `<span class="px-3 py-1 rounded-full text-xs font-black text-white" style="background-color:${f.couleur};">${f.label} : ${totaux[f.id]}</span>`).join('')}
            </div>

            <h3 class="text-xs font-black text-slate-400 uppercase mb-2">Détail par activité</h3>
            ${activites.length === 0 ? '<p class="text-xs text-slate-500 mb-4">Aucune donnée.</p>' : `
                <div class="overflow-x-auto mb-4">
                    <table class="w-full text-xs">
                        <thead>
                            <tr class="text-slate-400 uppercase border-b border-slate-700">
                                <th class="p-1.5 text-left">Activité</th>
                                ${STATS_FLAGS.map(f => `<th class="p-1.5 text-center">${f.label}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${activites.map(act => `
                                <tr class="border-b border-slate-800">
                                    <td class="p-1.5 font-bold text-white">${act}</td>
                                    ${STATS_FLAGS.map(f => {
                                        const n = parActivite[act][f.id];
                                        return `<td class="p-1.5 text-center ${n > 0 ? 'font-black text-red-400' : 'text-slate-600'}">${n || '—'}</td>`;
                                    }).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `}

            <h3 class="text-xs font-black text-slate-400 uppercase mb-2">📊 Évaluations (grilles)</h3>
            ${grilles.length === 0 ? '<p class="text-xs text-slate-500 mb-4">Aucune grille.</p>' : `
                <div class="overflow-x-auto mb-4">
                    <table class="w-full text-xs">
                        <thead>
                            <tr class="text-slate-400 uppercase border-b border-slate-700">
                                <th class="p-1.5 text-left">Grille</th>
                                ${periodes.map(p => `<th class="p-1.5 text-center">${p}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${lignesEval.map(l => `
                                <tr class="border-b border-slate-800">
                                    <td class="p-1.5 font-bold text-white">${l.titre}</td>
                                    ${l.cellules.map(c => `<td class="p-1.5 text-center font-black ${c !== null ? 'text-emerald-400' : 'text-slate-600'}">${c !== null ? c + '/20' : '—'}</td>`).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `}

            <h3 class="text-xs font-black text-slate-400 uppercase mb-2">🤕 Inaptitude</h3>
            <p class="text-sm font-bold text-white">${inapt ? libelleInaptitude(inapt) : 'Aucune inaptitude en cours.'}</p>

            <h3 class="text-xs font-black text-slate-400 uppercase mb-2">🏟️ UNSS</h3>
            ${lic ? `
                <div class="text-sm text-white">
                    <div class="flex gap-1 flex-wrap mb-1">
                        ${lic.activitesUnss.split(',').map(a => a.trim()).filter(Boolean).map(a => `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 text-slate-200">${a}</span>`).join('')}
                        ${!lic.activitesUnss ? '<span class="text-slate-500">Aucune activité</span>' : ''}
                    </div>
                    <p class="text-xs text-slate-300">Licence : ${lic.numLicence || '—'} · Catégorie : ${lic.categorie || '—'}</p>
                    <p class="text-xs text-slate-300">Parents : ${lic.etatParents || '—'}</p>
                </div>
            ` : '<p class="text-sm text-slate-500">Non inscrit à l\'UNSS.</p>'}
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
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

window.appelFiltreGroupe = function(groupeId) {
    currentGroupe = groupeId;
    render();
};

// ============================================================
// STATISTIQUES : absences / retards / oublis de tenue / inaptitudes
// ============================================================
window.appelVoirStats = function() {
    if (!currentClasse) return;
    const appel = lireAppel();
    const eleves = getExistingEleves(currentClasse);
    eleves.sort((a, b) => (a.nom || '').localeCompare(b.nom || '') || (a.prenom || '').localeCompare(b.prenom || ''));

    // { [eleveId]: { [activite]: { absent, retard, oubli_tenue, inapte } } }
    const stats = {};
    const activites = new Set();
    Object.entries(appel).forEach(([date, jour]) => {
        getSeancesClasseDate(currentClasse, date).seances.forEach(s => {
            if (!s.activite) return;
            activites.add(s.activite);
            Object.entries(jour).forEach(([eleveId, flags]) => {
                if (!flags || typeof flags !== 'object') return;
                if (!stats[eleveId]) stats[eleveId] = {};
                if (!stats[eleveId][s.activite]) stats[eleveId][s.activite] = {};
                STATS_FLAGS.forEach(f => {
                    if (flags[f.id]) stats[eleveId][s.activite][f.id] = (stats[eleveId][s.activite][f.id] || 0) + 1;
                });
            });
        });
    });

    window._statsData = { stats, activites: [...activites].sort(), eleves, classe: currentClasse };

    const overlay = document.createElement('div');
    overlay.id = 'appel-stats-modal';
    overlay.className = 'fixed inset-0 bg-black/70 z-50 flex items-start justify-center p-4 overflow-y-auto';
    overlay.innerHTML = `
        <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-4xl my-8">
            <div class="flex justify-between items-center mb-4 border-b border-slate-700 pb-4">
                <div>
                    <h2 class="text-xl font-black text-cyan-400 uppercase">📊 Statistiques de l'appel</h2>
                    <p class="text-xs text-slate-400">Classe ${currentClasse} · ${eleves.length} élèves</p>
                </div>
                <button onclick="document.getElementById('appel-stats-modal').remove()" class="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-xl font-black text-white text-sm">✖</button>
            </div>
            <div class="flex gap-2 flex-wrap mb-4">
                ${STATS_FLAGS.map(f => `<button onclick="window.appelStatsAfficher('${f.id}')" id="stats-tab-${f.id}" class="px-3 py-1.5 rounded-xl font-black text-xs text-white">${f.label}</button>`).join('')}
            </div>
            <div id="appel-stats-content"></div>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    window.appelStatsAfficher('absent');
};

window.appelStatsAfficher = function(flagId) {
    const data = window._statsData;
    const container = document.getElementById('appel-stats-content');
    if (!data || !container) return;

    // Mise en évidence de l'onglet actif
    STATS_FLAGS.forEach(f => {
        const btn = document.getElementById('stats-tab-' + f.id);
        if (btn) btn.style.backgroundColor = (f.id === flagId) ? f.couleur : '#1e293b';
    });

    if (data.activites.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-center py-8">Aucune donnée. Définis les activités dans l\'emploi du temps puis fais des appels.</p>';
        return;
    }

    container.innerHTML = `
        <div class="overflow-x-auto">
            <table class="w-full text-sm">
                <thead>
                    <tr class="text-xs text-slate-400 uppercase border-b border-slate-700">
                        <th class="p-2 text-left sticky left-0 bg-slate-900">Élève</th>
                        ${data.activites.map(a => `<th class="p-2 text-center">${a}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${data.eleves.map(e => `
                        <tr class="border-b border-slate-800">
                            <td class="p-2 font-bold text-white sticky left-0 bg-slate-900 whitespace-nowrap">${e.prenom} ${e.nom}</td>
                            ${data.activites.map(a => {
                                const n = data.stats[e.id]?.[a]?.[flagId] || 0;
                                return `<td class="p-2 text-center ${n > 0 ? 'font-black text-red-400' : 'text-slate-600'}">${n || '—'}</td>`;
                            }).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
};

// ============================================================
// BILAN DE PÉRIODE : synthèse par élève (absences, retards, oublis, inaptitudes)
// ============================================================
function calculerBilan(periode) {
    const appel = lireAppel();
    const eleves = getExistingEleves(currentClasse);
    eleves.sort((a, b) => (a.nom || '').localeCompare(b.nom || '') || (a.prenom || '').localeCompare(b.prenom || ''));
    const bilan = {};
    eleves.forEach(e => { bilan[e.id] = { absent: 0, retard: 0, oubli_tenue: 0, inapte: 0 }; });
    Object.entries(appel).forEach(([date, jour]) => {
        if (periode && (date < periode.debut || date > periode.fin)) return;
        Object.entries(jour).forEach(([eleveId, flags]) => {
            if (!flags || typeof flags !== 'object') return;
            if (!bilan[eleveId]) bilan[eleveId] = { absent: 0, retard: 0, oubli_tenue: 0, inapte: 0 };
            STATS_FLAGS.forEach(f => {
                if (flags[f.id]) bilan[eleveId][f.id] += 1;
            });
        });
    });
    return { eleves, bilan };
}

window.appelVoirBilan = function() {
    if (!currentClasse) return;
    const periodes = lirePeriodes();
    window._bilanData = { periodes, periodeId: '' };

    const overlay = document.createElement('div');
    overlay.id = 'appel-bilan-modal';
    overlay.className = 'fixed inset-0 bg-black/70 z-50 flex items-start justify-center p-4 overflow-y-auto';
    overlay.innerHTML = `
        <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-3xl my-8">
            <div class="flex justify-between items-center mb-4 border-b border-slate-700 pb-4">
                <div>
                    <h2 class="text-xl font-black text-emerald-400 uppercase">🧾 Bilan de période</h2>
                    <p class="text-xs text-slate-400">Classe ${currentClasse} · synthèse des appels</p>
                </div>
                <button onclick="document.getElementById('appel-bilan-modal').remove()" class="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-xl font-black text-white text-sm">✖</button>
            </div>
            <div class="flex gap-2 flex-wrap mb-4 items-center">
                <button onclick="window.appelBilanAfficher('')" id="bilan-tab-all" class="px-3 py-1.5 rounded-xl font-black text-xs text-white">Toute l'année</button>
                ${periodes.map(p => `<button onclick="window.appelBilanAfficher('${p.id}')" id="bilan-tab-${p.id}" class="px-3 py-1.5 rounded-xl font-black text-xs text-white">${p.nom}</button>`).join('')}
                <button onclick="window.appelBilanExporter()" class="ml-auto px-4 py-1.5 rounded-xl font-black text-xs text-white bg-emerald-600 hover:bg-emerald-500">📥 Exporter Excel</button>
            </div>
            <div id="appel-bilan-content"></div>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    window.appelBilanAfficher('');
};

window.appelBilanAfficher = function(periodeId) {
    const data = window._bilanData;
    const container = document.getElementById('appel-bilan-content');
    if (!data || !container) return;
    data.periodeId = periodeId;
    const periode = data.periodes.find(p => p.id === periodeId) || null;

    ['', ...data.periodes.map(p => p.id)].forEach(id => {
        const btn = document.getElementById('bilan-tab-' + (id || 'all'));
        if (btn) btn.style.backgroundColor = (id === periodeId) ? '#10b981' : '#1e293b';
    });

    const { eleves, bilan } = calculerBilan(periode);
    const total = e => bilan[e.id].absent + bilan[e.id].retard + bilan[e.id].oubli_tenue + bilan[e.id].inapte;

    container.innerHTML = `
        <div class="overflow-x-auto">
            <table class="w-full text-sm">
                <thead>
                    <tr class="text-xs text-slate-400 uppercase border-b border-slate-700">
                        <th class="p-2 text-left sticky left-0 bg-slate-900">Élève</th>
                        ${STATS_FLAGS.map(f => `<th class="p-2 text-center">${f.label}</th>`).join('')}
                        <th class="p-2 text-center">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${eleves.map(e => `
                        <tr class="border-b border-slate-800">
                            <td class="p-2 font-bold text-white sticky left-0 bg-slate-900 whitespace-nowrap">${e.prenom} ${e.nom}</td>
                            ${STATS_FLAGS.map(f => {
                                const n = bilan[e.id][f.id] || 0;
                                return `<td class="p-2 text-center ${n > 0 ? 'font-black text-red-400' : 'text-slate-600'}">${n || '—'}</td>`;
                            }).join('')}
                            <td class="p-2 text-center font-black ${total(e) > 0 ? 'text-amber-400' : 'text-slate-600'}">${total(e) || '—'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
};

window.appelBilanExporter = function() {
    const data = window._bilanData;
    if (!data) return;
    const periode = data.periodes.find(p => p.id === data.periodeId) || null;
    const { eleves, bilan } = calculerBilan(periode);

    const colonnes = [
        { nom: 'Nom de famille', cle: 'nom' },
        { nom: 'Prénom', cle: 'prenom' },
        { nom: 'Absences', cle: 'absent' },
        { nom: 'Retards', cle: 'retard' },
        { nom: 'Oublis tenue', cle: 'oubli_tenue' },
        { nom: 'Inaptitudes', cle: 'inapte' },
        { nom: 'Total', cle: 'total' },
    ];
    const donnees = eleves.map(e => ({
        nom: e.nom || '',
        prenom: e.prenom || '',
        absent: bilan[e.id].absent,
        retard: bilan[e.id].retard,
        oubli_tenue: bilan[e.id].oubli_tenue,
        inapte: bilan[e.id].inapte,
        total: bilan[e.id].absent + bilan[e.id].retard + bilan[e.id].oubli_tenue + bilan[e.id].inapte,
    }));

    const suffixe = periode ? periode.nom : 'Annee';
    exporterVersExcel('Bilan_' + suffixe, currentClasse, [{ nom: 'Bilan', colonnes, donnees }]);
};

