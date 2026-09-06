// src/js/modules/multi/multi-prof.js
// Module professeur pour les Multi-activités

import { generateTeams as generateClassicTeams } from '../teams/team-generator.js';
import { getPhotoUrl } from '../../services/admin-service.js';
import { db, ref, set } from '../../core/firebase-service.js';
import { registerModule } from '../registry.js';

// ============================================================
// ÉTAT DU MODULE
// ============================================================
let currentClasse = '';
let lastTeams = [];
let teamColorState = {};
let sortableInstances = [];

// ============================================================
// FONCTIONS D’INITIALISATION
// ============================================================

export function initProf(classe) {
    currentClasse = classe;
    // Initialiser la palette de couleurs
    initPalette();
    // Charger les équipes sauvegardées
    loadTeamsFromStorage(classe);
    // Restaurer les couleurs
    const savedColors = JSON.parse(localStorage.getItem('eps_arena_team_colors') || '{}');
    teamColorState = savedColors;
    // Afficher les équipes si elles existent
    if (lastTeams.length > 0) {
        renderTeams(lastTeams);
    }
}

export function initKiosk(classe, code) {
    console.log('[Multi] Kiosk init pour', classe, code);
}

// ============================================================
// CHARGEMENT / SAUVEGARDE DES ÉQUIPES
// ============================================================

function loadTeamsFromStorage(classe) {
    const saved = localStorage.getItem(`eps_arena_multi_teams_${classe}`);
    if (saved) {
        try {
            lastTeams = JSON.parse(saved);
            return true;
        } catch (e) {
            console.warn('Erreur chargement équipes multi :', e);
        }
    }
    return false;
}

function saveTeamsToStorage(classe, teams) {
    localStorage.setItem(`eps_arena_multi_teams_${classe}`, JSON.stringify(teams));
}

// ============================================================
// GÉNÉRATION DES ÉQUIPES
// ============================================================

export async function generateTeams(classe, eleves) {
    if (!classe) {
        const select = document.getElementById('selectClasse');
        if (select) classe = select.value;
    }
    if (!classe) return alert("Sélectionnez une classe d'abord.");
    
    if (!eleves) {
        eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');
    }
    if (eleves.length === 0) return alert("Aucun élève dans cette classe.");

    // Récupérer les statuts
    const statuts = JSON.parse(localStorage.getItem(`eps_arena_multi_statuts_${classe}`) || '{}');
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

    if (!options.nbEquipes && options.nbParEquipe) {
        options.nbEquipes = Math.ceil(elevesActifs.length / options.nbParEquipe);
    } else if (options.nbEquipes && !options.nbParEquipe) {
        options.nbParEquipe = Math.ceil(elevesActifs.length / options.nbEquipes);
    }

    const teams = generateClassicTeams(elevesActifs, options);
    lastTeams = teams;
    saveTeamsToStorage(classe, teams);
    
    // Charger les photos
    const teamsWithPhotos = await enrichTeamsWithPhotos(teams);
    
    // Attribuer les couleurs
    assignColors(teamsWithPhotos);
    
    // Afficher
    renderTeams(teamsWithPhotos, statuts);
    
    document.getElementById('nbEquipes').value = options.nbEquipes;
    document.getElementById('nbParEquipe').value = options.nbParEquipe;
    
    // Afficher les exclus
    renderExclus(eleves, statuts);
    
    return teams;
}

// ============================================================
// ENRICHISSEMENT DES PHOTOS
// ============================================================

async function enrichTeamsWithPhotos(teams) {
    const result = [];
    for (const team of teams) {
        const membersWithPhotos = [];
        for (const m of team.members) {
            const url = await getPhotoUrl(m.id);
            membersWithPhotos.push({ ...m, photoUrl: url });
        }
        result.push({ ...team, members: membersWithPhotos });
    }
    return result;
}

// ============================================================
// GESTION DES COULEURS
// ============================================================

function assignColors(teams) {
    const savedColors = JSON.parse(localStorage.getItem('eps_arena_team_colors') || '{}');
    const usedColors = new Set(Object.values(savedColors));
    const palette = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#f97316', '#a855f7', '#ec4899', '#06b6d4', '#ffffff', '#000000'];
    let availableColors = palette.filter(c => !usedColors.has(c));

    teams.forEach((team, index) => {
        if (savedColors[team.id]) {
            team.color = savedColors[team.id];
        } else {
            const color = availableColors.length > 0 ? availableColors.shift() : palette[index % palette.length];
            team.color = color;
            usedColors.add(color);
        }
    });

    teamColorState = {};
    teams.forEach(team => {
        teamColorState[team.id] = team.color;
    });
    localStorage.setItem('eps_arena_team_colors', JSON.stringify(teamColorState));
}

// ============================================================
// RENDU DES ÉQUIPES
// ============================================================

function renderTeams(teams, statuts) {
    const container = document.getElementById('teamsGrid');
    if (!container) return;

    if (!statuts) {
        const activeClasse = document.getElementById('selectClasse')?.value || currentClasse;
        statuts = JSON.parse(localStorage.getItem(`eps_arena_multi_statuts_${activeClasse}`) || '{}');
    }

    container.innerHTML = teams.map(team => {
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

    // Réinitialiser Sortable
    initSortableMulti();
}

// ============================================================
// RENDU DES ÉLÈVES EXCLUS
// ============================================================

async function renderExclus(eleves, statuts) {
    const container = document.getElementById('teamsGrid');
    if (!container) return;

    const elevesExclus = eleves.filter(e => {
        const statut = statuts[e.id] || 'present';
        return statut !== 'present';
    });

    if (elevesExclus.length === 0) return;

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

// ============================================================
// SORTABLE
// ============================================================

function initSortableMulti() {
    // Détruire les instances existantes
    sortableInstances.forEach(s => s.destroy());
    sortableInstances = [];

    document.querySelectorAll('.team-members').forEach(el => {
        const sortable = new Sortable(el, {
            group: 'teams',
            animation: 150,
            onEnd: function(evt) {
                console.log("Nouvelle répartition détectée");
                // Sauvegarder automatiquement
                saveCurrentAssignments();
            }
        });
        sortableInstances.push(sortable);
    });
}

function saveCurrentAssignments() {
    const activeClasse = document.getElementById('selectClasse')?.value || currentClasse;
    if (!activeClasse) return;
    
    // Récupérer la composition actuelle des équipes
    const teams = [];
    document.querySelectorAll('.team-members').forEach(el => {
        const teamId = el.dataset.teamId;
        const members = [];
        el.querySelectorAll('[data-id]').forEach(child => {
            members.push(child.dataset.id);
        });
        // On ne peut pas reconstruire complètement, on sauvegarde juste les IDs
        // Pour une sauvegarde complète, il faudrait garder la structure
        // On va simplement stocker les IDs dans le localStorage
        localStorage.setItem(`eps_arena_multi_team_${teamId}_${activeClasse}`, JSON.stringify(members));
    });
}

// ============================================================
// PALETTE DE COULEURS
// ============================================================

function initPalette() {
    const paletteContainer = document.getElementById('paletteCouleurs');
    if (!paletteContainer) return;
    const couleursDispo = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#f97316', '#a855f7', '#ec4899', '#06b6d4', '#ffffff', '#000000'];
    paletteContainer.innerHTML = couleursDispo.map(c => 
        `<div onclick="window.toggleCouleur('${c}')" data-couleur="${c}" class="w-8 h-8 rounded-full border-2 border-slate-600 cursor-pointer active:scale-90" style="background-color: ${c}"></div>`
    ).join('');
}

window.toggleCouleur = function(couleur) {
    const el = document.querySelector(`[data-couleur="${couleur}"]`);
    if (el) {
        el.classList.toggle('border-emerald-400');
        el.classList.toggle('border-slate-600');
    }
};

// ============================================================
// GESTION DES STATUTS
// ============================================================

window.setEleveStatut = function(eleveId, statut) {
    const activeClasse = document.getElementById('selectClasse')?.value || currentClasse;
    if (!activeClasse) return;

    const key = `eps_arena_multi_statuts_${activeClasse}`;
    const statuts = JSON.parse(localStorage.getItem(key) || '{}');
    statuts[eleveId] = statut;
    localStorage.setItem(key, JSON.stringify(statuts));

    // Re-générer les équipes
    generateTeams(activeClasse);
};

// ============================================================
// EXPORT / IMPORT JSON
// ============================================================

export function exportConfig() {
    const activeClasse = document.getElementById('selectClasse')?.value || currentClasse;
    if (!activeClasse) return alert("Sélectionnez une classe.");

    const teams = lastTeams || [];
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
            color: teamColorState[team.id] || team.color || '#3b82f6',
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
}

export function importConfig(file) {
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
            teamColorState = colors;
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

            lastTeams = teams;
            saveTeamsToStorage(data.classe, teams);

            const select = document.getElementById('selectClasse');
            if (select && select.value !== data.classe) {
                select.value = data.classe;
                select.dispatchEvent(new Event('change'));
            }

            await generateTeams(data.classe);
            alert("✅ Configuration Multi importée avec succès !");
        } catch (err) {
            alert("❌ Erreur d'import : " + err.message);
        }
    };
    reader.readAsText(file);
}

// ============================================================
// COULEURS : Sélecteur de couleurs (exposé global)
// ============================================================

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
    const currentColor = teamColorState?.[teamId] || '#3b82f6';
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
    teamColorState[teamId] = color;
    localStorage.setItem('eps_arena_team_colors', JSON.stringify(teamColorState));

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
// UTILITAIRE : NOM DES COULEURS
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
// TRANSMISSION FIREBASE
// ============================================================

export async function transmettre(classe) {
    const activeClasse = classe || document.getElementById('selectClasse')?.value || currentClasse;
    if (!activeClasse) return alert("Sélectionnez une classe.");

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const baseProf = `etablissements/0680013V/profs/${profCode}`;
    
    const configData = { activite: 'multi' };
    const localMapping = {};
    
    if (lastTeams && lastTeams.length > 0) {
        lastTeams.forEach((team) => {
            const key = team.label;
            localMapping[`${activeClasse}_${key}`] = team.members.map(m => m.id);
            configData[key] = team.members.length;
        });
    } else {
        return alert("Veuillez d'abord générer les équipes.");
    }

    localStorage.setItem(`eps_arena_local_mapping_${activeClasse}`, JSON.stringify(localMapping));

    try {
        console.log("📡 Configuration Multi envoyée :", configData);
        await set(ref(db, `${baseProf}/${activeClasse}/config`), configData);
        await set(ref(db, `${baseProf}/active_classes/${activeClasse}`), true);
        alert("✅ Configuration Multi transmise aux iPads !");
    } catch (e) {
        console.error("Erreur transmission :", e);
        alert("Erreur lors de la transmission.\nVérifie la console (F12) pour plus de détails.");
    }
}

// ============================================================
// LIVE / TV
// ============================================================

export function renderLive(classe) {
    import('./multi-live.js').then(module => {
        const data = window.lastLiveData || {};
        module.renderMultiLive(data);
    }).catch(err => console.error('Erreur Live Multi :', err));
}

export function renderTV(classe) {
    // Pour l'instant, pas de TV spécifique pour Multi
    console.log('[Multi] TV non disponible pour le moment');
}

// ============================================================
// EXPOSITION GLOBALE (compatibilité avec le HTML)
// ============================================================

window.exportMultiConfig = exportConfig;
window.importMultiConfig = function(event) {
    const file = event.target.files[0];
    if (file) importConfig(file);
    event.target.value = '';
};

// ============================================================
// ENREGISTREMENT DU MODULE
// ============================================================

registerModule({
    id: 'multi',
    label: '🏋️ Multi-activités',
    icon: '🏋️',
    initProf,
    initKiosk,
    generateTeams,
    transmettre,
    renderLive,
    renderTV,
    isDefault: true,
    cleanup: () => {
        sortableInstances.forEach(s => s.destroy());
        sortableInstances = [];
        console.log('[Multi] Nettoyage effectué');
    }
});

// ============================================================
// EXPORT PAR DÉFAUT
// ============================================================

export default {
    id: 'multi',
    label: '🏋️ Multi-activités',
    initProf,
    initKiosk,
    generateTeams,
    transmettre,
    renderLive,
    renderTV,
    exportConfig,
    importConfig
};