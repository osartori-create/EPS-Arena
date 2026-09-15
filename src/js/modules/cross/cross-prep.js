// src/js/modules/cross/cross-prep.js
// Onglet Préparation : import, génération dossards, statuts, export PDF

import {
    getCrossConfig, setCrossConfig,
    getClassesParticipantes, setClassesParticipantes,
    getTousLesElevesCross, setDossardPourEleve, getDossardByEleveId,
    getStatutsCross, setStatutsCross, getDossards
} from './cross-config.js';
import { importCSVEtablissement, importExcelDossards, genererDossardsAuto } from './cross-import.js';
import { getNiveauFromClasse } from './cross-core.js';
import { getPhotoUrl } from '../../services/admin-service.js';

let filtreClasse = '';
let filtreStatut = '';

export function initCrossPrep(container) {
    if (!container) return;
    render(container);
}

async function render(container) {
    const config = getCrossConfig();
    const classes = getClassesParticipantes();
    const eleves = getTousLesElevesCross();

    const stats = {
        nbClasses: classes.length,
        nbEleves: eleves.length,
        nbAvecDossard: eleves.filter(e => e.dossard).length,
        nbAbsents: eleves.filter(e => e.statut === 'absent').length,
        nbInaptes: eleves.filter(e => e.statut === 'inapte').length
    };

    // Classes filtrées
    const elevesFiltres = eleves.filter(e => {
        if (filtreClasse && e.classe !== filtreClasse) return false;
        if (filtreStatut && e.statut !== filtreStatut) return false;
        return true;
    });

    container.innerHTML = `
        <div class="space-y-4">
            <!-- Bandeau config -->
            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 flex justify-between items-center flex-wrap gap-3">
                <div>
                    <h3 class="font-black text-blue-400 uppercase text-sm">🏃 Cross — Préparation</h3>
                    <p class="text-xs text-slate-400">${config?.nom || 'Cross ' + new Date().getFullYear()} · ${stats.nbClasses} classes · ${stats.nbEleves} élèves</p>
                </div>
                <div class="flex gap-2 flex-wrap">
                    <button onclick="window.crossPrepImporterEtab()" class="bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-xl font-black text-xs text-white">
                        📥 Import CSV établissement
                    </button>
                    <button onclick="window.crossPrepImporterDossards()" class="bg-indigo-600 hover:bg-indigo-500 px-3 py-2 rounded-xl font-black text-xs text-white">
                        📥 Import Excel dossards
                    </button>
                    <button onclick="window.crossPrepGenererDossards()" class="bg-emerald-600 hover:bg-emerald-500 px-3 py-2 rounded-xl font-black text-xs text-white">
                        🎫 Générer dossards auto
                    </button>
                    <button onclick="window.crossPrepReset()" class="bg-red-600 hover:bg-red-500 px-3 py-2 rounded-xl font-black text-xs text-white">
                        🗑️ Reset
                    </button>
                </div>
            </div>

            <!-- Stats -->
            <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div class="bg-slate-800 p-3 rounded-xl border border-slate-700 text-center">
                    <div class="text-[10px] uppercase text-slate-400 font-bold">Classes</div>
                    <div class="text-2xl font-black text-blue-400">${stats.nbClasses}</div>
                </div>
                <div class="bg-slate-800 p-3 rounded-xl border border-slate-700 text-center">
                    <div class="text-[10px] uppercase text-slate-400 font-bold">Élèves</div>
                    <div class="text-2xl font-black text-white">${stats.nbEleves}</div>
                </div>
                <div class="bg-slate-800 p-3 rounded-xl border border-slate-700 text-center">
                    <div class="text-[10px] uppercase text-slate-400 font-bold">Avec dossard</div>
                    <div class="text-2xl font-black text-emerald-400">${stats.nbAvecDossard}</div>
                </div>
                <div class="bg-slate-800 p-3 rounded-xl border border-slate-700 text-center">
                    <div class="text-[10px] uppercase text-slate-400 font-bold">Absents</div>
                    <div class="text-2xl font-black text-red-400">${stats.nbAbsents}</div>
                </div>
                <div class="bg-slate-800 p-3 rounded-xl border border-slate-700 text-center">
                    <div class="text-[10px] uppercase text-slate-400 font-bold">Inaptes</div>
                    <div class="text-2xl font-black text-amber-400">${stats.nbInaptes}</div>
                </div>
            </div>

            <!-- Filtres -->
            <div class="bg-slate-800 p-3 rounded-2xl border border-slate-700 flex flex-wrap gap-3 items-center">
                <label class="text-xs font-bold text-slate-400 uppercase">Filtrer :</label>
                <select id="crossPrepFiltreClasse" class="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white" onchange="window.crossPrepSetFiltreClasse(this.value)">
                    <option value="">Toutes les classes</option>
                    ${classes.sort().map(c => `<option value="${c}" ${filtreClasse===c?'selected':''}>${c}</option>`).join('')}
                </select>
                <select id="crossPrepFiltreStatut" class="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white" onchange="window.crossPrepSetFiltreStatut(this.value)">
                    <option value="">Tous statuts</option>
                    <option value="present" ${filtreStatut==='present'?'selected':''}>Présents</option>
                    <option value="absent"  ${filtreStatut==='absent'?'selected':''}>Absents</option>
                    <option value="inapte"  ${filtreStatut==='inapte'?'selected':''}>Inaptes</option>
                </select>
                <span class="text-xs text-slate-400 ml-auto">${elevesFiltres.length} élève(s) affiché(s)</span>
            </div>

            <!-- Table -->
            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 overflow-x-auto">
                <table class="w-full text-sm">
                    <thead class="bg-slate-900 text-slate-400 text-xs uppercase border-b border-slate-700">
                        <tr>
                            <th class="p-2 text-left">Dossard</th>
                            <th class="p-2 text-left">Classe</th>
                            <th class="p-2 text-left">Nom</th>
                            <th class="p-2 text-left">Prénom</th>
                            <th class="p-2 text-center">Sexe</th>
                            <th class="p-2 text-center">VMA</th>
                            <th class="p-2 text-center">Statut</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${elevesFiltres.map(e => renderRow(e)).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderRow(e) {
    const statutColor = e.statut === 'absent' ? 'bg-red-900/30' : (e.statut === 'inapte' ? 'bg-amber-900/30' : '');
    return `
        <tr class="border-b border-slate-700/50 ${statutColor}">
            <td class="p-2 font-black text-yellow-400">${e.dossard || '—'}</td>
            <td class="p-2 text-slate-300">${e.classe}</td>
            <td class="p-2 font-bold text-white">${e.nom}</td>
            <td class="p-2 text-slate-200">${e.prenom}</td>
            <td class="p-2 text-center text-slate-400">${e.sexe || '?'}</td>
            <td class="p-2 text-center text-emerald-400 font-bold">${e.vma || '—'}</td>
            <td class="p-2 text-center">
                <select onchange="window.crossPrepSetStatut('${e.eleveId}', this.value)" class="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white">
                    <option value="present" ${e.statut==='present'?'selected':''}>Présent</option>
                    <option value="absent"  ${e.statut==='absent'?'selected':''}>Absent</option>
                    <option value="inapte"  ${e.statut==='inapte'?'selected':''}>Inapte</option>
                </select>
            </td>
        </tr>
    `;
}

// ============================================================
// ACTIONS GLOBALES
// ============================================================
window.crossPrepImporterEtab = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.csv';
    input.onchange = async (ev) => {
        const file = ev.target.files[0]; if (!file) return;
        try {
            const res = await importCSVEtablissement(file);
            alert(`✅ Import terminé.\n${Object.keys(res.classes).length} classes · ${res.totalEleves} élèves.`);
            refreshCross();
        } catch (err) {
            console.error(err);
            alert('❌ Erreur d\'import : ' + err.message);
        }
    };
    input.click();
};

window.crossPrepImporterDossards = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.xlsx,.xls';
    input.onchange = async (ev) => {
        const file = ev.target.files[0]; if (!file) return;
        try {
            const res = await importExcelDossards(file);
            alert(`✅ ${res.associes} dossard(s) associé(s). ${res.ignores} ignoré(s).`);
            refreshCross();
        } catch (err) {
            console.error(err);
            alert('❌ Erreur d\'import : ' + err.message);
        }
    };
    input.click();
};

window.crossPrepGenererDossards = () => {
    const classes = getClassesParticipantes();
    if (classes.length === 0) return alert('Importe d\'abord un CSV établissement.');
    if (!confirm('Attribuer un dossard à tous les élèves qui n\'en ont pas ?')) return;
    const res = genererDossardsAuto(classes);
    alert(`✅ ${res.attribues} dossard(s) attribué(s) (de ${res.premier} à ${res.dernier}).`);
    refreshCross();
};

window.crossPrepSetStatut = (eleveId, statut) => {
    const statuts = getStatutsCross();
    if (statut === 'present') delete statuts[eleveId];
    else statuts[eleveId] = statut;
    setStatutsCross(statuts);
    refreshCross();
};

window.crossPrepSetFiltreClasse = (v) => { filtreClasse = v; refreshCross(); };
window.crossPrepSetFiltreStatut = (v) => { filtreStatut = v; refreshCross(); };

window.crossPrepReset = () => {
    if (!confirm('⚠️ Effacer TOUTES les données Cross locales (dossards, statuts) ?')) return;
    if (!confirm('✅ Dernière confirmation ?')) return;
    ['eps_arena_cross_config', 'eps_arena_cross_classes', 'eps_arena_cross_dossards',
     'eps_arena_cross_dossards_inv', 'eps_arena_cross_statuts'].forEach(k => localStorage.removeItem(k));
    refreshCross();
};

function refreshCross() {
    const container = document.getElementById('viewCross');
    if (container) render(container);
}