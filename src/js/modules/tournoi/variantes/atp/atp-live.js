// src/js/modules/tournoi/variantes/atp/atp-live.js
// Live prof ATP : classement temps réel + ajustement manuel des points + export CSV
import { db, ref, onValue, set } from '../../../../core/firebase-service.js';
import { getCurrentClasse } from '../../tournoi-core.js';
import { getPhotoUrl } from '../../../../services/admin-service.js';
import { recalculerTout, trierClassement, appliquerAjustements, BAREME_DEFAUT, getMedaille, formatEcart } from './atp-core.js';

let unsub = null;

// État partagé (pour l'ajustement manuel et l'export CSV)
let _classe = '';
let _elevesMap = {};
let _codes = [];
let _matchs = {};
let _config = {};
let _ajustements = {};

function getATPBasePath(classe) {
    const profCode = localStorage.getItem('eps_arena_profCode') || 'DEFAULT';
    return `etablissements/0680013V/profs/${profCode}/${classe}/tournoi/atp`;
}

function getBareme() {
    if (_config.bareme && Array.isArray(_config.bareme) && _config.bareme.length > 0) return _config.bareme;
    return BAREME_DEFAUT;
}

// Calcule la base (sans ajustements) et le classement final (avec ajustements)
function calculerClassement() {
    const base = recalculerTout(_codes, _matchs, getBareme());
    appliquerAjustements(base, _ajustements);
    return { base, classement: trierClassement(base, _elevesMap) };
}

export function renderLive() {
    const container = document.getElementById('live-content');
    if (!container) return;

    _classe = getCurrentClasse() || document.getElementById('selectClasse')?.value;
    if (!_classe) {
        container.innerHTML = '<p class="text-slate-500 text-center">Sélectionnez une classe.</p>';
        return;
    }

    if (unsub) { try { unsub(); } catch (e) {} unsub = null; }

    const eleves = JSON.parse(localStorage.getItem(`eps_arena_eleves_${_classe}`) || '[]');
    _elevesMap = {};
    eleves.forEach(e => { if (e.codeAutoEval !== undefined && e.codeAutoEval !== null) _elevesMap[String(e.codeAutoEval)] = e; });
    _codes = eleves.map(e => String(e.codeAutoEval)).filter(Boolean);
    _matchs = {};
    _config = {};
    _ajustements = {};

    const base = getATPBasePath(_classe);
    const u1 = onValue(ref(db, `${base}/matchs`), snap => { _matchs = snap.val() || {}; render(); });
    const u2 = onValue(ref(db, `${base}/config`), snap => { _config = snap.val() || {}; render(); });
    const u3 = onValue(ref(db, `${base}/ajustements`), snap => { _ajustements = snap.val() || {}; render(); });
    unsub = () => { u1(); u2(); u3(); };
}

async function render() {
    const container = document.getElementById('live-content');
    if (!container) return;

    const { classement } = calculerClassement();

    let html = `
        <div class="flex justify-between items-center mb-3">
            <h3 class="font-black text-blue-400 uppercase text-sm">🏆 Classement ATP en direct</h3>
            <span class="text-[10px] text-slate-500">✏️ Clique sur les points pour ajuster manuellement</span>
        </div>
        <div class="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
    `;

    for (const item of classement) {
        const eleve = item.eleve;
        let photo = null;
        if (eleve) { try { photo = await getPhotoUrl(eleve.id); } catch (e) { photo = null; } }
        const photoHtml = photo
            ? `<img src="${photo}" class="w-10 h-10 rounded-full object-cover border-2 border-slate-600">`
            : `<div class="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-lg">👤</div>`;

        const couleur = item.rang === 1 ? 'border-yellow-500 bg-yellow-500/5' :
                        item.rang === 2 ? 'border-slate-400' :
                        item.rang === 3 ? 'border-amber-600' : 'border-slate-700';

        html += `
            <div class="flex items-center gap-3 bg-slate-800 p-2 rounded-xl border-2 ${couleur}">
                <div class="text-2xl min-w-[42px] text-center font-black text-slate-300">${getMedaille(item.rang)}</div>
                ${photoHtml}
                <div class="flex-1 min-w-0">
                    <div class="font-bold text-white text-sm truncate">${eleve ? eleve.prenom + ' ' + eleve.nom : 'Code ' + item.code}</div>
                    <div class="text-[10px] text-slate-500">#${item.code} · ${item.victoires}V-${item.defaites}D · diff ${formatEcart(item.diffPoints)}</div>
                </div>
                <button onclick="window.atpEditPoints('${item.code}')" title="Modifier les points"
                        class="text-right group">
                    <div class="text-2xl font-black ${item.points >= 100 ? 'text-emerald-400' : 'text-red-400'}">${item.points}</div>
                    <div class="text-[9px] text-slate-500 uppercase group-hover:text-blue-400">pts ✏️</div>
                </button>
            </div>
        `;
    }

    html += `</div>`;
    container.innerHTML = html;
}

// ============================================================
// AJUSTEMENT MANUEL DES POINTS (bonus/malus persistant)
// ============================================================
window.atpEditPoints = function(code) {
    if (!_classe) return alert('Sélectionnez une classe.');
    const { base } = calculerClassement();
    const basePoints = base[String(code)]?.points ?? 100;
    const ajustement = Number(_ajustements[String(code)]) || 0;
    const affiche = basePoints + ajustement;

    const saisie = prompt(`Nouveau total de points pour #${code} (actuel : ${affiche})`, affiche);
    if (saisie === null) return;
    const desire = parseInt(saisie, 10);
    if (isNaN(desire)) return alert('Valeur invalide.');

    const delta = desire - basePoints;
    const basePath = getATPBasePath(_classe);
    set(ref(db, `${basePath}/ajustements/${String(code)}`), delta)
        .catch(err => alert('❌ Erreur : ' + err.message));
};

// ============================================================
// EXPORT CSV DU CLASSEMENT LIVE
// ============================================================
window.exportTournoiLiveCSV = function() {
    if (!_classe) return alert('Sélectionnez une classe.');
    const { classement } = calculerClassement();

    let csv = '\uFEFF"Rang";"Code";"Nom de famille";"Prénom";"Points";"Victoires";"Défaites";"Diff"\n';
    classement.forEach(it => {
        csv += `"${it.rang}";"${it.code}";"${it.eleve?.nom || ''}";"${it.eleve?.prenom || ''}";"${it.points}";"${it.victoires}";"${it.defaites}";"${it.diffPoints}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ATP_Live_${_classe}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};