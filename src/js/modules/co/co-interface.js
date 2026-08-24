// src/js/modules/co/co-interface.js
import { MATRICE } from './matrice.js';

let reserveContainer = null;
let postesContainer = null;

export function initCOInterface() {
    reserveContainer = document.getElementById('reserveList');
    postesContainer = document.getElementById('postesGrid');

    if (!reserveContainer || !postesContainer) return;
    generatePostesGrid();
    initSortableCO();
}

function generatePostesGrid() {
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

function initSortableCO() {
    if (!reserveContainer) return;
    
    // La réserve accepte les élèves individuels
    new Sortable(reserveContainer, {
        group: 'co-groupes',
        animation: 150,
    });

    // Chaque poste accepte les élèves
    document.querySelectorAll('.poste-members').forEach(el => {
        new Sortable(el, {
            group: 'co-groupes',
            animation: 150,
            onAdd: function(evt) {
                const posteId = el.closest('[data-poste]').dataset.poste;
                console.log('Élève assigné au poste : ' + posteId);
            }
        });
    });
}

// Remplir la réserve avec des ÉLÈVES INDIVIDUELS (pour la CO)
export function populateReserveWithStudents(eleves) {
    if (!reserveContainer) return;
    
    let html = '';
    eleves.forEach(eleve => {
        // On crée une carte individuelle avec le nom et la photo si possible
        html += `
            <div class="bg-slate-800 p-2 rounded-lg border border-slate-600 cursor-grab active:cursor-grabbing flex items-center gap-2" data-id="${eleve.id}">
                <span class="font-bold text-white text-sm">${eleve.prenom} ${eleve.nom}</span>
                <span class="text-xs text-slate-400 ml-auto">(${eleve.vma ? 'VMA: ' + eleve.vma : ''})</span>
            </div>
        `;
    });
    
    reserveContainer.innerHTML = html;
}

// (Ancienne fonction pour les équipes, on la garde pour le Sprint)
export function populateReserve(teams) {
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
}