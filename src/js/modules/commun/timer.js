// src/js/modules/commun/timer.js
export function initIntervalTimer() {
    const container = document.getElementById('interval-timer-module');
    if (!container) return;

    // État du chrono
    let isRunning = false;
    let intervalId = null;
    let timeLeft = 0;

    // Interface (HTML injecté)
    container.innerHTML = `
        <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
            <div class="flex justify-center gap-4 mb-4">
                <div class="bg-slate-900 p-2 rounded-xl text-center">
                    <span class="text-xs font-bold text-slate-400">Travail</span>
                    <input type="number" id="timer-work" value="30" class="w-20 text-center bg-transparent text-2xl font-black text-emerald-400 outline-none">
                </div>
                <div class="bg-slate-900 p-2 rounded-xl text-center">
                    <span class="text-xs font-bold text-slate-400">Repos</span>
                    <input type="number" id="timer-rest" value="15" class="w-20 text-center bg-transparent text-2xl font-black text-amber-400 outline-none">
                </div>
            </div>
            <div id="timer-display" class="text-8xl font-black tabular-nums text-center mb-8">00:00</div>
            <button id="timer-start" onclick="window.toggleTimer()" class="w-full bg-emerald-600 py-5 rounded-3xl text-2xl font-black uppercase shadow-xl active:scale-95 transition-all">▶ Démarrer</button>
        </div>
    `;

    // Logique
    window.toggleTimer = function() {
        if (isRunning) {
            clearInterval(intervalId);
            isRunning = false;
            document.getElementById('timer-start').innerText = "▶ Reprendre";
        } else {
            const workTime = parseInt(document.getElementById('timer-work').value) || 30;
            const restTime = parseInt(document.getElementById('timer-rest').value) || 15;
            
            // Simulation alternance travail/repos (à adapter selon votre logique précise)
            timeLeft = workTime;
            let phase = 'work'; // 'work' ou 'rest'
            
            document.getElementById('timer-display').innerText = formatTime(timeLeft);
            document.getElementById('timer-display').classList.add('text-emerald-400');
            
            intervalId = setInterval(() => {
                timeLeft--;
                if (timeLeft < 0) {
                    if (phase === 'work') {
                        phase = 'rest';
                        timeLeft = restTime;
                        document.getElementById('timer-display').classList.remove('text-emerald-400');
                        document.getElementById('timer-display').classList.add('text-amber-400');
                    } else {
                        phase = 'work';
                        timeLeft = workTime;
                        document.getElementById('timer-display').classList.remove('text-amber-400');
                        document.getElementById('timer-display').classList.add('text-emerald-400');
                    }
                }
                document.getElementById('timer-display').innerText = formatTime(timeLeft);
            }, 1000);
            
            isRunning = true;
            document.getElementById('timer-start').innerText = "⏹ Arrêter";
        }
    };
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}