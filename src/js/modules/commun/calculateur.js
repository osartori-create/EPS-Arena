// src/js/modules/commun/calculateur.js

export function initCalculateur() {
    const container = document.getElementById('calculateur-module');
    if (!container) return;

    container.innerHTML = `
        <div class="bg-slate-800 rounded-xl shadow-lg p-6">
            <h2 class="text-2xl font-bold text-center mb-6 text-white">Réglages</h2>
            
            <!-- Slider Vitesse de base -->
            <div class="slider-group space-y-3 mb-6">
                <label class="block text-sm font-medium text-slate-300">Vitesse de base</label>
                <div class="relative w-full flex justify-center">
                    <div id="calc-bubbleSpeed" class="absolute -top-8 bg-indigo-600 text-white text-sm font-bold px-3 py-1 rounded-full">15 km/h</div>
                </div>
                <div class="flex items-center space-x-3">
                    <button class="bg-slate-700 hover:bg-slate-600 rounded-full w-10 h-10 flex-shrink-0 flex items-center justify-center" onclick="adjustCalc('calc-baseSpeed', -0.1)">−</button>
                    <input type="range" id="calc-baseSpeed" min="5" max="25" step="0.1" value="15">
                    <button class="bg-slate-700 hover:bg-slate-600 rounded-full w-10 h-10 flex-shrink-0 flex items-center justify-center" onclick="adjustCalc('calc-baseSpeed', 0.1)">+</button>
                </div>
            </div>

            <!-- Slider Pourcentage -->
            <div class="slider-group space-y-3 mb-6">
                <label class="block text-sm font-medium text-slate-300">Pourcentage d'allure</label>
                <div class="relative w-full flex justify-center">
                    <div id="calc-bubblePercent" class="absolute -top-8 bg-indigo-600 text-white text-sm font-bold px-3 py-1 rounded-full">100%</div>
                </div>
                <div class="flex items-center space-x-3">
                    <button class="bg-slate-700 hover:bg-slate-600 rounded-full w-10 h-10 flex-shrink-0 flex items-center justify-center" onclick="adjustCalc('calc-percentSpeed', -1)">−</button>
                    <input type="range" id="calc-percentSpeed" min="50" max="150" step="1" value="100">
                    <button class="bg-slate-700 hover:bg-slate-600 rounded-full w-10 h-10 flex-shrink-0 flex items-center justify-center" onclick="adjustCalc('calc-percentSpeed', 1)">+</button>
                </div>
            </div>

            <!-- Résultat Vitesse -->
            <div class="mt-6 pt-4 border-t border-slate-700">
                <div id="calc-resultSpeed" class="text-center text-2xl font-bold text-amber-400">Vitesse résultante : 15 km/h</div>
            </div>

            <!-- Sliders Distance et Temps -->
            <div class="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="slider-group space-y-3">
                    <label class="block text-sm font-medium text-slate-300">Distance</label>
                    <div class="relative w-full flex justify-center">
                        <div id="calc-bubbleDist" class="absolute -top-8 bg-indigo-600 text-white text-sm font-bold px-3 py-1 rounded-full">750 m</div>
                    </div>
                    <div class="flex items-center space-x-3">
                        <button class="bg-slate-700 hover:bg-slate-600 rounded-full w-10 h-10 flex-shrink-0 flex items-center justify-center" onclick="adjustCalc('calc-distance', -10)">−</button>
                        <input type="range" id="calc-distance" min="10" max="5000" step="10" value="750">
                        <button class="bg-slate-700 hover:bg-slate-600 rounded-full w-10 h-10 flex-shrink-0 flex items-center justify-center" onclick="adjustCalc('calc-distance', 10)">+</button>
                    </div>
                </div>
                <div class="slider-group space-y-3">
                    <label class="block text-sm font-medium text-slate-300">Temps</label>
                    <div class="relative w-full flex justify-center">
                        <div id="calc-bubbleTime" class="absolute -top-8 bg-indigo-600 text-white text-sm font-bold px-3 py-1 rounded-full">3:00</div>
                    </div>
                    <div class="flex items-center space-x-3">
                        <button class="bg-slate-700 hover:bg-slate-600 rounded-full w-10 h-10 flex-shrink-0 flex items-center justify-center" onclick="adjustCalc('calc-time', -1)">−</button>
                        <input type="range" id="calc-time" min="10" max="1200" step="1" value="180">
                        <button class="bg-slate-700 hover:bg-slate-600 rounded-full w-10 h-10 flex-shrink-0 flex items-center justify-center" onclick="adjustCalc('calc-time', 1)">+</button>
                    </div>
                </div>
            </div>
            
            <!-- Récapitulatif -->
            <p id="calc-recap" class="text-center text-slate-300 mt-8 mb-4 font-bold"></p>

            <!-- Zone Temps de passage (Chronomètre) -->
            <div class="bg-slate-900 rounded-xl p-6 mt-4 border border-slate-700">
                <h3 class="text-xl font-bold text-center mb-4">Temps de passages</h3>
                <div id="calc-chronoDisplay" class="text-center text-6xl font-mono text-amber-400 mb-4">0:00<span class="text-3xl text-slate-400">.0</span></div>
                <div class="flex justify-center gap-3 mb-4">
                    <button id="calc-startBtn" class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-md">Start</button>
                    <button id="calc-pauseBtn" class="hidden bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-6 rounded-md">Pause</button>
                    <button id="calc-stopBtn" class="hidden bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-md">Stop</button>
                    <button id="calc-resetBtn" class="hidden bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-6 rounded-md">Reset</button>
                </div>
                
                <div class="flex items-center justify-center space-x-2 mb-4">
                    <label for="calc-balise" class="text-slate-400">Distance entre balises :</label>
                    <input type="number" id="calc-balise" value="25" min="1" step="1" class="w-20 text-center bg-slate-700 border border-slate-600 rounded-md p-2 text-white">
                </div>

                <div class="overflow-x-auto rounded-lg border border-slate-700">
                    <table class="w-full text-left">
                        <thead class="bg-slate-700">
                            <tr><th class="p-3 text-sm font-semibold text-center">Distance (m)</th><th class="p-3 text-sm font-semibold text-center">Temps</th></tr>
                        </thead>
                        <tbody id="calc-tableBody" class="divide-y divide-slate-700"></tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    // --- Variables ---
    const baseSpeed = document.getElementById('calc-baseSpeed');
    const percentSpeed = document.getElementById('calc-percentSpeed');
    const distance = document.getElementById('calc-distance');
    const time = document.getElementById('calc-time');
    const tableBody = document.getElementById('calc-tableBody');
    
    let chronoInterval;
    let startTime;
    let elapsedTime = 0;
    let state = 'idle';

    // --- Fonctions de calcul (adaptées du code fourni) ---
    function getSpeed() {
        return parseFloat(baseSpeed.value) * (parseFloat(percentSpeed.value) / 100);
    }

    function updateSpeed() {
        let base = parseFloat(baseSpeed.value), pct = parseFloat(percentSpeed.value), res = getSpeed();
        document.getElementById('calc-bubbleSpeed').textContent = base.toFixed(1) + " km/h";
        document.getElementById('calc-bubblePercent').textContent = pct + "%";
        document.getElementById('calc-resultSpeed').textContent = "Vitesse résultante : " + res.toFixed(1) + " km/h";
        updateDistTime('speed');
    }

    function updateDistTime(changed) {
        let v_ms = getSpeed() * 1000 / 3600;
        if (v_ms < 0.01) v_ms = 0.01;

        if (changed === 'distance' || changed === 'speed') {
            let d = parseFloat(distance.value), t = d / v_ms;
            if (t < 10) { t = 10; distance.value = Math.round(v_ms * 10); }
            if (t > 1200) { t = 1200; distance.value = Math.round(v_ms * 1200); }
            time.value = t;
        } else if (changed === 'time') {
            let t = parseFloat(time.value), d = v_ms * t;
            if (d < 10) { d = 10; time.value = Math.round(10 / v_ms); }
            if (d > 5000) { d = 5000; time.value = Math.round(5000 / v_ms); }
            distance.value = d;
        }
        
        document.getElementById('calc-bubbleDist').textContent = Math.round(distance.value) + " m";
        document.getElementById('calc-bubbleTime').textContent = formatTime(time.value);
        updateTable();
    }

    function formatTime(sec) {
        let m = Math.floor(sec / 60), s = Math.round(sec % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    // Fonction Globale pour les boutons +/-
    window.adjustCalc = function(id, step) {
        let el = document.getElementById(id);
        let newValue = parseFloat(el.value) + step;
        if (newValue < parseFloat(el.min)) newValue = parseFloat(el.min);
        if (newValue > parseFloat(el.max)) newValue = parseFloat(el.max);
        el.value = newValue;
        if (id === 'calc-baseSpeed' || id === 'calc-percentSpeed') updateSpeed();
        else if (id === 'calc-distance') updateDistTime('distance');
        else if (id === 'calc-time') updateDistTime('time');
    };

    function updateTable() {
        let v_ms = getSpeed() * 1000 / 3600;
        if (v_ms === 0) v_ms = 0.0001;
        let dTot = parseFloat(distance.value);
        let bal = parseFloat(document.getElementById('calc-balise').value) || 25;

        tableBody.innerHTML = "";
        document.getElementById('calc-recap').textContent = `Vitesse: ${getSpeed().toFixed(1)} km/h | Distance: ${Math.round(dTot)} m | Temps: ${formatTime(time.value)}`;

        let hasFinalRow = false;
        for (let d = bal; d <= dTot; d += bal) {
            let t = d / v_ms;
            tableBody.insertAdjacentHTML('beforeend', `<tr class="hover:bg-slate-700"><td class="p-3 text-center">${d}</td><td class="p-3 text-center">${formatTime(t)}</td></tr>`);
            if (d === dTot) hasFinalRow = true;
        }
        if (!hasFinalRow && dTot > 0) {
            let t = dTot / v_ms;
            tableBody.insertAdjacentHTML('beforeend', `<tr class="hover:bg-slate-700 font-bold"><td class="p-3 text-center">${Math.round(dTot)}</td><td class="p-3 text-center">${formatTime(t)}</td></tr>`);
        }
        if (state === 'running') highlightNextPassage(elapsedTime);
    }

    // --- Chrono ---
    function startChrono() {
        if (state === 'idle' || state === 'stopped') elapsedTime = 0;
        startTime = Date.now() - elapsedTime;
        chronoInterval = setInterval(updateChrono, 100);
        updateChronoButtons('running');
        state = 'running';
    }
    function pauseChrono() {
        clearInterval(chronoInterval);
        elapsedTime = Date.now() - startTime;
        updateChronoButtons('paused');
        state = 'paused';
    }
    function stopChrono() {
        clearInterval(chronoInterval);
        elapsedTime = Date.now() - startTime;
        updateChronoButtons('stopped');
        state = 'stopped';
        highlightNextPassage(elapsedTime);
    }
    function resetChrono() {
        clearInterval(chronoInterval);
        elapsedTime = 0;
        document.getElementById('calc-chronoDisplay').innerHTML = '0:00<span class="text-3xl text-slate-400">.0</span>';
        updateChronoButtons('idle');
        state = 'idle';
        removeHighlight();
    }
    function updateChrono() {
        elapsedTime = Date.now() - startTime;
        let totalSeconds = Math.floor(elapsedTime / 1000);
        let minutes = Math.floor(totalSeconds / 60);
        let seconds = totalSeconds % 60;
        let tenths = Math.floor((elapsedTime % 1000) / 100);
        document.getElementById('calc-chronoDisplay').innerHTML = `${minutes}:${seconds.toString().padStart(2, '0')}<span class="text-3xl text-slate-400">.${tenths}</span>`;
        highlightNextPassage(elapsedTime);
    }
    function updateChronoButtons(newState) {
        ['calc-startBtn', 'calc-pauseBtn', 'calc-stopBtn', 'calc-resetBtn'].forEach(id => document.getElementById(id).classList.add('hidden'));
        if (newState === 'idle') document.getElementById('calc-startBtn').classList.remove('hidden');
        else if (newState === 'running') { document.getElementById('calc-pauseBtn').classList.remove('hidden'); document.getElementById('calc-stopBtn').classList.remove('hidden'); }
        else if (newState === 'paused') { document.getElementById('calc-startBtn').classList.remove('hidden'); document.getElementById('calc-resetBtn').classList.remove('hidden'); }
        else if (newState === 'stopped') { document.getElementById('calc-startBtn').classList.remove('hidden'); document.getElementById('calc-resetBtn').classList.remove('hidden'); }
    }
    function highlightNextPassage(currentTimeMs) {
        removeHighlight();
        const rows = tableBody.querySelectorAll('tr');
        const currentTimeSec = currentTimeMs / 1000;
        for (const row of rows) {
            const timeCell = row.children[1];
            if (!timeCell) continue;
            let [m, s] = timeCell.textContent.split(":").map(Number);
            let passageTimeSec = m * 60 + s;
            if (passageTimeSec > currentTimeSec) {
                row.classList.add('highlight');
                break;
            }
        }
    }
    function removeHighlight() {
        const highlighted = tableBody.querySelector('.highlight');
        if (highlighted) highlighted.classList.remove('highlight');
    }

    // --- Event Listeners ---
    baseSpeed.addEventListener('input', updateSpeed);
    percentSpeed.addEventListener('input', updateSpeed);
    distance.addEventListener('input', () => updateDistTime('distance'));
    time.addEventListener('input', () => updateDistTime('time'));
    document.getElementById('calc-balise').addEventListener('input', updateTable);
    
    document.getElementById('calc-startBtn').addEventListener('click', startChrono);
    document.getElementById('calc-pauseBtn').addEventListener('click', pauseChrono);
    document.getElementById('calc-stopBtn').addEventListener('click', stopChrono);
    document.getElementById('calc-resetBtn').addEventListener('click', resetChrono);

    updateSpeed();
}