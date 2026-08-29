// src/js/modules/orientshow/orientshow-interface.js

import { getPhotoUrl } from '../../services/admin-service.js';
import { getCurrentClasse, getLocalMapping, setLocalMapping } from '../../core/live-engine.js';
import { setOrientShowConfig, listenOrientShowConfig } from '../../core/firebase-service.js';

// Constantes
const COULEURS = ['NOIR', 'ROUGE', 'BLEU', 'VERT', 'JAUNE'];
const NB_NUMEROS = 6;
const NB_CIRCUITS = 12;

let matrix = {};
let startTime = null;
let endTime = null;
let matrixVisible = false;

// --------------------------------------------------------------
// 1. INITIALISATION (appelée par activities.js)
// --------------------------------------------------------------
export function initOrientShowInterface() {
    const container = document.getElementById('viewOrientShowSettings');
    if (!container) return;

    // On vide complètement le conteneur
    container.innerHTML = '';

    // Construire la grille + réserve
    buildGridAndReserve(container);

    // Ajouter le bouton "Matrice"
    addMatrixToggleButton(container);
    addMatrixContainer(container);
    attachClassChangeListener();

    const classe = getCurrentClasse();
    if (classe) {
        listenOrientShowConfig(classe, (config) => {
            if (config && config.matrix) {
                matrix = config.matrix;
                startTime = config.startTime || null;
                endTime = config.endTime || null;
            } else {
                resetMatrix();
                startTime = null;
                endTime = null;
            }
            localStorage.setItem('eps_arena_os_matrix', JSON.stringify(matrix));
            localStorage.setItem('eps_arena_os_startTime', startTime);
            localStorage.setItem('eps_arena_os_endTime', endTime);
            if (matrixVisible) renderMatrix();
            updateChronoButtons();
        });
    }

    loadOrientShowAssignments();
}

// --------------------------------------------------------------
// 2. CONSTRUCTION DU DOM
// --------------------------------------------------------------
function buildGridAndReserve(container) {
    const mainDiv = document.createElement('div');
    mainDiv.className = 'flex gap-4';

    // Réserve (largeur ajustée à 1/3 pour mieux contenir 2 colonnes)
    const reserveCol = document.createElement('div');
    reserveCol.className = 'w-1/3 shrink-0 bg-slate-900 p-4 rounded-2xl border-2 border-dashed border-slate-600';
    reserveCol.innerHTML = `
        <div class="flex justify-between items-center mb-3">
            <h4 class="font-bold text-slate-400 uppercase text-xs">Réserve</h4>
            <button onclick="window.populateReserveOS()" class="bg-blue-600 px-3 py-1 rounded-xl font-black text-[10px] uppercase text-white">⬇️ Charger (reset)</button>
        </div>
        <div id="os-reserve" class="grid grid-cols-2 gap-1 min-h-[200px]"></div>
    `;

    // Grille des postes (2/3 restants)
    const gridCol = document.createElement('div');
    gridCol.className = 'flex-1 bg-slate-800 p-4 border border-slate-700 rounded-xl overflow-x-auto';
    gridCol.innerHTML = `
        <h3 class="font-bold text-slate-400 uppercase text-xs mb-3">Groupes par code (couleur_numéro)</h3>
        <div id="os-postesGrid" class="min-w-[600px]"></div>
    `;

    mainDiv.appendChild(reserveCol);
    mainDiv.appendChild(gridCol);
    container.appendChild(mainDiv);

    // Remplir la grille des postes (sans espace entre le numéro et les colonnes)
    const gridContainer = document.getElementById('os-postesGrid');
    if (gridContainer) {
        // En-tête des couleurs
        let headerHtml = `<div class="flex items-center mb-2">
            <div class="w-12 shrink-0"></div> <!-- placeholder pour aligner -->
            <div class="flex flex-1 gap-0">`;
        COULEURS.forEach(c => {
            const bg = c === 'NOIR' ? 'bg-black' : c === 'ROUGE' ? 'bg-red-600' : c === 'BLEU' ? 'bg-blue-600' : c === 'VERT' ? 'bg-green-600' : 'bg-yellow-500';
            const text = c === 'JAUNE' ? 'text-black' : 'text-white';
            headerHtml += `<div class="${bg} ${text} font-black text-center p-2 rounded-t-lg uppercase text-[10px] flex-1">${c}</div>`;
        });
        headerHtml += `</div></div>`;
        gridContainer.innerHTML = headerHtml;

        // Lignes de numéros
        for (let ligne = 1; ligne <= NB_NUMEROS; ligne++) {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'flex items-stretch mb-1'; // pas d'espace vertical
            // Numéro jaune
            const numDiv = document.createElement('div');
            numDiv.className = 'w-12 shrink-0 flex items-center justify-center font-black text-yellow-400 text-2xl bg-slate-900 rounded-l-lg border-r-0 border border-yellow-500/30';
            numDiv.textContent = ligne;
            rowDiv.appendChild(numDiv);

            // Colonnes des couleurs (sans gap)
            const colsDiv = document.createElement('div');
            colsDiv.className = 'flex flex-1 gap-0';
            COULEURS.forEach(col => {
                const code = `${col}_${ligne}`;
                const dropzone = document.createElement('div');
                dropzone.className = 'os-dropzone bg-slate-800 border border-slate-700 min-h-[50px] flex flex-col gap-1 p-1 flex-1';
                dropzone.dataset.code = code;
                colsDiv.appendChild(dropzone);
            });
            rowDiv.appendChild(colsDiv);
            gridContainer.appendChild(rowDiv);
        }
    }
}

// --------------------------------------------------------------
// 3. MATRICE (affichage/masquage)
// --------------------------------------------------------------
function addMatrixToggleButton(container) {
    const btn = document.createElement('button');
    btn.id = 'os-toggle-matrix';
    btn.className = 'bg-purple-600 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-purple-400 mt-4';
    btn.textContent = '📝 Matrice de correction';
    btn.onclick = toggleMatrixVisibility;
    container.appendChild(btn);
}

function addMatrixContainer(container) {
    const matrixContainer = document.createElement('div');
    matrixContainer.id = 'os-matrix-container';
    matrixContainer.className = 'bg-slate-900 p-4 rounded-2xl border border-slate-700 overflow-x-auto mt-4 hidden';
    container.appendChild(matrixContainer);
}

function toggleMatrixVisibility() {
    matrixVisible = !matrixVisible;
    const container = document.getElementById('os-matrix-container');
    if (container) {
        container.classList.toggle('hidden', !matrixVisible);
        if (matrixVisible) renderMatrix();
    }
}
window.openOSMatrixModal = toggleMatrixVisibility;

// --------------------------------------------------------------
// 4. GESTION DU CHANGEMENT DE CLASSE
// --------------------------------------------------------------
function attachClassChangeListener() {
    const select = document.getElementById('selectClasse');
    if (!select) return;
    select.removeEventListener('change', onClassChange);
    select.addEventListener('change', onClassChange);
}

function onClassChange() {
    const classe = getCurrentClasse();
    if (classe) {
        listenOrientShowConfig(classe, (config) => {
            if (config && config.matrix) {
                matrix = config.matrix;
                startTime = config.startTime || null;
                endTime = config.endTime || null;
            } else {
                resetMatrix();
                startTime = null;
                endTime = null;
            }
            localStorage.setItem('eps_arena_os_matrix', JSON.stringify(matrix));
            localStorage.setItem('eps_arena_os_startTime', startTime);
            localStorage.setItem('eps_arena_os_endTime', endTime);
            if (matrixVisible) renderMatrix();
            updateChronoButtons();
        });
    }
    loadOrientShowAssignments();
}

// --------------------------------------------------------------
// 5. CHARGEMENT DES AFFECTATIONS (restaure le mapping)
// --------------------------------------------------------------
export async function loadOrientShowAssignments() {
    if (!document.getElementById('os-postesGrid')) {
        initOrientShowInterface();
        setTimeout(() => loadOrientShowAssignments(), 50);
        return;
    }

    const classe = getCurrentClasse();
    if (!classe) {
        document.querySelectorAll('.os-dropzone').forEach(el => el.innerHTML = '');
        const reserve = document.getElementById('os-reserve');
        if (reserve) reserve.innerHTML = '<p class="text-slate-500 text-xs col-span-2">Sélectionnez une classe.</p>';
        return;
    }

    const mapping = getLocalMapping(classe) || {};
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');

    // Vider tout
    document.querySelectorAll('.os-dropzone').forEach(el => el.innerHTML = '');
    const reserveContainer = document.getElementById('os-reserve');
    if (reserveContainer) reserveContainer.innerHTML = '';

    // Placer selon le mapping
    const placedIds = new Set();
    for (const [key, eleveId] of Object.entries(mapping)) {
        const codePart = key.replace(`${classe}_`, '');
        const match = codePart.match(/^([A-Z]+)_(\d+)$/);
        if (match) {
            const color = match[1];
            const num = parseInt(match[2], 10);
            const dropzone = document.querySelector(`.os-dropzone[data-code="${color}_${num}"]`);
            if (dropzone) {
                const eleve = eleves.find(e => e.id === eleveId);
                if (eleve) {
                    const card = await createEleveCard(eleve);
                    dropzone.appendChild(card);
                    placedIds.add(eleveId);
                }
            }
        }
    }

    // Réserve : tous les élèves non placés
    if (reserveContainer) {
        for (const eleve of eleves) {
            if (!placedIds.has(eleve.id)) {
                const card = await createEleveCard(eleve);
                reserveContainer.appendChild(card);
            }
        }
        // Si aucun élève dans la réserve, afficher un message
        if (reserveContainer.children.length === 0) {
            reserveContainer.innerHTML = '<p class="text-slate-500 text-xs col-span-2">Tous les élèves sont affectés.</p>';
        }
    }

    initSortableOS();
}

// --------------------------------------------------------------
// 6. BOUTON "CHARGER" : RESET COMPLET (tout en réserve)
// --------------------------------------------------------------
export async function resetAllToReserve() {
    const classe = getCurrentClasse();
    if (!classe) {
        alert('Veuillez sélectionner une classe.');
        return;
    }

    // Vider toutes les dropzones et la réserve
    document.querySelectorAll('.os-dropzone').forEach(el => el.innerHTML = '');
    const reserveContainer = document.getElementById('os-reserve');
    if (reserveContainer) reserveContainer.innerHTML = '';

    // Récupérer tous les élèves
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');

    // Ajouter tous les élèves dans la réserve
    if (reserveContainer) {
        for (const eleve of eleves) {
            const card = await createEleveCard(eleve);
            reserveContainer.appendChild(card);
        }
        if (eleves.length === 0) {
            reserveContainer.innerHTML = '<p class="text-slate-500 text-xs col-span-2">Aucun élève dans cette classe.</p>';
        }
    }

    // Supprimer le mapping local pour cette classe
    setLocalMapping(classe, {});

    // Réinitialiser Sortable
    initSortableOS();
}

// Exposer le bouton "Charger" avec la nouvelle fonction
window.populateReserveOS = resetAllToReserve;

// --------------------------------------------------------------
// 7. SAUVEGARDE DES AFFECTATIONS (après glissé)
// --------------------------------------------------------------
export function saveOrientShowAssignments() {
    const classe = getCurrentClasse();
    if (!classe) return;

    const mapping = {};
    document.querySelectorAll('.os-dropzone').forEach(zone => {
        const code = zone.dataset.code;
        const card = zone.querySelector('[data-id]');
        if (card) {
            mapping[`${classe}_${code}`] = card.dataset.id;
        }
    });
    setLocalMapping(classe, mapping);
    refreshReserve();
}

async function refreshReserve() {
    const classe = getCurrentClasse();
    if (!classe) return;

    const mapping = getLocalMapping(classe) || {};
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');
    const placedIds = new Set();
    document.querySelectorAll('.os-dropzone [data-id]').forEach(el => placedIds.add(el.dataset.id));

    const reserveContainer = document.getElementById('os-reserve');
    if (!reserveContainer) return;
    reserveContainer.innerHTML = '';
    for (const eleve of eleves) {
        if (!placedIds.has(eleve.id)) {
            const card = await createEleveCard(eleve);
            reserveContainer.appendChild(card);
        }
    }
    if (reserveContainer.children.length === 0) {
        reserveContainer.innerHTML = '<p class="text-slate-500 text-xs col-span-2">Tous les élèves sont affectés.</p>';
    }
    initSortableOS();
}

// --------------------------------------------------------------
// 8. CRÉATION D'UNE CARTE ÉLÈVE (style escalade)
// --------------------------------------------------------------
async function createEleveCard(eleve) {
    const url = await getPhotoUrl(eleve.id);
    let bgClass = 'bg-slate-200 border-slate-400';
    if (eleve.sexe === 'M') bgClass = 'bg-blue-200 border-blue-400';
    else if (eleve.sexe === 'F') bgClass = 'bg-rose-200 border-rose-400';
    
    const photoHtml = url 
        ? `<img src="${url}" class="w-10 h-10 rounded-full object-cover border-2 border-slate-500">`
        : `<div class="w-10 h-10 rounded-full bg-slate-400 flex items-center justify-center text-xl">👤</div>`;

    const div = document.createElement('div');
    div.className = `p-2 rounded-lg border-2 cursor-grab active:cursor-grabbing flex items-center gap-3 ${bgClass}`;
    div.dataset.id = eleve.id;
    div.innerHTML = `
        ${photoHtml}
        <div class="flex flex-col leading-tight">
            <span class="font-black text-slate-900 text-base">${eleve.prenom}</span>
            <span class="text-xs font-bold text-slate-600 uppercase">${eleve.nom}</span>
        </div>
    `;
    return div;
}

// --------------------------------------------------------------
// 9. SORTABLE (glisser-déposer)
// --------------------------------------------------------------
function initSortableOS() {
    if (typeof Sortable === 'undefined') return;

    const reserve = document.getElementById('os-reserve');
    if (reserve && !reserve.__sortable) {
        reserve.__sortable = new Sortable(reserve, {
            group: 'os',
            animation: 150,
            onEnd: saveOrientShowAssignments
        });
    }

    document.querySelectorAll('.os-dropzone').forEach(el => {
        if (!el.__sortable) {
            el.__sortable = new Sortable(el, {
                group: 'os',
                animation: 150,
                onEnd: saveOrientShowAssignments
            });
        }
    });
}

// --------------------------------------------------------------
// 10. MATRICE DE CORRECTION (rendu)
// --------------------------------------------------------------
function resetMatrix() {
    matrix = {};
    for (let c = 1; c <= NB_CIRCUITS; c++) {
        matrix[c] = {};
        COULEURS.forEach(col => {
            matrix[c][col] = ['', ''];
        });
    }
}

function renderMatrix() {
    const container = document.getElementById('os-matrix-container');
    if (!container) return;
    if (!matrix || Object.keys(matrix).length === 0) resetMatrix();

    let html = `<table class="w-full text-center font-bold text-[10px]"><thead><tr class="bg-slate-900 text-white"><th>#</th>`;
    COULEURS.forEach(col => {
        const bg = col === 'NOIR' ? 'bg-black' : col === 'ROUGE' ? 'bg-red-600' : col === 'BLEU' ? 'bg-blue-600' : col === 'VERT' ? 'bg-green-600' : 'bg-yellow-500 text-black';
        html += `<th colspan="2" class="py-2 ${bg}">${col}</th>`;
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
    const classe = getCurrentClasse();
    if (!classe) return;
    const configData = { matrix, startTime, endTime, nbCircuits: NB_CIRCUITS, nbCouleurs: COULEURS.length };
    setOrientShowConfig(classe, configData);
}

// --------------------------------------------------------------
// 11. CHRONO
// --------------------------------------------------------------
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
    const classe = getCurrentClasse();
    if (!classe) return alert('Choisissez une classe.');
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

window.startOrientShow = startOrientShow;
window.stopOrientShow = stopOrientShow;

// --------------------------------------------------------------
// 12. EXPORT / IMPORT JSON (avec mapping)
// --------------------------------------------------------------
export function exportOrientShowConfig() {
    const classe = getCurrentClasse();
    if (!classe) return alert('Choisissez une classe.');
    saveMatrixToFirebase();
    const mapping = getLocalMapping(classe) || {};
    const data = {
        version: 1,
        classe: classe,
        activite: 'orientshow',
        date: new Date().toISOString().slice(0,10).replace(/-/g,''),
        matrix: matrix,
        startTime,
        endTime,
        nbCircuits: NB_CIRCUITS,
        nbCouleurs: COULEURS.length,
        mapping: mapping
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${classe}_orientshow_${data.date}.json`;
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
            const classe = data.classe;
            matrix = data.matrix;
            startTime = data.startTime || null;
            endTime = data.endTime || null;
            localStorage.setItem('eps_arena_os_matrix', JSON.stringify(matrix));
            localStorage.setItem('eps_arena_os_startTime', startTime);
            localStorage.setItem('eps_arena_os_endTime', endTime);
            if (data.mapping) {
                setLocalMapping(classe, data.mapping);
            }
            const select = document.getElementById('selectClasse');
            if (select && select.value !== classe) {
                select.value = classe;
                select.dispatchEvent(new Event('change'));
            } else {
                loadOrientShowAssignments();
                if (matrixVisible) renderMatrix();
                updateChronoButtons();
            }
            alert('✅ Configuration OrientShow importée !');
        } catch (err) {
            alert('❌ Erreur : ' + err.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

window.exportOrientShowConfig = exportOrientShowConfig;
window.importOrientShowConfig = importOrientShowConfig;