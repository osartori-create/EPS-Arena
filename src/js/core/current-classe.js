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
