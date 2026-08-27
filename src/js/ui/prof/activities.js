import { initCOInterface, populateReserveWithStudents, initSortableCO, loadCOAssignments, exportCOConfig, importCOConfig } from '../../modules/co/co-interface.js';
import { initEscaladeInterface, populateReserveEscalade, initSortableEscalade, loadEscaladeAssignments, exportEscaladeConfig, importEscaladeConfig } from '../../modules/escalade/escalade-interface.js';
import { renderCircuits, getCircuits, addCircuit as addCircuitCO, editCircuit as editCircuitCO, delCircuit } from '../../modules/co/circuit-manager.js';
import { generateTeams as generateClassicTeams } from '../../modules/teams/team-generator.js';
import { getPhotoUrl } from '../../services/admin-service.js';
import { db, ref, set, remove } from '../../core/firebase-service.js';

let currentDiscipline = 'multi';

export function initActivities() {
    try { initCOInterface(); } catch (e) { console.error("Erreur init CO :", e); }
    try { initEscaladeInterface(); } catch (e) { console.error("Erreur init Escalade :", e); }

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
                    configData[lettre].forEach((id, idx) => { localMapping[`${activeClasse}_${lettre}${idx+1}`] = id; });
                }
            });
        } else if (currentDiscipline === 'escalade') {
            configData = JSON.parse(localStorage.getItem(`eps_arena_escalade_assignments_${activeClasse}`) || '{}');
            configData.activite = 'escalade';
            Object.keys(configData).forEach(lettre => {
                if (lettre !== 'activite' && Array.isArray(configData[lettre])) {
                    configData[lettre].forEach((id, idx) => { localMapping[`${activeClasse}_${lettre}${idx+1}`] = id; });
                }
            });
        } else {
            configData.activite = 'multi';
            if (window.lastTeams) {
                const lettres = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
                window.lastTeams.forEach((team, index) => {
                    const lettre = lettres[index] || `EQ${index+1}`;
                    configData[lettre] = team.members.map(m => m.id);
                    team.members.forEach((m, i) => { localMapping[`${activeClasse}_${lettre}${i+1}`] = m.id; });
                });
            } else {
                return alert("Veuillez d'abord générer les équipes.");
            }
        }

        localStorage.setItem(`eps_arena_local_mapping_${activeClasse}`, JSON.stringify(localMapping));
        try {
            // NOUVELLE STRUCTURE : etablissements/0680013V/profs/{profCode}/{classe}/config
            const profBase = `etablissements/0680013V/profs/${localStorage.getItem('eps_arena_profCode') || 'DEFAULT'}`;
            await set(ref(db, `${profBase}/${activeClasse}/config`), configData);
            await set(ref(db, `etablissements/0680013V/profs/${localStorage.getItem('eps_arena_profCode') || 'DEFAULT'}/active_classes/${activeClasse}`), true);
            alert("✅ Configuration transmise aux iPads !");
        } catch (e) { console.error("Erreur transmission :", e); alert("Erreur lors de la transmission."); }
    };

    window.openPurgeModal = function() {
        const choix = prompt("Purge Firebase\n1- Purger la classe active\n2- Purger TOUTE la base (code RNE)");
        if (choix === "1") {
            const activeClasse = document.getElementById('selectClasse').value;
            const profBase = `etablissements/0680013V/profs/${localStorage.getItem('eps_arena_profCode') || 'DEFAULT'}`;
            if (activeClasse && confirm("Supprimer toutes les données de la classe " + activeClasse + " ?")) {
                remove(ref(db, `${profBase}/${activeClasse}`)).then(() => location.reload()).catch(err => alert("Erreur purge"));
            }
        } else if (choix === "2") {
            const code = prompt("Code RNE :");
            if (code === "0680013V" && confirm("Supprimer TOUTE la base ?")) {
                remove(ref(db)).then(() => location.reload()).catch(err => alert("Erreur purge"));
            }
        }
    };

    window.addCircuit = function() { /* ... */ };
    window.editCircuit = function(id) { /* ... */ };
    window.delCircuit = function(id) { /* ... */ };

    window.exportCOConfig = exportCOConfig;
    window.importCOConfig = importCOConfig;
    window.exportEscaladeConfig = exportEscaladeConfig;
    window.importEscaladeConfig = importEscaladeConfig;

    try { initSortableCO(); } catch (e) {}
    try { initSortableEscalade(); } catch (e) {}
}