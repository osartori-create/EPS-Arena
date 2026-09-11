// src/js/modules/relais/relais-kiosk.js
// Kiosque élève : menu principal + saisie vitesses + relais

import { db, ref, onValue, push, set } from '../../core/firebase-service.js';
import { getCurrentClasse } from '../../core/live-engine.js';
import { 
    zoneToVitesse, calculerVTheorique, calculerScore, getScoreCouleur, getScoreLabel, 
    getPairesGroupe, formatVitesse, NB_PLOTS 
} from './relais-core.js';

// ============================================================
// ÉTAT
// ============================================================
const state = {
    classe: '',
    code: '',
    config: null,
    vitesses: {},         // { eleveId: { arret, lance } }
    mesures: {},          // { pushId: { groupe, pairId, relayeId, relayeurId, zoneAtteinte, score, ... } }
    mode: 'menu',         // 'menu' | 'saisie-vitesses' | 'select-eleve' | 'select-groupe' | 'select-paire' | 'saisie-zone' | 'feedback'
    currentEleve: null,
    currentGroupeIdx: null,
    currentPaire: null,
    currentVitesses: { arret: null, lance: null },
    currentZone: 0,
    lastFeedback: null
};

let configListener = null;
let vitessesListener = null;
let mesuresListener = null;

// ============================================================
// INITIALISATION
// ============================================================
export function initRelaisKiosk(classe, code) {
    state.classe = classe;
    state.code = code;
    state.mode = 'menu';

    const container = document.getElementById('relais-module');
    if (!container) {
        console.error('[Relais Kiosk] Conteneur relais-module introuvable');
        return;
    }
    container.innerHTML = '';
    container.classList.remove('hidden');

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const basePath = `etablissements/0680013V/profs/${profCode}/${classe}/relais`;

    // Config
    if (configListener) configListener();
    configListener = onValue(ref(db, `${basePath}/config`), (snap) => {
        state.config = snap.val() || null;
        if (state.config) render();
    });

    // Vitesses
    if (vitessesListener) vitessesListener();
    vitessesListener = onValue(ref(db, `${basePath}/vitesses`), (snap) => {
        state.vitesses = snap.val() || {};
        render();
    });

    // Mesures
    if (mesuresListener) mesuresListener();
    mesuresListener = onValue(ref(db, `${basePath}/mesures`), (snap) => {
        state.mesures = snap.val() || {};
        if (state.mode === 'feedback' || state.mode === 'menu') render();
    });
}

// ============================================================
// RENDU PRINCIPAL (aiguillage)
// ============================================================
function render() {
    const container = document.getElementById('relais-module');
    if (!container) return;

    if (!state.config) {
        container.innerHTML = `<div class="text-center py-10 text-slate-400"><p class="text-2xl">⏳ En attente de la configuration du professeur...</p></div>`;
        return;
    }

    switch (state.mode) {
        case 'menu':              renderMenu(container); break;
        case 'saisie-vitesses':   renderSaisieVitesses(container); break;
        case 'select-eleve':      renderSelectEleve(container); break;
        case 'select-groupe':     renderSelectGroupe(container); break;
        case 'select-paire':      renderSelectPaire(container); break;
        case 'saisie-zone':       renderSaisieZone(container); break;
        case 'feedback':          renderFeedback(container); break;
    }
}

// ============================================================
// BANDEAU DE MODE
// ============================================================
function getBannerHtml() {
    const mode = state.config.mode || 'essai';
    if (mode === 'competition') {
        return `<div class="bg-yellow-500 text-black text-center font-black uppercase py-2 px-4 rounded-xl mb-4 text-sm tracking-wider">🏆 MODE COMPÉTITION</div>`;
    }
    return `<div class="bg-emerald-500 text-white text-center font-black uppercase py-2 px-4 rounded-xl mb-4 text-sm tracking-wider">🌱 MODE ESSAI</div>`;
}

// ============================================================
// MENU PRINCIPAL
// ============================================================
function renderMenu(container) {
    container.innerHTML = `
        ${getBannerHtml()}
        <div class="space-y-4">
            <div class="text-center py-4">
                <h2 class="text-3xl font-black text-white mb-2">🏁 Relais</h2>
                <p class="text-slate-400 text-sm">Choisis ton mode</p>
            </div>

            <button onclick="window.relaisKioskGoTo('saisie-vitesses')" 
                    class="w-full bg-blue-600 hover:bg-blue-500 py-8 rounded-3xl font-black text-2xl text-white active:scale-95 transition-all shadow-xl">
                🏃 Saisir mes vitesses
                <p class="text-xs font-normal opacity-80 mt-1">Départ arrêté / Départ lancé</p>
            </button>

            <button onclick="window.relaisKioskGoTo('select-groupe')" 
                    class="w-full bg-orange-600 hover:bg-orange-500 py-8 rounded-3xl font-black text-2xl text-white active:scale-95 transition-all shadow-xl">
                🏁 Courir un relais
                <p class="text-xs font-normal opacity-80 mt-1">Choisir un groupe et une paire</p>
            </button>

            <button onclick="window.retourMenuRelais()" 
                    class="w-full bg-slate-700 hover:bg-slate-600 py-4 rounded-2xl font-black text-sm text-white active:scale-95 transition-all mt-4">
                ← Retour au menu général
            </button>
        </div>
    `;
}

// ============================================================
// SAISIE DES VITESSES DE RÉFÉRENCE
// ============================================================
function renderSelectEleve(container) {
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${state.classe}`) || '[]');
    eleves.sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));

    let html = `
        ${getBannerHtml()}
        <div class="space-y-3">
            <div class="flex justify-between items-center">
                <h2 class="text-xl font-black text-white">🏃 Saisir mes vitesses</h2>
                <button onclick="window.relaisKioskGoTo('menu')" class="bg-slate-700 px-3 py-1.5 rounded-xl font-black text-xs text-white active:scale-95">← Retour</button>
            </div>
            <p class="text-slate-400 text-sm">Cherche ton nom dans la liste</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[70vh] overflow-y-auto pr-2">
    `;

    if (eleves.length === 0) {
        html += `<p class="text-slate-500 col-span-full text-center py-6">Aucun élève importé. Préviens ton professeur.</p>`;
    } else {
        eleves.forEach((eleve, index) => {
            const numero = index + 1;
            const v = state.vitesses[eleve.id];
            const hasV = v && v.arret && v.lance;
            const badge = hasV
                ? `<span class="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-full font-bold">✓ saisi</span>`
                : `<span class="text-xs bg-slate-600 text-slate-300 px-2 py-0.5 rounded-full font-bold">à faire</span>`;

            html += `
                <button onclick="window.relaisKioskSelectEleve('${eleve.id}')"
                        class="bg-slate-800 hover:bg-slate-700 border-2 border-slate-700 hover:border-blue-500 p-3 rounded-xl flex items-center gap-3 active:scale-95 transition-all text-left">
                    <span class="text-2xl font-black text-yellow-400 w-10">${numero}</span>
                    <span class="flex-1 font-bold text-white">${eleve.prenom} ${eleve.nom}</span>
                    ${badge}
                </button>
            `;
        });
    }

    html += `</div></div>`;
    container.innerHTML = html;
}

function renderSaisieVitesses(container) {
    const eleve = state.currentEleve;
    if (!eleve) {
        window.relaisKioskGoTo('saisie-vitesses');
        return;
    }

    const v = state.vitesses[eleve.id] || {};
    const arret = state.currentVitesses.arret !== null ? state.currentVitesses.arret : (v.arret || null);
    const lance = state.currentVitesses.lance !== null ? state.currentVitesses.lance : (v.lance || null);

    const renderZoneSelector = (type, value) => {
        let html = `<div class="grid grid-cols-7 gap-1">`;
        for (let z = 1; z <= NB_PLOTS; z++) {
            const kmh = zoneToVitesse(z);
            const selected = value === z;
            html += `
                <button onclick="window.relaisKioskSetZone('${type}', ${z})"
                        class="py-3 rounded-lg font-black text-sm ${selected ? 'bg-blue-600 text-white ring-2 ring-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'} active:scale-95 transition-all">
                    ${kmh}
                </button>
            `;
        }
        html += `</div>`;
        return html;
    };

    container.innerHTML = `
        ${getBannerHtml()}
        <div class="space-y-4">
            <div class="flex justify-between items-center">
                <h2 class="text-xl font-black text-white">🏃 ${eleve.prenom} ${eleve.nom}</h2>
                <button onclick="window.relaisKioskGoTo('saisie-vitesses')" class="bg-slate-700 px-3 py-1.5 rounded-xl font-black text-xs text-white active:scale-95">← Retour</button>
            </div>

            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <h3 class="font-bold text-white mb-1">🅰️ 5'' Départ arrêté</h3>
                <p class="text-xs text-slate-400 mb-3">Zone atteinte (vitesse en km/h)</p>
                ${renderZoneSelector('arret', arret)}
                <p class="mt-2 text-sm font-bold ${arret ? 'text-emerald-400' : 'text-slate-500'}">
                    ${arret ? `✓ Zone ${arret} = ${zoneToVitesse(arret)} km/h` : 'Aucune zone sélectionnée'}
                </p>
            </div>

            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <h3 class="font-bold text-white mb-1">🅱️ 5'' Départ lancé</h3>
                <p class="text-xs text-slate-400 mb-3">Zone atteinte (vitesse en km/h)</p>
                ${renderZoneSelector('lance', lance)}
                <p class="mt-2 text-sm font-bold ${lance ? 'text-emerald-400' : 'text-slate-500'}">
                    ${lance ? `✓ Zone ${lance} = ${zoneToVitesse(lance)} km/h` : 'Aucune zone sélectionnée'}
                </p>
            </div>

            <button onclick="window.relaisKioskValiderVitesses()"
                    class="w-full py-5 rounded-2xl font-black text-xl uppercase ${arret && lance ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}"
                    ${arret && lance ? '' : 'disabled'}>
                ✅ Enregistrer mes vitesses
            </button>
        </div>
    `;
}

// ============================================================
// SÉLECTION DU GROUPE
// ============================================================
function renderSelectGroupe(container) {
    const groupes = state.config.groupes || {};
    let html = `
        ${getBannerHtml()}
        <div class="space-y-4">
            <div class="flex justify-between items-center">
                <h2 class="text-xl font-black text-white">🏁 Choisis ton groupe</h2>
                <button onclick="window.relaisKioskGoTo('menu')" class="bg-slate-700 px-3 py-1.5 rounded-xl font-black text-xs text-white active:scale-95">← Retour</button>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
    `;

    Object.entries(groupes).forEach(([idx, groupe]) => {
        const membresStr = (groupe.membres || []).map(m => m.lettre).join(', ');
        html += `
            <button onclick="window.relaisKioskSelectGroupe(${idx})"
                    class="bg-slate-800 hover:bg-slate-700 border-2 border-slate-700 hover:border-blue-500 p-4 rounded-2xl active:scale-95 transition-all text-left">
                <div class="text-2xl font-black text-yellow-400 mb-1">G${groupe.numero || (parseInt(idx) + 1)}</div>
                <div class="text-xs text-slate-400">Élèves : ${membresStr}</div>
            </button>
        `;
    });

    html += `</div></div>`;
    container.innerHTML = html;
}

// ============================================================
// SÉLECTION DE LA PAIRE
// ============================================================
function renderSelectPaire(container) {
    const groupeIdx = state.currentGroupeIdx;
    const groupe = state.config.groupes[groupeIdx];
    if (!groupe) {
        window.relaisKioskGoTo('select-groupe');
        return;
    }

    const membres = groupe.membres;
    const paires = getPairesGroupe(membres);

    let html = `
        ${getBannerHtml()}
        <div class="space-y-4">
            <div class="flex justify-between items-center">
                <h2 class="text-xl font-black text-white">Groupe ${groupe.numero}</h2>
                <button onclick="window.relaisKioskGoTo('select-groupe')" class="bg-slate-700 px-3 py-1.5 rounded-xl font-black text-xs text-white active:scale-95">← Retour</button>
            </div>
            <p class="text-slate-400 text-sm">Quel binôme va courir ?</p>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
    `;

    paires.forEach((p, i) => {
        // Vérifier si les vitesses sont disponibles
        const vRelaye = state.vitesses[p.relaye.id] || {};
        const vRelayeur = state.vitesses[p.relayeur.id] || {};
        const pret = vRelaye.arret && vRelayeur.lance;

        // Meilleur essai existant pour cette paire ?
        const essaisPaire = Object.values(state.mesures).filter(m => 
            m.groupeIdx === groupeIdx && m.pairId === p.pairId
        );
        const meilleur = essaisPaire.length > 0 ? Math.max(...essaisPaire.map(m => m.score)) : null;

        html += `
            <button onclick="window.relaisKioskSelectPaire(${i})"
                    class="bg-slate-800 hover:bg-slate-700 border-2 ${pret ? 'border-slate-700 hover:border-blue-500' : 'border-red-800'} p-4 rounded-2xl active:scale-95 transition-all text-left">
                <div class="text-3xl font-black text-white mb-1">${p.relaye.lettre} → ${p.relayeur.lettre}</div>
                <div class="text-xs text-slate-400">Relayé : ${p.relaye.prenom}</div>
                <div class="text-xs text-slate-400">Relayeur : ${p.relayeur.prenom}</div>
                ${meilleur !== null ? `<div class="mt-1 text-xs text-yellow-400 font-bold">🏆 Meilleur : ${meilleur.toFixed(1)} pts</div>` : ''}
                ${!pret ? `<div class="mt-1 text-xs text-red-400 font-bold">⚠️ Vitesses manquantes</div>` : ''}
            </button>
        `;
    });

    html += `</div></div>`;
    container.innerHTML = html;
}

// ============================================================
// SAISIE DE LA ZONE ATTEINTE (RELais)
// ============================================================
function renderSaisieZone(container) {
    const groupeIdx = state.currentGroupeIdx;
    const paire = state.currentPaire;
    if (!paire) {
        window.relaisKioskGoTo('select-groupe');
        return;
    }

    const nbPlots = state.config.nbPlots || 14;
    const zone = state.currentZone;

    let gridHtml = `<div class="grid grid-cols-7 gap-2">`;
    for (let z = 1; z <= nbPlots; z++) {
        const kmh = zoneToVitesse(z);
        const selected = zone === z;
        gridHtml += `
            <button onclick="window.relaisKioskSetZoneRelais(${z})"
                    class="py-5 rounded-xl font-black text-lg ${selected ? 'bg-orange-600 text-white ring-4 ring-white scale-105' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'} active:scale-95 transition-all">
                ${kmh}
            </button>
        `;
    }
    gridHtml += `</div>`;

    container.innerHTML = `
        ${getBannerHtml()}
        <div class="space-y-4">
            <div class="flex justify-between items-center">
                <h2 class="text-2xl font-black text-white">${paire.label}</h2>
                <button onclick="window.relaisKioskGoTo('select-paire')" class="bg-slate-700 px-3 py-1.5 rounded-xl font-black text-xs text-white active:scale-95">← Retour</button>
            </div>

            <div class="bg-slate-800 p-3 rounded-2xl border border-slate-700 text-center text-sm">
                <p class="text-slate-400">Au 2ᵉ bip (10s), où se trouvait le témoin ?</p>
                <p class="text-xs text-slate-500 mt-1">Clique sur le plot atteint (km/h affichée)</p>
            </div>

            ${gridHtml}

            <div class="text-center text-3xl font-black ${zone > 0 ? 'text-emerald-400' : 'text-slate-500'} py-2">
                ${zone > 0 ? `Zone ${zone} = ${zoneToVitesse(zone)} km/h` : 'Aucune zone sélectionnée'}
            </div>

            <button onclick="window.relaisKioskValiderZone()"
                    class="w-full py-5 rounded-2xl font-black text-xl uppercase ${zone > 0 ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}"
                    ${zone > 0 ? '' : 'disabled'}>
                ✅ Valider cet essai
            </button>
        </div>
    `;
}

// ============================================================
// FEEDBACK
// ============================================================
function renderFeedback(container) {
    const fb = state.lastFeedback;
    if (!fb) { state.mode = 'menu'; render(); return; }

    const couleur = getScoreCouleur(fb.score);
    const label = getScoreLabel(fb.score);
    const mode = state.config.mode || 'essai';

    container.innerHTML = `
        ${getBannerHtml()}
        <div class="space-y-4 text-center py-6">
            <div class="text-6xl mb-2">${fb.score >= 8 ? '🚀' : fb.score >= 5 ? '🌟' : fb.score >= 3 ? '👍' : '📈'}</div>
            <h2 class="text-3xl font-black text-white">${fb.pairId}</h2>
            <p class="text-slate-400">${fb.relayePrenom} → ${fb.relayeurPrenom}</p>

            <div class="bg-slate-800 p-6 rounded-3xl border-2 inline-block px-8" style="border-color: ${couleur}">
                <div class="text-sm text-slate-400 mb-1">Score</div>
                <div class="text-5xl font-black" style="color: ${couleur}">${fb.score.toFixed(1)}</div>
                <div class="text-lg font-bold mt-2" style="color: ${couleur}">${label}</div>
            </div>

            <div class="grid grid-cols-2 gap-3 mt-4">
                <div class="bg-slate-800 p-3 rounded-xl border border-slate-700">
                    <div class="text-xs text-slate-400">V. théorique</div>
                    <div class="text-xl font-black text-yellow-400">${fb.vTheorique.toFixed(1)} km/h</div>
                </div>
                <div class="bg-slate-800 p-3 rounded-xl border border-slate-700">
                    <div class="text-xs text-slate-400">V. réelle</div>
                    <div class="text-xl font-black text-emerald-400">${fb.vReelle} km/h</div>
                </div>
            </div>

            <div class="text-sm text-slate-400 mt-2">
                Écart : <span class="font-bold ${fb.ecart >= 0 ? 'text-emerald-400' : 'text-red-400'}">${fb.ecart >= 0 ? '+' : ''}${fb.ecart.toFixed(1)} km/h</span>
            </div>

            <div class="flex gap-3 mt-6">
                <button onclick="window.relaisKioskGoTo('select-paire')" 
                        class="flex-1 bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-black text-white text-lg active:scale-95 transition-all">
                    🔄 Refaire
                </button>
                <button onclick="window.relaisKioskGoTo('select-groupe')" 
                        class="flex-1 bg-slate-700 hover:bg-slate-600 py-4 rounded-2xl font-black text-white text-lg active:scale-95 transition-all">
                    🏁 Autre groupe
                </button>
            </div>

            <button onclick="window.relaisKioskGoTo('menu')" 
                    class="w-full bg-slate-800 hover:bg-slate-700 py-3 rounded-2xl font-black text-white text-sm active:scale-95 transition-all mt-3">
                ← Menu principal
            </button>
        </div>
    `;
}

// ============================================================
// ACTIONS (exposées sur window)
// ============================================================
window.relaisKioskGoTo = function(mode) {
    state.mode = mode;
    if (mode === 'saisie-vitesses') {
        state.mode = 'select-eleve';
    } else if (mode === 'select-paire' && state.currentGroupeIdx !== null) {
        // rien
    } else if (mode !== 'feedback') {
        state.currentEleve = null;
        state.currentVitesses = { arret: null, lance: null };
        state.currentZone = 0;
    }
    render();
};

window.relaisKioskSelectEleve = function(eleveId) {
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${state.classe}`) || '[]');
    const eleve = eleves.find(e => e.id === eleveId);
    if (!eleve) return;

    state.currentEleve = eleve;
    state.currentVitesses = { arret: null, lance: null };
    state.mode = 'saisie-vitesses';
    render();
};

window.relaisKioskSetZone = function(type, zone) {
    state.currentVitesses[type] = zone;
    render();
};

window.relaisKioskValiderVitesses = async function() {
    const eleve = state.currentEleve;
    const v = state.currentVitesses;
    if (!eleve || !v.arret || !v.lance) return;

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const path = `etablissements/0680013V/profs/${profCode}/${state.classe}/relais/vitesses/${eleve.id}`;

    try {
        await set(ref(db, path), {
            arret: v.arret,
            lance: v.lance,
            timestamp: Date.now()
        });
        alert(`✅ Vitesses enregistrées !\nDépart arrêté : ${zoneToVitesse(v.arret)} km/h\nDépart lancé : ${zoneToVitesse(v.lance)} km/h`);
        state.currentEleve = null;
        state.currentVitesses = { arret: null, lance: null };
        state.mode = 'select-eleve';
        render();
    } catch (err) {
        console.error(err);
        alert('❌ Erreur lors de l\'enregistrement.');
    }
};

window.relaisKioskSelectGroupe = function(groupeIdx) {
    state.currentGroupeIdx = parseInt(groupeIdx);
    state.mode = 'select-paire';
    render();
};

window.relaisKioskSelectPaire = function(paireIdx) {
    const groupe = state.config.groupes[state.currentGroupeIdx];
    if (!groupe) return;

    const paires = getPairesGroupe(groupe.membres);
    const paire = paires[paireIdx];
    if (!paire) return;

    const vRelaye = state.vitesses[paire.relaye.id] || {};
    const vRelayeur = state.vitesses[paire.relayeur.id] || {};

    if (!vRelaye.arret || !vRelayeur.lance) {
        alert(`⚠️ Vitesses manquantes :\n- ${paire.relaye.prenom} doit avoir son "Départ arrêté" saisi\n- ${paire.relayeur.prenom} doit avoir son "Départ lancé" saisi\n\nDemande à ces élèves de saisir leurs vitesses.`);
        return;
    }

    state.currentPaire = paire;
    state.currentZone = 0;
    state.mode = 'saisie-zone';
    render();
};

window.relaisKioskSetZoneRelais = function(zone) {
    state.currentZone = zone;
    render();
};

window.relaisKioskValiderZone = async function() {
    const paire = state.currentPaire;
    const groupeIdx = state.currentGroupeIdx;
    const zone = state.currentZone;
    if (!paire || !zone) return;

    const vRelaye = state.vitesses[paire.relaye.id] || {};
    const vRelayeur = state.vitesses[paire.relayeur.id] || {};
    const vTheo = calculerVTheorique(zoneToVitesse(vRelaye.arret), zoneToVitesse(vRelayeur.lance));
    const vReelle = zoneToVitesse(zone);
    const score = calculerScore(vReelle, vTheo);
    const ecart = vReelle - vTheo;

    const mesure = {
        groupeIdx: groupeIdx,
        groupeNumero: state.config.groupes[groupeIdx].numero,
        pairId: paire.pairId,
        relayeId: paire.relaye.id,
        relayePrenom: paire.relaye.prenom,
        relayeurId: paire.relayeur.id,
        relayeurPrenom: paire.relayeur.prenom,
        zoneAtteinte: zone,
        vReelle: vReelle,
        vTheorique: Math.round(vTheo * 10) / 10,
        score: Math.round(score * 10) / 10,
        ecart: Math.round(ecart * 10) / 10,
        timestamp: Date.now()
    };

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const path = `etablissements/0680013V/profs/${profCode}/${state.classe}/relais/mesures`;

    try {
        await push(ref(db, path), mesure);
        state.lastFeedback = mesure;
        state.mode = 'feedback';
        render();
    } catch (err) {
        console.error(err);
        alert('❌ Erreur lors de l\'enregistrement.');
    }
};

// ============================================================
// NETTOYAGE
// ============================================================
window.retourMenuRelais = function() {
    if (configListener) { configListener(); configListener = null; }
    if (vitessesListener) { vitessesListener(); vitessesListener = null; }
    if (mesuresListener) { mesuresListener(); mesuresListener = null; }
    const container = document.getElementById('relais-module');
    if (container) {
        container.innerHTML = '';
        container.classList.add('hidden');
    }
    if (typeof window.resetToLogin === 'function') {
        window.resetToLogin();
    }
};

export function cleanupRelaisKiosk() {
    if (configListener) { configListener(); configListener = null; }
    if (vitessesListener) { vitessesListener(); vitessesListener = null; }
    if (mesuresListener) { mesuresListener(); mesuresListener = null; }
}