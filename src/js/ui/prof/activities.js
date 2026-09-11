// src/js/ui/prof/activities.js
import { populateReserveWithStudents, exportCOConfig, importCOConfig } from '../../modules/co/co-interface.js';
import { initEscaladeInterface, populateReserveEscalade, initSortableEscalade, loadEscaladeAssignments, exportEscaladeConfig, importEscaladeConfig } from '../../modules/escalade/escalade-interface.js';
import { renderCircuits, getCircuits, addCircuit as addCircuitCO, editCircuit as editCircuitCO, delCircuit } from '../../modules/co/circuit-manager.js';
import { generateTeams as generateClassicTeams } from '../../modules/teams/team-generator.js';
import { getPhotoUrl } from '../../services/admin-service.js';
import { db, ref, set, remove, onValue } from '../../core/firebase-service.js';
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
import '../../modules/relais/index.js';

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
            'viewNatationSettings',
            'viewRelaisSettings'
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
            'natation': 'viewNatationSettings',
            'relais': 'viewRelaisSettings'
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
        } else if (disc === 'escalade' || disc === 'bloccontest') {
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
            // Définir le mode pour le Live et la TV
            const mode = disc === 'bloccontest' ? 'bloc' : 'classic';
            import('../../modules/escalade/escalade-live.js').then(module => {
                if (module.setEscaladeMode) module.setEscaladeMode(mode);
            });
            import('../../modules/escalade/escalade-tv-ui.js').then(module => {
                if (module.setEscaladeMode) module.setEscaladeMode(mode);
            });
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
        } else if (disc === 'relais') {
            import('../../modules/relais/relais-interface.js')
                .then(m => m.initRelaisInterface())
                .catch(err => console.error('Erreur init Relais :', err));
        }

        // Mise à jour des boutons de discipline
        const btnIds = ['multi', 'co', 'escalade', 'badminton', 'arcathlon', 'evaluation', 'tournoi', 'natation', 'relais'];
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
        import('../../modules/escalade/escalade-live.js').then(module => {
            if (module.setEscaladeMode) module.setEscaladeMode(mode);
        });
        import('../../modules/escalade/escalade-tv-ui.js').then(module => {
            if (module.setEscaladeMode) module.setEscaladeMode(mode);
        });
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
            'relais': async () => {
                const relaisModule = getModule('relais');
                if (relaisModule?.generateTeams) {
                    await relaisModule.generateTeams(activeClasse);
                } else {
                    const m = await import('../../modules/relais/relais-interface.js');
                    if (m.relaisGenererGroupes) window.relaisGenererGroupes();
                }
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
            'viewTournoiSettings', 'viewNatationSettings', 'viewRelaisSettings'
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
                'bloccontest': 'viewEscaladeSettings',
                'relais': 'viewRelaisSettings'
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
            if (disc === 'relais') {
                import('../../modules/relais/relais-interface.js')
                    .then(m => m.initRelaisInterface())
                    .catch(err => console.error('Erreur init Relais :', err));
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

            // Par défaut, on les masque pour les disciplines où ils ne sont pas utiles
            if (disc === 'escalade' || disc === 'bloccontest' || disc === 'natation' || disc === 'relais') {
                if (exportCSVBtn) exportCSVBtn.style.display = 'none';
                if (exportIDoceoBtn) exportIDoceoBtn.style.display = 'none';
            } else {
                // Pour les autres disciplines, on les restaure
                if (exportCSVBtn) exportCSVBtn.style.display = '';
                // Pour CO, on restaure le bouton iDoceo
                if (exportIDoceoBtn) {
                    if (disc === 'co') {
                        exportIDoceoBtn.textContent = '📥 Export iDoceo (CO)';
                        exportIDoceoBtn.className = 'bg-green-600 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-green-400';
                        exportIDoceoBtn.onclick = function() {
                            if (typeof exportCOiDoceo === 'function') exportCOiDoceo();
                            else alert('Export CO non disponible.');
                        };
                        exportIDoceoBtn.style.display = '';
                    } else {
                        exportIDoceoBtn.style.display = 'none';
                    }
                }
            }

            // --- Chargement du Live selon la discipline ---
            const liveModules = {
                'badminton': () => import('../../modules/badminton/badminton-live.js').then(m => m.renderBadmintonLive()),
                'escalade': () => import('../../modules/escalade/escalade-live.js').then(m => m.renderEscaladeLive('classic')),
                'bloccontest': () => import('../../modules/escalade/escalade-live.js').then(m => m.renderEscaladeLive('bloc')),
                'co': () => {
                    const coModule = getModule('co');
                    return coModule?.renderLive ? coModule.renderLive() : import('../../modules/co/co-live.js').then(m => m.renderCOLive(window.lastLiveData || {}));
                },
                'multi': () => import('../../modules/multi/multi-live.js').then(m => m.renderMultiLive(window.lastLiveData || {})),
                'natation': () => import('../../modules/natation/natation-live.js').then(m => m.renderNatationLive()),
                'relais': () => import('../../modules/relais/relais-live.js').then(m => m.renderRelaisLive()),
                'tournoi': () => {
                    return import('../../modules/tournoi/variantes/elimination/elimination-live.js')
                        .then(module => module.renderEliminationLive())
                        .catch(err => {
                            console.error('Erreur Live Tournoi :', err);
                            container.innerHTML = '<p class="text-red-400">Erreur de chargement du Live.</p>';
                        });
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
                        'escalade': () => import('../../modules/escalade/escalade-tv-ui.js').then(m => m.renderEscaladeTV('classic')),
                        'bloccontest': () => import('../../modules/escalade/escalade-tv-ui.js').then(m => m.renderEscaladeTV('bloc')),
                        'co': () => {
                            const coModule = getModule('co');
                            return coModule?.renderTV ? coModule.renderTV() : Promise.resolve();
                        },
                        'arcathlon': () => import('../../modules/arcathlon/arcathlon-tv.js').then(m => m.renderArcathlonTV()),
                        'natation': () => import('../../modules/natation/natation-tv.js').then(m => m.renderNatationTV()),
                        'relais': () => import('../../modules/relais/relais-tv.js').then(m => m.renderRelaisTV()),
                        'tournoi': () => {
                            return import('../../modules/tournoi/variantes/elimination/elimination-tv.js')
                                .then(module => module.renderEliminationTV())
                                .catch(err => {
                                    console.error('Erreur TV Tournoi :', err);
                                    document.getElementById('tvGlobe').innerHTML = '<p class="text-red-400">Erreur de chargement de la TV.</p>';
                                });
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
            'relais': async () => {
                const m = await import('../../modules/relais/relais-interface.js');
                await m.transmettreRelaisConfig();
            },
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
            },
            'arcathlon': async () => {
                await transmettreArcathlonConfig();
            },
            'natation': async () => {
                await transmettreNatationConfig();
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
    // MODAL DE PURGE
    // ============================================================
    window.openPurgeModal = function() {
        const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
        const basePath = `etablissements/0680013V/profs/${profCode}`;

        const overlay = document.createElement('div');
        overlay.id = 'purge-modal-overlay';
        overlay.className = 'fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4';
        overlay.style.overflowY = 'auto';

        const modal = document.createElement('div');
        modal.className = 'bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto';
        modal.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-black text-blue-400 uppercase">🗑️ Gestion des purges</h2>
                <button onclick="window.closePurgeModal()" class="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-xl font-black text-sm text-white transition-colors">
                    ✖ Fermer
                </button>
            </div>
            <p class="text-sm text-slate-400 mb-4">
                <span class="text-emerald-400">●</span> Sélectionne les éléments à supprimer. 
                <span class="text-yellow-400 font-bold">⚠️ Les suppressions sont irréversibles.</span>
                <br><span class="text-xs text-slate-500">Seul ton espace personnel (<strong>${profCode}</strong>) est accessible.</span>
            </p>
            <div id="purge-loading" class="text-center py-10 text-slate-400">
                <p>⏳ Chargement des données...</p>
            </div>
            <div id="purge-content" class="hidden space-y-6"></div>
            <div id="purge-actions" class="hidden mt-8 border-t border-slate-700 pt-6 space-y-3">
                <button id="purge-selected-btn" class="w-full bg-red-600 hover:bg-red-700 py-4 rounded-2xl font-black text-white text-xl active:scale-95 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                    🗑️ Supprimer les activités sélectionnées
                </button>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button id="purge-all-classes-btn" class="bg-orange-600 hover:bg-orange-700 py-3 rounded-xl font-black text-sm text-white active:scale-95 transition-colors">
                        🧹 Supprimer toutes MES classes
                    </button>
                    <button id="purge-all-data-only-btn" class="bg-amber-600 hover:bg-amber-700 py-3 rounded-xl font-black text-sm text-white active:scale-95 transition-colors">
                        📄 Supprimer les DONNÉES (sans config) de toutes mes classes
                    </button>
                </div>
            </div>
        `;
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        window.closePurgeModal = function() {
            const el = document.getElementById('purge-modal-overlay');
            if (el) el.remove();
        };
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) window.closePurgeModal();
        });

        loadPurgeData(basePath);
    };

    async function loadPurgeData(basePath) {
        const loading = document.getElementById('purge-loading');
        const content = document.getElementById('purge-content');
        const actions = document.getElementById('purge-actions');

        try {
            const classesRef = ref(db, basePath);
            const snapshot = await new Promise((resolve) => {
                onValue(classesRef, resolve, { onlyOnce: true });
            });
            const classesData = snapshot.val() || {};
            const classNames = Object.keys(classesData).filter(key => key !== 'active_classes' && key !== 'live' && key !== 'config');

            if (classNames.length === 0) {
                loading.innerHTML = '<p class="text-yellow-400">ℹ️ Aucune classe trouvée dans ton espace.</p>';
                return;
            }

            loading.classList.add('hidden');
            content.classList.remove('hidden');
            actions.classList.remove('hidden');

            let html = '';

            for (const className of classNames) {
                const classPath = `${basePath}/${className}`;
                const classRef = ref(db, classPath);
                const classSnap = await new Promise((resolve) => {
                    onValue(classRef, resolve, { onlyOnce: true });
                });
                const classContent = classSnap.val() || {};
                const activityNames = Object.keys(classContent).filter(key => 
                    !['config', 'active_classes', 'live'].includes(key) && typeof classContent[key] === 'object'
                );

                if (activityNames.length === 0) {
                    html += `
                        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                            <h3 class="text-lg font-black text-white">${className}</h3>
                            <p class="text-sm text-slate-500 italic">Aucune activité détectée.</p>
                        </div>
                    `;
                    continue;
                }

                html += `
                    <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700" data-classe="${className}">
                        <div class="flex items-center gap-3 mb-3">
                            <input type="checkbox" class="classe-select-all w-5 h-5 accent-blue-500" data-classe="${className}">
                            <h3 class="text-xl font-black text-white">${className}</h3>
                            <span class="text-xs text-slate-400">(${activityNames.length} activité(s))</span>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 ml-6">
                `;

                for (const activity of activityNames) {
                    const hasConfig = classContent[activity]?.config !== undefined;
                    html += `
                        <div class="bg-slate-900 p-3 rounded-xl border border-slate-600 flex flex-wrap items-center gap-3" data-classe="${className}" data-activity="${activity}">
                            <input type="checkbox" class="activity-select w-5 h-5 accent-red-500" data-classe="${className}" data-activity="${activity}">
                            <span class="font-bold text-white text-sm flex-1">${activity}</span>
                            <div class="flex gap-2 text-xs">
                                <label class="flex items-center gap-1 text-slate-400">
                                    <input type="radio" name="mode_${className}_${activity}" value="data" checked class="mode-radio">
                                    Données
                                </label>
                                <label class="flex items-center gap-1 text-slate-400">
                                    <input type="radio" name="mode_${className}_${activity}" value="full" class="mode-radio">
                                    + Config
                                </label>
                            </div>
                            ${!hasConfig ? '<span class="text-[10px] text-amber-400 bg-amber-950 px-2 py-0.5 rounded-full">(pas de config)</span>' : ''}
                        </div>
                    `;
                }

                html += `
                        </div>
                    </div>
                `;
            }

            content.innerHTML = html;

            document.querySelectorAll('.classe-select-all').forEach(cb => {
                cb.addEventListener('change', function() {
                    const classe = this.dataset.classe;
                    const checkboxes = document.querySelectorAll(`.activity-select[data-classe="${classe}"]`);
                    checkboxes.forEach(c => c.checked = this.checked);
                    updatePurgeButtonState();
                });
            });

            document.querySelectorAll('.activity-select').forEach(cb => {
                cb.addEventListener('change', updatePurgeButtonState);
            });

            document.getElementById('purge-selected-btn').addEventListener('click', function() {
                const selected = [];
                document.querySelectorAll('.activity-select:checked').forEach(cb => {
                    const classe = cb.dataset.classe;
                    const activity = cb.dataset.activity;
                    const mode = document.querySelector(`input[name="mode_${classe}_${activity}"]:checked`)?.value || 'data';
                    selected.push({ classe, activity, mode });
                });

                if (selected.length === 0) {
                    alert('Aucune activité sélectionnée.');
                    return;
                }

                const msg = selected.map(s => `- ${s.classe} / ${s.activity} (${s.mode === 'data' ? 'Données uniquement' : 'Données + Config'})`).join('\n');
                if (!confirm(`⚠️ Supprimer définitivement :\n${msg}\n\nCette action est irréversible. Confirmer ?`)) return;

                let promises = selected.map(({ classe, activity, mode }) => {
                    const activityPath = `${basePath}/${classe}/${activity}`;
                    if (mode === 'full') {
                        return remove(ref(db, activityPath));
                    } else {
                        return deleteDataOnly(activityPath);
                    }
                });

                Promise.all(promises)
                    .then(() => {
                        alert('✅ Suppression(s) effectuée(s) avec succès !');
                        window.closePurgeModal();
                        location.reload();
                    })
                    .catch(err => {
                        console.error(err);
                        alert('❌ Erreur lors de la suppression : ' + err.message);
                    });
            });

            document.getElementById('purge-all-classes-btn').addEventListener('click', function() {
                if (!confirm(`⚠️ Supprimer TOUT ton espace (toutes les classes, toutes les activités) ?\nCette action est irréversible.`)) return;
                if (!confirm(`✅ Dernière confirmation : supprimer définitivement le dossier "${basePath}" ?`)) return;

                remove(ref(db, basePath))
                    .then(() => {
                        alert('✅ Toutes vos classes ont été supprimées.');
                        window.closePurgeModal();
                        location.reload();
                    })
                    .catch(err => {
                        console.error(err);
                        alert('❌ Erreur : ' + err.message);
                    });
            });

            document.getElementById('purge-all-data-only-btn').addEventListener('click', function() {
                if (!confirm(`⚠️ Supprimer toutes les DONNÉES (résultats, passages, etc.) de toutes vos classes ?\nLes configurations seront conservées.`)) return;
                if (!confirm(`✅ Dernière confirmation : lancer la suppression massive des données ?`)) return;

                const classesRef = ref(db, basePath);
                onValue(classesRef, async (snap) => {
                    const data = snap.val() || {};
                    const classNames = Object.keys(data).filter(k => !['active_classes', 'live', 'config'].includes(k));
                    let total = 0;
                    let errors = [];

                    for (const className of classNames) {
                        const classContent = data[className] || {};
                        const activityNames = Object.keys(classContent).filter(k => 
                            !['config', 'active_classes', 'live'].includes(k) && typeof classContent[k] === 'object'
                        );
                        for (const activity of activityNames) {
                            const activityPath = `${basePath}/${className}/${activity}`;
                            try {
                                await deleteDataOnly(activityPath);
                                total++;
                            } catch (e) {
                                errors.push(`${className}/${activity} : ${e.message}`);
                            }
                        }
                    }

                    if (errors.length > 0) {
                        alert(`⚠️ ${total} activité(s) nettoyée(s), mais des erreurs sont survenues :\n${errors.join('\n')}`);
                    } else {
                        alert(`✅ ${total} activité(s) nettoyée(s) (configs conservées).`);
                    }
                    window.closePurgeModal();
                    location.reload();
                }, { onlyOnce: true });
            });

            updatePurgeButtonState();

        } catch (err) {
            console.error(err);
            loading.innerHTML = `<p class="text-red-400">❌ Erreur de chargement : ${err.message}</p>`;
        }
    }

    async function deleteDataOnly(activityPath) {
        const activityRef = ref(db, activityPath);
        const snap = await new Promise((resolve) => {
            onValue(activityRef, resolve, { onlyOnce: true });
        });
        const content = snap.val() || {};

        const toDelete = Object.keys(content).filter(key => key !== 'config');
        if (toDelete.length === 0) {
            console.log(`ℹ️ Rien à supprimer dans ${activityPath} (seulement config ou vide).`);
            return;
        }

        const promises = toDelete.map(key => {
            const childRef = ref(db, `${activityPath}/${key}`);
            return remove(childRef);
        });

        await Promise.all(promises);
        console.log(`✅ Données supprimées (config conservée) dans ${activityPath}`);
    }

    function updatePurgeButtonState() {
        const checked = document.querySelectorAll('.activity-select:checked').length;
        const btn = document.getElementById('purge-selected-btn');
        if (btn) {
            btn.disabled = checked === 0;
            btn.textContent = checked === 0 ? '🗑️ Supprimer les activités sélectionnées' : `🗑️ Supprimer ${checked} activité(s) sélectionnée(s)`;
        }
    }

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
    // EXPORTS / IMPORTS
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

export default {
    initActivities
};