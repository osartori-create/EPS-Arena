// src/js/modules/badminton/badminton-registry.js
// Dictionnaire des modes de jeu Badminton

export const BADMINTON_MODES = {
    'terrain': {
        label: 'Terrain',
        icon: '🏸',
        module: () => import('./badminton-terrain.js'),
        description: 'Clique sur les zones du terrain 3D. Classement par points V/D (3/1/0).',
        default: true
    },
    'maniere': {
        label: 'Avec la manière',
        icon: '📊',
        module: () => import('./badminton-maniere.js'),
        description: 'Cases à cocher (dangereuse/centrale). Bonus manière à 8 pts. Classement 5/3/2/1.'
    }
};

export function getModeConfig(modeId) {
    return BADMINTON_MODES[modeId] || BADMINTON_MODES['terrain'];
}

export function getAvailableModes() {
    return Object.keys(BADMINTON_MODES);
}

export function getModeLabel(modeId) {
    return BADMINTON_MODES[modeId]?.label || modeId;
}

export function getDefaultMode() {
    for (const [id, config] of Object.entries(BADMINTON_MODES)) {
        if (config.default) return id;
    }
    return 'terrain';
}

export function getModesList() {
    return Object.entries(BADMINTON_MODES).map(([id, config]) => ({
        id,
        label: config.label,
        icon: config.icon,
        description: config.description,
        isDefault: config.default || false
    }));
}

// Alias pour compatibilité
export const getBadmintonModes = getModesList;