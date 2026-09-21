// src/js/modules/cross/cross-interface.js
import { initCrossPrep } from './cross-prep.js';
import { initCrossCourse } from './cross-course.js';

let currentTab = 'prep';

export function initCrossInterface() {
    const container = document.getElementById('viewCross');
    if (!container) return;
    container.classList.remove('hidden');

    // Barre de navigation interne (Préparation / Course)
    if (!document.getElementById('cross-tabs')) {
        const nav = document.createElement('div');
        nav.id = 'cross-tabs';
        nav.className = 'flex gap-2 bg-slate-800 p-3 rounded-2xl border border-slate-700 mb-4';
        nav.innerHTML = `
            <button id="cross-tab-prep" onclick="window.crossSetTab('prep')"
                    class="px-4 py-2 rounded-xl font-black text-xs uppercase bg-blue-600 text-white">
                ⚙️ Préparation
            </button>
            <button id="cross-tab-course" onclick="window.crossSetTab('course')"
                    class="px-4 py-2 rounded-xl font-black text-xs uppercase bg-slate-700 text-slate-300">
                🏃 Course
            </button>
        `;
        container.appendChild(nav);
    }

    // Conteneur de contenu
    let content = document.getElementById('cross-content');
    if (!content) {
        content = document.createElement('div');
        content.id = 'cross-content';
        content.className = 'space-y-4';
        container.appendChild(content);
    }

    renderCurrentTab(content);
}

function renderCurrentTab(content) {
    content.innerHTML = '';
    if (currentTab === 'prep') {
        initCrossPrep(content);
    } else {
        initCrossCourse(content);
    }
}

window.crossSetTab = (tab) => {
    currentTab = tab;
    document.getElementById('cross-tab-prep').className = tab === 'prep'
        ? 'px-4 py-2 rounded-xl font-black text-xs uppercase bg-blue-600 text-white'
        : 'px-4 py-2 rounded-xl font-black text-xs uppercase bg-slate-700 text-slate-300';
    document.getElementById('cross-tab-course').className = tab === 'course'
        ? 'px-4 py-2 rounded-xl font-black text-xs uppercase bg-blue-600 text-white'
        : 'px-4 py-2 rounded-xl font-black text-xs uppercase bg-slate-700 text-slate-300';

    const content = document.getElementById('cross-content');
    if (content) renderCurrentTab(content);
};