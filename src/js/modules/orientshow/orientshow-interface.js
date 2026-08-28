// src/js/modules/orientshow/orientshow-interface.js

import { getPhotoUrl } from '../../services/admin-service.js';
import { getCurrentClasse, getLocalMapping, setLocalMapping } from '../../core/live-engine.js';
import { setOrientShowConfig, listenOrientShowConfig } from '../../core/firebase-service.js';

const COULEURS = ['NOIR', 'ROUGE', 'BLEU', 'VERT', 'JAUNE'];
const NB_COULEURS = 5;
const NB_NUMEROS = 10;
const NB_CIRCUITS = 12;

let currentClasse = '';
let matrix = {};
let startTime = null;
let endTime = null;

// ---------- EXPORTS pour activities.js ----------
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

    // 1. Générer la grille (postes) et la réserve en utilisant l’ancienne méthode
    renderGridAndReserve();

    // 2. Écouter la config Firebase pour la matrice
    listenOrientShowConfig(currentClasse, (config) => {
        if (config && config.matrix) {
            matrix = config.matrix;
            startTime = config.startTime || null;
            endTime = config.endTime || null;
        } else {
            matrix = {};
            for (let c = 1; c <= NB_CIRCUITS; c++) {
                matrix[c] = {};
                COULEURS.forEach(col => {
                    matrix[c][col] = ['', ''];
                });
            }
            startTime = null;
            endTime = null;
        }
        localStorage.setItem('eps_arena_os_matrix', JSON.stringify(matrix));
        localStorage.setItem('eps_arena_os_startTime', startTime);
        localStorage.setItem('eps_arena_os_endTime', endTime);

        renderMatrix();
        updateChronoButtons();
    });

    document.getElementById('selectClasse').addEventListener('change', () => {
        currentClasse = getCurrentClasse();
        initOrientShowInterface();
    });
}

// ---------- GRID ET RESERVE (reprise de l'ancien os-interface.js) ----------
function renderGridAndReserve() {
    // Grille (os-postesGrid) - identique à l'ancien
    const gridContainer = document.getElementById('os-postesGrid');
    if (gridContainer) {
        let html = `<div class="grid grid-cols-6 gap-2 mb-2"><div></div>`;
        COULEURS.forEach(c => {
            const bg = c === 'NOIR' ? 'bg-black' : c === 'ROUGE' ? 'bg-red-600' : c === 'BLEU' ? 'bg-blue-600' : c === 'VERT' ? 'bg-green-600' : 'bg-yellow-500';
            const text = c === 'JAUNE' ? 'text-black' : 'text-white';
            html += `<div class="${bg} ${text} font-black text-center p-2 rounded-lg uppercase text-[10px] shadow-md">${c}</div>`;
        });
        html += `</div>`;

        for (let ligne = 1; ligne <= NB_NUMEROS; ligne++) {
            html += `<div class="grid grid-cols-6 gap-2 mb-2">`;
            html += `<div class="flex items-center justify-center font-black text-yellow-400 text-2xl bg-slate-900 w-12 h-12 rounded-lg shadow-inner border border-yellow-500/30">${ligne}</div>`;
            COULEURS.forEach(col => {
                const code = `${col}_${ligne}`;
                html += `<div class="os-dropzone bg-slate-800 border border-slate-700 min-h-[50px] flex flex-col gap-1 p-1 rounded-lg" data-code="${code}"></div>`;
            });
            html += `</div>`;
        }
        gridContainer.innerHTML = html;
    }

    // Réserve : charger les élèves non affectés
    loadReserve();
    setTimeout(() => initSortableOS(), 200);
}

async function loadReserve() {
    const reserveContainer = document.getElementById('os-reserve');
    if (!reserveContainer) return;

    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${currentClasse}`) || '[]');
    const mapping = getLocalMapping(currentClasse) || {};

    // Trouver les élèves déjà placés dans les dropzones
    const placedIds = new Set();
    document.querySelectorAll('.os-dropzone [data-id]').forEach(el => placedIds.add(el.dataset.id));

    // Vider la réserve
    reserveContainer.innerHTML = '';

    // Ajouter les élèves non placés
    for (const eleve of eleves) {
        if (!placedIds.has(eleve.id)) {
            reserveContainer.appendChild(await createEleveCard(eleve));
        }
    }
}

async function createEleveCard(eleve) {
    const url = await getPhotoUrl(eleve.id);
    const bgClass = eleve.sexe === 'M' ? 'bg-blue-200 border-blue-400' : (eleve.sexe === 'F' ? 'bg-rose-200 border-rose-400' : 'bg-slate-200 border-slate-400');
    const photoHtml = url ? `<img src="${url}" class="w-8 h-8 rounded-full object-cover border-2 border-slate-500">` : `<div class="w-8 h-8 rounded-full bg-slate-400 flex items-center justify-center text-sm">👤</div>`;

    const div = document.createElement('div');
    div.className = `p-1 rounded border-2 cursor-grab active:cursor-grabbing flex items-center gap-2 ${bgClass}`;
    div.dataset.id = eleve.id;
    div.innerHTML = `${photoHtml}<div class="flex flex-col leading-none"><span class="font-black text-slate-900 text-[10px] truncate max-w-[80px]">${eleve.prenom}</span><span class="text-[9px] font-bold text-slate-600 uppercase truncate max-w-[80px]">${eleve.nom}</span></div>`;
    return div;
}

// ---------- SORTABLE ----------
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
            mapping[`${currentClasse}_${code}`] = card.dataset.id;
        }
    });
    setLocalMapping(currentClasse, mapping);
    // Recharger la réserve pour mettre à jour
    loadReserve();
}

// ---------- MATRICE (inchangée) ----------
function renderMatrix() {
    let container = document.getElementById('os-matrix-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'os-matrix-container';
        container.className = 'bg-slate-900 p-4 rounded-2xl border border-slate-700 overflow-x-auto mb-4';
        const parent = document.getElementById('viewOrientShowSettings');
        if (parent) {
            const nextSibling = parent.querySelector('.flex.gap-4');
            if (nextSibling) {
                parent.insertBefore(container, nextSibling);
            } else {
                parent.appendChild(container);
            }
        }
    }
    let html = `<table class="w-full text-center font-bold text-[10px]"><thead><tr class="bg-slate-900 text-white"><th>#</th>`;
    COULEURS.forEach(col => {
        html += `<th colspan="2" class="py-2 ${col === 'NOIR' ? 'bg-black' : col === 'ROUGE' ? 'bg-red-600' : col === 'BLEU' ? 'bg-blue-600' : col === 'VERT' ? 'bg-green-600' : 'bg-yellow-500 text-black'}">${col}</th>`;
    });
    html += `</tr></thead><tbody>`;
    for (let c = 1; c <= NB_CIRCUITS; c++) {
        html += `<tr class="border-b border-slate-700"><td class="font-black text-slate-500 py-2">C${c}</td>`;
        COULEURS.forEach(col => {
            const val = matrix[c]?.[col] || ['', ''];
            html += `<td><input class="w-10 h-10 bg-slate-900 text-center font-black text-xl text-blue-400 m-0.5 uppercase outline-none rounded shadow-inner" value="${val[0]}" maxlength="1" data-circuit="${c}" data-color="${col}" data-index="0" onchange="window.updateOSMatrixCell(this)"></td>
                     <td><input class="w-10 h-10 bg-slate-900 text-center font-black text-xl text-blue-400 m-0.5 uppercase outline-none rounded shadow-inner" value="${val[1]}" maxlength="1" data-circuit="${c}" data-color="${col}" data-index="1" onchange="window.updateOSMatrixCell(this)"></td>`;
        });
        html += `</tr>`;
    }
    html += `</tbody></table>`;
    container.innerHTML = html;
}

window.updateOSMatrixCell = function(input) {
    const circuit = parseInt(input.dataset.circuit);
    const color = input.dataset.color;
    const index = parseInt(input.dataset.index);
    if (!matrix[circuit]) matrix[circuit] = {};
    if (!matrix[circuit][color]) matrix[circuit][color] = ['', ''];
    matrix[circuit][color][index] = input.value.toUpperCase();
    localStorage.setItem('eps_arena_os_matrix', JSON.stringify(matrix));
    saveMatrixToFirebase();
};

function saveMatrixToFirebase() {
    if (!currentClasse) return;
    const configData = { matrix, startTime, endTime, nbCircuits: NB_CIRCUITS, nbCouleurs: NB_COULEURS };
    setOrientShowConfig(currentClasse, configData);
}

// ---------- CHRONO ----------
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

// ---------- EXPORT / IMPORT ----------
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
            renderMatrix();
            updateChronoButtons();
            alert('✅ Configuration OrientShow importée !');
        } catch (err) {
            alert('❌ Erreur : ' + err.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

export function loadOrientShowAssignments() {
    renderGridAndReserve();
}

// Exposer les fonctions globales
window.initOrientShowInterface = initOrientShowInterface;
window.loadOrientShowAssignments = loadOrientShowAssignments;
window.exportOrientShowConfig = exportOrientShowConfig;
window.importOrientShowConfig = importOrientShowConfig;
window.startOrientShow = startOrientShow;
window.stopOrientShow = stopOrientShow;