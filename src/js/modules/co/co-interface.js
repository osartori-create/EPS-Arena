// src/js/modules/co/co-interface.js
import { MATRICE } from './matrice.js';
import { getPhotoUrl } from '../../services/admin-service.js';

export function initCOInterface() {
    console.log("🔍 Initialisation CO...");
    const postesContainer = document.getElementById('postesGrid');
    if (!postesContainer) {
        console.error("❌ #postesGrid introuvable !");
        return;
    }
    generatePostesGrid();
    console.log("✅ Interface CO initialisée.");
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
                <div class="poste-members w-full flex flex-col gap-2 min-h-[40px]">
                </div>
            </div>
        `;
    });
    postesContainer.innerHTML = html;
}

export function initSortableCO() {
    const reserveContainer = document.getElementById('reserveList');
    if (!reserveContainer) return;

    if (reserveContainer.__sortable) return;

    try {
        new Sortable(reserveContainer, {
            group: 'co-groupes',
            animation: 150,
            onEnd: function() {
                saveCOAssignments();
            }
        });
        reserveContainer.__sortable = true;

        document.querySelectorAll('.poste-members').forEach(el => {
            if (!el.__sortable) {
                new Sortable(el, {
                    group: 'co-groupes',
                    animation: 150,
                    onEnd: function() {
                        saveCOAssignments();
                    },
                    onAdd: function() {
                        saveCOAssignments();
                    },
                    onRemove: function() {
                        saveCOAssignments();
                    }
                });
                el.__sortable = true;
            }
        });
    } catch (e) {
        console.error("Erreur Sortable :", e);
    }
}

export async function populateReserveWithStudents(eleves) {
    const reserveContainer = document.getElementById('reserveList');
    if (!reserveContainer) return;

    const coView = document.getElementById('viewCOSettings');
    if (coView) coView.classList.remove('hidden');

    let html = '';
    for (const eleve of eleves) {
        const url = await getPhotoUrl(eleve.id);
        
        let bgClass = 'bg-slate-200 border-slate-400';
        if (eleve.sexe === 'M') bgClass = 'bg-blue-200 border-blue-400';
        else if (eleve.sexe === 'F') bgClass = 'bg-rose-200 border-rose-400';
        
        const photoHtml = url 
            ? `<img src="${url}" class="w-10 h-10 rounded-full object-cover border-2 border-slate-500">`
            : `<div class="w-10 h-10 rounded-full bg-slate-400 flex items-center justify-center text-xl">👤</div>`;
            
        html += `
            <div class="p-2 rounded-lg border-2 cursor-grab active:cursor-grabbing flex items-center gap-3 ${bgClass}" data-id="${eleve.id}">
                ${photoHtml}
                <div class="flex flex-col leading-tight">
                    <span class="font-black text-slate-900 text-base">${eleve.prenom}</span>
                    <span class="text-xs font-bold text-slate-600 uppercase">${eleve.nom}</span>
                </div>
            </div>
        `;
    }

    reserveContainer.innerHTML = html;
    
    // 🔄 On efface les anciennes affectations car on vient de remplir une nouvelle réserve
    localStorage.removeItem(getStorageKey());
    
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

// ==========================================
// SAUVEGARDE LOCALE DES AFFECTATIONS CO
// ==========================================

function getStorageKey() {
    const activeClasse = document.getElementById('selectClasse').value;
    return `eps_arena_co_assignments_${activeClasse}`;
}

export function saveCOAssignments() {
    const reserveContainer = document.getElementById('reserveList');
    if (!reserveContainer) return;
    
    const assignments = {};
    const postes = document.querySelectorAll('[data-poste]');
    
    postes.forEach(posteDiv => {
        const posteId = posteDiv.dataset.poste;
        const membersDiv = posteDiv.querySelector('.poste-members');
        if (membersDiv) {
            const ids = [];
            membersDiv.querySelectorAll('[data-id]').forEach(el => {
                ids.push(el.dataset.id);
            });
            if (ids.length > 0) {
                assignments[posteId] = ids;
            }
        }
    });

    localStorage.setItem(getStorageKey(), JSON.stringify(assignments));
    console.log("💾 Affectations CO sauvegardées :", assignments);
}

export function loadCOAssignments() {
    const assignments = JSON.parse(localStorage.getItem(getStorageKey()) || '{}');
    const postes = document.querySelectorAll('[data-poste]');
    
    if (Object.keys(assignments).length === 0) return;

    // 🔄 Récupérer la liste complète des élèves de la classe active
    const activeClasse = document.getElementById('selectClasse').value;
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');

    // On parcourt chaque poste
    postes.forEach(async posteDiv => {
        const posteId = posteDiv.dataset.poste;
        const membersDiv = posteDiv.querySelector('.poste-members');
        
        if (membersDiv && assignments[posteId]) {
            // On vide le poste avant de le remplir (évite les doublons)
            membersDiv.innerHTML = '';

            for (const id of assignments[posteId]) {
                const eleve = eleves.find(e => e.id === id);
                if (eleve) {
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
                    membersDiv.appendChild(div);
                }
            }
        }
    });
    
    console.log("📂 Affectations CO chargées :", assignments);
    
    // 🔄 On réinitialise le glisser-déposer pour les nouveaux éléments
    setTimeout(() => initSortableCO(), 100);
}

// ==========================================
// EXPORT / IMPORT DE LA CONFIGURATION CO (JSON)
// ==========================================

// Sauvegarde et téléchargement du fichier JSON
export function exportCOConfig() {
    const activeClasse = document.getElementById('selectClasse').value;
    if (!activeClasse) return alert("Sélectionnez une classe d'abord.");
    
    // Récupération des données d'affectation
    const assignments = JSON.parse(localStorage.getItem(getStorageKey()) || '{}');
    
    // Formatage de la date (YYYYMMDD)
    const date = new Date();
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    
    // Construction de l'objet de sauvegarde
    const data = {
        version: 1,
        classe: activeClasse,
        activite: 'co',
        date: dateStr, // 20260825
        postes: assignments // { A1: [id1, id2], C4: [id3] ... }
    };

    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeClasse}_co_${dateStr}.json`; // Ex: 504_co_20260825.json
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log("💾 Export CO effectué :", data);
}

// Lecture et importation d'un fichier JSON
export function importCOConfig(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.classe || !data.postes) throw new Error("Format de fichier invalide");
            
            // Sauvegarde dans le localStorage de la classe spécifiée
            const storageKey = `eps_arena_co_assignments_${data.classe}`;
            localStorage.setItem(storageKey, JSON.stringify(data.postes));
            
            // Sélection de la classe importée dans l'interface
            const select = document.getElementById('selectClasse');
            if (select.value !== data.classe) {
                select.value = data.classe;
                select.dispatchEvent(new Event('change')); // Déclenche la mise à jour des élèves et du stockage
            }
            
            // Rechargement des affectations dans l'interface CO
            loadCOAssignments();
            alert("✅ Configuration CO importée avec succès !");
        } catch (err) {
            alert("❌ Erreur lors de l'import : " + err.message);
        }
    };
    reader.readAsText(file);
    
    // Réinitialisation de l'input pour permettre une nouvelle sélection
    event.target.value = '';
}