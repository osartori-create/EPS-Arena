// src/js/modules/grilles/grilles-interface.js
// UI Prof : bibliothèque + passation + export + auto-évaluations reçues

import {
    getToutesGrilles, getGrille, sauvegarderGrille, supprimerGrille, figerGrille,
    calculerNoteFinale, getEvaluationsClasse, sauvegarderEvaluation,
    setDernierNiveauEleve, getDernierNiveauEleve, NIVEAUX, getCouleurNiveau
} from './grilles-core.js';
import { importerGrilleXLSX } from './grilles-import.js';
import { exporterNotesIDoceo, exporterRubriqueIDoceo, exporterGrilleVierge } from './grilles-export.js';
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
                        <div class="flex gap-2 flex-wrap">
                            <button onclick="window.grillesUtiliser('${g.id}')"
                                    class="flex-1 bg-blue-600 hover:bg-blue-500 py-2 rounded-xl font-black text-xs text-white active:scale-95">
                                ✏️ Évaluer
                            </button>
                            <button onclick="window.grillesVoirContenu('${g.id}')"
                                    class="bg-cyan-700 hover:bg-cyan-600 px-3 py-2 rounded-xl font-black text-xs text-white active:scale-95"
                                    title="Voir le contenu de la grille">👁️</button>
                            <button onclick="window.grillesRenommer('${g.id}')"
                                    class="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-xl font-black text-xs text-white active:scale-95"
                                    title="Renommer la grille">✏️</button>
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
                    <span id="grilles-vue-label">${_vueCompacte ? '📊 Vue détaillée' : '👁️ Vue compacte'}</span>
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

    // ✅ Charger les données auto (connecteur générique)
    chargerDonneesAutoGenerique(eleves);
}

// ============================================================
// CHARGEMENT DES DONNÉES AUTO (générique)
// ============================================================
async function chargerDonneesAutoGenerique(eleves) {
    if (!currentGrille) return;

    const activite = currentGrille.activite;
    const niveauGrille = currentGrille.niveau;

    // Liste des activités avec connecteur
    const ACTIVITES_AVEC_CONNECTEUR = ['relais', 'arcathlon', 'escalade'];

    // ✅ Si pas de connecteur, désactiver le bouton et vider les données
    window._grillesAutoData = {};
    const btnGlobal = document.querySelector('[onclick*="grillesRemplirAutoGlobal"]');
    if (!ACTIVITES_AVEC_CONNECTEUR.includes(activite)) {
        if (btnGlobal) {
            btnGlobal.disabled = true;
            btnGlobal.className = btnGlobal.className.replace('bg-pink-600', 'bg-slate-600').replace('hover:bg-pink-500', 'cursor-not-allowed');
            btnGlobal.textContent = `🤖 Auto indisponible (${activite})`;
            btnGlobal.title = `Le remplissage auto n'est pas disponible pour "${activite}". Toutes les évaluations sont en saisie prof.`;
        }
        console.log(`[Grilles] Pas de connecteur pour "${activite}" — mode prof uniquement`);
        return;
    } else {
        if (btnGlobal) {
            btnGlobal.disabled = false;
            btnGlobal.className = btnGlobal.className.replace('bg-slate-600', 'bg-pink-600').replace('cursor-not-allowed', 'hover:bg-pink-500');
            btnGlobal.textContent = '🤖 Tout remplir auto';
            btnGlobal.title = '';
        }
    }

    // Charger le bon connecteur
    let connecteur = null;
    try {
        if (activite === 'relais') {
            connecteur = (await import('./connecteurs/relais.js')).calculerNiveauxRelais;
        } else if (activite === 'arcathlon') {
            connecteur = (await import('./connecteurs/arcathlon.js')).calculerNiveauxArcathlon;
        } else if (activite === 'escalade') {
            connecteur = (await import('./connecteurs/escalade.js')).calculerNiveauxEscalade;
        }
    } catch (err) {
        console.warn(`[Grilles] Connecteur "${activite}" non disponible :`, err);
        return;
    }

        if (!connecteur) return;

    // ✅ Récupérer la config Firebase (chemin différent selon l'activité)
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';

    // L'escalade stocke sa config directement à la racine {classe}/config
    // (voir escalade-prof.js), contrairement à Relais/Arcathlon qui ont un sous-dossier dédié.
    let configPath;
    if (activite === 'escalade') {
        configPath = `etablissements/0680013V/profs/${profCode}/${currentClasse}/config`;
    } else {
        configPath = `etablissements/0680013V/profs/${profCode}/${currentClasse}/${activite}/config`;
    }

    const configSnap = await new Promise((resolve) => {
        onValue(ref(db, configPath), resolve, { onlyOnce: true });
    });
    const config = configSnap.val();

    // Pour l'escalade, la config n'est pas indispensable (le connecteur utilise le mapping local)
    if (!config && activite !== 'escalade') {
        console.log(`[Grilles] Config ${activite} non transmise`);
        return;
    }

    window._grillesAutoData = window._grillesAutoData || {};
    let nbLoad = 0;

    for (const e of eleves) {
        try {
            const niveaux = await connecteur(currentClasse, e.id, config, { niveau: niveauGrille });
            if (Object.keys(niveaux).length > 0) {
                window._grillesAutoData[e.id] = niveaux;
                nbLoad++;
            }
        } catch (err) {
            console.error(`[Grilles] Erreur connecteur pour ${e.id}:`, err);
        }
    }

    console.log(`[Grilles] Données auto chargées pour ${nbLoad}/${eleves.length} élèves (${activite})`);
}

// ============================================================
// MATCHING CRITÈRE → DONNÉE AUTO
// ============================================================
function matcherCritere(critere, data) {
    if (!data) return undefined;
    const nomLower = (critere.nom || '').toLowerCase();

    // Projet (Arcathlon)
    if (nomLower.includes('projet')) {
        return data['projet'] ?? data['coureur_projet'] ?? data['coureur_son_projet'];
    }

    // Performance / Tir (Arcathlon)
    if (nomLower.includes('performance') && nomLower.includes('tir')) {
        return data['performance_tir'] ?? data['tir'];
    }

    // Performance Donneur (Relais)
    if (nomLower.includes('performance') && (nomLower.includes('donneur') || nomLower.includes('relayé'))) {
        return data['performance_donneur'];
    }

    // Transmission (Relais)
    if (nomLower.includes('transmission') || nomLower.includes('qualité')) {
        return data['qualite_de_transmission'] ?? data['transmission'];
    }

    // Grimpeur bloc (Escalade C4)
    if (nomLower.includes('grimpeur') && nomLower.includes('bloc')) {
        return data['grimpeur_bloc'];
    }

    // Grimpeur voies (Escalade C4)
    if (nomLower.includes('grimpeur') && (nomLower.includes('voie') || nomLower.includes('2 voies'))) {
        return data['grimpeur_voies'] ?? data['grimpeur_c4'];
    }

    // Grimpeur (Escalade C3 ou générique)
    if (nomLower.includes('grimpeur')) {
        return data['grimpeur'] ?? data['grimpeur_c3'];
    }

    // Allure (Demi-fond)
    if (nomLower.includes('allure')) {
        return data['allure'];
    }

    // Badiste (Badminton)
    if (nomLower.includes('badiste')) {
        return data['badiste'];
    }

    return undefined;
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

    const notesActuelles = evals[currentGrille.id][currentPeriode][eleveId].notes;
    const valeurActuelle = notesActuelles[critereId];

    // ✅ Si on clique sur le même niveau déjà sélectionné → on désélectionne
    if (valeurActuelle === valeur) {
        delete notesActuelles[critereId];
        console.log(`[Grilles] Désélection : ${critereId} de ${eleveId}`);
    } else {
        notesActuelles[critereId] = valeur;
    }

    evals[currentGrille.id][currentPeriode][eleveId].timestamp = Date.now();

    const critere = currentGrille.criteres.find(c => c.id === critereId);
    if (critere && critere.nom.toLowerCase().includes('élève') && valeurActuelle !== valeur) {
        setDernierNiveauEleve(currentClasse, eleveId, valeur, currentGrille.activite);
    }

    sauvegarderEvaluation(currentClasse, currentGrille.id, currentPeriode, eleveId, notesActuelles);
    const container = document.getElementById('viewEvaluations');
    renderPassation(container);
};

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
        alert('Aucune donnée automatique pour cet élève.\n\nVérifie que :\n- Le module de l\'activité est configuré\n- Il y a au moins 1 mesure enregistrée');
        return;
    }

    const critere = currentGrille.criteres.find(c => c.id === critereId);
    if (!critere) return;

    const valeur = matcherCritere(critere, data);

    if (valeur === undefined || valeur === null) {
        alert(`Pas de donnée auto pour ce critère.\n\nNom : "${critere.nom}"\nClés dispo : ${Object.keys(data).join(', ')}`);
        return;
    }

    console.log(`[Grilles] 🤖 Auto : ${critere.nom} → niveau ${valeur}`);
    window.grillesSetNote(eleveId, critereId, valeur);
};

window.grillesRemplirAutoGlobal = async function() {
    if (!currentGrille) return;
    if (!window._grillesAutoData || Object.keys(window._grillesAutoData).length === 0) {
        alert('Aucune donnée auto disponible.\n\nVérifie que :\n- Le module de l\'activité a des mesures\n- Clique sur 🧪 Test pour générer des données bidons');
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

            const valeur = matcherCritere(critere, data);
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

    const all = JSON.parse(localStorage.getItem('eps_arena_grilles_evaluations') || '{}');
    if (!all[currentClasse]) all[currentClasse] = {};
    if (!all[currentClasse][currentGrille.id]) all[currentClasse][currentGrille.id] = {};
    all[currentClasse][currentGrille.id][currentPeriode] = evals[currentGrille.id][currentPeriode];
    localStorage.setItem('eps_arena_grilles_evaluations', JSON.stringify(all));

    alert(`🤖 ${nbRemplis} case(s) remplie(s) automatiquement sur ${nbCriteresAuto} possible(s).`);
    renderPassation(document.getElementById('viewEvaluations'));
};

window.grillesToggleVueCompacte = function() {
    _vueCompacte = !_vueCompacte;
    const label = document.getElementById('grilles-vue-label');
    if (label) label.textContent = _vueCompacte ? '📊 Vue détaillée' : '👁️ Vue compacte';
    renderPassation(document.getElementById('viewEvaluations'));
};

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
// VOIR LE CONTENU D'UNE GRILLE
// ============================================================
window.grillesVoirContenu = function(id) {
    const grille = getGrille(id);
    if (!grille) return;

    const niveauxOrdre = [...NIVEAUX].sort((a, b) => b.valeur - a.valeur);

    const modal = document.createElement('div');
    modal.id = 'grille-content-modal';
    modal.className = 'fixed inset-0 bg-black/95 z-50 flex items-start justify-center p-4 overflow-y-auto';

    let tableHtml = `
        <table class="w-full text-xs" style="table-layout: fixed; border-collapse: collapse;">
            <thead>
                <tr>
                    <th class="p-2 text-left bg-slate-800 text-slate-400 uppercase text-[10px] sticky left-0" style="width: 180px;">Critère</th>
                    ${niveauxOrdre.map(n => `
                        <th class="p-2 text-center text-white font-black"
                            style="background-color: ${n.couleur}; width: 20%;">
                            ${n.label}
                            <span class="block text-lg">${n.valeur}</span>
                        </th>
                    `).join('')}
                </tr>
            </thead>
            <tbody>
    `;

    grille.criteres.forEach(c => {
        tableHtml += `<tr class="border-t border-slate-700">`;
        tableHtml += `
            <td class="p-2 bg-slate-800 align-top sticky left-0" style="width: 180px;">
                <div class="font-black text-white text-[11px] leading-tight">${c.nom}</div>
                ${c.ponderation > 0 ? `<div class="text-[10px] text-yellow-400 mt-1 font-bold">${c.ponderation}%</div>` : `<div class="text-[10px] text-slate-500 mt-1">équipondéré</div>`}
                ${c.type === 'auto' ? `<div class="text-[10px] text-emerald-400 mt-1 font-bold">🤖 AUTO</div>` : ''}
            </td>
        `;
        niveauxOrdre.forEach(n => {
            const desc = (c.niveaux || []).find(x => x.valeur === n.valeur);
            tableHtml += `
                <td class="p-2 align-top border-l border-slate-700" style="background-color: ${n.couleur}15;">
                    <div class="text-slate-200 text-[11px] leading-snug">${desc?.descripteur || '--'}</div>
                </td>
            `;
        });
        tableHtml += `</tr>`;
    });

    tableHtml += `</tbody></table>`;

    modal.innerHTML = `
        <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-6xl my-8">
            <div class="flex justify-between items-center mb-4 border-b border-slate-700 pb-4 flex-wrap gap-2">
                <div>
                    <h2 class="text-2xl font-black text-cyan-400 uppercase">👁️ ${grille.titre || grille.id}</h2>
                    <p class="text-xs text-slate-400">
                        Activité : <span class="text-blue-400 font-bold">${grille.activite}</span> · 
                        Niveau : <span class="text-blue-400 font-bold">${grille.niveau}</span> · 
                        ${grille.criteres.length} critères
                    </p>
                </div>
                <div class="flex gap-2">
                    <button onclick="window.grillesRenommer('${grille.id}'); document.getElementById('grille-content-modal').remove();"
                            class="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-xl font-black text-sm text-white">
                        ✏️ Renommer
                    </button>
                    <button onclick="document.getElementById('grille-content-modal').remove()"
                            class="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-xl font-black text-sm text-white">
                        ✖ Fermer
                    </button>
                </div>
            </div>
            <div class="overflow-x-auto">
                ${tableHtml}
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
};

// ============================================================
// RENOMMER UNE GRILLE
// ============================================================
window.grillesRenommer = function(id) {
    const grille = getGrille(id);
    if (!grille) return;

    const nouveauTitre = prompt(
        `Nouveau titre pour cette grille :\n\n(Actuel : "${grille.titre}")`,
        grille.titre || ''
    );
    if (nouveauTitre === null) return;
    if (!nouveauTitre.trim()) {
        alert('Le titre ne peut pas être vide.');
        return;
    }

    grille.titre = nouveauTitre.trim();
    sauvegarderGrille(grille);

    if (currentGrille && currentGrille.id === id) {
        currentGrille = getGrille(id);
        renderPassation(document.getElementById('viewEvaluations'));
    } else {
        renderBibliotheque(document.getElementById('viewEvaluations'));
    }
    console.log(`[Grilles] Renommée : "${nouveauTitre}"`);
};

// ============================================================
// ACTIVATION IPADS
// ============================================================
window.grillesActiver = async function() {
    if (!currentGrille) return;
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const path = `etablissements/0680013V/profs/${profCode}/${currentClasse}/grilles/config`;

    try {
        const { set } = await import('../../core/firebase-service.js');
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
    const path = `etablissements/0680013V/profs/${profCode}/${currentClasse}/grilles/config`;

    try {
        const { set } = await import('../../core/firebase-service.js');
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
    if (!currentGrille) {
        alert('Sélectionne d\'abord une grille.');
        return;
    }

    const eleves = getExistingEleves(currentClasse);
    if (eleves.length === 0) {
        alert('Aucun élève dans cette classe.');
        return;
    }

    const activite = currentGrille.activite;

    if (!confirm(`Générer des données de test pour "${activite}" ?\n\nClasse : ${currentClasse}\n${eleves.length} élèves`)) {
        return;
    }

    // Dispatch selon l'activité
    if (activite === 'relais') {
        await genererDonneesTestRelais(eleves);
    } else if (activite === 'arcathlon') {
        await genererDonneesTestArcathlon(eleves);
    } else if (activite === 'escalade') {
        await genererDonneesTestEscalade(eleves);
    } else if (activite === 'badminton') {
        await genererDonneesTestBadminton(eleves);
    } else {
        alert(`⚠️ Aucun générateur de test pour l'activité "${activite}".`);
    }
};

// ============================================================
// GÉNÉRATEURS SPÉCIFIQUES
// ============================================================
async function genererDonneesTestRelais(eleves) {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const { push } = await import('../../core/firebase-service.js');

    const configPath = `etablissements/0680013V/profs/${profCode}/${currentClasse}/relais/config`;
    const configSnap = await new Promise(resolve => {
        onValue(ref(db, configPath), resolve, { onlyOnce: true });
    });
    const config = configSnap.val();
    if (!config || !config.groupes) {
        alert('⚠️ Aucune configuration Relais trouvée.\nTransmets d\'abord une config Relais.');
        return;
    }

    const mesures10sPath = `etablissements/0680013V/profs/${profCode}/${currentClasse}/relais/mesures-10s`;
    const mesures2zPath = `etablissements/0680013V/profs/${profCode}/${currentClasse}/relais/mesures-2zones`;

    let nb10s = 0, nb2z = 0;

    for (const [groupeIdx, groupe] of Object.entries(config.groupes)) {
        for (const membre of groupe.membres) {
            const lettre = membre.lettre;

            for (let i = 0; i < 3; i++) {
                const vTheo = 20 + Math.random() * 5;
                const ecart = (Math.random() - 0.5) * 4;
                const vReelle = Math.round((vTheo + ecart) * 10) / 10;
                const score = Math.round((5 + ecart) * 10) / 10;

                await push(ref(db, mesures10sPath), {
                    sousActivite: 'relais10s',
                    groupeIdx: parseInt(groupeIdx),
                    groupeNumero: groupe.numero,
                    pairId: `${lettre}-${lettre}`,
                    relayeLettre: lettre,
                    relayeurLettre: lettre,
                    zoneAtteinte: Math.round(vReelle - 14),
                    vReelle,
                    vTheorique: Math.round(vTheo * 10) / 10,
                    score,
                    ecart: Math.round(ecart * 10) / 10,
                    timestamp: Date.now() - (3 - i) * 60000
                });
                nb10s++;
            }

            for (let i = 0; i < 3; i++) {
                const vZ1 = 18 + Math.random() * 6;
                const vZ2 = 18 + Math.random() * 6;
                const moyenne = (vZ1 + vZ2) / 2;
                const pct = 60 + Math.random() * 45;
                const vTrans = moyenne * pct / 100;
                let points = pct >= 100 ? 5 : pct >= 90 ? 4 : pct >= 80 ? 3 : pct >= 70 ? 2 : pct >= 60 ? 1 : 0;

                await push(ref(db, mesures2zPath), {
                    sousActivite: 'relais2zones',
                    groupeIdx: parseInt(groupeIdx),
                    groupeNumero: groupe.numero,
                    pairId: `${lettre}-${lettre}`,
                    relayeLettre: lettre,
                    relayeurLettre: lettre,
                    distances: { z1: 20, trans: 10, z2: 20 },
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
    alert(`✅ ${nb10s} essais 10s + ${nb2z} essais 2 zones générés.`);
}

async function genererDonneesTestArcathlon(eleves) {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const { push } = await import('../../core/firebase-service.js');

    const basePath = `etablissements/0680013V/profs/${profCode}/${currentClasse}/arcathlon`;
    const equipes = JSON.parse(localStorage.getItem(`arcathlon_equipes_${currentClasse}`) || '[]');
    if (equipes.length === 0) {
        alert('⚠️ Aucune équipe Arcathlon configurée.\nGénère d\'abord les équipes dans Activités → Arcathlon.');
        return;
    }

    let nb = 0;
    const modes = ['sprint', 'poursuite'];

    for (const eq of equipes) {
        for (const m of eq.membres) {
            const code = `${eq.id}_${m.maillot}`;

            for (const mode of modes) {
                for (let serie = 1; serie <= 3; serie++) {
                    const scoreTir = Math.floor(5 + Math.random() * 15);
                    const vGrande = 12 + Math.random() * 6;
                    const nbPen = Math.floor(Math.random() * 3);
                    const tempsPen = [];
                    for (let p = 0; p < nbPen; p++) tempsPen.push(15000 + Math.random() * 10000);

                    await push(ref(db, `${basePath}/passages/${mode}`), {
                        code,
                        equipe: eq.id,
                        maillot: m.maillot,
                        serie,
                        isFinale: false,
                        mode,
                        tempsCourse: 30000 + Math.random() * 10000,
                        tempsTir: 20000 + Math.random() * 15000,
                        tempsPenalites: tempsPen,
                        vitesseGrandeBoucle: Math.round(vGrande * 10) / 10,
                        scoreTir,
                        penalites: nbPen,
                        timestamp: Date.now() - serie * 60000
                    });
                    nb++;
                }
            }
        }
    }
    alert(`✅ ${nb} passages Arcathlon générés.`);
}

async function genererDonneesTestEscalade(eleves) {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const { push } = await import('../../core/firebase-service.js');

    const assignments = JSON.parse(localStorage.getItem(`eps_arena_escalade_assignments_${currentClasse}`) || '{}');
    const groupes = Object.keys(assignments).filter(k => k !== 'reserve' && k !== 'nbGroupes');

    if (groupes.length === 0) {
        alert('⚠️ Aucun groupe Escalade configuré.\nGénère d\'abord les groupes dans Activités → Escalade.');
        return;
    }

    const cotations = ['4a', '4b', '4c', '5a', '5b', '5c', '6a'];
    const hauteurs = [3, 4, 5, 6, 7, 8, 9];
    let nb = 0;

    for (const lettre of groupes) {
        const ids = assignments[lettre] || [];
        ids.forEach((eleveId, idx) => {
            const role = idx + 1;
            for (let i = 0; i < 4; i++) {
                const hauteur = hauteurs[Math.floor(Math.random() * hauteurs.length)];
                const cotation = cotations[Math.floor(Math.random() * cotations.length)];

                push(ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/escalade/montees`), {
                    groupe: lettre,
                    role,
                    voie_num: 1 + Math.floor(Math.random() * 10),
                    couleur: 'bleue',
                    cotation,
                    hauteur,
                    points: hauteur,
                    timestamp: Date.now() - i * 60000
                });
                nb++;
            }
        });
    }
    alert(`✅ ${nb} montées Escalade générées.`);
}

async function genererDonneesTestBadminton(eleves) {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const { push } = await import('../../core/firebase-service.js');

    const assignments = JSON.parse(localStorage.getItem(`eps_arena_badminton_assignments_${currentClasse}`) || '{}');
    const terrains = Object.keys(assignments).filter(k => !isNaN(parseInt(k)));

    if (terrains.length === 0) {
        alert('⚠️ Aucun terrain Badminton configuré.\nGénère d\'abord les terrains dans Activités → Badminton.');
        return;
    }

    let nb = 0;
    for (const terrain of terrains) {
        const nbJoueurs = assignments[terrain]?.length || 0;
        const lettres = 'ABCDEFGHIJ'.split('').slice(0, nbJoueurs);

        for (let i = 0; i < lettres.length; i++) {
            for (let j = i + 1; j < lettres.length; j++) {
                const s1 = Math.floor(5 + Math.random() * 8);
                const s2 = Math.floor(5 + Math.random() * 8);
                const avec1 = s1 >= 8;
                const avec2 = s2 >= 8;
                const winner = s1 > s2 ? 'p1' : 'p2';

                await push(ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/badminton/results`), {
                    terrain: parseInt(terrain),
                    p1: lettres[i],
                    p2: lettres[j],
                    score1: s1,
                    score2: s2,
                    pts1: s1 > s2 ? (avec1 ? 5 : 3) : (avec1 ? 2 : 1),
                    pts2: s2 > s1 ? (avec2 ? 5 : 3) : (avec2 ? 2 : 1),
                    avecManiere1: avec1,
                    avecManiere2: avec2,
                    winner,
                    timestamp: Date.now()
                });
                nb++;
            }
        }
    }
    alert(`✅ ${nb} matchs Badminton générés.`);
}


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
        <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-6xl my-8">
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

            <div id="auto-evals-content" class="space-y-4">
                <p class="text-slate-400 text-center py-8">⏳ Chargement...</p>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    onValue(ref(db, path), (snap) => {
        const data = snap.val() || {};
        window._grillesAutoEvalsData = data;
        window.grillesFiltrerAutoEvals('toutes');
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

    const index = {};
    Object.values(data).forEach(item => {
        if (!item.grilleId || !item.periode || item.code === undefined) return;
        if (!index[item.grilleId]) index[item.grilleId] = {};
        if (!index[item.grilleId][item.periode]) index[item.grilleId][item.periode] = {};
        const code = String(item.code);
        const existing = index[item.grilleId][item.periode][code];
        if (!existing || (existing.timestamp || 0) < (item.timestamp || 0)) {
            index[item.grilleId][item.periode][code] = item;
        }
    });

    const eleves = getExistingEleves(currentClasse);
    eleves.sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));

    const toutesGrilles = getToutesGrilles();
    const grillesAvecEval = toutesGrilles.filter(g => index[g.id]);

    if (grillesAvecEval.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-center py-8">Aucune auto-évaluation enregistrée.</p>';
        return;
    }

    const periodesAffichees = periode === 'toutes'
        ? ['Début', 'Milieu', 'Fin']
        : [periode];

    let html = '';

    grillesAvecEval.forEach(g => {
        periodesAffichees.forEach(per => {
            const evalsPeriode = index[g.id]?.[per] || {};
            const nbReponses = Object.keys(evalsPeriode).length;

            if (periode !== 'toutes' && nbReponses === 0) return;

            html += `
                <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 mb-4">
                    <div class="flex justify-between items-center mb-3 flex-wrap gap-2">
                        <h3 class="font-black text-white">${g.titre || g.id}</h3>
                        <div class="flex items-center gap-2">
                            <span class="text-xs bg-blue-600 px-2 py-0.5 rounded-full text-white font-bold">${per}</span>
                            <span class="text-xs text-slate-400">${nbReponses}/${eleves.length} réponse(s)</span>
                        </div>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-xs">
                            <thead>
                                <tr class="text-[10px] text-slate-400 uppercase border-b border-slate-700">
                                    <th class="p-2 text-left sticky left-0 bg-slate-800 min-w-[130px]">Élève</th>
                                    ${g.criteres.map(c => `
                                        <th class="p-1 text-center min-w-[70px]" title="${c.nom}">
                                            <div class="font-black text-white text-[9px] leading-tight">${c.nom.substring(0, 20)}</div>
                                        </th>
                                    `).join('')}
                                    <th class="p-1 text-center min-w-[50px]">/100</th>
                                    <th class="p-1 text-center min-w-[50px]">/20</th>
                                </tr>
                            </thead>
                            <tbody>
            `;

            eleves.forEach(e => {
                const code = String(e.codeAutoEval);
                const rep = evalsPeriode[code];
                const notes = rep?.notes || {};

                let note100 = '--';
                let note20 = '--';
                if (rep) {
                    const nf = calculerNoteFinale(notes, g.criteres);
                    note100 = nf.sur100 !== null ? nf.sur100 : '--';
                    note20 = nf.sur20 !== null ? nf.sur20 : '--';
                }

                html += `<tr class="border-b border-slate-800 hover:bg-slate-900/50">`;
                html += `<td class="p-1.5 sticky left-0 bg-slate-800 font-bold text-white text-[11px]">${e.prenom} ${e.nom}</td>`;

                g.criteres.forEach(c => {
                    const val = notes[c.id];
                    if (val === undefined || val === null) {
                        html += `<td class="p-1 text-center">
                            <div class="rounded font-black text-sm py-1 bg-slate-900 text-slate-600 border border-slate-700">—</div>
                        </td>`;
                    } else {
                        const couleur = getCouleurNiveau(val);
                        html += `<td class="p-1 text-center">
                            <div class="rounded font-black text-sm py-1" style="background-color: ${couleur}; color: white;">${val}</div>
                        </td>`;
                    }
                });

                html += `<td class="p-1 text-center font-black text-yellow-400">${note100}</td>`;
                html += `<td class="p-1 text-center font-black text-emerald-400">${note20}</td>`;
                html += `</tr>`;
            });

            html += `</tbody></table></div></div>`;
        });
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