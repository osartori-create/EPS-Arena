// src/js/ui/prof/activities.js
import { initCOInterface, populateReserveWithStudents, initSortableCO, loadCOAssignments, exportCOConfig, importCOConfig } from '../../modules/co/co-interface.js';
import { initEscaladeInterface, populateReserveEscalade, initSortableEscalade, loadEscaladeAssignments, exportEscaladeConfig, importEscaladeConfig } from '../../modules/escalade/escalade-interface.js';
import { renderCircuits, getCircuits, addCircuit as addCircuitCO, editCircuit as editCircuitCO, delCircuit } from '../../modules/co/circuit-manager.js';
import { generateTeams as generateClassicTeams } from '../../modules/teams/team-generator.js';
import { getPhotoUrl } from '../../services/admin-service.js';
import { db, ref, set, remove } from '../../core/firebase-service.js';
import { initOrientShowInterface, loadOrientShowAssignments, exportOrientShowConfig, importOrientShowConfig, startOrientShow, stopOrientShow } from '../../modules/orientshow/orientshow-interface.js';
import { initBadmintonInterface, generateBadmintonTeams, loadBadmintonAssignments, initSortableBadminton, saveBadmintonAssignments, updateCodes, exportBadmintonConfig, importBadmintonConfig, transmettreBadmintonConfig } from '../../modules/badminton/badminton-interface.js';
import { initArcathlonInterface, generateArcathlonTeams, transmettreArcathlonConfig } from '../../modules/arcathlon/arcathlon-interface.js';
import { initEvaluationInterface } from '../../modules/evaluation/evaluation-interface.js';
import { loadTournoiVariant } from '../../modules/tournoi/tournoi-dispatcher.js';
import { initBlocProf, cleanupBlocProf } from '../../modules/escalade/escalade-prof-blocs.js';

// ✅ NOUVEAUX IMPORTS POUR LE SÉLECTEUR DE MODE BADMINTON
import { getModesList } from '../../modules/badminton/badminton-registry.js';
import { initBadmintonModeSelector, setBadmintonMode } from '../../modules/badminton/badminton-ui-prof.js';

let currentDiscipline = 'multi';
let escaladeMode = 'classic';
// ============================================================
// UTILITAIRE : COULEUR CLAIRE ?
// ============================================================
function isLightColor(hex) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
}

// ============================================================
// NOM DES COULEURS
// ============================================================
function getColorName(hex) {
    const map = {
        '#ef4444': 'Rouge',
        '#3b82f6': 'Bleu',
        '#22c55e': 'Vert',
        '#eab308': 'Jaune',
        '#f97316': 'Orange',
        '#a855f7': 'Violet',
        '#ec4899': 'Rose',
        '#06b6d4': 'Cyan',
        '#ffffff': 'Blanc',
        '#000000': 'Noir'
    };
    return map[hex] || 'Couleur';
}

// ============================================================
// EXPOSITION GLOBALE DES FONCTIONS
// ============================================================

// Palette de couleurs
window.openColorPicker = function(teamId) {
    const allTeams = document.querySelectorAll('.team-members');
    const usedColors = new Set();
    allTeams.forEach(el => {
        const id = el.dataset.teamId;
        if (id !== teamId) {
            const parent = el.closest('.bg-slate-900');
            if (parent) {
                const borderColor = parent.style.borderColor;
                if (borderColor) usedColors.add(borderColor);
            }
        }
    });

    const palette = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#f97316', '#a855f7', '#ec4899', '#06b6d4', '#ffffff', '#000000'];
    const currentColor = window.teamColorState?.[teamId] || '#3b82f6';
    const availableColors = palette.filter(c => !usedColors.has(c) || c === currentColor);

    const modalHtml = `
        <div id="colorPickerModal" class="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
            <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 max-w-md w-full">
                <h3 class="text-xl font-black text-white text-center mb-4">Choisis une couleur</h3>
                <div class="grid grid-cols-5 gap-3">
                    ${availableColors.map(c => {
                        const isSelected = c === currentColor;
                        return `
                            <div onclick="window.selectTeamColor('${teamId}', '${c}')" 
                                 class="w-16 h-16 rounded-full border-4 cursor-pointer hover:scale-105 transition-transform ${isSelected ? 'border-white ring-4 ring-blue-500' : 'border-slate-600'}"
                                 style="background-color: ${c}">
                            </div>
                        `;
                    }).join('')}
                </div>
                <button onclick="document.getElementById('colorPickerModal').remove()" 
                        class="w-full mt-6 bg-slate-700 py-3 rounded-xl font-black text-white text-sm uppercase active:scale-95 transition-transform">
                    Annuler
                </button>
            </div>
        </div>
    `;

    const oldModal = document.getElementById('colorPickerModal');
    if (oldModal) oldModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.selectTeamColor = function(teamId, color) {
    if (!window.teamColorState) window.teamColorState = {};
    window.teamColorState[teamId] = color;
    localStorage.setItem('eps_arena_team_colors', JSON.stringify(window.teamColorState));

    const teamCard = document.querySelector(`[data-team-id="${teamId}"]`)?.closest('.bg-slate-900');
    if (teamCard) {
        teamCard.style.borderColor = color;
        const h3 = teamCard.querySelector('h3');
        if (h3) {
            h3.style.color = color;
            const formatLibelle = document.getElementById('formatLibelle')?.value || 'Couleurs';
            if (formatLibelle === 'Couleurs') {
                const colorName = getColorName(color);
                h3.textContent = colorName;
            }
        }
    }
    const modal = document.getElementById('colorPickerModal');
    if (modal) modal.remove();
};

window.renameTeam = function(teamId) {
    const newName = prompt("Nouveau nom pour cette équipe ?");
    if (newName) {
        const teamDiv = document.querySelector(`[data-team-id="${teamId}"]`)?.parentElement;
        if (teamDiv) {
            const h3 = teamDiv.querySelector('h3');
            if (h3) h3.textContent = newName;
        }
    }
};

// ============================================================
// GESTION DES STATUTS (ABSENT / INAPTE)
// ============================================================
window.setEleveStatut = function(eleveId, statut) {
    const activeClasse = document.getElementById('selectClasse').value;
    if (!activeClasse) return;

    const key = `eps_arena_multi_statuts_${activeClasse}`;
    const statuts = JSON.parse(localStorage.getItem(key) || '{}');
    statuts[eleveId] = statut;
    localStorage.setItem(key, JSON.stringify(statuts));

    window.generateTeams();
};

// ============================================================
// EXPORT / IMPORT JSON MULTI
// ============================================================
window.exportMultiConfig = function() {
    const activeClasse = document.getElementById('selectClasse').value;
    if (!activeClasse) return alert("Sélectionnez une classe.");

    const teams = window.lastTeams || [];
    const teamColors = window.teamColorState || {};
    const statuts = JSON.parse(localStorage.getItem(`eps_arena_multi_statuts_${activeClasse}`) || '{}');
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');

    const data = {
        version: 2,
        classe: activeClasse,
        activite: 'multi',
        date: new Date().toISOString().slice(0,10).replace(/-/g,''),
        equipes: teams.map(team => ({
            id: team.id,
            label: team.label,
            color: teamColors[team.id] || team.color || '#3b82f6',
            membres: team.members.map(m => m.id)
        })),
        statuts: statuts,
        eleves: eleves.map(e => ({ id: e.id, nom: e.nom, prenom: e.prenom, sexe: e.sexe, vma: e.vma, force: e.force, longueur: e.longueur, sprint30: e.sprint30 }))
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${activeClasse}_multi_${data.date}.json`;
    a.click();
};

window.importMultiConfig = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.classe || !data.equipes) throw new Error("Format de fichier invalide.");

            if (data.statuts) {
                localStorage.setItem(`eps_arena_multi_statuts_${data.classe}`, JSON.stringify(data.statuts));
            }
            const colors = {};
            data.equipes.forEach(eq => {
                colors[eq.id] = eq.color || '#3b82f6';
            });
            window.teamColorState = colors;
            localStorage.setItem('eps_arena_team_colors', JSON.stringify(colors));

            if (data.eleves) {
                localStorage.setItem(`eps_arena_eleves_${data.classe}`, JSON.stringify(data.eleves));
            }

            const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${data.classe}`) || '[]');
            const teams = data.equipes.map(eq => {
                const membres = eq.membres.map(id => eleves.find(e => e.id === id)).filter(Boolean);
                return {
                    id: eq.id,
                    label: eq.label || 'Couleur',
                    color: eq.color || '#3b82f6',
                    members: membres
                };
            });

            window.lastTeams = teams;

            const select = document.getElementById('selectClasse');
            if (select.value !== data.classe) {
                select.value = data.classe;
                select.dispatchEvent(new Event('change'));
            }

            await window.generateTeams();
            alert("✅ Configuration Multi importée avec succès !");
        } catch (err) {
            alert("❌ Erreur d'import : " + err.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
};

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
    
    try { console.log("→ Initialisation CO..."); initCOInterface(); console.log("✅ CO OK"); } catch (e) { console.error("❌ Erreur CO :", e); }
    try { console.log("→ Initialisation Escalade..."); initEscaladeInterface(6); console.log("✅ Escalade OK"); } catch (e) { console.error("❌ Erreur Escalade :", e); }
    try { console.log("→ Initialisation Badminton..."); initBadmintonInterface(6); console.log("✅ Badminton OK"); } catch (e) { console.error("❌ Erreur Badminton :", e); }
    try { console.log("→ Initialisation OrientShow..."); initOrientShowInterface(); console.log("✅ OrientShow OK"); } catch (e) { console.error("❌ Erreur OrientShow :", e); }
    try { console.log("→ Initialisation Arcathlon..."); initArcathlonInterface(); console.log("✅ Arcathlon OK"); } catch (e) { console.error("❌ Erreur Arcathlon :", e); }
    try { console.log("→ Initialisation Évaluation..."); initEvaluationInterface(); console.log("✅ Évaluation OK"); } catch (e) { console.error("❌ Erreur Évaluation :", e); }

    // ✅ NOUVEAU : Initialisation du sélecteur de mode Badminton
    try {
        initBadmintonModeSelector();
        console.log("✅ Sélecteur de mode Badminton initialisé");
    } catch (e) {
        console.error("❌ Erreur initBadmintonModeSelector :", e);
    }

    try {
        initEscaladeModeSelector();
        console.log("✅ Sélecteur de mode Escalade initialisé");
    } catch (e) {
        console.error("❌ Erreur initEscaladeModeSelector :", e);
    }
    // Palette de couleurs pour Multi-activités
    initPalette();


    // ============================================================
    // CHANGEMENT DE DISCIPLINE
    // ============================================================
    window.switchDiscipline = function(disc) {
        currentDiscipline = disc;
        localStorage.setItem('eps_arena_current_discipline', disc);

        const multiView = document.getElementById('viewMultiSettings');
        const coView = document.getElementById('viewCOSettings');
        const osView = document.getElementById('viewOrientShowSettings');
        const escView = document.getElementById('viewEscaladeSettings');
        const bmtView = document.getElementById('viewBadmintonSettings');
        const arcView = document.getElementById('viewArcathlonSettings');
        const evalView = document.getElementById('viewEvaluationSettings');
        const tournoiView = document.getElementById('viewTournoiSettings');

        // Cacher toutes les vues
        if (multiView) multiView.classList.add('hidden');
        if (coView) coView.classList.add('hidden');
        if (osView) osView.classList.add('hidden');
        if (escView) escView.classList.add('hidden');
        if (bmtView) bmtView.classList.add('hidden');
        if (arcView) arcView.classList.add('hidden');
        if (evalView) evalView.classList.add('hidden');
        if (tournoiView) tournoiView.classList.add('hidden');

        // Afficher la vue correspondante
        if (disc === 'multi' && multiView) multiView.classList.remove('hidden');
        else if (disc === 'co' && coView) coView.classList.remove('hidden');
        else if (disc === 'orientshow' && osView) osView.classList.remove('hidden');
        else if (disc === 'escalade' && escView) escView.classList.remove('hidden');
        else if (disc === 'badminton' && bmtView) bmtView.classList.remove('hidden');
        else if (disc === 'arcathlon' && arcView) arcView.classList.remove('hidden');
        else if (disc === 'evaluation' && evalView) evalView.classList.remove('hidden');
        else if (disc === 'tournoi' && tournoiView) tournoiView.classList.remove('hidden');
        else if (disc === 'bloccontest' && escView) {
            // On utilise la vue escalade pour le Bloc Contest
            escView.classList.remove('hidden');
            // S'assurer que le conteneur existe
            let container = document.getElementById('bloc-prof-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'bloc-prof-container';
                container.className = 'space-y-4 mt-6';
                escView.appendChild(container);
            }
            // Initialiser le module prof Bloc Contest
            const activeClasse = document.getElementById('selectClasse').value;
            if (activeClasse) {
                initBlocProf(activeClasse);
            } else {
                container.innerHTML = '<p class="text-slate-500">Sélectionnez une classe.</p>';
            }
        }

        // Mise à jour des boutons
        const btnMulti = document.getElementById('btnDisc-multi');
        const btnCo = document.getElementById('btnDisc-co');
        const btnOs = document.getElementById('btnDisc-orientshow');
        const btnEsc = document.getElementById('btnDisc-escalade');
        const btnBmt = document.getElementById('btnDisc-badminton');
        const btnArc = document.getElementById('btnDisc-arcathlon');
        const btnEval = document.getElementById('btnDisc-evaluation');
        const btnTournoi = document.getElementById('btnDisc-tournoi');
        const btnBloc = document.getElementById('btnDisc-bloccontest');

        const resetBtn = (btn) => { if (btn) { btn.classList.remove('border-blue-500'); btn.classList.add('border-slate-600'); } };
        const setActive = (btn) => { if (btn) { btn.classList.remove('border-slate-600'); btn.classList.add('border-blue-500'); } };

        resetBtn(btnMulti); resetBtn(btnCo); resetBtn(btnOs); resetBtn(btnEsc);
        resetBtn(btnBmt); resetBtn(btnArc); resetBtn(btnEval); resetBtn(btnTournoi); resetBtn(btnBloc);

        if (disc === 'multi') setActive(btnMulti);
        else if (disc === 'co') setActive(btnCo);
        else if (disc === 'orientshow') setActive(btnOs);
        else if (disc === 'escalade') setActive(btnEsc);
        else if (disc === 'badminton') setActive(btnBmt);
        else if (disc === 'arcathlon') setActive(btnArc);
        else if (disc === 'evaluation') setActive(btnEval);
        else if (disc === 'tournoi') setActive(btnTournoi);
        else if (disc === 'bloccontest') setActive(btnBloc);

        // Initialisations spécifiques
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
    // GÉNÉRATION DES ÉQUIPES (MULTI-ACTIVITÉS)
    // ============================================================
    window.generateTeams = async function() {
        const activeClasse = document.getElementById('selectClasse').value;
        if (!activeClasse) return alert("Sélectionnez une classe d'abord.");
        const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${activeClasse}`) || '[]');
        if (eleves.length === 0) return alert("Aucun élève dans cette classe.");

        // Cas particuliers : CO, Escalade, OrientShow, Badminton, Arcathlon, Bloc Contest
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
        if (currentDiscipline === 'bloccontest') {
            alert("Pour Bloc Contest, configurez les blocs depuis l'interface professeur.");
            return;
        }

        // ---- Multi-activités ----
        const statuts = JSON.parse(localStorage.getItem(`eps_arena_multi_statuts_${activeClasse}`) || '{}');
        const elevesActifs = eleves.filter(e => {
            const statut = statuts[e.id] || 'present';
            return statut === 'present';
        });

        if (elevesActifs.length === 0) {
            return alert("Aucun élève présent dans cette classe.");
        }

        const options = {
            mode: document.getElementById('modeRepartition')?.value || 'melange',
            mixite: document.getElementById('modeMixite')?.value || 'ignore',
            critere: document.getElementById('critereForce')?.value || 'vma',
            formatLibelle: document.getElementById('formatLibelle')?.value || 'Couleurs',
            nbEquipes: parseInt(document.getElementById('nbEquipes')?.value) || 0,
            nbParEquipe: parseInt(document.getElementById('nbParEquipe')?.value) || 0,
            couleurs: [],
        };

        if (!options.nbEquipes && options.nbParEquipe) options.nbEquipes = Math.ceil(elevesActifs.length / options.nbParEquipe);
        else if (options.nbEquipes && !options.nbParEquipe) options.nbParEquipe = Math.ceil(elevesActifs.length / options.nbEquipes);

        const teams = generateClassicTeams(elevesActifs, options);
        window.lastTeams = teams;

        // Chargement des photos
        const teamsWithPhotos = [];
        for (const team of teams) {
            const membersWithPhotos = [];
            for (const m of team.members) {
                const url = await getPhotoUrl(m.id);
                membersWithPhotos.push({ ...m, photoUrl: url });
            }
            teamsWithPhotos.push({ ...team, members: membersWithPhotos });
        }

        // Restaurer les couleurs sauvegardées
        const savedColors = JSON.parse(localStorage.getItem('eps_arena_team_colors') || '{}');
        const usedColors = new Set(Object.values(savedColors));
        const palette = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#f97316', '#a855f7', '#ec4899', '#06b6d4', '#ffffff', '#000000'];
        let availableColors = palette.filter(c => !usedColors.has(c));

        teamsWithPhotos.forEach((team, index) => {
            if (savedColors[team.id]) {
                team.color = savedColors[team.id];
            } else {
                const color = availableColors.length > 0 ? availableColors.shift() : palette[index % palette.length];
                team.color = color;
                usedColors.add(color);
            }
        });

        window.teamColorState = {};
        teamsWithPhotos.forEach(team => {
            window.teamColorState[team.id] = team.color;
        });
        localStorage.setItem('eps_arena_team_colors', JSON.stringify(window.teamColorState));

        const container = document.getElementById('teamsGrid');
        if (!container) return;

        // Construction des cartes
        container.innerHTML = teamsWithPhotos.map(team => {
            const bgColor = team.color || '#3b82f6';
            return `
                <div class="bg-slate-900 rounded-2xl p-4 border-4" style="border-color: ${bgColor}">
                    <div class="flex justify-between items-center mb-3">
                        <h3 class="font-black text-xl cursor-pointer hover:opacity-80 transition-opacity" 
                            style="color: ${bgColor}"
                            onclick="window.openColorPicker('${team.id}')">
                            ${team.label}
                        </h3>
                        <button onclick="event.stopPropagation(); window.renameTeam('${team.id}')" 
                                class="text-[10px] text-slate-400 underline hover:text-white transition-colors">
                            Renommer
                        </button>
                    </div>
                    <div class="team-members flex flex-col gap-2 min-h-[60px]" data-team-id="${team.id}">
                        ${team.members.map(m => {
                            const photoHtml = m.photoUrl 
                                ? `<img src="${m.photoUrl}" class="w-10 h-10 rounded-full object-cover border-2 border-slate-600">`
                                : `<div class="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-xl">👤</div>`;

                            let bgSexe = 'bg-slate-200 border-slate-400';
                            if (m.sexe === 'M' || m.sexe === 'm') bgSexe = 'bg-blue-200 border-blue-400';
                            else if (m.sexe === 'F' || m.sexe === 'f') bgSexe = 'bg-rose-200 border-rose-400';

                            let starsHtml = '';
                            const force = m.force || 0;
                            for (let i = 1; i <= 5; i++) {
                                starsHtml += `<span class="${i <= force ? 'text-yellow-400' : 'text-slate-600'}">★</span>`;
                            }

                            const vmaDisplay = m.vma ? `${m.vma} km/h` : '--';
                            const longueurDisplay = m.longueur ? `${m.longueur} cm` : '--';
                            const sprintDisplay = m.sprint30 ? `${m.sprint30} s` : '--';

                            const statut = statuts[m.id] || 'present';
                            const isAbsent = statut === 'absent';
                            const isInapte = statut === 'inapte';

                            return `
                                <div class="p-2 rounded-lg border-2 flex items-center gap-3 ${bgSexe} ${isAbsent ? 'opacity-40' : ''} ${isInapte ? 'opacity-60' : ''}" data-id="${m.id}">
                                    ${photoHtml}
                                    <div class="flex flex-col flex-1 leading-tight">
                                        <span class="font-black text-slate-900 text-sm">${m.prenom}</span>
                                        <span class="text-xs font-bold text-slate-600 uppercase">${m.nom}</span>
                                        <div class="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] font-bold">
                                            <span class="text-blue-600">VMA : ${vmaDisplay}</span>
                                            <span class="text-orange-600">L : ${longueurDisplay}</span>
                                            <span class="text-purple-600">30m : ${sprintDisplay}</span>
                                            <span class="text-yellow-600">${starsHtml}</span>
                                        </div>
                                        <div class="flex gap-1 mt-0.5">
                                            <button onclick="window.setEleveStatut('${m.id}', 'present')" 
                                                    class="text-[10px] px-1.5 py-0.5 rounded ${statut === 'present' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400'}">
                                                ✅
                                            </button>
                                            <button onclick="window.setEleveStatut('${m.id}', 'absent')" 
                                                    class="text-[10px] px-1.5 py-0.5 rounded ${statut === 'absent' ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-400'}">
                                                🚫
                                            </button>
                                            <button onclick="window.setEleveStatut('${m.id}', 'inapte')" 
                                                    class="text-[10px] px-1.5 py-0.5 rounded ${statut === 'inapte' ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-400'}">
                                                ⚠️
                                            </button>
                                        </div>
                                    </div>
                                    <span class="text-3xl font-black text-slate-900 pr-2">${m.rank}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }).join('');

        // Afficher les élèves exclus
        const elevesExclus = eleves.filter(e => {
            const statut = statuts[e.id] || 'present';
            return statut !== 'present';
        });

        if (elevesExclus.length > 0) {
            let exclHtml = `
                <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 mt-4">
                    <h4 class="font-bold text-slate-400 uppercase text-xs mb-3">🚫 Élèves non inclus (${elevesExclus.length})</h4>
                    <div class="flex flex-wrap gap-3">
            `;
            for (const eleve of elevesExclus) {
                const url = await getPhotoUrl(eleve.id);
                const photoHtml = url ? `<img src="${url}" class="w-10 h-10 rounded-full object-cover border-2 border-slate-600">` : `<div class="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-xl">👤</div>`;
                const statut = statuts[eleve.id] || 'present';
                const statutLabel = statut === 'absent' ? '🚫 Absent' : '⚠️ Inapte';
                const statutColor = statut === 'absent' ? 'bg-red-500/20 border-red-500' : 'bg-orange-500/20 border-orange-500';
                exclHtml += `
                    <div class="p-2 rounded-lg border-2 flex items-center gap-3 ${statutColor}">
                        ${photoHtml}
                        <div>
                            <span class="font-black text-white text-sm">${eleve.prenom}</span>
                            <span class="text-xs text-slate-400">${eleve.nom}</span>
                            <span class="text-[10px] font-bold block ${statut === 'absent' ? 'text-red-400' : 'text-orange-400'}">${statutLabel}</span>
                        </div>
                        <button onclick="window.setEleveStatut('${eleve.id}', 'present')" 
                                class="ml-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] px-2 py-1 rounded font-bold transition-colors">
                            ✅ Réintégrer
                        </button>
                    </div>
                `;
            }
            exclHtml += `</div></div>`;
            container.insertAdjacentHTML('afterend', exclHtml);
        }

        // Sortable
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

    // ============================================================
    // GESTION DES SOUS-ONGLETS (Live / TV)
    // ============================================================
    window.switchActivitySubTab = function(subTab) {
        const disc = currentDiscipline;
        
        // Mettre à jour les boutons des sous-onglets
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
        const views = ['viewMultiSettings', 'viewCOSettings', 'viewOrientShowSettings', 
                       'viewEscaladeSettings', 'viewBadmintonSettings', 'viewArcathlonSettings', 'viewEvaluationSettings'];
        views.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        // Masquer les anciennes vues Live et TV
        const viewLive = document.getElementById('viewLive');
        const viewTV = document.getElementById('viewTV');
        if (viewLive) viewLive.classList.add('hidden');
        if (viewTV) viewTV.style.display = 'none';

        if (subTab === 'settings') {
            // Afficher la vue de réglages correspondante
            const map = {
                'multi': 'viewMultiSettings',
                'co': 'viewCOSettings',
                'orientshow': 'viewOrientShowSettings',
                'escalade': 'viewEscaladeSettings',
                'badminton': 'viewBadmintonSettings',
                'arcathlon': 'viewArcathlonSettings',
                'evaluation': 'viewEvaluationSettings',
                'bloccontest': 'viewEscaladeSettings' // on réutilise la vue escalade
            };
            const targetView = document.getElementById(map[disc]);
            if (targetView) {
                targetView.classList.remove('hidden');
                // Pour l'évaluation, réinitialiser l'interface
                if (disc === 'evaluation') {
                    setTimeout(() => initEvaluationInterface(), 50);
                }
                // Pour Bloc Contest, s'assurer que le conteneur est présent
                if (disc === 'bloccontest') {
                    let container = document.getElementById('bloc-prof-container');
                    if (!container) {
                        container = document.createElement('div');
                        container.id = 'bloc-prof-container';
                        container.className = 'space-y-4 mt-6';
                        targetView.appendChild(container);
                    }
                    const activeClasse = document.getElementById('selectClasse').value;
                    if (activeClasse) {
                        initBlocProf(activeClasse);
                    } else {
                        container.innerHTML = '<p class="text-slate-500">Sélectionnez une classe.</p>';
                    }
                }
            }
        } 
        else if (subTab === 'live') {
            // Afficher le Live
            if (viewLive) viewLive.classList.remove('hidden');
            const container = document.getElementById('live-content');
            container.innerHTML = '<p>Chargement du Live...</p>';

            // Charger le module Live correspondant
            const liveModules = {
                'badminton': () => import('../../modules/badminton/badminton-live.js').then(m => m.renderBadmintonLive()),
                'escalade': () => import('../../modules/escalade/escalade-live.js').then(m => m.renderEscaladeLive(window.lastLiveData || {})),
                'co': () => import('../../modules/co/co-live.js').then(m => m.renderCOLive(window.lastLiveData || {})),
                'orientshow': () => import('../../modules/orientshow/orientshow-live.js').then(m => m.renderOrientShowLive()),
                'multi': () => import('../../modules/multi/multi-live.js').then(m => m.renderMultiLive(window.lastLiveData || {})),
                'bloccontest': () => import('../../modules/escalade/escalade-live.js').then(m => m.renderEscaladeLive(window.lastLiveData || {})), // fallback
            };

            if (liveModules[disc]) {
                liveModules[disc]().catch(err => console.error(`Erreur Live ${disc} :`, err));
            } else {
                container.innerHTML = `<p class="text-red-400">Aucun module Live pour cette discipline.</p>`;
            }
        } 
        else if (subTab === 'tv') {
            // Afficher la TV
            const tvViewEl = document.getElementById('viewTV');
            if (tvViewEl) {
                tvViewEl.style.display = 'block';
                tvViewEl.style.height = '100vh';
                setTimeout(() => {
                    // Charger le module TV correspondant
                    const tvModules = {
                        'badminton': () => import('../../modules/badminton/badminton-tv.js').then(m => m.renderBadmintonTV()),
                        'escalade': () => import('../../modules/escalade/escalade-tv-ui.js').then(m => m.renderEscaladeTV()),
                        'orientshow': () => import('../../modules/orientshow/orientshow-tv.js').then(m => m.renderOrientShowTV()),
                        'arcathlon': () => import('../../modules/arcathlon/arcathlon-tv.js').then(m => m.renderArcathlonTV()),
                        'bloccontest': () => import('../../modules/escalade/escalade-tv-ui.js').then(m => m.renderEscaladeTV()), // fallback
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
    // TRANSMISSION FIREBASE (CORRIGÉE)
    // ============================================================
    window.transmettreConfig = async function() {
        const activeClasse = document.getElementById('selectClasse').value;
        if (!activeClasse) return alert("Sélectionnez une classe.");

        const baseProf = getBaseProf();
        let configData = {};
        let localMapping = {};

        if (currentDiscipline === 'bloccontest' || escaladeMode === 'bloc') {
    await transmettreConfigBloc();
    return;
}
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
        // ✅ SECTION BADMINTON CORRIGÉE
        else if (currentDiscipline === 'badminton') {
            const assignments = JSON.parse(localStorage.getItem(`eps_arena_badminton_assignments_${activeClasse}`) || '{}');
            const lettres = ['A','B','C','D','E','F','G','H','I','J'];
            
            const mode = window.badmintonMode || 'terrain';
            const terrainType = document.getElementById('badmintonMode')?.value || 'frontback';
            const bonusManiere = parseInt(document.getElementById('badmintonBonusManiere')?.value) || 5;
            
            configData = {
                activite: 'badminton',
                mode: mode,
                terrainType: terrainType,
                bonusManiere: Math.max(3, Math.min(8, bonusManiere))
            };
            
            for (let t = 1; t <= (assignments.nbTerrains || 6); t++) {
                const idsTerrain = assignments[t] || [];
                idsTerrain.forEach((eleveId, index) => {
                    const lettre = lettres[index] || '?';
                    localMapping[`${activeClasse}_${t}_${lettre}`] = eleveId;
                });
                configData[t] = idsTerrain.length;
            }
        } 
        else if (currentDiscipline === 'arcathlon') {
            transmettreArcathlonConfig();
            return;
        }
        else if (currentDiscipline === 'tournoi') {
            const configData = {
                activite: 'tournoi',
                mode: window.tournoiMode || 'elimination'
            };
            await set(ref(db, `${baseProf}/${activeClasse}/config`), configData);
            await set(ref(db, `${baseProf}/active_classes/${activeClasse}`), true);
            alert("✅ Module Tournoi activé pour les iPads !");
            return;
        }
        else if (currentDiscipline === 'bloccontest') {
    // On appelle la fonction de transmission dédiée
    await transmettreConfigBloc();
    return;
}
        else {
            configData.activite = 'multi';
            if (window.lastTeams) {
                window.lastTeams.forEach((team) => {
                    const key = team.label;
                    localMapping[`${activeClasse}_${key}`] = team.members.map(m => m.id);
                    configData[key] = team.members.length;
                });
            } else {
                return alert("Veuillez d'abord générer les équipes.");
            }
        }

        localStorage.setItem(`eps_arena_local_mapping_${activeClasse}`, JSON.stringify(localMapping));

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
    // FONCTIONS CO (circuits)
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

    // ✅ EXPOSER setBadmintonMode SUR window
    window.setBadmintonMode = setBadmintonMode;

    // ============================================================
    // EXPORTS / IMPORTS
    // ============================================================
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
    window.generateArcathlonTeams = generateArcathlonTeams;
    window.transmettreArcathlonConfig = transmettreArcathlonConfig;

    // ============================================================
    // INITIALISATION SORTABLE (au cas où)
    // ============================================================
    try { initSortableCO(); } catch (e) {}
    try { initSortableEscalade(); } catch (e) {}
}

// ============================================================
// PALETTE DE COULEURS (pour Multi-activités)
// ============================================================
function initPalette() {
    const paletteContainer = document.getElementById('paletteCouleurs');
    if (!paletteContainer) return;
    const couleursDispo = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#f97316', '#a855f7', '#ec4899', '#06b6d4', '#ffffff', '#000000'];
    paletteContainer.innerHTML = couleursDispo.map(c => 
        `<div onclick="window.toggleCouleur('${c}')" data-couleur="${c}" class="w-8 h-8 rounded-full border-2 border-slate-600 cursor-pointer active:scale-90" style="background-color: ${c}"></div>`
    ).join('');
}
// ============================================================
// SÉLECTEUR DE MODE ESCALADE (Classique / Bloc Contest)
// ============================================================
function initEscaladeModeSelector() {
    const escView = document.getElementById('viewEscaladeSettings');
    if (!escView) return;
    // Ne pas dupliquer
    if (document.getElementById('escalade-mode-selector')) return;
    
    const selector = document.createElement('div');
    selector.id = 'escalade-mode-selector';
    selector.className = 'flex gap-2 mb-4 bg-slate-800 p-3 rounded-2xl border border-slate-700';
    selector.innerHTML = `
        <button id="escalade-mode-classic" class="px-4 py-2 rounded-xl font-black text-xs uppercase bg-blue-600 text-white">🧗 Escalade classique</button>
        <button id="escalade-mode-bloc" class="px-4 py-2 rounded-xl font-black text-xs uppercase bg-slate-700 text-slate-300">🧗 Bloc Contest</button>
    `;
    // Insérer en haut de la vue
    escView.prepend(selector);
    
    // Gestion des clics
    document.getElementById('escalade-mode-classic').addEventListener('click', () => {
        setEscaladeMode('classic');
    });
    document.getElementById('escalade-mode-bloc').addEventListener('click', () => {
        setEscaladeMode('bloc');
    });

    // Par défaut, afficher le mode classique
    setEscaladeMode('classic');
}

function setEscaladeMode(mode) {
    escaladeMode = mode;
    const classicContainer = document.getElementById('escalade-classic-container');
    const blocContainer = document.getElementById('bloc-prof-container');
    
    if (mode === 'classic') {
        currentDiscipline = 'escalade'; // ← on reste sur escalade
        if (classicContainer) classicContainer.style.display = '';
        if (blocContainer) blocContainer.style.display = 'none';
        document.getElementById('escalade-mode-classic').className = 'px-4 py-2 rounded-xl font-black text-xs uppercase bg-blue-600 text-white';
        document.getElementById('escalade-mode-bloc').className = 'px-4 py-2 rounded-xl font-black text-xs uppercase bg-slate-700 text-slate-300';
        initEscaladeInterface();
        initSortableEscalade();
        loadEscaladeAssignments();
    } else {
        currentDiscipline = 'bloccontest'; // ← on passe en bloccontest
        if (classicContainer) classicContainer.style.display = 'none';
        if (blocContainer) {
            blocContainer.style.display = '';
            const activeClasse = document.getElementById('selectClasse').value;
            if (activeClasse) initBlocProf(activeClasse);
            else blocContainer.innerHTML = '<p class="text-slate-500">Sélectionnez une classe.</p>';
        }
        document.getElementById('escalade-mode-bloc').className = 'px-4 py-2 rounded-xl font-black text-xs uppercase bg-blue-600 text-white';
        document.getElementById('escalade-mode-classic').className = 'px-4 py-2 rounded-xl font-black text-xs uppercase bg-slate-700 text-slate-300';
    }
}
window.toggleCouleur = function(couleur) {
    const el = document.querySelector(`[data-couleur="${couleur}"]`);
    if (el) {
        el.classList.toggle('border-emerald-400');
        el.classList.toggle('border-slate-600');
    }
};