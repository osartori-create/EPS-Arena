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

// Fonction locale pour construire le chemin hiérarchique
function getBaseProf() {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    return `etablissements/0680013V/profs/${profCode}`;
}

// ==========================================
// LISTE DES COULEURS ET FONCTIONS DE PALETTE
// ==========================================
const colorOptions = [
    { name: "Rouge", hex: "#ef4444" },
    { name: "Bleu", hex: "#3b82f6" },
    { name: "Vert", hex: "#22c55e" },
    { name: "Jaune", hex: "#eab308" },
    { name: "Orange", hex: "#f97316" },
    { name: "Violet", hex: "#a855f7" },
    { name: "Rose", hex: "#ec4899" },
    { name: "Cyan", hex: "#06b6d4" },
    { name: "Blanc", hex: "#ffffff" },
    { name: "Noir", hex: "#000000" }
];

// Fonction pour calculer la couleur du texte en fonction du fond
function getContrastColor(hex) {
    const r = parseInt(hex.substr(1,2), 16);
    const g = parseInt(hex.substr(3,2), 16);
    const b = parseInt(hex.substr(5,2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
}

// Fonction globale pour ouvrir la palette (appelée par le clic sur "Couleur")
window.openColorPicker = function(teamId) {
    const team = window.lastTeams.find(t => t.id === teamId);
    if (!team) return;

    // Récupérer les couleurs déjà choisies par les autres équipes
    const usedColors = window.lastTeams
        .filter(t => t.id !== teamId && t.color !== '#e2e8f0')
        .map(t => t.color);
    
    // Créer la modale
    const modal = document.createElement('div');
    modal.id = 'colorPickerModal';
    modal.className = 'fixed inset-0 bg-black/90 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-slate-800 p-6 rounded-3xl border border-slate-700 w-full max-w-sm">
            <h3 class="text-xl font-black text-blue-400 uppercase mb-4 text-center">Choisir la couleur</h3>
            <div class="grid grid-cols-2 gap-3">
                ${colorOptions.map(color => {
                    const isUsed = usedColors.includes(color.hex);
                    return `
                    <button onclick="applyColor('${teamId}', '${color.name}', '${color.hex}')"
                            class="p-4 rounded-2xl font-bold text-lg border-2 transition-all flex items-center justify-center gap-2 ${isUsed ? 'opacity-30 cursor-not-allowed border-slate-700' : 'border-slate-600 hover:border-white'}"
                            style="background-color: ${color.hex}; color: ${getContrastColor(color.hex)}"
                            ${isUsed ? 'disabled' : ''}>
                        <span class="w-4 h-4 rounded-full border border-slate-500" style="background-color: ${color.hex}"></span>
                        ${color.name}
                        ${isUsed ? '<span class="text-red-400 font-black ml-1">✖</span>' : ''}
                    </button>`;
                }).join('')}
            </div>
            <button onclick="document.getElementById('colorPickerModal').remove()" 
                    class="w-full mt-6 bg-slate-700 py-3 rounded-xl font-bold text-white text-sm uppercase">
                Fermer
            </button>
        </div>
    `;
    document.body.appendChild(modal);
};

// Fonction pour appliquer la couleur choisie
window.applyColor = function(teamId, colorName, colorHex) {
    const team = window.lastTeams.find(t => t.id === teamId);
    if (team) {
        team.label = colorName;
        team.color = colorHex;
        team.textColor = getContrastColor(colorHex);
    }

    // Fermer la modale
    document.getElementById('colorPickerModal').remove();

    // Régénérer l'affichage avec le nouveau label
    window.renderTeams();
};

// Fonction pour régénérer l'affichage (utilisée après un changement de couleur)
window.renderTeams = async function() {
    const container = document.getElementById('teamsGrid');
    const options = window.lastOptions || {};
    if (!container || !window.lastTeams) return;

    const teamsHTML = await Promise.all(window.lastTeams.map(async (team) => {
        const membersHTML = await Promise.all(team.members.map(async (m) => {
            const url = await getPhotoUrl(m.id);
            const photoHtml = url 
                ? `<img src="${url}" class="w-10 h-10 rounded-full object-cover border-2 border-slate-500">`
                : `<div class="w-10 h-10 rounded-full bg-slate-400 flex items-center justify-center text-xl">👤</div>`;
            
            let bgClass = 'bg-slate-200 border-slate-400';
            if (m.sexe === 'M') bgClass = 'bg-blue-200 border-blue-400';
            else if (m.sexe === 'F') bgClass = 'bg-rose-200 border-rose-400';

            let criteriaHtml = '';
            if (options.critere === 'vma') {
                criteriaHtml = `<span class="text-emerald-700">VMA: ${m.vma || '--'}</span>`;
            } else if (options.critere === 'force') {
                let stars = '';
                for (let i = 1; i <= (m.force || 0); i++) stars += '★';
                criteriaHtml = `<span class="text-yellow-600 font-black">${stars}</span>`;
            } else {
                criteriaHtml = `<span class="text-purple-700">V: ${m.vma || '--'} | L: ${m.longueur || '--'} | 30m: ${m.sprint30 || '--'}</span>`;
            }

            return `<div class="p-2 rounded-lg border-2 ${bgClass} flex items-center gap-3 text-sm font-bold text-slate-900">
                        ${photoHtml}
                        <div class="flex flex-col leading-tight">
                            <span>${m.prenom} ${m.nom}</span>
                            <span class="text-[10px] font-bold">${criteriaHtml}</span>
                        </div>
                    </div>`;
        }));

        return `<div class="bg-slate-900 rounded-2xl p-4 border-2 relative" style="border-color: ${team.color}">
                    <div class="flex justify-between items-center mb-3">
                        <button onclick="openColorPicker('${team.id}')" 
                                class="font-black text-xl px-4 py-2 rounded-lg border-2 border-dashed border-slate-500 hover:border-white transition-colors"
                                style="background-color: ${team.color}; color: ${team.textColor}">
                            ${team.label}
                        </button>
                        <span class="text-xs text-slate-500">${team.members.length} joueurs</span>
                    </div>
                    <div class="team-members flex flex-col gap-2">
                        ${membersHTML.join('')}
                    </div>
                </div>`;
    }));
    container.innerHTML = teamsHTML.join('');
};


export function initActivities() {
    try { initCOInterface(); } catch (e) {}
    try { initEscaladeInterface(6); } catch (e) {}
    try { initBadmintonInterface(6); } catch (e) {}
    try { initOrientShowInterface(); } catch (e) {}

    window.switchDiscipline = function(disc) {
        currentDiscipline = disc;
        localStorage.setItem('eps_arena_current_discipline', disc);

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
        if (disc === 'badminton') {
            try {
                initBadmintonInterface();
                initSortableBadminton();
                loadBadmintonAssignments();
            } catch (e) {}
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

        generateBadmintonTeams(eleves);
        alert("✅ Terrains générés par niveau de force !");
    };

    // Fonction pour ajouter un terrain supplémentaire
        window.addBadmintonTerrain = function() {
        let nb = window.currentBadmintonTerrains || 6;
        nb++;
        // Force la recréation de la grille avec le nouveau nombre
        initBadmintonInterface(nb, true);
        // Recharge les affectations existantes
        setTimeout(() => loadBadmintonAssignments(), 100);
        alert("✅ Terrain " + nb + " ajouté !");
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