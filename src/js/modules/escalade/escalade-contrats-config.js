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
    { id: 'pieds', label: 'Pieds (pose précise)' },
    { id: 'ppm', label: 'Pieds-pieds-mains-mains' },
    { id: 'equilibre', label: 'Équilibre' }
];

// Épreuves grimpeur possibles (score parlant).
export const EPREUVES_GRIMPEUR = [
    { id: 'degaines', label: 'Dégaines atteintes' },
    { id: 'degaines-moyenne', label: 'Dégaines / ascensions' },
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
// type : 'degaines' | 'degaines-moyenne' | 'degaines-erreurs' | 'degaines-cotation' | 'degaines-cotation-erreurs'
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

function contratGrimpeur(id, couleur, label, descriptif, epreuves) {
    return { id, couleur, label, descriptif, mode: 'grimpeur', epreuves };
}

function contratsGrimpeurDefaut() {
    const BLEU = '#3b82f6';
    return [
        // Du plus accessible au plus exigeant (couleurs libres, éditable).
        // Le numéro (1, 2, 3…) est attribué automatiquement selon l'ordre des
        // contrats d'une même couleur.
        // « Je cherche X » = objectif calculé depuis l'épreuve (sommet + critères).
        contratGrimpeur('jaune', '#eab308', 'Jaune', 'Atteindre le sommet', [
            epreuve('degaines')
        ]),
        contratGrimpeur('vert-1', '#22c55e', 'Vert', 'Atteindre le sommet', [
            epreuve('degaines')
        ]),
        contratGrimpeur('vert-2', '#22c55e', 'Vert', 'Sommet en régularité (dégaines / ascensions)', [
            epreuve('degaines-moyenne')
        ]),
        contratGrimpeur('bleu-1', BLEU, 'Bleu', 'Sommet avec au plus 1 erreur Pieds', [
            epreuve('degaines-erreurs', { erreurType: 'pieds', erreursMax: 1 })
        ]),
        contratGrimpeur('bleu-2', BLEU, 'Bleu', 'Sommet avec au plus 1 erreur Pieds-pieds-mains-mains', [
            epreuve('degaines-erreurs', { erreurType: 'ppm', erreursMax: 1 })
        ]),
        contratGrimpeur('bleu-3', BLEU, 'Bleu', 'Sommet avec au plus 1 erreur Équilibre', [
            epreuve('degaines-erreurs', { erreurType: 'equilibre', erreursMax: 1 })
        ]),
        contratGrimpeur('bleu-4', BLEU, 'Bleu', 'Sommet avec au plus 1 erreur (Pieds + PPM + Équilibre)', [
            epreuve('degaines-erreurs', { erreurType: 'toutes', erreursMax: 1 })
        ]),
        contratGrimpeur('rouge', '#ef4444', 'Rouge', 'Sommet avec cotation 5a', [
            epreuve('degaines-cotation', { cotationChiffre: 5, cotationLettre: 'a' })
        ]),
        contratGrimpeur('noir', '#111827', 'Noir', 'Sommet avec cotation 5a et au plus 1 erreur', [
            epreuve('degaines-cotation-erreurs', { erreurType: 'toutes', erreursMax: 1, cotationChiffre: 5, cotationLettre: 'a' })
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

function contratEchelleAssureur(id, couleur, label, descriptif, idsCompetences, seuil) {
    const competences = COMPETENCES_ASSUREUR
        .filter(c => idsCompetences.includes(c.id))
        .map(c => ({ ...c }));
    return { id, couleur, label, descriptif, mode: 'echelle', competences, seuil };
}

function contratsAssureurDefaut() {
    return [
        contratEchelleAssureur('orange', '#f97316', 'Orange', 'Contre-assureur en hauteur', ['s-equiper', 's-encorder', 'verifier', 'communiquer', 'vigilant'], 10),
        contratEchelleAssureur('vert', '#22c55e', 'Vert', 'Assurer en moulinette', ['s-equiper', 's-encorder', 'frein', 'equilibrer', 'verifier', 'communiquer', 'cinq-temps', 'preparer-descente', 'assurer-descente', 'enrayer-chute', 'vigilant'], 22),
        contratEchelleAssureur('bleu', '#3b82f6', 'Bleu', 'Assurer en moulinette en hauteur', TOUTES_ASSUREUR, 24),
        contratEchelleAssureur('rouge', '#ef4444', 'Rouge', 'Assurer en moulinette haute confortablement', TOUTES_ASSUREUR, 30),
        contratEchelleAssureur('noir', '#111827', 'Noir', 'Assurer et grimper en tête', TOUTES_ASSUREUR, 36)
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
        { id: 'vert', couleur: '#22c55e', label: 'Vert', descriptif: 'Sécurité passive plutôt respectée', mode: 'echelle', competences: competencesCitoyen(base7), seuil: 15 },
        { id: 'bleu', couleur: '#3b82f6', label: 'Bleu', descriptif: 'Sécurité passive respectée', mode: 'echelle', competences: competencesCitoyen(base7), seuil: 16 },
        { id: 'rouge', couleur: '#ef4444', label: 'Rouge', descriptif: 'Sécurité passive respectée', mode: 'echelle', competences: competencesCitoyen(base7), seuil: 17 },
        { id: 'noir', couleur: '#111827', label: 'Noir', descriptif: 'Sécurité respectée + initiatives', mode: 'echelle', competences: competencesCitoyen([...base7, 'epi', 'aider']), seuil: 24 }
    ];
}

