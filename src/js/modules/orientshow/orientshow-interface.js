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
        // Au lieu d'afficher un message, on écoute le changement de classe
        const select = document.getElementById('selectClasse');
        if (select) {
            select.addEventListener('change', function onClassChange() {
                currentClasse = this.value;
                if (currentClasse) {
                    select.removeEventListener('change', onClassChange);
                    initOrientShowInterface(); // recharger
                }
            });
        }
        // On affiche un message temporaire
        container.innerHTML = '<p class="text-slate-500">Veuillez sélectionner une classe.</p>';
        return;
    }

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
        renderReserveAndGroups();
        updateChronoButtons();
    });

    document.getElementById('selectClasse').addEventListener('change', () => {
        currentClasse = getCurrentClasse();
        initOrientShowInterface();
    });
}

export function loadOrientShowAssignments() {
    // Cette fonction recharge l'affichage (appelée dans switchDiscipline)
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
function renderMatrix() {
    // 1. Chercher ou créer le conteneur
    let container = document.getElementById('os-matrix-container');
    if (!container) {
        // Créer le conteneur s'il n'existe pas
        container = document.createElement('div');
        container.id = 'os-matrix-container';
        container.className = 'bg-slate-900 p-4 rounded-2xl border border-slate-700 overflow-x-auto mb-4';
        // L'insérer dans viewOrientShowSettings avant la zone Réserve/Grille
        const parent = document.getElementById('viewOrientShowSettings');
        if (parent) {
            // Insérer juste avant le premier élément qui a la classe "flex gap-4" (la zone Réserve)
            const nextSibling = parent.querySelector('.flex.gap-4');
            if (nextSibling) {
                parent.insertBefore(container, nextSibling);
            } else {
                parent.appendChild(container);
            }
        } else {
            console.error('viewOrientShowSettings introuvable');
            return;
        }
    }

    // 2. Générer le HTML de la matrice (le code existant)
    let html = `<table class="w-full text-center font-bold text-[10px]">
        <thead><tr class="bg-slate-900 text-white">
            <th>#</th>`;
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

function renderReserveAndGroups() {
    const reserveContainer = document.getElementById('os-reserve');
    const gridContainer = document.getElementById('os-postesGrid');
    if (!reserveContainer || !gridContainer) return;

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

    let html = `<div class="grid grid-cols-${NB_COULEURS + 1} gap-2">`;
    html += `<div></div>`;
    COULEURS.forEach(col => {
        html += `<div class="font-black text-center p-1 text-[10px] uppercase">${col}</div>`;
    });
    html += `</div>`;

    for (let num = 1; num <= NB_NUMEROS; num++) {
        html += `<div class="grid grid-cols-${NB_COULEURS + 1} gap-2 mb-2">`;
        html += `<div class="flex items-center justify-center font-black text-yellow-400 text-2xl">${num}</div>`;
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
    renderReserveAndGroups();
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

// Exposer les fonctions globales pour les boutons HTML (si besoin)
window.initOrientShowInterface = initOrientShowInterface;
window.loadOrientShowAssignments = loadOrientShowAssignments;
window.exportOrientShowConfig = exportOrientShowConfig;
window.importOrientShowConfig = importOrientShowConfig;
window.startOrientShow = startOrientShow;
window.stopOrientShow = stopOrientShow;