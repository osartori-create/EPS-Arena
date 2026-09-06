// src/js/modules/escalade/escalade-prof-blocs.js
// Interface professeur Bloc Contest

import {
    listenBlocConfig,
    setBlocConfig,
    updateBlocConfig,
    listenValidations,
    clearValidations
} from './escalade-blocs-firebase.js';
import {
    agregerDonnees,
    genererClassement,
    genererCSVBlocContest
} from './escalade-blocs-core.js';
import { getPhotoUrl } from '../../services/admin-service.js';

let currentClasse = '';
let config = null;
let validations = {};
let configListener = null;
let validationsListener = null;

// ============================================================
// Initialisation (appelée depuis activities.js)
// ============================================================
export function initBlocProf(classe) {
    currentClasse = classe;
    // Créer le conteneur s'il n'existe pas
    let container = document.getElementById('bloc-prof-container');
    if (!container) {
        const parent = document.getElementById('viewEscaladeSettings');
        if (!parent) return;
        container = document.createElement('div');
        container.id = 'bloc-prof-container';
        container.className = 'space-y-4 mt-6';
        container.style.display = 'none'; // caché par défaut (sera affiché par le sélecteur)
        parent.appendChild(container);
    }

    // Récupérer les groupes depuis la configuration escalade classique
    const assignments = JSON.parse(localStorage.getItem(`eps_arena_escalade_assignments_${classe}`) || '{}');
    const groupes = {};
    // On extrait les groupes (les clés qui ne sont pas 'reserve' ou 'nbGroupes')
    Object.keys(assignments).forEach(key => {
        if (key !== 'reserve' && key !== 'nbGroupes' && Array.isArray(assignments[key])) {
            groupes[key] = assignments[key];
        }
    });

    // Si pas de groupes, on génère une répartition par défaut
    if (Object.keys(groupes).length === 0) {
        const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');
        if (eleves.length === 0) {
            container.innerHTML = '<p class="text-slate-500">Aucun élève dans cette classe.</p>';
            return;
        }
        const nbGroupes = Math.ceil(eleves.length / 3);
        const lettres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
        for (let i = 0; i < nbGroupes; i++) {
            const lettre = lettres[i] || `G${i+1}`;
            groupes[lettre] = [];
        }
        eleves.forEach((e, index) => {
            const g = lettres[index % nbGroupes];
            groupes[g].push(e.id);
        });
        // Sauvegarder pour l'escalade classique
        const newAssignments = { ...assignments, ...groupes, nbGroupes };
        localStorage.setItem(`eps_arena_escalade_assignments_${classe}`, JSON.stringify(newAssignments));
        // Afficher la sauvegarde
        console.log('✅ Groupes Bloc Contest sauvegardés dans eps_arena_escalade_assignments');
    }

    // Vérifier si une config Bloc Contest existe déjà
    if (configListener) configListener();
    configListener = listenBlocConfig(classe, (data) => {
        config = data;
        // Si pas de config, on en crée une par défaut avec les groupes
        if (!config) {
            const blocs = [];
            // Créer 10 blocs par défaut
            for (let i = 1; i <= 10; i++) {
                blocs.push({
                    id: `bloc${i}`,
                    label: `Bloc ${i}`,
                    couleur: '#3b82f6',
                    ordre: i
                });
            }
            const configData = {
                groupes: groupes,
                blocs: blocs,
                score: {
                    valeurInitiale: 100,
                    decote: 10,
                    mode: 'fige'
                },
                actif: true,
                dateCreation: new Date().toISOString()
            };
            setBlocConfig(classe, configData)
                .then(() => {
                    console.log('✅ Configuration Bloc Contest créée par défaut');
                    // Recharger la config
                    configListener();
                })
                .catch(err => console.error('❌ Erreur création config Bloc Contest :', err));
            return;
        }

        // Si config existe mais les groupes sont vides, on les met à jour
        if (!config.groupes || Object.keys(config.groupes).length === 0) {
            config.groupes = groupes;
            updateBlocConfig(classe, { groupes: groupes })
                .then(() => console.log('✅ Groupes mis à jour dans la config Bloc Contest'))
                .catch(err => console.error('❌ Erreur mise à jour des groupes :', err));
        }

        // Écouter les validations
        if (validationsListener) validationsListener();
        validationsListener = listenValidations(classe, (validData) => {
            validations = validData;
            afficherInterface();
        });
    });
}

// ============================================================
// Affichage de l’interface
// ============================================================
function afficherInterface() {
    const container = document.getElementById('bloc-prof-container');
    if (!container) return;

    // Si pas de config, afficher un message
    if (!config) {
        container.innerHTML = `
            <div class="bg-slate-800 p-6 rounded-2xl border border-slate-700 text-center">
                <p class="text-slate-400">Configuration Bloc Contest en cours de création...</p>
            </div>
        `;
        return;
    }

    // Récupérer les données agrégées
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${currentClasse}`) || '[]');
    const groupes = config.groupes || {};
    const blocs = config.blocs || [];
    const params = config.score || { valeurInitiale: 100, decote: 10, mode: 'fige' };
    const dataAgregees = agregerDonnees(validations, blocs, eleves, groupes, params);
    const classement = genererClassement(dataAgregees);

    // Construction de l’interface
    let html = `
        <div class="flex justify-between items-center bg-slate-800 p-4 rounded-2xl border border-slate-700 flex-wrap gap-2">
            <div>
                <h3 class="font-black text-blue-400 uppercase text-sm">🧗 Bloc Contest</h3>
                <p class="text-xs text-slate-400">Classe : ${currentClasse}</p>
                <p class="text-xs text-slate-500">Groupes partagés avec l'escalade classique</p>
            </div>
            <div class="flex gap-2 flex-wrap">
                <button onclick="window.modifierConfigBloc()" class="bg-blue-600 px-4 py-2 rounded-xl font-black text-xs text-white active:scale-95">
                    ⚙️ Configurer
                </button>
                <button onclick="window.reinitialiserValidationsBloc()" class="bg-red-600 px-4 py-2 rounded-xl font-black text-xs text-white active:scale-95">
                    🗑️ Réinitialiser
                </button>
                <button onclick="window.exporterCSVBloc()" class="bg-emerald-600 px-4 py-2 rounded-xl font-black text-xs text-white active:scale-95">
                    📥 Export iDoceo
                </button>
                <button onclick="window.transmettreConfigBloc()" class="bg-emerald-600 px-4 py-2 rounded-xl font-black text-xs text-white border-2 border-emerald-400 active:scale-95">
                    📡 Transmettre
                </button>
            </div>
        </div>

        <!-- Vue d’ensemble : tableau élèves x blocs -->
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 overflow-x-auto">
            <h4 class="font-bold text-slate-400 uppercase text-xs mb-3">Progression des élèves</h4>
            <table class="w-full text-sm">
                <thead>
                    <tr class="text-xs text-slate-400 uppercase">
                        <th class="p-2 text-left sticky left-0 bg-slate-800">Élève</th>
                        ${blocs.map(b => `<th class="p-2 text-center">${b.label}</th>`).join('')}
                        <th class="p-2 text-center bg-slate-800">Total</th>
                    </tr>
                </thead>
                <tbody>
    `;

    // Filtrer les élèves présents (statut !== 'absent' && statut !== 'inapte')
    const elevesPresents = Object.values(dataAgregees.eleves).filter(e => e.statut === 'present');
    elevesPresents.forEach(e => {
        html += `<tr class="border-t border-slate-700">`;
        html += `<td class="p-2 sticky left-0 bg-slate-800 font-bold text-white">${e.code} (${e.groupe})</td>`;
        blocs.forEach(b => {
            const bloc = e.blocs[b.id];
            const points = bloc ? bloc.points : 0;
            const couleur = bloc ? 'text-emerald-400' : 'text-slate-500';
            html += `<td class="p-2 text-center ${couleur}">${points > 0 ? points : '—'}</td>`;
        });
        html += `<td class="p-2 text-center font-bold text-yellow-400">${e.totalPoints}</td>`;
        html += `</tr>`;
    });

    html += `</tbody></table></div>`;

    // Classement des groupes
    html += `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
            <h4 class="font-bold text-slate-400 uppercase text-xs mb-3">🏆 Classement des groupes</h4>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
    `;
    const classementGroupes = classement.classementGroupes;
    classementGroupes.forEach((g, idx) => {
        const medaille = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : `${idx+1}.`));
        html += `
            <div class="bg-slate-900 p-3 rounded-xl border border-slate-600 text-center">
                <div class="text-2xl">${medaille}</div>
                <div class="font-black text-white">Groupe ${g.groupe}</div>
                <div class="text-yellow-400 font-bold">${g.totalPoints} pts</div>
                <div class="text-xs text-slate-400">${g.nbBlocsValides} blocs validés</div>
            </div>
        `;
    });
    html += `</div></div>`;

    container.innerHTML = html;
}

// ============================================================
// Actions (exposées globalement)
// ============================================================

window.modifierConfigBloc = function() {
    if (!config) return alert('Aucune configuration.');
    // Ouvrir un modal de modification (simplifié ici)
    const newValeur = prompt('Valeur initiale des blocs (actuelle : ' + config.score.valeurInitiale + ')', config.score.valeurInitiale);
    if (newValeur === null) return;
    const newDecote = prompt('Décote par validation (actuelle : ' + config.score.decote + ')', config.score.decote);
    if (newDecote === null) return;
    const mode = confirm('Mode figé ? (OK = figé, Annuler = évolutif)') ? 'fige' : 'evolutif';

    const updates = {
        'score.valeurInitiale': parseInt(newValeur, 10) || 100,
        'score.decote': parseInt(newDecote, 10) || 10,
        'score.mode': mode
    };
    updateBlocConfig(currentClasse, updates)
        .then(() => {
            alert('✅ Configuration mise à jour.');
        })
        .catch(err => alert('❌ Erreur : ' + err.message));
};

window.reinitialiserValidationsBloc = function() {
    if (!confirm('⚠️ Supprimer toutes les validations de cette classe ?')) return;
    clearValidations(currentClasse)
        .then(() => {
            alert('✅ Validations réinitialisées.');
        })
        .catch(err => alert('❌ Erreur : ' + err.message));
};

window.exporterCSVBloc = function() {
    if (!config) return alert('Aucune configuration.');
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${currentClasse}`) || '[]');
    const groupes = config.groupes || {};
    const blocs = config.blocs || [];
    const params = config.score || { valeurInitiale: 100, decote: 10, mode: 'fige' };
    const dataAgregees = agregerDonnees(validations, blocs, eleves, groupes, params);
    const csv = genererCSVBlocContest(dataAgregees, blocs);

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BlocContest_${currentClasse}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};

window.transmettreConfigBloc = function() {
    if (!config) return alert('Aucune configuration.');
    // Mettre à jour l’activité dans la config principale pour que les élèves voient le module
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const mainConfigRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/config`);
    set(mainConfigRef, { activite: 'bloccontest' })
        .then(() => {
            alert('✅ Configuration transmise aux iPads !');
        })
        .catch(err => alert('❌ Erreur : ' + err.message));
};

// ============================================================
// Nettoyage
// ============================================================
export function cleanupBlocProf() {
    if (configListener) { configListener(); configListener = null; }
    if (validationsListener) { validationsListener(); validationsListener = null; }
}