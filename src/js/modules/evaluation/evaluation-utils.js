// src/js/modules/evaluation/evaluation-utils.js
// Utilitaires : calculs des scores, groupes de maîtrise, export

import { PALIER_VMA } from '../../config/constants.js';

// ============================================================
// FONCTION : Récupère la VMA à partir du palier
// ============================================================
export function getVMAFromPalier(palier) {
    if (palier === undefined || palier === null || !(palier in PALIER_VMA)) {
        return null;
    }
    return PALIER_VMA[palier];
}

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
// FONCTIONS DE CALCUL DES GROUPES PAR TEST
// ============================================================
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
// EXPORT CSV
// ============================================================
export function genererCSV(data, classe) {
    const eleves = Object.values(data.eleves).sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));

    // En-tête avec préfixes ! pour les colonnes d'identité
    let csv = '';
    csv += '"!groupe";"!Nom";"!Prénom";"Sexe";"Statut";"Endurance (palier)";"Endurance (groupe)";"VMA (km/h)";"Force (cm)";"Force (groupe)";"Vitesse (s)";"Vitesse (groupe)";"Équilibre (s)";"Équilibre (groupe)";"Coordination (nb)";"Coordination (groupe)";"Souplesse (cm)";"Souplesse (groupe)";"Endurance musculaire (s)";"Endurance musculaire (groupe)"\n';

    eleves.forEach((e, index) => {
        const r = e.resultats || {};
        const numero = index + 1;

        let vmaValue = '';
        if (r.endurance && r.endurance.palier !== undefined && r.endurance.palier !== null) {
            const vma = getVMAFromPalier(r.endurance.palier);
            if (vma !== null) vmaValue = vma.toFixed(1);
        }

        const nom = (e.nom || '').replace(/"/g, '""');
        const prenom = (e.prenom || '').replace(/"/g, '""');
        const sexe = (e.sexe || '').replace(/"/g, '""');
        const statut = (e.statut || 'present').replace(/"/g, '""');

        csv += `"${numero}";"${nom}";"${prenom}";"${sexe}";"${statut}"`;
        csv += `;"${r.endurance ? r.endurance.palier ?? '' : ''}"`;
        csv += `;"${r.endurance ? LIBELLES_GROUPES[r.endurance.groupe] || '' : ''}"`;
        csv += `;"${vmaValue}"`;
        csv += `;"${r.force ? r.force.meilleur ?? '' : ''}"`;
        csv += `;"${r.force ? LIBELLES_GROUPES[r.force.groupe] || '' : ''}"`;
        csv += `;"${r.vitesse ? r.vitesse.meilleur ?? '' : ''}"`;
        csv += `;"${r.vitesse ? LIBELLES_GROUPES[r.vitesse.groupe] || '' : ''}"`;
        csv += `;"${r.equilibre ? r.equilibre.temps ?? '' : ''}"`;
        csv += `;"${r.equilibre ? LIBELLES_GROUPES[r.equilibre.groupe] || '' : ''}"`;
        csv += `;"${r.coordination ? r.coordination.nb_lancers ?? '' : ''}"`;
        csv += `;"${r.coordination ? LIBELLES_GROUPES[r.coordination.groupe] || '' : ''}"`;
        csv += `;"${r.souplesse ? r.souplesse.meilleur ?? '' : ''}"`;
        csv += `;"${r.souplesse ? LIBELLES_GROUPES[r.souplesse.groupe] || '' : ''}"`;
        csv += `;"${r.endurance_musculaire ? r.endurance_musculaire.temps ?? '' : ''}"`;
        csv += `;"${r.endurance_musculaire ? LIBELLES_GROUPES[r.endurance_musculaire.groupe] || '' : ''}"`;
        csv += '\n';
    });

    return csv;
}


export function telechargerCSV(csv, nomFichier) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomFichier;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function exporterVersIDoceo(data, classe) {
    const csv = genererCSV(data, classe);
    const nomFichier = `EPS_Arena_Evaluation_${classe}_${new Date().toISOString().slice(0,10)}.csv`;
    telechargerCSV(csv, nomFichier);
}