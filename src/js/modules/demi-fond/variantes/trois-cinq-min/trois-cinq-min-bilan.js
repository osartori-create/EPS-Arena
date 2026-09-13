// src/js/modules/demi-fond/variantes/trois-cinq-min/trois-cinq-min-bilan.js
// Calcul et rendu du bilan élève (graphique SVG + indicateurs)

import { db, ref, onValue } from '../../../../core/firebase-service.js';
import { getBasePath, getCouleurGroupe } from '../../demifond-common.js';
import { evaluerAllure, evaluerPerformance, calculerDistance, calculerVitesse, calculerRegularite } from './trois-cinq-min-core.js';

// ============================================================
// CHARGEMENT DES OBSERVATIONS FIREBASE
// ============================================================
export async function chargerObservations(classe, code) {
    const basePath = getBasePath(classe);
    const result = { course1: null, course2: null, course3: null };

    for (let i = 1; i <= 3; i++) {
        const snap = await new Promise(resolve => {
            onValue(ref(db, `${basePath}/observations/course-${i}/${code}`), resolve, { onlyOnce: true });
        });
        result[`course${i}`] = snap.val() || null;
    }
    return result;
}

// ============================================================
// CALCUL DU BILAN
// ============================================================
export function calculerBilan(observations, config, vma) {
    const tour = config.tour || 200;
    const plots = config.plots || 8;
    const duree = config.duree || 300;

    const courses = [];

    for (let i = 1; i <= 3; i++) {
        const obs = observations[`course${i}`];
        if (!obs) {
            courses.push(null);
            continue;
        }

        const timestamps = obs.timestamps || [];
        const partiel = obs.partiel || 0;
        const abandon = obs.abandon || null;

        const distance = calculerDistance(timestamps, partiel, tour, plots);
        const vitesse = abandon ? 0 : calculerVitesse(distance, duree);
        const regularite = calculerRegularite(timestamps);

        // Vitesses par tour (pour le graphique)
        const vitessesParTour = [];
        for (let j = 0; j < timestamps.length; j++) {
            const t0 = j === 0 ? 0 : timestamps[j - 1];
            const t1 = timestamps[j];
            const dt = (t1 - t0) / 1000;
            if (dt > 0) {
                vitessesParTour.push({
                    debut: t0,
                    fin: t1,
                    vitesse: Math.round((tour / dt) * 3.6 * 10) / 10
                });
            }
        }
        // Dernier tour partiel
        if (partiel > 0 && timestamps.length > 0) {
            const tDernier = timestamps[timestamps.length - 1];
            const dt = (duree * 1000 - tDernier) / 1000;
            if (dt > 0) {
                const distancePartielle = (partiel * tour) / plots;
                vitessesParTour.push({
                    debut: tDernier,
                    fin: duree * 1000,
                    vitesse: Math.round((distancePartielle / dt) * 3.6 * 10) / 10,
                    partiel: true
                });
            }
        }

        courses.push({
            num: i,
            timestamps,
            partiel,
            abandon,
            distance: Math.round(distance),
            vitesse,
            nbTours: timestamps.length,
            regularite,
            vitessesParTour
        });
    }

    // Vitesses pour l'évaluation de l'allure
    const vitesses = courses.map(c => c?.abandon ? null : (c?.vitesse || null));
    const abandons = courses.map(c => c?.abandon).filter(Boolean);

    const allure = evaluerAllure(vitesses, abandons);
    const performance = evaluerPerformance(vitesses[2], vma);

    return {
        courses,
        allure,
        performance,
        vma,
        config
    };
}

// ============================================================
// RENDU HTML DU BILAN
// ============================================================
export function rendreBilanHTML(bilan, couleurId) {
    const couleur = getCouleurGroupe(couleurId);
    const niveauCouleurs = ['#ef4444', '#f59e0b', '#84cc16', '#22c55e'];

    // ============================================
    // GRAPHIQUE SVG
    // ============================================
    const svg = genererSVG(bilan);

    // ============================================
    // 3 CARTES COURSES
    // ============================================
    let cartesHtml = '<div class="grid grid-cols-3 gap-3 mb-4">';
    bilan.courses.forEach((c, i) => {
        const num = i + 1;
        if (!c) {
            cartesHtml += `
                <div class="bg-slate-900 p-3 rounded-xl border border-slate-700 text-center">
                    <div class="text-xs text-slate-500 font-bold">COURSE ${num}</div>
                    <div class="text-sm text-slate-500 mt-2">Non effectuée</div>
                </div>
            `;
            return;
        }
        if (c.abandon) {
            cartesHtml += `
                <div class="bg-red-900/20 p-3 rounded-xl border-2 border-red-700 text-center">
                    <div class="text-xs text-red-400 font-bold">COURSE ${num}</div>
                    <div class="text-xl font-black text-red-400 mt-1">🚫 ABANDON</div>
                    <div class="text-[10px] text-red-300 mt-1">${c.abandon === 'blessure' ? 'Blessure' : 'Mental'}</div>
                </div>
            `;
            return;
        }
        cartesHtml += `
            <div class="bg-slate-900 p-3 rounded-xl border border-slate-700 text-center">
                <div class="text-xs text-slate-400 font-bold">COURSE ${num}</div>
                <div class="text-2xl font-black mt-1" style="color:${couleur.bg};">${c.vitesse.toFixed(1)}</div>
                <div class="text-[10px] text-slate-500">km/h</div>
                <div class="text-xs text-slate-300 mt-1">${c.distance} m</div>
                <div class="text-[10px] text-slate-500">${c.nbTours} tours + ${c.partiel} plots</div>
            </div>
        `;
    });
    cartesHtml += '</div>';

    // ============================================
    // INDICATEURS
    // ============================================
    const niveauAllure = bilan.allure.niveau;
    const niveauPerf = bilan.performance.niveau;

    // Résumé général
    let resume = '';
    if (abandonGlobal(bilan)) {
        resume = 'Tu as abandonné avant la fin des 3 courses. Reprends progressivement à la prochaine séance.';
    } else if (niveauAllure === 4 && niveauPerf >= 3) {
        resume = 'Excellent travail ! Tu as su gérer ton effort et progresser.';
    } else if (niveauAllure === 3 && niveauPerf >= 3) {
        resume = 'Très bon travail, allure régulière et performance solide.';
    } else if (niveauAllure === 2) {
        resume = 'Tu as eu tendance à ralentir au fil des courses. Pense à mieux gérer ton départ.';
    } else {
        resume = 'Continue à travailler ton endurance. L\'objectif est de tenir 3 courses à allure régulière.';
    }

    let indicateursHtml = `
        <div class="space-y-2 mb-4">
            <div class="bg-slate-900 p-3 rounded-xl border-l-4 flex justify-between items-center" style="border-color:${niveauCouleurs[niveauAllure - 1] || '#64748b'};">
                <div>
                    <div class="text-xs text-slate-400 font-bold">🎯 ALLURE</div>
                    <div class="text-xs text-slate-500 mt-0.5">${bilan.allure.raison}</div>
                </div>
                <div class="text-3xl font-black" style="color:${niveauCouleurs[niveauAllure - 1] || '#64748b'};">${niveauAllure}</div>
            </div>

            <div class="bg-slate-900 p-3 rounded-xl border-l-4 flex justify-between items-center" style="border-color:${niveauPerf ? niveauCouleurs[niveauPerf - 1] : '#64748b'};">
                <div>
                    <div class="text-xs text-slate-400 font-bold">🏃 PERFORMANCE</div>
                    <div class="text-xs text-slate-500 mt-0.5">${bilan.performance.raison}</div>
                </div>
                <div class="text-3xl font-black" style="color:${niveauPerf ? niveauCouleurs[niveauPerf - 1] : '#64748b'};">${niveauPerf || '—'}</div>
            </div>

            <div class="bg-slate-900 p-3 rounded-xl border-l-4 border-slate-600 flex justify-between items-center">
                <div>
                    <div class="text-xs text-slate-400 font-bold">📊 RÉGULARITÉ</div>
                    <div class="text-xs text-slate-500 mt-0.5">${getRegulariteLabel(bilan)}</div>
                </div>
                <div class="text-2xl font-black text-slate-300">${getRegulariteIcone(bilan)}</div>
            </div>
        </div>

        <div class="bg-slate-900 p-3 rounded-xl border border-slate-700 mb-4">
            <div class="text-xs text-slate-400 font-bold mb-1">💬 RÉSUMÉ</div>
            <div class="text-sm text-slate-200">${resume}</div>
        </div>
    `;

    return `
        <div class="space-y-4">
            <div class="bg-slate-800 p-3 rounded-2xl border-2" style="border-color:${couleur.border};">
                <div class="flex justify-between items-center mb-2">
                    <div>
                        <div class="text-[10px] uppercase text-slate-400 font-bold">Bilan élève</div>
                        <div class="text-2xl font-black" style="color:${couleur.bg};">#${bilan.code}</div>
                    </div>
                    <div class="text-right">
                        <div class="text-[10px] uppercase text-slate-400 font-bold">VMA</div>
                        <div class="text-xl font-black text-white">${bilan.vma ? bilan.vma.toFixed(1) + ' km/h' : '?'}</div>
                    </div>
                </div>
                ${svg}
            </div>

            ${cartesHtml}
            ${indicateursHtml}

            <button onclick="window.dmfKioskBilanRetour()"
                    class="w-full bg-slate-700 hover:bg-slate-600 py-3 rounded-2xl font-black text-sm uppercase text-white active:scale-95">
                ← Autre élève
            </button>
        </div>
    `;
}

// ============================================================
// GRAPHIQUE SVG
// ============================================================
function genererSVG(bilan) {
    const config = bilan.config;
    const duree = config.duree;
    const pause = config.pause;

    // Axe X : de 0 à 3*duree + 2*pause (en secondes)
    const totalTime = 3 * duree + 2 * pause;

    // Collecter tous les points (temps, vitesse)
    const points = []; // { tSec, vitesse, courseNum }
    bilan.courses.forEach((c, i) => {
        if (!c || c.abandon) return;
        const courseOffset = i * (duree + pause);
        c.vitessesParTour.forEach(v => {
            points.push({
                tSec: courseOffset + (v.fin / 1000),
                vitesse: v.vitesse,
                courseNum: i + 1,
                partiel: v.partiel
            });
        });
    });

    if (points.length === 0) {
        return `<div class="text-slate-500 text-center py-10 text-sm">Aucune donnée</div>`;
    }

    // Échelles
    const vMin = Math.max(0, Math.min(...points.map(p => p.vitesse)) - 2);
    const vMax = Math.max(...points.map(p => p.vitesse)) + 2;
    const vRange = vMax - vMin || 1;

    const svgW = 800;
    const svgH = 260;
    const padL = 40;
    const padR = 10;
    const padT = 20;
    const padB = 30;
    const plotW = svgW - padL - padR;
    const plotH = svgH - padT - padB;

    const xScale = t => padL + (t / totalTime) * plotW;
    const yScale = v => padT + plotH - ((v - vMin) / vRange) * plotH;

    // Zones de fond (3 courses + 2 pauses)
    let zones = '';
    const courseColors = ['#3b82f6', '#84cc16', '#ef4444'];
    for (let i = 0; i < 3; i++) {
        const courseStart = i * (duree + pause);
        const courseEnd = courseStart + duree;
        zones += `<rect x="${xScale(courseStart)}" y="${padT}" width="${xScale(courseEnd) - xScale(courseStart)}" height="${plotH}" fill="${courseColors[i]}" opacity="0.1"/>`;
        // Label
        const midX = (xScale(courseStart) + xScale(courseEnd)) / 2;
        zones += `<text x="${midX}" y="${padT + 14}" fill="${courseColors[i]}" font-size="11" font-weight="900" text-anchor="middle">C${i+1}</text>`;
        // Pause entre les courses
        if (i < 2) {
            const pauseStart = courseEnd;
            const pauseEnd = courseStart + duree + pause;
            zones += `<rect x="${xScale(pauseStart)}" y="${padT}" width="${xScale(pauseEnd) - xScale(pauseStart)}" height="${plotH}" fill="#475569" opacity="0.15"/>`;
            const midXp = (xScale(pauseStart) + xScale(pauseEnd)) / 2;
            zones += `<text x="${midXp}" y="${padT + 14}" fill="#94a3b8" font-size="9" text-anchor="middle">P</text>`;
        }
    }

    // Grille horizontale
    let grid = '';
    const nbLignes = 4;
    for (let i = 0; i <= nbLignes; i++) {
        const v = vMin + (vRange * i / nbLignes);
        const y = yScale(v);
        grid += `<line x1="${padL}" y1="${y}" x2="${svgW - padR}" y2="${y}" stroke="#334155" stroke-width="1" stroke-dasharray="2,4"/>`;
        grid += `<text x="${padL - 5}" y="${y + 3}" fill="#94a3b8" font-size="9" text-anchor="end">${v.toFixed(1)}</text>`;
    }

    // Courbe (segments par course)
    let chemins = '';
    for (let cn = 1; cn <= 3; cn++) {
        const coursePoints = points.filter(p => p.courseNum === cn);
        if (coursePoints.length === 0) continue;

        // Ligne reliant les points
        let pathD = '';
        coursePoints.forEach((p, i) => {
            const x = xScale(p.tSec);
            const y = yScale(p.vitesse);
            pathD += (i === 0 ? 'M' : 'L') + x + ',' + y + ' ';
        });
        chemins += `<path d="${pathD}" fill="none" stroke="${courseColors[cn-1]}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`;

        // Points
        coursePoints.forEach(p => {
            const x = xScale(p.tSec);
            const y = yScale(p.vitesse);
            const color = p.partiel ? '#facc15' : courseColors[cn-1];
            chemins += `<circle cx="${x}" cy="${y}" r="4" fill="${color}" stroke="#0f172a" stroke-width="1.5"/>`;
        });
    }

    return `
        <svg viewBox="0 0 ${svgW} ${svgH}" style="width:100%; height:auto; background:#0f172a; border-radius:12px; margin-top:8px;">
            ${zones}
            ${grid}
            ${chemins}
            <text x="${padL - 5}" y="${padT - 8}" fill="#94a3b8" font-size="9" text-anchor="end">km/h</text>
        </svg>
    `;
}

// ============================================================
// HELPERS
// ============================================================
function abandonGlobal(bilan) {
    return bilan.courses.some(c => c && c.abandon);
}

function getRegulariteLabel(bilan) {
    // Prendre la meilleure régularité des courses
    const cvs = bilan.courses
        .filter(c => c && !c.abandon && c.regularite)
        .map(c => c.regularite.cv);
    if (cvs.length === 0) return 'Aucune donnée';
    const cvMoyen = cvs.reduce((a, b) => a + b, 0) / cvs.length;
    if (cvMoyen < 5) return `Très régulier (CV ${cvMoyen.toFixed(1)}%)`;
    if (cvMoyen < 10) return `Régulier (CV ${cvMoyen.toFixed(1)}%)`;
    return `Variable (CV ${cvMoyen.toFixed(1)}%)`;
}

function getRegulariteIcone(bilan) {
    const cvs = bilan.courses
        .filter(c => c && !c.abandon && c.regularite)
        .map(c => c.regularite.cv);
    if (cvs.length === 0) return '—';
    const cvMoyen = cvs.reduce((a, b) => a + b, 0) / cvs.length;
    if (cvMoyen < 5) return '🟢';
    if (cvMoyen < 10) return '🟡';
    return '🔴';
}