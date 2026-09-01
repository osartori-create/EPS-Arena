// src/js/modules/evaluation/evaluation-sprint.js
// Saisie du Sprint 30m (chrono intégré, 3 essais max)

import { setResultat, getResultat, setStatutEleve } from './evaluation-stockage.js';
import { groupeVitesse, COULEURS_GROUPES } from './evaluation-utils.js';
import { getPhotoUrl } from '../../services/admin-service.js';

let currentEleve = null;
let currentData = null;
let currentTestId = 'vitesse';
let zoneSaisie = null;
let chronoRunning = false;
let chronoStart = 0;
let chronoElapsed = 0;
let rafId = null;
let essais = [];
let maxEssais = 3;
let eleveEnCoursId = null;
let intervalId = null;

// ============================================================
// INITIALISATION
// ============================================================

export function initSaisieSprint(zone, eleve, data, testId) {
    zoneSaisie = zone;
    currentEleve = eleve;
    currentData = data;
    currentTestId = testId;
    eleveEnCoursId = eleve.id;

    // Charger les essais existants
    const resultat = getResultat(data, eleve.id, testId);
    if (resultat && resultat.essais) {
        essais = [...resultat.essais];
    } else {
        essais = [];
    }

    // Si déjà 3 essais, afficher terminé
    if (essais.length >= maxEssais) {
        afficherTermine();
        setTimeout(() => {
            if (window.evalPasserSuivant) window.evalPasserSuivant();
        }, 1500);
        return;
    }

    afficherSaisie();
}

// ============================================================
// AFFICHAGE
// ============================================================

function afficherSaisie() {
    // Récupérer la meilleure performance
    const meilleur = essais.length > 0 ? Math.min(...essais) : null;
    const nbEssais = essais.length;
    const dernierEssai = nbEssais > 0 ? essais[nbEssais - 1] : null;

    const html = `
        <div class="space-y-4">
            <!-- Meilleur performance -->
            <div class="text-center">
                <span class="text-sm text-slate-400">Meilleur performance</span>
                <span class="text-2xl font-black text-yellow-400 block">
                    ${meilleur !== null ? `${meilleur.toFixed(1)} s` : '--'}
                </span>
            </div>

            <!-- Chrono -->
            <div class="text-center py-4">
                <div id="sprint-chrono-display" class="text-8xl font-black tabular-nums text-yellow-400">
                    ${dernierEssai !== null ? dernierEssai.toFixed(1) : '0.0'}
                </div>
                <p class="text-sm text-slate-400 mt-1">secondes</p>
                <div class="mt-2 text-xs text-slate-500">
                    Essai ${nbEssais + 1} / ${maxEssais}
                    ${essais.length > 0 ? `| Essais : ${essais.map(e => e.toFixed(1)).join(' - ')}` : ''}
                </div>
            </div>

            <!-- Zone cliquable pour la fiche -->
            <div id="sprint-click-zone" class="bg-slate-900 p-6 rounded-2xl border-2 border-dashed border-slate-600 cursor-pointer hover:border-blue-500 transition-all text-center">
                <p class="text-lg font-bold text-slate-400">
                    ${chronoRunning ? '⏱️ Cliquez pour arrêter' : '👆 Cliquez pour démarrer le chrono'}
                </p>
                <p class="text-xs text-slate-500 mt-2">(cliquez sur l'élève pour démarrer/arrêter)</p>
            </div>

            <!-- Info essais -->
            <div class="flex justify-center gap-4 text-xs">
                ${essais.map((t, i) => `
                    <span class="px-3 py-1 rounded-full ${i === essais.length - 1 ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}">
                        Essai ${i+1}: ${t.toFixed(1)}s
                    </span>
                `).join('')}
                ${Array.from({ length: maxEssais - essais.length }, (_, i) => `
                    <span class="px-3 py-1 rounded-full bg-slate-800 text-slate-500">
                        Essai ${essais.length + i + 1}: --
                    </span>
                `).join('')}
            </div>

            <!-- Boutons d'actions -->
            <div class="flex gap-3">
                <button onclick="window.evalResetChronoSprint()" class="flex-1 bg-slate-700 py-3 rounded-xl font-black text-white text-sm active:scale-95">
                    🔄 Réinitialiser
                </button>
            </div>
        </div>
    `;

    zoneSaisie.innerHTML = html;

    // Exposer les fonctions globales
    window.evalDemarrerChronoSprint = demarrerChronoSprint;
    window.evalArreterChronoSprint = arreterChronoSprint;
    window.evalResetChronoSprint = resetChronoSprint;

    // Gérer le clic sur la zone
    const clickZone = document.getElementById('sprint-click-zone');
    if (clickZone) {
        clickZone.addEventListener('click', () => {
            if (chronoRunning) {
                arreterChronoSprint();
            } else {
                demarrerChronoSprint();
            }
        });
    }

    // Mettre à jour le statut des boutons Absent/Inapte via l'en-tête (déjà fait)
}

// ============================================================
// CHRONO
// ============================================================

function demarrerChronoSprint() {
    if (chronoRunning) return;
    if (essais.length >= maxEssais) {
        alert('⚠️ Déjà 3 essais pour cet élève.');
        return;
    }

    chronoRunning = true;
    chronoStart = performance.now() - chronoElapsed;
    rafId = requestAnimationFrame(updateChronoSprint);

    // Mettre à jour l'interface
    const clickZone = document.getElementById('sprint-click-zone');
    if (clickZone) {
        clickZone.innerHTML = '<p class="text-lg font-bold text-emerald-400">⏱️ Cliquez pour arrêter</p>';
        clickZone.className = 'bg-slate-900 p-6 rounded-2xl border-2 border-emerald-500 cursor-pointer hover:border-emerald-400 transition-all text-center';
    }
}

function arreterChronoSprint() {
    if (!chronoRunning) return;
    if (essais.length >= maxEssais) return;

    chronoRunning = false;
    if (rafId) cancelAnimationFrame(rafId);
    const temps = chronoElapsed / 1000;

    // Enregistrer l'essai
    essais.push(temps);
    const meilleur = Math.min(...essais);
    const groupe = groupeVitesse(meilleur);

    // Sauvegarder
    setResultat(currentData, currentEleve.id, currentTestId, {
        essais: essais,
        meilleur: meilleur,
        groupe: groupe
    });

    // Réinitialiser le chrono pour le prochain essai
    chronoElapsed = 0;

    // Vérifier si on a atteint 3 essais
    if (essais.length >= maxEssais) {
        afficherTermine();
        setTimeout(() => {
            if (window.evalPasserSuivant) window.evalPasserSuivant();
        }, 1500);
    } else {
        // Recharger l'affichage
        afficherSaisie();
    }
}

function updateChronoSprint() {
    if (!chronoRunning) return;
    chronoElapsed = performance.now() - chronoStart;
    const display = document.getElementById('sprint-chrono-display');
    if (display) {
        display.textContent = (chronoElapsed / 1000).toFixed(1);
    }
    rafId = requestAnimationFrame(updateChronoSprint);
}

function resetChronoSprint() {
    if (chronoRunning) {
        chronoRunning = false;
        if (rafId) cancelAnimationFrame(rafId);
    }
    chronoElapsed = 0;
    const display = document.getElementById('sprint-chrono-display');
    if (display) {
        display.textContent = '0.0';
    }
    const clickZone = document.getElementById('sprint-click-zone');
    if (clickZone) {
        clickZone.innerHTML = '<p class="text-lg font-bold text-slate-400">👆 Cliquez pour démarrer le chrono</p>';
        clickZone.className = 'bg-slate-900 p-6 rounded-2xl border-2 border-dashed border-slate-600 cursor-pointer hover:border-blue-500 transition-all text-center';
    }
}

// ============================================================
// FIN DU TEST (3 essais effectués)
// ============================================================

function afficherTermine() {
    const meilleur = essais.length > 0 ? Math.min(...essais) : 0;
    const groupe = groupeVitesse(meilleur);
    const couleur = COULEURS_GROUPES[groupe] || '#64748b';
    const libelleGroupe = groupe === 'satisfaisant' ? '✅ Satisfaisant' :
                          groupe === 'fragile' ? '⚠️ Fragile' :
                          '🔴 À besoins';

    const html = `
        <div class="text-center py-6 bg-slate-900 rounded-2xl border border-slate-700">
            <div class="text-5xl mb-4">🏆</div>
            <p class="text-2xl font-black text-white">Test terminé !</p>
            <p class="text-lg text-slate-400">Meilleur : <span class="text-3xl font-black text-yellow-400">${meilleur.toFixed(1)}</span> s</p>
            <p class="text-lg" style="color:${couleur}">${libelleGroupe}</p>
            <div class="mt-4 text-sm text-slate-500">
                Essais : ${essais.map(e => e.toFixed(1)).join(' - ')} s
            </div>
        </div>
    `;

    zoneSaisie.innerHTML = html;
}

// ============================================================
// EXPOSITION DES FONCTIONS GLOBALES
// ============================================================

window.evalDemarrerChronoSprint = demarrerChronoSprint;
window.evalArreterChronoSprint = arreterChronoSprint;
window.evalResetChronoSprint = resetChronoSprint;