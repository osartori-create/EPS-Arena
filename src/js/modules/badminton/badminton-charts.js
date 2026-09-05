// src/js/modules/badminton/badminton-charts.js

import { getPhotoUrl } from '../../services/admin-service.js';

export function renderBadmintonStatsChart(canvasId, playerName, stats, mode) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    if (canvas.__chart) {
        canvas.__chart.destroy();
    }

    const ctx = canvas.getContext('2d');
    
    let labels, data, colors;
    if (mode === '4corners') {
        labels = ['Centre', 'Coins', 'Autres', 'Fautes'];
        data = [stats.center || 0, stats.corner || 0, stats.other || 0, stats.fault || 0];
        colors = ['#3b82f6', '#f97316', '#a855f7', '#eab308'];
    } else {
        labels = ['Centre', 'Extérieur'];
        data = [stats.center || 0, stats.extreme || 0];
        colors = ['#3b82f6', '#ef4444'];
    }

    canvas.__chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderColor: '#1e293b',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#f1f5f9',
                        font: { weight: 'bold', size: 11 }
                    }
                }
            }
        }
    });
}

export function renderBadmintonStatsModal(matchData, player1, player2) {
    // Crée une modale avec les stats des deux joueurs
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
        <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-black text-white">Statistiques du match</h2>
                <button onclick="this.closest('.fixed').remove()" class="bg-slate-700 px-4 py-2 rounded-xl font-black text-xs text-white">
                    ✖ Fermer
                </button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h3 class="text-center font-black text-blue-400 text-lg">${player1}</h3>
                    <canvas id="stats-chart-p1"></canvas>
                </div>
                <div>
                    <h3 class="text-center font-black text-blue-400 text-lg">${player2}</h3>
                    <canvas id="stats-chart-p2"></canvas>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Render les charts après un court délai
    setTimeout(() => {
        const mode = matchData.mode || 'frontback';
        renderBadmintonStatsChart('stats-chart-p1', player1, matchData.stats.p1, mode);
        renderBadmintonStatsChart('stats-chart-p2', player2, matchData.stats.p2, mode);
    }, 100);
}