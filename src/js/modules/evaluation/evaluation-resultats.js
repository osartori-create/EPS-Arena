// src/js/modules/evaluation/evaluation-resultats.js
// Vue Tableau de bord des résultats

import { templateTableauBord, templateFicheEleve } from './evaluation-templates.js';
import { getElevesTous, setResultat, setStatutEleve, sauvegarderDonnees } from './evaluation-stockage.js';
import { COULEURS_GROUPES, LIBELLES_GROUPES, FONCTIONS_GROUPE } from './evaluation-utils.js';
import { renderRadar } from './evaluation-graphiques.js';

let currentData = null;
let currentEleveId = null;
let modeEdition = false;

/**
 * Affiche le tableau de bord des résultats
 */
export function afficherResultats(data) {
    currentData = data;
    const container = document.getElementById('viewEvaluationSettings');
    if (!container) return;

    container.innerHTML = templateTableauBord(data, data.classe);

    // Exposer les fonctions globales
    window.evalRetourMenu = retourMenu;
    window.evalOuvrirFiche = ouvrirFiche;
    window.evalExporterCSV = exporterCSV;
    window.evalGenererFactices = genererFactices;
    window.evalReinitialiser = reinitialiser;
    window.evalRetourResultats = afficherResultats.bind(null, data);
}

function retourMenu() {
    // Revenir au menu principal du module
    const container = document.getElementById('viewEvaluationSettings');
    if (!container) return;

    // Réimporter l'interface principale
    import('./evaluation-interface.js').then(module => {
        module.initEvaluationInterface();
    }).catch(err => {
        console.error('Erreur retour menu :', err);
        // Fallback : recharger la page
        location.reload();
    });
}

function exporterCSV() {
    if (!currentData) return;
    import('./evaluation-utils.js').then(module => {
        module.exporterVersIDoceo(currentData, currentData.classe);
    });
}

function genererFactices() {
    if (!currentData) return;
    if (confirm('Générer des données factices pour tous les tests ?')) {
        import('./evaluation-stockage.js').then(module => {
            currentData = module.genererDonneesFactices(currentData);
            afficherResultats(currentData);
            alert('✅ Données factices générées !');
        });
    }
}

function reinitialiser() {
    if (!currentData) return;
    if (confirm('⚠️ Supprimer toutes les données d\'évaluation pour cette classe ?')) {
        import('./evaluation-stockage.js').then(module => {
            module.reinitialiserDonnees(currentData.classe);
            // Recharger les données
            const elevesData = JSON.parse(localStorage.getItem(`eps_arena_eleves_${currentData.classe}`) || '[]');
            currentData = module.loadOrCreateData(currentData.classe, elevesData);
            currentData.classe = currentData.classe;
            afficherResultats(currentData);
            alert('✅ Données réinitialisées.');
        });
    }
}

/**
 * Ouvre la fiche détaillée d'un élève
 */
export function ouvrirFiche(eleveId) {
    currentEleveId = eleveId;
    modeEdition = false;

    const container = document.getElementById('viewEvaluationSettings');
    if (!container) return;

    const eleve = currentData.eleves[eleveId];
    if (!eleve) {
        container.innerHTML = '<p class="text-slate-500 text-center py-10">Élève non trouvé.</p>';
        return;
    }

    container.innerHTML = templateFicheEleve(eleve, currentData, false);

    // Charger la photo
    chargerPhoto(eleveId);

    // Charger le radar
    setTimeout(() => {
        const radarContainer = document.getElementById('eval-radar-canvas');
        if (radarContainer && currentData) {
            renderRadar(radarContainer, currentData, eleveId);
        }
    }, 200);

    // Exposer les fonctions pour la fiche
    window.evalToggleEdition = toggleEdition;
    window.evalSauvegarderFiche = sauvegarderFiche;
    window.evalRetourResultats = afficherResultats.bind(null, currentData);
    window.evalRetourMenu = retourMenu;
}

async function chargerPhoto(eleveId) {
    const container = document.getElementById('eval-photo-container');
    if (!container) return;

    try {
        const { getPhotoUrl } = await import('../../services/admin-service.js');
        const url = await getPhotoUrl(eleveId);
        if (url) {
            container.innerHTML = `<img src="${url}" class="w-32 h-32 rounded-full object-cover">`;
        } else {
            const eleve = currentData.eleves[eleveId];
            container.innerHTML = `<span class="text-6xl">${eleve?.prenom?.charAt(0) || '👤'}</span>`;
        }
    } catch (e) {
        const eleve = currentData.eleves[eleveId];
        container.innerHTML = `<span class="text-6xl">${eleve?.prenom?.charAt(0) || '👤'}</span>`;
    }
}

function toggleEdition() {
    modeEdition = !modeEdition;
    const eleve = currentData.eleves[currentEleveId];
    const container = document.getElementById('viewEvaluationSettings');
    if (!container || !eleve) return;

    container.innerHTML = templateFicheEleve(eleve, currentData, modeEdition);

    // Recharger la photo
    chargerPhoto(currentEleveId);

    // Recharger le radar
    setTimeout(() => {
        const radarContainer = document.getElementById('eval-radar-canvas');
        if (radarContainer && currentData) {
            renderRadar(radarContainer, currentData, currentEleveId);
        }
    }, 200);

    // Réexposer les fonctions
    window.evalToggleEdition = toggleEdition;
    window.evalSauvegarderFiche = sauvegarderFiche;
    window.evalRetourResultats = afficherResultats.bind(null, currentData);
    window.evalRetourMenu = retourMenu;
}

function sauvegarderFiche() {
    const eleve = currentData.eleves[currentEleveId];
    if (!eleve) return;

    // Récupérer les valeurs des champs
    const tests = ['endurance', 'force', 'vitesse', 'equilibre', 'coordination', 'souplesse', 'endurance_musculaire'];
    let modifie = false;

    tests.forEach(testId => {
        const input = document.getElementById(`edit-${testId}`);
        if (!input) return;

        const valeur = parseFloat(input.value);
        if (isNaN(valeur)) return;

        const resultatActuel = eleve.resultats[testId];
        if (!resultatActuel) {
            // Créer un nouveau résultat
            const nouveauResultat = { groupe: null };
            switch (testId) {
                case 'endurance':
                    nouveauResultat.palier = valeur;
                    break;
                case 'force':
                case 'souplesse':
                    nouveauResultat.essais = [valeur];
                    nouveauResultat.meilleur = valeur;
                    break;
                case 'vitesse':
                    nouveauResultat.essais = [valeur];
                    nouveauResultat.meilleur = valeur;
                    break;
                case 'equilibre':
                case 'endurance_musculaire':
                    nouveauResultat.temps = valeur;
                    break;
                case 'coordination':
                    nouveauResultat.nb_lancers = valeur;
                    break;
            }
            // Calculer le groupe
            const groupeFn = FONCTIONS_GROUPE[testId];
            if (groupeFn) nouveauResultat.groupe = groupeFn(valeur);
            setResultat(currentData, currentEleveId, testId, nouveauResultat);
            modifie = true;
            return;
        }

        // Mettre à jour le résultat existant
        let besoinMiseAJour = false;
        switch (testId) {
            case 'endurance':
                if (resultatActuel.palier !== valeur) {
                    resultatActuel.palier = valeur;
                    besoinMiseAJour = true;
                }
                break;
            case 'force':
            case 'souplesse':
                if (resultatActuel.meilleur !== valeur) {
                    resultatActuel.meilleur = valeur;
                    if (!resultatActuel.essais) resultatActuel.essais = [];
                    resultatActuel.essais.push(valeur);
                    besoinMiseAJour = true;
                }
                break;
            case 'vitesse':
                if (resultatActuel.meilleur !== valeur) {
                    resultatActuel.meilleur = valeur;
                    if (!resultatActuel.essais) resultatActuel.essais = [];
                    resultatActuel.essais.push(valeur);
                    besoinMiseAJour = true;
                }
                break;
            case 'equilibre':
            case 'endurance_musculaire':
                if (resultatActuel.temps !== valeur) {
                    resultatActuel.temps = valeur;
                    besoinMiseAJour = true;
                }
                break;
            case 'coordination':
                if (resultatActuel.nb_lancers !== valeur) {
                    resultatActuel.nb_lancers = valeur;
                    besoinMiseAJour = true;
                }
                break;
        }

        if (besoinMiseAJour) {
            // Recalculer le groupe
            const groupeFn = FONCTIONS_GROUPE[testId];
            if (groupeFn) {
                let val = valeur;
                if (testId === 'endurance') val = valeur;
                else if (testId === 'force' || testId === 'souplesse') val = resultatActuel.meilleur;
                else if (testId === 'vitesse') val = resultatActuel.meilleur;
                else if (testId === 'equilibre' || testId === 'endurance_musculaire') val = resultatActuel.temps;
                else if (testId === 'coordination') val = resultatActuel.nb_lancers;
                resultatActuel.groupe = groupeFn(val);
            }
            // Sauvegarder
            setResultat(currentData, currentEleveId, testId, resultatActuel);
            modifie = true;
        }
    });

    // Gérer le statut
    const statutSelect = document.getElementById('edit-statut');
    if (statutSelect && statutSelect.value !== eleve.statut) {
        setStatutEleve(currentData, currentEleveId, statutSelect.value);
        modifie = true;
    }

    if (modifie) {
        sauvegarderDonnees(currentData.classe || currentData.classe, currentData);
        alert('✅ Modifications sauvegardées !');
    } else {
        alert('ℹ️ Aucune modification détectée.');
    }

    // Recharger la fiche en mode lecture
    modeEdition = false;
    const eleveMisAJour = currentData.eleves[currentEleveId];
    const container = document.getElementById('viewEvaluationSettings');
    if (container && eleveMisAJour) {
        container.innerHTML = templateFicheEleve(eleveMisAJour, currentData, false);
        chargerPhoto(currentEleveId);
        setTimeout(() => {
            const radarContainer = document.getElementById('eval-radar-canvas');
            if (radarContainer && currentData) {
                renderRadar(radarContainer, currentData, currentEleveId);
            }
        }, 200);
        // Réexposer les fonctions
        window.evalToggleEdition = toggleEdition;
        window.evalSauvegarderFiche = sauvegarderFiche;
        window.evalRetourResultats = afficherResultats.bind(null, currentData);
        window.evalRetourMenu = retourMenu;
    }
}