// src/js/modules/demi-fond/demifond-kiosk.js
// Dispatch vers le sous-module sélectionné (écoute continue de la config).
import { getEtab, db, ref, onValue } from '../../core/firebase-service.js';

let cleanupCurrent = null;
let configListener = null;

export function initDemiFondKiosk(classe) {
    const container = document.getElementById('demi-fond-module');
    if (!container) {
        console.error('[DemiFond Kiosk] Conteneur #demi-fond-module introuvable');
        return;
    }

    if (configListener) configListener();

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const basePath = `${getEtab()}/profs/${profCode}/${classe}/demi-fond/config`;

    // État de chargement immédiat, le temps de lire la config Firebase.
    container.innerHTML = '<div class="text-center py-10 text-slate-400"><p class="text-xl">⏳ Chargement du 1/2 Fond...</p></div>';

    // Écoute continue : si le prof transmet sa config après l'ouverture du kiosk,
    // le kiosk se met à jour automatiquement.
    configListener = onValue(ref(db, basePath), (snap) => {
        const config = snap.val();
        const sousModule = config?.sousModule || '3x5min';
        console.log('[DemiFond Kiosk] config reçue :', config, '| sousModule =', sousModule);

        if (cleanupCurrent) {
            try { cleanupCurrent(); } catch (e) {}
            cleanupCurrent = null;
        }

        if (sousModule === '3x5min') {
            import('./variantes/trois-cinq-min/trois-cinq-min-kiosk.js')
                .then(m => {
                    cleanupCurrent = m.initTroisCinqMinKiosk(classe) || null;
                })
                .catch(err => {
                    console.error('[DemiFond] Erreur chargement kiosque:', err);
                    container.innerHTML = `<p class="text-red-400 text-center">❌ Erreur : ${err.message}</p>`;
                });
        } else if (sousModule === 'enchainement') {
            import('./variantes/enchainement/enchainement-kiosk.js')
                .then(m => {
                    cleanupCurrent = m.initEnchainementKiosk(classe) || null;
                })
                .catch(err => {
                    console.error('[DemiFond] Erreur chargement kiosque:', err);
                    container.innerHTML = `<p class="text-red-400 text-center">❌ Erreur : ${err.message}</p>`;
                });
        } else if (sousModule === 'rectangle-vitesses') {
            import('./variantes/rectangle-vitesses/rectangle-vitesses-kiosk.js')
                .then(m => {
                    cleanupCurrent = m.initRectangleVitessesKiosk(classe) || null;
                })
                .catch(err => {
                    console.error('[DemiFond] Erreur chargement kiosque:', err);
                    container.innerHTML = `<p class="text-red-400 text-center">❌ Erreur : ${err.message}</p>`;
                });
        } else {
            container.innerHTML = '<p class="text-slate-400 text-center">Sous-module 1/2 Fond inconnu.</p>';
        }
    });
}

export function cleanupDemiFondKiosk() {
    if (configListener) {
        configListener();
        configListener = null;
    }
    if (cleanupCurrent) {
        try { cleanupCurrent(); } catch (e) {}
        cleanupCurrent = null;
    }
}