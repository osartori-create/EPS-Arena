// src/js/modules/co/co-interface.js
import { MATRICE } from './matrice.js';

export function initCOInterface() {
    console.log("🔍 Initialisation de l'interface CO...");
    const reserveContainer = document.getElementById('reserveList');
    const postesContainer = document.getElementById('postesGrid');

    if (!reserveContainer || !postesContainer) {
        console.error("❌ Impossible de trouver #reserveList ou #postesGrid ! Vérifiez le HTML.");
        return;
    }

    generatePostesGrid();
    initSortableCO();
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

function initSortableCO() {
    const reserveContainer = document.getElementById('reserveList');
    if (!reserveContainer) return;

    // On détruit les anciennes instances pour éviter les conflits
    if (window.sortableCOInstances) {
        window.sortableCOInstances.forEach(s => s.destroy());
    }
    window.sortableCOInstances = [];

    // Vérification de visibilité (pour éviter le crash de Sortable)
    if (reserveContainer.offsetParent === null) {
        console.warn("⚠️ La réserve est masquée, SortableJS ne s'initialisera pas tout de suite.");
    }

    try {
        const sortableReserve = new Sortable(reserveContainer, {
            group: 'co-groupes',
            animation: 150,
        });
        window.sortableCOInstances.push(sortableReserve);

        document.querySelectorAll('.poste-members').forEach(el => {
            const sortablePoste = new Sortable(el, {
                group: 'co-groupes',
                animation: 150,
                onAdd: function(evt) {
                    const posteId = el.closest('[data-poste]').dataset.poste;
                    console.log('Élève assigné au poste : ' + posteId);
                }
            });
            window.sortableCOInstances.push(sortablePoste);
        });
    } catch (e) {
        console.error("Erreur Sortable :", e);
    }
}

export function populateReserveWithStudents(eleves) {
    const reserveContainer = document.getElementById('reserveList');
    console.log("🔍 Div trouvée :", reserveContainer);
    
    if (!reserveContainer) {
        console.error("❌ Impossible de trouver #reserveList !");
        return;
    }
    
    let html = '';
    eleves.forEach(eleve => {
        html += `
            <div class="bg-slate-800 p-2 rounded-lg border border-slate-600 cursor-grab active:cursor-grabbing flex items-center gap-2" data-id="${eleve.id}">
                <span class="font-bold text-white text-sm">${eleve.prenom} ${eleve.nom}</span>
                <span class="text-xs text-slate-400 ml-auto">${eleve.vma ? 'VMA: ' + eleve.vma : ''}</span>
            </div>
        `;
    });
    
    console.log("🔍 HTML généré :", html.substring(0, 200) + "...");
    reserveContainer.innerHTML = html;
    console.log("✅ Réserve remplie !");

    // 🛠️ CORRECTION IMPORTANTE : On laisse le DOM se stabiliser avant d'initialiser Sortable
    setTimeout(() => {
        initSortableCO();
        console.log("✅ Sortable réinitialisé !");
    }, 100);
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
    
    setTimeout(() => {
        initSortableCO();
    }, 100);
}