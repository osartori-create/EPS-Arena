// src/js/modules/evaluation/evaluation-stockage.js
// Gestion du stockage local (localStorage)

const PREFIX = 'eps_arena_evaluation_';

export function getStorageKey(classe) {
    return `${PREFIX}${classe}`;
}

export function chargerDonnees(classe) {
    if (!classe) return null;
    const key = getStorageKey(classe);
    const raw = localStorage.getItem(key);
    if (raw) {
        try {
            return JSON.parse(raw);
        } catch (e) {
            console.error('Erreur de parsing des données évaluation :', e);
            return null;
        }
    }
    return null;
}

export function sauvegarderDonnees(classe, data) {
    if (!classe || !data) return;
    const key = getStorageKey(classe);
    data.derniere_modification = Date.now();
    localStorage.setItem(key, JSON.stringify(data));
}

export function creerStructureVide(classe, eleves) {
    const data = {
        eleves: {},
        config: {
            tests_actifs: {
                endurance: true,
                force: true,
                vitesse: true,
                equilibre: false,
                coordination: false,
                souplesse: false,
                endurance_musculaire: false
            },
            vma_offset: 34,
            vma_mode: 'classe_entiere',
            vma_demi_mode: 'alphabétique',
            ordre_passation: 'alphabétique'
        },
        derniere_modification: Date.now()
    };

    eleves.forEach(e => {
        data.eleves[e.id] = {
            id: e.id,
            nom: e.nom || '',
            prenom: e.prenom || '',
            sexe: e.sexe || '',
            statut: 'present',
            resultats: {
                endurance: null,
                force: null,
                vitesse: null,
                equilibre: null,
                coordination: null,
                souplesse: null,
                endurance_musculaire: null
            }
        };
    });

    sauvegarderDonnees(classe, data);
    return data;
}

export function loadOrCreateData(classe, eleves) {
    let data = chargerDonnees(classe);
    if (!data) {
        data = creerStructureVide(classe, eleves);
    } else {
        let modifie = false;
        eleves.forEach(e => {
            if (!data.eleves[e.id]) {
                data.eleves[e.id] = {
                    id: e.id,
                    nom: e.nom || '',
                    prenom: e.prenom || '',
                    sexe: e.sexe || '',
                    statut: 'present',
                    resultats: {
                        endurance: null,
                        force: null,
                        vitesse: null,
                        equilibre: null,
                        coordination: null,
                        souplesse: null,
                        endurance_musculaire: null
                    }
                };
                modifie = true;
            } else {
                const el = data.eleves[e.id];
                if (el.nom !== e.nom || el.prenom !== e.prenom || el.sexe !== e.sexe) {
                    el.nom = e.nom || el.nom;
                    el.prenom = e.prenom || el.prenom;
                    el.sexe = e.sexe || el.sexe;
                    modifie = true;
                }
            }
        });
        if (modifie) sauvegarderDonnees(classe, data);
    }
    return data;
}

export function getElevesTries(data) {
    const eleves = Object.values(data.eleves);
    return eleves.sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));
}

export function getElevesActifs(data) {
    return Object.values(data.eleves).filter(e => e.statut === 'present');
}

export function getElevesTous(data) {
    return Object.values(data.eleves);
}

export function setStatutEleve(data, eleveId, statut) {
    if (data.eleves[eleveId]) {
        data.eleves[eleveId].statut = statut;
        sauvegarderDonnees(data.classe || '', data);
        return true;
    }
    return false;
}

export function setResultat(data, eleveId, testId, resultat) {
    if (data.eleves[eleveId]) {
        data.eleves[eleveId].resultats[testId] = {
            ...resultat,
            timestamp: Date.now()
        };
        sauvegarderDonnees(data.classe || '', data);
        return true;
    }
    return false;
}

export function getResultat(data, eleveId, testId) {
    if (data.eleves[eleveId]) {
        return data.eleves[eleveId].resultats[testId] || null;
    }
    return null;
}

export function reinitialiserDonnees(classe) {
    const key = getStorageKey(classe);
    localStorage.removeItem(key);
}

export function genererDonneesFactices(data) {
    const eleves = getElevesActifs(data);
    const tests = ['endurance', 'force', 'vitesse', 'equilibre', 'coordination', 'souplesse', 'endurance_musculaire'];
    
    eleves.forEach(e => {
        // Endurance : palier entre 0 et 8
        const palier = Math.floor(Math.random() * 9);
        data.eleves[e.id].resultats.endurance = {
            palier: palier,
            groupe: palier <= 1 ? 'a_besoins' : (palier <= 3 ? 'fragile' : 'satisfaisant'),
            timestamp: Date.now()
        };

        // Force : distance entre 80 et 200 cm
        const force = Math.floor(Math.random() * 120) + 80;
        const essaisForce = [force - Math.floor(Math.random() * 20), force, force + Math.floor(Math.random() * 15)];
        data.eleves[e.id].resultats.force = {
            essais: essaisForce,
            meilleur: Math.max(...essaisForce),
            groupe: force <= 110 ? 'a_besoins' : (force <= 140 ? 'fragile' : 'satisfaisant'),
            timestamp: Date.now()
        };

        // Vitesse : temps entre 5.0 et 8.0 secondes
        const vitesse = (Math.random() * 3 + 5).toFixed(1);
        const essaisVitesse = [
            (parseFloat(vitesse) + (Math.random() * 0.4 - 0.2)).toFixed(1),
            (parseFloat(vitesse) + (Math.random() * 0.4 - 0.2)).toFixed(1),
            parseFloat(vitesse)
        ].map(Number);
        const meilleurVitesse = Math.min(...essaisVitesse);
        data.eleves[e.id].resultats.vitesse = {
            essais: essaisVitesse,
            meilleur: meilleurVitesse,
            groupe: meilleurVitesse >= 6.8 ? 'a_besoins' : (meilleurVitesse >= 6.0 ? 'fragile' : 'satisfaisant'),
            timestamp: Date.now()
        };

        // Équilibre : temps entre 5 et 45 secondes
        const equilibre = Math.floor(Math.random() * 40) + 5;
        data.eleves[e.id].resultats.equilibre = {
            temps: equilibre,
            groupe: equilibre <= 10 ? 'a_besoins' : (equilibre <= 30 ? 'fragile' : 'satisfaisant'),
            timestamp: Date.now()
        };

        // Coordination : lancers entre 1 et 8
        const coordination = Math.floor(Math.random() * 8) + 1;
        data.eleves[e.id].resultats.coordination = {
            nb_lancers: coordination,
            groupe: coordination <= 3 ? 'a_besoins' : (coordination <= 5 ? 'fragile' : 'satisfaisant'),
            timestamp: Date.now()
        };

        // Souplesse : distance entre -20 et +10 cm
        const souplesse = Math.floor(Math.random() * 30) - 20;
        const essaisSouplesse = [
            souplesse + Math.floor(Math.random() * 6) - 3,
            souplesse + Math.floor(Math.random() * 6) - 3,
            souplesse
        ];
        const meilleurSouplesse = Math.max(...essaisSouplesse);
        data.eleves[e.id].resultats.souplesse = {
            essais: essaisSouplesse,
            meilleur: meilleurSouplesse,
            groupe: meilleurSouplesse <= -15 ? 'a_besoins' : (meilleurSouplesse <= -5 ? 'fragile' : 'satisfaisant'),
            timestamp: Date.now()
        };

        // Endurance musculaire : temps entre 10 et 150 secondes
        const em = Math.floor(Math.random() * 140) + 10;
        data.eleves[e.id].resultats.endurance_musculaire = {
            temps: em,
            groupe: em <= 30 ? 'a_besoins' : (em <= 60 ? 'fragile' : 'satisfaisant'),
            timestamp: Date.now()
        };
    });

    sauvegarderDonnees(data.classe || '', data);
    return data;
}