// src/js/modules/demi-fond/demifond-kiosk.js
// Dispatch vers le sous-module sélectionné

let cleanupCurrent = null;

export function initDemiFondKiosk(classe) {
    const container = document.getElementById('demi-fond-module');
    if (!container) {
        console.error('[DemiFond Kiosk] Conteneur #demi-fond-module introuvable');
        return;
    }

    // Détecter le sous-module actif via Firebase (config/sousModule)
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const basePath = `etablissements/0680013V/profs/${profCode}/${classe}/demi-fond/config`;

    import('../../core/firebase-service.js').then(({ db, ref, onValue }) => {
        onValue(ref(db, basePath), (snap) => {
            const config = snap.val();
            const sousModule = config?.sousModule || '3x5min';

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
            }
        }, { onlyOnce: true });
    });
}

export function cleanupDemiFondKiosk() {
    if (cleanupCurrent) {
        try { cleanupCurrent(); } catch (e) {}
        cleanupCurrent = null;
    }
}