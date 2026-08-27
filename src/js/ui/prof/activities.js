// src/js/ui/prof/activities.js
import { initCOInterface, populateReserveWithStudents, initSortableCO, loadCOAssignments, exportCOConfig, importCOConfig } from '../../modules/co/co-interface.js';
import { renderCircuits, getCircuits, addCircuit as addCircuitCO, editCircuit as editCircuitCO, delCircuit } from '../../modules/co/circuit-manager.js';
import { generateTeams as generateClassicTeams } from '../../modules/teams/team-generator.js';
import { getPhotoUrl } from '../../services/admin-service.js';

let currentDiscipline = 'multi';

export function initActivities() {
    
    // Initialisation de l'interface CO (postes + réserves)
    try {
        initCOInterface();
    } catch (e) {
        console.error("Erreur init CO :", e);
    }

    window.switchDiscipline = function(disc) {
        currentDiscipline = disc;
        console.log("Discipline changée :", disc);

        // Affichage du panneau CO si nécessaire
        const coView = document.getElementById('viewCOSettings');
        if (coView) {
            if (disc === 'co') {
                coView.classList.remove('hidden');
            } else {
                coView.classList.add('hidden');
            }
        }
        
        // Rechargement des affectations CO si on clique sur CO
        if (disc === 'co') {
            try {
                initSortableCO();
                loadCOAssignments();
                const circuitList = document.getElementById('circuitList');
                if (circuitList) renderCircuits('circuitList', "");
            } catch (e) {
                console.error("Erreur lors de l'initialisation CO :", e);
            }
        }
    };

    // Génération des équipes (gère la CO et le Multi)
    window.generateTeams = async function() {
        const activeClasse = document.getElementById('selectClasse').value;
        if (!activeClasse) return alert("Sélectionnez une classe d'abord.");
        const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');
        if (eleves.length === 0) return alert("Aucun élève dans cette classe.");

        // Cas spécial CO : on met les élèves dans la réserve
        if (currentDiscipline === 'co') {
            await populateReserveWithStudents(eleves);
            alert("Tous les élèves sont dans la réserve CO. Glissez-les dans les postes !");
            return;
        }

        // Cas Multi-activités : génération classique
        const options = {
            mode: document.getElementById('modeRepartition')?.value || 'melange',
            mixite: document.getElementById('modeMixite')?.value || 'ignore',
            critere: document.getElementById('critereForce')?.value || 'vma',
            formatLibelle: document.getElementById('formatLibelle')?.value || 'Couleurs',
            nbEquipes: parseInt(document.getElementById('nbEquipes')?.value) || 0,
            nbParEquipe: parseInt(document.getElementById('nbParEquipe')?.value) || 0,
            couleurs: Array.from(document.querySelectorAll('#paletteCouleurs .border-emerald-400')).map(el => el.dataset.couleur),
        };
        if (!options.nbEquipes && options.nbParEquipe) options.nbEquipes = Math.ceil(eleves.length / options.nbParEquipe);
        else if (options.nbEquipes && !options.nbParEquipe) options.nbParEquipe = Math.ceil(eleves.length / options.nbEquipes);

        const teams = generateClassicTeams(eleves, options);
        const container = document.getElementById('teamsGrid');
        if (container) {
            container.innerHTML = teams.map(team => `
                <div class="bg-slate-900 rounded-2xl p-4 border-2" style="border-color: ${team.color}">
                    <div class="flex justify-between items-center mb-3">
                        <h3 class="font-black text-xl" style="color: ${team.color}">${team.label}</h3>
                    </div>
                    <div class="team-members flex flex-col gap-2">
                        ${team.members.map(m => `<div class="bg-slate-800 p-2 rounded-lg text-sm font-bold text-white" data-id="${m.id}">${m.prenom} ${m.nom}</div>`).join('')}
                    </div>
                </div>
            `).join('');
        }
    };

    // Fonctions CO (boutons HTML)
    window.addCircuit = function() {
        const cat = prompt("Catégorie (ex: Forêt, Étoiles) :");
        if(!cat) return;
        const nom = prompt("Nom du circuit (ex: 1, Rouge) :");
        if(!nom) return;
        const b = prompt("Liste des balises (ex: 31, 34*, 42) :");
        if(b) {
            addCircuitCO(cat, nom, b);
            renderCircuits('circuitList', "");
        }
    };
    
    window.editCircuit = function(id) {
        const circ = getCircuits().find(c => c.id === id);
        const n = prompt("Modifier les balises :", circ.balises.join(', '));
        if(n !== null) {
            editCircuitCO(id, n);
            renderCircuits('circuitList', "");
        }
    };

    window.delCircuit = function(id) {
        if(confirm("Supprimer ce circuit ?")) {
            delCircuit(id);
            renderCircuits('circuitList', "");
        }
    };

    // Export / Import CO
    window.exportCOConfig = exportCOConfig;
    window.importCOConfig = importCOConfig;

    // Initialisation au chargement
    try {
        initSortableCO();
    } catch (e) {
        console.error("Erreur init Sortable CO :", e);
    }
}