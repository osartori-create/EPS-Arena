// src/js/modules/badminton/badminton-firebase.js
// Communication Firebase

import { db, ref, onValue, update } from '../../core/firebase-service.js';

export function listenBadmintonConfig(classe, callback) {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const configRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/config`);
    return onValue(configRef, (snap) => {
        callback(snap.val() || {});
    });
}

export function listenBadmintonResults(classe, terrain, callback) {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const resultsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/badminton/results`);
    return onValue(resultsRef, (snap) => {
        const data = snap.val() || {};
        const filtered = {};
        Object.keys(data).forEach(key => {
            if (data[key].terrain === terrain) filtered[key] = data[key];
        });
        callback(filtered);
    });
}

export function saveBadmintonResult(classe, matchId, data) {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const resultRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/badminton/results/${matchId}`);
    return update(resultRef, data);
}