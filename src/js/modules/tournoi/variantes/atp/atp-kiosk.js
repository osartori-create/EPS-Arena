// src/js/modules/tournoi/variantes/atp/atp-kiosk.js
// Kiosk élève : saisie d'un match ATP (code V, code P, scores)
import { onValue } from '../../../../core/firebase-service.js';
import { getCurrentClasse } from '../../tournoi-core.js';

let currentClasse = '';
let eleveCode = null;
let eleveAdversaire = null;
let scoreEleve = null;
let scoreAdversaire = null;

const COOLDOWN_MS = 3 * 60 * 1000; // 3 minutes
const COOLDOWN_KEY = 'eps_arena_atp_last_send';

// ============================================================
// INITIALISATION
// ============================================================
export function init(classe) {
    currentClasse = classe;
    eleveCode = null;
    eleveAdversaire = null;
    scoreEleve = null;
    scoreAdversaire = null;

    const container = document.getElementById('tournoi-module');
    if (!container) return;

        renderSaisie();

    return () => {
        // Pas de listener à nettoyer pour l'instant
    };
}

// ============================================================
// RENDU
// ============================================================
function renderSaisie(message = null, couleur = 'slate') {
    const container = document.getElementById('tournoi-module');
    if (!container) return;

    const messageHtml = message
        ? `<div class="bg-${couleur}-900/30 border-2 border-${couleur}-500 p-4 rounded-2xl mb-4 text-center">
              <p class="text-${couleur}-300 font-bold">${message}</p>
           </div>`
        : '';

    // On ne connaît pas les élèves côté iPad → l'élève saisit son code ET celui de l'adversaire
    container.innerHTML = `
        <div class="max-w-md mx-auto space-y-4">
            <div class="text-center py-4">
                <h2 class="text-3xl font-black text-white mb-2">🎾 Tournoi ATP</h2>
                <p class="text-slate-400 text-sm">Saisis ton match</p>
            </div>

            ${messageHtml}

            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <label class="text-xs font-bold text-emerald-400 uppercase block mb-2">Mon code</label>
                <input type="number" id="atp-k-code" inputmode="numeric" placeholder="Ex: 12"
                       value="${eleveCode || ''}"
                       class="w-full bg-slate-900 border-2 border-slate-600 rounded-xl p-4 text-center text-3xl font-black text-white"
                       oninput="window.atpKSetCode(this.value)">
            </div>

            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <label class="text-xs font-bold text-red-400 uppercase block mb-2">Code adversaire</label>
                <input type="number" id="atp-k-code-adv" inputmode="numeric" placeholder="Ex: 7"
                       value="${eleveAdversaire || ''}"
                       class="w-full bg-slate-900 border-2 border-slate-600 rounded-xl p-4 text-center text-3xl font-black text-white"
                       oninput="window.atpKSetAdversaire(this.value)">
            </div>

            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <p class="text-xs font-bold text-slate-400 uppercase mb-3">Score du match</p>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-[10px] text-slate-400 block mb-1 text-center">Mes points</label>
                        <input type="number" id="atp-k-sc-me" inputmode="numeric" min="0" max="99"
                               value="${scoreEleve !== null ? scoreEleve : ''}"
                               class="w-full bg-slate-900 border-2 border-slate-600 rounded-xl p-4 text-center text-4xl font-black text-white"
                               oninput="window.atpKSetScoreMe(this.value)">
                    </div>
                    <div>
                        <label class="text-[10px] text-slate-400 block mb-1 text-center">Ses points</label>
                        <input type="number" id="atp-k-sc-adv" inputmode="numeric" min="0" max="99"
                               value="${scoreAdversaire !== null ? scoreAdversaire : ''}"
                               class="w-full bg-slate-900 border-2 border-slate-600 rounded-xl p-4 text-center text-4xl font-black text-white"
                               oninput="window.atpKSetScoreAdv(this.value)">
                    </div>
                </div>
            </div>

            <button onclick="window.atpKValider()"
                    class="w-full bg-emerald-600 hover:bg-emerald-500 py-5 rounded-2xl font-black text-xl text-white active:scale-95 transition-all">
                ✅ Valider le match
            </button>
        </div>
    `;
}

// ============================================================
// SETTERS
// ============================================================
window.atpKSetCode = function(v) { eleveCode = v ? parseInt(v) : null; };
window.atpKSetAdversaire = function(v) { eleveAdversaire = v ? parseInt(v) : null; };
window.atpKSetScoreMe = function(v) { scoreEleve = v !== '' ? parseInt(v) : null; };
window.atpKSetScoreAdv = function(v) { scoreAdversaire = v !== '' ? parseInt(v) : null; };

// ============================================================
// VALIDATION
// ============================================================
window.atpKValider = async function() {
    // Vérifs de base
    if (!eleveCode || !eleveAdversaire) return renderSaisie('Renseigne les deux codes.', 'amber');
    if (eleveCode === eleveAdversaire) return renderSaisie('Le code adversaire doit être différent du tien.', 'amber');
    if (scoreEleve === null || scoreAdversaire === null) return renderSaisie('Renseigne les deux scores.', 'amber');
    if (scoreEleve === scoreAdversaire) return renderSaisie('Pas de match nul au tennis de table !', 'amber');

    // Détermination V/P
    const codeV = scoreEleve > scoreAdversaire ? eleveCode : eleveAdversaire;
    const codeP = scoreEleve > scoreAdversaire ? eleveAdversaire : eleveCode;
    const scoreV = Math.max(scoreEleve, scoreAdversaire);
    const scoreP = Math.min(scoreEleve, scoreAdversaire);

    // Anti-triche : cooldown local par code (source ET cible)
    const cooldowns = JSON.parse(localStorage.getItem(COOLDOWN_KEY) || '{}');
    const now = Date.now();
    for (const c of [String(eleveCode), String(eleveAdversaire)]) {
        const last = cooldowns[c] || 0;
        if (now - last < COOLDOWN_MS) {
            const restant = Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
            return renderSaisie(`⏳ Trop rapide (code #${c}). Attends encore ${restant}s.`, 'amber');
        }
    }

    // Calcul ecart/points : on lit le classement courant puis on calcule
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    const baseATP = `etablissements/0680013V/profs/${profCode}/${currentClasse}/tournoi/atp`;

    // On a besoin du classement actuel → on relit les matchs
    const { recalculerTout, calculerMatch, BAREME_DEFAUT, POINTS_INITIAUX } = await import('./atp-core.js');

    const matchsSnap = await new Promise(resolve => {
        onValue(ref(db, `${baseATP}/matchs`), resolve, { onlyOnce: true });
    });
    const matchs = matchsSnap.val() || {};

    const configSnap = await new Promise(resolve => {
        onValue(ref(db, `${baseATP}/config`), resolve, { onlyOnce: true });
    });
    const config = configSnap.val() || {};
    const bareme = (config.bareme && config.bareme.length > 0) ? config.bareme : BAREME_DEFAUT;

    // Liste des codes : on la déduit des matchs existants + les 2 du match courant
    const codesSet = new Set([String(eleveCode), String(eleveAdversaire)]);
    Object.values(matchs).forEach(m => {
        if (m.codeV) codesSet.add(String(m.codeV));
        if (m.codeP) codesSet.add(String(m.codeP));
    });

    const joueurs = recalculerTout(Array.from(codesSet), matchs, bareme);
    const jV = joueurs[String(codeV)] || { points: POINTS_INITIAUX };
    const jP = joueurs[String(codeP)] || { points: POINTS_INITIAUX };
    const { ecart, ptsV, ptsP } = calculerMatch(jV, jP, bareme);

    const payload = {
        codeV: String(codeV),
        codeP: String(codeP),
        scoreV, scoreP,
        ecart, ptsV, ptsP,
        timestamp: now,
        source: 'kiosk'
    };

    try {
        await push(ref(db, `${baseATP}/matchs`), payload);

        // MàJ cooldown
        cooldowns[String(eleveCode)] = now;
        cooldowns[String(eleveAdversaire)] = now;
        localStorage.setItem(COOLDOWN_KEY, JSON.stringify(cooldowns));

        renderSaisie(`✅ Match enregistré !<br>#${codeV} bat #${codeP} · ${scoreV}-${scoreP}<br>+${ptsV} pts / ${ptsP} pts`, 'emerald');

        // Retour auto après 3s
        setTimeout(() => {
            eleveCode = null;
            eleveAdversaire = null;
            scoreEleve = null;
            scoreAdversaire = null;
            renderSaisie();
        }, 3000);
    } catch (err) {
        console.error(err);
        renderSaisie('❌ Erreur lors de l\'enregistrement.', 'red');
    }
};

window.atpInitKiosk = init;
export default init;