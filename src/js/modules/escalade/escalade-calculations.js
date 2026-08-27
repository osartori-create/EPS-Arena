// src/js/modules/escalade/escalade-calculations.js

// Fonction unique pour calculer les points d'escalade
export function calculateClimbingPoints({ hauteur, cotation, couleur = '', essai = 1 }) {
    const BAREME = {
        "4a": 1, "4b": 1.1, "4c": 1.2,
        "5a": 1.3, "5b": 1.4, "5c": 1.5,
        "6a": 1.6, "6b": 1.8, "6c": 2
    };

    // 1. Récupérer le coefficient
    const coeff = BAREME[cotation] || 1;

    // 2. Bonus/Malus selon le nombre d'essais (1er essai = 20% bonus, 2e = normal, 3e+ = -20%)
    let bonusEssai = 1;
    if (essai === 1) bonusEssai = 1.2;
    else if (essai === 2) bonusEssai = 1;
    else bonusEssai = 0.8;

    // 3. Bonus/Malus selon la couleur (TC = Toutes Couleurs, plus difficile)
    let bonusCouleur = (couleur === 'tc') ? 0.9 : 1;

    // 4. Calcul final : hauteur * coefficient * bonusEssai * bonusCouleur
    const points = hauteur * coeff * bonusEssai * bonusCouleur;

    // Arrondir à 1 décimale
    return Math.round(points * 10) / 10;
}