// src/js/modules/evaluation/evaluation-interface.js
// Interface principale du module d'évaluation

import {
    loadOrCreateData, getElevesActifs,
    genererDonneesFactices, reinitialiserDonnees,
    purgerTest, purgerTousLesTests, purgerClasseEntiere
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
    window.evalOuvrirPurge = ouvrirPurge;
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
async function afficherPassation() {
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

    // Charger les photos si on est en mode individuel
    if (mode !== 'collectif' && eleveEnCours) {
        await chargerPhotoEleve(eleveEnCours.id, 'eval-eleve-photo');
        if (eleveSuivant) {
            await chargerPhotoEleve(eleveSuivant.id, 'eval-prochain-photo');
        }
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

// Fonction utilitaire pour charger une photo
async function chargerPhotoEleve(eleveId, elementId) {
    const container = document.getElementById(elementId);
    if (!container) return;
    try {
        const { getPhotoUrl } = await import('../../services/admin-service.js');
        const url = await getPhotoUrl(eleveId);
        // Récupérer l'élève pour connaître son sexe
        const eleve = currentData.eleves[eleveId];
        if (eleve) {
            // Déterminer la couleur de fond selon le sexe
            let bgSexe = 'bg-slate-200 border-slate-400';
            if (eleve.sexe === 'M' || eleve.sexe === 'm') bgSexe = 'bg-blue-200 border-blue-400';
            else if (eleve.sexe === 'F' || eleve.sexe === 'f') bgSexe = 'bg-rose-200 border-rose-400';
            container.className = `w-${elementId === 'eval-eleve-photo' ? '16' : '10'} h-${elementId === 'eval-eleve-photo' ? '16' : '10'} rounded-full border-2 flex items-center justify-center text-3xl overflow-hidden ${bgSexe}`;
        }
        if (url) {
            container.innerHTML = `<img src="${url}" class="w-full h-full object-cover rounded-full">`;
        } else {
            // Conserver l'initiale si pas de photo
            const initiale = eleve?.prenom?.charAt(0) || '👤';
            container.innerHTML = `<span class="text-${elementId === 'eval-eleve-photo' ? '3xl' : 'sm'}">${initiale}</span>`;
        }
    } catch (e) {
        // Fallback : garder l'initiale
        const eleve = currentData.eleves[eleveId];
        const initiale = eleve?.prenom?.charAt(0) || '👤';
        container.innerHTML = `<span class="text-${elementId === 'eval-eleve-photo' ? '3xl' : 'sm'}">${initiale}</span>`;
    }
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
function ouvrirPurge() {
    if (!currentData || !currentClasse) {
        alert('Aucune classe sélectionnée.');
        return;
    }
    
    // Compter les résultats pour chaque test
    const stats = {};
    const tests = ['endurance', 'force', 'vitesse', 'equilibre', 'coordination', 'souplesse', 'endurance_musculaire'];
    const libelles = {
        endurance: 'Endurance (Luc Léger)',
        force: 'Force (saut en longueur)',
        vitesse: 'Vitesse (30m)',
        equilibre: 'Équilibre (Flamingo)',
        coordination: 'Coordination (lancer/rattrapé)',
        souplesse: 'Souplesse (sit and reach)',
        endurance_musculaire: 'Endurance musculaire (chaise)'
    };
    
    tests.forEach(testId => {
        const nb = Object.values(currentData.eleves).filter(e => e.resultats[testId] !== null && e.resultats[testId]?.groupe !== null).length;
        stats[testId] = nb;
    });
    
    const nbEleves = Object.keys(currentData.eleves).length;
    
    // Créer la modale
    const modalHtml = templateModalPurge(currentClasse, stats, libelles, nbEleves);
    
    // Ajouter la modale au DOM
    const modalContainer = document.createElement('div');
    modalContainer.id = 'eval-purge-modal';
    modalContainer.className = 'fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4';
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);
    
    // Gérer les événements
    modalContainer.querySelector('#eval-purge-close').addEventListener('click', () => {
        modalContainer.remove();
    });
    
    modalContainer.querySelectorAll('.eval-purge-test').forEach(btn => {
        btn.addEventListener('click', () => {
            const testId = btn.dataset.test;
            const libelle = libelles[testId] || testId;
            const count = stats[testId] || 0;
            if (count === 0) {
                alert(`ℹ️ Aucun résultat pour ${libelle}.`);
                return;
            }
            if (confirm(`⚠️ Supprimer les ${count} résultat(s) pour "${libelle}" ?`)) {
                purgerTest(currentClasse, testId);
                // Recharger les données
                const elevesData = JSON.parse(localStorage.getItem(`eps_arena_eleves_${currentClasse}`) || '[]');
                currentData = loadOrCreateData(currentClasse, elevesData);
                currentData.classe = currentClasse;
                modalContainer.remove();
                afficherMenu();
                alert(`✅ Résultats de "${libelle}" supprimés.`);
            }
        });
    });
    
    modalContainer.querySelector('#eval-purge-all').addEventListener('click', () => {
        const total = Object.values(stats).reduce((a, b) => a + b, 0);
        if (total === 0) {
            alert('ℹ️ Aucun résultat à supprimer.');
            return;
        }
        if (confirm(`⚠️ Supprimer TOUS les résultats (${total} au total) ? Cette action est irréversible.`)) {
            purgerTousLesTests(currentClasse);
            // Recharger les données
            const elevesData = JSON.parse(localStorage.getItem(`eps_arena_eleves_${currentClasse}`) || '[]');
            currentData = loadOrCreateData(currentClasse, elevesData);
            currentData.classe = currentClasse;
            modalContainer.remove();
            afficherMenu();
            alert(`✅ Tous les résultats supprimés.`);
        }
    });
    
    modalContainer.querySelector('#eval-purge-all-eleves').addEventListener('click', () => {
        if (confirm(`⚠️ Supprimer TOUTES les données de la classe "${currentClasse}" (élèves + résultats) ? Cette action est irréversible.`)) {
            purgerClasseEntiere(currentClasse);
            modalContainer.remove();
            // Recharger la page ou réinitialiser l'affichage
            const container = document.getElementById('viewEvaluationSettings');
            if (container) {
                container.innerHTML = '<p class="text-slate-500 text-center py-10">Classe purgée. Veuillez sélectionner une classe.</p>';
            }
            // Réinitialiser currentData
            currentData = null;
            alert(`✅ Toutes les données de la classe "${currentClasse}" ont été supprimées.`);
        }
    });
    
    // Fermer la modale en cliquant à l'extérieur
    modalContainer.addEventListener('click', (e) => {
        if (e.target === modalContainer) {
            modalContainer.remove();
        }
    });
}