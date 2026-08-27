import { getNomFromCode, getPhotoHtml } from '../../core/live-engine.js';

export function renderEscaladeLive(data) {
    const container = document.getElementById('live-content');
    if (!container) return;

    const entries = Object.values(data).reverse();
    let html = `<h3 class="font-black text-blue-400 uppercase text-sm mb-2">🧗 Montées Escalade</h3><div class="space-y-2">`;
    
    const promises = entries.map(async m => {
        const code = `${m.groupe}${m.role}`;
        const nom = getNomFromCode(code);
        const photoHtml = await getPhotoHtml(code);
        return `<div class="bg-slate-800 p-3 rounded-xl border border-slate-700 flex items-center gap-3 justify-between">
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
}