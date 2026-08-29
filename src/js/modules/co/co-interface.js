import { MATRICE } from './matrice.js';
import { getPhotoUrl } from '../../services/admin-service.js';

// --------------------------------------------------------------
// INITIALISATION DE L'INTERFACE CO
// --------------------------------------------------------------
export function initCOInterface() {
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

    // Réinitialiser Sortable après création du DOM
    setTimeout(() => initSortableCO(), 100);
}

// --------------------------------------------------------------
// INITIALISATION DU GLISSER-DÉPOSER (SORTABLE)
// --------------------------------------------------------------
export function initSortableCO() {
    // Vérifier que Sortable est chargé
    if (typeof Sortable === 'undefined') {
        console.warn('Sortable non chargé, réessai dans 200ms...');
        setTimeout(() => initSortableCO(), 200);
        return;
    }

    const garconsContainer = document.getElementById('reserveCOGarcons');
    const fillesContainer = document.getElementById('reserveCOFilles');

    // Réinitialiser les instances existantes pour éviter les doublons
    if (garconsContainer && garconsContainer.__sortable) {
        garconsContainer.__sortable.destroy();
        garconsContainer.__sortable = null;
    }
    if (fillesContainer && fillesContainer.__sortable) {
        fillesContainer.__sortable.destroy();
        fillesContainer.__sortable = null;
    }
    document.querySelectorAll('.poste-members').forEach(el => {
        if (el.__sortable) {
            el.__sortable.destroy();
            el.__sortable = null;
        }
    });

    // Créer les nouvelles instances
    if (garconsContainer) {
        garconsContainer.__sortable = new Sortable(garconsContainer, {
            group: 'co-groupes',
            animation: 150,
            onEnd: () => {
                saveCOAssignments();
                // Forcer le rafraîchissement de la réserve
                setTimeout(() => refreshReserve(), 50);
            }
        });
    }

    if (fillesContainer) {
        fillesContainer.__sortable = new Sortable(fillesContainer, {
            group: 'co-groupes',
            animation: 150,
            onEnd: () => {
                saveCOAssignments();
                setTimeout(() => refreshReserve(), 50);
            }
        });
    }

    document.querySelectorAll('.poste-members').forEach(el => {
        if (!el.__sortable) {
            el.__sortable = new Sortable(el, {
                group: 'co-groupes',
                animation: 150,
                onEnd: () => {
                    saveCOAssignments();
                    setTimeout(() => refreshReserve(), 50);
                }
            });
        }
    });

    console.log('✅ Sortable CO initialisé');
}

// --------------------------------------------------------------
// CRÉATION D'UNE CARTE ÉLÈVE
// --------------------------------------------------------------
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

// --------------------------------------------------------------
// CLÉ DE STOCKAGE
// --------------------------------------------------------------
function getStorageKey() {
    const activeClasse = document.getElementById('selectClasse').value;
    return `eps_arena_co_assignments_${activeClasse}`;
}

// --------------------------------------------------------------
// SAUVEGARDE DES AFFECTATIONS
// --------------------------------------------------------------
export function saveCOAssignments() {
    const assignments = {};
    const reserveIds = [];

    // Récupérer les IDs des deux colonnes de réserve
    document.querySelectorAll('#reserveCOGarcons [data-id], #reserveCOFilles [data-id]').forEach(el => {
        reserveIds.push(el.dataset.id);
    });
    if (reserveIds.length > 0) assignments.reserve = reserveIds;

    // Récupérer les IDs des postes
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
    console.log('💾 Affectations CO sauvegardées');
}

// --------------------------------------------------------------
// CHARGEMENT DES AFFECTATIONS
// --------------------------------------------------------------
export async function loadCOAssignments() {
    const assignments = JSON.parse(localStorage.getItem(getStorageKey()) || '{}');
    const activeClasse = document.getElementById('selectClasse').value;
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');

    // Vider les conteneurs
    document.querySelectorAll('.poste-members').forEach(el => el.innerHTML = '');
    const garconsContainer = document.getElementById('reserveCOGarcons');
    const fillesContainer = document.getElementById('reserveCOFilles');
    if (garconsContainer) garconsContainer.innerHTML = '';
    if (fillesContainer) fillesContainer.innerHTML = '';

    // Placer les élèves dans les postes selon le mapping
    const placedIds = new Set();
    const postes = document.querySelectorAll('[data-poste]');
    for (const posteDiv of postes) {
        const posteId = posteDiv.dataset.poste;
        const membersDiv = posteDiv.querySelector('.poste-members');
        if (membersDiv && assignments[posteId]) {
            for (const id of assignments[posteId]) {
                const eleve = eleves.find(e => e.id === id);
                if (eleve) {
                    membersDiv.appendChild(await createEleveCard(eleve));
                    placedIds.add(id);
                }
            }
        }
    }

    // Les élèves non placés vont dans la réserve (par sexe)
    const nonPlaces = eleves.filter(e => !placedIds.has(e.id));
    const garcons = nonPlaces.filter(e => e.sexe === 'M').sort((a, b) => a.nom.localeCompare(b.nom));
    const filles = nonPlaces.filter(e => e.sexe === 'F').sort((a, b) => a.nom.localeCompare(b.nom));
    const autres = nonPlaces.filter(e => e.sexe !== 'M' && e.sexe !== 'F').sort((a, b) => a.nom.localeCompare(b.nom));

    if (garconsContainer) {
        for (const eleve of garcons) {
            garconsContainer.appendChild(await createEleveCard(eleve));
        }
        for (const eleve of autres) {
            garconsContainer.appendChild(await createEleveCard(eleve));
        }
        if (garconsContainer.children.length === 0) {
            garconsContainer.innerHTML = '<p class="text-slate-500 text-xs">Aucun garçon</p>';
        }
    }

    if (fillesContainer) {
        for (const eleve of filles) {
            fillesContainer.appendChild(await createEleveCard(eleve));
        }
        if (fillesContainer.children.length === 0) {
            fillesContainer.innerHTML = '<p class="text-slate-500 text-xs">Aucune fille</p>';
        }
    }

    saveCOAssignments();
    setTimeout(() => initSortableCO(), 100);
}

// --------------------------------------------------------------
// RAFRAÎCHISSEMENT DE LA RÉSERVE (après glissé)
// --------------------------------------------------------------
export async function refreshReserve() {
    const assignments = JSON.parse(localStorage.getItem(getStorageKey()) || '{}');
    const activeClasse = document.getElementById('selectClasse').value;
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');

    // Récupérer tous les IDs placés dans les postes
    const placedIds = new Set();
    document.querySelectorAll('.poste-members [data-id]').forEach(el => placedIds.add(el.dataset.id));

    const garconsContainer = document.getElementById('reserveCOGarcons');
    const fillesContainer = document.getElementById('reserveCOFilles');

    // Vider la réserve
    if (garconsContainer) garconsContainer.innerHTML = '';
    if (fillesContainer) fillesContainer.innerHTML = '';

    // Les élèves non placés vont dans la réserve (par sexe)
    const nonPlaces = eleves.filter(e => !placedIds.has(e.id));
    const garcons = nonPlaces.filter(e => e.sexe === 'M').sort((a, b) => a.nom.localeCompare(b.nom));
    const filles = nonPlaces.filter(e => e.sexe === 'F').sort((a, b) => a.nom.localeCompare(b.nom));
    const autres = nonPlaces.filter(e => e.sexe !== 'M' && e.sexe !== 'F').sort((a, b) => a.nom.localeCompare(b.nom));

    if (garconsContainer) {
        for (const eleve of garcons) {
            garconsContainer.appendChild(await createEleveCard(eleve));
        }
        for (const eleve of autres) {
            garconsContainer.appendChild(await createEleveCard(eleve));
        }
        if (garconsContainer.children.length === 0) {
            garconsContainer.innerHTML = '<p class="text-slate-500 text-xs">Aucun garçon</p>';
        }
    }

    if (fillesContainer) {
        for (const eleve of filles) {
            fillesContainer.appendChild(await createEleveCard(eleve));
        }
        if (fillesContainer.children.length === 0) {
            fillesContainer.innerHTML = '<p class="text-slate-500 text-xs">Aucune fille</p>';
        }
    }

    // Mettre à jour la sauvegarde
    saveCOAssignments();
    setTimeout(() => initSortableCO(), 100);
}

// --------------------------------------------------------------
// REMPLISSAGE DE LA RÉSERVE (bouton Générer CO)
// --------------------------------------------------------------
export async function populateReserveWithStudents(eleves) {
    const garconsContainer = document.getElementById('reserveCOGarcons');
    const fillesContainer = document.getElementById('reserveCOFilles');
    if (!garconsContainer || !fillesContainer) {
        console.warn('Conteneurs de réserve CO non trouvés');
        return;
    }

    // Vider les deux conteneurs
    garconsContainer.innerHTML = '';
    fillesContainer.innerHTML = '';

    // Trier les élèves par sexe
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
    document.querySelectorAll('.poste-members').forEach(el => el.innerHTML = '');

    setTimeout(() => initSortableCO(), 100);
}

// --------------------------------------------------------------
// EXPORT CONFIG
// --------------------------------------------------------------
export function exportCOConfig() {
    saveCOAssignments();
    const activeClasse = document.getElementById('selectClasse').value;
    const assignments = JSON.parse(localStorage.getItem(getStorageKey()) || '{}');

    const date = new Date();
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;

    const data = { version: 1, classe: activeClasse, activite: 'co', date: dateStr, postes: assignments };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${activeClasse}_co_${dateStr}.json`;
    a.click();
}

// --------------------------------------------------------------
// IMPORT CONFIG
// --------------------------------------------------------------
export function importCOConfig(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.classe || !data.postes) throw new Error("Format de fichier invalide");
            localStorage.setItem(`eps_arena_co_assignments_${data.classe}`, JSON.stringify(data.postes));
            const select = document.getElementById('selectClasse');
            if (select.value !== data.classe) {
                select.value = data.classe;
                select.dispatchEvent(new Event('change'));
            } else {
                await loadCOAssignments();
                setTimeout(() => initSortableCO(), 100);
            }
            alert("✅ Configuration CO importée !");
        } catch (err) {
            alert("❌ Erreur import : " + err.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}