// src/js/modules/demi-fond/variantes/enchainement/enchainement-bilan.js
// Bilan élève du sous-module "Enchaînement" selon la rubrique 4 critères.

import { db, ref, onValue } from '../../../../core/firebase-service.js';
import { getBasePath, getCouleurGroupe } from '../../demifond-common.js';
import { calculerDistance, calculerVitesse, calculerRegularite, evaluerPerformanceRubrique, evaluerAllureRubrique, DEFAUT_PARAMS } from './enchainement-core.js';

export async function chargerObservations(classe, code, nbCourses) {
    const basePath = getBasePath(classe);
    const result = {};
    for (let i = 1; i <= nbCourses; i++) {
        const snap = await new Promise(resolve => {
            onValue(ref(db, `${basePath}/observations/course-${i}/${code}`), resolve, { onlyOnce: true });
        });
        result[`course${i}`] = snap.val() || null;
    }
    return result;
}

export function calculerBilan(observations, config, vma, sexe) {
    const tour = config.tour || 200;
    const plots = config.plots || 8;
    const durees = config.durees || DEFAUT_PARAMS.durees;
    const seuils = config.seuilsPerformance || DEFAUT_PARAMS.seuilsPerformance;

    const courses = [];
    for (let i = 1; i <= durees.length; i++) {
        const obs = observations[`course${i}`];
        const duree = durees[i - 1];
        if (!obs) { courses.push(null); continue; }
        const timestamps = obs.timestamps || [];
        const partiel = obs.partiel || 0;
        const abandon = obs.abandon || null;
        const distance = calculerDistance(timestamps, partiel, tour, plots);
        const vitesse = abandon ? 0 : calculerVitesse(distance, duree);
        const regularite = calculerRegularite(timestamps);
        courses.push({ num: i, timestamps, partiel, abandon, distance: Math.round(distance), vitesse, nbTours: timestamps.length, regularite, duree });
    }

    const vitesses = courses.map(c => c?.abandon ? null : (c?.vitesse || null));
    const abandons = courses.filter(c => c?.abandon).map(c => c.abandon);

    const performance = evaluerPerformanceRubrique(vitesses[durees.length - 1], sexe, seuils);
    const allure = evaluerAllureRubrique(vitesses, abandons);

    return { courses, performance, allure, vma, sexe, config };
}

export function rendreBilanHTML(bilan, couleurId) {
    const couleur = getCouleurGroupe(couleurId);
    const niveauCouleurs = ['#ef4444', '#f59e0b', '#84cc16', '#22c55e'];

    let cartesHtml = '<div class="grid grid-cols-2 gap-3 mb-4">';
    bilan.courses.forEach((c, i) => {
        const num = i + 1;
        if (!c) {
            cartesHtml += `<div class="bg-slate-900 p-3 rounded-xl border border-slate-700 text-center"><div class="text-xs text-slate-500 font-bold">SÉRIE ${num}</div><div class="text-sm text-slate-500 mt-2">Non effectuée</div></div>`;
        } else if (c.abandon) {
            cartesHtml += `<div class="bg-red-900/20 p-3 rounded-xl border-2 border-red-700 text-center"><div class="text-xs text-red-400 font-bold">SÉRIE ${num}</div><div class="text-xl font-black text-red-400 mt-1">🚫 ABANDON</div></div>`;
        } else {
            cartesHtml += `<div class="bg-slate-900 p-3 rounded-xl border border-slate-700 text-center"><div class="text-xs text-slate-400 font-bold">SÉRIE ${num}</div><div class="text-2xl font-black mt-1" style="color:${couleur.bg};">${c.vitesse.toFixed(1)}</div><div class="text-[10px] text-slate-500">km/h</div><div class="text-xs text-slate-300 mt-1">${c.distance} m · ${c.duree}s</div></div>`;
        }
    });
    cartesHtml += '</div>';

    const indices = `
        <div class="space-y-2 mb-4">
            <div class="bg-slate-900 p-3 rounded-xl border-l-4 flex justify-between items-center" style="border-color:${bilan.performance.niveau ? niveauCouleurs[bilan.performance.niveau-1] : '#64748b'};">
                <div><div class="text-xs text-slate-400 font-bold">🏃 COUREUR — PERFORMANCE</div><div class="text-xs text-slate-500 mt-0.5">${bilan.performance.raison}</div></div>
                <div class="text-3xl font-black" style="color:${bilan.performance.niveau ? niveauCouleurs[bilan.performance.niveau-1] : '#64748b'};">${bilan.performance.niveau || '—'}</div>
            </div>
            <div class="bg-slate-900 p-3 rounded-xl border-l-4 flex justify-between items-center" style="border-color:${niveauCouleurs[bilan.allure.niveau-1]};">
                <div><div class="text-xs text-slate-400 font-bold">🎯 COUREUR — ALLURE</div><div class="text-xs text-slate-500 mt-0.5">${bilan.allure.raison}</div></div>
                <div class="text-3xl font-black" style="color:${niveauCouleurs[bilan.allure.niveau-1]};">${bilan.allure.niveau}</div>
            </div>
            <div class="bg-slate-800 p-3 rounded-xl border border-slate-700 text-xs text-slate-400">
                💡 <strong class="text-slate-200">Observateur / Coach</strong> et <strong class="text-slate-200">Élève</strong> sont évalués par le professeur (barème qualitatif de la rubrique).
            </div>
        </div>
    `;

    return `
        <div class="bg-slate-800 p-3 rounded-2xl border-2 mb-3" style="border-color:${couleur.border};">
            <div class="flex justify-between items-center">
                <div><div class="text-[10px] uppercase text-slate-400 font-bold">Bilan</div><div class="text-2xl font-black" style="color:${couleur.bg};">#${bilan.code}</div></div>
                <div class="text-right"><div class="text-[10px] uppercase text-slate-400 font-bold">VMA</div><div class="text-xl font-black text-white">${bilan.vma ? bilan.vma.toFixed(1) + ' km/h' : '?'}</div></div>
            </div>
        </div>
        ${cartesHtml}
        ${indices}
        <button onclick="window.enchainementKioskBilanRetour()" class="w-full bg-slate-700 py-3 rounded-2xl font-black text-sm uppercase text-white">← Autre élève</button>
    `;
}