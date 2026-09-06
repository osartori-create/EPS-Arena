// src/js/ui/prof/activities.js
import { populateReserveWithStudents, exportCOConfig, importCOConfig } from '../../modules/co/co-interface.js';
import { initEscaladeInterface, populateReserveEscalade, initSortableEscalade, loadEscaladeAssignments, exportEscaladeConfig, importEscaladeConfig } from '../../modules/escalade/escalade-interface.js';
import { renderCircuits, getCircuits, addCircuit as addCircuitCO, editCircuit as editCircuitCO, delCircuit } from '../../modules/co/circuit-manager.js';
import { generateTeams as generateClassicTeams } from '../../modules/teams/team-generator.js';
import { getPhotoUrl } from '../../services/admin-service.js';
import { db, ref, set, remove } from '../../core/firebase-service.js';
import { initBadmintonInterface, generateBadmintonTeams, loadBadmintonAssignments, initSortableBadminton, saveBadmintonAssignments, updateCodes, exportBadmintonConfig, importBadmintonConfig, transmettreBadmintonConfig } from '../../modules/badminton/badminton-interface.js';
import { initArcathlonInterface, generateArcathlonTeams, transmettreArcathlonConfig } from '../../modules/arcathlon/arcathlon-interface.js';
import { initEvaluationInterface } from '../../modules/evaluation/evaluation-interface.js';
import { loadTournoiVariant } from '../../modules/tournoi/tournoi-dispatcher.js';
import { getModule, getAllModules } from '../../modules/registry.js';
import { initNatationInterface, generateNatationGroups, transmettreNatationConfig, loadNatationAssignments } from '../../modules/natation/index.js';

// ✅ Importer le module escalade (pour l'initialisation via le registre)
import { initBlocProf } from '../../modules/escalade/escalade-prof-blocs.js';
// ✅ Forcer l’enregistrement du module escalade
import '../../modules/escalade/escalade-prof.js';
// ✅ Forcer l’enregistrement du module multi
import '../../modules/multi/multi-prof.js';
// ✅ Forcer l’enregistrement du module CO (inclut la gestion OrientShow)
import '../../modules/co/co-prof.js';

let currentDiscipline = 'multi';

// ============================================================
// UTILITAIRE : COULEUR CLAIRE (gardée car utilisée ailleurs)
// ============================================================
function isLightColor(hex) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
}

// ============================================================
// CHEMINS FIREBASE
// ============================================================
function getBaseProf() {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    return `etablissements/0680013V/profs/${profCode}`;
}

// ============================================================
// INITIALISATION PRINCIPALE
// ============================================================
export function initActivities() {
    console.log("🚀 initActivities appelée !");
    
    // ✅ Les initialisations des modules qui ont un sélecteur interne sont déplacées dans le sélecteur
    // On garde seulement les modules sans sélecteur : Escalade classique (fallback), Badminton, Arcathlon, Évaluation, Tournoi
    try { console.log("→ Initialisation Escalade..."); initEscaladeInterface(6); console.log("✅ Escalade OK"); } catch (e) { console.error("❌ Erreur Escalade :", e); }
    try { console.log("→ Initialisation Badminton..."); initBadmintonInterface(6); console.log("✅ Badminton OK"); } catch (e) { console.error("❌ Erreur Badminton :", e); }
    try { console.log("→ Initialisation Arcathlon..."); initArcathlonInterface(); console.log("✅ Arcathlon OK"); } catch (e) { console.error("❌ Erreur Arcathlon :", e); }
    try { console.log("→ Initialisation Évaluation..."); initEvaluationInterface(); console.log("✅ Évaluation OK"); } catch (e) { console.error("❌ Erreur Évaluation :", e); }

    // ============================================================
    // CHANGEMENT DE DISCIPLINE
    // ============================================================
    window.switchDiscipline = function(disc) {
        currentDiscipline = disc;
        localStorage.setItem('eps_arena_current_discipline', disc);

        const multiView = document.getElementById('viewMultiSettings');
        const coView = document.getElementById('viewCOSettings');
        const escView = document.getElementById('viewEscaladeSettings');
        const bmtView = document.getElementById('viewBadmintonSettings');
        const arcView = document.getElementById('viewArcathlonSettings');
        const evalView = document.getElementById('viewEvaluationSettings');
        const tournoiView = document.getElementById('viewTournoiSettings');

        // Cacher toutes les vues
        if (multiView) multiView.classList.add('hidden');
        if (coView) coView.classList.add('hidden');
        if (escView) escView.classList.add('hidden');
        if (bmtView) bmtView.classList.add('hidden');
        if (arcView) arcView.classList.add('hidden');
        if (evalView) evalView.classList.add('hidden');
        if (tournoiView) tournoiView.classList.add('hidden');

        // Afficher la vue correspondante
        if (disc === 'multi') {
            const multiModule = getModule('multi');
            if (multiModule && multiModule.initProf) {
                const activeClasse = document.getElementById('selectClasse').value;
                multiModule.initProf(activeClasse);
            }
            if (multiView) multiView.classList.remove('hidden');
        }
        else if (disc === 'co') {
    const coModule = getModule('co');
    if (coModule && coModule.initProf) {
        const activeClasse = document.getElementById('selectClasse').value;
        coModule.initProf(activeClasse);
    }
    if (coView) coView.classList.remove('hidden');
}
else if (disc === 'natation') {
    const view = document.getElementById('viewNatationSettings');
    if (view) view.classList.remove('hidden');
    initNatationInterface();
    loadNatationAssignments();
}
        else if (disc === 'escalade') {
            if (escView) escView.classList.remove('hidden');
            const escaladeModule = getModule('escalade');
            if (escaladeModule && escaladeModule.initProf) {
                const activeClasse = document.getElementById('selectClasse').value;
                escaladeModule.initProf(activeClasse);
            } else {
                // Fallback
                initEscaladeInterface();
                initSortableEscalade();
                loadEscaladeAssignments();
            }
            currentDiscipline = 'escalade';
        }
        else if (disc === 'badminton' && bmtView) bmtView.classList.remove('hidden');
        else if (disc === 'arcathlon' && arcView) arcView.classList.remove('hidden');
        else if (disc === 'evaluation' && evalView) evalView.classList.remove('hidden');
        else if (disc === 'tournoi' && tournoiView) tournoiView.classList.remove('hidden');

        // Mise à jour des boutons
        const btnMulti = document.getElementById('btnDisc-multi');
        const btnCo = document.getElementById('btnDisc-co');
        const btnEsc = document.getElementById('btnDisc-escalade');
        const btnBmt = document.getElementById('btnDisc-badminton');
        const btnArc = document.getElementById('btnDisc-arcathlon');
        const btnEval = document.getElementById('btnDisc-evaluation');
        const btnTournoi = document.getElementById('btnDisc-tournoi');

        const resetBtn = (btn) => { if (btn) { btn.classList.remove('border-blue-500'); btn.classList.add('border-slate-600'); } };
        const setActive = (btn) => { if (btn) { btn.classList.remove('border-slate-600'); btn.classList.add('border-blue-500'); } };

        resetBtn(btnMulti); resetBtn(btnCo); resetBtn(btnEsc);
        resetBtn(btnBmt); resetBtn(btnArc); resetBtn(btnEval); resetBtn(btnTournoi);

        if (disc === 'multi') setActive(btnMulti);
        else if (disc === 'co') setActive(btnCo);
        else if (disc === 'escalade') setActive(btnEsc);
        else if (disc === 'badminton') setActive(btnBmt);
        else if (disc === 'arcathlon') setActive(btnArc);
        else if (disc === 'evaluation') setActive(btnEval);
        else if (disc === 'tournoi') setActive(btnTournoi);

        // Initialisations spécifiques (pour les modules qui n'ont pas de sélecteur)
        if (disc === 'badminton') {
            try { initBadmintonInterface(); initSortableBadminton(); loadBadmintonAssignments(); } catch (e) {}
        }
        if (disc === 'arcathlon') {
            try { initArcathlonInterface(); } catch (e) {}
        }
        if (disc === 'evaluation') {
            try { setTimeout(() => initEvaluationInterface(), 50); } catch (e) { console.error("Erreur init Évaluation :", e); }
        }
        if (disc === 'tournoi') {
            try {
                const container = document.getElementById('tournoi-prof-container');
                if (container) {
                    const activeClasse = document.getElementById('selectClasse').value;
                    if (activeClasse) {
                        loadTournoiVariant(activeClasse, 'elimination');
                        import('../../modules/tournoi/variantes/elimination/elimination-prof.js').then(module => {
                            if (module.initProf) {
                                module.initProf(activeClasse);
                            } else {
                                console.error('❌ initProf non trouvé');
                            }
                        }).catch(err => console.error("Erreur chargement tournoi prof :", err));
                    } else {
                        container.innerHTML = '<p class="text-slate-500">Sélectionnez une classe.</p>';
                    }
                }
            } catch (e) {
                console.error("Erreur init Tournoi :", e);
            }
        }
    };

    // ============================================================
    // ÉCOUTE DU CHANGEMENT DE MODE ESCALADE
    // ============================================================
    window.addEventListener('escalade-mode-changed', (e) => {
        const mode = e.detail.mode;
        if (mode === 'bloc') {
            currentDiscipline = 'bloccontest';
        } else {
            currentDiscipline = 'escalade';
        }
        console.log('[activities] currentDiscipline mis à jour :', currentDiscipline);
    });

    // ============================================================
    // GÉNÉRATION DES ÉQUIPES (dispatch vers les modules)
    // ============================================================
    window.generateTeams = async function() {
        const activeClasse = document.getElementById('selectClasse').value;
        if (!activeClasse) return alert("Sélectionnez une classe d'abord.");
        const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');
        if (eleves.length === 0) return alert("Aucun élève dans cette classe.");

        // Cas particuliers : CO, Escalade, Badminton, Arcathlon, Multi
        if (currentDiscipline === 'natation') {
    generateNatationGroups();
    return;
}
        if (currentDiscipline === 'co') {
            const coModule = getModule('co');
            if (coModule && coModule.generateTeams) {
                await coModule.generateTeams(activeClasse);
                return;
            }
            // Fallback
            await populateReserveWithStudents(eleves);
            alert("Tous les élèves sont dans la réserve CO.");
            return;
        }
        if (currentDiscipline === 'escalade' || currentDiscipline === 'bloccontest') {
            const escaladeModule = getModule('escalade');
            if (escaladeModule && escaladeModule.generateTeams) {
                await escaladeModule.generateTeams(activeClasse);
                return;
            } else {
                // Fallback
                const nbGroupes = Math.ceil(eleves.length / 3);
                initEscaladeInterface(nbGroupes, true);
                await populateReserveEscalade(eleves);
                alert(`Tous les élèves sont dans la réserve Escalade (${nbGroupes} groupes). Glissez-les !`);
                return;
            }
        }
        if (currentDiscipline === 'badminton') {
            const joueurs = eleves.filter(e => e.code !== 'INAPTE');
            const inaptes = eleves.filter(e => e.code === 'INAPTE');
            generateBadmintonTeams([...joueurs, ...inaptes]);
            alert("✅ Terrains générés par niveau de force !");
            return;
        }
        if (currentDiscipline === 'arcathlon') {
            generateArcathlonTeams();
            return;
        }
        if (currentDiscipline === 'multi') {
            const multiModule = getModule('multi');
            if (multiModule && multiModule.generateTeams) {
                await multiModule.generateTeams(activeClasse, eleves);
                return;
            }
        }

        alert("❌ Aucune génération définie pour cette discipline.");
    };

    // ============================================================
    // GESTION DES SOUS-ONGLETS (Live / TV)
    // ============================================================
    window.switchActivitySubTab = function(subTab) {
        const disc = currentDiscipline;
        
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

        // Masquer TOUTES les vues de réglages
        const views = ['viewMultiSettings', 'viewCOSettings', 'viewEscaladeSettings',
                       'viewBadmintonSettings', 'viewArcathlonSettings', 'viewEvaluationSettings'];
        views.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        const viewLive = document.getElementById('viewLive');
        const viewTV = document.getElementById('viewTV');
        if (viewLive) viewLive.classList.add('hidden');
        if (viewTV) viewTV.style.display = 'none';

        if (subTab === 'settings') {
            const map = {
                'multi': 'viewMultiSettings',
                'co': 'viewCOSettings',
                'escalade': 'viewEscaladeSettings',
                'badminton': 'viewBadmintonSettings',
                'arcathlon': 'viewArcathlonSettings',
                'evaluation': 'viewEvaluationSettings',
                'bloccontest': 'viewEscaladeSettings'
            };
            const targetView = document.getElementById(map[disc] || 'viewMultiSettings');
            if (targetView) {
                targetView.classList.remove('hidden');
                if (disc === 'evaluation') {
                    setTimeout(() => initEvaluationInterface(), 50);
                }
                if (disc === 'escalade' || disc === 'bloccontest') {
                    const escaladeModule = getModule('escalade');
                    if (escaladeModule && escaladeModule.initProf) {
                        const activeClasse = document.getElementById('selectClasse').value;
                        escaladeModule.initProf(activeClasse);
                    }
                }
                if (disc === 'multi') {
                    const multiModule = getModule('multi');
                    if (multiModule && multiModule.initProf) {
                        const activeClasse = document.getElementById('selectClasse').value;
                        multiModule.initProf(activeClasse);
                    }
                }
                if (disc === 'co') {
    const coModule = getModule('co');
    if (coModule && typeof coModule.renderLive === 'function') {
        const result = coModule.renderLive();
        if (result && typeof result.catch === 'function') {
            result.catch(console.error);
        }
    } else {
        import('../../modules/co/co-live.js')
            .then(m => m.renderCOLive())
            .catch(console.error);
    }
    return;
}
            }
        } 
        else if (subTab === 'live') {
            if (viewLive) viewLive.classList.remove('hidden');
            const container = document.getElementById('live-content');
            container.innerHTML = '<p>Chargement du Live...</p>';

            const liveModules = {
                'badminton': () => import('../../modules/badminton/badminton-live.js').then(m => m.renderBadmintonLive()),
                'escalade': () => import('../../modules/escalade/escalade-live.js').then(m => m.renderEscaladeLive(window.lastLiveData || {})),
                'co': () => {
                    const coModule = getModule('co');
                    if (coModule && coModule.renderLive) {
                        return coModule.renderLive();
                    } else {
                        return import('../../modules/co/co-live.js').then(m => m.renderCOLive(window.lastLiveData || {}));
                    }
                },
                'multi': () => import('../../modules/multi/multi-live.js').then(m => m.renderMultiLive(window.lastLiveData || {})),
                'bloccontest': () => import('../../modules/escalade/escalade-live.js').then(m => m.renderEscaladeLive(window.lastLiveData || {})),
            };

            if (liveModules[disc]) {
    const result = liveModules[disc]();
    if (result && typeof result.catch === 'function') {
        result.catch(err => console.error(`Erreur Live ${disc} :`, err));
    } else {
        console.warn(`Le module Live pour ${disc} n'a pas retourné de promesse.`);
    }
} else {
                container.innerHTML = `<p class="text-red-400">Aucun module Live pour cette discipline.</p>`;
            }
        } 
        else if (subTab === 'tv') {
            const tvViewEl = document.getElementById('viewTV');
            if (tvViewEl) {
                tvViewEl.style.display = 'block';
                tvViewEl.style.height = '100vh';
                setTimeout(() => {
                    const tvModules = {
                        'badminton': () => import('../../modules/badminton/badminton-tv.js').then(m => m.renderBadmintonTV()),
                        'escalade': () => import('../../modules/escalade/escalade-tv-ui.js').then(m => m.renderEscaladeTV()),
                        'co': () => {
                            const coModule = getModule('co');
                            if (coModule && coModule.renderTV) {
                                return coModule.renderTV();
                            } else {
                                console.log('[TV] CO non disponible');
                            }
                        },
                        'arcathlon': () => import('../../modules/arcathlon/arcathlon-tv.js').then(m => m.renderArcathlonTV()),
                        'bloccontest': () => import('../../modules/escalade/escalade-tv-ui.js').then(m => m.renderEscaladeTV()),
                    };
                    if (tvModules[disc]) {
                        tvModules[disc]().catch(err => console.error(`Erreur TV ${disc} :`, err));
                    } else {
                        document.getElementById('tvGlobe').innerHTML = '<p class="text-slate-500 text-center">Mode TV non disponible pour cette discipline.</p>';
                    }
                }, 100);
            }
        }
    };

    // ============================================================
    // TRANSMISSION FIREBASE (dispatch vers les modules)
    // ============================================================
    window.transmettreConfig = async function() {
        const activeClasse = document.getElementById('selectClasse').value;
        if (!activeClasse) return alert("Sélectionnez une classe.");

        const baseProf = getBaseProf();

        // ✅ Escalade / Bloc Contest
        if (currentDiscipline === 'escalade' || currentDiscipline === 'bloccontest') {
            const escaladeModule = getModule('escalade');
            if (escaladeModule && escaladeModule.transmettre) {
                try {
                    await escaladeModule.transmettre(activeClasse);
                    return;
                } catch (err) {
                    console.error('Erreur transmission escalade :', err);
                    alert('Erreur lors de la transmission.\nVérifie la console (F12) pour plus de détails.');
                    return;
                }
            }
            // Fallback
            const configData = JSON.parse(localStorage.getItem(`eps_arena_escalade_assignments_${activeClasse}`) || '{}');
            configData.activite = 'escalade';
            const localMapping = {};
            Object.keys(configData).forEach(lettre => {
                if (lettre !== 'activite' && Array.isArray(configData[lettre])) {
                    localMapping[`${activeClasse}_${lettre}`] = configData[lettre];
                    configData[lettre] = configData[lettre].length;
                }
            });
            localStorage.setItem(`eps_arena_local_mapping_${activeClasse}`, JSON.stringify(localMapping));
            try {
                await set(ref(db, `${baseProf}/${activeClasse}/config`), configData);
                await set(ref(db, `${baseProf}/active_classes/${activeClasse}`), true);
                alert("✅ Configuration Escalade transmise aux iPads !");
            } catch (e) {
                console.error("Erreur transmission :", e);
                alert("Erreur lors de la transmission.\nVérifie la console (F12) pour plus de détails.");
            }
            return;
        }

        // ✅ Multi
        if (currentDiscipline === 'multi') {
            const multiModule = getModule('multi');
            if (multiModule && multiModule.transmettre) {
                await multiModule.transmettre(activeClasse);
                return;
            }
        }

        // ✅ CO (classique + OrientShow gérés par le module)
        if (currentDiscipline === 'co') {
            const coModule = getModule('co');
            if (coModule && coModule.transmettre) {
                await coModule.transmettre(activeClasse);
                return;
            }
        }

        // ✅ Badminton
        if (currentDiscipline === 'badminton') {
            await transmettreBadmintonConfig();
            return;
        }

        // ✅ Arcathlon
        if (currentDiscipline === 'arcathlon') {
            await transmettreArcathlonConfig();
            return;
        }

        if (currentDiscipline === 'natation') {
    await transmettreNatationConfig();
    return;
}
        // ✅ Tournoi
        if (currentDiscipline === 'tournoi') {
            const configData = {
                activite: 'tournoi',
                mode: window.tournoiMode || 'elimination'
            };
            try {
                await set(ref(db, `${baseProf}/${activeClasse}/config`), configData);
                await set(ref(db, `${baseProf}/active_classes/${activeClasse}`), true);
                alert("✅ Module Tournoi activé pour les iPads !");
            } catch (e) {
                console.error("Erreur transmission :", e);
                alert("Erreur lors de la transmission.\nVérifie la console (F12) pour plus de détails.");
            }
            return;
        }

        alert("❌ Aucune transmission définie pour cette discipline.");
    };

    // ============================================================
    // PURGE
    // ============================================================
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

    // ============================================================
    // FONCTIONS CO (circuits) – conservées pour compatibilité HTML
    // ============================================================
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

    // ============================================================
    // BADMINTON
    // ============================================================
    window.generateBadmintonTeamsFromCurrentClass = async function() {
        const activeClasse = document.getElementById('selectClasse').value;
        const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');
        if (eleves.length === 0) return alert("Aucun élève dans cette classe.");
        const nbTerrains = parseInt(document.getElementById('badmintonNbTerrains').value) || 6;
        generateBadmintonTeams(eleves, nbTerrains);
        alert("✅ Terrains générés par niveau de force !");
    };

    // ============================================================
    // EXPORTS / IMPORTS (conservés pour compatibilité)
    // ============================================================
    window.exportCOConfig = exportCOConfig;
    window.importCOConfig = importCOConfig;
    window.exportEscaladeConfig = exportEscaladeConfig;
    window.importEscaladeConfig = importEscaladeConfig;
    window.exportBadmintonConfig = exportBadmintonConfig;
    window.importBadmintonConfig = importBadmintonConfig;
    window.generateArcathlonTeams = generateArcathlonTeams;
    window.transmettreArcathlonConfig = transmettreArcathlonConfig;

    // ============================================================
    // INITIALISATION SORTABLE (au cas où)
    // ============================================================
    try { initSortableEscalade(); } catch (e) {}
}

// ============================================================
// EXPORT PAR DÉFAUT
// ============================================================
export default {
    initActivities
};