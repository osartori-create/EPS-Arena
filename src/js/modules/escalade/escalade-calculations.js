// src/js/modules/escalade/escalade-calculations.js

export const BAREME = {
    "4a": 1, "4b": 1.1, "4c": 1.2,
    "5a": 1.3, "5b": 1.4, "5c": 1.5,
    "6a": 1.6, "6b": 1.8, "6c": 2
};

// Fonction unique pour calculer les points d'escalade
export function calculateClimbingPoints({ hauteur, cotation, couleur = '', essai = 1 }) {
    const coeff = BAREME[cotation] || 1;
    
    // Bonus/Malus selon l'essai
    let bonusEssai = 1;
    if (essai === 1) bonusEssai = 1.2;
    else if (essai === 2) bonusEssai = 1;
    else bonusEssai = 0.8;

    // Bonus/Malus selon la couleur
    let bonusCouleur = (couleur === 'tc') ? 0.9 : 1;

    // Calcul : hauteur * coeff * bonusEssai * bonusCouleur
    const points = Number(hauteur) * coeff * bonusEssai * bonusCouleur;
    return Math.round(points * 10) / 10;
}