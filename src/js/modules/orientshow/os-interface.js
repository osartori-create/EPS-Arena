import { getPhotoUrl } from '../../services/admin-service.js';

const colorsInfo = [
    { id: "NOIR", bg: "bg-black", text: "text-white" },
    { id: "ROUGE", bg: "bg-red-600", text: "text-white" },
    { id: "BLEU", bg: "bg-blue-600", text: "text-white" },
    { id: "VERT", bg: "bg-green-600", text: "text-white" },
    { id: "JAUNE", bg: "bg-yellow-500", text: "text-black" }
];
const NB_LIGNES = 6;
let osSortableInitialise = false;

export function initOSInterface() {
    console.log("🛠️ initOSInterface appelé...");
    renderMatrix();
    const container = document.getElementById('os-postesGrid');
    if (!container) {
        console.error("❌ os-postesGrid introuvable !");
        return;
    }

    let html = `<div class="grid grid-cols-6 gap-2 mb-2"><div></div>`;
    colorsInfo.forEach(c => { html += `<div class="${c.bg} ${c.text} font-black text-center p-2 rounded-lg uppercase text-[10px] shadow-md">${c.id}</div>`; });
    html += `</div>`;

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
    console.log("✅ Grille OrientShow générée !");
    
    // Init Sortable après la génération du DOM
    setTimeout(() => initSortableOS(), 50);
}

export function initSortableOS() {
    if (typeof Sortable === 'undefined') return;
    document.querySelectorAll('.os-dropzone').forEach(el => {
        if (!el.__sortable) {
            el.__sortable = new Sortable(el, {
                group: 'orientshow',
                animation: 150,
                onEnd: () => saveOSAssignments()
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
    console.log("🛠️ ensureReserveLoaded, réserve vide ?", reserve.children.length === 0, "| élèves :", eleves.length);

    if (reserve.children.length === 0 && eleves.length > 0) {
        populateReserveOS(); // Appel global
    }
}

window.populateReserveOS = async function() {
    const activeClasse = document.getElementById('selectClasse')?.value;
    if (!activeClasse) return alert("Sélectionnez une classe.");
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');
    const reserve = document.getElementById('os-reserve');
    if (!reserve) return;

    // ✅ NE PLUS JAMAIS VIDER LA GRILLE ICI
    reserve.innerHTML = ""; // On vide seulement la réserve

    for (const eleve of eleves) reserve.appendChild(await createEleveCard(eleve));
    console.log("✅ Réserve remplie avec", eleves.length, "élèves");
    
    // L'initialisation Sortable est déjà faite, on ne la refait pas ici pour ne pas écraser la grille
    setTimeout(() => initSortableOS(), 100);
};

export async function loadOSAssignments() {
    const assignments = JSON.parse(localStorage.getItem(getOSStorageKey()) || '{}');
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${document.getElementById('selectClasse')?.value}`) || '[]');
    
    document.querySelectorAll('.os-dropzone').forEach(el => el.innerHTML = '');

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

    const reserve = document.getElementById('os-reserve');
    for (const eleve of eleves) {
        if (!affectedIds.has(eleve.id)) reserve.appendChild(await createEleveCard(eleve));
    }

    setTimeout(() => initSortableOS(), 100);
}