// src/js/modules/badminton/badminton-ui-prof.js
// Interface professeur pour la sélection du mode

import { getModesList } from './badminton-registry.js';

let currentMode = 'terrain';

export function initBadmintonModeSelector(containerId = 'badminton-mode-selector') {
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn('⚠️ Conteneur du sélecteur de mode introuvable');
        return;
    }

    const modes = getModesList();
    currentMode = localStorage.getItem('badminton_mode') || 'terrain';

    // S'assurer que le mode existe
    if (!modes.find(m => m.id === currentMode)) {
        currentMode = 'terrain';
    }

     window.badmintonMode = currentMode;
    renderSelector(container, modes);
}

function renderSelector(container, modes) {
    container.innerHTML = modes.map(m => `
        <button onclick="window.setBadmintonMode('${m.id}')" 
                id="badminton-mode-${m.id}"
                class="${m.id === currentMode ? 'bg-blue-600 border-blue-400' : 'bg-slate-700 border-slate-600'} 
                       p-4 rounded-xl font-black text-white border-2 active:scale-95 transition-transform text-sm">
            ${m.icon} ${m.label}
        </button>
    `).join('');

    // Mettre à jour le label
    const label = document.getElementById('badminton-mode-label');
    if (label) {
        const mode = modes.find(m => m.id === currentMode);
        label.textContent = mode ? mode.label : 'Classique';
    }
}

export function setBadmintonMode(mode) {
    const modes = getModesList();
    if (!modes.find(m => m.id === mode)) {
        console.warn(`⚠️ Mode "${mode}" inconnu`);
        return;
    }
    currentMode = mode;
    localStorage.setItem('badminton_mode', mode);

    // Mettre à jour l'interface
    document.querySelectorAll('#badminton-mode-selector button').forEach(btn => {
        const isActive = btn.id === `badminton-mode-${mode}`;
        btn.className = isActive ? 
            'bg-blue-600 p-4 rounded-xl font-black text-white border-2 border-blue-400' : 
            'bg-slate-700 p-4 rounded-xl font-black text-white border-2 border-slate-600';
    });

    const label = document.getElementById('badminton-mode-label');
    if (label) {
        const m = modes.find(m => m.id === mode);
        label.textContent = m ? m.label : 'Classique';
    }

    // Déclencher l'événement pour la transmission
    window.dispatchEvent(new CustomEvent('badminton-mode-changed', { detail: { mode } }));
}

// Exposer les fonctions globalement
window.setBadmintonMode = setBadmintonMode;