// src/js/modules/escalade/escalade-prof.js
// Module professeur pour l’Escalade (classique et Bloc Contest)

import {
    initEscaladeInterface,
    populateReserveEscalade,
    initSortableEscalade,
    loadEscaladeAssignments,
    exportEscaladeConfig,
    importEscaladeConfig,
    saveEscaladeAssignments,
    updateRanks
} from './escalade-interface.js';

import {
    initBlocProf,
    cleanupBlocProf,
    transmettreConfigBloc
} from './escalade-prof-blocs.js';
import { initSuiviProf, cleanupSuiviProf } from './escalade-voies-prof.js';

import { registerModule, getModule } from '../registry.js';

// ============================================================
// SÉLECTEUR DE MODE ESCALADE (Classique / Bloc Contest)
// ============================================================
let escaladeMode = 'classic';

export function initEscaladeModeSelector() {
    const escView = document.getElementById('viewEscaladeSettings');
    if (!escView) {
        console.warn('[Escalade] viewEscaladeSettings introuvable');
        return;
    }
    // Éviter les doublons
    if (document.getElementById('escalade-mode-selector')) {
        // S'assurer qu'il est visible
        const selector = document.getElementById('escalade-mode-selector');
        selector.style.display = 'flex';
        return;
    }
    
    const selector = document.createElement('div');
    selector.id = 'escalade-mode-selector';
    selector.className = 'flex flex-wrap gap-2 mb-4 bg-slate-800 p-3 rounded-2xl border border-slate-700';
    selector.innerHTML = `
        <button id="escalade-mode-classic" class="px-4 py-2 rounded-xl font-black text-xs uppercase bg-blue-600 text-white">🧗 Escalade classique</button>
        <button id="escalade-mode-bloc" class="px-4 py-2 rounded-xl font-black text-xs uppercase bg-slate-700 text-slate-300">🧗 Bloc Contest</button>
        <button id="escalade-mode-suivi" class="px-4 py-2 rounded-xl font-black text-xs uppercase bg-slate-700 text-slate-300">🏔️ Suivi des réalisations</button>
    `;
    // Insérer en haut de la vue
    escView.prepend(selector);
    
    document.getElementById('escalade-mode-classic').addEventListener('click', () => {
        setEscaladeMode('classic');
    });
    document.getElementById('escalade-mode-bloc').addEventListener('click', () => {
        setEscaladeMode('bloc');
    });
    document.getElementById('escalade-mode-suivi').addEventListener('click', () => {
        setEscaladeMode('suivi');
    });
    
    // Par défaut, on met le mode classique
    setEscaladeMode('classic');
}

function setEscaladeMode(mode) {
    escaladeMode = mode;

    const escView = document.getElementById('viewEscaladeSettings');
    const classicEl = document.getElementById('escalade-classic-block');
    let blocEl = document.getElementById('bloc-prof-container');
    let suiviEl = document.getElementById('suivi-prof-container');

    const btnClassic = document.getElementById('escalade-mode-classic');
    const btnBloc = document.getElementById('escalade-mode-bloc');
    const btnSuivi = document.getElementById('escalade-mode-suivi');

    const clsOn = 'px-4 py-2 rounded-xl font-black text-xs uppercase bg-blue-600 text-white';
    const clsOff = 'px-4 py-2 rounded-xl font-black text-xs uppercase bg-slate-700 text-slate-300';

    // Masquer / afficher les contenus selon le mode.
    if (classicEl) classicEl.style.display = (mode === 'classic') ? '' : 'none';
    if (blocEl) blocEl.style.display = (mode === 'bloc') ? '' : 'none';
    if (suiviEl) suiviEl.style.display = (mode === 'suivi') ? '' : 'none';

    if (btnClassic) btnClassic.className = (mode === 'classic') ? clsOn : clsOff;
    if (btnBloc) btnBloc.className = (mode === 'bloc') ? clsOn : clsOff;
    if (btnSuivi) btnSuivi.className = (mode === 'suivi') ? clsOn : clsOff;

    const activeClasse = document.getElementById('selectClasse') ? document.getElementById('selectClasse').value : '';

    if (mode === 'classic') {
        initEscaladeInterface();
        initSortableEscalade();
        loadEscaladeAssignments();
    } else if (mode === 'bloc') {
        if (!blocEl && escView) {
            blocEl = document.createElement('div');
            blocEl.id = 'bloc-prof-container';
            blocEl.className = 'space-y-4 mt-6';
            escView.appendChild(blocEl);
        }
        if (blocEl) blocEl.style.display = '';
        if (activeClasse) initBlocProf(activeClasse);
        else if (blocEl) blocEl.innerHTML = '<p class="text-slate-500">Sélectionnez une classe.</p>';
    } else if (mode === 'suivi') {
        if (activeClasse) initSuiviProf(activeClasse);
        else if (suiviEl) suiviEl.innerHTML = '<p class="text-slate-500">Sélectionnez une classe.</p>';
    }

    // Émettre un événement pour que activities.js mette à jour currentDiscipline
    window.dispatchEvent(new CustomEvent('escalade-mode-changed', {
        detail: { mode: escaladeMode }
    }));
}

// ============================================================
// FONCTIONS D’INITIALISATION
// ============================================================

export function initProf(classe) {
    // Forcer la création du sélecteur
    initEscaladeModeSelector();
    // Si la classe est fournie et qu'on est en mode Bloc Contest, initialiser
    if (classe && escaladeMode === 'bloc') {
        const blocContainer = document.getElementById('bloc-prof-container');
        if (blocContainer) {
            blocContainer.style.display = '';
            initBlocProf(classe);
        }
    } else if (classe) {
        // Mode classique
        // On s'assure que le conteneur classique est visible
        const classicContainer = document.getElementById('escalade-classic-block');
        if (classicContainer) classicContainer.style.display = '';
        initEscaladeInterface();
        initSortableEscalade();
        loadEscaladeAssignments();
    }
}

export function initKiosk(classe, code) {
    console.log('[Escalade] Kiosk init pour', classe, code);
}

// ============================================================
// TRANSMISSION FIREBASE
// ============================================================

export async function transmettre(classe) {
    if (escaladeMode === 'bloc') {
        await transmettreConfigBloc();
        return;
    }
    if (escaladeMode === 'suivi') {
        if (window.suiviTransmettre) { await window.suiviTransmettre(); }
        return;
    }

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const baseProf = `etablissements/0680013V/profs/${profCode}`;
    const configData = JSON.parse(localStorage.getItem(`eps_arena_escalade_assignments_${classe}`) || '{}');
    configData.activite = 'escalade';
    
    const localMapping = {};
    Object.keys(configData).forEach(lettre => {
        if (lettre !== 'activite' && Array.isArray(configData[lettre])) {
            localMapping[`${classe}_${lettre}`] = configData[lettre];
            configData[lettre] = configData[lettre].length;
        }
    });
    
    localStorage.setItem(`eps_arena_local_mapping_${classe}`, JSON.stringify(localMapping));
    
    const { ref, set, db } = await import('../../core/firebase-service.js');
    await set(ref(db, `${baseProf}/${classe}/config`), configData);
    await set(ref(db, `${baseProf}/active_classes/${classe}`), true);
}

// ============================================================
// GÉNÉRATION DES GROUPES
// ============================================================

export async function generateTeams(classe) {
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');
    if (eleves.length === 0) return alert('Aucun élève dans cette classe.');
    
    if (escaladeMode === 'bloc') {
        alert('Pour Bloc Contest, configurez les blocs depuis l’interface professeur.');
        return;
    }
    if (escaladeMode === 'suivi') {
        alert('Pour le Suivi des réalisations, configurez les secteurs et voies dans l’onglet dédié.');
        return;
    }

    const nbGroupes = Math.ceil(eleves.length / 3);
    initEscaladeInterface(nbGroupes, true);
    await populateReserveEscalade(eleves);
    alert(`Tous les élèves sont dans la réserve Escalade (${nbGroupes} groupes). Glissez-les !`);
}

// ============================================================
// LIVE / TV
// ============================================================

export function renderLive(classe) {
    import('./escalade-live.js').then(module => {
        const data = window.lastLiveData || {};
        module.renderEscaladeLive(data);
    }).catch(err => console.error('Erreur Live Escalade :', err));
}

export function renderTV(classe) {
    import('./escalade-tv-ui.js').then(module => {
        module.renderEscaladeTV();
    }).catch(err => console.error('Erreur TV Escalade :', err));
}

// ============================================================
// ALIAS POUR COMPATIBILITÉ AVEC activities.js
// ============================================================
export const generateEscaladeTeams = generateTeams;
export const initEscaladeProf = initProf;
export const transmettreEscalade = transmettre;

// ============================================================
// EXPOSITION DES FONCTIONS GLOBALES (compatibilité HTML)
// ============================================================

window.initEscaladeInterface = initEscaladeInterface;
window.populateReserveEscalade = populateReserveEscalade;
window.initSortableEscalade = initSortableEscalade;
window.loadEscaladeAssignments = loadEscaladeAssignments;
window.exportEscaladeConfig = exportEscaladeConfig;
window.importEscaladeConfig = importEscaladeConfig;
window.saveEscaladeAssignments = saveEscaladeAssignments;
window.updateRanks = updateRanks;
window.transmettreConfigBloc = transmettreConfigBloc;

// ============================================================
// ENREGISTREMENT EXPLICITE DU MODULE
// ============================================================
export function registerEscaladeModule() {
    registerModule({
        id: 'escalade',
        label: '🧗 Escalade',
        icon: '🧗',
        initProf,
        initKiosk,
        transmettre,
        generateTeams,
        renderLive,
        renderTV,
        isDefault: false,
        cleanup: () => {
            cleanupBlocProf();
            cleanupSuiviProf();
            console.log('[Escalade] Nettoyage effectué');
        }
    });
    console.log('✅ Module escalade enregistré (appel explicite)');
}

// Appel automatique au chargement (pour compatibilité avec l'import)
registerEscaladeModule();

// ============================================================
// EXPORT PAR DÉFAUT
// ============================================================

export default {
    id: 'escalade',
    label: '🧗 Escalade',
    initProf,
    initKiosk,
    transmettre,
    generateTeams,
    renderLive,
    renderTV,
    registerEscaladeModule
};