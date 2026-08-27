// src/js/modules/orientshow/os-interface.js
import { getPhotoUrl } from '../../services/admin-service.js';

const colorsInfo = [
    { id: "NOIR", bg: "bg-black", text: "text-white" },
    { id: "ROUGE", bg: "bg-red-600", text: "text-white" },
    { id: "BLEU", bg: "bg-blue-600", text: "text-white" },
    { id: "VERT", bg: "bg-green-600", text: "text-white" },
    { id: "JAUNE", bg: "bg-yellow-500", text: "text-black" }
];

export function initOSInterface() {
    renderMatrix();
    
    const container = document.getElementById('os-postesGrid');
    if (container) {
        let html = '';
        colorsInfo.forEach(c => {
            html += `
            <div class="flex flex-col">
                <div class="${c.bg} ${c.text} font-black text-center p-2 rounded-t-lg uppercase text-[10px]">${c.id}</div>
                <div class="os-col bg-slate-800 border border-slate-700 rounded-b-lg min-h-[150px] flex flex-col p-2" data-couleur="${c.id}">
                    <div class="groupe-members flex flex-col gap-2 min-h-[50px]"></div>
                </div>
            </div>`;
        });
        container.innerHTML = html;
    }
}

// --- 1. MATRICE ---
function renderMatrix() {
    let matrix = JSON.parse(localStorage.getItem('eps_arena_os_matrix')) || {};
    let html = `<tr class="bg-slate-900 text-white"><th>#</th><th colspan="2" class="bg-black">NOIR</th><th colspan="2" class="bg-red-600">ROUGE</th><th colspan="2" class="bg-blue-600">BLEU</th><th colspan="2" class="bg-green-600">VERT</th><th colspan="2" class="bg-yellow-500 text-black">JAUNE</th></tr>`;
    for(let c=1; c<=12; c++) {
        html += `<tr class="border-b border-slate-700"><td class="font-black text-slate-500 py-1">C${c}</td>`;
        colorsInfo.forEach(col => {
            const l = matrix[c]?.[col.id] || ["",""];
            html += `
                <td><input class="w-8 h-8 bg-slate-900 text-center font-bold text-blue-400 m-0.5 uppercase outline-none rounded shadow-inner" value="${l[0]}" maxlength="1" onchange="window.saveOSMatrix(${c}, '${col.id}', 0, this.value)"></td>
                <td class="border-r border-slate-700/50"><input class="w-8 h-8 bg-slate-900 text-center font-bold text-blue-400 m-0.5 uppercase outline-none rounded shadow-inner" value="${l[1]}" maxlength="1" onchange="window.saveOSMatrix(${c}, '${col.id}', 1, this.value)"></td>`;
        });
        html += `</tr>`;
    }
    const table = document.getElementById('osMatrixTable');
    if (table) table.innerHTML = html;
}

window.saveOSMatrix = function(circuit, color, index, val) {
    let matrix = JSON.parse(localStorage.getItem('eps_arena_os_matrix')) || {};
    if(!matrix[circuit]) matrix[circuit] = {};
    if(!matrix[circuit][color]) matrix[circuit][color] = ["",""];
    matrix[circuit][color][index] = val.toUpperCase();
    localStorage.setItem('eps_arena_os_matrix', JSON.stringify(matrix));
};

// --- 2. DRAG & DROP & CARTES ---
async function createEleveCard(eleve) {
    const url = await getPhotoUrl(eleve.id);
    let bgClass = 'bg-slate-200 border-slate-400';
    if (eleve.sexe === 'M') bgClass = 'bg-blue-200 border-blue-400';
    else if (eleve.sexe === 'F') bgClass = 'bg-rose-200 border-rose-400';
    
    const photoHtml = url 
        ? `<img src="${url}" class="w-8 h-8 rounded-full object-cover border-2 border-slate-500">`
        : `<div class="w-8 h-8 rounded-full bg-slate-400 flex items-center justify-center text-sm">👤</div>`;

    const div = document.createElement('div');
    div.className = `p-1.5 rounded-lg border-2 cursor-grab active:cursor-grabbing flex items-center gap-2 ${bgClass}`;
    div.dataset.id = eleve.id;
    div.innerHTML = `
        ${photoHtml}
        <div class="flex flex-col leading-none">
            <span class="font-black text-slate-900 text-xs">${eleve.prenom}</span>
            <span class="text-[10px] font-bold text-slate-600 uppercase">${eleve.nom}</span>
        </div>
    `;
    return div;
}

export function initSortableOS() {
    if (typeof Sortable === 'undefined') return;
    
    const reserveContainer = document.getElementById('os-reserve');
    if (reserveContainer && !reserveContainer.__sortable) {
        reserveContainer.__sortable = new Sortable(reserveContainer, {
            group: 'orientshow',
            animation: 150,
            onEnd: () => { saveOSAssignments(); updateOSRanks(); }
        });
    }

    document.querySelectorAll('.os-col .groupe-members').forEach(el => {
        if (!el.__sortable) {
            el.__sortable = new Sortable(el, {
                group: 'orientshow',
                animation: 150,
                onEnd: () => { saveOSAssignments(); updateOSRanks(); }
            });
        }
    });
}

function updateOSRanks() {
    document.querySelectorAll('.os-col').forEach(colDiv => {
        const membersDiv = colDiv.querySelector('.groupe-members');
        if (!membersDiv) return;
        const children = membersDiv.querySelectorAll('[data-id]');
        children.forEach((child, index) => {
            let rankSpan = child.querySelector('.rank-badge');
            if (!rankSpan) {
                rankSpan = document.createElement('span');
                rankSpan.className = 'rank-badge bg-blue-900 text-white text-sm font-black px-2 py-0.5 rounded-lg ml-auto';
                child.appendChild(rankSpan);
            }
            rankSpan.textContent = index + 1;
        });
    });
}

// --- 3. SAUVEGARDE & CHARGEMENT ---
function getOSStorageKey() {
    const activeClasse = document.getElementById('selectClasse').value;
    return `eps_arena_os_assignments_${activeClasse}`;
}

export function saveOSAssignments() {
    const assignments = {};
    const reserveIds = [];
    
    document.getElementById('os-reserve')?.querySelectorAll('[data-id]').forEach(el => reserveIds.push(el.dataset.id));
    if (reserveIds.length > 0) assignments.reserve = reserveIds;

    document.querySelectorAll('.os-col').forEach(colDiv => {
        const couleur = colDiv.dataset.couleur;
        const membersDiv = colDiv.querySelector('.groupe-members');
        if (membersDiv) {
            const ids = Array.from(membersDiv.querySelectorAll('[data-id]')).map(el => el.dataset.id);
            if (ids.length > 0) assignments[couleur] = ids;
        }
    });
    localStorage.setItem(getOSStorageKey(), JSON.stringify(assignments));
}

window.populateReserveOS = async function() {
    const activeClasse = document.getElementById('selectClasse')?.value;
    if (!activeClasse) return alert("Sélectionnez une classe.");
    
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');
    const reserve = document.getElementById('os-reserve');
    reserve.innerHTML = "";
    document.querySelectorAll('.os-col .groupe-members').forEach(el => el.innerHTML = "");

    for (const eleve of eleves) {
        reserve.appendChild(await createEleveCard(eleve));
    }
    
    saveOSAssignments();
    setTimeout(() => initSortableOS(), 100);
};

export async function loadOSAssignments() {
    const assignments = JSON.parse(localStorage.getItem(getOSStorageKey()) || '{}');
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${document.getElementById('selectClasse').value}`) || '[]');

    document.getElementById('os-reserve').innerHTML = '';
    document.querySelectorAll('.os-col .groupe-members').forEach(el => el.innerHTML = '');

    const colonnes = document.querySelectorAll('.os-col');
    for (const colDiv of colonnes) {
        const couleur = colDiv.dataset.couleur;
        const membersDiv = colDiv.querySelector('.groupe-members');
        if (membersDiv && assignments[couleur]) {
            for (const id of assignments[couleur]) {
                const eleve = eleves.find(e => e.id === id);
                if (eleve) membersDiv.appendChild(await createEleveCard(eleve));
            }
        }
    }

    const affectedIds = new Set();
    colonnes.forEach(colDiv => {
        colDiv.querySelectorAll('[data-id]').forEach(el => affectedIds.add(el.dataset.id));
    });

    let reserveIds = assignments.reserve || [];
    eleves.forEach(eleve => {
        if (!affectedIds.has(eleve.id) && !reserveIds.includes(eleve.id)) reserveIds.push(eleve.id);
    });

    const reserveContainer = document.getElementById('os-reserve');
    for (const id of reserveIds) {
        const eleve = eleves.find(e => e.id === id);
        if (eleve) reserveContainer.appendChild(await createEleveCard(eleve));
    }

    updateOSRanks();
    setTimeout(() => initSortableOS(), 100);
}