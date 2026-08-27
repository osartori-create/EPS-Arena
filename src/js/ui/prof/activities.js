// src/js/ui/prof/activities.js
import { generateTeams as generateClassicTeams } from '../../modules/teams/team-generator.js';
import { getPhotoUrl } from '../../services/admin-service.js';

let currentDiscipline = 'multi';

export function initActivities() {
    // Fonction simple pour changer de discipline (sans dépendances)
    window.switchDiscipline = function(disc) {
        currentDiscipline = disc;
        console.log("Discipline changée :", disc);
    };

    // Génération d'équipes simple (Multi)
    window.generateTeams = async function() {
        const activeClasse = document.getElementById('selectClasse').value;
        if (!activeClasse) return alert("Sélectionnez une classe d'abord.");
        const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');
        if (eleves.length === 0) return alert("Aucun élève dans cette classe.");

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
}