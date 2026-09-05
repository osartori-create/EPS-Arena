// src/js/modules/tournoi/variantes/elimination/elimination-core.js

import { getJoueurs, getCurrentClasse, updateJoueur, ajouterHistorique } from '../../tournoi-core.js';
// ✅ Chemin correct depuis variantes/elimination/ vers core/
import { db, ref, onValue, set } from '../../../../core/firebase-service.js';

let exclus = {};

export function getExclus() { return exclus; }

export function setExclus(data) {
    exclus = data;
    window.dispatchEvent(new CustomEvent('tournoi-updated'));
}

export function ajouterElimination(code) {
    if (!code || exclus[code]) return;
    const joueurs = getJoueurs();
    const currentElim = joueurs[code]?.eliminations || 0;
    updateJoueur(code, { eliminations: currentElim + 1 });
    ajouterHistorique({ code, action: 'elimine', timestamp: Date.now() });
}

export function reinitialiserJoueur(code) {
    if (!code) return;
    updateJoueur(code, { eliminations: 0 });
}

export function toggleExclure(code) {
    if (!code) return;
    const newExclus = { ...exclus };
    if (newExclus[code]) delete newExclus[code];
    else newExclus[code] = true;
    setExclus(newExclus);
}

export function reinitialiserTournoi() {
    if (!confirm('⚠️ Réinitialiser toutes les données du tournoi ?')) return;
    const classe = getCurrentClasse();
    const joueursRef = ref(db, getJoueursPath(classe));
    const historiqueRef = ref(db, getHistoriquePath(classe));
    set(joueursRef, {});
    set(historiqueRef, []);
    setExclus({});
}

export function init(classe) {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const exclusRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/tournoi/exclus`);
    onValue(exclusRef, (snap) => {
        exclus = snap.val() || {};
        window.dispatchEvent(new CustomEvent('tournoi-updated'));
    });
    return () => console.log('🧹 [Élimination] Nettoyage');
}