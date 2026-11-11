// src/js/carnet/bilan-inaptitudes.js
// Bilan & statistiques des inaptitudes (ponctuelles ≠ médicales), avec historisation.
// Données (localStorage, RGPD) : inaptitudes courantes + historique + appel (flag inapte).

import { getExistingEleves } from '../services/admin-service.js';
import { getCurrentClasse } from '../core/live-engine.js';
import { MOTIFS, ZONES, labelZone, lireInaptitudesClasse, lireHistoriqueClasse, supprimerInaptitude, setClasseInaptitude, calculerTempsRestant } from './inaptitude.js';

const KEY_CLASSES = 'eps_arena_classes';

let classeSelectionnee = '';

function lireClasses() { return JSON.parse(localStorage.getItem(KEY_CLASSES) || '[]'); }
function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function typeInapt(inapt) { return inapt && inapt.motif === 'medicale' ? 'medicale' : 'ponctuelle'; }

function notifier(msg, ok = true) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:1rem;left:50%;transform:translateX(-50%);z-index:9999;max-width:90vw;padding:0.6rem 1rem;border-radius:0.75rem;font-weight:700;font-size:0.8rem;color:#fff;box-shadow:0 10px 25px rgba(0,0,0,.4);background:' + (ok ? '#059669' : '#dc2626') + ';';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
}

// Agrège toutes les statistiques (vue globale + portée de la classe sélectionnée).
function collecter() {
    const classes = lireClasses();
    const global = { total: 0, medicales: 0, ponctuelles: 0, nonJustifiees: 0 };
    const parClasse = {};
    const zones = {}, motifs = {}, sexe = { F: 0, M: 0 };
    const detail = [];

    classes.forEach(classe => {
        const eleves = getExistingEleves(classe);
        const inapts = lireInaptitudesClasse(classe);
        const hist = lireHistoriqueClasse(classe);
        const stats = { total: 0, medicales: 0, ponctuelles: 0, nbEleves: eleves.length };
        const estSel = classe === classeSelectionnee;

        eleves.forEach(e => {
            const inapt = inapts[e.id];
            if (inapt && inapt.motif) {
                const type = typeInapt(inapt);
                stats.total++;
                stats[type === 'medicale' ? 'medicales' : 'ponctuelles']++;
                global.total++;
                global[type === 'medicale' ? 'medicales' : 'ponctuelles']++;
                if (inapt.nonJustifiee) global.nonJustifiees++;
                if (estSel) {
                    if (inapt.zone) zones[inapt.zone] = (zones[inapt.zone] || 0) + 1;
                    motifs[inapt.motif] = (motifs[inapt.motif] || 0) + 1;
                    const s = (e.sexe || '').toUpperCase();
                    if (s === 'F' || s === 'M') sexe[s]++;
                    detail.push({ eleve: e, inapt, type });
                }
            }
        });

        if (estSel) {
            Object.values(hist).forEach(liste => {
                liste.forEach(h => {
                    if (h.zone) zones[h.zone] = (zones[h.zone] || 0) + 1;
                    if (h.motif) motifs[h.motif] = (motifs[h.motif] || 0) + 1;
                });
            });
        }

        parClasse[classe] = stats;
    });

    return { classes, global, parClasse, zones, motifs, sexe, detail };
}

// Silhouette agrégée : zones colorées selon la fréquence.
function rendererVue(vue, counts) {
    const zones = ZONES[vue] || [];
    const couleur = (n) => n <= 0 ? '#334155' : n === 1 ? '#f59e0b' : n === 2 ? '#f97316' : '#ef4444';
    const zonesHtml = zones.map(z => {
        const n = counts[z.id] || 0;
        return `<ellipse cx="${z.x}" cy="${z.y}" rx="${z.rx}" ry="${z.ry}" fill="${couleur(n)}" fill-opacity="${n > 0 ? 0.8 : 0.18}" stroke="#0f172a" stroke-width="1"><title>${z.label} : ${n}</title></ellipse>`;
    }).join('');
    return `<svg viewBox="0 0 200 380" class="w-full max-w-[160px]">
        <g fill="#475569" stroke="#1e293b" stroke-width="1.5">
            <circle cx="100" cy="32" r="22"/>
            <rect x="89" y="49" width="22" height="18" rx="7"/>
            <ellipse cx="100" cy="130" rx="37" ry="60"/>
            <ellipse cx="84" cy="196" rx="16" ry="15"/>
            <ellipse cx="116" cy="196" rx="16" ry="15"/>
        </g>
        <g stroke="#64748b" stroke-width="15" stroke-linecap="round" fill="none">
            <path d="M64 82 L50 140 L42 190"/>
            <path d="M136 82 L150 140 L158 190"/>
        </g>
        <g stroke="#64748b" stroke-width="17" stroke-linecap="round" fill="none">
            <path d="M84 210 L84 270 L84 340"/>
            <path d="M116 210 L116 270 L116 340"/>
        </g>
        ${zonesHtml}
    </svg>`;
}

function render() {
    const container = document.getElementById('viewInaptitudes');
    if (!container) return;
    const d = collecter();
    const classes = d.classes;

    if (!classes.length) {
        container.innerHTML = '<p class="text-slate-500 text-center py-10">Aucune classe.</p>';
        return;
    }
    if (!classeSelectionnee || !classes.includes(classeSelectionnee)) classeSelectionnee = classes[0];

    const cartes = `
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div class="bg-purple-600 p-4 rounded-2xl border-2 border-purple-400">
                <p class="text-2xl font-black text-white">${d.global.total}</p>
                <p class="text-xs font-bold text-purple-100 uppercase">Inaptes en cours</p>
            </div>
            <div class="bg-emerald-600 p-4 rounded-2xl border-2 border-emerald-400">
                <p class="text-2xl font-black text-white">${d.global.medicales}</p>
                <p class="text-xs font-bold text-emerald-100 uppercase">Médicales (certificats)</p>
            </div>
            <div class="bg-amber-500 p-4 rounded-2xl border-2 border-amber-300">
                <p class="text-2xl font-black text-black">${d.global.ponctuelles}</p>
                <p class="text-xs font-bold text-amber-900 uppercase">Ponctuelles</p>
            </div>
            <div class="bg-red-600 p-4 rounded-2xl border-2 border-red-400">
                <p class="text-2xl font-black text-white">${d.global.nonJustifiees}</p>
                <p class="text-xs font-bold text-red-100 uppercase">⚠️ Non justifiées</p>
            </div>
        </div>`;

    const tableauClasses = `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 mb-4 overflow-x-auto">
            <h4 class="text-xs font-black text-slate-400 uppercase mb-2">Par classe</h4>
            <table class="w-full text-sm">
                <thead><tr class="text-xs text-slate-400 uppercase border-b border-slate-700"><th class="p-2 text-left">Classe</th><th class="p-2 text-center">Élèves</th><th class="p-2 text-center">Inaptes</th><th class="p-2 text-center">Médicales</th><th class="p-2 text-center">Ponctuelles</th><th class="p-2 text-center">%</th></tr></thead>
                <tbody>${classes.map(c => {
                    const s = d.parClasse[c];
                    const pct = s.nbEleves ? Math.round(s.total / s.nbEleves * 100) : 0;
                    return `<tr class="border-b border-slate-800"><td class="p-2 font-bold text-white">${esc(c)}</td><td class="p-2 text-center">${s.nbEleves}</td><td class="p-2 text-center font-bold ${s.total ? 'text-purple-400' : 'text-slate-500'}">${s.total}</td><td class="p-2 text-center text-emerald-400">${s.medicales}</td><td class="p-2 text-center text-amber-400">${s.ponctuelles}</td><td class="p-2 text-center font-bold">${pct}%</td></tr>`;
                }).join('')}</tbody>
            </table>
        </div>`;

    const detailHtml = `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 mb-4">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h4 class="text-xs font-black text-slate-400 uppercase">Détail — ${esc(classeSelectionnee)}</h4>
                <select onchange="window.inaptChangerClasse(this.value)" class="bg-slate-900 border border-slate-600 rounded px-3 py-2 text-xs font-bold text-white">
                    ${classes.map(c => `<option value="${c}" ${c === classeSelectionnee ? 'selected' : ''}>${c}</option>`).join('')}
                </select>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="md:col-span-2">
                    ${d.detail.length === 0 ? '<p class="text-xs text-slate-500 py-4">Aucune inaptitude en cours dans cette classe.</p>' : `
                    <table class="w-full text-sm">
                        <thead><tr class="text-xs text-slate-400 uppercase border-b border-slate-700"><th class="p-2 text-left">Élève</th><th class="p-2 text-center">Type</th><th class="p-2 text-center">Motif</th><th class="p-2 text-center">Zone</th><th class="p-2 text-center">Fin</th><th class="p-2"></th></tr></thead>
                        <tbody>${d.detail.map(r => {
                            const med = r.type === 'medicale';
                            const motif = MOTIFS.find(m => m.id === r.inapt.motif);
                            const j = calculerTempsRestant(r.inapt);
                            return `<tr class="border-b border-slate-800">
                                <td class="p-2 font-bold text-white">${esc(r.eleve.prenom)} ${esc(r.eleve.nom)}</td>
                                <td class="p-2 text-center"><span class="px-2 py-1 rounded-lg text-[10px] font-black ${med ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-black'}">${med ? 'MÉDICALE' : 'PONCTUELLE'}</span>${r.inapt.nonJustifiee ? ' <span class="px-2 py-1 rounded-lg text-[10px] font-black bg-red-600 text-white">⚠️ à justifier</span>' : ''}</td>
                                <td class="p-2 text-center text-slate-300">${motif ? motif.icon + ' ' + motif.label : '—'}</td>
                                <td class="p-2 text-center text-slate-300">${r.inapt.zone ? labelZone(r.inapt.zone) : '—'}</td>
                                <td class="p-2 text-center text-slate-400 text-xs">${r.inapt.dateFin || '—'}${j !== null && j >= 0 ? ` (${j} j)` : ''}</td>
                                <td class="p-2 text-right"><button onclick="window.inaptLever('${r.eleve.id}')" class="min-h-[36px] bg-red-600 hover:bg-red-500 px-3 py-1.5 rounded-lg font-black text-xs text-white">Lever</button></td>
                            </tr>`;
                        }).join('')}</tbody>
                    </table>`}
                </div>
                <div>
                    <div class="flex gap-2 justify-center mb-2">
                        ${rendererVue('face', d.zones)}
                        ${rendererVue('dos', d.zones)}
                    </div>
                    <p class="text-[10px] text-slate-500 text-center mb-3">Zones touchées (courantes + historiques)</p>
                    <div class="flex flex-wrap gap-1.5 mb-3">
                        ${MOTIFS.map(m => `<span class="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-700 text-slate-200">${m.icon} ${m.label} : ${d.motifs[m.id] || 0}</span>`).join('')}
                    </div>
                    <p class="text-xs text-slate-400">♀ ${d.sexe.F || 0} · ♂ ${d.sexe.M || 0}</p>
                </div>
            </div>
        </div>`;

    container.innerHTML = `
        <div class="space-y-4">
            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700 flex items-center justify-between gap-4">
                <div>
                    <h3 class="font-black text-purple-400 uppercase text-sm">🏥 Bilan des inaptitudes</h3>
                    <p class="text-xs text-slate-400 mt-1">Ponctuelles (« j'ai mal aujourd'hui ») ≠ médicales (certificat)</p>
                </div>
            </div>
            ${cartes}
            ${tableauClasses}
            ${detailHtml}
        </div>
    `;
}

window.inaptChangerClasse = function(classe) {
    classeSelectionnee = classe;
    render();
};

window.inaptLever = function(eleveId) {
    setClasseInaptitude(classeSelectionnee);
    supprimerInaptitude(eleveId);
    render();
    notifier("✅ Inaptitude levée (conservée dans l'historique).");
};

export function initBilanInaptitudes() {
    classeSelectionnee = getCurrentClasse() || '';
    render();
}

