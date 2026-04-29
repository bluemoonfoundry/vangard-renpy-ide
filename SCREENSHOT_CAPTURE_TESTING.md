# Screenshot Capture Feature - Testing Guide

## Architecture: Main-Process Driven

The screenshot capture is now handled **entirely in the main process** to ensure it works even during renderer crashes, black screens, and freezes.

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ User presses Cmd+Shift+C (or Ctrl+Shift+C on Windows/Linux) │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │ Main Process (electron.js)    │
         │ globalShortcut.register()     │
         └───────────────┬───────────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │ webContents.capturePage()     │
         │ (Bypasses renderer completely)│
         └───────────────┬───────────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │ Save PNG to                   │
         │ .renide/screenshots/          │
         └───────────────┬───────────────┘
                         │
                ┌────────┴────────┐
                │                 │
                ▼                 ▼
    ┌──────────────────┐  ┌─────────────────────┐
    │ Native OS        │  │ Try to notify       │
    │ Notification     │  │ renderer (optional) │
    │ (Always works)   │  │ - Show toast        │
    └──────────────────┘  │ - Update count      │
                          │ - Update status bar │
                          └─────────────────────┘
```

## Why This Approach?

### Problem with Renderer-Dependent Capture
When the app crashes or shows a black screen (the exact moment you want a screenshot), the renderer is frozen/dead and can't handle keyboard shortcuts or IPC calls.

### Solution: Main-Process Capture
The global shortcut is handled directly in the main process, which remains alive even when the renderer crashes. The screenshot is captured and saved before the renderer is even notified.

## Testing Scenarios

### 1. Normal Operation (Renderer Alive)
**Expected behavior:**
- Press `Cmd+Shift+C`
- Native OS notification appears: "Screenshot Captured"
- In-app toast appears: "Screenshot saved: renide-screenshot-..."
- Status bar camera icon updates count
- File saved to `.renide/screenshots/`

**How to verify:**
```bash
# After pressing Cmd+Shift+C:
ls -la .renide/screenshots/
# Should show new PNG file with timestamp
```

### 2. Renderer Frozen/Crashed (Critical Test)
**How to simulate:**
```javascript
// Open DevTools (Cmd+Option+I)
// In Console, run:
while(true) {}  // This freezes the renderer
```

**Expected behavior:**
- Press `Cmd+Shift+C` (while renderer is frozen)
- Native OS notification STILL appears
- Screenshot STILL saved to disk
- In-app toast will NOT appear (renderer is frozen)
- Status bar will NOT update (renderer is frozen)
- **But the screenshot file exists!** ← This is the key success criterion

**How to verify:**
```bash
# While app is still frozen, check filesystem:
ls -la .renide/screenshots/
# Should show the new screenshot even though UI didn't update
```

### 3. Black Screen / DevTools Error
**How to simulate:**
- Trigger any React error that causes a black screen
- Or force a DevTools crash

**Expected behavior:**
- Same as scenario 2: screenshot captures regardless of renderer state
- Native notification appears
- File is saved

### 4. OS Notification Click
**Expected behavior:**
- Click the native notification
- Screenshots folder opens in Finder/Explorer

**How to verify:**
- Press `Cmd+Shift+C`
- When notification appears, click it
- Folder should open showing all screenshots

### 5. Status Bar Features (When Renderer Alive)
**Camera Icon:**
- Click → Opens screenshots folder
- Right-click → Shows context menu:
  - "Open Screenshots Folder"
  - "Copy Latest Screenshot Path"
  - "Clear All Screenshots"

**Badge Count:**
- Shows number of screenshots
- Only appears after first screenshot
- Updates after each capture (if renderer alive)

### 6. File Menu
**"Open Screenshots Folder" entry:**
- Greyed out when no screenshots exist
- Enabled when screenshots exist
- Opens folder when clicked

## File Locations

| Platform | Screenshots Folder |
|----------|-------------------|
| macOS | `{ProjectRoot}/.renide/screenshots/` |
| Windows | `{ProjectRoot}\.renide\screenshots\` |
| Linux | `{ProjectRoot}/.renide/screenshots/` |

## Filename Format
```
renide-screenshot-2026-04-29T15-02-49.png
                  └──────┬──────┘ └─┬─┘
                    ISO date      time
```

## Fallback Mechanisms

1. **Primary**: Global shortcut in main process
2. **Native notification**: Always works (OS level)
3. **Renderer notification**: Best-effort (IPC event)
4. **Status bar UI**: Best-effort (React state update)
5. **In-app toast**: Best-effort (requires renderer alive)

## Known Limitations

- **Screenshot count** won't update in status bar until renderer recovers
- **In-app toast** won't show during crashes (but native notification will)
- **Context menu** actions require renderer to be alive

## Success Criteria

✅ Screenshot saves even when renderer is frozen  
✅ Native notification appears even during crashes  
✅ File written to disk regardless of UI state  
✅ Screenshot count refreshes when app recovers  
✅ Click notification to open folder works  
✅ Status bar UI updates (when renderer alive)  

## Debugging

Check main process logs:
```bash
# macOS
tail -f ~/Library/Logs/renide/main.log

# Windows
type %USERPROFILE%\AppData\Roaming\renide\logs\main.log

# Linux
tail -f ~/.config/renide/logs/main.log
```

Look for:
```
[RenIDE] Screenshot captured: renide-screenshot-2026-04-29T15-02-49.png
```

Or errors:
```
[RenIDE] Failed to capture screenshot: ...
```

## Code References

| File | Purpose |
|------|---------|
| `electron.js:730-780` | Global shortcut handler (main capture logic) |
| `preload.js:133-142` | IPC bridge for screenshot APIs |
| `src/App.tsx:3968-3981` | Renderer listener for screenshot events |
| `src/components/StatusBar.tsx:60-115` | Camera icon UI with context menu |

