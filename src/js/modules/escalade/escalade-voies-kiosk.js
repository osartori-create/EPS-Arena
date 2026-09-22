// src/js/modules/escalade/escalade-voies-kiosk.js
// Kiosk élève du module « Suivi des réalisations » (voies / secteurs).
// L'élève saisit son numéro personnel (codeAutoEval), indique la voie réalisée
// et reçoit un retour motivant. 100 % anonyme côté Firebase (code uniquement).

import { listenSuiviConfig, listenMontees, addMontee, filtrerMonteesParCode } from './escalade-voies-firebase.js';
import { calculerStatsEleve, nouveauxBadges } from './escalade-voies-core.js';
import {
    COULEUR_HEX,
    COULEUR_LABELS,
    MAITRISES,
    RESSENTIS,
    HAUTEUR_MUR,
    HAUTEUR_ECHEC_MIN,
    BADGES
} from './escalade-voies-config.js';

let currentClasse = '';
let currentCode = '';
let config = { secteurs: {}, voies: {} };
let montees = {};
let configListener = null;
let monteesListener = null;

// État temporaire de la saisie en cours.
let saisie = {
    secteur: null,
    voie: null
};

// ============================================================
// INITIALISATION
// ============================================================
export function initSuiviKiosk(classe) {
    currentClasse = classe;

    // Écoute la config (secteurs + voies).
    if (configListener) configListener();
    configListener = listenSuiviConfig(classe, (data) => {
        config = data;
        // La carte des voies par id.
        if (!config.voies) config.voies = {};
        // Une fois la config chargée, on affiche l'écran de saisie du numéro.
        afficherSaisieNumero();
    });
}

export function cleanupSuiviKiosk() {
    if (configListener) { configListener(); configListener = null; }
    if (monteesListener) { monteesListener(); monteesListener = null; }
}

// ============================================================
// HELPERS DOM
// ============================================================
function getContainer() {
    // Utilise le conteneur dédié déclaré dans eleve.html (suivi-module),
    // afin que resetToLogin() le masque correctement.
    let el = document.getElementById('suivi-module');
    if (!el) {
        el = document.createElement('div');
        el.id = 'suivi-kiosk-container';
        el.className = 'space-y-4';
        const screen = document.getElementById('activity-screen');
        if (screen) screen.appendChild(el);
    }
    return el;
}

function viderContainer() {
    const el = getContainer();
    el.innerHTML = '';
    return el;
}

// Listener des montées de l'élève courant.
function ecouterMesMontees() {
    if (monteesListener) { monteesListener(); monteesListener = null; }
    monteesListener = listenMontees(currentClasse, (data) => {
        montees = data;
    });
}

function mesMontees() {
    return filtrerMonteesParCode(montees, currentCode);
}

// Revient à la saisie du numéro élève (coupe l'écoute des montées).
window.suiviEleveSuivant = function() {
    if (monteesListener) { monteesListener(); monteesListener = null; }
    montees = {};
    afficherSaisieNumero();
};

// ============================================================
// ÉCRAN 1 — SAISIE DU NUMÉRO PERSONNEL
// ============================================================
function afficherSaisieNumero() {
    currentCode = '';
    saisie.secteur = null;
    saisie.voie = null;
    const container = viderContainer();

    container.innerHTML = `
        <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700 text-center">
            <div class="text-4xl mb-2">🧗</div>
            <h2 class="text-xl font-black text-white mb-1">Suivi des voies</h2>
            <p class="text-sm text-slate-400 mb-4">Entre ton numéro personnel</p>
            <div id="suivi-numero-display" class="bg-slate-950 border-2 border-slate-700 rounded-2xl h-16 flex items-center justify-center text-4xl font-black tracking-[0.4em] text-emerald-400 mb-4"></div>
            <div id="suivi-keypad" class="grid grid-cols-3 gap-3 max-w-xs mx-auto"></div>
        </div>
    `;

    let numero = '';
    const display = document.getElementById('suivi-numero-display');

    const buildKeypad = () => {
        const keypad = document.getElementById('suivi-keypad');
        keypad.innerHTML = '';
        for (let i = 1; i <= 9; i++) {
            const btn = document.createElement('button');
            btn.className = 'bg-slate-700 hover:bg-slate-600 h-16 rounded-xl text-2xl font-black text-white active:scale-95 transition-transform';
            btn.textContent = i;
            btn.onclick = () => {
                if (numero.length < 4) {
                    numero += i;
                    display.textContent = numero;
                }
            };
            keypad.appendChild(btn);
        }
        const effacer = document.createElement('button');
        effacer.className = 'bg-red-950 text-red-400 h-16 rounded-xl text-xs font-black uppercase border border-red-800 active:bg-red-800';
        effacer.textContent = 'Effacer';
        effacer.onclick = () => {
            numero = '';
            display.textContent = '';
        };
        keypad.appendChild(effacer);

        const zero = document.createElement('button');
        zero.className = 'bg-slate-700 hover:bg-slate-600 h-16 rounded-xl text-2xl font-black text-white active:scale-95';
        zero.textContent = '0';
        zero.onclick = () => {
            if (numero.length < 4) {
                numero += '0';
                display.textContent = numero;
            }
        };
        keypad.appendChild(zero);

        const ok = document.createElement('button');
        ok.className = 'bg-emerald-600 text-white h-16 rounded-xl text-xs font-black uppercase active:bg-emerald-700';
        ok.textContent = 'OK';
        ok.onclick = () => {
            if (!numero) return;
            currentCode = numero;
            ecouterMesMontees();
            afficherChoixMode();
        };
        keypad.appendChild(ok);
    };
    buildKeypad();
}

// ============================================================
// ÉCRAN 1bis — CHOIX VOIES / BLOCS
// ============================================================
function afficherChoixMode() {
    const container = viderContainer();

    container.innerHTML = `
        <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
            <div class="flex items-center justify-between gap-3 mb-4">
                <div>
                    <p class="text-xs text-slate-400">Numéro</p>
                    <p class="text-2xl font-black text-white">${currentCode}</p>
                </div>
                <button onclick="window.suiviVoirProgression()" class="bg-slate-700 px-4 py-2 rounded-xl font-black text-xs text-white active:scale-95">📊 Ma progression</button>
            </div>
            <h2 class="text-xl font-black text-white text-center mb-4">Que veux-tu grimper ?</h2>
            <div class="grid grid-cols-2 gap-4">
                <button onclick="window.suiviChoisirMode('voies')" class="bg-blue-600 py-8 rounded-2xl font-black text-white text-lg active:scale-95 transition-transform">🧗 Voies</button>
                <button onclick="window.suiviChoisirMode('blocs')" class="bg-orange-600 py-8 rounded-2xl font-black text-white text-lg active:scale-95 transition-transform">🧱 Blocs</button>
            </div>
            <div class="mt-4">
                <p class="text-xs text-slate-500 text-center">Tu pourras passer de l'un à l'autre à tout moment.</p>
            </div>
        </div>
    `;
}

window.suiviChoisirMode = function(mode) {
    if (mode === 'blocs') afficherChoixBloc();
    else afficherChoixSecteur();
};

// ============================================================
// ÉCRAN 2bis — CHOIX D'UN BLOC (grille simple)
// ============================================================
function afficherChoixBloc() {
    const container = viderContainer();
    const blocs = config.blocs || {};
    const idsBlocs = Object.keys(blocs).sort((a, b) => parseInt(a) - parseInt(b));

    const grille = idsBlocs.length > 0
        ? idsBlocs.map(id => {
            const dejaFait = mesMontees().some(m => m.secteur === id && m.type === 'bloc');
            return `<button onclick="window.suiviChoisirBloc('${id}')" class="h-14 rounded-xl ${dejaFait ? 'bg-emerald-600' : 'bg-orange-600'} text-white font-black text-lg active:scale-95 transition-transform">${id}</button>`;
        }).join('')
        : '<p class="text-slate-400 text-center py-6 col-span-7">⚠️ Aucun bloc configuré. Demande à ton professeur.</p>';

    container.innerHTML = `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
            <div class="flex items-center justify-between gap-3 mb-3">
                <div>
                    <p class="text-xs text-slate-400">Numéro</p>
                    <p class="text-2xl font-black text-white">${currentCode}</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="window.suiviVoirProgression()" class="bg-slate-700 px-4 py-2 rounded-xl font-black text-xs text-white active:scale-95">📊 Ma progression</button>
                    <button onclick="window.suiviChoisirMode('voies')" class="bg-blue-600 px-4 py-2 rounded-xl font-black text-xs text-white active:scale-95">↔ Voies</button>
                </div>
            </div>
            <p class="text-sm text-slate-400 mb-3 text-center">Choisis ton bloc</p>
            <div class="grid grid-cols-7 gap-2">${grille}</div>
        </div>
    `;
}

window.suiviChoisirBloc = function(blocId) {
    afficherVoiesSecteur(blocId, 'bloc');
};

// ============================================================
// ÉCRAN 2 — CHOIX DU SECTEUR (photo + pastilles ou grille)
// ============================================================
function afficherChoixSecteur() {
    const container = viderContainer();
    const secteurs = config.secteurs || {};

    let pastillesHtml = '';
    Object.entries(secteurs).forEach(([id, s]) => {
        const x = (s.x !== undefined) ? s.x : 50;
        const y = (s.y !== undefined) ? s.y : 50;
        const valide = secteurDejaFait(id);
        const bg = valide ? 'bg-emerald-500' : 'bg-blue-600';
        pastillesHtml += `
            <button onclick="window.suiviChoisirSecteur('${id}')"
                class="absolute w-10 h-10 -translate-x-1/2 -translate-y-1/2 rounded-full ${bg} border-2 border-white text-white font-black text-sm shadow-lg active:scale-95 transition-transform"
                style="left:${x}%;top:${y}%;">${valide ? '✓' : id}</button>
        `;
    });

    const photoHtml = config.murImage
        ? `<div class="relative w-full overflow-hidden rounded-2xl border border-slate-600" style="background-image:url('${config.murImage}');background-size:contain;background-repeat:no-repeat;background-position:center;min-height:320px;">${pastillesHtml}</div>`
        : `<div class="relative w-full overflow-hidden rounded-2xl border border-slate-600 bg-slate-900 min-h-[320px] p-4">
            <div class="grid grid-cols-7 gap-2">${Object.keys(secteurs).map(id => {
                const valide = secteurDejaFait(id);
                return `<button onclick="window.suiviChoisirSecteur('${id}')" class="h-14 rounded-xl ${valide ? 'bg-emerald-600' : 'bg-blue-600'} text-white font-black text-lg active:scale-95 transition-transform">${id}</button>`;
            }).join('')}</div>
        </div>`;

    container.innerHTML = `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700">
            <div class="flex items-center justify-between gap-3 mb-3">
                <div>
                    <p class="text-xs text-slate-400">Numéro</p>
                    <p class="text-2xl font-black text-white">${currentCode}</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="window.suiviVoirProgression()" class="bg-slate-700 px-4 py-2 rounded-xl font-black text-xs text-white active:scale-95">📊 Ma progression</button>
                    <button onclick="window.suiviChoisirMode('blocs')" class="bg-orange-600 px-4 py-2 rounded-xl font-black text-xs text-white active:scale-95">↔ Blocs</button>
                </div>
            </div>
            <p class="text-sm text-slate-400 mb-3 text-center">Choisis ton secteur (n° au bas du mur)</p>
            ${photoHtml}
        </div>
    `;
}

function secteurDejaFait(secteurId) {
    return mesMontees().some(m => m.secteur === secteurId);
}

window.suiviChoisirSecteur = function(secteurId) {
    saisie.secteur = secteurId;
    afficherVoiesSecteur(secteurId, 'voie');
};

// ============================================================
// ÉCRAN 3 — VOIES DU SECTEUR (ou BLOCS d'un bloc)
// ============================================================
function afficherVoiesSecteur(secteurId, type = 'voie') {
    const container = viderContainer();
    const estBloc = (type === 'bloc');
    const elements = Object.values(config.voies || {}).filter(v => v.secteur === secteurId && v.type === type);
    const titre = estBloc ? `Bloc ${secteurId}` : `Secteur ${secteurId}`;
    const libelleElement = estBloc ? 'Bloc' : 'Voie';

    let elementsHtml;
    if (elements.length === 0) {
        elementsHtml = `<p class="text-slate-400 text-center py-6">⚠️ Aucun élément configuré pour ${estBloc ? 'ce bloc' : 'ce secteur'}.<br>Demande à ton professeur de l'ajouter.</p>`;
    } else {
        elementsHtml = elements.map(v => {
            const bg = COULEUR_HEX[v.couleur] || '#3b82f6';
            const dejaReussi = mesMontees().some(m => m.voieId === v.id && m.reussie);
            return `
                <button onclick="window.suiviChoisirVoie('${v.id}')"
                    class="w-full text-left bg-slate-700 p-4 rounded-2xl border-2 border-slate-600 active:scale-95 transition-transform">
                    <div class="flex items-center gap-3">
                        <span class="w-6 h-6 rounded-full border-2 border-white/50" style="background:${bg}"></span>
                        <div class="flex-1">
                            <span class="font-black text-white">${libelleElement} ${v.label || ''}</span>
                            <span class="text-xs text-slate-400 ml-2">${COULEUR_LABELS[v.couleur] || v.couleur}</span>
                        </div>
                        <span class="text-xl font-black text-yellow-400">${v.cotation || ''}</span>
                        ${dejaReussi ? '<span class="text-emerald-400">✓</span>' : ''}
                    </div>
                </button>
            `;
        }).join('');
    }

    container.innerHTML = `
        <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
            <div class="flex items-center gap-3 mb-4">
                <button onclick="window.suiviRetourElements('${secteurId}', '${type}')" class="bg-slate-700 px-3 py-2 rounded-xl font-black text-xs text-white active:scale-95">←</button>
                <h2 class="text-lg font-black text-white">${titre}</h2>
                <div class="ml-auto">
                    <button onclick="window.suiviBasculerMode('${type}')" class="px-3 py-2 rounded-xl font-black text-xs text-white active:scale-95 ${estBloc ? 'bg-blue-600' : 'bg-orange-600'}">${estBloc ? '↔ Voies' : '↔ Blocs'}</button>
                </div>
            </div>
            <div class="space-y-3">${elementsHtml}</div>
        </div>
    `;
}

window.suiviRetourElements = function(id, type) {
    if (type === 'bloc') afficherChoixBloc();
    else afficherChoixSecteur();
};

window.suiviBasculerMode = function(typeActuel) {
    if (typeActuel === 'bloc') afficherChoixSecteur();
    else afficherChoixBloc();
};

window.suiviChoisirVoie = function(voieId) {
    const voie = (config.voies || {})[voieId];
    if (!voie) return;
    saisie.voie = voie;
    afficherSaisieResultat();
};

window.suiviRetourSecteurs = function() {
    afficherChoixSecteur();
};

// ============================================================
// ÉCRAN 4 — RÉSULTAT DE LA VOIE
// ============================================================
function afficherSaisieResultat() {
    const container = viderContainer();
    const voie = saisie.voie;
    const bg = COULEUR_HEX[voie.couleur] || '#3b82f6';
    const estBloc = voie.type === 'bloc';
    const libelle = estBloc ? 'Bloc' : 'Voie';

    container.innerHTML = `
        <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
            <div class="flex items-center gap-3 mb-4">
                <button onclick="window.suiviRetourVoie()" class="bg-slate-700 px-3 py-2 rounded-xl font-black text-xs text-white active:scale-95">←</button>
                <div class="flex-1">
                    <h2 class="text-lg font-black text-white">${libelle} ${voie.label || ''}</h2>
                    <p class="text-xs text-slate-400">${COULEUR_LABELS[voie.couleur] || ''} · Cotation <span class="text-yellow-400 font-bold">${voie.cotation}</span></p>
                </div>
                <span class="w-8 h-8 rounded-full border-2 border-white/50" style="background:${bg}"></span>
            </div>

            <p class="text-sm font-bold text-slate-300 mb-2">As-tu réussi ?</p>
            <div class="grid grid-cols-2 gap-3 mb-4">
                <button onclick="window.suiviSetReussite(true)" class="bg-emerald-600 py-4 rounded-2xl font-black text-white text-lg active:scale-95">✅ Oui</button>
                <button onclick="window.suiviSetReussite(false)" class="bg-red-600 py-4 rounded-2xl font-black text-white text-lg active:scale-95">❌ Non</button>
            </div>

            <div id="suivi-details-Suite" class="hidden space-y-4">
                <div>
                    <p class="text-xs font-bold text-slate-400 uppercase mb-1">Niveau de maîtrise</p>
                    <div id="suivi-maitrise" class="grid grid-cols-2 gap-2"></div>
                </div>
                <div>
                    <p class="text-xs font-bold text-slate-400 uppercase mb-1">Ressenti</p>
                    <div id="suivi-ressenti" class="grid grid-cols-3 gap-2"></div>
                </div>
                <div id="suivi-hauteur-block">
                    <button onclick="window.suiviEnvoyer()" class="w-full bg-blue-600 py-5 rounded-3xl text-xl font-black uppercase active:scale-95">📤 Enregistrer</button>
                </div>
            </div>
        </div>
    `;

    const maitriseEl = document.getElementById('suivi-maitrise');
    MAITRISES.forEach(m => {
        const btn = document.createElement('button');
        btn.className = 'maitrise-btn bg-slate-700 p-3 rounded-xl font-black text-xs text-white border-2 border-slate-600';
        btn.textContent = m.label;
        btn.onclick = () => {
            maitriseEl.querySelectorAll('button').forEach(b => {
                b.classList.remove('bg-blue-600', 'border-white');
                b.classList.add('bg-slate-700', 'border-slate-600');
            });
            btn.classList.remove('bg-slate-700', 'border-slate-600');
            btn.classList.add('bg-blue-600', 'border-white');
        };
        maitriseEl.appendChild(btn);
    });

    const ressentiEl = document.getElementById('suivi-ressenti');
    RESSENTIS.forEach(r => {
        const btn = document.createElement('button');
        btn.className = 'ressenti-btn bg-slate-700 p-3 rounded-xl font-black text-sm text-white border-2 border-slate-600';
        btn.textContent = r.label;
        btn.onclick = () => {
            ressentiEl.querySelectorAll('button').forEach(b => {
                b.classList.remove('bg-blue-600', 'border-white');
                b.classList.add('bg-slate-700', 'border-slate-600');
            });
            btn.classList.remove('bg-slate-700', 'border-slate-600');
            btn.classList.add('bg-blue-600', 'border-white');
        };
        ressentiEl.appendChild(btn);
    });
}

window.suiviRetourVoie = function() {
    if (saisie.voie) {
        afficherVoiesSecteur(saisie.secteur, saisie.voie.type || 'voie');
    } else {
        afficherChoixMode();
    }
};

window.suiviSetReussite = function(reussie) {
    saisie.reussie = reussie;
    const details = document.getElementById('suivi-details-Suite');
    if (details) details.classList.remove('hidden');

    const hauteurBlock = document.getElementById('suivi-hauteur-block');
    if (hauteurBlock) {
        if (reussie) {
            hauteurBlock.innerHTML = `<button onclick="window.suiviEnvoyer()" class="w-full bg-emerald-600 py-5 rounded-3xl text-xl font-black uppercase active:scale-95">📤 Enregistrer la réussite</button>`;
        } else {
            let hauteurOptions = '';
            for (let h = HAUTEUR_ECHEC_MIN; h <= 8; h++) {
                hauteurOptions += `<button onclick="window.suiviSetHauteur(${h}, this)" class="hauteur-btn bg-slate-700 p-2 rounded-lg font-black text-white border-2 border-slate-600">${h}m</button>`;
            }
            hauteurBlock.innerHTML = `
                <p class="text-xs font-bold text-slate-400 uppercase mb-1">Hauteur atteinte (échec)</p>
                <div class="grid grid-cols-6 gap-2 mb-3">${hauteurOptions}</div>
                <button onclick="window.suiviEnvoyer()" class="w-full bg-blue-600 py-5 rounded-3xl text-xl font-black uppercase active:scale-95">📤 Enregistrer</button>
            `;
        }
    }
};

window.suiviSetHauteur = function(h, btn) {
    saisie.hauteur = h;
    const btns = document.querySelectorAll('.hauteur-btn');
    btns.forEach(b => {
        b.classList.remove('bg-blue-600', 'border-white');
        b.classList.add('bg-slate-700', 'border-slate-600');
    });
    if (btn) {
        btn.classList.remove('bg-slate-700', 'border-slate-600');
        btn.classList.add('bg-blue-600', 'border-white');
    }
};

// ============================================================
// ENVOI + FEEDBACK MOTIVANT
// ============================================================
window.suiviEnvoyer = function() {
    const voie = saisie.voie;
    if (!voie) return;

    const maîtriseBtn = document.querySelector('#suivi-maitrise button.bg-blue-600');
    const ressentiBtn = document.querySelector('#suivi-ressenti button.bg-blue-600');

    if (!maîtriseBtn || !ressentiBtn) {
        alert('Choisis un niveau de maîtrise et un ressenti.');
        return;
    }

    const maitrise = MAITRISES[Array.from(document.querySelectorAll('#suivi-maitrise button')).indexOf(maîtriseBtn)].value;
    const ressenti = RESSENTIS[Array.from(document.querySelectorAll('#suivi-ressenti button')).indexOf(ressentiBtn)].value;

    const hauteur = saisie.reussie ? HAUTEUR_MUR : (saisie.hauteur || null);
    if (!saisie.reussie && hauteur === null) {
        alert('Indique la hauteur atteinte.');
        return;
    }

    // Badges AVANT l'envoi (pour détecter les nouveautés).
    const statsAvant = calculerStatsEleve(mesMontees());

    const monteeData = {
        code: currentCode,
        voieId: voie.id,
        secteur: voie.secteur,
        couleur: voie.couleur,
        cotation: voie.cotation,
        reussie: saisie.reussie,
        maitrise: maitrise,
        ressenti: ressenti,
        hauteur: hauteur,
        timestamp: Date.now()
    };

    addMontee(currentClasse, monteeData)
        .then(() => {
            // Optimistic update immédiat.
            montees = { ...montees, [`pending_${Date.now()}`]: monteeData };
            const statsApres = calculerStatsEleve(mesMontees());
            const nouveaux = nouveauxBadges(statsAvant.badges, statsApres.badges);
            afficherFeedback(monteeData, statsApres, nouveaux);
        })
        .catch(err => {
            alert('❌ Erreur lors de l\'enregistrement : ' + err.message);
        });
};

function afficherFeedback(montee, stats, nouveaux) {
    const container = viderContainer();
    container.classList.remove('space-y-4');

    let message = '';
    if (montee.reussie) {
        if (montee.ressenti === 'facile') message = 'Top ! Cette voie est en dessous de ton niveau. Ose la cotation au-dessus 👆';
        else if (montee.ressenti === 'juste') message = 'Nickel, tu es dans ta zone de progression. Continue comme ça 🎯';
        else message = 'Beau combat ! Une victoire qui fait progresser 💪';
    } else {
        message = `Ce n'est pas un échec, c'est un repère. Tu es monté à ${montee.hauteur} m : prochaine étape, +1 m 🔥`;
    }

    const nouveauxHtml = nouveaux.length > 0
        ? `<div class="flex flex-wrap justify-center gap-2 mb-4">${nouveaux.map(b => `<span class="bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 px-3 py-1 rounded-full text-xs font-black">${b.emoji} ${b.titre}</span>`).join('')}</div>`
        : '';

    container.innerHTML = `
        <div class="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
            <div class="text-6xl mb-3">${montee.reussie ? '✅' : '📈'}</div>
            <h2 class="text-2xl font-black text-white mb-2">${montee.reussie ? 'Voie réussie !' : 'Bien tenté !'}</h2>
            ${nouveauxHtml}
            <p class="text-slate-300 mb-6 max-w-sm">${message}</p>
            <div class="bg-slate-800 p-6 rounded-3xl border-2 border-slate-600 w-full max-w-sm space-y-3 text-left">
                <div class="flex justify-between"><span class="text-slate-400">Montées</span><span class="font-black text-white">${stats.total}</span></div>
                <div class="flex justify-between"><span class="text-slate-400">Réussites</span><span class="font-black text-emerald-400">${stats.reussies}</span></div>
                <div class="flex justify-between"><span class="text-slate-400">Taux de réussite</span><span class="font-black text-yellow-400">${Math.round(stats.tauxReussite)}%</span></div>
                <div class="flex justify-between"><span class="text-slate-400">Cotation max</span><span class="font-black text-white">${stats.cotationMax || '—'}</span></div>
            </div>
            <button onclick="window.suiviNouvelleMontée()" class="mt-6 bg-blue-600 px-6 py-4 rounded-2xl font-black text-white active:scale-95">↩ Autre montée</button>
            <button onclick="window.suiviEleveSuivant()" class="mt-3 w-full bg-emerald-600 px-6 py-5 rounded-2xl text-xl font-black text-white active:scale-95">👤 Élève suivant</button>
        </div>
    `;
}

window.suiviNouvelleMontée = function() {
    saisie.secteur = null;
    saisie.voie = null;
    afficherChoixMode();
};

// ============================================================
// ÉCRAN MA PROGRESSION
// ============================================================
window.suiviVoirProgression = function() {
    const container = viderContainer();
    const stats = calculerStatsEleve(mesMontees());

    const frise = BADGES.niveau.map(b => {
        const atteint = stats.niveauxAtteints.has(b.niveau);
        return `<div class="flex-1 text-center">
            <div class="text-2xl ${atteint ? '' : 'opacity-25'}">${b.emoji}</div>
            <div class="text-[10px] font-black ${atteint ? 'text-emerald-400' : 'text-slate-500'}">Niveau ${b.niveau}</div>
        </div>`;
    }).join('');

    container.innerHTML = `
        <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
            <div class="flex items-center gap-3 mb-4">
                <button onclick="window.suiviRetourElementsMode()" class="bg-slate-700 px-3 py-2 rounded-xl font-black text-xs text-white active:scale-95">←</button>
                <h2 class="text-lg font-black text-white">Ma progression</h2>
            </div>
            <div class="grid grid-cols-2 gap-3 mb-5">
                <div class="bg-slate-900 p-4 rounded-2xl text-center"><div class="text-3xl font-black text-white">${stats.total}</div><div class="text-xs text-slate-400">Montées</div></div>
                <div class="bg-slate-900 p-4 rounded-2xl text-center"><div class="text-3xl font-black text-emerald-400">${stats.reussies}</div><div class="text-xs text-slate-400">Réussites</div></div>
                <div class="bg-slate-900 p-4 rounded-2xl text-center"><div class="text-3xl font-black text-yellow-400">${Math.round(stats.tauxReussite)}%</div><div class="text-xs text-slate-400">Taux</div></div>
                <div class="bg-slate-900 p-4 rounded-2xl text-center"><div class="text-3xl font-black text-blue-400">${stats.cotationMax || '—'}</div><div class="text-xs text-slate-400">Cotation max</div></div>
            </div>
            <div class="bg-slate-900 p-4 rounded-2xl mb-5">
                <p class="text-xs font-bold text-slate-400 uppercase mb-3">Étapes franchies</p>
                <div class="flex gap-1">${frise}</div>
            </div>
            <div class="mb-5">
                <p class="text-xs font-bold text-slate-400 uppercase mb-2">🏅 Mes badges</p>
                <div class="grid grid-cols-2 gap-2">
                    ${stats.badges.map(b => `<div class="bg-slate-900 p-3 rounded-xl text-center"><div class="text-2xl">${b.emoji}</div><div class="text-[10px] text-slate-300 font-bold">${b.titre}</div></div>`).join('')}
                </div>
            </div>
            <button onclick="window.suiviRetourElementsMode()" class="w-full bg-blue-600 py-4 rounded-2xl font-black text-white active:scale-95">↩ Retour à la saisie</button>
            <button onclick="window.suiviEleveSuivant()" class="mt-3 w-full bg-emerald-600 py-5 rounded-2xl text-xl font-black text-white active:scale-95">👤 Élève suivant</button>
        </div>
    `;
};

// Retourne au choix Voies / Blocs depuis l'écran progression.
window.suiviRetourElementsMode = function() {
    afficherChoixMode();
};
