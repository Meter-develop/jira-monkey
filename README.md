# Tampermonkey Jira Bundle

This folder contains a shareable Jira userscript setup built around a small bootstrap loader.

## Files in this shared package

This package contains:

- `Jira.loader.user.js` — manually installed trusted loader
- `Jira.js` — main Jira userscript
- `loader.manifest.json` — manifest loaded by the bootstrap
- `README.md` — installation and configuration notes

## Jira.js features

`Jira.js` is the main userscript in this package. It adds the following Jira board enhancements:

- story points on cards
- item counts and story-point totals in board columns
- simplified issue key display
- simplified subtask cards
- assignee first-name labels on board cards
- highlighting for issues assigned to the signed-in user
- avatar quick actions:
	- `Ctrl+click` opens Teams chat
	- `Shift+click` opens a mail draft
- focus mode toggle with the `B` shortcut
- swimlane sorting
- done-subtask sorting
- backlog and sprint-board support
- local settings UI for enabling or disabling features

## How sharing works

1. The user manually installs `Jira.loader.user.js` in Tampermonkey.
2. The loader fetches the manifest and only downloads scripts that match the current page according to manifest rules and userscript metadata.
3. New or changed remote manifests and scripts only load after local approval.
4. When possible, the approval modal includes a clickable GitHub diff/history/file review link plus an open-in-new-tab action before approval.
5. The loader also performs periodic passive update checks on matching pages and can signal when updates are available.
6. The manually installed `Jira.loader.user.js` is also checked separately for newer versions.
7. Manual update checks still run in place: they either show the changed-file approval flow, a manual-loader-update message, or a modal saying no update is available.

For efficiency, the bootstrap keeps a short local cache of fetched sources:

- manifest responses are cached for about 5 minutes
- script responses are cached for 15 minutes by default
- passive update checks run about once per hour on matching pages by default
- setting `cacheBust: true` in the manifest switches back to always-fresh dev-style fetching
- use `Update now` in the Jira settings panel or `TM Bootstrap: Check for updates now` in Tampermonkey to immediately check the latest manifest and matching scripts; the page only reloads when an approved update needs to be applied

When a passive check detects a newer loader, manifest, or script, the Jira settings cog turns red until you manually run `Update now`. If the loader itself is outdated, the loader update takes priority and you are prompted to update that manually in Tampermonkey before applying other updates.

Update modals stay open until you use one of their buttons, so no more accidental backdrop or Escape-key vanish acts.

The manually installed loader is the trusted anchor.

## Before another user installs it

They should review and, if needed, adjust:

- `MANIFEST_URL` in `Jira.loader.user.js`
- `@connect` in `Jira.loader.user.js`
- `@namespace` in `Jira.loader.user.js`
- `SP_FIELD` in `Jira.js` if their Jira instance uses a different Story Points field ID

By default, this shared package points to:

- `https://raw.githubusercontent.com/Meter-develop/jira-monkey/main/loader.manifest.json`

## Email domain quick actions

The Jira avatar quick actions no longer contain a hardcoded organization email domain.

On first use, the script prompts the user for their organization email domain and stores it locally.

## Manifest note

`loader.manifest.json` in this folder is the active shareable manifest and only loads `Jira.js`.

The shared manifest now also includes Jira page-match rules so the loader can skip downloading `Jira.js` on unrelated sites.

The loader now also hashes and locally approves the manifest itself before trusting it.
