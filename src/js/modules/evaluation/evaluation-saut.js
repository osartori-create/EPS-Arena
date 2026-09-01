// src/js/modules/evaluation/evaluation-saut.js
// Saisie du saut en longueur

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
let valeurInitiale = 120;

export function initSaisieSaut(zone, eleve, data, testId) {
    zoneSaisie = zone;
    currentEleve = eleve;
    currentData = data;
    currentTestId = testId;

    const resultat = getResultat(data, eleve.id, testId);
    if (resultat && resultat.essais) {
        essais = [...resultat.essais];
        essaiCourant = essais.length;
    } else {
        essais = [];
        essaiCourant = 0;
    }

    // Déterminer la valeur initiale du slider
    if (essaiCourant === 0) {
        valeurInitiale = 120;
    } else if (essaiCourant === 1) {
        valeurInitiale = essais[0];
    } else {
        valeurInitiale = Math.max(...essais);
    }

    if (essaiCourant >= maxEssais) {
        afficherTermine();
        setTimeout(() => {
            if (window.evalPasserSuivant) window.evalPasserSuivant();
        }, 1500);
        return;
    }

    afficherSaisie();
}

function afficherSaisie() {
    const meilleur = essais.length > 0 ? Math.max(...essais) : null;

    const html = `
        <div class="space-y-4">
            <!-- Meilleur performance -->
            <div class="text-center">
                <span class="text-sm text-slate-400">Meilleur performance</span>
                <span class="text-2xl font-black text-yellow-400 block">${meilleur !== null ? `${meilleur} cm` : '--'}</span>
            </div>

            <!-- Toise -->
            <div id="eval-slider-container">
                ${templateSliderSaut(valeurInitiale, 0, 250, 'cm')}
            </div>

            <!-- Infos essais -->
            <div class="text-center text-sm text-slate-400">
                Essai ${essaiCourant + 1} / ${maxEssais}
                ${essais.length > 0 ? `| Essais : ${essais.join(' - ')} cm` : ''}
            </div>
        </div>
    `;

    zoneSaisie.innerHTML = html;

    window.evalValiderEssai = validerEssai;
    window.evalEssaiSuivant = essaiSuivant;

    const slider = document.getElementById('eval-slider');
    const input = document.getElementById('eval-input-manuel');

    if (slider) {
        slider.addEventListener('input', () => {
            if (input) input.value = slider.value;
            // Mettre à jour l'affichage du score en jaune (dans la toise)
            const scoreEl = document.querySelector('#eval-slider-container .text-4xl.font-black.text-yellow-400');
            if (scoreEl) scoreEl.textContent = slider.value;
        });
    }

    if (input) {
        input.addEventListener('input', () => {
            let val = parseFloat(input.value);
            if (isNaN(val)) val = 0;
            if (slider) {
                if (val < 0) slider.value = 0;
                else if (val > 250) slider.value = 250;
                else slider.value = val;
            }
            // Mettre à jour l'affichage du score en jaune
            const scoreEl = document.querySelector('#eval-slider-container .text-4xl.font-black.text-yellow-400');
            if (scoreEl) scoreEl.textContent = val;
        });
    }
}

function validerEssai() {
    const input = document.getElementById('eval-input-manuel');
    if (!input) return;
    const valeur = parseFloat(input.value);
    if (isNaN(valeur) || valeur < 0) {
        alert('Veuillez saisir une distance valide (≥ 0 cm).');
        return;
    }

    essais.push(valeur);
    essaiCourant++;

    const meilleur = Math.max(...essais);
    const groupe = groupeForce(meilleur);

    setResultat(currentData, currentEleve.id, currentTestId, {
        essais: essais,
        meilleur: meilleur,
        groupe: groupe
    });

    if (essaiCourant >= maxEssais) {
        afficherTermine();
        setTimeout(() => {
            if (window.evalPasserSuivant) window.evalPasserSuivant();
        }, 800);
    } else {
        valeurInitiale = essais.length === 1 ? essais[0] : Math.max(...essais);
        afficherSaisie();
    }
}

function essaiSuivant() {
    alert('Veuillez d\'abord valider l\'essai en cours avec "✅ Valider l\'essai".');
}

function afficherTermine() {
    const meilleur = essais.length > 0 ? Math.max(...essais) : 0;
    const groupe = groupeForce(meilleur);
    const couleur = groupe === 'satisfaisant' ? '#22c55e' : (groupe === 'fragile' ? '#f59e0b' : '#ef4444');
    const libelleGroupe = groupe === 'satisfaisant' ? '✅ Satisfaisant' :
                          groupe === 'fragile' ? '⚠️ Fragile' :
                          '🔴 À besoins';

    zoneSaisie.innerHTML = `
        <div class="text-center py-6 bg-slate-900 rounded-2xl border border-slate-700">
            <div class="text-5xl mb-4">🏆</div>
            <p class="text-2xl font-black text-white">Test terminé !</p>
            <p class="text-lg text-slate-400">Meilleur : <span class="text-3xl font-black text-yellow-400">${meilleur}</span> cm</p>
            <p class="text-lg" style="color:${couleur}">${libelleGroupe}</p>
            <div class="mt-4 text-sm text-slate-500">
                Essais : ${essais.join(' - ')} cm
            </div>
        </div>
    `;
}