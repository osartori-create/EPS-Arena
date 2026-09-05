// src/js/modules/badminton/badminton-core.js
// Logique métier : Round Robin, classement, calcul des points "Avec la manière"

import { SEUIL_MANIERE, POINTS_CLASSEMENT } from './badminton-utils.js';

export function generateRoundRobin(players) {
    const schedule = [];
    const n = players.length;
    let list = [...players];
    if (n % 2 !== 0) list.push('BYE');

    const totalRounds = list.length - 1;
    const half = list.length / 2;
    let arr = list.slice(1);

    for (let r = 0; r < totalRounds; r++) {
        let roundArr = [list[0], ...arr];
        for (let i = 0; i < half; i++) {
            let p1 = roundArr[i];
            let p2 = roundArr[list.length - 1 - i];
            if (p1 !== 'BYE' && p2 !== 'BYE') {
                schedule.push({
                    id: `${r}_${i}`,
                    p1, p2,
                    score1: null, score2: null,
                    pts1: null, pts2: null,
                    style1: null, style2: null,
                    s1: null, s2: null // compatibilité ancien format
                });
            }
        }
        arr.push(arr.shift());
    }
    return schedule;
}

export function calculerPointsMatch(score1, score2) {
    let pts1, pts2, avecManiere1, avecManiere2, winner, loser;

    avecManiere1 = score1 >= SEUIL_MANIERE;
    avecManiere2 = score2 >= SEUIL_MANIERE;

    if (score1 > score2) {
        winner = 'p1'; loser = 'p2';
        pts1 = avecManiere1 ? POINTS_CLASSEMENT.GAGNE_AVEC : POINTS_CLASSEMENT.GAGNE_SANS;
        pts2 = avecManiere2 ? POINTS_CLASSEMENT.PERDU_AVEC : POINTS_CLASSEMENT.PERDU_SANS;
    } else if (score2 > score1) {
        winner = 'p2'; loser = 'p1';
        pts2 = avecManiere2 ? POINTS_CLASSEMENT.GAGNE_AVEC : POINTS_CLASSEMENT.GAGNE_SANS;
        pts1 = avecManiere1 ? POINTS_CLASSEMENT.PERDU_AVEC : POINTS_CLASSEMENT.PERDU_SANS;
    } else {
        // Match nul
        winner = null; loser = null;
        pts1 = avecManiere1 ? POINTS_CLASSEMENT.PERDU_AVEC : POINTS_CLASSEMENT.PERDU_SANS;
        pts2 = avecManiere2 ? POINTS_CLASSEMENT.PERDU_AVEC : POINTS_CLASSEMENT.PERDU_SANS;
    }

    return { pts1, pts2, avecManiere1, avecManiere2, winner, loser };
}

export function calculerClassement(schedule, players) {
    const standings = {};
    players.forEach(p => standings[p] = { pts: 0, wins: 0, losses: 0, diff: 0 });

    schedule.forEach(m => {
        if (m.pts1 === null || m.pts2 === null) return;
        // On utilise les points attribués pour le classement
        standings[m.p1].pts += m.pts1;
        standings[m.p2].pts += m.pts2;
        // Pour les victoires/défaites on compare les scores réels
        if (m.score1 > m.score2) {
            standings[m.p1].wins++;
            standings[m.p2].losses++;
            standings[m.p1].diff += (m.score1 - m.score2);
            standings[m.p2].diff -= (m.score1 - m.score2);
        } else if (m.score2 > m.score1) {
            standings[m.p2].wins++;
            standings[m.p1].losses++;
            standings[m.p2].diff += (m.score2 - m.score1);
            standings[m.p1].diff -= (m.score2 - m.score1);
        }
    });

    // Trier par points, puis par différence, puis par victoires
    return Object.entries(standings).sort((a, b) => {
        if (b[1].pts !== a[1].pts) return b[1].pts - a[1].pts;
        if (b[1].diff !== a[1].diff) return b[1].diff - a[1].diff;
        return b[1].wins - a[1].wins;
    });
}