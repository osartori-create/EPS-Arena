// src/js/modules/evaluation/evaluation-utils.js
import { PALIER_VMA } from '../../config/constants.js';
import { exporterVersIDoceo as exporterVersIDoceoService } from '../../services/export-service.js';
import { colonnesIdentite, col, exporterVersIDoceo as exporterService } from '../../services/export-service.js';

// ============================================================
// GROUPES DE MAÎTRISE
// ============================================================
export const GROUPES = {
    A_BESOINS: 'a_besoins',
    FRAGILE: 'fragile',
    SATISFAISANT: 'satisfaisant'
};

export const COULEURS_GROUPES = {
    [GROUPES.A_BESOINS]: '#ef4444',
    [GROUPES.FRAGILE]: '#f59e0b',
    [GROUPES.SATISFAISANT]: '#22c55e'
};

export const LIBELLES_GROUPES = {
    [GROUPES.A_BESOINS]: 'À besoins',
    [GROUPES.FRAGILE]: 'Fragile',
    [GROUPES.SATISFAISANT]: 'Satisfaisant'
};

// ============================================================
// FONCTIONS DE CALCUL DES GROUPES
// ============================================================
export function getVMAFromPalier(palier) {
    if (palier === undefined || palier === null || !(palier in PALIER_VMA)) {
        return null;
    }
    return PALIER_VMA[palier];
}

export function groupeEndurance(palier) {
    if (palier === undefined || palier === null) return null;
    if (palier <= 1) return GROUPES.A_BESOINS;
    if (palier <= 3) return GROUPES.FRAGILE;
    return GROUPES.SATISFAISANT;
}

export function groupeForce(distance) {
    if (distance === undefined || distance === null) return null;
    if (distance <= 110) return GROUPES.A_BESOINS;
    if (distance <= 140) return GROUPES.FRAGILE;
    return GROUPES.SATISFAISANT;
}

export function groupeVitesse(temps) {
    if (temps === undefined || temps === null) return null;
    if (temps >= 6.8) return GROUPES.A_BESOINS;
    if (temps >= 6.0) return GROUPES.FRAGILE;
    return GROUPES.SATISFAISANT;
}

export function groupeEquilibre(duree) {
    if (duree === undefined || duree === null) return null;
    if (duree <= 10) return GROUPES.A_BESOINS;
    if (duree <= 30) return GROUPES.FRAGILE;
    return GROUPES.SATISFAISANT;
}

export function groupeCoordination(nb) {
    if (nb === undefined || nb === null) return null;
    if (nb <= 3) return GROUPES.A_BESOINS;
    if (nb <= 5) return GROUPES.FRAGILE;
    return GROUPES.SATISFAISANT;
}

export function groupeSouplesse(distance) {
    if (distance === undefined || distance === null) return null;
    if (distance <= -15) return GROUPES.A_BESOINS;
    if (distance <= -5) return GROUPES.FRAGILE;
    return GROUPES.SATISFAISANT;
}

export function groupeEnduranceMusculaire(duree) {
    if (duree === undefined || duree === null) return null;
    if (duree <= 30) return GROUPES.A_BESOINS;
    if (duree <= 60) return GROUPES.FRAGILE;
    return GROUPES.SATISFAISANT;
}

export const FONCTIONS_GROUPE = {
    endurance: groupeEndurance,
    force: groupeForce,
    vitesse: groupeVitesse,
    equilibre: groupeEquilibre,
    coordination: groupeCoordination,
    souplesse: groupeSouplesse,
    endurance_musculaire: groupeEnduranceMusculaire
};

// ============================================================
// LIBELLÉS ET UNITÉS
// ============================================================
export const LIBELLES_TESTS = {
    endurance: 'Endurance (Luc Léger)',
    force: 'Force (saut en longueur)',
    vitesse: 'Vitesse (30m)',
    equilibre: 'Équilibre (Flamingo)',
    coordination: 'Coordination (lancer/rattrapé)',
    souplesse: 'Souplesse (sit and reach)',
    endurance_musculaire: 'Endurance musculaire (chaise)'
};

export const UNITES_TESTS = {
    endurance: 'paliers',
    force: 'cm',
    vitesse: 's',
    equilibre: 's',
    coordination: 'lancers',
    souplesse: 'cm',
    endurance_musculaire: 's'
};

// ============================================================
// EXPORT iDoceo (via service centralisé)
// ============================================================
// ============================================================
// EXPORT iDoceo (via service centralisé) — v4
// Format validé : identité sans préfixe ("Nom de famille" / "Prénom"),
// données SANS préfixe. iDoceo fait le matching élèves et détecte
// automatiquement le type des colonnes de données.
// ============================================================
export function exporterVersIDoceo(data, classe) {
    if (!classe) return alert('Sélectionnez une classe.');

    const eleves = Object.values(data.eleves).sort((a, b) =>
        a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom)
    );
    if (eleves.length === 0) return alert('Aucun élève dans cette classe.');

    const lignes = eleves.map((e, index) => {
        const r = e.resultats || {};

        let vmaValue = '';
        if (r.endurance?.palier !== undefined && r.endurance?.palier !== null) {
            const vma = getVMAFromPalier(r.endurance.palier);
            if (vma !== null) vmaValue = vma.toFixed(1);
        }

        return {
            nom: e.nom || '',
            prenom: e.prenom || '',
            donnees: {
                endurancePalier:        r.endurance ? r.endurance.palier ?? '' : '',
                enduranceGroupe:        libelleGroupe(r.endurance?.groupe),
                vma:                    vmaValue,
                forceCm:                r.force ? r.force.meilleur ?? '' : '',
                forceGroupe:            libelleGroupe(r.force?.groupe),
                vitesseSec:             r.vitesse ? r.vitesse.meilleur ?? '' : '',
                vitesseGroupe:          libelleGroupe(r.vitesse?.groupe),
                equilibreSec:           r.equilibre ? r.equilibre.temps ?? '' : '',
                equilibreGroupe:        libelleGroupe(r.equilibre?.groupe),
                coordinationNb:         r.coordination ? r.coordination.nb_lancers ?? '' : '',
                coordinationGroupe:     libelleGroupe(r.coordination?.groupe),
                souplesseCm:            r.souplesse ? r.souplesse.meilleur ?? '' : '',
                souplesseGroupe:        libelleGroupe(r.souplesse?.groupe),
                enduranceMusculaireSec: r.endurance_musculaire ? r.endurance_musculaire.temps ?? '' : '',
                enduranceMusculaireGroupe: libelleGroupe(r.endurance_musculaire?.groupe)
            }
        };
    });

    const colonnesDonnees = [
        col('Endurance (palier)', 'endurancePalier'),
        col('Endurance (groupe)', 'enduranceGroupe'),
        col('VMA (km/h)', 'vma'),
        col('Force (cm)', 'forceCm'),
        col('Force (groupe)', 'forceGroupe'),
        col('Vitesse (s)', 'vitesseSec'),
        col('Vitesse (groupe)', 'vitesseGroupe'),
        col('Équilibre (s)', 'equilibreSec'),
        col('Équilibre (groupe)', 'equilibreGroupe'),
        col('Coordination (nb)', 'coordinationNb'),
        col('Coordination (groupe)', 'coordinationGroupe'),
        col('Souplesse (cm)', 'souplesseCm'),
        col('Souplesse (groupe)', 'souplesseGroupe'),
        col('Endurance musculaire (s)', 'enduranceMusculaireSec'),
        col('Endurance musculaire (groupe)', 'enduranceMusculaireGroupe')
    ];

    exporterService('Evaluation', classe, [...colonnesIdentite(), ...colonnesDonnees], lignes.map(l => ({ nom: l.nom, prenom: l.prenom, ...l.donnees })));
}


// Helper : libellé lisible du groupe de maîtrise
function libelleGroupe(groupe) {
    if (!groupe) return '';
    const map = {
        'satisfaisant': 'Satisfaisant',
        'fragile': 'Fragile',
        'a_besoins': 'À besoins'
    };
    return map[groupe] || groupe;
}