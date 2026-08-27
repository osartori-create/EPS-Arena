import { initCOInterface, populateReserveWithStudents, initSortableCO, loadCOAssignments, exportCOConfig, importCOConfig } from '../../modules/co/co-interface.js';
import { initEscaladeInterface, populateReserveEscalade, initSortableEscalade, loadEscaladeAssignments, exportEscaladeConfig, importEscaladeConfig } from '../../modules/escalade/escalade-interface.js';
import { renderCircuits, getCircuits, addCircuit as addCircuitCO, editCircuit as editCircuitCO, delCircuit } from '../../modules/co/circuit-manager.js';
import { generateTeams as generateClassicTeams } from '../../modules/teams/team-generator.js';
import { getPhotoUrl } from '../../services/admin-service.js';
import { db, ref, set, remove } from '../../core/firebase-service.js';
import { initOSInterface, initSortableOS } from '../../modules/orientshow/os-interface.js';

let currentDiscipline = 'multi';

// ✅ Fonction locale pour construire le chemin hiérarchique
function getBaseProf() {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    return `etablissements/0680013V/profs/${profCode}`;
}

export function initActivities() {
    try { initCOInterface(); } catch (e) {}
    try { initEscaladeInterface(6); } catch (e) {}
    try { initOSInterface(); } catch (e) {}

    window.switchDiscipline = function(disc) {
        currentDiscipline = disc;

        const multiView = document.getElementById('viewMultiSettings');
        const coView = document.getElementById('viewCOSettings');
        const osView = document.getElementById('viewOrientShowSettings');
        const escView = document.getElementById('viewEscaladeSettings');
        if (multiView) multiView.classList.toggle('hidden', disc !== 'multi');
        if (coView) coView.classList.toggle('hidden', disc !== 'co');
        if (osView) osView.classList.toggle('hidden', disc !== 'orientshow');
        if (escView) escView.classList.toggle('hidden', disc !== 'escalade');

        const btnMulti = document.getElementById('btnDisc-multi');
        const btnCo = document.getElementById('btnDisc-co');
        const btnOs = document.getElementById('btnDisc-orientshow');
        const btnEsc = document.getElementById('btnDisc-escalade');
        
        if (btnMulti) btnMulti.classList.toggle('border-blue-500', disc === 'multi');
        if (btnCo) btnCo.classList.toggle('border-blue-500', disc === 'co');
        if (btnOs) btnOs.classList.toggle('border-blue-500', disc === 'orientshow');
        if (btnEsc) btnEsc.classList.toggle('border-blue-500', disc === 'escalade');

        if (disc === 'co') {
            try { initSortableCO(); loadCOAssignments(); renderCircuits('circuitList', ""); } catch (e) {}
        }
        if (disc === 'escalade') {
            try {
                initEscaladeInterface(); // Va lire la sauvegarde OU le nombre d'élèves
                initSortableEscalade();
                loadEscaladeAssignments();
            } catch (e) {}
        }

        if (disc === 'orientshow') {
            try { initSortableOS(); } catch (e) {}
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

    // ✅ TRANSMISSION (chemins hiérarchiques)
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
                    localMapping[`${activeClasse}_${lettre}`] = configData[lettre];
                    configData[lettre] = configData[lettre].length;
                }
            });
        } else if (currentDiscipline === 'escalade') {
            configData = JSON.parse(localStorage.getItem(`eps_arena_escalade_assignments_${activeClasse}`) || '{}');
            configData.activite = 'escalade';
            Object.keys(configData).forEach(lettre => {
                if (lettre !== 'activite' && Array.isArray(configData[lettre])) {
                    localMapping[`${activeClasse}_${lettre}`] = configData[lettre];
                    configData[lettre] = configData[lettre].length;
                }
            });
        } else if (currentDiscipline === 'orientshow') {
            // 1. Récupération des affectations (sauvegardées par ta future UI Prof)
            const osAssignments = JSON.parse(localStorage.getItem(`eps_arena_os_assignments_${activeClasse}`) || '{}');
            configData.activite = 'orientshow';
            
            // 2. Création du mapping RGPD plat et comptage
            Object.keys(osAssignments).forEach(couleur => {
                if (Array.isArray(osAssignments[couleur])) {
                    // On compte le nombre d'élèves pour cette couleur (ex: ROUGE: 5)
                    configData[couleur] = osAssignments[couleur].length; 
                    
                    // On associe l'ID de l'élève à son code (ex: "504_ROUGE_1": "ID_ELEVE")
                    osAssignments[couleur].forEach((eleveId, index) => {
                        const code = `${couleur}_${index + 1}`; 
                        localMapping[`${activeClasse}_${code}`] = eleveId;
                    });
                }
            });
            // 3. Ajout de la matrice de contrôle (les lettres) pour Firebase
            const osMatrix = JSON.parse(localStorage.getItem('eps_arena_os_matrix') || '{}');
            configData.matrice = osMatrix;
            
        } else {
            configData.activite = 'multi';
            if (window.lastTeams) {
                const lettres = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
                window.lastTeams.forEach((team, index) => {
                    const lettre = lettres[index] || `EQ${index+1}`;
                    localMapping[`${activeClasse}_${lettre}`] = team.members.map(m => m.id);
                    configData[lettre] = team.members.length;
                });
            } else {
                return alert("Veuillez d'abord générer les équipes.");
            }
        }
        localStorage.setItem(`eps_arena_local_mapping_${activeClasse}`, JSON.stringify(localMapping));

        const baseProf = getBaseProf();
        try {
            await set(ref(db, `${baseProf}/${activeClasse}/config`), configData);
            await set(ref(db, `${baseProf}/active_classes/${activeClasse}`), true);
            alert("✅ Configuration transmise aux iPads !");
        } catch (e) { console.error("Erreur transmission :", e); alert("Erreur lors de la transmission."); }
    };

    // ✅ PURGE (corrigée avec le bon chemin hiérarchique)
    window.openPurgeModal = function() {
        const choix = prompt("Purge Firebase\n1- Purger la classe active\n2- Purger TOUTE la base (code RNE)");
        const baseProf = getBaseProf();

        if (choix === "1") {
            const activeClasse = document.getElementById('selectClasse').value;
            if (activeClasse && confirm("Supprimer toutes les données de la classe " + activeClasse + " ?")) {
                remove(ref(db, `${baseProf}/${activeClasse}`))
                    .then(() => location.reload())
                    .catch(err => alert("Erreur purge : " + err.message));
            }
        } else if (choix === "2") {
            const code = prompt("Code RNE :");
            if (code === "0680013V" && confirm("Supprimer TOUTE la base ?")) {
                remove(ref(db))
                    .then(() => location.reload())
                    .catch(err => alert("Erreur purge : " + err.message));
            }
        }
    };

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
        if(n !== null) { editCircuitCO(id, n); renderCircuits('circuitList', ""); }
    };
    window.delCircuit = function(id) {
        if(confirm("Supprimer ce circuit ?")) { delCircuit(id); renderCircuits('circuitList', ""); }
    };

    window.exportCOConfig = exportCOConfig;
    window.importCOConfig = importCOConfig;
    window.exportEscaladeConfig = exportEscaladeConfig;
    window.importEscaladeConfig = importEscaladeConfig;

    try { initSortableCO(); } catch (e) {}
    try { initSortableEscalade(); } catch (e) {}
}