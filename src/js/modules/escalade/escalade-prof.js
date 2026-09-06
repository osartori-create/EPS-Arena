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

import { registerModule } from '../registry.js';

// ============================================================
// SÉLECTEUR DE MODE ESCALADE (Classique / Bloc Contest)
// ============================================================
let escaladeMode = 'classic';

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
    escView.prepend(selector);
    
    document.getElementById('escalade-mode-classic').addEventListener('click', () => {
        setEscaladeMode('classic');
    });
    document.getElementById('escalade-mode-bloc').addEventListener('click', () => {
        setEscaladeMode('bloc');
    });
    
    setEscaladeMode('classic');
}

function setEscaladeMode(mode) {
    escaladeMode = mode;
    const classicContainer = document.getElementById('escalade-classic-container');
    const blocContainer = document.getElementById('bloc-prof-container');
    
    if (mode === 'classic') {
        if (classicContainer) classicContainer.style.display = '';
        if (blocContainer) blocContainer.style.display = 'none';
        const btnClassic = document.getElementById('escalade-mode-classic');
        const btnBloc = document.getElementById('escalade-mode-bloc');
        if (btnClassic) btnClassic.className = 'px-4 py-2 rounded-xl font-black text-xs uppercase bg-blue-600 text-white';
        if (btnBloc) btnBloc.className = 'px-4 py-2 rounded-xl font-black text-xs uppercase bg-slate-700 text-slate-300';
        initEscaladeInterface();
        initSortableEscalade();
        loadEscaladeAssignments();
    } else {
        if (classicContainer) classicContainer.style.display = 'none';
        if (blocContainer) {
            blocContainer.style.display = '';
            const activeClasse = document.getElementById('selectClasse').value;
            if (activeClasse) initBlocProf(activeClasse);
            else blocContainer.innerHTML = '<p class="text-slate-500">Sélectionnez une classe.</p>';
        }
        const btnClassic = document.getElementById('escalade-mode-classic');
        const btnBloc = document.getElementById('escalade-mode-bloc');
        if (btnBloc) btnBloc.className = 'px-4 py-2 rounded-xl font-black text-xs uppercase bg-blue-600 text-white';
        if (btnClassic) btnClassic.className = 'px-4 py-2 rounded-xl font-black text-xs uppercase bg-slate-700 text-slate-300';
    }
}

// ============================================================
// FONCTIONS D’INITIALISATION
// ============================================================

export function initProf(classe) {
    initEscaladeModeSelector();
    if (classe && escaladeMode === 'bloc') {
        const blocContainer = document.getElementById('bloc-prof-container');
        if (blocContainer) {
            blocContainer.style.display = '';
            initBlocProf(classe);
        }
    } else if (classe) {
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
    
    const { ref, set } = await import('../../core/firebase-service.js');
    const { db } = await import('../../core/firebase-service.js');
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
// ENREGISTREMENT DU MODULE
// ============================================================

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
        console.log('[Escalade] Nettoyage effectué');
    }
});

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
    renderTV
};