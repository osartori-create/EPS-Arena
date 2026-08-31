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

let currentData = null;
let currentClasse = '';
let currentTestId = '';
let currentEleves = [];
let currentIndex = 0;
let currentMode = 'menu'; // 'menu' | 'passation'
let selectListenerAttached = false;

/**
 * Point d'entrée du module
 * - S'assure que le conteneur existe
 * - Écoute les changements de classe
 * - Charge les données si une classe est sélectionnée
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

    // Fonction qui charge les données pour la classe sélectionnée
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

        // Si on était en mode passation, on revient au menu
        if (currentMode === 'passation') {
            currentMode = 'menu';
        }
        afficherMenu();
    }

    // Ajouter l'écouteur une seule fois
    if (!selectListenerAttached) {
        select.addEventListener('change', chargerDonneesClasse);
        selectListenerAttached = true;
    }

    // Charger immédiatement si une classe est déjà sélectionnée
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
    window.evalGenererFactices = genererFactices;
    window.evalReinitialiser = reinitialiser;
    window.evalExporterCSV = exporterCSV;
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

    // Trouver le premier élève sans résultat pour ce test
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
        // Recharger les données
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
// Dans afficherPassation, remplacer l'appel à templatePassation par :
const mode = (currentTestId === 'endurance') ? 'collectif' : 'individuel';
container.innerHTML = templatePassation(
    currentTestId,
    eleveEnCours,
    eleveSuivant,
    currentEleves,
    currentData,
    mode
);