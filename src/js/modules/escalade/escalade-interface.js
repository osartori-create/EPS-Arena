import { getPhotoUrl } from '../../services/admin-service.js';

export function initEscaladeInterface() {
    const container = document.getElementById('postesGridEscalade');
    if (!container) return;

    // Création des blocs (ABC) et (DEF)
    const blocs = [
        { colonnes: ['A', 'B', 'C'] },
        { colonnes: ['D', 'E', 'F'] }
    ];

    let html = '';
    blocs.forEach(bloc => {
        html += `<div class="escalade-block mb-4">`;
        html += `<div class="grid" style="grid-template-columns: 60px repeat(${bloc.colonnes.length}, 1fr); gap: 4px;">`;

        // En-têtes de colonnes
        html += `<div></div>`;
        bloc.colonnes.forEach(col => {
            html += `<div class="header-groupe">${col}</div>`;
        });

        // Ligne dynamique (une seule ligne, car les élèves s'empilent)
        bloc.colonnes.forEach(col => {
            // La case jaune dynamique
            html += `<div class="groupe-num" data-groupe="${col}"></div>`;
            // La colonne de dépôt des élèves
            html += `<div class="groupe-col" data-groupe="${col}">
                        <div class="groupe-members" style="min-height: 50px;"></div>
                     </div>`;
        });

        html += `</div></div>`;
    });

    container.innerHTML = html;
}

export function initSortableEscalade() {
    const reserveContainer = document.getElementById('reserveListEscalade');
    if (!reserveContainer || reserveContainer.__sortable) return;

    try {
        new Sortable(reserveContainer, {
            group: 'escalade',
            animation: 150,
            onEnd: () => {
                saveEscaladeAssignments();
                updateRankNumbers();
            }
        });
        reserveContainer.__sortable = true;

        // On initialise chaque colonne de groupe
        document.querySelectorAll('.groupe-members').forEach(el => {
            if (!el.__sortable) {
                new Sortable(el, {
                    group: 'escalade',
                    animation: 150,
                    onEnd: () => {
                        saveEscaladeAssignments();
                        updateRankNumbers();
                    }
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
    
    // On vide toutes les colonnes
    document.querySelectorAll('.groupe-members').forEach(el => el.innerHTML = '');
    updateRankNumbers();

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

    // On lit les groupes (A, B, C...)
    document.querySelectorAll('.groupe-col').forEach(colDiv => {
        const groupe = colDiv.dataset.groupe;
        const membersDiv = colDiv.querySelector('.groupe-members');
        if (membersDiv) {
            const ids = [];
            membersDiv.querySelectorAll('[data-id]').forEach(el => ids.push(el.dataset.id));
            if (ids.length > 0) assignments[groupe] = ids;
        }
    });

    localStorage.setItem(getStorageKey(), JSON.stringify(assignments));
}

// Mise à jour des numéros dans la partie jaune (1, 2, 3...)
export function updateRankNumbers() {
    document.querySelectorAll('.groupe-col').forEach(colDiv => {
        const groupe = colDiv.dataset.groupe;
        const membersDiv = colDiv.querySelector('.groupe-members');
        const count = membersDiv ? membersDiv.querySelectorAll('[data-id]').length : 0;
        
        const numDiv = document.querySelector(`.groupe-num[data-groupe="${groupe}"]`);
        if (numDiv) {
            if (count > 0) {
                numDiv.textContent = Array.from({ length: count }, (_, i) => i + 1).join(', ');
            } else {
                numDiv.textContent = '';
            }
        }
    });
}

export async function loadEscaladeAssignments() {
    const assignments = JSON.parse(localStorage.getItem(getStorageKey()) || '{}');
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${document.getElementById('selectClasse').value}`) || '[]');

    document.getElementById('reserveListEscalade').innerHTML = '';
    document.querySelectorAll('.groupe-members').forEach(el => el.innerHTML = '');

    // Restaurer les élèves dans les groupes
    document.querySelectorAll('.groupe-col').forEach(async colDiv => {
        const groupe = colDiv.dataset.groupe;
        const membersDiv = colDiv.querySelector('.groupe-members');
        if (membersDiv && assignments[groupe]) {
            for (const id of assignments[groupe]) {
                const eleve = eleves.find(e => e.id === id);
                if (eleve) membersDiv.appendChild(await createEleveCard(eleve));
            }
        }
    });

    // Restaurer la réserve avec les non affectés
    const affectedIds = new Set();
    document.querySelectorAll('.groupe-members').forEach(membersDiv => {
        membersDiv.querySelectorAll('[data-id]').forEach(el => affectedIds.add(el.dataset.id));
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