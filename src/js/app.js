// src/js/app.js
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

    const select = document.getElementById('selectClasse');
    if (select) {
        const ecouterConfigClasse = () => {
            const classeActive = select.value;
            if (classeActive) {
                listenConfig(classeActive, (config) => {
                    updateState('equipesConfig', config.equipes || {});
                });
            }
        };
        select.addEventListener('change', ecouterConfigClasse);
        if (select.value) ecouterConfigClasse();
    }
}