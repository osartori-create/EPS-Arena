// src/js/modules/escalade/escalade-voies-prof.js
// Interface professeur du module « Suivi des réalisations ».
// - Gestion des secteurs (1..21) et des voies par secteur.
// - Tableau de suivi par élève / voie / secteur (résolution noms en LOCAL uniquement).
// - Export CSV compatible iDoceo.

import {
    listenSuiviConfig,
    getSuiviConfigSnapshot,
    setSuiviConfig,
    listenMontees
} from './escalade-voies-firebase.js';
import { calculerStatsEleve, agregerParVoie } from './escalade-voies-core.js';
import {
    COULEURS,
    COULEUR_LABELS,
    construireSecteursDefaut
} from './escalade-voies-config.js';
import { getExistingEleves } from '../../services/admin-service.js';
import { db, ref, set } from '../../core/firebase-service.js';

let currentClasse = '';
let config = { secteurs: {}, voies: {} };
let montees = {};
let configListener = null;
let monteesListener = null;
let ongletActif = 'suivi'; // 'suivi' | 'secteurs'

// ============================================================
// INITIALISATION (appelée depuis activities.js)
// ============================================================
export function initSuiviProf(classe) {
    if (!classe) return;
    currentClasse = classe;

    let container = document.getElementById('suivi-prof-container');
    if (!container) {
        // Le suivi vit DANS le module Escalade (3e mode).
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
        config = data || { secteurs: {}, voies: {} };
        if (!config.voies) config.voies = {};
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
                    <button onclick="window.suiviOnglet('suivi')" class="bg-blue-600 px-4 py-2 rounded-xl font-black text-xs text-white active:scale-95">📊 Suivi</button>
                    <button onclick="window.suiviOnglet('secteurs')" class="bg-slate-700 px-4 py-2 rounded-xl font-black text-xs text-white active:scale-95">🧭 Secteurs & voies</button>
                    <button onclick="window.suiviInitialiserConfig()" class="bg-slate-700 px-4 py-2 rounded-xl font-black text-xs text-white active:scale-95">⚙️ Init. 21 secteurs</button>
                    <button onclick="window.suiviExporterCSV()" class="bg-emerald-600 px-4 py-2 rounded-xl font-black text-xs text-white border-2 border-emerald-400 active:scale-95">📥 Export CSV</button>
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
    afficherOngletActif();
};

function afficherOngletActif() {
    if (ongletActif === 'secteurs') afficherVueSecteurs();
    else afficherVueSuivi();
}

// Enregistre une configuration par défaut (21 secteurs, aucune voie).
window.suiviInitialiserConfig = async function() {
    if (!currentClasse) return alert('Sélectionne une classe.');
    const snapshot = await getSuiviConfigSnapshot(currentClasse);
    const base = snapshot || {};
    const configData = {
        secteurs: construireSecteursDefaut(),
        voies: base.voies || {},
        murImage: base.murImage || null
    };
    await setSuiviConfig(currentClasse, configData);
    alert('✅ Configuration initialisée : 21 secteurs prêts à être complétés.');
};

// ============================================================
// VUE SECTEURS & VOIES (ajout / modification des secteurs)
// ============================================================
function afficherVueSecteurs() {
    const content = document.getElementById('suivi-onglet-content');
    if (!content) return;

    const secteurs = Object.entries(config.secteurs || {}).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

    content.innerHTML = `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
            <h4 class="font-bold text-slate-400 uppercase text-xs mb-3">Ajouter un secteur</h4>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-1">
                <input id="suivi-new-secteur-num" placeholder="N° (ex: 22)" class="bg-slate-900 border border-slate-600 rounded p-2 text-white">
                <input id="suivi-new-secteur-label" placeholder="Libellé (ex: Secteur 22)" class="bg-slate-900 border border-slate-600 rounded p-2 text-white col-span-2">
                <button onclick="window.suiviAjouterSecteur()" class="bg-blue-600 rounded p-2 font-black text-white active:scale-95">+ Ajouter</button>
            </div>
            <button onclick="window.suiviAjouterSecteurBloc()" class="mt-2 bg-slate-700 px-3 py-2 rounded-xl font-black text-xs text-white active:scale-95">🧱 + Secteur de bloc (type bloc)</button>
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
                                <div class="text-[10px] text-slate-400">Type : ${s.type || 'voie'} · ${Object.values(config.voies || {}).filter(v => v.secteur === id).length} voie(s)</div>
                            </div>
                            <button onclick="window.suiviSupprimerSecteur('${id}')" class="bg-red-950 text-red-400 px-3 py-1 rounded-lg text-xs font-black active:scale-95">🗑️</button>
                        </div>
                        <div class="mt-2">${afficherVoiesSecteurProf(id)}</div>
                        <div class="mt-2 flex gap-2 flex-wrap">
                            <select id="suivi-voie-secteur-${id}" class="bg-slate-800 border border-slate-600 rounded p-1 text-xs text-white">
                                ${Object.values(config.voies || {}).filter(v => v.secteur === id).length === 0 ? '' : ''}
                            </select>
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
            <span class="text-slate-400">${COULEUR_LABELS[v.couleur] || v.couleur}</span>
            <span class="text-yellow-400 font-black ml-auto">${v.cotation}</span>
            <button onclick="window.suiviSupprimerVoie('${v.id}')" class="bg-red-950 text-red-400 px-2 py-0.5 rounded text-[10px] font-black">✕</button>
        </div>`).join('')}</div>`;
}

function couleurHexProf(couleur) {
    const map = {
        bleue: '#3b82f6', rouge: '#ef4444', verte: '#22c55e', jaune: '#eab308',
        rose: '#ec4899', orange: '#f97316', sable: '#d6b98c', toutes: '#94a3b8'
    };
    return map[couleur] || '#3b82f6';
}

// Ajouter un secteur de voie.
window.suiviAjouterSecteur = async function() {
    const num = document.getElementById('suivi-new-secteur-num').value.trim();
    const label = document.getElementById('suivi-new-secteur-label').value.trim();
    if (!num) return alert('Indique un numéro de secteur.');
    const secteurs = { ...(config.secteurs || {}) };
    secteurs[num] = {
        type: 'voie',
        label: label || `Secteur ${num}`,
        x: 50, y: 50
    };
    await setSuiviConfig(currentClasse, { ...config, secteurs });
    alert(`✅ Secteur ${num} ajouté.`);
};

// Ajouter un secteur de bloc (évolution prévue d'emblée).
window.suiviAjouterSecteurBloc = async function() {
    const num = prompt('Numéro du secteur de bloc ?');
    if (!num) return;
    const label = prompt('Libellé ?', `Bloc ${num}`);
    const secteurs = { ...(config.secteurs || {}) };
    secteurs[num] = { type: 'bloc', label: label || `Bloc ${num}`, x: 50, y: 50 };
    await setSuiviConfig(currentClasse, { ...config, secteurs });
    alert(`✅ Secteur de bloc ${num} ajouté.`);
};

window.suiviSupprimerSecteur = async function(id) {
    if (!confirm(`Supprimer le secteur ${id} et ses voies ?`)) return;
    const secteurs = { ...(config.secteurs || {}) };
    delete secteurs[id];
    const voies = { ...(config.voies || {}) };
    Object.keys(voies).forEach(k => { if (voies[k].secteur === id) delete voies[k]; });
    await setSuiviConfig(currentClasse, { ...config, secteurs, voies });
    afficherVueSecteurs();
};

// Ajouter une voie à un secteur.
window.suiviAjouterVoie = async function(secteurId) {
    if (!config.secteurs || !config.secteurs[secteurId]) return alert('Secteur inexistant.');

    const type = config.secteurs[secteurId].type || 'voie';
    const label = prompt('Libellé de la voie (ex: bleue, sable…)');
    if (label === null) return;

    const couleurChoisie = prompt('Couleur des prises (' + COULEURS.join(', ') + ')', 'bleue');
    if (couleurChoisie === null) return;
    const couleur = COULEURS.includes(couleurChoisie.trim().toLowerCase()) ? couleurChoisie.trim().toLowerCase() : 'toutes';

    let cotation = null;
    if (type === 'voie') {
        cotation = prompt('Cotation (ex: 6A+, 5B…)');
        if (cotation === null) return;
    }

    const id = `${secteurId}-${Date.now()}`;
    const voies = { ...(config.voies || {}) };
    voies[id] = {
        id,
        type,
        secteur: secteurId,
        label: label || 'voie',
        couleur,
        cotation: cotation || ''
    };

    await setSuiviConfig(currentClasse, { ...config, voies });
    afficherVueSecteurs();
};

window.suiviSupprimerVoie = async function(voieId) {
    if (!confirm('Supprimer cette voie ?')) return;
    const voies = { ...(config.voies || {}) };
    delete voies[voieId];
    await setSuiviConfig(currentClasse, { ...config, voies });
    afficherVueSecteurs();
};

// ============================================================
// VUE SUIVI (tableau de progression réelle)
// ============================================================
function afficherVueSuivi() {
    const content = document.getElementById('suivi-onglet-content');
    if (!content) return;

    const eleves = getExistingEleves(currentClasse);
    const voies = config.voies || {};

    // Associer chaque code (numéro) présent dans les montées à un élève local.
    const codesActifs = new Set();
    Object.values(montees).forEach(m => codesActifs.add(String(m.code)));

    const statsParCode = {};
    let totalMontees = 0;
    codesActifs.forEach(code => {
        const mesMontées = Object.values(montees).filter(m => String(m.code) === code);
        totalMontees += mesMontées.length;
        statsParCode[code] = calculerStatsEleve(mesMontées);
    });

    // Statistiques par voie et par secteur.
    const parVoie = agregerParVoie(Object.values(montees));
    const parSecteur = {};
    Object.values(montees).forEach(m => {
        const s = String(m.secteur);
        if (!parSecteur[s]) parSecteur[s] = { tentatives: 0, reussies: 0 };
        parSecteur[s].tentatives++;
        if (m.reussie) parSecteur[s].reussies++;
    });

    // En-tête des colonnes voies (tri par secteur puis cotation).
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
// EXPORT CSV (compatible iDoceo)
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

    // S'assurer de la présence des secteurs.
    let snapshot = await getSuiviConfigSnapshot(currentClasse);
    snapshot = snapshot || {};
    if (!snapshot.secteurs) snapshot.secteurs = construireSecteursDefaut();
    if (!snapshot.voies) snapshot.voies = {};

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