// src/js/modules/tournoi/tournoi-registry.js
export const TOURNOI_VARIANTS = {
    'elimination': {
        id: 'elimination',
        label: 'Élimination',
        icon: '🏆',
        description: 'Comptage des éliminations (kiosque élève)',
        module: () => import('./variantes/elimination/index.js'),
        default: true
    },
    'atp': {
        id: 'atp',
        label: 'ATP',
        icon: '🎾',
        description: 'Classement continu par points (badminton, ping-pong)',
        module: () => import('./variantes/atp/index.js')
    }
};

export function getVariantConfig(id) {
    return TOURNOI_VARIANTS[id] || TOURNOI_VARIANTS['elimination'];
}

export function getDefaultVariant() { return 'elimination'; }