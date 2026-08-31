// src/js/modules/evaluation/evaluation-sprint.js
// Saisie du sprint 30m (chrono intégré)

import { templateChronoSprint } from './evaluation-templates.js';
import { setResultat, getResultat } from './evaluation-stockage.js';
import { groupeVitesse } from './evaluation-utils.js';

let currentEleve = null;
let currentData = null;
let currentTestId = 'vitesse';
let essais = [];
let maxEssais = 3;
let chronoRunning = false;
let startTime = 0;
let elapsedTime = 0;
let rafId = null;
let zoneSaisie = null;

export function initSaisieSprint(zone, eleve, data, testId) {
    zoneSaisie = zone;
    currentEleve = eleve;
    currentData = data;
    currentTestId = testId;
    
    // Charger les essais existants
    const resultat = getResultat(data, eleve.id, testId);
    if (resultat && resultat.essais) {
        essais = [...resultat.essais];
    } else {
        essais = [];
    }
    
    afficherChrono();
}

function afficherChrono() {
    const temps = essais.length > 0 ? essais[essais.length - 1] : null;
    zoneSaisie.innerHTML = templateChronoSprint(temps);
    
    const nbEssais = document.getElementById('eval-nb-essais');
    if (nbEssais) nbEssais.textContent = essais.length;
    
    if (essais.length >= maxEssais) {
        // Désactiver les boutons et afficher le meilleur
        document.querySelector('#eval-zone-saisie button').disabled = true;
        const meilleur = Math.min(...essais);
        const groupe = groupeVitesse(meilleur);
        const couleur = groupe === 'satisfaisant' ? 'text-emerald-400' : (groupe === 'fragile' ? 'text-amber-400' : 'text-red-400');
        
        zoneSaisie.innerHTML = `
            <div class="text-center py-8">
                <div class="text-6xl mb-4">🏆</div>
                <p class="text-2xl font-black text-white">Test terminé !</p>
                <p class="text-lg text-slate-400">Meilleur : <span class="text-3xl font-black text-yellow-400">${meilleur.toFixed(1)}</span> s</p>
                <p class="text-lg ${couleur}">Groupe : ${groupe === 'satisfaisant' ? '✅ Satisfaisant' : (groupe === 'fragile' ? '⚠️ Fragile' : '🔴 À besoins')}</p>
                <div class="mt-4 text-sm text-slate-500">
                    Essais : ${essais.map(e => e.toFixed(1)).join(' - ')} s
                </div>
            </div>
        `;
        
        // Passer automatiquement après délai
        setTimeout(() => {
            if (window.evalPasserSuivant) window.evalPasserSuivant();
        }, 1000);
        return;
    }
    
    window.evalDemarrerChrono = demarrerChrono;
    window.evalArreterChrono = arreterChrono;
}

function demarrerChrono() {
    if (chronoRunning) return;
    if (essais.length >= maxEssais) return;
    
    chronoRunning = true;
    startTime = performance.now() - elapsedTime;
    rafId = requestAnimationFrame(updateChrono);
    
    // Mettre à jour le bouton
    const btnStart = document.querySelector('#eval-zone-saisie button:first-child');
    if (btnStart) {
        btnStart.textContent = '⏳ En cours...';
        btnStart.className = 'bg-yellow-600 px-8 py-4 rounded-xl font-black text-white text-xl active:scale-95';
        btnStart.disabled = true;
    }
}

function arreterChrono() {
    if (!chronoRunning) return;
    if (essais.length >= maxEssais) return;
    
    chronoRunning = false;
    if (rafId) cancelAnimationFrame(rafId);
    
    const temps = elapsedTime / 1000;
    essais.push(temps);
    
    // Sauvegarder
    const meilleur = Math.min(...essais);
    const groupe = groupeVitesse(meilleur);
    setResultat(currentData, currentEleve.id, currentTestId, {
        essais: essais,
        meilleur: meilleur,
        groupe: groupe
    });
    
    elapsedTime = 0;
    afficherChrono();
}

function updateChrono() {
    if (!chronoRunning) return;
    elapsedTime = performance.now() - startTime;
    const display = document.querySelector('#eval-zone-saisie .text-8xl');
    if (display) {
        display.textContent = (elapsedTime / 1000).toFixed(1);
    }
    rafId = requestAnimationFrame(updateChrono);
}