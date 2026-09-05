// src/js/modules/tournoi/tournoi-registry.js
// Enregistrement des variantes du tournoi

export const TOURNOI_VARIANTS = {
    'elimination': {
        id: 'elimination',
        label: 'Élimination',
        icon: '🏆',
        description: 'Comptage des éliminations (badminton, tennis de table...)',
        module: () => import('./variantes/elimination/index.js'),
        default: true
    }
    // Ajoute ici tes futures variantes
    // 'points': {
    //     id: 'points',
    //     label: 'Points',
    //     icon: '⭐',
    //     description: 'Comptage des points gagnés',
    //     module: () => import('./variantes/points/index.js'),
    //     default: false
    // },
    // 'equipes': {
    //     id: 'equipes',
    //     label: 'Par équipes',
    //     icon: '👥',
    //     description: 'Tournoi par équipes',
    //     module: () => import('./variantes/equipes/index.js'),
    //     default: false
    // }
};

export function getVariantConfig(id) {
    return TOURNOI_VARIANTS[id] || TOURNOI_VARIANTS['elimination'];
}

export function getAvailableVariants() {
    return Object.values(TOURNOI_VARIANTS);
}

export function getDefaultVariant() {
    for (const [id, config] of Object.entries(TOURNOI_VARIANTS)) {
        if (config.default) return id;
    }
    return 'elimination';
}

export function getVariantById(id) {
    return TOURNOI_VARIANTS[id] || null;
}