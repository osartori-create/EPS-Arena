// src/js/modules/escalade/escalade-voies-prof.js
// Interface professeur du module « Suivi des réalisations ».
// - Onglets : Suivi / Secteurs (voies) / Blocs (numérotations séparées).
// - Gestion des couleurs personnalisées.
// - Import / export CSV des voies et des blocs.
// - Tableau de suivi par élève / voie / secteur (noms résolus en local uniquement).

import {
    listenSuiviConfig,
    getSuiviConfigSnapshot,
    setSuiviConfig,
    listenMontees
} from './escalade-voies-firebase.js';
import { calculerStatsEleve, agregerParVoie } from './escalade-voies-core.js';
import {
    COULEURS_BASE,
    COULEUR_LABELS,
    construireSecteursDefaut
} from './escalade-voies-config.js';
import { getExistingEleves } from '../../services/admin-service.js';
import { db, ref, set } from '../../core/firebase-service.js';

let currentClasse = '';
let config = { secteurs: {}, blocs: {}, voies: {}, couleurs: {} };
let montees = {};
let configListener = null;
let monteesListener = null;
let ongletActif = 'suivi'; // 'suivi' | 'secteurs' | 'blocs'

// ============================================================
// COULEURS (base + personnalisées)
// ============================================================
function couleurHexProf(couleur) {
    const base = {
        bleue: '#3b82f6', rouge: '#ef4444', verte: '#22c55e', jaune: '#eab308',
        rose: '#ec4899', orange: '#f97316', sable: '#d6b98c', toutes: '#94a3b8'
    };
    if (base[couleur]) return base[couleur];
    const custom = (config.couleurs || {})[couleur];
    return custom?.hex || '#64748b';
}

function couleurLabelProf(couleur) {
    if (COULEUR_LABELS[couleur]) return COULEUR_LABELS[couleur];
    const custom = (config.couleurs || {})[couleur];
    return custom?.label || couleur;
}

function couleurExiste(c) {
    const cle = normaliserCouleur(c);
    if (COULEURS_BASE.includes(cle)) return cle;
    return (config.couleurs || {})[cle] ? cle : null;
}

function normaliserCouleur(c) {
    const map = {
        'bleues': 'bleue', 'rouges': 'rouge', 'vertes': 'verte',
        'jaunes': 'jaune', 'sables': 'sable', 'roses': 'rose',
        'oranges': 'orange', 'toutes': 'toutes'
    };
    const brut = String(c || '').trim().toLowerCase();
    if (map[brut]) return map[brut];
    // Nettoyage : minuscules, accents retirés, espaces -> tirets.
    return brut.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function listeCouleursDisponibles() {
    const base = COULEURS_BASE.map(c => ({ key: c, label: couleurLabelProf(c), hex: couleurHexProf(c), custom: false }));
    const customs = Object.entries(config.couleurs || {}).map(([k, v]) => ({ key: k, label: v.label || k, hex: v.hex || '#64748b', custom: true }));
    return [...base, ...customs];
}

// ============================================================
// INITIALISATION (appelée depuis escalade-prof.js)
// ============================================================
export function initSuiviProf(classe) {
    if (!classe) return;
    currentClasse = classe;

    let container = document.getElementById('suivi-prof-container');
    if (!container) {
        const parent = document.getElementById('viewEscaladeSettings');
        if (!parent) return;
        container = document.createElement('div');
        container.id = 'suivi-prof-container';
        container.className = 'space-y-4 mt-6';
        parent.appendChild(container);
    }

    if (configListener) configListener();
    if (monteesListener) monteesListener();

    configListener = listenSuiviConfig(classe, (data) => {
        config = data || { secteurs: {}, blocs: {}, voies: {}, couleurs: {} };
        if (!config.voies) config.voies = {};
        if (!config.blocs) config.blocs = {};
        if (!config.couleurs) config.couleurs = {};
        if (monteesListener) monteesListener();
        monteesListener = listenMontees(classe, (data) => {
            montees = data;
            afficherInterface();
        });
    });
}

export function cleanupSuiviProf() {
    if (configListener) { configListener(); configListener = null; }
    if (monteesListener) { monteesListener(); monteesListener = null; }
}

// ============================================================
// AFFICHAGE PRINCIPAL
// ============================================================
function afficherInterface() {
    const container = document.getElementById('suivi-prof-container');
    if (!container) return;

    container.innerHTML = `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
            <div class="flex justify-between items-center flex-wrap gap-2">
                <div>
                    <h3 class="font-black text-blue-400 uppercase text-sm">🏔️ Suivi des réalisations</h3>
                    <p class="text-xs text-slate-400">Classe : ${currentClasse} · RGPD : codes anonymes, noms résolus en local</p>
                </div>
                <div class="flex gap-2 flex-wrap">
                    <button onclick="window.suiviOnglet('suivi')" class="${ongletActif === 'suivi' ? 'bg-blue-600' : 'bg-slate-700'} px-4 py-2 rounded-xl font-black text-xs text-white active:scale-95">📊 Suivi</button>
                    <button onclick="window.suiviOnglet('secteurs')" class="${ongletActif === 'secteurs' ? 'bg-blue-600' : 'bg-slate-700'} px-4 py-2 rounded-xl font-black text-xs text-white active:scale-95">🧗 Secteurs (voies)</button>
                    <button onclick="window.suiviOnglet('blocs')" class="${ongletActif === 'blocs' ? 'bg-blue-600' : 'bg-slate-700'} px-4 py-2 rounded-xl font-black text-xs text-white active:scale-95">🧱 Blocs</button>
                    <button onclick="window.suiviInitialiserConfig()" class="bg-slate-700 px-4 py-2 rounded-xl font-black text-xs text-white active:scale-95">⚙️ Init. 21 secteurs</button>
                    <button onclick="window.suiviExporterCSV()" class="bg-emerald-600 px-4 py-2 rounded-xl font-black text-xs text-white border-2 border-emerald-400 active:scale-95">📥 Export suivi</button>
                    <button onclick="window.suiviTransmettre()" class="bg-emerald-600 px-4 py-2 rounded-xl font-black text-xs text-white border-2 border-emerald-400 active:scale-95">📡 Transmettre</button>
                </div>
            </div>
        </div>
        <div id="suivi-onglet-content" class="space-y-4"></div>
    `;

    afficherOngletActif();
}

window.suiviOnglet = function(onglet) {
    ongletActif = onglet;
    afficherInterface();
};

function afficherOngletActif() {
    if (ongletActif === 'secteurs') afficherVueSecteurs();
    else if (ongletActif === 'blocs') afficherVueBlocs();
    else afficherVueSuivi();
}

window.suiviInitialiserConfig = async function() {
    if (!currentClasse) return alert('Sélectionne une classe.');
    const snapshot = await getSuiviConfigSnapshot(currentClasse);
    const base = snapshot || {};
    const configData = {
        secteurs: construireSecteursDefaut(),
        blocs: base.blocs || {},
        voies: base.voies || {},
        couleurs: base.couleurs || {},
        murImage: base.murImage || null
    };
    await setSuiviConfig(currentClasse, configData);
    alert('✅ 21 secteurs initialisés. Les blocs et couleurs existants sont conservés.');
};

// ============================================================
// VUE COULEURS (partagée en haut des onglets secteurs / blocs)
// ============================================================
function afficherBlocCouleurs() {
    const couleurs = listeCouleursDisponibles();
    const badges = couleurs.map(c => `
        <span class="inline-flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg text-[10px] font-black text-white border border-slate-600">
            <span class="w-3 h-3 rounded-full border border-white/40" style="background:${c.hex}"></span>
            ${c.label}
            ${c.custom ? `<button onclick="window.suiviSupprimerCouleur('${c.key}')" class="ml-1 text-red-400">✕</button>` : ''}
        </span>
    `).join('');

    return `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
            <h4 class="font-bold text-slate-400 uppercase text-xs mb-2">🎨 Couleurs des prises</h4>
            <div class="flex flex-wrap gap-2 mb-2">${badges}</div>
            <button onclick="window.suiviAjouterCouleur()" class="bg-slate-700 px-3 py-2 rounded-xl font-black text-xs text-white active:scale-95">+ Ajouter une couleur</button>
        </div>
    `;
}

window.suiviAjouterCouleur = async function() {
    const label = prompt('Nom de la couleur (ex: Violette)');
    if (!label) return;
    const hex = prompt('Code hexadécimal (ex: #8b5cf6)', '#8b5cf6');
    if (hex === null) return;

    const cle = normaliserCouleur(label);
    const couleurs = { ...(config.couleurs || {}) };
    couleurs[cle] = { label: label.trim(), hex: /^#[0-9a-fA-F]{6}$/.test(hex.trim()) ? hex.trim() : '#64748b' };
    await setSuiviConfig(currentClasse, { ...config, couleurs });
    afficherInterface();
};

window.suiviSupprimerCouleur = async function(cle) {
    if (!confirm('Supprimer cette couleur ?')) return;
    const couleurs = { ...(config.couleurs || {}) };
    delete couleurs[cle];
    await setSuiviConfig(currentClasse, { ...config, couleurs });
    afficherInterface();
};

// ============================================================
// VUE SECTEURS & VOIES
// ============================================================
function afficherVueSecteurs() {
    const content = document.getElementById('suivi-onglet-content');
    if (!content) return;

    const secteurs = Object.entries(config.secteurs || {}).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

    content.innerHTML = `
        ${afficherBlocCouleurs()}

        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
            <h4 class="font-bold text-slate-400 uppercase text-xs mb-2">Ajouter un secteur</h4>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-1">
                <input id="suivi-new-secteur-num" placeholder="N° (ex: 22)" class="bg-slate-900 border border-slate-600 rounded p-2 text-white">
                <input id="suivi-new-secteur-label" placeholder="Libellé" class="bg-slate-900 border border-slate-600 rounded p-2 text-white col-span-2">
                <button onclick="window.suiviAjouterSecteur()" class="bg-blue-600 rounded p-2 font-black text-white active:scale-95">+ Ajouter</button>
            </div>
        </div>

        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
            <h4 class="font-bold text-slate-400 uppercase text-xs mb-2">Importer les voies (CSV)</h4>
            <p class="text-xs text-slate-400 mb-2">Format : <code class="bg-slate-900 px-1 rounded">secteur;couleur;cotation</code> (1 ligne = 1 voie).</p>
            <div class="flex gap-2">
                <button onclick="document.getElementById('suivi-import-csv').click()" class="bg-emerald-600 px-4 py-2 rounded-xl font-black text-xs text-white border-2 border-emerald-400 active:scale-95">📥 Importer CSV</button>
                <button onclick="window.suiviExporterVoiesCSV()" class="bg-slate-700 px-4 py-2 rounded-xl font-black text-xs text-white active:scale-95">⬇️ Modèle CSV</button>
            </div>
            <input type="file" id="suivi-import-csv" accept=".csv,text/csv" class="hidden" onchange="window.suiviImporterCSV(event)">
        </div>

        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
            <h4 class="font-bold text-slate-400 uppercase text-xs mb-3">Secteurs (${secteurs.length})</h4>
            <div class="space-y-3">
                ${secteurs.map(([id, s]) => `
                    <div class="bg-slate-900 p-3 rounded-xl border border-slate-700">
                        <div class="flex items-center gap-3 flex-wrap">
                            <span class="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-black text-white">${id}</span>
                            <div class="flex-1 min-w-[160px]">
                                <div class="font-black text-white">${s.label || 'Secteur ' + id}</div>
                                <div class="text-[10px] text-slate-400">${Object.values(config.voies || {}).filter(v => v.secteur === id).length} voie(s)</div>
                            </div>
                            <button onclick="window.suiviSupprimerSecteur('${id}')" class="bg-red-950 text-red-400 px-3 py-1 rounded-lg text-xs font-black active:scale-95">🗑️</button>
                        </div>
                        <div class="mt-2">${afficherVoiesSecteurProf(id)}</div>
                        <div class="mt-2">
                            <button onclick="window.suiviAjouterVoie('${id}')" class="bg-emerald-600 px-3 py-1 rounded-lg text-xs font-black text-white active:scale-95">+ Ajouter une voie</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function afficherVoiesSecteurProf(secteurId) {
    const voies = Object.values(config.voies || {}).filter(v => v.secteur === secteurId);
    if (voies.length === 0) return '<p class="text-xs text-slate-500 italic">Aucune voie.</p>';
    return `<div class="space-y-1">${voies.map(v => `
        <div class="flex items-center gap-2 text-xs">
            <span class="w-3 h-3 rounded-full border border-white/40" style="background:${couleurHexProf(v.couleur)}"></span>
            <span class="text-white font-bold">${v.label || 'voie'}</span>
            <span class="text-slate-400">${couleurLabelProf(v.couleur)}</span>
            <span class="text-yellow-400 font-black ml-auto">${v.cotation}</span>
            <button onclick="window.suiviSupprimerVoie('${v.id}')" class="bg-red-950 text-red-400 px-2 py-0.5 rounded text-[10px] font-black">✕</button>
        </div>`).join('')}</div>`;
}

window.suiviAjouterSecteur = async function() {
    const num = document.getElementById('suivi-new-secteur-num').value.trim();
    const label = document.getElementById('suivi-new-secteur-label').value.trim();
    if (!num) return alert('Indique un numéro de secteur.');
    const secteurs = { ...(config.secteurs || {}) };
    secteurs[num] = { label: label || `Secteur ${num}`, x: 50, y: 50 };
    await setSuiviConfig(currentClasse, { ...config, secteurs });
    afficherInterface();
};

window.suiviSupprimerSecteur = async function(id) {
    if (!confirm(`Supprimer le secteur ${id} et ses voies ?`)) return;
    const secteurs = { ...(config.secteurs || {}) };
    delete secteurs[id];
    const voies = { ...(config.voies || {}) };
    Object.keys(voies).forEach(k => { if (voies[k].secteur === id) delete voies[k]; });
    await setSuiviConfig(currentClasse, { ...config, secteurs, voies });
    afficherInterface();
};

window.suiviAjouterVoie = async function(secteurId) {
    if (!config.secteurs || !config.secteurs[secteurId]) return alert('Secteur inexistant.');

    const label = prompt('Libellé de la voie (ex: bleue, sable…)');
    if (label === null) return;

    const couleurs = listeCouleursDisponibles().map(c => c.key).join(', ');
    const couleurChoisie = prompt('Couleur des prises (' + couleurs + ')', COULEURS_BASE[0]);
    if (couleurChoisie === null) return;
    const couleur = normaliserCouleur(couleurChoisie);
    if (!couleurExiste(couleur)) return alert('Couleur inconnue. Ajoute-la d\'abord dans « + Ajouter une couleur ».');

    const cotation = prompt('Cotation (ex: 6A+, 5B…)');
    if (cotation === null) return;

    const id = `${secteurId}-${couleur}-${cotation.trim().toUpperCase()}`;
    const voies = { ...(config.voies || {}) };
    voies[id] = {
        id,
        type: 'voie',
        secteur: secteurId,
        label: label || couleurLabelProf(couleur),
        couleur,
        cotation: cotation.trim().toUpperCase()
    };
    await setSuiviConfig(currentClasse, { ...config, voies });
    afficherInterface();
};

window.suiviSupprimerVoie = async function(voieId) {
    if (!confirm('Supprimer cette voie ?')) return;
    const voies = { ...(config.voies || {}) };
    delete voies[voieId];
    await setSuiviConfig(currentClasse, { ...config, voies });
    afficherInterface();
};

// ============================================================
// IMPORT / EXPORT CSV DES VOIES
// ============================================================
window.suiviImporterCSV = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const texte = e.target.result || '';
            if (!texte.trim()) { alert('Fichier vide.'); return; }

            const lignes = parserCsv(texte);
            if (lignes.length === 0) { alert('Aucune ligne de données détectée.'); return; }

            // L'import REMPLACE toutes les voies existantes (topo complet).
            const voies = {};
            Object.entries(config.voies || {}).forEach(([k, v]) => {
                if (v.type === 'bloc') voies[k] = v;
            });
            const secteurs = { ...(config.secteurs || {}) };
            let nb = 0;
            const erreurs = [];

            lignes.forEach((ligne, idx) => {
                const secteur = String(ligne.secteur || '').trim();
                if (secteur && !secteurs[secteur]) {
                    // Auto-création du secteur s'il n'existe pas encore.
                    secteurs[secteur] = { label: `Secteur ${secteur}`, x: 50, y: 50 };
                }
                const cotationBrute = String(ligne.cotation || '').trim();
                if (!secteur) { erreurs.push(`Ligne ${idx + 2} : secteur vide`); return; }

                const couleur = normaliserCouleur(ligne.couleur);
                if (!couleurExiste(couleur)) { erreurs.push(`Ligne ${idx + 2} : couleur « ${ligne.couleur} » inconnue`); return; }

                const label = (ligne.label && String(ligne.label).trim()) || couleurLabelProf(couleur);
                const cotation = cotationBrute.toUpperCase();

                const id = `${secteur}-${couleur}-${cotation}`;
                voies[id] = { id, type: 'voie', secteur, label, couleur, cotation };
                nb++;
            });

            await setSuiviConfig(currentClasse, { ...config, voies, secteurs });
            afficherInterface();

            if (erreurs.length > 0) {
                alert(`⚠️ ${nb} voie(s) importée(s).\n${erreurs.length} ligne(s) ignorée(s) :\n${erreurs.slice(0, 5).join('\n')}${erreurs.length > 5 ? '\n…' : ''}`);
            } else {
                alert(`✅ ${nb} voie(s) importée(s) !`);
            }
        } catch (err) {
            console.error(err);
            alert('❌ Erreur import CSV : ' + err.message);
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsText(file, 'utf-8');
};

window.suiviExporterVoiesCSV = function() {
    const voies = Object.values(config.voies || {})
        .filter(v => v.type !== 'bloc')
        .sort((a, b) => parseInt(a.secteur) - parseInt(b.secteur) || (a.couleur || '').localeCompare(b.couleur || ''));

    const lignes = ['secteur;couleur;cotation'];
    voies.forEach(v => lignes.push(`${v.secteur};${v.couleur};${v.cotation}`));

    const csv = '\uFEFF' + lignes.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `topo_voies_${currentClasse}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};

// ============================================================
// VUE BLOCS (numérotation indépendante des secteurs)
// ============================================================
function afficherVueBlocs() {
    const content = document.getElementById('suivi-onglet-content');
    if (!content) return;

    const blocs = Object.entries(config.blocs || {}).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

    content.innerHTML = `
        ${afficherBlocCouleurs()}

        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
            <h4 class="font-bold text-slate-400 uppercase text-xs mb-2">Ajouter un bloc</h4>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-1">
                <input id="suivi-new-bloc-num" placeholder="N° (ex: 1)" class="bg-slate-900 border border-slate-600 rounded p-2 text-white">
                <input id="suivi-new-bloc-label" placeholder="Libellé" class="bg-slate-900 border border-slate-600 rounded p-2 text-white col-span-2">
                <button onclick="window.suiviAjouterBloc()" class="bg-blue-600 rounded p-2 font-black text-white active:scale-95">+ Ajouter</button>
            </div>
        </div>

        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
            <h4 class="font-bold text-slate-400 uppercase text-xs mb-2">Importer les blocs (CSV)</h4>
            <p class="text-xs text-slate-400 mb-2">Format : <code class="bg-slate-900 px-1 rounded">bloc;couleur;cotation</code> (1 ligne = 1 bloc).</p>
            <div class="flex gap-2">
                <button onclick="document.getElementById('suivi-import-csv-bloc').click()" class="bg-emerald-600 px-4 py-2 rounded-xl font-black text-xs text-white border-2 border-emerald-400 active:scale-95">📥 Importer CSV</button>
                <button onclick="window.suiviExporterBlocsCSV()" class="bg-slate-700 px-4 py-2 rounded-xl font-black text-xs text-white active:scale-95">⬇️ Modèle CSV</button>
            </div>
            <input type="file" id="suivi-import-csv-bloc" accept=".csv,text/csv" class="hidden" onchange="window.suiviImporterCSVBloc(event)">
        </div>

        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
            <h4 class="font-bold text-slate-400 uppercase text-xs mb-3">Blocs (${blocs.length})</h4>
            <div class="space-y-3">
                ${blocs.map(([id, b]) => `
                    <div class="bg-slate-900 p-3 rounded-xl border border-slate-700">
                        <div class="flex items-center gap-3 flex-wrap">
                            <span class="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center font-black text-white">${id}</span>
                            <div class="flex-1 min-w-[160px]">
                                <div class="font-black text-white">${b.label || 'Bloc ' + id}</div>
                                <div class="text-[10px] text-slate-400">${Object.values(config.voies || {}).filter(v => v.type === 'bloc' && v.secteur === id).length} bloc(s)</div>
                            </div>
                            <button onclick="window.suiviSupprimerBloc('${id}')" class="bg-red-950 text-red-400 px-3 py-1 rounded-lg text-xs font-black active:scale-95">🗑️</button>
                        </div>
                        <div class="mt-2">${afficherBlocsProf(id)}</div>
                        <div class="mt-2">
                            <button onclick="window.suiviAjouterVoieBloc('${id}')" class="bg-emerald-600 px-3 py-1 rounded-lg text-xs font-black text-white active:scale-95">+ Ajouter un bloc</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function afficherBlocsProf(blocId) {
    const blocs = Object.values(config.voies || {}).filter(v => v.type === 'bloc' && v.secteur === blocId);
    if (blocs.length === 0) return '<p class="text-xs text-slate-500 italic">Aucun bloc.</p>';
    return `<div class="space-y-1">${blocs.map(v => `
        <div class="flex items-center gap-2 text-xs">
            <span class="w-3 h-3 rounded-full border border-white/40" style="background:${couleurHexProf(v.couleur)}"></span>
            <span class="text-white font-bold">${v.label || 'bloc'}</span>
            <span class="text-slate-400">${couleurLabelProf(v.couleur)}</span>
            <span class="text-yellow-400 font-black ml-auto">${v.cotation}</span>
            <button onclick="window.suiviSupprimerVoie('${v.id}')" class="bg-red-950 text-red-400 px-2 py-0.5 rounded text-[10px] font-black">✕</button>
        </div>`).join('')}</div>`;
}

window.suiviAjouterBloc = async function() {
    const num = document.getElementById('suivi-new-bloc-num').value.trim();
    const label = document.getElementById('suivi-new-bloc-label').value.trim();
    if (!num) return alert('Indique un numéro de bloc (indépendant des secteurs).');
    const blocs = { ...(config.blocs || {}) };
    blocs[num] = { label: label || `Bloc ${num}`, x: 50, y: 50 };
    await setSuiviConfig(currentClasse, { ...config, blocs });
    afficherInterface();
};

window.suiviSupprimerBloc = async function(id) {
    if (!confirm(`Supprimer le bloc ${id} et ses éléments ?`)) return;
    const blocs = { ...(config.blocs || {}) };
    delete blocs[id];
    const voies = { ...(config.voies || {}) };
    Object.keys(voies).forEach(k => { if (voies[k].type === 'bloc' && voies[k].secteur === id) delete voies[k]; });
    await setSuiviConfig(currentClasse, { ...config, blocs, voies });
    afficherInterface();
};

window.suiviAjouterVoieBloc = async function(blocId) {
    if (!config.blocs || !config.blocs[blocId]) return alert('Bloc inexistant.');

    const label = prompt('Libellé du bloc (ex: orange, bleu…)');
    if (label === null) return;

    const couleurs = listeCouleursDisponibles().map(c => c.key).join(', ');
    const couleurChoisie = prompt('Couleur (' + couleurs + ')', COULEURS_BASE[0]);
    if (couleurChoisie === null) return;
    const couleur = normaliserCouleur(couleurChoisie);
    if (!couleurExiste(couleur)) return alert('Couleur inconnue. Ajoute-la d\'abord.');

    const cotation = prompt('Cotation (ex: 6A+, 5B…)');
    if (cotation === null) return;

    const id = `bloc-${blocId}-${couleur}-${cotation.trim().toUpperCase()}`;
    const voies = { ...(config.voies || {}) };
    voies[id] = {
        id,
        type: 'bloc',
        secteur: blocId,
        label: label || couleurLabelProf(couleur),
        couleur,
        cotation: cotation.trim().toUpperCase()
    };
    await setSuiviConfig(currentClasse, { ...config, voies });
    afficherInterface();
};

window.suiviImporterCSVBloc = function(event) {
    importerCsvParType(event, 'bloc', 'bloc');
};

window.suiviExporterBlocsCSV = function() {
    const blocs = Object.values(config.voies || {})
        .filter(v => v.type === 'bloc')
        .sort((a, b) => parseInt(a.secteur) - parseInt(b.secteur) || (a.couleur || '').localeCompare(b.couleur || ''));

    const lignes = ['bloc;couleur;cotation'];
    blocs.forEach(v => lignes.push(`${v.secteur};${v.couleur};${v.cotation}`));

    const csv = '\uFEFF' + lignes.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `topo_blocs_${currentClasse}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};

function importerCsvParType(event, type, cleSecteur) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const texte = e.target.result || '';
            if (!texte.trim()) { alert('Fichier vide.'); return; }
            const lignes = parserCsv(texte);
            if (lignes.length === 0) { alert('Aucune ligne de données détectée.'); return; }

            // L'import REMPLACE tous les éléments de ce type.
            const voies = {};
            const autreType = (type === 'bloc') ? 'voie' : 'bloc';
            Object.entries(config.voies || {}).forEach(([k, v]) => {
                if (v.type === autreType) voies[k] = v;
            });
            let nb = 0;
            const erreurs = [];

            lignes.forEach((ligne, idx) => {
                const secteur = String(ligne[cleSecteur] || ligne.secteur || '').trim();
                const cotationBrute = String(ligne.cotation || '').trim();
                if (!secteur) { erreurs.push(`Ligne ${idx + 2} : ${cleSecteur} vide`); return; }

                const couleur = normaliserCouleur(ligne.couleur);
                if (!couleurExiste(couleur)) { erreurs.push(`Ligne ${idx + 2} : couleur « ${ligne.couleur} » inconnue`); return; }

                const label = (ligne.label && String(ligne.label).trim()) || couleurLabelProf(couleur);
                const cotation = cotationBrute.toUpperCase();
                const id = `${type === 'bloc' ? 'bloc-' : ''}${secteur}-${couleur}-${cotation}`;
                voies[id] = { id, type, secteur, label, couleur, cotation };
                nb++;
            });

            await setSuiviConfig(currentClasse, { ...config, voies });
            afficherInterface();

            if (erreurs.length > 0) {
                alert(`⚠️ ${nb} ${type === 'bloc' ? 'bloc(s)' : 'voie(s)'} importé(s).\n${erreurs.length} ligne(s) ignorée(s) :\n${erreurs.slice(0, 5).join('\n')}${erreurs.length > 5 ? '\n…' : ''}`);
            } else {
                alert(`✅ ${nb} ${type === 'bloc' ? 'bloc(s)' : 'voie(s)'} importé(s) !`);
            }
        } catch (err) {
            console.error(err);
            alert('❌ Erreur import CSV : ' + err.message);
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsText(file, 'utf-8');
}

function parserCsv(texte) {
    const parse = window.Papa ? window.Papa.parse : null;
    if (parse) {
        const res = parse(texte, {
            header: true,
            skipEmptyLines: true,
            delimiter: ';',
            transformHeader: h => String(h).trim().toLowerCase()
        });
        return res.data || [];
    }
    const lignesBrutes = texte.split(/\r?\n/).filter(l => l.trim());
    const entete = lignesBrutes[0].split(';').map(h => h.trim().toLowerCase());
    return lignesBrutes.slice(1).map(l => {
        const vals = l.split(';');
        const o = {};
        entete.forEach((h, i) => { o[h] = (vals[i] || '').trim(); });
        return o;
    });
}

// ============================================================
// VUE SUIVI (tableau de progression réelle)
// ============================================================
function afficherVueSuivi() {
    const content = document.getElementById('suivi-onglet-content');
    if (!content) return;

    const eleves = getExistingEleves(currentClasse);
    const voies = config.voies || {};

    const codesActifs = new Set();
    Object.values(montees).forEach(m => codesActifs.add(String(m.code)));

    const statsParCode = {};
    let totalMontees = 0;
    codesActifs.forEach(code => {
        const mesMontées = Object.values(montees).filter(m => String(m.code) === code);
        totalMontees += mesMontées.length;
        statsParCode[code] = calculerStatsEleve(mesMontées);
    });

    const parVoie = agregerParVoie(Object.values(montees));
    const parSecteur = {};
    Object.values(montees).forEach(m => {
        const s = String(m.secteur);
        if (!parSecteur[s]) parSecteur[s] = { tentatives: 0, reussies: 0 };
        parSecteur[s].tentatives++;
        if (m.reussie) parSecteur[s].reussies++;
    });

    const colonnesVoies = Object.values(voies)
        .filter(v => v.type !== 'bloc')
        .sort((a, b) => parseInt(a.secteur) - parseInt(b.secteur));

    const rowsHtml = eleves.map(e => {
        const code = String(e.codeAutoEval);
        const stats = statsParCode[code];
        const nomAffiche = `${e.prenom || ''} ${e.nom || ''}`.trim() || `#${code}`;
        if (!stats) return '';

        const cellules = colonnesVoies.map(v => {
            const monteesVoie = Object.values(montees).filter(m => m.voieId === v.id && String(m.code) === code);
            if (monteesVoie.length === 0) return '<td class="p-1.5 text-center text-slate-600">·</td>';
            const reussies = monteesVoie.filter(m => m.reussie).length;
            const color = reussies > 0 ? 'text-emerald-400 font-black' : 'text-amber-400 font-black';
            return `<td class="p-1.5 text-center ${color}">${reussies > 0 ? '✓' : monteesVoie.length + '×'}</td>`;
        }).join('');

        return `
            <tr class="border-t border-slate-800 hover:bg-slate-800/50">
                <td class="p-2 sticky left-0 bg-slate-900 font-bold text-white whitespace-nowrap">${nomAffiche}</td>
                <td class="p-2 text-center text-xs text-slate-400 sticky left-0 bg-slate-900">#${code}</td>
                <td class="p-2 text-center font-black text-white">${stats.total}</td>
                <td class="p-2 text-center font-black text-emerald-400">${stats.reussies}</td>
                <td class="p-2 text-center font-black text-yellow-400">${Math.round(stats.tauxReussite)}%</td>
                <td class="p-2 text-center font-black text-blue-400">${stats.cotationMax || '—'}</td>
                <td class="p-2 text-center font-black text-white">${stats.hauteurMax}m</td>
                ${cellules}
            </tr>
        `;
    }).join('');

    const headersVoies = colonnesVoies.map(v => {
        return `<th class="p-1.5 text-center text-[10px] font-black text-slate-400 border-l border-slate-800">S${v.secteur} ${v.label || ''}<br><span class="text-yellow-500">${v.cotation || ''}</span></th>`;
    }).join('');

    content.innerHTML = `
        <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
            <h4 class="font-black text-blue-400 uppercase text-sm mb-3">📊 Tableau de suivi (${codesActifs.size} élève(s) actif(s) · ${totalMontees} montée(s))</h4>
            <div class="overflow-x-auto">
                <table class="w-full text-xs border-collapse">
                    <thead>
                        <tr class="text-slate-400 uppercase text-[10px]">
                            <th class="p-2 text-left sticky left-0 bg-slate-900">Élève</th>
                            <th class="p-2 text-center sticky left-0 bg-slate-900">N°</th>
                            <th class="p-2 text-center">Montées</th>
                            <th class="p-2 text-center">Réussites</th>
                            <th class="p-2 text-center">Taux</th>
                            <th class="p-2 text-center">Cotation max</th>
                            <th class="p-2 text-center">Hauteur max</th>
                            ${headersVoies}
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <h4 class="font-bold text-slate-400 uppercase text-xs mb-3">Taux de réussite par secteur</h4>
                <div class="space-y-2">
                    ${Object.entries(parSecteur).sort((a,b) => parseInt(a[0])-parseInt(b[0])).map(([s, d]) => {
                        const taux = d.tentatives > 0 ? Math.round((d.reussies / d.tentatives) * 100) : 0;
                        return `<div class="flex items-center gap-2">
                            <span class="w-8 text-right font-black text-white">${s}</span>
                            <div class="flex-1 bg-slate-900 rounded-full h-4 overflow-hidden"><div class="bg-emerald-500 h-4" style="width:${taux}%"></div></div>
                            <span class="w-24 text-right text-xs text-slate-400">${d.reussies}/${d.tentatives} (${taux}%)</span>
                        </div>`;
                    }).join('')}
                </div>
            </div>
            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <h4 class="font-bold text-slate-400 uppercase text-xs mb-3">Taux de réussite par voie</h4>
                <div class="space-y-2">
                    ${Object.entries(parVoie).map(([id, d]) => {
                        const v = voies[id];
                        if (!v) return '';
                        const taux = d.tentatives > 0 ? Math.round((d.reussies / d.tentatives) * 100) : 0;
                        return `<div class="flex items-center gap-2 text-xs">
                            <span class="w-24 text-right font-black text-white truncate">S${v.secteur} ${v.label || ''}</span>
                            <div class="flex-1 bg-slate-900 rounded-full h-4 overflow-hidden"><div class="bg-blue-500 h-4" style="width:${taux}%"></div></div>
                            <span class="w-24 text-right text-slate-400">${d.reussies}/${d.tentatives} (${taux}%)</span>
                        </div>`;
                    }).join('')}
                </div>
            </div>
        </div>
    `;
}

// ============================================================
// EXPORT SUIVI CSV (compatible iDoceo)
// ============================================================
window.suiviExporterCSV = function() {
    const eleves = getExistingEleves(currentClasse);
    const codesActifs = new Set();
    Object.values(montees).forEach(m => codesActifs.add(String(m.code)));

    const entete = ['"Nom"', '"Prénom"', '"Numéro"', '"Montées"', '"Réussites"', '"Taux réussite"',
        '"Cotation max"', '"Hauteur max"', '"Badges"'];
    const lignes = [entete.join(';')];

    eleves.forEach(e => {
        const code = String(e.codeAutoEval);
        if (!codesActifs.has(code)) return;
        const stats = calculerStatsEleve(Object.values(montees).filter(m => String(m.code) === code));
        const badges = stats.badges.map(b => b.titre).join(' / ');
        const ligne = [
            `"${e.nom || ''}"`,
            `"${e.prenom || ''}"`,
            `"${code}"`,
            stats.total,
            stats.reussies,
            Math.round(stats.tauxReussite) + '%',
            `"${stats.cotationMax || ''}"`,
            stats.hauteurMax + 'm',
            `"${badges}"`
        ];
        lignes.push(ligne.join(';'));
    });

    const csv = '\uFEFF' + lignes.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SuiviEscalade_${currentClasse}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};

// ============================================================
// TRANSMISSION (activité dédiée)
// ============================================================
window.suiviTransmettre = async function() {
    if (!currentClasse) return alert('Sélectionne une classe.');

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const baseProf = `etablissements/0680013V/profs/${profCode}`;

    let snapshot = await getSuiviConfigSnapshot(currentClasse);
    snapshot = snapshot || {};
    if (!snapshot.secteurs) snapshot.secteurs = construireSecteursDefaut();
    if (!snapshot.blocs) snapshot.blocs = {};
    if (!snapshot.voies) snapshot.voies = {};
    if (!snapshot.couleurs) snapshot.couleurs = {};

    try {
        await setSuiviConfig(currentClasse, snapshot);
        await set(ref(db, `${baseProf}/${currentClasse}/config`), { activite: 'escalade-suivi' });
        await set(ref(db, `${baseProf}/active_classes/${currentClasse}`), true);
        alert('✅ Suivi des réalisations transmis aux iPads !');
    } catch (err) {
        console.error(err);
        alert('❌ Erreur de transmission : ' + err.message);
    }
};

// ============================================================
// ENREGISTREMENT DU MODULE (compatibilité registre)
// ============================================================
export function registerSuiviModule() {
    return {
        id: 'escalade-suivi',
        label: '🏔️ Suivi des réalisations',
        icon: '🏔️',
        initProf: initSuiviProf,
        initKiosk: (classe) => import('./escalade-voies-kiosk.js').then(m => m.initSuiviKiosk(classe)),
        transmettre: (classe) => { currentClasse = classe; return window.suiviTransmettre(); },
        isDefault: false,
        cleanup: cleanupSuiviProf
    };
}