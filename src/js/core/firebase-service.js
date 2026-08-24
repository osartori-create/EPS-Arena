// src/js/core/firebase-service.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-app.js";
import { getDatabase, ref, onValue, push } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-database.js";
import { FIREBASE_CONFIG, DB_PATHS } from "../config/firebase-config.js";

const app = initializeApp(FIREBASE_CONFIG);
export const db = getDatabase(app);

export function listenConfig(callback) {
    const refConfig = ref(db, DB_PATHS.CONFIG);
    onValue(refConfig, (snapshot) => callback(snapshot.val() || {}));
}

export function listenPassages(callback) {
    const refPassages = ref(db, DB_PATHS.PASSAGES);
    onValue(refPassages, (snapshot) => callback(snapshot.val() || {}));
}

export function sendPassage(passageData) {
    const refPassages = ref(db, DB_PATHS.PASSAGES);
    return push(refPassages, passageData);
}