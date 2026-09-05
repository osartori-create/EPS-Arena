// src/js/modules/badminton/badminton-registry.js
// Dictionnaire des modes Badminton

export const BADMINTON_MODES = {
    'terrain': {
        label: 'Classique',
        icon: '🏸',
        module: () => import('./badminton-terrain.js'),
        description: 'Jouez en cliquant sur les zones du terrain (3D)',
        default: true
    },
    'maniere': {
        label: 'Avec la manière',
        icon: '📊',
        module: () => import('./badminton-maniere.js'),
        description: 'Saisie des points avec cases à cocher (dangereux/central)'
    }
    // Ajoute ici tes futurs modes
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

// ✅ Alias pour compatibilité avec le dispatcher
export const getBadmintonModes = getModesList;