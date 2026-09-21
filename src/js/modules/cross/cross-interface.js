// src/js/modules/cross/cross-interface.js
import { initCrossPrep } from './cross-prep.js';
import { initCrossCourse } from './cross-course.js';
import { initCrossDossards } from './cross-dossards.js';
import { initCrossResults } from './cross-results.js';

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
    <button id="cross-tab-dossards" onclick="window.crossSetTab('dossards')"
            class="px-4 py-2 rounded-xl font-black text-xs uppercase bg-slate-700 text-slate-300">
        🎫 Dossards
    </button>
    <button id="cross-tab-results" onclick="window.crossSetTab('results')"
        class="px-4 py-2 rounded-xl font-black text-xs uppercase bg-slate-700 text-slate-300">
    📊 Résultats
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
    } else if (currentTab === 'course') {
        initCrossCourse(content);
    } else if (currentTab === 'dossards') {
        initCrossDossards(content);
    } else if (currentTab === 'results') {
        initCrossResults(content);
    }
}

window.crossSetTab = (tab) => {
    currentTab = tab;
    const actifs = 'px-4 py-2 rounded-xl font-black text-xs uppercase bg-blue-600 text-white';
    const inactifs = 'px-4 py-2 rounded-xl font-black text-xs uppercase bg-slate-700 text-slate-300';

    ['prep', 'course', 'dossards', 'results'].forEach(t => {
        const el = document.getElementById(`cross-tab-${t}`);
        if (el) el.className = (t === tab) ? actifs : inactifs;
    });

    const content = document.getElementById('cross-content');
    if (content) renderCurrentTab(content);
};