// src/js/modules/badminton/badminton-kiosk.js
import { db, ref, onValue, update } from '../../core/firebase-service.js';

let currentClasse = '';
let currentTerrain = '';
let currentCode = '';
let playersList = []; // Liste des lettres (A, B, C...) pour le terrain
let matchSchedule = [];
let currentMatchIndex = 0;

export function initBadmintonKiosk(classe, code) {
    currentClasse = classe;
    // Le code est au format "Terrain_Code" (ex: "1_A")
    const parts = code.split('_');
    currentTerrain = parts[0];
    currentCode = parts[1];

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const configRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/config`);

    onValue(configRef, (snap) => {
        const config = snap.val() || {};
        if (config.activite !== 'badminton') return;

        // Le nombre de joueurs sur le terrain est envoyé dans config[currentTerrain]
        const nbJoueurs = config[currentTerrain] || 0;
        const lettres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
        
        playersList = [];
        for (let i = 0; i < nbJoueurs; i++) {
            playersList.push(lettres[i]);
        }

        if (playersList.length < 2) {
            document.getElementById('badminton-content').innerHTML = '<p class="text-white text-center p-6">En attente des autres joueurs...</p>';
            return;
        }

        generateRoundRobin();
        renderInterface();
        listenForScoreUpdates();
    });
}

// --- GÉNÉRATION DU ROUND ROBIN ---
function generateRoundRobin() {
    matchSchedule = [];
    const n = playersList.length;
    
    // Si n est impair, on ajoute un joueur fantôme (BYE)
    let list = [...playersList];
    if (n % 2 !== 0) {
        list.push('BYE');
    }

    const totalRounds = list.length - 1;
    const half = list.length / 2;

    let arr = list.slice(1);
    for (let r = 0; r < totalRounds; r++) {
        let roundArr = [list[0], ...arr];
        
        for (let i = 0; i < half; i++) {
            let p1 = roundArr[i];
            let p2 = roundArr[list.length - 1 - i];
            
            // On ignore les matchs contre "BYE"
            if (p1 !== 'BYE' && p2 !== 'BYE') {
                matchSchedule.push({ id: `${currentTerrain}_${r}_${i}`, p1, p2, s1: null, s2: null });
            }
        }
        
        // Rotation
        arr.push(arr.shift());
    }
    
    // On trie les matchs pour que l'élève joue d'abord ses propres matchs (pratique)
    matchSchedule.sort((a, b) => {
        if (a.p1 === currentCode || a.p2 === currentCode) return -1;
        if (b.p1 === currentCode || b.p2 === currentCode) return 1;
        return 0;
    });
}

// --- INTERFACE TACTILE ---
function renderInterface() {
    const container = document.getElementById('badminton-content');
    container.innerHTML = `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 mb-4 text-center">
            <h2 class="text-2xl font-black text-white">Terrain ${currentTerrain}</h2>
            <p class="text-slate-400">Vous êtes le joueur <span class="text-blue-400 font-black text-3xl">${currentCode}</span></p>
        </div>

        <div id="match-display" class="bg-slate-900 p-6 rounded-3xl border-4 border-blue-500 text-center">
            <!-- Le match en cours sera injecté ici -->
        </div>

        <div id="classement-terrain" class="mt-4 bg-slate-800 p-4 rounded-2xl border border-slate-700">
            <h3 class="font-black text-blue-400 uppercase text-sm mb-2">Classement</h3>
            <div id="classement-content" class="space-y-2"></div>
        </div>
    `;

    displayNextMatch();
}

function displayNextMatch() {
    const display = document.getElementById('match-display');
    if (!display) return;

    // Trouver le prochain match non joué impliquant l'élève, sinon le premier non joué
    let match = matchSchedule.find(m => (m.p1 === currentCode || m.p2 === currentCode) && m.s1 === null);
    if (!match) match = matchSchedule.find(m => m.s1 === null);

    if (!match) {
        display.innerHTML = `
            <div class="text-5xl mb-4">🏆</div>
            <p class="text-xl font-black text-white mb-4">Tous les matchs sont terminés !</p>
            <p class="text-slate-400">Consultez le classement.</p>
        `;
        updateStandings();
        return;
    }

    // Empêcher l'élève de jouer un match qui ne le concerne pas
    if (match.p1 !== currentCode && match.p2 !== currentCode) {
        // Pas son match : on l'affiche en spectateur
        display.innerHTML = `
            <p class="text-lg font-black text-white mb-2">Match en cours :</p>
            <p class="text-4xl font-black text-yellow-400">${match.p1} vs ${match.p2}</p>
            <p class="text-slate-400 mt-2">Ce n'est pas votre match, patientez...</p>
        `;
    } else {
        display.innerHTML = `
            <p class="text-lg font-black text-white mb-2">Votre prochain match :</p>
            <p class="text-4xl font-black text-yellow-400">Vous (${currentCode}) vs ${match.p1 === currentCode ? match.p2 : match.p1}</p>
            
            <div class="mt-6 grid grid-cols-2 gap-4">
                <div>
                    <label class="text-xs font-bold text-slate-400 uppercase">Votre score</label>
                    <input type="number" id="score-me" min="0" max="30" placeholder="21" class="w-full bg-slate-950 text-center text-3xl font-black text-white border-2 border-slate-600 rounded-xl p-2 mt-1">
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-400 uppercase">Score adverse</label>
                    <input type="number" id="score-opp" min="0" max="30" placeholder="0" class="w-full bg-slate-950 text-center text-3xl font-black text-white border-2 border-slate-600 rounded-xl p-2 mt-1">
                </div>
            </div>

            <button onclick="submitScore('${match.id}', '${match.p1}', '${match.p2}')" class="mt-6 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-3xl text-xl uppercase active:scale-95 transition-transform">✅ Valider le score</button>
        `;
    }
}

// Exposer la fonction globalement
window.submitScore = function(matchId, p1, p2) {
    const scoreMe = parseInt(document.getElementById('score-me').value);
    const scoreOpp = parseInt(document.getElementById('score-opp').value);

    if (isNaN(scoreMe) || isNaN(scoreOpp) || scoreMe < 0 || scoreOpp < 0) {
        alert("Veuillez saisir des scores valides.");
        return;
    }

    // On vérifie que c'est bien le match de l'élève pour éviter la triche
    if (p1 !== currentCode && p2 !== currentCode) {
        alert("Vous ne pouvez pas valider ce match !");
        return;
    }

    let s1, s2;
    if (p1 === currentCode) {
        s1 = scoreMe; s2 = scoreOpp;
    } else {
        s1 = scoreOpp; s2 = scoreMe;
    }

    // Envoi vers Firebase (uniquement des codes !)
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const resultRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/badminton/results/${matchId}`);
    
    update(resultRef, {
        terrain: currentTerrain,
        p1: p1,
        p2: p2,
        s1: s1,
        s2: s2,
        timestamp: Date.now()
    })
    .then(() => {
        // Mise à jour locale
        const match = matchSchedule.find(m => m.id === matchId);
        if (match) {
            match.s1 = s1;
            match.s2 = s2;
        }
        displayNextMatch();
        updateStandings();
    })
    .catch(err => alert("Erreur envoi : " + err.message));
};

// --- ÉCOUTE DES SCORES (classement en direct) ---
function listenForScoreUpdates() {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const resultsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${currentClasse}/badminton/results`);
    
    onValue(resultsRef, (snap) => {
        const data = snap.val() || {};
        
        // Mettre à jour localement les scores des matchs de ce terrain
        matchSchedule.forEach(m => {
            const result = data[m.id];
            if (result && result.terrain === currentTerrain) {
                m.s1 = result.s1;
                m.s2 = result.s2;
            }
        });

        // On rafraîchit l'affichage si on ne regarde pas un formulaire
        if (document.getElementById('match-display')) {
            const current = document.querySelector('#match-display input');
            if (!current) displayNextMatch();
        }
        updateStandings();
    });
}

// --- CLASSEMENT DU TERRAIN ---
function updateStandings() {
    const container = document.getElementById('classement-content');
    if (!container) return;

    const standings = {};
    playersList.forEach(p => standings[p] = { pts: 0, wins: 0, losses: 0, diff: 0 });

    matchSchedule.forEach(m => {
        if (m.s1 === null) return;
        const s1 = m.s1, s2 = m.s2;
        
        // Points : Victoire = 3, Défaite = 1 (ou 0 si blessé, mais ici on prend simple)
        if (s1 > s2) {
            standings[m.p1].pts += 3;
            standings[m.p1].wins++;
            standings[m.p1].diff += (s1 - s2);
            standings[m.p2].losses++;
            standings[m.p2].diff -= (s1 - s2);
        } else {
            standings[m.p2].pts += 3;
            standings[m.p2].wins++;
            standings[m.p2].diff += (s2 - s1);
            standings[m.p1].losses++;
            standings[m.p1].diff -= (s2 - s1);
        }
    });

    const sorted = Object.entries(standings).sort((a, b) => b[1].pts - a[1].pts || b[1].diff - a[1].diff);
    
    let html = '';
    sorted.forEach(([player, data], idx) => {
        const isMe = player === currentCode ? 'bg-blue-900 border-blue-500' : 'bg-slate-900 border-slate-700';
        html += `
            <div class="flex items-center justify-between p-2 rounded-xl border ${isMe}">
                <div class="flex items-center gap-3">
                    <span class="font-black text-slate-500 w-6">${idx + 1}</span>
                    <span class="font-black text-xl text-white">${player}</span>
                    ${isMe ? '<span class="text-[10px] text-blue-300">(Vous)</span>' : ''}
                </div>
                <div class="flex gap-4 text-xs font-black">
                    <span class="text-emerald-400">${data.wins} V</span>
                    <span class="text-red-400">${data.losses} D</span>
                    <span class="text-yellow-400">${data.pts} pts</span>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}