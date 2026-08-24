// src/js/app.js
import { listenConfig } from './core/firebase-service.js';
import { updateState } from './core/state.js';
import { initLayout } from './ui/prof/layout.js';         // NOUVEAU : Gestion onglets, classes, connexion
import { initActivities } from './ui/prof/activities.js'; // NOUVEAU : Palette, génération équipes, CO
import { initAdminUI } from './ui/dashboard-ui.js';       // EXISTANT : Imports, photos, modales (on garde)

// Initialise l'application
export function initApp() {
    console.log("✅ EPS-Arena démarré !");
    
    // 1. Initialisation de la structure et de la connexion
    initLayout();

    // 2. Initialisation de l'interface Admin (imports, élèves, photos)
    initAdminUI();

    // 3. Initialisation de l'interface Activités (Sprint, CO, etc.)
    initActivities();

    // 4. Écoute de la config Firebase
    listenConfig((config) => {
        updateState('equipesConfig', config.equipes || {});
    });
}