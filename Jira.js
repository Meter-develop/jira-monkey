// ==UserScript==
// @name         Jira Board Suite
// @version      5.7
// @match        *://*/secure/*
// @match        *://*/browse/*
// @match        *://*/projects/*
// @match        *://*/issues/*
// @match        *://*/jira/*
// @match        *://*/servicedesk/*
// @match        *://*/plugins/*
// @run-at       document-start
// @grant        GM_addStyle
// ==/UserScript==

(function () {
'use strict';

/* ========================= */
/* CONFIG */

const SP_FIELD = "customfield_10002";
const SETTINGS_STORAGE_KEY = "tm-jira-perfect-sorting-settings";
const USER_CONFIG_STORAGE_KEY = "tm-jira-board-suite-user-config";
const LOADER_FORCE_REFRESH_FLAG_KEY = "tm-bootstrap-force-refresh-once";
const LOADER_UPDATE_API_NAME = "__tmBootstrapCheckForUpdatesNow";
const LOADER_UPDATE_EVENT_NAME = "tm-bootstrap-check-for-updates-now";
const FEATURE_DEFAULTS = {
    showStoryPoints: true,
    optimizeIssueIds: true,
    simplifySubtaskCards: true,
    showAssigneeNames: true,
    highlightCurrentUserIssues: true,
    enableAvatarQuickActions: true,
    enableFocusModeShortcut: true,
    sortSwimlanes: true,
    sortDoneSubtasks: true
};
const FEATURE_DEFINITIONS = [
    {
        key: "showStoryPoints",
        label: "Show story points",
        description: "Shows story points on cards and item counts plus totals in board headers."
    },
    {
        key: "optimizeIssueIds",
        label: "Simplify issue id's",
        description: "Controls issue-id trimming, badge styling, and subtask issue-id changes."
    },
    {
        key: "simplifySubtaskCards",
        label: "Simplify subtask cards",
        description: "Hides repeated footer metadata on subtasks to keep cards cleaner."
    },
    {
        key: "showAssigneeNames",
        label: "Show assignee names",
        description: "Adds first-name labels under Jira board avatars."
    },
    {
        key: "highlightCurrentUserIssues",
        label: "Highlight my issues",
        description: "Highlights cards assigned to the signed-in Jira user."
    },
    {
        key: "enableAvatarQuickActions",
        label: "Avatar quick actions",
        description: "Ctrl-click an avatar for Teams, Shift-click for mail."
    },
    {
        key: "enableFocusModeShortcut",
        label: "Enable focus shortcut",
        description: "Press B to toggle focus mode on boards and issue navigator pages."
    },
    {
        key: "sortSwimlanes",
        label: "Sort swimlanes",
        description: "Active by priority, done by resolution date.",
        requiresReload: true
    },
    {
        key: "sortDoneSubtasks",
        label: "Sort done subtasks",
        description: "Newest updated subtasks first in done columns.",
        requiresReload: true
    }
];

/* ========================= */
/* HIDE BOARD UNTIL READY */

GM_addStyle(`
#ghx-pool { opacity: 0; transition: opacity .15s ease; }
.tm-ready #ghx-pool { opacity: 1; }

.tm-story-points{
    display:inline-block;
    background:#dfe1e6;
    font-size:11px;
    font-weight:700;
    padding:0 4px;
    border-radius:8px;
    margin-left:4px;
}

.tm-column-points{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    background:#dfe1e6;
    color:#172b4d;
    font-size:10px;
    font-weight:700;
    padding:0 5px;
    border-radius:10px;
    min-width:16px;
    min-height:16px;
    margin-left:6px;
    line-height:1;
    vertical-align:middle;
    transform:translateY(-1px);
}

.tm-column-title-inline{
    display:flex;
    align-items:center;
    white-space:nowrap;
}

.tm-column-title-text{
    display:inline-block;
    line-height:1.2;
}

.ghx-issue-fields{
    display:flex;
    align-items:baseline;
    gap:6px;
    flex-wrap:nowrap;
}

.ghx-issue-fields .ghx-key{
    flex:0 0 auto;
    display:flex;
    align-items:center;
}

body.tm-feature-optimize-issue-ids .ghx-issue-fields .ghx-key .ghx-key-link,
body.tm-feature-optimize-issue-ids .ghx-swimlane-header .ghx-parent-key{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    background:#fff4bf;
    color:#5e4a00;
    font-size:10px;
    font-weight:700;
    padding:0 6px;
    border-radius:10px;
    min-height:16px;
    line-height:1;
    vertical-align:middle;
    text-decoration:none;
}

.ghx-issue-fields .ghx-summary{
    flex:1 1 auto;
    min-width:0;
    display:flex;
    align-items:baseline;
}

.ghx-issue-fields .ghx-summary .ghx-inner{
    display:block;
    width:100%;
    overflow:hidden;
    text-overflow:ellipsis;
    white-space:nowrap;
}

body.tm-feature-assignee-names.tm-jira-board-view .ghx-card-footer,
body.tm-feature-assignee-names.tm-jira-board-view .ghx-issue-content{
    overflow:visible;
}

body.tm-feature-assignee-names.tm-jira-board-view .ghx-issue-content{
    padding-bottom:10px !important;
}

body.tm-feature-assignee-names.tm-jira-board-view .ghx-card-footer{
    min-height:0;
    margin-top:-2px;
    padding:0 !important;
}

body.tm-feature-assignee-names.tm-jira-board-view .tm-subtask-card .ghx-card-footer{
    margin-top:0;
}

body.tm-feature-assignee-names.tm-jira-board-view .tm-subtask-card .ghx-issue-content{
    padding-bottom:19px !important;
}

body.tm-feature-assignee-names.tm-jira-board-view .ghx-card-footer .ghx-avatar,
body.tm-feature-assignee-names.tm-jira-board-view .ghx-issue-content .ghx-avatar{
    display:flex !important;
    flex-direction:column !important;
    align-items:center !important;
    justify-content:flex-start !important;
    gap:0 !important;
    height:auto !important;
    width:auto !important;
    overflow:visible !important;
    line-height:1 !important;
    vertical-align:top !important;
}

body.tm-feature-assignee-names.tm-jira-board-view .ghx-card-footer .ghx-avatar-name,
body.tm-feature-assignee-names.tm-jira-board-view .ghx-issue-content .ghx-avatar-name,
body.tm-feature-assignee-names.tm-jira-board-view .ghx-card-footer .aui-avatar-name,
body.tm-feature-assignee-names.tm-jira-board-view .ghx-issue-content .aui-avatar-name{
    display:block !important;
    visibility:visible !important;
    opacity:1 !important;
    position:static !important;
    inset:auto !important;
    max-height:none !important;
    width:auto !important;
    max-width:48px;
    overflow:visible !important;
    margin-top:-1px;
    margin-bottom:-2px;
    font-size:6px;
    font-weight:400;
    line-height:.95;
    white-space:nowrap;
    text-align:center;
    transform:none !important;
}

body.tm-feature-optimize-issue-ids .ghx-issue-fields .ghx-key .ghx-key-link:hover,
body.tm-feature-optimize-issue-ids .ghx-issue-fields .ghx-key .ghx-key-link:focus,
body.tm-feature-optimize-issue-ids .ghx-swimlane-header .ghx-parent-key:hover,
body.tm-feature-optimize-issue-ids .ghx-swimlane-header .ghx-parent-key:focus{
    text-decoration:none;
}

.tm-subtask-card .ghx-card-footer .ghx-type,
.tm-subtask-card .ghx-card-footer .ghx-flags{
    display:none;
}

body.tm-feature-optimize-issue-ids .tm-subtask-card .ghx-key,
body.tm-feature-optimize-issue-ids .tm-subtask-card .ghx-key-link,
body.tm-feature-optimize-issue-ids .tm-subtask-card .ghx-parent-key,
body.tm-feature-optimize-issue-ids .tm-subtask-card .ghx-issue-key-link{
    display:none !important;
}

.tm-settings-slot{
    position:relative;
    display:inline-flex;
    flex:0 0 auto;
    align-items:center;
    margin-left:8px;
    padding:0;
    list-style:none;
    vertical-align:middle;
}

.tm-settings-button{
    position:relative;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    width:auto;
    height:auto;
    padding:2px 4px;
    border:none;
    border-radius:0;
    background:transparent;
    color:#42526e;
    cursor:pointer;
    font-size:15px;
    line-height:1;
    box-shadow:none;
}

.tm-settings-button:hover{
    background:transparent;
    color:#172b4d;
}

.tm-settings-button:focus{
    outline:2px solid #4c9aff;
    outline-offset:2px;
}

.tm-settings-button .aui-icon{
    margin:0;
    color:inherit;
}

.tm-settings-panel{
    position:fixed;
    top:0;
    right:auto;
    left:0;
    z-index:9999;
    width:320px;
    padding:12px;
    border:1px solid #dfe1e6;
    border-radius:10px;
    background:#ffffff;
    box-shadow:0 8px 24px rgba(9,30,66,.25);
    color:#172b4d;
}

.tm-settings-panel[hidden]{
    display:none !important;
}

.tm-settings-title{
    margin:0 0 10px;
    font-size:13px;
    font-weight:700;
}

.tm-settings-list{
    display:grid;
    gap:8px;
}

.tm-settings-option{
    display:grid;
    grid-template-columns:16px 1fr;
    gap:8px;
    align-items:start;
}

.tm-settings-option input{
    margin-top:2px;
}

.tm-settings-label{
    display:block;
    font-size:12px;
    font-weight:600;
    color:#172b4d;
}

.tm-settings-description{
    display:block;
    margin-top:2px;
    font-size:11px;
    line-height:1.35;
    color:#5e6c84;
}

.tm-settings-note{
    margin-top:10px;
    font-size:11px;
    line-height:1.35;
    color:#5e6c84;
}

.tm-settings-actions{
    display:flex;
    justify-content:space-between;
    align-items:center;
    flex-wrap:wrap;
    gap:8px;
    margin-top:12px;
    padding-top:10px;
    border-top:1px solid #dfe1e6;
}

.tm-settings-action-group{
    display:flex;
    flex-wrap:wrap;
    gap:8px;
}

.tm-settings-action-button{
    padding:5px 10px;
    border:1px solid #dfe1e6;
    border-radius:6px;
    background:#ffffff;
    cursor:pointer;
    font-size:12px;
    font-weight:600;
}

.tm-settings-action-button:hover{
    background:#f7f8f9;
}

.tm-settings-action-button:focus{
    outline:2px solid #4c9aff;
    outline-offset:2px;
}

.tm-settings-update-button{
    color:#0747a6;
    border-color:#cce0ff;
    background:#e9f2ff;
}

.tm-settings-update-button:hover{
    background:#dbeafe;
    border-color:#85b8ff;
}

.tm-settings-reset-button{
    color:#c9372c;
}

.tm-settings-reset-button:hover{
    background:#fff0f0;
    border-color:#f5c2c0;
}

.tm-settings-reload-chip{
    display:inline-block;
    margin-left:6px;
    padding:1px 5px;
    border-radius:999px;
    background:#deebff;
    color:#0747a6;
    font-size:10px;
    font-weight:700;
    vertical-align:middle;
}

.tm-assignee-name{
    font-size:10px;
    text-align:center;
    margin-top:2px;
    line-height:10px;
    color:#555;
}

.tm-highlight-card{
    outline:2px solid #2e7d32 !important;
    background:#e8f5e9 !important;
}

.ghx-issue.tm-highlight-card,
.js-issue.tm-highlight-card{
    outline:2px solid #2e7d32 !important;
    background:#e8f5e9 !important;
}

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
`);

/* ========================= */

const cache = new Map();
const inflight = new Set();
const sprintCache = new Map();
const sprintInflight = new Map();
let applyTimer = 0;
let isApplying = false;
let observerStarted = false;
let hooksInstalled = false;
let lastBoardRouteKey = "";
let boardRefreshPending = false;
let observerIgnoreUntil = 0;
let featureSettings = loadFeatureSettings();
let settingsUiInstalled = false;
let settingsPanelOpen = false;
let settingsUiTimer = 0;
let focusShortcutInstalled = false;
let focusMode = false;
let lastFocusPanelWidth = 400;
let currentUserInfo = null;
let currentUserInfoPromise = null;
let lastHighlightDiagnosticKey = "";
let userConfig = loadUserConfig();

function isRapidBoardPage(href = location.href){

    const url = new URL(href, location.origin);
    return /\/secure\/RapidBoard\.jspa$/i.test(url.pathname);
}

function isLikelyJiraPage(){

    return Boolean(
        window.AJS
        || document.getElementById("jira")
        || document.querySelector("meta[name='ajs-version-number'], meta[name='ajs-server-time'], meta[name='application-name'][content*='jira' i]")
        || /\/(secure|browse|projects|jira|issues|servicedesk|plugins)\//i.test(location.pathname)
    );
}

function getIssueCollectionRoot(){

    return document.getElementById("ghx-pool")
        || document.getElementById("ghx-plan")
        || document.getElementById("ghx-backlog")
        || document.querySelector(".ghx-backlog, .ghx-backlog-container, .ghx-plan, .ghx-work")
        || null;
}

function hasVisibleJiraIssues(){

    return Boolean(document.querySelector(
        "#ghx-pool [data-issue-key], #ghx-plan [data-issue-key], #ghx-backlog [data-issue-key], .ghx-backlog [data-issue-key], .ghx-backlog-container [data-issue-key], .ghx-issue[data-issue-key], .js-issue[data-issue-key], .ghx-swimlane-header[data-issue-key]"
    ));
}

function isBoardViewActive(){

    return Boolean(document.getElementById("ghx-pool"));
}

function isBacklogViewActive(){

    return !isBoardViewActive() && Boolean(
        document.getElementById("ghx-plan")
        || document.getElementById("ghx-backlog")
        || document.querySelector(".ghx-backlog, .ghx-backlog-container")
    );
}

function normalizePersonName(value){

    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function normalizeAssetUrl(value){

    if(!value) return "";

    try{
        const url = new URL(String(value), location.origin);
        return `${url.origin}${url.pathname}`.toLowerCase();
    }catch{
        return String(value || "")
            .replace(/[?#].*$/, "")
            .trim()
            .toLowerCase();
    }
}

function getCurrentUserDisplayName(){

    const headerUser = document.querySelector("#header-details-user-fullname");
    const metaNames = [
        "ajs-remote-user-fullname",
        "ajs-user-fullname",
        "ajs-current-user-fullname",
        "ajs-display-name"
    ];
    const ajsMetaKeys = [
        "remote-user-fullname",
        "user-fullname",
        "current-user-fullname",
        "displayName",
        "display-name",
        "full-name",
        "fullname"
    ];

    const values = [
        headerUser?.dataset.displayname,
        headerUser?.getAttribute("data-displayname"),
        headerUser?.getAttribute("title"),
        headerUser?.getAttribute("aria-label"),
        headerUser?.textContent,
        ...metaNames.map(name => document.querySelector(`meta[name='${name}']`)?.content),
        ...ajsMetaKeys.map(key => window.AJS?.Meta?.get?.(key))
    ];

    return values.find(value => String(value || "").trim())?.trim() || "";
}

function isCurrentUserAssignee(fullName, currentUser){

    const normalizedAssignee = normalizePersonName(fullName);
    const normalizedCurrentUser = normalizePersonName(currentUser);

    if(!normalizedAssignee || !normalizedCurrentUser) return false;

    return normalizedAssignee === normalizedCurrentUser
        || normalizedAssignee.includes(normalizedCurrentUser)
        || normalizedCurrentUser.includes(normalizedAssignee);
}

function buildUserIdentitySet(user){

    return new Set(
        [
            user?.displayName,
            user?.name,
            user?.key,
            user?.accountId,
            user?.emailAddress,
            user?.username,
            user?.userKey,
            user?.avatarUrl,
            user?.avatar,
            user?.avatarUrls?.["48x48"],
            user?.avatarUrls?.["32x32"],
            user?.avatarUrls?.["24x24"],
            user?.avatarUrls?.["16x16"]
        ]
            .flatMap(value => {
                if(!value) return [];
                return [normalizePersonName(value), normalizeAssetUrl(value)];
            })
            .filter(Boolean)
    );
}

function matchesCurrentUserAssigneeData(assignee, user = currentUserInfo){

    if(!assignee || !user) return false;

    const assigneeIds = buildUserIdentitySet(assignee);
    const userIds = buildUserIdentitySet(user);

    if(!assigneeIds.size || !userIds.size) return false;

    for(const value of assigneeIds){
        if(userIds.has(value)){
            return true;
        }
    }

    return isCurrentUserAssignee(assignee.displayName, user.displayName || getCurrentUserDisplayName());
}

async function ensureCurrentUserInfo(){

    if(currentUserInfo) return currentUserInfo;
    if(currentUserInfoPromise) return currentUserInfoPromise;

    currentUserInfoPromise = (async()=>{
        const headerAvatar = document.querySelector("#header-details-user-avatar img, #header-details-user-avatar, .aui-header .aui-avatar img, .aui-header .aui-avatar");
        const fallback = {
            displayName: getCurrentUserDisplayName(),
            name: window.AJS?.Meta?.get?.("remote-user") || window.AJS?.Meta?.get?.("user-name") || "",
            key: window.AJS?.Meta?.get?.("remote-user-key") || window.AJS?.Meta?.get?.("user-key") || "",
            accountId: window.AJS?.Meta?.get?.("account-id") || "",
            emailAddress: "",
            avatarUrl: headerAvatar?.getAttribute?.("src") || headerAvatar?.getAttribute?.("data-src") || ""
        };

        try{
            const remote = await fetchJson("/rest/api/2/myself");
            currentUserInfo = {
                ...fallback,
                ...remote
            };
        }catch{
            currentUserInfo = fallback;
        }

        return currentUserInfo;
    })();

    return currentUserInfoPromise;
}

function loadUserConfig(){

    try{
        const parsed = JSON.parse(window.localStorage.getItem(USER_CONFIG_STORAGE_KEY) || "{}");
        return parsed && typeof parsed === "object"
            ? parsed
            : {};
    }catch{
        return {};
    }
}

function saveUserConfig(){

    try{
        window.localStorage.setItem(USER_CONFIG_STORAGE_KEY, JSON.stringify(userConfig));
    }catch{}
}

function normalizeEmailDomain(value){

    const normalized = String(value || "")
        .trim()
        .toLowerCase()
        .replace(/^@+/, "");

    return normalized
        ? `@${normalized}`
        : "";
}

function getSuggestedEmailDomain(){

    const emailAddress = String(currentUserInfo?.emailAddress || "").trim();
    const atIndex = emailAddress.lastIndexOf("@");

    return atIndex >= 0
        ? normalizeEmailDomain(emailAddress.slice(atIndex + 1))
        : "";
}

function getConfiguredEmailDomain(){

    userConfig = loadUserConfig();

    const emailDomain = normalizeEmailDomain(userConfig.emailDomain);

    if(emailDomain && userConfig.emailDomain !== emailDomain){
        userConfig.emailDomain = emailDomain;
        saveUserConfig();
    }

    return emailDomain;
}

function promptForEmailDomain(){

    const configuredDomain = getConfiguredEmailDomain();

    if(configuredDomain){
        return configuredDomain;
    }

    const suggestedDomain = getSuggestedEmailDomain() || "@example.com";
    const response = window.prompt(
        "Enter your organisation email domain for Jira avatar quick actions (for example example.com)",
        suggestedDomain.replace(/^@/, "")
    );
    const emailDomain = normalizeEmailDomain(response);

    if(!emailDomain){
        return "";
    }

    userConfig.emailDomain = emailDomain;
    saveUserConfig();

    return emailDomain;
}

function nameToEmail(fullName, emailDomain = getConfiguredEmailDomain()){

    if(!emailDomain) return "";

    return String(fullName || "")
        .toLowerCase()
        .replace(/\s+/g, ".")
        + emailDomain;
}

function extractAssigneeName(avatar){

    if(avatar?.alt?.startsWith("Assignee:")){
        return avatar.alt.replace("Assignee:", "").trim();
    }

    if(avatar?.title?.startsWith("Assignee:")){
        return avatar.title.replace("Assignee:", "").trim();
    }

    return "";
}

function getBoardPanel(){

    return document.querySelector("#ghx-detail-view");
}

function unlockFocusResize(){

    if(!window.jQuery) return;

    const panel = getBoardPanel();
    if(!panel) return;

    const $panel = window.jQuery(panel);

    if($panel.data("ui-resizable")){
        $panel.resizable("option", "minWidth", 0);
    }
}

function syncFocusModeState(){

    if(!focusMode) return;

    document.body?.classList.add("tm-focus-mode");

    const panel = getBoardPanel();

    if(panel){
        panel.style.width = "0px";
    }

    unlockFocusResize();
}

function toggleBoardHeader(){

    const button = document.querySelector(".ghx-compact-toggle.js-compact-toggle");

    if(button && isRapidBoardPage()){
        button.click();
    }
}

function toggleFocusMode(){

    const panel = getBoardPanel();

    if(!focusMode && panel){
        lastFocusPanelWidth = panel.offsetWidth || lastFocusPanelWidth;
    }

    focusMode = !focusMode;
    document.body?.classList.toggle("tm-focus-mode", focusMode);

    if(!focusMode && panel){
        panel.style.width = `${lastFocusPanelWidth}px`;
    }

    unlockFocusResize();
    toggleBoardHeader();
}

function installFocusShortcut(){

    if(focusShortcutInstalled) return;

    focusShortcutInstalled = true;

    document.addEventListener("keydown", event=>{

        if(!isFeatureEnabled("enableFocusModeShortcut")) return;
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

function openTeamsForAssignee(fullName){

    const emailDomain = promptForEmailDomain();
    const email = nameToEmail(fullName, emailDomain);

    if(!email) return;

    window.location.href = `msteams:/l/chat/0/0?users=${email}`;
}

function openMailForAssignee(fullName){

    const emailDomain = promptForEmailDomain();
    const email = nameToEmail(fullName, emailDomain);

    if(!email) return;

    window.location.href = `mailto:${email}`;
}

function handleAssigneeAvatarClick(event){

    if(!isFeatureEnabled("enableAvatarQuickActions")) return;

    const fullName = event.currentTarget?.dataset.tmAssigneeFullName || extractAssigneeName(event.currentTarget);

    if(!fullName) return;

    if(event.ctrlKey){
        event.preventDefault();
        event.stopPropagation();
        openTeamsForAssignee(fullName);
        return;
    }

    if(event.shiftKey){
        event.preventDefault();
        event.stopPropagation();
        openMailForAssignee(fullName);
    }
}

function matchesCurrentUserFromAvatar(avatar, user = currentUserInfo){

    if(!avatar || !user) return false;

    const avatarName = extractAssigneeName(avatar);
    return Boolean(avatarName) && isCurrentUserAssignee(avatarName, user.displayName || getCurrentUserDisplayName());
}

function applyAssigneeEnhancements(scope = document){

    const shouldShowLabels = isFeatureEnabled("showAssigneeNames") && isBoardViewActive();

    scope.querySelectorAll(".ghx-avatar-img, .ghx-auto-avatar").forEach(avatar=>{

        const fullName = extractAssigneeName(avatar);
        if(!fullName) return;

        avatar.dataset.tmAssigneeFullName = fullName;

        if(!avatar.dataset.tmAssigneeHandler){
            avatar.dataset.tmAssigneeHandler = "true";
            avatar.addEventListener("click", handleAssigneeAvatarClick);
        }

        const firstName = fullName.split(" ")[0] || fullName;
        const avatarContainer = avatar.closest(".ghx-avatar") || avatar.closest(".ghx-end");
        const card = avatar.closest(".js-issue") || avatar.closest(".ghx-issue");
        const label = avatarContainer?.querySelector(".tm-assignee-name");

        if(avatarContainer?.classList.contains("ghx-avatar")){
            if(shouldShowLabels){
                const nextLabel = label || document.createElement("div");
                nextLabel.className = "tm-assignee-name";
                nextLabel.textContent = firstName;

                if(!label){
                    avatarContainer.appendChild(nextLabel);
                }
            }else if(label){
                label.remove();
            }
        }

        void card;
    });
}

function highlightCurrentUserIssueCards(){

    const fallbackUser = {
        displayName: getCurrentUserDisplayName(),
        avatarUrl: document.querySelector("#header-details-user-avatar img, #header-details-user-avatar, .aui-header .aui-avatar img, .aui-header .aui-avatar")?.getAttribute?.("src") || ""
    };
    const seenCards = new Set();
    let highlightCount = 0;

    document.querySelectorAll(".ghx-parent-group.tm-highlight-card, .js-fake-parent.tm-highlight-card, .ghx-subtask-group.tm-highlight-card").forEach(node=>{
        node.classList.remove("tm-highlight-card");
    });

    document.querySelectorAll(".ghx-avatar-img, .ghx-auto-avatar").forEach(avatar=>{

        const target = avatar.closest(".ghx-issue, .js-issue");

        if(!target || seenCards.has(target)) return;

        seenCards.add(target);

        const issueKey = target.dataset.issueKey || target.querySelector("[data-issue-key]")?.dataset.issueKey || "";
        if(!issueKey) return;

        const data = cache.get(issueKey);
        const avatarName = extractAssigneeName(avatar);
        const shouldHighlight = isFeatureEnabled("highlightCurrentUserIssues") && (
            matchesCurrentUserAssigneeData(data?.assignee, currentUserInfo || fallbackUser)
            || matchesCurrentUserFromAvatar(avatar, currentUserInfo || fallbackUser)
            || (!data?.assignee && isCurrentUserAssignee(avatarName, fallbackUser.displayName))
        );

        target.classList.toggle("tm-highlight-card", shouldHighlight);

        if(shouldHighlight){
            highlightCount += 1;
        }
    });

    document.querySelectorAll(".ghx-issue.tm-highlight-card, .js-issue.tm-highlight-card").forEach(node=>{

        if(!seenCards.has(node)){
            node.classList.remove("tm-highlight-card");
        }
    });

    if(
        isFeatureEnabled("highlightCurrentUserIssues")
        && !highlightCount
        && seenCards.size
    ){
        const diagnosticKey = `${getBoardRouteKey()}|${seenCards.size}|${currentUserInfo?.displayName || fallbackUser.displayName}`;

        if(lastHighlightDiagnosticKey !== diagnosticKey){
            lastHighlightDiagnosticKey = diagnosticKey;

            const sampleTargets = [...seenCards]
                .slice(0, 5)
                .map(target => {
                    const issueKey = target.dataset.issueKey || target.querySelector("[data-issue-key]")?.dataset.issueKey || "";

                    return {
                        issueKey,
                        assignee: cache.get(issueKey)?.assignee || null,
                        avatarName: extractAssigneeName(target.querySelector(".ghx-avatar-img, .ghx-auto-avatar"))
                    };
                });

            console.info("[TM Jira] No current-user issue matches found", {
                currentUser: currentUserInfo || fallbackUser,
                targetCount: seenCards.size,
                sampleTargets
            });
        }
    }
}

function getSettingsSlots(){

    return [...document.querySelectorAll(".tm-settings-slot")];
}

function getActiveSettingsSlot(preferredSlot = null){

    if(preferredSlot?.isConnected) return preferredSlot;

    return getSettingsSlots().find(isVisibleElement)
        || getSettingsSlots().at(-1)
        || null;
}

function getActiveSettingsButton(preferredSlot = null){

    return getActiveSettingsSlot(preferredSlot)?.querySelector(".tm-settings-button") || null;
}

function getActiveSettingsPanel(preferredSlot = null){

    return getActiveSettingsSlot(preferredSlot)?.querySelector(".tm-settings-panel") || null;
}

function positionSettingsPanel(preferredSlot = null){

    const button = getActiveSettingsButton(preferredSlot);
    const panel = getActiveSettingsPanel(preferredSlot);

    if(!button || !panel) return;

    const buttonRect = button.getBoundingClientRect();
    const panelWidth = panel.offsetWidth || 320;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const left = Math.max(8, Math.min(buttonRect.right - panelWidth, viewportWidth - panelWidth - 8));
    const top = buttonRect.bottom + 8;

    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
}

function scheduleEnsureSettingsUi(delay = 120){

    window.clearTimeout(settingsUiTimer);

    settingsUiTimer = window.setTimeout(()=>{
        settingsUiTimer = 0;
        ensureSettingsUi();
    }, delay);
}

function loadFeatureSettings(){

    try{
        const parsed = JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) || "{}");

        const showStoryPoints = typeof parsed?.showStoryPoints === "boolean"
            ? parsed.showStoryPoints
            : typeof parsed?.showSwimlaneStoryPoints === "boolean"
                ? parsed.showSwimlaneStoryPoints
                : typeof parsed?.showColumnTotals === "boolean"
                    ? parsed.showColumnTotals
                    : FEATURE_DEFAULTS.showStoryPoints;

        const optimizeIssueIds = typeof parsed?.optimizeIssueIds === "boolean"
            ? parsed.optimizeIssueIds
            : typeof parsed?.trimParentKeys === "boolean"
                ? parsed.trimParentKeys
                : FEATURE_DEFAULTS.optimizeIssueIds;

        return {
            showStoryPoints,
            optimizeIssueIds,
            simplifySubtaskCards: typeof parsed?.simplifySubtaskCards === "boolean"
                ? parsed.simplifySubtaskCards
                : FEATURE_DEFAULTS.simplifySubtaskCards,
            showAssigneeNames: typeof parsed?.showAssigneeNames === "boolean"
                ? parsed.showAssigneeNames
                : FEATURE_DEFAULTS.showAssigneeNames,
            highlightCurrentUserIssues: typeof parsed?.highlightCurrentUserIssues === "boolean"
                ? parsed.highlightCurrentUserIssues
                : FEATURE_DEFAULTS.highlightCurrentUserIssues,
            enableAvatarQuickActions: typeof parsed?.enableAvatarQuickActions === "boolean"
                ? parsed.enableAvatarQuickActions
                : FEATURE_DEFAULTS.enableAvatarQuickActions,
            enableFocusModeShortcut: typeof parsed?.enableFocusModeShortcut === "boolean"
                ? parsed.enableFocusModeShortcut
                : FEATURE_DEFAULTS.enableFocusModeShortcut,
            sortSwimlanes: typeof parsed?.sortSwimlanes === "boolean"
                ? parsed.sortSwimlanes
                : FEATURE_DEFAULTS.sortSwimlanes,
            sortDoneSubtasks: typeof parsed?.sortDoneSubtasks === "boolean"
                ? parsed.sortDoneSubtasks
                : FEATURE_DEFAULTS.sortDoneSubtasks
        };
    }catch{
        return { ...FEATURE_DEFAULTS };
    }
}

function syncFeatureSettingsFromStorage(){

    featureSettings = loadFeatureSettings();
    return featureSettings;
}

function saveFeatureSettings(){

    try{
        window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(featureSettings));
    }catch{}
}

function clearStoredSettings(){

    try{
        window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
    }catch{}

    try{
        window.localStorage.removeItem(USER_CONFIG_STORAGE_KEY);
    }catch{}
}

function requestLoaderForceRefresh(){

    try{
        window.localStorage.setItem(LOADER_FORCE_REFRESH_FLAG_KEY, "true");
    }catch{}
}

function triggerLoaderUpdateNow(){
    const loaderUpdateApi = window[LOADER_UPDATE_API_NAME];

    closeSettingsPanel();

    if(typeof loaderUpdateApi === "function"){
        void loaderUpdateApi();
        return;
    }

    try{
        window.dispatchEvent(new CustomEvent(LOADER_UPDATE_EVENT_NAME));
        return;
    }catch{}

    requestLoaderForceRefresh();

    window.setTimeout(()=>{
        window.location.reload();
    }, 80);
}

function resetStoredSettings(){

    const confirmed = window.confirm(
        "Reset Jira Board Suite settings to their first-run defaults? This clears feature preferences and the configured email domain, then reloads the page."
    );

    if(!confirmed) return;

    clearStoredSettings();
    featureSettings = { ...FEATURE_DEFAULTS };
    userConfig = {};
    currentUserInfo = null;
    currentUserInfoPromise = null;
    focusMode = false;
    closeSettingsPanel();
    applyImmediateFeatureState();

    window.setTimeout(()=>{
        window.location.reload();
    }, 80);
}

function isFeatureEnabled(key){

    return featureSettings[key] !== false;
}

function applyFeatureClasses(){

    if(!document.body) return;

    document.body.classList.toggle("tm-feature-assignee-names", isFeatureEnabled("showAssigneeNames"));
    document.body.classList.toggle("tm-feature-optimize-issue-ids", isFeatureEnabled("optimizeIssueIds"));
    document.body.classList.toggle("tm-jira-board-view", isBoardViewActive());
    document.body.classList.toggle("tm-jira-backlog-view", isBacklogViewActive());
}

function removePoints(){

    document.querySelectorAll(".tm-story-points").forEach(node=>{
        node.remove();
    });
}

function resetColumnTitleLayout(title){

    title.querySelectorAll(":scope > .tm-column-points").forEach(node=>{
        node.remove();
    });

    const text = title.querySelector(":scope > .tm-column-title-text");

    if(text){
        while(text.firstChild){
            title.insertBefore(text.firstChild, text);
        }

        text.remove();
    }

    title.classList.remove("tm-column-title-inline");
}

function resetColumnTotals(){

    getBoardColumnHeaders().forEach(header=>{

        const title = getColumnTitleNode(header);
        if(title){
            resetColumnTitleLayout(title);
        }
    });
}

function resetSubtaskCards(){

    document.querySelectorAll(".ghx-issue.tm-subtask-card[data-issue-key]").forEach(issue=>{
        issue.classList.remove("tm-subtask-card");
    });

    document.querySelectorAll(".ghx-issue[data-issue-key]").forEach(issue=>{
        issue.querySelectorAll(".ghx-key, .ghx-key-link, .ghx-parent-key, .ghx-issue-key-link").forEach(node=>{
            node.style.display = "";
        });
    });
}

function restoreTrimmedParentKeys(){

    document.querySelectorAll(".ghx-parent-key").forEach(link=>{

        if(link.dataset.tmOriginalText != null){
            link.textContent = link.dataset.tmOriginalText;
            delete link.dataset.tmOriginalText;
        }

        delete link.dataset.tmTrimmedPrefix;
    });
}

function applyImmediateFeatureState(){

    syncFeatureSettingsFromStorage();

    applyFeatureClasses();

    if(isFeatureEnabled("showStoryPoints")){
        addPoints();
    }else{
        removePoints();
    }

    if(!isFeatureEnabled("showStoryPoints")){
        resetColumnTotals();
    }else if(document.getElementById("ghx-pool")){
        addColumnTotals();
    }

    if(!isFeatureEnabled("simplifySubtaskCards")){
        resetSubtaskCards();
    }else if(document.getElementById("ghx-pool")){
        markSubtaskCards();
    }

    if(!isFeatureEnabled("optimizeIssueIds")){
        restoreTrimmedParentKeys();
    }

    if(hasVisibleJiraIssues()){
        syncIssueFieldTypography();
        applyAssigneeEnhancements(document);
        highlightCurrentUserIssueCards();
    }

    if(!isFeatureEnabled("enableFocusModeShortcut") && focusMode){
        focusMode = false;
        document.body?.classList.remove("tm-focus-mode");

        const panel = getBoardPanel();
        if(panel){
            panel.style.width = `${lastFocusPanelWidth}px`;
        }
    }else if(focusMode){
        syncFocusModeState();
    }
}

function getFeatureDefinition(key){

    return FEATURE_DEFINITIONS.find(feature => feature.key === key);
}

function closeSettingsPanel(){

    settingsPanelOpen = false;
    document.querySelectorAll(".tm-settings-panel").forEach(panel=>{
        panel.setAttribute("hidden", "hidden");
    });
    document.querySelectorAll(".tm-settings-button").forEach(button=>{
        button.setAttribute("aria-expanded", "false");
    });
}

function openSettingsPanel(preferredSlot = null){

    const panel = getActiveSettingsPanel(preferredSlot);
    const button = getActiveSettingsButton(preferredSlot);

    if(!panel || !button) return;

    closeSettingsPanel();

    settingsPanelOpen = true;

    panel.removeAttribute("hidden");
    positionSettingsPanel(preferredSlot);
    button.setAttribute("aria-expanded", "true");
}

function toggleSettingsPanel(preferredSlot = null){

    const button = getActiveSettingsButton(preferredSlot);
    const isOpenForSlot = settingsPanelOpen && button?.getAttribute("aria-expanded") === "true";

    if(isOpenForSlot){
        closeSettingsPanel();
    }else{
        openSettingsPanel(preferredSlot);
    }
}

function isVisibleElement(node){

    if(!node?.isConnected) return false;

    const style = window.getComputedStyle(node);

    if(style.display === "none" || style.visibility === "hidden") return false;

    return node.getClientRects().length > 0;
}

function getQuickFiltersContainer(){

    if(!isRapidBoardPage() && !hasVisibleJiraIssues()) return null;

    const candidates = [...document.querySelectorAll(
        "#js-work-quickfilters, .ghx-quick-content, #js-quickfilters, .js-quickfilters, #js-quick-filters, .js-quick-filters, #ghx-quickfilters, .ghx-quickfilters, #ghx-quick-filters, .ghx-quick-filters, #quick-filters, .quick-filters"
    )];

    return candidates.find(node => node.id === "js-work-quickfilters" && isVisibleElement(node))
        || candidates.find(node => node.closest("#ghx-work") && isVisibleElement(node))
        || candidates.find(isVisibleElement)
        || candidates[0]
        || null;
}

function renderSettingsPanel(panel){

    panel.innerHTML = `
        <h3 class="tm-settings-title">Jira tweaks</h3>
        <div class="tm-settings-list">
            ${FEATURE_DEFINITIONS.map(feature => `
                <label class="tm-settings-option">
                    <input type="checkbox" data-tm-setting="${feature.key}" ${isFeatureEnabled(feature.key) ? "checked" : ""}>
                    <span>
                        <span class="tm-settings-label">${feature.label}${feature.requiresReload ? '<span class="tm-settings-reload-chip">reload</span>' : ""}</span>
                        <span class="tm-settings-description">${feature.description}</span>
                    </span>
                </label>
            `).join("")}
        </div>
        <div class="tm-settings-note">Sorting changes reload the board so Jira can restore its native order cleanly. Other tweaks update live. Update now checks for newer loader-approved files in place and reloads only when an approved update needs to be applied.</div>
        <div class="tm-settings-actions">
            <div class="tm-settings-action-group">
                <button type="button" class="tm-settings-action-button tm-settings-update-button" data-tm-settings-update="true">Update now</button>
            </div>
            <div class="tm-settings-action-group">
                <button type="button" class="tm-settings-action-button tm-settings-reset-button" data-tm-settings-reset="true">Reset settings</button>
            </div>
        </div>
    `;

    panel.querySelectorAll("input[data-tm-setting]").forEach(input=>{
        input.addEventListener("change", event=>{

            const target = event.currentTarget;
            const key = target.dataset.tmSetting;
            const definition = getFeatureDefinition(key);

            featureSettings[key] = target.checked;
            saveFeatureSettings();
            applyImmediateFeatureState();

            if(definition?.requiresReload){
                window.setTimeout(()=>{
                    window.location.reload();
                }, 80);
                return;
            }

            scheduleApply(0);
        });
    });

    panel.querySelector("[data-tm-settings-reset]")?.addEventListener("click", event=>{
        event.preventDefault();
        event.stopPropagation();
        resetStoredSettings();
    });

    panel.querySelector("[data-tm-settings-update]")?.addEventListener("click", event=>{
        event.preventDefault();
        event.stopPropagation();
        triggerLoaderUpdateNow();
    });
}

function installSettingsUiEvents(){

    if(settingsUiInstalled) return;

    settingsUiInstalled = true;

    document.addEventListener("click", event=>{

        const slot = getActiveSettingsSlot();
        if(!slot?.contains(event.target)){
            closeSettingsPanel();
        }
    });

    document.addEventListener("keydown", event=>{
        if(event.key === "Escape"){
            closeSettingsPanel();
        }
    });

    window.addEventListener("resize", ()=>{
        if(settingsPanelOpen){
            positionSettingsPanel();
        }
    });

    window.addEventListener("scroll", ()=>{
        if(settingsPanelOpen){
            positionSettingsPanel();
        }
    }, true);

}

function removeStaleSettingsSlots(container){

    getSettingsSlots().forEach(slot=>{
        if(slot.parentElement !== container){
            slot.remove();
        }
    });
}

function ensureSettingsUi(){

    const container = getQuickFiltersContainer();

    if(!container){
        if(hasVisibleJiraIssues()){
            scheduleEnsureSettingsUi(250);
        }

        return false;
    }

    installSettingsUiEvents();
    removeStaleSettingsSlots(container);

    let slot = container.querySelector(".tm-settings-slot");

    if(!slot){
        const slotTagName = container.tagName === "UL" || container.tagName === "OL"
            ? "li"
            : container.tagName === "DL"
                ? "dd"
                : "span";

        slot = document.createElement(slotTagName);
        slot.className = "tm-settings-slot";

        if(slot.tagName === "DD"){
            slot.classList.add("ghx-quickfilter");
        }

        const trigger = container.querySelector(".ghx-quickfilter-trigger");

        if(trigger?.parentNode === container){
            container.insertBefore(slot, trigger);
        }else{
            container.appendChild(slot);
        }
    }

    let button = slot.querySelector(".tm-settings-button");

    if(!button){
        button = document.createElement("button");
        button.type = "button";
        button.className = "tm-settings-button";
        button.setAttribute("aria-label", "Board tweak settings");
        button.setAttribute("aria-expanded", "false");
        const icon = document.createElement("span");
        icon.className = "aui-icon aui-icon-small aui-iconfont-configure";
        button.appendChild(icon);
        button.addEventListener("click", event=>{
            event.preventDefault();
            event.stopPropagation();
            toggleSettingsPanel(slot);
        });
        slot.appendChild(button);
    }

    let panel = slot.querySelector(".tm-settings-panel");

    if(!panel){
        panel = document.createElement("div");
        panel.className = "tm-settings-panel";
        panel.setAttribute("hidden", "hidden");
        panel.addEventListener("click", event=>{
            event.stopPropagation();
        });
        slot.appendChild(panel);
    }

    renderSettingsPanel(panel);

    if(settingsPanelOpen){
        openSettingsPanel(slot);
    }else{
        closeSettingsPanel();
    }

    return true;
}

function getStoryPointsValue(value){

    const points = Number(value);
    return Number.isFinite(points) ? points : 0;
}

function getIssueUpdatedTime(key){

    const timestamp = Date.parse(cache.get(key)?.updated || "");
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizeLabel(value){

    return String(value || "")
        .replace(/\s+/g, " ")
        .trim()
        .toUpperCase();
}

function getColumnTitleNode(header){

    return header.querySelector(
        ".ghx-column-title, .ghx-column-name, .ghx-name, .js-column-title, h2, .ghx-heading"
    ) || header;
}

function getColumnIndexByLabel(columnIndexes, label){

    const normalized = normalizeLabel(label);

    if(!normalized) return undefined;
    if(columnIndexes.has(normalized)) return columnIndexes.get(normalized);

    for(const [name, index] of columnIndexes.entries()){
        if(name.includes(normalized) || normalized.includes(name)){
            return index;
        }
    }
}

function isDoneColumnName(value){

    const normalized = normalizeLabel(value);

    return normalized === "DONE"
        || normalized.endsWith("DONE")
        || normalized.includes("DONE");
}

function isInReviewColumnName(value){

    const normalized = normalizeLabel(value);

    return normalized === "IN REVIEW"
        || normalized.endsWith("IN REVIEW")
        || normalized.includes("IN REVIEW");
}

function getBoardColumnHeaders(){

    return [...document.querySelectorAll(
        "#ghx-column-header-group .ghx-column, #ghx-column-headers .ghx-column, .ghx-column-headers .ghx-column"
    )];
}

function isDoneColumnElement(column){

    if(!column?.parentElement) return false;

    const columns = [...column.parentElement.querySelectorAll(":scope > .ghx-column")];
    const columnIndex = columns.indexOf(column);

    if(columnIndex === -1) return false;

    const header = getBoardColumnHeaders()[columnIndex];
    if(!header) return false;

    const title = getColumnTitleNode(header);
    const badgeText = title.querySelector(".tm-column-points")?.textContent || "";
    const name = title.textContent.replace(badgeText, "");

    return isDoneColumnName(name);
}

function normalizeColumnTitleLayout(title, badge){

    title.classList.add("tm-column-title-inline");

    let text = title.querySelector(".tm-column-title-text");

    if(!text){
        text = document.createElement("span");
        text.className = "tm-column-title-text";
        title.insertBefore(text, title.firstChild);
    }

    [...title.childNodes].forEach(node=>{
        if(node === text || node === badge) return;
        text.appendChild(node);
    });

    if(badge.parentNode !== title){
        title.appendChild(badge);
    }
}

function getBoardRouteKey(href = location.href){

    const url = new URL(href, location.origin);
    const relevantParams = new URLSearchParams();
    const ignoredParams = new Set([
        "selectedIssue",
        "issueKey",
        "modal",
        "oldIssueView"
    ]);

    [...url.searchParams.entries()]
        .filter(([key]) => !ignoredParams.has(key))
        .sort(([keyA, valueA], [keyB, valueB]) =>
            keyA.localeCompare(keyB) || valueA.localeCompare(valueB)
        )
        .forEach(([key, value]) => {
            relevantParams.append(key, value);
        });

    const normalizedHash = url.hash
        .replace(/([#&?])selectedIssue=[^&]*/gi, "$1")
        .replace(/([#&?])issueKey=[^&]*/gi, "$1")
        .replace(/[?&]$/, "")
        .replace(/^#&/, "#")
        .replace(/^#$/, "");

    return `${url.pathname}?${relevantParams.toString()}${normalizedHash}`;
}

function getRapidViewId(href = location.href){

    const url = new URL(href, location.origin);
    return url.searchParams.get("rapidView") || "";
}

function getSprintId(href = location.href){

    const url = new URL(href, location.origin);
    return url.searchParams.get("sprint")
        || document.querySelector(".ghx-sprint-meta[data-sprint-id]")?.dataset.sprintId
        || "";
}

function getCurrentSprintName(){

    return document.querySelector("#subnav-title .subnavigator-title")?.textContent?.trim() || "";
}

function normalizeSprintName(value){

    return String(value || "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function formatSprintDate(value){

    if(!value) return "";

    const directMatch = String(value).match(/\b(\d{2})-(\d{2})-(\d{4})\b/);

    if(directMatch){
        return `${directMatch[1]}-${directMatch[2]}-${directMatch[3]}`;
    }

    const date = new Date(value);

    if(Number.isNaN(date.getTime())){
        return String(value).trim();
    }

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = String(date.getFullYear());

    return `${day}-${month}-${year}`;
}

function parseSprintDatesFromText(text){

    const normalizedText = String(text || "")
        .replace(/\s+/g, " ")
        .trim();

    if(!normalizedText) return null;

    const startMatch = normalizedText.match(/start\s*date\s*:\s*(\d{2}-\d{2}-\d{4})(?:\s+\d{2}:\d{2})?/i);
    const endMatch = normalizedText.match(/end\s*date\s*:\s*(\d{2}-\d{2}-\d{4})(?:\s+\d{2}:\d{2})?/i);

    if(!startMatch && !endMatch){
        return null;
    }

    return {
        id: getSprintId(),
        name: getCurrentSprintName(),
        state: "active",
        startDate: startMatch?.[1] || "",
        endDate: endMatch?.[1] || ""
    };
}

function getSprintDatesFromMeta(){

    const timeEl = document.querySelector(".ghx-sprint-meta .time");

    if(!timeEl) return null;

    const tooltipId = timeEl.getAttribute("aria-describedby");
    const describedByText = tooltipId
        ? document.getElementById(tooltipId)?.textContent || ""
        : "";

    const tooltipCandidates = [
        timeEl.getAttribute("title"),
        timeEl.getAttribute("original-title"),
        timeEl.getAttribute("data-tooltip"),
        timeEl.getAttribute("data-aui-tooltip"),
        timeEl.getAttribute("aria-label"),
        describedByText,
        document.querySelector("#aui-tooltip")?.textContent,
        document.querySelector(".aui-tooltip")?.textContent,
        document.querySelector(".tipsy-inner")?.textContent,
        document.querySelector("[role='tooltip']")?.textContent
    ];

    for(const candidate of tooltipCandidates){
        const parsed = parseSprintDatesFromText(candidate);
        if(parsed) return parsed;
    }

    return null;
}

function installSprintMetaDateHook(){

    const timeEl = document.querySelector(".ghx-sprint-meta .time");

    if(!timeEl || timeEl.dataset.tmSprintDateHooked === "true") return;

    timeEl.dataset.tmSprintDateHooked = "true";

    const refreshFromTooltip = () => {
        window.setTimeout(() => {
            ensureSprintDates();
        }, 60);
    };

    ["mouseenter", "focus", "click"].forEach(eventName => {
        timeEl.addEventListener(eventName, refreshFromTooltip);
    });
}

function normalizeSprintRecord(record){

    if(!record) return null;

    return {
        id: record.id != null ? String(record.id) : "",
        name: String(record.name || "").trim(),
        state: String(record.state || "").trim().toLowerCase(),
        startDate: record.startDate || record.start_date || record.start || "",
        endDate: record.endDate || record.end_date || record.completeDate || record.complete_date || ""
    };
}

function matchSprintRecord(records, sprintId, sprintName){

    const normalizedName = normalizeSprintName(sprintName);

    if(sprintId){
        const byId = records.find(record => String(record?.id ?? "") === String(sprintId));
        if(byId) return byId;
    }

    if(normalizedName){
        const exact = records.find(record => normalizeSprintName(record?.name) === normalizedName);
        if(exact) return exact;

        const partial = records.find(record => {
            const candidate = normalizeSprintName(record?.name);
            return candidate && (candidate.includes(normalizedName) || normalizedName.includes(candidate));
        });

        if(partial) return partial;
    }

    return records.find(record => record?.state === "active") || null;
}

function renderSprintDates(sprint){

    const goal = document.getElementById("ghx-sprint-goal");
    if(!goal) return;

    const startText = formatSprintDate(sprint?.startDate);
    const endText = formatSprintDate(sprint?.endDate);
    const originalText = goal.dataset.tmOriginalText || goal.textContent.trim();

    goal.dataset.tmOriginalText = originalText;

    if(!startText && !endText){
        goal.textContent = originalText;
        return;
    }

    goal.textContent = `${originalText} — ${startText || "?"} • ${endText || "?"}`;
}

async function fetchJson(url){

    const response = await fetch(url, { credentials: "same-origin" });

    if(!response.ok){
        throw new Error(`Request failed: ${response.status}`);
    }

    return response.json();
}

async function fetchSprintById(sprintId){

    if(!sprintId) return null;

    try{
        const data = await fetchJson(`/rest/agile/1.0/sprint/${encodeURIComponent(sprintId)}`);
        return normalizeSprintRecord(data);
    }catch{
        return null;
    }
}

async function fetchSprintFromBoard(boardId, sprintId, sprintName){

    if(!boardId) return null;

    let startAt = 0;
    const maxResults = 50;

    while(startAt < 500){
        try{
            const data = await fetchJson(
                `/rest/agile/1.0/board/${encodeURIComponent(boardId)}/sprint?state=active,future,closed&startAt=${startAt}&maxResults=${maxResults}`
            );

            const records = Array.isArray(data?.values)
                ? data.values.map(normalizeSprintRecord).filter(Boolean)
                : [];

            const match = matchSprintRecord(records, sprintId, sprintName);

            if(match) return match;

            if(!records.length || data?.isLast || startAt + records.length >= (data?.total || 0)){
                break;
            }

            startAt += records.length;
        }catch{
            break;
        }
    }

    return null;
}

async function ensureSprintDates(){

    const boardId = getRapidViewId();
    const sprintId = getSprintId();
    const sprintName = getCurrentSprintName();
    const cacheKey = `${boardId}|${sprintId}|${normalizeSprintName(sprintName)}`;

    installSprintMetaDateHook();

    const tooltipSprint = getSprintDatesFromMeta();

    if(!boardId && !sprintId && !sprintName){
        renderSprintDates(null);
        return;
    }

    if(tooltipSprint){
        sprintCache.set(cacheKey, tooltipSprint);
        renderSprintDates(tooltipSprint);
        return;
    }

    if(sprintCache.has(cacheKey)){
        renderSprintDates(sprintCache.get(cacheKey));
        return;
    }

    if(!sprintInflight.has(cacheKey)){
        const promise = (async()=>{
            const sprint = await fetchSprintById(sprintId) || await fetchSprintFromBoard(boardId, sprintId, sprintName);
            sprintCache.set(cacheKey, sprint);
            return sprint;
        })().finally(()=>{
            sprintInflight.delete(cacheKey);
        });

        sprintInflight.set(cacheKey, promise);
    }

    renderSprintDates(await sprintInflight.get(cacheKey));
}

function isBoardMutationNode(node){

    if(node?.nodeType !== Node.ELEMENT_NODE) return false;

    return node.matches?.(
        "#ghx-pool, #ghx-plan, #ghx-backlog, .ghx-backlog, .ghx-backlog-container, .ghx-issue, .js-issue, .ghx-column, .ghx-column-headers, .ghx-parent-group, .ghx-subtask-group"
    ) || node.querySelector?.(
        "#ghx-pool, #ghx-plan, #ghx-backlog, .ghx-backlog, .ghx-backlog-container, .ghx-issue, .js-issue, .ghx-column, .ghx-column-headers, .ghx-parent-group, .ghx-subtask-group"
    );
}

function isCriticalBoardMutationNode(node){

    if(node?.nodeType !== Node.ELEMENT_NODE) return false;

    return node.matches?.(
        "#ghx-pool, #ghx-plan, #ghx-backlog, .ghx-backlog, .ghx-backlog-container, #js-work-quickfilters, .ghx-quick-content, .ghx-column-headers, #ghx-column-header-group"
    ) || node.querySelector?.(
        "#ghx-pool, #ghx-plan, #ghx-backlog, .ghx-backlog, .ghx-backlog-container, #js-work-quickfilters, .ghx-quick-content, .ghx-column-headers, #ghx-column-header-group"
    );
}

function isBoardMutationTarget(node){

    if(node?.nodeType !== Node.ELEMENT_NODE) return false;

    return node.matches?.(
        "#ghx-pool, #ghx-plan, #ghx-backlog, .ghx-backlog, .ghx-backlog-container, .ghx-issue, .js-issue, .ghx-parent-group, .ghx-subtask-group"
    );
}

function isBoardStructureMutationTarget(node){

    if(node?.nodeType !== Node.ELEMENT_NODE) return false;

    return node.matches?.(
        "#ghx-pool, #ghx-plan, #ghx-backlog, .ghx-backlog, .ghx-backlog-container, .ghx-column-headers, #ghx-column-header-group, #js-work-quickfilters, .ghx-quick-content"
    );
}

function shouldReactToBoardAttributeMutation(mutation){

    if(mutation?.type !== "attributes") return false;

    const target = mutation.target;

    return mutation.attributeName === "data-issue-key" && isBoardMutationTarget(target);
}

function markBoardDirty({ hideBoard = false } = {}){

    boardRefreshPending = true;

    if(hideBoard){
        document.body?.classList.remove("tm-ready");
    }
}

function suppressObserver(ms = 800){

    observerIgnoreUntil = Math.max(observerIgnoreUntil, Date.now() + ms);
}

function scheduleApply(delay = 150){

    window.clearTimeout(applyTimer);

    applyTimer = window.setTimeout(()=>{
        applyBoardEnhancements();
    }, delay);
}

function handleNavigation(){

    const routeKey = getBoardRouteKey();
    const routeChanged = routeKey !== lastBoardRouteKey;

    syncFeatureSettingsFromStorage();

    if(!routeChanged) return;

    lastBoardRouteKey = routeKey;
    markBoardDirty({ hideBoard: true });
    scheduleApply(200);
    scheduleEnsureSettingsUi(350);
}

function installHooks(){

    if(hooksInstalled) return;

    hooksInstalled = true;

    ["pushState", "replaceState"].forEach(method=>{

        const original = history[method];

        history[method] = function (...args){

            const result = original.apply(this, args);
            handleNavigation();
            return result;
        };
    });

    window.addEventListener("popstate", handleNavigation);
    window.addEventListener("hashchange", handleNavigation);

    const guardBoardInteraction = event=>{

        const target = event.target?.closest?.(
            ".ghx-swimlane-header, .ghx-issue, .js-issue, .ghx-parent-group, .ghx-subtask-group"
        );

        if(!target) return;

        window.clearTimeout(applyTimer);
        suppressObserver(target.matches(".ghx-swimlane-header") ? 900 : 700);
    };

    ["pointerdown", "mousedown", "click"].forEach(eventName=>{
        document.addEventListener(eventName, guardBoardInteraction, true);
    });

    document.addEventListener("keydown", event=>{

        if(event.key !== "Enter" && event.key !== " ") return;

        guardBoardInteraction(event);
    }, true);
}

function startObserver(){

    if(observerStarted || !document.body) return;

    observerStarted = true;

    const observer = new MutationObserver(mutations=>{

        const hasCriticalBoardMutation = mutations.some(mutation=>
            mutation.type === "childList"
            && [...mutation.addedNodes, ...mutation.removedNodes].some(isCriticalBoardMutationNode)
        );

        if(hasCriticalBoardMutation){
            scheduleEnsureSettingsUi(80);
        }

        if(isApplying || (Date.now() < observerIgnoreUntil && !hasCriticalBoardMutation)) return;

        const shouldApply = hasCriticalBoardMutation || mutations.some(mutation=>
            (
                mutation.type === "childList"
                && [...mutation.addedNodes, ...mutation.removedNodes].some(isBoardMutationNode)
            )
            || (
                mutation.type === "attributes"
                && shouldReactToBoardAttributeMutation(mutation)
            )
        );

        if(shouldApply){
            markBoardDirty();
            scheduleApply(120);
        }
    });

    observer.observe(document.body, {
        attributes: true,
        attributeFilter: ["data-issue-key"],
        childList: true,
        subtree: true
    });
}

/* ========================= */
/* FETCH (FAST + CORRECT FIELD) */

async function fetchIssue(key){

    if(cache.has(key) || inflight.has(key)) return;

    inflight.add(key);

    try{
        const r = await fetch(
            `/rest/api/2/issue/${key}?fields=resolutiondate,priority,issuetype,updated,parent,assignee,${SP_FIELD}`
        );
        const d = await r.json();

        cache.set(key,{
            parentKey: d.fields.parent?.key || "",
            resolved: d.fields.resolutiondate,
            priority: d.fields.priority?.id || 999,
            updated: d.fields.updated,
            sp: d.fields[SP_FIELD],
            subtask: Boolean(d.fields.issuetype?.subtask),
            assignee: d.fields.assignee ? {
                displayName: d.fields.assignee.displayName || "",
                name: d.fields.assignee.name || "",
                key: d.fields.assignee.key || "",
                accountId: d.fields.assignee.accountId || "",
                emailAddress: d.fields.assignee.emailAddress || ""
            } : null
        });

    }catch{}

    inflight.delete(key);
}

/* ========================= */

async function preloadAll(){

    const keys = [...document.querySelectorAll("[data-issue-key]")]
        .map(e => e.dataset.issueKey)
        .filter(Boolean);

    await Promise.all(keys.map(fetchIssue));
}

/* ========================= */

function addPoints(){

    document.querySelectorAll(".ghx-swimlane-header[data-issue-key]").forEach(h=>{

        const key = h.dataset.issueKey;
        const data = cache.get(key);
        const points = getStoryPointsValue(data?.sp);

        if(!points) return;
        if(h.querySelector(".tm-story-points")) return;

        const el = document.createElement("span");
        el.className = "tm-story-points";
        el.textContent = points;

        h.querySelector(".ghx-parent-key")?.after(el);
    });
}

function markSubtaskCards(){

    document.querySelectorAll(".ghx-issue[data-issue-key]").forEach(issue=>{

        const key = issue.dataset.issueKey;
        const isSubtask = Boolean(cache.get(key)?.subtask);
        const hideSubtaskKeys = isSubtask && isFeatureEnabled("optimizeIssueIds");

        issue.classList.toggle("tm-subtask-card", isSubtask);

        issue.querySelectorAll(".ghx-key, .ghx-key-link, .ghx-parent-key, .ghx-issue-key-link").forEach(node=>{
            node.style.display = hideSubtaskKeys ? "none" : "";
        });
    });
}

function trimDisplayedParentKeys(){

    document.querySelectorAll(".ghx-parent-key").forEach(link=>{

        if(link.dataset.tmTrimmedPrefix === "true") return;

        link.dataset.tmOriginalText = link.textContent;
        link.textContent = link.textContent.replace(/^[A-Z][A-Z0-9]*-\s*/i, "");
        link.dataset.tmTrimmedPrefix = "true";
    });
}

function syncIssueFieldTypography(){

    document.querySelectorAll(".ghx-issue-fields").forEach(fields=>{

        const projectKey = fields.querySelector(".ghx-key-link-project-key");
        const issueNumber = fields.querySelector(".ghx-key-link-issue-num");
        const summary = fields.querySelector(".ghx-summary");
        const summaryInner = summary?.querySelector(".ghx-inner") || summary;

        if(projectKey){
            if(projectKey.dataset.tmOriginalDisplay == null){
                projectKey.dataset.tmOriginalDisplay = projectKey.style.display || "";
            }

            projectKey.style.display = isFeatureEnabled("optimizeIssueIds")
                ? "none"
                : projectKey.dataset.tmOriginalDisplay;
        }

        if(issueNumber){
            if(issueNumber.dataset.tmOriginalText == null){
                issueNumber.dataset.tmOriginalText = issueNumber.textContent;
            }

            if(isFeatureEnabled("optimizeIssueIds")){
                if(issueNumber.dataset.tmTrimmedPrefix !== "true"){
                    issueNumber.textContent = issueNumber.textContent.replace(/^\s*-\s*/, "");
                    issueNumber.dataset.tmTrimmedPrefix = "true";
                }
            }else if(issueNumber.dataset.tmOriginalText != null){
                issueNumber.textContent = issueNumber.dataset.tmOriginalText;
                delete issueNumber.dataset.tmTrimmedPrefix;
            }
        }

        if(!issueNumber || !summary || !summaryInner) return;

        [summary, summaryInner].forEach(node=>{
            node.style.removeProperty("font");
            node.style.removeProperty("font-family");
            node.style.removeProperty("font-size");
            node.style.removeProperty("font-weight");
            node.style.removeProperty("line-height");
            node.style.removeProperty("letter-spacing");
            node.style.removeProperty("font-style");
            node.style.removeProperty("color");
            node.style.removeProperty("text-transform");
        });
    });
}

function addColumnTotals(){

    const headers = [...document.querySelectorAll(
        "#ghx-column-header-group .ghx-column, #ghx-column-headers .ghx-column, .ghx-column-headers .ghx-column"
    )];

    if(!headers.length) return;

    const counts = Array(headers.length).fill(0);
    const totals = Array(headers.length).fill(0);
    const counted = new Set();

    const headerMeta = headers.map((header,index)=>{

        const title = getColumnTitleNode(header);
        const badgeText = title.querySelector(".tm-column-points")?.textContent || "";
        const name = normalizeLabel(title.textContent.replace(badgeText, ""));

        return { header, index, title, name };
    });

    const columnIndexes = new Map(
        headerMeta.map(({ name, index }) => [name, index])
    );

    const doneColumnIndex = headerMeta.find(({ name }) => isDoneColumnName(name))?.index;
    const inReviewColumnIndex = headerMeta.find(({ name }) => isInReviewColumnName(name))?.index;
    const inReviewStoryKeys = new Set();

    document.querySelectorAll("#ghx-pool .ghx-issue[data-issue-key]").forEach(issue=>{

        const key = issue.dataset.issueKey;
        const data = cache.get(key);
        const points = getStoryPointsValue(data?.sp);

        if(!key || data?.subtask || counted.has(key)) return;

        const column = issue.closest(".ghx-column");
        const columns = column?.parentElement
            ? [...column.parentElement.querySelectorAll(":scope > .ghx-column")]
            : [];
        const columnIndex = columns.indexOf(column);

        if(columnIndex === -1 || columnIndex >= totals.length) return;

        if(columnIndex === inReviewColumnIndex){
            inReviewStoryKeys.add(key);
            counted.add(key);
            return;
        }

        counts[columnIndex] += 1;
        totals[columnIndex] += points;
        counted.add(key);
    });

    document.querySelectorAll("#ghx-pool .ghx-issue[data-issue-key]").forEach(issue=>{

        const key = issue.dataset.issueKey;
        const data = cache.get(key);
        const column = issue.closest(".ghx-column");
        const parentKey = data?.parentKey;
        const columns = column?.parentElement
            ? [...column.parentElement.querySelectorAll(":scope > .ghx-column")]
            : [];
        const columnIndex = columns.indexOf(column);

        if(
            !data?.subtask
            || !parentKey
            || inReviewColumnIndex === undefined
            || columnIndex !== inReviewColumnIndex
            || inReviewStoryKeys.has(parentKey)
        ){
            return;
        }

        inReviewStoryKeys.add(parentKey);
    });

    document.querySelectorAll(".ghx-swimlane-header[data-issue-key]").forEach(header=>{

        const key = header.dataset.issueKey;
        const data = cache.get(key);
        const points = getStoryPointsValue(cache.get(key)?.sp);

        if(!key || data?.subtask || counted.has(key)) return;

        const status = normalizeLabel(
            header.querySelector(".jira-issue-status-lozenge, .aui-lozenge, .ghx-extra-field-content")?.textContent
        );
        const columnIndex = data?.resolved && doneColumnIndex !== undefined
            ? doneColumnIndex
            : getColumnIndexByLabel(columnIndexes, status);

        if(columnIndex === undefined) return;

        if(columnIndex === inReviewColumnIndex){
            inReviewStoryKeys.add(key);
            counted.add(key);
            return;
        }

        counts[columnIndex] += 1;
        totals[columnIndex] += points;
        counted.add(key);
    });

    if(inReviewColumnIndex !== undefined){
        counts[inReviewColumnIndex] = inReviewStoryKeys.size;
    }

    headerMeta.forEach(({ header, index, title })=>{

        const anchor = title;

        let badge = header.querySelector(".tm-column-points");

        if(!badge){
            badge = document.createElement("span");
            badge.className = "tm-column-points";
        }

        normalizeColumnTitleLayout(anchor, badge);

        badge.textContent = index === inReviewColumnIndex
            ? `${counts[index]}`
            : `${counts[index]} : ${totals[index]}`;
    });
}

/* ========================= */
/* SORT */

function sort(){

    const pool = document.getElementById("ghx-pool");
    if(!pool) return;

    const lanes = [...pool.querySelectorAll(":scope > .ghx-swimlane")];

    const active = [];
    const done = [];

    lanes.forEach(sl=>{
        const key = sl.querySelector("[data-issue-key]")?.dataset.issueKey;
        const data = cache.get(key);

        if(data?.resolved){
            done.push(sl);
        }else{
            active.push(sl);
        }
    });

    /* ACTIVE → priority (lower id = higher priority) */
    active.sort((a,b)=>{
        const kA = a.querySelector("[data-issue-key]")?.dataset.issueKey;
        const kB = b.querySelector("[data-issue-key]")?.dataset.issueKey;

        return (cache.get(kA)?.priority || 999)
             - (cache.get(kB)?.priority || 999);
    });

    /* DONE → resolution date */
    done.sort((a,b)=>{
        const kA = a.querySelector("[data-issue-key]")?.dataset.issueKey;
        const kB = b.querySelector("[data-issue-key]")?.dataset.issueKey;

        return new Date(cache.get(kB)?.resolved || 0)
             - new Date(cache.get(kA)?.resolved || 0);
    });

    const anchor = pool.querySelector("#js-pool-end");

    [...active, ...done].forEach(sl=>{
        pool.insertBefore(sl, anchor);
    });
}

function sortSubtasks(){

    const pool = document.getElementById("ghx-pool");
    if(!pool) return;

    const groups = new Map();

    pool.querySelectorAll(".ghx-issue[data-issue-key]").forEach(issue => {

        const key = issue.dataset.issueKey;
        const data = cache.get(key);
        const container = issue.parentElement;
        const column = issue.closest(".ghx-column");

        if(!key || !data?.subtask || !container || !isDoneColumnElement(column)) return;

        if(!groups.has(container)){
            groups.set(container, []);
        }

        groups.get(container).push(issue);
    });

    groups.forEach((issues, container) => {

        if(issues.length < 2) return;

        const sortedIssues = [...issues].sort((a, b) => {
            const keyA = a.dataset.issueKey;
            const keyB = b.dataset.issueKey;

            return getIssueUpdatedTime(keyB) - getIssueUpdatedTime(keyA);
        });

        const sortableIssues = new Set(issues);
        const orderedChildren = [...container.children];
        const fragment = document.createDocumentFragment();
        let sortedIndex = 0;

        orderedChildren.forEach(child => {
            if(sortableIssues.has(child)){
                fragment.appendChild(sortedIssues[sortedIndex]);
                sortedIndex += 1;
            } else {
                fragment.appendChild(child);
            }
        });

        container.appendChild(fragment);
    });
}

/* ========================= */

async function applyBoardEnhancements(){

    const pool = document.getElementById("ghx-pool");
    const hasIssues = hasVisibleJiraIssues();

    if((!pool && !hasIssues) || isApplying) return;

    isApplying = true;

    try{
        syncFeatureSettingsFromStorage();

        await Promise.all([
            preloadAll(),
            pool ? ensureSprintDates() : Promise.resolve(),
            ensureCurrentUserInfo()
        ]);
        suppressObserver();
        applyFeatureClasses();

        if(pool && isFeatureEnabled("sortSwimlanes")){
            sort();
        }

        if(pool && isFeatureEnabled("sortDoneSubtasks")){
            sortSubtasks();
        }

        if(isFeatureEnabled("simplifySubtaskCards")){
            markSubtaskCards();
        }else{
            resetSubtaskCards();
        }

        if(isFeatureEnabled("optimizeIssueIds")){
            trimDisplayedParentKeys();
        }else{
            restoreTrimmedParentKeys();
        }

        syncIssueFieldTypography();

        if(pool && isFeatureEnabled("showStoryPoints")){
            addPoints();
        }else{
            removePoints();
        }

        if(pool && isFeatureEnabled("showStoryPoints")){
            addColumnTotals();
        }else{
            resetColumnTotals();
        }

        applyAssigneeEnhancements(document);
        highlightCurrentUserIssueCards();

        if(focusMode){
            syncFocusModeState();
        }

        ensureSettingsUi();
        scheduleEnsureSettingsUi(250);

        if(pool){
            document.body.classList.add("tm-ready");
        }
        boardRefreshPending = false;
    } finally {
        isApplying = false;
    }
}

/* ========================= */

async function init(){

    /* wait until DOM exists, then keep enhancing after SPA navigations */
    const wait = setInterval(() => {

        if(!document.body) return;

        clearInterval(wait);

        if(!isLikelyJiraPage()) return;

        applyImmediateFeatureState();
        ensureSettingsUi();
        scheduleEnsureSettingsUi(350);

        installFocusShortcut();
        installHooks();
        startObserver();
        lastBoardRouteKey = getBoardRouteKey();

        if(isRapidBoardPage() && (document.querySelector("#ghx-pool") || hasVisibleJiraIssues())){
            markBoardDirty();
            scheduleApply(0);
        }

    }, 100);
}

init();

})();