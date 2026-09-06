// src/js/modules/tournoi/tournoi-core.js
import { db, ref, onValue, set, update, push } from '../../core/firebase-service.js';

let currentClasse = '';
let joueurs = {};
let historique = [];
let config = {};

function getBasePath(classe) {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    return `etablissements/0680013V/profs/${profCode}/${classe}/tournoi`;
}

// ✅ Exporter ces fonctions pour qu'elles soient accessibles
export function getJoueursPath(classe) { return `${getBasePath(classe)}/joueurs`; }
export function getHistoriquePath(classe) { return `${getBasePath(classe)}/historique`; }
export function getConfigPath(classe) { return `${getBasePath(classe)}/config`; }

function getJoueursPath(classe) { return `${getBasePath(classe)}/joueurs`; }
function getHistoriquePath(classe) { return `${getBasePath(classe)}/historique`; }
function getConfigPath(classe) { return `${getBasePath(classe)}/config`; }

export function initTournoiCore(classe) {
    currentClasse = classe;
    joueurs = {};
    historique = [];
    config = {};

    onValue(ref(db, getJoueursPath(classe)), snap => {
        joueurs = snap.val() || {};
        window.dispatchEvent(new CustomEvent('tournoi-updated'));
    });
    onValue(ref(db, getHistoriquePath(classe)), snap => {
        historique = snap.val() || [];
        window.dispatchEvent(new CustomEvent('tournoi-updated'));
    });
    onValue(ref(db, getConfigPath(classe)), snap => {
        config = snap.val() || {};
        window.dispatchEvent(new CustomEvent('tournoi-updated'));
    });
}

export function getJoueurs() { return joueurs; }
export function getHistorique() { return historique; }
export function getConfig() { return config; }
export function getCurrentClasse() { return currentClasse; }
export { currentClasse };

export function setJoueurs(data) { set(ref(db, getJoueursPath(currentClasse)), data); }
export function setHistorique(data) { set(ref(db, getHistoriquePath(currentClasse)), data); }
export function setConfig(data) { set(ref(db, getConfigPath(currentClasse)), data); }
export function updateJoueur(code, data) { update(ref(db, getJoueursPath(currentClasse)), { [code]: data }); }
export function ajouterHistorique(entry) { push(ref(db, getHistoriquePath(currentClasse)), entry); }

export function exportTournoiData() {
    if (!currentClasse) return alert('Sélectionnez une classe.');
    const data = { version: 1, classe: currentClasse, date: new Date().toISOString().slice(0,10).replace(/-/g,''), joueurs, historique, config };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tournoi_${currentClasse}_${data.date}.json`;
    a.click();
}

export function importTournoiData(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.classe) throw new Error('Format invalide.');
            setJoueurs(data.joueurs || {});
            setHistorique(data.historique || []);
            setConfig(data.config || {});
            alert('✅ Tournoi importé avec succès !');
        } catch (err) { alert('❌ Erreur d\'import : ' + err.message); }
    };
    reader.readAsText(file);
}