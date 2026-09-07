// src/js/modules/natation/natation-kiosk.js
import { db, ref, onValue, set } from '../../core/firebase-service.js';

let currentClasse = '';
let currentNumero = null;
let config = null;
let configListener = null;
let nbEleves = 0;

let chronoRunning = false;
let chronoStart = 0;
let chronoElapsed = 0;
let rafId = null;
let tempsFinal = null;

let mode = 'liste'; // 'liste' | 'chrono' | 'saisie' | 'feedback'
let historiqueEssais = [];

// ============================================================
// EXPOSITION DES FONCTIONS GLOBALES (pour les onclick)
// ============================================================
window.natationChoisirNumero = function(num) {
    console.log('🖱️ Clic sur le numéro', num);
    if (!num || num < 1 || num > nbEleves) {
        console.warn('Numéro invalide :', num);
        return;
    }
    if (chronoRunning) {
        chronoRunning = false;
        if (rafId) cancelAnimationFrame(rafId);
    }
    currentNumero = num;
    tempsFinal = null;
    chronoElapsed = 0;
    mode = 'chrono';
    afficherInterface();
};

window.natationRetourListe = function() {
    console.log('⬅️ Retour à la liste');
    if (chronoRunning) {
        chronoRunning = false;
        if (rafId) cancelAnimationFrame(rafId);
    }
    chronoElapsed = 0;
    tempsFinal = null;
    mode = 'liste';
    afficherInterface();
};

window.natationDemarrer = function() {
    if (currentNumero === null) {
        alert('Erreur : aucun numéro sélectionné.');
        return;
    }
    if (chronoRunning) return;
    chronoRunning = true;
    chronoStart = performance.now() - chronoElapsed;
    rafId = requestAnimationFrame(updateChrono);
    
    const startBtn = document.getElementById('natation-start-btn');
    const stopBtn = document.getElementById('natation-stop-btn');
    if (startBtn) startBtn.classList.add('hidden');
    if (stopBtn) stopBtn.classList.remove('hidden');
};

window.natationArreter = function() {
    if (!chronoRunning) return;
    chronoRunning = false;
    if (rafId) cancelAnimationFrame(rafId);
    tempsFinal = chronoElapsed;
    mode = 'saisie';
    afficherInterface();
};

window.natationValiderTemps = function() {
    if (mode !== 'saisie') {
        mode = 'saisie';
        afficherInterface();
    }
};

window.natationRecommencer = function() {
    chronoElapsed = 0;
    tempsFinal = null;
    mode = 'chrono';
    afficherInterface();
};

window.natationAdjustCoups = function(delta) {
    const display = document.getElementById('natation-coups-display');
    if (!display) return;
    let val = parseInt(display.textContent) || 25;
    val = Math.max(1, val + delta);
    display.textContent = val;
    window._coupsSaisis = val;
};

window.natationValiderCoups = function() {
    const nbCoups = window._coupsSaisis || 25;
    if (nbCoups < 1) {
        alert('Veuillez saisir au moins 1 coup de bras.');
        return;
    }
    enregistrerTempsEtCoups(tempsFinal, nbCoups);
};

window.natationAnnulerCoups = function() {
    mode = 'chrono';
    afficherInterface();
};

window.natationNouvelEssai = function() {
    tempsFinal = null;
    chronoElapsed = 0;
    mode = 'chrono';
    afficherInterface();
};

window.natationChangerEleve = function() {
    currentNumero = null;
    tempsFinal = null;
    chronoElapsed = 0;
    mode = 'liste';
    afficherInterface();
};

window.retourMenuNatation = function() {
    if (configListener) configListener();
    const container = document.getElementById('natation-module');
    if (container) {
        container.innerHTML = '';
        container.style.display = 'none';
    }
    if (typeof window.resetToLogin === 'function') {
        window.resetToLogin();
    } else {
        location.reload();
    }
};

// ============================================================
// INITIALISATION
// ============================================================
export function initNatationKiosk(classe) {
    console.log('🏊 initNatationKiosk appelée pour', classe);
    currentClasse = classe;
    currentNumero = null;
    tempsFinal = null;
    mode = 'liste';
    historiqueEssais = [];

    const container = document.getElementById('natation-module');
    if (!container) {
        console.warn('Conteneur natation-module introuvable');
        return;
    }
    container.innerHTML = '';
    container.style.display = 'block';

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const configRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/natation/config`);
    if (configListener) configListener();
    configListener = onValue(configRef, (snap) => {
        config = snap.val() || {};
        nbEleves = config.nbEleves || 0;
        if (nbEleves === 0) {
            const mapping = JSON.parse(localStorage.getItem(`eps_arena_local_mapping_${classe}`) || '{}');
            const nums = Object.keys(mapping)
                .filter(k => k.startsWith(`${classe}_`))
                .map(k => parseInt(k.split('_')[1]))
                .filter(n => !isNaN(n));
            nbEleves = Math.max(...nums, 0);
        }
        if (nbEleves === 0) nbEleves = 28;
        afficherInterface();
    });
}

// ============================================================
// AFFICHAGE PRINCIPAL
// ============================================================
function afficherInterface() {
    const container = document.getElementById('natation-module');
    if (!container) return;
    console.log('🔄 afficherInterface() mode =', mode);

    if (mode === 'liste') afficherListeNumeros(container);
    else if (mode === 'chrono') afficherChrono(container);
    else if (mode === 'saisie') afficherSaisieCoups(container);
    else if (mode === 'feedback') {
        if (tempsFinal !== null && window._dernierNbCoups) {
            afficherFeedback(container, tempsFinal, window._dernierNbCoups);
        } else {
            mode = 'liste';
            afficherListeNumeros(container);
        }
    }
}

// ============================================================
// 1. LISTE DES NUMÉROS
// ============================================================
function afficherListeNumeros(container) {
    const distance = config?.distance || 25;
    const nums = [];
    for (let i = 1; i <= nbEleves; i++) nums.push(i);

    let html = `
        <div class="bg-slate-800 p-6 rounded-3xl border border-slate-700 text-center max-w-4xl mx-auto">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-3xl font-black text-white">🏊 Indice de nage</h2>
                <span class="text-sm text-slate-400">${distance}m</span>
            </div>
            <p class="text-sm text-slate-400 mb-6">Choisis ton numéro</p>
            <div class="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-4 max-w-3xl mx-auto" id="num-grid">
    `;

    nums.forEach(num => {
        html += `
            <button class="num-btn bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 
                           p-6 rounded-2xl font-black text-4xl text-white border-2 border-blue-400 
                           active:scale-95 transition-all shadow-lg hover:scale-105 hover:shadow-2xl"
                    data-numero="${num}"
                    onclick="window.natationChoisirNumero(${num})">
                ${num}
            </button>
        `;
    });

    html += `
            </div>
            <button onclick="window.retourMenuNatation()" 
                    class="mt-8 bg-slate-700 hover:bg-slate-600 px-8 py-3 rounded-xl font-black text-sm text-white active:scale-95 transition-all">
                ← Retour
            </button>
        </div>
    `;

    container.innerHTML = html;

    // Mettre à jour les couleurs avec les temps existants
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const tempsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/natation/temps`);
    onValue(tempsRef, (snap) => {
        const tempsData = snap.val() || {};
        const buttons = container.querySelectorAll('.num-btn');
        buttons.forEach(btn => {
            const num = parseInt(btn.dataset.numero);
            const eleveId = getEleveIdFromNumero(num);
            const temps = eleveId ? tempsData[eleveId] : null;
            if (temps && temps > 0) {
                btn.classList.remove('from-blue-600', 'to-blue-700', 'border-blue-400');
                btn.classList.add('from-emerald-600', 'to-emerald-700', 'border-emerald-400');
                btn.innerHTML = `${num} ✅`;
            } else {
                btn.classList.remove('from-emerald-600', 'to-emerald-700', 'border-emerald-400');
                btn.classList.add('from-blue-600', 'to-blue-700', 'border-blue-400');
                btn.innerHTML = `${num}`;
            }
        });
    }, { onlyOnce: false });
}

// ============================================================
// 2. CHRONO
// ============================================================
function afficherChrono(container) {
    const distance = config?.distance || 25;
    let tempsAffiche = '00:00.0';
    if (tempsFinal !== null) tempsAffiche = formatTime(tempsFinal);
    else if (chronoRunning) tempsAffiche = formatTime(chronoElapsed);

    container.innerHTML = `
        <div class="bg-slate-800 p-8 rounded-3xl border border-slate-700 text-center max-w-md mx-auto">
            <div class="flex items-center justify-center gap-6 mb-6">
                <span class="text-2xl font-black text-slate-400">N°</span>
                <span class="text-7xl font-black text-yellow-400">${currentNumero}</span>
            </div>
            <p class="text-sm text-slate-400 mb-4">${distance}m - Départ dans l'eau</p>

            <div class="text-8xl font-black tabular-nums text-yellow-400 mb-8" id="natation-chrono-display">
                ${tempsAffiche}
            </div>

            <div class="flex gap-4 justify-center">
                <button id="natation-start-btn" 
                        class="bg-emerald-600 hover:bg-emerald-500 px-10 py-5 rounded-2xl font-black text-2xl text-white active:scale-95 transition-all ${chronoRunning ? 'hidden' : ''}"
                        onclick="window.natationDemarrer()"
                        ${tempsFinal !== null ? 'disabled' : ''}>
                    ▶ Démarrer
                </button>
                <button id="natation-stop-btn" 
                        class="bg-red-600 hover:bg-red-500 px-10 py-5 rounded-2xl font-black text-2xl text-white active:scale-95 transition-all ${chronoRunning ? '' : 'hidden'}"
                        onclick="window.natationArreter()">
                    ⏹ Arrêter
                </button>
            </div>

            ${tempsFinal !== null ? `
                <div class="mt-6 flex gap-4 justify-center">
                    <button onclick="window.natationValiderTemps()" 
                            class="bg-emerald-600 hover:bg-emerald-500 px-8 py-3 rounded-xl font-black text-lg text-white active:scale-95 transition-all">
                        ✅ Valider
                    </button>
                    <button onclick="window.natationRecommencer()" 
                            class="bg-slate-600 hover:bg-slate-500 px-8 py-3 rounded-xl font-black text-lg text-white active:scale-95 transition-all">
                        ↺ Recommencer
                    </button>
                </div>
            ` : ''}

            <button onclick="window.natationRetourListe()" 
                    class="mt-8 bg-slate-700 hover:bg-slate-600 px-8 py-3 rounded-xl font-black text-sm text-white active:scale-95 transition-all">
                ← Retour à la liste
            </button>
        </div>
    `;
}

// ============================================================
// 3. SAISIE DES COUPS DE BRAS (démarre à 25)
// ============================================================
function afficherSaisieCoups(container) {
    const tempsStr = formatTime(tempsFinal);
    window._coupsSaisis = 25;
    container.innerHTML = `
        <div class="bg-slate-800 p-8 rounded-3xl border border-slate-700 text-center max-w-md mx-auto">
            <div class="flex items-center justify-center gap-6 mb-6">
                <span class="text-2xl font-black text-slate-400">N°</span>
                <span class="text-7xl font-black text-yellow-400">${currentNumero}</span>
            </div>
            <p class="text-sm text-slate-400 mb-2">Temps enregistré</p>
            <div class="text-5xl font-black text-yellow-400 mb-6">${tempsStr}</div>
            
            <p class="text-lg font-bold text-white mb-4">Combien de coups de bras ?</p>
            <div class="flex justify-center items-center gap-6 mb-6">
                <button onclick="window.natationAdjustCoups(-1)" 
                        class="bg-slate-700 hover:bg-slate-600 w-20 h-20 rounded-2xl text-4xl font-black text-white active:scale-95 transition-all">−</button>
                <span id="natation-coups-display" class="text-7xl font-black text-white w-32 text-center">25</span>
                <button onclick="window.natationAdjustCoups(1)" 
                        class="bg-slate-700 hover:bg-slate-600 w-20 h-20 rounded-2xl text-4xl font-black text-white active:scale-95 transition-all">+</button>
            </div>
            <p class="text-xs text-slate-500 mb-6">(1 cycle = 2 coups de bras)</p>

            <div class="flex gap-4 justify-center">
                <button onclick="window.natationValiderCoups()" 
                        class="bg-emerald-600 hover:bg-emerald-500 px-8 py-3 rounded-xl font-black text-lg text-white active:scale-95 transition-all">
                    ✅ Enregistrer
                </button>
                <button onclick="window.natationAnnulerCoups()" 
                        class="bg-slate-600 hover:bg-slate-500 px-8 py-3 rounded-xl font-black text-lg text-white active:scale-95 transition-all">
                    Annuler
                </button>
            </div>

            <button onclick="window.natationRetourListe()" 
                    class="mt-8 bg-slate-700 hover:bg-slate-600 px-8 py-3 rounded-xl font-black text-sm text-white active:scale-95 transition-all">
                ← Retour à la liste
            </button>
        </div>
    `;
}

// ============================================================
// 4. FONCTIONS DE BARÈME (CORRIGÉES AVEC ARRONDI)
// ============================================================
function getNiveau(indice) {
    if (indice === null || isNaN(indice)) {
        return { couleur: '#64748b', label: '--' };
    }
    // Arrondir à 2 décimales pour éviter les problèmes de précision
    const rounded = Math.round(indice * 100) / 100;
    
    if (rounded >= 4.0) return { couleur: '#22c55e', label: '🌟 Excellent' };
    if (rounded >= 3.0) return { couleur: '#3b82f6', label: '💪 Très satisfaisant' };
    if (rounded >= 2.0) return { couleur: '#eab308', label: '✅ Satisfaisant' };
    if (rounded >= 1.31) return { couleur: '#f97316', label: '🟡 Fragile' };
    return { couleur: '#ef4444', label: '🔴 Très insuffisant' };
}

function getMessageEncouragement(indice) {
    if (indice === null || isNaN(indice)) return null;
    // Arrondir à 2 décimales
    const rounded = Math.round(indice * 100) / 100;
    
    if (rounded >= 4.0) return '🏆 Excellent ! Tu maîtrises parfaitement ta nage !';
    if (rounded >= 3.0) {
        const ecart = (4.0 - rounded).toFixed(2);
        if (ecart == 0) return '🎯 Tu es à la limite de l\'Excellent !';
        return `💪 Tu es à ${ecart} pt${ecart > 1 ? 's' : ''} de passer dans le groupe "Excellent" !`;
    }
    if (rounded >= 2.0) {
        const ecart = (3.0 - rounded).toFixed(2);
        if (ecart == 0) return '🎯 Tu es à la limite du "Très satisfaisant" !';
        return `💪 Tu es à ${ecart} pt${ecart > 1 ? 's' : ''} de passer dans le groupe "Très satisfaisant" !`;
    }
    if (rounded >= 1.31) {
        const ecart = (2.0 - rounded).toFixed(2);
        if (ecart == 0) return '🎯 Tu es à la limite du "Satisfaisant" !';
        return `💪 Tu es à ${ecart} pt${ecart > 1 ? 's' : ''} de passer dans le groupe "Satisfaisant" !`;
    }
    return null;
}

// ============================================================
// 5. FEEDBACK (avec barème corrigé)
// ============================================================
function afficherFeedback(container, tempsMs, nbCoups) {
    const indice = calculIndice(tempsMs, nbCoups);
    const niveau = getNiveau(indice);
    const tempsStr = formatTime(tempsMs);

    // Ajouter l'essai à l'historique
    historiqueEssais.push({ tempsMs, nbCoups, indice, timestamp: Date.now() });
    if (historiqueEssais.length > 5) historiqueEssais.shift();

    // Meilleur indice
    const meilleurIndice = Math.max(...historiqueEssais.map(e => e.indice), 0);

    // Message d'encouragement
    const messageEncouragement = getMessageEncouragement(indice);

    // Graphique de progression
    let graphHtml = '';
    if (historiqueEssais.length > 0) {
        const maxIndice = Math.max(...historiqueEssais.map(e => e.indice), 1);
        graphHtml = `
            <div class="flex items-end justify-center gap-3 h-32 mt-4">
                ${historiqueEssais.map((essai, idx) => {
                    const hauteur = Math.max(10, (essai.indice / maxIndice) * 80);
                    const couleur = getNiveau(essai.indice).couleur;
                    return `
                        <div class="flex flex-col items-center">
                            <div class="w-8 rounded-t-lg" style="height:${hauteur}px; background-color:${couleur};"></div>
                            <span class="text-xs text-slate-400 mt-1">${idx+1}</span>
                        </div>
                    `;
                }).join('')}
            </div>
            <p class="text-xs text-slate-500 mt-2">Évolution de l'indice (essais successifs)</p>
        `;
    }

    let html = `
        <div class="bg-slate-800 p-8 rounded-3xl border border-slate-700 text-center max-w-md mx-auto">
            <div class="flex items-center justify-center gap-6 mb-4">
                <span class="text-2xl font-black text-slate-400">N°</span>
                <span class="text-6xl font-black text-yellow-400">${currentNumero}</span>
            </div>
            
            <div class="bg-slate-900 p-4 rounded-2xl border border-slate-600 mb-4">
                <p class="text-sm text-slate-400">Temps</p>
                <p class="text-3xl font-black text-yellow-400">${tempsStr}</p>
                <p class="text-sm text-slate-400 mt-2">Coups de bras</p>
                <p class="text-3xl font-black text-blue-400">${nbCoups}</p>
            </div>

            <div class="bg-slate-900 p-4 rounded-2xl border border-slate-600 mb-4">
                <p class="text-sm text-slate-400">Indice de nage</p>
                <p class="text-5xl font-black text-yellow-400">${indice.toFixed(2)}</p>
                <p class="text-sm font-bold mt-2" style="color: ${niveau.couleur}">
                    ${niveau.label}
                </p>
                ${historiqueEssais.length > 1 ? `
                    <div class="mt-1 text-sm text-slate-400">
                        🏅 Meilleur : <span class="text-yellow-400 font-bold">${meilleurIndice.toFixed(2)}</span>
                    </div>
                ` : ''}
                ${messageEncouragement ? `
                    <div class="mt-3 p-2 bg-slate-700/50 rounded-xl border border-slate-600">
                        <p class="text-sm text-yellow-400 font-bold">${messageEncouragement}</p>
                    </div>
                ` : ''}
            </div>

            ${graphHtml}

            <div class="flex gap-4 justify-center mt-6">
                <button onclick="window.natationNouvelEssai()" 
                        class="bg-blue-600 hover:bg-blue-500 px-8 py-3 rounded-xl font-black text-lg text-white active:scale-95 transition-all">
                    🔄 Nouvel essai
                </button>
                <button onclick="window.natationChangerEleve()" 
                        class="bg-slate-600 hover:bg-slate-500 px-8 py-3 rounded-xl font-black text-lg text-white active:scale-95 transition-all">
                    👤 Changer d'élève
                </button>
            </div>

            <button onclick="window.natationRetourListe()" 
                    class="mt-4 bg-slate-700 hover:bg-slate-600 px-8 py-3 rounded-xl font-black text-sm text-white active:scale-95 transition-all">
                ← Retour à la liste
            </button>
        </div>
    `;

    container.innerHTML = html;
}

// ============================================================
// FONCTIONS UTILITAIRES
// ============================================================
function getEleveIdFromNumero(num) {
    const mapping = JSON.parse(localStorage.getItem(`eps_arena_local_mapping_${currentClasse}`) || '{}');
    return mapping[`${currentClasse}_${num}`] || null;
}

function calculIndice(tempsMs, nbCoups) {
    if (tempsMs === null || nbCoups === null || tempsMs <= 0 || nbCoups <= 0) return null;
    const tempsSec = tempsMs / 1000;
    const cycles = nbCoups / 2;
    if (cycles <= 0) return null;
    const vitesse = 25 / tempsSec;
    const distanceParCycle = 25 / cycles;
    return vitesse * distanceParCycle;
}

function formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const min = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const sec = String(totalSec % 60).padStart(2, '0');
    const dec = Math.floor((ms % 1000) / 100);
    return `${min}:${sec}.${dec}`;
}

function updateChrono() {
    if (!chronoRunning) return;
    chronoElapsed = performance.now() - chronoStart;
    const display = document.getElementById('natation-chrono-display');
    if (display) display.textContent = formatTime(chronoElapsed);
    rafId = requestAnimationFrame(updateChrono);
}

// ============================================================
// ENREGISTREMENT FIREBASE
// ============================================================
function enregistrerTempsEtCoups(tempsMs, nbCoups) {
    if (currentNumero === null) return;
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const mapping = JSON.parse(localStorage.getItem(`eps_arena_local_mapping_${currentClasse}`) || '{}');
    const eleveId = mapping[`${currentClasse}_${currentNumero}`];
    if (!eleveId) {
        alert('Numéro non reconnu. Contacte le professeur.');
        return;
    }

    const tempsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/natation/temps/${eleveId}`);
    const coupsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/natation/coups/${eleveId}`);

    Promise.all([
        set(tempsRef, tempsMs),
        set(coupsRef, nbCoups)
    ]).then(() => {
        console.log('✅ Temps et coups enregistrés pour', eleveId);
        window._dernierNbCoups = nbCoups;
        mode = 'feedback';
        const container = document.getElementById('natation-module');
        if (container) afficherFeedback(container, tempsMs, nbCoups);
    }).catch(err => {
        console.error('Erreur enregistrement :', err);
        alert('Erreur lors de l\'enregistrement. Réessayez.');
    });
}