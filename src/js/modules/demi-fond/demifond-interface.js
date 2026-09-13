// src/js/modules/demi-fond/demifond-interface.js
// Point d'entrée de l'interface prof pour 1/2 Fond
// Dispatch vers le sous-module sélectionné

import { COULEURS_GROUPES } from './demifond-common.js';

const SOUS_MODULE_KEY = 'eps_arena_demifond_sous_module';

export function initDemiFondInterface() {
    const container = document.getElementById('viewDemiFondSettings');
    if (!container) {
        // Création dynamique si absent
        const parent = document.getElementById('viewActivities');
        if (!parent) return;
        const div = document.createElement('div');
        div.id = 'viewDemiFondSettings';
        div.className = 'hidden space-y-4';
        parent.appendChild(div);
        setTimeout(() => initDemiFondInterface(), 50);
        return;
    }

    const sousModule = localStorage.getItem(SOUS_MODULE_KEY) || '3x5min';

    container.innerHTML = '';

    // Sélecteur de sous-module
    const selector = document.createElement('div');
    selector.className = 'bg-slate-800 p-4 rounded-2xl border border-slate-700';
    selector.innerHTML = `
        <label class="text-xs font-bold text-blue-400 uppercase block mb-2">Sous-module 1/2 Fond</label>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button onclick="window.demifondSetSousModule('3x5min')" id="dmfSubMod-3x5min"
                    class="p-4 rounded-xl font-black text-sm border-2 text-left active:scale-95 transition-all">
                <div class="text-xl mb-1">⏱️ 3×5min R=3'</div>
                <div class="text-[10px] font-normal opacity-80">3 courses de 5min, 3min de pause entre chaque</div>
            </button>
        </div>
    `;
    container.appendChild(selector);

    // Conteneur pour le sous-module
    const subContainer = document.createElement('div');
    subContainer.id = 'demifond-submodule-container';
    container.appendChild(subContainer);

    // Marquer la sélection
    const btn3x5 = document.getElementById('dmfSubMod-3x5min');
    if (btn3x5) {
        btn3x5.className = 'p-4 rounded-xl font-black text-sm border-2 border-blue-500 bg-blue-900/40 text-white text-left active:scale-95 transition-all ring-2 ring-blue-400';
    }

    // Charger le sous-module
    chargerSousModule(sousModule, subContainer);
}

function chargerSousModule(sousModule, container) {
    if (sousModule === '3x5min') {
        import('./variantes/trois-cinq-min/trois-cinq-min-interface.js').then(m => {
            m.initTroisCinqMinInterface(container);
        }).catch(err => {
            console.error('[DemiFond] Erreur chargement sous-module:', err);
            container.innerHTML = `<p class="text-red-400">❌ Erreur de chargement : ${err.message}</p>`;
        });
    }
}

window.demifondSetSousModule = function(sousModule) {
    localStorage.setItem(SOUS_MODULE_KEY, sousModule);
    initDemiFondInterface();
};

window.initDemiFondInterface = initDemiFondInterface;