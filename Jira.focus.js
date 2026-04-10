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
let focusMode = false;
let stylesInstalled = false;

function installStyles(){

    if(stylesInstalled) return;

    stylesInstalled = true;

    const styles = `
body.tm-focus-mode #ghx-detail-view,
body.tm-focus-mode #ghx-detail-contents,
body.tm-focus-mode #addcomment{
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

    document.body?.classList.toggle("tm-focus-mode", focusMode);
}

function toggleFocusMode(){

    if(!stylesInstalled){
        installStyles();
    }

    focusMode = !focusMode;
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
            focusMode = false;
            syncFocusModeState();
        }
    });
}

installFocusShortcut();
installStorageSync();

})();
