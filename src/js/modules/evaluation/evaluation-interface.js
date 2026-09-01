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

    const photoContainer = document.getElementById('eval-photo-en-cours');
if (photoContainer && eleveEnCours) {
    chargerPhotoDansElement(eleveEnCours.id, photoContainer);
}

// Charger la photo de l'élève suivant
const photoSuivant = document.getElementById('eval-photo-suivant');
if (photoSuivant && eleveSuivant) {
    chargerPhotoDansElement(eleveSuivant.id, photoSuivant);
}
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
window.evalSetStatut = function(statut) {
    if (!currentData || !currentEleves[currentIndex]) return;
    const eleveId = currentEleves[currentIndex].id;
    setStatutEleve(currentData, eleveId, statut);
    // Recharger la passation pour mettre à jour l'affichage
    afficherPassation();
};
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
async function chargerPhotoDansElement(eleveId, container) {
    try {
        const { getPhotoUrl } = await import('../../services/admin-service.js');
        const url = await getPhotoUrl(eleveId);
        if (url) {
            container.innerHTML = `<img src="${url}" class="w-full h-full object-cover">`;
        } else {
            container.innerHTML = '👤';
        }
    } catch (e) {
        container.innerHTML = '👤';
    }
}