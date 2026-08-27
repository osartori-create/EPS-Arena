export const FIREBASE_CONFIG = {
    databaseURL: "https://eps-arena-default-rtdb.europe-west1.firebasedatabase.app/"
};

export const DB_PATHS = {
    ETAB: 'etablissements/0680013V',
    CONFIG: 'etablissements/0680013V/profs/{profCode}/config',
    PASSAGES: 'etablissements/0680013V/profs/{profCode}/live/passages'
};

// Fonction centralisée pour obtenir le chemin des performances d'une activité
export function getPerformancePath(classe, activite) {
    // Chemin unique : {classe}/{activite}/performances
    return `${classe}/${activite}/performances`;
}