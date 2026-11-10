// src/js/ui/prof/menu.js
// Menu latéral (data-driven). Pour ajouter une entrée : ajouter un objet.
// `view` = identifiant de vue existant (voir switchTab dans layout.js).
// `section` = libellé du groupe. `icon` = emoji affiché en mode replié.

export const MENU = [
    {
        section: 'Ma classe',
        items: [
            { id: 'admin', icon: '👨‍🏫', label: 'Administration', view: 'admin' },
            { id: 'presences', icon: '✅', label: 'Présences', view: 'presences' },
        ]
    },
    {
        section: 'Évaluation',
        items: [
            { id: 'evaluations', icon: '📋', label: 'Évaluations', view: 'evaluations' },
        ]
    },
    {
        section: 'Activités',
        items: [
            { id: 'activities', icon: '⚙️', label: 'Activités', view: 'activities' },
            { id: 'cross', icon: '🏃', label: 'Cross', view: 'cross' },
        ]
    },
    {
        section: 'Outils',
        items: [
            { id: 'tools', icon: '🧰', label: 'Outils', view: 'tools' },
            { id: 'scancamera', icon: '📷', label: 'Scan Caméra', view: 'scancamera' },
            { id: 'sync', icon: '🔁', label: 'Sync', view: 'sync' },
        ]
    },
];
