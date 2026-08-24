// src/js/modules/co/co-interface.js
import { MATRICE } from './matrice.js';

let reserveContainer = null;
let postesContainer = null;

// Initialise l'interface CO
export function initCOInterface() {
    reserveContainer = document.getElementById('reserveList');
    postesContainer = document.getElementById('postesGrid');

    if (!reserveContainer || !postesContainer) return;

    // Générer la grille de postes (A1 à F6)
    generatePostesGrid();
    
    // Initialiser Sortable pour le glisser-déposer
    initSortableCO();
}

// Génère la grille des postes basée sur la matrice (A1, A2... F6)
function generatePostesGrid() {
    if (!postesContainer) return;
    
    // On prend les colonnes de la ligne 31 (les en-têtes A1, A2, etc.)
    const headers = Object.keys(MATRICE['31'] || {});
    
    let html = '';
    headers.forEach(poste => {
        html += `
            <div class="bg-slate-900 border-2 border-slate-600 p-4 rounded-2xl min-h-[80px] flex flex-col items-center justify-center" data-poste="${poste}" id="poste-${poste}">
                <h4 class="font-black text-yellow-400 text-xl mb-2">${poste}</h4>
                <div class="poste-members w-full flex flex-col gap-2 min-h-[40px]">
                    <!-- Les groupes glissés ici apparaîtront ici -->
                </div>
            </div>
        `;
    });
    
    postesContainer.innerHTML = html;
}

// Initialise le glisser-déposer entre la réserve et les postes
function initSortableCO() {
    if (!reserveContainer) return;

    // Initialiser la réserve comme zone de départ
    new Sortable(reserveContainer, {
        group: 'co-groupes',
        animation: 150,
    });

    // Initialiser chaque poste comme zone de réception
    document.querySelectorAll('.poste-members').forEach(el => {
        new Sortable(el, {
            group: 'co-groupes',
            animation: 150,
            onAdd: function(evt) {
                // Quand un groupe est déposé sur un poste
                const posteId = el.closest('[data-poste]').dataset.poste;
                console.log('Groupe assigné au poste : ' + posteId);
            }
        });
    });
}

// Fonction pour remplir la réserve avec les équipes générées
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