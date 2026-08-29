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

    // On vide complètement le conteneur pour repartir de zéro
    container.innerHTML = '';

    // Construire la grille + réserve
    buildGridAndReserve(container);

    // Ajouter le bouton "Matrice" (s'il n'existe pas déjà)
    addMatrixToggleButton(container);

    // Ajouter le conteneur de matrice (masqué)
    addMatrixContainer(container);

    // Attacher l'écouteur de changement de classe
    attachClassChangeListener();

    // Écouter la config Firebase (matrice + temps)
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

    // Charger les affectations (si une classe est sélectionnée)
    loadOrientShowAssignments();
}

// --------------------------------------------------------------
// 2. CONSTRUCTION DU DOM
// --------------------------------------------------------------
function buildGridAndReserve(container) {
    // Structure principale
    const mainDiv = document.createElement('div');
    mainDiv.className = 'flex gap-4';

    // Colonne réserve
    const reserveCol = document.createElement('div');
    reserveCol.className = 'w-1/4 shrink-0 bg-slate-900 p-4 rounded-2xl border-2 border-dashed border-slate-600';
    reserveCol.innerHTML = `
        <div class="flex justify-between items-center mb-3">
            <h4 class="font-bold text-slate-400 uppercase text-xs">Réserve</h4>
            <button onclick="window.populateReserveOS()" class="bg-blue-600 px-3 py-1 rounded-xl font-black text-[10px] uppercase text-white">⬇️ Charger</button>
        </div>
        <div id="os-reserve" class="flex flex-col gap-2 min-h-[200px]"></div>
    `;

    // Colonne grille des postes
    const gridCol = document.createElement('div');
    gridCol.className = 'flex-1 bg-slate-800 p-4 border border-slate-700 rounded-xl overflow-x-auto';
    gridCol.innerHTML = `
        <h3 class="font-bold text-slate-400 uppercase text-xs mb-3">Groupes par code (couleur_numéro)</h3>
        <div id="os-postesGrid" class="min-w-[600px]"></div>
    `;

    mainDiv.appendChild(reserveCol);
    mainDiv.appendChild(gridCol);
    container.appendChild(mainDiv);

    // Remplir la grille des postes
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
}

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

// --------------------------------------------------------------
// 3. MATRICE (affichage/masquage)
// --------------------------------------------------------------
function toggleMatrixVisibility() {
    matrixVisible = !matrixVisible;
    const container = document.getElementById('os-matrix-container');
    if (container) {
        container.classList.toggle('hidden', !matrixVisible);
        if (matrixVisible) renderMatrix();
    }
}
// Alias pour le bouton dans maitre.html
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
// 5. CHARGEMENT DES AFFECTATIONS (mapping plat)
// --------------------------------------------------------------
export async function loadOrientShowAssignments() {
    // Si la grille n'existe pas, on l'initialise
    if (!document.getElementById('os-postesGrid')) {
        initOrientShowInterface();
        // Après création, on rappelle la fonction (mais attention aux boucles)
        // On va plutôt tout refaire dans la même exécution.
        // On attend un tick pour que le DOM soit prêt
        setTimeout(() => loadOrientShowAssignments(), 50);
        return;
    }

    const classe = getCurrentClasse();
    if (!classe) {
        document.querySelectorAll('.os-dropzone').forEach(el => el.innerHTML = '');
        const reserve = document.getElementById('os-reserve');
        if (reserve) reserve.innerHTML = '<p class="text-slate-500 text-xs">Sélectionnez une classe.</p>';
        return;
    }

    const mapping = getLocalMapping(classe) || {};
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');

    // Vider toutes les dropzones et la réserve
    document.querySelectorAll('.os-dropzone').forEach(el => el.innerHTML = '');
    const reserveContainer = document.getElementById('os-reserve');
    if (reserveContainer) reserveContainer.innerHTML = '';

    // Placer les élèves selon le mapping
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

    // Ajouter les élèves non placés dans la réserve
    if (reserveContainer) {
        for (const eleve of eleves) {
            if (!placedIds.has(eleve.id)) {
                const card = await createEleveCard(eleve);
                reserveContainer.appendChild(card);
            }
        }
    }

    // Réinitialiser Sortable
    initSortableOS();
}

// Fonction pour le bouton "Charger"
window.populateReserveOS = loadOrientShowAssignments;

// --------------------------------------------------------------
// 6. SAUVEGARDE DES AFFECTATIONS (après glissé)
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
    initSortableOS();
}

// --------------------------------------------------------------
// 7. CRÉATION D'UNE CARTE ÉLÈVE
// --------------------------------------------------------------
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

// --------------------------------------------------------------
// 8. SORTABLE (glisser-déposer)
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
// 9. MATRICE DE CORRECTION (rendu)
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
// 10. CHRONO
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
// 11. EXPORT / IMPORT
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