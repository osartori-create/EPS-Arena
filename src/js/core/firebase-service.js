// src/js/core/firebase-service.js
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, push } from "firebase/database";
import { FIREBASE_CONFIG, DB_PATHS } from "../config/firebase-config.js";

const app = initializeApp(FIREBASE_CONFIG);
const db = getDatabase(app);

// Écoute de la configuration (équipes, activités) pour le Prof et les Élèves
export function listenConfig(callback) {
    const refConfig = ref(db, DB_PATHS.CONFIG);
    onValue(refConfig, (snapshot) => callback(snapshot.val() || {}));
}

// Écoute des passages (pour le classement live)
export function listenPassages(callback) {
    const refPassages = ref(db, DB_PATHS.PASSAGES);
    onValue(refPassages, (snapshot) => callback(snapshot.val() || {}));
}

// Envoi d'un passage (par le contrôleur Sprint/Poursuite)
export function sendPassage(passageData) {
    const refPassages = ref(db, DB_PATHS.PASSAGES);
    return push(refPassages, passageData);
}