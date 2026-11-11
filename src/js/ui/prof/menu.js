// src/js/ui/prof/menu.js
// Menu latéral (data-driven), organisé en sections repliables.
// `view` = identifiant de vue existant (voir switchTab dans layout.js).
// `section` = libellé du groupe ; `icon` = emoji de la section (et de l'item).

export const MENU = [
    {
        id: 'eleves',
        icon: '👥',
        section: 'Élèves',
        items: [
            { id: 'presences', icon: '✅', label: 'Présences', view: 'presences' },
            { id: 'groupes', icon: '🧩', label: 'Groupes', view: 'groupes' },
            { id: 'plan', icon: '🪑', label: 'Plan de classe', view: 'plan' },
            { id: 'unss', icon: '🏟️', label: 'UNSS', view: 'unss' },
        ]
    },
    {
        id: 'organisation',
        icon: '🗂️',
        section: 'Organisation',
        items: [
            { id: 'admin', icon: '👨‍🏫', label: 'Administration', view: 'admin' },
            { id: 'planner', icon: '⏰', label: 'Emploi du temps', view: 'planner' },
            { id: 'calendrier', icon: '🗓️', label: 'Calendrier', view: 'calendrier' },
        ]
    },
    {
        id: 'evaluation',
        icon: '📋',
        section: 'Évaluation',
        items: [
            { id: 'evaluations', icon: '📝', label: 'Grilles', view: 'evaluations' },
        ]
    },
    {
        id: 'activites',
        icon: '🏅',
        section: 'Activités',
        items: [
            { id: 'activities', icon: '🎽', label: 'Modules sportifs', view: 'activities' },
            { id: 'cross', icon: '🏃', label: 'Cross', view: 'cross' },
        ]
    },
    {
        id: 'outils',
        icon: '🧰',
        section: 'Outils',
        items: [
            { id: 'tools', icon: '🔧', label: 'Utilitaires', view: 'tools' },
            { id: 'scancamera', icon: '📷', label: 'Scan Caméra', view: 'scancamera' },
            { id: 'sync', icon: '🔁', label: 'Sync', view: 'sync' },
        ]
    },
];
