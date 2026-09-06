// src/js/modules/escalade/escalade-prof.js
// Module professeur pour l'Escalade (classique + Bloc Contest)

import { registerModule } from '../registry.js';
import { initEscaladeInterface, populateReserveEscalade, initSortableEscalade, loadEscaladeAssignments, exportEscaladeConfig, importEscaladeConfig } from './escalade-interface.js';
import { initBlocProf, cleanupBlocProf, transmettreConfigBloc } from './escalade-prof-blocs.js';
import { db, ref, set } from '../../core/firebase-service.js';
import { getPhotoUrl } from '../../services/admin-service.js';
import { transmettreConfigBloc } from './escalade-prof-blocs.js';

let currentMode = 'classic'; // 'classic' | 'bloc'
let currentClasse = '';

// ============================================================
// SÉLECTEUR DE MODE (classique / Bloc Contest)
// ============================================================
function initEscaladeModeSelector() {
    const escView = document.getElementById('viewEscaladeSettings');
    if (!escView) return;
    if (document.getElementById('escalade-mode-selector')) return;

    const selector = document.createElement('div');
    selector.id = 'escalade-mode-selector';
    selector.className = 'flex gap-2 mb-4 bg-slate-800 p-3 rounded-2xl border border-slate-700';
    selector.innerHTML = `
        <button id="escalade-mode-classic" class="px-4 py-2 rounded-xl font-black text-xs uppercase bg-blue-600 text-white">🧗 Escalade classique</button>
        <button id="escalade-mode-bloc" class="px-4 py-2 rounded-xl font-black text-xs uppercase bg-slate-700 text-slate-300">🧗 Bloc Contest</button>
    `;

    // Insérer en haut de la vue (après le titre)
    const header = escView.querySelector('.flex.justify-between');
    if (header) {
        header.after(selector);
    } else {
        escView.prepend(selector);
    }

    document.getElementById('escalade-mode-classic').addEventListener('click', () => setEscaladeMode('classic'));
    document.getElementById('escalade-mode-bloc').addEventListener('click', () => setEscaladeMode('bloc'));

    // Par défaut, mode classique
    setEscaladeMode('classic');
}

function setEscaladeMode(mode) {
    currentMode = mode;
    const escView = document.getElementById('viewEscaladeSettings');
    if (!escView) return;

    const classicContainer = document.getElementById('escalade-classic-container');
    const blocContainer = document.getElementById('bloc-prof-container');

    // Créer les conteneurs si besoin
    if (!classicContainer) {
        const div = document.createElement('div');
        div.id = 'escalade-classic-container';
        div.className = 'space-y-4';
        // Insérer avant le conteneur Bloc Contest s'il existe
        const existingBloc = document.getElementById('bloc-prof-container');
        if (existingBloc) {
            existingBloc.before(div);
        } else {
            escView.appendChild(div);
        }
    }

    if (!blocContainer) {
        const div = document.createElement('div');
        div.id = 'bloc-prof-container';
        div.className = 'space-y-4 mt-6';
        div.style.display = 'none';
        escView.appendChild(div);
    }

    const classicEl = document.getElementById('escalade-classic-container');
    const blocEl = document.getElementById('bloc-prof-container');

    if (mode === 'classic') {
        if (classicEl) classicEl.style.display = '';
        if (blocEl) blocEl.style.display = 'none';
        document.getElementById('escalade-mode-classic').className = 'px-4 py-2 rounded-xl font-black text-xs uppercase bg-blue-600 text-white';
        document.getElementById('escalade-mode-bloc').className = 'px-4 py-2 rounded-xl font-black text-xs uppercase bg-slate-700 text-slate-300';
        // Réinitialiser l'interface classique
        initEscaladeInterface();
        initSortableEscalade();
        loadEscaladeAssignments();
    } else {
        if (classicEl) classicEl.style.display = 'none';
        if (blocEl) {
            blocEl.style.display = '';
            const activeClasse = document.getElementById('selectClasse').value;
            if (activeClasse) {
                initBlocProf(activeClasse);
                currentClasse = activeClasse;
            } else {
                blocEl.innerHTML = '<p class="text-slate-500">Sélectionnez une classe.</p>';
            }
        }
        document.getElementById('escalade-mode-bloc').className = 'px-4 py-2 rounded-xl font-black text-xs uppercase bg-blue-600 text-white';
        document.getElementById('escalade-mode-classic').className = 'px-4 py-2 rounded-xl font-black text-xs uppercase bg-slate-700 text-slate-300';
    }
}

// ============================================================
// FONCTIONS D'INITIALISATION
// ============================================================
export function initEscaladeProf(classe) {
    currentClasse = classe;
    initEscaladeModeSelector();
    // Si le mode Bloc Contest était actif, on le réinitialise
    if (currentMode === 'bloc') {
        setEscaladeMode('bloc');
    } else {
        initEscaladeInterface();
        initSortableEscalade();
        loadEscaladeAssignments();
    }
}

// ============================================================
// GÉNÉRATION DES ÉQUIPES (pour l'escalade classique)
// ============================================================
export async function generateEscaladeTeams(classe, eleves) {
    const nbGroupes = Math.ceil(eleves.length / 3);
    initEscaladeInterface(nbGroupes, true);
    await populateReserveEscalade(eleves);
    return nbGroupes;
}

// ============================================================
// TRANSMISSION FIREBASE
// ============================================================
export async function transmettreEscalade(classe) {
    if (currentMode === 'bloc') {
        // Déléguer à la transmission Bloc Contest
        return await transmettreConfigBloc();
    }

    // Mode classique
    const configData = JSON.parse(localStorage.getItem(`eps_arena_escalade_assignments_${classe}`) || '{}');
    configData.activite = 'escalade';
    const localMapping = {};
    Object.keys(configData).forEach(lettre => {
        if (lettre !== 'activite' && lettre !== 'reserve' && lettre !== 'nbGroupes' && Array.isArray(configData[lettre])) {
            localMapping[`${classe}_${lettre}`] = configData[lettre];
            configData[lettre] = configData[lettre].length;
        }
    });

    localStorage.setItem(`eps_arena_local_mapping_${classe}`, JSON.stringify(localMapping));

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const baseProf = `etablissements/0680013V/profs/${profCode}`;

    await set(ref(db, `${baseProf}/${classe}/config`), configData);
    await set(ref(db, `${baseProf}/active_classes/${classe}`), true);
    return true;
}

// ============================================================
// EXPORT / IMPORT
// ============================================================
export { exportEscaladeConfig, importEscaladeConfig };

// ============================================================
// ENREGISTREMENT DU MODULE
// ============================================================
registerModule({
    id: 'escalade',
    label: 'Escalade',
    icon: '🧗',
    initProf: initEscaladeProf,
    generateTeams: generateEscaladeTeams,
    transmettre: transmettreEscalade,
    isDefault: false,
});