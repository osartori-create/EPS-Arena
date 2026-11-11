// src/js/carnet/fiche-eleve.js
// Fiche élève "tout-en-un" — agrège identité, performances, carnet, appel, évaluations,
// inaptitude, UNSS et contacts administratifs.

import { getExistingEleves, getPhotoUrl } from '../services/admin-service.js';
import { getLicenceParEleve } from './unss.js';
import { getToutesGrilles, getEvaluationsClasse, calculerNoteFinale } from '../modules/grilles/grilles-core.js';
import { setClasseInaptitude, getInaptitude, libelleInaptitude } from './inaptitude.js';
import { getSeancesClasseDate } from './planner.js';

const FLAGS = [
    { id: 'absent', label: 'Absent', couleur: '#ef4444' },
    { id: 'retard', label: 'Retard', couleur: '#f59e0b' },
    { id: 'oubli_tenue', label: 'Oubli tenue', couleur: '#3b82f6' },
    { id: 'inapte', label: 'Inapte', couleur: '#8b5cf6' },
];

function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function lireCarnet(classe) {
    const champs = JSON.parse(localStorage.getItem('eps_arena_carnet_champs_' + classe) || '[]');
    const valeurs = JSON.parse(localStorage.getItem('eps_arena_carnet_valeurs_' + classe) || '{}');
    return { champs, valeurs };
}

function lireAdmin(ine) {
    if (!ine) return null;
    const all = JSON.parse(localStorage.getItem('eps_arena_admin_eleves') || '{}');
    return all[ine] || null;
}

export async function ouvrirFicheEleve(eleveId, classe) {
    const eleve = getExistingEleves(classe).find(e => e.id === eleveId);
    if (!eleve) return;
    setClasseInaptitude(classe);

    const photoUrl = await getPhotoUrl(eleveId);
    const photoHtml = photoUrl
        ? `<img src="${photoUrl}" class="w-16 h-16 rounded-full object-cover border-2 border-slate-600 shrink-0">`
        : `<div class="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center text-3xl shrink-0">👤</div>`;

    const inapt = getInaptitude(eleveId);
    const lic = getLicenceParEleve({ ...eleve, classe });
    const admin = lireAdmin(eleve.ine);

    const perf = [
        ['🏊 Indice de nage', eleve.indiceNage],
        ['🏃 VMA (km/h)', eleve.vma],
        ['📈 Palier Luc Léger', eleve.palier],
        ['📏 Longueur (cm)', eleve.longueur],
        ['⚡ Sprint 30m (s)', eleve.sprint30],
        ['💪 Force', eleve.force],
    ].filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== 0);

    const { champs, valeurs } = lireCarnet(classe);
    const vals = valeurs[eleveId] || {};
    const carnetHtml = champs.length ? champs.map(c => {
        const v = vals[c.id];
        let aff = '—';
        if (v !== undefined && v !== null && v !== '') {
            if (c.type === 'statut') {
                const entree = (c.legende || []).find(l => String(l.v) === String(v));
                aff = entree ? entree.label : v;
            } else if (c.type === 'note') {
                aff = v + ' / ' + (c.bareme || 20);
            } else if (c.type === 'mesure') {
                aff = v + (c.unite ? ' ' + c.unite : '');
            } else {
                aff = v;
            }
        }
        return `<div class="flex justify-between gap-2 py-1 border-b border-slate-800 last:border-0">
            <span class="text-xs text-slate-400">${esc(c.libelle)}</span>
            <span class="text-xs font-bold text-white text-right">${esc(aff)}</span>
        </div>`;
    }).join('') : '<p class="text-xs text-slate-500">Aucune donnée de carnet.</p>';

    const appel = JSON.parse(localStorage.getItem('eps_arena_appel_' + classe) || '{}');
    const totaux = { absent: 0, retard: 0, oubli_tenue: 0, inapte: 0 };
    const parActivite = {};
    Object.entries(appel).forEach(([date, jour]) => {
        const flags = jour[eleveId];
        if (!flags || typeof flags !== 'object') return;
        FLAGS.forEach(f => { if (flags[f.id]) totaux[f.id]++; });
        getSeancesClasseDate(classe, date).seances.forEach(s => {
            if (!s.activite) return;
            if (!parActivite[s.activite]) parActivite[s.activite] = { absent: 0, retard: 0, oubli_tenue: 0, inapte: 0 };
            FLAGS.forEach(f => { if (flags[f.id]) parActivite[s.activite][f.id]++; });
        });
    });
    const activites = Object.keys(parActivite).sort();

    const grilles = getToutesGrilles();
    const evalsClasse = getEvaluationsClasse(classe);
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

    let adminHtml = '<p class="text-xs text-slate-500">Aucun contact (INE non renseigné).</p>';
    if (admin) {
        const reps = [admin.legal1, admin.legal2].filter(r => r && (r.nom || r.prenom));
        const lignes = reps.map(r => {
            const nom = [r.civ, r.prenom, r.nom].filter(Boolean).join(' ');
            const coord = [r.tel, r.email].filter(Boolean).join(' · ');
            const adresse = [r.adresse, r.cp, r.commune].filter(Boolean).join(' ');
            return `<div class="py-1 border-b border-slate-800 last:border-0">
                <p class="text-xs font-bold text-white">${esc(nom || '—')}</p>
                ${coord ? `<p class="text-xs text-slate-400">${esc(coord)}</p>` : ''}
                ${adresse ? `<p class="text-[10px] text-slate-500">${esc(adresse)}</p>` : ''}
            </div>`;
        }).join('');
        const financ = [admin.financ?.prenom, admin.financ?.nom].filter(Boolean).join(' ');
        adminHtml = `
            ${lignes || '<p class="text-xs text-slate-500">Aucun représentant légal.</p>'}
            ${financ ? `<p class="text-xs text-slate-400 mt-2">💰 Resp. financier : <span class="text-white">${esc(financ)}</span></p>` : ''}
        `;
    }

    const htmlHaut = `
        <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-lg my-8">
            <div class="flex items-center gap-4 mb-4 border-b border-slate-700 pb-4">
                ${photoHtml}
                <div class="flex-1 min-w-0">
                    <h2 class="text-xl font-black text-white leading-tight">${esc(eleve.prenom)} ${esc(eleve.nom)}</h2>
                    <p class="text-xs text-slate-400">${eleve.sexe ? esc(eleve.sexe) + ' · ' : ''}Code ${eleve.codeAutoEval ?? '—'}${eleve.ine ? ' · INE ' + esc(eleve.ine) : ''}</p>
                    ${eleve.dateNaissance || eleve.regime ? `<p class="text-xs text-slate-500">${[eleve.dateNaissance, eleve.regime].filter(Boolean).join(' · ')}</p>` : ''}
                </div>
                <button onclick="document.getElementById('fiche-eleve-modal').remove()" class="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-xl font-black text-white text-sm shrink-0">✖</button>
            </div>

            ${perf.length ? `
            <h3 class="text-xs font-black text-slate-400 uppercase mb-2">🏅 Performances</h3>
            <div class="flex gap-2 flex-wrap mb-4">
                ${perf.map(([label, v]) => `<span class="px-3 py-1 rounded-full text-xs font-black text-white bg-slate-700">${label} : ${esc(v)}</span>`).join('')}
            </div>` : ''}

            <h3 class="text-xs font-black text-slate-400 uppercase mb-2">📋 Appel</h3>
            <div class="flex gap-2 flex-wrap mb-3">
                ${FLAGS.map(f => `<span class="px-3 py-1 rounded-full text-xs font-black text-white" style="background-color:${f.couleur};">${f.label} : ${totaux[f.id]}</span>`).join('')}
            </div>
            ${activites.length ? `
            <div class="overflow-x-auto mb-4">
                <table class="w-full text-xs">
                    <thead><tr class="text-slate-400 uppercase border-b border-slate-700"><th class="p-1.5 text-left">Activité</th>${FLAGS.map(f => `<th class="p-1.5 text-center">${f.label}</th>`).join('')}</tr></thead>
                    <tbody>${activites.map(act => `<tr class="border-b border-slate-800"><td class="p-1.5 font-bold text-white">${esc(act)}</td>${FLAGS.map(f => { const n = parActivite[act][f.id]; return `<td class="p-1.5 text-center ${n > 0 ? 'font-black text-red-400' : 'text-slate-600'}">${n || '—'}</td>`; }).join('')}</tr>`).join('')}</tbody>
                </table>
            </div>` : ''}

            <h3 class="text-xs font-black text-slate-400 uppercase mb-2">📒 Carnet</h3>
            <div class="bg-slate-800 p-3 rounded-xl mb-4">${carnetHtml}</div>
    `;

    const htmlBas = `
            <h3 class="text-xs font-black text-slate-400 uppercase mb-2">📊 Évaluations (grilles)</h3>
            ${grilles.length === 0 ? '<p class="text-xs text-slate-500 mb-4">Aucune grille.</p>' : `
            <div class="overflow-x-auto mb-4">
                <table class="w-full text-xs">
                    <thead><tr class="text-slate-400 uppercase border-b border-slate-700"><th class="p-1.5 text-left">Grille</th>${periodes.map(p => `<th class="p-1.5 text-center">${esc(p)}</th>`).join('')}</tr></thead>
                    <tbody>${lignesEval.map(l => `<tr class="border-b border-slate-800"><td class="p-1.5 font-bold text-white">${esc(l.titre)}</td>${l.cellules.map(c => `<td class="p-1.5 text-center font-black ${c !== null ? 'text-emerald-400' : 'text-slate-600'}">${c !== null ? c + '/20' : '—'}</td>`).join('')}</tr>`).join('')}</tbody>
                </table>
            </div>`}

            <h3 class="text-xs font-black text-slate-400 uppercase mb-2">🤕 Inaptitude</h3>
            <p class="text-sm font-bold text-white mb-4">${inapt ? libelleInaptitude(inapt) : 'Aucune inaptitude en cours.'}</p>

            <h3 class="text-xs font-black text-slate-400 uppercase mb-2">🏟️ UNSS</h3>
            ${lic ? `
            <div class="text-sm text-white mb-4">
                <div class="flex gap-1 flex-wrap mb-1">${String(lic.activitesUnss || '').split(',').map(a => a.trim()).filter(Boolean).map(a => `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 text-slate-200">${esc(a)}</span>`).join('')}${!lic.activitesUnss ? '<span class="text-slate-500">Aucune activité</span>' : ''}</div>
                <p class="text-xs text-slate-300">Licence : ${esc(lic.numLicence || '—')} · Catégorie : ${esc(lic.categorie || '—')}</p>
                <p class="text-xs text-slate-300">Parents : ${esc(lic.etatParents || '—')}</p>
            </div>` : '<p class="text-sm text-slate-500 mb-4">Non inscrit à l\'UNSS.</p>'}

            <h3 class="text-xs font-black text-slate-400 uppercase mb-2">👨‍👩‍👦 Contacts</h3>
            <div class="bg-slate-800 p-3 rounded-xl">${adminHtml}</div>
        </div>
    `;

    const overlay = document.createElement('div');
    overlay.id = 'fiche-eleve-modal';
    overlay.className = 'fixed inset-0 bg-black/70 z-50 flex items-start justify-center p-4 overflow-y-auto';
    overlay.innerHTML = htmlHaut + htmlBas;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

window.ouvrirFicheEleve = ouvrirFicheEleve;
