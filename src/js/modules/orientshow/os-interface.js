import { getPhotoUrl } from '../../services/admin-service.js';

// 1. Génération de la grille (5 colonnes couleurs, 6 lignes numéros)
export function initOSInterface() {
    const container = document.getElementById('os-postesGrid');
    if (!container) return;

    // Matrice (en haut)
    renderMatrix();

    // Grille façon Escalade
    const couleurs = [
        { id: "NOIR", bg: "bg-black", text: "text-white" },
        { id: "ROUGE", bg: "bg-red-600", text: "text-white" },
        { id: "BLEU", bg: "bg-blue-600", text: "text-white" },
        { id: "VERT", bg: "bg-green-600", text: "text-white" },
        { id: "JAUNE", bg: "bg-yellow-500", text: "text-black" }
    ];

    let html = `<div class="flex gap-4">`;
    couleurs.forEach(c => {
        html += `
            <div class="flex flex-col">
                <div class="header-col ${c.bg} ${c.text}">${c.id}</div>
                <div class="escalade-col" data-couleur="${c.id}">
        `;
        // 6 cases numéros par couleur
        for (let num = 1; num <= 6; num++) {
            const code = `${c.id}_${num}`;
            html += `
                <div class="os-dropzone bg-slate-800 border border-slate-600 rounded-lg min-h-[60px] flex flex-col gap-1 p-1" data-code="${code}">
                    <span class="text-[9px] font-black text-slate-500 uppercase">${c.id} ${num}</span>
                </div>
            `;
        }
        html += `</div></div>`;
    });
    html += `</div>`;
    container.innerHTML = html;

    // Initialisation Sortable après génération
    setTimeout(() => initSortableOS(), 100);
}

// 2. Initialisation du glisser-déposer (pour la réserve et les cases)
export function initSortableOS() {
    if (typeof Sortable === 'undefined') return;
    
    // Réserve
    const reserve = document.getElementById('os-reserve');
    if (reserve && !reserve.__sortable) {
        reserve.__sortable = new Sortable(reserve, {
            group: 'os',
            animation: 150,
            onEnd: saveOSAssignments
        });
    }

    // Toutes les cases
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

// 3. Création d'une carte élève (identique à l'escalade)
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
        <span class="rank-badge bg-blue-900 text-white text-2xl font-black px-3 py-1 rounded-lg ml-auto">1</span>
    `;
    return div;
}

// 4. Remplissage de la réserve
export function ensureReserveLoaded() {
    const activeClasse = document.getElementById('selectClasse')?.value;
    if (!activeClasse) return;

    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');
    const reserve = document.getElementById('os-reserve');
    if (!reserve) return;

    if (reserve.children.length === 0 && eleves.length > 0) {
        populateReserveOS();
    }
}

window.populateReserveOS = async function() {
    const activeClasse = document.getElementById('selectClasse')?.value;
    if (!activeClasse) return alert("Sélectionnez une classe.");

    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');
    const reserve = document.getElementById('os-reserve');
    if (!reserve) return;

    reserve.innerHTML = '';
    for (const eleve of eleves) {
        reserve.appendChild(await createEleveCard(eleve));
    }

    setTimeout(() => initSortableOS(), 100);
};

// 5. Sauvegarde et chargement des affectations
function getOSStorageKey() {
    return `eps_arena_os_assignments_${document.getElementById('selectClasse')?.value}`;
}

export function saveOSAssignments() {
    const assignments = {};
    document.querySelectorAll('.os-dropzone').forEach(zone => {
        const code = zone.dataset.code;
        const ids = Array.from(zone.querySelectorAll('[data-id]')).map(el => el.dataset.id);
        if (ids.length > 0) assignments[code] = ids;
    });
    localStorage.setItem(getOSStorageKey(), JSON.stringify(assignments));
}

export async function loadOSAssignments() {
    const assignments = JSON.parse(localStorage.getItem(getOSStorageKey()) || '{}');
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${document.getElementById('selectClasse')?.value}`) || '[]');

    document.querySelectorAll('.os-dropzone').forEach(el => el.innerHTML = '');
    document.getElementById('os-reserve').innerHTML = '';

    const affectedIds = new Set();
    for (const zone of document.querySelectorAll('.os-dropzone')) {
        const code = zone.dataset.code;
        if (assignments[code]) {
            for (const id of assignments[code]) {
                const eleve = eleves.find(e => e.id === id);
                if (eleve) {
                    // On ajoute la carte et le rang
                    const card = await createEleveCard(eleve);
                    zone.querySelectorAll('[data-id]').forEach((old, idx) => {
                        old.querySelector('.rank-badge').innerText = idx + 1;
                    });
                    zone.appendChild(card);
                    affectedIds.add(id);
                }
            }
        }
    }

    // Réserve : les élèves restants
    const reserve = document.getElementById('os-reserve');
    for (const eleve of eleves) {
        if (!affectedIds.has(eleve.id)) {
            reserve.appendChild(await createEleveCard(eleve));
        }
    }

    updateRanksOS();
    saveOSAssignments();
    setTimeout(() => initSortableOS(), 100);
}

// 6. Mise à jour des rangs dans les cases
export function updateRanksOS() {
    document.querySelectorAll('.os-dropzone').forEach(zone => {
        const cards = zone.querySelectorAll('[data-id]');
        cards.forEach((card, idx) => {
            const rank = card.querySelector('.rank-badge');
            if (rank) rank.innerText = idx + 1;
        });
    });
}

// 7. La matrice (inchangée, mais stylée)
function renderMatrix() {
    let matrix = JSON.parse(localStorage.getItem('eps_arena_os_matrix')) || {};
    let html = `<tr class="bg-slate-900 text-white"><th>#</th><th colspan="2" class="bg-black">NOIR</th><th colspan="2" class="bg-red-600">ROUGE</th><th colspan="2" class="bg-blue-600">BLEU</th><th colspan="2" class="bg-green-600">VERT</th><th colspan="2" class="bg-yellow-500 text-black">JAUNE</th></tr>`;
    for(let c=1; c<=12; c++) {
        html += `<tr class="border-b border-slate-700"><td class="font-black text-slate-500 py-1">C${c}</td>`;
        ['NOIR','ROUGE','BLEU','VERT','JAUNE'].forEach(col => {
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

window.saveOSMatrix = function(circuit, color, index, val) {
    let matrix = JSON.parse(localStorage.getItem('eps_arena_os_matrix')) || {};
    if(!matrix[circuit]) matrix[circuit] = {};
    if(!matrix[circuit][color]) matrix[circuit][color] = ["",""];
    matrix[circuit][color][index] = val.toUpperCase();
    localStorage.setItem('eps_arena_os_matrix', JSON.stringify(matrix));
};