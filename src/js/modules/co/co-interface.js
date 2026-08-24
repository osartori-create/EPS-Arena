// src/js/modules/co/co-interface.js
import { MATRICE } from './matrice.js';

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

// On force l'initialisation du glisser-déposer, mais on s'assure de ne pas effacer le contenu
export function initSortableCO() {
    const reserveContainer = document.getElementById('reserveList');
    if (!reserveContainer) return;

    // Si déjà initialisé, on ne fait rien (pour ne pas effacer le HTML)
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

export function populateReserveWithStudents(eleves) {
    const reserveContainer = document.getElementById('reserveList');
    if (!reserveContainer) {
        alert("❌ ERREUR : La div 'reserveList' est introuvable. Vérifiez le HTML !");
        return;
    }

    // 🛠️ CORRECTIF MAJEUR : On force l'affichage du panneau CO !
    const coView = document.getElementById('viewCOSettings');
    if (coView) {
        coView.classList.remove('hidden');
        console.log("✅ Panneau CO forcé visible !");
    }

    // Construction du HTML
    let html = '';
    eleves.forEach(eleve => {
        html += `
            <div class="bg-slate-800 p-2 rounded-lg border border-slate-600 cursor-grab active:cursor-grabbing flex items-center gap-2" data-id="${eleve.id}">
                <span class="font-bold text-white text-sm">${eleve.prenom} ${eleve.nom}</span>
                <span class="text-xs text-slate-400 ml-auto">${eleve.vma ? 'VMA: ' + eleve.vma : ''}</span>
            </div>
        `;
    });

    // Injection du HTML
    reserveContainer.innerHTML = html;
    console.log("✅ Réserve remplie !");
    console.log("📋 Nombre de caractères injectés :", html.length);

    // 🛠️ CORRECTIF MAJEUR : On initialise Sortable APRÈS un délai pour éviter qu'il efface le contenu
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