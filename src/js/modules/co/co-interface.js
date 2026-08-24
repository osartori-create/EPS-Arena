// src/js/modules/co/co-interface.js
import { MATRICE } from './matrice.js';
import { getPhotoUrl } from '../../services/admin-service.js'; // Import pour les photos

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
        });
        reserveContainer.__sortable = true;

        document.querySelectorAll('.poste-members').forEach(el => {
            if (!el.__sortable) {
                new Sortable(el, {
                    group: 'co-groupes',
                    animation: 150,
                    onAdd: function(evt) {
                        const posteId = el.closest('[data-poste]').dataset.poste;
                        console.log('Élève assigné au poste : ' + posteId);
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

    // Forcer l'affichage du panneau CO
    const coView = document.getElementById('viewCOSettings');
    if (coView) coView.classList.remove('hidden');

    let html = '';
    for (const eleve of eleves) {
        const url = await getPhotoUrl(eleve.id);
        
        // Définition du style de fond selon le sexe
        let bgClass = 'bg-slate-200 border-slate-400'; // Couleur neutre par défaut
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
    console.log("✅ Réserve remplie avec photos et couleurs !");

    // Réinitialiser le tri après insertion
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