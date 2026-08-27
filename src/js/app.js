import { listenConfig } from './core/firebase-service.js';
import { updateState } from './core/state.js';
import { initLayout } from './ui/prof/layout.js';
import { initActivities } from './ui/prof/activities.js';
import { initAdminUI } from './ui/dashboard-ui.js';
import { initLiveUI } from './ui/prof/live.js';

export function initApp() {
    console.log("✅ EPS-Arena démarré !");
    initLayout();
    initAdminUI();
    initActivities();
    initLiveUI();

    // On écoute la config de la classe sélectionnée
    const select = document.getElementById('selectClasse');
    const classeActive = select ? select.value : "";
    if (classeActive) {
        listenConfig(classeActive, (config) => {
            updateState('equipesConfig', config.equipes || {});
        });
    }
}