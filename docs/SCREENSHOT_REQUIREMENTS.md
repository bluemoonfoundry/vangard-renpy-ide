# Screenshot Requirements for Ren'IDE User Guide

This document lists all screenshots needed for the user guide, organized by section. Each screenshot should be saved in the `docs/images/` directory with the filename indicated.

## Screenshot Checklist

### Section 1: Introduction (3-4 screenshots)

- [ ] **intro-story-canvas.png** - Story Canvas showing a medium-sized project with visible blocks, arrows, and the diagnostic glow feature
- [ ] **intro-three-canvases.png** - Side-by-side comparison showing Story Canvas, Route Canvas, and Choice Canvas
- [ ] **intro-code-editor.png** - Monaco editor with IntelliSense popup showing label suggestions
- [ ] **intro-diagnostics-panel.png** - Diagnostics panel with a mix of errors and warnings

### Section 2: Getting Started (10-12 screenshots)

#### Installation
- [ ] **install-windows-smartscreen.png** - Windows SmartScreen warning dialog with "More info" button visible
- [ ] **install-windows-installer.png** - NSIS installer wizard (any step)
- [ ] **install-macos-dmg.png** - DMG window showing Ren'IDE icon and Applications folder
- [ ] **install-macos-gatekeeper.png** - macOS Gatekeeper warning dialog
- [ ] **install-linux-appimage.png** - Terminal showing chmod command and AppImage execution

#### First Launch
- [ ] **welcome-screen.png** - Welcome screen with "Open Existing Project" and "Create New Project" buttons, recent projects list
- [ ] **project-opened.png** - Ren'IDE immediately after opening a project (Story Canvas visible, file tree populated)

#### New Project Wizard
- [ ] **wizard-step1.png** - New Project Wizard Step 1 (name and location)
- [ ] **wizard-step2.png** - Step 2 (resolution presets)
- [ ] **wizard-step3.png** - Step 3 (theme and accent color)

#### SDK Configuration
- [ ] **settings-sdk-path.png** - Settings modal showing Ren'Py SDK section with path input and Test button
- [ ] **sdk-test-success.png** - Green checkmark after successful SDK path test

### Section 3: Interface Overview (8-10 screenshots)

#### Main Interface
- [ ] **interface-labeled.png** - Main interface with labeled callouts:
  - Toolbar (top)
  - Canvas Area (center)
  - Project Explorer (left)
  - Story Elements Panel (right)
  - Split Pane Editor (bottom)
  - Status Bar (bottom)

#### Toolbar
- [ ] **toolbar-closeup.png** - Close-up of toolbar showing all buttons clearly

#### Project Explorer
- [ ] **project-explorer.png** - Project Explorer with expanded folders
- [ ] **project-explorer-context-menu.png** - Right-click context menu on a .rpy file showing "Center on Canvas" option

#### Story Elements Panel
- [ ] **story-elements-characters.png** - Characters tab with several characters listed
- [ ] **story-elements-images.png** - Images tab with thumbnails visible
- [ ] **story-elements-composers.png** - Composers tab showing saved compositions

#### Editor
- [ ] **editor-split-pane.png** - Split pane editor showing two files side by side
- [ ] **editor-tabs.png** - Multiple editor tabs with one showing modified indicator

#### Themes
- [ ] **themes-comparison.png** - Two side-by-side screenshots showing a light theme and a dark theme

### Section 4: Core Features Tour (12-15 screenshots)

#### Story Canvas
- [ ] **story-canvas-basic.png** - Story Canvas with blocks arranged, showing jump/call arrows
- [ ] **story-canvas-diagnostic-glow.png** - Blocks with red and amber diagnostic glow visible
- [ ] **story-canvas-role-tinting.png** - Role tinting enabled, showing color-coded blocks
- [ ] **story-canvas-minimap.png** - Minimap visible in corner
- [ ] **story-canvas-legend.png** - Legend overlay explaining arrow types and colors
- [ ] **goto-label-palette.png** - Ctrl+G command palette open with search results

#### Route Canvas
- [ ] **route-canvas-basic.png** - Route Canvas showing label nodes and edges
- [ ] **route-canvas-menu-inspector.png** - Hover popover over a menu node showing choices
- [ ] **route-canvas-route-highlighting.png** - Route highlighting active, with one path highlighted
- [ ] **route-list-panel.png** - Route List panel showing multiple routes

#### Choice Canvas
- [ ] **choice-canvas-basic.png** - Choice Canvas showing menu nodes and choice pills
- [ ] **choice-canvas-conditional-badges.png** - Choice pills with conditional badges visible

#### Code Editor
- [ ] **editor-intellisense-jump.png** - IntelliSense showing label suggestions after typing "jump "
- [ ] **editor-snippet-expansion.png** - Snippet expanded with tab stops highlighted
- [ ] **editor-multi-cursor.png** - Multi-cursor editing in action

#### Search & Replace
- [ ] **search-panel.png** - Search panel with results listed

#### Diagnostics
- [ ] **diagnostics-panel-full.png** - Diagnostics panel with errors, warnings, and info items
- [ ] **diagnostics-severity-filter.png** - Severity filter checkboxes visible

#### Statistics
- [ ] **stats-panel.png** - Stats panel with per-character dialogue bar chart visible

### Section 5: For Writers (8-10 screenshots)

- [ ] **writer-story-canvas-organized.png** - Story Canvas with blocks spatially organized (main story center, side quests off to sides)
- [ ] **writer-character-filter.png** - Character filter dropdown in toolbox, showing dimmed blocks
- [ ] **writer-character-manager.png** - Characters tab with multiple characters
- [ ] **writer-character-editor.png** - Character Editor modal/panel with all fields visible
- [ ] **writer-menu-builder.png** - Menu Builder interface with choices configured
- [ ] **writer-route-canvas-path-trace.png** - Route Canvas with a highlighted path from start to ending
- [ ] **writer-choice-canvas-player-view.png** - Choice Canvas showing player-facing choice text
- [ ] **writer-sticky-notes.png** - Canvas with sticky notes attached to blocks
- [ ] **writer-goto-toolbox.png** - Go-to-Label toolbox search box with dropdown results

### Section 6: For Artists (10-12 screenshots)

#### Image Asset Manager
- [ ] **artist-images-tab.png** - Images tab with folder tree and thumbnails
- [ ] **artist-image-metadata.png** - Image Editor showing metadata fields (Ren'Py name, tags, subfolder)
- [ ] **artist-image-context-menu.png** - Right-click context menu on image showing "Copy scene statement"
- [ ] **artist-scan-external-directory.png** - Dialog for adding external scan directory

#### Audio Asset Manager
- [ ] **artist-audio-tab.png** - Audio tab with audio files listed
- [ ] **artist-audio-player.png** - Built-in audio player with controls visible

#### Scene Composer
- [ ] **artist-scene-composer-basic.png** - Scene Composer with background and sprites on stage
- [ ] **artist-scene-composer-transform-controls.png** - Transform controls panel showing zoom, flip, rotate, alpha, blur sliders
- [ ] **artist-scene-composer-layers.png** - Layer list showing multiple layers with drag handles
- [ ] **artist-scene-composer-generated-code.png** - Generated code displayed (can be a modal or code block)

#### ImageMap Composer
- [ ] **artist-imagemap-composer.png** - ImageMap Composer with ground image and hotspots drawn
- [ ] **artist-imagemap-hotspot-config.png** - Hotspot configuration panel showing action type and target label

#### Screen Layout Composer
- [ ] **artist-screen-composer.png** - Screen Layout Composer with widgets on stage
- [ ] **artist-screen-composer-widget-tree.png** - Widget hierarchy tree showing nested widgets

#### Drafting Mode
- [ ] **artist-drafting-mode-enabled.png** - Toolbar with Drafting Mode button highlighted/active

### Section 7: For Developers (8-10 screenshots)

- [ ] **dev-editor-advanced.png** - Monaco editor showing multi-cursor or column selection
- [ ] **dev-editor-find-replace.png** - Find/replace bar open with regex enabled
- [ ] **dev-syntax-highlighting.png** - Code with semantic token coloring visible (labels, variables, screens in different colors)
- [ ] **dev-snippets-tab.png** - Snippets tab showing built-in and user-defined snippets
- [ ] **dev-custom-snippet.png** - Custom snippet creation dialog with trigger prefix and content
- [ ] **dev-screen-composer-widgets.png** - Screen Layout Composer with widget palette showing available widgets
- [ ] **dev-screen-composer-properties.png** - Widget properties panel showing configurable properties
- [ ] **dev-diagnostics-detailed.png** - Diagnostics panel with detailed error messages and file/line info
- [ ] **dev-stats-complexity.png** - Stats panel showing branching complexity metrics
- [ ] **dev-sdk-running-game.png** - Ren'Py game window running alongside Ren'IDE (two windows side by side)

### Section 8: Complete Feature Reference (2-3 screenshots)

- [ ] **reference-canvas-controls.png** - Canvas controls (bottom-right) showing Fit-to-Screen and Go-to-Start buttons
- [ ] **reference-keyboard-shortcuts.png** - (Optional) Keyboard shortcuts modal if it exists in the app

### Section 9: Appendices (1-2 screenshots)

- [ ] **appendix-about-modal.png** - About modal showing version info (if available)

---

## Screenshot Guidelines

### Technical Requirements

- **Resolution:** Minimum 1920×1080 for main interface screenshots, higher if available
- **Format:** PNG (lossless)
- **DPI:** 144 DPI or higher for clarity in print
- **File size:** Compress without visible quality loss (use tools like TinyPNG or ImageOptim after capture)

### Capture Guidelines

1. **Clean Environment:**
   - Use a clean, representative project (not too cluttered, not empty)
   - Close unnecessary windows or applications in the background
   - Use a neutral theme (System Light or System Dark) for consistency
   - Ensure all UI elements are visible and readable

2. **Annotations:**
   - Add callout labels/arrows for complex screenshots (use tools like Skitch, Snagit, or Photoshop)
   - Keep annotations minimal and clear
   - Use consistent colors for callouts (e.g., red arrows, yellow highlights)

3. **Context:**
   - Capture enough context to understand what's being shown
   - For modals/dialogs, include a bit of the main window behind them
   - For closeups, ensure the surrounding UI is recognizable

4. **Consistency:**
   - Use the same theme throughout (recommend System Light for print, or System Dark for a modern look)
   - Use the same test project for all screenshots (creates continuity)
   - Maintain consistent window sizes

### Tools for Screenshots

**macOS:**
- Built-in: `Cmd+Shift+4` (select region), `Cmd+Shift+4` then `Space` (window)
- Professional: CleanShot X, Snagit

**Windows:**
- Built-in: `Win+Shift+S` (Snipping Tool in Windows 10/11)
- Professional: Snagit, Greenshot, ShareX

**Linux:**
- Built-in: `PrtScn` or Spectacle (KDE), GNOME Screenshot
- Professional: Flameshot, Shutter

### Test Project for Screenshots

Create a demo project with:
- 10-15 `.rpy` files representing chapters, scenes, endings
- 5-10 characters defined
- 10-15 images in `game/images/` (backgrounds, character sprites)
- 5-10 audio files in `game/audio/`
- Several menus with choices
- Mix of valid and invalid code (to show diagnostics)
- A few sticky notes on the canvas
- Saved compositions (Scene, ImageMap, Screen)

This ensures all features have something to display in screenshots.

---

## Organizing Screenshots

### Directory Structure

```
docs/
├── images/
│   ├── 01-intro/
│   │   ├── intro-story-canvas.png
│   │   ├── intro-three-canvases.png
│   │   └── ...
│   ├── 02-getting-started/
│   │   ├── install-windows-smartscreen.png
│   │   ├── welcome-screen.png
│   │   └── ...
│   ├── 03-interface/
│   ├── 04-core-features/
│   ├── 05-writers/
│   ├── 06-artists/
│   ├── 07-developers/
│   ├── 08-reference/
│   └── 09-appendices/
└── USER_GUIDE.md
```

### Inserting Screenshots into Markdown

Use this format:

```markdown
![Alt text description](images/02-getting-started/welcome-screen.png)

*Figure X: Caption describing what the screenshot shows*
```

Example:

```markdown
![Welcome Screen](images/02-getting-started/welcome-screen.png)

*Figure 2.1: The Ren'IDE Welcome Screen with options to open existing projects or create new ones*
```

Pandoc will automatically include these images in the PDF.

---

## Priority Screenshots

If you can only capture a subset initially, prioritize these for the most impact:

1. **interface-labeled.png** - Essential for understanding the UI
2. **story-canvas-basic.png** - Core feature visualization
3. **welcome-screen.png** - First-time user experience
4. **editor-intellisense-jump.png** - Key editor feature
5. **diagnostics-panel-full.png** - QA feature showcase
6. **artist-scene-composer-basic.png** - Visual composer demo
7. **writer-menu-builder.png** - Menu building workflow
8. **dev-screen-composer-widgets.png** - Developer tooling
9. **route-canvas-basic.png** - Alternate canvas view
10. **choice-canvas-basic.png** - Player perspective view

These 10 screenshots cover the most important features and give readers a comprehensive visual understanding.

---

## Notes

- Screenshots can be added incrementally (start with priority list, then add more)
- Ensure you have rights to any content shown in screenshots (use your own test project)
- Consider adding a watermark or copyright notice if distributing publicly
- Update this document as you capture screenshots (check off items in the list)

---

**Total Screenshots Needed:** 60-70 (minimum 10 priority screenshots)
**Estimated Time:** 3-5 hours for complete set with a prepared test project
