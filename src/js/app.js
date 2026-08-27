import { initLayout } from './ui/prof/layout.js';
import { initLiveUI } from './ui/prof/live.js';

export function initApp() {
    console.log("TEST : initLayout + initLiveUI");
    initLayout();
    initLiveUI();
}