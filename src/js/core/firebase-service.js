// src/js/core/firebase-service.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-app.js";
import { getDatabase, ref, onValue, push, set, update, remove } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-database.js";
import { FIREBASE_CONFIG, DB_PATHS } from "../config/firebase-config.js";

const app = initializeApp(FIREBASE_CONFIG);
export const db = getDatabase(app);

// Exportation des fonctions utilitaires pour les modules
export { ref, onValue, push, set, update, remove };

// Écoute de la config globale (pour le professeur)
export function listenConfig(callback) {
    const refConfig = ref(db, DB_PATHS.CONFIG);
    return onValue(refConfig, (snapshot) => callback(snapshot.val() || {}));
}

// Écoute des passages (pour le live)
export function listenPassages(callback) {
    const refPassages = ref(db, DB_PATHS.PASSAGES);
    return onValue(refPassages, (snapshot) => callback(snapshot.val() || {}));
}

// Envoi d'un passage
export function sendPassage(passageData) {
    const refPassages = ref(db, DB_PATHS.PASSAGES);
    return push(refPassages, passageData);
}