// src/js/carnet/calendrier.js
// Calendrier hebdomadaire (vue visuelle de la semaine, avec dates réelles).
// Filtres par classe et par période. Clic sur une séance → ouvre l'appel (classe + date).

import { lireCreneaux, lireCycles, lirePeriodes, getCouleurActivite } from './planner.js';

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];

let filtreClasse = '';   // '' = toutes les classes
let filtrePeriode = '';  // '' = toutes les périodes
let lundiSemaine = getLundi(new Date());

const KEY_VACANCES = 'eps_arena_vacances';
const KEY_VACANCES_ZONE = 'eps_arena_vacances_zone';
const ZONES = { A: 'Zone A', B: 'Zone B', C: 'Zone C' };
const API_VACANCES = 'https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records';

function formaterDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const j = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${j}`;
}

// Lundi de la semaine contenant `d`.
function getLundi(d) {
    const res = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const decalage = (res.getDay() + 6) % 7; // 0 = lundi … 6 = dimanche
    res.setDate(res.getDate() - decalage);
    return res;
}

function periodePourDate(dateISO, periodes) {
    return periodes.find(p => p.debut && p.fin && dateISO >= p.debut && dateISO <= p.fin) || null;
}

function formatCourt(dateISO) {
    if (!dateISO) return '';
    return new Date(dateISO + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function lireVacances() { return JSON.parse(localStorage.getItem(KEY_VACANCES) || '[]'); }
function ecrireVacances(v) { localStorage.setItem(KEY_VACANCES, JSON.stringify(v)); }
function lireZone() { return localStorage.getItem(KEY_VACANCES_ZONE) || ''; }
function ecrireZone(z) { localStorage.setItem(KEY_VACANCES_ZONE, z); }

// Date UTC de l'API → date locale de Paris (ex : "2017-10-20T22:00:00+00:00" → "2017-10-21").
function apiDateVersParis(utcISO) {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(utcISO));
    const val = t => parts.find(p => p.type === t)?.value || '';
    return `${val('year')}-${val('month')}-${val('day')}`;
}

function vacancesPourDate(dateISO) {
    return lireVacances().find(v => dateISO >= v.debut && dateISO <= v.fin) || null;
}

function icsVersISO(val) {
    const m = String(val).match(/^(\d{4})(\d{2})(\d{2})/);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

// Parse un .ics (fallback fichier / collage). DTEND est exclusif ; DTSTART == DTEND = jour unique.
function parserICS(texte) {
    const lignes = texte.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
    const evenements = [];
    let courant = null;
    for (const ligne of lignes) {
        if (ligne.startsWith('BEGIN:VEVENT')) { courant = {}; continue; }
        if (ligne.startsWith('END:VEVENT')) { if (courant) evenements.push(courant); courant = null; continue; }
        if (!courant) continue;
        const idx = ligne.indexOf(':');
        if (idx < 0) continue;
        const cle = ligne.slice(0, idx).split(';')[0];
        if (cle === 'DTSTART' || cle === 'DTEND' || cle === 'SUMMARY') courant[cle] = ligne.slice(idx + 1);
    }
    const plages = [];
    const vus = new Set();
    for (const e of evenements) {
        const nom = (e.SUMMARY || 'Vacances').replace(/\\,/g, ',').replace(/\\\\/g, '\\');
        if (/prérentrée|pre-rentrée|début des/i.test(nom)) continue;
        const debut = icsVersISO(e.DTSTART);
        const finExclusive = icsVersISO(e.DTEND);
        if (!debut || !finExclusive) continue;
        let fin = debut;
        if (finExclusive !== debut) {
            const d = new Date(finExclusive + 'T12:00:00');
            d.setDate(d.getDate() - 1);
            fin = formaterDate(d);
        }
        const cle = `${nom}|${debut}|${fin}`;
        if (vus.has(cle)) continue;
        vus.add(cle);
        plages.push({ debut, fin, nom });
    }
    return plages;
}

export function initCalendrierInterface() {
    render();
}

function render() {
    const container = document.getElementById('viewCalendrier');
    if (!container) return;

    const creneaux = lireCreneaux();
    const cycles = lireCycles();
    const periodes = lirePeriodes();
    const classes = Object.keys(creneaux).sort();

    if (classes.length === 0) {
        container.innerHTML = `
            <div class="bg-slate-800 p-10 rounded-2xl border border-slate-700 text-center text-slate-400">
                <p class="text-2xl mb-2">📅</p>
                <p class="font-bold">Aucun emploi du temps importé.</p>
                <p class="text-xs mt-1">Importe ton planner iDoceo dans « Emploi du temps » pour voir le calendrier.</p>
            </div>`;
        return;
    }

    if (filtreClasse && !classes.includes(filtreClasse)) filtreClasse = '';
    const classesAffichees = filtreClasse ? [filtreClasse] : classes;

    const horaires = [...new Set(
        classesAffichees.flatMap(c => (creneaux[c] || []).map(x => x.horaire))
    )].filter(Boolean).sort();

    const jours = JOURS.map((nom, i) => {
        const d = new Date(lundiSemaine);
        d.setDate(lundiSemaine.getDate() + i);
        return { nom, date: formaterDate(d) };
    });

    const aujourdhui = formaterDate(new Date());

    const vacancesParJour = {};
    jours.forEach(j => { const v = vacancesPourDate(j.date); if (v) vacancesParJour[j.date] = v.nom; });
    const zoneActuelle = lireZone();
    const vacances = lireVacances();

    const celluleHTML = (h, j) => {
        if (vacancesParJour[j.date]) {
            return `<div class="rounded-lg bg-slate-900/40 border border-amber-500/20 px-2 py-3 text-[10px] font-bold text-amber-400/90">🏖️ ${vacancesParJour[j.date]}</div>`;
        }
        return grille[h][j.nom].cellules.map(item => `
            <button onclick="window.calendrierOuvrirAppel('${item.classe}', '${j.date}')" class="w-full mb-1.5 rounded-lg px-2 py-1.5 text-left border border-slate-700/60" style="background-color:${item.activite ? getCouleurActivite(item.activite) : '#1e293b'};">
                <div class="text-[11px] font-black text-white">${item.classe}</div>
                ${item.activite ? `<div class="text-[10px] font-bold text-white/90 truncate">${item.activite}</div>` : '<div class="text-[10px] text-slate-400">—</div>'}
            </button>
        `).join('');
    };

    const grille = {};
    horaires.forEach(h => {
        grille[h] = {};
        JOURS.forEach(j => { grille[h][j] = { cellules: [] }; });
    });

    classesAffichees.forEach(classe => {
        (creneaux[classe] || []).forEach(c => {
            if (!JOURS.includes(c.jour) || !grille[c.horaire]) return;
            const jourInfo = jours.find(j => j.nom === c.jour);
            if (!jourInfo) return;
            const key = `${c.jour} ${c.horaire}`.trim();

            let activite = '';
            if (filtrePeriode) {
                const pFiltre = periodes.find(p => p.id === filtrePeriode);
                if (pFiltre && jourInfo.date >= pFiltre.debut && jourInfo.date <= pFiltre.fin) {
                    activite = cycles[classe]?.[key]?.[filtrePeriode] || '';
                }
            } else {
                const pDate = periodePourDate(jourInfo.date, periodes);
                activite = pDate ? (cycles[classe]?.[key]?.[pDate.id] || '') : '';
            }

            grille[c.horaire][c.jour].cellules.push({ classe, activite });
        });
    });

    container.innerHTML = `
        <div class="space-y-4">
            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <div class="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h3 class="font-black text-blue-400 uppercase text-sm">📅 Calendrier hebdomadaire</h3>
                        <p class="text-xs text-slate-400 mt-1">Clique sur une séance pour faire l'appel de la classe à cette date.</p>
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                        <button onclick="window.calendrierSemainePrecedente()" class="bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-xl font-black text-white text-sm">◀</button>
                        <button onclick="window.calendrierAujourdhui()" class="bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-xl font-black text-xs uppercase text-white">Aujourd'hui</button>
                        <button onclick="window.calendrierSemaineSuivante()" class="bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-xl font-black text-white text-sm">▶</button>
                        <span class="text-xs font-bold text-white ml-1">${formatCourt(jours[0].date)} → ${formatCourt(jours[4].date)}</span>
                    </div>
                </div>
                <div class="flex flex-wrap gap-2 mt-4">
                    <select onchange="window.calendrierFiltreClasse(this.value)" class="bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-xs font-bold text-white">
                        <option value="">Toutes les classes</option>
                        ${classes.map(c => `<option value="${c}" ${c === filtreClasse ? 'selected' : ''}>Classe ${c}</option>`).join('')}
                    </select>
                    <select onchange="window.calendrierFiltrePeriode(this.value)" class="bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-xs font-bold text-white">
                        <option value="">Toutes les périodes</option>
                        ${periodes.map(p => `<option value="${p.id}" ${p.id === filtrePeriode ? 'selected' : ''}>${p.nom} (${formatCourt(p.debut)} → ${formatCourt(p.fin)})</option>`).join('')}
                    </select>
                </div>
                <div class="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-700">
                    <span class="text-xs font-bold text-slate-400 uppercase">🏖️ Vacances :</span>
                    ${Object.keys(ZONES).map(z => `
                        <button onclick="window.calendrierChoisirZone('${z}')" class="px-3 py-1.5 rounded-xl text-xs font-black ${zoneActuelle === z ? 'bg-amber-500 text-slate-900' : 'bg-slate-700 hover:bg-slate-600 text-white'}">Zone ${z}</button>
                    `).join('')}
                    <button onclick="window.calendrierImporterVacances()" class="px-3 py-1.5 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-500 text-white">📥 Importer</button>
                    ${vacances.length ? `<button onclick="window.calendrierEffacerVacances()" class="px-3 py-1.5 rounded-xl text-xs font-black bg-red-700 hover:bg-red-600 text-white">🗑️ Effacer</button>` : ''}
                    ${vacances.length ? `<span class="text-xs font-bold text-amber-400">Zone ${zoneActuelle || '—'} · ${vacances.length} plage(s)</span>` : '<span class="text-xs text-slate-500">Aucune vacance chargée.</span>'}
                </div>
                <div id="calendrier-vacances-fallback" class="hidden mt-3 p-3 bg-slate-900/60 rounded-xl border border-slate-700 text-xs text-slate-400">
                    <p class="mb-2 font-bold text-slate-300">Import web impossible (CORS ou réseau). Deux solutions :</p>
                    <p class="mb-1">1. Télécharge le fichier .ics puis importe-le : <button onclick="window.calendrierChoisirFichier()" class="underline text-blue-300 font-bold">📂 Choisir un fichier</button></p>
                    <p class="mb-2">2. Ou colle le contenu du .ics ci-dessous puis clique « Charger ».</p>
                    <textarea id="calendrier-vacances-texte" rows="4" class="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 font-mono text-[10px] text-white" placeholder="BEGIN:VCALENDAR …"></textarea>
                    <button onclick="window.calendrierImporterVacancesTexte()" class="mt-2 px-3 py-1.5 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-500 text-white">Charger</button>
                </div>
            </div>

            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700 overflow-x-auto">
                <table class="w-full text-sm border-collapse">
                    <thead>
                        <tr class="text-xs text-slate-400 uppercase border-b border-slate-700">
                            <th class="p-2 text-left whitespace-nowrap">Créneau</th>
                            ${jours.map(j => `
                                <th class="p-2 text-center capitalize ${j.date === aujourdhui ? 'text-blue-300' : ''}">
                                    <div>${j.nom}</div>
                                    <div class="text-[10px] font-bold ${j.date === aujourdhui ? 'text-blue-300' : 'text-slate-500'}">${formatCourt(j.date)}</div>
                                    ${vacancesParJour[j.date] ? `<div class="text-[10px] font-bold text-amber-400 mt-0.5">🏖️ ${vacancesParJour[j.date]}</div>` : ''}
                                </th>
                            `).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${horaires.map(h => `
                            <tr class="border-b border-slate-800 align-top">
                                <td class="p-2 font-bold text-white whitespace-nowrap text-xs">${h}</td>
                                ${jours.map(j => `
                                    <td class="p-1.5 text-center align-top min-w-[140px] ${j.date === aujourdhui ? 'bg-blue-500/5' : ''}">
                                        ${celluleHTML(h, j)}
                                    </td>
                                `).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

window.calendrierFiltreClasse = function(classe) {
    filtreClasse = classe;
    render();
};

window.calendrierFiltrePeriode = function(periodeId) {
    filtrePeriode = periodeId;
    render();
};

window.calendrierSemainePrecedente = function() {
    lundiSemaine.setDate(lundiSemaine.getDate() - 7);
    render();
};

window.calendrierSemaineSuivante = function() {
    lundiSemaine.setDate(lundiSemaine.getDate() + 7);
    render();
};

window.calendrierAujourdhui = function() {
    lundiSemaine = getLundi(new Date());
    render();
};

window.calendrierOuvrirAppel = function(classe, dateISO) {
    const select = document.getElementById('selectClasse');
    if (select) {
        select.value = classe;
        select.dispatchEvent(new Event('change'));
    }
    if (dateISO) localStorage.setItem('eps_arena_appel_date_demandee', dateISO);
    if (typeof window.switchTab === 'function') window.switchTab('presences');
};

window.calendrierChoisirZone = function(zone) {
    ecrireZone(zone);
    render();
};

window.calendrierImporterVacances = async function() {
    const zone = lireZone();
    if (!zone) { alert("Choisis d'abord une zone (A, B ou C)."); return; }
    try {
        const toutes = [];
        for (let offset = 0; offset < 2000; offset += 100) {
            const refine = encodeURIComponent(`zones:"${ZONES[zone]}"`);
            const url = `${API_VACANCES}?refine=${refine}&limit=100&offset=${offset}`;
            const rep = await fetch(url);
            if (!rep.ok) throw new Error('HTTP ' + rep.status);
            const json = await rep.json();
            const results = json.results || [];
            toutes.push(...results);
            if (results.length < 100) break;
        }
        const vus = new Set();
        const plages = [];
        toutes.forEach(r => {
            if (r.population === 'Enseignants') return; // prérentrée = jour travaillé pour le prof
            if (!r.description || !r.start_date || !r.end_date) return;
            const debut = apiDateVersParis(r.start_date);
            const finExclusive = apiDateVersParis(r.end_date);
            if (!debut || !finExclusive) return;
            let fin = debut;
            if (finExclusive > debut) {
                const d = new Date(finExclusive + 'T12:00:00');
                d.setDate(d.getDate() - 1);
                fin = formaterDate(d);
            }
            const cle = `${r.description}|${debut}|${fin}`;
            if (vus.has(cle)) return;
            vus.add(cle);
            plages.push({ debut, fin, nom: r.description });
        });
        plages.sort((a, b) => a.debut.localeCompare(b.debut));
        ecrireVacances(plages);
        render();
        alert(`✅ ${plages.length} plage(s) de vacances importée(s) (Zone ${zone}).`);
    } catch (err) {
        console.error('Import vacances :', err);
        document.getElementById('calendrier-vacances-fallback')?.classList.remove('hidden');
        alert('Import web impossible (CORS ou réseau). Importe le fichier .ics ou colle son contenu ci-dessous.');
    }
};

window.calendrierEffacerVacances = function() {
    ecrireVacances([]);
    render();
};

window.calendrierChoisirFichier = function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.ics,text/calendar';
    input.onchange = async () => {
        if (!input.files[0]) return;
        const texte = await input.files[0].text();
        const plages = parserICS(texte);
        if (plages.length === 0) { alert('Aucune vacance trouvée dans ce fichier.'); return; }
        ecrireVacances(plages);
        document.getElementById('calendrier-vacances-fallback')?.classList.add('hidden');
        render();
        alert(`✅ ${plages.length} plage(s) importée(s) depuis le fichier.`);
    };
    input.click();
};

window.calendrierImporterVacancesTexte = function() {
    const ta = document.getElementById('calendrier-vacances-texte');
    const texte = ta ? ta.value : '';
    if (!texte.trim()) { alert("Colle d'abord le contenu du .ics."); return; }
    const plages = parserICS(texte);
    if (plages.length === 0) { alert('Aucune vacance trouvée dans le texte collé.'); return; }
    ecrireVacances(plages);
    document.getElementById('calendrier-vacances-fallback')?.classList.add('hidden');
    render();
    alert(`✅ ${plages.length} plage(s) importée(s).`);
};

