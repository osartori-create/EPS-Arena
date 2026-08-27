// src/js/config/firebase-config.js
export const FIREBASE_CONFIG = {
    databaseURL: "https://eps-arena-default-rtdb.europe-west1.firebasedatabase.app/"
};

export const DB_PATHS = {
    // Racine par établissement (Code RNE)
    ETAB: 'etablissements/0680013V',
    // Le code prof sera ajouté dynamiquement (ex: /profs/MARTIN)
    CONFIG: 'etablissements/0680013V/profs/{profCode}/config',
    PASSAGES: 'etablissements/0680013V/profs/{profCode}/live/passages'
};