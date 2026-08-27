// src/js/modules/orientshow/os-interface.js

const colors = ["NOIR", "ROUGE", "BLEU", "VERT", "JAUNE"];

export function initOSInterface() {
    renderMatrix();
    initSortableOS();
}

// 1. GÉNÉRATION DE LA MATRICE
function renderMatrix() {
    let matrix = JSON.parse(localStorage.getItem('eps_arena_os_matrix')) || {};
    let html = `<tr class="bg-slate-900 text-white"><th>#</th><th colspan="2" class="bg-black">NOIR</th><th colspan="2" class="bg-red-600">ROUGE</th><th colspan="2" class="bg-blue-600">BLEU</th><th colspan="2" class="bg-green-600">VERT</th><th colspan="2" class="bg-yellow-500 text-black">JAUNE</th></tr>`;
    
    for(let c=1; c<=12; c++) {
        html += `<tr class="border-b border-slate-700"><td class="font-black text-slate-500 py-1">C${c}</td>`;
        colors.forEach(col => {
            const l = matrix[c]?.[col] || ["",""];
            html += `
                <td><input class="w-8 h-8 bg-slate-900 text-center font-bold text-blue-400 m-0.5 uppercase outline-none rounded shadow-inner" value="${l[0]}" maxlength="1" onchange="window.saveOSMatrix(${c}, '${col}', 0, this.value)"></td>
                <td class="border-r border-slate-700/50"><input class="w-8 h-8 bg-slate-900 text-center font-bold text-blue-400 m-0.5 uppercase outline-none rounded shadow-inner" value="${l[1]}" maxlength="1" onchange="window.saveOSMatrix(${c}, '${col}', 1, this.value)"></td>`;
        });
        html += `</tr>`;
    }
    const table = document.getElementById('osMatrixTable');
    if (table) table.innerHTML = html;
}

// Exposé globalement pour les input HTML
window.saveOSMatrix = function(circuit, color, index, val) {
    let matrix = JSON.parse(localStorage.getItem('eps_arena_os_matrix')) || {};
    if(!matrix[circuit]) matrix[circuit] = {};
    if(!matrix[circuit][color]) matrix[circuit][color] = ["",""];
    matrix[circuit][color][index] = val.toUpperCase();
    localStorage.setItem('eps_arena_os_matrix', JSON.stringify(matrix));
};

// 2. GESTION DES GROUPES (DRAG & DROP)
export function initSortableOS() {
    if (typeof Sortable === 'undefined') return;
    const containers = [document.getElementById('os-reserve'), ...colors.map(c => document.getElementById(`os-col-${c}`))];
    
    containers.forEach(container => {
        if (!container) return;
        // Détruire l'ancienne instance si elle existe
        if (container.__sortable) container.__sortable.destroy();
        
        container.__sortable = new Sortable(container, {
            group: 'orientshow',
            animation: 150,
            ghostClass: 'opacity-50',
            onEnd: saveOSAssignments
        });
    });
}

// 3. SAUVEGARDE ET CHARGEMENT
function saveOSAssignments() {
    const activeClasse = document.getElementById('selectClasse')?.value;
    if (!activeClasse) return;

    let assignments = {};
    colors.forEach(color => {
        const colDiv = document.getElementById(`os-col-${color}`);
        if (colDiv) {
            assignments[color] = Array.from(colDiv.children).map(el => el.dataset.id);
        }
    });
    localStorage.setItem(`eps_arena_os_assignments_${activeClasse}`, JSON.stringify(assignments));
}

window.populateReserveOS = function() {
    const activeClasse = document.getElementById('selectClasse')?.value;
    if (!activeClasse) return alert("Sélectionnez une classe.");
    
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');
    const reserve = document.getElementById('os-reserve');
    reserve.innerHTML = eleves.map(e => `<div data-id="${e.id}" class="bg-slate-700 text-white text-[10px] font-bold px-2 py-1 rounded cursor-grab active:cursor-grabbing border border-slate-600">${e.prenom} ${e.nom}</div>`).join('');
    
    // Nettoyer les colonnes
    colors.forEach(c => document.getElementById(`os-col-${c}`).innerHTML = "");
    saveOSAssignments();
};