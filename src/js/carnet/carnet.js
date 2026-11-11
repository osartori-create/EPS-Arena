// src/js/carnet/carnet.js
// "Super carnet" — tableau générique élèves × colonnes typées, éditable et évolutif.
// Champs : note (barème), mesure (unité), statut (badge à légende), texte.
// Données (localStorage, RGPD) :
//   eps_arena_carnet_champs_<classe>   = [{ id, type, libelle, groupe, ordre, bareme, unite, legende }]
//   eps_arena_carnet_valeurs_<classe>  = { [eleveId]: { [champId]: valeur } }

import { getExistingEleves } from '../services/admin-service.js';
import { getCurrentClasse } from '../core/live-engine.js';
import './fiche-eleve.js'; // enregistre window.ouvrirFicheEleve

const PREFIX_CHAMPS = 'eps_arena_carnet_champs_';
const PREFIX_VALEURS = 'eps_arena_carnet_valeurs_';

let currentClasse = '';
let currentGroupe = '';
let currentValeurs = {};

const TYPES = {
    note:   { label: 'Note', icone: '🔢', defaut: { bareme: 20 } },
    mesure: { label: 'Mesure', icone: '📏', defaut: { unite: '' } },
    statut: { label: 'Statut', icone: '✅', defaut: { legende: [{ v: '0', label: 'Non' }, { v: '1', label: 'En cours' }, { v: '2', label: 'Validé' }] } },
    texte:  { label: 'Texte', icone: '💬', defaut: {} },
    calcul: { label: 'Calcul', icone: '🧮', defaut: {} },
};

function lireChamps(classe) { return JSON.parse(localStorage.getItem(PREFIX_CHAMPS + classe) || '[]'); }
function ecrireChamps(classe, d) { localStorage.setItem(PREFIX_CHAMPS + classe, JSON.stringify(d)); }
function lireValeurs(classe) { return JSON.parse(localStorage.getItem(PREFIX_VALEURS + classe) || '{}'); }
function ecrireValeurs(classe, d) { localStorage.setItem(PREFIX_VALEURS + classe, JSON.stringify(d)); }

function genererChampId() { return 'c_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1000); }
function getChamp(id) { return lireChamps(currentClasse).find(c => c.id === id) || null; }
function getValeur(eid, cid) { return (currentValeurs[eid] && currentValeurs[eid][cid] !== undefined) ? currentValeurs[eid][cid] : null; }

function setValeur(eid, cid, v) {
    if (!currentValeurs[eid]) currentValeurs[eid] = {};
    if (v === null || v === undefined || v === '') delete currentValeurs[eid][cid];
    else currentValeurs[eid][cid] = v;
    ecrireValeurs(currentClasse, currentValeurs);
}

function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function escAttr(s) { return esc(s).replace(/'/g, '&#39;'); }

function couleurNote(ratio) {
    if (ratio === null) return '#64748b';
    if (ratio >= 0.75) return '#22c55e';
    if (ratio >= 0.5) return '#3b82f6';
    if (ratio >= 0.25) return '#f59e0b';
    return '#ef4444';
}

const COULEURS_STATUT = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const ECHELLE_LETTRES = [
    { v: 'A', label: 'A', couleur: '#22c55e' },
    { v: 'B', label: 'B', couleur: '#84cc16' },
    { v: 'C', label: 'C', couleur: '#eab308' },
    { v: 'D', label: 'D', couleur: '#f97316' },
    { v: 'E', label: 'E', couleur: '#ef4444' },
    { v: 'F', label: 'F', couleur: '#b91c1c' },
];

// Échelle effective d'une colonne "note" (compatible avec les anciennes colonnes).
function echelleNote(champ) {
    return champ.echelle || { mode: 'numerique', bareme: champ.bareme || 20 };
}

// Affichage + couleur d'une valeur de note.
function noteAffichage(champ, v) {
    const ech = echelleNote(champ);
    if (ech.mode === 'lettres') {
        const e = ECHELLE_LETTRES.find(x => x.v === v);
        return e ? { aff: e.label, couleur: e.couleur } : { aff: '·', couleur: '#64748b' };
    }
    if (ech.mode === 'liste') {
        const vals = ech.valeurs || [];
        const i = vals.indexOf(v);
        return i >= 0 ? { aff: v, couleur: COULEURS_STATUT[i % COULEURS_STATUT.length] } : { aff: '·', couleur: '#64748b' };
    }
    const num = parseFloat(v);
    const ok = !isNaN(num) && v !== null && v !== undefined && v !== '';
    const bareme = ech.bareme || 20;
    const ratio = ok && bareme ? num / bareme : null;
    return ok ? { aff: num + ' / ' + bareme, couleur: couleurNote(ratio) } : { aff: '·', couleur: '#64748b' };
}

// Calcule la valeur d'une colonne "calcul" pour un élève (moyenne / somme / % de documents).
function calculerChamp(champ, eid) {
    const calc = champ.calcul || {};
    const sources = lireChamps(currentClasse).filter(c => c.groupe === calc.dossier && c.id !== champ.id);
    if (calc.fonction === 'pourcentage') {
        const statuts = sources.filter(c => c.type === 'statut');
        if (!statuts.length) return { aff: '·', couleur: '#64748b' };
        const valides = (calc.valides || '').split(',').map(x => x.trim()).filter(Boolean);
        let fait = 0;
        statuts.forEach(c => {
            const v = getValeur(eid, c.id);
            if (v === null || v === undefined || v === '') return;
            if (!valides.length || valides.some(x => String(x) === String(v))) fait++;
        });
        const pct = Math.round(fait / statuts.length * 100);
        const couleur = pct >= 100 ? '#22c55e' : pct >= 50 ? '#3b82f6' : pct > 0 ? '#f59e0b' : '#64748b';
        return { aff: pct + '%', couleur };
    }
    if (calc.fonction === 'somme') {
        let somme = 0, n = 0;
        sources.filter(c => c.type === 'note' || c.type === 'mesure').forEach(c => {
            const v = parseFloat(getValeur(eid, c.id));
            if (!isNaN(v)) { somme += v; n++; }
        });
        return n ? { aff: String(Math.round(somme * 100) / 100), couleur: '#e2e8f0' } : { aff: '·', couleur: '#64748b' };
    }
    // moyenne (défaut) : notes numériques normalisées sur 20
    let total = 0, n = 0;
    sources.filter(c => c.type === 'note').forEach(c => {
        const v = parseFloat(getValeur(eid, c.id));
        if (isNaN(v)) return;
        const ech = echelleNote(c);
        if (ech.mode !== 'numerique') return;
        const bareme = ech.bareme || 20;
        total += (v / bareme) * 20;
        n++;
    });
    if (!n) return { aff: '·', couleur: '#64748b' };
    const moy = Math.round((total / n) * 10) / 10;
    return { aff: moy + ' /20', couleur: couleurNote(moy / 20) };
}

// Modèles rapides (colonnes pré-remplies).
const TEMPLATES = {
    docsPP: {
        nom: '📋 Documents PP',
        champs: [
            ['statut', 'Demi-pension', 'Documents PP'],
            ['statut', 'Fiche urgence', 'Documents PP'],
            ['statut', 'Adhésion FSE', 'Documents PP'],
            ['statut', 'Manuels scolaires', 'Documents PP'],
            ['statut', 'Recensement numérique', 'Documents PP'],
            ['statut', "Droit à l'image", 'Documents PP'],
            ['statut', 'Attestation assurance', 'Documents PP'],
            ['statut', 'Copie CNI', 'Documents PP'],
            ['statut', 'Signature carnet', 'Documents PP'],
            ['statut', 'Paiement FSE', 'Documents PP'],
            ['statut', 'DAC', 'Documents PP'],
            ['statut', 'Ski', 'Documents PP'],
        ]
    },
    tests: {
        nom: '🏃 Tests physiques',
        champs: [
            ['mesure', 'Gainage tronc (s)', 'Tests physiques', 's'],
            ['mesure', 'Squats (rép)', 'Tests physiques', 'rép'],
            ['mesure', 'Corde à sauter (rép)', 'Tests physiques', 'rép'],
            ['mesure', 'Vitesse 5" (s)', 'Tests physiques', 's'],
            ['mesure', 'Longueur sans élan (cm)', 'Tests physiques', 'cm'],
            ['mesure', 'Luc Léger (palier)', 'Tests physiques', 'palier'],
            ['mesure', 'Sprint 30m (s)', 'Tests physiques', 's'],
        ]
    }
};

function cellHtml(e, champ) {
    const eid = e.id, cid = champ.id;
    const v = getValeur(eid, cid);
    if (champ.type === 'statut') {
        const leg = champ.legende || [];
        const entree = leg.find(l => String(l.v) === String(v));
        const idx = entree ? leg.indexOf(entree) : -1;
        const bg = entree ? COULEURS_STATUT[idx % COULEURS_STATUT.length] : '#334155';
        return `<td class="p-1 text-center cursor-pointer" onclick="window.carnetCell('${eid}','${cid}','statut')" title="${escAttr(champ.libelle)}">
            <span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold text-white whitespace-nowrap" style="background:${bg}">${entree ? esc(entree.label) : '—'}</span>
        </td>`;
    }
    if (champ.type === 'note') {
        const a = noteAffichage(champ, v);
        return `<td class="p-1 text-center cursor-pointer" id="cell-${eid}-${cid}" onclick="window.carnetNoteEditer('${eid}','${cid}')" title="${escAttr(champ.libelle)}">
            <span class="inline-block px-1.5 py-0.5 rounded-lg text-[11px] font-bold" style="color:${a.couleur}">${a.aff}</span>
        </td>`;
    }
    if (champ.type === 'calcul') {
        const a = calculerChamp(champ, eid);
        return `<td class="p-1 text-center" title="${escAttr(champ.libelle)}">
            <span class="inline-block px-1.5 py-0.5 rounded-lg text-[11px] font-bold" style="color:${a.couleur}">${a.aff}</span>
        </td>`;
    }
    if (champ.type === 'mesure') {
        const ok = v !== null && v !== undefined && v !== '';
        return `<td class="p-1 text-center cursor-pointer" id="cell-${eid}-${cid}" onclick="window.carnetCell('${eid}','${cid}','mesure')" title="${escAttr(champ.libelle)}">
            <span class="text-[11px] text-slate-200 whitespace-nowrap">${ok ? esc(v) + (champ.unite ? ' ' + esc(champ.unite) : '') : '·'}</span>
        </td>`;
    }
    const txt = v || '';
    return `<td class="p-1 cursor-pointer" id="cell-${eid}-${cid}" onclick="window.carnetCell('${eid}','${cid}','texte')" title="${escAttr(champ.libelle)}">
        <span class="text-[10px] text-slate-400 block truncate" style="max-width:150px">${txt ? esc(txt) : '·'}</span>
    </td>`;
}

function render() {
    const container = document.getElementById('viewCarnet');
    if (!container) return;
    if (!currentClasse) {
        container.innerHTML = '<p class="text-slate-500 text-center py-10">Sélectionne une classe.</p>';
        return;
    }
    const champs = lireChamps(currentClasse);
    const eleves = getExistingEleves(currentClasse);
    currentValeurs = lireValeurs(currentClasse);

    const groupes = [];
    const parGroupe = {};
    champs.forEach(c => {
        const g = c.groupe || 'Général';
        if (!parGroupe[g]) { parGroupe[g] = []; groupes.push(g); }
        parGroupe[g].push(c);
    });

    const headerBar = `
        <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700 flex flex-wrap items-center justify-between gap-3">
            <div>
                <h3 class="font-black text-blue-400 uppercase text-sm">📒 Carnet de classe</h3>
                <p class="text-xs text-slate-400 mt-1">${eleves.length} élève(s) · ${champs.length} colonne(s)</p>
            </div>
            <div class="flex gap-2 flex-wrap">
                <button onclick="window.carnetAjouterColonne()" class="bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-xl font-black text-xs text-white">➕ Colonne</button>
                <button onclick="window.carnetModele('docsPP')" class="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-xl font-black text-xs text-white">📋 Documents PP</button>
                <button onclick="window.carnetModele('tests')" class="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-xl font-black text-xs text-white">🏃 Tests physiques</button>
            </div>
        </div>`;

    if (!groupes.length) {
        container.innerHTML = headerBar + '<div class="bg-slate-800 p-10 rounded-2xl border border-slate-700 text-center text-slate-400"><p class="text-3xl mb-2">📒</p><p class="font-bold">Aucune colonne.</p><p class="text-xs mt-1">Ajoute une colonne ou charge un modèle (Documents PP / Tests physiques).</p></div>';
        return;
    }

    if (!groupes.includes(currentGroupe)) currentGroupe = groupes[0];
    const champsActifs = parGroupe[currentGroupe] || [];

    const tabs = `<div class="flex gap-2 flex-wrap mb-3">${groupes.map(g => `<button onclick="window.carnetOnglet('${escAttr(g)}')" class="px-3 py-1.5 rounded-xl font-black text-xs ${g === currentGroupe ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}">${esc(g)} <span class="opacity-60">(${parGroupe[g].length})</span></button>`).join('')}</div>`;

    let header = '<th class="p-2 text-left text-xs font-black text-slate-300 border border-slate-700 sticky left-0 bg-slate-800">Élève</th>';
    champsActifs.forEach(c => {
        const t = TYPES[c.type] || TYPES.texte;
        header += `<th class="p-1 text-center border border-slate-700 bg-slate-800">
            <div class="flex items-center justify-center gap-1">
                <span class="text-[10px] font-bold text-white" title="${escAttr(c.libelle)}">${t.icone} ${esc(c.libelle)}</span>
                <span class="text-slate-500 hover:text-slate-300 cursor-pointer" title="Déplacer à gauche" onclick="window.carnetDeplacer('${c.id}',-1)">◀</span>
                <span class="text-slate-500 hover:text-slate-300 cursor-pointer" title="Déplacer à droite" onclick="window.carnetDeplacer('${c.id}',1)">▶</span>
                <span class="text-slate-500 hover:text-slate-300 cursor-pointer" title="Renommer" onclick="window.carnetRenommer('${c.id}')">✏️</span>
                <span class="text-red-500 hover:text-red-400 cursor-pointer" title="Supprimer" onclick="window.carnetSupprimer('${c.id}')">✕</span>
            </div>
        </th>`;
    });

    const lignes = eleves.map(e => {
        const cells = champsActifs.map(c => cellHtml(e, c)).join('');
        return `<tr class="border-b border-slate-800">
            <td class="p-2 font-bold text-white text-sm border border-slate-700 sticky left-0 bg-slate-900 whitespace-nowrap cursor-pointer hover:text-blue-400" onclick="window.ouvrirFicheEleve('${e.id}','${escAttr(currentClasse)}')">👤 ${esc(e.prenom)} ${esc(e.nom)}</td>
            ${cells}
        </tr>`;
    }).join('');

    container.innerHTML = headerBar + `
        ${tabs}
        <div class="bg-slate-800 p-2 rounded-2xl border border-slate-700 overflow-x-auto">
            <table class="w-full text-sm border-collapse">
                <thead><tr>${header}</tr></thead>
                <tbody>${lignes}</tbody>
            </table>
        </div>`;
}

window.carnetOnglet = function(g) {
    currentGroupe = g;
    render();
};

function cycleStatut(eid, cid) {
    const champ = getChamp(cid);
    if (!champ) return;
    const vals = (champ.legende || []).map(l => l.v);
    const cur = getValeur(eid, cid);
    const idx = vals.findIndex(v => String(v) === String(cur));
    const next = vals[(idx + 1) % (vals.length + 1)];
    setValeur(eid, cid, next === undefined ? null : next);
    render();
}

window.carnetCell = function(eid, cid, type) {
    if (type === 'statut') { cycleStatut(eid, cid); return; }
    const cell = document.getElementById('cell-' + eid + '-' + cid);
    if (!cell) return;
    const val = getValeur(eid, cid);
    const input = type === 'texte'
        ? `<input type="text" value="${escAttr(val ?? '')}" onblur="window.carnetSave('${eid}','${cid}','${type}', this.value)" onkeydown="if(event.key==='Enter')this.blur()" class="w-full bg-slate-900 border border-blue-500 rounded px-1 py-0.5 text-xs text-white">`
        : `<input type="number" step="any" value="${escAttr(val ?? '')}" onblur="window.carnetSave('${eid}','${cid}','${type}', this.value)" onkeydown="if(event.key==='Enter')this.blur()" class="w-full bg-slate-900 border border-blue-500 rounded px-1 py-0.5 text-xs text-white">`;
    cell.innerHTML = input;
    const inp = cell.querySelector('input');
    if (inp) inp.focus();
};

window.carnetSave = function(eid, cid, type, val) {
    if (type === 'note' || type === 'mesure') {
        const n = parseFloat(String(val).replace(',', '.'));
        setValeur(eid, cid, isNaN(n) ? null : n);
    } else {
        setValeur(eid, cid, val);
    }
    render();
};

window.carnetNoteEditer = function(eid, cid) {
    const champ = getChamp(cid);
    if (!champ) return;
    const ech = echelleNote(champ);
    let zone;
    if (ech.mode === 'numerique') {
        zone = `
            <input id="carnet-note-valeur" type="number" step="any" inputmode="decimal" value="${getValeur(eid, cid) ?? ''}" placeholder="Note sur ${ech.bareme || 20}" class="w-full bg-slate-800 border border-slate-600 rounded px-3 py-3 text-2xl text-white mb-2 text-center">
            <p class="text-[10px] text-slate-500 text-center mb-3">Barème : /${ech.bareme || 20}</p>
            <div class="flex gap-2">
                <button onclick="window.carnetNoteValider('${eid}','${cid}')" class="flex-1 bg-blue-600 py-3 rounded-xl font-black text-white">Valider</button>
                <button onclick="window.carnetNoteEffacer('${eid}','${cid}')" class="bg-red-600 px-4 rounded-xl font-black text-white">Effacer</button>
            </div>`;
    } else {
        const valeurs = ech.mode === 'lettres' ? ECHELLE_LETTRES : (ech.valeurs || []).map((x, i) => ({ v: x, label: x, couleur: COULEURS_STATUT[i % COULEURS_STATUT.length] }));
        zone = `
            <div class="grid grid-cols-3 gap-2 mb-3">
                ${valeurs.map(x => `<button onclick="window.carnetNoteChoisir('${eid}','${cid}','${escAttr(x.v)}')" class="py-3 rounded-xl font-black text-lg border-2" style="background:${x.couleur}22;border-color:${x.couleur};color:${x.couleur}">${esc(x.label)}</button>`).join('')}
            </div>
            <button onclick="window.carnetNoteEffacer('${eid}','${cid}')" class="w-full bg-red-600 py-2.5 rounded-xl font-black text-white text-sm">Effacer</button>`;
    }
    document.getElementById('carnet-note-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'carnet-note-modal';
    modal.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
        <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-sm">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-black text-white">🔢 ${esc(champ.libelle)}</h3>
                <button onclick="document.getElementById('carnet-note-modal').remove()" class="bg-slate-700 px-3 py-1.5 rounded-lg font-black text-xs text-white">✖</button>
            </div>
            ${zone}
        </div>
    `;
    document.body.appendChild(modal);
    const inp = document.getElementById('carnet-note-valeur');
    if (inp) inp.focus();
};

window.carnetNoteValider = function(eid, cid) {
    const inp = document.getElementById('carnet-note-valeur');
    const n = parseFloat(String(inp?.value ?? '').replace(',', '.'));
    setValeur(eid, cid, isNaN(n) ? null : n);
    document.getElementById('carnet-note-modal')?.remove();
    render();
};

window.carnetNoteChoisir = function(eid, cid, val) {
    setValeur(eid, cid, val);
    document.getElementById('carnet-note-modal')?.remove();
    render();
};

window.carnetNoteEffacer = function(eid, cid) {
    setValeur(eid, cid, null);
    document.getElementById('carnet-note-modal')?.remove();
    render();
};

function ajouterChamp(def) {
    const champs = lireChamps(currentClasse);
    champs.push({
        id: genererChampId(),
        type: def.type,
        libelle: def.libelle || TYPES[def.type].label,
        groupe: def.groupe || 'Général',
        bareme: def.type === 'note' ? (def.bareme || 20) : undefined,
        unite: def.type === 'mesure' ? (def.unite || '') : undefined,
        legende: def.type === 'statut' ? (def.legende || TYPES.statut.defaut.legende) : undefined,
        echelle: def.type === 'note' ? (def.echelle || { mode: 'numerique', bareme: def.bareme || 20 }) : undefined,
        calcul: def.type === 'calcul' ? (def.calcul || { fonction: 'moyenne', dossier: 'Général', valides: '' }) : undefined,
    });
    ecrireChamps(currentClasse, champs);
    currentGroupe = def.groupe || 'Général';
    render();
}

window.carnetAjouterColonne = function() {
    if (!currentClasse) return;
    const modal = document.createElement('div');
    modal.id = 'carnet-col-modal';
    modal.className = 'fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
        <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-md">
            <h3 class="text-lg font-black text-blue-400 uppercase mb-4">➕ Nouvelle colonne</h3>
            <label class="text-xs text-slate-400 block mb-1">Type</label>
            <select id="carnet-col-type" onchange="window.carnetColType()" class="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white mb-3">
                <option value="note">🔢 Note (sur un barème)</option>
                <option value="mesure">📏 Mesure (avec unité)</option>
                <option value="statut">✅ Statut (badge à légende)</option>
                <option value="texte">💬 Texte</option>
                <option value="calcul">🧮 Calcul (moyenne / somme / %)</option>
            </select>
            <label class="text-xs text-slate-400 block mb-1">Libellé</label>
            <input id="carnet-col-libelle" type="text" placeholder="Ex. : Contrôle n°1" class="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white mb-3">
            <label class="text-xs text-slate-400 block mb-1">Dossier</label>
            <input id="carnet-col-groupe" type="text" placeholder="Général" class="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white mb-3">
            <div id="carnet-col-opt-note" class="hidden mb-3">
                <label class="text-xs text-slate-400 block mb-1">Échelle</label>
                <select id="carnet-col-echelle" onchange="window.carnetColEchelle()" class="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white mb-2">
                    <option value="numerique">Numérique (sur un barème)</option>
                    <option value="lettres">Lettres (A à F)</option>
                    <option value="liste">Liste personnalisée</option>
                </select>
                <div id="carnet-col-ech-numerique">
                    <label class="text-xs text-slate-400 block mb-1">Barème</label>
                    <input id="carnet-col-bareme" type="number" value="20" class="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white">
                </div>
                <div id="carnet-col-ech-liste" class="hidden">
                    <label class="text-xs text-slate-400 block mb-1">Valeurs (séparées par ;)</label>
                    <input id="carnet-col-valeurs" type="text" placeholder="Acquis;En cours;Non acquis" class="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white">
                </div>
            </div>
            <div id="carnet-col-opt-mesure" class="hidden mb-3">
                <label class="text-xs text-slate-400 block mb-1">Unité</label>
                <input id="carnet-col-unite" type="text" placeholder="cm, s, rép…" class="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white">
            </div>
            <div id="carnet-col-opt-statut" class="hidden mb-3">
                <label class="text-xs text-slate-400 block mb-1">Légende (format : 0=Non;1=Oui)</label>
                <input id="carnet-col-legende" type="text" value="0=Non;1=En cours;2=Validé" class="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white">
            </div>
            <div id="carnet-col-opt-calcul" class="hidden mb-3">
                <label class="text-xs text-slate-400 block mb-1">Fonction</label>
                <select id="carnet-col-fonction" onchange="window.carnetColFonction()" class="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white mb-2">
                    <option value="moyenne">Moyenne (notes → /20)</option>
                    <option value="somme">Somme (notes / mesures)</option>
                    <option value="pourcentage">% de documents rendus</option>
                </select>
                <label class="text-xs text-slate-400 block mb-1">Dossier source</label>
                <select id="carnet-col-dossier" class="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white mb-2"></select>
                <div id="carnet-col-opt-valides" class="hidden">
                    <label class="text-xs text-slate-400 block mb-1">Valeurs « rendu » (séparées par des virgules)</label>
                    <input id="carnet-col-valides" type="text" placeholder="vide = toute valeur remplie" class="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white">
                </div>
            </div>
            <div class="flex gap-3 mt-4">
                <button onclick="document.getElementById('carnet-col-modal').remove()" class="flex-1 bg-slate-700 py-2.5 rounded-xl font-black text-sm text-white">Annuler</button>
                <button onclick="window.carnetColValider()" class="flex-1 bg-blue-600 py-2.5 rounded-xl font-black text-sm text-white">Ajouter</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const dossiers = [...new Set(lireChamps(currentClasse).map(c => c.groupe || 'Général'))];
    const selDossier = document.getElementById('carnet-col-dossier');
    if (selDossier) selDossier.innerHTML = (dossiers.length ? dossiers : ['Général']).map(d => `<option value="${escAttr(d)}">${esc(d)}</option>`).join('');
    window.carnetColType();
};

window.carnetColType = function() {
    const t = document.getElementById('carnet-col-type')?.value;
    ['note', 'mesure', 'statut', 'calcul'].forEach(k => {
        const el = document.getElementById('carnet-col-opt-' + k);
        if (el) el.classList.toggle('hidden', t !== k);
    });
    window.carnetColEchelle();
    window.carnetColFonction();
};

window.carnetColValider = function() {
    const type = document.getElementById('carnet-col-type').value;
    const libelle = document.getElementById('carnet-col-libelle').value.trim();
    const groupe = document.getElementById('carnet-col-groupe').value.trim();
    if (!libelle) { alert('Donne un libellé à la colonne.'); return; }
    const bareme = parseInt(document.getElementById('carnet-col-bareme')?.value) || 20;
    const unite = document.getElementById('carnet-col-unite')?.value.trim() || '';
    const legende = (document.getElementById('carnet-col-legende')?.value || '').split(';').filter(Boolean).map(p => {
        const [v, label] = p.split('=');
        return { v: (v || '').trim(), label: (label || v || '').trim() };
    });
    const echMode = document.getElementById('carnet-col-echelle')?.value || 'numerique';
    const echValeurs = (document.getElementById('carnet-col-valeurs')?.value || '').split(';').map(x => x.trim()).filter(Boolean);
    const echelle = { mode: echMode, bareme, valeurs: echValeurs };
    const calcul = type === 'calcul' ? {
        fonction: document.getElementById('carnet-col-fonction')?.value || 'moyenne',
        dossier: document.getElementById('carnet-col-dossier')?.value || 'Général',
        valides: document.getElementById('carnet-col-valides')?.value || '',
    } : undefined;
    ajouterChamp({ type, libelle, groupe, bareme, unite, legende: legende.length ? legende : undefined, echelle, calcul });
    document.getElementById('carnet-col-modal').remove();
};

window.carnetColEchelle = function() {
    const m = document.getElementById('carnet-col-echelle')?.value;
    document.getElementById('carnet-col-ech-numerique')?.classList.toggle('hidden', m !== 'numerique');
    document.getElementById('carnet-col-ech-liste')?.classList.toggle('hidden', m !== 'liste');
};

window.carnetColFonction = function() {
    const f = document.getElementById('carnet-col-fonction')?.value;
    document.getElementById('carnet-col-opt-valides')?.classList.toggle('hidden', f !== 'pourcentage');
};

window.carnetRenommer = function(cid) {
    const champ = getChamp(cid);
    if (!champ) return;
    const libelle = prompt('Renommer la colonne ?', champ.libelle);
    if (libelle && libelle.trim()) {
        const champs = lireChamps(currentClasse);
        const c = champs.find(x => x.id === cid);
        if (c) { c.libelle = libelle.trim(); ecrireChamps(currentClasse, champs); render(); }
    }
};

window.carnetSupprimer = function(cid) {
    const champ = getChamp(cid);
    if (!champ) return;
    if (!confirm('Supprimer la colonne « ' + champ.libelle + ' » et toutes ses valeurs ?')) return;
    ecrireChamps(currentClasse, lireChamps(currentClasse).filter(c => c.id !== cid));
    Object.keys(currentValeurs).forEach(eid => { delete currentValeurs[eid][cid]; });
    ecrireValeurs(currentClasse, currentValeurs);
    render();
};

window.carnetDeplacer = function(cid, dir) {
    const champs = lireChamps(currentClasse);
    const i = champs.findIndex(c => c.id === cid);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= champs.length) return;
    [champs[i], champs[j]] = [champs[j], champs[i]];
    ecrireChamps(currentClasse, champs);
    render();
};

window.carnetModele = function(cle) {
    if (!currentClasse) return;
    const modele = TEMPLATES[cle];
    if (!modele) return;
    if (!confirm('Ajouter les colonnes du modèle « ' + modele.nom + ' » ?')) return;
    const champs = lireChamps(currentClasse);
    modele.champs.forEach(([type, libelle, groupe, unite]) => {
        champs.push({
            id: genererChampId(), type, libelle, groupe: groupe || 'Général',
            bareme: type === 'note' ? 20 : undefined,
            unite: type === 'mesure' ? (unite || '') : undefined,
            legende: type === 'statut' ? TYPES.statut.defaut.legende : undefined,
        });
    });
    ecrireChamps(currentClasse, champs);
    currentGroupe = modele.champs[0]?.[2] || 'Général';
    render();
};

export function initCarnetInterface() {
    currentClasse = getCurrentClasse();
    currentValeurs = currentClasse ? lireValeurs(currentClasse) : {};
    render();
}





