// src/js/modules/scan-camera/scan-camera-interface.js
// Interface professeur du module Scan Caméra.
// - Attribution des numéros (locale), génération PDF, session + résultats.
// - RGPD : seuls markerId + response transitent vers Firebase.

import { getExistingEleves } from '../../services/admin-service.js';
import { db, ref, set, update, onValue } from '../../core/firebase-service.js';
import { generateStudentCardsPDF } from './scan-camera-export.js';
import { assignMarkerIds, DEFAULT_RESPONSES, generateMarkerSvg } from './scan-camera-core.js';
import {
    getMapping, setMapping, getSessionConfig, setSessionConfig,
    getSessionConfigPath, getResponsesPath, newSessionId
} from './scan-camera-config.js';

let currentClasse = '';
let currentSessionId = null;
let unsubResponses = null;

// ============================================================
// POINT D'ENTRÉE
// ============================================================
export function initScanCameraInterface() {
    const container = document.getElementById('viewScanCamera');
    if (!container) return;
    container.classList.remove('hidden');

    if (!document.getElementById('scancam-content')) {
        const nav = document.createElement('div');
        nav.id = 'scancam-nav';
        nav.className = 'bg-slate-800 p-3 rounded-2xl border border-slate-700 mb-4 flex items-center justify-between flex-wrap gap-3';
        nav.innerHTML = `
            <h3 class="font-black text-blue-400 uppercase text-sm">📷 Scan Caméra — QCM / Sondage</h3>
            <span class="text-[10px] text-slate-400">Marqueurs ArUco orientables · données anonymes sur Firebase</span>
        `;
        container.appendChild(nav);

        const content = document.createElement('div');
        content.id = 'scancam-content';
        content.className = 'space-y-4';
        container.appendChild(content);
    }

    // Classe par défaut = sélecteur global du header.
    if (!currentClasse) {
        const globalSelect = document.getElementById('selectClasse');
        if (globalSelect && globalSelect.value) currentClasse = globalSelect.value;
    }

    // Reprise d'une session encore active.
    const session = getSessionConfig();
    if (session && session.active && session.sessionId) {
        currentSessionId = session.sessionId;
    }

    render();
    if (currentSessionId) {
        showUrl();
        startListening();
    }
}

// ============================================================
// HELPERS
// ============================================================
function esc(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function afficherToast(msg, couleur = 'emerald') {
    const bgMap = {
        emerald: 'bg-emerald-600',
        red: 'bg-red-600',
        amber: 'bg-amber-600',
        blue: 'bg-blue-600'
    };
    const bg = bgMap[couleur] || bgMap.emerald;

    let toast = document.getElementById('scancam-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'scancam-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className = `fixed bottom-6 right-6 z-[60] px-4 py-3 rounded-xl font-black text-sm text-white shadow-xl transition-all duration-200 ${bg}`;
    toast.style.opacity = '1';

    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 2600);
}

// ============================================================
// RENDU
// ============================================================
function render() {
    const content = document.getElementById('scancam-content');
    if (!content) return;

    const classes = JSON.parse(localStorage.getItem('eps_arena_classes') || '[]');
    const eleves = currentClasse ? getExistingEleves(currentClasse) : [];
    const mapping = getMapping(currentClasse); // { markerId: eleveId }
    const byEleve = {};
    Object.entries(mapping).forEach(([markerId, eleveId]) => { byEleve[eleveId] = Number(markerId); });

    const classOptions = classes.map(c =>
        `<option value="${esc(c)}" ${c === currentClasse ? 'selected' : ''}>${esc(c)}</option>`
    ).join('');

    const rows = eleves.map(e => {
        const markerId = byEleve[e.id];
        const svg = markerId != null ? generateMarkerSvg(Number(markerId), 7) : '';
        return `
            <tr class="border-b border-slate-700/50 align-middle">
                <td class="py-1 pr-2 w-14">${svg}</td>
                <td class="py-1 pr-2 w-16 font-black text-blue-400">${markerId != null ? 'N° ' + markerId : '—'}</td>
                <td class="py-1 font-bold text-slate-200">${esc(e.nom || '')} ${esc(e.prenom || '')}</td>
            </tr>`;
    }).join('');

    content.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <!-- PRÉPARATION -->
            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 space-y-3">
                <h4 class="font-black text-emerald-400 uppercase text-xs">1 · Préparation</h4>
                <div>
                    <label class="block font-bold text-slate-400 uppercase text-xs mb-1">Classe</label>
                    <select id="scancam-classe" onchange="window.scancamSetClasse(this.value)"
                            class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white font-bold">
                        <option value="">-- Choisir la classe --</option>
                        ${classOptions}
                    </select>
                </div>
                <div class="flex items-center justify-between gap-2">
                    <p class="text-xs text-slate-400">${eleves.length} élève(s) · ${Object.keys(mapping).length} numéro(s)</p>
                    <button onclick="window.scancamAssigner()" ${eleves.length === 0 ? 'disabled' : ''}
                            class="bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-xl font-black text-xs uppercase text-white active:scale-95 disabled:opacity-40 whitespace-nowrap">
                        🔢 Attribuer les numéros
                    </button>
                </div>
                <div class="max-h-64 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900/50">
                    <table class="w-full text-xs text-slate-300">
                        <tbody>${rows || '<tr><td class="p-3 text-slate-500">Aucun élève pour cette classe.</td></tr>'}</tbody>
                    </table>
                </div>
                <button onclick="window.scancamGenererPDF()" ${eleves.length === 0 ? 'disabled' : ''}
                        class="w-full bg-purple-600 hover:bg-purple-500 py-3 rounded-xl font-black text-xs uppercase text-white active:scale-95 disabled:opacity-40">
                    🖨️ Générer les cartes PDF
                </button>
            </div>

            <!-- SESSION -->
            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 space-y-3">
                <h4 class="font-black text-amber-400 uppercase text-xs">2 · Question / Sondage</h4>
                <div>
                    <label class="block font-bold text-slate-400 uppercase text-xs mb-1">Question affichée sur le kiosk</label>
                    <input id="scancam-question" type="text" placeholder="Ex : Es-tu prêt pour l'échauffement ?"
                           class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white text-sm">
                </div>
                <div>
                    <label class="block font-bold text-slate-400 uppercase text-xs mb-1">Réponses (4 orientations)</label>
                    <div class="grid grid-cols-4 gap-2">
                        ${DEFAULT_RESPONSES.map((r, i) => {
                            const orientations = ['haut', 'droite', 'bas', 'gauche'];
                            return `
                            <div class="text-center">
                                <span class="block text-[10px] uppercase font-black text-slate-500 mb-1">${orientations[i]}</span>
                                <input id="scancam-rep-${i}" value="${esc(r)}" maxlength="2"
                                       class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-center text-white font-black">
                            </div>`;
                        }).join('')}
                    </div>
                </div>
                <div class="flex gap-2">
                    <button onclick="window.scancamDemarrer()" class="flex-1 bg-emerald-600 hover:bg-emerald-500 py-3 rounded-xl font-black text-sm uppercase text-white active:scale-95">
                        ▶ Démarrer la session
                    </button>
                    <button onclick="window.scancamArreter()" class="bg-red-600 hover:bg-red-500 px-4 py-3 rounded-xl font-black text-sm uppercase text-white active:scale-95">
                        ⏹ Arrêter
                    </button>
                </div>
                <div id="scancam-url" class="hidden bg-slate-900 p-3 rounded-xl border border-slate-700 space-y-2">
                    <p class="text-[10px] font-bold uppercase text-slate-400">URL du kiosk iPad</p>
                    <div class="flex gap-2">
                        <input id="scancam-url-input" readonly class="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-[11px] text-white">
                        <button onclick="window.scancamCopierURL()" class="bg-blue-600 px-3 rounded-lg font-black text-[10px] uppercase text-white">📋 Copier</button>
                        <button onclick="window.scancamOuvrirURL()" class="bg-emerald-600 px-3 rounded-lg font-black text-[10px] uppercase text-white">↗ Ouvrir</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- RÉSULTATS -->
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
            <h4 class="font-black text-blue-400 uppercase text-xs mb-3">📊 Résultats en direct</h4>
            <div id="scancam-results" class="space-y-2">
                <p class="text-xs text-slate-500">Démarre une session pour voir les réponses des élèves.</p>
            </div>
        </div>
    `;
}

// ============================================================
// ACTIONS
// ============================================================
window.scancamSetClasse = (classe) => {
    currentClasse = classe || '';
    stopListening();
    render();
};

window.scancamAssigner = () => {
    if (!currentClasse) {
        afficherToast(`Choisis d'abord une classe.`, 'amber');
        return;
    }
    const eleves = getExistingEleves(currentClasse);
    if (eleves.length === 0) {
        afficherToast('Aucun élève dans cette classe.', 'amber');
        return;
    }
    const { byMarker } = assignMarkerIds(eleves);
    setMapping(currentClasse, byMarker);
    render();
    afficherToast(`✅ ${eleves.length} numéro(s) attribué(s).`, 'emerald');
};

window.scancamGenererPDF = () => {
    if (!currentClasse) {
        afficherToast(`Choisis d'abord une classe.`, 'amber');
        return;
    }
    const eleves = getExistingEleves(currentClasse);
    if (eleves.length === 0) {
        afficherToast('Aucun élève dans cette classe.', 'amber');
        return;
    }
    const mapping = getMapping(currentClasse);
    const byEleve = {};
    Object.entries(mapping).forEach(([markerId, eleveId]) => { byEleve[eleveId] = Number(markerId); });

    const nbSansNumero = eleves.filter(e => !byEleve[e.id]).length;
    if (nbSansNumero > 0) {
        if (!confirm(`⚠️ ${nbSansNumero} élève(s) sans numéro. Continuer quand même ?`)) return;
    }

    try {
        const n = generateStudentCardsPDF({ eleves, mappingByEleve: byEleve, classe: currentClasse });
        afficherToast(`🖨️ ${n} carte(s) générée(s).`, 'emerald');
    } catch (err) {
        console.error(err);
        afficherToast(`❌ ${err.message}`, 'red');
    }
};

window.scancamDemarrer = () => {
    if (!currentClasse) {
        afficherToast(`Choisis d'abord une classe.`, 'amber');
        return;
    }
    const question = (document.getElementById('scancam-question') || {}).value || '';
    const responses = DEFAULT_RESPONSES.map((defaut, i) => {
        const el = document.getElementById(`scancam-rep-${i}`);
        return (el && el.value.trim()) || defaut;
    });

    currentSessionId = newSessionId();
    const config = {
        sessionId: currentSessionId,
        question: question.trim(),
        responses,
        active: true,
        ts: Date.now(),
        nbEleves: getExistingEleves(currentClasse).length
    };
    setSessionConfig(config);

    set(ref(db, getSessionConfigPath(currentSessionId)), config)
        .then(() => {
            afficherToast('✅ Session démarrée sur le kiosk.', 'emerald');
            showUrl();
            startListening();
        })
        .catch(err => {
            console.error(err);
            afficherToast(`❌ Erreur Firebase : ${err.message}`, 'red');
        });
};

window.scancamArreter = () => {
    if (!currentSessionId) {
        afficherToast('Aucune session en cours.', 'amber');
        return;
    }
    update(ref(db, getSessionConfigPath(currentSessionId)), { active: false, stoppedAt: Date.now() })
        .then(() => afficherToast('⏹ Session arrêtée.', 'emerald'))
        .catch(err => {
            console.error(err);
            afficherToast(`❌ Erreur Firebase : ${err.message}`, 'red');
        });
};

window.scancamCopierURL = () => {
    const input = document.getElementById('scancam-url-input');
    if (!input || !input.value) return;
    navigator.clipboard.writeText(input.value)
        .then(() => afficherToast('✅ URL copiée.', 'emerald'))
        .catch(() => prompt('Copie cette URL :', input.value));
};

window.scancamOuvrirURL = () => {
    const input = document.getElementById('scancam-url-input');
    if (input && input.value) window.open(input.value, '_blank');
};

function showUrl() {
    const block = document.getElementById('scancam-url');
    if (!block) return;
    block.classList.remove('hidden');
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const base = window.location.href.replace(/maitre\.html.*$/, 'eleve.html');
    const url = `${base}?mode=scan-camera&prof=${encodeURIComponent(profCode)}&session=${encodeURIComponent(currentSessionId)}`;
    const input = document.getElementById('scancam-url-input');
    if (input) input.value = url;
}

// ============================================================
// ÉCOUTE DES RÉPONSES (temps réel)
// ============================================================
function startListening() {
    stopListening();
    unsubResponses = onValue(ref(db, getResponsesPath(currentSessionId)), (snap) => {
        renderResults(snap.val() || {});
    });
}

function stopListening() {
    if (unsubResponses) {
        unsubResponses();
        unsubResponses = null;
    }
}

function renderResults(data) {
    const container = document.getElementById('scancam-results');
    if (!container) return;

    const mapping = getMapping(currentClasse);
    const eleves = currentClasse ? getExistingEleves(currentClasse) : [];
    const nomById = {};
    eleves.forEach(e => { nomById[e.id] = `${e.nom || ''} ${e.prenom || ''}`.trim(); });

    const session = getSessionConfig();
    const responses = (session && session.responses) || DEFAULT_RESPONSES;

    const entries = Object.values(data).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // Dernière réponse de chaque marqueur (un élève peut changer d'avis).
    const derniere = {};
    entries.forEach(entry => {
        if (entry.response == null) return;
        if (!derniere[entry.markerId]) derniere[entry.markerId] = entry;
    });

    const tally = {};
    responses.forEach(r => { tally[r] = 0; });
    Object.values(derniere).forEach(entry => {
        if (tally[entry.response] != null) tally[entry.response]++;
    });

    const nbRepondus = Object.keys(derniere).length;

    const tallyHtml = responses.map(r => {
        const count = tally[r] || 0;
        const pct = nbRepondus ? Math.round((count / nbRepondus) * 100) : 0;
        return `
            <div class="flex items-center gap-2">
                <span class="w-7 text-center font-black text-white bg-slate-700 rounded py-1">${esc(r)}</span>
                <div class="flex-1 h-4 bg-slate-900 rounded overflow-hidden">
                    <div class="h-full bg-emerald-500 transition-all" style="width:${pct}%"></div>
                </div>
                <span class="text-xs font-black text-slate-300 w-8 text-right">${count}</span>
            </div>`;
    }).join('');

    const listeHtml = Object.values(derniere).map(entry => {
        const eleveId = mapping[String(entry.markerId)];
        const nom = eleveId ? (nomById[eleveId] || `N° ${entry.markerId}`) : `N° ${entry.markerId}`;
        return `
            <div class="flex justify-between items-center text-xs border-b border-slate-700/50 py-1">
                <span class="font-bold text-slate-200">${esc(nom)} <span class="text-slate-500">· N° ${esc(String(entry.markerId))}</span></span>
                <span class="font-black text-emerald-400 text-sm">${esc(entry.response)}</span>
            </div>`;
    }).join('');

    container.innerHTML = `
        <p class="text-xs text-slate-400 mb-2">${nbRepondus} élève(s) ont répondu.</p>
        <div class="space-y-1 mb-3">${tallyHtml || '<p class="text-xs text-slate-500">Aucune réponse.</p>'}</div>
        <div class="max-h-48 overflow-y-auto">${listeHtml || '<p class="text-xs text-slate-500">En attente des premières réponses…</p>'}</div>
    `;
}
