// src/js/modules/natation/natation-relais.js
// Gestion du relais : préparation, course en direct, résultats
// Ne modifie PAS les mesures (temps/coups/historique), il les lit seulement.

import { db, ref, onValue, set } from '../../core/firebase-service.js';
import { getPhotoUrl } from '../../services/admin-service.js';
import { getCurrentClasse } from '../../core/live-engine.js';

// ============================================================
// PARAMÈTRES PAR DÉFAUT
// ============================================================
const PAUSE_ARGENT_DEFAUT = 10; // secondes

// ============================================================
// ÉTAT GLOBAL DE LA COURSE (en mémoire, non persistant)
// ============================================================
let etatCourse = null;
// {
//   equipes: [{ eqId, nom, couleur, membres, tempsTheorique, handicap, startTimeAbsolu, finishTime }],
//   startGlobal: null,     // performance.now() au moment du GO
//   animationId: null,
//   termine: false,
//   classe: '',
//   pauseArgent: 10
// }

// ============================================================
// UTILITAIRES
// ============================================================
function getBasePath(classe) {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    return `etablissements/0680013V/profs/${profCode}/${classe}/natation/organisation`;
}

function formatSecondes(s) {
    if (s === null || s === undefined || isNaN(s)) return '--';
    const min = Math.floor(s / 60);
    const sec = s - min * 60;
    if (min > 0) {
        return `${min}'${sec.toFixed(1).padStart(4, '0')}`;
    }
    return `${sec.toFixed(1)}s`;
}

function formatChrono(s) {
    if (s < 60) {
        return s.toFixed(1) + 's';
    }
    const min = Math.floor(s / 60);
    const sec = s - min * 60;
    return `${min}'${sec.toFixed(1).padStart(4, '0')}`;
}

function chargerElevesTries(classe) {
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');
    eleves.sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));
    eleves.forEach((e, idx) => { e.numero = idx + 1; });
    return eleves;
}

// ============================================================
// MODALE PRINCIPALE
// ============================================================
export function openRelaisNatation() {
    const classe = getCurrentClasse();
    if (!classe) {
        alert('Sélectionnez une classe.');
        return;
    }

    // Si une course est déjà en cours, prévenir
    if (etatCourse && !etatCourse.termine) {
        if (!confirm('Une course est déjà en cours. La reprendre ?')) {
            // On la termine silencieusement
            arreterChrono();
            etatCourse = null;
        }
    }

    const existante = document.getElementById('natation-relais-modal');
    if (existante) existante.remove();

    const overlay = document.createElement('div');
    overlay.id = 'natation-relais-modal';
    overlay.className = 'fixed inset-0 bg-black/95 z-50 flex items-start justify-center p-4 overflow-y-auto';

    const modal = document.createElement('div');
    modal.className = 'bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-5xl my-8';
    modal.innerHTML = `
        <div class="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
            <div>
                <h2 class="text-2xl font-black text-blue-400 uppercase">🏁 Relais par équipes</h2>
                <p class="text-xs text-slate-400">Classe : ${classe}</p>
            </div>
            <button onclick="window.fermerRelaisNatation()"
                    class="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-xl font-black text-sm text-white transition-colors">
                ✖ Fermer
            </button>
        </div>
        <div id="relais-content" class="space-y-6">
            <p class="text-slate-400 text-center py-8">⏳ Chargement...</p>
        </div>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) window.fermerRelaisNatation();
    });

    window.fermerRelaisNatation = function() {
        if (etatCourse && !etatCourse.termine) {
            if (!confirm('Une course est en cours. La fermer et tout perdre ?')) return;
            arreterChrono();
            etatCourse = null;
        }
        const el = document.getElementById('natation-relais-modal');
        if (el) el.remove();
    };

    // Si une course est en mémoire, on l'affiche directement
    if (etatCourse && etatCourse.classe === classe) {
        if (etatCourse.termine) {
            afficherResultats();
        } else {
            afficherCourse();
        }
        return;
    }

    // Sinon on charge les données et on affiche la préparation
    chargerEtAfficherPreparation(classe);
}

// ============================================================
// CHARGEMENT DES DONNÉES + PRÉPARATION
// ============================================================
async function chargerEtAfficherPreparation(classe) {
    const container = document.getElementById('relais-content');
    if (!container) return;

    const basePath = getBasePath(classe);

    // Lire les équipes et la référence
    const equipesRef = ref(db, `${basePath}/equipes`);
    const referenceRef = ref(db, `${basePath}/reference`);

    const [equipes, reference] = await Promise.all([
        new Promise(res => onValue(equipesRef, s => res(s.val() || {}), { onlyOnce: true })),
        new Promise(res => onValue(referenceRef, s => res(s.val() || {}), { onlyOnce: true }))
    ]);

    if (Object.keys(equipes).length === 0) {
        container.innerHTML = `
            <div class="bg-amber-900/20 border-2 border-amber-500 p-6 rounded-2xl text-center">
                <p class="text-lg font-black text-amber-400 mb-2">Aucune équipe configurée</p>
                <p class="text-sm text-slate-300">Génère d'abord les équipes dans l'onglet "🎓 Organisation".</p>
            </div>
        `;
        return;
    }

    if (Object.keys(reference).length === 0) {
        container.innerHTML = `
            <div class="bg-amber-900/20 border-2 border-amber-500 p-6 rounded-2xl text-center">
                <p class="text-lg font-black text-amber-400 mb-2">Aucune référence figée</p>
                <p class="text-sm text-slate-300">Fige la référence dans l'onglet "🎓 Organisation".</p>
            </div>
        `;
        return;
    }

    const eleves = chargerElevesTries(classe);
    renderPreparation(container, classe, eleves, equipes, reference, basePath);
}

// ============================================================
// ÉCRAN 1 : PRÉPARATION
// ============================================================
function renderPreparation(container, classe, eleves, equipes, reference, basePath) {
    // Construire les équipes de course avec temps théorique
    const equipesList = Object.entries(equipes).sort(([a], [b]) => a.localeCompare(b));

    const equipesCourse = equipesList.map(([eqId, eq]) => {
        const membres = eq.membres.map(numero => {
            const eleve = eleves.find(e => e.numero === parseInt(numero));
            const refVal = reference[numero];
            const role = eq.roles?.[numero] || 'bronze';
            const temps25m = refVal?.tempsMs ? refVal.tempsMs / 1000 : null;
            return { numero, eleve, role, temps25m };
        }).filter(m => m.temps25m !== null);

        const membreOr = membres.find(m => m.role === 'or');
        const membreArgent = membres.find(m => m.role === 'argent');
        const membreBronze = membres.find(m => m.role === 'bronze');

        // Calcul des temps théoriques
        const tempsOr = membreOr ? membreOr.temps25m * 2 : 0;
        const tempsArgent = membreArgent ? membreArgent.temps25m * 2 + PAUSE_ARGENT_DEFAUT : 0;
        const tempsBronze = membreBronze ? membreBronze.temps25m : 0;

        const tempsTheorique = tempsOr + tempsArgent + tempsBronze;

        return {
            eqId,
            nom: eq.nom || eqId,
            couleur: eq.couleur || '#3b82f6',
            membres,
            membreOr,
            membreArgent,
            membreBronze,
            tempsOr,
            tempsArgent,
            tempsBronze,
            tempsTheorique,
            handicap: 0, // à calculer
            startTimeAbsolu: null,
            finishTime: null
        };
    });

    // Filtrer les équipes sans temps (aucun membre avec référence)
    const equipesValides = equipesCourse.filter(e => e.tempsTheorique > 0);

    if (equipesValides.length === 0) {
        container.innerHTML = `
            <div class="bg-amber-900/20 border-2 border-amber-500 p-6 rounded-2xl text-center">
                <p class="text-lg font-black text-amber-400 mb-2">Aucun temps disponible</p>
                <p class="text-sm text-slate-300">Aucun élève dans les équipes n'a de temps de référence.</p>
            </div>
        `;
        return;
    }

    // Calcul des handicaps : équipe la plus lente part à t=0
    const maxTheorique = Math.max(...equipesValides.map(e => e.tempsTheorique));
    equipesValides.forEach(e => {
        e.handicap = maxTheorique - e.tempsTheorique;
    });

    // Trier par handicap croissant (le plus lent en premier)
    const equipesTriees = [...equipesValides].sort((a, b) => a.handicap - b.handicap);

    // Afficher
    let html = `
        <div class="bg-slate-800 border-2 border-slate-700 p-5 rounded-2xl mb-4">
            <div class="flex justify-between items-center flex-wrap gap-2 mb-3">
                <h3 class="font-black text-blue-400 uppercase text-sm">🏁 Préparation du relais</h3>
                <div class="text-xs text-slate-400">
                    Pause Argent : <input type="number" id="relais-pause-argent" value="${PAUSE_ARGENT_DEFAUT}" min="0" max="30"
                        class="w-14 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-center font-black">
                    s
                </div>
            </div>
            <p class="text-xs text-slate-500 mb-3">
                Les temps théoriques sont calculés à partir des temps de référence 25m de chaque élève.
                L'équipe la plus lente part en premier.
            </p>
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="text-xs text-slate-400 uppercase border-b border-slate-700">
                            <th class="text-left p-2">Ordre</th>
                            <th class="text-left p-2">Équipe</th>
                            <th class="text-center p-2">🥇 Or</th>
                            <th class="text-center p-2">🥈 Argent</th>
                            <th class="text-center p-2">🥉 Bronze</th>
                            <th class="text-center p-2">Théorique</th>
                            <th class="text-center p-2">Handicap</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    equipesTriees.forEach((eq, idx) => {
        html += `
            <tr class="border-b border-slate-800">
                <td class="p-2">
                    <span class="font-black ${idx === 0 ? 'text-emerald-400' : 'text-slate-400'}">
                        ${idx === 0 ? '1er' : `${idx + 1}e`}
                    </span>
                </td>
                <td class="p-2">
                    <div class="flex items-center gap-2">
                        <div class="w-3 h-3 rounded-full" style="background:${eq.couleur}"></div>
                        <span class="font-black text-white">${eq.nom}</span>
                    </div>
                </td>
                <td class="p-2 text-center">
                    <div class="text-xs text-white font-bold">${eq.membreOr?.eleve?.prenom || '—'}</div>
                    <div class="text-[10px] text-slate-500">${eq.tempsOr > 0 ? formatChrono(eq.tempsOr) : '—'}</div>
                </td>
                <td class="p-2 text-center">
                    <div class="text-xs text-white font-bold">${eq.membreArgent?.eleve?.prenom || '—'}</div>
                    <div class="text-[10px] text-slate-500">${eq.tempsArgent > 0 ? formatChrono(eq.tempsArgent) : '—'}</div>
                </td>
                <td class="p-2 text-center">
                    <div class="text-xs text-white font-bold">${eq.membreBronze?.eleve?.prenom || '—'}</div>
                    <div class="text-[10px] text-slate-500">${eq.tempsBronze > 0 ? formatChrono(eq.tempsBronze) : '—'}</div>
                </td>
                <td class="p-2 text-center font-black text-yellow-400">${formatChrono(eq.tempsTheorique)}</td>
                <td class="p-2 text-center font-bold text-blue-400">
                    ${eq.handicap > 0 ? '+' + eq.handicap.toFixed(1) + 's' : '→ GO'}
                </td>
            </tr>
        `;
    });

    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Avertissement équipes incomplètes
    const equipesIncompletes = equipesValides.filter(e => e.membres.length < 3);
    if (equipesIncompletes.length > 0) {
        html += `
            <div class="bg-blue-900/20 border border-blue-500 p-3 rounded-xl mb-4">
                <p class="text-xs text-blue-300">
                    ℹ️ ${equipesIncompletes.length} équipe(s) ont moins de 3 membres.
                    Leur temps théorique est calculé sur les rôles disponibles.
                </p>
            </div>
        `;
    }

    html += `
        <button onclick="window.lancerCourseRelais()"
                class="w-full bg-emerald-600 hover:bg-emerald-500 py-5 rounded-2xl font-black text-white text-xl uppercase active:scale-95 transition-all">
            🏁 Lancer la course
        </button>
    `;

    container.innerHTML = html;

    // Stocker l'état de préparation pour le lancement
    window._relaisPreparation = {
        equipesTriees,
        pauseArgent: PAUSE_ARGENT_DEFAUT,
        classe
    };
}

// ============================================================
// LANCEMENT DE LA COURSE
// ============================================================
window.lancerCourseRelais = function() {
    const prep = window._relaisPreparation;
    if (!prep) return;

    // Lire la pause Argent depuis l'input
    const inputPause = document.getElementById('relais-pause-argent');
    const pauseArgent = parseInt(inputPause?.value) || PAUSE_ARGENT_DEFAUT;

    // Recalculer avec la pause actualisée
    const equipes = prep.equipesTriees.map(eq => {
        // Recalculer le temps Argent si la pause a changé
        const tempsArgent = eq.membreArgent ? eq.membreArgent.temps25m * 2 + pauseArgent : 0;
        const tempsTheorique = eq.tempsOr + tempsArgent + eq.tempsBronze;
        return {
            ...eq,
            tempsArgent,
            tempsTheorique
        };
    });

    // Recalcul des handicaps
    const maxTheorique = Math.max(...equipes.map(e => e.tempsTheorique));
    equipes.forEach(e => {
        e.handicap = maxTheorique - e.tempsTheorique;
    });

    // Trier par handicap
    equipes.sort((a, b) => a.handicap - b.handicap);

    // Initialiser l'état de course
    etatCourse = {
        equipes,
        startGlobal: null,
        animationId: null,
        termine: false,
        classe: prep.classe,
        pauseArgent
    };

    afficherCourse();
};

// ============================================================
// ÉCRAN 2 : COURSE EN DIRECT
// ============================================================
function afficherCourse() {
    const container = document.getElementById('relais-content');
    if (!container || !etatCourse) return;

    let html = `
        <div class="bg-slate-800 border-2 border-emerald-500 p-5 rounded-2xl mb-4">
            <div class="text-center mb-3">
                <p class="text-xs text-slate-400 uppercase">Temps global</p>
                <p id="relais-chrono-global" class="text-4xl font-mono font-black text-emerald-400">0:00.0</p>
            </div>
        </div>

        <div class="bg-slate-800 border-2 border-slate-700 p-5 rounded-2xl">
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="text-xs text-slate-400 uppercase border-b border-slate-700">
                            <th class="text-left p-2">Équipe</th>
                            <th class="text-center p-2">Théorique</th>
                            <th class="text-center p-2">Handicap</th>
                            <th class="text-center p-2">Chrono</th>
                            <th class="text-center p-2">Action</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    etatCourse.equipes.forEach(eq => {
        html += `
            <tr class="border-b border-slate-800" data-eq-id="${eq.eqId}">
                <td class="p-3">
                    <div class="flex items-center gap-2">
                        <div class="w-3 h-3 rounded-full" style="background:${eq.couleur}"></div>
                        <span class="font-black text-white">${eq.nom}</span>
                    </div>
                </td>
                <td class="p-3 text-center text-yellow-400 font-bold">${formatChrono(eq.tempsTheorique)}</td>
                <td class="p-3 text-center text-blue-400">
                    ${eq.handicap > 0 ? '+' + eq.handicap.toFixed(1) + 's' : '→ GO'}
                </td>
                <td class="p-3 text-center">
                    <span id="relais-eq-${eq.eqId}-chrono" class="text-lg font-mono text-slate-400">—</span>
                </td>
                <td class="p-3 text-center">
                    <button id="relais-eq-${eq.eqId}-btn"
                            onclick="window.arriveeEquipeRelais('${eq.eqId}')"
                            class="bg-red-600 hover:bg-red-500 px-4 py-2 rounded-xl font-black text-xs text-white active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                            disabled>
                        🏁 Arrivée
                    </button>
                </td>
            </tr>
        `;
    });

    html += `
                    </tbody>
                </table>
            </div>
        </div>

        <div class="flex gap-3">
            <button onclick="window.terminerCourseRelais()" id="relais-btn-terminer"
                    class="flex-1 bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-black text-white uppercase active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    disabled>
                ✅ Terminer la course (toutes les équipes arrivées)
            </button>
            <button onclick="window.abandonnerCourseRelais()"
                    class="bg-slate-700 hover:bg-slate-600 px-6 py-4 rounded-2xl font-black text-white text-sm uppercase active:scale-95">
                🛑 Abandonner
            </button>
        </div>
    `;

    container.innerHTML = html;

    // Lancer le GO dans 3 secondes
    let decompte = 3;
    const startDelay = setInterval(() => {
        const container2 = document.getElementById('relais-content');
        if (!container2) { clearInterval(startDelay); return; }
        if (decompte > 0) {
            const global = document.getElementById('relais-chrono-global');
            if (global) {
                global.textContent = `Départ dans ${decompte}...`;
                global.className = 'text-4xl font-mono font-black text-amber-400';
            }
            decompte--;
        } else {
            clearInterval(startDelay);
            demarrerChrono();
        }
    }, 1000);
}

function demarrerChrono() {
    if (!etatCourse) return;

    const now = performance.now();
    etatCourse.startGlobal = now;

    // Calculer les startTimeAbsolu pour chaque équipe
    etatCourse.equipes.forEach(eq => {
        eq.startTimeAbsolu = now + eq.handicap * 1000;
        eq.finishTime = null;
    });

    // Démarrer la boucle de mise à jour
    function loop() {
        if (!etatCourse || etatCourse.termine) return;
        updateChronos();
        etatCourse.animationId = requestAnimationFrame(loop);
    }
    etatCourse.animationId = requestAnimationFrame(loop);
}

function updateChronos() {
    if (!etatCourse) return;
    const now = performance.now();

    // Chrono global
    const globalElapsed = (now - etatCourse.startGlobal) / 1000;
    const globalEl = document.getElementById('relais-chrono-global');
    if (globalEl) {
        globalEl.textContent = formatChrono(globalElapsed);
        globalEl.className = 'text-4xl font-mono font-black text-emerald-400';
    }

    // Pour chaque équipe
    for (const eq of etatCourse.equipes) {
        const chronoEl = document.getElementById(`relais-eq-${eq.eqId}-chrono`);
        const btnEl = document.getElementById(`relais-eq-${eq.eqId}-btn`);
        if (!chronoEl) continue;

        if (eq.finishTime) {
            // Arrivée enregistrée
            const t = (eq.finishTime - eq.startTimeAbsolu) / 1000;
            chronoEl.textContent = formatChrono(t);
            chronoEl.className = 'text-lg font-mono font-black text-emerald-400';
            if (btnEl) btnEl.disabled = true;
        } else if (now < eq.startTimeAbsolu) {
            // Pas encore partie
            const attente = (eq.startTimeAbsolu - now) / 1000;
            chronoEl.textContent = `dans ${attente.toFixed(1)}s`;
            chronoEl.className = 'text-lg font-mono font-bold text-amber-400 animate-pulse';
            if (btnEl) btnEl.disabled = true;
        } else {
            // En cours
            const t = (now - eq.startTimeAbsolu) / 1000;
            chronoEl.textContent = formatChrono(t);
            // Rouge si dépassement du théorique
            if (t > eq.tempsTheorique) {
                chronoEl.className = 'text-lg font-mono font-black text-red-400';
            } else {
                chronoEl.className = 'text-lg font-mono font-black text-white';
            }
            if (btnEl) btnEl.disabled = false;
        }
    }
}

function arreterChrono() {
    if (etatCourse?.animationId) {
        cancelAnimationFrame(etatCourse.animationId);
        etatCourse.animationId = null;
    }
}

// ============================================================
// ARRIVÉE D'UNE ÉQUIPE
// ============================================================
window.arriveeEquipeRelais = function(eqId) {
    if (!etatCourse || etatCourse.termine) return;

    const eq = etatCourse.equipes.find(e => e.eqId === eqId);
    if (!eq) return;
    if (eq.finishTime) return; // déjà arrivée

    const now = performance.now();
    if (now < eq.startTimeAbsolu) return; // pas encore partie

    eq.finishTime = now;

    // Mettre à jour l'affichage
    updateChronos();

    // Vérifier si toutes sont arrivées
    const toutesArrivees = etatCourse.equipes.every(e => e.finishTime !== null);
    if (toutesArrivees) {
        const btnTerminer = document.getElementById('relais-btn-terminer');
        if (btnTerminer) btnTerminer.disabled = false;
    }
};

// ============================================================
// TERMINER LA COURSE
// ============================================================
window.terminerCourseRelais = function() {
    if (!etatCourse) return;

    arreterChrono();
    etatCourse.termine = true;
    afficherResultats();
};

window.abandonnerCourseRelais = function() {
    if (!etatCourse) return;
    if (!confirm('Abandonner la course en cours ?\nLes temps ne seront pas sauvegardés.')) return;

    arreterChrono();
    etatCourse = null;
    window._relaisPreparation = null;
    const modal = document.getElementById('natation-relais-modal');
    if (modal) modal.remove();
};

// ============================================================
// ÉCRAN 3 : RÉSULTATS
// ============================================================
function afficherResultats() {
    const container = document.getElementById('relais-content');
    if (!container || !etatCourse) return;

    // Calculer temps réel et écart pour chaque équipe
    const resultats = etatCourse.equipes.map(eq => {
        const tempsReel = eq.finishTime ? (eq.finishTime - eq.startTimeAbsolu) / 1000 : null;
        const ecart = tempsReel !== null ? eq.tempsTheorique - tempsReel : null;
        return {
            ...eq,
            tempsReel,
            ecart
        };
    });

    // Trier par ordre d'arrivée (tempsReel croissant)
    const resultatsTries = [...resultats]
        .filter(r => r.tempsReel !== null)
        .sort((a, b) => a.tempsReel - b.tempsReel);

    let html = `
        <div class="bg-slate-800 border-2 border-emerald-500 p-5 rounded-2xl mb-4">
            <h3 class="font-black text-emerald-400 uppercase text-sm mb-4">🏆 Résultats du relais</h3>
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="text-xs text-slate-400 uppercase border-b border-slate-700">
                            <th class="text-left p-2">Rang</th>
                            <th class="text-left p-2">Équipe</th>
                            <th class="text-center p-2">Théorique</th>
                            <th class="text-center p-2">Réel</th>
                            <th class="text-center p-2">Écart</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    resultatsTries.forEach((r, idx) => {
        const medaille = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : `${idx + 1}.`));
        const ecartStr = r.ecart !== null
            ? `${r.ecart > 0 ? '−' : '+'}${Math.abs(r.ecart).toFixed(1)}s`
            : '—';
        const ecartClass = r.ecart === null ? 'text-slate-500'
            : r.ecart > 0 ? 'text-emerald-400'
            : 'text-red-400';

        html += `
            <tr class="border-b border-slate-800">
                <td class="p-3 text-2xl">${medaille}</td>
                <td class="p-3">
                    <div class="flex items-center gap-2">
                        <div class="w-3 h-3 rounded-full" style="background:${r.couleur}"></div>
                        <span class="font-black text-white">${r.nom}</span>
                    </div>
                </td>
                <td class="p-3 text-center text-yellow-400 font-bold">${formatChrono(r.tempsTheorique)}</td>
                <td class="p-3 text-center text-white font-black text-lg">${formatChrono(r.tempsReel)}</td>
                <td class="p-3 text-center font-black ${ecartClass}">${ecartStr}</td>
            </tr>
        `;
    });

    html += `
                    </tbody>
                </table>
            </div>
        </div>

        <div class="flex gap-3 flex-wrap">
            <button onclick="window.sauvegarderCourseRelais()"
                    class="flex-1 bg-emerald-600 hover:bg-emerald-500 py-4 rounded-2xl font-black text-white uppercase active:scale-95 transition-all">
                💾 Enregistrer la séance
            </button>
            <button onclick="window.nouvelleCourseRelais()"
                    class="flex-1 bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-black text-white uppercase active:scale-95 transition-all">
                🔄 Nouvelle course
            </button>
        </div>
    `;

    container.innerHTML = html;
}

// ============================================================
// SAUVEGARDE DE LA SÉANCE
// ============================================================
window.sauvegarderCourseRelais = async function() {
    if (!etatCourse) return;

    const basePath = getBasePath(etatCourse.classe);
    const timestamp = Date.now();

    const seanceData = {
        date: timestamp,
        pauseArgent: etatCourse.pauseArgent,
        equipes: {}
    };

    etatCourse.equipes.forEach(eq => {
        const tempsReel = eq.finishTime ? (eq.finishTime - eq.startTimeAbsolu) / 1000 : null;
        seanceData.equipes[eq.eqId] = {
            nom: eq.nom,
            couleur: eq.couleur,
            tempsTheorique: Math.round(eq.tempsTheorique * 10) / 10,
            tempsReel: tempsReel !== null ? Math.round(tempsReel * 10) / 10 : null,
            ecart: tempsReel !== null ? Math.round((eq.tempsTheorique - tempsReel) * 10) / 10 : null,
            membres: eq.membres.map(m => ({
                numero: m.numero,
                role: m.role,
                temps25m: Math.round(m.temps25m * 10) / 10
            }))
        };
    });

    try {
        await set(ref(db, `${basePath}/courses/${timestamp}`), seanceData);
        alert('✅ Séance enregistrée !');
    } catch (err) {
        console.error(err);
        alert('❌ Erreur : ' + err.message);
    }
};

window.nouvelleCourseRelais = function() {
    if (!etatCourse) return;

    const classe = etatCourse.classe;
    arreterChrono();
    etatCourse = null;
    window._relaisPreparation = null;

    // Relancer la préparation
    chargerEtAfficherPreparation(classe);
};