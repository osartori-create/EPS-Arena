import { getNomFromCode, getPhotoHtml, getEscaladeData, getLocalMapping, getCurrentClasse } from '../../core/live-engine.js';
import { getPhotoUrl } from '../../services/admin-service.js';
import { BAREME } from './escalade-calculations.js';

export function renderEscaladeLive(data) {
    const container = document.getElementById('live-content');
    if (!container) return;

    const entries = Object.values(data).reverse();
    let html = `<h3 class="font-black text-blue-400 uppercase text-sm mb-2">🧗 Montées Escalade (Cliquez pour le bilan)</h3><div class="space-y-2">`;
    
    const promises = entries.map(async m => {
        const code = `${m.groupe}${m.role}`;
        const nom = getNomFromCode(code);
        const photoHtml = await getPhotoHtml(code);
        
        // On ajoute un onclick pour ouvrir le bilan de cet élève (via son code)
        return `<div onclick="openBilan('${code}')" class="bg-slate-800 p-3 rounded-xl border border-slate-700 flex items-center gap-3 justify-between cursor-pointer hover:border-blue-500">
                <div class="flex items-center gap-3">
                    ${photoHtml}
                    <span class="font-bold text-white">${nom}</span>
                </div>
                <span class="text-emerald-400 font-black">${m.points}m</span>
            </div>`;
    });

    Promise.all(promises).then(results => {
        html += results.join('');
        html += `</div>`;
        container.innerHTML = html;
    });

    // ✅ Exposer la fonction openBilan globalement pour l'événement onclick
    window.openBilan = async function(code) {
        // Récupération de toutes les données d'escalade depuis live-engine
        const allEscaladeData = getEscaladeData();
        const localMapping = getLocalMapping();
        const currentClasse = getCurrentClasse();
        
        // Filtrer les montées de CET élève
        const mesMontees = Object.values(allEscaladeData).filter(m => `${m.groupe}${m.role}` === code);
        
        // Récupération du nom et de la photo
        const nom = getNomFromCode(code);
        
        // Récupérer la photo
        let photoUrl = null;
        const eleveId = localMapping[`${currentClasse}_${code.slice(0, 1)}`] ? localMapping[`${currentClasse}_${code.slice(0, 1)}`][parseInt(code.slice(1)) - 1] : null;
        if (eleveId) photoUrl = await getPhotoUrl(eleveId);
        
        const photoHtml = photoUrl 
            ? `<img src="${photoUrl}" class="w-16 h-16 rounded-full object-cover border-2 border-slate-500">` 
            : `<div class="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center text-xl">👤</div>`;

        // Calculs statistiques
        const nbMontees = mesMontees.length;
        const distanceTotale = mesMontees.reduce((sum, m) => sum + (m.hauteur || 0), 0);
        
        // Difficulté moyenne (pondérée par la hauteur)
        let coeffTotal = 0, hauteurTotal = 0;
        mesMontees.forEach(m => {
            const coeff = BAREME[m.cotation] || 1;
            coeffTotal += coeff * (m.hauteur || 0);
            hauteurTotal += m.hauteur || 0;
        });
        const difficultMoyenne = hauteurTotal > 0 ? (coeffTotal / hauteurTotal) : 0;
        
        // Tops (hauteur >= 9)
        const nbTops = mesMontees.filter(m => m.hauteur >= 9).length;

        // Plus grande difficulté validée (2 voies différentes)
        const validations = {};
        mesMontees.forEach(m => {
            if (!validations[m.cotation]) validations[m.cotation] = new Set();
            validations[m.cotation].add(m.voie_num);
        });
        const plusGrandeDif = Object.keys(validations)
            .filter(cot => validations[cot].size >= 2)
            .sort((a, b) => (BAREME[b] || 1) - (BAREME[a] || 1))[0] || 'Aucune';

        // Génération de la modale
        const modalHtml = `
        <div class="fixed inset-0 bg-black/90 flex items-center justify-center p-6 z-50" id="bilanModal">
            <div class="bg-slate-800 p-6 rounded-3xl border border-slate-700 w-full max-w-md">
                <div class="flex flex-col items-center mb-4">
                    ${photoHtml}
                    <h3 class="text-2xl font-black text-white mt-3">${nom}</h3>
                    <p class="text-slate-400">Code : ${code}</p>
                </div>
                <div class="space-y-3">
                    <div class="flex justify-between"><span class="text-slate-400">Nombre de montées</span><span class="font-black text-white">${nbMontees}</span></div>
                    <div class="flex justify-between"><span class="text-slate-400">Distance cumulée</span><span class="font-black text-emerald-400">${distanceTotale} m</span></div>
                    <div class="flex justify-between"><span class="text-slate-400">Nombre de Tops</span><span class="font-black text-yellow-400">${nbTops}</span></div>
                    <div class="flex justify-between"><span class="text-slate-400">Difficulté moyenne</span><span class="font-black text-blue-400">${difficultMoyenne.toFixed(1)}</span></div>
                    <div class="flex justify-between"><span class="text-slate-400">Plus grande difficulté validée (2 voies)</span><span class="font-black text-blue-400">${plusGrandeDif}</span></div>
                </div>
                <button onclick="document.getElementById('bilanModal').remove()" class="w-full mt-6 bg-slate-700 py-3 rounded-xl font-bold text-white">Fermer</button>
            </div>
        </div>`;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    };
}