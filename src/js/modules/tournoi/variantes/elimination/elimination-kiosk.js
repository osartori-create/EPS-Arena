// src/js/modules/tournoi/variantes/elimination/elimination-kiosk.js
import { ajouterElimination, getExclus, initCore } from './elimination-core.js';
import { getJoueurs } from '../../tournoi-core.js';

let currentCode = '';
let currentClasse = '';
let resetTimer = null;

export function init(classe) {
    currentClasse = classe;
    initCore(classe);
    renderKiosk();
    return () => {
        if (resetTimer) clearTimeout(resetTimer);
        console.log('🧹 [Élimination Kiosk] Nettoyage');
    };
}

function renderKiosk(message, showStats) {
    const container = document.getElementById('tournoi-module');
    if (!container) return;

    const statsHtml = showStats ? getStats() : '';
    const defaultMessage = message || (currentCode ? 'Entre ton code et clique sur "Je suis éliminé" quand tu perds.' : 'Entre ton code pour commencer.');

    container.innerHTML = `
        <div class="bg-slate-800 p-6 rounded-2xl border border-slate-700 text-center max-w-md mx-auto">
            <h2 class="text-2xl font-black text-white mb-4">🏆 Tournoi Élimination</h2>
            
            <div class="mb-6">
                <label class="text-xs font-bold text-slate-400 uppercase block mb-2">Ton code</label>
                <input type="number" id="tournoi-code-input" 
                       inputmode="numeric" 
                       class="w-full bg-slate-900 border-2 border-slate-600 rounded-xl p-4 text-center text-4xl font-black text-white"
                       placeholder="Ton code" 
                       min="1" max="99" 
                       value="${currentCode || ''}"
                       oninput="window.tournoiSetCode(this.value)">
            </div>

            <button id="tournoi-btn-elimine" 
                    class="w-full bg-red-600 py-6 rounded-3xl text-3xl font-black uppercase shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    onclick="window.tournoiElimine()"
                    ${currentCode ? '' : 'disabled'}>
                ❌ Je suis éliminé
            </button>

            <div id="tournoi-message" class="mt-4 text-sm text-slate-400 min-h-[60px] transition-all duration-300">
                ${defaultMessage}
            </div>
            
            <div id="tournoi-stats" class="mt-4 text-xs text-slate-500 min-h-[24px]">
                ${statsHtml}
            </div>
        </div>
    `;

    // Mettre à jour l'état du bouton
    const btn = document.getElementById('tournoi-btn-elimine');
    if (btn) {
        btn.disabled = !currentCode;
    }
}

// ✅ Fonction pour mettre à jour le message sans re-rendre tout
function updateMessageAndStats(message, statsHtml) {
    const msgEl = document.getElementById('tournoi-message');
    const statsEl = document.getElementById('tournoi-stats');
    if (msgEl) msgEl.innerHTML = message;
    if (statsEl) statsEl.innerHTML = statsHtml || '';
}

// ✅ Réinitialisation après 3 secondes
function resetAfterDelay() {
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
        currentCode = '';
        const input = document.getElementById('tournoi-code-input');
        if (input) input.value = '';
        const btn = document.getElementById('tournoi-btn-elimine');
        if (btn) btn.disabled = true;
        updateMessageAndStats('Entre ton code pour commencer.', '');
        resetTimer = null;
    }, 3000);
}

// Fonctions globales
window.tournoiSetCode = function(value) {
    currentCode = value.trim();
    const btn = document.getElementById('tournoi-btn-elimine');
    const msgEl = document.getElementById('tournoi-message');
    const statsEl = document.getElementById('tournoi-stats');
    
    if (currentCode) {
        btn.disabled = false;
        if (msgEl) msgEl.innerHTML = `Code ${currentCode} sélectionné. Clique sur "Je suis éliminé" quand tu perds.`;
        if (statsEl) statsEl.innerHTML = getStats();
    } else {
        btn.disabled = true;
        if (msgEl) msgEl.innerHTML = 'Entre ton code pour commencer.';
        if (statsEl) statsEl.innerHTML = '';
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
        
        // Désactiver le bouton pendant le traitement
        const btn = document.getElementById('tournoi-btn-elimine');
        btn.disabled = true;
        
        // Afficher le message de confirmation + compteur
        const msg = `✅ Élimination du joueur ${currentCode} enregistrée !<br><br>📱 Prends le temps de réfléchir à tes points perdus,<br>je te recharge avec 8pts, tu vas pouvoir bientôt retourner sur un terrain.`;
        const stats = getStats();
        updateMessageAndStats(msg, stats);
        
        // Réinitialiser après 3 secondes
        resetAfterDelay();
    }
};

function getStats() {
    const joueurs = getJoueurs();
    const info = joueurs[currentCode] || { eliminations: 0 };
    return `📊 Éliminations : <span class="font-bold text-yellow-400">${info.eliminations || 0}</span>`;
}

// Pour l'intégration depuis eleve-app
export function initTournoiKioskFromApp(classe) {
    const activityScreen = document.getElementById('activity-screen');
    let module = document.getElementById('tournoi-module');
    if (!module) {
        module = document.createElement('div');
        module.id = 'tournoi-module';
        module.className = 'space-y-4 module';
        activityScreen.appendChild(module);
    }
    module.classList.remove('hidden');
    init(classe);
}