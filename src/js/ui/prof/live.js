import { initLiveEngine, getConfigData, getEscaladeData, getStudentsMap, getLocalMapping, getCurrentClasse } from '../../core/live-engine.js';
import { renderEscaladeLive } from '../../modules/escalade/escalade-live.js';
import { renderCOLive } from '../../modules/co/co-live.js';
import { renderMultiLive } from '../../modules/multi/multi-live.js';
import { renderEscaladeTV } from '../../modules/escalade/escalade-tv-ui.js';
import { getPhotoUrl } from '../../services/admin-service.js';

let currentClasse = "";

async function renderTV() {
    const container = document.getElementById('tvGlobe');
    if (!container) return;

    container.style.height = '600px';
    container.style.width = '100%';
    container.style.backgroundColor = '#1e293b';
    container.style.overflow = 'hidden';
    container.style.display = 'flex';
    container.style.flexDirection = 'row';
    container.style.justifyContent = 'space-around';
    container.style.alignItems = 'flex-start';

    const config = getConfigData();
    const montees = getEscaladeData();
    const localMapping = getLocalMapping(); // ✅ AJOUTÉ
    const currentClasse = getCurrentClasse(); // ✅ AJOUTÉ

    if (!config) {
        container.innerHTML = '<p style="text-align:center; color: #64748b; margin-top: 50px;">En attente de la configuration du prof...</p>';
        return;
    }

    const equipes = [];
    Object.keys(config).forEach(key => {
        if (key !== 'activite' && (typeof config[key] === 'number' || Array.isArray(config[key]))) {
            equipes.push({ lettre: key, score: 0 });
        }
    });
    equipes.sort((a, b) => a.lettre.localeCompare(b.lettre));

    const monteesList = Object.values(montees || {});
    for (const m of monteesList) {
        const equipe = equipes.find(eq => eq.lettre === m.groupe);
        if (equipe) equipe.score += (m.points || 0);
    }

    const equipesAvecScore = equipes.filter(eq => eq.score > 0);
    if (equipesAvecScore.length === 0) {
        container.innerHTML = '<p style="text-align:center; color: #64748b; margin-top: 50px;">En attente des performances...</p>';
        return;
    }

    const maxScore = Math.max(...equipesAvecScore.map(eq => eq.score), 1);
    const topMax = 20;
    const topMin = 420;

    let html = '';
    for (const eq of equipesAvecScore) {
        const topPos = topMin - ((eq.score / maxScore) * (topMin - topMax));

        const membresGroupes = {};
        monteesList.forEach(m => {
            if (m.groupe === eq.lettre) {
                if (!membresGroupes[m.role]) membresGroupes[m.role] = 0;
                membresGroupes[m.role] += (m.points || 0);
            }
        });

        const rolesTries = Object.keys(membresGroupes).sort((a, b) => membresGroupes[b] - membresGroupes[a]);

        let photosHtml = '<div style="display: flex; flex-direction: column; gap: 5px; margin-top: 10px;">';
        for (const role of rolesTries) {
            const index = parseInt(role) - 1;
            const mappingKey = `${currentClasse}_${eq.lettre}`;
            let eleveId = null;
            if (localMapping[mappingKey] && Array.isArray(localMapping[mappingKey])) {
                eleveId = localMapping[mappingKey][index];
            } else if (localMapping[`${currentClasse}_${eq.lettre}${role}`]) {
                eleveId = localMapping[`${currentClasse}_${eq.lettre}${role}`];
            }

            let photoUrl = null;
            if (eleveId) {
                try {
                    photoUrl = await getPhotoUrl(eleveId);
                } catch (e) { /* ignore */ }
            }

            if (photoUrl) {
                photosHtml += `<div style="width: 40px; height: 40px; border-radius: 50%; background-image: url('${photoUrl}'); background-size: cover; border: 2px solid #3b82f6;"></div>`;
            } else {
                photosHtml += `<div style="width: 40px; height: 40px; border-radius: 50%; background: #334155; display: flex; align-items: center; justify-content: center; font-size: 18px;">👤</div>`;
            }
        }
        photosHtml += '</div>';

        html += `
        <div style="display: flex; flex-direction: column; align-items: center; position: relative; top: ${topPos}px; transition: top 0.5s ease;">
            <div style="font-size: 60px;">🧗</div>
            <div style="background: #3b82f6; color: white; font-size: 30px; font-weight: 900; padding: 5px 15px; border-radius: 10px; margin-top: 5px;">${eq.lettre}</div>
            <div style="color: #facc15; font-size: 24px; font-weight: 800; margin-top: 5px;">${eq.score.toFixed(0)} m</div>
            ${photosHtml}
        </div>`;
    }

    container.innerHTML = html;
}

// Exposer globalement pour que layout.js puisse l'appeler
window.renderEscaladeTV = renderEscaladeTV;

export function initLiveUI() {
    initLiveEngine();

    // Écoute des données pour mettre à jour la TV automatiquement
    window.addEventListener('live-data-updated', (e) => {
        const { type, data } = e.detail;
        const currentActivite = getConfigData().activite || 'multi';

        if (type === 'escalade' && currentActivite === 'escalade') {
            renderEscaladeLive(data);
            // Si la TV est ouverte, on met à jour
            if (document.getElementById('viewTV') && !document.getElementById('viewTV').classList.contains('hidden')) {
                renderTV();
            }
        } else if (type === 'co' && currentActivite === 'co') {
            renderCOLive(data);
        } else if (type === 'multi' && currentActivite === 'multi') {
            renderMultiLive(data);
        }
    });

    // Écoute des changements de config
    window.addEventListener('live-config-updated', () => {
        document.getElementById('live-content').innerHTML = '<p class="text-slate-500 text-center">En attente des données...</p>';
        // Mise à jour de la TV si elle est ouverte
        if (document.getElementById('viewTV') && !document.getElementById('viewTV').classList.contains('hidden')) {
            renderTV();
        }
    });
}

window.exportResultsLive = function() {
    if (!currentClasse) {
        currentClasse = document.getElementById('selectClasse').value;
    }
    if (!currentClasse) return alert("Sélectionnez une classe.");

    const studentsMap = getStudentsMap();
    const localMap = getLocalMapping();

    let csv = "\uFEFFNom;Type;Valeur\n";

    const rows = document.querySelectorAll('#live-content .bg-slate-800');
    rows.forEach(row => {
        const nameSpan = row.querySelector('.text-white');
        const valueSpan = row.querySelector('span:last-child');
        const name = nameSpan ? nameSpan.innerText : '';
        const value = valueSpan ? valueSpan.innerText : '';
        csv += `${name};Performance;${value}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Live_${currentClasse}.csv`;
    a.click();
};