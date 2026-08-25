import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-app.js";
import { getDatabase, ref, onValue, push, set, update, remove } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-database.js";
import { FIREBASE_CONFIG, DB_PATHS } from "../../config/firebase-config.js";

const app = initializeApp(FIREBASE_CONFIG);
export const db = getDatabase(app);

export { ref, onValue, push, set, update, remove };

function getProfBasePath() {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    return `${DB_PATHS.ETAB}/profs/${profCode}`;
}

export function listenConfig(callback) {
    const refConfig = ref(db, `${getProfBasePath()}/config`);
    return onValue(refConfig, (snapshot) => callback(snapshot.val() || {}));
}

export function listenPassages(callback) {
    const refPassages = ref(db, `${getProfBasePath()}/live/passages`);
    return onValue(refPassages, (snapshot) => callback(snapshot.val() || {}));
}

export function sendPassage(passageData) {
    const refPassages = ref(db, `${getProfBasePath()}/live/passages`);
    return push(refPassages, passageData);
}