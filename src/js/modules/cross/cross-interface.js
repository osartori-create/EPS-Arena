// src/js/modules/cross/cross-interface.js
import { initCrossPrep } from './cross-prep.js';

export function initCrossInterface() {
    const container = document.getElementById('viewCross');
    if (!container) return;
    container.classList.remove('hidden');
    initCrossPrep(container);
}