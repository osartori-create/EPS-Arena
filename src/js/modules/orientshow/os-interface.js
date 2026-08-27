import { getPhotoUrl } from '../../services/admin-service.js';

const couleurs = [
    { id: "NOIR", bg: "bg-black", text: "text-white" },
    { id: "ROUGE", bg: "bg-red-600", text: "text-white" },
    { id: "BLEU", bg: "bg-blue-600", text: "text-white" },
    { id: "VERT", bg: "bg-green-600", text: "text-white" },
    { id: "JAUNE", bg: "bg-yellow-500", text: "text-black" }
];

// ✅ MATRICE PAR DÉFAUT (codes fournis)
const DEFAULT_MATRIX = {
    1:{NOIR:["D","O"],ROUGE:["Y","E"],BLEU:["N","K"],VERT:["",""],JAUNE:["",""]},
    2:{NOIR:["E","X"],ROUGE:["T","R"],BLEU:["A","L"],VERT:["",""],JAUNE:["",""]},
    3:{NOIR:["C","H"],ROUGE:["I","O"],BLEU:["T","E"],VERT:["",""],JAUNE:["",""]},
    4:{NOIR:["R","E"],ROUGE:["C","N"],BLEU:["O","I"],VERT:["",""],JAUNE:["",""]},
    5:{NOIR:["A","J"],ROUGE:["O","E"],BLEU:["S","C"],VERT:["",""],JAUNE:["",""]},
    6:{NOIR:["F","I"],ROUGE:["C","S"],BLEU:["U","U"],VERT:["",""],JAUNE:["",""]},
    7:{NOIR:["G","U"],ROUGE:["E","H"],BLEU:["E","C"],VERT:["",""],JAUNE:["",""]},
    8:{NOIR:["I","V"],ROUGE:["R","N"],BLEU:["S","C"],VERT:["",""],JAUNE:["",""]},
    9:{NOIR:["K","R"],ROUGE:["A","T"],BLEU:["N","C"],VERT:["",""],JAUNE:["",""]},
    10:{NOIR:["O","C"],ROUGE:["I","Z"],BLEU:["E","C"],VERT:["",""],JAUNE:["",""]},
    11:{NOIR:["P","A"],ROUGE:["L","D"],BLEU:["U","U"],VERT:["",""],JAUNE:["",""]},
    12:{NOIR:["U","L"],ROUGE:["N","A"],BLEU:["H","T"],VERT:["",""],JAUNE:["",""]}
};

// Vérifie si la matrice existe, sinon insère celle par défaut
if(!localStorage.getItem('eps_arena_os_matrix')) {
    localStorage.setItem('eps_arena_os_matrix', JSON.stringify(DEFAULT_MATRIX));
}

// Fonctions exposées globalement
window.exportOSConfig = exportOSConfig;
window.importOSConfig = importOSConfig;

export function initOSInterface() {
    const container = document.getElementById('os-postesGrid');
    if (!container) return;

    // Génération de la grille (5x6)
    let html = `<div class="grid grid-cols-6 gap-2 mb-2"><div></div>`;
    couleurs.forEach(c => { html += `<div class="${c.bg} ${c.text} font-black text-center p-2 rounded-lg uppercase text-[10px] shadow-md">${c.id}</div>`; });
    html += `</div>`;

    for (let ligne = 1; ligne <= 6; ligne++) {
        html += `<div class="grid grid-cols-6 gap-2 mb-2">
            <div class="flex items-center justify-center font-black text-yellow-400 text-5xl bg-slate-900 w-12 h-12 rounded-lg shadow-inner border border-yellow-500/30">${ligne}</div>`;
        couleurs.forEach(c => {
            const code = `${c.id}_${ligne}`;
            html += `<div class="os-dropzone bg-slate-800 border border-slate-700 min-h-[50px] flex flex-col gap-1 p-1 rounded-lg" data-code="${code}"></div>`;
        });
        html += `</div>`;
    }
    container.innerHTML = html;

    setTimeout(() => initSortableOS(), 100);
}

export function initSortableOS() {
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

export function ensureReserveLoaded() {
    const activeClasse = document.getElementById('selectClasse')?.value;
    if (!activeClasse) return;
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');
    const reserve = document.getElementById('os-reserve');
    if (!reserve) return;
    
    // D'abord on charge les groupes
    loadOSAssignments();
    
    // Ensuite, si la réserve est vide, on la remplit avec les non-affectés (une seule fois)
    if (reserve.children.length === 0 && eleves.length > 0) populateReserveOS();
}

window.populateReserveOS = async function() {
    const activeClasse = document.getElementById('selectClasse')?.value;
    if (!activeClasse) return alert("Sélectionnez une classe.");
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');
    const reserve = document.getElementById('os-reserve');
    if (!reserve) return;
    
    // Ne vider la réserve que si on vient de cliquer volontairement
    // Évite de re-vider si on a déjà chargé la page
    if (reserve.dataset.loaded !== "true") {
        reserve.innerHTML = "";
    }

    // On récupère les élèves déjà placés dans les cases pour éviter les doublons
    const placedIds = new Set();
    document.querySelectorAll('.os-dropzone').forEach(zone => {
        zone.querySelectorAll('[data-id]').forEach(el => placedIds.add(el.dataset.id));
    });

    // On ne met dans la réserve que les élèves NON placés
    for (const eleve of eleves) {
        if (!placedIds.has(eleve.id)) reserve.appendChild(await createEleveCard(eleve));
    }
    reserve.dataset.loaded = "true"; // Marqueur pour ne pas re-vider au prochain chargement
    setTimeout(() => initSortableOS(), 100);
};

export async function loadOSAssignments() {
    const assignments = JSON.parse(localStorage.getItem(getOSStorageKey()) || '{}');
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${document.getElementById('selectClasse')?.value}`) || '[]');
    
    document.querySelectorAll('.os-dropzone').forEach(el => el.innerHTML = '');
    const reserve = document.getElementById('os-reserve');
    if (reserve) reserve.innerHTML = '';

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

    if (reserve) {
        for (const eleve of eleves) {
            if (!affectedIds.has(eleve.id)) reserve.appendChild(await createEleveCard(eleve));
        }
        // On oublie le marqueur pour que le prochain clic sur "Charger" re-vide et re-remplisse tout proprement
        delete reserve.dataset.loaded;
    }

    setTimeout(() => initSortableOS(), 100);
}

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
            }
            alert("✅ Configuration OrientShow importée !");
        } catch (err) { alert("❌ Erreur import : " + err.message); }
    };
    reader.readAsText(file);
    event.target.value = '';
}

window.openOSMatrixModal = function() {
    let matrix = JSON.parse(localStorage.getItem('eps_arena_os_matrix') || {});
    let html = `<div class="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4">
        <div class="bg-slate-800 w-full max-w-3xl rounded-3xl p-6 border border-slate-700 relative">
            <button onclick="document.getElementById('osMatrixModal').remove()" class="absolute top-4 right-4 text-3xl text-slate-400 hover:text-white">&times;</button>
            <h3 class="font-black text-blue-400 text-lg mb-4">Matrice des Balises</h3>
            <div class="overflow-x-auto">
                <table class="w-full text-center font-bold text-[10px]">`;

    html += `<tr class="bg-slate-900 text-white"><th>#</th><th colspan="2" class="bg-black">NOIR</th><th colspan="2" class="bg-red-600">ROUGE</th><th colspan="2" class="bg-blue-600">BLEU</th><th colspan="2" class="bg-green-600">VERT</th><th colspan="2" class="bg-yellow-500 text-black">JAUNE</th></tr>`;

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
    html += `</table></div></div></div>`;

    const modal = document.createElement('div');
    modal.id = 'osMatrixModal';
    modal.innerHTML = html;
    document.body.appendChild(modal);
};

window.saveOSMatrix = function(circuit, color, index, val) {
    let matrix = JSON.parse(localStorage.getItem('eps_arena_os_matrix')) || {};
    if(!matrix[circuit]) matrix[circuit] = {};
    if(!matrix[circuit][color]) matrix[circuit][color] = ["",""];
    matrix[circuit][color][index] = val.toUpperCase();
    localStorage.setItem('eps_arena_os_matrix', JSON.stringify(matrix));
};