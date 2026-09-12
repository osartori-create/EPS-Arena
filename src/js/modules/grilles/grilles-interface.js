// src/js/modules/grilles/grilles-interface.js
// UI Prof : bibliothèque + passation + export

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

// ============================================================
// POINT D'ENTRÉE (appelé depuis layout.js)
// ============================================================
export function initGrillesInterface() {
    const container = document.getElementById('viewEvaluations');
    if (!container) return;

    currentClasse = getCurrentClasse();
    container.innerHTML = '';

    renderBibliotheque(container);
}

// ============================================================
// ÉCRAN 1 : BIBLIOTHÈQUE
// ============================================================
function renderBibliotheque(container) {
    const grilles = getToutesGrilles();

    // Grouper par activité
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
                <div class="flex gap-2">
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
                                    title="Exporter la grille vierge">
                                ⬇️
                            </button>
                            <button onclick="window.grillesSupprimer('${g.id}')"
                                    class="bg-red-900/50 hover:bg-red-800 px-3 py-2 rounded-xl font-black text-xs text-red-300 active:scale-95"
                                    title="Supprimer">
                                🗑️
                            </button>
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
    `;

    // Bandeau dernier niveau Élève
    if (eleves.length > 0) {
        const derniers = eleves.map(e => getDernierNiveauEleve(currentClasse, e.id)).filter(Boolean);
        if (derniers.length > 0) {
            html += `
                <div class="bg-amber-900/20 border border-amber-500/50 rounded-xl p-3 text-xs text-amber-200">
                    💡 <strong class="text-amber-400">Info :</strong> Certains élèves ont déjà un niveau "Élève" enregistré dans une autre activité.
                    Il sera pré-rempli automatiquement lors de la saisie.
                </div>
            `;
        }
    }

    // Tableau
    html += `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 overflow-x-auto">
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
                <tbody>
    `;

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

    html += `
                </tbody>
            </table>
        </div>
                <div class="flex gap-3 flex-wrap">
            <button onclick="window.grillesSauvegarder()"
                    class="flex-1 bg-emerald-600 hover:bg-emerald-500 py-3 rounded-2xl font-black text-white active:scale-95">
                💾 Sauvegarder les notes
            </button>
            <button onclick="window.grillesFiger()"
                    class="bg-amber-600 hover:bg-amber-500 px-4 py-3 rounded-2xl font-black text-white active:scale-95 ${currentGrille.figee ? 'opacity-50 cursor-not-allowed' : ''}"
                    ${currentGrille.figee ? 'disabled' : ''}>
                🔒 ${currentGrille.figee ? 'Déjà figée' : 'Figer la grille'}
            </button>
            <button onclick="window.grillesActiver()"
                    class="bg-blue-600 hover:bg-blue-500 px-4 py-3 rounded-2xl font-black text-xs text-white active:scale-95 border-2 border-blue-400">
                📡 Activer pour les iPads
            </button>
            <button onclick="window.grillesDesactiver()"
                    class="bg-slate-700 hover:bg-slate-600 px-4 py-3 rounded-2xl font-black text-xs text-white active:scale-95">
                ⏹ Désactiver
            </button>
            <button onclick="window.grillesGenererDonneesTest()"
                    class="bg-pink-600 hover:bg-pink-500 px-4 py-3 rounded-2xl font-black text-xs text-white active:scale-95">
                🧪 Générer données test
            </button>
            <button onclick="window.grillesExporterNotes()"
                    class="bg-indigo-600 hover:bg-indigo-500 px-4 py-3 rounded-2xl font-black text-xs text-white active:scale-95">
                📥 Export notes iDoeceo
            </button>
            <button onclick="window.grillesExporterRubrique()"
                    class="bg-purple-600 hover:bg-purple-500 px-4 py-3 rounded-2xl font-black text-xs text-white active:scale-95">
                📥 Export rubrique iDoeceo
            </button>
        </div>
    `;

    container.innerHTML = html;

    // Charger les données auto pour le Relais
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

        // Calculer les niveaux auto pour chaque élève
        for (const e of eleves) {
            const niveaux = await calculerNiveauxRelais(currentClasse, e.id, config);
            if (Object.keys(niveaux).length > 0) {
                // Stocker temporairement pour utilisation par le bouton "Auto"
                window._grillesAutoData = window._grillesAutoData || {};
                window._grillesAutoData[e.id] = niveaux;
            }
        }
        console.log('[Grilles] Données auto chargées pour', Object.keys(window._grillesAutoData || {}).length, 'élèves');
    }, { onlyOnce: true });
}

// ============================================================
// ACTIONS GLOBALES
// ============================================================
window.grillesImporterXLSX = function() {
    document.getElementById('grillesInputFile').click();
};

window.grillesTraiterImport = async function(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const grille = await importerGrilleXLSX(file);
        // Vérifier si une grille avec le même id existe
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

    // Sauvegarder le niveau "Élève" si c'est ce critère
    const critere = currentGrille.criteres.find(c => c.id === critereId);
    if (critere && critere.nom.toLowerCase().includes('élève')) {
        setDernierNiveauEleve(currentClasse, eleveId, valeur, currentGrille.activite);
    }

    sauvegarderEvaluation(currentClasse, currentGrille.id, currentPeriode, eleveId, evals[currentGrille.id][currentPeriode][eleveId].notes);
    const container = document.getElementById('viewEvaluations');
    renderPassation(container);
};

window.grillesRemplirAuto = function(eleveId, critereId) {
    const data = window._grillesAutoData?.[eleveId];
    if (!data) {
        alert('Aucune donnée automatique disponible pour cet élève.');
        return;
    }
    const valeur = data[critereId];
    if (valeur === undefined) {
        alert('Pas de donnée auto pour ce critère.');
        return;
    }
    window.grillesSetNote(eleveId, critereId, valeur);
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

window.grillesActiver = async function() {
    if (!currentGrille) return;
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const { db, ref, set } = await import('../../core/firebase-service.js');
    const path = `etablissements/0680013V/profs/${profCode}/${currentClasse}/grilles/config`;
    await set(ref(db, path), {
        actif: true,
        grilleId: currentGrille.id,
        periode: currentPeriode,
        timestamp: Date.now()
    });
    // Config activité principale
    await set(ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/config`), { activite: 'grilles' });
    alert('✅ Auto-évaluation activée pour les iPads.');
};

window.grillesDesactiver = async function() {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const { db, ref, set } = await import('../../core/firebase-service.js');
    const path = `etablissements/0680013V/profs/${profCode}/${currentClasse}/grilles/config`;
    await set(ref(db, path), { actif: false });
    alert('✅ Auto-évaluation désactivée.');
};

// ============================================================
// ACTIVATION POUR LES IPADS
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
        // Config activité principale (déclencheur kiosque)
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
// GÉNÉRATION DE DONNÉES TEST (pour valider le pré-remplissage)
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

    // Vérifier s'il existe déjà des mesures
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const { db, ref, set, get } = await import('../../core/firebase-service.js');

    const mesures10sPath = `etablissements/0680013V/profs/${profCode}/${currentClasse}/relais/mesures-10s`;
    const mesures2zPath = `etablissements/0680013V/profs/${profCode}/${currentClasse}/relais/mesures-2zones`;
    const configPath = `etablissements/0680013V/profs/${profCode}/${currentClasse}/relais/config`;

    // Vérifier la config relais
    const configSnap = await new Promise(resolve => {
        const { onValue } = window._fb || {};
        // Fallback : import direct
        import('../../core/firebase-service.js').then(m => {
            m.onValue(m.ref(m.db, configPath), resolve, { onlyOnce: true });
        });
    });

    const config = configSnap.val();
    if (!config || !config.groupes) {
        alert('⚠️ Aucune configuration Relais trouvée.\nTransmets d\'abord une config Relais (onglet Activités → Relais).');
        return;
    }

    if (!confirm(`Générer 3 essais 10s + 3 essais 2 zones par élève ?\n\nClasse : ${currentClasse}\n${eleves.length} élèves\n${Object.keys(config.groupes).length} groupes`)) {
        return;
    }

    const { push } = await import('../../core/firebase-service.js');
    let nb10s = 0, nb2z = 0;

    // Parcourir les groupes et élèves
    for (const [groupeIdx, groupe] of Object.entries(config.groupes)) {
        for (const membre of groupe.membres) {
            const lettre = membre.lettre;

            // 3 essais 10s
            for (let i = 0; i < 3; i++) {
                const vTheo = 20 + Math.random() * 5; // entre 20 et 25
                const ecart = (Math.random() - 0.5) * 4; // -2 à +2
                const vReelle = Math.round((vTheo + ecart) * 10) / 10;
                const score = Math.round((5 + ecart) * 10) / 10;
                const zoneAtteinte = Math.round(vReelle - 14); // zone 1-14

                const mesure = {
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
                };
                await push(ref(db, mesures10sPath), mesure);
                nb10s++;
            }

            // 3 essais 2 zones
            for (let i = 0; i < 3; i++) {
                const vZ1 = 18 + Math.random() * 6;
                const vZ2 = 18 + Math.random() * 6;
                const moyenne = (vZ1 + vZ2) / 2;
                const pct = 60 + Math.random() * 45; // 60 à 105%
                const vTrans = moyenne * pct / 100;

                // Calcul du score selon les paliers
                let points = 0;
                if (pct >= 100) points = 5;
                else if (pct >= 90) points = 4;
                else if (pct >= 80) points = 3;
                else if (pct >= 70) points = 2;
                else if (pct >= 60) points = 1;

                const mesure = {
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
                };
                await push(ref(db, mesures2zPath), mesure);
                nb2z++;
            }
        }
    }

    alert(`✅ Données test générées !\n${nb10s} essais 10s\n${nb2z} essais 2 zones\n\nLes boutons 🤖 Auto devraient maintenant fonctionner.`);
};

export function cleanupGrillesInterface() {
    currentGrille = null;
    currentClasse = '';
    currentEvaluations = {};
}