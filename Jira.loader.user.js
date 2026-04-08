// ==UserScript==
// @name         Local Tampermonkey Bootstrap
// @namespace    https://github.com/Meter-develop/jira-monkey/
// @version      3.3
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
    const MANIFEST_EXPECTED_HASH = '';
    const TRUST_STORE_KEY = 'tm-bootstrap-approved-script-hashes-v1';
    const DEFAULT_MANIFEST = {
        cacheBust: true,
        scripts: []
    };
    const loadedScriptUrls = new Set();

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

    function getTrustKey(record) {
        return record.kind === 'manifest'
            ? `manifest:${record.url}`
            : record.url;
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
        const reviewInfo = await getReviewInfo(record, previousHash);

        if (reviewInfo?.url) {
            openReviewLink(reviewInfo.url);
        }

        const approved = window.confirm(
            [
                `[TM bootstrap] ${getDisplayName(record)} has a ${actionLabel} version.`,
                '',
                `URL: ${record.url}`,
                reviewInfo?.url
                    ? `${reviewInfo.label}: ${reviewInfo.url}`
                    : 'Review the source before approving this version.',
                '',
                'Approve this version and allow it to load?'
            ].filter(Boolean).join('\n')
        );

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
            return true;
        }

        return promptForApproval(record);
    }

    function installManagementMenu() {
        if (typeof GM_registerMenuCommand !== 'function') {
            return;
        }

        GM_registerMenuCommand('TM Bootstrap: Clear approved hashes', async () => {
            const confirmed = window.confirm('Clear all locally approved manifest and script hashes for the bootstrap loader?');

            if (!confirmed) {
                return;
            }

            await clearTrustStore();
            notifyUser('Approved hashes cleared', 'The next manifest or script load will require approval again.');
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

    function fetchText(url) {
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

    async function fetchJson(url) {
        return JSON.parse(await fetchText(url));
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
        const source = await fetchText(rawUrl);
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

    async function loadManifest() {
        try {
            const raw = await fetchText(appendCacheBust(MANIFEST_URL, true));
            const manifestRecord = {
                kind: 'manifest',
                displayName: 'loader.manifest.json',
                url: MANIFEST_URL,
                source: raw,
                sourceHash: '',
                expectedHash: MANIFEST_EXPECTED_HASH
            };

            if (!(await ensureRecordIsTrusted(manifestRecord))) {
                console.info('[TM bootstrap] Manifest was not approved, so no local scripts were loaded.');
                return DEFAULT_MANIFEST;
            }

            const parsed = JSON.parse(raw);

            if (!Array.isArray(parsed?.scripts)) {
                throw new Error('Manifest is missing a scripts array');
            }

            return parsed;
        } catch (error) {
            console.warn('[TM bootstrap] Failed to load manifest; no local scripts will be loaded until loader.manifest.json is reachable again.', error);
            return DEFAULT_MANIFEST;
        }
    }

    function normalizeManifestEntry(entry, manifestUrl) {
        if (typeof entry === 'string') {
            return {
                enabled: true,
                url: new URL(entry, manifestUrl).toString()
            };
        }

        if (entry && typeof entry === 'object' && typeof entry.url === 'string') {
            return {
                enabled: entry.enabled !== false,
                url: new URL(entry.url, manifestUrl).toString(),
                hash: typeof entry.hash === 'string' ? entry.hash : undefined,
                expectedHash: typeof entry.expectedHash === 'string' ? entry.expectedHash : undefined,
                sha256: typeof entry.sha256 === 'string' ? entry.sha256 : undefined
            };
        }

        return null;
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

    function metadataMatchesCurrentPage(metadata) {
        const hasMatchRules = metadata.match.length > 0 || metadata.include.length > 0;

        if (metadata['exclude-match'].some(pattern => matchesPattern(pattern))) {
            return false;
        }

        if (metadata.exclude.some(pattern => matchesPattern(pattern))) {
            return false;
        }

        if (metadata.match.length > 0) {
            return metadata.match.some(pattern => matchesPattern(pattern));
        }

        if (metadata.include.length > 0) {
            return metadata.include.some(pattern => matchesPattern(pattern));
        }

        return !hasMatchRules || true;
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

    async function loadScriptRecord(entry, cacheBustEnabled) {
        const requestUrl = appendCacheBust(entry.url, cacheBustEnabled);
        const source = await fetchText(requestUrl);
        const metadata = parseUserscriptMetadata(source);

        return {
            entry,
            url: entry.url,
            source,
            metadata,
            sourceHash: ''
        };
    }

    async function init() {
        installManagementMenu();

        const manifest = await loadManifest();
        const cacheBustEnabled = manifest.cacheBust !== false;
        const scriptEntries = (manifest.scripts || [])
            .map(entry => normalizeManifestEntry(entry, MANIFEST_URL))
            .filter(entry => entry?.enabled);

        if (!scriptEntries.length) {
            console.info('[TM bootstrap] Manifest loaded but contains no enabled scripts.');
            return;
        }

        const records = await Promise.allSettled(
            scriptEntries.map(entry => loadScriptRecord(entry, cacheBustEnabled))
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
    }

    init().catch(error => {
        console.error('[TM bootstrap] Unexpected loader failure', error);
    });
})();
