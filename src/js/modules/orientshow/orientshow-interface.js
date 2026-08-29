// src/js/modules/orientshow/orientshow-interface.js

import { getPhotoUrl } from '../../services/admin-service.js';
import { getCurrentClasse, getLocalMapping, setLocalMapping } from '../../core/live-engine.js';
import { setOrientShowConfig, listenOrientShowConfig } from '../../core/firebase-service.js';
import { DEFAULT_OS_MATRIX } from '../../config/orientshow-default-codes.js';
console.log('DEFAULT_OS_MATRIX chargé :', DEFAULT_OS_MATRIX);

// Constantes
const COULEURS = ['NOIR', 'ROUGE', 'BLEU', 'VERT', 'JAUNE'];
const NB_NUMEROS = 6;
const NB_CIRCUITS = 12;

let matrix = {};
let startTime = null;
let endTime = null;
let matrixVisible = false;

// --------------------------------------------------------------
// 1. INITIALISATION
// --------------------------------------------------------------
export function initOrientShowInterface() {
    const container = document.getElementById('viewOrientShowSettings');
    if (!container) return;

    container.innerHTML = '';

    const header = createHeader();
    container.appendChild(header);

    const main = createMain();
    container.appendChild(main);

    const matrixContainer = createMatrixContainer();
    container.appendChild(matrixContainer);

    // IMPORTANT : on initialise la matrice avec les valeurs par défaut
    resetMatrix();

    // On tente de charger la config Firebase pour écraser les valeurs par défaut
    const classe = getCurrentClasse();
    if (classe) {
        listenOrientShowConfig(classe, (config) => {
            // Fusion : on part des valeurs par défaut, on écrase avec la config Firebase
            const defaultMatrix = JSON.parse(JSON.stringify(DEFAULT_OS_MATRIX));
            if (config && config.matrix) {
                for (const circuit of Object.keys(defaultMatrix)) {
                    if (config.matrix[circuit]) {
                        for (const color of COULEURS) {
                            if (config.matrix[circuit][color] && config.matrix[circuit][color].length === 2) {
                                defaultMatrix[circuit][color] = [...config.matrix[circuit][color]];
                            }
                        }
                    }
                }
            }
            matrix = defaultMatrix;
            startTime = config?.startTime || null;
            endTime = config?.endTime || null;
            
            localStorage.setItem('eps_arena_os_matrix', JSON.stringify(matrix));
            localStorage.setItem('eps_arena_os_startTime', startTime);
            localStorage.setItem('eps_arena_os_endTime', endTime);
            
            // On affiche la matrice si visible
            if (matrixVisible) renderMatrix();
            updateChronoButtons();
        });
    } else {
        // Pas de classe : on affiche quand même la matrice par défaut
        matrix = JSON.parse(JSON.stringify(DEFAULT_OS_MATRIX));
        localStorage.setItem('eps_arena_os_matrix', JSON.stringify(matrix));
        if (matrixVisible) renderMatrix();
    }

    // Charger les affectations
    attachClassChangeListener();
    loadOrientShowAssignments();
}

// --------------------------------------------------------------
// 2. BARRE D'EN-TÊTE
// --------------------------------------------------------------
function createHeader() {
    const div = document.createElement('div');
    div.className = 'flex justify-between items-center bg-slate-800 p-4 rounded-2xl border border-slate-700 mb-4 flex-wrap gap-2';

    const title = document.createElement('h3');
    title.className = 'font-black text-blue-400 uppercase text-sm';
    title.textContent = "Configuration Orient'Show";

    const btnGroup = document.createElement('div');
    btnGroup.className = 'flex gap-2 flex-wrap';

    const btnMatrix = document.createElement('button');
    btnMatrix.className = 'bg-purple-600 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-purple-400';
    btnMatrix.textContent = '📝 Matrice';
    btnMatrix.onclick = toggleMatrixVisibility;

    const btnExport = document.createElement('button');
    btnExport.className = 'bg-emerald-600 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-emerald-400';
    btnExport.textContent = '⬇️ Export';
    btnExport.onclick = () => exportOrientShowConfig();

    const btnImport = document.createElement('button');
    btnImport.className = 'bg-slate-600 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-slate-400';
    btnImport.textContent = '⬆️ Import';
    
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'importOSFile';
    fileInput.className = 'hidden';
    fileInput.accept = '.json';
    fileInput.onchange = (e) => importOrientShowConfig(e);
    
    btnImport.onclick = () => fileInput.click();

    btnGroup.appendChild(btnMatrix);
    btnGroup.appendChild(btnExport);
    btnGroup.appendChild(btnImport);
    btnGroup.appendChild(fileInput);

    div.appendChild(title);
    div.appendChild(btnGroup);

    return div;
}

// --------------------------------------------------------------
// 3. CORPS PRINCIPAL (réserve 2 colonnes + grille)
// --------------------------------------------------------------
function createMain() {
    const mainDiv = document.createElement('div');
    mainDiv.className = 'flex gap-4';

    // ---- RÉSERVE ----
    const reserveCol = document.createElement('div');
    reserveCol.className = 'w-1/3 shrink-0 bg-slate-900 p-4 rounded-2xl border-2 border-dashed border-slate-600';

    const reserveHeader = document.createElement('div');
    reserveHeader.className = 'flex justify-between items-center mb-3';
    reserveHeader.innerHTML = `
        <h4 class="font-bold text-slate-400 uppercase text-xs">Réserve</h4>
        <button onclick="window.populateReserveOS()" class="bg-blue-600 px-3 py-1 rounded-xl font-black text-[10px] uppercase text-white">⬇️ Charger (reset)</button>
    `;
    reserveCol.appendChild(reserveHeader);

    const sexesContainer = document.createElement('div');
    sexesContainer.className = 'flex gap-2';

    const garconsDiv = document.createElement('div');
    garconsDiv.className = 'flex-1';
    garconsDiv.innerHTML = `<div class="text-xs font-bold text-blue-400 uppercase mb-1">👦 Garçons</div>`;
    const garconsList = document.createElement('div');
    garconsList.id = 'os-reserve-garcons';
    garconsList.className = 'flex flex-col gap-1 min-h-[100px] border border-blue-800/30 rounded-lg p-1';
    garconsDiv.appendChild(garconsList);
    sexesContainer.appendChild(garconsDiv);

    const fillesDiv = document.createElement('div');
    fillesDiv.className = 'flex-1';
    fillesDiv.innerHTML = `<div class="text-xs font-bold text-rose-400 uppercase mb-1">👩 Filles</div>`;
    const fillesList = document.createElement('div');
    fillesList.id = 'os-reserve-filles';
    fillesList.className = 'flex flex-col gap-1 min-h-[100px] border border-rose-800/30 rounded-lg p-1';
    fillesDiv.appendChild(fillesList);
    sexesContainer.appendChild(fillesDiv);

    reserveCol.appendChild(sexesContainer);
    mainDiv.appendChild(reserveCol);

    // ---- GRILLE ----
    const gridCol = document.createElement('div');
    gridCol.className = 'flex-1 bg-slate-800 p-4 border border-slate-700 rounded-xl overflow-x-auto';
    
    let gridHtml = `<h3 class="font-bold text-slate-400 uppercase text-xs mb-3">Groupes par code (couleur_numéro)</h3>`;
    gridHtml += `<div id="os-postesGrid" class="min-w-[600px]">`;
    
    gridHtml += `<div class="flex items-center mb-2">
        <div class="w-12 shrink-0"></div>
        <div class="flex flex-1 gap-0">`;
    COULEURS.forEach(c => {
        const bg = c === 'NOIR' ? 'bg-black' : c === 'ROUGE' ? 'bg-red-600' : c === 'BLEU' ? 'bg-blue-600' : c === 'VERT' ? 'bg-green-600' : 'bg-yellow-500';
        const text = c === 'JAUNE' ? 'text-black' : 'text-white';
        gridHtml += `<div class="${bg} ${text} font-black text-center p-2 rounded-t-lg uppercase text-[10px] flex-1">${c}</div>`;
    });
    gridHtml += `</div></div>`;

    for (let ligne = 1; ligne <= NB_NUMEROS; ligne++) {
        gridHtml += `<div class="flex items-stretch mb-1">`;
        gridHtml += `<div class="w-12 shrink-0 flex items-center justify-center font-black text-yellow-400 text-2xl bg-slate-900 rounded-l-lg border-r-0 border border-yellow-500/30">${ligne}</div>`;
        gridHtml += `<div class="flex flex-1 gap-0">`;
        COULEURS.forEach(col => {
            const code = `${col}_${ligne}`;
            gridHtml += `<div class="os-dropzone bg-slate-800 border border-slate-700 min-h-[50px] flex flex-col gap-1 p-1 flex-1" data-code="${code}"></div>`;
        });
        gridHtml += `</div></div>`;
    }

    gridHtml += `</div>`;
    gridCol.innerHTML = gridHtml;
    mainDiv.appendChild(gridCol);

    return mainDiv;
}

// --------------------------------------------------------------
// 4. MATRICE
// --------------------------------------------------------------
function createMatrixContainer() {
    const div = document.createElement('div');
    div.id = 'os-matrix-container';
    div.className = 'bg-slate-900 p-4 rounded-2xl border border-slate-700 overflow-x-auto mt-4 hidden';
    return div;
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
// 5. GESTION DU CHANGEMENT DE CLASSE
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
        // On réinitialise avec les valeurs par défaut
        const defaultMatrix = JSON.parse(JSON.stringify(DEFAULT_OS_MATRIX));
        listenOrientShowConfig(classe, (config) => {
            if (config && config.matrix) {
                for (const circuit of Object.keys(defaultMatrix)) {
                    if (config.matrix[circuit]) {
                        for (const color of COULEURS) {
                            if (config.matrix[circuit][color] && config.matrix[circuit][color].length === 2) {
                                defaultMatrix[circuit][color] = [...config.matrix[circuit][color]];
                            }
                        }
                    }
                }
            }
            matrix = defaultMatrix;
            startTime = config?.startTime || null;
            endTime = config?.endTime || null;
            
            localStorage.setItem('eps_arena_os_matrix', JSON.stringify(matrix));
            localStorage.setItem('eps_arena_os_startTime', startTime);
            localStorage.setItem('eps_arena_os_endTime', endTime);
            
            if (matrixVisible) renderMatrix();
            updateChronoButtons();
        });
    } else {
        // Pas de classe : on utilise les valeurs par défaut
        matrix = JSON.parse(JSON.stringify(DEFAULT_OS_MATRIX));
        localStorage.setItem('eps_arena_os_matrix', JSON.stringify(matrix));
        if (matrixVisible) renderMatrix();
    }
    loadOrientShowAssignments();
}

// --------------------------------------------------------------
// 6. CHARGEMENT DES AFFECTATIONS (avec listes d'IDs)
// --------------------------------------------------------------
export async function loadOrientShowAssignments() {
    if (!document.getElementById('os-postesGrid')) {
        initOrientShowInterface();
        setTimeout(() => loadOrientShowAssignments(), 100);
        return;
    }

    const classe = getCurrentClasse();
    if (!classe) {
        document.querySelectorAll('.os-dropzone').forEach(el => el.innerHTML = '');
        document.getElementById('os-reserve-garcons').innerHTML = '<p class="text-slate-500 text-xs">Sélectionnez une classe.</p>';
        document.getElementById('os-reserve-filles').innerHTML = '<p class="text-slate-500 text-xs">Sélectionnez une classe.</p>';
        return;
    }

    const mapping = getLocalMapping(classe) || {};
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');

    document.querySelectorAll('.os-dropzone').forEach(el => el.innerHTML = '');
    const garconsContainer = document.getElementById('os-reserve-garcons');
    const fillesContainer = document.getElementById('os-reserve-filles');
    garconsContainer.innerHTML = '';
    fillesContainer.innerHTML = '';

    const placedIds = new Set();
    for (const [key, eleveIds] of Object.entries(mapping)) {
        const ids = Array.isArray(eleveIds) ? eleveIds : [eleveIds];
        const codePart = key.replace(`${classe}_`, '');
        const match = codePart.match(/^([A-Z]+)_(\d+)$/);
        if (match) {
            const color = match[1];
            const num = parseInt(match[2], 10);
            const dropzone = document.querySelector(`.os-dropzone[data-code="${color}_${num}"]`);
            if (dropzone) {
                for (const eleveId of ids) {
                    const eleve = eleves.find(e => e.id === eleveId);
                    if (eleve) {
                        const card = await createEleveCard(eleve);
                        dropzone.appendChild(card);
                        placedIds.add(eleveId);
                    }
                }
            }
        }
    }

    const nonPlaces = eleves.filter(e => !placedIds.has(e.id));
    const garcons = nonPlaces.filter(e => e.sexe === 'M').sort((a, b) => a.nom.localeCompare(b.nom));
    const filles = nonPlaces.filter(e => e.sexe === 'F').sort((a, b) => a.nom.localeCompare(b.nom));
    const autres = nonPlaces.filter(e => e.sexe !== 'M' && e.sexe !== 'F').sort((a, b) => a.nom.localeCompare(b.nom));

    for (const eleve of garcons) {
        garconsContainer.appendChild(await createEleveCard(eleve));
    }
    for (const eleve of filles) {
        fillesContainer.appendChild(await createEleveCard(eleve));
    }
    for (const eleve of autres) {
        garconsContainer.appendChild(await createEleveCard(eleve));
    }

    if (garconsContainer.children.length === 0) garconsContainer.innerHTML = '<p class="text-slate-500 text-xs">Aucun garçon</p>';
    if (fillesContainer.children.length === 0) fillesContainer.innerHTML = '<p class="text-slate-500 text-xs">Aucune fille</p>';

    initSortableOS();
}

// --------------------------------------------------------------
// 7. RESET COMPLET (bouton "Charger")
// --------------------------------------------------------------
export async function resetAllToReserve() {
    const classe = getCurrentClasse();
    if (!classe) {
        alert('Veuillez sélectionner une classe.');
        return;
    }

    document.querySelectorAll('.os-dropzone').forEach(el => el.innerHTML = '');
    const garconsContainer = document.getElementById('os-reserve-garcons');
    const fillesContainer = document.getElementById('os-reserve-filles');
    garconsContainer.innerHTML = '';
    fillesContainer.innerHTML = '';

    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');
    const garcons = eleves.filter(e => e.sexe === 'M').sort((a, b) => a.nom.localeCompare(b.nom));
    const filles = eleves.filter(e => e.sexe === 'F').sort((a, b) => a.nom.localeCompare(b.nom));
    const autres = eleves.filter(e => e.sexe !== 'M' && e.sexe !== 'F').sort((a, b) => a.nom.localeCompare(b.nom));

    for (const eleve of garcons) {
        garconsContainer.appendChild(await createEleveCard(eleve));
    }
    for (const eleve of filles) {
        fillesContainer.appendChild(await createEleveCard(eleve));
    }
    for (const eleve of autres) {
        garconsContainer.appendChild(await createEleveCard(eleve));
    }

    if (garconsContainer.children.length === 0) garconsContainer.innerHTML = '<p class="text-slate-500 text-xs">Aucun garçon</p>';
    if (fillesContainer.children.length === 0) fillesContainer.innerHTML = '<p class="text-slate-500 text-xs">Aucune fille</p>';

    setLocalMapping(classe, {});
    initSortableOS();
}
window.populateReserveOS = resetAllToReserve;

// --------------------------------------------------------------
// 8. SAUVEGARDE DES AFFECTATIONS (liste d'IDs par code)
// --------------------------------------------------------------
export function saveOrientShowAssignments() {
    const classe = getCurrentClasse();
    if (!classe) return;

    const mapping = {};
    document.querySelectorAll('.os-dropzone').forEach(zone => {
        const code = zone.dataset.code;
        const cards = zone.querySelectorAll('[data-id]');
        if (cards.length > 0) {
            const ids = [];
            cards.forEach(card => ids.push(card.dataset.id));
            mapping[`${classe}_${code}`] = ids;
        }
    });
    setLocalMapping(classe, mapping);
    refreshReserve();
}

// --------------------------------------------------------------
// 9. RAFRAÎCHISSEMENT DE LA RÉSERVE (après glissé)
// --------------------------------------------------------------
async function refreshReserve() {
    const classe = getCurrentClasse();
    if (!classe) return;

    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');
    const placedIds = new Set();
    document.querySelectorAll('.os-dropzone [data-id]').forEach(el => placedIds.add(el.dataset.id));

    const garconsContainer = document.getElementById('os-reserve-garcons');
    const fillesContainer = document.getElementById('os-reserve-filles');
    garconsContainer.innerHTML = '';
    fillesContainer.innerHTML = '';

    const nonPlaces = eleves.filter(e => !placedIds.has(e.id));
    const garcons = nonPlaces.filter(e => e.sexe === 'M').sort((a, b) => a.nom.localeCompare(b.nom));
    const filles = nonPlaces.filter(e => e.sexe === 'F').sort((a, b) => a.nom.localeCompare(b.nom));
    const autres = nonPlaces.filter(e => e.sexe !== 'M' && e.sexe !== 'F').sort((a, b) => a.nom.localeCompare(b.nom));

    for (const eleve of garcons) {
        garconsContainer.appendChild(await createEleveCard(eleve));
    }
    for (const eleve of filles) {
        fillesContainer.appendChild(await createEleveCard(eleve));
    }
    for (const eleve of autres) {
        garconsContainer.appendChild(await createEleveCard(eleve));
    }

    if (garconsContainer.children.length === 0) garconsContainer.innerHTML = '<p class="text-slate-500 text-xs">Aucun garçon</p>';
    if (fillesContainer.children.length === 0) fillesContainer.innerHTML = '<p class="text-slate-500 text-xs">Aucune fille</p>';

    initSortableOS();
}

// --------------------------------------------------------------
// 10. CRÉATION CARTE ÉLÈVE
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
// 11. SORTABLE
// --------------------------------------------------------------
function initSortableOS() {
    if (typeof Sortable === 'undefined') return;

    const garcons = document.getElementById('os-reserve-garcons');
    const filles = document.getElementById('os-reserve-filles');

    if (garcons && !garcons.__sortable) {
        garcons.__sortable = new Sortable(garcons, {
            group: 'os',
            animation: 150,
            onEnd: saveOrientShowAssignments
        });
    }
    if (filles && !filles.__sortable) {
        filles.__sortable = new Sortable(filles, {
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
// 12. MATRICE DE CORRECTION
// --------------------------------------------------------------
function resetMatrix() {
    matrix = JSON.parse(JSON.stringify(DEFAULT_OS_MATRIX));
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
// 13. CHRONO
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
// 14. EXPORT / IMPORT
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
            // On fusionne avec les valeurs par défaut pour combler les trous
            const defaultMatrix = JSON.parse(JSON.stringify(DEFAULT_OS_MATRIX));
            for (const circuit of Object.keys(defaultMatrix)) {
                if (data.matrix[circuit]) {
                    for (const color of COULEURS) {
                        if (data.matrix[circuit][color] && data.matrix[circuit][color].length === 2) {
                            defaultMatrix[circuit][color] = [...data.matrix[circuit][color]];
                        }
                    }
                }
            }
            matrix = defaultMatrix;
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