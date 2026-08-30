// src/js/modules/badminton/badminton-kiosk.js
import { db, ref, onValue, push, update } from '../../core/firebase-service.js';

let currentClasse = '';
let currentTerrain = '';
let currentCode = '';
let players = [];
let matchSchedule = [];

export function initBadmintonKiosk(classe, code) {
    currentClasse = classe;
    // code est au format "1_A" (Terrain_Code)
    const parts = code.split('_');
    currentTerrain = parts[0];
    currentCode = parts[1];

    // Écoute la config du prof (nombre de terrains, joueurs par terrain)
    const configRef = ref(db, `etablissements/0680013V/profs/${localStorage.getItem('eps_arena_profCode') || 'DEFAULT'}/${classe}/badminton/config`);
    onValue(configRef, (snap) => {
        const config = snap.val() || {};
        // Ici, on peut récupérer les listes des joueurs du terrain depuis Firebase si le prof a transmis
        // Sinon, on génère le round robin localement avec les codes.
        generateRoundRobin();
    });
}

function generateRoundRobin() {
    // Récupération des joueurs du terrain
    // Pour cet exemple, on suppose que le prof a envoyé les joueurs via config
    // (sinon on utilise une liste par défaut locale)
    
    // ALGORITHME ROUND ROBIN (Rotation) :
    // Exemple avec 4 joueurs [A, B, C, D]
    // J1 : A-B, C-D
    // J2 : A-C, B-D
    // J3 : A-D, B-C

    players = ['A', 'B', 'C', 'D']; // Remplacer par la vraie liste reçue
    matchSchedule = [];

    if (players.length < 2) return;

    const n = players.length;
    const rounds = n - 1;
    const half = n / 2;

    let arr = players.slice(1); // On fixe le premier joueur et on fait tourner les autres
    for (let r = 0; r < rounds; r++) {
        let roundMatches = [];
        let roundArr = [players[0], ...arr];

        for (let i = 0; i < half; i++) {
            roundMatches.push({ p1: roundArr[i], p2: roundArr[n - 1 - i] });
        }

        matchSchedule.push(...roundMatches);
        
        // Rotation
        arr.push(arr.shift());
    }

    renderMatches();
}

function renderMatches() {
    // Affiche la liste des matchs avec les boutons pour envoyer le score
    // Ex: "Match 1 : A vs B" -> [Saisir Score]
    // L'élève clique, remplit le score (ex: 21-15), et envoie via Firebase.
}