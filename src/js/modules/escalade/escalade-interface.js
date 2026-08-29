import { getPhotoUrl } from '../../services/admin-service.js';

// 1. Génération de la grille (avec lecture de la sauvegarde pour le bon nombre de groupes)
export function initEscaladeInterface(nbGroupes = 6, force = false) {
    const container = document.getElementById('postesGridEscalade');
    if (!container) return;

    const activeClasse = document.getElementById('selectClasse').value;
    let nbGroupesCalcule = nbGroupes;

    // Si on force, on utilise nbGroupes sans regarder la sauvegarde
    if (!force && activeClasse) {
        const saved = JSON.parse(localStorage.getItem(`eps_arena_escalade_assignments_${activeClasse}`) || '{}');
        const savedGroupes = Object.keys(saved).filter(k => k !== 'reserve' && Array.isArray(saved[k]) && saved[k].length > 0).length;
        if (savedGroupes > 0) {
            nbGroupesCalcule = savedGroupes;
        } else {
            const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');
            if (eleves.length > 0) {
                nbGroupesCalcule = Math.ceil(eleves.length / 3);
            }
        }
    } else if (force && activeClasse) {
        // On force le nombre de groupes, on peut aussi vider la sauvegarde ici
        localStorage.removeItem(`eps_arena_escalade_assignments_${activeClasse}`);
    }

    // Construire le HTML avec le bon nombre de groupes
    let html = '';
    for (let i = 0; i < nbGroupesCalcule; i++) {
        const lettre = String.fromCharCode(65 + i);
        html += `
            <div class="flex flex-col">
                <div class="header-col">${lettre}</div>
                <div class="escalade-col" data-groupe="${lettre}">
                    <div class="groupe-members flex flex-col gap-2"></div>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;

    window.currentEscaladeGroupes = nbGroupesCalcule;
    // Réinitialiser Sortable après construction
    setTimeout(() => initSortableEscalade(), 100);
}

// 2. Initialisation du glisser-déposer
export function initSortableEscalade() {
    const garconsContainer = document.getElementById('reserveEscaladeGarcons');
    const fillesContainer = document.getElementById('reserveEscaladeFilles');

    // Détruire les instances existantes
    if (garconsContainer && garconsContainer.__sortable) {
        garconsContainer.__sortable.destroy();
        garconsContainer.__sortable = null;
    }
    if (fillesContainer && fillesContainer.__sortable) {
        fillesContainer.__sortable.destroy();
        fillesContainer.__sortable = null;
    }
    document.querySelectorAll('.groupe-members').forEach(el => {
        if (el.__sortable) {
            el.__sortable.destroy();
            el.__sortable = null;
        }
    });

    if (garconsContainer) {
        garconsContainer.__sortable = new Sortable(garconsContainer, {
            group: 'escalade',
            animation: 150,
            onEnd: saveEscaladeAssignments
        });
    }
    if (fillesContainer) {
        fillesContainer.__sortable = new Sortable(fillesContainer, {
            group: 'escalade',
            animation: 150,
            onEnd: saveEscaladeAssignments
        });
    }

    document.querySelectorAll('.groupe-members').forEach(el => {
        el.__sortable = new Sortable(el, {
            group: 'escalade',
            animation: 150,
            onEnd: saveEscaladeAssignments
        });
    });
}

// 3. Création d'une carte élève
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

// 4. Remplissage de la réserve
export async function populateReserveEscalade(eleves) {
    const garconsContainer = document.getElementById('reserveEscaladeGarcons');
    const fillesContainer = document.getElementById('reserveEscaladeFilles');
    if (!garconsContainer || !fillesContainer) return;

    garconsContainer.innerHTML = '';
    fillesContainer.innerHTML = '';

    const garcons = eleves.filter(e => e.sexe === 'M').sort((a, b) => a.nom.localeCompare(b.nom));
    const filles = eleves.filter(e => e.sexe === 'F').sort((a, b) => a.nom.localeCompare(b.nom));
    const autres = eleves.filter(e => e.sexe !== 'M' && e.sexe !== 'F').sort((a, b) => a.nom.localeCompare(b.nom));

    for (const eleve of garcons) {
        garconsContainer.appendChild(await createEleveCard(eleve));
    }
    for (const eleve of filles) {
        fillesContainer.appendChild(await createEleveCard(eleve));
    }
    for (const eleve of autres) {
        garconsContainer.appendChild(await createEleveCard(eleve));
    }

    if (garconsContainer.children.length === 0) {
        garconsContainer.innerHTML = '<p class="text-slate-500 text-xs">Aucun garçon</p>';
    }
    if (fillesContainer.children.length === 0) {
        fillesContainer.innerHTML = '<p class="text-slate-500 text-xs">Aucune fille</p>';
    }

    // Nettoyer l'ancienne sauvegarde
    localStorage.removeItem(getStorageKey());
    document.querySelectorAll('.groupe-members').forEach(el => el.innerHTML = '');

    setTimeout(() => initSortableEscalade(), 100);
}

// 5. Clé de stockage
function getStorageKey() {
    const activeClasse = document.getElementById('selectClasse').value;
    return `eps_arena_escalade_assignments_${activeClasse}`;
}

// 6. Sauvegarde des affectations
export function saveEscaladeAssignments() {
    const assignments = {};
    const reserveIds = [];

    document.querySelectorAll('#reserveEscaladeGarcons [data-id], #reserveEscaladeFilles [data-id]').forEach(el => {
        reserveIds.push(el.dataset.id);
    });
    if (reserveIds.length > 0) assignments.reserve = reserveIds;

    document.querySelectorAll('[data-groupe]').forEach(colDiv => {
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

// 7. Chargement des affectations
export async function loadEscaladeAssignments() {
    const assignments = JSON.parse(localStorage.getItem(getStorageKey()) || '{}');
    const activeClasse = document.getElementById('selectClasse').value;
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');

    document.querySelectorAll('.groupe-members').forEach(el => el.innerHTML = '');
    const garconsContainer = document.getElementById('reserveEscaladeGarcons');
    const fillesContainer = document.getElementById('reserveEscaladeFilles');
    garconsContainer.innerHTML = '';
    fillesContainer.innerHTML = '';

    const placedIds = new Set();
    const groupes = document.querySelectorAll('[data-groupe]');
    for (const colDiv of groupes) {
        const groupe = colDiv.dataset.groupe;
        const membersDiv = colDiv.querySelector('.groupe-members');
        if (membersDiv && assignments[groupe]) {
            for (const id of assignments[groupe]) {
                const eleve = eleves.find(e => e.id === id);
                if (eleve) {
                    membersDiv.appendChild(await createEleveCard(eleve));
                    placedIds.add(id);
                }
            }
        }
    }

    const nonPlaces = eleves.filter(e => !placedIds.has(e.id));
    const garcons = nonPlaces.filter(e => e.sexe === 'M').sort((a, b) => a.nom.localeCompare(b.nom));
    const filles = nonPlaces.filter(e => e.sexe === 'F').sort((a, b) => a.nom.localeCompare(b.nom));
    const autres = nonPlaces.filter(e => e.sexe !== 'M' && e.sexe !== 'F').sort((a, b) => a.nom.localeCompare(b.nom));

    for (const eleve of garcons) {
        garconsContainer.appendChild(await createEleveCard(eleve));
    }
    for (const eleve of filles) {
        fillesContainer.appendChild(await createEleveCard(eleve));
    }
    for (const eleve of autres) {
        garconsContainer.appendChild(await createEleveCard(eleve));
    }

    if (garconsContainer.children.length === 0) {
        garconsContainer.innerHTML = '<p class="text-slate-500 text-xs">Aucun garçon</p>';
    }
    if (fillesContainer.children.length === 0) {
        fillesContainer.innerHTML = '<p class="text-slate-500 text-xs">Aucune fille</p>';
    }

    updateRanks();
    saveEscaladeAssignments();
    setTimeout(() => initSortableEscalade(), 100);
}

// 8. Mise à jour des rangs
export function updateRanks() {
    document.querySelectorAll('[data-groupe]').forEach(colDiv => {
        const membersDiv = colDiv.querySelector('.groupe-members');
        const children = membersDiv ? membersDiv.querySelectorAll('[data-id]') : [];
        children.forEach((child, index) => {
            let rankSpan = child.querySelector('.rank-badge');
            if (!rankSpan) {
                rankSpan = document.createElement('span');
                rankSpan.className = 'rank-badge bg-blue-900 text-white text-2xl font-black px-3 py-1 rounded-lg ml-auto';
                child.appendChild(rankSpan);
            }
            rankSpan.textContent = index + 1;
        });
    });
}

// 9. Export JSON
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

// 10. Import JSON
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
                const groupKeys = Object.keys(data.groupes).filter(k => k !== 'reserve');
                const nbGroupes = groupKeys.length;
                initEscaladeInterface(nbGroupes, true);
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