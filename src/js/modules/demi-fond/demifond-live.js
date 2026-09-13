// src/js/modules/demi-fond/demifond-live.js
// Dispatch vers le sous-module actif

let currentUnsub = null;

export function renderDemiFondLive() {
    const container = document.getElementById('live-content');
    if (!container) return;

    const select = document.getElementById('selectClasse');
    const classe = select ? select.value : '';

    if (!classe) {
        container.innerHTML = '<p class="text-slate-500 text-center">Sélectionnez une classe.</p>';
        return;
    }

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const configPath = `etablissements/0680013V/profs/${profCode}/${classe}/demi-fond/config`;

    import('../../core/firebase-service.js').then(({ db, ref, onValue }) => {
        onValue(ref(db, configPath), (snap) => {
            const config = snap.val();
            const sousModule = config?.sousModule || '3x5min';

            if (currentUnsub) {
                try { currentUnsub(); } catch (e) {}
                currentUnsub = null;
            }

            if (sousModule === '3x5min') {
                import('./variantes/trois-cinq-min/trois-cinq-min-live.js')
                    .then(m => {
                        currentUnsub = m.renderTroisCinqMinLive() || null;
                    })
                    .catch(err => {
                        console.error('[DemiFond Live] Erreur:', err);
                        container.innerHTML = `<p class="text-red-400 text-center">❌ ${err.message}</p>`;
                    });
            }
        }, { onlyOnce: true });
    });
}

export function cleanupDemiFondLive() {
    if (currentUnsub) {
        try { currentUnsub(); } catch (e) {}
        currentUnsub = null;
    }
}