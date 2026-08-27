export function initEscaladeInterface(nbGroupes = 6) {
    const container = document.getElementById('postesGridEscalade');
    if (!container) return;

    // Détruire les anciens Sortable pour éviter les conflits
    document.querySelectorAll('.groupe-members').forEach(el => {
        if (el.__sortable && typeof el.__sortable.destroy === 'function') {
            el.__sortable.destroy();
        }
        // Supprimer la propriété dans tous les cas
        delete el.__sortable;
    });
    
    // ... le reste de la fonction
}
Ensuite, dans initSortableEscalade, nous devons être cohérents : nous stockons l'instance dans el.__sortable, et non un booléen. Actuellement nous faisons :

javascript
if (!el.__sortable) {
    new Sortable(el, {...});
    el.__sortable = true;
}
Il faut corriger cela pour stocker l'instance réelle :

javascript
if (!el.__sortable) {
    const sortable = new Sortable(el, {...});
    el.__sortable = sortable;
}
Appliquez ces deux corrections dans src/js/modules/escalade/escalade-interface.js et rechargez la page. Le glisser-déposer fonctionnera à nouveau et la génération des équipes ne provoquera plus d'erreur.

Le problème est que el.__sortable contient un booléen (true) et non l'instance de Sortable. On a utilisé true comme indicateur pour ne pas réinitialiser, mais destroy() n'existe pas sur un booléen.

Voici la correction complète pour src/js/modules/escalade/escalade-interface.js. Remplacez tout le fichier par ceci :

javascript
import { getPhotoUrl } from '../../services/admin-service.js';

export function initEscaladeInterface(nbGroupes = 6) {
    const container = document.getElementById('postesGridEscalade');
    if (!container) return;

    // 1. Détruire les anciennes instances de Sortable (si ce sont de vraies instances)
    document.querySelectorAll('.groupe-members').forEach(el => {
        if (el.__sortable && typeof el.__sortable.destroy === 'function') {
            el.__sortable.destroy();
        }
        delete el.__sortable; // On supprime toujours la propriété
    });

    // 2. Lire la sauvegarde pour le bon nombre de groupes
    const activeClasse = document.getElementById('selectClasse').value;
    if (activeClasse) {
        const saved = JSON.parse(localStorage.getItem(`eps_arena_escalade_assignments_${activeClasse}`) || '{}');
        const savedGroupes = Object.keys(saved).filter(k => k !== 'reserve' && Array.isArray(saved[k])).length;
        if (savedGroupes > 0) nbGroupes = savedGroupes;
    }

    // 3. Construire le HTML des colonnes
    let html = '';
    for (let i = 0; i < nbGroupes; i++) {
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
}

export function initSortableEscalade() {
    const reserveContainer = document.getElementById('reserveListEscalade');
    if (!reserveContainer) return;

    // Initialisation de la réserve
    if (!reserveContainer.__sortable) {
        const sortableReserve = new Sortable(reserveContainer, {
            group: 'escalade',
            animation: 150,
            onEnd: saveEscaladeAssignments
        });
        reserveContainer.__sortable = sortableReserve; // ✅ On stocke l'instance, pas un booléen
    }

    // Initialisation des groupes
    document.querySelectorAll('.groupe-members').forEach(el => {
        if (!el.__sortable) {
            const sortable = new Sortable(el, {
                group: 'escalade',
                animation: 150,
                onEnd: saveEscaladeAssignments
            });
            el.__sortable = sortable; // ✅ On stocke l'instance
        }
        });
    } catch (e) { console.error("Erreur Sortable Escalade :", e); }
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

export async function loadEscaladeAssignments() {
    const assignments = JSON.parse(localStorage.getItem(getStorageKey()) || '{}');
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${document.getElementById('selectClasse').value}`) || '[]');

    document.getElementById('reserveListEscalade').innerHTML = '';
    document.querySelectorAll('.groupe-members').forEach(el => el.innerHTML = '');

    const groupes = document.querySelectorAll('[data-groupe]');
    for (const colDiv of groupes) {
        const groupe = colDiv.dataset.groupe;
        const membersDiv = colDiv.querySelector('.groupe-members');
        if (membersDiv && assignments[groupe]) {
            for (const id of assignments[groupe]) {
                const eleve = eleves.find(e => e.id === id);
                if (eleve) membersDiv.appendChild(await createEleveCard(eleve));
            }
        }
    }

    const affectedIds = new Set();
    groupes.forEach(colDiv => {
        const membersDiv = colDiv.querySelector('.groupe-members');
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

    updateRanks();
    saveEscaladeAssignments();
    
    // Réinitialise le tri APRÈS avoir rempli les groupes
    setTimeout(() => initSortableEscalade(), 100);
}

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