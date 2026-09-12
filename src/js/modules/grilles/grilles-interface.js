// src/js/modules/grilles/grilles-interface.js
// UI Prof : bibliothèque + passation + export + auto-évaluations reçues

import {
    getToutesGrilles, getGrille, sauvegarderGrille, supprimerGrille, figerGrille,
    calculerNoteFinale, getEvaluationsClasse, sauvegarderEvaluation,
    setDernierNiveauEleve, getDernierNiveauEleve, NIVEAUX, getCouleurNiveau
} from './grilles-core.js';
import { importerGrilleXLSX } from './grilles-import.js';
import { exporterNotesIDoceo, exporterRubriqueIDoceo, exporterGrilleVierge } from './grilles-export.js';
import { calculerNiveauxRelais } from './connecteurs/relais.js';
import { getExistingEleves, getPhotoUrl } from '../../services/admin-service.js';
import { getCurrentClasse } from '../../core/live-engine.js';
import { db, ref, onValue } from '../../core/firebase-service.js';

let currentClasse = '';
let currentGrille = null;
let currentPeriode = 'Début';
let currentEvaluations = {};
let _vueCompacte = false;

// ============================================================
// POINT D'ENTRÉE
// ============================================================
export function initGrillesInterface() {
    const container = document.getElementById('viewEvaluations');
    if (!container) return;

    currentClasse = getCurrentClasse();
    container.innerHTML = '';

    if (currentGrille) {
        renderPassation(container);
    } else {
        renderBibliotheque(container);
    }
}

// ============================================================
// ÉCRAN 1 : BIBLIOTHÈQUE
// ============================================================
function renderBibliotheque(container) {
    const grilles = getToutesGrilles();

    const parActivite = {};
    grilles.forEach(g => {
        if (!parActivite[g.activite]) parActivite[g.activite] = [];
        parActivite[g.activite].push(g);
    });

    let html = `
        <div class="space-y-4">
            <div class="flex justify-between items-center bg-slate-800 p-4 rounded-2xl border border-slate-700 flex-wrap gap-2">
                <div>
                    <h2 class="text-xl font-black text-blue-400">📋 Bibliothèque de grilles</h2>
                    <p class="text-xs text-slate-400">${grilles.length} grille(s) disponible(s)</p>
                </div>
                <div class="flex gap-2 flex-wrap">
                    <button onclick="window.grillesVoirAutoEvals()"
                            class="bg-cyan-600 hover:bg-cyan-500 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-cyan-400 active:scale-95">
                        👁️ Voir les auto-évaluations
                    </button>
                    <button onclick="window.grillesImporterXLSX()"
                            class="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-purple-400 active:scale-95">
                        📥 Importer XLSX
                    </button>
                    <input type="file" id="grillesInputFile" class="hidden" accept=".xlsx,.xls" onchange="window.grillesTraiterImport(event)">
                </div>
            </div>
    `;

    if (grilles.length === 0) {
        html += `
            <div class="bg-slate-800 p-10 rounded-2xl border border-slate-700 text-center">
                <div class="text-6xl mb-4">📭</div>
                <p class="text-lg font-black text-white mb-2">Aucune grille dans la bibliothèque</p>
                <p class="text-sm text-slate-400 mb-4">Importe un fichier XLSX généré par iDoceo pour commencer.</p>
                <button onclick="window.grillesImporterXLSX()"
                        class="bg-purple-600 hover:bg-purple-500 px-6 py-3 rounded-xl font-black text-sm text-white active:scale-95">
                    📥 Importer ma première grille
                </button>
            </div>
        `;
    } else {
        html += `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">`;
        Object.entries(parActivite).forEach(([activite, list]) => {
            list.forEach(g => {
                const nbCriteres = g.criteres.length;
                const nbAuto = g.criteres.filter(c => c.type === 'auto').length;
                html += `
                    <div class="bg-slate-800 p-4 rounded-2xl border-2 ${g.figee ? 'border-amber-500' : 'border-slate-700'}">
                        <div class="flex justify-between items-start mb-2">
                            <div>
                                <div class="text-xs font-bold text-blue-400 uppercase">${activite}</div>
                                <div class="font-black text-white text-lg">${g.niveau}</div>
                            </div>
                            ${g.figee ? '<span class="text-amber-400 text-xs font-black">🔒 FIGÉE</span>' : ''}
                        </div>
                        <p class="text-xs text-slate-400 mb-2">${g.titre || ''}</p>
                        <div class="flex gap-2 text-[10px] mb-3">
                            <span class="bg-slate-700 px-2 py-0.5 rounded-full text-slate-300">${nbCriteres} critères</span>
                            ${nbAuto > 0 ? `<span class="bg-emerald-900/50 text-emerald-300 px-2 py-0.5 rounded-full">${nbAuto} auto</span>` : ''}
                        </div>
                        <div class="flex gap-2">
                            <button onclick="window.grillesUtiliser('${g.id}')"
                                    class="flex-1 bg-blue-600 hover:bg-blue-500 py-2 rounded-xl font-black text-xs text-white active:scale-95">
                                ✏️ Évaluer
                            </button>
                            <button onclick="window.grillesExporterVierge('${g.id}')"
                                    class="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-xl font-black text-xs text-white active:scale-95"
                                    title="Exporter la grille vierge">⬇️</button>
                            <button onclick="window.grillesSupprimer('${g.id}')"
                                    class="bg-red-900/50 hover:bg-red-800 px-3 py-2 rounded-xl font-black text-xs text-red-300 active:scale-95"
                                    title="Supprimer">🗑️</button>
                        </div>
                    </div>
                `;
            });
        });
        html += `</div>`;
    }

    html += `</div>`;
    container.innerHTML = html;
}

// ============================================================
// ÉCRAN 2 : PASSATION
// ============================================================
function renderPassation(container) {
    if (!currentGrille) {
        renderBibliotheque(container);
        return;
    }

    const eleves = getExistingEleves(currentClasse);
    eleves.sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));

    const evaluations = getEvaluationsClasse(currentClasse);
    currentEvaluations = evaluations[currentGrille.id] || {};

    const periodes = currentGrille.periodes || ['Début', 'Milieu', 'Fin'];
    if (!periodes.includes(currentPeriode)) currentPeriode = periodes[0];

    const eleveData = currentEvaluations[currentPeriode] || {};

    let html = `
        <div class="space-y-4">
            <!-- EN-TÊTE + PÉRIODES -->
            <div class="flex justify-between items-center bg-slate-800 p-4 rounded-2xl border border-slate-700 flex-wrap gap-2">
                <div>
                    <button onclick="window.grillesRetourBibliotheque()" class="bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-xl font-black text-xs text-white active:scale-95 mb-2">
                        ← Bibliothèque
                    </button>
                    <h2 class="text-xl font-black text-blue-400">${currentGrille.titre || currentGrille.id}</h2>
                    <p class="text-xs text-slate-400">${currentGrille.criteres.length} critères · ${eleves.length} élèves</p>
                </div>
                <div class="flex gap-2 flex-wrap">
                    ${periodes.map(p => `
                        <button onclick="window.grillesSetPeriode('${p}')"
                                class="${p === currentPeriode ? 'bg-blue-600' : 'bg-slate-700'} px-3 py-1.5 rounded-xl font-black text-xs text-white active:scale-95">
                            ${p}
                        </button>
                    `).join('')}
                </div>
            </div>

            <!-- ✅ MENU D'ACTIONS EN HAUT -->
            <div class="flex gap-2 flex-wrap bg-slate-800 p-3 rounded-2xl border border-slate-700">
                <button onclick="window.grillesSauvegarder()"
                        class="flex-1 min-w-[130px] bg-emerald-600 hover:bg-emerald-500 py-3 rounded-xl font-black text-xs uppercase text-white active:scale-95">
                    💾 Sauvegarder
                </button>
                <button onclick="window.grillesRemplirAutoGlobal()"
                        class="flex-1 min-w-[130px] bg-pink-600 hover:bg-pink-500 py-3 rounded-xl font-black text-xs uppercase text-white active:scale-95 border-2 border-pink-400">
                    🤖 Tout remplir auto
                </button>
                <button onclick="window.grillesToggleVueCompacte()"
                        class="flex-1 min-w-[130px] bg-cyan-700 hover:bg-cyan-600 py-3 rounded-xl font-black text-xs uppercase text-white active:scale-95">
                    <span id="grilles-vue-label">👁️ Vue compacte</span>
                </button>
                <button onclick="window.grillesActiver()"
                        class="bg-blue-600 hover:bg-blue-500 px-4 py-3 rounded-xl font-black text-xs uppercase text-white active:scale-95 border-2 border-blue-400">
                    📡 Activer iPads
                </button>
                <button onclick="window.grillesDesactiver()"
                        class="bg-slate-700 hover:bg-slate-600 px-4 py-3 rounded-xl font-black text-xs uppercase text-white active:scale-95">
                    ⏹ Désactiver
                </button>
                <button onclick="window.grillesGenererDonneesTest()"
                        class="bg-orange-700 hover:bg-orange-600 px-4 py-3 rounded-xl font-black text-xs uppercase text-white active:scale-95">
                    🧪 Test
                </button>
                <button onclick="window.grillesFiger()"
                        class="bg-amber-600 hover:bg-amber-500 px-4 py-3 rounded-xl font-black text-xs uppercase text-white active:scale-95 ${currentGrille.figee ? 'opacity-50 cursor-not-allowed' : ''}"
                        ${currentGrille.figee ? 'disabled' : ''}>
                    🔒 ${currentGrille.figee ? 'Figée' : 'Figer'}
                </button>
                <button onclick="window.grillesExporterNotes()"
                        class="bg-indigo-600 hover:bg-indigo-500 px-4 py-3 rounded-xl font-black text-xs uppercase text-white active:scale-95">
                    📥 Notes XLS
                </button>
                <button onclick="window.grillesExporterRubrique()"
                        class="bg-purple-600 hover:bg-purple-500 px-4 py-3 rounded-xl font-black text-xs uppercase text-white active:scale-95">
                    📥 Rubrique XLS
                </button>
            </div>
    `;

    // Bandeau dernier niveau Élève
    if (eleves.length > 0) {
        const derniers = eleves.map(e => getDernierNiveauEleve(currentClasse, e.id)).filter(Boolean);
        if (derniers.length > 0) {
            html += `
                <div class="bg-amber-900/20 border border-amber-500/50 rounded-xl p-3 text-xs text-amber-200">
                    💡 <strong class="text-amber-400">Info :</strong> Certains élèves ont déjà un niveau "Élève" enregistré dans une autre activité.
                    Il sera pré-rempli automatiquement.
                </div>
            `;
        }
    }

    // ============================================================
    // VUE COMPACTE
    // ============================================================
    if (_vueCompacte) {
        html += `<div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 overflow-x-auto">
            <table class="w-full text-xs">
                <thead>
                    <tr class="text-[10px] text-slate-400 uppercase">
                        <th class="p-2 text-left sticky left-0 bg-slate-800 min-w-[130px]">Élève</th>
                        ${currentGrille.criteres.map(c => `
                            <th class="p-1 text-center min-w-[80px]">
                                <div class="font-black text-white text-[9px] leading-tight">${c.nom.substring(0, 22)}</div>
                            </th>
                        `).join('')}
                        <th class="p-1 text-center min-w-[50px]">/100</th>
                        <th class="p-1 text-center min-w-[50px]">/20</th>
                    </tr>
                </thead>
                <tbody>`;

        for (const e of eleves) {
            const notes = eleveData[e.id]?.notes || {};
            const noteFinale = calculerNoteFinale(notes, currentGrille.criteres);

            html += `<tr class="border-t border-slate-700 hover:bg-slate-700/30">`;
            html += `<td class="p-1 sticky left-0 bg-slate-800 font-bold text-white text-[11px]">${e.prenom} ${e.nom}</td>`;

            for (const c of currentGrille.criteres) {
                const val = notes[c.id];
                const couleur = val !== undefined ? getCouleurNiveau(val) : '#334155';
                html += `
                    <td class="p-1 text-center">
                        <button onclick="window.grillesCycleNote('${e.id}', '${c.id}')"
                                class="w-full h-9 rounded font-black text-sm transition-all active:scale-95"
                                style="background-color: ${couleur}; color: white;"
                                title="${val !== undefined ? 'Niveau ' + val : 'Non évalué'}">
                            ${val !== undefined ? val : '--'}
                        </button>
                    </td>
                `;
            }

            html += `<td class="p-1 text-center font-black text-yellow-400">${noteFinale.sur100 !== null ? noteFinale.sur100 : '--'}</td>`;
            html += `<td class="p-1 text-center font-black text-emerald-400">${noteFinale.sur20 !== null ? noteFinale.sur20 : '--'}</td>`;
            html += `</tr>`;
        }

        html += `</tbody></table>
            <p class="text-[10px] text-slate-500 mt-2 text-center">
                💡 Clique sur une case pour cycler : 4 → 3 → 2 → 1 → 4
            </p>
        </div>`;
    } else {
        // ============================================================
        // VUE DÉTAILLÉE
        // ============================================================
        html += `<div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 overflow-x-auto">
            <table class="w-full text-sm">
                <thead>
                    <tr class="text-xs text-slate-400 uppercase border-b border-slate-700">
                        <th class="p-2 text-left sticky left-0 bg-slate-800">Élève</th>
                        ${currentGrille.criteres.map(c => `
                            <th class="p-2 text-center">
                                <div class="font-black text-white">${c.nom}</div>
                                <div class="text-[9px] text-slate-500">${c.ponderation > 0 ? c.ponderation + '%' : 'équipondéré'}</div>
                                ${c.type === 'auto' ? '<div class="text-[9px] text-emerald-400 font-black">AUTO</div>' : ''}
                            </th>
                        `).join('')}
                        <th class="p-2 text-center">Note /100</th>
                        <th class="p-2 text-center">Note /20</th>
                    </tr>
                </thead>
                <tbody>`;

        for (const e of eleves) {
            const notes = eleveData[e.id]?.notes || {};
            const noteFinale = calculerNoteFinale(notes, currentGrille.criteres);

            html += `<tr class="border-b border-slate-700/50 hover:bg-slate-700/30">`;
            html += `<td class="p-2 sticky left-0 bg-slate-800 font-bold text-white">${e.prenom} ${e.nom}</td>`;

            for (const c of currentGrille.criteres) {
                const val = notes[c.id];
                html += `
                    <td class="p-2 text-center">
                        <div class="flex justify-center gap-1">
                            ${NIVEAUX.map(n => `
                                <button onclick="window.grillesSetNote('${e.id}', '${c.id}', ${n.valeur})"
                                        class="w-8 h-8 rounded-lg font-black text-xs ${val === n.valeur ? 'text-white ring-2 ring-white' : 'text-slate-400 hover:text-white'}"
                                        style="background-color: ${val === n.valeur ? n.couleur : '#334155'};"
                                        title="${n.label}">
                                    ${n.valeur}
                                </button>
                            `).join('')}
                        </div>
                        ${c.type === 'auto' ? `<button onclick="window.grillesRemplirAuto('${e.id}', '${c.id}')" class="text-[9px] text-emerald-400 hover:text-emerald-300 mt-0.5 font-bold">🤖 Auto</button>` : ''}
                    </td>
                `;
            }

            html += `<td class="p-2 text-center font-black text-yellow-400">${noteFinale.sur100 !== null ? noteFinale.sur100 : '--'}</td>`;
            html += `<td class="p-2 text-center font-black text-emerald-400">${noteFinale.sur20 !== null ? noteFinale.sur20 : '--'}</td>`;
            html += `</tr>`;
        }

        html += `</tbody></table></div>`;
    }

    html += `</div>`;
    container.innerHTML = html;

    if (currentGrille.activite === 'relais') {
        chargerDonneesAutoRelais(eleves);
    }
}

async function chargerDonneesAutoRelais(eleves) {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const configRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/relais/config`);

    onValue(configRef, async (snap) => {
        const config = snap.val();
        if (!config) return;

        window._grillesAutoData = window._grillesAutoData || {};
        for (const e of eleves) {
            const niveaux = await calculerNiveauxRelais(currentClasse, e.id, config);
            if (Object.keys(niveaux).length > 0) {
                window._grillesAutoData[e.id] = niveaux;
            }
        }
        console.log('[Grilles] Données auto chargées pour', Object.keys(window._grillesAutoData || {}).length, 'élèves');
    }, { onlyOnce: true });
}

// ============================================================
// ACTIONS
// ============================================================
window.grillesImporterXLSX = function() {
    document.getElementById('grillesInputFile').click();
};

window.grillesTraiterImport = async function(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const grille = await importerGrilleXLSX(file);
        const existante = getGrille(grille.id);
        if (existante) {
            if (!confirm(`Une grille "${grille.titre}" existe déjà. La remplacer ?`)) {
                event.target.value = '';
                return;
            }
        }
        sauvegarderGrille(grille);
        alert(`✅ Grille importée : ${grille.criteres.length} critères détectés.`);
        initGrillesInterface();
    } catch (err) {
        console.error(err);
        alert('❌ Erreur d\'import : ' + err.message);
    }
    event.target.value = '';
};

window.grillesUtiliser = function(id) {
    currentGrille = getGrille(id);
    if (!currentGrille) return;
    currentPeriode = currentGrille.periodes[0] || 'Début';
    const container = document.getElementById('viewEvaluations');
    renderPassation(container);
};

window.grillesRetourBibliotheque = function() {
    currentGrille = null;
    _vueCompacte = false;
    const container = document.getElementById('viewEvaluations');
    renderBibliotheque(container);
};

window.grillesSetPeriode = function(periode) {
    currentPeriode = periode;
    const container = document.getElementById('viewEvaluations');
    renderPassation(container);
};

window.grillesSetNote = function(eleveId, critereId, valeur) {
    const evals = getEvaluationsClasse(currentClasse);
    if (!evals[currentGrille.id]) evals[currentGrille.id] = {};
    if (!evals[currentGrille.id][currentPeriode]) evals[currentGrille.id][currentPeriode] = {};
    if (!evals[currentGrille.id][currentPeriode][eleveId]) {
        evals[currentGrille.id][currentPeriode][eleveId] = { notes: {} };
    }
    evals[currentGrille.id][currentPeriode][eleveId].notes[critereId] = valeur;
    evals[currentGrille.id][currentPeriode][eleveId].timestamp = Date.now();

    const critere = currentGrille.criteres.find(c => c.id === critereId);
    if (critere && critere.nom.toLowerCase().includes('élève')) {
        setDernierNiveauEleve(currentClasse, eleveId, valeur, currentGrille.activite);
    }

    sauvegarderEvaluation(currentClasse, currentGrille.id, currentPeriode, eleveId, evals[currentGrille.id][currentPeriode][eleveId].notes);
    const container = document.getElementById('viewEvaluations');
    renderPassation(container);
};

// Cycle 4 → 3 → 2 → 1 → 4 (vue compacte)
window.grillesCycleNote = function(eleveId, critereId) {
    const evals = getEvaluationsClasse(currentClasse);
    const actuel = evals[currentGrille.id]?.[currentPeriode]?.[eleveId]?.notes?.[critereId];
    let suivant;
    if (actuel === undefined || actuel === null) suivant = 4;
    else if (actuel === 1) suivant = 4;
    else suivant = actuel - 1;
    window.grillesSetNote(eleveId, critereId, suivant);
};

window.grillesRemplirAuto = function(eleveId, critereId) {
    const data = window._grillesAutoData?.[eleveId];
    if (!data) {
        alert('Aucune donnée automatique pour cet élève.\n\nVérifie que :\n- Le module Relais est configuré\n- Il y a au moins 1 essai 10s et 1 essai 2 zones pour cet élève');
        return;
    }

    const critere = currentGrille.criteres.find(c => c.id === critereId);
    if (!critere) return;

    const nomLower = (critere.nom || '').toLowerCase();
    let valeur = null;
    let source = '';

    if (nomLower.includes('performance') && (nomLower.includes('donneur') || nomLower.includes('relayé'))) {
        valeur = data['performance_donneur'];
        source = 'performance 10s';
    } else if (nomLower.includes('transmission') || nomLower.includes('qualité')) {
        valeur = data['qualite_de_transmission'];
        source = 'transmission 2 zones';
    } else if (nomLower.includes('projet')) {
        valeur = data['projet'];
        source = 'projet arcathlon';
    } else if (nomLower.includes('allure')) {
        valeur = data['allure'];
        source = 'allure';
    } else if (nomLower.includes('grimpeur')) {
        valeur = data['grimpeur'] || data['grimpeur_bloc'] || data['grimpeur_voies'];
        source = 'escalade';
    }

    if (valeur === undefined || valeur === null) {
        alert(`Pas de donnée auto pour ce critère.\n\nNom : "${critere.nom}"\nClés dispo : ${Object.keys(data).join(', ')}`);
        return;
    }

    console.log(`[Grilles] 🤖 Auto : ${critere.nom} → niveau ${valeur} (${source})`);
    window.grillesSetNote(eleveId, critereId, valeur);
};

// ============================================================
// TOUT REMPLIR EN AUTO
// ============================================================
window.grillesRemplirAutoGlobal = async function() {
    if (!currentGrille) return;
    if (!window._grillesAutoData || Object.keys(window._grillesAutoData).length === 0) {
        alert('Aucune donnée auto disponible.\n\nVérifie que :\n- Le module Relais a des mesures\n- Clique sur 🧪 Test pour générer des données bidons');
        return;
    }

    const eleves = getExistingEleves(currentClasse);
    const evals = getEvaluationsClasse(currentClasse);
    if (!evals[currentGrille.id]) evals[currentGrille.id] = {};
    if (!evals[currentGrille.id][currentPeriode]) evals[currentGrille.id][currentPeriode] = {};

    let nbRemplis = 0;
    let nbCriteresAuto = 0;

    for (const eleve of eleves) {
        const data = window._grillesAutoData[eleve.id];
        if (!data) continue;

        const notesEleve = evals[currentGrille.id][currentPeriode][eleve.id]?.notes || {};

        for (const critere of currentGrille.criteres) {
            if (critere.type !== 'auto') continue;
            nbCriteresAuto++;

            const nomLower = (critere.nom || '').toLowerCase();
            let valeur = null;

            if (nomLower.includes('performance') && (nomLower.includes('donneur') || nomLower.includes('relayé'))) {
                valeur = data['performance_donneur'];
            } else if (nomLower.includes('transmission') || nomLower.includes('qualité')) {
                valeur = data['qualite_de_transmission'];
            } else if (nomLower.includes('projet')) {
                valeur = data['projet'];
            } else if (nomLower.includes('allure')) {
                valeur = data['allure'];
            } else if (nomLower.includes('grimpeur')) {
                valeur = data['grimpeur'] || data['grimpeur_bloc'] || data['grimpeur_voies'];
            }

            if (valeur !== undefined && valeur !== null) {
                notesEleve[critere.id] = valeur;
                nbRemplis++;
            }
        }

        evals[currentGrille.id][currentPeriode][eleve.id] = {
            notes: notesEleve,
            timestamp: Date.now()
        };
    }

    // Sauvegarder
    const all = JSON.parse(localStorage.getItem('eps_arena_grilles_evaluations') || '{}');
    if (!all[currentClasse]) all[currentClasse] = {};
    if (!all[currentClasse][currentGrille.id]) all[currentClasse][currentGrille.id] = {};
    all[currentClasse][currentGrille.id][currentPeriode] = evals[currentGrille.id][currentPeriode];
    localStorage.setItem('eps_arena_grilles_evaluations', JSON.stringify(all));

    alert(`🤖 ${nbRemplis} case(s) remplie(s) automatiquement sur ${nbCriteresAuto} possible(s).`);
    renderPassation(document.getElementById('viewEvaluations'));
};

// ============================================================
// VUE COMPACTE
// ============================================================
window.grillesToggleVueCompacte = function() {
    _vueCompacte = !_vueCompacte;
    const label = document.getElementById('grilles-vue-label');
    if (label) label.textContent = _vueCompacte ? '📊 Vue détaillée' : '👁️ Vue compacte';
    renderPassation(document.getElementById('viewEvaluations'));
};

// ============================================================
// SAUVEGARDE / FIGER / EXPORT
// ============================================================
window.grillesSauvegarder = function() {
    alert('✅ Notes sauvegardées automatiquement.');
};

window.grillesFiger = function() {
    if (!currentGrille) return;
    if (!confirm('⚠️ Figer la grille ? Une fois figée, elle ne pourra plus être modifiée.')) return;
    figerGrille(currentGrille.id);
    currentGrille = getGrille(currentGrille.id);
    alert('✅ Grille figée.');
    const container = document.getElementById('viewEvaluations');
    renderPassation(container);
};

window.grillesExporterNotes = function() {
    if (!currentGrille) return;
    const evals = getEvaluationsClasse(currentClasse);
    exporterNotesIDoceo(currentGrille, evals[currentGrille.id] || {}, currentClasse, currentPeriode);
};

window.grillesExporterRubrique = function() {
    if (!currentGrille) return;
    const evals = getEvaluationsClasse(currentClasse);
    exporterRubriqueIDoceo(currentGrille, evals[currentGrille.id] || {}, currentClasse, currentPeriode);
};

window.grillesExporterVierge = function(id) {
    const grille = getGrille(id);
    if (grille) exporterGrilleVierge(grille);
};

window.grillesSupprimer = function(id) {
    if (!confirm('Supprimer cette grille de la bibliothèque ?')) return;
    supprimerGrille(id);
    initGrillesInterface();
};

// ============================================================
// ACTIVATION IPADS
// ============================================================
window.grillesActiver = async function() {
    if (!currentGrille) return;
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const { db, ref, set } = await import('../../core/firebase-service.js');
    const path = `etablissements/0680013V/profs/${profCode}/${currentClasse}/grilles/config`;

    try {
        await set(ref(db, path), {
            actif: true,
            grilleId: currentGrille.id,
            periode: currentPeriode,
            timestamp: Date.now()
        });
        await set(ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/config`), {
            activite: 'grilles'
        });
        alert(`✅ Auto-évaluation activée pour les iPads.\nGrille : ${currentGrille.titre}\nPériode : ${currentPeriode}`);
    } catch (err) {
        console.error(err);
        alert('❌ Erreur lors de l\'activation.');
    }
};

window.grillesDesactiver = async function() {
    if (!currentClasse) return;
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const { db, ref, set } = await import('../../core/firebase-service.js');
    const path = `etablissements/0680013V/profs/${profCode}/${currentClasse}/grilles/config`;

    try {
        await set(ref(db, path), { actif: false });
        alert('✅ Auto-évaluation désactivée.');
    } catch (err) {
        console.error(err);
        alert('❌ Erreur.');
    }
};

// ============================================================
// GÉNÉRATION DONNÉES TEST
// ============================================================
window.grillesGenererDonneesTest = async function() {
    if (!currentClasse) {
        alert('Sélectionne une classe.');
        return;
    }

    const eleves = getExistingEleves(currentClasse);
    if (eleves.length === 0) {
        alert('Aucun élève dans cette classe.');
        return;
    }

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const { db, ref, set, push, onValue } = await import('../../core/firebase-service.js');

    const mesures10sPath = `etablissements/0680013V/profs/${profCode}/${currentClasse}/relais/mesures-10s`;
    const mesures2zPath = `etablissements/0680013V/profs/${profCode}/${currentClasse}/relais/mesures-2zones`;
    const configPath = `etablissements/0680013V/profs/${profCode}/${currentClasse}/relais/config`;

    const configSnap = await new Promise(resolve => {
        onValue(ref(db, configPath), resolve, { onlyOnce: true });
    });

    const config = configSnap.val();
    if (!config || !config.groupes) {
        alert('⚠️ Aucune configuration Relais trouvée.\nTransmets d\'abord une config Relais (onglet Activités → Relais).');
        return;
    }

    if (!confirm(`Générer 3 essais 10s + 3 essais 2 zones par élève ?\n\nClasse : ${currentClasse}\n${eleves.length} élèves\n${Object.keys(config.groupes).length} groupes`)) {
        return;
    }

    let nb10s = 0, nb2z = 0;

    for (const [groupeIdx, groupe] of Object.entries(config.groupes)) {
        for (const membre of groupe.membres) {
            const lettre = membre.lettre;

            // 3 essais 10s
            for (let i = 0; i < 3; i++) {
                const vTheo = 20 + Math.random() * 5;
                const ecart = (Math.random() - 0.5) * 4;
                const vReelle = Math.round((vTheo + ecart) * 10) / 10;
                const score = Math.round((5 + ecart) * 10) / 10;
                const zoneAtteinte = Math.round(vReelle - 14);

                await push(ref(db, mesures10sPath), {
                    sousActivite: 'relais10s',
                    groupeIdx: parseInt(groupeIdx),
                    groupeNumero: groupe.numero,
                    pairId: `${lettre}-${lettre}`,
                    relayeLettre: lettre,
                    relayeurLettre: lettre,
                    zoneAtteinte,
                    vReelle,
                    vTheorique: Math.round(vTheo * 10) / 10,
                    score,
                    ecart: Math.round(ecart * 10) / 10,
                    timestamp: Date.now() - (3 - i) * 60000
                });
                nb10s++;
            }

            // 3 essais 2 zones
            for (let i = 0; i < 3; i++) {
                const vZ1 = 18 + Math.random() * 6;
                const vZ2 = 18 + Math.random() * 6;
                const moyenne = (vZ1 + vZ2) / 2;
                const pct = 60 + Math.random() * 45;
                const vTrans = moyenne * pct / 100;

                let points = 0;
                if (pct >= 100) points = 5;
                else if (pct >= 90) points = 4;
                else if (pct >= 80) points = 3;
                else if (pct >= 70) points = 2;
                else if (pct >= 60) points = 1;

                await push(ref(db, mesures2zPath), {
                    sousActivite: 'relais2zones',
                    groupeIdx: parseInt(groupeIdx),
                    groupeNumero: groupe.numero,
                    pairId: `${lettre}-${lettre}`,
                    relayeLettre: lettre,
                    relayeurLettre: lettre,
                    distances: { z1: 20, trans: 10, z2: 20 },
                    temps: {
                        z1: Math.round(20000 / vZ1 * 3.6),
                        trans: Math.round(10000 / vTrans * 3.6),
                        z2: Math.round(20000 / vZ2 * 3.6)
                    },
                    vitesses: {
                        z1: Math.round(vZ1 * 10) / 10,
                        trans: Math.round(vTrans * 10) / 10,
                        z2: Math.round(vZ2 * 10) / 10
                    },
                    vMoyenne3z: Math.round(moyenne * 10) / 10,
                    vTheorique: Math.round(moyenne * 10) / 10,
                    pourcentageTransmission: Math.round(pct),
                    score: points,
                    timestamp: Date.now() - (3 - i) * 60000
                });
                nb2z++;
            }
        }
    }

    alert(`✅ Données test générées !\n${nb10s} essais 10s\n${nb2z} essais 2 zones\n\nLes boutons 🤖 Auto devraient maintenant fonctionner.`);
};

// ============================================================
// AUTO-ÉVALUATIONS REÇUES
// ============================================================
window.grillesVoirAutoEvals = function() {
    if (!currentClasse) {
        alert('Sélectionne une classe.');
        return;
    }

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const path = `etablissements/0680013V/profs/${profCode}/${currentClasse}/grilles/auto_evaluations`;

    const overlay = document.createElement('div');
    overlay.id = 'auto-evals-modal';
    overlay.className = 'fixed inset-0 bg-black/95 z-50 flex items-start justify-center p-4 overflow-y-auto';
    overlay.innerHTML = `
        <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-5xl my-8">
            <div class="flex justify-between items-center mb-4 border-b border-slate-700 pb-4">
                <div>
                    <h2 class="text-2xl font-black text-cyan-400 uppercase">👁️ Auto-évaluations reçues</h2>
                    <p class="text-xs text-slate-400">Classe ${currentClasse}</p>
                    <p class="text-[10px] text-amber-400 mt-1">🔒 Données anonymes — codes élèves</p>
                </div>
                <button onclick="document.getElementById('auto-evals-modal').remove()"
                        class="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-xl font-black text-sm text-white">
                    ✖ Fermer
                </button>
            </div>

            <div class="mb-3 flex gap-2 flex-wrap">
                <button onclick="window.grillesFiltrerAutoEvals('toutes')" id="filtrer-toutes" class="bg-blue-600 px-3 py-1.5 rounded-xl font-black text-xs text-white">Toutes</button>
                <button onclick="window.grillesFiltrerAutoEvals('Début')" id="filtrer-Début" class="bg-slate-700 px-3 py-1.5 rounded-xl font-black text-xs text-white">Début</button>
                <button onclick="window.grillesFiltrerAutoEvals('Milieu')" id="filtrer-Milieu" class="bg-slate-700 px-3 py-1.5 rounded-xl font-black text-xs text-white">Milieu</button>
                <button onclick="window.grillesFiltrerAutoEvals('Fin')" id="filtrer-Fin" class="bg-slate-700 px-3 py-1.5 rounded-xl font-black text-xs text-white">Fin</button>
            </div>

            <div id="auto-evals-content" class="space-y-3">
                <p class="text-slate-400 text-center py-8">⏳ Chargement...</p>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    import('../../core/firebase-service.js').then(({ db, ref, onValue }) => {
        onValue(ref(db, path), (snap) => {
            const data = snap.val() || {};
            window._grillesAutoEvalsData = data;
            window.grillesFiltrerAutoEvals('toutes');
        });
    });
};

window.grillesFiltrerAutoEvals = function(periode) {
    const data = window._grillesAutoEvalsData || {};
    const container = document.getElementById('auto-evals-content');
    if (!container) return;

    ['toutes', 'Début', 'Milieu', 'Fin'].forEach(p => {
        const btn = document.getElementById(`filtrer-${p}`);
        if (btn) {
            btn.className = p === periode
                ? 'bg-blue-600 px-3 py-1.5 rounded-xl font-black text-xs text-white'
                : 'bg-slate-700 px-3 py-1.5 rounded-xl font-black text-xs text-white';
        }
    });

    const all = Object.entries(data).map(([key, val]) => ({ _key: key, ...val }));
    const filtered = periode === 'toutes' ? all : all.filter(e => e.periode === periode);

    if (filtered.length === 0) {
        container.innerHTML = `<p class="text-slate-500 text-center py-8">Aucune auto-évaluation ${periode === 'toutes' ? '' : 'pour la période ' + periode}.</p>`;
        return;
    }

    const groupes = {};
    filtered.forEach(e => {
        const key = `${e.grilleId}__${e.periode}`;
        if (!groupes[key]) groupes[key] = { grilleId: e.grilleId, periode: e.periode, items: [] };
        groupes[key].items.push(e);
    });

    const eleves = getExistingEleves(currentClasse);
    const codeToNom = {};
    eleves.forEach(e => { codeToNom[String(e.codeAutoEval)] = `${e.prenom} ${e.nom}`; });

    Object.values(groupes).forEach(g => g.items.sort((a, b) => b.timestamp - a.timestamp));

    let html = '';
    Object.values(groupes).forEach(g => {
        const grille = getGrille(g.grilleId);
        const titreGrille = grille ? grille.titre : g.grilleId;

        html += `
            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <div class="flex justify-between items-center mb-3">
                    <h3 class="font-black text-white">${titreGrille}</h3>
                    <span class="text-xs bg-blue-600 px-2 py-0.5 rounded-full text-white font-bold">${g.periode}</span>
                </div>
                <p class="text-xs text-slate-400 mb-3">${g.items.length} réponse(s)</p>
                <div class="space-y-2 max-h-96 overflow-y-auto">
        `;

        g.items.forEach(item => {
            const nom = codeToNom[String(item.code)] || '?';
            const date = new Date(item.timestamp).toLocaleString('fr-FR', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
            });

            let noteHtml = '';
            if (grille) {
                const note = calculerNoteFinale(item.notes, grille.criteres);
                noteHtml = `<span class="text-yellow-400 font-black">${note.sur100 !== null ? note.sur100 + '/100' : '--'}</span>
                            <span class="text-emerald-400 font-black ml-2">${note.sur20 !== null ? note.sur20 + '/20' : '--'}</span>`;
            }

            const notesDetail = grille ? grille.criteres.map(c => {
                const val = item.notes[c.id];
                if (val === undefined) return '';
                return `<span class="text-[10px] bg-slate-900 px-2 py-0.5 rounded">${c.nom.split('(')[0].substring(0, 15)}: <span class="text-white font-black">${val}</span></span>`;
            }).join('') : '';

            html += `
                <div class="bg-slate-900 p-3 rounded-xl border border-slate-700">
                    <div class="flex justify-between items-center mb-2 flex-wrap gap-2">
                        <div class="flex items-center gap-2">
                            <span class="bg-cyan-600 text-white font-black text-lg w-10 h-10 rounded-full flex items-center justify-center">${item.code}</span>
                            <span class="text-sm font-bold text-white">${nom}</span>
                        </div>
                        <div class="text-right">${noteHtml}</div>
                    </div>
                    <div class="flex flex-wrap gap-1 mb-1">${notesDetail}</div>
                    <div class="text-[10px] text-slate-500 mt-1">${date}</div>
                </div>
            `;
        });

        html += `</div></div>`;
    });

    container.innerHTML = html;
};

// ============================================================
// CLEANUP
// ============================================================
export function cleanupGrillesInterface() {
    currentGrille = null;
    currentClasse = '';
    currentEvaluations = {};
    _vueCompacte = false;
}