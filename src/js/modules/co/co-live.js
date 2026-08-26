import { getNomFromCode, getPhotoHtml } from '../../core/live-engine.js';

export function renderCOLive(data) {
    const container = document.getElementById('live-content');
    if (!container) return;

    const entries = Object.values(data).reverse();
    let html = `<h3 class="font-black text-blue-400 uppercase text-sm mb-2">🧭 Validations CO</h3><div class="space-y-2">`;
    
    const promises = entries.map(async v => {
        const nom = getNomFromCode(v.code);
        const photoHtml = await getPhotoHtml(v.code);
        return `<div class="bg-slate-800 p-3 rounded-xl border border-slate-700 flex items-center gap-3 justify-between">
                <div class="flex items-center gap-3">
                    ${photoHtml}
                    <span class="font-bold text-white">${nom}</span>
                </div>
                <span class="text-blue-400 font-black">Balise ${v.balise}</span>
            </div>`;
    });

    Promise.all(promises).then(results => {
        html += results.join('');
        html += `</div>`;
        container.innerHTML = html;
    });
}