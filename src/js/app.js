// src/js/app.js
import { initLayout } from './ui/prof/layout.js';
import { initAdminUI } from './ui/dashboard-ui.js';
import { initActivities } from './ui/prof/activities.js';

export function initApp() {
    console.log("⚠️ TEST : initLayout + initAdminUI + initActivities");
    initLayout();
    initAdminUI();
    initActivities();
}