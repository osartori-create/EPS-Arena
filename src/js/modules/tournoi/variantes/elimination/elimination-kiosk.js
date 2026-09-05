// src/js/modules/tournoi/variantes/elimination/elimination-kiosk.js
// Interface élève : code + bouton élimination

import { ajouterElimination, getExclus, init as initEliminationCore } from './elimination-core.js';
import { getJoueurs } from '../../tournoi-core.js';

let currentCode = '';
let currentClasse = '';

// ============================================================
// RENDU DE L'INTERFACE ÉLÈVE
// ============================================================

function renderKiosk() {
    const container = document.getElementById('tournoi-module');
    if (!container) return;

    container.innerHTML = `
        <div class="bg-slate-800 p-6 rounded-2xl border border-slate-700 text-center max-w-md mx-auto">
            <h2 class="text-2xl font-black text-white mb-4">🏆 Tournoi Élimination</h2>
            
            <div class="mb-6">
                <label class="text-xs font-bold text-slate-400 uppercase block mb-2">Ton code</label>
                <input type="number" id="tournoi-code-input" 
                       class="w-full bg-slate-900 border-2 border-slate-600 rounded-xl p-4 text-center text-4xl font-black text-white"
                       placeholder="1" min="1" max="99" 
                       value="${currentCode || ''}"
                       oninput="window.tournoiSetCode(this.value)">
            </div>

            <button id="tournoi-btn-elimine" 
                    class="w-full bg-red-600 py-6 rounded-3xl text-3xl font-black uppercase shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    onclick="window.tournoiElimine()"
                    disabled>
                ❌ Je suis éliminé
            </button>

            <div id="tournoi-message" class="mt-4 text-sm text-slate-400 min-h-[60px]">
                ${currentCode ? 'Entre ton code et clique sur le bouton quand tu es éliminé.' : 'Entre ton code pour commencer.'}
            </div>
            
            <div id="tournoi-stats" class="mt-4 text-xs text-slate-500">
                ${currentCode ? getStats() : ''}
            </div>
        </div>
    `;

    if (currentCode) {
        document.getElementById('tournoi-btn-elimine').disabled = false;
    }
}

// ============================================================
// FONCTIONS GLOBALES (exposées sur window)
// ============================================================

window.tournoiSetCode = function(value) {
    currentCode = value.trim();
    const btn = document.getElementById('tournoi-btn-elimine');
    const message = document.getElementById('tournoi-message');
    const stats = document.getElementById('tournoi-stats');
    
    if (currentCode) {
        btn.disabled = false;
        message.innerHTML = `Code ${currentCode} sélectionné. Clique sur "Je suis éliminé" quand tu perds.`;
        stats.innerHTML = getStats();
    } else {
        btn.disabled = true;
        message.innerHTML = 'Entre ton code pour commencer.';
        stats.innerHTML = '';
    }
};

window.tournoiElimine = function() {
    if (!currentCode) {
        alert('Entre ton code d\'abord.');
        return;
    }

    const exclus = getExclus();
    if (exclus[currentCode]) {
        alert('⚠️ Tu es exclu du suivi. Vois avec le professeur.');
        return;
    }

    if (confirm(`Confirmer l'élimination du joueur ${currentCode} ?`)) {
        ajouterElimination(currentCode);
        
        const btn = document.getElementById('tournoi-btn-elimine');
        btn.disabled = true;
        btn.textContent = '✅ Élimination enregistrée !';
        
        const message = document.getElementById('tournoi-message');
        message.innerHTML = `✅ Élimination du joueur ${currentCode} enregistrée !<br><br>📱 Prends le temps de réfléchir à tes points perdus,<br>je te recharge avec 8pts, tu vas pouvoir bientôt retourner sur un terrain.`;
        
        setTimeout(() => {
            btn.textContent = '❌ Je suis éliminé';
            btn.disabled = false;
            const stats = document.getElementById('tournoi-stats');
            if (stats) stats.innerHTML = getStats();
        }, 2000);
    }
};

// ============================================================
// FONCTIONS UTILITAIRES
// ============================================================

function getStats() {
    const joueurs = getJoueurs();
    const info = joueurs[currentCode] || { eliminations: 0 };
    return `📊 Éliminations : <span class="font-bold text-yellow-400">${info.eliminations || 0}</span>`;
}

// ============================================================
// EXPORT DE L'INITIALISATION
// ============================================================

export function initEliminationKiosk(classe) {
    currentClasse = classe;
    initEliminationCore(classe);

    // Créer le module dans l'interface élève
    const activityScreen = document.getElementById('activity-screen');
    let module = document.getElementById('tournoi-module');
    if (!module) {
        module = document.createElement('div');
        module.id = 'tournoi-module';
        module.className = 'space-y-4 module';
        activityScreen.appendChild(module);
    }
    module.classList.remove('hidden');

    renderKiosk();
}

// Point d'entrée pour le dispatcher
export function init(classe) {
    initEliminationKiosk(classe);
}