// src/js/modules/escalade/escalade-contrats-config.js
// Constantes et configuration par défaut du module « Contrats » escalade.
// - Le « sommet » (nb de dégaines max) est paramétrable et partagé.
// - Les couleurs des contrats sont libres (éditables côté prof).

export const NB_DEGAINES_DEFAUT = 7;

// Cotation : lettre -> valeur numérique (a=1, b=2, c=3).
export const COTATION_LETTRES = { a: 1, b: 2, c: 3 };
export const COTATION_CHIFFRES = [3, 4, 5, 6, 7];

// Codes erreurs par défaut (repris du document du collègue) + saisie libre.
export const ERREURS_DEFAUT = [
    { id: 'pose-precise-pieds', label: 'Pose précise des pieds' },
    { id: 'ppm', label: 'Pieds-pieds-mains-mains' },
    { id: 'equilibre', label: 'Équilibre' },
    { id: 'tractions', label: 'Tractions (trop de bras)' }
];

// Épreuves grimpeur possibles (score parlant).
export const EPREUVES_GRIMPEUR = [
    { id: 'degaines', label: 'Dégaines atteintes' },
    { id: 'degaines-erreurs', label: 'Dégaines + score erreur' },
    { id: 'degaines-cotation', label: 'Dégaines + cotation' },
    { id: 'degaines-cotation-erreurs', label: 'Dégaines + cotation + score erreur' }
];

// ============================================================
// CONFIGURATION PAR DÉFAUT
// ============================================================
export function construireConfigContratsDefaut() {
    return {
        actif: true,
        seance: 1,
        sequence: 'Séquence 1',
        nbDegainesMax: NB_DEGAINES_DEFAUT,
        erreurs: ERREURS_DEFAUT.map(e => ({ ...e })),
        roles: [
            { id: 'grimpeur', label: 'Grimpeur', actif: true, contrats: contratsGrimpeurDefaut() },
            { id: 'assureur', label: 'Assureur', actif: true, contrats: contratsAssureurDefaut() },
            { id: 'citoyen', label: 'Citoyen', actif: false, contrats: contratsCitoyenDefaut() }
        ]
    };
}

// ============================================================
// GRIMPEUR — contrats « score parlant »
// ============================================================
// Fabrique une épreuve grimpeur (score parlant).
// type : 'degaines' | 'degaines-erreurs' | 'degaines-cotation' | 'degaines-cotation-erreurs'
function epreuve(type, opts = {}) {
    return {
        type,
        erreurType: opts.erreurType ?? null,
        exigeSommet: opts.exigeSommet !== false,
        cibleDegaines: opts.cibleDegaines ?? null,
        erreursMax: opts.erreursMax ?? 0,
        cotationChiffre: opts.cotationChiffre ?? 5,
        cotationLettre: opts.cotationLettre ?? 'a'
    };
}

function contratGrimpeur(id, label, couleur, epreuves) {
    return { id, label, couleur, mode: 'grimpeur', epreuves };
}

function contratsGrimpeurDefaut() {
    const types = ['pose-precise-pieds', 'ppm', 'equilibre', 'tractions'];
    return [
        // Du plus accessible au plus exigeant (couleurs libres, éditable).
        // Chaque niveau peut comporter PLUSIEURS épreuves.
        contratGrimpeur('jaune', 'Jaune', '#eab308', [
            epreuve('degaines')
        ]),
        contratGrimpeur('vert', 'Vert', '#22c55e', types.map(t => epreuve('degaines-erreurs', { erreurType: t, erreursMax: 1 }))),
        contratGrimpeur('bleu', 'Bleu', '#3b82f6', [
            ...types.map(t => epreuve('degaines-erreurs', { erreurType: t, erreursMax: 0 })),
            epreuve('degaines-erreurs', { erreurType: 'toutes', erreursMax: 2 })
        ]),
        contratGrimpeur('rouge', 'Rouge', '#ef4444', [
            epreuve('degaines-cotation', { cotationChiffre: 5, cotationLettre: 'a' })
        ]),
        contratGrimpeur('noir', 'Noir', '#111827', [
            epreuve('degaines-cotation-erreurs', { erreurType: 'toutes', erreursMax: 0, cotationChiffre: 5, cotationLettre: 'a' })
        ])
    ];
}

// ============================================================
// ASSUREUR — contrats « échelle 1-3 »
// ============================================================
const COMPETENCES_ASSUREUR = [
    { id: 's-equiper', label: `S'équiper du baudrier` },
    { id: 's-encorder', label: `S'encorder (double huit + nœud d'arrêt)` },
    { id: 'frein', label: 'Installer le frein' },
    { id: 'equilibrer', label: 'Équilibrer la cordée' },
    { id: 'verifier', label: 'Vérifier / faire vérifier la chaîne' },
    { id: 'communiquer', label: 'Communiquer' },
    { id: 'cinq-temps', label: 'Assurer en 5 temps (moulinette)' },
    { id: 'preparer-descente', label: 'Préparer la descente' },
    { id: 'assurer-descente', label: 'Assurer la descente' },
    { id: 'enrayer-chute', label: 'Enrayer une chute' },
    { id: 'vigilant', label: 'Rester vigilant / proche du mur' },
    { id: 'tension', label: 'Gérer la tension de la corde' }
];

const TOUTES_ASSUREUR = COMPETENCES_ASSUREUR.map(c => c.id);

function contratEchelleAssureur(id, label, couleur, idsCompetences, seuil) {
    const competences = COMPETENCES_ASSUREUR
        .filter(c => idsCompetences.includes(c.id))
        .map(c => ({ ...c }));
    return { id, label, couleur, mode: 'echelle', competences, seuil };
}

function contratsAssureurDefaut() {
    return [
        contratEchelleAssureur('orange', 'Orange', '#f97316', ['s-equiper', 's-encorder', 'verifier', 'communiquer', 'vigilant'], 10),
        contratEchelleAssureur('vert', 'Vert', '#22c55e', ['s-equiper', 's-encorder', 'frein', 'equilibrer', 'verifier', 'communiquer', 'cinq-temps', 'preparer-descente', 'assurer-descente', 'enrayer-chute', 'vigilant'], 22),
        contratEchelleAssureur('bleu', 'Bleu', '#3b82f6', TOUTES_ASSUREUR, 24),
        contratEchelleAssureur('rouge', 'Rouge', '#ef4444', TOUTES_ASSUREUR, 30),
        contratEchelleAssureur('noir', 'Noir', '#111827', TOUTES_ASSUREUR, 36)
    ];
}

// ============================================================
// CITOYEN — contrats « échelle 1-3 » (rôle optionnel, désactivé)
// ============================================================
const COMPETENCES_CITOYEN = [
    { id: 'routines-sae', label: 'Respecter les routines sur la SAE (hauteur max, pas de doigts dans les plaquettes)' },
    { id: 'materiel', label: 'Utiliser le matériel comme il est prévu' },
    { id: 'verif-materiel', label: 'Prendre le matériel, se faire vérifier, ranger le matériel' },
    { id: 'regles-eps', label: `Respecter les règles d'EPS (tenue, cheveux, bijoux, échauffement, ponctualité)` },
    { id: 'tapis', label: 'Placer et replacer les tapis' },
    { id: 'calme', label: 'Respecter le calme dans le cours (communication, relations, déplacements)' },
    { id: 'aide', label: `Demander de l'aide en cas d'incertitude ou signaler un problème` },
    { id: 'epi', label: 'Vérifier son matériel (EPI)' },
    { id: 'aider', label: 'Aider ses camarades' }
];

function competencesCitoyen(ids) {
    return COMPETENCES_CITOYEN.filter(c => ids.includes(c.id)).map(c => ({ ...c }));
}

function contratsCitoyenDefaut() {
    const base7 = ['routines-sae', 'materiel', 'verif-materiel', 'regles-eps', 'tapis', 'calme', 'aide'];
    return [
        { id: 'vert', label: 'Vert', couleur: '#22c55e', mode: 'echelle', competences: competencesCitoyen(base7), seuil: 15 },
        { id: 'bleu', label: 'Bleu', couleur: '#3b82f6', mode: 'echelle', competences: competencesCitoyen(base7), seuil: 16 },
        { id: 'rouge', label: 'Rouge', couleur: '#ef4444', mode: 'echelle', competences: competencesCitoyen(base7), seuil: 17 },
        { id: 'noir', label: 'Noir', couleur: '#111827', mode: 'echelle', competences: competencesCitoyen([...base7, 'epi', 'aider']), seuil: 24 }
    ];
}

