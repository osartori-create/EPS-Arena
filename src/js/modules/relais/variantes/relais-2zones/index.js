// src/js/modules/relais/variantes/relais-2zones/index.js
// Variante "Relais 2 zones" : chrono 4 clics sur 3 zones de 20m
// Prototype original adapté au format kiosque EPS-Arena

let state = {
    clicks: 0,
    times: [],
    startTime: null,
    elapsedTime: 0,
    timerInterval: null,
    zoneDistance: 20,
    isRunning: false
};

export function initRelais2ZonesKiosk() {
    const container = document.getElementById('relais-module');
    if (!container) return;

    state = {
        clicks: 0,
        times: [],
        startTime: null,
        elapsedTime: 0,
        timerInterval: null,
        zoneDistance: 20,
        isRunning: false
    };

    render(container);
}

function render(container) {
    container.innerHTML = `
        <div class="space-y-4">
            <button onclick="window.retourMenuRelais()" 
                    class="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-xl font-black text-xs text-white active:scale-95">
                ← Retour
            </button>

            <div class="bg-orange-500 text-white text-center font-black uppercase py-2 rounded-xl text-sm">
                🏁 Relais 2 zones
            </div>

            <div class="bg-slate-800 p-6 rounded-2xl border border-slate-700 text-center">
                <div id="relais2z-chrono" class="text-6xl font-mono font-black text-yellow-400 mb-6">00.00</div>

                <button id="relais2z-btn" onclick="window.relais2zonesClick()"
                        class="w-full bg-emerald-600 hover:bg-emerald-500 py-8 rounded-3xl font-black text-2xl text-white active:scale-95 transition-all shadow-xl mb-4">
                    ▶ Démarrer / Cliquer
                </button>

                <div class="text-xs text-slate-400 mb-2">Distance par zone</div>
                <select id="relais2z-distance" onchange="window.relais2zonesSetDistance(this.value)"
                        class="bg-slate-900 border border-slate-600 rounded-xl p-3 text-white font-bold">
                    <option value="10">10 m</option>
                    <option value="15">15 m</option>
                    <option value="20" selected>20 m</option>
                    <option value="25">25 m</option>
                    <option value="30">30 m</option>
                </select>
            </div>

            <div id="relais2z-zones" class="grid grid-cols-3 gap-3">
                ${[1, 2, 3].map(i => `
                    <div class="bg-slate-900 border-2 border-dashed border-slate-600 rounded-xl p-4 text-center">
                        <div class="text-xs text-slate-500 font-bold mb-1">Zone ${i}</div>
                        <div id="relais2z-speed${i}" class="text-lg font-black text-white">--</div>
                        <div id="relais2z-time${i}" class="text-xs text-slate-400 mt-1">-- s</div>
                    </div>
                `).join('')}
            </div>

            <div id="relais2z-results" class="hidden bg-slate-800 p-4 rounded-2xl border border-slate-700 text-center">
                <p id="relais2z-avg" class="text-lg font-bold text-yellow-400 mb-2">--</p>
                <p id="relais2z-compare" class="text-2xl font-black">--</p>
            </div>

            <button onclick="window.relais2zonesReset()" 
                    class="w-full bg-slate-700 hover:bg-slate-600 py-3 rounded-xl font-black text-sm text-white active:scale-95">
                ↺ Réinitialiser
            </button>
        </div>
    `;
}

window.relais2zonesClick = function() {
    state.clicks++;

    if (state.clicks === 1) {
        state.startTime = Date.now();
        state.timerInterval = setInterval(() => {
            state.elapsedTime = Date.now() - state.startTime;
            updateChrono();
        }, 10);
    } else if (state.clicks <= 4) {
        state.times.push(state.elapsedTime);
    }

    if (state.clicks === 4) {
        clearInterval(state.timerInterval);
        calculateResults();
    }
};

function updateChrono() {
    const el = document.getElementById('relais2z-chrono');
    if (!el) return;
    const sec = Math.floor(state.elapsedTime / 1000);
    const cs = Math.floor((state.elapsedTime % 1000) / 10);
    el.textContent = `${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function calculateResults() {
    const d = state.zoneDistance;
    const speeds = [];
    for (let i = 0; i < 3; i++) {
        const t0 = i === 0 ? 0 : state.times[i - 1];
        const t1 = state.times[i];
        const dt = (t1 - t0) / 1000;
        const v = (d / dt) * 3.6;
        speeds.push(v);
        const speedEl = document.getElementById(`relais2z-speed${i + 1}`);
        const timeEl = document.getElementById(`relais2z-time${i + 1}`);
        if (speedEl) speedEl.textContent = `${v.toFixed(1)} km/h`;
        if (timeEl) timeEl.textContent = `${dt.toFixed(2)} s`;
    }

    const avg = (speeds[0] + speeds[2]) / 2;
    const transmission = speeds[1];
    const pct = Math.round((transmission / avg) * 100);

    const results = document.getElementById('relais2z-results');
    const avgEl = document.getElementById('relais2z-avg');
    const cmpEl = document.getElementById('relais2z-compare');

    if (results) results.classList.remove('hidden');
    if (avgEl) avgEl.textContent = `Vitesse moyenne relayeurs : ${avg.toFixed(1)} km/h`;
    if (cmpEl) {
        const couleur = pct >= 90 ? 'text-emerald-400' : (pct >= 65 ? 'text-yellow-400' : 'text-red-400');
        cmpEl.className = `text-2xl font-black ${couleur}`;
        cmpEl.textContent = `Transmission / Moyenne : ${pct}%`;
    }
}

window.relais2zonesReset = function() {
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.clicks = 0;
    state.times = [];
    state.elapsedTime = 0;
    state.startTime = null;

    const chrono = document.getElementById('relais2z-chrono');
    if (chrono) chrono.textContent = '00.00';

    for (let i = 1; i <= 3; i++) {
        const s = document.getElementById(`relais2z-speed${i}`);
        const t = document.getElementById(`relais2z-time${i}`);
        if (s) s.textContent = '--';
        if (t) t.textContent = '-- s';
    }

    const r = document.getElementById('relais2z-results');
    if (r) r.classList.add('hidden');
};

window.relais2zonesSetDistance = function(val) {
    state.zoneDistance = parseInt(val);
    window.relais2zonesReset();
};