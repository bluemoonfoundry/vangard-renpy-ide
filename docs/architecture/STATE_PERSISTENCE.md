# State Persistence Architecture

Ren'IDE splits persisted state across four locations, each with a different owner, scope, and write trigger.

---

## 1. Overview

| Location | Scope | Written by | When |
|---|---|---|---|
| `<project>/game/project.ide.json` | Per-project | Renderer → IPC → Main | Save All, app exit |
| `<project>/**/*.rpy` | Per-file | Renderer → IPC → Main | Save All, app exit, tab close |
| `userData/app-settings.json` | Global (all projects) | Main process | Settings change |
| `userData/api-keys.enc` | Global | Main process (encrypted) | API key save |

`userData` is the Electron user data directory (`app.getPath('userData')`): `%APPDATA%\ren-ide` on Windows, `~/Library/Application Support/ren-ide` on macOS, `~/.config/ren-ide` on Linux.

---

## 2. Project Settings (`game/project.ide.json`)

A single JSON file in the project's `game/` directory holds all IDE-specific project metadata. It is never read by Ren'Py — only by the IDE.

**What lives here:**

| Category | Examples |
|---|---|
| Canvas layout | Block positions, sizes, colors; layout mode and fingerprint; group containers |
| Sticky notes | Content, position, color for all three canvases |
| Compositions | Scene, imagemap, and screen layout composer data |
| Character profiles | Tag → display name mappings |
| Diagnostics tasks | Task list (migrated from legacy `punchlistMetadata`) |
| Ignored diagnostics | Suppression rules |
| Open tabs / active tab | Session state (restored on reopen) |

**Decision rule for new state:** If the data is meaningful only within a specific project (canvas positions, compositions, tasks), it belongs here. If it applies across all projects (theme, font, Ren'Py path), it belongs in `app-settings.json`.

### Save triggers

Project settings are **not saved on a timer**. They are written to disk when:
- The user presses **Ctrl+S / Save All**
- A dirty tab is closed (before close confirmation)
- The app receives the `save-ide-state-before-quit` event (just before exit)

Individual `.rpy` files follow the same triggers — dirty file content is written at Save All or exit, not periodically.

### Layout versioning

Canvas layouts are fingerprinted on load:

```
computeStoryLayoutFingerprint(blocks, links, layoutMode, groupingMode)
getStoryLayoutVersion()
```

If the stored fingerprint doesn't match the current algorithm version, the layout is recalculated automatically and the new positions are offered to the user. This is the mechanism for non-breaking layout algorithm upgrades.

---

## 3. App Settings (`userData/app-settings.json`)

Stores user preferences that are not project-specific. Written by the main process whenever a preference changes.

**What lives here:** theme, sidebar widths, editor font family and size, Ren'Py SDK path, mouse gesture settings, recent projects list (capped at 25), last browsed directory.

An `RENIDE_SETTINGS_OVERRIDE` environment variable (JSON string) is merged over the saved file at startup, which is useful for CI and testing without touching the actual settings file.

---

## 4. API Keys (`userData/api-keys.enc`)

API keys are encrypted using Electron's `safeStorage` API, which delegates to the OS keychain (Windows DPAPI, macOS Keychain, Linux libsecret). The stored file contains the entire key payload as a single encrypted blob — decrypted only in the main process, never sent to the renderer in plaintext.

**IPC interface:**
- `app:load-api-keys` → main decrypts and returns the key map
- `app:save-api-key` → main encrypts and writes the updated map

If `safeStorage.isEncryptionAvailable()` returns false (e.g., headless Linux without a keyring), the handlers degrade gracefully — keys are not persisted rather than stored in plaintext.

---

## 5. File Watcher

The main process watches the project folder for external `.rpy` changes using Node's `fs.watch()` with two guards to prevent false positives.

### Debounce

File system events are debounced at `WATCH_DEBOUNCE_MS = 400 ms`. Rapid successive events for the same file (common during editor saves) collapse into one notification.

### Self-write suppression

When the IDE writes a file via the `fs:writeFile` IPC handler, it records a timestamp in `recentSelfWrites` (a `Map<path, timestamp>`). The watcher ignores any change event for that path within `SELF_WRITE_SUPPRESS_MS = 3000 ms` of that timestamp. This prevents the IDE from reacting to its own writes.

```
pointerdown on Save
  → fs:writeFile (renderer → main)
      → file written to disk
      → recentSelfWrites.set(path, Date.now())
  fs.watch fires (within 3 s)
      → suppressed (self-write guard)
```

### Renderer response

When an external change passes both guards, the main process fires `fs:file-changed-externally` with `{ relativePath, absolutePath }`. The renderer then:
- **Auto-reloads silently** if the block's editor is clean (no unsaved changes)
- **Shows a warning bar** ("Reload" / "Keep my changes") if the editor is dirty

### Refresh Project

The `project:refresh` IPC handler performs a full reconciliation — re-reads all `.rpy` files, images, and audio assets from disk and returns the same structure as `project:load`. The renderer merges the result with current state, queueing dirty-file conflict warnings for any files that changed externally while the editor has unsaved edits. This is triggered by **File → Refresh Project** or the Project Explorer context menu.

---

## 6. Migration Patterns

When a persisted data format changes, add a migration function and call it in the `project:load` path. The pattern:

1. **Detect the old format** — check for the presence of the legacy field (not the absence of the new one, since new projects will also lack it).
2. **Convert in memory** — produce the new format from the old data.
3. **Let the next Save All write the new format** — do not write immediately on load; the migration is only committed when the user saves.
4. **Keep the old field readable for one release** — remove it in the following release once all projects have been migrated.

**Existing migrations:**

| Old format | New format | Trigger field |
|---|---|---|
| `punchlistMetadata` (sticky-note task map) | `diagnosticsTasks` array | Presence of `punchlistMetadata` key |
| Tab type `'punchlist'` | Tab type `'diagnostics'` | `tab.type === 'punchlist'` |
| Single scene composition (flat object) | Multi-scene map keyed by `'scene-default'` | Shape of `sceneCompositions` value |

The layout fingerprint system (Section 2) handles layout algorithm upgrades without a migration function — it just recalculates.
