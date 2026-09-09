// src/js/modules/natation/natation-tv.js
import { db, ref, onValue } from '../../core/firebase-service.js';
import { getPhotoUrl } from '../../services/admin-service.js';
import { getLocalMapping, getCurrentClasse } from '../../core/live-engine.js';
import { getExistingEleves } from '../../services/admin-service.js';

let currentUnsubTemps = null;
let currentUnsubCoups = null;

// ============================================================
// BARÈME
// ============================================================
function getNiveau(indice) {
    if (indice === null || isNaN(indice)) return { couleur: '#64748b', label: '--' };
    const rounded = Math.round(indice * 100) / 100;
    if (rounded >= 4.0) return { couleur: '#22c55e', label: 'Excellent' };
    if (rounded >= 3.0) return { couleur: '#3b82f6', label: 'Très satisfaisant' };
    if (rounded >= 2.0) return { couleur: '#eab308', label: 'Satisfaisant' };
    if (rounded >= 1.31) return { couleur: '#f97316', label: 'Fragile' };
    return { couleur: '#ef4444', label: 'Très insuffisant' };
}

function calculIndice(tempsMs, nbCoups) {
    if (tempsMs === null || nbCoups === null || tempsMs <= 0 || nbCoups <= 0) return null;
    const tempsSec = tempsMs / 1000;
    const cycles = nbCoups / 2;
    if (cycles <= 0) return null;
    const vitesse = 25 / tempsSec;
    const distanceParCycle = 25 / cycles;
    return vitesse * distanceParCycle;
}

// ============================================================
// RENDU PRINCIPAL
// ============================================================
export function renderNatationTV() {
    const container = document.getElementById('tvGlobe');
    if (!container) return;

    const tvView = document.getElementById('viewTV');
    if (tvView) {
        tvView.style.display = 'block';
        tvView.style.height = '100vh';
        tvView.style.padding = '0';
        tvView.style.overflow = 'hidden';
    }

    container.style.height = '100vh';
    container.style.width = '100%';
    container.style.backgroundColor = '#0f172a';
    container.style.overflow = 'hidden';
    container.style.position = 'relative';
    container.style.padding = '0';

    const classe = getCurrentClasse();
    if (!classe) {
        container.innerHTML = '<p style="text-align:center; color:#64748b; font-size:2rem; margin-top:40vh;">Sélectionnez une classe.</p>';
        return;
    }

    if (currentUnsubTemps) currentUnsubTemps();
    if (currentUnsubCoups) currentUnsubCoups();

    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const tempsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/natation/temps`);
    const coupsRef = ref(db, `etablissements/0680013V/profs/${profCode}/${classe}/natation/coups`);

    let tempsData = {};
    let coupsData = {};
    const mapping = getLocalMapping(classe) || {};
    const eleves = getExistingEleves(classe);

    // Configuration de l'échelle
    const INDICE_MIN = 0.8;
    const INDICE_MAX = 4.5;

    // Zones de couleur (du bas vers le haut)
    const ZONES = [
        { min: 0, max: 1.3, couleur: '#ef4444', label: 'Très insuffisant' },
        { min: 1.3, max: 2.0, couleur: '#f97316', label: 'Fragile' },
        { min: 2.0, max: 3.0, couleur: '#eab308', label: 'Satisfaisant' },
        { min: 3.0, max: 4.0, couleur: '#3b82f6', label: 'Très satisfaisant' },
        { min: 4.0, max: 6.0, couleur: '#22c55e', label: 'Excellent' }
    ];

    // Repères de l'axe vertical (seuils)
    const REPERES = [
        { valeur: 1.0, label: '1.0' },
        { valeur: 1.3, label: '1.3' },
        { valeur: 2.0, label: '2.0' },
        { valeur: 3.0, label: '3.0' },
        { valeur: 4.0, label: '4.0' }
    ];

    async function render() {
        if (Object.keys(tempsData).length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#64748b; font-size:2rem; margin-top:40vh;">En attente des résultats...</p>';
            return;
        }

        // 1. Collecter les meilleurs indices par élève
        const eleveData = [];
        for (const [numero, tempsMs] of Object.entries(tempsData)) {
            const eleveId = mapping[`${classe}_${numero}`];
            const eleve = eleves.find(e => e.id === eleveId);
            if (!eleve) continue;
            const coups = coupsData[numero] || null;
            const indice = calculIndice(tempsMs, coups);
            if (indice === null) continue;
            eleveData.push({
                numero: parseInt(numero),
                eleve,
                indice: indice,
                tempsMs,
                coups
            });
        }

        if (eleveData.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#64748b; font-size:2rem; margin-top:40vh;">Aucune performance enregistrée.</p>';
            return;
        }

        // 2. Regrouper par tranche d'indice (arrondi à 0.1)
        const groupes = {};
        for (const item of eleveData) {
            const cle = Math.round(item.indice * 10) / 10;
            if (!groupes[cle]) groupes[cle] = [];
            groupes[cle].push(item);
        }

        // 3. Calculer la taille des photos en fonction du nombre max d'élèves dans un groupe
        const maxElevesParGroupe = Math.max(...Object.values(groupes).map(arr => arr.length));
        // Taille en pixels, entre 40px et 70px
        const photoSizePx = Math.max(40, Math.min(70, 500 / maxElevesParGroupe));
        // Taille en vw pour responsive
        const photoSizeVw = Math.min(8, Math.max(4, (photoSizePx / window.innerWidth) * 100));
        const photoSize = `clamp(40px, ${photoSizeVw}vw, 70px)`;

        // 4. Construire le HTML avec les zones de fond
        let html = `
            <style>
                .tv-container {
                    position: relative;
                    width: 100%;
                    height: 100vh;
                    background: #0f172a;
                    overflow: hidden;
                }
                .tv-background {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    pointer-events: none;
                    z-index: 0;
                }
                .tv-background .zone {
                    position: absolute;
                    left: 0;
                    width: 100%;
                    opacity: 0.25;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                }
                .tv-background .repere {
                    position: absolute;
                    left: 60px;
                    right: 60px;
                    height: 1px;
                    background: rgba(255,255,255,0.15);
                    z-index: 1;
                }
                .tv-background .repere-label {
                    position: absolute;
                    left: 10px;
                    transform: translateY(-50%);
                    color: rgba(255,255,255,0.4);
                    font-size: 1.2rem;
                    font-weight: 700;
                    z-index: 1;
                    text-shadow: 0 0 10px rgba(0,0,0,0.8);
                }
                .tv-eleves {
                    position: relative;
                    width: 100%;
                    height: 100%;
                    z-index: 2;
                }
                .tv-eleve {
                    position: absolute;
                    transform: translate(-50%, -50%);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    transition: top 0.8s ease, left 0.8s ease;
                    z-index: 3;
                }
                .tv-eleve .photo {
                    width: ${photoSize};
                    height: ${photoSize};
                    border-radius: 50%;
                    overflow: hidden;
                    border: 3px solid rgba(255,255,255,0.3);
                    box-shadow: 0 4px 15px rgba(0,0,0,0.5);
                    transition: border-color 0.3s ease;
                    flex-shrink: 0;
                }
                .tv-eleve .photo img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                .tv-eleve .photo .fallback {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #334155;
                    font-size: calc(${photoSize} * 0.45);
                    color: #94a3b8;
                }
                .tv-eleve .numero {
                    margin-top: 2px;
                    font-size: clamp(0.6rem, ${photoSizeVw * 0.25}vw, 1.2rem);
                    font-weight: 900;
                    color: #facc15;
                    text-shadow: 0 0 10px rgba(0,0,0,0.9);
                    background: rgba(0,0,0,0.5);
                    padding: 0 6px;
                    border-radius: 10px;
                    white-space: nowrap;
                    line-height: 1.4;
                }
                @media (max-width: 768px) {
                    .tv-background .repere-label { font-size: 0.8rem; left: 5px; }
                    .tv-background .repere { left: 30px; right: 30px; }
                }
                @media (max-width: 480px) {
                    .tv-background .repere-label { font-size: 0.6rem; }
                    .tv-background .repere { left: 15px; right: 15px; }
                }
            </style>
            <div class="tv-container" id="tv-container">
                <!-- FOND -->
                <div class="tv-background" id="tv-background">
        `;

        // Ajouter les zones de couleur
        for (const zone of ZONES) {
            const topPct = 100 - ((zone.min - INDICE_MIN) / (INDICE_MAX - INDICE_MIN)) * 100;
            const heightPct = ((zone.max - zone.min) / (INDICE_MAX - INDICE_MIN)) * 100;
            const zoneCss = `top: ${topPct}%; height: ${heightPct}%; background: ${zone.couleur};`;
            html += `<div class="zone" style="${zoneCss}"></div>`;
        }

        // Ajouter les repères horizontaux
        for (const repere of REPERES) {
            const topPct = 100 - ((repere.valeur - INDICE_MIN) / (INDICE_MAX - INDICE_MIN)) * 100;
            html += `
                <div class="repere" style="top: ${topPct}%;"></div>
                <div class="repere-label" style="top: ${topPct}%;">${repere.label}</div>
            `;
        }

        html += `</div>`; // fin background

        // 5. Placer les élèves
        html += `<div class="tv-eleves" id="tv-eleves">`;

        const paddingX = 6; // pourcentage
        const largeurDispo = 100 - 2 * paddingX;
        const groupesTries = Object.keys(groupes).sort((a, b) => parseFloat(b) - parseFloat(a));

        const elevesToRender = [];

        for (const cle of groupesTries) {
            const items = groupes[cle];
            const indice = parseFloat(cle);
            const yPct = 100 - ((Math.min(Math.max(indice, INDICE_MIN), INDICE_MAX) - INDICE_MIN) / (INDICE_MAX - INDICE_MIN)) * 100;
            const nb = items.length;
            // Calculer l'espacement horizontal pour éviter les chevauchements
            const espacementMin = (photoSizePx / window.innerWidth) * 100; // en pourcentage
            const espacement = Math.max(espacementMin * 1.2, largeurDispo / (nb + 1));
            const debutX = paddingX + espacement / 2;

            for (let i = 0; i < nb; i++) {
                const item = items[i];
                const xPct = debutX + i * espacement;
                const niveau = getNiveau(item.indice);
                elevesToRender.push({
                    numero: item.numero,
                    eleve: item.eleve,
                    x: xPct,
                    y: yPct,
                    niveau: niveau
                });
            }
        }

        // Générer le HTML des élèves (avec fallback photo)
        let elevesHtmlFinal = '';
        for (const item of elevesToRender) {
            const colorBorder = item.niveau.couleur;
            elevesHtmlFinal += `
                <div class="tv-eleve" style="top: ${item.y}%; left: ${item.x}%;" data-numero="${item.numero}">
                    <div class="photo" style="border-color: ${colorBorder};" id="photo-${item.numero}">
                        <div class="fallback">👤</div>
                    </div>
                    <div class="numero">#${item.numero}</div>
                </div>
            `;
        }

        html += elevesHtmlFinal;
        html += `</div></div>`; // fin tv-eleves et tv-container

        container.innerHTML = html;

        // 6. Charger les photos en asynchrone
        for (const item of elevesToRender) {
            const photoDiv = document.getElementById(`photo-${item.numero}`);
            if (!photoDiv) continue;
            try {
                const url = await getPhotoUrl(item.eleve.id);
                if (url) {
                    photoDiv.innerHTML = `<img src="${url}" alt="${item.eleve.prenom}">`;
                }
            } catch (e) {
                // fallback déjà présent
            }
        }
    }

    currentUnsubTemps = onValue(tempsRef, (snap) => {
        tempsData = snap.val() || {};
        render();
    });

    currentUnsubCoups = onValue(coupsRef, (snap) => {
        coupsData = snap.val() || {};
        render();
    });
}