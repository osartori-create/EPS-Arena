// src/js/modules/tournoi/variantes/elimination/elimination-core.js
// Logique spécifique à la variante Élimination

import { getJoueurs, getHistorique, getConfig, getCurrentClasse, updateJoueur, ajouterHistorique } from '../../tournoi-core.js';
import { db, ref, onValue, set } from '../../../../core/firebase-service.js';

let exclus = {};

export function getExclus() { return exclus; }

export function setExclus(data) {
    exclus = data;
    window.dispatchEvent(new CustomEvent('tournoi-updated'));
}

export function ajouterElimination(code) {
    if (!code) return;
    if (exclus[code]) return;

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
    if (newExclus[code]) {
        delete newExclus[code];
    } else {
        newExclus[code] = true;
    }
    setExclus(newExclus);
}

export function reinitialiserTournoi() {
    if (!confirm('⚠️ Réinitialiser toutes les données du tournoi ?')) return;
    const classe = getCurrentClasse();
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const joueursRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/tournoi/joueurs`);
    const historiqueRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/tournoi/historique`);
    const exclusRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/tournoi/exclus`);
    set(joueursRef, {});
    set(historiqueRef, []);
    setExclus({});
}

// ✅ Renommée pour éviter le conflit
export function initEliminationCore(classe) {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const exclusRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/tournoi/exclus`);
    onValue(exclusRef, (snap) => {
        exclus = snap.val() || {};
        window.dispatchEvent(new CustomEvent('tournoi-updated'));
    });
    
    return () => {
        console.log('🧹 [Élimination] Nettoyage');
    };
}

// Point d'entrée pour le dispatcher
export function init(classe) {
    return initEliminationCore(classe);
}