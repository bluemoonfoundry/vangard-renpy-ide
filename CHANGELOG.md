# Changelog

All notable changes to Vangard Ren'Py IDE are documented here.

---

## [v0.6.0] — Public Beta 3

### New Features

#### Editor & Workspace
- **Two-pane split editor** — split the center area right or bottom to view two tabs simultaneously. Tabs can be dragged between panes or moved via the right-click context menu. Closing a pane automatically merges its tabs back into the other pane.
- **Tab bar scroll buttons** — `‹` and `›` chevrons appear when there are more tabs than fit on screen, keeping the close-pane and filter buttons always visible.
- **Cursor position in status bar** — the status bar now shows `Ln N, Col N` for the active editor tab.
- **Minimap toggle** — a Minimap checkbox has been added to the canvas View Filters panel, letting you hide the minimap to reclaim space.

#### Image Viewer
- **Zoom and pan** — scroll to zoom in/out, drag to pan. A toolbar provides `−`/`+` buttons, a zoom percentage display, a **Fit** button, and a **1:1** (actual pixels) button. The image dimensions are also shown in the toolbar.

#### Story Analysis
- **Script statistics dashboard** — a new **Stats** tab shows total word count, estimated play time, per-character word breakdown (bar chart), lines-per-file chart, and a branching complexity score. Powered by Recharts.

#### Settings & Preferences
- **Configurable canvas/mouse preferences** — a new "Canvas & Mouse" section in Settings lets you choose:
  - Pan gesture: Shift+drag, drag, or middle-mouse drag
  - Middle mouse always pans (override)
  - Scroll zoom direction: normal or inverted
  - Scroll zoom sensitivity (0.5×–2.0×)

#### Stability & Distribution
- **Error boundary** — unhandled render errors now show a recovery UI instead of a blank screen.
- **Auto-updater** — the app checks for updates 5 seconds after launch (packaged builds only) and shows a toast when an update is available or ready to install. "Check for Updates" is also available in the Help menu.
- **Menu bar overhaul** — the menu bar now follows standard IDE conventions: Save All, Settings, Stop Project, Find in Files, and a Help menu with Keyboard Shortcuts, Documentation, and About.
- **Empty-canvas onboarding** — a hint overlay is shown on a blank canvas describing the key shortcuts (N, Shift+drag, Scroll, G).
- **In-app documentation link** — the About modal now includes a Documentation button that opens the GitHub wiki.

#### Developer
- **Vitest test suite** — 161 unit tests covering the Ren'Py analysis parser, undo/redo history hook, and file tree utilities.
- **ESLint** — flat config with TypeScript and react-hooks rules; `lint` and `lint:fix` scripts added.
- **CI gating** — GitHub Actions now runs lint and tests on every push/PR to `main`.

---

### Improvements

#### Character Editor
- **Dialogue color override** — dialogue color is now a separate opt-in with a checkbox. When unchecked, the field shows "Theme default" rather than sending an invisible `#ffffff` override to Ren'Py.
- **Slow-text controls** — slow text speed (chars/sec) and the "player can skip" checkbox are now revealed only when slow text is enabled, reducing visual noise.
- **Collapsible advanced section** — the right column (name/dialogue prefixes and suffixes, slow text, click-to-continue) is collapsed by default and can be expanded when needed.
- **Help text** — all advanced fields now have explanatory help text directly below them.
- **gui/ images excluded from Image Tag dropdown** — the dropdown no longer lists standard Ren'Py UI assets from the `game/gui/` folder.

#### Image & Audio Managers
- The default source view is now **Project** (was "All"), so project assets are shown immediately without filtering.
- Project view hides `game/gui/` assets by default. A "Show UI assets (gui/)" toggle is available when the Project source is selected.

---

### Bug Fixes

- **`call screen` parser false positive** — `call screen foo()` no longer produces an "Invalid jump: Label 'screen' not found" error. `screen` is a Ren'Py keyword in this context, not a label name; the parser now skips it the same way it already skipped `call expression`. ([#69](https://github.com/bluemoonfoundry/vangard-renpy-ide/issues/69))
- **Image viewer left-edge scroll** — zooming into an image no longer prevents scrolling to the left edge. The previous flex-centering approach clipped left-side overflow; replaced with computed padding so all four edges are equally reachable.
- **Character editor reset** — switching to "New Character" now correctly resets all 13 fields (previously only 5 core fields were reset, leaving stale values from the last edited character).
- **Keyboard Shortcuts modal** — the modal now reflects the user's current gesture settings rather than showing hardcoded defaults.
- **Auto-updater on first run** — gracefully handles the case where `latest.yml` does not exist yet (pre-release / no published release), avoiding an uncaught error on startup.
- **electron-updater import** — fixed CJS compatibility issue with the default import for `electron-updater`.

---

## [v0.5.0-beta] — prior release

The v0.5.0 beta introduced the Scene Editor visual designer, configurable UI themes, an Audio Manager with waveform preview, expanded Ren'Py analysis (screens, transforms, styles), and drag-and-drop asset import.
