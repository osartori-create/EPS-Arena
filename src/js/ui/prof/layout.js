// src/js/ui/prof/layout.js
import { db, ref, onValue } from '../../core/firebase-service.js';
import { 
    initIntervalTimer, 
    startTimer, 
    stopTimer, 
    resetTimer, 
    backToSettings, 
    savePreset, 
    loadPreset, 
    deletePreset 
} from '../../modules/commun/timer.js';
import { initCalculateur } from '../../modules/commun/calculateur.js';
import '../../services/sync-service.js';
import { MENU } from './menu.js';

let sidebarCollapsed = localStorage.getItem('eps_arena_sidebar_collapsed') === '1';

function renderSidebar() {
    const nav = document.getElementById('sidebarNav');
    if (!nav) return;

    nav.innerHTML = MENU.map(section => `
        <div class="mb-2">
            <div class="sidebar-section-title px-3 pt-2 pb-1 text-[10px] font-black uppercase tracking-wider">${section.section}</div>
            ${section.items.map(item => `
                <button onclick="switchTab('${item.view}')" data-view="${item.view}" title="${item.label}"
                        class="sidebar-item w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors">
                    <span class="sidebar-icon text-lg leading-none shrink-0">${item.icon}</span>
                    <span class="sidebar-label whitespace-nowrap">${item.label}</span>
                </button>
            `).join('')}
        </div>
    `).join('');

    appliquerEtatSidebar();
    // Vue active par défaut : admin
    nav.querySelector('.sidebar-item[data-view="admin"]')?.classList.add('sidebar-active');
}

function appliquerEtatSidebar() {
    const aside = document.getElementById('sidebar');
    const title = document.getElementById('sidebarTitle');
    const footer = document.getElementById('sidebarFooterLabel');
    if (aside) aside.style.width = sidebarCollapsed ? '4rem' : '15rem';
    if (title) title.style.display = sidebarCollapsed ? 'none' : '';
    if (footer) footer.style.display = sidebarCollapsed ? 'none' : '';
    document.querySelectorAll('#sidebarNav .sidebar-label, #sidebarNav .sidebar-section-title').forEach(el => {
        el.style.display = sidebarCollapsed ? 'none' : '';
    });
    document.querySelectorAll('#sidebarNav .sidebar-item').forEach(el => {
        el.classList.toggle('justify-center', sidebarCollapsed);
    });
}

window.toggleSidebar = function() {
    sidebarCollapsed = !sidebarCollapsed;
    localStorage.setItem('eps_arena_sidebar_collapsed', sidebarCollapsed ? '1' : '0');
    appliquerEtatSidebar();
};

export function initLayout() {

    // Exposer les fonctions du Timer
    window.startTimer = startTimer;
    window.stopTimer = stopTimer;
    window.resetTimer = resetTimer;
    window.backToSettings = backToSettings;
    window.savePreset = savePreset;
    window.loadPreset = loadPreset;
    window.deletePreset = deletePreset;

    window.openTool = function(toolName) {
        document.getElementById('tools-menu').classList.add('hidden');
        if (toolName === 'timer') {
            document.getElementById('tools-timer-container').classList.remove('hidden');
            initIntervalTimer();
        } else if (toolName === 'calculateur') {
            document.getElementById('tools-calculator').classList.remove('hidden');
            initCalculateur();
        }
    };

    window.backToToolsMenu = function() {
        document.getElementById('tools-timer-container').classList.add('hidden');
        document.getElementById('tools-calculator').classList.add('hidden');
        document.getElementById('tools-menu').classList.remove('hidden');
    };

    // 1. Gestion des onglets (CORRIGÉ : on n'utilise plus el.style.display pour les vues standard)
    window.switchTab = function(tabName) {
    ['admin', 'activities', 'live', 'tools', 'evaluations', 'sync', 'cross', 'scancamera', 'presences'].forEach(t => {
        const viewId = 'view' + t.charAt(0).toUpperCase() + t.slice(1);
        const el = document.getElementById(viewId);
        if (el) el.classList.add('hidden');
    });

    const tvView = document.getElementById('viewTV');
    if (tvView) {
        if (tabName === 'tv') {
            tvView.style.display = 'block';
        } else {
            tvView.classList.add('hidden');
            tvView.style.display = 'none';
            tvView.style.height = '';
        }
    }

    // Surbrillance de l'item actif dans la barre latérale
    document.querySelectorAll('#sidebarNav .sidebar-item').forEach(btn => {
        btn.classList.toggle('sidebar-active', btn.dataset.view === tabName);
    });

    if (tabName !== 'tv') {
        const targetView = document.getElementById('view' + tabName.charAt(0).toUpperCase() + tabName.slice(1));
        if (targetView) {
            targetView.classList.remove('hidden');
            targetView.style.display = '';
        }
    }

    if (tabName === 'evaluations') {
    import('../../modules/grilles/grilles-interface.js').then(m => {
        m.initGrillesInterface();
    }).catch(err => console.error('Erreur init Grilles :', err));
}
if (tabName === 'cross') {
    import('../../modules/cross/cross-interface.js').then(m => m.initCrossInterface());
}
if (tabName === 'scancamera') {
    import('../../modules/scan-camera/scan-camera-interface.js').then(m => m.initScanCameraInterface());
}
if (tabName === 'presences') {
    import('../../carnet/appel.js').then(m => {
        m.initAppelInterface();
    }).catch(err => console.error('Erreur init Appel :', err));
}
if (tabName === 'sync') {
    setTimeout(() => {
        if (window.syncAfficherResume) window.syncAfficherResume();
    }, 50);
}
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

    renderSidebar();
}