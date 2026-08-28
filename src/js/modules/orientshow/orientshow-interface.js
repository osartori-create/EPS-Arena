// src/js/modules/orientshow/orientshow-interface.js

import { getPhotoUrl } from '../../services/admin-service.js';
import { getCurrentClasse, getLocalMapping, setLocalMapping } from '../../core/live-engine.js';
import { setOrientShowConfig, listenOrientShowConfig } from '../../core/firebase-service.js';

const COULEURS = ['NOIR', 'ROUGE', 'BLEU', 'VERT', 'JAUNE'];
const NB_COULEURS = 5;
const NB_NUMEROS = 6; // 6 numéros (1 à 6)
const NB_CIRCUITS = 12;

// Matrice par défaut (identique à l'ancien)
const DEFAULT_MATRIX = {
    1:{NOIR:["D","O"],ROUGE:["Y","E"],BLEU:["N","K"],VERT:["",""],JAUNE:["",""]},
    2:{NOIR:["E","X"],ROUGE:["T","R"],BLEU:["A","L"],VERT:["",""],JAUNE:["",""]},
    3:{NOIR:["C","H"],ROUGE:["I","O"],BLEU:["T","E"],VERT:["",""],JAUNE:["",""]},
    4:{NOIR:["R","E"],ROUGE:["C","N"],BLEU:["O","I"],VERT:["",""],JAUNE:["",""]},
    5:{NOIR:["A","J"],ROUGE:["O","E"],BLEU:["S","C"],VERT:["",""],JAUNE:["",""]},
    6:{NOIR:["F","I"],ROUGE:["C","S"],BLEU:["U","U"],VERT:["",""],JAUNE:["",""]},
    7:{NOIR:["G","U"],ROUGE:["E","H"],BLEU:["E","C"],VERT:["",""],JAUNE:["",""]},
    8:{NOIR:["I","V"],ROUGE:["R","N"],BLEU:["S","C"],VERT:["",""],JAUNE:["",""]},
    9:{NOIR:["K","R"],ROUGE:["A","T"],BLEU:["N","C"],VERT:["",""],JAUNE:["",""]},
    10:{NOIR:["O","C"],ROUGE:["I","Z"],BLEU:["E","C"],VERT:["",""],JAUNE:["",""]},
    11:{NOIR:["P","A"],ROUGE:["L","D"],BLEU:["U","U"],VERT:["",""],JAUNE:["",""]},
    12:{NOIR:["U","L"],ROUGE:["N","A"],BLEU:["H","T"],VERT:["",""],JAUNE:["",""]}
};

let currentClasse = '';
let matrix = {};
let startTime = null;
let endTime = null;

// ---------- EXPORTS ----------
export function initOrientShowInterface() {
    const container = document.getElementById('viewOrientShowSettings');
    if (!container) return;

    currentClasse = getCurrentClasse();
    if (!currentClasse) {
        const select = document.getElementById('selectClasse');
        if (select) {
            select.addEventListener('change', function onClassChange() {
                currentClasse = this.value;
                if (currentClasse) {
                    select.removeEventListener('change', onClassChange);
                    initOrientShowInterface();
                }
            });
        }
        container.innerHTML = '<p class="text-slate-500">Veuillez sélectionner une classe.</p>';
        return;
    }

    // Charger la config Firebase
    listenOrientShowConfig(currentClasse, (config) => {
        if (config && config.matrix) {
            matrix = config.matrix;
            startTime = config.startTime || null;
            endTime = config.endTime || null;
        } else {
            // Utiliser la matrice par défaut
            matrix = JSON.parse(JSON.stringify(DEFAULT_MATRIX));
            startTime = null;
            endTime = null;
        }
        localStorage.setItem('eps_arena_os_matrix', JSON.stringify(matrix));
        localStorage.setItem('eps_arena_os_startTime', startTime);
        localStorage.setItem('eps_arena_os_endTime', endTime);
        
        // Rendu de la grille (réserve + dropzones)
        renderReserveAndGroups();
        updateChronoButtons();
    });

    document.getElementById('selectClasse').addEventListener('change', () => {
        currentClasse = getCurrentClasse();
        initOrientShowInterface();
    });
}

export function loadOrientShowAssignments() {
    renderReserveAndGroups();
}

export function exportOrientShowConfig() {
    saveMatrixToFirebase();
    const data = {
        version: 1,
        classe: currentClasse,
        activite: 'orientshow',
        date: new Date().toISOString().slice(0,10).replace(/-/g,''),
        matrix: matrix,
        startTime,
        endTime,
        nbCircuits: NB_CIRCUITS,
        nbCouleurs: NB_COULEURS
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${currentClasse}_orientshow_${data.date}.json`;
    a.click();
}

export function importOrientShowConfig(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.classe || !data.matrix) throw new Error('Format invalide');
            matrix = data.matrix;
            startTime = data.startTime || null;
            endTime = data.endTime || null;
            localStorage.setItem('eps_arena_os_matrix', JSON.stringify(matrix));
            localStorage.setItem('eps_arena_os_startTime', startTime);
            localStorage.setItem('eps_arena_os_endTime', endTime);
            setOrientShowConfig(currentClasse, { matrix, startTime, endTime, nbCircuits: NB_CIRCUITS, nbCouleurs: NB_COULEURS });
            renderReserveAndGroups();
            updateChronoButtons();
            alert('✅ Configuration OrientShow importée !');
        } catch (err) {
            alert('❌ Erreur : ' + err.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

export function startOrientShow() {
    if (!currentClasse) return alert('Choisissez une classe.');
    startTime = Date.now();
    endTime = null;
    localStorage.setItem('eps_arena_os_startTime', startTime);
    localStorage.setItem('eps_arena_os_endTime', null);
    saveMatrixToFirebase();
    updateChronoButtons();
}

export function stopOrientShow() {
    if (!startTime) return;
    endTime = Date.now();
    localStorage.setItem('eps_arena_os_endTime', endTime);
    saveMatrixToFirebase();
    updateChronoButtons();
}

// ---------- Fonctions internes ----------

function saveMatrixToFirebase() {
    if (!currentClasse) return;
    const configData = { matrix, startTime, endTime, nbCircuits: NB_CIRCUITS, nbCouleurs: NB_COULEURS };
    setOrientShowConfig(currentClasse, configData);
}

// Ouvre la modal de la matrice (bouton "Matrice")
window.openOSMatrixModal = function() {
    let matrix = JSON.parse(localStorage.getItem('eps_arena_os_matrix') || JSON.stringify(DEFAULT_MATRIX));
    let html = `<div class="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4">
        <div class="bg-slate-800 w-full max-w-3xl rounded-3xl p-6 border border-slate-700 relative">
            <button onclick="document.getElementById('osMatrixModal').remove()" class="absolute top-4 right-4 text-3xl text-slate-400 hover:text-white">&times;</button>
            <h3 class="font-black text-blue-400 text-lg mb-4">Matrice des Balises</h3>
            <div class="overflow-x-auto">
                <table class="w-full text-center font-bold text-[10px]">`;
    html += `<tr class="bg-slate-900 text-white"><th>#</th><th colspan="2" class="bg-black">NOIR</th><th colspan="2" class="bg-red-600">ROUGE</th><th colspan="2" class="bg-blue-600">BLEU</th><th colspan="2" class="bg-green-600">VERT</th><th colspan="2" class="bg-yellow-500 text-black">JAUNE</th></tr>`;
    for(let c=1; c<=NB_CIRCUITS; c++) {
        html += `<tr class="border-b border-slate-700"><td class="font-black text-slate-500 py-1">C${c}</td>`;
        COULEURS.forEach(col => {
            const l = matrix[c]?.[col] || ["",""];
            html += `
                <td><input class="w-8 h-8 bg-slate-900 text-center font-bold text-blue-400 m-0.5 uppercase outline-none rounded shadow-inner" value="${l[0]}" maxlength="1" onchange="window.saveOSMatrix(${c}, '${col}', 0, this.value)"></td>
                <td class="border-r border-slate-700/50"><input class="w-8 h-8 bg-slate-900 text-center font-bold text-blue-400 m-0.5 uppercase outline-none rounded shadow-inner" value="${l[1]}" maxlength="1" onchange="window.saveOSMatrix(${c}, '${col}', 1, this.value)"></td>`;
        });
        html += `</tr>`;
    }
    html += `</table></div></div></div>`;
    const modal = document.createElement('div');
    modal.id = 'osMatrixModal';
    modal.innerHTML = html;
    document.body.appendChild(modal);
};

window.saveOSMatrix = function(circuit, color, index, val) {
    let matrix = JSON.parse(localStorage.getItem('eps_arena_os_matrix')) || {};
    if(!matrix[circuit]) matrix[circuit] = {};
    if(!matrix[circuit][color]) matrix[circuit][color] = ["",""];
    matrix[circuit][color][index] = val.toUpperCase();
    localStorage.setItem('eps_arena_os_matrix', JSON.stringify(matrix));
    // Sauvegarder dans Firebase
    const configData = { matrix, startTime, endTime, nbCircuits: NB_CIRCUITS, nbCouleurs: NB_COULEURS };
    setOrientShowConfig(currentClasse, configData);
};

// Rendu de la réserve et de la grille (avec 6 numéros)
function renderReserveAndGroups() {
    const reserveContainer = document.getElementById('os-reserve');
    const gridContainer = document.getElementById('os-postesGrid');
    if (!reserveContainer || !gridContainer) return;

    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${currentClasse}`) || '[]');
    const mapping = getLocalMapping(currentClasse) || {};

    // Réserve : élèves non affectés
    const assignedCodes = new Set();
    Object.keys(mapping).forEach(key => {
        if (key.startsWith(currentClasse + '_')) {
            assignedCodes.add(key);
        }
    });
    const reserveEleves = eleves.filter(e => !assignedCodes.has(`${currentClasse}_${e.id}`));

    reserveContainer.innerHTML = '';
    reserveEleves.forEach(eleve => {
        const card = createEleveCard(eleve);
        reserveContainer.appendChild(card);
    });

    // Grille : 6 numéros x 5 couleurs
    let html = `<div class="grid grid-cols-6 gap-2 mb-2"><div></div>`;
    COULEURS.forEach(col => {
        const colorClass = col === 'NOIR' ? 'bg-black' : col === 'ROUGE' ? 'bg-red-600' : col === 'BLEU' ? 'bg-blue-600' : col === 'VERT' ? 'bg-green-600' : 'bg-yellow-500';
        const textClass = col === 'JAUNE' ? 'text-black' : 'text-white';
        html += `<div class="${colorClass} ${textClass} font-black text-center p-2 rounded-lg uppercase text-[10px] shadow-md">${col}</div>`;
    });
    html += `</div>`;

    for (let num = 1; num <= NB_NUMEROS; num++) {
        html += `<div class="grid grid-cols-6 gap-2 mb-2">
            <div class="flex items-center justify-center font-black text-yellow-400 text-5xl bg-slate-900 w-12 h-12 rounded-lg shadow-inner border border-yellow-500/30">${num}</div>`;
        COULEURS.forEach(col => {
            const code = `${col}_${num}`;
            const mappingKey = `${currentClasse}_${code}`;
            const eleveId = mapping[mappingKey] || null;
            const eleve = eleves.find(e => e.id === eleveId);
            html += `<div class="os-dropzone bg-slate-800 border border-slate-700 min-h-[50px] flex flex-col gap-1 p-1 rounded-lg" data-code="${code}">`;
            if (eleve) {
                html += createEleveCardHTML(eleve);
            }
            html += `</div>`;
        });
        html += `</div>`;
    }
    gridContainer.innerHTML = html;

    setTimeout(() => initSortableOS(), 100);
}

function createEleveCard(eleve) {
    const div = document.createElement('div');
    div.className = 'p-2 rounded border-2 cursor-grab active:cursor-grabbing flex items-center gap-3 w-full bg-slate-200 border-slate-400';
    div.dataset.id = eleve.id;
    div.innerHTML = `<div class="w-8 h-8 rounded-full bg-slate-400 flex items-center justify-center text-sm">👤</div>
                     <div class="flex flex-col leading-tight overflow-hidden">
                         <span class="font-black text-slate-900 text-sm truncate">${eleve.prenom}</span>
                         <span class="text-xs font-bold text-slate-600 uppercase truncate">${eleve.nom}</span>
                     </div>`;
    return div;
}

function createEleveCardHTML(eleve) {
    return `<div class="p-1 rounded bg-slate-700 text-white flex items-center gap-1" data-id="${eleve.id}">
                <span class="text-xs font-bold">${eleve.prenom} ${eleve.nom}</span>
            </div>`;
}

function initSortableOS() {
    if (typeof Sortable === 'undefined') return;
    const reserve = document.getElementById('os-reserve');
    if (reserve && !reserve.__sortable) {
        reserve.__sortable = new Sortable(reserve, {
            group: 'os',
            animation: 150,
            onEnd: saveOSAssignments
        });
    }
    document.querySelectorAll('.os-dropzone').forEach(el => {
        if (!el.__sortable) {
            el.__sortable = new Sortable(el, {
                group: 'os',
                animation: 150,
                onEnd: saveOSAssignments
            });
        }
    });
}

function saveOSAssignments() {
    const mapping = {};
    document.querySelectorAll('.os-dropzone').forEach(zone => {
        const code = zone.dataset.code;
        const card = zone.querySelector('[data-id]');
        if (card) {
            const eleveId = card.dataset.id;
            mapping[`${currentClasse}_${code}`] = eleveId;
        }
    });
    setLocalMapping(currentClasse, mapping);
    // Ne pas rappeler renderReserveAndGroups pour éviter la boucle
    // On peut juste recharger la réserve pour mettre à jour
    // Mais on va juste laisser le mapping à jour
    // L'affichage sera mis à jour au prochain chargement
    // Pour un rafraîchissement immédiat, on pourrait re-rendre, mais attention aux boucles
    // On peut juste mettre à jour la réserve en retirant les élèves affectés
    // On va simplement re-render la réserve (pas la grille) pour retirer les élèves placés
    renderReserveOnly();
}

function renderReserveOnly() {
    const reserveContainer = document.getElementById('os-reserve');
    if (!reserveContainer) return;
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${currentClasse}`) || '[]');
    const mapping = getLocalMapping(currentClasse) || {};
    const assignedCodes = new Set();
    Object.keys(mapping).forEach(key => {
        if (key.startsWith(currentClasse + '_')) {
            assignedCodes.add(key);
        }
    });
    const reserveEleves = eleves.filter(e => !assignedCodes.has(`${currentClasse}_${e.id}`));
    reserveContainer.innerHTML = '';
    reserveEleves.forEach(eleve => {
        const card = createEleveCard(eleve);
        reserveContainer.appendChild(card);
    });
}

function updateChronoButtons() {
    const btnStart = document.getElementById('os-start-btn');
    const btnStop = document.getElementById('os-stop-btn');
    if (!btnStart || !btnStop) return;
    if (!startTime) {
        btnStart.disabled = false;
        btnStop.disabled = true;
        btnStart.innerText = '🚀 TOP DÉPART';
    } else if (!endTime) {
        btnStart.disabled = true;
        btnStop.disabled = false;
        btnStart.innerText = '⏳ Course en cours';
        btnStop.innerText = '🛑 ARRÊTER';
    } else {
        btnStart.disabled = true;
        btnStop.disabled = true;
        btnStart.innerText = '✅ Terminée';
        btnStop.innerText = '⏱️ Arrêtée';
    }
}

// Fonctions globales pour les boutons
window.initOrientShowInterface = initOrientShowInterface;
window.loadOrientShowAssignments = loadOrientShowAssignments;
window.exportOrientShowConfig = exportOrientShowConfig;
window.importOrientShowConfig = importOrientShowConfig;
window.startOrientShow = startOrientShow;
window.stopOrientShow = stopOrientShow;
window.openOSMatrixModal = openOSMatrixModal;
window.saveOSMatrix = saveOSMatrix;