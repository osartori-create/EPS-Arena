// src/js/services/merge-eleves.js
// Fusion de doublons d'élèves (accents, doublons d'import…).
// Migre toutes les références (photo, évaluations, UNSS, groupes, plan, appel) de l'élève
// « doublon » vers l'élève « conservé », puis supprime le doublon. Aucune donnée perdue.

import { getExistingEleves, saveEleves, getPhotoUrl, transfererPhoto } from './admin-service.js';

const KEY_CLASSES = 'eps_arena_classes';

function lireClasses() { return JSON.parse(localStorage.getItem(KEY_CLASSES) || '[]'); }
function norm(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }

// Remplace récursivement l'id source par l'id cible (clés d'objets + valeurs exactes).
function remplacer(val, source, cible) {
    if (Array.isArray(val)) return val.map(v => remplacer(v, source, cible));
    if (val && typeof val === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(val)) {
            if (k === source && (cible in val)) continue; // conflit : le conservé gagne
            out[k === source ? cible : k] = remplacer(v, source, cible);
        }
        return out;
    }
    return val === source ? cible : val;
}

// Migre toutes les références du doublon vers le conservé dans le localStorage.
function migrerReferences(source, cible) {
    Object.keys(localStorage).forEach(k => {
        if (!k.startsWith('eps_arena_')) return;
        if (k.startsWith('eps_arena_eleves_')) return; // listes élèves : gérées explicitement
        const raw = localStorage.getItem(k);
        let val;
        try { val = JSON.parse(raw); } catch (e) {
            if (raw === source) localStorage.setItem(k, cible);
            return;
        }
        const nv = remplacer(val, source, cible);
        if (JSON.stringify(nv) !== JSON.stringify(val)) localStorage.setItem(k, JSON.stringify(nv));
    });
}

const CHAMPS_PEDA = ['vma', 'palier', 'longueur', 'sprint30', 'force', 'indiceNage', 'vitesseDemiFond'];
const estVide = (v) => v === undefined || v === null || v === '' || v === 0;

// Fusionne un doublon dans le conservé. Retourne true si succès.
export async function fusionnerEleves(classe, idConserve, idSupprime) {
    const eleves = getExistingEleves(classe);
    const c = eleves.find(e => e.id === idConserve);
    const s = eleves.find(e => e.id === idSupprime);
    if (!c || !s) return false;

    // identité : compléter les vides
    if (!c.ine && s.ine) c.ine = s.ine;
    if (!c.sexe && s.sexe) c.sexe = s.sexe;
    if (!c.dateNaissance && s.dateNaissance) c.dateNaissance = s.dateNaissance;
    if (!c.regime && s.regime) c.regime = s.regime;
    // données péda : compléter les valeurs vides
    CHAMPS_PEDA.forEach(f => { if (estVide(c[f]) && !estVide(s[f])) c[f] = s[f]; });
    if ((c.codeAutoEval === undefined || c.codeAutoEval === null) && s.codeAutoEval !== undefined && s.codeAutoEval !== null) c.codeAutoEval = s.codeAutoEval;

    // suppression du doublon de la liste
    saveEleves(classe, eleves.filter(e => e.id !== idSupprime));
    // migration des références (localStorage)
    migrerReferences(idSupprime, idConserve);
    // photo (IndexedDB) : si le conservé n'en a pas, copier celle du doublon
    await transfererPhoto(idConserve, idSupprime);
    return true;
}

function tagsEleve(e) {
    const tags = [];
    if (e.ine) tags.push('INE');
    if (e._photo) tags.push('📷');
    if (e.indiceNage) tags.push('🏊 ' + e.indiceNage);
    if (e.vma) tags.push('VMA ' + e.vma);
    if (e.codeAutoEval !== undefined && e.codeAutoEval !== null) tags.push('#' + e.codeAutoEval);
    return tags.length ? tags.join(' · ') : '— vide —';
}

function scoreEleve(e) {
    let s = 0;
    if (e._photo) s += 3;
    if (e.indiceNage) s += 3;
    if (e.vma) s += 2;
    if (e.ine) s += 2;
    if (e.codeAutoEval !== undefined && e.codeAutoEval !== null) s += 1;
    if (e.palier) s += 1;
    return s;
}

let _groupes = [];

async function detecterDoublons() {
    const groupes = [];
    for (const classe of lireClasses()) {
        const eleves = getExistingEleves(classe);
        const parCle = {};
        eleves.forEach(e => {
            const c = norm(e.nom) + '|' + norm(e.prenom);
            (parCle[c] = parCle[c] || []).push(e);
        });
        Object.values(parCle).forEach(liste => {
            if (liste.length >= 2) groupes.push({ classe, eleves: liste });
        });
    }
    for (const g of groupes) for (const e of g.eleves) e._photo = !!(await getPhotoUrl(e.id));
    return groupes;
}

export async function openMergeModal() {
    _groupes = await detecterDoublons();
    if (!_groupes.length) { alert('Aucun doublon détecté. 👍'); return; }
    document.getElementById('merge-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'merge-modal';
    modal.className = 'fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
        <div class="bg-slate-900 p-6 rounded-3xl border-2 border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-center mb-4">
                <div>
                    <h3 class="text-xl font-black text-orange-400 uppercase">🔗 Fusionner les doublons</h3>
                    <p class="text-[10px] text-slate-400">${_groupes.length} groupe(s) détecté(s). Pour chaque groupe, choisis l'élève à conserver (le mieux noté est présélectionné).</p>
                </div>
                <button onclick="document.getElementById('merge-modal').remove()" class="bg-slate-700 px-4 py-2 rounded-xl font-black text-xs text-white">✖ Fermer</button>
            </div>
            <div id="merge-liste"></div>
        </div>
    `;
    document.body.appendChild(modal);
    rendererGroupes();
}

function rendererGroupes() {
    const cont = document.getElementById('merge-liste');
    if (!cont) return;
    if (!_groupes.length) {
        cont.innerHTML = '<p class="text-center text-emerald-400 font-bold py-6">✅ Tous les doublons ont été fusionnés.</p>';
        return;
    }
    cont.innerHTML = _groupes.map((g, gi) => {
        const eleves = g.eleves.slice().sort((a, b) => scoreEleve(b) - scoreEleve(a));
        const meilleur = eleves[0].id;
        return `
        <div class="bg-slate-800 p-3 rounded-2xl border border-slate-700 mb-3">
            <p class="text-xs font-bold text-slate-400 mb-2">Classe ${g.classe} — ${g.eleves.length} fiches identiques (nom + prénom)</p>
            <div class="space-y-1">
                ${eleves.map(e => `
                    <label class="flex items-center gap-2 text-xs p-1.5 rounded hover:bg-slate-700 cursor-pointer">
                        <input type="radio" name="merge-surv-${gi}" value="${e.id}" ${e.id === meilleur ? 'checked' : ''}>
                        <span class="text-white font-bold">${e.prenom} ${e.nom}</span>
                        <span class="text-slate-500">${tagsEleve(e)}</span>
                    </label>`).join('')}
            </div>
            <button onclick="window.mergeFusionner(${gi})" class="mt-2 bg-orange-600 hover:bg-orange-500 px-3 py-1.5 rounded-lg font-black text-xs text-white">Fusionner vers l'élève sélectionné →</button>
        </div>`;
    }).join('');
}

window.mergeFusionner = async function(gi) {
    const g = _groupes[gi];
    if (!g) return;
    const surv = document.querySelector(`input[name="merge-surv-${gi}"]:checked`)?.value;
    if (!surv) return;
    const survEleve = g.eleves.find(e => e.id === surv);
    const doublons = g.eleves.filter(e => e.id !== surv);
    let ok = 0;
    for (const d of doublons) {
        if (await fusionnerEleves(g.classe, surv, d.id)) ok++;
    }
    _groupes.splice(gi, 1);
    rendererGroupes();
    alert(`✅ ${ok} doublon(s) fusionné(s) vers ${survEleve ? survEleve.prenom + ' ' + survEleve.nom : "l'élève conservé"}.\n\nPhotos, notes, indices de nage, évaluations, UNSS, groupes, plan et appel ont été réunis.`);
};

window.fusionnerDoublons = () => openMergeModal();

