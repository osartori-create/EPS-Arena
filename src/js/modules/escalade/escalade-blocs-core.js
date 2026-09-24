// src/js/modules/escalade/escalade-blocs-core.js
// Logique métier : calcul des points, progression, classement,
// réussites/échecs, habiletés et hiérarchie des blocs.

// ============================================================
// HABILETÉS MOTRICES PAR DÉFAUT (catalogue proposé à la config)
// ============================================================
export const HABILETES_DEFAUT = [
    'Équilibre',
    'Coordination',
    'Placement',
    'Poussée de jambes',
    'Lecture de voie',
    'Grip / Préhension'
];

// ============================================================
// Calcul de la valeur d'un bloc en fonction du nombre de validations
// ============================================================
export function calculerValeurBloc(nbValidations, valeurInitiale = 100, decote = 10) {
    // La valeur ne peut pas descendre en dessous de 0
    return Math.max(0, valeurInitiale - (nbValidations * decote));
}

// ============================================================
// Normalisation d'une habileté (sous forme de string unifiée)
// ============================================================
function labelHabilete(h) {
    if (typeof h === 'string') return h;
    if (h && (h.label || h.id)) return h.label || h.id;
    return String(h || '');
}

// ============================================================
// Agrégation des données pour une classe
// ============================================================
// Chaque validation peut être :
//   { eleveId/code, blocId, reussite: true|false, timestamp, valeurAuMoment? }
// (rétro-compat : une validation sans champ `reussite` est considérée réussie)
//
// Un élève peut faire plusieurs tentatives sur un même bloc (échec puis
// réussite). La réussite n'est comptabilisée qu'une seule fois pour les points.
export function agregerDonnees(validations, blocs, eleves, groupes, params) {
    const result = {
        eleves: {},
        groupes: {},
        blocs: {},
        habiletes: {}, // catalogue global { label: { label, tentatives, reussites, taux } }
    };

    // Initialisation des groupes
    Object.keys(groupes).forEach(g => {
        result.groupes[g] = { totalPoints: 0, nbEleves: 0, nbBlocsValides: 0 };
    });

    // Initialisation des blocs + catalogue des habiletés
    const blocsDef = blocs.map(b => ({
        id: b.id,
        label: b.label || b.id,
        couleur: b.couleur || '#3b82f6',
        ordre: b.ordre || 0,
        habiletes: b.habiletes || [],
    }));

    blocsDef.forEach(b => {
        result.blocs[b.id] = {
            id: b.id,
            label: b.label,
            couleur: b.couleur,
            ordre: b.ordre,
            habiletes: b.habiletes,
            tentatives: 0,
            reussites: 0,
            nbValidations: 0, // rétro-compat (== reussites)
            valeurActuelle: params.valeurInitiale,
            eleves: [],
            tauxReussite: null
        };

        b.habiletes.forEach(h => {
            const label = labelHabilete(h);
            if (!label) return;
            if (!result.habiletes[label]) {
                result.habiletes[label] = { label, tentatives: 0, reussites: 0, taux: null };
            }
        });
    });

    // Index code anonyme → ID réel. Chaque groupe `{ A: [id1, id2] }`
    // implique `A1 → id1`, `A2 → id2`, etc.
    const codeVersId = {};
    Object.entries(groupes).forEach(([lettre, ids]) => {
        (ids || []).forEach((id, index) => {
            codeVersId[`${lettre}${index + 1}`] = id;
        });
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
            habiletes: {},
            totalPoints: 0,
            statut: e.statut || 'present',
        };
        result.groupes[groupe].nbEleves++;
    });

    // Traitement chronologique : garantit une valeur "figée" correcte
    // (la décote dépend de l'ordre des réussites).
    const validationsArray = Object.values(validations)
        .filter(v => v && v.eleveId !== undefined && v.blocId !== undefined)
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    validationsArray.forEach(v => {
        let eleveId = v.eleveId;
        if (!result.eleves[eleveId] && codeVersId[eleveId]) {
            eleveId = codeVersId[eleveId];
        }
        const blocId = v.blocId;
        if (!result.eleves[eleveId]) return; // élève inconnu ou non affecté
        if (!result.blocs[blocId]) return; // bloc inconnu

        const eleve = result.eleves[eleveId];
        const bloc = result.blocs[blocId];
        const reussite = v.reussite !== false;

        // L'élève avait-il déjà réussi ce bloc avant cette tentative ?
        const dejaReussi = !!(eleve.blocs[blocId] && eleve.blocs[blocId].reussite);
        const reussitesAvant = bloc.reussites;

        // Compteurs globaux du bloc
        bloc.tentatives++;
        if (reussite) bloc.reussites++;
        bloc.nbValidations = bloc.reussites;

        // Agrégation par habileté (globale + par élève)
        bloc.habiletes.forEach(h => {
            const label = labelHabilete(h);
            if (!label) return;

            if (!result.habiletes[label]) {
                result.habiletes[label] = { label, tentatives: 0, reussites: 0, taux: null };
            }
            result.habiletes[label].tentatives++;
            if (reussite) result.habiletes[label].reussites++;

            const eh = eleve.habiletes[label] || { reussites: 0, tentatives: 0 };
            eh.tentatives++;
            if (reussite) eh.reussites++;
            eleve.habiletes[label] = eh;
        });

        // Mise à jour de l'état de l'élève sur ce bloc
        if (!eleve.blocs[blocId]) {
            eleve.blocs[blocId] = {
                reussite: false,
                points: 0,
                tentatives: 0,
                reussites: 0,
                valeur: null,
                timestamp: null
            };
        }
        const eb = eleve.blocs[blocId];
        eb.tentatives++;
        if (reussite) {
            eb.reussites++;
            eb.reussite = true;
            eb.valeur = calculerValeurBloc(reussitesAvant, params.valeurInitiale, params.decote);
            eb.timestamp = v.timestamp;
        }

        // Points : uniquement au premier succès (pas de double comptage).
        if (reussite && !dejaReussi) {
            const points = (params.mode === 'fige')
                ? calculerValeurBloc(reussitesAvant, params.valeurInitiale, params.decote)
                : calculerValeurBloc(bloc.reussites, params.valeurInitiale, params.decote);

            eb.points = points;
            eleve.totalPoints += points;

            const grp = eleve.groupe;
            result.groupes[grp].totalPoints += points;
            result.groupes[grp].nbBlocsValides++;
        }

        // Un seul ajout à la liste des grimpeurs ayant réussi ce bloc.
        if (reussite && !dejaReussi) {
            bloc.eleves.push(eleveId);
        }
    });

    // Mise à jour des valeurs actuelles + taux de réussite des blocs
    Object.keys(result.blocs).forEach(blocId => {
        const b = result.blocs[blocId];
        b.valeurActuelle = calculerValeurBloc(b.reussites, params.valeurInitiale, params.decote);
        b.tauxReussite = b.tentatives > 0 ? Math.round((b.reussites / b.tentatives) * 100) : null;
    });

    // Taux de réussite des habiletés
    Object.keys(result.habiletes).forEach(label => {
        const h = result.habiletes[label];
        h.taux = h.tentatives > 0 ? Math.round((h.reussites / h.tentatives) * 100) : null;
    });

    return result;
}

// ============================================================
// Hiérarchie des blocs : du moins réussi (le plus stratégique)
// au plus réussi. Les blocs jamais tentés sont placés en fin.
// ============================================================
export function hierarchiserBlocs(dataAgregees) {
    return Object.values(dataAgregees.blocs).sort((a, b) => {
        const ta = a.tentatives === 0 ? null : a.tauxReussite;
        const tb = b.tentatives === 0 ? null : b.tauxReussite;
        if (ta === null && tb === null) return (a.ordre || 0) - (b.ordre || 0);
        if (ta === null) return 1;
        if (tb === null) return -1;
        if (ta !== tb) return ta - tb;
        return (a.ordre || 0) - (b.ordre || 0);
    });
}

// ============================================================
// Fonction utilitaire pour trouver le groupe d'un élève
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
// Export CSV (iDoceo) — conservé pour compatibilité
// ============================================================
export function genererCSVBlocContest(dataAgregees, blocs) {
    const eleves = Object.values(dataAgregees.eleves).filter(e => e.statut === 'present');
    const entete = ['"Groupe"', '"Nom de famille"', '"Prénom"', '"Code"', ...blocs.map(b => `"${b.label}"`), '"Total Points"'];
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