// src/js/core/current-classe.js
// Lecture de la classe active — SANS dépendance Firebase.
// Permet aux modules 100 % locaux (Carnet : appel, groupes, plan, planner…)
// de fonctionner hors connexion sans tirer firebase-service.js.
export function getCurrentClasse() {
    let select = document.getElementById('selectClasse');
    if (!select) {
        select = document.getElementById('class-select');
    }
    return select ? select.value : '';
}

// ------------------------------------------------------------------
// Abonnement au changement de classe (sans Firebase).
// Un seul listener global sur #selectClasse, plusieurs abonnés.
// ------------------------------------------------------------------
const ecouteurs = new Set();
let listenerAttache = false;

function attacherListenerClasse() {
    if (listenerAttache) return;
    const el = document.getElementById('selectClasse');
    if (!el) return;
    listenerAttache = true;
    el.addEventListener('change', () => {
        const classe = getCurrentClasse();
        ecouteurs.forEach(fn => {
            try { fn(classe); } catch (e) { console.error('[current-classe] Erreur listener :', e); }
        });
    });
}

export function onClasseChange(cb) {
    if (typeof cb !== 'function') return;
    ecouteurs.add(cb);
    attacherListenerClasse();
}
