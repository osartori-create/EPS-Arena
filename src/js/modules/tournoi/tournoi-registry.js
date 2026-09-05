// src/js/modules/tournoi/tournoi-registry.js

export const TOURNOI_VARIANTS = {
    'elimination': {
        id: 'elimination',
        label: 'Élimination',
        icon: '🏆',
        description: 'Comptage des éliminations',
        module: () => import('./variantes/elimination/index.js'),
        default: true
    }
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