// src/js/modules/escalade/escalade-contrats-prof.js
// Interface professeur du module « Contrats » escalade.
// - Onglet Config : paramétrage (dégaines, erreurs libres, rôles, contrats, couleurs).
// - Onglet Séance : suivi de la séance courante (relais kiosk consolidé).
// - Onglet Séquence : progression multi-séances.
// RGPD : les noms sont résolus en local uniquement (localStorage), jamais transmis.

import { getEtab, db, ref, set } from '../../core/firebase-service.js';
import {
    listenContratsConfig,
    setContratsConfig,
    listenContratsEvaluations
} from './escalade-contrats-firebase.js';
import { construireConfigContratsDefaut, EPREUVES_GRIMPEUR, COTATION_CHIFFRES } from './escalade-contrats-config.js';
import { cibleEpreuve } from './escalade-contrats-core.js';
import { getExistingEleves, getPhotoUrl } from '../../services/admin-service.js';

const STORAGE_RESULTATS = 'eps_arena_escalade_contrats_resultats';

let currentClasse = '';
let config = null;
let evaluations = {};
let resultats = [];
let configListener = null;
let evaluationsListener = null;
let onglet = 'config'; // 'config' | 'seance' | 'sequence'

// ============================================================
// INITIALISATION
// ============================================================
export function initContratsProf(classe) {
    if (!classe) return;
    currentClasse = classe;

    let container = document.getElementById('contrats-prof-container');
    if (!container) {
        const parent = document.getElementById('viewEscaladeSettings');
        if (!parent) return;
        container = document.createElement('div');
        container.id = 'contrats-prof-container';
        container.className = 'space-y-4 mt-6';
        parent.appendChild(container);
    }

    if (configListener) configListener();
    if (evaluationsListener) evaluationsListener();

    configListener = listenContratsConfig(classe, (data) => {
        config = migrerConfig(data && data.roles ? data : construireConfigContratsDefaut());
        resultats = lireResultatsClasse(classe);
        afficherInterface();
    });

    evaluationsListener = listenContratsEvaluations(classe, (data) => {
        evaluations = data || {};
        resultats = consoliderEvaluations();
        afficherInterface();
    });
}

export function cleanupContratsProf() {
    if (configListener) { configListener(); configListener = null; }
    if (evaluationsListener) { evaluationsListener(); evaluationsListener = null; }
}

// Complète les champs manquants (titre, emoji, image, imagePos) d'une config
// existante avec les valeurs par défaut, selon l'id de chaque contrat.
function migrerConfig(config) {
    const defaut = construireConfigContratsDefaut();
    (config.roles || []).forEach(role => {
        const roleDefaut = defaut.roles.find(r => r.id === role.id);
        (role.contrats || []).forEach(contrat => {
            const cDefaut = roleDefaut?.contrats?.find(c => c.id === contrat.id);
            if (!cDefaut) return;
            ['titre', 'emoji', 'image', 'imagePos'].forEach(champ => {
                if (contrat[champ] === undefined || contrat[champ] === null) {
                    contrat[champ] = cDefaut[champ] ?? '';
                }
            });
        });
    });
    if (!config.erreurs || !Array.isArray(config.erreurs) || config.erreurs.length === 0) {
        config.erreurs = defaut.erreurs.map(e => ({ ...e }));
    }
    return config;
}

// ============================================================
// STOCKAGE LOCAL DES RÉSULTATS (nominatif, jamais sur Firebase)
// ============================================================
function lireResultatsClasse(classe) {
    const all = JSON.parse(localStorage.getItem(STORAGE_RESULTATS) || '{}');
    return all[classe] || [];
}

function ecrireResultatsClasse(classe, liste) {
    const all = JSON.parse(localStorage.getItem(STORAGE_RESULTATS) || '{}');
    all[classe] = liste;
    localStorage.setItem(STORAGE_RESULTATS, JSON.stringify(all));
}

// Consolide le relais anonyme (code) en résultats nominatifs locaux.
function consoliderEvaluations() {
    const eleves = getExistingEleves(currentClasse);
    const codeToId = {};
    eleves.forEach(e => {
        if (e.codeAutoEval !== undefined && e.codeAutoEval !== null) {
            codeToId[String(e.codeAutoEval)] = e.id;
        }
    });

    const liste = lireResultatsClasse(currentClasse);
    const deja = new Set(liste.map(r => `${r.code}_${r.timestamp}_${r.role}`));
    let changed = false;

    Object.values(evaluations).forEach(ev => {
        if (!ev || ev.code === undefined || ev.code === null) return;
        const cle = `${ev.code}_${ev.timestamp}_${ev.role}`;
        if (deja.has(cle)) return;
        liste.push({ eleveId: codeToId[String(ev.code)] || null, ...ev });
        deja.add(cle);
        changed = true;
    });

    if (changed) ecrireResultatsClasse(currentClasse, liste);
    return liste;
}

// ============================================================
// AFFICHAGE PRINCIPAL
// ============================================================
function afficherInterface() {
    const container = document.getElementById('contrats-prof-container');
    if (!container) return;

    container.innerHTML = `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
            <div class="flex justify-between items-center flex-wrap gap-2">
                <div>
                    <h3 class="font-black text-blue-400 uppercase text-sm">⛰️ Contrats escalade</h3>
                    <p class="text-xs text-slate-400">Classe : ${currentClasse} · RGPD : codes anonymes, noms en local</p>
                </div>
                <div class="flex gap-2 flex-wrap">
                    <button onclick="window.contratsOnglet('config')" class="${onglet === 'config' ? 'bg-blue-600' : 'bg-slate-700'} px-4 py-2 rounded-xl font-black text-xs text-white active:scale-95">⚙️ Config</button>
                    <button onclick="window.contratsOnglet('seance')" class="${onglet === 'seance' ? 'bg-blue-600' : 'bg-slate-700'} px-4 py-2 rounded-xl font-black text-xs text-white active:scale-95">📋 Séance</button>
                    <button onclick="window.contratsOnglet('sequence')" class="${onglet === 'sequence' ? 'bg-blue-600' : 'bg-slate-700'} px-4 py-2 rounded-xl font-black text-xs text-white active:scale-95">📈 Séquence</button>
                    <button onclick="window.contratsTransmettre()" class="bg-emerald-600 px-4 py-2 rounded-xl font-black text-xs text-white border-2 border-emerald-400 active:scale-95">📡 Transmettre</button>
                </div>
            </div>
        </div>
        <div id="contrats-onglet-content" class="space-y-4"></div>
    `;

    if (!config) {
        const contenu = document.getElementById('contrats-onglet-content');
        if (contenu) contenu.innerHTML = '<p class="text-slate-400 text-sm p-4">Chargement…</p>';
        return;
    }

    if (onglet === 'config') renderConfig();
    else if (onglet === 'seance') renderSeance();
    else renderSequence();
}

window.contratsOnglet = function(ong) {
    onglet = ong;
    afficherInterface();
};

// ============================================================
// ONGLET CONFIG
// ============================================================
function renderConfig() {
    const el = document.getElementById('contrats-onglet-content');
    if (!el) return;

    const erreursHTML = (config.erreurs || []).map((e, i) => `
        <div class="flex items-center gap-2">
            <input value="${e.label}" onchange="window.contratsSetErreur(${i}, this.value)"
                   class="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs font-bold text-white">
            <button onclick="window.contratsSupprimerErreur(${i})" class="bg-red-600 px-3 py-2 rounded-lg font-black text-xs text-white active:scale-95">✕</button>
        </div>
    `).join('');

    const rolesHTML = (config.roles || []).map((r) => {
        const contratsHTML = (r.contrats || []).map((c, ci) => contratHTML(r.id, c, ci)).join('');
        return `
            <div class="bg-slate-900 p-3 rounded-xl border border-slate-700">
                <div class="flex items-center gap-2 mb-2">
                    <label class="flex items-center gap-2 text-xs font-bold text-slate-300">
                        <input type="checkbox" ${r.actif ? 'checked' : ''} onchange="window.contratsToggleRole('${r.id}')">
                        Actif
                    </label>
                    <input value="${r.label}" onchange="window.contratsSetRoleLabel('${r.id}', this.value)"
                           class="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm font-black text-white">
                </div>
                <div class="space-y-2">${contratsHTML}</div>
            </div>
        `;
    }).join('');

    el.innerHTML = `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 space-y-4">
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="text-xs font-bold text-slate-400 uppercase">Nb dégaines max (sommet)</label>
                    <input type="number" min="1" max="9" value="${config.nbDegainesMax}"
                           onchange="window.contratsSetGlobal('nbDegainesMax', parseInt(this.value))"
                           class="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-lg font-black text-white">
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-400 uppercase">Séance courante</label>
                    <input type="number" min="1" value="${config.seance}"
                           onchange="window.contratsSetGlobal('seance', parseInt(this.value))"
                           class="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-lg font-black text-white">
                </div>
            </div>
            <div>
                <label class="text-xs font-bold text-slate-400 uppercase">Libellé de séquence</label>
                <input value="${config.sequence || ''}" onchange="window.contratsSetGlobal('sequence', this.value)"
                       class="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm font-black text-white">
            </div>
            <div>
                <p class="text-xs font-bold text-slate-400 uppercase mb-1">Codes erreurs (saisie libre)</p>
                <div class="space-y-2">${erreursHTML}</div>
                <button onclick="window.contratsAjouterErreur()" class="mt-2 bg-slate-700 px-4 py-2 rounded-xl font-black text-xs text-white active:scale-95">+ Ajouter un code erreur</button>
            </div>
            <div class="space-y-3">${rolesHTML}</div>
            <div class="flex gap-2">
                <button onclick="window.contratsEnregistrer()" class="flex-1 bg-emerald-600 py-3 rounded-2xl font-black text-white active:scale-95">💾 Enregistrer</button>
                <button onclick="window.contratsReinitialiser()" class="bg-amber-600 py-3 px-4 rounded-2xl font-black text-white active:scale-95">♻️ Réinitialiser</button>
            </div>
        </div>
    `;
}

function contratHTML(roleId, c, ci) {
    if (c.mode === 'grimpeur') {
        const epreuvesHTML = (c.epreuves || []).map((ep, ei) => epreuveHTML(roleId, ci, ei, ep)).join('');
        return `
            <div class="bg-slate-800 p-3 rounded-xl border border-slate-600 space-y-2">
                <div class="flex items-center gap-2">
                    <input type="color" value="${c.couleur}" onchange="window.contratsSetContrat('${roleId}', ${ci}, 'couleur', this.value)" class="w-8 h-8 rounded cursor-pointer bg-slate-700 border-0">
                    <input value="${c.label}" onchange="window.contratsSetContrat('${roleId}', ${ci}, 'label', this.value)"
                           class="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm font-black text-white">
                </div>
                <div class="flex items-center gap-2">
                    <input value="${c.emoji || ''}" onchange="window.contratsSetContrat('${roleId}', ${ci}, 'emoji', this.value)"
                           class="w-14 bg-slate-900 border border-slate-600 rounded-lg px-2 py-2 text-center font-black text-white" placeholder="😀">
                    <input value="${c.titre || ''}" onchange="window.contratsSetContrat('${roleId}', ${ci}, 'titre', this.value)"
                           placeholder="Titre du niveau" class="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm font-black text-white">
                </div>
                <div class="flex items-center gap-2 text-xs">
                    <input value="${c.image || ''}" onchange="window.contratsSetContrat('${roleId}', ${ci}, 'image', this.value)"
                           placeholder="Chemin image" class="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-2 py-2 font-bold text-white">
                    <input value="${c.imagePos || ''}" onchange="window.contratsSetContrat('${roleId}', ${ci}, 'imagePos', this.value)"
                           placeholder="0% 0%" class="w-24 bg-slate-900 border border-slate-600 rounded-lg px-2 py-2 font-bold text-white">
                </div>
                <input value="${c.descriptif || ''}" onchange="window.contratsSetContrat('${roleId}', ${ci}, 'descriptif', this.value)"
                       placeholder="Descriptif du contrat" class="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs font-bold text-white">
                <div class="space-y-2">${epreuvesHTML}</div>
                <button onclick="window.contratsAjouterEpreuve('${roleId}', ${ci})" class="w-full bg-slate-700 py-2 rounded-xl font-black text-xs text-white active:scale-95">+ Ajouter une épreuve</button>
            </div>
        `;
    }

    return `
        <div class="bg-slate-800 p-3 rounded-xl border border-slate-600 space-y-2">
            <div class="flex items-center gap-2">
                <input type="color" value="${c.couleur}" onchange="window.contratsSetContrat('${roleId}', ${ci}, 'couleur', this.value)" class="w-8 h-8 rounded cursor-pointer bg-slate-700 border-0">
                <input value="${c.label}" onchange="window.contratsSetContrat('${roleId}', ${ci}, 'label', this.value)"
                       class="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm font-black text-white">
            </div>
            <div class="flex items-center gap-2">
                <input value="${c.emoji || ''}" onchange="window.contratsSetContrat('${roleId}', ${ci}, 'emoji', this.value)"
                       class="w-14 bg-slate-900 border border-slate-600 rounded-lg px-2 py-2 text-center font-black text-white" placeholder="😀">
                <input value="${c.titre || ''}" onchange="window.contratsSetContrat('${roleId}', ${ci}, 'titre', this.value)"
                       placeholder="Titre du niveau" class="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm font-black text-white">
            </div>
            <div class="flex items-center gap-2 text-xs">
                <input value="${c.image || ''}" onchange="window.contratsSetContrat('${roleId}', ${ci}, 'image', this.value)"
                       placeholder="Chemin image" class="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-2 py-2 font-bold text-white">
                <input value="${c.imagePos || ''}" onchange="window.contratsSetContrat('${roleId}', ${ci}, 'imagePos', this.value)"
                       placeholder="0% 0%" class="w-24 bg-slate-900 border border-slate-600 rounded-lg px-2 py-2 font-bold text-white">
            </div>
            <input value="${c.descriptif || ''}" onchange="window.contratsSetContrat('${roleId}', ${ci}, 'descriptif', this.value)"
                   placeholder="Descriptif du contrat" class="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs font-bold text-white">
            <div>
                <label class="text-xs text-slate-400 uppercase">Seuil de validation (somme des notes 1-3)</label>
                <input type="number" min="0" value="${c.seuil ?? 0}"
                       onchange="window.contratsSetContrat('${roleId}', ${ci}, 'seuil', parseInt(this.value))"
                       class="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 font-bold text-white">
            </div>
            <p class="text-[10px] text-slate-500">${(c.competences || []).length} compétence(s) — ${(c.competences || []).map(x => x.label).join(' · ')}</p>
        </div>
    `;
}

function erreurTypeOptions(selected) {
    const types = (config.erreurs || []).map(e => `<option value="${e.id}" ${selected === e.id ? 'selected' : ''}>${e.label}</option>`).join('');
    return `<option value="toutes" ${selected === 'toutes' ? 'selected' : ''}>Toutes erreurs</option>${types}`;
}

function epreuveHTML(roleId, ci, ei, ep) {
    const epreuvesOptions = EPREUVES_GRIMPEUR.map(e => `<option value="${e.id}" ${ep.type === e.id ? 'selected' : ''}>${e.label}</option>`).join('');
    const utiliseErreur = ep.type.includes('erreurs');
    const utiliseCotation = ep.type.includes('cotation');
    const objectif = cibleEpreuve(ep, config?.nbDegainesMax || 7);
    const avecTolerance = utiliseErreur && (ep.erreursMax ?? 0) > 0;

    const erreursBlock = utiliseErreur ? `
        <div class="grid grid-cols-2 gap-2 text-xs">
            <div>
                <label class="text-slate-400 uppercase">Erreurs max</label>
                <input type="number" min="0" max="9" value="${ep.erreursMax ?? 0}"
                       onchange="window.contratsSetEpreuve('${roleId}', ${ci}, ${ei}, 'erreursMax', parseInt(this.value))"
                       class="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-2 font-bold text-white">
            </div>
            <div>
                <label class="text-slate-400 uppercase">Type d'erreur</label>
                <select onchange="window.contratsSetEpreuve('${roleId}', ${ci}, ${ei}, 'erreurType', this.value)"
                        class="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-2 font-bold text-white">${erreurTypeOptions(ep.erreurType)}</select>
            </div>
        </div>
    ` : '';

    return `
        <div class="bg-slate-900 p-2 rounded-lg border border-slate-700 space-y-2">
            <div class="flex items-center gap-2">
                <select onchange="window.contratsSetEpreuve('${roleId}', ${ci}, ${ei}, 'type', this.value)"
                        class="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-2 py-2 text-xs font-bold text-white">${epreuvesOptions}</select>
                <button onclick="window.contratsSupprimerEpreuve('${roleId}', ${ci}, ${ei})" class="bg-red-600 px-2 py-2 rounded-lg font-black text-xs text-white active:scale-95">✕</button>
            </div>
            <label class="flex items-center gap-2 text-xs font-bold text-slate-300">
                <input type="checkbox" ${ep.exigeSommet !== false ? 'checked' : ''} onchange="window.contratsSetEpreuve('${roleId}', ${ci}, ${ei}, 'exigeSommet', this.checked)">
                Exige le sommet (nb dégaines max)
            </label>
            ${erreursBlock}
            ${utiliseCotation ? `
                <div class="grid grid-cols-2 gap-2 text-xs">
                    <div>
                        <label class="text-slate-400 uppercase">Cotation chiffre min</label>
                        <select onchange="window.contratsSetEpreuve('${roleId}', ${ci}, ${ei}, 'cotationChiffre', parseInt(this.value))"
                                class="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-2 font-bold text-white">
                            ${COTATION_CHIFFRES.map(n => `<option value="${n}" ${ep.cotationChiffre === n ? 'selected' : ''}>${n}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="text-slate-400 uppercase">Lettre min</label>
                        <select onchange="window.contratsSetEpreuve('${roleId}', ${ci}, ${ei}, 'cotationLettre', this.value)"
                                class="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-2 font-bold text-white">
                            ${['a', 'b', 'c'].map(l => `<option value="${l}" ${ep.cotationLettre === l ? 'selected' : ''}>${l}</option>`).join('')}
                        </select>
                    </div>
                </div>
            ` : ''}
            <p class="text-[10px] font-bold text-blue-300">Objectif : je cherche ${objectif}${avecTolerance ? ' ou ' + (objectif + 1) : ''}</p>
        </div>
    `;
}

// ============================================================
// HANDLERS DE CONFIG (mutation en mémoire, enregistrée à part)
// ============================================================
window.contratsSetGlobal = function(field, value) {
    if (!config) return;
    if (field === 'nbDegainesMax') config.nbDegainesMax = Math.max(1, Math.min(9, value || 1));
    else if (field === 'seance') config.seance = Math.max(1, value || 1);
    else config[field] = value;
};

window.contratsToggleRole = function(roleId) {
    const role = (config.roles || []).find(r => r.id === roleId);
    if (role) role.actif = !role.actif;
};

window.contratsSetRoleLabel = function(roleId, value) {
    const role = (config.roles || []).find(r => r.id === roleId);
    if (role) role.label = value;
};

window.contratsSetContrat = function(roleId, ci, field, value) {
    const role = (config.roles || []).find(r => r.id === roleId);
    if (!role || !role.contrats || !role.contrats[ci]) return;
    role.contrats[ci][field] = value;
};

window.contratsSetEpreuve = function(roleId, ci, ei, field, value) {
    const role = (config.roles || []).find(r => r.id === roleId);
    const ep = role?.contrats?.[ci]?.epreuves?.[ei];
    if (!ep) return;
    ep[field] = value;
};

window.contratsAjouterEpreuve = function(roleId, ci) {
    const role = (config.roles || []).find(r => r.id === roleId);
    if (!role || !role.contrats || !role.contrats[ci]) return;
    if (!role.contrats[ci].epreuves) role.contrats[ci].epreuves = [];
    role.contrats[ci].epreuves.push({
        type: 'degaines',
        erreurType: null,
        exigeSommet: true,
        cibleDegaines: null,
        erreursMax: 0,
        cotationChiffre: 5,
        cotationLettre: 'a'
    });
    renderConfig();
};

window.contratsSupprimerEpreuve = function(roleId, ci, ei) {
    const role = (config.roles || []).find(r => r.id === roleId);
    if (!role || !role.contrats || !role.contrats[ci]) return;
    role.contrats[ci].epreuves.splice(ei, 1);
    renderConfig();
};

window.contratsSetErreur = function(index, value) {
    if (config.erreurs && config.erreurs[index]) config.erreurs[index].label = value;
};

window.contratsAjouterErreur = function() {
    if (!config.erreurs) config.erreurs = [];
    config.erreurs.push({ id: `erreur-${Date.now()}`, label: 'Nouveau code erreur' });
    renderConfig();
};

window.contratsSupprimerErreur = function(index) {
    config.erreurs.splice(index, 1);
    renderConfig();
};

window.contratsEnregistrer = async function() {
    if (!currentClasse || !config) return;
    try {
        await setContratsConfig(currentClasse, config);
        alert('✅ Configuration enregistrée.');
    } catch (err) {
        console.error(err);
        alert(`❌ Erreur enregistrement : ${err.message}`);
    }
};

window.contratsReinitialiser = async function() {
    if (!currentClasse) return;
    if (!confirm(`⚠️ Réinitialiser la config avec les valeurs par défaut ?\nCela remplacera tes contrats, couleurs et épreuves.`)) return;
    config = construireConfigContratsDefaut();
    try {
        await setContratsConfig(currentClasse, config);
        alert(`✅ Config réinitialisée. Clique « Transmettre » pour l'envoyer aux iPads.`);
    } catch (err) {
        console.error(err);
        alert(`❌ Erreur : ${err.message}`);
    }
    afficherInterface();
};

// Validation prof : bascule le carré « validé » sur la dernière évaluation
// (élève + rôle + séance courante). Stockée en local uniquement.
window.contratsValider = function(eleveId, roleId) {
    const seance = config?.seance || 1;
    const liste = lireResultatsClasse(currentClasse);
    let cibleIdx = -1;
    let cible = null;
    liste.forEach((r, idx) => {
        if (r.eleveId === eleveId && r.role === roleId && String(r.seance) === String(seance)) {
            if (!cible || (r.timestamp || 0) > (cible.timestamp || 0)) {
                cible = r;
                cibleIdx = idx;
            }
        }
    });
    if (cibleIdx < 0) return;
    liste[cibleIdx].valideProf = liste[cibleIdx].valideProf === true ? false : true;
    ecrireResultatsClasse(currentClasse, liste);
    resultats = liste;
    afficherInterface();
};

// ============================================================
// ONGLET SÉANCE
// ============================================================
function renderSeance() {
    const el = document.getElementById('contrats-onglet-content');
    if (!el) return;

    const eleves = getExistingEleves(currentClasse);
    const seanceCourante = config?.seance || 1;
    const rolesActifs = (config?.roles || []).filter(r => r.actif);

    const parEleve = {};
    resultats.filter(r => String(r.seance) === String(seanceCourante)).forEach(r => {
        if (!r.eleveId) return;
        if (!parEleve[r.eleveId]) parEleve[r.eleveId] = {};
        const prev = parEleve[r.eleveId][r.role];
        if (!prev || (r.timestamp || 0) > (prev.timestamp || 0)) parEleve[r.eleveId][r.role] = r;
    });

    if (eleves.length === 0) {
        el.innerHTML = `<div class="bg-slate-800 p-6 rounded-2xl border border-slate-700 text-center"><p class="text-slate-400">Aucun élève dans cette classe.</p></div>`;
        return;
    }

    const lignes = eleves.map(e => {
        const cellules = rolesActifs.map(r => {
            const ev = parEleve[e.id]?.[r.id];
            if (!ev) return '<td class="px-2 py-2 text-center text-slate-600">—</td>';
            const contrat = (config.roles.find(x => x.id === r.id)?.contrats || []).find(c => c.id === ev.contrat);
            const couleur = contrat?.couleur || '#64748b';
            const num = numeroContrat(r, contrat);
            const suffix = (r.contrats || []).filter(x => x.label === contrat?.label).length > 1 ? ` N°${num}` : '';
            const valideProf = ev.valideProf === true;
            return `<td class="px-2 py-2">
                <div class="flex items-center justify-center gap-1.5">
                    <button onclick="window.contratsValider('${e.id}', '${r.id}')" title="Validation prof"
                            class="w-6 h-6 rounded-sm border-2 ${valideProf ? 'bg-emerald-500 border-emerald-300' : 'bg-transparent border-slate-500 hover:border-slate-300'} active:scale-95"></button>
                    <span title="Auto-éval élève : ${contrat?.label || ev.contrat}${suffix} ${ev.valide ? 'réussi' : 'échoué'}"
                          class="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black text-white border border-white/40"
                          style="background:${couleur}">${ev.valide ? '✓' : '✗'}</span>
                </div>
                <div class="text-[9px] font-bold text-slate-400 mt-1">${contrat?.label || ev.contrat}${suffix}</div>
            </td>`;
        }).join('');
        return `<tr class="border-t border-slate-700"><td class="px-2 py-2"><div class="flex items-center gap-2"><div class="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm shrink-0" data-photo="${e.id}">👤</div><button onclick="window.contratsOuvrirFiche('${e.id}')" class="text-xs font-bold text-white hover:text-blue-400 text-left">${e.prenom} ${e.nom}</button><div class="flex gap-1 ml-1">${dotsPositionnement(e.id, rolesActifs)}</div></div></td>${cellules}</tr>`;
    }).join('');

    const entetes = rolesActifs.map(r => `<th class="px-2 py-2 text-xs uppercase text-slate-400">${r.label}</th>`).join('');

    el.innerHTML = `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
            <h4 class="font-black text-white text-sm mb-1">📋 Séance ${seanceCourante} — ${config?.sequence || ''}</h4>
            <p class="text-[10px] text-slate-500 mb-2">◻ validation prof (cliquer) · ⚪ auto-éval élève (✓ réussi / ✗ échoué)</p>
            <div class="overflow-x-auto">
                <table class="w-full text-left">
                    <thead><tr><th class="px-2 py-2 text-xs uppercase text-slate-400">Élève</th>${entetes}</tr></thead>
                    <tbody>${lignes}</tbody>
                </table>
            </div>
        </div>
    `;
    chargerPhotosEleves(eleves);
}

// ============================================================
// ONGLET SÉQUENCE
// ============================================================
function renderSequence() {
    const el = document.getElementById('contrats-onglet-content');
    if (!el) return;

    const eleves = getExistingEleves(currentClasse);
    const rolesActifs = (config?.roles || []).filter(r => r.actif);
    const seances = [...new Set(resultats.map(r => parseInt(r.seance, 10)).filter(n => !isNaN(n)))].sort((a, b) => a - b);

    if (eleves.length === 0 || seances.length === 0) {
        el.innerHTML = `<div class="bg-slate-800 p-6 rounded-2xl border border-slate-700 text-center"><p class="text-slate-400">Aucune donnée à afficher.</p></div>`;
        return;
    }

    const lignes = eleves.map(e => {
        const cellules = seances.map(s => {
            const evs = resultats.filter(r => r.eleveId === e.id && String(r.seance) === String(s));
            const badges = evs.map(ev => {
                const role = (config.roles || []).find(x => x.id === ev.role);
                const contrat = (role?.contrats || []).find(c => c.id === ev.contrat);
                const couleur = contrat?.couleur || '#64748b';
                const init = (role?.label || ev.role).charAt(0).toUpperCase();
                return `<span class="inline-block px-1.5 py-0.5 rounded text-white text-[10px] font-black mr-1" style="background:${couleur}">${init} ${ev.valide ? '✓' : '✗'}</span>`;
            }).join('');
            return `<td class="px-2 py-2 text-center">${badges || '<span class="text-slate-600">—</span>'}</td>`;
        }).join('');
        return `<tr class="border-t border-slate-700"><td class="px-2 py-2"><div class="flex items-center gap-2"><div class="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm shrink-0" data-photo="${e.id}">👤</div><button onclick="window.contratsOuvrirFiche('${e.id}')" class="text-xs font-bold text-white hover:text-blue-400 text-left">${e.prenom} ${e.nom}</button><div class="flex gap-1 ml-1">${dotsPositionnement(e.id, rolesActifs)}</div></div></td>${cellules}</tr>`;
    }).join('');

    const entetes = seances.map(s => `<th class="px-2 py-2 text-xs uppercase text-slate-400">S${s}</th>`).join('');

    el.innerHTML = `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
            <h4 class="font-black text-white text-sm mb-2">📈 ${config?.sequence || 'Séquence'} — progression</h4>
            <div class="overflow-x-auto">
                <table class="w-full text-left">
                    <thead><tr><th class="px-2 py-2 text-xs uppercase text-slate-400">Élève</th>${entetes}</tr></thead>
                    <tbody>${lignes}</tbody>
                </table>
            </div>
        </div>
    `;
    chargerPhotosEleves(eleves);
}

// ============================================================
// PHOTOS + FICHE ÉLÈVE
// ============================================================
function numeroContrat(role, contrat) {
    if (!role || !contrat) return 0;
    const memeCouleur = (role.contrats || []).filter(c => c.label === contrat.label);
    return memeCouleur.findIndex(c => c.id === contrat.id) + 1;
}

function dernierContratValide(eleveId, role) {
    const valides = resultats.filter(r => r.eleveId === eleveId && r.role === role.id && r.valide);
    if (!valides.length) return null;
    const dernier = valides.reduce((a, b) => ((b.timestamp || 0) > (a.timestamp || 0) ? b : a));
    return (role.contrats || []).find(c => c.id === dernier.contrat) || null;
}

function dotsPositionnement(eleveId, roles) {
    return roles.map(r => {
        const c = dernierContratValide(eleveId, r);
        const couleur = c?.couleur || '#475569';
        const suffix = c && (r.contrats || []).filter(x => x.label === c.label).length > 1 ? ` N°${numeroContrat(r, c)}` : '';
        const titre = c ? `${r.label} : ${c.label}${suffix}` : `${r.label} : aucun`;
        return `<span title="${titre}" class="inline-block w-3 h-3 rounded-full border border-slate-500" style="background:${couleur}"></span>`;
    }).join('');
}

async function chargerPhotosEleves(eleves) {
    for (const e of eleves) {
        try {
            const url = await getPhotoUrl(e.id);
            if (url) {
                document.querySelectorAll(`[data-photo="${e.id}"]`).forEach(el => {
                    el.innerHTML = `<img src="${url}" class="w-8 h-8 rounded-full object-cover">`;
                });
            }
        } catch (err) { /* photo absente : on garde l'emoji */ }
    }
}

window.contratsOuvrirFiche = function(eleveId) {
    const eleve = getExistingEleves(currentClasse).find(e => e.id === eleveId);
    if (!eleve) return;

    const modal = document.createElement('div');
    modal.id = 'contrats-fiche-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60';
    modal.innerHTML = `
        <div class="bg-slate-800 rounded-2xl border border-slate-600 max-w-2xl w-full max-h-[85vh] overflow-y-auto p-5">
            <div class="flex items-center gap-3 mb-4">
                <div id="contrats-fiche-photo" class="w-14 h-14 rounded-full bg-slate-700 flex items-center justify-center text-2xl shrink-0">👤</div>
                <div>
                    <h3 class="text-lg font-black text-white">${eleve.prenom} ${eleve.nom}</h3>
                    <p class="text-xs text-slate-400">${currentClasse} · ${config?.sequence || ''}</p>
                </div>
                <button onclick="document.getElementById('contrats-fiche-modal').remove()" class="ml-auto bg-slate-700 px-3 py-2 rounded-xl font-black text-xs text-white">✕</button>
            </div>
            <div id="contrats-fiche-corps"></div>
        </div>
    `;
    document.body.appendChild(modal);

    getPhotoUrl(eleveId).then(url => {
        const ph = document.getElementById('contrats-fiche-photo');
        if (ph && url) ph.innerHTML = `<img src="${url}" class="w-14 h-14 rounded-full object-cover">`;
    }).catch(() => {});

    const corps = document.getElementById('contrats-fiche-corps');
    const roles = config?.roles || [];
    const evs = resultats.filter(r => r.eleveId === eleveId).sort((a, b) => (parseInt(a.seance, 10) || 0) - (parseInt(b.seance, 10) || 0));

    if (evs.length === 0) {
        corps.innerHTML = '<p class="text-slate-400 text-sm">Aucune évaluation enregistrée.</p>';
        return;
    }

    // Dernier niveau validé par rôle.
    const dernierValide = {};
    evs.filter(ev => ev.valide).forEach(ev => {
        const prev = dernierValide[ev.role];
        if (!prev || (ev.timestamp || 0) > (prev.timestamp || 0)) dernierValide[ev.role] = ev;
    });
    const resume = roles.filter(r => dernierValide[r.id]).map(r => {
        const ev = dernierValide[r.id];
        const contrat = (r.contrats || []).find(c => c.id === ev.contrat);
        const num = numeroContrat(r, contrat);
        const suffix = (r.contrats || []).filter(x => x.label === contrat?.label).length > 1 ? ` N°${num}` : '';
        return `<span class="inline-block px-2 py-1 rounded-lg text-white text-xs font-black mr-1 mb-1" style="background:${contrat?.couleur || '#64748b'}">${r.label} : ${contrat?.label || ev.contrat}${suffix}</span>`;
    }).join('');

    const parSeance = {};
    evs.forEach(ev => {
        const s = String(ev.seance);
        if (!parSeance[s]) parSeance[s] = [];
        parSeance[s].push(ev);
    });

    const detailSeances = Object.keys(parSeance).sort((a, b) => parseInt(a, 10) - parseInt(b, 10)).map(s => {
        const items = parSeance[s].map(ev => ficheLigneEvaluation(ev, roles)).join('');
        return `
            <div class="mb-4">
                <h4 class="text-xs font-black text-blue-400 uppercase mb-2">Séance ${s}</h4>
                <div class="space-y-2">${items}</div>
            </div>
        `;
    }).join('');

    corps.innerHTML = (resume ? `<div class="mb-4"><p class="text-xs font-bold text-slate-400 uppercase mb-1">Dernier niveau validé</p><div>${resume}</div></div>` : '') + detailSeances;
};

function ficheLigneEvaluation(ev, roles) {
    const role = roles.find(x => x.id === ev.role);
    const contrat = (role?.contrats || []).find(c => c.id === ev.contrat);
    const couleur = contrat?.couleur || '#64748b';
    const num = numeroContrat(role, contrat);
    const suffix = (role?.contrats || []).filter(x => x.label === contrat?.label).length > 1 ? ` N°${num}` : '';
    const libelle = contrat ? `${contrat.label}${suffix}` : ev.contrat;

    let detail = '';
    if (contrat && contrat.mode === 'grimpeur') {
        const ep = (ev.epreuves || []).map(e => `<span class="${e.valide ? 'text-emerald-400' : 'text-red-400'}">${e.scoreParlant}${e.valide ? '✓' : '✗'}</span>`).join(' · ');
        detail = `<div class="text-[10px] text-slate-500 mt-1">Épreuves : ${ep}</div>`;
    } else if (ev.notes) {
        detail = `<div class="text-[10px] text-slate-500 mt-1">Notes : ${Object.values(ev.notes).join(' / ')}</div>`;
    }

    return `
        <div class="bg-slate-900 p-3 rounded-xl border border-slate-700">
            <div class="flex items-center gap-2">
                <span class="inline-block w-3 h-3 rounded-full shrink-0" style="background:${couleur}"></span>
                <span class="text-sm font-bold text-white">${role?.label || ev.role} — ${libelle}</span>
                <span class="ml-auto text-xs font-black ${ev.valide ? 'text-emerald-400' : 'text-red-400'}">${ev.valide ? '✓ Validé' : '✗ Non validé'}</span>
            </div>
            ${detail}
        </div>
    `;
}

// ============================================================
// TRANSMISSION (activité dédiée) + ENREGISTREMENT MODULE
// ============================================================
window.contratsTransmettre = async function() {
    if (!currentClasse) return alert('Sélectionne une classe.');
    if (!config) return;

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const baseProf = `${getEtab()}/profs/${profCode}`;

    try {
        await setContratsConfig(currentClasse, config);
        await set(ref(db, `${baseProf}/${currentClasse}/config`), { activite: 'escalade-contrats' });
        await set(ref(db, `${baseProf}/active_classes/${currentClasse}`), true);
        alert('✅ Contrats transmis aux iPads !');
    } catch (err) {
        console.error(err);
        alert(`❌ Erreur transmission : ${err.message}`);
    }
};

export function registerContratsModule() {
    return {
        id: 'escalade-contrats',
        label: '⛰️ Contrats escalade',
        icon: '⛰️',
        initProf: initContratsProf,
        initKiosk: (classe) => import('./escalade-contrats-kiosk.js').then(m => m.initContratsKiosk(classe)),
        transmettre: (classe) => { currentClasse = classe; return window.contratsTransmettre(); },
        isDefault: false,
        cleanup: cleanupContratsProf
    };
}


