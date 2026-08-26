import { db } from '../../core/firebase-service.js';
import { ref, onValue } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-database.js";
import { getConfigData, getEscaladeData, getStudentsMap, getLocalMapping } from '../../core/live-engine.js';
import { getPhotoUrl } from '../../services/admin-service.js';

// Fonction de rendu TV directement intégrée (100% fiable)
async function renderTVDirect() {
    const container = document.getElementById('tvGlobe');
    if (!container) return;

    const config = getConfigData();
    const montees = getEscaladeData();
    const studentsMap = getStudentsMap();
    const localMapping = getLocalMapping();

    if (!config) {
        container.innerHTML = '<p class="text-slate-500 text-center mt-20">En attente de la configuration du prof...</p>';
        return;
    }

    // 1. Identifier les équipes
    const equipes = [];
    Object.keys(config).forEach(key => {
        if (key !== 'activite' && (typeof config[key] === 'number' || Array.isArray(config[key]))) {
            equipes.push({ lettre: key, score: 0, membres: [] });
        }
    });

    // 2. Calcul des scores
    for (const m of Object.values(montees || {})) {
        const equipe = equipes.find(eq => eq.lettre === m.groupe);
        if (equipe) {
            equipe.score += (m.points || 0);
            const lettre = m.groupe;
            const index = parseInt(m.role) - 1;
            const mappingKey = `${lettre}`;
            let eleveId = null;
            if (localMapping[mappingKey] && localMapping[mappingKey][index]) {
                eleveId = localMapping[mappingKey][index];
            }
            const existing = equipe.membres.find(mem => mem.code === `${lettre}${m.role}`);
            if (existing) {
                existing.points += (m.points || 0);
            } else {
                equipe.membres.push({ code: `${lettre}${m.role}`, points: m.points || 0, eleveId });
            }
        }
    }

    // 3. Trier
    equipes.sort((a, b) => b.score - a.score);

    // 4. Construire la montagne (CSS inline)
    const baseHeight = 500;
    const maxHeight = baseHeight * 0.85;
    const maxScore = Math.max(...equipes.map(eq => eq.score), 1);

    let html = `<div style="width: 100%; height: ${baseHeight}px; position: relative; background: #1e293b; border-radius: 16px; overflow: hidden;">`;

    html += `<div style="position: absolute; bottom: 0; left: 0; right: 0; height: 25%; background: #334155;"></div>`;
    html += `<div style="position: absolute; bottom: 25%; left: 0; right: 0; height: 25%; background: #475569;"></div>`;
    html += `<div style="position: absolute; bottom: 50%; left: 0; right: 0; height: 25%; background: #64748b;"></div>`;
    html += `<div style="position: absolute; bottom: 75%; left: 0; right: 0; height: 25%; background: #94a3b8;"></div>`;

    html += `<div style="position: absolute; bottom: 0; left: 0; right: 0; display: flex; justify-content: space-around; align-items: flex-end; padding-bottom: 10px;">`;

    for (const eq of equipes) {
        const teamHeight = (eq.score / maxScore) * maxHeight;

        const groupes = [];
        for (const m of eq.membres) {
            if (m.points <= 0) continue;
            const last = groupes[groupes.length - 1];
            if (last && last.points === m.points) {
                last.membres.push(m);
            } else {
                groupes.push({ points: m.points, membres: [m] });
            }
        }

        let teteHtml = '';
        for (const grp of groupes) {
            let memberHeight = (grp.points / eq.score) * maxHeight;
            memberHeight = Math.min(memberHeight, teamHeight * 0.7);

            let groupHtml = '<div style="display: flex; justify-content: center; gap: 5px; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%) translateY(-' + memberHeight + 'px); transition: transform 1s ease;">';
            for (const m of grp.membres) {
                let photoUrl = null;
                if (m.eleveId) photoUrl = await getPhotoUrl(m.eleveId);
                if (photoUrl) {
                    groupHtml += `<div style="width: 40px; height: 40px; border-radius: 50%; background-image: url('${photoUrl}'); background-size: cover; border: 2px solid #3b82f6;"></div>`;
                }
            }
            groupHtml += '</div>';
            teteHtml += groupHtml;
        }

        html += `
        <div style="position: relative; height: ${teamHeight}px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; width: 150px;">
            <div style="position: absolute; bottom: 50px; display: flex; flex-direction: column; align-items: center;">
                <div style="font-size: 70px;">🧗</div>
                <div style="background: #3b82f6; color: white; font-size: 40px; font-weight: 900; padding: 8px 20px; border-radius: 12px; margin-top: 10px;">${eq.lettre}</div>
                <div style="color: #facc15; font-size: 32px; font-weight: 900; margin-top: 6px;">${eq.score.toFixed(0)} m</div>
            </div>
            <div style="position: absolute; bottom: 0; left: 0; right: 0; height: 50px;">
                ${teteHtml}
            </div>
        </div>`;
    }

    html += `</div></div>`;
    container.innerHTML = html;
}

export function initLayout() {
    
    // 1. Gestion des onglets
    window.switchTab = function(tabName) {
        ['admin', 'activities', 'live', 'tv'].forEach(t => {
            const viewId = 'view' + t.charAt(0).toUpperCase() + t.slice(1);
            const el = document.getElementById(viewId);
            if (el) el.classList.add('hidden');
        });

        ['btnTab1', 'btnTab2', 'btnTab3', 'btnTab4'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.classList.remove('tab-active', 'text-blue-500');
                btn.classList.add('text-slate-500');
            }
        });

        const map = { 'admin': '1', 'activities': '2', 'live': '3', 'tv': '4' };
        const targetViewId = 'view' + tabName.charAt(0).toUpperCase() + tabName.slice(1);
        const targetView = document.getElementById(targetViewId);
        if (targetView) targetView.classList.remove('hidden');

        // Cas spécifique pour l'onglet TV : on appelle notre fonction intégrée
        if (tabName === 'tv') {
            setTimeout(() => {
                renderTVDirect();
            }, 200);
        }

        const targetBtn = document.getElementById('btnTab' + map[tabName]);
        if (targetBtn) targetBtn.classList.add('tab-active', 'text-blue-500');
    };

    // 2. Gestion des classes
    function initClassesSelect() {
        const select = document.getElementById('selectClasse');
        if (!select) return; 
        select.innerHTML = '<option value="">-- Classe --</option>';
        let classes = JSON.parse(localStorage.getItem('eps_arena_classes')) || [];
        classes.forEach(nom => {
            const option = document.createElement('option');
            option.value = nom;
            option.textContent = nom;
            select.appendChild(option);
        });
    }
    initClassesSelect();

    window.addClasse = function() {
        const nom = prompt("Nom de la classe ?");
        if (nom) {
            let classes = JSON.parse(localStorage.getItem('eps_arena_classes')) || [];
            if (!classes.includes(nom)) {
                classes.push(nom);
                localStorage.setItem('eps_arena_classes', JSON.stringify(classes));
                
                const select = document.getElementById('selectClasse');
                if (select) {
                    const option = document.createElement('option');
                    option.value = nom; option.textContent = nom;
                    select.appendChild(option); select.value = nom;
                    select.dispatchEvent(new Event('change'));
                }
                alert("Classe ajoutée !");
            } else {
                alert("Cette classe existe déjà.");
                const select = document.getElementById('selectClasse');
                if (select) {
                    select.value = nom; select.dispatchEvent(new Event('change'));
                }
            }
        }
    };

    // 3. Gestion du Code Prof
    const profInput = document.getElementById('profCode');
    if (profInput) {
        profInput.value = localStorage.getItem('eps_arena_profCode') || '';
        profInput.addEventListener('change', (e) => {
            localStorage.setItem('eps_arena_profCode', e.target.value.toUpperCase());
            alert("Code Prof enregistré !");
        });
    }

    // 4. Connexion Firebase
    onValue(ref(db, '.info/connected'), (snap) => {
        const dot = document.getElementById('connDot');
        const label = document.getElementById('connLabel');
        if (dot && label) {
            dot.className = "w-3 h-3 rounded-full " + (snap.val() ? "bg-emerald-500" : "bg-red-500");
            label.textContent = snap.val() ? "En ligne" : "Hors ligne";
        }
    });
}