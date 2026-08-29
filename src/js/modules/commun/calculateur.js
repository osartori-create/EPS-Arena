// src/js/modules/commun/calculateur.js
/**
 * Module "Vitesse / Temps" pour EPS-Arena
 * 
 * Ce code est dérivé de l'outil "Convertisseur Distance-Temps" de Webjéjé.
 * Source originale : https://www.webjeje.com/online/webapp/convert/convertisseur.html
 * Licence : Creative Commons Attribution 4.0 International (CC BY 4.0) [citation:7]
 * Lien licence : https://creativecommons.org/licenses/by/4.0/
 * 
 * MODIFICATIONS : Code adapté et intégré dans une architecture ES6 modulaire pour l'application EPS-Arena.
 * (Changement des IDs pour éviter les conflits, ajout du mode "Plein écran", intégration du menu).
 */
export function initCalculateur() {
    const container = document.getElementById('calculateur-module');
    if (!container) return;

    // --- Injection du CSS nécessaire (pour que les sliders fonctionnent) ---
    if (!document.getElementById('calc-style')) {
        const style = document.createElement('style');
        style.id = 'calc-style';
        style.textContent = `
            input[type=range] {
                -webkit-appearance: none; appearance: none;
                width: 100%; height: 8px;
                background: #334155; border-radius: 9999px; outline: none;
            }
            input[type=range]::-webkit-slider-thumb {
                -webkit-appearance: none; appearance: none;
                width: 20px; height: 20px;
                background: #f59e0b; border-radius: 50%;
                cursor: pointer; border: 2px solid #f1f5f9;
            }
            input[type=range]::-moz-range-thumb {
                width: 20px; height: 20px;
                background: #f59e0b; border-radius: 50%;
                cursor: pointer; border: 2px solid #f1f5f9;
            }
            #calc-passageTable tbody tr.highlight {
                background-color: #f59e0b !important;
                color: #1e293b !important;
                font-weight: bold;
            }
        `;
        document.head.appendChild(style);
    }

    // --- HTML du module (avec les deux onglets internes) ---
    container.innerHTML = `
        <div class="bg-slate-800 rounded-xl shadow-lg p-6 max-h-[80vh] overflow-y-auto">
            
            <!-- Navigation interne -->
            <div class="flex justify-center space-x-1 mb-6">
                <button id="calc-tab-reglages" class="bg-blue-600 px-4 py-2 rounded-lg font-black text-xs uppercase text-white">Réglages</button>
                <button id="calc-tab-passages" class="bg-slate-700 px-4 py-2 rounded-lg font-black text-xs uppercase text-slate-300">Temps de passages</button>
            </div>

            <!-- ONGLET 1 : RÉGLAGES -->
            <div id="calc-reglages" class="space-y-5">
                <!-- Vitesse de base -->
                <div class="space-y-3">
                    <label class="block text-sm font-medium text-slate-300">Vitesse de base</label>
                    <div class="relative w-full flex justify-center">
                        <div id="calc-bubbleSpeed" class="absolute -top-8 bg-indigo-600 text-white text-sm font-bold px-3 py-1 rounded-full">15 km/h</div>
                    </div>
                    <div class="flex items-center space-x-3">
                        <button class="bg-slate-700 hover:bg-slate-600 rounded-full w-10 h-10 flex-shrink-0 flex items-center justify-center font-black text-white" onclick="adjustCalc('calc-baseSpeed', -0.1)">−</button>
                        <input type="range" id="calc-baseSpeed" min="5" max="25" step="0.1" value="15">
                        <button class="bg-slate-700 hover:bg-slate-600 rounded-full w-10 h-10 flex-shrink-0 flex items-center justify-center font-black text-white" onclick="adjustCalc('calc-baseSpeed', 0.1)">+</button>
                    </div>
                </div>

                <!-- Pourcentage d'allure -->
                <div class="space-y-3">
                    <label class="block text-sm font-medium text-slate-300">Pourcentage d'allure</label>
                    <div class="relative w-full flex justify-center">
                        <div id="calc-bubblePercent" class="absolute -top-8 bg-indigo-600 text-white text-sm font-bold px-3 py-1 rounded-full">100%</div>
                    </div>
                    <div class="flex items-center space-x-3">
                        <button class="bg-slate-700 hover:bg-slate-600 rounded-full w-10 h-10 flex-shrink-0 flex items-center justify-center font-black text-white" onclick="adjustCalc('calc-percentSpeed', -1)">−</button>
                        <input type="range" id="calc-percentSpeed" min="50" max="150" step="1" value="100">
                        <button class="bg-slate-700 hover:bg-slate-600 rounded-full w-10 h-10 flex-shrink-0 flex items-center justify-center font-black text-white" onclick="adjustCalc('calc-percentSpeed', 1)">+</button>
                    </div>
                </div>

                <div class="mt-6 pt-4 border-t border-slate-700">
                    <div id="calc-resultSpeed" class="text-center text-2xl font-bold text-amber-400">Vitesse résultante : 15 km/h</div>
                </div>

                <!-- Distance et Temps liés -->
                <div class="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-3">
                        <label class="block text-sm font-medium text-slate-300">Distance</label>
                        <div class="relative w-full flex justify-center">
                            <div id="calc-bubbleDist" class="absolute -top-8 bg-indigo-600 text-white text-sm font-bold px-3 py-1 rounded-full">750 m</div>
                        </div>
                        <div class="flex items-center space-x-3">
                            <button class="bg-slate-700 hover:bg-slate-600 rounded-full w-10 h-10 flex-shrink-0 flex items-center justify-center font-black text-white" onclick="adjustCalc('calc-distance', -10)">−</button>
                            <input type="range" id="calc-distance" min="10" max="5000" step="10" value="750">
                            <button class="bg-slate-700 hover:bg-slate-600 rounded-full w-10 h-10 flex-shrink-0 flex items-center justify-center font-black text-white" onclick="adjustCalc('calc-distance', 10)">+</button>
                        </div>
                    </div>
                    <div class="space-y-3">
                        <label class="block text-sm font-medium text-slate-300">Temps</label>
                        <div class="relative w-full flex justify-center">
                            <div id="calc-bubbleTime" class="absolute -top-8 bg-indigo-600 text-white text-sm font-bold px-3 py-1 rounded-full">3:00</div>
                        </div>
                        <div class="flex items-center space-x-3">
                            <button class="bg-slate-700 hover:bg-slate-600 rounded-full w-10 h-10 flex-shrink-0 flex items-center justify-center font-black text-white" onclick="adjustCalc('calc-time', -1)">−</button>
                            <input type="range" id="calc-time" min="10" max="1200" step="1" value="180">
                            <button class="bg-slate-700 hover:bg-slate-600 rounded-full w-10 h-10 flex-shrink-0 flex items-center justify-center font-black text-white" onclick="adjustCalc('calc-time', 1)">+</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ONGLET 2 : TEMPS DE PASSAGES -->
            <div id="calc-passages" class="hidden space-y-4">
                <div class="text-center">
                    <div id="calc-chronoDisplay" class="text-5xl font-mono text-amber-400 mb-4">0:00<span class="text-2xl text-slate-400">.0</span></div>
                    <div class="flex justify-center gap-3">
                        <button id="calc-startBtn" class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-md">Start</button>
                        <button id="calc-pauseBtn" class="hidden bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-6 rounded-md">Pause</button>
                        <button id="calc-stopBtn" class="hidden bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-md">Stop</button>
                        <button id="calc-resetBtn" class="hidden bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-6 rounded-md">Reset</button>
                    </div>
                </div>

                <div class="flex items-center justify-center space-x-2">
                    <label for="calc-balise" class="text-slate-400">Distance entre balises :</label>
                    <input type="number" id="calc-balise" value="25" min="1" step="1" class="w-20 text-center bg-slate-700 border border-slate-600 rounded-md p-2 text-white">
                </div>

                <div class="overflow-x-auto rounded-lg border border-slate-700">
                    <table class="w-full text-left">
                        <thead class="bg-slate-700">
                            <tr><th class="p-3 text-sm font-semibold text-center">Distance (m)</th><th class="p-3 text-sm font-semibold text-center">Temps</th></tr>
                        </thead>
                        <tbody id="calc-passageTable" class="divide-y divide-slate-700"></tbody>
                    </table>
                </div>
            </div>

        </div>
    `;

    // --- Sélection des éléments ---
    const baseSpeed = document.getElementById('calc-baseSpeed');
    const percentSpeed = document.getElementById('calc-percentSpeed');
    const distance = document.getElementById('calc-distance');
    const time = document.getElementById('calc-time');
    const tableBody = document.getElementById('calc-passageTable');

    // --- Gestion des onglets internes ---
    document.getElementById('calc-tab-reglages').addEventListener('click', () => switchCalcTab('reglages'));
    document.getElementById('calc-tab-passages').addEventListener('click', () => switchCalcTab('passages'));

    function switchCalcTab(tab) {
        document.getElementById('calc-reglages').classList.toggle('hidden', tab !== 'reglages');
        document.getElementById('calc-passages').classList.toggle('hidden', tab !== 'passages');
        document.getElementById('calc-tab-reglages').className = tab === 'reglages' ? 'bg-blue-600 px-4 py-2 rounded-lg font-black text-xs uppercase text-white' : 'bg-slate-700 px-4 py-2 rounded-lg font-black text-xs uppercase text-slate-300';
        document.getElementById('calc-tab-passages').className = tab === 'passages' ? 'bg-blue-600 px-4 py-2 rounded-lg font-black text-xs uppercase text-white' : 'bg-slate-700 px-4 py-2 rounded-lg font-black text-xs uppercase text-slate-300';
        if (tab === 'passages') updateTable();
    }

    // --- Variables du chrono ---
    let chronoInterval, startTime, elapsedTime = 0, state = 'idle';

    // --- Fonctions de calcul ---
    function getSpeed() {
        return parseFloat(baseSpeed.value) * (parseFloat(percentSpeed.value) / 100);
    }

    function updateSpeed() {
        document.getElementById('calc-bubbleSpeed').textContent = parseFloat(baseSpeed.value).toFixed(1) + " km/h";
        document.getElementById('calc-bubblePercent').textContent = parseFloat(percentSpeed.value) + "%";
        document.getElementById('calc-resultSpeed').textContent = "Vitesse résultante : " + getSpeed().toFixed(1) + " km/h";
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
        } else {
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
        return m + ":" + s.toString().padStart(2, '0');
    }

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
        if (document.getElementById('calc-passages').classList.contains('hidden')) return;
        
        removeHighlight();
        let v_ms = getSpeed() * 1000 / 3600;
        if (v_ms === 0) v_ms = 0.0001;
        let dTot = parseFloat(distance.value);
        let bal = parseFloat(document.getElementById('calc-balise').value) || 25;
        
        tableBody.innerHTML = "";
        let hasFinalRow = false;
        for (let d = bal; d <= dTot; d += bal) {
            let t = d / v_ms;
            tableBody.insertAdjacentHTML('beforeend', `<tr class="hover:bg-slate-700"><td class="p-3 text-center">${d}</td><td class="p-3 text-center">${formatTime(t)}</td></tr>`);
            if (d === dTot) hasFinalRow = true;
        }
        if (!hasFinalRow) {
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
        document.getElementById('calc-chronoDisplay').innerHTML = '0:00<span class="text-2xl text-slate-400">.0</span>';
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
        document.getElementById('calc-chronoDisplay').innerHTML = `${minutes}:${seconds.toString().padStart(2, '0')}<span class="text-2xl text-slate-400">.${tenths}</span>`;
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