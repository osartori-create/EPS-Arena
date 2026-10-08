// src/js/config/firebase-config.js
//
// ════════════════════════════════════════════════════════════════
//  CONFIGURATION FIREBASE — SANS IDENTIFIANT EN DUR
// ════════════════════════════════════════════════════════════════
//
//  Le code RNE de l'établissement et l'URL Firebase ne doivent PLUS
//  apparaître en dur dans les modules. Ils se règlent à l'exécution :
//
//  1. localStorage['eps_arena_etabCode']  (prioritaire, à la volée)
//  2. window.EPS_ARENA_CONFIG (fichier config.local.js, gitignoré)
//  3. valeur par défaut ci-dessous (établissement d'origine)
//
//  Exemple de src/js/config/config.local.js (NE PAS versionner) :
//    window.EPS_ARENA_CONFIG = {
//      rne: '0123456X',
//      firebaseDatabaseURL: 'https://mon-projet-default-rtdb.europe-west1.firebasedatabase.app/'
//    };
// ════════════════════════════════════════════════════════════════

export const DEFAULT_RNE = '0680013V';
const DEFAULT_DB_URL = 'https://eps-arena-default-rtdb.europe-west1.firebasedatabase.app/';

function getLocalConfig() {
    if (typeof window !== 'undefined' && window.EPS_ARENA_CONFIG) {
        return window.EPS_ARENA_CONFIG;
    }
    return {};
}

// Code RNE de l'établissement (configurable, jamais en dur dans les modules).
export function getRNE() {
    if (typeof window !== 'undefined') {
        const fromStorage = localStorage.getItem('eps_arena_etabCode');
        if (fromStorage) return fromStorage;
    }
    const cfg = getLocalConfig();
    return cfg.rne || DEFAULT_RNE;
}

// Racine des chemins par établissement : "etablissements/<RNE>".
export function getEtabPath() {
    return `etablissements/${getRNE()}`;
}

export const FIREBASE_CONFIG = {
    apiKey: getLocalConfig().apiKey || 'AIzaSyBdngK5H6AgTr9g2nE9JH52e1pbiIoi7GM',
    authDomain: getLocalConfig().authDomain || 'eps-arena.firebaseapp.com',
    databaseURL: getLocalConfig().firebaseDatabaseURL || DEFAULT_DB_URL,
    projectId: getLocalConfig().projectId || 'eps-arena',
    storageBucket: getLocalConfig().storageBucket || 'eps-arena.firebasestorage.app',
    messagingSenderId: getLocalConfig().messagingSenderId || '129576505015',
    appId: getLocalConfig().appId || '1:129576505015:web:9b495488b2ae94ad43c732'
};

// ------------------------------------------------------------------
// DB_PATHS : conservé pour compatibilité ascendante.
// Privilégier getEtabPath() / getEtab() pour tout nouveau code.
// ------------------------------------------------------------------
export const DB_PATHS = {
    ETAB: getEtabPath()
};

// ------------------------------------------------------------------
// SAISIE DU RNE AU PREMIER LANCEMENT
// ------------------------------------------------------------------

/**
 * RNE explicite fourni au déploiement (config.local.js), ou null.
 * Sert à pré-remplir la saisie sans imposer la valeur de repli.
 */
function rneExplicite() {
    const cfg = getLocalConfig();
    return (cfg && cfg.rne) ? cfg.rne : null;
}

/**
 * Affiche une modale de saisie du code RNE.
 * @returns {Promise<string|null>} le code saisi (mémorisé), ou null si annulé.
 */
export function demanderRNE() {
    return new Promise((resolve) => {
        const valeurCourante = localStorage.getItem('eps_arena_etabCode') || rneExplicite() || '';

        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4';
        overlay.innerHTML = `
            <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-md">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-black text-white">🏫 Établissement</h3>
                    <button id="rne-annuler" class="bg-slate-700 px-3 py-1.5 rounded-xl font-black text-xs text-white">✖</button>
                </div>
                <p class="text-xs text-slate-400 mb-4">
                    Renseigne le code <strong>RNE</strong> de ton établissement (8 caractères).
                    Il isole <strong>tes</strong> données de celles des autres établissements.
                </p>
                <div>
                    <label class="block text-xs font-bold text-slate-400 uppercase mb-1">Code RNE</label>
                    <input id="rne-input" value="${valeurCourante}" maxlength="8"
                           placeholder="ex: 0680013V"
                           class="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-white text-center text-2xl font-black uppercase tracking-widest">
                </div>
                <div class="flex gap-3 mt-6">
                    <button id="rne-sauver" class="flex-1 bg-emerald-600 py-3 rounded-xl font-black text-white text-sm active:scale-95">💾 Enregistrer</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const fermer = () => { overlay.remove(); resolve(null); };
        overlay.querySelector('#rne-annuler').onclick = fermer;
        overlay.addEventListener('click', (e) => { if (e.target === overlay) fermer(); });

        overlay.querySelector('#rne-sauver').onclick = () => {
            const valeur = overlay.querySelector('#rne-input').value.trim().toUpperCase();
            if (!valeur) {
                alert('Le code RNE est obligatoire.');
                return;
            }
            try { localStorage.setItem('eps_arena_etabCode', valeur); } catch (e) {}
            overlay.remove();
            resolve(valeur);
        };
    });
}

/**
 * Demande le code RNE au premier lancement (si absent de localStorage),
 * puis recharge la page pour repartir sur la bonne racine d'établissement.
 */
export async function assurerRNE() {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem('eps_arena_etabCode')) return;
    const rne = await demanderRNE();
    if (rne) {
        location.reload();
    }
}

// Expose une commande de modification ultérieure (console).
if (typeof window !== 'undefined') {
    window.changerRNE = demanderRNE;
}
