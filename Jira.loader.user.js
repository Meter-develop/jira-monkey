// ==UserScript==
// @name         Local Tampermonkey Bootstrap
// @namespace    https://github.com/Meter-develop/jira-monkey/
// @version      4.5
// @description  Manually installed trusted loader for local userscripts; manifest and script updates only load after local approval.
// @match        *://*/*
// @run-at       document-start
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_notification
// @grant        GM_openInTab
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      api.github.com
// @connect      raw.githubusercontent.com
// ==/UserScript==

(function () {
    'use strict';

    const MANIFEST_URL = 'https://raw.githubusercontent.com/Meter-develop/jira-monkey/main/loader.manifest.json';
    const LOADER_SELF_URL = 'https://raw.githubusercontent.com/Meter-develop/jira-monkey/main/Jira.loader.user.js';
    const MANIFEST_EXPECTED_HASH = '';
    const TRUST_STORE_KEY = 'tm-bootstrap-approved-script-hashes-v1';
    const APPROVED_SOURCE_STORE_KEY = 'tm-bootstrap-approved-sources-v1';
    const SOURCE_CACHE_KEY = 'tm-bootstrap-source-cache-v1';
    const FORCE_REFRESH_FLAG_KEY = 'tm-bootstrap-force-refresh-once';
    const UPDATE_API_NAME = '__tmBootstrapCheckForUpdatesNow';
    const UPDATE_EVENT_NAME = 'tm-bootstrap-check-for-updates-now';
    const UPDATE_STATUS_KEY = 'tm-bootstrap-update-status-v1';
    const UPDATE_STATUS_EVENT_NAME = 'tm-bootstrap-update-status-change';
    const LOADED_SCRIPTS_STATE_KEY = '__tmBootstrapLoadedScripts';
    const LOADED_SCRIPTS_EVENT_NAME = 'tm-bootstrap-loaded-scripts-change';
    const MANIFEST_CACHE_TTL_MS = 5 * 60 * 1000;
    const DEFAULT_SCRIPT_CACHE_TTL_MS = 15 * 60 * 1000;
    const DEFAULT_UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
    const DEFAULT_MANIFEST = {
        cacheBust: false,
        scriptCacheTtlSeconds: DEFAULT_SCRIPT_CACHE_TTL_MS / 1000,
        updateCheckIntervalSeconds: DEFAULT_UPDATE_CHECK_INTERVAL_MS / 1000,
        scripts: []
    };
    const loadedScriptUrls = new Set();
    const MODAL_ROOT_ID = 'tm-bootstrap-modal-root';
    let modalStylesInstalled = false;
    let approvalPromptCount = 0;
    let manualUpdatePromise = null;

    function getStorage() {
        const gmApi = typeof GM !== 'undefined' ? GM : undefined;

        return {
            async get(key, fallbackValue) {
                if (typeof GM_getValue === 'function') {
                    return await GM_getValue(key, fallbackValue);
                }

                if (typeof gmApi?.getValue === 'function') {
                    return await gmApi.getValue(key, fallbackValue);
                }

                try {
                    const raw = window.localStorage.getItem(key);
                    return raw == null ? fallbackValue : raw;
                } catch {
                    return fallbackValue;
                }
            },
            async set(key, value) {
                if (typeof GM_setValue === 'function') {
                    return await GM_setValue(key, value);
                }

                if (typeof gmApi?.setValue === 'function') {
                    return await gmApi.setValue(key, value);
                }

                try {
                    window.localStorage.setItem(key, value);
                } catch {}
            },
            async remove(key) {
                if (typeof GM_deleteValue === 'function') {
                    return await GM_deleteValue(key);
                }

                if (typeof gmApi?.deleteValue === 'function') {
                    return await gmApi.deleteValue(key);
                }

                try {
                    window.localStorage.removeItem(key);
                } catch {}
            }
        };
    }

    function notifyUser(title, text) {
        if (typeof GM_notification === 'function') {
            GM_notification({
                title,
                text,
                timeout: 7000
            });
            return;
        }

        console.info(`[TM bootstrap] ${title}: ${text}`);
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function ensureModalStyles() {
        if (modalStylesInstalled) {
            return;
        }

        modalStylesInstalled = true;

        const styles = `
            #${MODAL_ROOT_ID} {
                position: fixed;
                inset: 0;
                z-index: 2147483647;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 24px;
                background: rgba(9, 30, 66, 0.45);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }

            #${MODAL_ROOT_ID} .tm-bootstrap-modal {
                width: min(100%, 560px);
                max-height: min(100%, 80vh);
                overflow: auto;
                border-radius: 14px;
                border: 1px solid #dfe1e6;
                background: #ffffff;
                box-shadow: 0 18px 48px rgba(9, 30, 66, 0.28);
                color: #172b4d;
            }

            #${MODAL_ROOT_ID} .tm-bootstrap-modal__header {
                padding: 18px 20px 12px;
                border-bottom: 1px solid #f1f2f4;
            }

            #${MODAL_ROOT_ID} .tm-bootstrap-modal__title {
                margin: 0;
                font-size: 18px;
                font-weight: 700;
                line-height: 1.3;
            }

            #${MODAL_ROOT_ID} .tm-bootstrap-modal__body {
                display: grid;
                gap: 12px;
                padding: 16px 20px;
                font-size: 14px;
                line-height: 1.5;
            }

            #${MODAL_ROOT_ID} .tm-bootstrap-modal__body p {
                margin: 0;
            }

            #${MODAL_ROOT_ID} .tm-bootstrap-modal__details {
                display: grid;
                gap: 8px;
                padding: 12px;
                border-radius: 10px;
                background: #f7f8f9;
            }

            #${MODAL_ROOT_ID} .tm-bootstrap-modal__detail-row {
                display: grid;
                gap: 3px;
            }

            #${MODAL_ROOT_ID} .tm-bootstrap-modal__detail-label {
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 0.04em;
                text-transform: uppercase;
                color: #5e6c84;
            }

            #${MODAL_ROOT_ID} .tm-bootstrap-modal__detail-value {
                word-break: break-word;
                color: #172b4d;
            }

            #${MODAL_ROOT_ID} .tm-bootstrap-modal__detail-value code {
                font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
                font-size: 12px;
                background: #ffffff;
                padding: 2px 4px;
                border-radius: 6px;
            }

            #${MODAL_ROOT_ID} .tm-bootstrap-modal__review {
                display: grid;
                gap: 10px;
                padding: 12px;
                border-radius: 10px;
                background: #e9f2ff;
                border: 1px solid #cce0ff;
            }

            #${MODAL_ROOT_ID} .tm-bootstrap-modal__review-label {
                font-size: 12px;
                font-weight: 700;
                color: #0747a6;
            }

            #${MODAL_ROOT_ID} .tm-bootstrap-modal__review-link {
                color: #0c66e4;
                text-decoration: underline;
                word-break: break-word;
            }

            #${MODAL_ROOT_ID} .tm-bootstrap-modal__actions,
            #${MODAL_ROOT_ID} .tm-bootstrap-modal__review-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
            }

            #${MODAL_ROOT_ID} .tm-bootstrap-modal__actions {
                justify-content: flex-end;
                padding: 0 20px 20px;
            }

            #${MODAL_ROOT_ID} .tm-bootstrap-modal__button {
                border: 1px solid #c1c7d0;
                border-radius: 10px;
                background: #ffffff;
                color: #172b4d;
                padding: 9px 14px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
            }

            #${MODAL_ROOT_ID} .tm-bootstrap-modal__button:hover {
                background: #f7f8f9;
            }

            #${MODAL_ROOT_ID} .tm-bootstrap-modal__button:focus,
            #${MODAL_ROOT_ID} .tm-bootstrap-modal__review-link:focus {
                outline: 2px solid #4c9aff;
                outline-offset: 2px;
            }

            #${MODAL_ROOT_ID} .tm-bootstrap-modal__button--primary {
                border-color: #0c66e4;
                background: #0c66e4;
                color: #ffffff;
            }

            #${MODAL_ROOT_ID} .tm-bootstrap-modal__button--primary:hover {
                background: #0055cc;
            }
        `;

        if (typeof GM_addStyle === 'function') {
            GM_addStyle(styles);
            return;
        }

        const styleTag = document.createElement('style');
        styleTag.textContent = styles;
        (document.head || document.documentElement).appendChild(styleTag);
    }

    function waitForModalMountNode() {
        const existingNode = document.body || document.documentElement;

        if (existingNode) {
            return Promise.resolve(existingNode);
        }

        return new Promise(resolve => {
            const finish = () => {
                resolve(document.body || document.documentElement);
            };

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', finish, { once: true });
                return;
            }

            finish();
        });
    }

    function renderModalDetailRow(detail) {
        const value = detail.code
            ? `<code>${escapeHtml(detail.value)}</code>`
            : escapeHtml(detail.value);

        return `
            <div class="tm-bootstrap-modal__detail-row">
                <span class="tm-bootstrap-modal__detail-label">${escapeHtml(detail.label)}</span>
                <span class="tm-bootstrap-modal__detail-value">${value}</span>
            </div>
        `;
    }

    async function showDecisionModal({
        title,
        message,
        details = [],
        reviewInfo = null,
        approveLabel = 'Approve',
        cancelLabel = 'Cancel'
    }) {
        const mountNode = await waitForModalMountNode();

        if (!mountNode) {
            return window.confirm([title, '', message].filter(Boolean).join('\n'));
        }

        ensureModalStyles();

        return new Promise(resolve => {
            const previousFocus = document.activeElement;
            const existingModal = document.getElementById(MODAL_ROOT_ID);
            const hasCancelButton = cancelLabel != null;

            if (existingModal) {
                existingModal.remove();
            }

            const overlay = document.createElement('div');
            overlay.id = MODAL_ROOT_ID;
            overlay.tabIndex = -1;
            overlay.innerHTML = `
                <div class="tm-bootstrap-modal" role="dialog" aria-modal="true" aria-labelledby="${MODAL_ROOT_ID}-title">
                    <div class="tm-bootstrap-modal__header">
                        <h2 id="${MODAL_ROOT_ID}-title" class="tm-bootstrap-modal__title">${escapeHtml(title)}</h2>
                    </div>
                    <div class="tm-bootstrap-modal__body">
                        <p>${escapeHtml(message)}</p>
                        ${details.length ? `<div class="tm-bootstrap-modal__details">${details.map(renderModalDetailRow).join('')}</div>` : ''}
                        ${reviewInfo?.url ? `
                            <div class="tm-bootstrap-modal__review">
                                <div class="tm-bootstrap-modal__review-label">${escapeHtml(reviewInfo.label)}</div>
                                <a class="tm-bootstrap-modal__review-link" href="${escapeHtml(reviewInfo.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(reviewInfo.url)}</a>
                                <div class="tm-bootstrap-modal__review-actions">
                                    <button type="button" class="tm-bootstrap-modal__button" data-tm-modal-open-review="true">Open review in new tab</button>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    <div class="tm-bootstrap-modal__actions">
                        ${hasCancelButton ? `<button type="button" class="tm-bootstrap-modal__button" data-tm-modal-cancel="true">${escapeHtml(cancelLabel)}</button>` : ''}
                        <button type="button" class="tm-bootstrap-modal__button tm-bootstrap-modal__button--primary" data-tm-modal-approve="true">${escapeHtml(approveLabel)}</button>
                    </div>
                </div>
            `;

            const dialog = overlay.querySelector('.tm-bootstrap-modal');
            const cancelButton = overlay.querySelector('[data-tm-modal-cancel]');
            const approveButton = overlay.querySelector('[data-tm-modal-approve]');
            const reviewButton = overlay.querySelector('[data-tm-modal-open-review]');

            const cleanup = approved => {
                overlay.remove();

                if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
                    previousFocus.focus();
                }

                resolve(approved);
            };

            dialog?.addEventListener('click', event => {
                event.stopPropagation();
            });

            cancelButton?.addEventListener('click', () => cleanup(false));
            approveButton?.addEventListener('click', () => cleanup(true));
            reviewButton?.addEventListener('click', event => {
                event.preventDefault();
                openReviewLink(reviewInfo?.url);
            });

            mountNode.appendChild(overlay);
            (hasCancelButton ? cancelButton : approveButton)?.focus();
        });
    }

    function normalizeHash(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/^sha256[:-]/, '');
    }

    function formatHashPreview(value) {
        const hash = normalizeHash(value);
        return hash ? `${hash.slice(0, 12)}…${hash.slice(-12)}` : '(none)';
    }

    async function sha256Hex(text) {
        const subtle = globalThis.crypto?.subtle || window.crypto?.subtle;

        if (!subtle) {
            throw new Error('Web Crypto SHA-256 is unavailable in this context.');
        }

        const bytes = new TextEncoder().encode(String(text || ''));
        const digest = await subtle.digest('SHA-256', bytes);

        return [...new Uint8Array(digest)]
            .map(byte => byte.toString(16).padStart(2, '0'))
            .join('');
    }

    async function readTrustStore() {
        const storage = getStorage();
        const raw = await storage.get(TRUST_STORE_KEY, '{}');

        try {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
            return {};
        }
    }

    async function writeTrustStore(store) {
        const storage = getStorage();
        await storage.set(TRUST_STORE_KEY, JSON.stringify(store, null, 2));
    }

    async function clearTrustStore() {
        const storage = getStorage();
        await storage.remove(TRUST_STORE_KEY);
    }

    async function clearApprovedSourceStore() {
        const storage = getStorage();
        await storage.remove(APPROVED_SOURCE_STORE_KEY);
    }

    async function readApprovedSourceStore() {
        const storage = getStorage();
        const raw = await storage.get(APPROVED_SOURCE_STORE_KEY, '{}');

        try {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
            return {};
        }
    }

    async function writeApprovedSourceStore(store) {
        const storage = getStorage();
        const nextEntries = Object.entries(store || {})
            .filter(([, record]) => typeof record?.source === 'string')
            .sort(([, left], [, right]) => Number(right?.storedAt || 0) - Number(left?.storedAt || 0))
            .slice(0, 25);

        await storage.set(APPROVED_SOURCE_STORE_KEY, JSON.stringify(Object.fromEntries(nextEntries), null, 2));
    }

    function readForceRefreshFlag() {
        try {
            return window.localStorage.getItem(FORCE_REFRESH_FLAG_KEY) === 'true';
        } catch {
            return false;
        }
    }

    function writeForceRefreshFlag(enabled) {
        try {
            if (enabled) {
                window.localStorage.setItem(FORCE_REFRESH_FLAG_KEY, 'true');
                return;
            }

            window.localStorage.removeItem(FORCE_REFRESH_FLAG_KEY);
        } catch {}
    }

    function consumeForceRefreshFlag() {
        const requested = readForceRefreshFlag();

        if (requested) {
            writeForceRefreshFlag(false);
        }

        return requested;
    }

    function requestForceRefresh() {
        writeForceRefreshFlag(true);
    }

    function readLoadedScriptsState() {
        try {
            const parsed = JSON.parse(window.localStorage.getItem(LOADED_SCRIPTS_STATE_KEY) || '{}');
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
            return {};
        }
    }

    function writeLoadedScriptsState(nextState) {
        const normalizedState = nextState && typeof nextState === 'object' ? nextState : {};

        try {
            window.localStorage.setItem(LOADED_SCRIPTS_STATE_KEY, JSON.stringify(normalizedState));
        } catch {}

        window.dispatchEvent(new CustomEvent(LOADED_SCRIPTS_EVENT_NAME, {
            detail: normalizedState
        }));

        return normalizedState;
    }

    function updateLoadedScriptState(record) {
        const currentState = readLoadedScriptsState();
        const scriptKey = record.url;
        const nextState = {
            ...currentState,
            [scriptKey]: {
                name: record.metadata?.name || getDisplayName(record),
                url: record.url,
                version: String(record.metadata?.version || '').trim(),
                sourceHash: normalizeHash(record.sourceHash),
                loadedAt: Date.now(),
                sourceStoredAt: toFiniteNumber(record.sourceStoredAt) || null,
                sourceFetchedAt: toFiniteNumber(record.sourceFetchedAt) || null
            }
        };

        writeLoadedScriptsState(nextState);
    }

    function getInstalledLoaderVersion() {
        return String(getGrantedApis().GM_info?.script?.version || '').trim();
    }

    function compareVersionTokens(leftToken, rightToken) {
        const leftNumber = Number(leftToken);
        const rightNumber = Number(rightToken);
        const leftIsNumber = Number.isFinite(leftNumber) && String(leftNumber) === String(leftToken);
        const rightIsNumber = Number.isFinite(rightNumber) && String(rightNumber) === String(rightToken);

        if (leftIsNumber && rightIsNumber) {
            return leftNumber - rightNumber;
        }

        return String(leftToken).localeCompare(String(rightToken), undefined, {
            numeric: true,
            sensitivity: 'base'
        });
    }

    function compareVersions(leftVersion, rightVersion) {
        const leftTokens = String(leftVersion || '0').split(/[^0-9A-Za-z]+/).filter(Boolean);
        const rightTokens = String(rightVersion || '0').split(/[^0-9A-Za-z]+/).filter(Boolean);
        const maxLength = Math.max(leftTokens.length, rightTokens.length);

        for (let index = 0; index < maxLength; index += 1) {
            const comparison = compareVersionTokens(leftTokens[index] ?? '0', rightTokens[index] ?? '0');

            if (comparison !== 0) {
                return comparison;
            }
        }

        return 0;
    }

    function readUpdateStatus() {
        try {
            const parsed = JSON.parse(window.localStorage.getItem(UPDATE_STATUS_KEY) || '{}');
            return parsed && typeof parsed === 'object'
                ? parsed
                : {};
        } catch {
            return {};
        }
    }

    function emitUpdateStatus(status) {
        window.dispatchEvent(new CustomEvent(UPDATE_STATUS_EVENT_NAME, {
            detail: status
        }));
    }

    function writeUpdateStatus({ hasUpdates, checkedAt = Date.now() }) {
        const nextStatus = {
            hasUpdates: Boolean(hasUpdates),
            checkedAt: Number(checkedAt) || Date.now()
        };

        try {
            window.localStorage.setItem(UPDATE_STATUS_KEY, JSON.stringify(nextStatus));
        } catch {}

        emitUpdateStatus(nextStatus);
        return nextStatus;
    }

    function shouldCheckForUpdates(intervalMs) {
        const status = readUpdateStatus();
        const checkedAt = Number(status?.checkedAt) || 0;

        return !checkedAt || Date.now() - checkedAt >= Math.max(0, intervalMs);
    }

    function getUpdateBridgeTarget() {
        try {
            return typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
        } catch {
            return window;
        }
    }

    async function readSourceCache() {
        const storage = getStorage();
        const raw = await storage.get(SOURCE_CACHE_KEY, '{}');

        try {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
            return {};
        }
    }

    async function writeSourceCache(cache) {
        const storage = getStorage();
        const nextEntries = Object.entries(cache || {})
            .filter(([, record]) => typeof record?.source === 'string')
            .sort(([, left], [, right]) => Number(right?.fetchedAt || 0) - Number(left?.fetchedAt || 0))
            .slice(0, 25);

        await storage.set(SOURCE_CACHE_KEY, JSON.stringify(Object.fromEntries(nextEntries), null, 2));
    }

    function toFiniteNumber(value) {
        const numericValue = Number(value);
        return Number.isFinite(numericValue) ? numericValue : null;
    }

    function secondsToMilliseconds(value, fallbackMs = 0) {
        const numericValue = toFiniteNumber(value);

        if (numericValue == null) {
            return fallbackMs;
        }

        return Math.max(0, Math.round(numericValue * 1000));
    }

    function getSourceCacheRecordKey(kind, url) {
        return `${kind}:${url}`;
    }

    async function getCachedSource(kind, url, maxAgeMs, options = {}) {
        const { allowStale = false } = options;
        const normalizedMaxAgeMs = Math.max(0, toFiniteNumber(maxAgeMs) || 0);

        if (!allowStale && normalizedMaxAgeMs <= 0) {
            return null;
        }

        const cache = await readSourceCache();
        const record = cache[getSourceCacheRecordKey(kind, url)];

        if (!record || typeof record.source !== 'string') {
            return null;
        }

        const fetchedAt = toFiniteNumber(record.fetchedAt) || 0;

        if (!allowStale && (!fetchedAt || Date.now() - fetchedAt > normalizedMaxAgeMs)) {
            return null;
        }

        return {
            source: record.source,
            sourceHash: normalizeHash(record.sourceHash),
            fetchedAt
        };
    }

    async function storeCachedSource(kind, url, source, sourceHash) {
        const cache = await readSourceCache();
        cache[getSourceCacheRecordKey(kind, url)] = {
            source: String(source || ''),
            sourceHash: normalizeHash(sourceHash),
            fetchedAt: Date.now()
        };
        await writeSourceCache(cache);
    }

    async function getApprovedSourceRecord(kind, url, approvedHash = '') {
        const normalizedApprovedHash = normalizeHash(approvedHash);
        const approvedStore = await readApprovedSourceStore();
        const approvedRecord = approvedStore[getSourceCacheRecordKey(kind, url)];

        if (
            approvedRecord
            && typeof approvedRecord.source === 'string'
            && (!normalizedApprovedHash || normalizeHash(approvedRecord.sourceHash) === normalizedApprovedHash)
        ) {
            return {
                source: approvedRecord.source,
                sourceHash: normalizeHash(approvedRecord.sourceHash),
                storedAt: toFiniteNumber(approvedRecord.storedAt) || null
            };
        }

        if (!normalizedApprovedHash) {
            return null;
        }

        const cachedRecord = await getCachedSource(kind, url, Number.MAX_SAFE_INTEGER, { allowStale: true });

        if (cachedRecord && normalizeHash(cachedRecord.sourceHash) === normalizedApprovedHash) {
            const nextApprovedStore = await readApprovedSourceStore();
            nextApprovedStore[getSourceCacheRecordKey(kind, url)] = {
                source: cachedRecord.source,
                sourceHash: normalizeHash(cachedRecord.sourceHash),
                storedAt: Date.now()
            };
            await writeApprovedSourceStore(nextApprovedStore);

            return {
                source: cachedRecord.source,
                sourceHash: normalizeHash(cachedRecord.sourceHash),
                storedAt: toFiniteNumber(nextApprovedStore[getSourceCacheRecordKey(kind, url)]?.storedAt) || null,
                fetchedAt: toFiniteNumber(cachedRecord.fetchedAt) || null
            };
        }

        return null;
    }

    async function storeApprovedSourceRecord(record) {
        const approvedStore = await readApprovedSourceStore();
        approvedStore[getSourceCacheRecordKey(record.kind || 'script', record.url)] = {
            source: String(record.source || ''),
            sourceHash: normalizeHash(await ensureRecordHash(record)),
            storedAt: Date.now()
        };
        await writeApprovedSourceStore(approvedStore);
    }

    function getTrustKey(record) {
        return record.kind === 'manifest'
            ? `manifest:${record.url}`
            : record.url;
    }

    async function getApprovedHashFor(kind, url) {
        const trustStore = await readTrustStore();
        return normalizeHash(trustStore[getTrustKey({ kind, url })]);
    }

    function getDisplayName(record) {
        return record.displayName || record.metadata?.name || record.url.split('/').pop() || record.url;
    }

    function getExpectedHash(entry) {
        return normalizeHash(entry?.hash || entry?.expectedHash || entry?.sha256);
    }

    async function ensureRecordHash(record) {
        if (!record.sourceHash) {
            record.sourceHash = await sha256Hex(record.source);
        }

        return record.sourceHash;
    }

    async function verifyExpectedHash(record) {
        const sourceHash = await ensureRecordHash(record);
        const expectedHash = normalizeHash(record.expectedHash || getExpectedHash(record.entry));

        if (!expectedHash) {
            return;
        }

        if (sourceHash !== expectedHash) {
            throw new Error(
                `Configured hash mismatch for ${getDisplayName(record)}. Expected ${formatHashPreview(expectedHash)}, got ${formatHashPreview(sourceHash)}.`
            );
        }
    }

    async function approveHash(record) {
        const sourceHash = await ensureRecordHash(record);
        const trustStore = await readTrustStore();
        trustStore[getTrustKey(record)] = sourceHash;
        await writeTrustStore(trustStore);
        await storeApprovedSourceRecord(record);
    }

    async function isApproved(record) {
        const sourceHash = await ensureRecordHash(record);
        const trustStore = await readTrustStore();
        return normalizeHash(trustStore[getTrustKey(record)]) === sourceHash;
    }

    async function promptForApproval(record) {
        const trustStore = await readTrustStore();
        const previousHash = normalizeHash(trustStore[getTrustKey(record)]);
        const isUpdate = Boolean(previousHash);
        const actionLabel = isUpdate ? 'updated' : 'new';
        approvalPromptCount += 1;
        const reviewInfo = await getReviewInfo(record, previousHash);
        const approved = await showDecisionModal({
            title: `${getDisplayName(record)} has a ${actionLabel} version`,
            message: 'Review the source details below, then decide whether to trust and load this version.',
            details: [
                {
                    label: 'Source URL',
                    value: record.url,
                    code: true
                }
            ],
            reviewInfo,
            approveLabel: 'Approve and load',
            cancelLabel: 'Block for now'
        });

        if (!approved) {
            notifyUser(
                'Script update blocked',
                `${getDisplayName(record)} was not approved and was not loaded.`
            );
            return false;
        }

        await approveHash(record);

        notifyUser(
            'Script hash approved',
            `${getDisplayName(record)} is now approved for loading.`
        );

        return true;
    }

    async function ensureRecordIsTrusted(record) {
        await verifyExpectedHash(record);

        if (await isApproved(record)) {
            await storeApprovedSourceRecord(record);
            return true;
        }

        return promptForApproval(record);
    }

    function installManagementMenu() {
        if (typeof GM_registerMenuCommand !== 'function') {
            return;
        }

        GM_registerMenuCommand('TM Bootstrap: Check for updates now', () => {
            void runManualUpdateCheck();
        });

        GM_registerMenuCommand('TM Bootstrap: Clear approved hashes', async () => {
            const confirmed = await showDecisionModal({
                title: 'Clear approved hashes?',
                message: 'This removes every locally approved manifest and script hash for the bootstrap loader. The next manifest or script update will ask for approval again.',
                approveLabel: 'Clear hashes',
                cancelLabel: 'Keep hashes'
            });

            if (!confirmed) {
                return;
            }

            await clearTrustStore();
            await clearApprovedSourceStore();
            notifyUser('Approved hashes cleared', 'The next manifest or script load will require approval again.');
        });
    }

    async function showNoUpdatesModal() {
        const acknowledged = await showDecisionModal({
            title: 'No updates available',
            message: 'The loader checked the latest manifest and the scripts relevant to this page, and everything is already up to date.',
            approveLabel: 'Close',
            cancelLabel: 'Force update anyway'
        });

        if (acknowledged) {
            return;
        }

        requestForceRefresh();
        window.location.reload();
    }

    async function fetchLoaderSelfRecord(forceRefresh = false) {
        const response = await fetchText(appendCacheBust(LOADER_SELF_URL, forceRefresh), {
            cacheKind: 'loader',
            cacheKey: LOADER_SELF_URL,
            cacheTtlMs: MANIFEST_CACHE_TTL_MS,
            bypassCache: forceRefresh
        });

        return {
            kind: 'loader',
            displayName: 'Jira.loader.user.js',
            url: LOADER_SELF_URL,
            source: response.source,
            sourceHash: response.sourceHash,
            metadata: parseUserscriptMetadata(response.source),
            fromCache: response.fromCache
        };
    }

    async function getLoaderSelfUpdateStatus(forceRefresh = false) {
        const record = await fetchLoaderSelfRecord(forceRefresh);
        const installedVersion = getInstalledLoaderVersion();
        const availableVersion = String(record.metadata?.version || '').trim();
        const hasUpdate = Boolean(availableVersion) && compareVersions(availableVersion, installedVersion) > 0;

        return {
            hasUpdate,
            installedVersion,
            availableVersion,
            record
        };
    }

    async function showLoaderSelfUpdateModal(loaderStatus) {
        const acknowledged = await showDecisionModal({
            title: 'Bootstrap loader update available',
            message: 'The manually installed Tampermonkey loader has a newer version. Please update the loader itself in Tampermonkey before applying any other pending updates.',
            details: [
                {
                    label: 'Installed version',
                    value: loaderStatus.installedVersion || '(unknown)',
                    code: true
                },
                {
                    label: 'Available version',
                    value: loaderStatus.availableVersion || '(unknown)',
                    code: true
                },
                {
                    label: 'Install URL',
                    value: LOADER_SELF_URL,
                    code: true
                }
            ],
            reviewInfo: {
                url: LOADER_SELF_URL,
                label: 'Open loader install/update URL'
            },
            approveLabel: 'Close',
            cancelLabel: null
        });

        return acknowledged;
    }

    async function runManualUpdateCheck() {
        if (manualUpdatePromise) {
            return manualUpdatePromise;
        }

        manualUpdatePromise = (async () => {
            approvalPromptCount = 0;
            let changesDetected = false;
            let approvedChangesDetected = false;
            let unresolvedUpdateCount = 0;

            try {
                const loaderStatus = await getLoaderSelfUpdateStatus(true);

                if (loaderStatus.hasUpdate) {
                    writeUpdateStatus({
                        hasUpdates: true,
                        checkedAt: Date.now()
                    });
                    await showLoaderSelfUpdateModal(loaderStatus);

                    return {
                        changesDetected: true,
                        approvedChangesDetected: false,
                        blocked: true,
                        loaderUpdate: true
                    };
                }

                const approvedManifestHash = await getApprovedHashFor('manifest', MANIFEST_URL);
                const remoteManifestRecord = await fetchManifestRecord(true);
                const remoteManifestHash = normalizeHash(await ensureRecordHash(remoteManifestRecord));
                const manifestChanged = !approvedManifestHash || remoteManifestHash !== approvedManifestHash;

                if (manifestChanged) {
                    changesDetected = true;
                    unresolvedUpdateCount += 1;
                }

                if (!(await ensureRecordIsTrusted(remoteManifestRecord))) {
                    writeUpdateStatus({
                        hasUpdates: unresolvedUpdateCount > 0,
                        checkedAt: Date.now()
                    });

                    return {
                        changesDetected,
                        approvedChangesDetected: false,
                        blocked: true
                    };
                }

                if (manifestChanged) {
                    approvedChangesDetected = true;
                    unresolvedUpdateCount = Math.max(0, unresolvedUpdateCount - 1);
                }

                const manifest = parseManifestSource(remoteManifestRecord.source);
                const cacheBustEnabled = manifest.cacheBust === true;
                const defaultScriptCacheTtlMs = secondsToMilliseconds(
                    manifest.scriptCacheTtlSeconds,
                    DEFAULT_SCRIPT_CACHE_TTL_MS
                );
                const candidateEntries = getPageMatchingManifestEntries(manifest);

                for (const entry of candidateEntries) {
                    const approvedHash = await getApprovedHashFor('script', entry.url);
                    const remoteRecord = await fetchRemoteScriptRecord(entry, cacheBustEnabled, defaultScriptCacheTtlMs, { forceRefresh: true });
                    const remoteHash = normalizeHash(await ensureRecordHash(remoteRecord));
                    const scriptChanged = !approvedHash || remoteHash !== approvedHash;

                    if (!scriptChanged) {
                        continue;
                    }

                    changesDetected = true;
                    unresolvedUpdateCount += 1;

                    if (await ensureRecordIsTrusted(remoteRecord)) {
                        approvedChangesDetected = true;
                        unresolvedUpdateCount = Math.max(0, unresolvedUpdateCount - 1);
                    }
                }

                writeUpdateStatus({
                    hasUpdates: unresolvedUpdateCount > 0,
                    checkedAt: Date.now()
                });

                if (!changesDetected) {
                    await showNoUpdatesModal();
                    return {
                        changesDetected: false,
                        approvedChangesDetected: false,
                        blocked: false
                    };
                }

                if (approvedChangesDetected) {
                    window.location.reload();
                }

                return {
                    changesDetected,
                    approvedChangesDetected,
                    blocked: false
                };
            } catch (error) {
                console.error('[TM bootstrap] Failed to check for updates.', error);
                notifyUser('Update check failed', 'The loader could not check for updates. See the console for details.');
                return {
                    changesDetected,
                    approvedChangesDetected,
                    blocked: false,
                    error
                };
            } finally {
                manualUpdatePromise = null;
            }
        })();

        return manualUpdatePromise;
    }

    async function checkForAvailableUpdates() {
        try {
            const loaderStatus = await getLoaderSelfUpdateStatus(true);

            if (loaderStatus.hasUpdate) {
                writeUpdateStatus({
                    hasUpdates: true,
                    checkedAt: Date.now()
                });
                return true;
            }

            const approvedManifestHash = await getApprovedHashFor('manifest', MANIFEST_URL);
            const remoteManifestRecord = await fetchManifestRecord(true);
            const remoteManifestHash = normalizeHash(await ensureRecordHash(remoteManifestRecord));

            if (!approvedManifestHash || remoteManifestHash !== approvedManifestHash) {
                writeUpdateStatus({
                    hasUpdates: true,
                    checkedAt: Date.now()
                });
                return true;
            }

            const remoteManifest = parseManifestSource(remoteManifestRecord.source);
            const cacheBustEnabled = remoteManifest.cacheBust === true;
            const defaultScriptCacheTtlMs = secondsToMilliseconds(
                remoteManifest.scriptCacheTtlSeconds,
                DEFAULT_SCRIPT_CACHE_TTL_MS
            );
            const candidateEntries = getPageMatchingManifestEntries(remoteManifest);

            for (const entry of candidateEntries) {
                const approvedHash = await getApprovedHashFor('script', entry.url);

                if (!approvedHash) {
                    writeUpdateStatus({
                        hasUpdates: true,
                        checkedAt: Date.now()
                    });
                    return true;
                }

                const remoteRecord = await fetchRemoteScriptRecord(entry, cacheBustEnabled, defaultScriptCacheTtlMs, { forceRefresh: true });
                const remoteHash = normalizeHash(await ensureRecordHash(remoteRecord));

                if (remoteHash !== approvedHash) {
                    writeUpdateStatus({
                        hasUpdates: true,
                        checkedAt: Date.now()
                    });
                    return true;
                }
            }

            writeUpdateStatus({
                hasUpdates: false,
                checkedAt: Date.now()
            });
            return false;
        } catch (error) {
            console.warn('[TM bootstrap] Failed while checking for passive updates.', error);
            return Boolean(readUpdateStatus().hasUpdates);
        }
    }

    function registerUpdateBridge() {
        const target = getUpdateBridgeTarget();
        target[UPDATE_API_NAME] = () => runManualUpdateCheck();
        window[UPDATE_API_NAME] = () => runManualUpdateCheck();
        window.addEventListener(UPDATE_EVENT_NAME, () => {
            void runManualUpdateCheck();
        });
    }

    function getGrantedApis() {
        return {
            GM: typeof GM !== 'undefined' ? GM : undefined,
            GM_addStyle: typeof GM_addStyle !== 'undefined' ? GM_addStyle : undefined,
            GM_xmlhttpRequest: typeof GM_xmlhttpRequest !== 'undefined' ? GM_xmlhttpRequest : undefined,
            GM_getValue: typeof GM_getValue !== 'undefined' ? GM_getValue : undefined,
            GM_setValue: typeof GM_setValue !== 'undefined' ? GM_setValue : undefined,
            GM_deleteValue: typeof GM_deleteValue !== 'undefined' ? GM_deleteValue : undefined,
            GM_listValues: typeof GM_listValues !== 'undefined' ? GM_listValues : undefined,
            GM_notification: typeof GM_notification !== 'undefined' ? GM_notification : undefined,
            GM_openInTab: typeof GM_openInTab !== 'undefined' ? GM_openInTab : undefined,
            GM_registerMenuCommand: typeof GM_registerMenuCommand !== 'undefined' ? GM_registerMenuCommand : undefined,
            GM_unregisterMenuCommand: typeof GM_unregisterMenuCommand !== 'undefined' ? GM_unregisterMenuCommand : undefined,
            GM_setClipboard: typeof GM_setClipboard !== 'undefined' ? GM_setClipboard : undefined,
            GM_download: typeof GM_download !== 'undefined' ? GM_download : undefined,
            GM_info: typeof GM_info !== 'undefined' ? GM_info : undefined,
            unsafeWindow: typeof unsafeWindow !== 'undefined' ? unsafeWindow : window
        };
    }

    function appendCacheBust(url, enabled) {
        if (!enabled) {
            return url;
        }

        const parsed = new URL(url, location.href);
        parsed.searchParams.set('_tmdev', String(Date.now()));
        return parsed.toString();
    }

    function parseGitHubRawReference(url) {
        try {
            const parsed = new URL(url, location.href);

            if (parsed.hostname !== 'raw.githubusercontent.com') {
                return null;
            }

            const parts = parsed.pathname.replace(/^\/+/, '').split('/');

            if (parts.length < 4) {
                return null;
            }

            const [owner, repo, branch, ...pathParts] = parts;
            const path = pathParts.join('/');

            if (!owner || !repo || !branch || !path) {
                return null;
            }

            return {
                owner,
                repo,
                branch,
                path
            };
        } catch {
            return null;
        }
    }

    function buildGitHubReviewUrls(reference) {
        const repoBase = `https://github.com/${reference.owner}/${reference.repo}`;

        return {
            fileUrl: `${repoBase}/blob/${reference.branch}/${reference.path}`,
            historyUrl: `${repoBase}/commits/${reference.branch}/${reference.path}`,
            compareUrl(baseSha, headSha) {
                return `${repoBase}/compare/${baseSha}...${headSha}`;
            }
        };
    }

    function requestText(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                onload(response) {
                    if (response.status >= 200 && response.status < 300) {
                        resolve(response.responseText || '');
                        return;
                    }

                    reject(new Error(`Request failed with status ${response.status}`));
                },
                onerror(error) {
                    reject(error instanceof Error ? error : new Error('Network request failed'));
                }
            });
        });
    }

    async function fetchText(url, options = {}) {
        const {
            cacheKind = 'script',
            cacheKey = url,
            cacheTtlMs = 0,
            bypassCache = false
        } = options;
        const normalizedCacheTtlMs = Math.max(0, toFiniteNumber(cacheTtlMs) || 0);

        if (!bypassCache && normalizedCacheTtlMs > 0) {
            const cached = await getCachedSource(cacheKind, cacheKey, normalizedCacheTtlMs);

            if (cached) {
                return {
                    ...cached,
                    fromCache: true,
                    stale: false
                };
            }
        }

        const stale = normalizedCacheTtlMs > 0
            ? await getCachedSource(cacheKind, cacheKey, normalizedCacheTtlMs, { allowStale: true })
            : null;

        try {
            const source = await requestText(url);
            const sourceHash = await sha256Hex(source);

            if (normalizedCacheTtlMs > 0) {
                await storeCachedSource(cacheKind, cacheKey, source, sourceHash);
            }

            return {
                source,
                sourceHash,
                fetchedAt: Date.now(),
                fromCache: false,
                stale: false
            };
        } catch (error) {
            if (stale) {
                console.warn(`[TM bootstrap] Using stale cached ${cacheKind} for ${cacheKey} because the network request failed.`, error);

                return {
                    ...stale,
                    fromCache: true,
                    stale: true
                };
            }

            throw error;
        }
    }

    async function fetchJson(url) {
        return JSON.parse(await requestText(url));
    }

    async function fetchGitHubCommitHistory(reference) {
        const apiUrl = new URL(`https://api.github.com/repos/${reference.owner}/${reference.repo}/commits`);

        apiUrl.searchParams.set('sha', reference.branch);
        apiUrl.searchParams.set('path', reference.path);
        apiUrl.searchParams.set('per_page', '20');

        const commits = await fetchJson(apiUrl.toString());
        return Array.isArray(commits) ? commits : [];
    }

    async function fetchCommitHashForPath(reference, commitSha) {
        const rawUrl = `https://raw.githubusercontent.com/${reference.owner}/${reference.repo}/${commitSha}/${reference.path}`;
        const source = await requestText(rawUrl);
        return sha256Hex(source);
    }

    async function findCommitForHash(reference, commits, targetHash) {
        const normalizedTargetHash = normalizeHash(targetHash);

        if (!normalizedTargetHash) {
            return null;
        }

        for (const commit of commits) {
            const commitSha = commit?.sha;

            if (!commitSha) {
                continue;
            }

            try {
                if (normalizeHash(await fetchCommitHashForPath(reference, commitSha)) === normalizedTargetHash) {
                    return commit;
                }
            } catch (error) {
                console.warn(`[TM bootstrap] Failed to inspect ${reference.path} at commit ${commitSha}`, error);
            }
        }

        return null;
    }

    async function getReviewInfo(record, previousHash) {
        const reference = parseGitHubRawReference(record.url);

        if (!reference) {
            return null;
        }

        const urls = buildGitHubReviewUrls(reference);
        const normalizedPreviousHash = normalizeHash(previousHash);

        if (!normalizedPreviousHash) {
            return {
                url: urls.fileUrl,
                label: 'Review file'
            };
        }

        try {
            const commits = await fetchGitHubCommitHistory(reference);

            if (!commits.length) {
                return {
                    url: urls.historyUrl,
                    label: 'Review file history'
                };
            }

            const currentCommit = (await findCommitForHash(reference, commits, await ensureRecordHash(record))) || commits[0];
            const previousCommit = await findCommitForHash(reference, commits, normalizedPreviousHash);

            if (previousCommit?.sha && currentCommit?.sha && previousCommit.sha !== currentCommit.sha) {
                return {
                    url: urls.compareUrl(previousCommit.sha, currentCommit.sha),
                    label: 'Review diff'
                };
            }
        } catch (error) {
            console.warn(`[TM bootstrap] Failed to prepare a GitHub review link for ${getDisplayName(record)}`, error);
        }

        return {
            url: urls.historyUrl,
            label: 'Review file history'
        };
    }

    function openReviewLink(url) {
        if (!url) {
            return;
        }

        if (typeof GM_openInTab === 'function') {
            GM_openInTab(url, {
                active: false,
                insert: true,
                setParent: true
            });
            return;
        }

        console.info(`[TM bootstrap] Review URL: ${url}`);
    }

    function parseManifestSource(source) {
        const parsed = JSON.parse(source);

        if (!Array.isArray(parsed?.scripts)) {
            throw new Error('Manifest is missing a scripts array');
        }

        return {
            ...DEFAULT_MANIFEST,
            ...parsed
        };
    }

    async function fetchManifestRecord(forceRefresh = false) {
        const response = await fetchText(appendCacheBust(MANIFEST_URL, forceRefresh), {
            cacheKind: 'manifest',
            cacheKey: MANIFEST_URL,
            cacheTtlMs: MANIFEST_CACHE_TTL_MS,
            bypassCache: forceRefresh
        });

        return {
            kind: 'manifest',
            displayName: 'loader.manifest.json',
            url: MANIFEST_URL,
            source: response.source,
            sourceHash: response.sourceHash,
            expectedHash: MANIFEST_EXPECTED_HASH,
            fromCache: response.fromCache
        };
    }

    async function loadManifest(options = {}) {
        const { forceRefresh = false } = options;

        try {
            let manifestRecord = await fetchManifestRecord(forceRefresh);

            try {
                if (!(await ensureRecordIsTrusted(manifestRecord))) {
                    console.info('[TM bootstrap] Manifest was not approved, so no local scripts were loaded.');
                    return DEFAULT_MANIFEST;
                }
            } catch (error) {
                if (!manifestRecord.fromCache) {
                    throw error;
                }

                manifestRecord = await fetchManifestRecord(true);

                if (!(await ensureRecordIsTrusted(manifestRecord))) {
                    console.info('[TM bootstrap] Manifest was not approved, so no local scripts were loaded.');
                    return DEFAULT_MANIFEST;
                }
            }

            return parseManifestSource(manifestRecord.source);
        } catch (error) {
            console.warn('[TM bootstrap] Failed to load manifest; no local scripts will be loaded until loader.manifest.json is reachable again.', error);
            return DEFAULT_MANIFEST;
        }
    }

    async function getExecutableManifest(forceRefresh = false) {
        if (forceRefresh) {
            return loadManifest({ forceRefresh: true });
        }

        try {
            const approvedHash = await getApprovedHashFor('manifest', MANIFEST_URL);
            const approvedManifest = await getApprovedSourceRecord('manifest', MANIFEST_URL, approvedHash);

            if (approvedManifest?.source) {
                return parseManifestSource(approvedManifest.source);
            }
        } catch (error) {
            console.warn('[TM bootstrap] Failed to use the approved manifest copy, falling back to the network.', error);
        }

        return loadManifest({ forceRefresh: false });
    }

    function normalizePatternList(value) {
        if (Array.isArray(value)) {
            return value
                .map(entry => String(entry || '').trim())
                .filter(Boolean);
        }

        if (typeof value === 'string') {
            const normalizedValue = value.trim();
            return normalizedValue ? [normalizedValue] : [];
        }

        return [];
    }

    function normalizeManifestEntry(entry, manifestUrl) {
        if (typeof entry === 'string') {
            return {
                enabled: true,
                url: new URL(entry, manifestUrl).toString(),
                match: [],
                include: [],
                exclude: [],
                'exclude-match': []
            };
        }

        if (entry && typeof entry === 'object' && typeof entry.url === 'string') {
            return {
                enabled: entry.enabled !== false,
                url: new URL(entry.url, manifestUrl).toString(),
                hash: typeof entry.hash === 'string' ? entry.hash : undefined,
                expectedHash: typeof entry.expectedHash === 'string' ? entry.expectedHash : undefined,
                sha256: typeof entry.sha256 === 'string' ? entry.sha256 : undefined,
                cacheTtlSeconds: toFiniteNumber(entry.cacheTtlSeconds),
                match: normalizePatternList(entry.match),
                include: normalizePatternList(entry.include),
                exclude: normalizePatternList(entry.exclude),
                'exclude-match': normalizePatternList(entry['exclude-match'] ?? entry.excludeMatch)
            };
        }

        return null;
    }

    function getEnabledManifestEntries(manifest) {
        return (manifest.scripts || [])
            .map(entry => normalizeManifestEntry(entry, MANIFEST_URL))
            .filter(entry => entry?.enabled);
    }

    function getPageMatchingManifestEntries(manifest, href = location.href) {
        return getEnabledManifestEntries(manifest)
            .filter(entry => pageRulesMatchCurrentPage(entry, href));
    }

    function parseUserscriptMetadata(source) {
        const blockMatch = source.match(/\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/i);
        const metadata = {
            name: '',
            match: [],
            include: [],
            exclude: [],
            'exclude-match': [],
            'run-at': 'document-end'
        };

        if (!blockMatch) {
            return metadata;
        }

        const lines = blockMatch[1].split(/\r?\n/);

        for (const line of lines) {
            const match = line.match(/^\s*\/\/\s*@([^\s]+)\s+(.+?)\s*$/);
            if (!match) {
                continue;
            }

            const [, key, rawValue] = match;
            const value = rawValue.trim();

            if (Array.isArray(metadata[key])) {
                metadata[key].push(value);
            } else {
                metadata[key] = value;
            }
        }

        return metadata;
    }

    function escapeRegExp(value) {
        return String(value).replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
    }

    function wildcardToRegExp(pattern) {
        return new RegExp(`^${escapeRegExp(pattern).replace(/\*/g, '.*')}$`, 'i');
    }

    function matchesPattern(pattern, href = location.href) {
        return wildcardToRegExp(pattern).test(href);
    }

    function pageRulesMatchCurrentPage(source, href = location.href) {
        const rules = {
            match: normalizePatternList(source?.match),
            include: normalizePatternList(source?.include),
            exclude: normalizePatternList(source?.exclude),
            'exclude-match': normalizePatternList(source?.['exclude-match'] ?? source?.excludeMatch)
        };
        const hasMatchRules = rules.match.length > 0 || rules.include.length > 0;

        if (rules['exclude-match'].some(pattern => matchesPattern(pattern, href))) {
            return false;
        }

        if (rules.exclude.some(pattern => matchesPattern(pattern, href))) {
            return false;
        }

        if (rules.match.length > 0) {
            return rules.match.some(pattern => matchesPattern(pattern, href));
        }

        if (rules.include.length > 0) {
            return rules.include.some(pattern => matchesPattern(pattern, href));
        }

        return !hasMatchRules || true;
    }

    function metadataMatchesCurrentPage(metadata) {
        return pageRulesMatchCurrentPage(metadata);
    }

    function getScriptCacheTtlMs(entry, defaultMs) {
        return secondsToMilliseconds(entry?.cacheTtlSeconds, defaultMs);
    }

    async function fetchRemoteScriptRecord(entry, cacheBustEnabled, defaultScriptCacheTtlMs, options = {}) {
        const { forceRefresh = false } = options;
        const shouldBypassCache = cacheBustEnabled || forceRefresh;
        const requestUrl = appendCacheBust(entry.url, shouldBypassCache);
        const cacheTtlMs = shouldBypassCache
            ? 0
            : getScriptCacheTtlMs(entry, defaultScriptCacheTtlMs);
        let result = await fetchText(requestUrl, {
            cacheKind: 'script',
            cacheKey: entry.url,
            cacheTtlMs,
            bypassCache: shouldBypassCache
        });
        const expectedHash = getExpectedHash(entry);

        if (expectedHash && result.fromCache && normalizeHash(result.sourceHash) !== expectedHash) {
            result = await fetchText(appendCacheBust(entry.url, true), {
                cacheKind: 'script',
                cacheKey: entry.url,
                cacheTtlMs,
                bypassCache: true
            });
        }

        return {
            kind: 'script',
            entry,
            url: entry.url,
            source: result.source,
            metadata: parseUserscriptMetadata(result.source),
            sourceHash: result.sourceHash,
            sourceFetchedAt: toFiniteNumber(result.fetchedAt) || null
        };
    }

    function waitForRunAt(runAt) {
        if (runAt === 'document-start') {
            return Promise.resolve();
        }

        if (document.readyState !== 'loading') {
            return Promise.resolve();
        }

        return new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', () => {
                if (runAt === 'document-idle') {
                    window.setTimeout(resolve, 0);
                    return;
                }

                resolve();
            }, { once: true });
        });
    }

    async function executeScript(record) {
        await waitForRunAt(record.metadata['run-at']);

        if (loadedScriptUrls.has(record.url)) {
            return;
        }

        loadedScriptUrls.add(record.url);
        updateLoadedScriptState(record);

        const grantedApis = getGrantedApis();
        const runner = new Function(
            'GM',
            'GM_addStyle',
            'GM_xmlhttpRequest',
            'GM_getValue',
            'GM_setValue',
            'GM_deleteValue',
            'GM_listValues',
            'GM_notification',
            'GM_openInTab',
            'GM_registerMenuCommand',
            'GM_unregisterMenuCommand',
            'GM_setClipboard',
            'GM_download',
            'GM_info',
            'unsafeWindow',
            `${record.source}\n//# sourceURL=${record.url}`
        );

        runner(
            grantedApis.GM,
            grantedApis.GM_addStyle,
            grantedApis.GM_xmlhttpRequest,
            grantedApis.GM_getValue,
            grantedApis.GM_setValue,
            grantedApis.GM_deleteValue,
            grantedApis.GM_listValues,
            grantedApis.GM_notification,
            grantedApis.GM_openInTab,
            grantedApis.GM_registerMenuCommand,
            grantedApis.GM_unregisterMenuCommand,
            grantedApis.GM_setClipboard,
            grantedApis.GM_download,
            grantedApis.GM_info,
            grantedApis.unsafeWindow
        );

        console.info(`[TM bootstrap] Loaded ${record.metadata.name || record.url}`);
    }

    async function loadScriptRecord(entry, cacheBustEnabled, defaultScriptCacheTtlMs, options = {}) {
        const { forceRefresh = false } = options;

        if (!forceRefresh) {
            const approvedHash = await getApprovedHashFor('script', entry.url);
            const approvedScript = await getApprovedSourceRecord('script', entry.url, approvedHash);

            if (approvedScript?.source) {
                return {
                    kind: 'script',
                    entry,
                    url: entry.url,
                    source: approvedScript.source,
                    metadata: parseUserscriptMetadata(approvedScript.source),
                    sourceHash: approvedScript.sourceHash,
                    sourceStoredAt: toFiniteNumber(approvedScript.storedAt) || null,
                    sourceFetchedAt: toFiniteNumber(approvedScript.fetchedAt) || null
                };
            }
        }

        return fetchRemoteScriptRecord(entry, cacheBustEnabled, defaultScriptCacheTtlMs, { forceRefresh });
    }

    async function init() {
        installManagementMenu();
        approvalPromptCount = 0;

        const forceRefresh = consumeForceRefreshFlag();
        const manifest = await getExecutableManifest(forceRefresh);
        const cacheBustEnabled = manifest.cacheBust === true || forceRefresh;
        const defaultScriptCacheTtlMs = secondsToMilliseconds(
            manifest.scriptCacheTtlSeconds,
            DEFAULT_SCRIPT_CACHE_TTL_MS
        );
        const updateCheckIntervalMs = secondsToMilliseconds(
            manifest.updateCheckIntervalSeconds,
            DEFAULT_UPDATE_CHECK_INTERVAL_MS
        );
        const scriptEntries = getEnabledManifestEntries(manifest);

        const candidateEntries = getPageMatchingManifestEntries(manifest);

        if (!scriptEntries.length) {
            console.info('[TM bootstrap] Manifest loaded but contains no enabled scripts.');

            if (forceRefresh) {
                await showNoUpdatesModal();
            }

            return;
        }

        if (!candidateEntries.length) {
            console.info(`[TM bootstrap] No manifest entries matched ${location.href}`);

            if (forceRefresh) {
                await showNoUpdatesModal();
            }

            return;
        }

        const records = await Promise.allSettled(
            candidateEntries.map(entry => loadScriptRecord(entry, cacheBustEnabled, defaultScriptCacheTtlMs, { forceRefresh }))
        );

        const matchingRecords = records
            .flatMap(result => {
                if (result.status === 'fulfilled') {
                    return [result.value];
                }

                console.error('[TM bootstrap] Failed to fetch local script', result.reason);
                return [];
            })
            .filter(record => metadataMatchesCurrentPage(record.metadata));

        if (!matchingRecords.length) {
            console.info(`[TM bootstrap] No configured local scripts matched ${location.href}`);

            if (forceRefresh) {
                await showNoUpdatesModal();
            }

            return;
        }

        const approvedRecords = [];

        for (const record of matchingRecords) {
            try {
                if (await ensureRecordIsTrusted(record)) {
                    approvedRecords.push(record);
                }
            } catch (error) {
                console.error(
                    `[TM bootstrap] Refusing to load ${getDisplayName(record)} because trust validation failed`,
                    error
                );

                notifyUser(
                    'Script verification failed',
                    `${getDisplayName(record)} was blocked because its hash verification failed.`
                );
            }
        }

        if (!approvedRecords.length) {
            console.info('[TM bootstrap] No matching local scripts were approved for execution.');

            if (forceRefresh && approvalPromptCount === 0) {
                await showNoUpdatesModal();
            }

            return;
        }

        const executionResults = await Promise.allSettled(approvedRecords.map(executeScript));

        executionResults.forEach((result, index) => {
            if (result.status === 'rejected') {
                console.error(
                    `[TM bootstrap] Failed while executing ${approvedRecords[index].metadata.name || approvedRecords[index].url}`,
                    result.reason
                );
            }
        });

        if (forceRefresh && approvalPromptCount === 0) {
            await showNoUpdatesModal();
        }

        if (!forceRefresh && (shouldCheckForUpdates(updateCheckIntervalMs) || readUpdateStatus().hasUpdates)) {
            void checkForAvailableUpdates();
        }
    }

    registerUpdateBridge();

    init().catch(error => {
        console.error('[TM bootstrap] Unexpected loader failure', error);
    });
})();
