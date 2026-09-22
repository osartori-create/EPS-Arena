// src/js/modules/escalade/escalade-voies-config.js
// Constantes partagées du module « Suivi des réalisations ».
// Source de vérité unique pour les cotations, couleurs, niveaux de maîtrise, ressentis.
// Les SECTEURS (voies) et les BLOCS sont deux espaces de numérotation distincts.

// ============================================================
// COTATIONS (échelle française, de 3A à 7B avec les « + »)
// ============================================================
const NIVEAUX = ['3', '4', '5', '6', '7'];
const LETTRES = ['A', 'B', 'C'];

function construireCotations() {
    const liste = [];
    for (let n = 0; n < NIVEAUX.length; n++) {
        const base = NIVEAUX[n];
        // Pour le niveau 7 on s'arrête à 7B+ (pas de 7C).
        const lettres = (base === '7') ? ['A', 'B'] : LETTRES;
        lettres.forEach(lettre => {
            liste.push(`${base}${lettre}`);
            liste.push(`${base}${lettre}+`);
        });
    }
    return liste;
}

export const COTATIONS = construireCotations();

export const COTATION_INDEX = {};
COTATIONS.forEach((cot, i) => { COTATION_INDEX[cot] = i; });

export function niveauCotation(cot) {
    return parseInt(String(cot).charAt(0), 10);
}

export function maxCotation(a, b) {
    if (!a) return b;
    if (!b) return a;
    return (COTATION_INDEX[a] >= COTATION_INDEX[b]) ? a : b;
}

// ============================================================
// COULEURS DES PRISES (liste par défaut, extensible par le prof)
// ============================================================
export const COULEURS_BASE = ['bleue', 'rouge', 'verte', 'jaune', 'rose', 'orange', 'sable', 'toutes'];

export const COULEUR_LABELS = {
    bleue: 'Bleue',
    rouge: 'Rouge',
    verte: 'Verte',
    jaune: 'Jaune',
    rose: 'Rose',
    orange: 'Orange',
    sable: 'Sable',
    toutes: 'Toutes'
};

// Couleur hexadécimale approximative pour l'affichage des pastilles.
export const COULEUR_HEX = {
    bleue: '#3b82f6',
    rouge: '#ef4444',
    verte: '#22c55e',
    jaune: '#eab308',
    rose: '#ec4899',
    orange: '#f97316',
    sable: '#d6b98c',
    toutes: '#94a3b8'
};

// Couleur de repli pour les couleurs personnalisées sans hex.
export const COULEUR_HEX_DEFAUT = '#64748b';

// ============================================================
// NIVEAUX DE MAÎTRISE (ordre du plus encadré au plus autonome)
// ============================================================
export const MAITRISES = [
    { value: 'moulinette', label: 'Moulinette' },
    { value: 'moulinette-corde-molle', label: 'Moulinette corde molle' },
    { value: 'fausse-tete', label: 'Fausse-tête' },
    { value: 'tete', label: 'En tête' }
];

export const MAITRISE_LABELS = {};
MAITRISES.forEach(m => { MAITRISE_LABELS[m.value] = m.label; });

// ============================================================
// RESSENTI (choisi par l'élève)
// ============================================================
export const RESSENTIS = [
    { value: 'facile', label: 'Facile 😊', emoji: '😊' },
    { value: 'juste', label: 'Juste 🎯', emoji: '🎯' },
    { value: 'difficile', label: 'Difficile 💪', emoji: '💪' }
];

export const RESSENTI_LABELS = {};
RESSENTIS.forEach(r => { RESSENTI_LABELS[r.value] = r.label; });

// ============================================================
// HAUTEUR (le mur fait 9 m : réussite = 9, échec de 3 à 8 m)
// ============================================================
export const HAUTEUR_MUR = 9;
export const HAUTEUR_ECHEC_MIN = 3;

// ============================================================
// BADGES (seuils)
// ============================================================
export const BADGES = {
    volume: [
        { seuil: 1, id: 'premier-pas', emoji: '🥾', titre: 'Premier pas sur le mur' },
        { seuil: 10, id: 'lezard', emoji: '🦎', titre: 'Lézard du mur' },
        { seuil: 25, id: 'grimpeur-assidu', emoji: '🐒', titre: 'Grimpeur assidu' },
        { seuil: 50, id: 'falconnier', emoji: '🦅', titre: 'Falconnier' },
        { seuil: 100, id: 'habitue', emoji: '🧗', titre: 'Habitué des 9 mètres' }
    ],
    reussite: [
        { seuil: 1, id: 'top', emoji: '🌟', titre: 'Premier top !' },
        { seuil: 5, id: 'enchaineur', emoji: '🔗', titre: 'Enchaîneur' },
        { seuil: 20, id: 'maitre-voies', emoji: '👑', titre: 'Maître des voies' }
    ],
    niveau: [
        { niveau: 4, emoji: '🟢', titre: 'Étape 4 franchie' },
        { niveau: 5, emoji: '🟡', titre: 'Étape 5 franchie' },
        { niveau: 6, emoji: '🟠', titre: 'Étape 6 franchie' },
        { niveau: 7, emoji: '🔴', titre: 'Étape 7 franchie' }
    ]
};

// ============================================================
// CONFIGURATION PAR DÉFAUT
//  - secteurs : zones de voies numérotées 1..21 au bas du mur.
//  - blocs     : zones de bloc (numérotation indépendante, vide par défaut).
// ============================================================
export function construireSecteursDefaut() {
    const secteurs = {};
    for (let i = 1; i <= 21; i++) {
        const col = (i - 1) % 7;
        const row = Math.floor((i - 1) / 7);
        secteurs[String(i)] = {
            label: `Secteur ${i}`,
            x: 5 + (col * 15),
            y: 20 + (row * 30)
        };
    }
    return secteurs;
}

export function construireBlocsDefaut() {
    // Les blocs ont leur propre numérotation (1, 2, 3…) indépendante des secteurs.
    return {};
}