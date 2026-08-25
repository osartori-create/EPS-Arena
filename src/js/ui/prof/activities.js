// src/js/ui/prof/activities.js
import { initCOInterface, populateReserveWithStudents, initSortableCO, loadCOAssignments, exportCOConfig, importCOConfig } from '../../modules/co/co-interface.js';
import { initEscaladeInterface, populateReserveEscalade, initSortableEscalade, loadEscaladeAssignments, exportEscaladeConfig, importEscaladeConfig } from '../../modules/escalade/escalade-interface.js';
import { generateTeams as generateClassicTeams } from '../../modules/teams/team-generator.js';
import { getPhotoUrl } from '../../services/admin-service.js';
import { renderCircuits, getCircuits, addCircuit as addCircuitCO, editCircuit as editCircuitCO, delCircuit } from '../../modules/co/circuit-manager.js';
import { calculerStatsGlobales, initEscaladeListener, exportIDoceo } from '../../modules/escalade/escalade-controller.js';
import { db, ref, set } from '../../core/firebase-service.js';

let currentDiscipline = 'multi';

// Dictionnaire pour éviter les erreurs de casse
const VIEW_MAP = {
    'multi': 'viewMultiSettings',
    'co': 'viewCOSettings',
    'arcathlon': 'viewArcathlonSettings',
    'escalade': 'viewEscaladeSettings'
};

export function initActivities() {
    initPalette();

    const classeSelect = document.getElementById('selectClasse');
    if (classeSelect) {
        classeSelect.addEventListener('change', () => {
            if (currentDiscipline === 'co') {
                try { loadCOAssignments(); } catch(e) { console.error("Change Classe CO:", e); }
            }
            if (currentDiscipline === 'escalade') {
                try { loadEscaladeAssignments(); } catch(e) { console.error("Change Classe Escalade:", e); }
            }
        });
    }

    window.switchDiscipline = function(disc) {
        currentDiscipline = disc;
        console.log("👉 Changement d'onglet vers :", disc);

        // 1. On cache tous les panneaux
        ['multi', 'co', 'arcathlon', 'escalade'].forEach(d => {
            const btn = document.getElementById('btnDisc-' + d);
            if (btn) {
                btn.classList.remove('border-blue-500', 'text-blue-400');
                btn.classList.add('border-slate-600', 'text-slate-400');
            }
            const viewId = VIEW_MAP[d];
            const el = document.getElementById(viewId);
            if (el) el.classList.add('hidden');
        });

        // 2. On style le bouton actif
        const activeBtn = document.getElementById('btnDisc-' + disc);
        if (activeBtn) {
            activeBtn.classList.remove('border-slate-600', 'text-slate-400');
            activeBtn.classList.add('border-blue-500', 'text-blue-400');
        }

        // 3. On AFFICHE le panneau via le dictionnaire
        const targetView = document.getElementById(VIEW_MAP[disc]);
        if (targetView) {
            targetView.classList.remove('hidden');
            console.log("✅ Panneau affiché :", targetView.id);
        } else {
            console.error("❌ Panneau INTROUVABLE ! ID attendu :", VIEW_MAP[disc]);
            return;
        }

        // 4. Initialisation des modules
        if (disc === 'co') {
            try {
                initCOInterface();
                const circuitList = document.getElementById('circuitList');
                if (circuitList) renderCircuits('circuitList', "");
                initSortableCO();
                loadCOAssignments();
            } catch (e) {
                console.error("Erreur lors de l'init CO :", e);
            }
        }

        if (disc === 'escalade') {
            try {
                const activeClasse = document.getElementById('selectClasse').value;
                const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');
                const nbColonnes = Math.ceil(eleves.length / 3) || 6;
                initEscaladeInterface(nbColonnes);
                initSortableEscalade();
                loadEscaladeAssignments();
                
                if (activeClasse) {
                    initEscaladeListener(activeClasse, (montees) => {
                        const stats = calculerStatsGlobales(montees);
                        if (document.getElementById('total-metres')) document.getElementById('total-metres').innerText = stats.totalMetres;
                        if (document.getElementById('progress-bar')) document.getElementById('progress-bar').style.width = stats.progressionPct + "%";
                    });
                }
            } catch (e) {
                console.error("Erreur lors de l'init Escalade :", e);
            }
        }
    };

    function initPalette() {
        const paletteContainer = document.getElementById('paletteCouleurs');
        if (!paletteContainer) return;
        const couleursDispo = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#f97316', '#a855f7', '#ec4899', '#06b6d4', '#ffffff', '#000000'];
        paletteContainer.innerHTML = couleursDispo.map(c => 
            `<div onclick="toggleCouleur('${c}')" data-couleur="${c}" class="w-8 h-8 rounded-full border-2 border-slate-600 cursor-pointer active:scale-90" style="background-color: ${c}"></div>`
        ).join('');
    }

    window.toggleCouleur = function(couleur) {
        const el = document.querySelector(`[data-couleur="${couleur}"]`);
        if (el) {
            el.classList.toggle('border-emerald-400');
            el.classList.toggle('border-slate-600');
        }
    };

    // ✅ Fonction Transmettre CORRIGÉE (plus de doublon ni de firebase global)
        window.transmettreConfig = async function() {
        const activeClasse = document.getElementById('selectClasse').value;
        if (!activeClasse) return alert("Sélectionnez une classe d'abord.");
        
        let configData = {};
        let localMapping = {}; // Stockage local Code -> ID (RGPD)

        if (currentDiscipline === 'co') {
            configData = JSON.parse(localStorage.getItem(`eps_arena_co_assignments_${activeClasse}`) || '{}');
            configData.activite = 'co';
            // On reconstruit le mapping local pour la CO
            const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');
            Object.keys(configData).forEach(poste => {
                if (poste !== 'activite' && poste !== 'reserve' && Array.isArray(configData[poste])) {
                    // Le mapping "C4 -> ID" est stocké localement
                    localMapping[`${activeClasse}_${poste}`] = configData[poste];
                }
            });
        } 
        else if (currentDiscipline === 'escalade') {
            configData = JSON.parse(localStorage.getItem(`eps_arena_escalade_assignments_${activeClasse}`) || '{}');
            configData.activite = 'escalade';
            // Idem pour l'escalade
            const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');
            Object.keys(configData).forEach(groupe => {
                if (groupe !== 'activite' && groupe !== 'reserve' && Array.isArray(configData[groupe])) {
                    localMapping[`${activeClasse}_${groupe}`] = configData[groupe];
                }
            });
        } 
        else {
            // Multi-activités : On reconstruit la structure
            configData.activite = 'multi';
            
            if (window.lastTeams) {
                const lettres = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
                window.lastTeams.forEach((team, index) => {
                    const lettre = lettres[index] || `EQ${index+1}`;
                    // ✅ ON N'ENVOIE QUE LA LONGUEUR DU TABLEAU (pas les IDs) !
                    configData[lettre] = team.members.length; 
                    
                    // ✅ ON SAUVEGARDE LE MAPPING EN LOCAL
                    team.members.forEach((m, i) => {
                        localMapping[`${activeClasse}_${lettre}${i+1}`] = m.id;
                    });
                });
            } else {
                return alert("⚠️ Veuillez d'abord générer les équipes avant de transmettre !");
            }
        }

        // Sauvegarde locale du mapping (aucune donnée sensible dans Firebase)
        localStorage.setItem(`eps_arena_local_mapping_${activeClasse}`, JSON.stringify(localMapping));

        try {
            await set(ref(db, `${activeClasse}/config`), configData);
            alert("✅ Configuration transmise aux iPads ! (Aucun nom envoyé sur Firebase)");
        } catch(e) {
            console.error("Erreur transmission :", e);
            alert("❌ Erreur lors de la transmission.");
        }
    };

    window.generateTeams = async function() {
        const activeClasse = document.getElementById('selectClasse').value;
        if (!activeClasse) return alert("Sélectionnez une classe d'abord.");
        const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');
        if (eleves.length === 0) return alert("Aucun élève dans cette classe.");

        if (currentDiscipline === 'co') {
            initCOInterface();
            await populateReserveWithStudents(eleves);
            alert("Tous les élèves sont dans la réserve CO. Glissez-les dans les postes !");
            return;
        }

        if (currentDiscipline === 'escalade') {
            const nbColonnes = Math.ceil(eleves.length / 3) || 6;
            initEscaladeInterface(nbColonnes);
            await populateReserveEscalade(eleves);
            alert("Tous les élèves sont dans la réserve Escalade. Glissez-les dans les groupes !");
            return;
        }

        // Multi-activités : génération classique sans réserve
        const options = {
            mode: document.getElementById('modeRepartition').value,
            mixite: document.getElementById('modeMixite').value,
            critere: document.getElementById('critereForce').value,
            formatLibelle: document.getElementById('formatLibelle').value,
            nbEquipes: parseInt(document.getElementById('nbEquipes').value) || 0,
            nbParEquipe: parseInt(document.getElementById('nbParEquipe').value) || 0,
            couleurs: Array.from(document.querySelectorAll('#paletteCouleurs .border-emerald-400')).map(el => el.dataset.couleur),
        };
        if (!options.nbEquipes && options.nbParEquipe) options.nbEquipes = Math.ceil(eleves.length / options.nbParEquipe);
        else if (options.nbEquipes && !options.nbParEquipe) options.nbParEquipe = Math.ceil(eleves.length / options.nbEquipes);

        const teams = generateClassicTeams(eleves, options);

        const teamsWithPhotos = [];
        for (const team of teams) {
            const membersWithPhotos = [];
            for (const m of team.members) {
                const url = await getPhotoUrl(m.id);
                let infoCritere = '';
                if (options.critere === 'polyvalent') {
                    infoCritere = `<span class="text-emerald-400 text-xs font-bold">VMA: ${m.vma || '--'} | L: ${m.longueur || '--'}cm | 30m: ${m.sprint30 || '--'}s</span>`;
                } else if (options.critere === 'vma') {
                    infoCritere = `<span class="text-emerald-400 text-xs font-bold">VMA: ${m.vma || '--'}</span>`;
                } else {
                    let starsHtml = '';
                    const force = m.force || 0;
                    if (force > 0) starsHtml = '<span class="text-yellow-400 text-xs">' + '★'.repeat(force) + '</span>';
                    infoCritere = starsHtml;
                }
                membersWithPhotos.push({ ...m, photoUrl: url, infoCritere: infoCritere });
            }
            teamsWithPhotos.push({ ...team, members: membersWithPhotos });
        }

        const container = document.getElementById('teamsGrid');
        container.innerHTML = teamsWithPhotos.map(team => `
            <div class="bg-slate-900 rounded-2xl p-4 border-2" style="border-color: ${team.color}">
                <div class="flex justify-between items-center mb-3">
                    <h3 class="font-black text-xl" style="color: ${team.color}">${team.label}</h3>
                    <button onclick="event.stopPropagation(); renameTeam('${team.id}')" class="text-[10px] text-slate-400 underline">Renommer</button>
                </div>
                <div class="team-members flex flex-col gap-2 min-h-[60px]" data-team-id="${team.id}">
                    ${team.members.map(m => {
                        const photoHtml = m.photoUrl 
                            ? `<img src="${m.photoUrl}" class="w-10 h-10 rounded-full object-cover border border-slate-600">`
                            : `<div class="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-xl">👤</div>`;

                        return `
                            <div class="bg-slate-800 p-2 rounded-lg text-sm font-bold text-white flex items-center gap-3" data-id="${m.id}">
                                ${photoHtml}
                                <div class="flex flex-col flex-1">
                                    <span>${m.prenom} ${m.nom}</span>
                                    ${m.infoCritere}
                                </div>
                                <span class="text-3xl font-black text-white pr-2">${m.rank}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `).join('');

        if (window.sortableInstances) {
            window.sortableInstances.forEach(s => s.destroy());
        }
        window.sortableInstances = [];
        
        document.querySelectorAll('.team-members').forEach(el => {
            const sortable = new Sortable(el, {
                group: 'teams',
                animation: 150,
                onEnd: function(evt) { console.log("Nouvelle répartition détectée"); }
            });
            window.sortableInstances.push(sortable);
        });

        document.getElementById('nbEquipes').value = options.nbEquipes;
        document.getElementById('nbParEquipe').value = options.nbParEquipe;

        // ✅ AJOUT OBLIGATOIRE : On sauvegarde les équipes générées pour la transmission
        window.lastTeams = teams;
    };

    window.renameTeam = function(teamId) {
        const newName = prompt("Nouveau nom pour cette équipe ?");
        if (newName) {
            const teamDiv = document.querySelector(`[data-team-id="${teamId}"]`).parentElement;
            const h3 = teamDiv.querySelector('h3');
            h3.textContent = newName;
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

    window.autoAssignCodes = function() {
        alert("Fonction d'assignation automatique des codes (à connecter avec les équipes générées)");
    };

    window.exportCOConfig = exportCOConfig;
    window.importCOConfig = importCOConfig;
    window.exportEscaladeConfig = exportEscaladeConfig;
    window.importEscaladeConfig = importEscaladeConfig;
    window.exportIDoceo = exportIDoceo;
}