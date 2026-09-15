// src/js/modules/cross/cross-scan.js
// Détection de la douchette USB (input + Enter)
// Capture globale : ne réagit qu'aux frappes très rapides (< 100ms)

let scanBuffer = '';
let lastKeyTime = 0;
let onScanCallback = null;
let listenerActif = false;

/**
 * Démarre l'écoute de la douchette.
 * @param {Function} callback - Appelé avec la chaîne scannée (nettoyée)
 */
export function startScanListener(callback) {
    stopScanListener();
    onScanCallback = callback;
    listenerActif = true;

    document.addEventListener('keydown', handleKey);
    // Focus sur un input invisible pour ne pas voler le focus
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

    const now = Date.now();
    const delay = now - lastKeyTime;
    lastKeyTime = now;

    // Frappe lente → c'est un humain, on reset le buffer
    if (delay > 150) scanBuffer = '';

    // Enter : fin de scan (si le buffer ressemble à un dossard)
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

    // Chiffres uniquement
    if (/^[0-9]$/.test(e.key)) {
        scanBuffer += e.key;
    }
}

/**
 * Ajoute un input invisible focalisé en permanence.
 * Utile quand l'iPad est posé sans clavier externe :
 * la douchette envoie ses données sur l'input focalisé.
 */
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
    // On refocalise après chaque blur
    input.onblur = () => setTimeout(() => input.focus(), 50);
    input.focus();
}

/**
 * Force le retour du focus sur l'input de scan.
 */
export function refocusScanInput() {
    const input = document.getElementById('cross-scan-input');
    if (input) input.focus();
}