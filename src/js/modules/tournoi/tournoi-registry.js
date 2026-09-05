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

export function getDefaultVariant() { return 'elimination'; }