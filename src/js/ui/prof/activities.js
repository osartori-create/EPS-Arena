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
import { initNatationInterface, transmettreNatationConfig } from '../../modules/natation/index.js';

// Imports nécessaires pour l’enregistrement des modules
import { initBlocProf } from '../../modules/escalade/escalade-prof-blocs.js';
import '../../modules/escalade/escalade-prof.js';
import '../../modules/multi/multi-prof.js';
import '../../modules/co/co-prof.js';

let currentDiscipline = 'multi';

// ============================================================
// UTILITAIRES
// ============================================================
function isLightColor(hex) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
}

function getBaseProf() {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    return `etablissements/0680013V/profs/${profCode}`;
}

// ============================================================
// INITIALISATION PRINCIPALE
// ============================================================
export function initActivities() {
    console.log("🚀 initActivities appelée !");

    // Initialisations par défaut (fallback)
    try { initEscaladeInterface(6); } catch (e) { console.error("Erreur Escalade :", e); }
    try { initBadmintonInterface(6); } catch (e) { console.error("Erreur Badminton :", e); }
    try { initArcathlonInterface(); } catch (e) { console.error("Erreur Arcathlon :", e); }
    try { initEvaluationInterface(); } catch (e) { console.error("Erreur Évaluation :", e); }

    // ============================================================
    // CHANGEMENT DE DISCIPLINE
    // ============================================================
    window.switchDiscipline = function(disc) {
        currentDiscipline = disc;
        localStorage.setItem('eps_arena_current_discipline', disc);

        // Liste de toutes les vues de paramètres
        const allViews = [
            'viewMultiSettings',
            'viewCOSettings',
            'viewEscaladeSettings',
            'viewBadmintonSettings',
            'viewArcathlonSettings',
            'viewEvaluationSettings',
            'viewTournoiSettings',
            'viewNatationSettings'
        ];

        // --- Masquer TOUTES les vues de manière FORCÉE ---
        allViews.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.classList.add('hidden');
                el.style.display = 'none';
            }
        });

        // --- Cacher spécifiquement les conteneurs internes de CO ---
        const coClassique = document.getElementById('co-classique-container');
        const coOrientShow = document.getElementById('co-orientshow-container');
        if (coClassique) {
            coClassique.style.display = 'none';
            coClassique.innerHTML = '';
        }
        if (coOrientShow) {
            coOrientShow.style.display = 'none';
            coOrientShow.innerHTML = '';
        }

        // --- Afficher la vue demandée ---
        const viewMap = {
            'multi': 'viewMultiSettings',
            'co': 'viewCOSettings',
            'escalade': 'viewEscaladeSettings',
            'badminton': 'viewBadmintonSettings',
            'arcathlon': 'viewArcathlonSettings',
            'evaluation': 'viewEvaluationSettings',
            'tournoi': 'viewTournoiSettings',
            'natation': 'viewNatationSettings'
        };

        const targetId = viewMap[disc];
        if (targetId) {
            const targetView = document.getElementById(targetId);
            if (targetView) {
                targetView.classList.remove('hidden');
                targetView.style.display = '';
            }
        }

        // --- Si on est en CO, réinitialiser le module pour afficher le bon conteneur ---
        if (disc === 'co') {
            const coModule = getModule('co');
            if (coModule && coModule.initProf) {
                const activeClasse = document.getElementById('selectClasse').value;
                setTimeout(() => coModule.initProf(activeClasse), 50);
            }
        }

        // --- Initialisations spécifiques pour les autres disciplines ---
        if (disc === 'multi') {
            const multiModule = getModule('multi');
            if (multiModule?.initProf) {
                const classe = document.getElementById('selectClasse').value;
                multiModule.initProf(classe);
            }
        } else if (disc === 'escalade') {
            const escaladeModule = getModule('escalade');
            if (escaladeModule?.initProf) {
                const classe = document.getElementById('selectClasse').value;
                escaladeModule.initProf(classe);
            } else {
                // Fallback
                initEscaladeInterface();
                initSortableEscalade();
                loadEscaladeAssignments();
            }
        } else if (disc === 'badminton') {
            try {
                initBadmintonInterface();
                initSortableBadminton();
                loadBadmintonAssignments();
            } catch (e) {}
        } else if (disc === 'arcathlon') {
            try { initArcathlonInterface(); } catch (e) {}
        } else if (disc === 'evaluation') {
            try { setTimeout(() => initEvaluationInterface(), 50); } catch (e) { console.error("Erreur init Évaluation :", e); }
        } else if (disc === 'tournoi') {
            try {
                const container = document.getElementById('tournoi-prof-container');
                if (container) {
                    const classe = document.getElementById('selectClasse').value;
                    if (classe) {
                        loadTournoiVariant(classe, 'elimination');
                        import('../../modules/tournoi/variantes/elimination/elimination-prof.js')
                            .then(module => {
                                if (module.initProf) module.initProf(classe);
                                else console.error('❌ initProf non trouvé');
                            })
                            .catch(err => console.error("Erreur chargement tournoi prof :", err));
                    } else {
                        container.innerHTML = '<p class="text-slate-500">Sélectionnez une classe.</p>';
                    }
                }
            } catch (e) {
                console.error("Erreur init Tournoi :", e);
            }
        } else if (disc === 'natation') {
            initNatationInterface();
        }

        // Mise à jour des boutons de discipline
        const btnIds = ['multi', 'co', 'escalade', 'badminton', 'arcathlon', 'evaluation', 'tournoi', 'natation'];
        btnIds.forEach(id => {
            const btn = document.getElementById(`btnDisc-${id}`);
            if (btn) {
                btn.classList.remove('border-blue-500', 'border-slate-600');
                btn.classList.add(id === disc ? 'border-blue-500' : 'border-slate-600');
            }
        });
    };

    // ============================================================
    // ÉCOUTE DU CHANGEMENT DE MODE ESCALADE
    // ============================================================
    window.addEventListener('escalade-mode-changed', (e) => {
        const mode = e.detail.mode;
        currentDiscipline = (mode === 'bloc') ? 'bloccontest' : 'escalade';
        console.log('[activities] currentDiscipline mis à jour :', currentDiscipline);
    });

    // ============================================================
    // GÉNÉRATION DES ÉQUIPES / GROUPES
    // ============================================================
    window.generateTeams = async function() {
        const activeClasse = document.getElementById('selectClasse').value;
        if (!activeClasse) return alert("Sélectionnez une classe d'abord.");
        const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');
        if (eleves.length === 0) return alert("Aucun élève dans cette classe.");

        const dispatch = {
            'natation': () => {
                initNatationInterface();
                alert('Liste des élèves mise à jour.');
            },
            'co': async () => {
                const coModule = getModule('co');
                if (coModule?.generateTeams) {
                    await coModule.generateTeams(activeClasse);
                } else {
                    await populateReserveWithStudents(eleves);
                    alert("Tous les élèves sont dans la réserve CO.");
                }
            },
            'escalade': async () => {
                const escaladeModule = getModule('escalade');
                if (escaladeModule?.generateTeams) {
                    await escaladeModule.generateTeams(activeClasse);
                } else {
                    const nbGroupes = Math.ceil(eleves.length / 3);
                    initEscaladeInterface(nbGroupes, true);
                    await populateReserveEscalade(eleves);
                    alert(`Tous les élèves sont dans la réserve Escalade (${nbGroupes} groupes).`);
                }
            },
            'bloccontest': async () => {
                const escaladeModule = getModule('escalade');
                if (escaladeModule?.generateTeams) {
                    await escaladeModule.generateTeams(activeClasse);
                }
            },
            'badminton': () => {
                const joueurs = eleves.filter(e => e.code !== 'INAPTE');
                const inaptes = eleves.filter(e => e.code === 'INAPTE');
                generateBadmintonTeams([...joueurs, ...inaptes]);
                alert("✅ Terrains générés par niveau de force !");
            },
            'arcathlon': () => {
                generateArcathlonTeams();
            },
            'multi': async () => {
                const multiModule = getModule('multi');
                if (multiModule?.generateTeams) {
                    await multiModule.generateTeams(activeClasse, eleves);
                }
            }
        };

        if (dispatch[currentDiscipline]) {
            await dispatch[currentDiscipline]();
        } else {
            alert("❌ Aucune génération définie pour cette discipline.");
        }
    };

    // ============================================================
    // SOUS-ONGLETS (Réglages / Live / TV)
    // ============================================================
    window.switchActivitySubTab = function(subTab) {
        const disc = currentDiscipline;

        // Mise à jour des boutons
        ['settings', 'live', 'tv'].forEach(tab => {
            const btn = document.getElementById(`subtab-${tab}`);
            if (btn) {
                btn.classList.remove('bg-blue-600', 'text-white', 'bg-slate-700', 'text-slate-300');
                btn.classList.add(tab === subTab ? 'bg-blue-600' : 'bg-slate-700');
                btn.classList.add(tab === subTab ? 'text-white' : 'text-slate-300');
            }
        });

        // Cacher toutes les vues de paramètres
        const settingsViews = [
            'viewMultiSettings', 'viewCOSettings', 'viewEscaladeSettings',
            'viewBadmintonSettings', 'viewArcathlonSettings', 'viewEvaluationSettings',
            'viewTournoiSettings', 'viewNatationSettings'
        ];
        settingsViews.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        // Cacher Live et TV
        const viewLive = document.getElementById('viewLive');
        const viewTV = document.getElementById('viewTV');
        if (viewLive) viewLive.classList.add('hidden');
        if (viewTV) viewTV.style.display = 'none';

        if (subTab === 'settings') {
            // Afficher la vue de réglages de la discipline courante
            const map = {
                'multi': 'viewMultiSettings',
                'co': 'viewCOSettings',
                'escalade': 'viewEscaladeSettings',
                'badminton': 'viewBadmintonSettings',
                'arcathlon': 'viewArcathlonSettings',
                'evaluation': 'viewEvaluationSettings',
                'tournoi': 'viewTournoiSettings',
                'natation': 'viewNatationSettings',
                'bloccontest': 'viewEscaladeSettings'
            };
            const targetId = map[disc];
            if (targetId) {
                const target = document.getElementById(targetId);
                if (target) target.classList.remove('hidden');
            }
            // Réinitialiser certains modules si nécessaire
            if (disc === 'evaluation') setTimeout(() => initEvaluationInterface(), 50);
            if (disc === 'escalade' || disc === 'bloccontest') {
                const escaladeModule = getModule('escalade');
                if (escaladeModule?.initProf) {
                    const classe = document.getElementById('selectClasse').value;
                    escaladeModule.initProf(classe);
                }
            }
            if (disc === 'multi') {
                const multiModule = getModule('multi');
                if (multiModule?.initProf) {
                    const classe = document.getElementById('selectClasse').value;
                    multiModule.initProf(classe);
                }
            }
            if (disc === 'co') {
                const coModule = getModule('co');
                if (coModule?.renderLive) {
                    const result = coModule.renderLive();
                    if (result?.catch) result.catch(console.error);
                } else {
                    import('../../modules/co/co-live.js').then(m => m.renderCOLive()).catch(console.error);
                }
            }
        } else if (subTab === 'live') {
            if (viewLive) viewLive.classList.remove('hidden');
            const container = document.getElementById('live-content');
            container.innerHTML = '<p>Chargement du Live...</p>';

            // --- GESTION DES BOUTONS D'EXPORT ---
            const exportCSVBtn = document.querySelector('#viewLive .bg-indigo-600');
            const exportIDoceoBtn = document.querySelector('#viewLive .bg-green-600');
            
            if (disc === 'natation') {
                if (exportCSVBtn) exportCSVBtn.style.display = 'none';
                if (exportIDoceoBtn) {
                    exportIDoceoBtn.textContent = '📥 Export iDoceo';
                    exportIDoceoBtn.className = 'bg-indigo-600 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-indigo-400';
                    exportIDoceoBtn.onclick = function() {
                        if (typeof window.exportNatationIDoceo === 'function') {
                            window.exportNatationIDoceo();
                        } else {
                            alert('Export Natation non disponible. Transmettez d\'abord la configuration.');
                        }
                    };
                }
            } else {
                if (exportCSVBtn) exportCSVBtn.style.display = '';
                if (exportIDoceoBtn) {
                    exportIDoceoBtn.textContent = '📥 Export iDoceo (CO)';
                    exportIDoceoBtn.className = 'bg-green-600 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-green-400';
                    exportIDoceoBtn.onclick = function() {
                        if (typeof exportCOiDoceo === 'function') exportCOiDoceo();
                        else alert('Export CO non disponible.');
                    };
                }
            }

            // --- Chargement du Live selon la discipline ---
            const liveModules = {
                'badminton': () => import('../../modules/badminton/badminton-live.js').then(m => m.renderBadmintonLive()),
                'escalade': () => import('../../modules/escalade/escalade-live.js').then(m => m.renderEscaladeLive(window.lastLiveData || {})),
                'co': () => {
                    const coModule = getModule('co');
                    return coModule?.renderLive ? coModule.renderLive() : import('../../modules/co/co-live.js').then(m => m.renderCOLive(window.lastLiveData || {}));
                },
                'multi': () => import('../../modules/multi/multi-live.js').then(m => m.renderMultiLive(window.lastLiveData || {})),
                'bloccontest': () => import('../../modules/escalade/escalade-live.js').then(m => m.renderEscaladeLive(window.lastLiveData || {})),
                'natation': () => import('../../modules/natation/natation-live.js').then(m => m.renderNatationLive()),
                'tournoi': () => {
                    container.innerHTML = '<p class="text-slate-500">Live non disponible pour le tournoi.</p>';
                    return Promise.resolve();
                }
            };
            if (liveModules[disc]) {
                const result = liveModules[disc]();
                if (result?.catch) result.catch(err => console.error(`Erreur Live ${disc} :`, err));
            } else {
                container.innerHTML = `<p class="text-red-400">Aucun module Live pour cette discipline.</p>`;
            }
        } else if (subTab === 'tv') {
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
                            return coModule?.renderTV ? coModule.renderTV() : Promise.resolve();
                        },
                        'arcathlon': () => import('../../modules/arcathlon/arcathlon-tv.js').then(m => m.renderArcathlonTV()),
                        'bloccontest': () => import('../../modules/escalade/escalade-tv-ui.js').then(m => m.renderEscaladeTV()),
                        'natation': () => import('../../modules/natation/natation-tv.js').then(m => m.renderNatationTV()),
                        'tournoi': () => {
                            document.getElementById('tvGlobe').innerHTML = '<p class="text-slate-500 text-center">Mode TV non disponible pour le tournoi.</p>';
                            return Promise.resolve();
                        }
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
    // TRANSMISSION FIREBASE
    // ============================================================
    window.transmettreConfig = async function() {
        const activeClasse = document.getElementById('selectClasse').value;
        if (!activeClasse) return alert("Sélectionnez une classe.");
        const baseProf = getBaseProf();

        const handlers = {
            'escalade': async () => {
                const escaladeModule = getModule('escalade');
                if (escaladeModule?.transmettre) {
                    try {
                        await escaladeModule.transmettre(activeClasse);
                        alert("✅ Configuration Escalade transmise aux iPads !");
                        return;
                    } catch (err) {
                        console.error('Erreur transmission escalade :', err);
                        alert('❌ Erreur lors de la transmission.\nVérifie la console (F12) pour plus de détails.');
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
                    alert("❌ Erreur lors de la transmission.\nVérifie la console (F12) pour plus de détails.");
                }
            },
            'bloccontest': async () => {
                const escaladeModule = getModule('escalade');
                if (escaladeModule?.transmettre) {
                    await escaladeModule.transmettre(activeClasse);
                    alert("✅ Configuration Bloc Contest transmise aux iPads !");
                }
            },
            'multi': async () => {
                const multiModule = getModule('multi');
                if (multiModule?.transmettre) {
                    await multiModule.transmettre(activeClasse);
                    alert("✅ Configuration Multi transmise aux iPads !");
                }
            },
            'co': async () => {
                const coModule = getModule('co');
                if (coModule?.transmettre) {
                    await coModule.transmettre(activeClasse);
                    alert("✅ Configuration CO transmise aux iPads !");
                }
            },
            'badminton': async () => {
                await transmettreBadmintonConfig();
                // transmettreBadmintonConfig gère déjà son propre alert
            },
            'arcathlon': async () => {
                await transmettreArcathlonConfig();
                // transmettreArcathlonConfig gère déjà son propre alert
            },
            'natation': async () => {
                await transmettreNatationConfig();
                // transmettreNatationConfig gère déjà son propre alert
            },
            'tournoi': async () => {
                const configData = { activite: 'tournoi', mode: window.tournoiMode || 'elimination' };
                await set(ref(db, `${baseProf}/${activeClasse}/config`), configData);
                await set(ref(db, `${baseProf}/active_classes/${activeClasse}`), true);
                alert("✅ Module Tournoi activé pour les iPads !");
            }
        };

        if (handlers[currentDiscipline]) {
            try {
                await handlers[currentDiscipline]();
            } catch (e) {
                console.error("Erreur transmission :", e);
                alert("❌ Erreur lors de la transmission.\nVérifie la console (F12) pour plus de détails.");
            }
        } else {
            alert("❌ Aucune transmission définie pour cette discipline.");
        }
    };

    // ============================================================
    // PURGE FIREBASE
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
    // FONCTIONS CO (circuits)
    // ============================================================
    window.addCircuit = function() {
        const cat = prompt("Catégorie :");
        if (!cat) return;
        const nom = prompt("Nom du circuit :");
        if (!nom) return;
        const b = prompt("Liste des balises :");
        if (b) {
            addCircuitCO(cat, nom, b);
            renderCircuits('circuitList', "");
        }
    };
    window.editCircuit = function(id) {
        const circ = getCircuits().find(c => c.id === id);
        const n = prompt("Modifier les balises :", circ.balises.join(', '));
        if (n !== null) { editCircuitCO(id, n); renderCircuits('circuitList', ""); }
    };
    window.delCircuit = function(id) {
        if (confirm("Supprimer ce circuit ?")) { delCircuit(id); renderCircuits('circuitList', ""); }
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
    // EXPORTS / IMPORTS (conservés)
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
    // INITIALISATION SORTABLE (fallback)
    // ============================================================
    try { initSortableEscalade(); } catch (e) {}

    // ============================================================
    // LANCEMENT DE LA DISCIPLINE PAR DÉFAUT
    // ============================================================
    setTimeout(() => {
        const savedDisc = localStorage.getItem('eps_arena_current_discipline') || 'multi';
        window.switchDiscipline(savedDisc);
    }, 100);
}

// ============================================================
// EXPORT PAR DÉFAUT
// ============================================================
export default {
    initActivities
};