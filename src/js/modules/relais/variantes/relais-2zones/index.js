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
    isRunning: false,
    gaugeChart: null
};

export function initRelais2ZonesKiosk() {
    const container = document.getElementById('relais-module');
    if (!container) return;

    // Reset complet
    if (state.timerInterval) clearInterval(state.timerInterval);
    state = {
        clicks: 0,
        times: [],
        startTime: null,
        elapsedTime: 0,
        timerInterval: null,
        zoneDistance: 20,
        isRunning: false,
        gaugeChart: null
    };

    render(container);
}

function render(container) {
    container.innerHTML = `
        <div class="space-y-4">
            <div class="bg-orange-500 text-white text-center font-black uppercase py-2 rounded-xl text-sm tracking-wider">
                🏁 RELAIS 2 ZONES
            </div>

            <!-- Chrono principal -->
            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700 text-center">
                <div id="relais2z-chrono" class="text-7xl font-mono font-black text-yellow-400 mb-2 tabular-nums">00.00</div>
                <p class="text-xs text-slate-500 mb-4">secondes</p>

                <!-- Gros bouton principal -->
                <button id="relais2z-btn" onclick="window.relais2zonesClick()"
                        class="w-full bg-emerald-600 hover:bg-emerald-500 py-8 rounded-3xl font-black text-2xl text-white active:scale-95 transition-all shadow-xl mb-3">
                    ▶ DÉMARRER / CLICKER
                </button>
                <p class="text-xs text-slate-400 mb-4">
                    <strong class="text-white">4 clics :</strong> 1 = départ • 2 = fin zone 1 • 3 = fin zone 2 • 4 = arrivée
                </p>

                <!-- Sélecteur de distance -->
                <div class="flex items-center justify-center gap-3">
                    <label class="text-xs font-bold text-slate-400 uppercase">Distance par zone</label>
                    <select id="relais2z-distance" onchange="window.relais2zonesSetDistance(this.value)"
                            class="bg-slate-900 border border-slate-600 rounded-xl p-2 text-white font-bold text-sm">
                        <option value="10">10 m</option>
                        <option value="15">15 m</option>
                        <option value="20" selected>20 m</option>
                        <option value="25">25 m</option>
                        <option value="30">30 m</option>
                    </select>
                </div>
            </div>

            <!-- Pistes visuelles (3 zones) -->
            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <div class="flex items-stretch h-20 rounded-xl overflow-hidden border-2 border-slate-600">
                    <div class="flex-1 bg-orange-500/80 flex flex-col items-center justify-center border-r-2 border-dashed border-white/50 relative">
                        <span class="text-[10px] font-bold text-white/70 uppercase absolute top-1">Zone 1</span>
                        <span class="text-xs font-bold text-slate-400 mb-1 mt-3">Relayeur 1</span>
                        <span id="relais2z-speed1" class="text-lg font-black text-white">--</span>
                        <span id="relais2z-time1" class="text-[10px] text-white/70">-- s</span>
                    </div>
                    <div class="flex-1 bg-blue-500/80 flex flex-col items-center justify-center border-r-2 border-dashed border-white/50 relative">
                        <span class="text-[10px] font-bold text-white/70 uppercase absolute top-1">Zone 2</span>
                        <span class="text-xs font-bold text-slate-400 mb-1 mt-3">Transmission</span>
                        <span id="relais2z-speed2" class="text-lg font-black text-white">--</span>
                        <span id="relais2z-time2" class="text-[10px] text-white/70">-- s</span>
                    </div>
                    <div class="flex-1 bg-green-600/80 flex flex-col items-center justify-center relative">
                        <span class="text-[10px] font-bold text-white/70 uppercase absolute top-1">Zone 3</span>
                        <span class="text-xs font-bold text-slate-400 mb-1 mt-3">Relayeur 2</span>
                        <span id="relais2z-speed3" class="text-lg font-black text-white">--</span>
                        <span id="relais2z-time3" class="text-[10px] text-white/70">-- s</span>
                    </div>
                </div>
            </div>

            <!-- Résultats -->
            <div id="relais2z-results" class="hidden bg-slate-800 p-5 rounded-2xl border-2 border-emerald-500">
                <p id="relais2z-avg" class="text-center text-sm font-bold text-yellow-400 mb-3">--</p>

                <div class="text-center">
                    <p class="text-xs text-slate-400 uppercase mb-1">Qualité de transmission</p>
                    <p id="relais2z-compare" class="text-5xl font-black mb-3">--</p>
                    <div class="w-full h-4 bg-slate-900 rounded-full overflow-hidden">
                        <div id="relais2z-bar" class="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500 transition-all" style="width: 0%"></div>
                    </div>
                </div>

                <p id="relais2z-message" class="text-center text-sm text-slate-300 mt-4"></p>
            </div>

            <!-- Boutons secondaires -->
            <div class="flex gap-3">
                <button onclick="window.relais2zonesReset()"
                        class="flex-1 bg-slate-600 hover:bg-slate-500 py-4 rounded-2xl font-black text-white text-sm active:scale-95 transition-all">
                    ↺ Réinitialiser
                </button>
                <button onclick="window.relaisKioskGoTo('menu')"
                        class="flex-1 bg-slate-700 hover:bg-slate-600 py-4 rounded-2xl font-black text-white text-sm active:scale-95 transition-all">
                    ← Menu relais
                </button>
            </div>
        </div>
    `;
}

// ============================================================
// CLIC PRINCIPAL (4 étapes)
// ============================================================
window.relais2zonesClick = function() {
    state.clicks++;

    if (state.clicks === 1) {
        state.startTime = Date.now();
        state.elapsedTime = 0;
        state.isRunning = true;
        state.timerInterval = setInterval(() => {
            state.elapsedTime = Date.now() - state.startTime;
            updateChrono();
        }, 10);
    } else if (state.clicks <= 4) {
        state.times.push(state.elapsedTime);
    }

    if (state.clicks === 4) {
        clearInterval(state.timerInterval);
        state.isRunning = false;
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

// ============================================================
// CALCUL DES RÉSULTATS
// ============================================================
function calculateResults() {
    const d = state.zoneDistance;
    const speeds = [];

    for (let i = 0; i < 3; i++) {
        const t0 = i === 0 ? 0 : state.times[i - 1];
        const t1 = state.times[i];
        const dt = (t1 - t0) / 1000;
        const v = dt > 0 ? (d / dt) * 3.6 : 0;
        speeds.push(v);

        const speedEl = document.getElementById(`relais2z-speed${i + 1}`);
        const timeEl = document.getElementById(`relais2z-time${i + 1}`);
        if (speedEl) speedEl.textContent = `${v.toFixed(1)} km/h`;
        if (timeEl) timeEl.textContent = `${dt.toFixed(2)} s`;
    }

    const avg = (speeds[0] + speeds[2]) / 2;
    const transmission = speeds[1];
    const pct = avg > 0 ? Math.round((transmission / avg) * 100) : 0;

    const results = document.getElementById('relais2z-results');
    const avgEl = document.getElementById('relais2z-avg');
    const cmpEl = document.getElementById('relais2z-compare');
    const barEl = document.getElementById('relais2z-bar');
    const msgEl = document.getElementById('relais2z-message');

    if (results) results.classList.remove('hidden');
    if (avgEl) avgEl.textContent = `Vitesse moyenne relayeurs : ${avg.toFixed(1)} km/h`;

    let couleur = 'text-red-400';
    let message = '⚠️ Transmission lente — essaie d\'anticiper !';
    if (pct >= 90) {
        couleur = 'text-emerald-400';
        message = '🚀 Transmission parfaite ! Le témoin n\'a pas ralenti.';
    } else if (pct >= 75) {
        couleur = 'text-green-400';
        message = '✅ Bonne transmission, tu peux encore gagner quelques dixièmes.';
    } else if (pct >= 60) {
        couleur = 'text-yellow-400';
        message = '👍 Transmission correcte, mais il y a de la marge.';
    }

    if (cmpEl) {
        cmpEl.className = `text-5xl font-black ${couleur}`;
        cmpEl.textContent = `${pct}%`;
    }
    if (barEl) {
        barEl.style.width = Math.min(pct, 100) + '%';
    }
    if (msgEl) {
        msgEl.textContent = message;
    }
}

// ============================================================
// RESET
// ============================================================
window.relais2zonesReset = function() {
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.clicks = 0;
    state.times = [];
    state.elapsedTime = 0;
    state.startTime = null;
    state.isRunning = false;

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

// ============================================================
// DISTANCE
// ============================================================
window.relais2zonesSetDistance = function(val) {
    state.zoneDistance = parseInt(val);
    window.relais2zonesReset();
};