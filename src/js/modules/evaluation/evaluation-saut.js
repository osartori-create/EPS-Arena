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
let valeurInitiale = 120; // valeur par défaut pour le 1er essai

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

    // Calculer la valeur initiale du slider
    if (essaiCourant === 0) {
        // 1er essai : milieu de la plage (120 cm)
        valeurInitiale = 120;
    } else if (essaiCourant === 1) {
        // 2e essai : valeur du 1er essai
        valeurInitiale = essais[0];
    } else {
        // 3e essai (ou plus) : meilleure valeur des essais précédents
        valeurInitiale = Math.max(...essais);
    }

    // Si déjà 3 essais, on affiche le résumé et on passe à l'élève suivant
    if (essaiCourant >= maxEssais) {
        afficherTermine();
        // Passer automatiquement après un court délai
        setTimeout(() => {
            if (window.evalPasserSuivant) window.evalPasserSuivant();
        }, 1500);
        return;
    }

    afficherSaisie();
}

function afficherSaisie() {
    // Construire le HTML avec photo, statut, etc.
    const photoPromise = getPhotoUrl(currentEleve.id);
    photoPromise.then(photoUrl => {
        const bgSexe = (currentEleve.sexe === 'M' || currentEleve.sexe === 'm') ? 'bg-blue-200 border-blue-400' :
                        (currentEleve.sexe === 'F' || currentEleve.sexe === 'f') ? 'bg-rose-200 border-rose-400' :
                        'bg-slate-200 border-slate-400';

        const photoHtml = photoUrl
            ? `<img src="${photoUrl}" class="w-16 h-16 rounded-full object-cover border-2 border-slate-500">`
            : `<div class="w-16 h-16 rounded-full bg-slate-400 flex items-center justify-center text-3xl">${currentEleve.prenom?.charAt(0) || '👤'}</div>`;

        // Statut actuel
        const statut = currentEleve.statut || 'present';
        const isAbsent = statut === 'absent';
        const isInapte = statut === 'inapte';

        const html = `
            <div class="space-y-4">
                <!-- En-tête élève -->
                <div class="flex items-center gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-700">
                    <div class="${bgSexe} p-1 rounded-full border-2 border-slate-600">
                        ${photoHtml}
                    </div>
                    <div class="flex-1">
                        <p class="text-xl font-black text-white">${currentEleve.prenom} ${currentEleve.nom}</p>
                        <p class="text-sm text-slate-400">Code : ${currentEleve.id}</p>
                        <div class="flex gap-2 mt-1">
                            <span class="text-xs font-bold ${isAbsent ? 'text-red-400' : 'text-slate-500'}">
                                ${isAbsent ? '🚫 Absent' : (isInapte ? '⚠️ Inapte' : '✅ Présent')}
                            </span>
                        </div>
                    </div>
                    <div class="flex flex-col gap-1">
                        <button onclick="window.evalSetStatutSaut('absent')" 
                                class="px-3 py-1 text-xs font-black rounded-lg ${isAbsent ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-300'}">
                            Absent
                        </button>
                        <button onclick="window.evalSetStatutSaut('inapte')" 
                                class="px-3 py-1 text-xs font-black rounded-lg ${isInapte ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300'}">
                            Inapte
                        </button>
                        ${(isAbsent || isInapte) ? `
                            <button onclick="window.evalSetStatutSaut('present')" 
                                    class="px-3 py-1 text-xs font-black rounded-lg bg-emerald-600 text-white">
                                Présent
                            </button>
                        ` : ''}
                    </div>
                </div>

                <!-- Slider -->
                <div id="eval-slider-container">
                    ${templateSliderSaut(valeurInitiale, 0, 500, 'cm', true)}
                </div>

                <!-- Infos essais -->
                <div class="text-center text-sm text-slate-400">
                    Essai ${essaiCourant + 1} / ${maxEssais} 
                    ${essais.length > 0 ? `| Meilleur : ${Math.max(...essais)} cm` : ''}
                </div>
            </div>
        `;

        zoneSaisie.innerHTML = html;

        // Exposer les fonctions
        window.evalValiderEssai = validerEssai;
        window.evalEssaiSuivant = essaiSuivant;
        window.evalSetStatutSaut = setStatutSaut;

        // Écouter les changements du slider et du champ manuel
        const slider = document.getElementById('eval-slider');
        const input = document.getElementById('eval-input-manuel');
        if (slider) {
            slider.addEventListener('input', () => {
                if (input) input.value = slider.value;
            });
        }
        if (input) {
            input.addEventListener('input', () => {
                let val = parseFloat(input.value);
                if (isNaN(val)) val = 0;
                if (slider) slider.value = val;
            });
        }
    }).catch(() => {
        // Fallback si la photo échoue
        afficherSaisieSansPhoto();
    });
}

function afficherSaisieSansPhoto() {
    // Version sans photo (fallback)
    const html = `
        <div class="space-y-4">
            <div class="flex items-center gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-700">
                <div class="w-16 h-16 rounded-full bg-slate-600 flex items-center justify-center text-3xl">👤</div>
                <div class="flex-1">
                    <p class="text-xl font-black text-white">${currentEleve.prenom} ${currentEleve.nom}</p>
                    <p class="text-sm text-slate-400">Code : ${currentEleve.id}</p>
                </div>
                <div class="flex flex-col gap-1">
                    <button onclick="window.evalSetStatutSaut('absent')" class="px-3 py-1 text-xs font-black rounded-lg bg-slate-700 text-slate-300">Absent</button>
                    <button onclick="window.evalSetStatutSaut('inapte')" class="px-3 py-1 text-xs font-black rounded-lg bg-slate-700 text-slate-300">Inapte</button>
                </div>
            </div>
            <div id="eval-slider-container">
                ${templateSliderSaut(valeurInitiale, 0, 500, 'cm', true)}
            </div>
            <div class="text-center text-sm text-slate-400">
                Essai ${essaiCourant + 1} / ${maxEssais}
                ${essais.length > 0 ? `| Meilleur : ${Math.max(...essais)} cm` : ''}
            </div>
        </div>
    `;
    zoneSaisie.innerHTML = html;
    window.evalValiderEssai = validerEssai;
    window.evalEssaiSuivant = essaiSuivant;
    window.evalSetStatutSaut = setStatutSaut;
}

function setStatutSaut(statut) {
    if (!currentData || !currentEleve) return;
    setStatutEleve(currentData, currentEleve.id, statut);
    // Recharger l'interface pour mettre à jour l'affichage
    afficherSaisie();
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
        // Recalculer la valeur initiale pour le prochain essai
        valeurInitiale = essais.length === 1 ? essais[0] : Math.max(...essais);
        afficherSaisie();
    }
}

function essaiSuivant() {
    // Permet de passer à l'essai suivant sans valider (utile en cas d'erreur)
    if (essaiCourant < maxEssais) {
        // Ajouter un essai vide (0) pour ne pas bloquer, mais ce n'est pas idéal
        // On préfère ne rien faire et laisser l'utilisateur valider
        alert('Veuillez d\'abord valider l\'essai en cours avec "✅ Valider l\'essai" ou ajuster la distance.');
    }
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