// src/js/modules/co/co-kiosk.js
// Kiosk élève pour la Course d'orientation classique
// Inspiré de CO‑Logic, adapté aux chemins Firebase EPS‑Arena

import { db, ref, onValue, push } from '../../core/firebase-service.js';

let currentClasse = '';
let currentCode = '';          // ex: "A1"
let config = {};
let circuits = [];
let valMode = 'step';
let activeCategory = '';
let startTime = null;
let endTime = null;
let sessions = {};             // Résultats déjà envoyés par l'élève

// État local
let selectedCircuitId = null;
let cartonDetails = [];        // [{ balise, userCode, status }]
let activePosteIdx = null;
let currentInput = '';

// Listener Firebase
let configListener = null;
let sessionsListener = null;
let startTimeListener = null;
let endTimeListener = null;
let activeCategoryListener = null;

// ============================================================
// INITIALISATION
// ============================================================
export function initCoKiosk(classe, code) {
    currentClasse = classe;
    currentCode = code;

    const container = document.getElementById('co-module');
    if (!container) {
        console.error('Conteneur co-module introuvable');
        return;
    }
    container.innerHTML = '';
    container.style.display = 'block';

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';

    // 1. Écouter la configuration
    const configRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/co/config`);
    configListener = onValue(configRef, (snap) => {
        const data = snap.val() || {};
        circuits = data.circuits ? Object.values(data.circuits) : [];
        valMode = data.valMode || 'step';
        activeCategory = data.activeCategory || '';
        config = data;
        chargerSessions();
        afficherInterface();
    });

    // 2. Écouter startTime / endTime
    const startRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/co/startTime`);
    startTimeListener = onValue(startRef, (snap) => {
        startTime = snap.val() || null;
        afficherInterface();
    });
    const endRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/co/endTime`);
    endTimeListener = onValue(endRef, (snap) => {
        endTime = snap.val() || null;
        afficherInterface();
    });

    // 3. Écouter la catégorie active sur le bon chemin
    const catRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/co/config/activeCategory`);
    activeCategoryListener = onValue(catRef, (snap) => {
        activeCategory = snap.val() || '';
        afficherInterface();
    });
}

// ============================================================
// CHARGEMENT DES SESSIONS (résultats déjà envoyés)
// ============================================================
function chargerSessions() {
    if (sessionsListener) {
        sessionsListener();
        sessionsListener = null;
    }
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const passagesRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/co/passages`);
    sessionsListener = onValue(passagesRef, (snap) => {
        const data = snap.val() || {};
        sessions = {};
        Object.keys(data).forEach(key => {
            const p = data[key];
            if (p.code === currentCode) {
                sessions[key] = p;
            }
        });
        // Si un circuit est sélectionné, mettre à jour l'affichage du carton
        if (selectedCircuitId) {
            afficherCarton();
        }
        // Mettre à jour le score global
        afficherScoreGlobal();
    });
}

// ============================================================
// AFFICHAGE DE L'INTERFACE PRINCIPALE
// ============================================================
function afficherInterface() {
    const container = document.getElementById('co-module');
    if (!container) return;
    container.innerHTML = '';

    // Vérifier la course
    const isActive = startTime && !endTime;
    const statusColor = !startTime ? 'text-slate-400' : (isActive ? 'text-emerald-400' : 'text-red-400');
    const statusText = !startTime ? '⏳ En attente du départ du professeur...' : (isActive ? '🏃 Course en cours !' : '⏱️ Course terminée.');

    // Sélecteur de circuit
    const circuitsFiltres = activeCategory ? circuits.filter(c => c.cat === activeCategory) : circuits;
    const circuitOptions = circuitsFiltres.map(c =>
        `<option value="${c.id}" ${c.id === selectedCircuitId ? 'selected' : ''}>${c.nom} (${c.cat})</option>`
    ).join('');

    let html = `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 mb-4">
            <div class="flex justify-between items-center">
                <div>
                    <div class="text-xs font-bold text-slate-400 uppercase">Équipe</div>
                    <div class="text-2xl font-black text-white">${currentCode}</div>
                </div>
                <div class="text-right">
                    <div class="text-xs font-bold text-slate-400 uppercase">Score</div>
                    <div id="scoreGlobal" class="text-3xl font-black text-yellow-400">0</div>
                </div>
            </div>
            <div class="mt-2 text-xs ${statusColor} font-bold">${statusText}</div>
        </div>

        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 mb-4">
            <label class="block text-xs font-bold text-slate-400 uppercase mb-2">Choisis ton circuit</label>
            <select id="selectCircuit" class="w-full bg-slate-900 border-2 border-slate-600 rounded-xl p-3 text-white font-bold text-lg outline-none focus:border-blue-500">
                <option value="">-- Sélectionne un circuit --</option>
                ${circuitOptions}
            </select>
            ${!activeCategory ? '<p class="text-xs text-amber-400 mt-2">⚠️ Aucune catégorie active. Attends que le professeur en choisisse une.</p>' : ''}
            ${circuitsFiltres.length === 0 && activeCategory ? '<p class="text-xs text-amber-400 mt-2">⚠️ Aucun circuit dans la catégorie active.</p>' : ''}
        </div>

        <div id="cartonContainer" class="bg-slate-800 p-4 rounded-2xl border border-slate-700 hidden">
            <div id="cartonGrid" class="grid grid-cols-2 gap-3 mb-4"></div>
            <div id="btnFinishContainer" class="hidden">
                <button id="btnFinish" class="w-full bg-blue-600 py-4 rounded-xl font-black text-white text-xl active:scale-95">✅ Valider le carton</button>
            </div>
        </div>
    `;

    container.innerHTML = html;

    // Attacher l'événement de changement de circuit
    const select = document.getElementById('selectCircuit');
    if (select) {
        // Supprimer les anciens écouteurs en clonant l'élément
        const newSelect = select.cloneNode(true);
        select.parentNode.replaceChild(newSelect, select);
        newSelect.addEventListener('change', (e) => {
            selectedCircuitId = e.target.value;
            if (selectedCircuitId) {
                afficherCarton();
            } else {
                document.getElementById('cartonContainer').classList.add('hidden');
            }
        });
    }

    // Si un circuit était déjà sélectionné, le rétablir
    if (selectedCircuitId) {
        const selectEl = document.getElementById('selectCircuit');
        if (selectEl) selectEl.value = selectedCircuitId;
        afficherCarton();
    }

    // Mettre à jour le score global
    afficherScoreGlobal();
}

// ============================================================
// AFFICHAGE DU CARTON (pour un circuit sélectionné)
// ============================================================
function afficherCarton() {
    const circuit = circuits.find(c => c.id === selectedCircuitId);
    if (!circuit) {
        console.warn('Circuit non trouvé :', selectedCircuitId);
        return;
    }

    console.log('Afficher carton pour circuit :', circuit.nom);

    // Récupérer les données déjà enregistrées pour ce circuit (si l'élève a déjà commencé)
    const existing = Object.values(sessions).find(s => s.circuitId === selectedCircuitId);
    if (existing && existing.details) {
        cartonDetails = existing.details.map(d => ({ ...d }));
        // On ne permet pas de modifier si le circuit est déjà complet
    } else {
        cartonDetails = circuit.balises.map(b => ({ balise: b, userCode: '', status: 'empty' }));
    }

    const container = document.getElementById('cartonContainer');
    container.classList.remove('hidden');

    const grid = document.getElementById('cartonGrid');
    grid.innerHTML = '';

    cartonDetails.forEach((det, idx) => {
        const isGhost = String(det.balise).includes('*');
        const displayBalise = isGhost ? 'VIDE' : det.balise;
        const div = document.createElement('div');
        div.className = 'bg-slate-900 p-3 rounded-xl border-2 border-slate-700';
        div.innerHTML = `
            <div class="text-xs font-bold text-slate-400 uppercase mb-1">Poste ${idx+1}</div>
            <div class="text-sm font-black text-blue-400">Balise ${displayBalise}</div>
            <div id="posteValue${idx}" class="mt-2 bg-black rounded-lg p-2 text-center text-2xl font-mono font-black text-white border-2 border-slate-600 cursor-pointer hover:border-blue-500 transition-colors" onclick="window.coOpenNumpad(${idx})">
                ${det.userCode || '---'}
            </div>
            <div id="posteStatus${idx}" class="mt-1 text-xs font-bold ${det.status === 'correct' ? 'text-emerald-400' : (det.status === 'wrong' ? 'text-red-400' : 'text-slate-500')}">
                ${det.status === 'correct' ? '✅ Correct' : (det.status === 'wrong' ? '❌ Erreur' : 'En attente')}
            </div>
        `;
        grid.appendChild(div);
    });

    // Afficher le bouton "Valider" si mode final et que le circuit n'est pas déjà terminé
    const btnContainer = document.getElementById('btnFinishContainer');
    if (valMode === 'final' && !existing) {
        btnContainer.classList.remove('hidden');
        const btn = document.getElementById('btnFinish');
        btn.onclick = () => soumettreCarton();
    } else {
        btnContainer.classList.add('hidden');
    }

    // Si mode step, on ne montre pas le bouton "Valider", la correction est immédiate.
}

// ============================================================
// PAVÉ NUMÉRIQUE (modale)
// ============================================================
window.coOpenNumpad = function(idx) {
    // Vérifier que le poste n'est pas déjà corrigé
    const det = cartonDetails[idx];
    if (det.status === 'correct' || det.status === 'wrong') {
        alert('Ce poste a déjà été corrigé.');
        return;
    }

    activePosteIdx = idx;
    currentInput = '';
    const overlay = document.createElement('div');
    overlay.id = 'coNumpadOverlay';
    overlay.className = 'fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4';
    overlay.innerHTML = `
        <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-md">
            <div class="text-center mb-4">
                <p class="text-sm font-bold text-slate-400">Saisie du code</p>
                <p class="text-xs text-slate-500">Poste ${idx+1} - Balise ${det.balise}</p>
                <div id="coNumpadDisplay" class="bg-black rounded-xl py-4 mt-2 text-4xl font-mono font-black text-white border-2 border-slate-600">---</div>
            </div>
            <div class="grid grid-cols-3 gap-3">
                ${[1,2,3,4,5,6,7,8,9].map(n => `<button class="bg-slate-800 py-4 rounded-xl text-2xl font-black text-white active:bg-blue-600 transition-colors" onclick="coNumpadType('${n}')">${n}</button>`).join('')}
                <button class="bg-red-800 py-4 rounded-xl text-sm font-black text-white active:bg-red-600 transition-colors" onclick="coNumpadDel()">EFF</button>
                <button class="bg-slate-800 py-4 rounded-xl text-2xl font-black text-white active:bg-blue-600 transition-colors" onclick="coNumpadType('0')">0</button>
                <button class="bg-blue-600 py-4 rounded-xl text-lg font-black text-white active:bg-blue-800 transition-colors" onclick="coNumpadOk()">OK</button>
            </div>
            <button class="w-full mt-4 py-3 text-sm font-black text-slate-400 border-2 border-slate-700 rounded-xl active:bg-slate-800 transition-colors" onclick="coNumpadClose()">Annuler</button>
        </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('coNumpadDisplay').innerText = '---';
};

window.coNumpadType = function(n) {
    if (currentInput.length < 5) currentInput += n;
    document.getElementById('coNumpadDisplay').innerText = currentInput || '---';
};

window.coNumpadDel = function() {
    currentInput = currentInput.slice(0, -1);
    document.getElementById('coNumpadDisplay').innerText = currentInput || '---';
};

window.coNumpadOk = function() {
    const idx = activePosteIdx;
    const userCode = currentInput;
    const det = cartonDetails[idx];
    det.userCode = userCode;

    // Correction immédiate si mode step
    if (valMode === 'step') {
        corrigerPoste(idx);
    }

    // Mettre à jour l'affichage
    const valueEl = document.getElementById(`posteValue${idx}`);
    if (valueEl) valueEl.innerText = userCode || '---';
    const statusEl = document.getElementById(`posteStatus${idx}`);
    if (statusEl) {
        if (det.status === 'correct') {
            statusEl.innerText = '✅ Correct';
            statusEl.className = 'mt-1 text-xs font-bold text-emerald-400';
        } else if (det.status === 'wrong') {
            statusEl.innerText = '❌ Erreur';
            statusEl.className = 'mt-1 text-xs font-bold text-red-400';
        } else {
            statusEl.innerText = 'En attente';
            statusEl.className = 'mt-1 text-xs font-bold text-slate-500';
        }
    }

    coNumpadClose();
};

window.coNumpadClose = function() {
    const overlay = document.getElementById('coNumpadOverlay');
    if (overlay) overlay.remove();
};

// ============================================================
// CORRECTION D'UN POSTE (mode step)
// ============================================================
function corrigerPoste(idx) {
    const det = cartonDetails[idx];
    const isGhost = String(det.balise).includes('*');
    const realBal = String(det.balise).replace('*', '');
    // Utilisation de la matrice globale (doit être importée)
    const MATRICE = window.MATRICE || {};
    const correctCode = isGhost ? '' : (MATRICE[realBal] ? MATRICE[realBal][currentCode] : null);

    if (det.userCode === correctCode) {
        det.status = 'correct';
    } else {
        det.status = 'wrong';
    }

    // Synchroniser immédiatement
    synchroniserPassage();
}

// ============================================================
// SOUMISSION DU CARTON (mode final)
// ============================================================
function soumettreCarton() {
    // Corriger toutes les balises
    const MATRICE = window.MATRICE || {};
    cartonDetails.forEach((det, idx) => {
        const isGhost = String(det.balise).includes('*');
        const realBal = String(det.balise).replace('*', '');
        const correctCode = isGhost ? '' : (MATRICE[realBal] ? MATRICE[realBal][currentCode] : null);
        if (det.userCode === correctCode) {
            det.status = 'correct';
        } else {
            det.status = 'wrong';
        }
        // Mettre à jour l'affichage
        const statusEl = document.getElementById(`posteStatus${idx}`);
        if (statusEl) {
            statusEl.innerText = det.status === 'correct' ? '✅ Correct' : '❌ Erreur';
            statusEl.className = `mt-1 text-xs font-bold ${det.status === 'correct' ? 'text-emerald-400' : 'text-red-400'}`;
        }
        const valueEl = document.getElementById(`posteValue${idx}`);
        if (valueEl) valueEl.innerText = det.userCode || '---';
    });

    // Désactiver le bouton "Valider"
    document.getElementById('btnFinishContainer').classList.add('hidden');

    // Synchroniser
    synchroniserPassage();

    // Afficher le score final
    const pts = cartonDetails.filter(d => d.status === 'correct').length;
    const total = cartonDetails.length;
    alert(`🏁 Score final : ${pts}/${total}`);
}

// ============================================================
// SYNCHRONISATION FIREBASE
// ============================================================
function synchroniserPassage() {
    const pts = cartonDetails.filter(d => d.status === 'correct').length;
    const total = cartonDetails.length;
    const timeElapsed = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;

    const data = {
        code: currentCode,
        circuitId: selectedCircuitId,
        pts: pts,
        total: total,
        details: cartonDetails.map(d => ({ balise: d.balise, userCode: d.userCode, status: d.status })),
        time: timeElapsed,
        timestamp: Date.now()
    };

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const passagesRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/co/passages`);
    push(passagesRef, data)
        .then(() => {
            afficherScoreGlobal();
        })
        .catch(err => {
            console.error('Erreur synchronisation :', err);
            alert('Erreur lors de l\'envoi. Réessayez.');
        });
}

// ============================================================
// AFFICHAGE DU SCORE GLOBAL
// ============================================================
function afficherScoreGlobal() {
    let totalPts = 0;
    Object.values(sessions).forEach(s => { totalPts += s.pts || 0; });
    const scoreEl = document.getElementById('scoreGlobal');
    if (scoreEl) scoreEl.innerText = totalPts;
}

// ============================================================
// NETTOYAGE
// ============================================================
export function cleanupCoKiosk() {
    if (configListener) configListener();
    if (sessionsListener) sessionsListener();
    if (startTimeListener) startTimeListener();
    if (endTimeListener) endTimeListener();
    if (activeCategoryListener) activeCategoryListener();
    const container = document.getElementById('co-module');
    if (container) container.innerHTML = '';
}