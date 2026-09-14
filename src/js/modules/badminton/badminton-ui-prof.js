// src/js/modules/badminton/badminton-ui-prof.js
// Sélecteur de mode prof + masquage conditionnel des blocs

import { getModesList } from './badminton-registry.js';

let currentMode = 'terrain';
let initialized = false;

export function initBadmintonModeSelector(containerId = 'badminton-mode-selector') {
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn('⚠️ [Badminton UI] Conteneur du sélecteur introuvable');
        return;
    }

    const modes = getModesList();
    currentMode = localStorage.getItem('badminton_mode') || 'terrain';
    if (!modes.find(m => m.id === currentMode)) currentMode = 'terrain';

    renderSelector(container, modes);
    applyModeVisibility(currentMode);
    initialized = true;
}

function renderSelector(container, modes) {
    container.innerHTML = modes.map(m => `
        <button onclick="window.setBadmintonMode('${m.id}')"
                id="badminton-mode-${m.id}"
                class="p-4 rounded-xl font-black border-2 active:scale-95 transition-transform text-left
                       ${m.id === currentMode
                           ? 'bg-blue-600 border-blue-400 text-white'
                           : 'bg-slate-700 border-slate-600 text-slate-300'}">
            <div class="text-xl mb-1">${m.icon} ${m.label}</div>
            <div class="text-[10px] font-normal opacity-80 leading-tight">${m.description || ''}</div>
        </button>
    `).join('');

    const label = document.getElementById('badminton-mode-label');
    if (label) {
        const mode = modes.find(m => m.id === currentMode);
        label.textContent = mode ? mode.label : 'Terrain';
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

    document.querySelectorAll('#badminton-mode-selector button').forEach(btn => {
        const isActive = btn.id === `badminton-mode-${mode}`;
        btn.className = `p-4 rounded-xl font-black border-2 active:scale-95 transition-transform text-left ${
            isActive
                ? 'bg-blue-600 border-blue-400 text-white'
                : 'bg-slate-700 border-slate-600 text-slate-300'
        }`;
    });

    const label = document.getElementById('badminton-mode-label');
    if (label) {
        const m = modes.find(m => m.id === mode);
        label.textContent = m ? m.label : 'Terrain';
    }

    applyModeVisibility(mode);
    window.dispatchEvent(new CustomEvent('badminton-mode-changed', { detail: { mode } }));
}

function applyModeVisibility(mode) {
    const isManiere = (mode === 'maniere');
    document.querySelectorAll('.badminton-maniere-only').forEach(el => {
        el.classList.toggle('hidden', !isManiere);
    });
    document.querySelectorAll('.badminton-terrain-only').forEach(el => {
        el.classList.toggle('hidden', isManiere);
    });
    console.log(`🎨 [Badminton UI] Visibilité pour mode "${mode}"`);
}

window.setBadmintonMode = setBadmintonMode;
window.initBadmintonModeSelector = initBadmintonModeSelector;

export function getCurrentBadmintonMode() {
    return localStorage.getItem('badminton_mode') || 'terrain';
}