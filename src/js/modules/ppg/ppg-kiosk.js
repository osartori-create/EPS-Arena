// src/js/modules/ppg/ppg-kiosk.js
// Kiosk élève PPG : saisie des performances par atelier
import { getEtab } from '../../core/firebase-service.js';
import { db, ref, onValue, set, push } from '../../core/firebase-service.js';
import { fusionnerBibliotheque, getAtelierById } from './ppg-core.js';

let currentClasse = '';
let currentSeance = null;
let currentBibliotheque = [];
let currentCode = null;
let saisie = {};                  // { atelierId: { p1, p2, niveau } }
let observationsExistantes = null; // si l'élève a déjà saisi aujourd'hui
let configListener = null;
let seanceListener = null;
let obsListener = null;

const COOLDOWN_MS = 30 * 1000;
const COOLDOWN_KEY = 'eps_arena_ppg_last_send';

// État du pavé numérique (saisie tactile sans clavier natif)
let kpad = { active: false, target: null, label: '', value: '' };

// ============================================================
// INIT
// ============================================================
export function initPPGKiosk(classe) {
    currentClasse = classe;
    currentSeance = null;
    currentCode = null;
    saisie = {};
    observationsExistantes = null;

    const container = document.getElementById('ppg-module');
    if (!container) {
        console.error('[PPG Kiosk] Conteneur ppg-module introuvable');
        return;
    }

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const basePath = `${getEtab()}/profs/${profCode}/${classe}/ppg`;
    const today = new Date().toISOString().split('T')[0];

    // Cleanup
    if (configListener) configListener();
    if (seanceListener) seanceListener();
    if (obsListener) obsListener();

    // 1. Bibliothèque (config)
    configListener = onValue(ref(db, `${basePath}/config`), snap => {
        const cfg = snap.val() || {};
        currentBibliotheque = fusionnerBibliotheque(cfg.ateliers);
        rendre();
    });

    // 2. Séance du jour
    seanceListener = onValue(ref(db, `${basePath}/seance/${today}`), snap => {
        currentSeance = snap.val() || null;
        rendre();
    });

    // 3. Observations du jour (pour pré-remplir si déjà saisi)
    obsListener = onValue(ref(db, `${basePath}/observations/${today}`), snap => {
        const all = snap.val() || {};
        if (currentCode && all[String(currentCode)]) {
            observationsExistantes = all[String(currentCode)];
        } else {
            observationsExistantes = null;
        }
        rendre();
    });

    return () => {
        if (configListener) { configListener(); configListener = null; }
        if (seanceListener) { seanceListener(); seanceListener = null; }
        if (obsListener) { obsListener(); obsListener = null; }
    };
}

// ============================================================
// ROUTAGE
// ============================================================
function rendre() {
    const container = document.getElementById('ppg-module');
    if (!container) return;

    if (currentBibliotheque.length === 0) {
        container.innerHTML = '<div class="text-center py-10 text-slate-400">⏳ Chargement...</div>';
        return;
    }

    if (!currentSeance || !Array.isArray(currentSeance.ateliers) || currentSeance.ateliers.length === 0) {
        container.innerHTML = `
            <div class="max-w-md mx-auto text-center py-16">
                <div class="text-6xl mb-4">⏳</div>
                <h2 class="text-2xl font-black text-white mb-2">Pas de séance configurée</h2>
                <p class="text-slate-400 text-sm">Le professeur doit choisir les ateliers du jour.</p>
                <button onclick="window.retourMenuPPG()" class="mt-8 bg-slate-700 hover:bg-slate-600 px-6 py-3 rounded-2xl font-black text-sm text-white active:scale-95">
                    ← Retour
                </button>
            </div>
        `;
        return;
    }

    if (!currentCode) {
        rendreChoixCode(container);
    } else {
        rendreSaisie(container);
    }
}

// ============================================================
// ÉCRAN 1 : CODE ÉLÈVE
// ============================================================
function rendreChoixCode(container) {
    const ateliersActifs = currentSeance.ateliers
        .map(id => getAtelierById(id, currentBibliotheque))
        .filter(Boolean);

    const ateliersHtml = ateliersActifs.map(a => `
        <div class="flex items-center gap-3 bg-slate-900 p-3 rounded-xl border border-slate-700">
            <span class="text-3xl">${a.emoji}</span>
            <div>
                <div class="font-black text-white text-sm">${a.label}</div>
                <div class="text-[10px] text-slate-500">Unité : ${a.unite}</div>
            </div>
        </div>
    `).join('');

    container.innerHTML = `
        <div class="max-w-md mx-auto space-y-4">
            <div class="text-center py-4">
                <h2 class="text-3xl font-black text-white mb-1">🏋️ PPG</h2>
                <p class="text-slate-400 text-sm">Saisie des performances</p>
            </div>

            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <p class="text-xs font-bold text-slate-400 uppercase mb-2">Ateliers du jour</p>
                <div class="space-y-2">${ateliersHtml}</div>
            </div>

            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <label class="text-xs font-bold text-slate-400 uppercase block mb-2">Ton code élève</label>
                <button id="ppg-k-code-display" onclick="window.ppgKOuvrirPave('code')"
                        class="w-full bg-slate-900 border-2 border-slate-600 rounded-xl p-4 text-center text-4xl font-black text-white active:scale-95 transition-all min-h-[76px]">
                    —
                </button>
                <p class="text-[10px] text-slate-500 text-center mt-2">👆 Touche pour ouvrir le pavé numérique</p>
            </div>

            <button onclick="window.ppgKValiderCode()"
                    class="w-full bg-emerald-600 hover:bg-emerald-500 py-5 rounded-2xl font-black text-xl text-white active:scale-95 transition-all">
                ✅ Commencer
            </button>

            <button onclick="window.retourMenuPPG()"
                    class="w-full bg-slate-700 hover:bg-slate-600 py-3 rounded-2xl font-black text-xs text-white active:scale-95">
                ← Retour
            </button>
        </div>
    `;
}

// ============================================================
// ÉCRAN 2 : SAISIE PAR ATELIER
// ============================================================
function rendreSaisie(container) {
    const ateliersActifs = currentSeance.ateliers
        .map(id => getAtelierById(id, currentBibliotheque))
        .filter(Boolean);

    // Init des valeurs par défaut
        // Init des valeurs par défaut (tolérant ancien/nouveau format)
    const getExistObs = (atelierId) => {
        if (!observationsExistantes) return null;
        if (observationsExistantes[atelierId]) return observationsExistantes[atelierId];       // nouveau format
        if (observationsExistantes.perfs?.[atelierId]) return observationsExistantes.perfs[atelierId]; // legacy
        return null;
    };

    ateliersActifs.forEach(a => {
        if (!saisie[a.id]) {
            const exist = getExistObs(a.id);
            saisie[a.id] = {
                p1: exist?.p1 ?? '',
                p2: exist?.p2 ?? '',
                niveau: exist?.niveau ?? (a.type === 'niveaux' ? 1 : null)
            };
        }
    });

    const dejaSaisi = !!observationsExistantes;

    let html = `
        <div class="max-w-md mx-auto space-y-4">
            <div class="flex items-center justify-between bg-slate-800 p-3 rounded-2xl border border-slate-700">
                <button onclick="window.ppgKRetourCode()" class="bg-slate-700 px-3 py-1.5 rounded-xl font-black text-xs text-white active:scale-95">
                    ← Code
                </button>
                <div class="text-center">
                    <div class="text-[10px] text-slate-400 uppercase">Code élève</div>
                    <div class="text-2xl font-black text-yellow-400">#${currentCode}</div>
                </div>
                <div class="w-16"></div>
            </div>
    `;

    if (dejaSaisi) {
        html += `
            <div class="bg-blue-900/30 border-2 border-blue-500 p-3 rounded-2xl text-center">
                <p class="text-blue-300 text-xs font-bold">📝 Tu as déjà saisi aujourd'hui. Modifie si besoin.</p>
            </div>
        `;
    }

    ateliersActifs.forEach(a => {
        html += `<div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
            <div class="flex items-center gap-2 mb-3">
                <span class="text-3xl">${a.emoji}</span>
                <h3 class="font-black text-white">${a.label}</h3>
            </div>`;

        // Sélecteur de niveau (pompes et ateliers avec niveaux)
        if (a.type === 'niveaux' && Array.isArray(a.niveaux)) {
            html += `<p class="text-[10px] text-slate-400 uppercase mb-2">Niveau choisi</p><div class="grid grid-cols-2 gap-2 mb-3">`;
            a.niveaux.forEach(n => {
                const actif = saisie[a.id].niveau === n.valeur;
                const cls = actif
                    ? 'bg-blue-600 border-blue-400 text-white'
                    : 'bg-slate-900 border-slate-700 text-slate-300';
                html += `
                    <button onclick="window.ppgKSetNiveau('${a.id}', ${n.valeur})"
                            class="p-3 rounded-xl font-black text-xs border-2 active:scale-95 transition-all ${cls}">
                        ${n.label}
                    </button>
                `;
            });
            html += `</div>`;
        }

        // Saisie des 2 passages
        const unitLabel = a.unite || 'reps';
        html += `
            <p class="text-[10px] text-slate-400 uppercase mb-2">Nombre de ${unitLabel} par passage</p>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="text-[10px] text-slate-400 block mb-1 text-center">Passage 1</label>
                    <button id="ppg-k-input-${a.id}-1" onclick="window.ppgKOuvrirPave('${a.id}:1')"
                            class="w-full bg-slate-900 border-2 border-slate-600 rounded-xl p-4 text-center text-3xl font-black text-white active:scale-95 transition-all min-h-[76px]">
                        ${saisie[a.id].p1 !== '' && saisie[a.id].p1 !== null && saisie[a.id].p1 !== undefined ? saisie[a.id].p1 : '—'}
                    </button>
                </div>
                <div>
                    <label class="text-[10px] text-slate-400 block mb-1 text-center">Passage 2</label>
                    <button id="ppg-k-input-${a.id}-2" onclick="window.ppgKOuvrirPave('${a.id}:2')"
                            class="w-full bg-slate-900 border-2 border-slate-600 rounded-xl p-4 text-center text-3xl font-black text-white active:scale-95 transition-all min-h-[76px]">
                        ${saisie[a.id].p2 !== '' && saisie[a.id].p2 !== null && saisie[a.id].p2 !== undefined ? saisie[a.id].p2 : '—'}
                    </button>
                </div>
            </div>
        `;

        // Best auto-calculé
        const best = calculerBest(a.id);
        if (best !== null) {
            html += `<div class="mt-3 text-center text-xs text-slate-400">
                🏅 Meilleur passage : <span class="text-emerald-400 font-black text-base">${best} ${unitLabel}</span>
            </div>`;
        }

        html += `</div>`;
    });

    html += `
            <button onclick="window.ppgKValider()"
                    class="w-full bg-emerald-600 hover:bg-emerald-500 py-5 rounded-2xl font-black text-xl text-white active:scale-95 transition-all">
                ✅ Enregistrer mes performances
            </button>

            <button onclick="window.retourMenuPPG()"
                    class="w-full bg-slate-700 hover:bg-slate-600 py-3 rounded-2xl font-black text-xs text-white active:scale-95">
                ← Quitter
            </button>
        </div>
    `;

    container.innerHTML = html;
}

function calculerBest(atelierId) {
    const s = saisie[atelierId];
    if (!s) return null;
    const p1 = parseInt(s.p1);
    const p2 = parseInt(s.p2);
    const vals = [p1, p2].filter(v => !isNaN(v) && v >= 0);
    if (vals.length === 0) return null;
    return Math.max(...vals);
}

// ============================================================
// SETTERS / ACTIONS
// ============================================================
window.ppgKValiderCode = function() {
    if (!currentCode) {
        alert('Saisis ton code.');
        return;
    }
    // Reset saisie (sera pré-remplie si existante via obsListener)
    saisie = {};
    rendre();
};

window.ppgKRetourCode = function() {
    currentCode = null;
    saisie = {};
    observationsExistantes = null;
    rendre();
};

window.ppgKSetNiveau = function(atelierId, niveau) {
    if (!saisie[atelierId]) saisie[atelierId] = { p1: '', p2: '', niveau: null };
    saisie[atelierId].niveau = niveau;
    rendre();
};

// ============================================================
// VALIDATION / ENVOI
// ============================================================
window.ppgKValider = async function() {
    if (!currentCode) return;
    const ateliersActifs = currentSeance.ateliers
        .map(id => getAtelierById(id, currentBibliotheque))
        .filter(Boolean);

    // Vérif : tous les ateliers doivent avoir au moins un passage valide
    for (const a of ateliersActifs) {
        const s = saisie[a.id] || {};
        const p1 = parseInt(s.p1);
        const p2 = parseInt(s.p2);
        const hasOne = (!isNaN(p1) && p1 >= 0) || (!isNaN(p2) && p2 >= 0);
        if (!hasOne) {
            alert(`Renseigne au moins un passage pour "${a.label}".`);
            return;
        }
        if (a.type === 'niveaux' && !s.niveau) {
            alert(`Choisis un niveau pour "${a.label}".`);
            return;
        }
    }

    // Anti-double envoi rapide
    const cooldowns = JSON.parse(localStorage.getItem(COOLDOWN_KEY) || '{}');
    const now = Date.now();
    const last = cooldowns[String(currentCode)] || 0;
    if (now - last < COOLDOWN_MS) {
        const restant = Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
        alert(`⏳ Attends encore ${restant}s avant de revalider.`);
        return;
    }

    // Construction du payload
        // Construction du payload — format à plat
    const payload = {
        _meta: {
            code: String(currentCode),
            timestamp: now,
            source: 'kiosk'
        }
    };

    ateliersActifs.forEach(a => {
        const s = saisie[a.id] || {};
        const p1 = parseInt(s.p1);
        const p2 = parseInt(s.p2);
        const p1Final = !isNaN(p1) ? p1 : null;
        const p2Final = !isNaN(p2) ? p2 : null;
        const vals = [p1Final, p2Final].filter(v => v !== null);
        const best = vals.length > 0 ? Math.max(...vals) : 0;

        payload[a.id] = {
            p1: p1Final,
            p2: p2Final,
            best,
            niveau: s.niveau || null
        };
    });

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const today = new Date().toISOString().split('T')[0];
    const obsRef = ref(db, `${getEtab()}/profs/${profCode}/${currentClasse}/ppg/observations/${today}/${currentCode}`);

    try {
        await set(obsRef, payload);
        cooldowns[String(currentCode)] = now;
        localStorage.setItem(COOLDOWN_KEY, JSON.stringify(cooldowns));

        // Écran de confirmation
        afficherConfirmation();
    } catch (err) {
        console.error(err);
        alert('❌ Erreur lors de l\'enregistrement.');
    }
};

function afficherConfirmation() {
    const container = document.getElementById('ppg-module');
    if (!container) return;

    container.innerHTML = `
        <div class="max-w-md mx-auto text-center py-16">
            <div class="text-7xl mb-4">✅</div>
            <h2 class="text-3xl font-black text-emerald-400 mb-2">Bravo !</h2>
            <p class="text-slate-300 mb-8">Tes performances sont enregistrées.</p>
            <p class="text-xs text-slate-500 mb-8">Retour automatique dans 3s...</p>
            <button onclick="window.ppgKRetourCode()"
                    class="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-black text-white active:scale-95 transition-all">
                🔄 Autre élève maintenant
            </button>
        </div>
    `;

    setTimeout(() => {
        // Vérifier qu'on est toujours sur l'écran de confirmation
        const c = document.getElementById('ppg-module');
        if (c && c.innerHTML.includes('Bravo')) {
            currentCode = null;
            saisie = {};
            observationsExistantes = null;
            rendre();
        }
    }, 3000);
}

// ============================================================
// PAVÉ NUMÉRIQUE (saisie tactile)
// ============================================================
window.ppgKOuvrirPave = function(target) {
    kpad.target = target;
    if (target === 'code') {
        kpad.value = currentCode ? String(currentCode) : '';
        kpad.label = 'Code élève';
    } else {
        const [id, passage] = target.split(':');
        const s = saisie[id] || {};
        const raw = s[`p${passage}`];
        kpad.value = (raw !== '' && raw !== null && raw !== undefined) ? String(raw) : '';
        const atelier = getAtelierById(id, currentBibliotheque);
        kpad.label = `${atelier ? atelier.label : ''} — Passage ${passage}`;
    }
    kpad.active = true;
    rendrePave();
};

window.ppgKPaveDigit = function(d) {
    if (kpad.value.length >= 5) return;
    if (kpad.value === '0') kpad.value = d;
    else kpad.value += d;
    mettreAJourAffichagePave();
};

window.ppgKPaveBack = function() {
    kpad.value = kpad.value.slice(0, -1);
    mettreAJourAffichagePave();
};

window.ppgKPaveClear = function() {
    kpad.value = '';
    mettreAJourAffichagePave();
};

window.ppgKPaveValider = function() {
    const num = kpad.value === '' ? null : parseInt(kpad.value, 10);

    if (kpad.target === 'code') {
        if (num === null || isNaN(num)) {
            alert('Saisis ton code.');
            return;
        }
        currentCode = num;
        saisie = {};
        kpad.active = false;
        fermerPave();
        rendre();
    } else {
        const [id, passage] = kpad.target.split(':');
        if (!saisie[id]) saisie[id] = { p1: '', p2: '', niveau: null };
        saisie[id][`p${passage}`] = (num === null || isNaN(num)) ? '' : String(num);
        kpad.active = false;
        fermerPave();
        rendre();
    }
};

window.ppgKPaveAnnuler = function() {
    kpad.active = false;
    fermerPave();
    // Ré-affiche l'écran sous-jacent (les valeurs déjà validées sont conservées)
    rendre();
};

function mettreAJourAffichagePave() {
    const disp = kpad.value === '' ? '—' : kpad.value;

    // Mise à jour du champ source sous le pavé
    let source = null;
    if (kpad.target === 'code') {
        source = document.getElementById('ppg-k-code-display');
    } else {
        const [id, passage] = kpad.target.split(':');
        source = document.getElementById(`ppg-k-input-${id}-${passage}`);
    }
    if (source) source.textContent = disp;

    // Mise à jour de l'écran du pavé
    const ecran = document.getElementById('ppg-kpad-ecran');
    if (ecran) ecran.textContent = disp;
}

function rendrePave() {
    fermerPave();
    if (!kpad.active) return;

    const el = document.createElement('div');
    el.id = 'ppg-kpad';
    el.className = 'fixed inset-x-0 bottom-0 z-50 bg-slate-950 border-t-2 border-slate-700 p-3 pb-5';
    el.style.background = '#0f172a';

    const grille = [['1','2','3'],['4','5','6'],['7','8','9']];
    let lignesHtml = '';
    grille.forEach(ligne => {
        lignesHtml += `<div class="grid grid-cols-3 gap-2 mb-2">`;
        ligne.forEach(d => {
            lignesHtml += `<button onclick="window.ppgKPaveDigit('${d}')"
                class="bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-600 rounded-xl py-4 text-2xl font-black text-white transition-all">${d}</button>`;
        });
        lignesHtml += `</div>`;
    });

    el.innerHTML = `
        <div class="max-w-md mx-auto">
            <div class="flex items-center justify-between mb-3">
                <div class="text-xs font-bold text-slate-400 uppercase">${kpad.label}</div>
                <button onclick="window.ppgKPaveAnnuler()" class="bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg text-xs font-black text-red-300 active:scale-95">✕ Fermer</button>
            </div>
            <div id="ppg-kpad-ecran" class="bg-slate-900 border-2 border-blue-500 rounded-xl py-3 text-center text-5xl font-black text-yellow-400 mb-3 min-h-[72px]">
                —
            </div>
            ${lignesHtml}
            <div class="grid grid-cols-3 gap-2">
                <button onclick="window.ppgKPaveBack()"
                        class="bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-600 rounded-xl py-4 text-xl font-black text-white transition-all">⌫</button>
                <button onclick="window.ppgKPaveDigit('0')"
                        class="bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-600 rounded-xl py-4 text-2xl font-black text-white transition-all">0</button>
                <button onclick="window.ppgKPaveClear()"
                        class="bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-600 rounded-xl py-4 text-xl font-black text-amber-400 transition-all">C</button>
            </div>
            <button onclick="window.ppgKPaveValider()"
                    class="w-full mt-3 bg-emerald-600 hover:bg-emerald-500 py-4 rounded-2xl font-black text-xl text-white active:scale-95 transition-all">
                ✓ Valider
            </button>
        </div>
    `;
    document.body.appendChild(el);

    // Affichage initial
    mettreAJourAffichagePave();
}

function fermerPave() {
    const el = document.getElementById('ppg-kpad');
    if (el) el.remove();
}

// ============================================================
// RETOUR MENU
// ============================================================
window.retourMenuPPG = function() {
    if (configListener) { configListener(); configListener = null; }
    if (seanceListener) { seanceListener(); seanceListener = null; }
    if (obsListener) { obsListener(); obsListener = null; }
    const container = document.getElementById('ppg-module');
    if (container) {
        container.innerHTML = '';
        container.style.display = 'none';
    }
    if (typeof window.resetToLogin === 'function') window.resetToLogin();
};