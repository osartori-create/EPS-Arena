// src/js/core/firebase-service.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-app.js";
import { getDatabase, ref, onValue, push, set, update, remove } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-database.js";
import { FIREBASE_CONFIG, DB_PATHS } from "../config/firebase-config.js"; // ✅ CORRIGÉ (un seul ../)

const app = initializeApp(FIREBASE_CONFIG);
export const db = getDatabase(app);

// Exportation des fonctions utilitaires pour les modules
export { ref, onValue, push, set, update, remove };

// 🔑 Fonction pour construire le chemin de base du professeur (dynamique)
function getProfBasePath() {
    // On récupère le code prof enregistré dans le localStorage (ex: "MARTIN")
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    
    // Construction du chemin : etablissements/0680013V/profs/MARTIN
    return `${DB_PATHS.ETAB}/profs/${profCode}`;
}

// Écoute de la config globale (pour le professeur)
export function listenConfig(callback) {
    // Chemin : etablissements/0680013V/profs/MARTIN/config
    const refConfig = ref(db, `${getProfBasePath()}/config`);
    return onValue(refConfig, (snapshot) => callback(snapshot.val() || {}));
}

// Écoute des passages (pour le live)
export function listenPassages(callback) {
    // Chemin : etablissements/0680013V/profs/MARTIN/live/passages
    const refPassages = ref(db, `${getProfBasePath()}/live/passages`);
    return onValue(refPassages, (snapshot) => callback(snapshot.val() || {}));
}

// Envoi d'un passage
export function sendPassage(passageData) {
    const refPassages = ref(db, `${getProfBasePath()}/live/passages`);
    return push(refPassages, passageData);
}

// NOUVELLE FONCTION : Écoute les données des élèves pour une classe donnée
export function listenToActivityData(className, callback) {
    // Chemin : {classe}/escalade/montees, {classe}/co/validations, {classe}/multi/performances
    const refEscalade = ref(db, `${className}/escalade/montees`);
    const refCO = ref(db, `${className}/co/validations`);
    const refMulti = ref(db, `${className}/multi/performances`);

    const unsubscribeEscalade = onValue(refEscalade, (snap) => {
        callback('escalade', snap.val() || {});
    });

    const unsubscribeCO = onValue(refCO, (snap) => {
        callback('co', snap.val() || {});
    });

    const unsubscribeMulti = onValue(refMulti, (snap) => {
        callback('multi', snap.val() || {});
    });

    // Retourne une fonction pour couper les écoutes si on change de classe
    return () => {
        unsubscribeEscalade();
        unsubscribeCO();
        unsubscribeMulti();
    };
}