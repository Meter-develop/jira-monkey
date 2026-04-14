// ==UserScript==
// @name         Jira Board Suite
// @version      5.22
// @match        *://*/secure/RapidBoard.jspa*
// @run-at       document-start
// @grant        GM_addStyle
// ==/UserScript==

(function () {
'use strict';

window.__tmJiraBoardSuiteInstalled = true;

/* ========================= */
/* CONFIG */

const SP_FIELD = "customfield_10002";
const REPOSITORY_URL = "https://github.com/Meter-develop/jira-monkey";
const SCRIPT_URL = "https://raw.githubusercontent.com/Meter-develop/jira-monkey/main/Jira.js";
const SETTINGS_STORAGE_KEY = "tm-jira-perfect-sorting-settings";
const USER_CONFIG_STORAGE_KEY = "tm-jira-board-suite-user-config";
const DEFAULT_BACKLOG_COLLAPSE_STORAGE_KEY = "tm-jira-default-backlog-collapse-v1";
const LOADER_FORCE_REFRESH_FLAG_KEY = "tm-bootstrap-force-refresh-once";
const LOADER_UPDATE_API_NAME = "__tmBootstrapCheckForUpdatesNow";
const LOADER_UPDATE_EVENT_NAME = "tm-bootstrap-check-for-updates-now";
const LOADER_UPDATE_STATUS_KEY = "tm-bootstrap-update-status-v1";
const LOADER_UPDATE_STATUS_EVENT_NAME = "tm-bootstrap-update-status-change";
const LOADER_LOADED_SCRIPTS_STATE_KEY = "__tmBootstrapLoadedScripts";
const LOADER_LOADED_SCRIPTS_EVENT_NAME = "tm-bootstrap-loaded-scripts-change";
const ISSUE_BADGE_COLOR_DEFAULTS = {
    issueBadgeBackgroundColor: "#fff4bf",
    issueBadgeTextColor: "#5e4a00",
    resolvedIssueBadgeBackgroundColor: "#dcfff1",
    resolvedIssueBadgeTextColor: "#216e4e"
};
const ISSUE_BADGE_COLOR_FIELDS = [
    {
        key: "issueBadgeBackgroundColor",
        label: "Default badge background",
        description: "Background color for normal issue ID badges."
    },
    {
        key: "issueBadgeTextColor",
        label: "Default badge text",
        description: "Text color for normal issue ID badges."
    },
    {
        key: "resolvedIssueBadgeBackgroundColor",
        label: "Resolved badge background",
        description: "Background color for resolved issue ID badges."
    },
    {
        key: "resolvedIssueBadgeTextColor",
        label: "Resolved badge text",
        description: "Text color for resolved issue ID badges."
    }
];
const FEATURE_DEFAULTS = {
    showStoryPoints: true,
    optimizeIssueIds: true,
    simplifySubtaskCards: true,
    simplifyBacklogCards: true,
    showAssigneeNames: true,
    highlightCurrentUserIssues: true,
    enableAvatarQuickActions: true,
    enableFocusModeShortcut: true,
    enableBacklogSearch: true,
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
        key: "simplifyBacklogCards",
        label: "Simplify backlog cards",
        description: "Moves story points and ready status forward, while hiding extra backlog metadata until hover."
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
        description: "Press B to cycle between normal view, hiding the left/top panels, and full focus mode."
    },
    {
        key: "enableBacklogSearch",
        label: "Backlog search",
        description: "Adds the custom backlog search beside the settings button and hides Jira's built-in backlog search box."
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

:root{
    --tm-issue-badge-bg:#fff4bf;
    --tm-issue-badge-text:#5e4a00;
    --tm-resolved-issue-badge-bg:#dcfff1;
    --tm-resolved-issue-badge-text:#216e4e;
    --tm-resolved-issue-badge-hover-bg:#baf3db;
    --tm-resolved-issue-badge-hover-text:#164b35;
}

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

.ghx-issue-fields,
.tm-issue-key-layout{
    display:flex;
    align-items:baseline;
    gap:6px;
    flex-wrap:nowrap;
}

.ghx-issue-fields .ghx-key,
.tm-issue-key-layout .ghx-key{
    flex:0 0 auto;
    display:flex;
    align-items:center;
}

body.tm-feature-optimize-issue-ids .ghx-issue-fields .ghx-key .ghx-key-link,
body.tm-feature-optimize-issue-ids .ghx-issue-fields .ghx-key .js-key-link,
body.tm-feature-optimize-issue-ids .tm-issue-key-layout .ghx-key .ghx-key-link,
body.tm-feature-optimize-issue-ids .tm-issue-key-layout .ghx-key .js-key-link,
body.tm-feature-optimize-issue-ids .ghx-swimlane-header .ghx-parent-key{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    background:var(--tm-issue-badge-bg);
    color:var(--tm-issue-badge-text);
    font-size:10px;
    font-weight:700;
    padding:0 6px;
    border-radius:10px;
    min-height:16px;
    line-height:1;
    vertical-align:middle;
    text-decoration:none;
}

.ghx-issue-fields .ghx-summary,
.tm-issue-key-layout .ghx-summary{
    flex:1 1 auto;
    min-width:0;
    display:flex;
    align-items:baseline;
}

.ghx-issue-fields .ghx-summary .ghx-inner,
.tm-issue-key-layout .ghx-summary .ghx-inner{
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
body.tm-feature-optimize-issue-ids .ghx-issue-fields .ghx-key .js-key-link:hover,
body.tm-feature-optimize-issue-ids .ghx-issue-fields .ghx-key .js-key-link:focus,
body.tm-feature-optimize-issue-ids .tm-issue-key-layout .ghx-key .ghx-key-link:hover,
body.tm-feature-optimize-issue-ids .tm-issue-key-layout .ghx-key .ghx-key-link:focus,
body.tm-feature-optimize-issue-ids .tm-issue-key-layout .ghx-key .js-key-link:hover,
body.tm-feature-optimize-issue-ids .tm-issue-key-layout .ghx-key .js-key-link:focus,
body.tm-feature-optimize-issue-ids .ghx-swimlane-header .ghx-parent-key:hover,
body.tm-feature-optimize-issue-ids .ghx-swimlane-header .ghx-parent-key:focus{
    text-decoration:none;
}

body.tm-feature-optimize-issue-ids .ghx-issue-fields .ghx-key .tm-resolved-issue-key,
body.tm-feature-optimize-issue-ids .tm-issue-key-layout .ghx-key .tm-resolved-issue-key,
body.tm-feature-optimize-issue-ids .ghx-swimlane-header .tm-resolved-issue-key{
    background:var(--tm-resolved-issue-badge-bg);
    color:var(--tm-resolved-issue-badge-text);
}

body.tm-feature-optimize-issue-ids .ghx-issue-fields .ghx-key .tm-resolved-issue-key:hover,
body.tm-feature-optimize-issue-ids .ghx-issue-fields .ghx-key .tm-resolved-issue-key:focus,
body.tm-feature-optimize-issue-ids .tm-issue-key-layout .ghx-key .tm-resolved-issue-key:hover,
body.tm-feature-optimize-issue-ids .tm-issue-key-layout .ghx-key .tm-resolved-issue-key:focus,
body.tm-feature-optimize-issue-ids .ghx-swimlane-header .tm-resolved-issue-key:hover,
body.tm-feature-optimize-issue-ids .ghx-swimlane-header .tm-resolved-issue-key:focus{
    background:var(--tm-resolved-issue-badge-hover-bg);
    color:var(--tm-resolved-issue-badge-hover-text);
    text-decoration:none;
}

.tm-default-backlog-expander svg{
    display:block;
    transition:transform .15s ease;
}

.tm-default-backlog-container.tm-default-backlog-collapsed .tm-default-backlog-expander svg{
    transform:rotate(-90deg);
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
    align-self:center;
    margin-left:8px;
    padding:0;
    list-style:none;
    vertical-align:middle;
    line-height:1;
}

.tm-backlog-search-slot{
    display:inline-flex;
    flex:0 0 auto;
    align-items:center;
    align-self:center;
    margin-left:8px;
    padding:0;
    list-style:none;
    vertical-align:middle;
    line-height:1;
}

.tm-settings-slot.ghx-quickfilter,
.tm-backlog-search-slot.ghx-quickfilter{
    float:none;
    min-height:30px;
    margin-top:0;
    margin-bottom:0;
}

.tm-settings-slot.ghx-quickfilter{
    margin-right:0;
}

.tm-backlog-search-slot.ghx-quickfilter{
    margin-right:0;
}

.tm-backlog-search-input{
    width:220px;
    max-width:min(32vw, 320px);
    min-height:30px;
    padding:4px 10px;
    border:1px solid #dfe1e6;
    border-radius:6px;
    background:#ffffff;
    color:#172b4d;
    font-size:12px;
    line-height:1.4;
    margin:0;
    vertical-align:middle;
}

.tm-backlog-search-input::placeholder{
    color:#6b778c;
}

.tm-backlog-search-input:hover{
    border-color:#c1c7d0;
}

.tm-backlog-search-input:focus{
    border-color:#4c9aff;
    outline:2px solid rgba(76,154,255,.35);
    outline-offset:1px;
}

.tm-backlog-search-hidden{
    display:none !important;
}

.tm-backlog-search-empty{
    display:none !important;
}

body.tm-feature-simplify-backlog-cards.tm-jira-backlog-view .tm-backlog-simplified-row .ghx-key{
    order:1;
}

body.tm-feature-simplify-backlog-cards.tm-jira-backlog-view .tm-backlog-simplified-row{
    align-items:center;
    width:100%;
    min-width:0;
}

body.tm-feature-simplify-backlog-cards.tm-jira-backlog-view .tm-backlog-simplified-row > *{
    align-self:center;
}

body.tm-feature-simplify-backlog-cards.tm-jira-backlog-view .tm-backlog-simplified-row .ghx-end.ghx-estimate{
    order:2;
    flex:0 0 auto;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    margin-left:0;
    padding:0 !important;
    border:none !important;
    background:transparent !important;
    box-shadow:none !important;
}

body.tm-feature-simplify-backlog-cards.tm-jira-backlog-view .tm-backlog-simplified-row .ghx-end.ghx-estimate .ghx-statistic-badge{
    display:inline-flex !important;
    align-items:center;
    justify-content:center;
    min-width:16px;
    min-height:16px;
    background:#dfe1e6 !important;
    font-size:11px;
    font-weight:700;
    padding:0 4px;
    border-radius:8px;
    margin-left:0;
    line-height:1.2;
    border:none !important;
    box-shadow:none !important;
    vertical-align:middle;
}

body.tm-feature-simplify-backlog-cards.tm-jira-backlog-view .tm-backlog-ready-inline{
    order:3;
    flex:0 0 auto;
    display:inline-flex;
    align-items:center;
    font-size:11px;
    line-height:1.2;
    white-space:nowrap;
}

body.tm-feature-simplify-backlog-cards.tm-jira-backlog-view .tm-backlog-ready-inline,
body.tm-feature-simplify-backlog-cards.tm-jira-backlog-view .tm-backlog-ready-inline *{
    font-size:11px !important;
}

body.tm-feature-simplify-backlog-cards.tm-jira-backlog-view .tm-backlog-simplified-row .ghx-summary{
    order:4;
    flex:1 1 auto;
    min-width:0;
    align-items:center;
}

body.tm-feature-simplify-backlog-cards.tm-jira-backlog-view .tm-backlog-right-meta{
    order:5;
    flex:0 0 auto;
    display:inline-flex;
    align-items:center;
    gap:6px;
    margin-left:auto;
    min-width:0;
    justify-content:flex-end;
}

body.tm-feature-simplify-backlog-cards.tm-jira-backlog-view .tm-backlog-right-meta > *{
    flex:0 0 auto;
}

body.tm-feature-simplify-backlog-cards.tm-jira-backlog-view .tm-backlog-right-meta .ghx-extra-field,
body.tm-feature-simplify-backlog-cards.tm-jira-backlog-view .tm-backlog-right-meta .ghx-avatar,
body.tm-feature-simplify-backlog-cards.tm-jira-backlog-view .tm-backlog-right-meta .ghx-end{
    display:inline-flex;
    align-items:center;
}

body.tm-feature-simplify-backlog-cards.tm-jira-backlog-view .tm-backlog-right-meta .ghx-avatar-img,
body.tm-feature-simplify-backlog-cards.tm-jira-backlog-view .tm-backlog-right-meta .ghx-auto-avatar{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    flex:0 0 auto;
}

body.tm-feature-simplify-backlog-cards.tm-jira-backlog-view .tm-backlog-right-meta .aui-label,
body.tm-feature-simplify-backlog-cards.tm-jira-backlog-view .tm-backlog-right-meta .ghx-label{
    max-width:180px;
    overflow:hidden;
    text-overflow:ellipsis;
    white-space:nowrap;
}

body.tm-feature-simplify-backlog-cards.tm-jira-backlog-view .tm-backlog-simplified-card,
body.tm-feature-simplify-backlog-cards.tm-jira-backlog-view .tm-backlog-simplified-card .ghx-issue-content{
    overflow:visible;
}

body.tm-feature-simplify-backlog-cards.tm-jira-backlog-view .tm-backlog-simplified-card{
    position:relative;
    display:flex;
    align-items:center;
}

body.tm-feature-simplify-backlog-cards.tm-jira-backlog-view .tm-backlog-simplified-card .ghx-issue-content{
    display:flex;
    align-items:center;
    width:100%;
    min-width:0;
    min-height:100%;
}

body.tm-feature-simplify-backlog-cards.tm-jira-backlog-view .tm-backlog-settings-trigger{
    position:relative;
    display:inline-flex !important;
    align-items:center;
    justify-content:center;
    width:18px;
    min-width:18px;
    height:18px;
    font-size:0 !important;
    line-height:1;
    color:#5e6c84;
    text-decoration:none;
}

body.tm-feature-simplify-backlog-cards.tm-jira-backlog-view .tm-backlog-settings-trigger > *{
    display:none !important;
}

body.tm-feature-simplify-backlog-cards.tm-jira-backlog-view .tm-backlog-settings-trigger::before,
body.tm-feature-simplify-backlog-cards.tm-jira-backlog-view .tm-backlog-settings-trigger.aui-iconfont-more::before{
    content:"⚙" !important;
    display:block;
    font-size:14px;
    line-height:1;
    color:currentColor;
    font-family:inherit !important;
}

body.tm-feature-simplify-backlog-cards.tm-jira-backlog-view .tm-backlog-settings-trigger:hover,
body.tm-feature-simplify-backlog-cards.tm-jira-backlog-view .tm-backlog-settings-trigger:focus{
    color:#172b4d;
}

body.tm-feature-simplify-backlog-cards.tm-jira-backlog-view .tm-backlog-simplified-card .tm-backlog-hidden-source,
body.tm-feature-simplify-backlog-cards.tm-jira-backlog-view .tm-backlog-simplified-card .tm-backlog-hidden-separator,
body.tm-feature-simplify-backlog-cards.tm-jira-backlog-view .tm-backlog-simplified-card .tm-backlog-ready-source-field,
body.tm-feature-simplify-backlog-cards.tm-jira-backlog-view .tm-backlog-simplified-card .tm-backlog-ready-source-separator,
body.tm-feature-simplify-backlog-cards.tm-jira-backlog-view .tm-backlog-simplified-card.tm-backlog-has-ready-status .tm-backlog-fixed-version-label{
    display:none !important;
}

body.tm-feature-simplify-backlog-cards.tm-jira-backlog-view .tm-backlog-simplified-card .ghx-plan-extra-fields{
    display:none !important;
}

body.tm-feature-simplify-backlog-cards.tm-jira-backlog-view .tm-backlog-hover-overlay{
    position:absolute;
    left:8px;
    right:8px;
    top:calc(100% + 4px);
    z-index:20;
    display:none !important;
    padding:6px 8px;
    border:1px solid #dfe1e6;
    border-radius:6px;
    background:#ffffff;
    box-shadow:0 8px 16px rgba(9,30,66,.18);
    color:#172b4d;
    font-size:11px;
    line-height:1.35;
    pointer-events:none;
}

body.tm-feature-simplify-backlog-cards.tm-jira-backlog-view .tm-backlog-hover-overlay .ghx-plan-extra-fields{
    display:flex;
    align-items:center;
    flex-wrap:wrap;
    gap:4px 6px;
}

body.tm-feature-simplify-backlog-cards.tm-jira-backlog-view .tm-backlog-hover-overlay .tm-backlog-hover-fixed-version{
    display:inline-flex;
    margin-bottom:4px;
}

body.tm-feature-simplify-backlog-cards.tm-jira-backlog-view .tm-backlog-hover-overlay .ghx-plan-extra-fields:empty,
body.tm-feature-simplify-backlog-cards.tm-jira-backlog-view .tm-backlog-hover-overlay:empty{
    display:none;
}

.tm-settings-button{
    position:relative;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    width:auto;
    min-height:30px;
    padding:0 4px;
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

.tm-settings-button.tm-settings-button--update-available{
    color:#c9372c;
}

.tm-settings-button.tm-settings-button--update-available::after{
    content:"";
    position:absolute;
    top:1px;
    right:1px;
    width:7px;
    height:7px;
    border-radius:999px;
    background:#c9372c;
    box-shadow:0 0 0 2px #ffffff;
}

.tm-settings-button.tm-settings-button--update-available:hover{
    color:#ae2e24;
}

.tm-settings-button:focus{
    outline:none;
}

.tm-settings-button:focus-visible{
    outline:2px solid #4c9aff;
    outline-offset:2px;
}

.tm-settings-button .aui-icon{
    margin:0;
    display:block;
    color:inherit;
}

body.tm-settings-modal-open{
    overflow:hidden !important;
}

body.tm-feature-backlog-search.tm-jira-backlog-view #ghx-backlog-search,
body.tm-feature-backlog-search.tm-jira-backlog-view form#ghx-backlog-search{
    display:none !important;
}

.tm-settings-backdrop{
    position:fixed;
    inset:0;
    z-index:9998;
    background:rgba(9,30,66,.18);
    backdrop-filter:blur(6px);
    -webkit-backdrop-filter:blur(6px);
}

.tm-settings-backdrop[hidden]{
    display:none !important;
}

.tm-settings-panel{
    position:fixed;
    top:50%;
    right:auto;
    left:50%;
    z-index:9999;
    width:min(460px, calc(100vw - 24px));
    max-width:calc(100vw - 24px);
    max-height:min(calc(100vh - 24px), 720px);
    display:flex;
    flex-direction:column;
    overflow:hidden;
    padding:14px;
    border:1px solid #dfe1e6;
    border-radius:10px;
    background:#ffffff;
    box-shadow:0 8px 24px rgba(9,30,66,.25);
    color:#172b4d;
    box-sizing:border-box;
    transform:translate(-50%, -50%);
    scrollbar-gutter:stable;
}

.tm-settings-panel[hidden]{
    display:none !important;
}

.tm-settings-title{
    margin:0 0 10px;
    font-size:13px;
    font-weight:700;
}

.tm-settings-scroll-area{
    flex:1 1 auto;
    min-height:0;
    overflow-y:auto;
    overflow-x:hidden;
    overscroll-behavior:contain;
    padding-right:4px;
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

.tm-settings-option-label{
    display:inline-flex;
    justify-self:start;
    cursor:pointer;
}

.tm-settings-label-row{
    display:inline-flex;
    align-items:center;
    gap:6px;
    flex-wrap:wrap;
}

.tm-settings-label{
    display:block;
    font-size:12px;
    font-weight:600;
    color:#172b4d;
}

.tm-settings-section{
    margin-top:10px;
    padding-top:8px;
    border-top:1px solid #dfe1e6;
}

.tm-settings-section-title{
    margin:0 0 6px;
    font-size:12px;
    font-weight:700;
    color:#172b4d;
}

.tm-settings-color-grid{
    display:grid;
    gap:4px;
}

.tm-settings-color-option{
    display:grid;
    grid-template-columns:max-content max-content;
    justify-content:start;
    column-gap:10px;
    align-items:center;
}

.tm-settings-color-label{
    display:inline-flex;
    align-items:center;
    justify-self:start;
    font-size:12px;
    font-weight:600;
    color:#172b4d;
    cursor:pointer;
}

.tm-settings-color-input{
    justify-self:start;
    width:34px;
    height:24px;
    padding:0;
    border:1px solid #dfe1e6;
    border-radius:6px;
    background:#ffffff;
    cursor:pointer;
}

.tm-settings-footer{
    flex:0 0 auto;
    margin-top:10px;
    padding-top:10px;
    border-top:1px solid #dfe1e6;
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

.tm-settings-footer .tm-settings-actions{
    margin-top:0;
    padding-top:0;
    border-top:none;
}

.tm-settings-action-group{
    display:flex;
    flex-wrap:wrap;
    gap:8px;
}

.tm-settings-action-button{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    padding:5px 10px;
    border:1px solid #dfe1e6;
    border-radius:6px;
    background:#ffffff;
    color:#172b4d;
    cursor:pointer;
    font-size:12px;
    font-weight:600;
    text-decoration:none;
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

.tm-settings-repo-button{
    color:#24292f;
    border-color:#d0d7de;
    background:#f6f8fa;
}

.tm-settings-repo-button:hover{
    background:#eef2f6;
    border-color:#afb8c1;
}

.tm-settings-meta{
    display:flex;
    flex-wrap:wrap;
    gap:6px 10px;
    margin-top:12px;
    padding-top:10px;
    border-top:1px solid #dfe1e6;
    font-size:11px;
    line-height:1.35;
    color:#5e6c84;
}

.tm-settings-meta strong{
    color:#172b4d;
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
`);

/* ========================= */

const cache = new Map();
const inflight = new Set();
const sprintCache = new Map();
const sprintInflight = new Map();
let applyTimer = 0;
let isApplying = false;
let boardObserver = null;
let observerStarted = false;
let hooksInstalled = false;
let lastBoardRouteKey = "";
let boardRefreshPending = false;
let observerIgnoreUntil = 0;
let featureSettings = loadFeatureSettings();
let settingsUiInstalled = false;
let settingsPanelOpen = false;
let settingsUiTimer = 0;
let settingsPanelIdCounter = 0;
let backlogOriginalPositionIdCounter = 0;
let focusShortcutInstalled = false;
const FOCUS_MODE_OFF = 0;
const FOCUS_MODE_PARTIAL = 1;
const FOCUS_MODE_FULL = 2;
let focusMode = FOCUS_MODE_OFF;
let lastFocusPanelWidth = 400;
let currentUserInfo = null;
let currentUserInfoPromise = null;
let lastHighlightDiagnosticKey = "";
let userConfig = loadUserConfig();
let backlogSearchQuery = "";

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
        || document.querySelector(".ghx-backlog, .ghx-backlog-container, .ghx-plan")
        || null;
}

function getBoardEnhancementScope(){

    return getIssueCollectionRoot() || document;
}

function isStandaloneIssuePage(href = location.href){

    const url = new URL(href, location.origin);
    return /\/browse\/[^/?#]+$/i.test(url.pathname);
}

function hasBoardEnhancementContext(href = location.href){

    if(isRapidBoardPage(href)) return true;
    if(isStandaloneIssuePage(href)) return false;

    return Boolean(getIssueCollectionRoot());
}

function hasVisibleJiraIssues(){

    return Boolean(document.querySelector(
        "#ghx-pool [data-issue-key], #ghx-plan [data-issue-key], #ghx-backlog [data-issue-key], .ghx-backlog [data-issue-key], .ghx-backlog-container [data-issue-key], .ghx-swimlane-header[data-issue-key]"
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

function normalizeHexColor(value, fallback = ""){

    const normalized = String(value || "").trim();
    const shortMatch = normalized.match(/^#([0-9a-f]{3})$/i);

    if(shortMatch){
        const [red, green, blue] = shortMatch[1].split("");
        return `#${red}${red}${green}${green}${blue}${blue}`.toLowerCase();
    }

    const longMatch = normalized.match(/^#([0-9a-f]{6})$/i);

    if(longMatch){
        return `#${longMatch[1]}`.toLowerCase();
    }

    return fallback;
}

function clampColorChannel(value){

    return Math.max(0, Math.min(255, Math.round(Number(value) || 0)));
}

function parseHexColor(value){

    const normalized = normalizeHexColor(value);

    if(!normalized) return null;

    return {
        red: parseInt(normalized.slice(1, 3), 16),
        green: parseInt(normalized.slice(3, 5), 16),
        blue: parseInt(normalized.slice(5, 7), 16)
    };
}

function formatHexColor({ red, green, blue }){

    return `#${[red, green, blue]
        .map(channel => clampColorChannel(channel).toString(16).padStart(2, "0"))
        .join("")}`;
}

function shiftHexColor(value, amount = 0){

    const color = parseHexColor(value);
    const ratio = Math.max(-1, Math.min(1, Number(amount) || 0));

    if(!color){
        return normalizeHexColor(value, "#000000");
    }

    const adjustChannel = channel => ratio >= 0
        ? channel + (255 - channel) * ratio
        : channel * (1 + ratio);

    return formatHexColor({
        red: adjustChannel(color.red),
        green: adjustChannel(color.green),
        blue: adjustChannel(color.blue)
    });
}

function getIssueBadgeColorSetting(key){

    return normalizeHexColor(featureSettings?.[key], ISSUE_BADGE_COLOR_DEFAULTS[key])
        || ISSUE_BADGE_COLOR_DEFAULTS[key];
}

function getIssueBadgePalette(){

    const resolvedBackgroundColor = getIssueBadgeColorSetting("resolvedIssueBadgeBackgroundColor");
    const resolvedTextColor = getIssueBadgeColorSetting("resolvedIssueBadgeTextColor");

    return {
        issueBadgeBackgroundColor: getIssueBadgeColorSetting("issueBadgeBackgroundColor"),
        issueBadgeTextColor: getIssueBadgeColorSetting("issueBadgeTextColor"),
        resolvedIssueBadgeBackgroundColor: resolvedBackgroundColor,
        resolvedIssueBadgeTextColor: resolvedTextColor,
        resolvedIssueBadgeHoverBackgroundColor: shiftHexColor(resolvedBackgroundColor, -0.12),
        resolvedIssueBadgeHoverTextColor: shiftHexColor(resolvedTextColor, -0.18)
    };
}

function applyIssueBadgeColorVariables(){

    const root = document.documentElement;

    if(!root) return;

    const palette = getIssueBadgePalette();

    root.style.setProperty("--tm-issue-badge-bg", palette.issueBadgeBackgroundColor);
    root.style.setProperty("--tm-issue-badge-text", palette.issueBadgeTextColor);
    root.style.setProperty("--tm-resolved-issue-badge-bg", palette.resolvedIssueBadgeBackgroundColor);
    root.style.setProperty("--tm-resolved-issue-badge-text", palette.resolvedIssueBadgeTextColor);
    root.style.setProperty("--tm-resolved-issue-badge-hover-bg", palette.resolvedIssueBadgeHoverBackgroundColor);
    root.style.setProperty("--tm-resolved-issue-badge-hover-text", palette.resolvedIssueBadgeHoverTextColor);
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

function setAssigneeTooltip(target, fullName){

    if(!target?.isConnected || !fullName) return;

    const tooltip = `Assignee: ${fullName}`;

    target.setAttribute("title", tooltip);

    if(target.matches?.(".ghx-avatar-img, .ghx-auto-avatar")){
        target.setAttribute("aria-label", tooltip);
    }
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

    const isFocusActive = focusMode !== FOCUS_MODE_OFF;
    const isFullFocus = focusMode === FOCUS_MODE_FULL;

    document.body?.classList.toggle("tm-focus-mode", isFocusActive);
    document.body?.classList.toggle("tm-focus-mode-full", isFullFocus);

    const panel = getBoardPanel();

    if(panel && isFullFocus){
        panel.style.width = "0px";
    }else if(panel && panel.style.width === "0px"){
        panel.style.width = `${lastFocusPanelWidth}px`;
    }

    unlockFocusResize();
}

function setFocusMode(nextFocusMode){

    const normalizedFocusMode = Math.max(FOCUS_MODE_OFF, Math.min(FOCUS_MODE_FULL, Number(nextFocusMode) || FOCUS_MODE_OFF));
    const previousFocusMode = focusMode;
    const panel = getBoardPanel();

    if(previousFocusMode !== FOCUS_MODE_FULL && normalizedFocusMode === FOCUS_MODE_FULL && panel){
        lastFocusPanelWidth = panel.offsetWidth || lastFocusPanelWidth;
    }

    focusMode = normalizedFocusMode;
    syncFocusModeState();

    if(previousFocusMode !== FOCUS_MODE_OFF && normalizedFocusMode === FOCUS_MODE_OFF && panel){
        panel.style.width = `${lastFocusPanelWidth}px`;
    }

    if(Boolean(previousFocusMode) !== Boolean(normalizedFocusMode)){
        toggleBoardHeader();
    }
}

function toggleBoardHeader(){

    const button = document.querySelector(".ghx-compact-toggle.js-compact-toggle");

    if(button && isRapidBoardPage()){
        button.click();
    }
}

function toggleFocusMode(){

    const nextFocusMode = focusMode === FOCUS_MODE_OFF
        ? FOCUS_MODE_PARTIAL
        : focusMode === FOCUS_MODE_PARTIAL
            ? FOCUS_MODE_FULL
            : FOCUS_MODE_OFF;

    setFocusMode(nextFocusMode);
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

function applyAssigneeEnhancements(scope = getBoardEnhancementScope()){

    const shouldShowLabels = isFeatureEnabled("showAssigneeNames") && isBoardViewActive();

    scope.querySelectorAll(".ghx-avatar-img, .ghx-auto-avatar").forEach(avatar=>{

        const fullName = extractAssigneeName(avatar);
        if(!fullName) return;

        avatar.dataset.tmAssigneeFullName = fullName;
        setAssigneeTooltip(avatar, fullName);

        const wrappedAvatar = avatar.closest(".ghx-avatar");

        if(wrappedAvatar){
            wrappedAvatar.dataset.tmAssigneeFullName = fullName;
            setAssigneeTooltip(wrappedAvatar, fullName);
        }

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

function highlightCurrentUserIssueCards(scope = getBoardEnhancementScope()){

    const fallbackUser = {
        displayName: getCurrentUserDisplayName(),
        avatarUrl: document.querySelector("#header-details-user-avatar img, #header-details-user-avatar, .aui-header .aui-avatar img, .aui-header .aui-avatar")?.getAttribute?.("src") || ""
    };
    const seenCards = new Set();
    let highlightCount = 0;

    scope.querySelectorAll(".ghx-parent-group.tm-highlight-card, .js-fake-parent.tm-highlight-card, .ghx-subtask-group.tm-highlight-card").forEach(node=>{
        node.classList.remove("tm-highlight-card");
    });

    scope.querySelectorAll(".ghx-avatar-img, .ghx-auto-avatar").forEach(avatar=>{

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

    scope.querySelectorAll(".ghx-issue.tm-highlight-card, .js-issue.tm-highlight-card").forEach(node=>{

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

function getActiveSettingsBackdrop(preferredSlot = null){

    return getActiveSettingsSlot(preferredSlot)?.querySelector(".tm-settings-backdrop") || null;
}

function normalizeBacklogSearchTerm(value){

    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function parseBacklogSearchTerms(value){

    const query = String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    const terms = [];
    let index = 0;

    while(index < query.length){
        while(index < query.length && /\s/.test(query[index])){
            index += 1;
        }

        if(index >= query.length) break;

        let exclude = false;

        if(query[index] === "!"){
            exclude = true;
            index += 1;

            while(index < query.length && /\s/.test(query[index])){
                index += 1;
            }
        }

        if(index >= query.length) break;

        let term = "";

        if(query[index] === '"'){
            index += 1;
            const startIndex = index;

            while(index < query.length && query[index] !== '"'){
                index += 1;
            }

            term = query.slice(startIndex, index);

            if(index < query.length && query[index] === '"'){
                index += 1;
            }
        }else{
            const startIndex = index;

            while(index < query.length && !/\s/.test(query[index])){
                index += 1;
            }

            term = query.slice(startIndex, index);
        }

        const normalizedTerm = normalizeBacklogSearchTerm(term);

        if(normalizedTerm){
            terms.push({ value: normalizedTerm, exclude });
        }
    }

    return terms;
}

function doesBacklogSearchTextMatch(text, terms){

    if(!terms.length) return true;

    const normalizedText = normalizeBacklogSearchTerm(text);

    return terms.every(term =>
        term.exclude
            ? !normalizedText.includes(term.value)
            : normalizedText.includes(term.value)
    );
}

function getBacklogIssueCards(scope = getBoardEnhancementScope()){

    const cards = new Set();

    scope.querySelectorAll(
        ".ghx-backlog-container .ghx-issue[data-issue-key], .ghx-backlog-container .js-issue[data-issue-key], #ghx-plan .ghx-issue[data-issue-key], #ghx-plan .js-issue[data-issue-key], #ghx-backlog .ghx-issue[data-issue-key], #ghx-backlog .js-issue[data-issue-key], .ghx-backlog .ghx-issue[data-issue-key], .ghx-backlog .js-issue[data-issue-key]"
    ).forEach(node=>{

        const card = node.closest(".ghx-issue[data-issue-key], .js-issue[data-issue-key]") || node;

        if(card?.isConnected){
            cards.add(card);
        }
    });

    return [...cards];
}

function restoreMovedBacklogNodes(scope = document){

    scope.querySelectorAll(".tm-backlog-moved-node").forEach(node=>{

        const placeholderId = node.dataset.tmBacklogPlaceholderId;
        const placeholder = placeholderId
            ? scope.querySelector(`.tm-backlog-original-placeholder[data-tm-backlog-placeholder-id="${placeholderId}"]`)
                || document.querySelector(`.tm-backlog-original-placeholder[data-tm-backlog-placeholder-id="${placeholderId}"]`)
            : null;

        if(placeholder?.parentNode){
            placeholder.parentNode.insertBefore(node, placeholder);
            placeholder.remove();
        }

        node.classList.remove("tm-backlog-moved-node");
        delete node.dataset.tmBacklogPlaceholderId;
    });

    scope.querySelectorAll(".tm-backlog-original-placeholder").forEach(node=>{
        node.remove();
    });

    scope.querySelectorAll(".tm-backlog-right-meta").forEach(node=>{
        node.remove();
    });
}

function suppressBacklogVisibleTitles(root){

    if(!root?.isConnected) return;

    const nodes = [];

    if(root.matches?.("[title]")){
        nodes.push(root);
    }

    root.querySelectorAll?.("[title]").forEach(node=>{
        nodes.push(node);
    });

    nodes.forEach(node=>{

        if(node.dataset.tmBacklogOriginalTitle == null){
            node.dataset.tmBacklogOriginalTitle = node.getAttribute("title") || "";
        }

        node.removeAttribute("title");
    });
}

function restoreBacklogVisibleTitles(scope = document){

    scope.querySelectorAll("[data-tm-backlog-original-title]").forEach(node=>{

        node.setAttribute("title", node.dataset.tmBacklogOriginalTitle || "");
        delete node.dataset.tmBacklogOriginalTitle;
    });
}

function ensureBacklogAssigneeTooltip(node){

    if(!node?.isConnected) return;

    const assigneeNode = node.matches?.(".ghx-avatar, .ghx-avatar-img, .ghx-auto-avatar")
        ? node
        : node.querySelector?.(".ghx-avatar, .ghx-avatar-img, .ghx-auto-avatar");
    const tooltipSource = assigneeNode?.matches?.(".ghx-avatar-img, .ghx-auto-avatar")
        ? assigneeNode
        : assigneeNode?.querySelector?.(".ghx-avatar-img, .ghx-auto-avatar");
    const fullName = assigneeNode?.dataset.tmAssigneeFullName
        || tooltipSource?.dataset.tmAssigneeFullName
        || extractAssigneeName(tooltipSource)
        || extractAssigneeName(assigneeNode);

    if(!fullName) return;

    if(assigneeNode){
        assigneeNode.dataset.tmAssigneeFullName = fullName;
        setAssigneeTooltip(assigneeNode, fullName);
    }

    if(tooltipSource && tooltipSource !== assigneeNode){
        tooltipSource.dataset.tmAssigneeFullName = fullName;
        setAssigneeTooltip(tooltipSource, fullName);
    }
}

function getBacklogSearchText(root){

    if(!root?.isConnected) return "";

    const values = [];
    const seen = new Set();
    const addValue = value=>{

        const normalizedValue = String(value || "")
            .replace(/\s+/g, " ")
            .trim();

        if(!normalizedValue || seen.has(normalizedValue)) return;

        seen.add(normalizedValue);
        values.push(normalizedValue);
    };

    addValue(root.textContent);
    addValue(root.getAttribute?.("title"));
    addValue(root.getAttribute?.("aria-label"));
    addValue(root.getAttribute?.("alt"));
    addValue(root.dataset?.tmAssigneeFullName);

    root.querySelectorAll?.("[title], [aria-label], [alt], [data-tm-assignee-full-name]").forEach(node=>{
        addValue(node.getAttribute("title"));
        addValue(node.getAttribute("aria-label"));
        addValue(node.getAttribute("alt"));
        addValue(node.dataset?.tmAssigneeFullName);
    });

    return normalizeBacklogSearchTerm(values.join(" "));
}

function moveBacklogNodeToRightMeta(node, container, beforeNode = null){

    if(!node?.isConnected || !container?.isConnected || node === container || container.contains(node)) return;
    if(!node.parentNode) return;

    if(!node.dataset.tmBacklogPlaceholderId){
        backlogOriginalPositionIdCounter += 1;

        const placeholder = document.createElement("span");
        const placeholderId = `tm-backlog-placeholder-${backlogOriginalPositionIdCounter}`;

        placeholder.hidden = true;
        placeholder.className = "tm-backlog-original-placeholder";
        placeholder.dataset.tmBacklogPlaceholderId = placeholderId;
        node.parentNode.insertBefore(placeholder, node);
        node.dataset.tmBacklogPlaceholderId = placeholderId;
    }

    node.classList.add("tm-backlog-moved-node");

    if(beforeNode?.parentNode === container){
        container.insertBefore(node, beforeNode);
    }else{
        container.appendChild(node);
    }
}

function getBacklogEpicNode(keyRow, fixedVersionLabel, extraFieldNodes){

    const extraEpicNode = extraFieldNodes.find(node =>
        node.querySelector(".aui-label, .ghx-label, [data-fieldname*='epic' i], [title*='epic' i], [aria-label*='epic' i]")
    );

    if(extraEpicNode) return extraEpicNode;

    return [...(keyRow?.querySelectorAll(".aui-label, .ghx-label") || [])].find(label =>
        label !== fixedVersionLabel
    ) || null;
}

function getBacklogActionTrigger(card){

    const actionCandidate = card.querySelector(
        ".ghx-issue-content button[aria-label*='more' i], .ghx-issue-content a[aria-label*='more' i], .ghx-issue-content button[title*='more' i], .ghx-issue-content a[title*='more' i], .ghx-issue-content .js-issue-actions, .ghx-issue-content .ghx-actions, .ghx-issue-content .ghx-extra-actions, .ghx-issue-content .aui-iconfont-more"
    );

    return actionCandidate?.closest("button, a") || actionCandidate || null;
}

function getBacklogAssigneeNode(card, estimateNode = null){

    const wrappedAvatar = card.querySelector(".ghx-issue-content .ghx-avatar");

    if(wrappedAvatar?.isConnected){
        return wrappedAvatar;
    }

    const assigneeLeaf = card.querySelector(
        ".ghx-issue-content .ghx-avatar-img, .ghx-issue-content .ghx-auto-avatar, .ghx-issue-content [data-tooltip*='assignee' i], .ghx-issue-content [aria-label*='assignee' i]"
    );

    if(!assigneeLeaf?.isConnected) return null;

    if(estimateNode?.contains(assigneeLeaf)){
        return assigneeLeaf;
    }

    return assigneeLeaf.closest(".ghx-avatar") || assigneeLeaf;
}

function decorateBacklogActionTrigger(node){

    if(!node?.isConnected) return null;

    const trigger = node.closest("button, a") || node;
    trigger.classList.add("tm-backlog-settings-trigger");
    return trigger;
}

function getBacklogRightMetaNodes(card, keyRow, fixedVersionLabel, extraFieldNodes, estimateNode = null){

    const nodes = [];
    const seen = new Set();
    const summaryNode = keyRow?.querySelector(".ghx-summary");
    const addNode = candidate=>{

        if(!candidate?.isConnected || candidate === fixedVersionLabel || candidate === summaryNode) return;

        const node = candidate.closest(".ghx-extra-field, .ghx-avatar, button, a") || candidate;

        if(!node?.isConnected || node === fixedVersionLabel || node === summaryNode || node === estimateNode || seen.has(node)) return;

        seen.add(node);
        nodes.push(node);
    };

    addNode(getBacklogEpicNode(keyRow, fixedVersionLabel, extraFieldNodes));

    addNode(getBacklogAssigneeNode(card, estimateNode));

    addNode(decorateBacklogActionTrigger(getBacklogActionTrigger(card)));

    return nodes;
}

function resetBacklogCardSimplification(scope = document){

    getBacklogIssueCards(scope).forEach(card=>{

        restoreMovedBacklogNodes(card);
        restoreBacklogVisibleTitles(card);
        card.querySelectorAll(".tm-backlog-settings-trigger").forEach(node=>{
            node.classList.remove("tm-backlog-settings-trigger");
        });

        card.classList.remove(
            "tm-backlog-simplified-card",
            "tm-backlog-has-ready-status",
            "tm-backlog-has-extra-details",
            "tm-backlog-has-fixed-version-label",
            "tm-backlog-has-hover-details"
        );
        card.querySelector(".tm-backlog-ready-inline")?.remove();
        card.querySelector(".tm-backlog-hover-overlay")?.remove();
        card.querySelector(".tm-backlog-simplified-row")?.classList.remove("tm-backlog-simplified-row");
        card.querySelector(".tm-backlog-fixed-version-label")?.classList.remove("tm-backlog-fixed-version-label");
        card.querySelectorAll(".tm-backlog-hidden-source").forEach(node=>{
            node.classList.remove("tm-backlog-hidden-source");
        });
        card.querySelectorAll(".tm-backlog-hidden-separator").forEach(node=>{
            node.classList.remove("tm-backlog-hidden-separator");
        });
        card.querySelectorAll(".tm-backlog-ready-source-field").forEach(node=>{
            node.classList.remove("tm-backlog-ready-source-field");
        });
        card.querySelectorAll(".tm-backlog-ready-source-separator").forEach(node=>{
            node.classList.remove("tm-backlog-ready-source-separator");
        });
    });
}

function syncBacklogCardSimplification(scope = getBoardEnhancementScope()){

    if(!isBacklogViewActive()) return;

    getBacklogIssueCards(scope).forEach(card=>{

        restoreMovedBacklogNodes(card);

        const keyRow = card.querySelector(".ghx-issue-content .ghx-row.tm-issue-key-layout, .ghx-issue-content .ghx-row");
        const summaryNode = keyRow?.querySelector(".ghx-summary") || null;
        const estimate = card.querySelector(".ghx-issue-content .ghx-end.ghx-estimate, .ghx-issue-content .ghx-estimate") || null;
        const keyNode = keyRow?.querySelector(".ghx-key");
        const fixedVersionLabel = keyRow?.querySelector(".ghx-label-0");
        const extraFields = card.querySelector(".ghx-plan-extra-fields");
        const extraFieldNodes = extraFields
            ? [...extraFields.querySelectorAll(":scope > .ghx-extra-field")]
            : [];
        const readyField = extraFieldNodes[0] || null;
        const readyContent = readyField?.querySelector(".ghx-extra-field-content");
        const readyText = String(readyContent?.textContent || "")
            .replace(/\s+/g, " ")
            .trim();
        const readySeparator = readyField?.nextElementSibling?.classList.contains("ghx-extra-field-seperator")
            ? readyField.nextElementSibling
            : null;
        const remainingFields = extraFieldNodes.filter(node => node !== readyField);
        const detailSeparators = extraFields
            ? [...extraFields.querySelectorAll(":scope > .ghx-extra-field-seperator")]
            : [];

        if(!keyRow) return;

        card.classList.add("tm-backlog-simplified-card");
        card.classList.toggle("tm-backlog-has-extra-details", Boolean(remainingFields.length));
        card.classList.toggle("tm-backlog-has-fixed-version-label", Boolean(fixedVersionLabel));
        keyRow.classList.add("tm-backlog-simplified-row");
        fixedVersionLabel?.classList.add("tm-backlog-fixed-version-label");
        card.querySelectorAll(".tm-backlog-hidden-source").forEach(node=>{
            node.classList.remove("tm-backlog-hidden-source");
        });
        card.querySelectorAll(".tm-backlog-hidden-separator").forEach(node=>{
            node.classList.remove("tm-backlog-hidden-separator");
        });
        extraFields?.querySelectorAll(".tm-backlog-ready-source-field").forEach(node=>{
            node.classList.remove("tm-backlog-ready-source-field");
        });
        extraFields?.querySelectorAll(".tm-backlog-ready-source-separator").forEach(node=>{
            node.classList.remove("tm-backlog-ready-source-separator");
        });
        extraFieldNodes.forEach(node=>{
            node.classList.add("tm-backlog-hidden-source");
        });
        detailSeparators.forEach(node=>{
            node.classList.add("tm-backlog-hidden-separator");
        });

        let readyInline = keyRow?.querySelector(".tm-backlog-ready-inline") || null;

        if(readyText && keyRow){
            if(!readyInline){
                readyInline = document.createElement("span");
                readyInline.className = "tm-backlog-ready-inline";
            }

            readyInline.replaceChildren();

            if(readyContent){
                readyInline.appendChild(readyContent.cloneNode(true));
            }else{
                readyInline.textContent = readyText;
            }

            readyInline.title = readyText;
            suppressBacklogVisibleTitles(readyInline);

            if(estimate?.parentNode === keyRow){
                keyRow.insertBefore(readyInline, estimate.nextSibling);
            }else if(keyNode?.parentNode === keyRow){
                keyRow.insertBefore(readyInline, keyNode.nextSibling);
            }else{
                keyRow.appendChild(readyInline);
            }

            card.classList.add("tm-backlog-has-ready-status");
            readyField?.classList.add("tm-backlog-ready-source-field");
            readySeparator?.classList.add("tm-backlog-ready-source-separator");
        }else{
            readyInline?.remove();
            card.classList.remove("tm-backlog-has-ready-status");
        }

        if(estimate && keyNode?.parentNode === keyRow){
            const estimateReference = readyInline?.parentNode === keyRow
                ? readyInline
                : summaryNode?.parentNode === keyRow
                    ? summaryNode
                    : null;

            moveBacklogNodeToRightMeta(estimate, keyRow, estimateReference);
        }

        const rightMetaNodes = getBacklogRightMetaNodes(card, keyRow, fixedVersionLabel, extraFieldNodes, estimate);

        if(rightMetaNodes.length){
            const rightMeta = document.createElement("span");
            rightMeta.className = "tm-backlog-right-meta";
            keyRow.appendChild(rightMeta);
            rightMetaNodes.forEach(node=>{
                if(node.matches?.(".ghx-avatar, .ghx-avatar-img, .ghx-auto-avatar") || node.querySelector?.(".ghx-avatar, .ghx-avatar-img, .ghx-auto-avatar")){
                    ensureBacklogAssigneeTooltip(node);
                }else{
                    suppressBacklogVisibleTitles(node);
                }
                moveBacklogNodeToRightMeta(node, rightMeta);
            });
        }

        suppressBacklogVisibleTitles(summaryNode);

        card.querySelector(".tm-backlog-hover-overlay")?.remove();
        card.classList.remove("tm-backlog-has-hover-details");
    });
}

function hasBacklogSearchQuery(){

    return isFeatureEnabled("enableBacklogSearch") && parseBacklogSearchTerms(backlogSearchQuery).length > 0;
}

function getBacklogSearchSlots(){

    return [...document.querySelectorAll(".tm-backlog-search-slot")];
}

function syncBacklogSearchInputs(){

    getBacklogSearchSlots().forEach(slot=>{

        const input = slot.querySelector(".tm-backlog-search-input");

        if(input && input.value !== backlogSearchQuery){
            input.value = backlogSearchQuery;
        }
    });
}

function clearBacklogSearchFiltering(scope = document){

    scope.querySelectorAll(".tm-backlog-search-hidden").forEach(node=>{
        node.classList.remove("tm-backlog-search-hidden");
    });

    scope.querySelectorAll(".tm-backlog-search-empty").forEach(node=>{
        node.classList.remove("tm-backlog-search-empty");
    });
}

function getBacklogSearchableRoots(scope = getBoardEnhancementScope()){

    const roots = new Set();

    scope.querySelectorAll(".ghx-issue[data-issue-key], .js-issue[data-issue-key], .ghx-swimlane-header[data-issue-key]").forEach(node=>{

        const root = node.closest(".ghx-parent-group, .js-fake-parent")
            || node.closest(".ghx-issue[data-issue-key], .js-issue[data-issue-key]")
            || node.closest(".ghx-swimlane")
            || node;

        if(root?.isConnected){
            roots.add(root);
        }
    });

    return [...roots].filter(root=>
        root.closest(".ghx-backlog-container, #ghx-plan, #ghx-backlog, .ghx-backlog")
    );
}

function syncBacklogContainerSearchState(scope, searchableRoots){

    scope.querySelectorAll(".ghx-backlog-container").forEach(container=>{

        const matchingRoots = searchableRoots.filter(root=>
            container.contains(root) && !root.classList.contains("tm-backlog-search-hidden")
        );
        const hasSearchableIssues = searchableRoots.some(root=> container.contains(root));

        container.classList.toggle(
            "tm-backlog-search-empty",
            hasBacklogSearchQuery() && hasSearchableIssues && !matchingRoots.length
        );

        syncDefaultBacklogIssueCount(container);
    });
}

function applyBacklogSearchFilter(scope = getBoardEnhancementScope()){

    clearBacklogSearchFiltering(scope);

    if(!isBacklogViewActive() || !hasBoardEnhancementContext() || !isFeatureEnabled("enableBacklogSearch")){
        return;
    }

    const searchTerms = parseBacklogSearchTerms(backlogSearchQuery);
    const searchableRoots = getBacklogSearchableRoots(scope);

    searchableRoots.forEach(root=>{

        root.dataset.tmBacklogSearchText = getBacklogSearchText(root);

        const matches = doesBacklogSearchTextMatch(root.dataset.tmBacklogSearchText, searchTerms);
        root.classList.toggle("tm-backlog-search-hidden", !matches);
    });

    syncBacklogContainerSearchState(scope, searchableRoots);
}

function handleBacklogSearchInput(event){

    backlogSearchQuery = event.currentTarget?.value || "";
    syncBacklogSearchInputs();
    applyBacklogSearchFilter();
}

function createQuickFiltersSlot(container, className){

    const slotTagName = container.tagName === "UL" || container.tagName === "OL"
        ? "li"
        : container.tagName === "DL"
            ? "dd"
            : "span";
    const slot = document.createElement(slotTagName);

    slot.className = `${className} ghx-quickfilter`;

    return slot;
}

function positionSettingsPanel(preferredSlot = null){

    const panel = getActiveSettingsPanel(preferredSlot);

    if(!panel) return;

    panel.style.left = "";
    panel.style.top = "";
    panel.style.transform = "";
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
            simplifyBacklogCards: typeof parsed?.simplifyBacklogCards === "boolean"
                ? parsed.simplifyBacklogCards
                : FEATURE_DEFAULTS.simplifyBacklogCards,
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
            enableBacklogSearch: typeof parsed?.enableBacklogSearch === "boolean"
                ? parsed.enableBacklogSearch
                : FEATURE_DEFAULTS.enableBacklogSearch,
            sortSwimlanes: typeof parsed?.sortSwimlanes === "boolean"
                ? parsed.sortSwimlanes
                : FEATURE_DEFAULTS.sortSwimlanes,
            sortDoneSubtasks: typeof parsed?.sortDoneSubtasks === "boolean"
                ? parsed.sortDoneSubtasks
                : FEATURE_DEFAULTS.sortDoneSubtasks,
            issueBadgeBackgroundColor: normalizeHexColor(parsed?.issueBadgeBackgroundColor, ISSUE_BADGE_COLOR_DEFAULTS.issueBadgeBackgroundColor),
            issueBadgeTextColor: normalizeHexColor(parsed?.issueBadgeTextColor, ISSUE_BADGE_COLOR_DEFAULTS.issueBadgeTextColor),
            resolvedIssueBadgeBackgroundColor: normalizeHexColor(parsed?.resolvedIssueBadgeBackgroundColor, ISSUE_BADGE_COLOR_DEFAULTS.resolvedIssueBadgeBackgroundColor),
            resolvedIssueBadgeTextColor: normalizeHexColor(parsed?.resolvedIssueBadgeTextColor, ISSUE_BADGE_COLOR_DEFAULTS.resolvedIssueBadgeTextColor)
        };
    }catch{
        return {
            ...FEATURE_DEFAULTS,
            ...ISSUE_BADGE_COLOR_DEFAULTS
        };
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
        "Reset Jira Board Suite settings to their first-run defaults? This clears feature preferences, issue badge colors, and the configured email domain, then reloads the page."
    );

    if(!confirmed) return;

    clearStoredSettings();
    featureSettings = {
        ...FEATURE_DEFAULTS,
        ...ISSUE_BADGE_COLOR_DEFAULTS
    };
    userConfig = {};
    currentUserInfo = null;
    currentUserInfoPromise = null;
    setFocusMode(FOCUS_MODE_OFF);
    closeSettingsPanel();
    applyImmediateFeatureState();

    window.setTimeout(()=>{
        window.location.reload();
    }, 80);
}

function isFeatureEnabled(key){

    return featureSettings[key] !== false;
}

function readLoaderUpdateStatus(){

    try{
        const parsed = JSON.parse(window.localStorage.getItem(LOADER_UPDATE_STATUS_KEY) || "{}");
        return parsed && typeof parsed === "object"
            ? parsed
            : {};
    }catch{
        return {};
    }
}

function hasLoaderUpdateAvailable(){

    return Boolean(readLoaderUpdateStatus().hasUpdates);
}

function readLoadedScriptsState(){

    try{
        const parsed = JSON.parse(window.localStorage.getItem(LOADER_LOADED_SCRIPTS_STATE_KEY) || "{}");
        return parsed && typeof parsed === "object"
            ? parsed
            : {};
    }catch{
        return {};
    }
}

function getLoadedJiraScriptInfo(){

    const loadedScripts = readLoadedScriptsState();

    return loadedScripts[SCRIPT_URL]
        || Object.values(loadedScripts).find(script => script?.name === "Jira Board Suite")
        || null;
}

function formatLoadedScriptDate(value){

    const timestamp = Number(value);

    if(!Number.isFinite(timestamp) || timestamp <= 0) return "unknown";

    return new Date(timestamp).toLocaleString();
}

function formatLoadedScriptHash(info){

    const sourceHash = String(info?.sourceHash || "").trim().toLowerCase();

    if(sourceHash){
        return sourceHash.slice(0, 8);
    }

    return "unknown";
}

function escapeHtml(value){

    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function renderLoadedScriptMeta(){

    const info = getLoadedJiraScriptInfo();
    const sourceHash = formatLoadedScriptHash(info);
    const sourceDate = info?.sourceStoredAt || info?.sourceFetchedAt || info?.loadedAt || 0;

    return `
        <div class="tm-settings-meta">
            <span><strong>Hash:</strong> ${sourceHash}</span>
            <span><strong>Date:</strong> ${formatLoadedScriptDate(sourceDate)}</span>
        </div>
    `;
}

function renderIssueBadgeColorSettings(panelIdPrefix = "tm-settings-panel"){

    return `
        <div class="tm-settings-section">
            <h4 class="tm-settings-section-title">Issue ID badge colors</h4>
            <div class="tm-settings-color-grid">
                ${ISSUE_BADGE_COLOR_FIELDS.map(field => {
                    const value = getIssueBadgeColorSetting(field.key);
                    const inputId = `${panelIdPrefix}-color-setting-${field.key}`;

                    return `
                        <div class="tm-settings-color-option">
                            <input
                                id="${inputId}"
                                type="color"
                                class="tm-settings-color-input"
                                data-tm-color-setting="${field.key}"
                                value="${value}"
                                title="${escapeHtml(field.description)}"
                                aria-label="${escapeHtml(`${field.label}: ${field.description}`)}"
                            >
                            <label class="tm-settings-color-label" for="${inputId}" title="${escapeHtml(field.description)}">${escapeHtml(field.label)}</label>
                        </div>
                    `;
                }).join("")}
            </div>
        </div>
    `;
}

function syncSettingsUpdateIndicator(){

    const hasUpdates = hasLoaderUpdateAvailable();

    document.querySelectorAll(".tm-settings-button").forEach(button=>{
        button.classList.toggle("tm-settings-button--update-available", hasUpdates);
        button.setAttribute(
            "aria-label",
            hasUpdates
                ? "Board tweak settings (update available)"
                : "Board tweak settings"
        );
        button.title = hasUpdates
            ? "Board tweak settings (update available)"
            : "Board tweak settings";
    });
}

function applyFeatureClasses(){

    applyIssueBadgeColorVariables();

    if(!document.body) return;

    const hasBoardContext = hasBoardEnhancementContext();

    document.body.classList.toggle("tm-feature-assignee-names", hasBoardContext && isFeatureEnabled("showAssigneeNames"));
    document.body.classList.toggle("tm-feature-optimize-issue-ids", hasBoardContext && isFeatureEnabled("optimizeIssueIds"));
    document.body.classList.toggle("tm-feature-backlog-search", hasBoardContext && isFeatureEnabled("enableBacklogSearch"));
    document.body.classList.toggle("tm-feature-simplify-backlog-cards", hasBoardContext && isFeatureEnabled("simplifyBacklogCards") && isBacklogViewActive());
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

    if(!hasBoardEnhancementContext()){
        closeSettingsPanel();
        clearBacklogSearchFiltering(document);
        resetBacklogCardSimplification(document);

        if(!isFeatureEnabled("enableFocusModeShortcut") && focusMode){
            setFocusMode(FOCUS_MODE_OFF);
        }else if(focusMode){
            syncFocusModeState();
        }

        return;
    }

    const enhancementScope = getBoardEnhancementScope();

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
        markSubtaskCards(enhancementScope);
    }

    if(!isFeatureEnabled("optimizeIssueIds")){
        restoreTrimmedParentKeys();
    }

    if(hasVisibleJiraIssues()){
        syncIssueFieldTypography(enhancementScope);

        if(isFeatureEnabled("simplifyBacklogCards") && isBacklogViewActive()){
            syncBacklogCardSimplification(enhancementScope);
        }else{
            resetBacklogCardSimplification(document);
        }

        enhanceDefaultBacklogSections(enhancementScope);
        applyAssigneeEnhancements(enhancementScope);
        highlightCurrentUserIssueCards(enhancementScope);
    }

    applyBacklogSearchFilter(enhancementScope);

    if(!isFeatureEnabled("enableFocusModeShortcut") && focusMode){
        setFocusMode(FOCUS_MODE_OFF);
    }else if(focusMode){
        syncFocusModeState();
    }
}

function getFeatureDefinition(key){

    return FEATURE_DEFINITIONS.find(feature => feature.key === key);
}

function closeSettingsPanel(){

    settingsPanelOpen = false;
    document.body?.classList.remove("tm-settings-modal-open");
    document.querySelectorAll(".tm-settings-backdrop").forEach(backdrop=>{
        backdrop.setAttribute("hidden", "hidden");
    });
    document.querySelectorAll(".tm-settings-panel").forEach(panel=>{
        panel.setAttribute("hidden", "hidden");
    });
    document.querySelectorAll(".tm-settings-button").forEach(button=>{
        button.setAttribute("aria-expanded", "false");
    });
}

function openSettingsPanel(preferredSlot = null){

    const panel = getActiveSettingsPanel(preferredSlot);
    const backdrop = getActiveSettingsBackdrop(preferredSlot);
    const button = getActiveSettingsButton(preferredSlot);

    if(!panel || !button) return;

    closeSettingsPanel();

    settingsPanelOpen = true;

    document.body?.classList.add("tm-settings-modal-open");
    backdrop?.removeAttribute("hidden");
    panel.removeAttribute("hidden");
    positionSettingsPanel(preferredSlot);
    button.setAttribute("aria-expanded", "true");
    panel.focus();
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

    if(!hasBoardEnhancementContext()) return null;

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

    if(!panel.dataset.tmSettingsPanelId){
        settingsPanelIdCounter += 1;
        panel.dataset.tmSettingsPanelId = String(settingsPanelIdCounter);
    }

    const panelIdPrefix = `tm-settings-panel-${panel.dataset.tmSettingsPanelId}`;

    panel.innerHTML = `
        <h3 class="tm-settings-title">Jira tweaks</h3>
        <div class="tm-settings-scroll-area">
            <div class="tm-settings-list">
                ${FEATURE_DEFINITIONS.map(feature => {
                    const inputId = `${panelIdPrefix}-setting-${feature.key}`;

                    return `
                        <div class="tm-settings-option">
                            <input id="${inputId}" type="checkbox" data-tm-setting="${feature.key}" ${isFeatureEnabled(feature.key) ? "checked" : ""}>
                            <label class="tm-settings-option-label" for="${inputId}" title="${escapeHtml(feature.description)}" aria-label="${escapeHtml(`${feature.label}: ${feature.description}`)}">
                                <span class="tm-settings-label-row">
                                    <span class="tm-settings-label">${escapeHtml(feature.label)}${feature.requiresReload ? '<span class="tm-settings-reload-chip">reload</span>' : ""}</span>
                                </span>
                            </label>
                        </div>
                    `;
                }).join("")}
            </div>
            ${renderIssueBadgeColorSettings(panelIdPrefix)}
        </div>
        <div class="tm-settings-footer">
            <div class="tm-settings-actions">
                <div class="tm-settings-action-group">
                    <button type="button" class="tm-settings-action-button tm-settings-update-button" data-tm-settings-update="true">Update now</button>
                    <a class="tm-settings-action-button tm-settings-repo-button" href="${REPOSITORY_URL}" target="_blank" rel="noopener noreferrer" data-tm-settings-repo="true">GitHub repo</a>
                </div>
                <div class="tm-settings-action-group">
                    <button type="button" class="tm-settings-action-button tm-settings-reset-button" data-tm-settings-reset="true">Reset settings</button>
                </div>
            </div>
            ${renderLoadedScriptMeta()}
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
            ensureSettingsUi();

            if(definition?.requiresReload){
                window.setTimeout(()=>{
                    window.location.reload();
                }, 80);
                return;
            }

            scheduleApply(0);
        });
    });

    panel.querySelectorAll("input[data-tm-color-setting]").forEach(input=>{

        const syncColorValue = () => {
            const key = input.dataset.tmColorSetting;
            const value = normalizeHexColor(input.value, ISSUE_BADGE_COLOR_DEFAULTS[key]) || ISSUE_BADGE_COLOR_DEFAULTS[key];

            if(input.value !== value){
                input.value = value;
            }

            return value;
        };

        syncColorValue();

        const handleColorChange = event => {
            const key = event.currentTarget.dataset.tmColorSetting;

            featureSettings[key] = syncColorValue();
            saveFeatureSettings();
            applyIssueBadgeColorVariables();
        };

        input.addEventListener("input", handleColorChange);
        input.addEventListener("change", handleColorChange);
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

    window.addEventListener("storage", event=>{
        if(event.key === LOADER_UPDATE_STATUS_KEY){
            syncSettingsUpdateIndicator();
        }

        if(event.key === LOADER_LOADED_SCRIPTS_STATE_KEY){
            const panel = getActiveSettingsPanel();

            if(panel){
                renderSettingsPanel(panel);
            }
        }
    });

    window.addEventListener(LOADER_UPDATE_STATUS_EVENT_NAME, ()=>{
        syncSettingsUpdateIndicator();
    });

    window.addEventListener(LOADER_LOADED_SCRIPTS_EVENT_NAME, ()=>{
        const panel = getActiveSettingsPanel();

        if(panel){
            renderSettingsPanel(panel);
        }
    });

}

function removeStaleSettingsSlots(container){

    getSettingsSlots().forEach(slot=>{
        if(slot.parentElement !== container){
            slot.remove();
        }
    });
}

function removeStaleBacklogSearchSlots(container){

    getBacklogSearchSlots().forEach(slot=>{
        if(slot.parentElement !== container || !isBacklogViewActive() || !isFeatureEnabled("enableBacklogSearch")){
            slot.remove();
        }
    });
}

function ensureBacklogSearchUi(container, settingsSlot){

    removeStaleBacklogSearchSlots(container);

    if(!isBacklogViewActive() || !isFeatureEnabled("enableBacklogSearch")){
        container.querySelector(".tm-backlog-search-slot")?.remove();
        clearBacklogSearchFiltering(document);
        return;
    }

    let slot = container.querySelector(".tm-backlog-search-slot");

    if(!slot){
        slot = createQuickFiltersSlot(container, "tm-backlog-search-slot");

        if(settingsSlot?.nextSibling){
            container.insertBefore(slot, settingsSlot.nextSibling);
        }else{
            container.appendChild(slot);
        }
    }else if(settingsSlot && slot.previousSibling !== settingsSlot){
        container.insertBefore(slot, settingsSlot.nextSibling);
    }

    let input = slot.querySelector(".tm-backlog-search-input");

    if(!input){
        input = document.createElement("input");
        input.type = "search";
        input.className = "tm-backlog-search-input";
        input.placeholder = 'Search backlog: foo "bar baz" !done';
        input.setAttribute("aria-label", "Search backlog issues using spaces for AND, quotes for phrases, and exclamation mark to exclude terms");
        input.title = 'Use spaces for AND, quotes for phrases, and !term to exclude';
        input.spellcheck = false;
        input.autocomplete = "off";
        input.addEventListener("input", handleBacklogSearchInput);
        input.addEventListener("search", handleBacklogSearchInput);
        input.addEventListener("keydown", event=>{

            if(event.key !== "Escape" || !input.value) return;

            event.stopPropagation();
            input.value = "";
            handleBacklogSearchInput({ currentTarget: input });
        });
        slot.appendChild(input);
    }

    if(input.value !== backlogSearchQuery){
        input.value = backlogSearchQuery;
    }
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
    removeStaleBacklogSearchSlots(container);

    let slot = container.querySelector(".tm-settings-slot");

    if(!slot){
        slot = createQuickFiltersSlot(container, "tm-settings-slot");

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

    syncSettingsUpdateIndicator();

    let backdrop = slot.querySelector(".tm-settings-backdrop");

    if(!backdrop){
        backdrop = document.createElement("div");
        backdrop.className = "tm-settings-backdrop";
        backdrop.setAttribute("hidden", "hidden");
        backdrop.addEventListener("click", event=>{
            event.preventDefault();
            event.stopPropagation();
            closeSettingsPanel();
        });
        slot.appendChild(backdrop);
    }

    let panel = slot.querySelector(".tm-settings-panel");

    if(!panel){
        panel = document.createElement("div");
        panel.className = "tm-settings-panel";
        panel.setAttribute("hidden", "hidden");
        panel.setAttribute("role", "dialog");
        panel.setAttribute("aria-modal", "true");
        panel.setAttribute("aria-label", "Jira tweaks");
        panel.tabIndex = -1;
        panel.addEventListener("click", event=>{
            event.stopPropagation();
        });
        slot.appendChild(panel);
    }

    renderSettingsPanel(panel);
    ensureBacklogSearchUi(container, slot);

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

function getDefaultBacklogStorageKey(){

    return getRapidViewId() || location.pathname || "default";
}

function readDefaultBacklogCollapseStates(){

    try{
        const parsed = JSON.parse(window.localStorage.getItem(DEFAULT_BACKLOG_COLLAPSE_STORAGE_KEY) || "{}");
        return parsed && typeof parsed === "object"
            ? parsed
            : {};
    }catch{
        return {};
    }
}

function writeDefaultBacklogCollapseState(collapsed){

    const storageKey = getDefaultBacklogStorageKey();
    const states = readDefaultBacklogCollapseStates();

    if(collapsed){
        states[storageKey] = true;
    }else{
        delete states[storageKey];
    }

    try{
        window.localStorage.setItem(DEFAULT_BACKLOG_COLLAPSE_STORAGE_KEY, JSON.stringify(states));
    }catch{}
}

function isDefaultBacklogCollapsed(){

    return Boolean(readDefaultBacklogCollapseStates()[getDefaultBacklogStorageKey()]);
}

function getDefaultBacklogContainers(scope = getBoardEnhancementScope()){

    const containers = new Set();

    scope.querySelectorAll(".ghx-backlog-header.js-marker-backlog-header").forEach(header=>{

        if(header.classList.contains("js-sprint-header") || header.hasAttribute("data-sprint-id")) return;

        const container = header.closest(".ghx-backlog-container");

        if(container){
            containers.add(container);
        }
    });

    return [...containers];
}

function getDefaultBacklogHeader(container){

    return container?.querySelector(":scope > .ghx-backlog-header.js-marker-backlog-header:not(.js-sprint-header)") || null;
}

function createDefaultBacklogExpanderButton(){

    const button = document.createElement("button");
    button.type = "button";
    button.className = "aui-button ghx-expander ghx-heading-expander tm-default-backlog-expander";
    button.setAttribute("aria-expanded", "true");
    button.setAttribute("title", "Toggle backlog visibility");
    button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><g fill="none" fill-rule="evenodd"><path d="M3.29175 4.793c-.389.392-.389 1.027 0 1.419l2.939 2.965c.218.215.5.322.779.322s.556-.107.769-.322l2.93-2.955c.388-.392.388-1.027 0-1.419-.389-.392-1.018-.392-1.406 0l-2.298 2.317-2.307-2.327c-.194-.195-.449-.293-.703-.293-.255 0-.51.098-.703.293z" fill="var(--ds-icon-subtle, #344563)"></path></g></svg>';

    return button;
}

function setDefaultBacklogCollapsed(container, collapsed){

    const header = getDefaultBacklogHeader(container);
    const button = header?.querySelector(".tm-default-backlog-expander");

    container.classList.add("tm-default-backlog-container");
    container.classList.toggle("tm-default-backlog-collapsed", collapsed);
    container.classList.toggle("ghx-closed", collapsed);
    container.classList.toggle("ghx-open", !collapsed);

    [...container.children].forEach(child=>{
        if(child === header) return;

        child.hidden = collapsed;
    });

    if(button){
        button.setAttribute("aria-expanded", String(!collapsed));
        button.setAttribute("title", collapsed ? "Expand backlog visibility" : "Collapse backlog visibility");
    }
}

function syncDefaultBacklogIssueCount(container){

    const header = getDefaultBacklogHeader(container);
    const issueCount = header?.querySelector(".ghx-issue-count");

    if(!issueCount) return;

    const issues = [...container.querySelectorAll(".ghx-issue[data-issue-key], .js-issue[data-issue-key]")];
    const issueTotal = new Set(
        issues
            .map(issue => issue.dataset.issueKey)
            .filter(Boolean)
    ).size;
    const visibleIssueTotal = new Set(
        issues
            .filter(issue => !issue.closest(".tm-backlog-search-hidden"))
            .map(issue => issue.dataset.issueKey)
            .filter(Boolean)
    ).size;

    const textNode = [...issueCount.childNodes].find(node => node.nodeType === Node.TEXT_NODE);

    if(textNode){
        textNode.textContent = hasBacklogSearchQuery()
            ? `${visibleIssueTotal} of ${issueTotal} issue${issueTotal === 1 ? "" : "s"} - `
            : `${issueTotal} issue${issueTotal === 1 ? "" : "s"} - `;
    }
}

function enhanceDefaultBacklogSections(scope = getBoardEnhancementScope()){

    const collapsed = isDefaultBacklogCollapsed();

    getDefaultBacklogContainers(scope).forEach(container=>{

        const header = getDefaultBacklogHeader(container);

        if(!header) return;

        let expander = header.querySelector(".tm-default-backlog-expander");

        if(!expander){
            expander = createDefaultBacklogExpanderButton();
            expander.addEventListener("click", event=>{
                event.preventDefault();
                event.stopPropagation();

                const nextCollapsed = !container.classList.contains("tm-default-backlog-collapsed");

                setDefaultBacklogCollapsed(container, nextCollapsed);
                writeDefaultBacklogCollapseState(nextCollapsed);
            });

            const name = header.querySelector(":scope > .ghx-name");

            if(name){
                header.insertBefore(expander, name);
            }else{
                header.insertBefore(expander, header.firstChild);
            }
        }

        syncDefaultBacklogIssueCount(container);
        setDefaultBacklogCollapsed(container, collapsed);
    });
}

function getSprintContainers(scope = getBoardEnhancementScope()){

    return [...scope.querySelectorAll(".ghx-backlog-container.js-sprint-container")];
}

function getSprintHeader(container){

    return container?.querySelector(":scope > .ghx-backlog-header.js-sprint-header") || null;
}

function getSprintExpanderButton(container){

    return getSprintHeader(container)?.querySelector(".ghx-expander.ghx-heading-expander") || null;
}

function isSprintContainerCollapsed(container){

    const button = getSprintExpanderButton(container);

    return Boolean(
        container?.classList.contains("ghx-closed")
        || button?.getAttribute("aria-expanded") === "false"
    );
}

function setSprintContainerCollapsed(container, collapsed){

    const button = getSprintExpanderButton(container);

    if(!button || isSprintContainerCollapsed(container) === collapsed) return;

    button.click();
}

function setAllSprintAndBacklogCollapsed(collapsed, scope = document){

    getSprintContainers(scope).forEach(container=>{
        setSprintContainerCollapsed(container, collapsed);
    });

    getDefaultBacklogContainers(scope).forEach(container=>{
        setDefaultBacklogCollapsed(container, collapsed);
    });

    writeDefaultBacklogCollapseState(collapsed);
}

function handleExpanderCtrlClick(event){

    if(!event.ctrlKey) return;

    const button = event.target?.closest?.(".ghx-expander.ghx-heading-expander");

    if(!button) return;

    const container = button.closest(".ghx-backlog-container");
    const isDefaultBacklogButton = button.classList.contains("tm-default-backlog-expander");
    const isSprintButton = Boolean(button.closest(".js-sprint-header"));

    if(!container || (!isDefaultBacklogButton && !isSprintButton)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    const nextCollapsed = isDefaultBacklogButton
        ? !container.classList.contains("tm-default-backlog-collapsed")
        : !isSprintContainerCollapsed(container);

    setAllSprintAndBacklogCollapsed(nextCollapsed, document);
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

function isElementNode(node){

    return node?.nodeType === Node.ELEMENT_NODE;
}

function doesMutationTouchContainer(mutation, container){

    if(mutation?.type !== "childList" || !container) return false;

    if(isElementNode(mutation.target) && (mutation.target === container || container.contains(mutation.target))){
        return true;
    }

    return [...mutation.addedNodes, ...mutation.removedNodes].some(node=>
        isElementNode(node)
        && (
            node === container
            || container.contains(node)
            || node.contains(container)
        )
    );
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

function stopObserver(){

    if(!boardObserver || !observerStarted) return;

    boardObserver.disconnect();
    observerStarted = false;
}

function handleNavigation(){

    const routeKey = getBoardRouteKey();
    const routeChanged = routeKey !== lastBoardRouteKey;

    syncFeatureSettingsFromStorage();

    if(!routeChanged) return;

    lastBoardRouteKey = routeKey;

    if(!hasBoardEnhancementContext(location.href)){
        stopObserver();
        boardRefreshPending = false;
        closeSettingsPanel();
        applyImmediateFeatureState();
        return;
    }

    startObserver();
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
    document.addEventListener("click", handleExpanderCtrlClick, true);

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

    if(!document.body) return;

    if(!boardObserver){
        boardObserver = new MutationObserver(mutations=>{

            if(!hasBoardEnhancementContext()) return;

            const boardRoot = getIssueCollectionRoot();

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
                    && doesMutationTouchContainer(mutation, boardRoot)
                )
                || (
                    mutation.type === "attributes"
                    && shouldReactToBoardAttributeMutation(mutation)
                    && (!boardRoot || boardRoot.contains(mutation.target))
                )
            );

            if(shouldApply){
                markBoardDirty();
                scheduleApply(120);
            }
        });
    }

    if(observerStarted) return;

    observerStarted = true;

    boardObserver.observe(document.body, {
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

    const keys = [...new Set([...getBoardEnhancementScope().querySelectorAll("[data-issue-key]")]
        .map(e => e.dataset.issueKey)
        .filter(Boolean))];

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

function markSubtaskCards(scope = getBoardEnhancementScope()){

    scope.querySelectorAll(".ghx-issue[data-issue-key]").forEach(issue=>{

        const key = issue.dataset.issueKey;
        const isSubtask = Boolean(cache.get(key)?.subtask);
        const hideSubtaskKeys = isSubtask && isFeatureEnabled("optimizeIssueIds");

        issue.classList.toggle("tm-subtask-card", isSubtask);

        issue.querySelectorAll(".ghx-key, .ghx-key-link, .ghx-parent-key, .ghx-issue-key-link").forEach(node=>{
            node.style.display = hideSubtaskKeys ? "none" : "";
        });
    });
}

function trimDisplayedParentKeys(scope = getBoardEnhancementScope()){

    scope.querySelectorAll(".ghx-parent-key").forEach(link=>{

        if(link.dataset.tmTrimmedPrefix === "true") return;

        link.dataset.tmOriginalText = link.textContent;
        link.textContent = link.textContent.replace(/^[A-Z][A-Z0-9]*-\s*/i, "");
        link.dataset.tmTrimmedPrefix = "true";
    });
}

function syncIssueFieldTypography(scope = getBoardEnhancementScope()){

    const fieldContainers = new Set(scope.querySelectorAll(".ghx-issue-fields"));

    scope.querySelectorAll(".ghx-issue-content").forEach(content=>{

        const keyRow = content.querySelector(".ghx-row") || content;

        if(
            keyRow.querySelector(".ghx-key-link-project-key, .ghx-key-link-issue-num, .ghx-key .ghx-key-link, .ghx-key .js-key-link")
            && keyRow.querySelector(".ghx-summary")
        ){
            fieldContainers.add(keyRow);
        }
    });

    fieldContainers.forEach(fields=>{

        fields.classList.add("tm-issue-key-layout");

        const issueKey = fields.closest("[data-issue-key]")?.dataset.issueKey || "";
        const isResolved = Boolean(cache.get(issueKey)?.resolved);

        const projectKey = fields.querySelector(".ghx-key-link-project-key");
        const issueNumber = fields.querySelector(".ghx-key-link-issue-num");
        const simpleIssueKeyLink = !projectKey && !issueNumber
            ? fields.querySelector(".ghx-key .ghx-key-link, .ghx-key .js-key-link")
            : null;
        const summary = fields.querySelector(".ghx-summary");
        const summaryInner = summary?.querySelector(".ghx-inner") || summary;
        const keyLinks = fields.querySelectorAll(".ghx-key .ghx-key-link, .ghx-key .js-key-link, .ghx-parent-key");

        keyLinks.forEach(link=>{
            link.classList.toggle("tm-resolved-issue-key", isResolved);
        });

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

        if(simpleIssueKeyLink){
            if(simpleIssueKeyLink.dataset.tmOriginalText == null){
                simpleIssueKeyLink.dataset.tmOriginalText = simpleIssueKeyLink.textContent;
            }

            if(isFeatureEnabled("optimizeIssueIds")){
                if(simpleIssueKeyLink.dataset.tmTrimmedPrefix !== "true"){
                    simpleIssueKeyLink.textContent = simpleIssueKeyLink.textContent.replace(/^[A-Z][A-Z0-9]*-\s*/i, "");
                    simpleIssueKeyLink.dataset.tmTrimmedPrefix = "true";
                }
            }else if(simpleIssueKeyLink.dataset.tmOriginalText != null){
                simpleIssueKeyLink.textContent = simpleIssueKeyLink.dataset.tmOriginalText;
                delete simpleIssueKeyLink.dataset.tmTrimmedPrefix;
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

    scope.querySelectorAll(".ghx-swimlane-header[data-issue-key] .ghx-parent-key").forEach(link=>{

        const issueKey = link.closest(".ghx-swimlane-header")?.dataset.issueKey || "";
        link.classList.toggle("tm-resolved-issue-key", Boolean(cache.get(issueKey)?.resolved));
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

    const orderedLanes = [...active, ...done];

    if(orderedLanes.every((lane, index) => lane === lanes[index])){
        return;
    }

    const anchor = pool.querySelector("#js-pool-end");

    orderedLanes.forEach(sl=>{
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

        if(sortedIssues.every((issue, index) => issue === issues[index])) return;

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

    if(!hasBoardEnhancementContext()) return;

    const pool = document.getElementById("ghx-pool");
    const hasIssues = hasVisibleJiraIssues();
    const enhancementScope = getBoardEnhancementScope();

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
            markSubtaskCards(enhancementScope);
        }else{
            resetSubtaskCards();
        }

        if(isFeatureEnabled("optimizeIssueIds")){
            trimDisplayedParentKeys(enhancementScope);
        }else{
            restoreTrimmedParentKeys();
        }

        syncIssueFieldTypography(enhancementScope);

        if(isFeatureEnabled("simplifyBacklogCards") && isBacklogViewActive()){
            syncBacklogCardSimplification(enhancementScope);
        }else{
            resetBacklogCardSimplification(document);
        }

        enhanceDefaultBacklogSections(enhancementScope);

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

        applyAssigneeEnhancements(enhancementScope);
        highlightCurrentUserIssueCards(enhancementScope);
        applyBacklogSearchFilter(enhancementScope);

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

        installFocusShortcut();
        installHooks();
        lastBoardRouteKey = getBoardRouteKey();

        if(!hasBoardEnhancementContext()) return;

        startObserver();
        ensureSettingsUi();
        scheduleEnsureSettingsUi(350);

        if(isRapidBoardPage() && (document.querySelector("#ghx-pool") || hasVisibleJiraIssues())){
            markBoardDirty();
            scheduleApply(0);
        }

    }, 100);
}

init();

})();