// src/js/modules/cross/cross-scan.js
// Détection de la douchette USB (input + Enter)
// Capture globale SAUF si le focus est sur un input/textarea/select

let scanBuffer = '';
let lastKeyTime = 0;
let onScanCallback = null;
let listenerActif = false;

export function startScanListener(callback) {
    stopScanListener();
    onScanCallback = callback;
    listenerActif = true;
    document.addEventListener('keydown', handleKey);
    focusScanInput();
}

export function stopScanListener() {
    if (!listenerActif) return;
    document.removeEventListener('keydown', handleKey);
    listenerActif = false;
    onScanCallback = null;
    scanBuffer = '';
}

function handleKey(e) {
    if (!listenerActif) return;

    // ✅ CORRECTIF : ne rien capturer si le focus est sur un champ éditable
    const active = document.activeElement;
    if (active && active.id !== 'cross-scan-input') {
        const tag = active.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || active.isContentEditable) {
            scanBuffer = '';
            return;
        }
    }

    const now = Date.now();
    const delay = now - lastKeyTime;
    lastKeyTime = now;

    if (delay > 150) scanBuffer = '';

    if (e.key === 'Enter') {
        if (scanBuffer.length >= 3) {
            e.preventDefault();
            const buffer = scanBuffer;
            scanBuffer = '';
            if (onScanCallback) onScanCallback(buffer);
        } else {
            scanBuffer = '';
        }
        return;
    }

    if (/^[0-9]$/.test(e.key)) {
        scanBuffer += e.key;
    }
}

function focusScanInput() {
    let input = document.getElementById('cross-scan-input');
    if (!input) {
        input = document.createElement('input');
        input.id = 'cross-scan-input';
        input.type = 'text';
        input.autocomplete = 'off';
        input.style.position = 'fixed';
        input.style.opacity = '0';
        input.style.pointerEvents = 'none';
        input.style.left = '-1000px';
        document.body.appendChild(input);
    }
    input.onblur = () => {
        // Ne refocalise que si l'utilisateur n'est pas dans un autre champ
        setTimeout(() => {
            const active = document.activeElement;
            if (!active || active === document.body || active.id === 'cross-scan-input') {
                input.focus();
            }
        }, 50);
    };
    input.focus();
}

export function refocusScanInput() {
    const input = document.getElementById('cross-scan-input');
    if (input) input.focus();
}