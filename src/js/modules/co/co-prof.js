// src/js/modules/co/co-prof.js
// Point d’entrée : sélecteur de mode (Classique / OrientShow)

import { registerModule } from '../registry.js';
import { initCOInterface, initSortableCO, loadCOAssignments } from './co-interface.js';

let currentMode = 'classique';
let currentClasse = '';

// ============================================================
// SÉLECTEUR DE MODE
// ============================================================
export function initCOModeSelector() {
    const coView = document.getElementById('viewCOSettings');
    if (!coView) {
        console.warn('[CO] viewCOSettings introuvable');
        return;
    }
    if (document.getElementById('co-mode-selector')) {
        const selector = document.getElementById('co-mode-selector');
        selector.style.display = 'flex';
        return;
    }

    const selector = document.createElement('div');
    selector.id = 'co-mode-selector';
    selector.className = 'flex gap-2 mb-4 bg-slate-800 p-3 rounded-2xl border border-slate-700';
    selector.innerHTML = `
        <button id="co-mode-classique" class="px-4 py-2 rounded-xl font-black text-xs uppercase bg-blue-600 text-white">🧭 CO classique</button>
        <button id="co-mode-orientshow" class="px-4 py-2 rounded-xl font-black text-xs uppercase bg-slate-700 text-slate-300">🏃 OrientShow</button>
    `;
    coView.prepend(selector);

    // Créer les conteneurs s'ils n'existent pas
    if (!document.getElementById('co-classique-container')) {
        const container = document.createElement('div');
        container.id = 'co-classique-container';
        container.className = 'space-y-4';
        selector.after(container);
    }
    if (!document.getElementById('co-orientshow-container')) {
        const container = document.createElement('div');
        container.id = 'co-orientshow-container';
        container.className = 'space-y-4';
        container.style.display = 'none';
        coView.appendChild(container);
    }

    document.getElementById('co-mode-classique').addEventListener('click', () => setCOMode('classique'));
    document.getElementById('co-mode-orientshow').addEventListener('click', () => setCOMode('orientshow'));

    setCOMode('classique');
}

function setCOMode(mode) {
    currentMode = mode;
    const containerClassique = document.getElementById('co-classique-container');
    const containerOrientShow = document.getElementById('co-orientshow-container');

    if (mode === 'classique') {
        if (containerClassique) containerClassique.style.display = '';
        if (containerOrientShow) containerOrientShow.style.display = 'none';
        const btnClassique = document.getElementById('co-mode-classique');
        const btnOrient = document.getElementById('co-mode-orientshow');
        if (btnClassique) btnClassique.className = 'px-4 py-2 rounded-xl font-black text-xs uppercase bg-blue-600 text-white';
        if (btnOrient) btnOrient.className = 'px-4 py-2 rounded-xl font-black text-xs uppercase bg-slate-700 text-slate-300';
        // Initialiser CO classique dans le conteneur
        // Vider le conteneur classique avant de le remplir
        if (containerClassique) containerClassique.innerHTML = '';
        initCOInterface();
        initSortableCO();
        loadCOAssignments();
    } else {
        if (containerClassique) containerClassique.style.display = 'none';
        if (containerOrientShow) {
            containerOrientShow.style.display = '';
            // ✅ Vider le conteneur avant de le remplir
            containerOrientShow.innerHTML = '';
            // ✅ Appeler l’initialisation OrientShow avec le conteneur
            import('./orientshow/orientshow-prof.js').then(module => {
                if (module.initProf) {
                    // On passe le conteneur
                    module.initProf(currentClasse, containerOrientShow);
                }
            });
        }
        const btnClassique = document.getElementById('co-mode-classique');
        const btnOrient = document.getElementById('co-mode-orientshow');
        if (btnOrient) btnOrient.className = 'px-4 py-2 rounded-xl font-black text-xs uppercase bg-blue-600 text-white';
        if (btnClassique) btnClassique.className = 'px-4 py-2 rounded-xl font-black text-xs uppercase bg-slate-700 text-slate-300';
    }
}

// ============================================================
// FONCTIONS D’INITIALISATION (exposées pour le registre)
// ============================================================
export function initProf(classe) {
    currentClasse = classe;
    initCOModeSelector();
}

export function initKiosk(classe, code) {
    if (currentMode === 'classique') {
        import('./classique/classique-kiosk.js').then(module => {
            if (module.initKiosk) module.initKiosk(classe, code);
        });
    } else {
        import('./orientshow/orientshow-kiosk.js').then(module => {
            if (module.initKiosk) module.initKiosk(classe, code);
        });
    }
}

export async function generateTeams(classe) {
    if (currentMode === 'classique') {
        const module = await import('./classique/classique-prof.js');
        if (module.generateTeams) return module.generateTeams(classe);
    } else {
        const module = await import('./orientshow/orientshow-prof.js');
        if (module.generateTeams) return module.generateTeams(classe);
    }
    alert('Aucune génération définie pour ce mode.');
}

export async function transmettre(classe) {
    if (currentMode === 'classique') {
        const module = await import('./classique/classique-prof.js');
        if (module.transmettre) return module.transmettre(classe);
    } else {
        const module = await import('./orientshow/orientshow-prof.js');
        if (module.transmettre) return module.transmettre(classe);
    }
    alert('Aucune transmission définie pour ce mode.');
}

export function renderLive(classe) {
    if (currentMode === 'classique') {
        import('./co-live.js').then(module => {
            const data = window.lastLiveData || {};
            module.renderCOLive(data);
        });
    } else {
        import('./orientshow/orientshow-live.js').then(module => {
            module.renderOrientShowLive();
        });
    }
}

export function renderTV(classe) {
    if (currentMode === 'classique') {
        console.log('[CO] TV classique non disponible');
    } else {
        import('./orientshow/orientshow-tv.js').then(module => {
            module.renderOrientShowTV();
        });
    }
}

// ============================================================
// EXPOSITION DES FONCTIONS GLOBALES (compatibilité HTML)
// ============================================================
window.initCOModeSelector = initCOModeSelector;

// ============================================================
// ENREGISTREMENT DU MODULE
// ============================================================
registerModule({
    id: 'co',
    label: '🧭 Course d\'orientation',
    icon: '🧭',
    initProf,
    initKiosk,
    generateTeams,
    transmettre,
    renderLive,
    renderTV,
    isDefault: false,
    cleanup: () => {
        console.log('[CO] Nettoyage effectué');
    }
});

export default {
    id: 'co',
    label: '🧭 Course d\'orientation',
    initProf,
    initKiosk,
    generateTeams,
    transmettre,
    renderLive,
    renderTV
};