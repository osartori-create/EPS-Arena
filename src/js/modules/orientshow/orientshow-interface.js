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
// 1. INITIALISATION
// --------------------------------------------------------------
export function initOrientShowInterface() {
    const container = document.getElementById('viewOrientShowSettings');
    if (!container) return;

    // On vide complètement
    container.innerHTML = '';

    // 1. Barre des boutons (en-tête)
    const header = createHeader();
    container.appendChild(header);

    // 2. Corps principal (réserve + grille)
    const main = createMain();
    container.appendChild(main);

    // 3. Conteneur de matrice (caché)
    const matrixContainer = createMatrixContainer();
    container.appendChild(matrixContainer);

    // 4. Attacher l'écouteur de changement de classe
    attachClassChangeListener();

    // 5. Écouter la config Firebase
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

    // 6. Charger les affectations
    loadOrientShowAssignments();
}

// --------------------------------------------------------------
// 2. CRÉATION DE LA BARRE D'EN-TÊTE (avec export/import)
// --------------------------------------------------------------
function createHeader() {
    const div = document.createElement('div');
    div.className = 'flex justify-between items-center bg-slate-800 p-4 rounded-2xl border border-slate-700 mb-4 flex-wrap gap-2';

    const title = document.createElement('h3');
    title.className = 'font-black text-blue-400 uppercase text-sm';
    title.textContent = "Configuration Orient'Show";

    const btnGroup = document.createElement('div');
    btnGroup.className = 'flex gap-2 flex-wrap';

    // Bouton Matrice
    const btnMatrix = document.createElement('button');
    btnMatrix.className = 'bg-purple-600 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-purple-400';
    btnMatrix.textContent = '📝 Matrice';
    btnMatrix.onclick = toggleMatrixVisibility;

    // Bouton Export
    const btnExport = document.createElement('button');
    btnExport.className = 'bg-emerald-600 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-emerald-400';
    btnExport.textContent = '⬇️ Export';
    btnExport.onclick = () => exportOrientShowConfig();

    // Bouton Import
    const btnImport = document.createElement('button');
    btnImport.className = 'bg-slate-600 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-slate-400';
    btnImport.textContent = '⬆️ Import';
    
    // Input file caché pour l'import
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
// 3. CRÉATION DU CORPS (réserve + grille)
// --------------------------------------------------------------
function createMain() {
    const mainDiv = document.createElement('div');
    mainDiv.className = 'flex gap-4';

    // Réserve (largeur 1/3, 2 colonnes)
    const reserveCol = document.createElement('div');
    reserveCol.className = 'w-1/3 shrink-0 bg-slate-900 p-4 rounded-2xl border-2 border-dashed border-slate-600';
    reserveCol.innerHTML = `
        <div class="flex justify-between items-center mb-3">
            <h4 class="font-bold text-slate-400 uppercase text-xs">Réserve</h4>
            <button onclick="window.populateReserveOS()" class="bg-blue-600 px-3 py-1 rounded-xl font-black text-[10px] uppercase text-white">⬇️ Charger (reset)</button>
        </div>
        <div id="os-reserve" class="grid grid-cols-2 gap-1 min-h-[200px]"></div>
    `;

    // Grille des postes (2/3)
    const gridCol = document.createElement('div');
    gridCol.className = 'flex-1 bg-slate-800 p-4 border border-slate-700 rounded-xl overflow-x-auto';
    gridCol.innerHTML = `
        <h3 class="font-bold text-slate-400 uppercase text-xs mb-3">Groupes par code (couleur_numéro)</h3>
        <div id="os-postesGrid" class="min-w-[600px]"></div>
    `;

    mainDiv.appendChild(reserveCol);
    mainDiv.appendChild(gridCol);

    // Remplir la grille des postes (sans espace)
    fillGrid();

    return mainDiv;
}

function fillGrid() {
    const gridContainer = document.getElementById('os-postesGrid');
    if (!gridContainer) return;

    // En-tête des couleurs
    let headerHtml = `<div class="flex items-center mb-2">
        <div class="w-12 shrink-0"></div>
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
        rowDiv.className = 'flex items-stretch mb-1';

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

// --------------------------------------------------------------
// 4. CONTENEUR DE MATRICE (masqué par défaut)
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
// 6. CHARGEMENT DES AFFECTATIONS
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

    // Réserve : tous les élèves non placés, triés par sexe puis nom
    const nonPlaces = eleves.filter(e => !placedIds.has(e.id));
    // Tri : d'abord les garçons (M), puis les filles (F), puis les autres
    nonPlaces.sort((a, b) => {
        if (a.sexe === 'M' && b.sexe !== 'M') return -1;
        if (a.sexe !== 'M' && b.sexe === 'M') return 1;
        if (a.sexe === 'F' && b.sexe === 'F') return a.nom.localeCompare(b.nom);
        if (a.sexe === 'M' && b.sexe === 'M') return a.nom.localeCompare(b.nom);
        return 0;
    });
    if (reserveContainer) {
        for (const eleve of nonPlaces) {
            const card = await createEleveCard(eleve);
            reserveContainer.appendChild(card);
        }
        if (nonPlaces.length === 0) {
            reserveContainer.innerHTML = '<p class="text-slate-500 text-xs col-span-2">Tous les élèves sont affectés.</p>';
        }
    }

    initSortableOS();
}

// --------------------------------------------------------------
// 7. BOUTON "CHARGER" : RESET COMPLET
// --------------------------------------------------------------
export async function resetAllToReserve() {
    const classe = getCurrentClasse();
    if (!classe) {
        alert('Veuillez sélectionner une classe.');
        return;
    }

    document.querySelectorAll('.os-dropzone').forEach(el => el.innerHTML = '');
    const reserveContainer = document.getElementById('os-reserve');
    if (reserveContainer) reserveContainer.innerHTML = '';

    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');
    // Tri : garçons en premier, puis par nom
    eleves.sort((a, b) => {
        if (a.sexe === 'M' && b.sexe !== 'M') return -1;
        if (a.sexe !== 'M' && b.sexe === 'M') return 1;
        return a.nom.localeCompare(b.nom);
    });

    if (reserveContainer) {
        for (const eleve of eleves) {
            const card = await createEleveCard(eleve);
            reserveContainer.appendChild(card);
        }
        if (eleves.length === 0) {
            reserveContainer.innerHTML = '<p class="text-slate-500 text-xs col-span-2">Aucun élève dans cette classe.</p>';
        }
    }

    setLocalMapping(classe, {});
    initSortableOS();
}
window.populateReserveOS = resetAllToReserve;

// --------------------------------------------------------------
// 8. SAUVEGARDE DES AFFECTATIONS (après glissé)
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

    const nonPlaces = eleves.filter(e => !placedIds.has(e.id));
    nonPlaces.sort((a, b) => {
        if (a.sexe === 'M' && b.sexe !== 'M') return -1;
        if (a.sexe !== 'M' && b.sexe === 'M') return 1;
        return a.nom.localeCompare(b.nom);
    });
    for (const eleve of nonPlaces) {
        const card = await createEleveCard(eleve);
        reserveContainer.appendChild(card);
    }
    if (nonPlaces.length === 0) {
        reserveContainer.innerHTML = '<p class="text-slate-500 text-xs col-span-2">Tous les élèves sont affectés.</p>';
    }
    initSortableOS();
}

// --------------------------------------------------------------
// 9. CRÉATION D'UNE CARTE ÉLÈVE (style escalade)
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
// 10. SORTABLE
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
// 11. MATRICE DE CORRECTION
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
// 12. CHRONO
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
// 13. EXPORT / IMPORT JSON
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

// Expositions globales
window.exportOrientShowConfig = exportOrientShowConfig;
window.importOrientShowConfig = importOrientShowConfig;