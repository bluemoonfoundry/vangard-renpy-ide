# Changelog

All notable changes to Ren'IDE are documented here.

## [Unreleased]

### Security
- **FIXED:** XSS vulnerability in Markdown preview - Added DOMPurify sanitization to prevent potential script injection through user-controlled Markdown files (#134)

## [v0.8.0] - Current Feature Set

### Added

- Three canvases for story structure, route flow, and player choice flow
- Monaco editor with split panes, Ren'Py syntax highlighting, autocomplete, and snippets
- Story Elements tools for characters, variables, screens, assets, composers, snippets, menu templates, and colors
- Diagnostics, stats, and translation dashboard tabs
- Project Explorer actions for create, rename, delete, refresh, and clipboard workflows
- Project search and replace with regex and whole-word support
- Markdown preview for `.md` files
- Run Project and Warp to Label launch support
- Drafting Mode for placeholder assets during development
- First-run tutorial, bundled user guide, keyboard shortcuts help, and auto-updater support
- External file change detection so outside edits are noticed automatically

### Improved

- Go-to-label navigation is available from the canvases and the global `Ctrl+G` palette
- `Ctrl+W` closes the active tab instead of quitting the app
- The Stats tab includes live project performance metrics
- The File menu exposes explorer actions for keyboard-first workflows
- Translation generation is available through the configured Ren'Py SDK

### Removed

- AI story generation and its related settings

## [v0.7.0]

### Highlights

- Introduced the ImageMap Composer
- Introduced the Screen Layout Composer
- Added the diagnostics panel and the stats dashboard
- Added user snippets and markdown preview
- Expanded accessibility, performance, and project tooling

## [v0.6.0]

### Highlights

- Two-pane split editor
- Image viewer zoom and pan
- Script statistics dashboard
- Configurable canvas and mouse preferences
- Error boundary and auto-updater support

---

Older release history remains in git history and can be restored if needed.
