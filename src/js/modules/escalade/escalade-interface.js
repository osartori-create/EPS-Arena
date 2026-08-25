// src/js/modules/escalade/escalade-interface.js
import { getPhotoUrl } from '../../services/admin-service.js';

// Génère la grille A, B, C avec les lignes 1, 2, 3...
export function initEscaladeInterface() {
    const container = document.getElementById('postesGridEscalade');
    if (!container) return;
    
    // Configuration : 3 colonnes (A, B, C) et 10 lignes max (pour 30 élèves)
    const groupes = ['A', 'B', 'C'];
    const maxLignes = 10;

    let html = '<div class="escalade-grid">';
    
    // En-tête vide + En-têtes de colonnes
    html += '<div class="bg-transparent"></div>';
    groupes.forEach(g => {
        html += `<div class="header-groupe bg-slate-700 text-white font-black text-center p-2 rounded-t-lg">${g}</div>`;
    });

    // Lignes
    for (let i = 1; i <= maxLignes; i++) {
        // Case jaune pour le numéro (En-tête de ligne)
        html += `<div class="header-num bg-yellow-400 text-black font-black text-center flex items-center justify-center rounded-l-lg">${i}</div>`;
        
        // Cellules postes
        groupes.forEach(g => {
            html += `
                <div class="bg-slate-900 border border-slate-600 p-1 min-h-[50px] flex flex-col gap-1" 
                     data-poste="${g}${i}" id="poste-${g}${i}">
                    <div class="poste-members w-full h-full flex flex-col gap-1"></div>
                </div>
            `;
        });
    }
    html += '</div>';
    
    container.innerHTML = html;
}

// Initialise le glisser-déposer (Réserve -> Cellules de la grille)
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

        document.querySelectorAll('.poste-members').forEach(el => {
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
        ? `<img src="${url}" class="w-8 h-8 rounded-full object-cover border border-slate-500">`
        : `<div class="w-8 h-8 rounded-full bg-slate-400 flex items-center justify-center text-lg">👤</div>`;

    const div = document.createElement('div');
    div.className = `p-1 rounded-lg border cursor-grab active:cursor-grabbing flex items-center gap-2 ${bgClass}`;
    div.dataset.id = eleve.id;
    div.innerHTML = `
        ${photoHtml}
        <div class="flex flex-col leading-tight overflow-hidden">
            <span class="font-black text-slate-900 text-xs truncate">${eleve.prenom}</span>
            <span class="text-[10px] font-bold text-slate-600 uppercase truncate">${eleve.nom}</span>
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

    document.querySelectorAll('.poste-members').forEach(el => el.innerHTML = '');

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

    // Sauvegarde par poste (A1, A2...)
    const postes = document.querySelectorAll('[data-poste]');
    postes.forEach(posteDiv => {
        const posteId = posteDiv.dataset.poste;
        const membersDiv = posteDiv.querySelector('.poste-members');
        if (membersDiv) {
            const ids = [];
            membersDiv.querySelectorAll('[data-id]').forEach(el => ids.push(el.dataset.id));
            if (ids.length > 0) assignments[posteId] = ids;
        }
    });

    localStorage.setItem(getStorageKey(), JSON.stringify(assignments));
}

export async function loadEscaladeAssignments() {
    const assignments = JSON.parse(localStorage.getItem(getStorageKey()) || '{}');
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${document.getElementById('selectClasse').value}`) || '[]');

    document.getElementById('reserveListEscalade').innerHTML = '';
    document.querySelectorAll('.poste-members').forEach(el => el.innerHTML = '');

    // Restaurer les élèves dans les postes
    const postes = document.querySelectorAll('[data-poste]');
    for (const posteDiv of postes) {
        const posteId = posteDiv.dataset.poste;
        const membersDiv = posteDiv.querySelector('.poste-members');
        if (membersDiv && assignments[posteId]) {
            for (const id of assignments[posteId]) {
                const eleve = eleves.find(e => e.id === id);
                if (eleve) membersDiv.appendChild(await createEleveCard(eleve));
            }
        }
    }

    // Restaurer la réserve avec les non affectés
    const affectedIds = new Set();
    postes.forEach(posteDiv => {
        const membersDiv = posteDiv.querySelector('.poste-members');
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
    
    const data = { version: 1, classe: activeClasse, activite: 'escalade', date: dateStr, postes: assignments };
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
            if (!data.classe || !data.postes) throw new Error("Format de fichier invalide");
            localStorage.setItem(`eps_arena_escalade_assignments_${data.classe}`, JSON.stringify(data.postes));
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