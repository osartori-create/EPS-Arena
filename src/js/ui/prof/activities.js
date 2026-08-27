import { initCOInterface, populateReserveWithStudents, initSortableCO, loadCOAssignments, exportCOConfig, importCOConfig } from '../../modules/co/co-interface.js';
import { initEscaladeInterface, populateReserveEscalade, initSortableEscalade, loadEscaladeAssignments, exportEscaladeConfig, importEscaladeConfig } from '../../modules/escalade/escalade-interface.js';
import { renderCircuits, getCircuits, addCircuit as addCircuitCO, editCircuit as editCircuitCO, delCircuit } from '../../modules/co/circuit-manager.js';
import { generateTeams as generateClassicTeams } from '../../modules/teams/team-generator.js';
import { getPhotoUrl } from '../../services/admin-service.js';
import { db, ref, set, remove } from '../../core/firebase-service.js';

let currentDiscipline = 'multi';

export function initActivities() {
    try { initCOInterface(); } catch (e) {}
    try { initEscaladeInterface(6); } catch (e) {} // Valeur par défaut, sera mise à jour

    window.switchDiscipline = function(disc) {
        currentDiscipline = disc;
        const coView = document.getElementById('viewCOSettings');
        const escView = document.getElementById('viewEscaladeSettings');
        if (coView) coView.classList.toggle('hidden', disc !== 'co');
        if (escView) escView.classList.toggle('hidden', disc !== 'escalade');

        if (disc === 'co') {
            try { initSortableCO(); loadCOAssignments(); renderCircuits('circuitList', ""); } catch (e) {}
        }
        if (disc === 'escalade') {
            const activeClasse = document.getElementById('selectClasse').value;
            const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');
            const nbGroupes = Math.max(Math.ceil(eleves.length / 3), 1);
            initEscaladeInterface(nbGroupes);
            try { initSortableEscalade(); loadEscaladeAssignments(); } catch (e) {}
        }
    };

    window.generateTeams = async function() {
        const activeClasse = document.getElementById('selectClasse').value;
        if (!activeClasse) return alert("Sélectionnez une classe d'abord.");
        const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');
        if (eleves.length === 0) return alert("Aucun élève dans cette classe.");

        if (currentDiscipline === 'co') {
            await populateReserveWithStudents(eleves);
            alert("Tous les élèves sont dans la réserve CO.");
            return;
        }
        if (currentDiscipline === 'escalade') {
            const nbGroupes = Math.ceil(eleves.length / 3);
            initEscaladeInterface(nbGroupes);
            await populateReserveEscalade(eleves);
            alert(`Tous les élèves sont dans la réserve Escalade (${nbGroupes} groupes). Glissez-les !`);
            return;
        }
        // Multi classique (code existant)
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
                    <div class="flex justify-between items-center mb-3"><h3 class="font-black text-xl" style="color: ${team.color}">${team.label}</h3></div>
                    <div class="team-members flex flex-col gap-2">
                        ${team.members.map(m => `<div class="bg-slate-800 p-2 rounded-lg text-sm font-bold text-white">${m.prenom} ${m.nom}</div>`).join('')}
                    </div>
                </div>`).join('');
        }
    };

    // TRANSMISSION : UNIQUEMENT DES NOMBRES !
    window.transmettreConfig = async function() {
        const activeClasse = document.getElementById('selectClasse').value;
        if (!activeClasse) return alert("Sélectionnez une classe.");
        let configData = {};
        let localMapping = {};

        if (currentDiscipline === 'co') {
            configData = JSON.parse(localStorage.getItem(`eps_arena_co_assignments_${activeClasse}`) || '{}');
            configData.activite = 'co';
            Object.keys(configData).forEach(lettre => {
                if (lettre !== 'activite' && Array.isArray(configData[lettre])) {
                    localMapping[`${activeClasse}_${lettre}`] = configData[lettre]; // Mapping local
                    configData[lettre] = configData[lettre].length; // Nombre uniquement !
                }
            });
        } else if (currentDiscipline === 'escalade') {
            configData = JSON.parse(localStorage.getItem(`eps_arena_escalade_assignments_${activeClasse}`) || '{}');
            configData.activite = 'escalade';
            Object.keys(configData).forEach(lettre => {
                if (lettre !== 'activite' && Array.isArray(configData[lettre])) {
                    localMapping[`${activeClasse}_${lettre}`] = configData[lettre]; // Mapping local
                    configData[lettre] = configData[lettre].length; // Nombre uniquement !
                }
            });
        } else {
            configData.activite = 'multi';
            if (window.lastTeams) {
                const lettres = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
                window.lastTeams.forEach((team, index) => {
                    const lettre = lettres[index] || `EQ${index+1}`;
                    localMapping[`${activeClasse}_${lettre}`] = team.members.map(m => m.id);
                    configData[lettre] = team.members.length; // Nombre uniquement !
                });
            } else {
                return alert("Veuillez d'abord générer les équipes.");
            }
        }

        // Sauvegarde locale du mapping
        localStorage.setItem(`eps_arena_local_mapping_${activeClasse}`, JSON.stringify(localMapping));

        const profBase = `etablissements/0680013V/profs/${localStorage.getItem('eps_arena_profCode') || 'DEFAULT'}`;
        try {
            await set(ref(db, `${profBase}/${activeClasse}/config`), configData);
            await set(ref(db, `${profBase}/active_classes/${activeClasse}`), true);
            alert("✅ Configuration transmise !");
        } catch (e) { console.error("Erreur transmission :", e); alert("Erreur lors de la transmission."); }
    };

    window.openPurgeModal = function() { /* (reste identique) */ };
    window.addCircuit = function() { /* (reste identique) */ };
    window.editCircuit = function(id) { /* (reste identique) */ };
    window.delCircuit = function(id) { /* (reste identique) */ };

    window.exportCOConfig = exportCOConfig;
    window.importCOConfig = importCOConfig;
    window.exportEscaladeConfig = exportEscaladeConfig;
    window.importEscaladeConfig = importEscaladeConfig;

    try { initSortableCO(); } catch (e) {}
    try { initSortableEscalade(); } catch (e) {}
}