// src/js/modules/evaluation/evaluation-utils.js
import { PALIER_VMA } from '../../config/constants.js';
import { exporterVersIDoceo as exporterVersIDoceoService } from '../../services/export-service.js';

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
export function exporterVersIDoceo(data, classe) {
    if (!classe) {
        alert('Sélectionnez une classe.');
        return;
    }

    // 1. Récupérer les élèves et les trier par nom/prénom
    const eleves = Object.values(data.eleves).sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));

    if (eleves.length === 0) {
        alert('Aucun élève dans cette classe.');
        return;
    }

    // 2. Construire les données
    const donnees = eleves.map((e, index) => {
        const r = e.resultats || {};
        const numero = index + 1;

        // VMA à partir du palier d'endurance
        let vmaValue = '';
        if (r.endurance && r.endurance.palier !== undefined && r.endurance.palier !== null) {
            const vma = getVMAFromPalier(r.endurance.palier);
            if (vma !== null) vmaValue = vma.toFixed(1);
        }

        return {
            numero: numero,
            nom: e.nom || '',
            prenom: e.prenom || '',
            sexe: e.sexe || '',
            statut: e.statut || 'present',
            endurancePalier: r.endurance ? r.endurance.palier ?? '' : '',
            enduranceGroupe: r.endurance ? LIBELLES_GROUPES[r.endurance.groupe] || '' : '',
            vma: vmaValue,
            forceCm: r.force ? r.force.meilleur ?? '' : '',
            forceGroupe: r.force ? LIBELLES_GROUPES[r.force.groupe] || '' : '',
            vitesseSec: r.vitesse ? r.vitesse.meilleur ?? '' : '',
            vitesseGroupe: r.vitesse ? LIBELLES_GROUPES[r.vitesse.groupe] || '' : '',
            equilibreSec: r.equilibre ? r.equilibre.temps ?? '' : '',
            equilibreGroupe: r.equilibre ? LIBELLES_GROUPES[r.equilibre.groupe] || '' : '',
            coordinationNb: r.coordination ? r.coordination.nb_lancers ?? '' : '',
            coordinationGroupe: r.coordination ? LIBELLES_GROUPES[r.coordination.groupe] || '' : '',
            souplesseCm: r.souplesse ? r.souplesse.meilleur ?? '' : '',
            souplesseGroupe: r.souplesse ? LIBELLES_GROUPES[r.souplesse.groupe] || '' : '',
            enduranceMusculaireSec: r.endurance_musculaire ? r.endurance_musculaire.temps ?? '' : '',
            enduranceMusculaireGroupe: r.endurance_musculaire ? LIBELLES_GROUPES[r.endurance_musculaire.groupe] || '' : ''
        };
    });

    // 3. Définir les colonnes (avec ! devant toutes les colonnes)
    const colonnes = [
        { nom: '!groupe', cle: 'numero' },
        { nom: '!Nom', cle: 'nom' },
        { nom: '!Prénom', cle: 'prenom' },
        { nom: '!Sexe', cle: 'sexe' },
        { nom: '!Statut', cle: 'statut' },
        { nom: '!Endurance (palier)', cle: 'endurancePalier' },
        { nom: '!Endurance (groupe)', cle: 'enduranceGroupe' },
        { nom: '!VMA (km/h)', cle: 'vma' },
        { nom: '!Force (cm)', cle: 'forceCm' },
        { nom: '!Force (groupe)', cle: 'forceGroupe' },
        { nom: '!Vitesse (s)', cle: 'vitesseSec' },
        { nom: '!Vitesse (groupe)', cle: 'vitesseGroupe' },
        { nom: '!Équilibre (s)', cle: 'equilibreSec' },
        { nom: '!Équilibre (groupe)', cle: 'equilibreGroupe' },
        { nom: '!Coordination (nb)', cle: 'coordinationNb' },
        { nom: '!Coordination (groupe)', cle: 'coordinationGroupe' },
        { nom: '!Souplesse (cm)', cle: 'souplesseCm' },
        { nom: '!Souplesse (groupe)', cle: 'souplesseGroupe' },
        { nom: '!Endurance musculaire (s)', cle: 'enduranceMusculaireSec' },
        { nom: '!Endurance musculaire (groupe)', cle: 'enduranceMusculaireGroupe' }
    ];

    // 4. Exporter via le service centralisé
    exporterVersIDoceoService('Evaluation', classe, colonnes, donnees);
}