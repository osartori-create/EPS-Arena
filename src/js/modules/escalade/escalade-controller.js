// src/js/modules/escalade/escalade-controller.js
import { db, ref, onValue, push } from '../../core/firebase-service.js';
import { BAREME_ESCALADE } from '../../config/constants.js';
import { calculateClimbingPoints } from './escalade-calculations.js';

export const BAREME = BAREME_ESCALADE;

const LONGUEUR_VOIE = 9;
export const OBJECTIF_METRES = 1000;

export function calculerPoints(hauteur, cotation, couleur, essai = 1) {
    return calculateClimbingPoints({ hauteur, cotation, couleur, essai });
}

export function exportIDoceo(students, montees, assignments, className) {
    let csv = "\uFEFFNom,Total_Metres,Nb_Voies,Meilleure_Cotation\n";
    students.forEach(name => {
        const post = assignments[name] || "";
        const gNum = post.slice(0, -1);
        const rLet = post.slice(-1);
        const perf = Object.values(montees).filter(m => post && m.groupe === gNum && m.role === rLet);
        const totalMetres = perf.reduce((a, b) => a + (parseFloat(b.points) || 0), 0).toFixed(1);
        let meilleureCotation = "";
        perf.forEach(m => {
            if (!meilleureCotation || BAREME[m.cotation] > BAREME[meilleureCotation]) meilleureCotation = m.cotation;
        });
        csv += `${name},${totalMetres},${perf.length},${meilleureCotation}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Escalade_${className}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

export function calculerStatsGlobales(montees) {
    const allMontees = Object.values(montees || {});
    const totalMetres = allMontees.reduce((sum, m) => sum + (parseFloat(m.points) || 0), 0);
    const progressionPct = Math.min((totalMetres / OBJECTIF_METRES) * 100, 100);
    const scoresParCode = {};
    allMontees.forEach(m => {
        const code = `${m.groupe}${m.role}`;
        if (!scoresParCode[code]) scoresParCode[code] = 0;
        scoresParCode[code] += parseFloat(m.points) || 0;
    });
    const top5 = Object.entries(scoresParCode).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([code, score]) => ({ code, score: Math.round(score * 10) / 10 }));
    const parGroupe = {};
    allMontees.forEach(m => {
        if (!parGroupe[m.groupe]) parGroupe[m.groupe] = { voies: 0, metres: 0 };
        parGroupe[m.groupe].voies++;
        parGroupe[m.groupe].metres += parseFloat(m.points) || 0;
    });
    return { totalMetres: Math.round(totalMetres), nbMontees: allMontees.length, progressionPct, top5, parGroupe };
}

export function initEscaladeListener(className, callback) {
    import { getPerformancePath } from '../../core/firebase-service.js';
const path = getPerformancePath(className, 'escalade');
const refMontees = ref(db, path);
    return onValue(refMontees, (snap) => callback(snap.val() || {}));
}

export async function envoyerMontee(className, groupe, role, voieNum, couleur, cotation, essai = 1) {
    const points = calculerPoints(cotation, couleur, essai);
    await push(ref(db, `escalade/${className}/montees`), {
        groupe: groupe, role: role, voie_num: voieNum,
        couleur: couleur, cotation: cotation, points: points, timestamp: Date.now()
    });
    return points;
}