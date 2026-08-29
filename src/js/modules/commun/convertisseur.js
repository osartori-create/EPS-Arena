// src/js/modules/commun/convertisseur.js

export function initConvertisseur() {
    const container = document.getElementById('convertisseur-module');
    if (!container) return;

    container.innerHTML = `
        <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
            <h3 class="font-black text-blue-400 uppercase text-sm mb-4">📐 Convertisseur EPS</h3>
            
            <!-- Sélection du type de conversion -->
            <div class="flex gap-2 mb-4">
                <button onclick="switchConvType('distance')" id="conv-type-distance" class="flex-1 bg-blue-600 py-2 rounded-xl font-black text-xs uppercase text-white">Distance</button>
                <button onclick="switchConvType('temps')" id="conv-type-temps" class="flex-1 bg-slate-700 py-2 rounded-xl font-black text-xs uppercase text-white">Temps</button>
                <button onclick="switchConvType('vitesse')" id="conv-type-vitesse" class="flex-1 bg-slate-700 py-2 rounded-xl font-black text-xs uppercase text-white">Vitesse</button>
            </div>

            <!-- Interface Distance -->
            <div id="conv-distance" class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase">Valeur</label>
                        <input type="number" id="dist-value" placeholder="Ex : 1500" class="w-full bg-slate-900 p-3 rounded-xl text-white text-2xl font-black text-center border border-slate-600">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase">Unité</label>
                        <select id="dist-unit" class="w-full bg-slate-900 p-3 rounded-xl text-white border border-slate-600">
                            <option value="m">Mètres (m)</option>
                            <option value="km">Kilomètres (km)</option>
                            <option value="cm">Centimètres (cm)</option>
                        </select>
                    </div>
                </div>
                <div class="bg-slate-900 p-4 rounded-xl text-center">
                    <p class="text-xs text-slate-400">Résultat</p>
                    <p id="dist-result" class="text-3xl font-black text-emerald-400">--</p>
                </div>
            </div>

            <!-- Interface Temps -->
            <div id="conv-temps" class="hidden space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase">Secondes</label>
                        <input type="number" id="temps-seconds" placeholder="Ex : 90" class="w-full bg-slate-900 p-3 rounded-xl text-white text-2xl font-black text-center border border-slate-600">
                    </div>
                </div>
                <div class="bg-slate-900 p-4 rounded-xl text-center">
                    <p class="text-xs text-slate-400">Format (min:sec)</p>
                    <p id="temps-result" class="text-3xl font-black text-emerald-400">--</p>
                </div>
            </div>

            <!-- Interface Vitesse -->
            <div id="conv-vitesse" class="hidden space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase">Valeur</label>
                        <input type="number" id="vit-value" placeholder="Ex : 12" class="w-full bg-slate-900 p-3 rounded-xl text-white text-2xl font-black text-center border border-slate-600">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase">Unité</label>
                        <select id="vit-unit" class="w-full bg-slate-900 p-3 rounded-xl text-white border border-slate-600">
                            <option value="kmh">km/h</option>
                            <option value="ms">m/s</option>
                        </select>
                    </div>
                </div>
                <div class="bg-slate-900 p-4 rounded-xl text-center">
                    <p class="text-xs text-slate-400">Résultat</p>
                    <p id="vit-result" class="text-3xl font-black text-emerald-400">--</p>
                </div>
            </div>
        </div>
    `;

    // Écouteurs d'événements
    document.getElementById('dist-value').addEventListener('input', convertDistance);
    document.getElementById('dist-unit').addEventListener('change', convertDistance);
    
    document.getElementById('temps-seconds').addEventListener('input', convertTemps);
    
    document.getElementById('vit-value').addEventListener('input', convertVitesse);
    document.getElementById('vit-unit').addEventListener('change', convertVitesse);

    // Fonctions de conversion
    window.switchConvType = function(type) {
        ['distance', 'temps', 'vitesse'].forEach(t => {
            document.getElementById(`conv-${t}`).classList.add('hidden');
            document.getElementById(`conv-type-${t}`).classList.remove('bg-blue-600');
            document.getElementById(`conv-type-${t}`).classList.add('bg-slate-700');
        });
        document.getElementById(`conv-${type}`).classList.remove('hidden');
        document.getElementById(`conv-type-${type}`).classList.add('bg-blue-600');
        document.getElementById(`conv-type-${type}`).classList.remove('bg-slate-700');
    };

    function convertDistance() {
        const val = parseFloat(document.getElementById('dist-value').value);
        const unit = document.getElementById('dist-unit').value;
        if (isNaN(val)) { document.getElementById('dist-result').innerText = '--'; return; }
        
        let result = '';
        if (unit === 'm') result = `${val} m = ${(val/1000).toFixed(3)} km = ${(val*100).toFixed(1)} cm`;
        else if (unit === 'km') result = `${val} km = ${(val*1000).toFixed(0)} m = ${(val*100000).toFixed(0)} cm`;
        else if (unit === 'cm') result = `${val} cm = ${(val/100).toFixed(2)} m = ${(val/100000).toFixed(4)} km`;
        
        document.getElementById('dist-result').innerText = result;
    }

    function convertTemps() {
        const val = parseFloat(document.getElementById('temps-seconds').value);
        if (isNaN(val)) { document.getElementById('temps-result').innerText = '--'; return; }
        
        const min = Math.floor(val / 60);
        const sec = Math.floor(val % 60);
        document.getElementById('temps-result').innerText = `${min}:${sec.toString().padStart(2, '0')}`;
    }

    function convertVitesse() {
        const val = parseFloat(document.getElementById('vit-value').value);
        const unit = document.getElementById('vit-unit').value;
        if (isNaN(val)) { document.getElementById('vit-result').innerText = '--'; return; }
        
        let result = '';
        if (unit === 'kmh') result = `${val} km/h = ${(val / 3.6).toFixed(2)} m/s`;
        else if (unit === 'ms') result = `${val} m/s = ${(val * 3.6).toFixed(2)} km/h`;
        
        document.getElementById('vit-result').innerText = result;
    }
}