import { listenConfig } from './core/firebase-service.js';
import { updateState } from './core/state.js';
import { initLayout } from './ui/prof/layout.js';
import { initActivities } from './ui/prof/activities.js';
import { initAdminUI } from './ui/dashboard-ui.js';

export function initApp() {
    console.log("✅ EPS-Arena démarré !");
    initLayout();
    initAdminUI();
    initActivities();
    listenConfig((config) => {
        updateState('equipesConfig', config.equipes || {});
    });
}