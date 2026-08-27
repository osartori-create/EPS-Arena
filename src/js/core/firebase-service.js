import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-app.js";
import { getDatabase, ref, onValue, push, set, update, remove } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-database.js";
import { FIREBASE_CONFIG, DB_PATHS } from "../config/firebase-config.js";

const app = initializeApp(FIREBASE_CONFIG);
export const db = getDatabase(app);
export { ref, onValue, push, set, update, remove };

function getProfBasePath() {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    return `${DB_PATHS.ETAB}/profs/${profCode}`;
}

// ✅ Chemin unifié hiérarchique pour les performances
export function getPerformancePath(classe, activite) {
    return `${getProfBasePath()}/${classe}/${activite}/montees`;
}

// ✅ Écoute des données des élèves (chemins hiérarchiques)
export function listenToActivityData(classe, callback) {
    const refEscalade = ref(db, getPerformancePath(classe, 'escalade'));
    const refCO = ref(db, getPerformancePath(classe, 'co'));
    const refMulti = ref(db, getPerformancePath(classe, 'multi'));

    const unsubEscalade = onValue(refEscalade, (snap) => callback('escalade', snap.val() || {}));
    const unsubCO = onValue(refCO, (snap) => callback('co', snap.val() || {}));
    const unsubMulti = onValue(refMulti, (snap) => callback('multi', snap.val() || {}));

    return () => {
        unsubEscalade();
        unsubCO();
        unsubMulti();
    };
}

// ✅ Écoute de la configuration (avec la classe en paramètre !)
export function listenConfig(classe, callback) {
    const refConfig = ref(db, `${getProfBasePath()}/${classe}/config`);
    return onValue(refConfig, (snapshot) => callback(snapshot.val() || {}));
}

// Fonctions standards (ne pas toucher)
export function listenPassages(callback) {
    const refPassages = ref(db, `${getProfBasePath()}/live/passages`);
    return onValue(refPassages, (snapshot) => callback(snapshot.val() || {}));
}

export function sendPassage(passageData) {
    const refPassages = ref(db, `${getProfBasePath()}/live/passages`);
    return push(refPassages, passageData);
}