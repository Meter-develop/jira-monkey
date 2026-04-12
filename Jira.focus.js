// ==UserScript==
// @name         Jira Focus Shortcut
// @version      1.0
// @match        *://*/secure/*
// @match        *://*/browse/*
// @match        *://*/projects/*
// @match        *://*/issues/*
// @match        *://*/jira/*
// @match        *://*/servicedesk/*
// @match        *://*/plugins/*
// @exclude-match *://*/secure/RapidBoard.jspa*
// @run-at       document-start
// @grant        GM_addStyle
// ==/UserScript==

(function () {
'use strict';

if(/\/secure\/RapidBoard\.jspa$/i.test(location.pathname)) return;
if(window.__tmJiraBoardSuiteInstalled) return;

const SETTINGS_STORAGE_KEY = "tm-jira-perfect-sorting-settings";
let focusShortcutInstalled = false;
const FOCUS_MODE_OFF = 0;
const FOCUS_MODE_PARTIAL = 1;
const FOCUS_MODE_FULL = 2;
let focusMode = FOCUS_MODE_OFF;
let stylesInstalled = false;

function installStyles(){

    if(stylesInstalled) return;

    stylesInstalled = true;

    const styles = `
body.tm-focus-mode-full #ghx-detail-view,
body.tm-focus-mode-full #ghx-detail-contents,
body.tm-focus-mode-full #addcomment{
    width:0 !important;
    min-width:0 !important;
    display:none !important;
}

body.tm-focus-mode #navigator-sidebar,
body.tm-focus-mode .navigator-sidebar{
    display:none !important;
}

body.tm-focus-mode #header,
body.tm-focus-mode .issue-search-header{
    display:none !important;
}
`;

    if(typeof GM_addStyle === "function"){
        GM_addStyle(styles);
        return;
    }

    const styleTag = document.createElement("style");
    styleTag.textContent = styles;
    (document.head || document.documentElement).appendChild(styleTag);
}

function loadFeatureSettings(){

    try{
        const parsed = JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) || "{}");
        return parsed && typeof parsed === "object"
            ? parsed
            : {};
    }catch{
        return {};
    }
}

function isFocusShortcutEnabled(){

    const settings = loadFeatureSettings();
    return settings.enableFocusModeShortcut !== false;
}

function syncFocusModeState(){

    document.body?.classList.toggle("tm-focus-mode", focusMode !== FOCUS_MODE_OFF);
    document.body?.classList.toggle("tm-focus-mode-full", focusMode === FOCUS_MODE_FULL);
}

function toggleFocusMode(){

    if(!stylesInstalled){
        installStyles();
    }

    focusMode = focusMode === FOCUS_MODE_OFF
        ? FOCUS_MODE_PARTIAL
        : focusMode === FOCUS_MODE_PARTIAL
            ? FOCUS_MODE_FULL
            : FOCUS_MODE_OFF;
    syncFocusModeState();
}

function installFocusShortcut(){

    if(focusShortcutInstalled) return;

    focusShortcutInstalled = true;

    document.addEventListener("keydown", event=>{

        if(!isFocusShortcutEnabled()) return;
        if(event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return;

        const element = document.activeElement;

        if(
            element?.tagName === "INPUT"
            || element?.tagName === "TEXTAREA"
            || element?.isContentEditable
        ){
            return;
        }

        if(event.key === "b" || event.key === "B"){
            toggleFocusMode();
        }
    });
}

function installStorageSync(){

    window.addEventListener("storage", event=>{

        if(event.key !== SETTINGS_STORAGE_KEY) return;

        if(!isFocusShortcutEnabled() && focusMode){
            focusMode = FOCUS_MODE_OFF;
            syncFocusModeState();
        }
    });
}

installFocusShortcut();
installStorageSync();

})();
