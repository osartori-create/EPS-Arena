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

let mode = 'liste';
let historiqueEssais = [];
let isSaving = false;

// ============================================================
// EXPOSITION DES FONCTIONS GLOBALES
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
    
    chargerHistoriqueEleve(num, () => {
        mode = 'chrono';
        afficherInterface();
    });
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
    if (isSaving) return;
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
    isSaving = false;

    const container = document.getElementById('natation-module');
    if (!container) {
        console.warn('Conteneur natation-module introuvable');
        return;
    }
    container.innerHTML = '';
    container.style.display = 'block';
    
    const codeInfo = document.getElementById('code-info');
    if (codeInfo) codeInfo.style.display = 'none';
    const btnQuit = document.getElementById('btn-quit');
    if (btnQuit) btnQuit.style.display = 'none';

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const configRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/natation/config`);
    if (configListener) configListener();
    configListener = onValue(configRef, (snap) => {
        config = snap.val() || {};
        nbEleves = config.nbEleves || 0;
        if (nbEleves === 0) {
            const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');
            if (eleves.length > 0) nbEleves = eleves.length;
            else nbEleves = 28;
        }
        afficherInterface();
    });
}

// ============================================================
// AFFICHAGE PRINCIPAL
// ============================================================
function afficherInterface() {
    const container = document.getElementById('natation-module');
    if (!container) return;

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

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const tempsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/natation/temps`);
    let tempsData = {};
    onValue(tempsRef, (snap) => {
        tempsData = snap.val() || {};
    }, { onlyOnce: false });

    let html = `
        <div class="w-full min-h-screen bg-slate-900 p-6 flex flex-col">
            <div class="flex justify-between items-center mb-6 px-4">
                <h2 class="text-4xl font-black text-white">🏊 Indice de nage</h2>
                <span class="text-xl text-slate-400">${distance}m</span>
            </div>
            <p class="text-xl text-slate-400 mb-8 text-center">Choisis ton numéro</p>
            <div class="flex-1 grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-4 max-w-6xl mx-auto w-full" id="num-grid">
    `;

    nums.forEach(num => {
        // On vérifie si l'élève a déjà un temps (directement dans tempsData par numéro)
        const temps = tempsData[num] || null;
        const aTemps = temps && temps > 0;
        const bgClass = aTemps 
            ? 'bg-gradient-to-br from-emerald-600 to-emerald-700 border-emerald-400' 
            : 'bg-gradient-to-br from-blue-600 to-blue-700 border-blue-400';
        const label = aTemps ? `${num} ✅` : `${num}`;
        
        html += `
            <button class="num-btn ${bgClass} 
                           p-8 rounded-2xl font-black text-5xl text-white border-4 
                           active:scale-95 transition-all shadow-lg hover:scale-105 hover:shadow-2xl
                           touch-manipulation"
                    data-numero="${num}"
                    onclick="window.natationChoisirNumero(${num})">
                ${label}
            </button>
        `;
    });

    html += `
            </div>
            <div class="mt-8 text-center">
                <button onclick="window.retourMenuNatation()" 
                        class="bg-slate-700 hover:bg-slate-600 px-12 py-4 rounded-2xl font-black text-xl text-white active:scale-95 transition-all">
                    ← Retour
                </button>
            </div>
        </div>
    `;

    container.innerHTML = html;
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
        <div class="w-full min-h-screen bg-slate-900 p-4 md:p-8 flex flex-col items-center justify-center">
            <div class="bg-slate-800 p-6 md:p-8 rounded-3xl border border-slate-700 w-full max-w-2xl">
                <div class="flex items-center justify-center gap-6 md:gap-8 mb-6 md:mb-8">
                    <span class="text-2xl md:text-3xl font-black text-slate-400">N°</span>
                    <span class="text-6xl md:text-8xl font-black text-yellow-400">${currentNumero}</span>
                </div>
                <p class="text-lg md:text-xl text-slate-400 text-center mb-4 md:mb-6">${distance}m - Départ dans l'eau</p>

                <div class="text-7xl md:text-9xl font-black tabular-nums text-yellow-400 text-center mb-8 md:mb-10" id="natation-chrono-display">
                    ${tempsAffiche}
                </div>

                <!-- 🔥 BOUTONS GÉANTS -->
                <div class="flex flex-col gap-4 md:gap-6">
                    <button id="natation-start-btn" 
                            class="w-full bg-emerald-600 hover:bg-emerald-500 py-8 md:py-10 rounded-2xl font-black text-4xl md:text-5xl text-white active:scale-95 transition-all touch-manipulation ${chronoRunning ? 'hidden' : ''}"
                            onclick="window.natationDemarrer()"
                            ${tempsFinal !== null ? 'disabled' : ''}>
                        ▶ DÉMARRER
                    </button>
                    <button id="natation-stop-btn" 
                            class="w-full bg-red-600 hover:bg-red-500 py-8 md:py-10 rounded-2xl font-black text-4xl md:text-5xl text-white active:scale-95 transition-all touch-manipulation ${chronoRunning ? '' : 'hidden'}"
                            onclick="window.natationArreter()">
                        ⏹ ARRÊTER
                    </button>

                    ${tempsFinal !== null ? `
                        <div class="flex flex-col sm:flex-row gap-4">
                            <button onclick="window.natationValiderTemps()" 
                                    class="flex-1 bg-emerald-600 hover:bg-emerald-500 py-6 md:py-8 rounded-2xl font-black text-3xl md:text-4xl text-white active:scale-95 transition-all touch-manipulation">
                                ✅ VALIDER
                            </button>
                            <button onclick="window.natationRecommencer()" 
                                    class="flex-1 bg-slate-600 hover:bg-slate-500 py-6 md:py-8 rounded-2xl font-black text-3xl md:text-4xl text-white active:scale-95 transition-all touch-manipulation">
                                ↺ RECOMMENCER
                            </button>
                        </div>
                    ` : ''}

                    <button onclick="window.natationRetourListe()" 
                            class="w-full bg-slate-700 hover:bg-slate-600 py-4 md:py-5 rounded-2xl font-black text-xl md:text-2xl text-white active:scale-95 transition-all touch-manipulation">
                        ← Retour à la liste
                    </button>
                </div>
            </div>
        </div>
    `;
}

// ============================================================
// 3. SAISIE DES COUPS DE BRAS
// ============================================================
function afficherSaisieCoups(container) {
    const tempsStr = formatTime(tempsFinal);
    window._coupsSaisis = 25;
    container.innerHTML = `
        <div class="w-full min-h-screen bg-slate-900 p-4 md:p-8 flex flex-col items-center justify-center">
            <div class="bg-slate-800 p-6 md:p-8 rounded-3xl border border-slate-700 w-full max-w-2xl">
                <div class="flex items-center justify-center gap-6 md:gap-8 mb-4 md:mb-6">
                    <span class="text-2xl md:text-3xl font-black text-slate-400">N°</span>
                    <span class="text-6xl md:text-8xl font-black text-yellow-400">${currentNumero}</span>
                </div>
                <p class="text-lg md:text-xl text-slate-400 text-center mb-2">Temps enregistré</p>
                <div class="text-5xl md:text-6xl font-black text-yellow-400 text-center mb-6 md:mb-8">${tempsStr}</div>
                
                <p class="text-xl md:text-2xl font-bold text-white text-center mb-4 md:mb-6">Combien de coups de bras ?</p>
                
                <!-- 🔥 COMPTEUR GÉANT -->
                <div class="flex justify-center items-center gap-4 md:gap-6 mb-6 md:mb-8">
                    <button onclick="window.natationAdjustCoups(-1)" 
                            class="bg-slate-700 hover:bg-slate-600 w-20 h-20 md:w-28 md:h-28 rounded-2xl text-5xl md:text-6xl font-black text-white active:scale-95 transition-all touch-manipulation">−</button>
                    <span id="natation-coups-display" class="text-7xl md:text-8xl font-black text-white w-32 md:w-40 text-center">25</span>
                    <button onclick="window.natationAdjustCoups(1)" 
                            class="bg-slate-700 hover:bg-slate-600 w-20 h-20 md:w-28 md:h-28 rounded-2xl text-5xl md:text-6xl font-black text-white active:scale-95 transition-all touch-manipulation">+</button>
                </div>
                <p class="text-sm text-slate-500 text-center mb-6 md:mb-8">(1 cycle = 2 coups de bras)</p>

                <!-- 🔥 BOUTONS GÉANTS -->
                <div class="flex flex-col sm:flex-row gap-4">
                    <button onclick="window.natationValiderCoups()" 
                            class="flex-1 bg-emerald-600 hover:bg-emerald-500 py-6 md:py-8 rounded-2xl font-black text-3xl md:text-4xl text-white active:scale-95 transition-all touch-manipulation">
                        ✅ ENREGISTRER
                    </button>
                    <button onclick="window.natationAnnulerCoups()" 
                            class="flex-1 bg-slate-600 hover:bg-slate-500 py-6 md:py-8 rounded-2xl font-black text-3xl md:text-4xl text-white active:scale-95 transition-all touch-manipulation">
                        ANNULER
                    </button>
                </div>

                <button onclick="window.natationRetourListe()" 
                        class="w-full mt-4 md:mt-6 bg-slate-700 hover:bg-slate-600 py-4 md:py-5 rounded-2xl font-black text-xl md:text-2xl text-white active:scale-95 transition-all touch-manipulation">
                    ← Retour à la liste
                </button>
            </div>
        </div>
    `;
}

// ============================================================
// 4. BARÈME
// ============================================================
function getNiveau(indice) {
    if (indice === null || isNaN(indice)) {
        return { couleur: '#64748b', label: '--' };
    }
    const rounded = Math.round(indice * 100) / 100;
    
    if (rounded >= 4.0) return { couleur: '#22c55e', label: '🌟 Excellent' };
    if (rounded >= 3.0) return { couleur: '#3b82f6', label: '💪 Très satisfaisant' };
    if (rounded >= 2.0) return { couleur: '#eab308', label: '✅ Satisfaisant' };
    if (rounded >= 1.31) return { couleur: '#f97316', label: '🟡 Fragile' };
    return { couleur: '#ef4444', label: '🔴 Très insuffisant' };
}

function getMessageEncouragement(indice) {
    if (indice === null || isNaN(indice)) return null;
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
// 5. FEEDBACK
// ============================================================
function afficherFeedback(container, tempsMs, nbCoups) {
    const indice = calculIndice(tempsMs, nbCoups);
    const niveau = getNiveau(indice);
    const tempsStr = formatTime(tempsMs);

    const uniqueEssais = [];
    const seen = new Set();
    for (const essai of historiqueEssais) {
        const key = `${essai.tempsMs}-${essai.nbCoups}-${Math.round(essai.indice * 100)}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueEssais.push(essai);
        }
    }
    historiqueEssais = uniqueEssais;

    const meilleurIndice = Math.max(...historiqueEssais.map(e => e.indice), 0);
    const messageEncouragement = getMessageEncouragement(indice);

    let graphHtml = '';
    if (historiqueEssais.length > 0) {
        const maxIndice = Math.max(...historiqueEssais.map(e => e.indice), 1);
        graphHtml = `
            <div class="flex items-end justify-center gap-3 md:gap-4 h-32 md:h-40 mt-4 md:mt-6">
                ${historiqueEssais.map((essai, idx) => {
                    const hauteur = Math.max(10, (essai.indice / maxIndice) * 100);
                    const couleur = getNiveau(essai.indice).couleur;
                    return `
                        <div class="flex flex-col items-center">
                            <div class="w-6 md:w-10 rounded-t-lg" style="height:${hauteur}px; background-color:${couleur};"></div>
                            <span class="text-xs md:text-sm text-slate-400 mt-1 md:mt-2">${idx+1}</span>
                        </div>
                    `;
                }).join('')}
            </div>
            <p class="text-xs md:text-sm text-slate-500 text-center mt-2 md:mt-3">Évolution de l'indice (essais successifs)</p>
        `;
    }

    container.innerHTML = `
        <div class="w-full min-h-screen bg-slate-900 p-4 md:p-8 flex flex-col items-center justify-center">
            <div class="bg-slate-800 p-6 md:p-8 rounded-3xl border border-slate-700 w-full max-w-2xl">
                <div class="flex items-center justify-center gap-6 md:gap-8 mb-4 md:mb-6">
                    <span class="text-2xl md:text-3xl font-black text-slate-400">N°</span>
                    <span class="text-6xl md:text-8xl font-black text-yellow-400">${currentNumero}</span>
                </div>
                
                <div class="grid grid-cols-2 gap-3 md:gap-4 bg-slate-900 p-4 md:p-6 rounded-2xl border border-slate-600 mb-4 md:mb-6">
                    <div class="text-center">
                        <p class="text-xs md:text-sm text-slate-400">Temps</p>
                        <p class="text-3xl md:text-4xl font-black text-yellow-400">${tempsStr}</p>
                    </div>
                    <div class="text-center">
                        <p class="text-xs md:text-sm text-slate-400">Coups de bras</p>
                        <p class="text-3xl md:text-4xl font-black text-blue-400">${nbCoups}</p>
                    </div>
                </div>

                <div class="bg-slate-900 p-4 md:p-6 rounded-2xl border border-slate-600 mb-4 md:mb-6">
                    <p class="text-xs md:text-sm text-slate-400 text-center">Indice de nage</p>
                    <p class="text-5xl md:text-7xl font-black text-yellow-400 text-center">${indice.toFixed(2)}</p>
                    <p class="text-xl md:text-2xl font-bold text-center mt-1 md:mt-2" style="color: ${niveau.couleur}">
                        ${niveau.label}</p>
                    ${historiqueEssais.length > 1 ? `
                        <div class="text-center mt-1 md:mt-2 text-xs md:text-sm text-slate-400">
                            🏅 Meilleur : <span class="text-yellow-400 font-bold text-lg md:text-xl">${meilleurIndice.toFixed(2)}</span>
                        </div>
                    ` : ''}
                    ${messageEncouragement ? `
                        <div class="mt-3 md:mt-4 p-3 md:p-4 bg-slate-700/50 rounded-xl border border-slate-600">
                            <p class="text-base md:text-lg text-yellow-400 font-bold text-center">${messageEncouragement}</p>
                        </div>
                    ` : ''}
                </div>

                ${graphHtml}

                <!-- 🔥 BOUTONS GÉANTS -->
                <div class="flex flex-col sm:flex-row gap-4 mt-4 md:mt-8">
                    <button onclick="window.natationNouvelEssai()" 
                            class="flex-1 bg-blue-600 hover:bg-blue-500 py-6 md:py-8 rounded-2xl font-black text-3xl md:text-4xl text-white active:scale-95 transition-all touch-manipulation">
                        🔄 NOUVEL ESSAI
                    </button>
                    <button onclick="window.natationChangerEleve()" 
                            class="flex-1 bg-slate-600 hover:bg-slate-500 py-6 md:py-8 rounded-2xl font-black text-3xl md:text-4xl text-white active:scale-95 transition-all touch-manipulation">
                        👤 CHANGER D'ÉLÈVE
                    </button>
                </div>

                <button onclick="window.natationRetourListe()" 
                        class="w-full mt-4 bg-slate-700 hover:bg-slate-600 py-4 md:py-5 rounded-2xl font-black text-xl md:text-2xl text-white active:scale-95 transition-all touch-manipulation">
                    ← Retour à la liste
                </button>
            </div>
        </div>
    `;
}

// ============================================================
// CHARGEMENT DE L'HISTORIQUE (uniquement ici)
// ============================================================
function chargerHistoriqueEleve(numero, callback) {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const historiqueRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/natation/historique/${numero}`);
    
    onValue(historiqueRef, (snap) => {
        const data = snap.val() || [];
        historiqueEssais = data.map(e => ({
            tempsMs: e.tempsMs,
            nbCoups: e.nbCoups,
            indice: e.indice,
            timestamp: e.timestamp
        }));
        if (callback) callback();
    }, { onlyOnce: true });
}

// ============================================================
// FONCTIONS UTILITAIRES
// ============================================================
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
    if (isSaving) return;
    if (currentNumero === null) return;
    
    const numero = currentNumero; // clé = numéro

    isSaving = true;
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const indice = calculIndice(tempsMs, nbCoups);
    
    const nouvelEssai = {
        numero: numero,
        tempsMs: tempsMs,
        nbCoups: nbCoups,
        indice: indice,
        timestamp: Date.now()
    };

    const historiqueRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/natation/historique/${numero}`);
    
    onValue(historiqueRef, (snap) => {
        let historique = snap.val() || [];
        if (!Array.isArray(historique)) historique = [];
        
        // Dédoublonner (supprimer les essais identiques)
        historique = historique.filter(h => 
            !(Math.abs(h.tempsMs - tempsMs) < 1 && h.nbCoups === nbCoups)
        );
        
        historique.push(nouvelEssai);
        if (historique.length > 10) historique.shift();
        
        set(historiqueRef, historique).then(() => {
            const tempsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/natation/temps/${numero}`);
            const coupsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/natation/coups/${numero}`);
            
            return Promise.all([
                set(tempsRef, tempsMs),
                set(coupsRef, nbCoups)
            ]);
        }).then(() => {
            console.log('✅ Enregistré pour le numéro', numero);
            window._dernierNbCoups = nbCoups;
            chargerHistoriqueEleve(numero, () => {
                isSaving = false;
                mode = 'feedback';
                const container = document.getElementById('natation-module');
                if (container) afficherFeedback(container, tempsMs, nbCoups);
            });
        }).catch(err => {
            console.error('Erreur :', err);
            alert('Erreur lors de l\'enregistrement.');
            isSaving = false;
        });
    }, { onlyOnce: true });
}