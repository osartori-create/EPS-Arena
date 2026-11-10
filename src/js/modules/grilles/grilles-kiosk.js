// src/js/modules/grilles/grilles-kiosk.js
// Kiosque élève : auto-évaluation anonyme (code numérique)
// ⚠️ Aucune donnée nominative

import { getEtab } from '../../core/firebase-service.js';
import { db, ref, onValue, push } from '../../core/firebase-service.js';
import { NIVEAUX, getCouleurNiveau, getToutesGrilles, sauvegarderGrille, parserGrilleJSON } from './grilles-core.js';

let currentClasse = '';
let currentGrille = null;
let currentPeriode = '';
let currentCode = null;
let currentNotes = {};
let configListener = null;
let currentConfig = null;

// ============================================================
// POINT D'ENTRÉE
// ============================================================
export function initGrillesKiosk(classe) {
    currentClasse = classe;
    currentGrille = null;
    currentPeriode = '';
    currentCode = null;
    currentNotes = {};
    currentConfig = null;

    const container = document.getElementById('grilles-module');
    if (!container) return;

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const configRef = ref(db, `${getEtab()}/profs/${profCode}/${classe}/grilles/config`);

    if (configListener) configListener();
    configListener = onValue(configRef, (snap) => {
        currentConfig = snap.val();
        appliquerConfig(container);
    });
}

// ============================================================
// APPLICATION DE LA CONFIG + IMPORT LOCAL DE LA GRILLE
// ============================================================
function appliquerConfig(container) {
    const config = currentConfig;
    if (config && config.actif && config.grilleId) {
        const grilles = getToutesGrilles();
        currentGrille = grilles.find(g => g.id === config.grilleId);
        if (currentGrille) {
            currentPeriode = config.periode || currentGrille.periodes[0];
            renderChoixCode(container);
        } else {
            container.innerHTML = `
                <div class="text-center py-10 text-slate-400 max-w-md mx-auto">
                    <p class="mb-4">⏳ Grille "${config.grilleId}" non trouvée dans cette tablette.</p>
                    <button onclick="window.grillesKioskImporter()"
                            class="bg-purple-600 hover:bg-purple-500 px-6 py-3 rounded-2xl font-black text-white active:scale-95">
                        📥 Importer la grille
                    </button>
                    <p class="text-xs text-slate-500 mt-3">Reçois la grille par Airdrop puis importe-la ici.</p>
                </div>
            `;
        }
    } else {
        container.innerHTML = `
            <div class="text-center py-10 text-slate-400 max-w-md mx-auto">
                <p class="mb-4">⏳ En attente de l'activation par le professeur...</p>
                <button onclick="window.grillesKioskImporter()"
                        class="bg-purple-600 hover:bg-purple-500 px-6 py-3 rounded-2xl font-black text-white active:scale-95">
                    📥 Importer la grille
                </button>
            </div>
        `;
    }
}

window.grillesKioskImporter = function() {
    let input = document.getElementById('grilles-kiosk-file-input');
    if (!input) {
        input = document.createElement('input');
        input.type = 'file';
        input.id = 'grilles-kiosk-file-input';
        input.accept = '.json';
        input.className = 'hidden';
        input.addEventListener('change', window.grillesKioskTraiterImport);
        document.body.appendChild(input);
    }
    input.value = '';
    input.click();
};

window.grillesKioskTraiterImport = async function(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
        const texte = await file.text();
        const grille = parserGrilleJSON(texte);
        sauvegarderGrille(grille);
        appliquerConfig(document.getElementById('grilles-module'));
        alert(`✅ Grille importée : ${grille.titre || grille.id}`);
    } catch (err) {
        console.error(err);
        alert('❌ Import impossible : ' + err.message);
    }
    event.target.value = '';
};

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
                <div id="grilles-code-display" style="background:#0f172a;border:2px solid #64748b;color:#34d399;width:10rem;height:4rem;border-radius:1rem;display:flex;align-items:center;justify-content:center;font-size:2.25rem;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0.2em;margin:0 auto 1rem auto;box-shadow:inset 0 2px 4px rgba(0,0,0,0.3);">--</div>
                <div class="grid grid-cols-3 gap-3 max-w-xs mx-auto">
                    ${[1,2,3,4,5,6,7,8,9].map(n => `
                        <button onclick="window.grillesKioskAddCode(${n})"
                                class="w-16 h-16 rounded-xl text-2xl font-black"
                                style="background:#334155;color:#ffffff;border:none;box-shadow:0 2px 4px rgba(0,0,0,0.25);">${n}</button>
                    `).join('')}
                    <button onclick="window.grillesKioskClearCode()"
                            class="w-16 h-16 rounded-xl text-xs font-black uppercase"
                            style="background:#7f1d1d;color:#fca5a5;border:1px solid #991b1b;">Effacer</button>
                    <button onclick="window.grillesKioskAddCode(0)"
                            class="w-16 h-16 rounded-xl text-2xl font-black"
                            style="background:#334155;color:#ffffff;border:none;box-shadow:0 2px 4px rgba(0,0,0,0.25);">0</button>
                    <button onclick="window.grillesKioskValiderCode()"
                            class="w-16 h-16 rounded-xl text-xs font-black uppercase"
                            style="background:#059669;color:#ffffff;border:2px solid #34d399;">OK</button>
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
    // Ordre des niveaux : 4 (gauche) → 1 (droite)
    const niveauxOrdre = [...NIVEAUX].sort((a, b) => b.valeur - a.valeur);

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
        // Croiser NIVEAUX (label + couleur) avec c.niveaux (descripteurs importés)
        const niveauxAffiches = niveauxOrdre.map(n => {
            const desc = (c.niveaux || []).find(x => x.valeur === n.valeur);
            return { ...n, descripteur: desc?.descripteur || '' };
        });

        html += `
            <div class="bg-slate-800 p-3 rounded-2xl border border-slate-700 overflow-x-auto">
                <h3 class="font-black text-white mb-3 text-sm">${c.nom}</h3>
                <table class="w-full" style="table-layout: fixed; border-collapse: separate; border-spacing: 4px;">
                    <thead>
                        <tr>
                            ${niveauxAffiches.map(n => `
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
                            ${niveauxAffiches.map(n => {
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
                                            <div style="color: ${isSelected ? '#0f172a' : '#e2e8f0'};">${n.descripteur || '--'}</div>
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
    const path = `${getEtab()}/profs/${profCode}/${currentClasse}/grilles/auto_evaluations`;

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
            <h2 class="text-2xl font-black text-white">Auto-évaluation envoyée !</h2>
            <p class="text-slate-400 text-sm">Retour automatique à l'écran de saisie dans 2 secondes...</p>

            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 mt-4">
                <p class="text-sm text-slate-400">Code : <span class="text-yellow-400 font-black text-lg">${currentCode}</span></p>
            </div>

            <button onclick="window.grillesKioskRetourCode()"
                    class="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-black text-white text-lg active:scale-95 transition-all mt-4">
                🔄 Élève suivant (immédiat)
            </button>
            <button onclick="window.retourMenuGrilles()"
                    class="w-full bg-slate-700 hover:bg-slate-600 py-3 rounded-2xl font-black text-sm text-white active:scale-95">
                ← Quitter l'auto-évaluation
            </button>
        </div>
    `;

    // ✅ Retour automatique après 2s
    if (window._grillesAutoReturnTimer) clearTimeout(window._grillesAutoReturnTimer);
    window._grillesAutoReturnTimer = setTimeout(() => {
        // Vérifier qu'on est toujours sur l'écran de confirmation
        const containerNow = document.getElementById('grilles-module');
        if (containerNow && containerNow.innerHTML.includes('Auto-évaluation envoyée')) {
            window.grillesKioskRetourCode();
        }
    }, 2000);
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
    if (window._grillesAutoReturnTimer) {
        clearTimeout(window._grillesAutoReturnTimer);
        window._grillesAutoReturnTimer = null;
    }
    currentClasse = '';
    currentGrille = null;
    currentCode = null;
    currentNotes = {};
    currentConfig = null;
}