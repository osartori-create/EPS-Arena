// src/js/modules/co/co-interface.js
import { MATRICE } from './matrice.js';
import { getPhotoUrl } from '../../services/admin-service.js';

export function initCOInterface() {
    const postesContainer = document.getElementById('postesGrid');
    if (!postesContainer) return;
    generatePostesGrid();
}

function generatePostesGrid() {
    const postesContainer = document.getElementById('postesGrid');
    if (!postesContainer) return;

    const headers = Object.keys(MATRICE['31'] || {});
    let html = '';
    headers.forEach(poste => {
        html += `
            <div class="bg-slate-900 border-2 border-slate-600 p-4 rounded-2xl min-h-[80px] flex flex-col items-center justify-center" data-poste="${poste}" id="poste-${poste}">
                <h4 class="font-black text-yellow-400 text-xl mb-2">${poste}</h4>
                <div class="poste-members w-full flex flex-col gap-2 min-h-[40px]"></div>
            </div>
        `;
    });
    postesContainer.innerHTML = html;
}

export function initSortableCO() {
    const reserveContainer = document.getElementById('reserveList');
    if (!reserveContainer || reserveContainer.__sortable) return;

    try {
        new Sortable(reserveContainer, {
            group: 'co-groupes',
            animation: 150,
            onEnd: saveCOAssignments
        });
        reserveContainer.__sortable = true;

        document.querySelectorAll('.poste-members').forEach(el => {
            if (!el.__sortable) {
                new Sortable(el, {
                    group: 'co-groupes',
                    animation: 150,
                    onEnd: saveCOAssignments
                });
                el.__sortable = true;
            }
        });
    } catch (e) {
        console.error("Erreur Sortable :", e);
    }
}

// Créer un élément HTML pour un élève (avec photo et couleur)
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

export async function populateReserveWithStudents(eleves) {
    const reserveContainer = document.getElementById('reserveList');
    if (!reserveContainer) return;

    const coView = document.getElementById('viewCOSettings');
    if (coView) coView.classList.remove('hidden');

    // On vide tout et on reconstruit la réserve
    reserveContainer.innerHTML = '';
    localStorage.removeItem(getStorageKey());

    // On réinitialise les postes
    document.querySelectorAll('.poste-members').forEach(el => el.innerHTML = '');

    for (const eleve of eleves) {
        reserveContainer.appendChild(await createEleveCard(eleve));
    }

    setTimeout(() => initSortableCO(), 100);
}

export function populateReserve(teams) {
    const reserveContainer = document.getElementById('reserveList');
    if (!reserveContainer) return;

    let html = '';
    teams.forEach(team => {
        html += `
            <div class="bg-slate-800 p-3 rounded-xl border border-slate-600 cursor-grab active:cursor-grabbing" data-team="${team.label}">
                <span class="font-black" style="color: ${team.color}">${team.label}</span>
                <span class="text-xs text-slate-400">(${team.members.length} élèves)</span>
            </div>
        `;
    });

    reserveContainer.innerHTML = html;
    setTimeout(() => initSortableCO(), 100);
}

function getStorageKey() {
    const activeClasse = document.getElementById('selectClasse').value;
    return `eps_arena_co_assignments_${activeClasse}`;
}

export function saveCOAssignments() {
    const reserveContainer = document.getElementById('reserveList');
    if (!reserveContainer) return;
    
    const assignments = {};
    const reserveIds = [];
    reserveContainer.querySelectorAll('[data-id]').forEach(el => reserveIds.push(el.dataset.id));
    if (reserveIds.length > 0) assignments.reserve = reserveIds;

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

// Fonction qui reconstruit toute l'interface à partir des affectations
export async function rebuildUI(assignments) {
    const activeClasse = document.getElementById('selectClasse').value;
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');

    // 1. Vider tout
    const reserveList = document.getElementById('reserveList');
    if (reserveList) reserveList.innerHTML = '';
    document.querySelectorAll('.poste-members').forEach(el => el.innerHTML = '');

    // 2. Remplir les postes
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

    // 3. Remplir la réserve avec tous les élèves NON affectés (recalcul automatique)
    const affectedIds = new Set();
    postes.forEach(posteDiv => {
        const membersDiv = posteDiv.querySelector('.poste-members');
        if (membersDiv) {
            membersDiv.querySelectorAll('[data-id]').forEach(el => affectedIds.add(el.dataset.id));
        }
    });

    // Si le JSON contient explicitement la réserve, on l'utilise, sinon on prend les restants
    let reserveIds = assignments.reserve || [];
    // On filtre pour ne garder que ceux qui ne sont pas déjà dans un poste (évite les doublons)
    reserveIds = reserveIds.filter(id => !affectedIds.has(id));

    // Ajoute tous les élèves qui ne sont ni dans un poste ni dans la réserve
    eleves.forEach(eleve => {
        if (!affectedIds.has(eleve.id) && !reserveIds.includes(eleve.id)) {
            reserveIds.push(eleve.id);
        }
    });

    if (reserveList) {
        for (const id of reserveIds) {
            const eleve = eleves.find(e => e.id === id);
            if (eleve) reserveList.appendChild(await createEleveCard(eleve));
        }
    }

    // 4. Sauvegarder l'état et réinitialiser Sortable
    saveCOAssignments();
    setTimeout(() => initSortableCO(), 100);
}

export function loadCOAssignments() {
    const assignments = JSON.parse(localStorage.getItem(getStorageKey()) || '{}');
    rebuildUI(assignments);
}

export function exportCOConfig() {
    const activeClasse = document.getElementById('selectClasse').value;
    if (!activeClasse) return alert("Sélectionnez une classe d'abord.");
    
    saveCOAssignments();
    const assignments = JSON.parse(localStorage.getItem(getStorageKey()) || '{}');
    
    const date = new Date();
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    
    const data = {
        version: 1,
        classe: activeClasse,
        activite: 'co',
        date: dateStr,
        postes: assignments
    };

    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeClasse}_co_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function importCOConfig(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.classe || !data.postes) throw new Error("Format de fichier invalide");

            // 1. On enregistre les données dans le localStorage de la classe cible
            const storageKey = `eps_arena_co_assignments_${data.classe}`;
            localStorage.setItem(storageKey, JSON.stringify(data.postes));

            // 2. On sélectionne la bonne classe si nécessaire
            const select = document.getElementById('selectClasse');
            const classeChangee = (select.value !== data.classe);
            
            if (classeChangee) {
                select.value = data.classe;
                select.dispatchEvent(new Event('change'));
                // Le listener 'change' appellera rebuildUI automatiquement
            } else {
                // Même classe : on reconstruit directement
                rebuildUI(data.postes);
            }

            alert("✅ Configuration CO importée !");
        } catch (err) {
            alert("❌ Erreur lors de l'import : " + err.message);
        }
    };
    reader.readAsText(file);
    
    event.target.value = '';
}