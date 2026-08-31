// src/js/modules/evaluation/evaluation-saut.js
// Saisie du saut en longueur (slider + champ manuel)

import { templateSliderSaut } from './evaluation-templates.js';
import { setResultat, getResultat } from './evaluation-stockage.js';
import { groupeForce } from './evaluation-utils.js';

let currentEleve = null;
let currentData = null;
let currentTestId = 'force';
let essais = [];
let essaiCourant = 0;
let maxEssais = 3;
let zoneSaisie = null;

export function initSaisieSaut(zone, eleve, data, testId) {
    zoneSaisie = zone;
    currentEleve = eleve;
    currentData = data;
    currentTestId = testId;
    
    // Charger les essais existants
    const resultat = getResultat(data, eleve.id, testId);
    if (resultat && resultat.essais) {
        essais = [...resultat.essais];
        essaiCourant = essais.length;
    } else {
        essais = [];
        essaiCourant = 0;
    }
    
    // Si déjà 3 essais, on affiche le meilleur
    if (essaiCourant >= maxEssais) {
        afficherTermine();
    } else {
        afficherSlider();
    }
}

function afficherSlider() {
    const valeurParDefaut = essais.length > 0 ? essais[essais.length - 1] : 120;
    zoneSaisie.innerHTML = templateSliderSaut(valeurParDefaut, 50, 400, 'cm');
    
    // Ajouter l'info des essais
    const info = document.createElement('div');
    info.className = 'text-center text-sm text-slate-400 mt-2';
    info.innerHTML = `Essai ${essaiCourant + 1} / ${maxEssais} | Meilleur : ${essais.length > 0 ? Math.max(...essais) : '--'} cm`;
    zoneSaisie.appendChild(info);
    
    // Écouteurs
    const slider = document.getElementById('eval-slider');
    const input = document.getElementById('eval-input-manuel');
    
    slider.addEventListener('input', () => {
        input.value = slider.value;
    });
    input.addEventListener('input', () => {
        let val = parseInt(input.value) || 50;
        if (val < 0) val = 0;
        if (val > 500) val = 500;
        slider.value = val;
    });
    
    window.evalValiderEssai = validerEssai;
    window.evalEssaiSuivant = essaiSuivant;
}

function validerEssai() {
    const input = document.getElementById('eval-input-manuel');
    const valeur = parseInt(input.value) || 0;
    
    if (valeur < 0 || valeur > 500) {
        alert('Valeur invalide (0-500 cm)');
        return;
    }
    
    essais.push(valeur);
    essaiCourant++;
    
    // Sauvegarder
    const meilleur = Math.max(...essais);
    const groupe = groupeForce(meilleur);
    setResultat(currentData, currentEleve.id, currentTestId, {
        essais: essais,
        meilleur: meilleur,
        groupe: groupe
    });
    
    if (essaiCourant >= maxEssais) {
        afficherTermine();
        // Passer automatiquement à l'élève suivant après un délai
        setTimeout(() => {
            if (window.evalPasserSuivant) window.evalPasserSuivant();
        }, 800);
    } else {
        afficherSlider();
    }
}

function essaiSuivant() {
    // Permet de passer à l'essai suivant sans valider (utile si erreur)
    if (essaiCourant < maxEssais) {
        // On ajoute un essai vide (0) pour ne pas bloquer
        essais.push(0);
        essaiCourant++;
        afficherSlider();
    }
}

function afficherTermine() {
    const meilleur = essais.length > 0 ? Math.max(...essais) : 0;
    const groupe = groupeForce(meilleur);
    const couleur = groupe === 'satisfaisant' ? 'text-emerald-400' : (groupe === 'fragile' ? 'text-amber-400' : 'text-red-400');
    
    zoneSaisie.innerHTML = `
        <div class="text-center py-8">
            <div class="text-6xl mb-4">🏆</div>
            <p class="text-2xl font-black text-white">Test terminé !</p>
            <p class="text-lg text-slate-400">Meilleur : <span class="text-3xl font-black text-yellow-400">${meilleur}</span> cm</p>
            <p class="text-lg ${couleur}">Groupe : ${groupe === 'satisfaisant' ? '✅ Satisfaisant' : (groupe === 'fragile' ? '⚠️ Fragile' : '🔴 À besoins')}</p>
            <div class="mt-4 text-sm text-slate-500">
                Essais : ${essais.join(' - ')} cm
            </div>
        </div>
    `;
}