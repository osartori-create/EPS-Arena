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

// ✅ FONCTION DÉPLACÉE ICI (Logique spécifique Escalade)
export function coeffToCotation(coeff) {
    const echelle = [
        { cotation: '4a', coeff: 1.0 },
        { cotation: '4b', coeff: 1.1 },
        { cotation: '4c', coeff: 1.2 },
        { cotation: '5a', coeff: 1.3 },
        { cotation: '5b', coeff: 1.4 },
        { cotation: '5c', coeff: 1.5 },
        { cotation: '6a', coeff: 1.6 },
        { cotation: '6b', coeff: 1.8 },
        { cotation: '6c', coeff: 2.0 }
    ];
    let closest = echelle[0];
    let minDiff = Math.abs(coeff - echelle[0].coeff);
    for (let i = 1; i < echelle.length; i++) {
        const diff = Math.abs(coeff - echelle[i].coeff);
        if (diff < minDiff) { minDiff = diff; closest = echelle[i]; }
    }
    return closest.cotation;
}