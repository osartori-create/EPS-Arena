// src/js/app.js
import { listenConfig } from './core/firebase-service.js';
import { updateState } from './core/state.js';
import { initAdminUI } from './ui/dashboard-ui.js';

// Initialise l'application
export function initApp() {
    console.log("✅ EPS-Arena démarré !");
    
    // Initialisation de l'UI (Appel une seule fois)
    initAdminUI();

    // Écoute de la config
    listenConfig((config) => {
        updateState('equipesConfig', config.equipes || {});
    });
}