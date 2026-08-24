// src/js/app.js
import { listenConfig } from './core/firebase-service.js';
import { updateState } from './core/state.js';

// Initialise l'application
export function initApp() {
    console.log("✅ EPS-Arena démarré !");
    listenConfig((config) => {
        updateState('equipesConfig', config.equipes || {});
    });
    
    // Ici, vous importerez et appellerez :
    // - initAdminUI() depuis './ui/dashboard-ui.js'
    // - initActivitiesUI() depuis './ui/action-ui.js'
}