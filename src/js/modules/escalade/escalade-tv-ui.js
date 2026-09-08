// src/js/modules/escalade/escalade-tv-ui.js
import { db, ref, onValue } from '../../core/firebase-service.js';
import { getLocalMapping, getCurrentClasse } from '../../core/live-engine.js';
import { getPhotoUrl } from '../../services/admin-service.js';

let currentUnsub = null;
let currentMode = 'classic';

export async function renderEscaladeTV() {
    const container = document.getElementById('tvGlobe');
    if (!container) return;

    const tvView = document.getElementById('viewTV');
    if (tvView) {
        tvView.style.display = 'block';
        tvView.style.height = '100vh';
        tvView.style.padding = '10px';
    }

    container.style.height = '90vh';
    container.style.width = '100%';
    container.style.backgroundColor = '#1e293b';
    container.style.overflow = 'hidden';
    container.style.display = 'flex';
    container.style.flexDirection = 'row';
    container.style.justifyContent = 'space-around';
    container.style.alignItems = 'flex-start';

    const classe = getCurrentClasse();
    if (!classe) {
        container.innerHTML = '<p style="text-align:center; color: #64748b; margin-top: 50px;">Sélectionnez une classe.</p>';
        return;
    }

    const savedMode = localStorage.getItem('escalade_mode') || 'classic';
    currentMode = savedMode;

    if (currentUnsub) {
        currentUnsub();
        currentUnsub = null;
    }

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const monteesPath = `etablissements/0680013V/profs/${profCode}/${classe}/escalade/montees`;
    const validationsPath = `etablissements/0680013V/profs/${profCode}/${classe}/bloccontest/validations`;
    const configPath = `etablissements/0680013V/profs/${profCode}/${classe}/bloccontest/config`;

    container.innerHTML = '<p style="text-align:center; color: #64748b; margin-top: 50px;">En attente des performances...</p>';

    if (currentMode === 'classic') {
        const monteesRef = ref(db, monteesPath);
        currentUnsub = onValue(monteesRef, async (snap) => {
            const montees = snap.val() || {};
            await renderClassicTV(container, montees, classe);
        });
    } else {
        const validationsRef = ref(db, validationsPath);
        const configRef = ref(db, configPath);
        
        let config = {};
        let validations = {};
        let loaded = 0;

        function checkAndRender() {
            if (loaded >= 2) {
                renderBlocTV(container, validations, config, classe);
            }
        }

        onValue(configRef, (snap) => {
            config = snap.val() || {};
            loaded++;
            checkAndRender();
        }, { onlyOnce: true });

        currentUnsub = onValue(validationsRef, (snap) => {
            validations = snap.val() || {};
            loaded++;
            checkAndRender();
        });
    }
}

async function renderClassicTV(container, montees, classe) {
    const monteesList = Object.values(montees);

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const configRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/config`);
    const configSnap = await new Promise(resolve => onValue(configRef, resolve, { onlyOnce: true }));
    const config = configSnap.val() || {};

    const localMapping = getLocalMapping(classe) || {};
    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');

    const equipes = [];
    Object.keys(config).forEach(key => {
        if (key !== 'activite' && key !== 'nbGroupes' && key !== 'reserve' && typeof config[key] === 'number') {
            equipes.push({ lettre: key, score: 0 });
        }
    });
    equipes.sort((a, b) => a.lettre.localeCompare(b.lettre));

    for (const m of monteesList) {
        const equipe = equipes.find(eq => eq.lettre === m.groupe);
        if (equipe) equipe.score += Number(m.points || m.hauteur || 0);
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
                membresGroupes[m.role] += Number(m.points || m.hauteur || 0);
            }
        });

        const rolesTries = Object.keys(membresGroupes).sort((a, b) => membresGroupes[b] - membresGroupes[a]);

        let photosHtml = '<div style="display: flex; flex-direction: column; gap: 5px; margin-top: 10px;">';
        for (const role of rolesTries) {
            const index = parseInt(role) - 1;
            const mappingKey = `${classe}_${eq.lettre}`;
            let eleveId = null;
            if (localMapping[mappingKey] && Array.isArray(localMapping[mappingKey])) {
                eleveId = localMapping[mappingKey][index];
            } else if (localMapping[`${classe}_${eq.lettre}${role}`]) {
                eleveId = localMapping[`${classe}_${eq.lettre}${role}`];
            }

            let photoUrl = null;
            if (eleveId) {
                try { photoUrl = await getPhotoUrl(eleveId); } catch (e) {}
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

async function renderBlocTV(container, validations, config, classe) {
    const validationsList = Object.values(validations);
    const blocs = config.blocs || [];

    if (validationsList.length === 0) {
        container.innerHTML = '<p style="text-align:center; color: #64748b; margin-top: 50px;">Aucune validation Bloc Contest.</p>';
        return;
    }

    const scores = {};
    validationsList.forEach(v => {
        if (!scores[v.eleveId]) scores[v.eleveId] = 0;
        scores[v.eleveId] += v.valeurAuMoment || 0;
    });

    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${classe}`) || '[]');
    const classement = Object.entries(scores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    if (classement.length === 0) {
        container.innerHTML = '<p style="text-align:center; color: #64748b; margin-top: 50px;">Aucun score.</p>';
        return;
    }

    const maxScore = Math.max(...classement.map(([, score]) => score), 1);
    const topMax = 20;
    const topMin = 420;

    let html = '';
    for (const [eleveId, score] of classement) {
        const eleve = eleves.find(e => e.id === eleveId);
        const nom = eleve ? `${eleve.prenom} ${eleve.nom}` : eleveId;
        const topPos = topMin - ((score / maxScore) * (topMin - topMax));

        let photoUrl = null;
        try { photoUrl = await getPhotoUrl(eleveId); } catch (e) {}

        const photoHtml = photoUrl 
            ? `<div style="width: 60px; height: 60px; border-radius: 50%; background-image: url('${photoUrl}'); background-size: cover; border: 3px solid #facc15; margin: 0 auto;"></div>`
            : `<div style="width: 60px; height: 60px; border-radius: 50%; background: #334155; display: flex; align-items: center; justify-content: center; font-size: 30px; margin: 0 auto;">👤</div>`;

        html += `
        <div style="display: flex; flex-direction: column; align-items: center; position: relative; top: ${topPos}px; transition: top 0.5s ease; min-width: 80px;">
            ${photoHtml}
            <div style="color: white; font-size: 16px; font-weight: 700; margin-top: 5px; text-align: center;">${nom}</div>
            <div style="color: #facc15; font-size: 24px; font-weight: 900;">${score} pts</div>
        </div>`;
    }

    container.innerHTML = html;
}