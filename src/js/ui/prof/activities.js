// src/js/ui/prof/activities.js
import { initCOInterface, populateReserve, populateReserveWithStudents, initSortableCO, loadCOAssignments, exportCOConfig, importCOConfig } from '../../modules/co/co-interface.js';
import { initEscaladeInterface, populateReserveEscalade, initSortableEscalade, loadEscaladeAssignments, exportEscaladeConfig, importEscaladeConfig } from '../../modules/escalade/escalade-interface.js';
import { generateTeams } from '../../modules/teams/team-generator.js';
import { getPhotoUrl } from '../../services/admin-service.js';
import { renderCircuits, getCircuits, addCircuit as addCircuitCO, editCircuit as editCircuitCO, delCircuit } from '../../modules/co/circuit-manager.js';
import { initEscaladeListener, calculerStatsGlobales, exportIDoceo } from '../../modules/escalade/escalade-controller.js';

let currentDiscipline = 'multi';

export function initActivities() {
    initPalette();
    initCOInterface();
    initEscaladeInterface(); // Initialisation de l'interface Escalade

    const classeSelect = document.getElementById('selectClasse');
    if (classeSelect) {
        classeSelect.addEventListener('change', () => {
            const coView = document.getElementById('viewCOSettings');
            if (coView && !coView.classList.contains('hidden')) loadCOAssignments();
            const escView = document.getElementById('viewEscaladeSettings');
            if (escView && !escView.classList.contains('hidden')) loadEscaladeAssignments();
        });
    }

    window.switchDiscipline = function(disc) {
        currentDiscipline = disc;
        const panneaux = ['multi', 'co', 'arcathlon', 'escalade'];

        panneaux.forEach(d => {
            const viewId = 'view' + d.charAt(0).toUpperCase() + d.slice(1) + 'Settings';
            const el = document.getElementById(viewId);
            if (el) el.classList.add('hidden');
        });

        panneaux.forEach(d => {
            const btn = document.getElementById('btnDisc-' + d);
            if (btn) {
                if (d === disc) {
                    btn.classList.remove('border-slate-600', 'text-slate-400');
                    btn.classList.add('border-blue-500', 'text-blue-400');
                } else {
                    btn.classList.remove('border-blue-500', 'text-blue-400');
                    btn.classList.add('border-slate-600', 'text-slate-400');
                }
            }
        });

        const targetView = document.getElementById('view' + disc.charAt(0).toUpperCase() + disc.slice(1) + 'Settings');
        if (targetView) targetView.classList.remove('hidden');

        if (disc === 'co') {
            const circuitList = document.getElementById('circuitList');
            if (circuitList) renderCircuits('circuitList', "");
            initSortableCO();
            loadCOAssignments();
        }

        if (disc === 'escalade') {
            initSortableEscalade();
            loadEscaladeAssignments();
            // On initialise l'écoute Firebase
            const activeClasse = document.getElementById('selectClasse').value;
            if (activeClasse) initEscaladeListener(activeClasse, (montees) => {
                const stats = calculerStatsGlobales(montees);
                if (document.getElementById('total-metres')) document.getElementById('total-metres').innerText = stats.totalMetres;
            });
        }
    };

    function initPalette() { /* ... identique ... */ }
    window.toggleCouleur = function(couleur) { /* ... identique ... */ };

    window.generateTeams = async function() {
        const activeClasse = document.getElementById('selectClasse').value;
        if (!activeClasse) return alert("Sélectionnez une classe d'abord.");
        const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');
        if (eleves.length === 0) return alert("Aucun élève dans cette classe.");

        const coView = document.getElementById('viewCOSettings');
        const isCOVisible = coView && !coView.classList.contains('hidden');
        const escView = document.getElementById('viewEscaladeSettings');
        const isEscVisible = escView && !escView.classList.contains('hidden');

        if (currentDiscipline === 'co' || isCOVisible) {
            await populateReserveWithStudents(eleves);
            document.getElementById('teamsGrid').innerHTML = '';
            return;
        }

        if (currentDiscipline === 'escalade' || isEscVisible) {
            await populateReserveEscalade(eleves);
            document.getElementById('teamsGrid').innerHTML = '';
            return;
        }

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

        const teams = generateTeams(eleves, options);
        
        populateReserve(teams);

        const teamsWithPhotos = [];
        for (const team of teams) {
            const membersWithPhotos = [];
            for (const m of team.members) {
                const url = await getPhotoUrl(m.id);
                membersWithPhotos.push({ ...m, photoUrl: url });
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
                        
                        let starsHtml = '';
                        const force = m.force || 0;
                        if (force > 0) starsHtml = '<span class="text-yellow-400 text-xs">' + '★'.repeat(force) + '</span>';

                        return `
                            <div class="bg-slate-800 p-2 rounded-lg text-sm font-bold text-white flex items-center gap-3" data-id="${m.id}">
                                ${photoHtml}
                                <div class="flex flex-col flex-1">
                                    <span>${m.prenom} ${m.nom}</span>
                                    ${starsHtml}
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
                onEnd: function(evt) {
                    console.log("Nouvelle répartition détectée");
                }
            });
            window.sortableInstances.push(sortable);
        });

        document.getElementById('nbEquipes').value = options.nbEquipes;
        document.getElementById('nbParEquipe').value = options.nbParEquipe;
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

    // Initialisation de l'écoute Escalade (appelée depuis switchDiscipline)
    window.initEscalade = function() {
        const activeClasse = document.getElementById('selectClasse').value;
        if (!activeClasse) return;
        
        initEscaladeListener(activeClasse, (montees) => {
            const stats = calculerStatsGlobales(montees);
            // Mise à jour de l'interface
            document.getElementById('total-metres').innerText = stats.totalMetres;
            document.getElementById('progress-bar').style.width = stats.progressionPct + "%";
            
            // Top 5
            const top5List = document.getElementById('top-5-list');
            top5List.innerHTML = stats.top5.map((s, i) => 
                `<div class="flex justify-between items-center bg-white/5 p-2 rounded-lg border-l-4 border-blue-500">
                    <span class="font-bold text-[10px]">${i+1}. ${s.code}</span>
                    <span class="font-black text-emerald-400">${s.score}m</span>
                </div>`
            ).join('');
            
            // Mise à jour du tableau des élèves
            updateStudentTable(montees);
        });
    };

    function updateStudentTable(montees) {
        // (Cette fonction sera complétée lors de l'intégration avec les élèves, 
        // elle utilisera les données locales pour afficher les noms)
    }

    // Exports
        window.exportCOConfig = exportCOConfig;
        window.importCOConfig = importCOConfig;
        window.exportEscaladeConfig = exportEscaladeConfig;
        window.importEscaladeConfig = importEscaladeConfig;
        window.exportIDoceo = exportIDoceo;
}