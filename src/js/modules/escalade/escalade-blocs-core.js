// src/js/modules/escalade/escalade-blocs-core.js
// Logique métier : calcul des points, progression, classement

// ============================================================
// Calcul de la valeur d’un bloc en fonction du nombre de validations
// ============================================================
export function calculerValeurBloc(nbValidations, valeurInitiale = 100, decote = 10) {
    // La valeur ne peut pas descendre en dessous de 0
    return Math.max(0, valeurInitiale - (nbValidations * decote));
}

// ============================================================
// Calcul des points d’un élève pour un bloc (mode figé ou évolutif)
// ============================================================
export function calculerPointsEleve(validation, validationsDuBloc, params) {
    const { valeurInitiale, decote, mode } = params;
    if (mode === 'fige') {
        // On utilise la valeur stockée au moment de la validation
        return validation.valeurAuMoment || 0;
    } else {
        // Mode évolutif : on recalcule en fonction du nombre total de validations du bloc
        const nbTotal = validationsDuBloc.length;
        return calculerValeurBloc(nbTotal, valeurInitiale, decote);
    }
}

// ============================================================
// Agrégation des données pour une classe
// ============================================================
export function agregerDonnees(validations, blocs, eleves, groupes, params) {
    // Structure retournée :
    // {
    //   eleves: { eleveId: { code, nom, prenom, groupe, blocs: { blocId: { points, valeur, timestamp } }, totalPoints } },
    //   groupes: { groupe: { totalPoints, nbEleves, nbBlocsValides } },
    //   blocs: { blocId: { nbValidations, valeurActuelle, eleves: [eleveId] } }
    // }

    const result = {
        eleves: {},
        groupes: {},
        blocs: {},
    };

    // Initialisation des groupes
    Object.keys(groupes).forEach(g => {
        result.groupes[g] = { totalPoints: 0, nbEleves: 0, nbBlocsValides: 0 };
    });

    // Initialisation des blocs
    blocs.forEach(b => {
        result.blocs[b.id] = { nbValidations: 0, valeurActuelle: params.valeurInitiale, eleves: [] };
    });

    // Initialisation des élèves
    eleves.forEach(e => {
        const groupe = trouverGroupe(e.id, groupes);
        if (!groupe) return; // élève non affecté à un groupe (peut arriver)
        result.eleves[e.id] = {
            code: e.code || e.id,
            nom: e.nom,
            prenom: e.prenom,
            groupe: groupe,
            blocs: {},
            totalPoints: 0,
            statut: e.statut || 'present',
        };
        result.groupes[groupe].nbEleves++;
    });

    // Parcours des validations
    const validationsArray = Object.values(validations);
    validationsArray.forEach(v => {
        const eleveId = v.eleveId;
        const blocId = v.blocId;
        if (!result.eleves[eleveId]) return; // élève inconnu ou non affecté
        if (!result.blocs[blocId]) return; // bloc inconnu

        // Incrémenter le compteur de validations du bloc
        result.blocs[blocId].nbValidations++;
        result.blocs[blocId].eleves.push(eleveId);

        // Calculer la valeur du bloc au moment de la validation (pour le mode figé)
        const nbAvant = result.blocs[blocId].nbValidations - 1;
        const valeurAuMoment = calculerValeurBloc(nbAvant, params.valeurInitiale, params.decote);

        // Stocker la validation dans l’élève
        const points = (params.mode === 'fige') ? valeurAuMoment : calculerValeurBloc(result.blocs[blocId].nbValidations, params.valeurInitiale, params.decote);
        result.eleves[eleveId].blocs[blocId] = {
            points: points,
            valeur: valeurAuMoment,
            timestamp: v.timestamp,
        };
        result.eleves[eleveId].totalPoints += points;

        // Mettre à jour le total du groupe
        const groupe = result.eleves[eleveId].groupe;
        result.groupes[groupe].totalPoints += points;
        result.groupes[groupe].nbBlocsValides++;
    });

    // Mise à jour des valeurs actuelles des blocs (pour affichage)
    Object.keys(result.blocs).forEach(blocId => {
        const nb = result.blocs[blocId].nbValidations;
        result.blocs[blocId].valeurActuelle = calculerValeurBloc(nb, params.valeurInitiale, params.decote);
    });

    return result;
}

// ============================================================
// Fonction utilitaire pour trouver le groupe d’un élève
// ============================================================
function trouverGroupe(eleveId, groupes) {
    for (const [groupe, ids] of Object.entries(groupes)) {
        if (ids.includes(eleveId)) return groupe;
    }
    return null;
}

// ============================================================
// Génération du classement (élèves et groupes)
// ============================================================
export function genererClassement(dataAgregees) {
    const classementEleves = Object.values(dataAgregees.eleves)
        .filter(e => e.statut === 'present') // on exclut absents/inaptes
        .sort((a, b) => b.totalPoints - a.totalPoints);

    const classementGroupes = Object.entries(dataAgregees.groupes)
        .map(([groupe, stats]) => ({ groupe, ...stats }))
        .sort((a, b) => b.totalPoints - a.totalPoints);

    return { classementEleves, classementGroupes };
}

// ============================================================
// Export iDoceo : génération du CSV
// ============================================================
export function genererCSVBlocContest(dataAgregees, blocs) {
    const eleves = Object.values(dataAgregees.eleves).filter(e => e.statut === 'present');
    const entete = ['"!groupe"', '"Nom"', '"Prénom"', '"Code"', ...blocs.map(b => `"${b.label}"`), '"Total Points"'];
    const lignes = [entete.join(';')];

    eleves.forEach(e => {
        const ligne = [
            `"${e.groupe}"`,
            `"${e.nom}"`,
            `"${e.prenom}"`,
            `"${e.code}"`,
            ...blocs.map(b => {
                const bloc = e.blocs[b.id];
                return bloc ? `"${bloc.points}"` : '""';
            }),
            `"${e.totalPoints}"`
        ];
        lignes.push(ligne.join(';'));
    });

    return '\uFEFF' + lignes.join('\n');
}