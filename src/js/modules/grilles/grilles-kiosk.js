// src/js/modules/grilles/grilles-kiosk.js
// Kiosque élève : auto-évaluation anonyme (code numérique)
// ⚠️ Aucune donnée nominative

import { db, ref, onValue, push } from '../../core/firebase-service.js';
import { NIVEAUX, getCouleurNiveau, getToutesGrilles } from './grilles-core.js';

let currentClasse = '';
let currentGrille = null;
let currentPeriode = '';
let currentCode = null;
let currentNotes = {};
let configListener = null;

// ============================================================
// POINT D'ENTRÉE
// ============================================================
export function initGrillesKiosk(classe) {
    currentClasse = classe;
    currentGrille = null;
    currentPeriode = '';
    currentCode = null;
    currentNotes = {};

    const container = document.getElementById('grilles-module');
    if (!container) return;

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const configRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/grilles/config`);

    if (configListener) configListener();
    configListener = onValue(configRef, (snap) => {
        const config = snap.val();
        if (config && config.actif && config.grilleId) {
            const grilles = getToutesGrilles();
            currentGrille = grilles.find(g => g.id === config.grilleId);
            if (currentGrille) {
                currentPeriode = config.periode || currentGrille.periodes[0];
                renderChoixCode(container);
            } else {
                container.innerHTML = `<div class="text-center py-10 text-slate-400"><p>⏳ Grille "${config.grilleId}" non trouvée dans cette tablette.</p></div>`;
            }
        } else {
            container.innerHTML = `<div class="text-center py-10 text-slate-400"><p>⏳ En attente de l'activation par le professeur...</p></div>`;
        }
    });
}

// ============================================================
// ÉCRAN 1 : SAISIE DU CODE
// ============================================================
function renderChoixCode(container) {
    container.innerHTML = `
        <div class="space-y-4 max-w-md mx-auto">
            <div class="text-center py-4">
                <h2 class="text-2xl font-black text-white mb-2">✏️ Je m'auto-évalue</h2>
                <p class="text-slate-400 text-sm">${currentGrille.titre} · ${currentPeriode}</p>
            </div>

            <div class="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                <label class="text-xs font-bold text-slate-400 uppercase block mb-3 text-center">
                    Entre ton code (donné par ton prof)
                </label>
                <div id="grilles-code-display" class="bg-slate-950 border-2 border-slate-700 w-40 h-16 rounded-2xl flex items-center justify-center text-4xl font-mono tracking-widest mb-4 text-emerald-400 shadow-inner mx-auto">--</div>
                <div class="grid grid-cols-3 gap-3 max-w-xs mx-auto">
                    ${[1,2,3,4,5,6,7,8,9].map(n => `
                        <button onclick="window.grillesKioskAddCode(${n})"
                                class="bg-slate-800 w-16 h-16 rounded-xl text-2xl font-black text-white active:bg-blue-600 transition-all">${n}</button>
                    `).join('')}
                    <button onclick="window.grillesKioskClearCode()"
                            class="bg-red-950 text-red-400 w-16 h-16 rounded-xl text-xs font-black uppercase border border-red-800 active:bg-red-800">Effacer</button>
                    <button onclick="window.grillesKioskAddCode(0)"
                            class="bg-slate-800 w-16 h-16 rounded-xl text-2xl font-black text-white active:bg-blue-600">0</button>
                    <button onclick="window.grillesKioskValiderCode()"
                            class="bg-emerald-600 text-white w-16 h-16 rounded-xl text-xs font-black uppercase border-2 border-emerald-400 active:bg-emerald-700">OK</button>
                </div>
            </div>

            <button onclick="window.retourMenuGrilles()"
                    class="w-full bg-slate-700 hover:bg-slate-600 py-3 rounded-2xl font-black text-sm text-white active:scale-95">
                ← Retour
            </button>
        </div>
    `;

    window._grillesInputCode = '';
    window.grillesKioskAddCode = (n) => {
        if (window._grillesInputCode.length < 3) {
            window._grillesInputCode += n;
            document.getElementById('grilles-code-display').textContent = window._grillesInputCode;
        }
    };
    window.grillesKioskClearCode = () => {
        window._grillesInputCode = '';
        document.getElementById('grilles-code-display').textContent = '--';
    };
    window.grillesKioskValiderCode = () => {
        const code = window._grillesInputCode;
        if (!code || code === '0') {
            alert('Entre un code valide.');
            return;
        }
        currentCode = code;
        currentNotes = {};
        renderEvaluation(container);
    };
}

// ============================================================
// ÉCRAN 2 : AUTO-ÉVALUATION (tableau)
// ============================================================
function renderEvaluation(container) {
    const criteres = currentGrille.criteres;
    // Ordre des niveaux : 4 (à gauche) → 1 (à droite)
    const niveauxTries = [...NIVEAUX].sort((a, b) => b.valeur - a.valeur);

    let html = `
        <div class="space-y-4">
            <div class="flex justify-between items-center bg-slate-800 p-3 rounded-2xl border border-slate-700">
                <div>
                    <h2 class="text-lg font-black text-white">${currentGrille.titre}</h2>
                    <p class="text-xs text-slate-400">Code ${currentCode} · ${currentPeriode}</p>
                </div>
                <button onclick="window.grillesKioskRetourCode()" class="bg-slate-700 px-3 py-1.5 rounded-xl font-black text-xs text-white active:scale-95">← Retour</button>
            </div>

            <p class="text-slate-400 text-sm text-center">Pour chaque critère, touche la case qui te correspond le mieux.</p>
    `;

    criteres.forEach(c => {
        const selected = currentNotes[c.id];
        html += `
            <div class="bg-slate-800 p-3 rounded-2xl border border-slate-700 overflow-x-auto">
                <h3 class="font-black text-white mb-3 text-sm">${c.nom}</h3>
                <table class="w-full" style="table-layout: fixed; border-collapse: separate; border-spacing: 4px;">
                    <thead>
                        <tr>
                            ${niveauxTries.map(n => `
                                <th style="width: 25%; vertical-align: top;">
                                    <div class="rounded-t-lg p-2 font-black text-[10px] leading-tight text-white text-center"
                                         style="background-color: ${n.couleur};">
                                        ${n.label}
                                        <span class="block text-xl mt-0.5">${n.valeur}</span>
                                    </div>
                                </th>
                            `).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            ${niveauxTries.map(n => {
                                const isSelected = selected === n.valeur;
                                return `
                                    <td style="vertical-align: top;">
                                        <button onclick="window.grillesKioskSetNote('${c.id}', ${n.valeur})"
                                                class="w-full p-2 rounded-b-lg border-2 text-left text-[11px] leading-snug transition-all active:scale-95"
                                                style="min-height: 100px;
                                                       border-color: ${isSelected ? n.couleur : '#334155'};
                                                       background-color: ${isSelected ? n.couleur + '40' : '#0f172a'};
                                                       ${isSelected ? 'box-shadow: 0 0 0 2px ' + n.couleur + ';' : ''}">
                                            ${isSelected ? '<div class="text-center text-lg mb-1" style="color:' + n.couleur + '">✓</div>' : ''}
                                            <div class="text-slate-200">${n.descripteur || '--'}</div>
                                        </button>
                                    </td>
                                `;
                            }).join('')}
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    });

    html += `
            <button onclick="window.grillesKioskValider()"
                    class="w-full bg-emerald-600 hover:bg-emerald-500 py-5 rounded-2xl font-black text-xl text-white active:scale-95 transition-all">
                ✅ Valider mon auto-évaluation
            </button>
        </div>
    `;

    container.innerHTML = html;
}

// ============================================================
// ACTIONS
// ============================================================
window.grillesKioskRetourCode = function() {
    currentCode = null;
    currentNotes = {};
    const container = document.getElementById('grilles-module');
    renderChoixCode(container);
};

window.grillesKioskSetNote = function(critereId, valeur) {
    currentNotes[critereId] = valeur;
    const container = document.getElementById('grilles-module');
    renderEvaluation(container);
};

window.grillesKioskValider = function() {
    if (!currentCode || !currentGrille) return;

    const manquants = currentGrille.criteres.filter(c => currentNotes[c.id] === undefined);
    if (manquants.length > 0) {
        alert(`Il manque ${manquants.length} critère(s) à évaluer.`);
        return;
    }

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const path = `etablissements/0680013V/profs/${profCode}/${currentClasse}/grilles/auto_evaluations`;

    const data = {
        code: currentCode,
        grilleId: currentGrille.id,
        periode: currentPeriode,
        notes: { ...currentNotes },
        timestamp: Date.now()
    };

    push(ref(db, path), data)
        .then(() => {
            renderConfirmation();
        })
        .catch(err => {
            console.error(err);
            alert('❌ Erreur lors de l\'envoi. Réessaye.');
        });
};

function renderConfirmation() {
    const container = document.getElementById('grilles-module');
    container.innerHTML = `
        <div class="space-y-4 max-w-md mx-auto text-center py-6">
            <div class="text-6xl mb-4">✅</div>
            <h2 class="text-2xl font-black text-white">Auto-évaluation enregistrée !</h2>
            <p class="text-slate-400 text-sm">Ton prof verra tes réponses de manière anonyme.</p>

            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 mt-4">
                <p class="text-sm text-slate-400">Code : <span class="text-yellow-400 font-black text-lg">${currentCode}</span></p>
            </div>

            <button onclick="window.grillesKioskRetourCode()"
                    class="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-black text-white text-lg active:scale-95 transition-all mt-4">
                🔄 Élève suivant
            </button>
            <button onclick="window.retourMenuGrilles()"
                    class="w-full bg-slate-700 hover:bg-slate-600 py-3 rounded-2xl font-black text-sm text-white active:scale-95">
                ← Quitter l'auto-évaluation
            </button>
        </div>
    `;
}

window.retourMenuGrilles = function() {
    if (configListener) { configListener(); configListener = null; }
    const container = document.getElementById('grilles-module');
    if (container) {
        container.innerHTML = '';
        container.classList.add('hidden');
    }
    if (typeof window.resetToLogin === 'function') window.resetToLogin();
};

export function cleanupGrillesKiosk() {
    if (configListener) { configListener(); configListener = null; }
    currentClasse = '';
    currentGrille = null;
    currentCode = null;
    currentNotes = {};
}