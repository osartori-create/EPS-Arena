// src/js/modules/evaluation/evaluation-saut.js
// Saisie du saut en longueur (slider + champ manuel + photo + statut)

import { templateSliderSaut } from './evaluation-templates.js';
import { setResultat, getResultat, setStatutEleve } from './evaluation-stockage.js';
import { groupeForce, COULEURS_GROUPES } from './evaluation-utils.js';
import { getPhotoUrl } from '../../services/admin-service.js';

let currentEleve = null;
let currentData = null;
let currentTestId = 'force';
let essais = [];
let essaiCourant = 0;
let maxEssais = 3;
let zoneSaisie = null;
let valeurInitiale = 120;

// ============================================================
// FONCTIONS GLOBALES POUR LE SLIDER (définies UNE SEULE FOIS)
// ============================================================
if (!window.evalUpdateSlider) {
    window.evalUpdateSlider = function(value, min, max) {
        console.log('🔄 evalUpdateSlider appelée avec value=', value);
        // Mettre à jour le champ manuel
        const input = document.getElementById('eval-input-manuel');
        if (input) input.value = value;

        // Mettre à jour la barre du curseur
        const bar = document.getElementById('slider-bar');
        if (bar) {
            const pct = ((parseFloat(value) - min) / (max - min)) * 100;
            bar.style.left = Math.max(0, Math.min(100, pct)) + '%';
        }

        // Mettre à jour le score affiché
        const score = document.getElementById('slider-score');
        if (score) {
            score.innerHTML = `<span class="text-4xl font-black text-yellow-400">${value}</span><span class="text-sm text-white/70">cm</span>`;
        }
    };
}

// ============================================================
// INIT
// ============================================================
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

    // Valeur initiale du slider
    if (essaiCourant === 0) valeurInitiale = 120;
    else if (essaiCourant === 1) valeurInitiale = essais[0];
    else valeurInitiale = Math.max(...essais);

    if (essaiCourant >= maxEssais) {
        afficherTermine();
        setTimeout(() => { if (window.evalPasserSuivant) window.evalPasserSuivant(); }, 1500);
        return;
    }

    afficherSaisie();
}

// ============================================================
// AFFICHAGE
// ============================================================
function afficherSaisie() {
    const meilleur = essais.length > 0 ? Math.max(...essais) : null;

    const html = `
        <div class="space-y-4">
            <div class="text-center">
                <span class="text-sm text-slate-400">Meilleur performance</span>
                <span class="text-2xl font-black text-yellow-400 block">${meilleur !== null ? `${meilleur} cm` : '--'}</span>
            </div>
            <div id="eval-slider-container">
                ${templateSliderSaut(valeurInitiale, 0, 250, 'cm')}
            </div>
            <div class="text-center text-sm text-slate-400">
                Essai ${essaiCourant + 1} / ${maxEssais}
                ${essais.length > 0 ? `| Essais : ${essais.join(' - ')} cm` : ''}
            </div>
        </div>
    `;

    zoneSaisie.innerHTML = html;

    // Exposer les fonctions
    window.evalValiderEssai = validerEssai;
    window.evalEssaiSuivant = essaiSuivant;

    // Synchroniser le champ manuel
    const input = document.getElementById('eval-input-manuel');
    if (input) {
        input.addEventListener('input', function() {
            let val = parseFloat(this.value);
            if (isNaN(val)) val = 0;
            const slider = document.getElementById('eval-slider');
            if (slider) {
                if (val < 0) slider.value = 0;
                else if (val > 250) slider.value = 250;
                else slider.value = val;
            }
            // Mettre à jour le visuel
            if (window.evalUpdateSlider) {
                window.evalUpdateSlider(val, 0, 250);
            }
        });
    }

    // Forcer une première mise à jour du visuel
    setTimeout(() => {
        const slider = document.getElementById('eval-slider');
        if (slider && window.evalUpdateSlider) {
            window.evalUpdateSlider(slider.value, 0, 250);
        }
    }, 50);
}

// ============================================================
// VALIDATION
// ============================================================
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
        setTimeout(() => { if (window.evalPasserSuivant) window.evalPasserSuivant(); }, 800);
    } else {
        valeurInitiale = essais.length === 1 ? essais[0] : Math.max(...essais);
        afficherSaisie();
    }
}

function essaiSuivant() {
    alert('Veuillez d\'abord valider l\'essai en cours avec "✅ Valider l\'essai" ou ajuster la distance.');
}

function afficherTermine() {
    const meilleur = essais.length > 0 ? Math.max(...essais) : 0;
    const groupe = groupeForce(meilleur);
    const couleur = COULEURS_GROUPES[groupe] || '#64748b';
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