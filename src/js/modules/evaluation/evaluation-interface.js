// src/js/modules/evaluation/evaluation-interface.js
// Interface principale du module d'évaluation

import {
    loadOrCreateData, getElevesActifs,
    genererDonneesFactices, reinitialiserDonnees
} from './evaluation-stockage.js';
import { templateVuePrincipale, templatePassation } from './evaluation-templates.js';
import { LIBELLES_TESTS, exporterVersIDoceo } from './evaluation-utils.js';
import { initSaisieSaut } from './evaluation-saut.js';
import { initSaisieSprint } from './evaluation-sprint.js';
import { initSaisieVMA } from './evaluation-vma.js';
import { initSaisieStandard } from './evaluation-saisie.js';
import { afficherResultats } from './evaluation-resultats.js';

let currentData = null;
let currentClasse = '';
let currentTestId = '';
let currentEleves = [];
let currentIndex = 0;
let currentMode = 'menu'; // 'menu' | 'passation'
let selectListenerAttached = false;

/**
 * Point d'entrée du module
 */
export function initEvaluationInterface() {
    console.log('📊 Initialisation du module Évaluation');

    const container = document.getElementById('viewEvaluationSettings');
    if (!container) {
        console.error('Conteneur viewEvaluationSettings introuvable');
        return;
    }

    const select = document.getElementById('selectClasse');
    if (!select) {
        container.innerHTML = '<p class="text-slate-500 text-center py-10">Sélecteur de classe introuvable.</p>';
        return;
    }

    function chargerDonneesClasse() {
        const classe = select.value;
        if (!classe) {
            container.innerHTML = '<p class="text-slate-500 text-center py-10">Veuillez sélectionner une classe.</p>';
            return;
        }

        currentClasse = classe;
        const elevesData = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');
        currentData = loadOrCreateData(classe, elevesData);
        currentData.classe = classe;

        if (currentMode === 'passation') {
            currentMode = 'menu';
        }
        afficherMenu();
    }

    if (!selectListenerAttached) {
        select.addEventListener('change', chargerDonneesClasse);
        selectListenerAttached = true;
    }

    chargerDonneesClasse();
}

/**
 * Affiche le menu principal
 */
function afficherMenu() {
    const container = document.getElementById('viewEvaluationSettings');
    if (!container || !currentData) return;

    currentMode = 'menu';
    container.innerHTML = templateVuePrincipale(currentData, currentClasse);

    // Exposer les fonctions globales
    window.evalLancerTest = lancerTest;
    window.evalVoirResultats = voirResultats;
    window.evalGenererFactices = genererFactices;
    window.evalReinitialiser = reinitialiser;
    window.evalExporterCSV = exporterCSV;
    window.evalRetourMenu = retourMenu;
}

/**
 * Lance un test
 */
function lancerTest(testId) {
    if (!currentData) {
        alert('Veuillez sélectionner une classe.');
        return;
    }

    currentTestId = testId;
    const eleves = getElevesActifs(currentData);
    currentEleves = eleves.sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));
    currentIndex = 0;

    const indexSansResultat = currentEleves.findIndex(e => e.resultats[testId] === null);
    if (indexSansResultat !== -1) {
        currentIndex = indexSansResultat;
    }

    currentMode = 'passation';
    afficherPassation();
}

/**
 * Affiche la vue de passation
 */
function afficherPassation() {
    const container = document.getElementById('viewEvaluationSettings');
    if (!container || !currentData) return;

    const eleveEnCours = currentEleves[currentIndex] || null;
    const eleveSuivant = currentEleves[currentIndex + 1] || null;

    const mode = (currentTestId === 'endurance') ? 'collectif' : 'individuel';

    container.innerHTML = templatePassation(
        currentTestId,
        eleveEnCours,
        eleveSuivant,
        currentEleves,
        currentData,
        mode
    );

    const zoneSaisie = document.getElementById('eval-zone-saisie');
    if (zoneSaisie && eleveEnCours) {
        const testId = currentTestId;
        const eleve = eleveEnCours;
        const data = currentData;

        switch (testId) {
            case 'force':
                initSaisieSaut(zoneSaisie, eleve, data, testId);
                break;
            case 'vitesse':
                initSaisieSprint(zoneSaisie, eleve, data, testId);
                break;
            case 'endurance':
                initSaisieVMA(zoneSaisie, eleve, data, testId, currentEleves);
                break;
            default:
                initSaisieStandard(zoneSaisie, eleve, data, testId);
                break;
        }
    }

    // Exposer les fonctions de navigation
    window.evalRetourMenu = retourMenu;
    window.evalPasserSuivant = passerSuivant;
    window.evalTerminerTest = terminerTest;
}

/**
 * Passe à l'élève suivant
 */
function passerSuivant() {
    if (currentIndex < currentEleves.length - 1) {
        currentIndex++;
        afficherPassation();
    } else {
        terminerTest();
    }
}

/**
 * Termine le test et retourne au menu
 */
function terminerTest() {
    currentMode = 'menu';
    afficherMenu();
}

/**
 * Retourne au menu
 */
function retourMenu() {
    if (currentMode === 'passation') {
        if (confirm('Quitter la passation en cours ? Les données seront sauvegardées.')) {
            currentMode = 'menu';
            afficherMenu();
        }
    } else {
        afficherMenu();
    }
}

/**
 * Affiche la vue des résultats (tableau de bord)
 */
function voirResultats() {
    if (!currentData) {
        alert('Veuillez sélectionner une classe.');
        return;
    }
    afficherResultats(currentData);
}

/**
 * Génère des données factices
 */
function genererFactices() {
    if (!currentData) {
        alert('Veuillez sélectionner une classe.');
        return;
    }
    if (confirm('Générer des données factices pour tous les tests ?')) {
        currentData = genererDonneesFactices(currentData);
        afficherMenu();
        alert('✅ Données factices générées !');
    }
}

/**
 * Réinitialise toutes les données
 */
function reinitialiser() {
    if (!currentClasse) return;
    if (confirm('⚠️ Supprimer toutes les données d\'évaluation pour cette classe ?')) {
        reinitialiserDonnees(currentClasse);
        const elevesData = JSON.parse(localStorage.getItem(`eps_arena_eleves_${currentClasse}`) || '[]');
        currentData = loadOrCreateData(currentClasse, elevesData);
        currentData.classe = currentClasse;
        afficherMenu();
        alert('✅ Données réinitialisées.');
    }
}

/**
 * Exporte les données en CSV
 */
function exporterCSV() {
    if (!currentData) {
        alert('Aucune donnée à exporter.');
        return;
    }
    exporterVersIDoceo(currentData, currentClasse);
}
export function templateVuePrincipale(data, classe) {
    const stats = calculerStatistiques(data);
    
    return `
        <div class="space-y-6">
            <!-- En-tête -->
            <div class="flex justify-between items-center bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <div>
                    <h2 class="text-xl font-black text-blue-400">📊 Évaluation des aptitudes physiques</h2>
                    <p class="text-xs text-slate-400">Classe : ${classe} | ${Object.keys(data.eleves).length} élèves</p>
                </div>
                <div class="flex gap-2 flex-wrap">
                    <button onclick="window.evalVoirResultats()" class="bg-indigo-600 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-indigo-400">
                        📊 Voir les résultats
                    </button>
                    <button onclick="window.evalGenererFactices()" class="bg-purple-600 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-purple-400">
                        🧪 Données factices
                    </button>
                    <button onclick="window.evalReinitialiser()" class="bg-red-600 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-red-400">
                        🗑️ Réinitialiser
                    </button>
                    <button onclick="window.evalExporterCSV()" class="bg-emerald-600 px-4 py-2 rounded-xl font-black text-xs uppercase text-white border-2 border-emerald-400">
                        📥 Export CSV
                    </button>
                </div>
            </div>

            <!-- Statistiques rapides -->
            <div class="grid grid-cols-3 md:grid-cols-7 gap-2">
                ${Object.keys(LIBELLES_TESTS).map(testId => {
                    const statsTest = stats[testId] || { total: 0, a_besoins: 0, fragile: 0, satisfaisant: 0 };
                    const pct = statsTest.total > 0 ? Math.round((statsTest.satisfaisant / statsTest.total) * 100) : 0;
                    return `
                        <div class="bg-slate-800 p-3 rounded-xl border border-slate-700 text-center">
                            <p class="text-[10px] font-bold text-slate-400 uppercase">${LIBELLES_TESTS[testId].split('(')[0].trim()}</p>
                            <p class="text-lg font-black text-white">${statsTest.total}</p>
                            <div class="w-full h-1.5 bg-slate-700 rounded-full mt-1 overflow-hidden">
                                <div class="h-full bg-emerald-500 rounded-full" style="width:${pct}%"></div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            <!-- Tests principaux -->
            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <h3 class="font-black text-blue-400 uppercase text-sm mb-4">🏆 Tests principaux (obligatoires)</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    ${['endurance', 'force', 'vitesse'].map(testId => templateCarteTest(testId, data)).join('')}
                </div>
            </div>

            <!-- Tests complémentaires -->
            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <h3 class="font-black text-blue-400 uppercase text-sm mb-4">🧪 Tests complémentaires (facultatifs)</h3>
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    ${['equilibre', 'coordination', 'souplesse', 'endurance_musculaire'].map(testId => templateCarteTest(testId, data)).join('')}
                </div>
            </div>
        </div>
    `;
}