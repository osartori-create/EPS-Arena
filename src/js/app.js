// src/js/app.js
import { initLayout } from './ui/prof/layout.js';
import { initAdminUI } from './ui/dashboard-ui.js';

export function initApp() {
    console.log("⚠️ TEST : initLayout + initAdminUI");
    initLayout();
    initAdminUI();
}