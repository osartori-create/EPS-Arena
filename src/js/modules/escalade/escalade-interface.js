import { getPhotoUrl } from '../../services/admin-service.js';

export function initEscaladeInterface() {
    const container = document.getElementById('postesGridEscalade');
    if (!container) return;

    // Création des blocs de tableaux (A, B, C) puis (D, E, F)
    const blocs = [
        { colonnes: ['A', 'B', 'C'] },
        { colonnes: ['D', 'E', 'F'] }
    ];

    let html = '';
    blocs.forEach(bloc => {
        html += `<div class="bg-slate-800 p-3 rounded-2xl border border-slate-700 mb-4">`;
        html += `<div class="grid" style="grid-template-columns: 50px repeat(${bloc.colonnes.length}, 1fr); gap: 2px;">`;

        // En-têtes de colonnes
        html += `<div></div>`;
        bloc.colonnes.forEach(col => {
            html += `<div class="header-groupe">${col}</div>`;
        });

        // Lignes 1 à 10
        for (let ligne = 1; ligne <= 10; ligne++) {
            html += `<div class="header-num" data-ligne="${ligne}">${ligne}</div>`;
            bloc.colonnes.forEach(col => {
                const posteId = `${col}${ligne}`;
                html += `
                    <div class="bg-slate-900 border border-slate-600 p-1 min-h-[40px]" data-poste="${posteId}" id="poste-${posteId}">
                        <div class="poste-members w-full h-full flex flex-col gap-1"></div>
                    </div>
                `;
            });
        }

        html += `</div></div>`;
    });

    container.innerHTML = html;
}

export function initSortableEscalade() {
    const reserveContainer = document.getElementById('reserveListEscalade');
    if (!reserveContainer || reserveContainer.__sortable) return;

    try {
        new Sortable(reserveContainer, { group: 'escalade', animation: 150, onEnd: saveEscaladeAssignments });
        reserveContainer.__sortable = true;

        document.querySelectorAll('.poste-members').forEach(el => {
            if (!el.__sortable) {
                new Sortable(el, { group: 'escalade', animation: 150, onEnd: updateRankNumbers });
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
    document.querySelectorAll('.header-num').forEach(el => { el.textContent = el.dataset.ligne; });

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

    document.querySelectorAll('[data-poste]').forEach(posteDiv => {
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

// Mise à jour des numéros dans la partie jaune en fonction du rang
function updateRankNumbers() {
    const postes = document.querySelectorAll('[data-poste]');
    postes.forEach(posteDiv => {
        const posteId = posteDiv.dataset.poste;
        const ligne = posteId.slice(1); // Ex: "A1" -> "1"
        const headerNum = document.querySelector(`.header-num[data-ligne="${ligne}"]`);
        
        if (headerNum) {
            const membersDiv = posteDiv.querySelector('.poste-members');
            const count = membersDiv ? membersDiv.querySelectorAll('[data-id]').length : 0;
            
            // Affiche "1, 2, 3..." ou vide si aucun élève
            if (count > 0) {
                headerNum.textContent = Array.from({ length: count }, (_, i) => i + 1).join(', ');
            } else {
                headerNum.textContent = ligne;
            }
        }
    });
    saveEscaladeAssignments();
}

export async function loadEscaladeAssignments() {
    const assignments = JSON.parse(localStorage.getItem(getStorageKey()) || '{}');
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${document.getElementById('selectClasse').value}`) || '[]');

    document.getElementById('reserveListEscalade').innerHTML = '';
    document.querySelectorAll('.poste-members').forEach(el => el.innerHTML = '');

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

    updateRankNumbers();
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