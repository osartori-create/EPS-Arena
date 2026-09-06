// src/js/modules/escalade/escalade-prof.js
// ... (imports et début du fichier)

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
    selector.className = 'flex gap-2 mb-4 bg-slate-800 p-3 rounded-2xl border border-slate-700';
    selector.innerHTML = `
        <button id="escalade-mode-classic" class="px-4 py-2 rounded-xl font-black text-xs uppercase bg-blue-600 text-white">🧗 Escalade classique</button>
        <button id="escalade-mode-bloc" class="px-4 py-2 rounded-xl font-black text-xs uppercase bg-slate-700 text-slate-300">🧗 Bloc Contest</button>
    `;
    // Insérer en haut de la vue
    escView.prepend(selector);
    
    document.getElementById('escalade-mode-classic').addEventListener('click', () => {
        setEscaladeMode('classic');
    });
    document.getElementById('escalade-mode-bloc').addEventListener('click', () => {
        setEscaladeMode('bloc');
    });
    
    // Par défaut, on met le mode classique
    setEscaladeMode('classic');
}

function setEscaladeMode(mode) {
    escaladeMode = mode;
    // Mettre à jour l'interface
    const classicContainer = document.getElementById('escalade-classic-container');
    const blocContainer = document.getElementById('bloc-prof-container');
    
    // Créer les conteneurs s'ils n'existent pas
    const escView = document.getElementById('viewEscaladeSettings');
    if (!classicContainer && escView) {
        const container = document.createElement('div');
        container.id = 'escalade-classic-container';
        container.className = 'space-y-4';
        // Insérer après le sélecteur
        const selector = document.getElementById('escalade-mode-selector');
        if (selector) {
            selector.after(container);
        } else {
            escView.prepend(container);
        }
        // On y mettra le contenu de l'escalade classique plus tard
    }
    if (!blocContainer && escView) {
        const container = document.createElement('div');
        container.id = 'bloc-prof-container';
        container.className = 'space-y-4 mt-6';
        container.style.display = 'none';
        escView.appendChild(container);
    }

    const classicEl = document.getElementById('escalade-classic-container');
    const blocEl = document.getElementById('bloc-prof-container');
    
    if (mode === 'classic') {
        if (classicEl) classicEl.style.display = '';
        if (blocEl) blocEl.style.display = 'none';
        const btnClassic = document.getElementById('escalade-mode-classic');
        const btnBloc = document.getElementById('escalade-mode-bloc');
        if (btnClassic) btnClassic.className = 'px-4 py-2 rounded-xl font-black text-xs uppercase bg-blue-600 text-white';
        if (btnBloc) btnBloc.className = 'px-4 py-2 rounded-xl font-black text-xs uppercase bg-slate-700 text-slate-300';
        // Initialiser l'interface classique
        initEscaladeInterface();
        initSortableEscalade();
        loadEscaladeAssignments();
    } else {
        if (classicEl) classicEl.style.display = 'none';
        if (blocEl) {
            blocEl.style.display = '';
            const activeClasse = document.getElementById('selectClasse').value;
            if (activeClasse) initBlocProf(activeClasse);
            else blocEl.innerHTML = '<p class="text-slate-500">Sélectionnez une classe.</p>';
        }
        const btnClassic = document.getElementById('escalade-mode-classic');
        const btnBloc = document.getElementById('escalade-mode-bloc');
        if (btnBloc) btnBloc.className = 'px-4 py-2 rounded-xl font-black text-xs uppercase bg-blue-600 text-white';
        if (btnClassic) btnClassic.className = 'px-4 py-2 rounded-xl font-black text-xs uppercase bg-slate-700 text-slate-300';
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
        const classicContainer = document.getElementById('escalade-classic-container');
        if (classicContainer) classicContainer.style.display = '';
        initEscaladeInterface();
        initSortableEscalade();
        loadEscaladeAssignments();
    }
}

// ... (reste du fichier inchangé, gardez les autres fonctions : initKiosk, transmettre, generateTeams, renderLive, renderTV, alias, registerModule, etc.)