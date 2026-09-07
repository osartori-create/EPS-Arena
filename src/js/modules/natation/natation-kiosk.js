// src/js/modules/natation/natation-kiosk.js
import { db, ref, onValue, set, push } from '../../core/firebase-service.js';

let currentClasse = '';
let currentNumero = null;
let config = null;
let configListener = null;
let nbEleves = 0;
let historiqueEssais = {}; // { eleveId: [ { temps, coups, indice, date }, ... ] }

let chronoRunning = false;
let chronoStart = 0;
let chronoElapsed = 0;
let rafId = null;
let tempsFinal = null;

let mode = 'liste'; // 'liste' | 'chrono' | 'saisie' | 'feedback'

export function initNatationKiosk(classe) {
    console.log('🏊 initNatationKiosk appelée pour', classe);
    currentClasse = classe;
    currentNumero = null;
    tempsFinal = null;
    mode = 'liste';
    historiqueEssais = {};

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
        console.log('📡 Config Natation reçue :', config);
        nbEleves = config.nbEleves || 0;
        
        if (nbEleves === 0) {
            const mapping = JSON.parse(localStorage.getItem(`eps_arena_local_mapping_${classe}`) || '{}');
            const nums = Object.keys(mapping)
                .filter(k => k.startsWith(`${classe}_`))
                .map(k => parseInt(k.split('_')[1]))
                .filter(n => !isNaN(n));
            nbEleves = Math.max(...nums, 0);
            console.log('🔢 nbEleves déduit du mapping :', nbEleves);
        }
        if (nbEleves === 0) {
            nbEleves = 28;
            console.log('⚠️ nbEleves = 0, utilisation de la valeur par défaut : 28');
        }
        
        // Charger l'historique des essais pour cette classe
        chargerHistoriqueEssais();
        afficherInterface();
    });
}

// ============================================================
// CHARGEMENT DE L'HISTORIQUE DES ESSAIS (Firebase)
// ============================================================
function chargerHistoriqueEssais() {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const historiqueRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/natation/historique`);
    onValue(historiqueRef, (snap) => {
        const data = snap.val() || {};
        // data = { eleveId: [ { temps, coups, indice, date }, ... ] }
        historiqueEssais = data;
        // Si on est en mode feedback, on rafraîchit l'affichage
        if (mode === 'feedback') {
            afficherInterface();
        }
    });
}

// ============================================================
// AFFICHAGE PRINCIPAL
// ============================================================
function afficherInterface() {
    const container = document.getElementById('natation-module');
    if (!container) return;
    console.log('🔄 afficherInterface() appelée, mode =', mode);

    if (mode === 'liste') {
        afficherListeNumeros(container);
    } else if (mode === 'chrono') {
        afficherChrono(container);
    } else if (mode === 'saisie') {
        afficherSaisieCoups(container);
    } else if (mode === 'feedback') {
        afficherFeedback(container);
    }
}

// ============================================================
// 1. LISTE DES NUMÉROS (colorés selon statut)
// ============================================================
function afficherListeNumeros(container) {
    const distance = config?.distance || 25;
    const nums = [];
    for (let i = 1; i <= nbEleves; i++) nums.push(i);

    // Récupérer les temps pour colorer les boutons
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const tempsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/natation/temps`);
    let tempsData = {};
    onValue(tempsRef, (snap) => {
        tempsData = snap.val() || {};
        // On réaffiche si on est encore en mode liste
        if (mode === 'liste') {
            afficherListeNumeros(container);
        }
    }, { onlyOnce: true });

    let html = `
        <div class="bg-slate-800 p-6 rounded-3xl border border-slate-700 text-center max-w-4xl mx-auto">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-3xl font-black text-white">🏊 Indice de nage</h2>
                <span class="text-sm text-slate-400">${distance}m</span>
            </div>
            <p class="text-sm text-slate-400 mb-6">Choisis ton numéro</p>
            <div class="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-4 max-w-3xl mx-auto">
    `;

    nums.forEach(num => {
        const eleveId = getEleveIdFromNumero(num);
        const aTemps = eleveId && tempsData[eleveId] && tempsData[eleveId] > 0;
        const bgClass = aTemps 
            ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400' 
            : 'bg-blue-600 hover:bg-blue-500 border-blue-400';
        const label = aTemps ? `${num} ✅` : `${num}`;
        html += `
            <button onclick="window.natationChoisirNumero(${num})" 
                    class="${bgClass} p-6 rounded-2xl font-black text-4xl text-white border-4 
                           active:scale-95 transition-all shadow-lg hover:scale-105 hover:shadow-2xl
                           min-h-[100px] min-w-[80px] touch-manipulation">
                ${label}
            </button>
        `;
    });

    html += `
            </div>
            <button onclick="window.retourMenuNatation()" 
                    class="mt-8 bg-slate-700 hover:bg-slate-600 px-8 py-4 rounded-xl font-black text-lg text-white active:scale-95 transition-all touch-manipulation">
                ← Retour
            </button>
        </div>
    `;

    container.innerHTML = html;
}

function getEleveIdFromNumero(num) {
    const mapping = JSON.parse(localStorage.getItem(`eps_arena_local_mapping_${currentClasse}`) || '{}');
    return mapping[`${currentClasse}_${num}`] || null;
}

// ============================================================
// 2. CHRONO (grands boutons tactiles)
// ============================================================
function afficherChrono(container) {
    const distance = config?.distance || 25;

    let tempsAffiche = '00:00.0';
    if (tempsFinal !== null) {
        tempsAffiche = formatTime(tempsFinal);
    } else if (chronoRunning) {
        tempsAffiche = formatTime(chronoElapsed);
    }

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
                        class="bg-emerald-600 hover:bg-emerald-500 px-12 py-6 rounded-3xl font-black text-3xl text-white active:scale-95 transition-all touch-manipulation ${chronoRunning ? 'hidden' : ''}"
                        onclick="window.natationDemarrer()"
                        ${tempsFinal !== null ? 'disabled' : ''}>
                    ▶ Démarrer
                </button>
                <button id="natation-stop-btn" 
                        class="bg-red-600 hover:bg-red-500 px-12 py-6 rounded-3xl font-black text-3xl text-white active:scale-95 transition-all touch-manipulation ${chronoRunning ? '' : 'hidden'}"
                        onclick="window.natationArreter()">
                    ⏹ Arrêter
                </button>
            </div>

            ${tempsFinal !== null ? `
                <div class="mt-6 flex gap-4 justify-center">
                    <button onclick="window.natationValiderTemps()" 
                            class="bg-emerald-600 hover:bg-emerald-500 px-10 py-4 rounded-2xl font-black text-xl text-white active:scale-95 transition-all touch-manipulation">
                        ✅ Valider
                    </button>
                    <button onclick="window.natationRecommencer()" 
                            class="bg-slate-600 hover:bg-slate-500 px-10 py-4 rounded-2xl font-black text-xl text-white active:scale-95 transition-all touch-manipulation">
                        ↺ Recommencer
                    </button>
                </div>
            ` : ''}

            <button onclick="window.natationRetourListe()" 
                    class="mt-8 bg-slate-700 hover:bg-slate-600 px-8 py-4 rounded-xl font-black text-lg text-white active:scale-95 transition-all touch-manipulation">
                ← Sélectionner un autre élève
            </button>
        </div>
    `;
}

// ============================================================
// 3. SAISIE DES COUPS (démarre à 25)
// ============================================================
function afficherSaisieCoups(container) {
    const tempsStr = formatTime(tempsFinal);
    // Initialiser à 25 si c'est le premier essai, sinon on peut partir de la dernière valeur
    const initialCoups = 25;
    window._coupsSaisis = initialCoups;

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
                        class="bg-slate-700 hover:bg-slate-600 w-24 h-24 rounded-3xl text-5xl font-black text-white active:scale-95 transition-all touch-manipulation">−</button>
                <span id="natation-coups-display" class="text-7xl font-black text-white w-32 text-center">${initialCoups}</span>
                <button onclick="window.natationAdjustCoups(1)" 
                        class="bg-slate-700 hover:bg-slate-600 w-24 h-24 rounded-3xl text-5xl font-black text-white active:scale-95 transition-all touch-manipulation">+</button>
            </div>
            <p class="text-xs text-slate-500 mb-6">(1 cycle = 2 coups de bras)</p>

            <div class="flex gap-4 justify-center">
                <button onclick="window.natationValiderCoups()" 
                        class="bg-emerald-600 hover:bg-emerald-500 px-10 py-4 rounded-2xl font-black text-xl text-white active:scale-95 transition-all touch-manipulation">
                    ✅ Enregistrer
                </button>
                <button onclick="window.natationAnnulerCoups()" 
                        class="bg-slate-600 hover:bg-slate-500 px-10 py-4 rounded-2xl font-black text-xl text-white active:scale-95 transition-all touch-manipulation">
                    Annuler
                </button>
            </div>

            <button onclick="window.natationRetourListe()" 
                    class="mt-8 bg-slate-700 hover:bg-slate-600 px-8 py-4 rounded-xl font-black text-lg text-white active:scale-95 transition-all touch-manipulation">
                ← Sélectionner un autre élève
            </button>
        </div>
    `;
    // Mettre à jour l'affichage
    const display = document.getElementById('natation-coups-display');
    if (display) display.textContent = initialCoups;
}

// ============================================================
// 4. FEEDBACK INDIVIDUEL (graphique d'évolution)
// ============================================================
function afficherFeedback(container) {
    const eleveId = getEleveIdFromNumero(currentNumero);
    const essais = historiqueEssais[eleveId] || [];
    // Trier par date
    essais.sort((a, b) => a.date - b.date);

    // Calcul du dernier indice et niveau
    let dernierIndice = null;
    let dernierNiveau = null;
    if (essais.length > 0) {
        const dernier = essais[essais.length - 1];
        dernierIndice = dernier.indice;
        dernierNiveau = getNiveau(dernierIndice);
    }

    // Générer les points pour le graphique
    let pointsHtml = '';
    if (essais.length > 0) {
        // Déterminer l'échelle : indice min et max
        const indices = essais.map(e => e.indice).filter(i => i !== null);
        const minIndice = Math.max(0, Math.min(...indices) - 0.5);
        const maxIndice = Math.max(5, Math.max(...indices) + 0.5);
        const range = maxIndice - minIndice;

        // Zones de couleurs (5 zones)
        const zones = [
            { min: 0, max: 2.0, color: 'red' },
            { min: 2.0, max: 2.5, color: 'orange' },
            { min: 2.5, max: 3.0, color: 'yellow' },
            { min: 3.0, max: 3.5, color: 'blue' },
            { min: 3.5, max: 5.0, color: 'gold' }
        ];

        // Construire les points
        let points = [];
        essais.forEach((e, idx) => {
            if (e.indice !== null) {
                const x = (idx / (essais.length - 1)) * 100; // 0 à 100%
                const y = 100 - ((e.indice - minIndice) / range) * 100; // inversion pour que le haut soit le meilleur
                points.push({ x, y, label: `#${idx+1}`, indice: e.indice });
            }
        });

        pointsHtml = `
            <div class="relative w-full h-64 bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden">
                <!-- Zones de couleur -->
                ${zones.map(zone => {
                    const yMin = 100 - ((zone.max - minIndice) / range) * 100;
                    const yMax = 100 - ((zone.min - minIndice) / range) * 100;
                    const height = yMax - yMin;
                    return `
                        <div class="absolute left-0 right-0 opacity-20" 
                             style="top: ${yMin}%; height: ${height}%; background-color: ${zone.color};">
                        </div>
                    `;
                }).join('')}
                
                <!-- Points -->
                <svg class="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <!-- Ligne reliant les points -->
                    <polyline points="${points.map(p => `${p.x},${p.y}`).join(' ')}" 
                              fill="none" stroke="#facc15" stroke-width="2" />
                    <!-- Points -->
                    ${points.map(p => `
                        <circle cx="${p.x}" cy="${p.y}" r="4" fill="#facc15" stroke="#fff" stroke-width="1.5" />
                        <text x="${p.x}" y="${p.y - 8}" font-size="4" fill="#fff" text-anchor="middle">${p.label}</text>
                    `).join('')}
                </svg>
                
                <!-- Légende des zones -->
                <div class="absolute bottom-2 left-2 right-2 flex justify-between text-[8px] text-slate-400">
                    <span>🔴</span>
                    <span>🟠</span>
                    <span>🟡</span>
                    <span>🔵</span>
                    <span>🟡</span>
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="bg-slate-800 p-6 rounded-3xl border border-slate-700 text-center max-w-lg mx-auto">
            <div class="flex items-center justify-center gap-6 mb-4">
                <span class="text-2xl font-black text-slate-400">N°</span>
                <span class="text-6xl font-black text-yellow-400">${currentNumero}</span>
            </div>
            
            ${dernierIndice !== null ? `
                <div class="mb-4">
                    <p class="text-sm text-slate-400">Dernier indice</p>
                    <p class="text-5xl font-black text-yellow-400">${dernierIndice.toFixed(2)}</p>
                    <span class="inline-block px-4 py-1 rounded-full text-sm font-bold text-white" 
                          style="background-color: ${dernierNiveau.couleur};">${dernierNiveau.label}</span>
                </div>
            ` : `
                <p class="text-slate-400 mb-4">Aucun essai enregistré.</p>
            `}

            ${essais.length > 1 ? `
                <div class="mb-4">
                    <p class="text-sm text-slate-400">Évolution des essais</p>
                    ${pointsHtml}
                </div>
            ` : `
                ${essais.length === 1 ? '<p class="text-sm text-slate-400">Un premier essai ! Continue comme ça ! 💪</p>' : ''}
            `}

            <div class="flex gap-4 justify-center mt-6">
                <button onclick="window.natationNouvelEssai()" 
                        class="bg-blue-600 hover:bg-blue-500 px-8 py-4 rounded-2xl font-black text-xl text-white active:scale-95 transition-all touch-manipulation">
                    🔄 Nouvel essai
                </button>
                <button onclick="window.natationRetourListe()" 
                        class="bg-slate-700 hover:bg-slate-600 px-8 py-4 rounded-2xl font-black text-xl text-white active:scale-95 transition-all touch-manipulation">
                    ← Changer d'élève
                </button>
            </div>
        </div>
    `;
}

// ============================================================
// BARÈME (couleurs et niveaux)
// ============================================================
function getNiveau(indice) {
    if (indice === null || indice === undefined || isNaN(indice)) {
        return { couleur: '#64748b', label: '--' };
    }
    // Seuils adaptés à la pratique
    if (indice >= 3.8) return { couleur: '#fbbf24', label: 'Excellent' }; // or
    if (indice >= 3.2) return { couleur: '#3b82f6', label: 'Très bien' }; // bleu
    if (indice >= 2.8) return { couleur: '#22c55e', label: 'Bien' }; // vert
    if (indice >= 2.4) return { couleur: '#f59e0b', label: 'Fragile' }; // orange
    return { couleur: '#ef4444', label: 'À besoins' }; // rouge
}

// ============================================================
// ACTIONS GLOBALES
// ============================================================
window.natationChoisirNumero = function(num) {
    console.log('🖱️ Clic sur le numéro', num);
    if (!num || num < 1 || num > nbEleves) {
        console.warn('Numéro invalide :', num);
        return;
    }
    currentNumero = num;
    tempsFinal = null;
    chronoElapsed = 0;
    chronoRunning = false;
    if (rafId) cancelAnimationFrame(rafId);
    mode = 'chrono';
    afficherInterface();
};

window.natationRetourListe = function() {
    console.log('⬅️ Retour à la liste des numéros');
    if (chronoRunning) {
        chronoRunning = false;
        if (rafId) cancelAnimationFrame(rafId);
    }
    chronoElapsed = 0;
    tempsFinal = null;
    mode = 'liste';
    afficherInterface();
};

window.natationNouvelEssai = function() {
    console.log('🔄 Nouvel essai pour', currentNumero);
    mode = 'chrono';
    tempsFinal = null;
    chronoElapsed = 0;
    afficherInterface();
};

window.natationDemarrer = function() {
    if (currentNumero === null) return;
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
    // Passer en mode feedback
    mode = 'feedback';
    afficherInterface();
};

window.natationAnnulerCoups = function() {
    mode = 'chrono';
    afficherInterface();
};

// ============================================================
// ENREGISTREMENT FIREBASE (temps + coups + historique)
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

    // Calculer l'indice
    const indice = calculIndice(tempsMs, nbCoups);

    // Mettre à jour les temps et coups actuels
    const tempsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/natation/temps/${eleveId}`);
    const coupsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/natation/coups/${eleveId}`);

    // Ajouter à l'historique
    const historiqueRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/natation/historique/${eleveId}`);
    const newEntry = {
        temps: tempsMs,
        coups: nbCoups,
        indice: indice,
        date: Date.now()
    };

    // Récupérer l'historique existant
    let historiqueExistant = historiqueEssais[eleveId] || [];
    historiqueExistant.push(newEntry);
    // Conserver les 10 derniers essais max
    if (historiqueExistant.length > 10) historiqueExistant = historiqueExistant.slice(-10);

    Promise.all([
        set(tempsRef, tempsMs),
        set(coupsRef, nbCoups),
        set(historiqueRef, historiqueExistant)
    ]).then(() => {
        console.log('✅ Temps et coups enregistrés pour', eleveId);
        // Mettre à jour la cache locale
        historiqueEssais[eleveId] = historiqueExistant;
        // Feedback visuel
        alert(`✅ Enregistré ! Indice = ${indice.toFixed(2)}`);
    }).catch(err => {
        console.error('Erreur enregistrement :', err);
        alert('Erreur lors de l\'enregistrement. Réessayez.');
    });
}

function calculIndice(tempsMs, nbCoups) {
    if (!tempsMs || tempsMs <= 0 || !nbCoups || nbCoups <= 0) return null;
    const tempsSec = tempsMs / 1000;
    const cycles = nbCoups / 2;
    if (cycles <= 0) return null;
    const vitesse = 25 / tempsSec;
    const distanceParCycle = 25 / cycles;
    return vitesse * distanceParCycle;
}

// ============================================================
// CHRONO (animation)
// ============================================================
function updateChrono() {
    if (!chronoRunning) return;
    chronoElapsed = performance.now() - chronoStart;
    const display = document.getElementById('natation-chrono-display');
    if (display) {
        display.textContent = formatTime(chronoElapsed);
    }
    rafId = requestAnimationFrame(updateChrono);
}

function formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const min = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const sec = String(totalSec % 60).padStart(2, '0');
    const dec = Math.floor((ms % 1000) / 100);
    return `${min}:${sec}.${dec}`;
}

// ============================================================
// RETOUR
// ============================================================
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