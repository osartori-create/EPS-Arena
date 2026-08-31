// src/js/modules/evaluation/evaluation-interface.js
// Interface principale du module d'évaluation

import { 
    loadOrCreateData, getElevesTries, getElevesActifs, 
    setStatutEleve, setResultat, genererDonneesFactices,
    reinitialiserDonnees, sauvegarderDonnees
} from './evaluation-stockage.js';
import { templateVuePrincipale, templatePassation } from './evaluation-templates.js';
import { LIBELLES_TESTS, exporterVersIDoceo } from './evaluation-utils.js';
import { initSaisieSaut } from './evaluation-saut.js';
import { initSaisieSprint } from './evaluation-sprint.js';
import { initSaisieVMA } from './evaluation-vma.js';
import { initSaisieStandard } from './evaluation-saisie.js';
import { afficherGraphiques } from './evaluation-graphiques.js';

let currentData = null;
let currentClasse = '';
let currentTestId = '';
let currentEleves = [];
let currentIndex = 0;
let currentMode = 'menu'; // 'menu' | 'passation'

/**
 * Point d'entrée du module
 */
export function initEvaluationInterface() {
    console.log('📊 Initialisation du module Évaluation');
    
    // S'assurer que le conteneur existe
    const container = document.getElementById('viewEvaluationSettings');
    if (!container) {
        console.error('Conteneur viewEvaluationSettings introuvable');
        return;
    }

    const classe = document.getElementById('selectClasse')?.value;
    if (!classe) {
        container.innerHTML = '<p class="text-slate-500 text-center py-10">Veuillez sélectionner une classe.</p>';
        return;
    }

    currentClasse = classe;
    chargerElevesEtAfficher();
}

/**
 * Charge les élèves et affiche le menu
 */
function chargerElevesEtAfficher() {
    const classe = currentClasse;
    const elevesData = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');
    
    currentData = loadOrCreateData(classe, elevesData);
    currentData.classe = classe;
    
    afficherMenu();
}

/**
 * Affiche le menu principal
 */
function afficherMenu() {
    currentMode = 'menu';
    const container = document.getElementById('viewEvaluationSettings');
    if (!container) return;

    container.innerHTML = templateVuePrincipale(currentData, currentClasse);
    
    // Exposer les fonctions globales
    window.evalLancerTest = lancerTest;
    window.evalGenererFactices = genererFactices;
    window.evalReinitialiser = reinitialiser;
    window.evalExporterCSV = exporterCSV;
}

/**
 * Lance un test
 */
function lancerTest(testId) {
    currentTestId = testId;
    const eleves = getElevesActifs(currentData);
    currentEleves = eleves.sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));
    currentIndex = 0;
    
    // Vérifier si des élèves ont déjà un résultat pour ce test
    // On commence par le premier élève sans résultat, ou le premier si tous sont faits
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
    if (!container) return;

    const eleveEnCours = currentEleves[currentIndex] || null;
    const eleveSuivant = currentEleves[currentIndex + 1] || null;
    
    container.innerHTML = templatePassation(
        currentTestId, 
        eleveEnCours, 
        eleveSuivant, 
        currentEleves, 
        currentData
    );

    // Initialiser la zone de saisie selon le test
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

    // Exposer les fonctions
    window.evalRetourMenu = retourMenu;
    window.evalPasserSuivant = passerSuivant;
    window.evalTerminerTest = terminerTest;
}

/**
 * Passe à l'élève suivant
 */
function passerSuivant() {
    // Vérifier si l'élève en cours a un résultat
    const eleveEnCours = currentEleves[currentIndex];
    if (eleveEnCours && currentData.eleves[eleveEnCours.id]?.resultats?.[currentTestId] === null) {
        // Si l'élève n'a pas de résultat, on le force à passer
        // On pourrait afficher une confirmation, mais on laisse faire
    }
    
    if (currentIndex < currentEleves.length - 1) {
        currentIndex++;
        afficherPassation();
    } else {
        // Tous les élèves ont été traités
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
 * Génère des données factices
 */
function genererFactices() {
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
    if (confirm('⚠️ Supprimer toutes les données d\'évaluation pour cette classe ?')) {
        reinitialiserDonnees(currentClasse);
        chargerElevesEtAfficher();
        alert('✅ Données réinitialisées.');
    }
}

/**
 * Exporte les données en CSV
 */
function exporterCSV() {
    exporterVersIDoceo(currentData, currentClasse);
}