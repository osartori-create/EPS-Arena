// src/js/ui/prof/activities.js
import { initCOInterface, populateReserveWithStudents, initSortableCO, loadCOAssignments, exportCOConfig, importCOConfig } from '../../modules/co/co-interface.js';
import { initEscaladeInterface, populateReserveEscalade, initSortableEscalade, loadEscaladeAssignments, exportEscaladeConfig, importEscaladeConfig } from '../../modules/escalade/escalade-interface.js';
import { renderCircuits, getCircuits, addCircuit as addCircuitCO, editCircuit as editCircuitCO, delCircuit } from '../../modules/co/circuit-manager.js';
import { generateTeams as generateClassicTeams } from '../../modules/teams/team-generator.js';
import { getPhotoUrl } from '../../services/admin-service.js';
import { db, ref, set, remove } from '../../core/firebase-service.js';
import { initOrientShowInterface, loadOrientShowAssignments, exportOrientShowConfig, importOrientShowConfig, startOrientShow, stopOrientShow } from '../../modules/orientshow/orientshow-interface.js';
import { initBadmintonInterface, generateBadmintonTeams, loadBadmintonAssignments, initSortableBadminton, saveBadmintonAssignments, updateCodes, exportBadmintonConfig, importBadmintonConfig } from '../../modules/badminton/badminton-interface.js';

let currentDiscipline = 'multi';

function getBaseProf() {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    return `etablissements/0680013V/profs/${profCode}`;
}

export function initActivities() {
    console.log("🚀 initActivities appelée !");
    
    try { console.log("→ Initialisation CO..."); initCOInterface(); console.log("✅ CO OK"); } catch (e) { console.error("❌ Erreur CO :", e); }
    try { console.log("→ Initialisation Escalade..."); initEscaladeInterface(6); console.log("✅ Escalade OK"); } catch (e) { console.error("❌ Erreur Escalade :", e); }
    try { console.log("→ Initialisation Badminton..."); initBadmintonInterface(6); console.log("✅ Badminton OK"); } catch (e) { console.error("❌ Erreur Badminton :", e); }
    try { console.log("→ Initialisation OrientShow..."); initOrientShowInterface(); console.log("✅ OrientShow OK"); } catch (e) { console.error("❌ Erreur OrientShow :", e); }

    window.switchDiscipline = function(disc) {
        currentDiscipline = disc;
        localStorage.setItem('eps_arena_current_discipline', disc);

        // Cacher toutes les vues de discipline
        const multiView = document.getElementById('viewMultiSettings');
        const coView = document.getElementById('viewCOSettings');
        const osView = document.getElementById('viewOrientShowSettings');
        const escView = document.getElementById('viewEscaladeSettings');
        const bmtView = document.getElementById('viewBadmintonSettings');

        if (multiView) multiView.classList.toggle('hidden', disc !== 'multi');
        if (coView) coView.classList.toggle('hidden', disc !== 'co');
        if (osView) osView.classList.toggle('hidden', disc !== 'orientshow');
        if (escView) escView.classList.toggle('hidden', disc !== 'escalade');
        if (bmtView) bmtView.classList.toggle('hidden', disc !== 'badminton');

        // Mettre à jour les boutons
        const btnMulti = document.getElementById('btnDisc-multi');
        const btnCo = document.getElementById('btnDisc-co');
        const btnOs = document.getElementById('btnDisc-orientshow');
        const btnEsc = document.getElementById('btnDisc-escalade');
        const btnBmt = document.getElementById('btnDisc-badminton');

        if (btnMulti) btnMulti.classList.toggle('border-blue-500', disc === 'multi');
        if (btnCo) btnCo.classList.toggle('border-blue-500', disc === 'co');
        if (btnOs) btnOs.classList.toggle('border-blue-500', disc === 'orientshow');
        if (btnEsc) btnEsc.classList.toggle('border-blue-500', disc === 'escalade');
        if (btnBmt) btnBmt.classList.toggle('border-blue-500', disc === 'badminton');

        // Initialisation spécifique
        if (disc === 'co') {
            try { initSortableCO(); loadCOAssignments(); renderCircuits('circuitList', ""); } catch (e) {}
        }
        if (disc === 'escalade') {
            try { initEscaladeInterface(); initSortableEscalade(); loadEscaladeAssignments(); } catch (e) {}
        }
        if (disc === 'orientshow') {
            try { setTimeout(() => { initOrientShowInterface(); loadOrientShowAssignments(); }, 100); } catch (e) {}
        }
        if (disc === 'badminton') {
            try { initBadmintonInterface(); initSortableBadminton(); loadBadmintonAssignments(); } catch (e) {}
        }
    };
    // Dans initActivities(), après switchDiscipline :

window.switchActivitySubTab = function(subTab) {
    const disc = currentDiscipline;
    
    // Mettre à jour les boutons
    ['settings', 'live', 'tv'].forEach(tab => {
        const btn = document.getElementById(`subtab-${tab}`);
        if (btn) {
            if (tab === subTab) {
                btn.classList.remove('bg-slate-700', 'text-slate-300');
                btn.classList.add('bg-blue-600', 'text-white');
            } else {
                btn.classList.remove('bg-blue-600', 'text-white');
                btn.classList.add('bg-slate-700', 'text-slate-300');
            }
        }
    });

    // Cacher les paramètres et afficher Live/TV selon le cas
    const multiView = document.getElementById('viewMultiSettings');
    const coView = document.getElementById('viewCOSettings');
    const osView = document.getElementById('viewOrientShowSettings');
    const escView = document.getElementById('viewEscaladeSettings');
    const bmtView = document.getElementById('viewBadmintonSettings');
    
    // On masque TOUTES les vues de réglages
    [multiView, coView, osView, escView, bmtView].forEach(el => {
        if (el) el.classList.add('hidden');
    });

    // Cacher les anciennes vues Live et TV globales pour réutiliser leurs conteneurs
    const viewLive = document.getElementById('viewLive');
    const viewTV = document.getElementById('viewTV');
    if (viewLive) viewLive.classList.add('hidden');
    if (viewTV) viewTV.style.display = 'none';

    if (subTab === 'settings') {
        // Afficher la vue de réglages correspondante
        if (disc === 'multi') multiView.classList.remove('hidden');
        else if (disc === 'co') coView.classList.remove('hidden');
        else if (disc === 'orientshow') osView.classList.remove('hidden');
        else if (disc === 'escalade') escView.classList.remove('hidden');
        else if (disc === 'badminton') bmtView.classList.remove('hidden');
    } 
    else if (subTab === 'live') {
        // Afficher le conteneur Live et appeler le bon module
        if (viewLive) viewLive.classList.remove('hidden');
        const container = document.getElementById('live-content');
        container.innerHTML = '<p>Chargement du Live...</p>';
        import('../../ui/prof/live.js').then(module => module.renderLive(disc));
    } 
    else if (subTab === 'tv') {
        // Afficher le conteneur TV et appeler le bon module
        const tvViewEl = document.getElementById('viewTV');
        if (tvViewEl) {
            tvViewEl.style.display = 'block';
            tvViewEl.style.height = '100vh'; // Plein écran pour la TV
            // Le conteneur tvGlobe est déjà dans le HTML
            setTimeout(() => {
                if (disc === 'badminton') {
                    import('../../modules/badminton/badminton-tv.js').then(m => m.renderBadmintonTV());
                } else if (disc === 'orientshow') {
                    import('../../modules/orientshow/orientshow-tv.js').then(m => m.renderOrientShowTV());
                } else {
                    import('../../modules/escalade/escalade-tv-ui.js').then(m => m.renderEscaladeTV());
                }
            }, 100);
        }
    }
     window.switchDiscipline('multi');
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
            initEscaladeInterface(nbGroupes, true);
            await populateReserveEscalade(eleves);
            alert(`Tous les élèves sont dans la réserve Escalade (${nbGroupes} groupes). Glissez-les !`);
            return;
        }
        if (currentDiscipline === 'orientshow') {
            alert("Pour OrientShow, glissez les élèves depuis la réserve vers les codes.");
            return;
        }
                if (currentDiscipline === 'badminton') {
            // Récupère les élèves (sans les absents/inaptes pour le tri, mais on garde tout pour la répartition)
            const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');
            // On filtre les inaptes pour qu'ils soient traités différemment par le module
            const joueurs = eleves.filter(e => e.code !== 'INAPTE');
            const inaptes = eleves.filter(e => e.code === 'INAPTE');
            
            generateBadmintonTeams([...joueurs, ...inaptes]); // Le module gère le tri interne
            alert("✅ Terrains générés par niveau de force !");
            return;
        }

        // ---- Multi-activités ----
        const options = {
            mode: document.getElementById('modeRepartition')?.value || 'melange',
            mixite: document.getElementById('modeMixite')?.value || 'ignore',
            critere: document.getElementById('critereForce')?.value || 'vma',
            formatLibelle: document.getElementById('formatLibelle')?.value || 'Couleurs',
            nbEquipes: parseInt(document.getElementById('nbEquipes')?.value) || 0,
            nbParEquipe: parseInt(document.getElementById('nbParEquipe')?.value) || 0,
            couleurs: Array.from(document.querySelectorAll('#paletteCouleurs .border-emerald-400')).map(el => el.dataset.couleur),
        };
        window.lastOptions = options;
        if (!options.nbEquipes && options.nbParEquipe) options.nbEquipes = Math.ceil(eleves.length / options.nbParEquipe);
        else if (options.nbEquipes && !options.nbParEquipe) options.nbParEquipe = Math.ceil(eleves.length / options.nbEquipes);

        const teams = generateClassicTeams(eleves, options);
        
        // Personnalisation : On remplace les couleurs par défaut par le libellé "Couleur"
        teams.forEach(team => {
            team.label = "Couleur";
            team.color = "#e2e8f0"; // Gris clair
            team.textColor = "#334155"; // Gris foncé
        });

        window.lastTeams = teams;
        
        // Appel direct de la fonction de rendu (celle avec les fiches élèves)
        window.renderTeams();
    };
    
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
            
            configData.matrix = DEFAULT_OS_MATRIX;
            
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
        else if (currentDiscipline === 'badminton') {
            // Récupération des affectations sauvegardées
            const assignments = JSON.parse(localStorage.getItem(`eps_arena_badminton_assignments_${activeClasse}`) || '{}');
            configData = { activite: 'badminton' };
            
            // On parcourt chaque terrain pour construire le mapping local et la config
            const lettres = ['A','B','C','D','E','F','G','H','I','J'];
            for (let t = 1; t <= (assignments.nbTerrains || 6); t++) {
                const idsTerrain = assignments[t] || [];
                
                // Construction du mapping local : { Classe_1_A: "IDélève" }
                idsTerrain.forEach((eleveId, index) => {
                    const lettre = lettres[index] || '?';
                    localMapping[`${activeClasse}_${t}_${lettre}`] = eleveId;
                });
                
                // Config pour les iPads : Nombre de joueurs par terrain
                configData[t] = idsTerrain.length;
            }
        } 
        else {
            // Multi-activités (par défaut)
            configData.activite = 'multi';
            if (window.lastTeams) {
                // Utilisation de team.label pour envoyer la couleur choisie aux iPads !
                window.lastTeams.forEach((team) => {
                    const key = team.label; // ex: "Rouge", "Bleu", etc.
                    localMapping[`${activeClasse}_${key}`] = team.members.map(m => m.id);
                    configData[key] = team.members.length;
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
                const classePath = `${baseProf}/${activeClasse}`;
                const matrixBackup = JSON.parse(localStorage.getItem('eps_arena_os_matrix') || '{}');
                remove(ref(db, classePath))
                    .then(() => {
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
        // Fonction pour générer les terrains de badminton (appelée par le bouton)
        window.generateBadmintonTeamsFromCurrentClass = async function() {
        const activeClasse = document.getElementById('selectClasse').value;
        const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');
        if (eleves.length === 0) return alert("Aucun élève dans cette classe.");
        const nbTerrains = parseInt(document.getElementById('badmintonNbTerrains').value) || 6;
        generateBadmintonTeams(eleves, nbTerrains);
        alert("✅ Terrains générés par niveau de force !");
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
    window.exportBadmintonConfig = exportBadmintonConfig;
window.importBadmintonConfig = importBadmintonConfig;

    try { initSortableCO(); } catch (e) {}
    try { initSortableEscalade(); } catch (e) {}
}