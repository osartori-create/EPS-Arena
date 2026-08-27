import { listenConfig } from './core/firebase-service.js';
import { updateState } from './core/state.js';
import { initLayout } from './ui/prof/layout.js';
import { initActivities } from './ui/prof/activities.js';
import { initAdminUI } from './ui/dashboard-ui.js';
import { initLiveUI } from './ui/prof/live.js';

export function initApp() {
    console.log("✅ EPS-Arena démarré !");
    
    // Initialisation des modules UI
    initLayout();
    initAdminUI();
    initActivities();
    initLiveUI();

    // On attend que la liste des classes soit chargée, puis on écoute la config
    const select = document.getElementById('selectClasse');
    if (select) {
        // Fonction pour écouter la config de la classe sélectionnée
        const ecouterConfigClasse = () => {
            const classeActive = select.value;
            if (classeActive) {
                listenConfig(classeActive, (config) => {
                    updateState('equipesConfig', config.equipes || {});
                });
            }
        };

        // Écoute quand on change de classe
        select.addEventListener('change', ecouterConfigClasse);

        // Si une classe est déjà présélectionnée au chargement, on écoute tout de suite
        if (select.value) ecouterConfigClasse();
    }
}