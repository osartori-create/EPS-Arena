// src/js/ui/eleve/eleve-actions.js
import { getDB, getSelectedClass, resetToLogin } from './eleve-app.js';
import { getPerformancePath } from '../../core/firebase-service.js';
import { ref, onValue } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-database.js";

export function showFeedback(message, delay = 5000) {
    const feedbackDiv = document.createElement('div');
    feedbackDiv.id = 'feedback-overlay';
    feedbackDiv.className = 'fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-6';
    feedbackDiv.innerHTML = `
        <div class="text-6xl mb-4">✅</div>
        <p class="text-2xl font-black text-center mb-4">${message}</p>
        <p class="text-sm text-slate-400 mb-8">Montagne d'équipe dans <span id="feedback-countdown">5</span>s</p>
    `;
    document.body.appendChild(feedbackDiv);

    let countdown = 5;
    const countdownEl = feedbackDiv.querySelector('#feedback-countdown');
    const interval = setInterval(() => {
        countdown--;
        countdownEl.textContent = countdown;
        if (countdown <= 0) {
            clearInterval(interval);
            feedbackDiv.remove();
            showTeamMountain();
        }
    }, 1000);
}

export function showTeamMountain() {
    const db = getDB();
    const selectedClass = getSelectedClass();
    const mountainDiv = document.createElement('div');
    mountainDiv.id = 'team-mountain-overlay';
    mountainDiv.className = 'fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-6';
    mountainDiv.innerHTML = `<p class="text-2xl font-black mb-4">⛰️ Montagne de l'équipe</p>
        <div class="content mt-6"></div>
        <p class="text-sm text-slate-400 mt-4 mb-8">Retour au choix du code dans <span id="mountain-countdown">5</span>s</p>`;
    document.body.appendChild(mountainDiv);

    const monteesRef = ref(db, getPerformancePath(selectedClass, 'escalade'));
    onValue(monteesRef, (snap) => {
        const montees = snap.val() || {};
        const equipeScores = {};
        Object.values(montees).forEach(m => {
            const lettre = m.groupe;
            if (!equipeScores[lettre]) equipeScores[lettre] = 0;
            equipeScores[lettre] += (m.points || 0);
        });
        const maxScore = Math.max(...Object.values(equipeScores), 1);
        let html = `<div class="w-full max-w-md h-64 relative overflow-hidden rounded-2xl bg-gradient-to-t from-slate-900 to-slate-600">`;
        html += `<div class="absolute bottom-0 left-0 right-0 h-1/4 bg-slate-800"></div>`;
        html += `<div class="absolute bottom-1/4 left-0 right-0 h-1/4 bg-slate-700"></div>`;
        html += `<div class="absolute bottom-1/2 left-0 right-0 h-1/4 bg-slate-600"></div>`;
        html += `<div class="absolute bottom-3/4 left-0 right-0 h-1/4 bg-slate-500"></div>`;
        html += `<div class="relative z-10 flex justify-around items-end pb-2 h-full">`;
        Object.keys(equipeScores).forEach(lettre => {
            const score = equipeScores[lettre];
            const height = Math.max((score / maxScore) * 80, 5);
            html += `<div class="flex flex-col items-center justify-end" style="transform: translateY(-${height}%);">
                <div class="text-4xl">🧗</div>
                <div class="bg-blue-500 text-white font-black px-3 py-1 rounded-lg">${lettre}</div>
                <div class="text-yellow-400 font-bold">${score.toFixed(0)}m</div>
            </div>`;
        });
        html += `</div></div>`;
        mountainDiv.querySelector('.content').innerHTML = html;
    });

    let countdown = 5;
    const countdownEl = mountainDiv.querySelector('#mountain-countdown');
    const interval = setInterval(() => {
        countdown--;
        countdownEl.textContent = countdown;
        if (countdown <= 0) {
            clearInterval(interval);
            mountainDiv.remove();
            resetToLogin();
        }
    }, 1000);
}