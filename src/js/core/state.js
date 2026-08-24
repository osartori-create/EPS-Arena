// src/js/core/state.js
export const state = {
    activeClasse: "",
    activeActivite: "sprint", // sprint, poursuite, etc.
    equipesConfig: {}, // Récupérées depuis Firebase
    equipeConnectee: "", // Ex: "EQ1"
    maillotConnecte: "", // Ex: "Jaune", "Bleu"
    scoreEnDirect: {} // Pour l'affichage du dashboard
};

export function updateState(key, value) {
    state[key] = value;
    // (Optionnel : émettre un événement personnalisé pour notifier l'UI)
}