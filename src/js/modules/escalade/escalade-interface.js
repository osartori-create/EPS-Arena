// src/js/modules/escalade/escalade-interface.js
import { getPhotoUrl } from '../../services/admin-service.js';

export function initEscaladeInterface() {
    const postesContainer = document.getElementById('postesGridEscalade');
    if (!postesContainer) return;
    
    // Génération des postes A, B, C, D...
    const groupes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    let html = '';
    groupes.forEach(groupe => {
        html += `
            <div class="bg-slate-900 border-2 border-slate-600 p-4 rounded-2xl min-h-[80px] flex flex-col items-center justify-center" data-groupe="${groupe}" id="groupe-${groupe}">
                <h4 class="font-black text-yellow-400 text-xl mb-2">${groupe}</h4>
                <div class="groupe-members w-full flex flex-col gap-2 min-h-[40px]">
                </div>
            </div>
        `;
    });
    postesContainer.innerHTML = html;
}

export function initSortableEscalade() {
    const reserveContainer = document.getElementById('reserveListEscalade');
    if (!reserveContainer || reserveContainer.__sortable) return;

    try {
        new Sortable(reserveContainer, {
            group: 'escalade',
            animation: 150,
            onEnd: saveEscaladeAssignments
        });
        reserveContainer.__sortable = true;

        document.querySelectorAll('.groupe-members').forEach(el => {
            if (!el.__sortable) {
                new Sortable(el, {
                    group: 'escalade',
                    animation: 150,
                    onEnd: saveEscaladeAssignments
                });
                el.__sortable = true;
            }
        });
    } catch (e) {
        console.error("Erreur Sortable Escalade :", e);
    }
}

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

export async function populateReserveEscalade(eleves) {
    const reserveContainer = document.getElementById('reserveListEscalade');
    if (!reserveContainer) return;

    const view = document.getElementById('viewEscaladeSettings');
    if (view) view.classList.remove('hidden');

    reserveContainer.innerHTML = '';
    localStorage.removeItem(getStorageKey());

    document.querySelectorAll('.groupe-members').forEach(el => el.innerHTML = '');

    for (const eleve of eleves) {
        reserveContainer.appendChild(await createEleveCard(eleve));
    }

    setTimeout(() => initSortableEscalade(), 100);
}

function getStorageKey() {
    const activeClasse = document.getElementById('selectClasse').value;
    return `eps_arena_escalade_assignments_${activeClasse}`;
}

export function saveEscaladeAssignments() {
    const reserveContainer = document.getElementById('reserveListEscalade');
    if (!reserveContainer) return;
    
    const assignments = {};
    const reserveIds = [];
    reserveContainer.querySelectorAll('[data-id]').forEach(el => reserveIds.push(el.dataset.id));
    if (reserveIds.length > 0) assignments.reserve = reserveIds;

    const groupes = document.querySelectorAll('[data-groupe]');
    groupes.forEach(groupeDiv => {
        const groupeId = groupeDiv.dataset.groupe;
        const membersDiv = groupeDiv.querySelector('.groupe-members');
        if (membersDiv) {
            const ids = [];
            membersDiv.querySelectorAll('[data-id]').forEach(el => ids.push(el.dataset.id));
            if (ids.length > 0) assignments[groupeId] = ids;
        }
    });

    localStorage.setItem(getStorageKey(), JSON.stringify(assignments));
}

export async function loadEscaladeAssignments() {
    const assignments = JSON.parse(localStorage.getItem(getStorageKey()) || '{}');
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${document.getElementById('selectClasse').value}`) || '[]');

    document.getElementById('reserveListEscalade').innerHTML = '';
    document.querySelectorAll('.groupe-members').forEach(el => el.innerHTML = '');

    // Restaurer les élèves dans les groupes
    const groupes = document.querySelectorAll('[data-groupe]');
    for (const groupeDiv of groupes) {
        const groupeId = groupeDiv.dataset.groupe;
        const membersDiv = groupeDiv.querySelector('.groupe-members');
        if (membersDiv && assignments[groupeId]) {
            for (const id of assignments[groupeId]) {
                const eleve = eleves.find(e => e.id === id);
                if (eleve) membersDiv.appendChild(await createEleveCard(eleve));
            }
        }
    }

    // Restaurer la réserve avec les non affectés
    const affectedIds = new Set();
    groupes.forEach(groupeDiv => {
        const membersDiv = groupeDiv.querySelector('.groupe-members');
        if (membersDiv) membersDiv.querySelectorAll('[data-id]').forEach(el => affectedIds.add(el.dataset.id));
    });
    
    let reserveIds = assignments.reserve || [];
    eleves.forEach(eleve => {
        if (!affectedIds.has(eleve.id) && !reserveIds.includes(eleve.id)) reserveIds.push(eleve.id);
    });

    const reserveContainer = document.getElementById('reserveListEscalade');
    for (const id of reserveIds) {
        const eleve = eleves.find(e => e.id === id);
        if (eleve) reserveContainer.appendChild(await createEleveCard(eleve));
    }

    saveEscaladeAssignments();
    setTimeout(() => initSortableEscalade(), 100);
}

export function exportEscaladeConfig() {
    saveEscaladeAssignments();
    const activeClasse = document.getElementById('selectClasse').value;
    const assignments = JSON.parse(localStorage.getItem(getStorageKey()) || '{}');

    const date = new Date();
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    
    const data = { version: 1, classe: activeClasse, activite: 'escalade', date: dateStr, groupes: assignments };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${activeClasse}_escalade_${dateStr}.json`;
    a.click();
}

export function importEscaladeConfig(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.classe || !data.groupes) throw new Error("Format de fichier invalide");
            localStorage.setItem(`eps_arena_escalade_assignments_${data.classe}`, JSON.stringify(data.groupes));
            const select = document.getElementById('selectClasse');
            if (select.value !== data.classe) {
                select.value = data.classe;
                select.dispatchEvent(new Event('change'));
            } else {
                await loadEscaladeAssignments();
            }
            alert("✅ Configuration Escalade importée !");
        } catch (err) {
            alert("❌ Erreur import : " + err.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}