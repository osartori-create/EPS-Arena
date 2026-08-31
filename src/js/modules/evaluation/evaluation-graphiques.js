// src/js/modules/evaluation/evaluation-graphiques.js
// Graphiques : histogramme, radar, podium

import { COULEURS_GROUPES, LIBELLES_GROUPES, LIBELLES_TESTS } from './evaluation-utils.js';

let chartInstance = null;

/**
 * Affiche un histogramme des groupes de maîtrise pour un test donné
 */
export function afficherHistogramme(container, data, testId) {
    const eleves = Object.values(data.eleves).filter(e => e.statut === 'present');
    const resultats = eleves.map(e => e.resultats[testId]).filter(r => r !== null);
    
    const comptes = {
        a_besoins: resultats.filter(r => r.groupe === 'a_besoins').length,
        fragile: resultats.filter(r => r.groupe === 'fragile').length,
        satisfaisant: resultats.filter(r => r.groupe === 'satisfaisant').length
    };
    
    const total = resultats.length;
    const pcts = {
        a_besoins: total > 0 ? Math.round((comptes.a_besoins / total) * 100) : 0,
        fragile: total > 0 ? Math.round((comptes.fragile / total) * 100) : 0,
        satisfaisant: total > 0 ? Math.round((comptes.satisfaisant / total) * 100) : 0
    };
    
    container.innerHTML = `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
            <h4 class="font-black text-blue-400 uppercase text-sm mb-4">${LIBELLES_TESTS[testId]} - Répartition des groupes</h4>
            <div class="flex h-8 rounded-full overflow-hidden">
                <div class="h-full bg-red-500 flex items-center justify-center text-xs font-black text-white" style="width:${pcts.a_besoins}%">
                    ${pcts.a_besoins > 10 ? `${pcts.a_besoins}%` : ''}
                </div>
                <div class="h-full bg-amber-500 flex items-center justify-center text-xs font-black text-white" style="width:${pcts.fragile}%">
                    ${pcts.fragile > 10 ? `${pcts.fragile}%` : ''}
                </div>
                <div class="h-full bg-emerald-500 flex items-center justify-center text-xs font-black text-white" style="width:${pcts.satisfaisant}%">
                    ${pcts.satisfaisant > 10 ? `${pcts.satisfaisant}%` : ''}
                </div>
            </div>
            <div class="flex justify-center gap-4 mt-2 text-xs">
                <span class="text-red-400">● À besoins (${comptes.a_besoins})</span>
                <span class="text-amber-400">● Fragile (${comptes.fragile})</span>
                <span class="text-emerald-400">● Satisfaisant (${comptes.satisfaisant})</span>
            </div>
            <p class="text-center text-xs text-slate-400 mt-2">${total} élèves évalués</p>
        </div>
    `;
}

/**
 * Affiche un radar des 7 aptitudes pour un élève
 */
export function afficherRadar(container, data, eleveId) {
    const eleve = data.eleves[eleveId];
    if (!eleve) {
        container.innerHTML = '<p class="text-slate-400">Élève non trouvé</p>';
        return;
    }
    
    const tests = ['endurance', 'force', 'vitesse', 'equilibre', 'coordination', 'souplesse', 'endurance_musculaire'];
    const valeurs = tests.map(testId => {
        const r = eleve.resultats[testId];
        if (!r) return 0;
        // Convertir en score 0-3 (0 = non évalué, 1 = à besoins, 2 = fragile, 3 = satisfaisant)
        if (r.groupe === 'satisfaisant') return 3;
        if (r.groupe === 'fragile') return 2;
        if (r.groupe === 'a_besoins') return 1;
        return 0;
    });
    
    const labels = tests.map(t => LIBELLES_TESTS[t].split('(')[0].trim());
    
    // Créer un canvas pour Chart.js
    container.innerHTML = `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
            <h4 class="font-black text-blue-400 uppercase text-sm mb-4">${eleve.prenom} ${eleve.nom} - Profil</h4>
            <div class="w-full max-w-md mx-auto">
                <canvas id="eval-radar-canvas"></canvas>
            </div>
        </div>
    `;
    
    // Utiliser Chart.js
    if (typeof Chart === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        script.onload = () => renderRadar();
        document.head.appendChild(script);
    } else {
        renderRadar();
    }
    
    function renderRadar() {
        const canvas = document.getElementById('eval-radar-canvas');
        if (!canvas) return;
        
        if (chartInstance) chartInstance.destroy();
        
        const ctx = canvas.getContext('2d');
        chartInstance = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Niveau de maîtrise',
                    data: valeurs,
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    borderColor: '#3b82f6',
                    pointBackgroundColor: '#3b82f6',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    r: {
                        min: 0,
                        max: 3,
                        ticks: {
                            stepSize: 1,
                            color: '#94a3b8',
                            backdropColor: 'transparent',
                            callback: (value) => {
                                if (value === 0) return '--';
                                if (value === 1) return 'À besoins';
                                if (value === 2) return 'Fragile';
                                if (value === 3) return 'Satisfaisant';
                                return '';
                            }
                        },
                        grid: { color: '#334155' },
                        angleLines: { color: '#334155' },
                        pointLabels: { color: '#f1f5f9', font: { weight: 'bold' } }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }
}

/**
 * Affiche un podium des meilleurs résultats pour un test
 */
export function afficherPodium(container, data, testId) {
    const eleves = Object.values(data.eleves).filter(e => e.statut === 'present');
    const avecResultats = eleves
        .map(e => ({ ...e, resultat: e.resultats[testId] }))
        .filter(e => e.resultat !== null);
    
    // Trier selon le test
    let sorted = [];
    switch (testId) {
        case 'force':
        case 'souplesse':
            sorted = avecResultats.sort((a, b) => (b.resultat.meilleur || 0) - (a.resultat.meilleur || 0));
            break;
        case 'vitesse':
            sorted = avecResultats.sort((a, b) => (a.resultat.meilleur || 999) - (b.resultat.meilleur || 999));
            break;
        case 'endurance':
            sorted = avecResultats.sort((a, b) => (b.resultat.palier || 0) - (a.resultat.palier || 0));
            break;
        case 'equilibre':
        case 'endurance_musculaire':
            sorted = avecResultats.sort((a, b) => (b.resultat.temps || 0) - (a.resultat.temps || 0));
            break;
        case 'coordination':
            sorted = avecResultats.sort((a, b) => (b.resultat.nb_lancers || 0) - (a.resultat.nb_lancers || 0));
            break;
        default:
            sorted = avecResultats;
    }
    
    const top3 = sorted.slice(0, 3);
    const medailles = ['🥇', '🥈', '🥉'];
    const couleursPodium = ['#facc15', '#94a3b8', '#d97706'];
    
    let html = `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
            <h4 class="font-black text-blue-400 uppercase text-sm mb-4">🏆 Podium - ${LIBELLES_TESTS[testId]}</h4>
            <div class="flex justify-center items-end gap-4 h-48">
    `;
    
    top3.forEach((eleve, index) => {
        const hauteur = 100 - (index * 25); // 100%, 75%, 50%
        const valeur = getValeurPodium(eleve.resultat, testId);
        const unite = testId === 'force' ? 'cm' : (testId === 'vitesse' ? 's' : (testId === 'souplesse' ? 'cm' : ''));
        
        html += `
            <div class="flex flex-col items-center" style="height:${hauteur}%">
                <div class="text-3xl">${medailles[index]}</div>
                <div class="text-xs font-black text-white text-center">${eleve.prenom}</div>
                <div class="text-xs text-slate-400">${eleve.nom}</div>
                <div class="w-12 rounded-t-lg" style="height:${Math.max(20, hauteur * 0.6)}%; background:${couleursPodium[index]};">
                    <div class="text-center text-xs font-black text-white mt-1">${valeur}${unite}</div>
                </div>
            </div>
        `;
    });
    
    html += `</div></div>`;
    container.innerHTML = html;
}

function getValeurPodium(resultat, testId) {
    switch (testId) {
        case 'force':
        case 'souplesse':
            return resultat.meilleur || 0;
        case 'vitesse':
            return resultat.meilleur || 0;
        case 'endurance':
            return resultat.palier || 0;
        case 'equilibre':
        case 'endurance_musculaire':
            return resultat.temps || 0;
        case 'coordination':
            return resultat.nb_lancers || 0;
        default:
            return 0;
    }
}
 * Render le radar pour la fiche élève
 */
export function renderRadar(canvas, data, eleveId) {
    const eleve = data.eleves[eleveId];
    if (!eleve) return;

    const tests = ['endurance', 'force', 'vitesse', 'equilibre', 'coordination', 'souplesse', 'endurance_musculaire'];
    const labels = tests.map(t => LIBELLES_TESTS[t].split('(')[0].trim());
    
    const valeurs = tests.map(testId => {
        const r = eleve.resultats[testId];
        if (!r || r.groupe === null) return 0;
        if (r.groupe === 'satisfaisant') return 3;
        if (r.groupe === 'fragile') return 2;
        if (r.groupe === 'a_besoins') return 1;
        return 0;
    });

    // Utiliser Chart.js
    if (typeof Chart === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        script.onload = () => renderRadarChart(canvas, labels, valeurs);
        document.head.appendChild(script);
    } else {
        renderRadarChart(canvas, labels, valeurs);
    }
}

function renderRadarChart(canvas, labels, valeurs) {
    if (canvas.__chart) {
        canvas.__chart.destroy();
    }

    const ctx = canvas.getContext('2d');
    canvas.__chart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Niveau de maîtrise',
                data: valeurs,
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                borderColor: '#3b82f6',
                pointBackgroundColor: '#3b82f6',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                r: {
                    min: 0,
                    max: 3,
                    ticks: {
                        stepSize: 1,
                        color: '#94a3b8',
                        backdropColor: 'transparent',
                        font: { size: 8 }
                    },
                    grid: { color: '#334155' },
                    angleLines: { color: '#334155' },
                    pointLabels: { 
                        color: '#f1f5f9', 
                        font: { weight: 'bold', size: 10 }
                    }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}