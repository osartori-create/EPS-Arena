// src/js/ui/prof/activities.js
import { initCOInterface, populateReserveWithStudents, initSortableCO, loadCOAssignments, exportCOConfig, importCOConfig } from '../../modules/co/co-interface.js';
import { initEscaladeInterface, populateReserveEscalade, initSortableEscalade, loadEscaladeAssignments, exportEscaladeConfig, importEscaladeConfig } from '../../modules/escalade/escalade-interface.js';
import { renderCircuits, getCircuits, addCircuit as addCircuitCO, editCircuit as editCircuitCO, delCircuit } from '../../modules/co/circuit-manager.js';
import { generateTeams as generateClassicTeams } from '../../modules/teams/team-generator.js';
import { getPhotoUrl } from '../../services/admin-service.js';
import { db, ref, set, remove } from '../../core/firebase-service.js';
import { 
    initOrientShowInterface,
    loadOrientShowAssignments,
    exportOrientShowConfig,
    importOrientShowConfig,
    startOrientShow,
    stopOrientShow
} from '../../modules/orientshow/orientshow-interface.js';

let currentDiscipline = 'multi';

// Fonction locale pour construire le chemin hiérarchique
function getBaseProf() {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    return `etablissements/0680013V/profs/${profCode}`;
}

export function initActivities() {
    try { initCOInterface(); } catch (e) {}
    try { initEscaladeInterface(6); } catch (e) {}
    try { initOrientShowInterface(); } catch (e) {}

    window.switchDiscipline = function(disc) {
        currentDiscipline = disc;
        localStorage.setItem('eps_arena_current_discipline', disc);

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
                initEscaladeInterface();
                initSortableEscalade();
                loadEscaladeAssignments();
            } catch (e) {}
        }
        if (disc === 'orientshow') {
            try {
                setTimeout(() => {
                    initOrientShowInterface();
                    loadOrientShowAssignments();
                }, 100);
            } catch (e) {}
        }
    };

        window.generateTeams = async function()

    window.transmettreConfig = async function() {
        const activeClasse = document.getElementById('selectClasse').value;
        if (!activeClasse) return alert("Sélectionnez une classe.");

        const baseProf = getBaseProf();
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
        } 
        else if (currentDiscipline === 'escalade') {
            configData = JSON.parse(localStorage.getItem(`eps_arena_escalade_assignments_${activeClasse}`) || '{}');
            configData.activite = 'escalade';
            Object.keys(configData).forEach(lettre => {
                if (lettre !== 'activite' && Array.isArray(configData[lettre])) {
                    localMapping[`${activeClasse}_${lettre}`] = configData[lettre];
                    configData[lettre] = configData[lettre].length;
                }
            });
        } 
        else if (currentDiscipline === 'orientshow') {
            // Codes par défaut pour la matrice (intégrés en dur)
            const DEFAULT_OS_MATRIX = {
                1: { NOIR: ['D','Q'], ROUGE: ['O','U'], BLEU: ['Y','A'], VERT: ['E','R'], JAUNE: ['N','K'] },
                2: { NOIR: ['E','X'], ROUGE: ['X','Y'], BLEU: ['T','L'], VERT: ['R','O'], JAUNE: ['A','L'] },
                3: { NOIR: ['C','L'], ROUGE: ['H','U'], BLEU: ['I','B'], VERT: ['O','I'], JAUNE: ['T','E'] },
                4: { NOIR: ['R','V'], ROUGE: ['E','E'], BLEU: ['C','R'], VERT: ['T','N'], JAUNE: ['O','I'] },
                5: { NOIR: ['A','B'], ROUGE: ['J','O'], BLEU: ['O','U'], VERT: ['N','E'], JAUNE: ['C','S'] },
                6: { NOIR: ['F','M'], ROUGE: ['I','E'], BLEU: ['C','R'], VERT: ['U','O'], JAUNE: ['S','U'] },
                7: { NOIR: ['G','H'], ROUGE: ['U','A'], BLEU: ['E','C'], VERT: ['U','H'], JAUNE: ['X','E'] },
                8: { NOIR: ['I','J'], ROUGE: ['V','E'], BLEU: ['R','A'], VERT: ['E','N'], JAUNE: ['S','S'] },
                9: { NOIR: ['K','N'], ROUGE: ['R','Y'], BLEU: ['A','L'], VERT: ['F','O'], JAUNE: ['T','N'] },
                10: { NOIR: ['O','S'], ROUGE: ['C','E'], BLEU: ['E','I'], VERT: ['A','Z'], JAUNE: ['N','E'] },
                11: { NOIR: ['P','T'], ROUGE: ['A','U'], BLEU: ['L','Y'], VERT: ['U','A'], JAUNE: ['D','U'] },
                12: { NOIR: ['U','W'], ROUGE: ['L','I'], BLEU: ['T','N'], VERT: ['R','C'], JAUNE: ['A','H'] }
            };

            const orientShowMapping = JSON.parse(localStorage.getItem(`eps_arena_local_mapping_${activeClasse}`) || '{}');
            const codeCounts = {};
            Object.keys(orientShowMapping).forEach(key => {
                if (key.startsWith(activeClasse + '_')) {
                    const code = key.replace(activeClasse + '_', '');
                    const match = code.match(/^([A-Z]+)_(\d+)$/);
                    if (match) {
                        const couleur = match[1];
                        codeCounts[couleur] = Math.max(codeCounts[couleur] || 0, parseInt(match[2], 10));
                    }
                }
            });
            configData = { activite: 'orientshow' };
            Object.keys(codeCounts).forEach(couleur => {
                configData[couleur] = codeCounts[couleur];
            });
            
            // Utiliser la matrice en dur (garantie complète)
            configData.matrix = DEFAULT_OS_MATRIX;
            
            // Récupération des temps (version robuste)
            const startTimeStr = localStorage.getItem('eps_arena_os_startTime');
            const endTimeStr = localStorage.getItem('eps_arena_os_endTime');
            const parseTime = (value) => {
                if (!value || value === 'null' || value === 'undefined') return null;
                const parsed = parseInt(value);
                if (isNaN(parsed)) return null;
                return parsed;
            };
            const startTime = parseTime(startTimeStr);
            const endTime = parseTime(endTimeStr);
            if (startTime !== null) configData.startTime = startTime;
            if (endTime !== null) configData.endTime = endTime;
        } 
        else {
            // Multi-activités (par défaut)
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

        // Sauvegarde du mapping local
        localStorage.setItem(`eps_arena_local_mapping_${activeClasse}`, JSON.stringify(localMapping));

        // Envoi à Firebase
        try {
            console.log("📡 Configuration envoyée :", configData);
            await set(ref(db, `${baseProf}/${activeClasse}/config`), configData);
            await set(ref(db, `${baseProf}/active_classes/${activeClasse}`), true);
            alert("✅ Configuration transmise aux iPads !");
        } catch (e) {
            console.error("Erreur transmission :", e);
            alert("Erreur lors de la transmission.\nVérifie la console (F12) pour plus de détails.");
        }
    };

    window.openPurgeModal = function() {
    const choix = prompt("Purge Firebase\n1- Purger la classe active (sauf OrientShow)\n2- Purger TOUTE la base (code RNE)");
    const baseProf = getBaseProf();

    if (choix === "1") {
        const activeClasse = document.getElementById('selectClasse').value;
        if (activeClasse && confirm("Supprimer toutes les données de la classe " + activeClasse + " (sauf la matrice OrientShow) ?")) {
            // Supprimer la classe en préservant le chemin orientshow/config
            const classePath = `${baseProf}/${activeClasse}`;
            // On pourrait ici faire un update pour supprimer tous les champs sauf orientshow/config
            // Mais pour simplifier, on peut sauvegarder la matrice avant la purge
            const matrixBackup = JSON.parse(localStorage.getItem('eps_arena_os_matrix') || '{}');
            remove(ref(db, classePath))
                .then(() => {
                    // Restaurer la matrice sauvegardée
                    if (Object.keys(matrixBackup).length > 0) {
                        const configData = {
                            activite: 'orientshow',
                            matrix: matrixBackup,
                            nbCircuits: 12,
                            nbCouleurs: 5
                        };
                        set(ref(db, `${classePath}/orientshow/config`), configData);
                    }
                    location.reload();
                })
                .catch(err => alert("Erreur purge : " + err.message));
        }
    } else if (choix === "2") {
        const code = prompt("Code RNE :");
        if (code === "0680013V" && confirm("Supprimer TOUTE la base ?")) {
            // Avant de purger, exporter la matrice dans localStorage
            const allMatrices = {};
            // Ici, on pourrait parcourir toutes les classes pour sauvegarder leurs matrices
            // Mais c'est plus complexe. L'export manuel reste la meilleure solution.
            remove(ref(db))
                .then(() => location.reload())
                .catch(err => alert("Erreur purge : " + err.message));
        }
    }
};

    // CO specific
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

    // Exports globaux
    window.exportCOConfig = exportCOConfig;
    window.importCOConfig = importCOConfig;
    window.exportEscaladeConfig = exportEscaladeConfig;
    window.importEscaladeConfig = importEscaladeConfig;
    window.exportOrientShowConfig = exportOrientShowConfig;
    window.importOrientShowConfig = importOrientShowConfig;
    window.startOrientShow = startOrientShow;
    window.stopOrientShow = stopOrientShow;

    try { initSortableCO(); } catch (e) {}
    try { initSortableEscalade(); } catch (e) {}
}