// src/js/modules/natation/natation-koh-lanta-core.js
// Cœur partagé du mode « Koh Lanta » (natation).
// Contient uniquement les barèmes et le calcul de score, utilisés par
// le kiosk juge, le live prof et l'écran TV.

export const TUNNEL_BONUS = {
    vert: 5,
    orange: 10,
    rouge: 15
};

export const REMORQUAGE_BONUS = {
    vert: 5,
    orange: 10,
    rouge: 15
};

// Description des choix de remontées pour le parcours « sans aide ».
// value = nombre saisi (4 représente « 4 ou plus »).
export const REMONTEES_CONDITIONS = [
    { value: 0, couleur: 'rouge', bonus: 15, label: '0 remontée' },
    { value: 1, couleur: 'rouge', bonus: 15, label: '1 remontée' },
    { value: 2, couleur: 'orange', bonus: 10, label: '2 remontées' },
    { value: 3, couleur: 'orange', bonus: 10, label: '3 remontées' },
    { value: 4, couleur: 'vert', bonus: 5, label: '4+ remontées' }
];

// Déduit la couleur validée du contrat tunnel.
export function getTunnelCouleur(tunnelType, remontees) {
    if (tunnelType === 'corde') return 'vert';
    if (remontees <= 1) return 'rouge';
    if (remontees <= 3) return 'orange';
    return 'vert';
}

export function getTunnelBonus(tunnelType, remontees) {
    return TUNNEL_BONUS[getTunnelCouleur(tunnelType, remontees)];
}

export function getRemorquageBonus(remorquage) {
    return REMORQUAGE_BONUS[remorquage] || 0;
}

// Score = temps(s) + coups + (méduses × 5) − bonus tunnel − bonus remorquage.
// Le score peut être négatif : le plus bas gagne.
export function calculScoreKohLanta(attempt) {
    const tempsSec = (attempt.tempsMs || 0) / 1000;
    return tempsSec
        + (attempt.coups || 0)
        + ((attempt.meduses || 0) * 5)
        - getTunnelBonus(attempt.tunnelType, attempt.remontees)
        - getRemorquageBonus(attempt.remorquage);
}

export function formatScoreKohLanta(score) {
    if (score === null || score === undefined || isNaN(score)) return '--';
    return score.toFixed(1);
}

export function formatTempsKohLanta(ms) {
    if (!ms || ms <= 0) return '--:--.-';
    const totalSec = Math.floor(ms / 1000);
    const min = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const sec = String(totalSec % 60).padStart(2, '0');
    const dec = Math.floor((ms % 1000) / 100);
    return `${min}:${sec}.${dec}`;
}

// Libellés et couleurs pour affichage (couleurs Tailwind).
export function getTunnelInfos(tunnelType, remontees) {
    const couleur = getTunnelCouleur(tunnelType, remontees);
    const bonus = getTunnelBonus(tunnelType, remontees);
    if (tunnelType === 'corde') {
        return { couleur, bonus, label: 'Corde', description: 'Tunnel vert avec corde' };
    }
    const remonteeLabel = remontees >= 4 ? '4 ou plus' : String(remontees);
    return {
        couleur,
        bonus,
        label: `Sans aide (${remonteeLabel} remontée${remontees > 1 ? 's' : ''})`,
        description: `Tunnel ${couleur} sans aide`
    };
}

export function getRemorquageInfos(remorquage) {
    if (remorquage === 'orange') {
        return { couleur: 'orange', bonus: 10, label: 'Mannequin', description: 'Petit mannequin remorqué' };
    }
    if (remorquage === 'rouge') {
        return { couleur: 'rouge', bonus: 15, label: 'Mannequin + clapot', description: 'Petit mannequin remorqué avec clapot' };
    }
    return { couleur: 'vert', bonus: 5, label: 'Cerceau', description: 'Cerceau remorqué' };
}