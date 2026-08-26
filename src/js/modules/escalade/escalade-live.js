import { getCurrentClasse, getConfigData, getEscaladeData, getNomFromCode, getPhotoHtml } from '../../core/live-engine.js';

// Fonction spécifique à l'escalade
function coeffToCotation(coeff) {
    const echelle = [
        { cotation: '4a', coeff: 1.0 },
        { cotation: '4b', coeff: 1.1 },
        { cotation: '4c', coeff: 1.2 },
        { cotation: '5a', coeff: 1.3 },
        { cotation: '5b', coeff: 1.4 },
        { cotation: '5c', coeff: 1.5 },
        { cotation: '6a', coeff: 1.6 },
        { cotation: '6b', coeff: 1.8 },
        { cotation: '6c', coeff: 2.0 }
    ];
    let closest = echelle[0];
    let minDiff = Math.abs(coeff - echelle[0].coeff);
    for (let i = 1; i < echelle.length; i++) {
        const diff = Math.abs(coeff - echelle[i].coeff);
        if (diff < minDiff) { minDiff = diff; closest = echelle[i]; }
    }
    return closest.cotation;
}

export function renderEscaladeLive(data) {
    const container = document.getElementById('live-content');
    if (!container) return;

    const entries = Object.values(data).reverse();
    let html = `<h3 class="font-black text-blue-400 uppercase text-sm mb-2">🧗 Montées Escalade (Cliquez pour le bilan)</h3><div class="space-y-2">`;
    
    const promises = entries.map(async m => {
        const code = `${m.groupe}${m.role}`;
        const nom = getNomFromCode(code);
        const photoHtml = await getPhotoHtml(code);
        const hauteur = m.hauteur ? `${m.hauteur}m` : 'Top';
        return `<div onclick="openBilan('${code}')" class="bg-slate-800 p-3 rounded-xl border border-slate-700 flex items-center gap-3 justify-between cursor-pointer hover:border-blue-500">
                <div class="flex items-center gap-3">
                    ${photoHtml}
                    <div>
                        <span class="font-bold text-white">${nom}</span>
                        <span class="text-xs text-slate-400 ml-2 block">Voie ${m.voie_num} - ${hauteur}</span>
                    </div>
                </div>
                <span class="text-emerald-400 font-black">${m.points}m</span>
            </div>`;
    });

    Promise.all(promises).then(results => {
        html += results.join('');
        html += `</div>`;
        container.innerHTML = html;
    });

    window.openBilan = function(code) {
        const nom = getNomFromCode(code);
        const toutesMontées = Object.values(getEscaladeData()).filter(m => `${m.groupe}${m.role}` === code);
        
        const nbVoies = toutesMontées.length;
        const distanceTotale = toutesMontées.reduce((sum, m) => sum + (m.hauteur || 0), 0);
        const nbTops = toutesMontées.filter(m => m.hauteur >= 9).length;
        const distanceMoyenne = nbVoies > 0 ? distanceTotale / nbVoies : 0;
        
        const bareme = { "4a": 1, "4b": 1.1, "4c": 1.2, "5a": 1.3, "5b": 1.4, "5c": 1.5, "6a": 1.6, "6b": 1.8, "6c": 2 };
        let coeffTotal = 0, hauteurTotal = 0;
        toutesMontées.forEach(m => {
            const coeff = bareme[m.cotation] || 1;
            coeffTotal += coeff * (m.hauteur || 0);
            hauteurTotal += m.hauteur || 0;
        });
        const coeffMoyen = hauteurTotal > 0 ? (coeffTotal / hauteurTotal) : 0;
        const difficulteMoyenne = coeffToCotation(coeffMoyen);
        
        const validéDeuxVoies = {};
        toutesMontées.forEach(m => {
            const key = m.cotation;
            if (!validéDeuxVoies[key]) validéDeuxVoies[key] = new Set();
            validéDeuxVoies[key].add(m.voie_num);
        });
        const plusGrandeDifValidée = Object.keys(validéDeuxVoies)
            .filter(cot => validéDeuxVoies[cot].size >= 2)
            .sort((a, b) => (bareme[b] || 1) - (bareme[a] || 1))[0] || 'Aucune';

        getPhotoHtml(code).then(photoHtml => {
            const modalHtml = `
            <div class="fixed inset-0 bg-black/90 flex items-center justify-center p-6 z-50" id="bilanModal">
                <div class="bg-slate-800 p-6 rounded-3xl border border-slate-700 w-full max-w-md">
                    <div class="flex flex-col items-center mb-4">
                        ${photoHtml}
                        <h3 class="text-2xl font-black text-white mt-3">${nom}</h3>
                        <p class="text-slate-400">Code : ${code}</p>
                    </div>
                    <div class="space-y-3">
                        <div class="flex justify-between"><span class="text-slate-400">Nombre de voies</span><span class="font-black text-white">${nbVoies}</span></div>
                        <div class="flex justify-between"><span class="text-slate-400">Distance cumulée</span><span class="font-black text-emerald-400">${distanceTotale} m</span></div>
                        <div class="flex justify-between"><span class="text-slate-400">Distance moyenne</span><span class="font-black text-white">${distanceMoyenne.toFixed(1)} m</span></div>
                        <div class="flex justify-between"><span class="text-slate-400">Nombre de Tops</span><span class="font-black text-yellow-400">${nbTops}</span></div>
                        <div class="flex justify-between"><span class="text-slate-400">Difficulté moyenne</span><span class="font-black text-blue-400">${difficulteMoyenne}</span></div>
                        <div class="flex justify-between"><span class="text-slate-400">Plus grande difficulté validée (2 voies)</span><span class="font-black text-blue-400">${plusGrandeDifValidée}</span></div>
                    </div>
                    <button onclick="document.getElementById('bilanModal').remove()" class="w-full mt-6 bg-slate-700 py-3 rounded-xl font-bold text-white">Fermer</button>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
        });
    };
}