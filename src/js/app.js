// src/js/app.js
import { listenConfig } from './core/firebase-service.js';
import { updateState } from './core/state.js';
import { initLayout } from './ui/prof/layout.js';
import { initActivities } from './ui/prof/activities.js';
import { initAdminUI } from './ui/dashboard-ui.js';
import { initLiveUI } from './ui/prof/live.js'; // Le Live gère maintenant la TV

export function initApp() {
    console.log("✅ EPS-Arena démarré !");
    initLayout();
    initAdminUI();
    initActivities();
    initLiveUI(); // Cette fonction gère le Live et l'onglet TV (via live.js)
    
    listenConfig((config) => {
        updateState('equipesConfig', config.equipes || {});
    });
}