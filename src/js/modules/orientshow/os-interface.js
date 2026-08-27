import { getPhotoUrl } from '../../services/admin-service.js';

const colorsInfo = [
    { id: "NOIR", bg: "bg-black", text: "text-white" },
    { id: "ROUGE", bg: "bg-red-600", text: "text-white" },
    { id: "BLEU", bg: "bg-blue-600", text: "text-white" },
    { id: "VERT", bg: "bg-green-600", text: "text-white" },
    { id: "JAUNE", bg: "bg-yellow-500", text: "text-black" }
];
const NB_LIGNES = 8; // Tu peux augmenter ce nombre si besoin

export function initOSInterface() {
    renderMatrix();
    
    const container = document.getElementById('os-postesGrid');
    if (!container) return;

    // Entête des couleurs
    let html = `<div class="grid grid-cols-6 gap-2 mb-2"><div></div>`;
    colorsInfo.forEach(c => {
        html += `<div class="${c.bg} ${c.text} font-black text-center p-2 rounded-lg uppercase text-[10px] shadow-md">${c.id}</div>`;
    });
    html += `</div>`;

    // Génération des 8 lignes
    for (let ligne = 1; ligne <= NB_LIGNES; ligne++) {
        html += `<div class="grid grid-cols-6 gap-2 mb-2">
            <div class="flex items-center justify-center font-black text-slate-500 text-xl bg-slate-800/50 rounded-lg">${ligne}</div>`;
        
        colorsInfo.forEach(c => {
            const code = `${c.id}_${ligne}`;
            html += `<div class="os-dropzone bg-slate-800 border border-slate-700 min-h-[50px] flex flex-col gap-1 p-1 rounded-lg" data-code="${code}"></div>`;
        });
        html += `</div>`;
    }
    container.innerHTML = html;
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
    let bgClass = eleve.sexe === 'M' ? 'bg-blue-200 border-blue-400' : (eleve.sexe === 'F' ? 'bg-rose-200 border-rose-400' : 'bg-slate-200 border-slate-400');
    const photoHtml = url ? `<img src="${url}" class="w-8 h-8 rounded-full object-cover border-2 border-slate-500">` : `<div class="w-8 h-8 rounded-full bg-slate-400 flex items-center justify-center text-sm">👤</div>`;

    const div = document.createElement('div');
    div.className = `p-1 rounded border-2 cursor-grab active:cursor-grabbing flex items-center gap-2 ${bgClass}`;
    div.dataset.id = eleve.id;
    div.innerHTML = `${photoHtml}<div class="flex flex-col leading-none"><span class="font-black text-slate-900 text-[10px] truncate max-w-[80px]">${eleve.prenom}</span><span class="text-[9px] font-bold text-slate-600 uppercase truncate max-w-[80px]">${eleve.nom}</span></div>`;
    return div;
}

export function initSortableOS() {
    if (typeof Sortable === 'undefined') return;
    document.querySelectorAll('.os-dropzone').forEach(el => {
        if (el.__sortable) el.__sortable.destroy(); // Nettoie l'ancienne instance
        el.__sortable = new Sortable(el, {
            group: 'orientshow',
            animation: 150,
            onEnd: () => saveOSAssignments()
        });
    });
}

// --- 3. SAUVEGARDE & CHARGEMENT ---
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

window.populateReserveOS = async function() {
    const activeClasse = document.getElementById('selectClasse')?.value;
    if (!activeClasse) return alert("Sélectionnez une classe.");
    
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');
    document.querySelectorAll('.os-dropzone').forEach(el => el.innerHTML = ""); // Vide tout

    const reserve = document.getElementById('os-reserve');
    for (const eleve of eleves) reserve.appendChild(await createEleveCard(eleve));
    
    saveOSAssignments();
    setTimeout(() => initSortableOS(), 100);
};

export async function loadOSAssignments() {
    const assignments = JSON.parse(localStorage.getItem(getOSStorageKey()) || '{}');
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${document.getElementById('selectClasse')?.value}`) || '[]');
    
    document.querySelectorAll('.os-dropzone').forEach(el => el.innerHTML = ''); // Reset visuel

    const affectedIds = new Set();
    for (const zone of document.querySelectorAll('.os-dropzone')) {
        const code = zone.dataset.code;
        if (assignments[code]) {
            for (const id of assignments[code]) {
                const eleve = eleves.find(e => e.id === id);
                if (eleve) {
                    zone.appendChild(await createEleveCard(eleve));
                    affectedIds.add(id);
                }
            }
        }
    }

    // Gérer les élèves qui n'ont pas de groupe (dans la réserve)
    const reserve = document.getElementById('os-reserve');
    for (const eleve of eleves) {
        if (!affectedIds.has(eleve.id)) reserve.appendChild(await createEleveCard(eleve));
    }

    setTimeout(() => initSortableOS(), 100);
}

// --- 4. EXPORT / IMPORT JSON ---
export function exportOSConfig() {
    saveOSAssignments();
    const activeClasse = document.getElementById('selectClasse').value;
    const assignments = JSON.parse(localStorage.getItem(getOSStorageKey()) || '{}');
    const matrix = JSON.parse(localStorage.getItem('eps_arena_os_matrix') || '{}');

    const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,"");
    const data = { version: 1, classe: activeClasse, activite: 'orientshow', date: dateStr, groupes: assignments, matrice: matrix };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${activeClasse}_orientshow_${dateStr}.json`;
    a.click();
}

export function importOSConfig(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.classe || !data.groupes) throw new Error("Format de fichier invalide");
            
            localStorage.setItem(`eps_arena_os_assignments_${data.classe}`, JSON.stringify(data.groupes));
            if (data.matrice) localStorage.setItem('eps_arena_os_matrix', JSON.stringify(data.matrice));
            
            const select = document.getElementById('selectClasse');
            if (select.value !== data.classe) {
                select.value = data.classe;
                select.dispatchEvent(new Event('change'));
            } else {
                await loadOSAssignments();
                renderMatrix();
            }
            alert("✅ Configuration OrientShow importée !");
        } catch (err) { alert("❌ Erreur import : " + err.message); }
    };
    reader.readAsText(file);
    event.target.value = '';
}