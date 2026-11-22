[English](README.en.md) | [简体中文](README.md)

# Thunder68 Local Driver (Personal Offline Edition)

A personal offline Electron desktop wrapper for the official DAREU Thunder68 WebHID configurator, offering offline execution, persistent light/dark workbench themes, USB wired and 2.4G wireless dongle support, local profile import, and read-back verification.

> **Scope & Licensing Notice**: This project is **not** an official DAREU Windows driver and does not install or replace any OS driver. The configuration UI and low-level WebHID protocol come from `https://oem.dareu.com/thunder68` (first captured on 2026-10-06 for personal offline use). The public repository **does not** bundle official vendor assets or distribute binaries containing them. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for full boundaries.

---

## Quick Start (Portable Build)

1. Double-click `release/Thunder68-Local/Thunder68-Local.exe`. Keep the entire folder intact (you can move or copy the whole folder elsewhere; no Node.js, browser, or internet connection required).
2. Connect your Thunder68 via **USB cable** or **2.4G wireless dongle**, then click **Connect Keyboard (连接键盘)** in the app.
   - If the official web configurator is still connected to the keyboard, disconnect or close that browser tab first.
   - When multiple Thunder68 devices are detected (e.g., both USB wired and 2.4G receiver plugged in), the app shows a device picker dialog listing connection type and PID.
   - In 2.4G mode, official dongle pairing and disconnect confirmation modals display properly centered; once connected, the sidebar and status header show connection mode, 2.4G battery percentage, and official core version.
3. Adjust key mappings, lighting, rapid trigger, advanced keys, game profiles, or general settings. You can also use the footer's **Import Config (导入配置)** button to load an existing profile, or **Re-read & Verify (重新读取核对)** to reconnect and compare read-back device state.
4. Close the window to exit. Launching a second instance focuses the existing window via single-instance lock.

Local profile data and diagnostic logs are stored in the `data/` directory beside the executable (if the directory is read-only, the app automatically falls back to the OS userData directory and logs the fallback). Diagnostics record only connection state, HID report byte lengths, and errors — never typed text. Open the folder anytime via **Driver → Open Local Data Folder** (press `Alt` to reveal the menu bar).

---

## Features & Recent Improvements (v0.2.1)

- **Strict Offline Isolation**: Serves local assets through a custom asynchronous `thunder68://driver` protocol with strict CSP and request interception blocking all remote traffic.
- **USB Wired & 2.4G Wireless Support**:
  - Preserves official sidebar modals (2.4G dongle pairing and disconnect dialogs) and the hidden `#fileInput` element, exposing an **Import Config** action in the footer.
  - Parses and displays connection mode (USB Wired / 2.4G Wireless), 2.4G battery level, and official bundle version.
- **Bilingual UI Compatibility & Workbench Redesign**:
  - Responsive two-column workbench on wide windows and vertical stacking on narrow viewports, with Dark, Light, and System themes persisted locally.
  - Preserves the official keyboard photo and native Canvas hit testing while adding batch selection (WASD, Letters, All, Invert, per-key chips) and a searchable key palette (distinguishing main-row digits, numpad keys, and left/right modifiers).
  - Shell adapter (`app/shell-helpers.js` + `app/ui.js`) matches **both Chinese and English labels** with structural DOM fallbacks (top navigation, exit button, lighting subtabs, all five keymap categories including macro grid, quick-select menu, loading overlay, and reset buttons).
- **Reliable Feedback & Read-Back State Machine**:
  - Decouples HID diagnostic log sampling from UI output feedback debouncing, and isolates page script errors from USB/2.4G HID transport errors.
  - **Re-read & Verify** uses an explicit state machine (`createVerifyStateMachine`) that only reports completion after a real disconnect/reconnect cycle and a stable 68-key read-back, preventing false positives from `redux-persist` cache.
- **v0.2.0 / v0.2.1 Fixes**: Reorganized workbench layout; fixed overlay z-index over the header, tiny media key labels, cramped advanced-key descriptions, oversized game profile tabs, hidden combination-key modifiers, truncated macro grids, and stale proxy clicks across category switches; warns when batch-editing keys with mixed values.

---

## Building & Developing from the Public Repository

### Prerequisites

- Windows
- Node.js (with `node:test`, Node 20+ recommended) and `npm`

### First-Time Setup

```powershell
# 1. Install dependencies (Electron ^44.5.1)
npm ci

# 2. Fetch official static assets locally into app/vendor/
npm run sync

# 3. Start the desktop app in development mode
npm start
```

- **Asset Sync**: `npm run sync` downloads assets directly from the official site into `app/vendor/` using `research/asset-paths.json` plus references discovered from HTML/CSS/JS, generating `app/vendor/manifest.json` with SHA256 hashes (including `/thunder68/index.html`). Any download failure exits non-zero. To force a clean re-download and prune stale files:
  ```powershell
  node scripts/sync-official.cjs --force
  ```
- **Manual Electron Runtime Download**: If `npm ci` fails to fetch the Electron binary, run `node scripts/download-runtime.cjs` (add `--mirror` for faster ranged mirror downloads). Downloaded archives are always verified against Electron's official `checksums.json` SHA256.

### Testing, Packaging & Auditing

```powershell
# Run all 23 unit tests (core device/path security, bilingual adapter, key classifier, feedback/verify state machines, build/audit scripts)
npm test

# Build local portable package into release/Thunder68-Local/ (mirrors app/, excludes debug files, prunes orphans)
npm run build

# Verify vendor SHA256 hashes, static asset routing, and release/ parity (writes output/package-audit.json)
npm run audit:package

# Headless offscreen Electron self-test (no visible window, writes output/self-test.json)
npx electron . --self-test --background-test
```

### Pre-Redesign Source Tag

Earlier self-authored source prior to the v0.2 redesign is preserved at tag `pre-ui-redesign-20261006`. After saving uncommitted changes, run `git switch --detach pre-ui-redesign-20261006` to inspect it. Git switches only tracked self-authored source; ignored local vendor assets and runtime data remain untouched. Public clones do not contain `research/official-main.js`, `research/decoded.js`, or local deobfuscation scripts.

---

## Known Boundaries & Verification Status

### Capability & Compliance Limits

- **Remote Services Excluded**: The embedded online keyboard tester (`kbtest5.driveall.cn`), online firmware version checks, and DFU firmware updates depend on remote servers and are intentionally blocked/excluded. Use the official website for firmware upgrades.
- **No Official React Source**: Only the compiled static bundle (fetched locally via `npm run sync`) is present — no original React source, TypeScript definitions, or source maps.
- **No Startup Auto-Restore Yet**: Applying settings automatically on OS startup is not implemented. Seeing "sent" in the UI or saved local state does not by itself prove the keyboard persisted settings across power cycles.

### Verification Status (Honest Scope)

- **Verified**: All 23 automated unit tests (`npm test`), static integrity audit across 220 vendor assets and 231 packaged app files (`npm run audit:package`), headless Electron self-test, dark/light/system theme switching & reload persistence, three viewport sizes (1024×720, 1400×940, 1920×1080), all six navigation pages, key selection/search, and read-only USB connection & re-read comparison (error banners checked via simulated events).
- **Not Yet Hardware-Verified Item by Item**: Actual hardware writes and read-backs for key remapping, lighting parameters, actuation/RT travel, macros, and advanced keys; persistence across unplug/power-loss/reboot; end-to-end 2.4G pairing and write verification on physical hardware.

---

## Documentation & License

- Architecture & Maintenance Guide (Chinese): [DEVELOPMENT.md](DEVELOPMENT.md)
- AI Agent & Engineering Guidelines (Chinese): [AGENTS.md](AGENTS.md)
- Third-Party Sources & Licensing Boundaries (Chinese): [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
- Self-authored code license: MIT ([LICENSE](LICENSE))
