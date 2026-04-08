# New Project Wizard - Implementation Plan & Debugging Guide

## Current Status

**Branch:** `performance-graph-analysis-brace`

**Implementation:** Phase 1 complete (MVP) — Core wizard UI and template processing functional, but Sharp (image generation library) has native dependency loading issues on macOS arm64 builds.

**Last tested:** macOS arm64 packaged build fails to load Sharp's native `libvips` libraries when running the distributed app.

---

## Architecture Overview

The new project wizard generates SDK-compatible Ren'Py projects with custom colors and resolution. It replicates the behavior of the Ren'Py SDK's own project launcher wizard.

### User Flow

1. User clicks "Create New Project" (Welcome Screen or File → New Project, Ctrl+N)
2. 3-step wizard modal opens:
   - **Step 1:** Project name + location picker (browse button for directory selection)
   - **Step 2:** Resolution presets (720p, 1080p, 2K, 4K) + custom W×H inputs
   - **Step 3:** Theme toggle (dark/light) + 20 SDK color swatches + custom color picker with preview
3. Wizard calls `electronAPI.createProjectFromTemplate(options)`
4. Main process:
   - Resolves template source (SDK path or bundled fallback)
   - Copies template to project directory
   - Derives GUI colors from accent color + theme
   - Updates `gui.rpy` with resolution and colors
   - Updates `options.rpy` with project name and save directory
   - Generates GUI images (if Sharp loads successfully)
5. Renderer loads the newly created project

### Template Handling

**Priority 1: SDK template**
- Path: `{sdkPath}/gui/game/`
- Used if SDK path is configured in settings and template exists
- Always contains the latest Ren'Py defaults

**Priority 2: Bundled fallback**
- Path: `resources/renpy-template/`
- Used if SDK template not found
- **Manual setup required:** Copy SDK's `gui/game/` directory to `resources/renpy-template/`
- Must be populated before distribution builds

---

## Implementation Files

### React Components

**`components/NewProjectWizardModal.tsx`** (~470 lines)
- 3-step wizard modal using `useModalAccessibility` hook
- Step 1: Project name (text input) + location (browse button → `showSaveDialog`)
- Step 2: Radio buttons for resolution presets + custom W×H inputs (revealed when "Custom" selected)
- Step 3: Dark/Light theme toggle + 5×4 color swatch grid (10 dark + 10 light colors) + HTML5 color picker + preview
- Validation: Name not empty, path selected, valid resolution dimensions
- Calls `window.electronAPI.createProjectFromTemplate(options)` on final step
- Shows warning banner if SDK path not configured

### Main Process Modules (ES Modules)

**`lib/colorUtils.js`** (~290 lines)
- `RenpyColor` class: Parse hex colors, manipulate via `tint()`, `shade()`, `replaceHSVSaturation()`, `replaceValue()`, `replaceOpacity()`
- `deriveGuiColors(accentHex, isLight)`: Derives all 13 GUI color variables from user's accent color + theme choice
- `SDK_COLOR_SWATCHES`: 20 predefined accent colors (10 dark, 10 light) matching Ren'Py launcher
- Ports Python's PIL color manipulation logic to JavaScript (RGB ↔ HSV conversion, tinting, shading)

**Color derivation rules:**

| Variable | Dark Theme | Light Theme |
|---|---|---|
| `accent_color` | User-chosen | User-chosen |
| `hover_color` | `accent.tint(0.6)` | Same as accent |
| `muted_color` | `accent.shade(0.4)` | `accent.tint(0.6)` |
| `hover_muted_color` | `accent.shade(0.6)` | `accent.tint(0.4)` |
| `menu_color` | `accent` at 25% sat, 25% val | `accent` at 25% sat, 75% val |
| `title_color` | `accent` at 50% sat, 100% val | Same |
| `selected_color` | `#ffffff` (fixed) | `#555555` (fixed) |
| `idle_color` | `#888888` (fixed) | `#707070` (fixed) |
| `idle_small_color` | `#aaaaaa` (fixed) | `#606060` (fixed) |
| `text_color` | `#ffffff` (fixed) | `#404040` (fixed) |
| `insensitive_color` | `idle_color` at 50% opacity | Same |

**`lib/guiImageGenerator.js`** (~285 lines)
- Uses `sharp` npm package for image manipulation
- Generates 8 essential GUI image sets (Phase 1 MVP):
  1. **Button backgrounds** (`gui/button/idle_background.png`, `hover_background.png`) — solid rects with muted colors
  2. **Bar elements** (`gui/bar/left.png`, `right.png`, `top.png`, `bottom.png`) — progress bars in accent color
  3. **Scrollbar elements** (`gui/scrollbar/horizontal_*`, `vertical_*`) — rounded rects with accent/muted colors
  4. **Slider elements** (`gui/slider/horizontal_*`, `vertical_*`) — circular thumbs + thin bars
  5. **Textbox** (`gui/textbox.png`) — semi-transparent overlay (resolution-scaled)
  6. **Namebox** (`gui/namebox.png`) — small rounded rect for character names
  7. **Overlays** (`gui/overlay/main_menu.png`, `game_menu.png`, `confirm.png`) — full-screen semi-transparent overlays
- All images generated as SVG → PNG via Sharp
- **Future:** Port remaining 20+ image generation functions from SDK's `gui7/images.py`

**`lib/templateProcessor.js`** (~140 lines)
- `updateGuiRpy(filePath, width, height, colors)`: Regex replace `gui.init(w, h)` and all 13 `define gui.*_color` lines
- `updateOptionsRpy(filePath, projectName, saveDir)`: Regex replace `config.name`, `config.save_directory`, `build.name`
- `slugify(text)`: Convert project name to URL-safe slug (spaces → hyphens, lowercase, strip special chars)
- `sanitizeBuildName(text)`: Similar to slugify but allows underscores (for `build.name`)
- `generateSaveDirectory(projectName)`: Format: `{slug}-{timestamp}` (ensures uniqueness)

### Main Process Integration

**`electron.js`** (lines 717-830)
- `getTemplateSource(sdkPath)`: Tries SDK template first, falls back to bundled template
- `dialog:createProjectFromTemplate` handler:
  1. Create project directory
  2. Copy template via `fs.cp()`
  3. Derive colors via `deriveGuiColors()`
  4. Update `gui.rpy` and `options.rpy`
  5. Generate GUI images (lazy-loaded, optional)
  6. Create `images/` and `audio/` directories
  7. Return `{ success: true, path }` or `{ success: false, error }`

**Lazy-loading Sharp:**
```javascript
// Lazy-load on first use to avoid blocking app startup
if (!generateGuiImages && !sharpLoadError) {
  try {
    const imageGenModule = await import('./lib/guiImageGenerator.js');
    generateGuiImages = imageGenModule.generateGuiImages;
  } catch (loadError) {
    sharpLoadError = loadError;
    console.warn('Failed to load Sharp - using template defaults');
  }
}
```

### IPC Bridge

**`preload.js:6`**
```javascript
createProjectFromTemplate: (options) =>
  ipcRenderer.invoke('dialog:createProjectFromTemplate', options),
```

**`types.ts:1078-1090`**
```typescript
export interface CreateProjectOptions {
  projectDir: string;
  projectName: string;
  width: number;
  height: number;
  accentColor: string;  // hex string
  isLight: boolean;
  sdkPath?: string;
}
```

### App Integration

**`App.tsx:235`** — Added `wizardModalOpen` state
**`App.tsx:1938-1952`** — `handleCreateProject()` opens wizard, `handleWizardComplete()` loads project
**`App.tsx:4109-4115`** — Renders `<NewProjectWizardModal>` with `sdkPath` prop

---

## Known Issues

### 1. Sharp Native Dependencies Fail on macOS arm64 Builds

**Symptom:**
- App builds successfully
- On first launch: Menu bar appears but no window (Welcome Screen never renders)
- On second launch: JavaScript error dialog shows `dlopen` failure for `libvips-cpp.42.dylib`
- Error message: "Could not load the 'sharp' module using the darwin-arm64 runtime"

**Root cause:**
Sharp requires native libraries (`libvips`, `libvips-cpp`) that must be:
1. Built for the correct architecture (arm64 on Apple Silicon)
2. Unpacked from electron's asar archive
3. Correctly linked at runtime

**Current mitigation:**
- Sharp is lazy-loaded (not imported at top level) to avoid blocking app startup
- If Sharp fails to load, wizard falls back to template default images (non-critical)
- Project creation still works, just without custom-tinted GUI images

**Electron-builder config added:**
```json
"asarUnpack": [
  "node_modules/sharp/**/*"
]
```

This tells electron-builder to extract Sharp from the asar archive so its native binaries are accessible.

### 2. Bundled Template Not Populated

**Symptom:**
- If SDK path not configured, project creation fails with "template not found"

**Root cause:**
- `resources/renpy-template/` directory exists but is empty (only contains README.md)
- Requires manual population with SDK's `gui/game/` directory before distribution

**Solution:**
Before running `npm run dist`, copy Ren'Py SDK template:
```bash
cp -r /path/to/renpy-sdk/gui/game/* resources/renpy-template/
```

---

## Debugging Steps

### Test in Development Mode

```bash
# Start dev server
npm run dev

# In another terminal, start Electron
npm run electron:start
```

Check console logs (View → Toggle Developer Tools) for:
- "Using SDK template: ..." or "Using bundled template: ..."
- "Successfully loaded Sharp for GUI image generation" or "Failed to load Sharp module: ..."
- "Custom GUI images generated successfully" or "Skipping GUI image generation - using template defaults"

### Test Packaged Build

```bash
# Clean build
rm -rf release node_modules package-lock.json
npm install

# Rebuild Sharp for Electron (if installed)
npm install --save-dev @electron/rebuild
npx electron-rebuild -f -w sharp

# Build distributable
npm run dist

# Run packaged app (macOS)
open release/mac-arm64/Vangard-RenPy-renide.app
```

### Verify Sharp Installation

```bash
# Check Sharp installed correctly
npm list sharp

# Check Sharp's native binaries
ls -la node_modules/sharp/build/Release/
ls -la node_modules/@img/sharp-libvips-darwin-arm64/lib/

# Test Sharp in Node.js directly
node -e "const sharp = require('sharp'); console.log(sharp.versions)"
```

### Inspect Packaged App (macOS)

```bash
# Extract asar archive
npx asar extract release/mac-arm64/Vangard-RenPy-renide.app/Contents/Resources/app.asar /tmp/extracted-app

# Check if Sharp was unpacked
ls -la release/mac-arm64/Vangard-RenPy-renide.app/Contents/Resources/app.asar.unpacked/node_modules/sharp/

# Check if lib/ directory was packaged
ls -la /tmp/extracted-app/lib/
```

---

## Alternative Approaches

### Option 1: Remove Sharp Dependency (Simplest)

**Pros:**
- Eliminates native dependency issues
- Faster builds
- Smaller distributable size

**Cons:**
- Users can't generate custom-tinted GUI images
- Projects use template default images (typically blue/cyan accent)

**Implementation:**
1. Remove Sharp from dependencies
2. Remove `lib/guiImageGenerator.js`
3. Remove image generation step from `electron.js` handler
4. Document that users must manually replace GUI images if they want custom colors

### Option 2: Generate Images in Renderer (HTML Canvas)

**Pros:**
- No native dependencies
- Browser canvas API available in renderer process
- Same functionality as Sharp approach

**Cons:**
- More complex (need to pass images back to main process)
- Canvas API less powerful than Sharp

**Implementation:**
1. Move image generation logic to renderer
2. Use `<canvas>` to draw colored rectangles/shapes
3. Convert canvas to data URLs
4. Send data URLs to main process via IPC
5. Main process writes images to disk

### Option 3: Pre-generate Image Variants

**Pros:**
- No runtime generation needed
- Works with any accent color via CSS filters or dynamic tinting

**Cons:**
- Larger bundle size (multiple image sets)
- Less flexible than runtime generation

**Implementation:**
1. Pre-generate GUI images for ~10 common accent colors
2. Bundle them in `resources/gui-templates/{color}/`
3. Wizard copies the closest matching template
4. Or: Bundle grayscale images and tint them via CSS filters in Ren'Py

### Option 4: Invoke Ren'Py SDK's Own Image Generator

**Pros:**
- Identical output to Ren'Py launcher
- Leverages SDK's existing Python/PIL code
- No need to port image generation logic

**Cons:**
- Requires SDK to be installed and configured
- Slower (spawning Python process)
- More complex error handling

**Implementation:**
1. After creating project, spawn Ren'Py process: `{sdkPath}/renpy.py {projectDir} --regenerate-gui`
2. Wait for process to complete
3. Check for errors
4. Falls back to template defaults if SDK not available

---

## Recommended Next Steps

### Short-term (For this branch)

1. **Populate bundled template** before merging:
   ```bash
   # Copy from Ren'Py SDK
   cp -r ~/Downloads/renpy-8.x.x-sdk/gui/game/* resources/renpy-template/

   # Verify files copied
   ls resources/renpy-template/
   # Should see: gui.rpy, screens.rpy, options.rpy, script.rpy, gui/, etc.
   ```

2. **Test on multiple machines** (especially macOS arm64 and x64, Windows, Linux) to isolate Sharp loading issues

3. **Document Sharp issues** in release notes if merging before fix

### Medium-term (Follow-up PR)

4. **Fix Sharp native dependencies**:
   - Test with `@electron/rebuild`
   - Try alternative Sharp installation methods (e.g., `npm install --cpu=arm64 --os=darwin sharp`)
   - Consider using `electron-builder` plugins for native modules
   - Check Sharp's Electron compatibility matrix

5. **Add fallback UI feedback**:
   - Show toast notification if Sharp fails: "Using template default GUI images. For custom colors, check Settings → Advanced"
   - Add checkbox in wizard: "Generate custom GUI images (requires Sharp)" with tooltip

### Long-term (Future enhancement)

6. **Port remaining GUI image generation** from SDK's `gui7/images.py`:
   - 20+ additional image types (phone overlays, choice buttons with text, NVL mode textbox, etc.)
   - Full parity with Ren'Py launcher

7. **Consider Option 2 or 4** if Sharp issues persist:
   - Option 2 (Canvas API) avoids native dependencies entirely
   - Option 4 (invoke SDK) ensures perfect compatibility

---

## Testing Checklist

- [ ] Dev mode: Wizard opens and completes all 3 steps
- [ ] Dev mode: Project created with correct resolution in `gui.rpy`
- [ ] Dev mode: Colors derived correctly in `gui.rpy` (13 variables)
- [ ] Dev mode: Project name/save dir updated in `options.rpy`
- [ ] Dev mode: Sharp loads successfully (check console)
- [ ] Dev mode: GUI images generated in `game/gui/` subdirectories
- [ ] Dev mode: Created project loads and runs in Ren'Py
- [ ] Packaged build: App launches and shows Welcome Screen
- [ ] Packaged build: Wizard completes without errors
- [ ] Packaged build: Sharp loads or falls back gracefully
- [ ] Packaged build: Created project is valid
- [ ] SDK path not configured: Falls back to bundled template
- [ ] SDK path configured: Uses SDK template
- [ ] Custom color: All 13 color variables updated correctly
- [ ] Custom resolution: `gui.init()` updated correctly
- [ ] Light theme: Fixed colors use light theme values
- [ ] Dark theme: Fixed colors use dark theme values

---

## References

### Ren'Py SDK Source Code
- Project wizard: `/launcher/game/new_project.rpy`, `/launcher/game/gui7.rpy`
- Color derivation: `/launcher/game/gui7/parameters.py` (class `GuiParameters`)
- Image generation: `/launcher/game/gui7/images.py` (class `ImageGenerator`)
- Code generation: `/launcher/game/gui7/code.py` (class `CodeGenerator`)
- Default template: `/gui/game/` directory

### Sharp Documentation
- Installation: https://sharp.pixelplumbing.com/install
- Electron compatibility: https://sharp.pixelplumbing.com/install#electron
- Native modules: https://sharp.pixelplumbing.com/install#custom-libvips

### Electron Builder
- Native modules: https://www.electron.build/configuration/configuration#Configuration-asarUnpack
- Rebuilding native modules: https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules

---

## Questions for Future Investigation

1. **Why does Sharp fail only on the second launch?** (First launch shows no window, second launch shows error dialog)
2. **Does Sharp work in development mode?** (Test with `npm run electron:start`)
3. **Does `@electron/rebuild` help?** (Need to test on affected machine)
4. **Can we use Sharp in renderer process instead?** (Avoid main process native module issues)
5. **Do other Electron apps successfully bundle Sharp?** (Research case studies)
6. **Should we switch to a pure-JS image library?** (e.g., `pngjs`, `canvas`)

---

## Commit Message Template

When committing this branch:

```
feat: Add New Project Wizard with SDK-compatible template generation

Implements a 3-step wizard for creating Ren'Py projects with custom
colors and resolution, replicating the Ren'Py SDK launcher's workflow.

Features:
- Step 1: Project name + location picker
- Step 2: Resolution presets (720p/1080p/2K/4K) + custom dimensions
- Step 3: Theme toggle + 20 SDK color swatches + custom color picker
- Derives 13 GUI colors from user's accent choice (matches SDK logic)
- Updates gui.rpy with resolution and colors
- Updates options.rpy with project name and save directory
- Generates custom GUI images via Sharp (optional, with fallback)

Implementation:
- components/NewProjectWizardModal.tsx: Wizard UI
- lib/colorUtils.js: Color derivation (ports SDK's Python logic)
- lib/guiImageGenerator.js: Image generation via Sharp
- lib/templateProcessor.js: Template file regex updates
- electron.js: IPC handler for template-based project creation
- resources/renpy-template/: Bundled template fallback

Known Issues:
- Sharp native dependencies fail on macOS arm64 builds
- Lazy-loading Sharp to avoid blocking app startup
- Falls back to template default images if Sharp fails
- Bundled template requires manual population before distribution

See NEW_PROJECT_PLAN.md for debugging steps and alternative approaches.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```
