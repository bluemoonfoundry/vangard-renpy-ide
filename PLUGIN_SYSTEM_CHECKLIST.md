# Plugin System - Testing Checklist

## ✅ Implementation Complete

### Core Infrastructure
- [x] Plugin type system (`src/types.ts`, `src/plugins/pluginTypes.ts`, `src/types.d.ts`)
- [x] Plugin loader with discovery and validation (`src/plugins/pluginLoader.ts`)
- [x] Plugin context and APIs (`src/plugins/PluginContext.tsx`, `src/plugins/builtInApis.ts`)
- [x] Error boundary (`src/plugins/PluginErrorBoundary.tsx`)
- [x] Plugin manager (`src/plugins/PluginManager.tsx`)
- [x] App.tsx integration (state, rendering, persistence)
- [x] IPC method for directory listing (`electron.js`, `preload.js`)
- [x] Sample Hello World plugin built and installed

### Files Added/Modified
- **8 new plugin system files** in `src/plugins/`
- **1 sample plugin** in `plugins/example-hello-world/`
- **Modified**: `src/App.tsx`, `src/types.ts`, `electron.js`, `preload.js`
- **Total**: ~1,900 lines of code

## 🧪 Manual Testing Steps

### 1. Start the IDE
```bash
npm run electron:start
```

### 2. Verify Plugin Loading
Open DevTools (Cmd+Option+I) and check console for:
```
[PluginManager] Discovering plugins...
[Plugin Loader] Discovered plugin: Hello World Plugin v1.0.0
[PluginManager] Loading plugin example-hello-world...
[Plugin:example-hello-world] Hello World plugin loaded!
[PluginManager] Plugin example-hello-world initialized successfully
[PluginManager] Successfully loaded 1 plugin(s)
```

### 3. Open Plugin Tab
- Look for a "Hello World 🌍" tab button (should be added to UI - may need to implement UI button)
- If no UI button exists yet, open DevTools console and run:
  ```javascript
  // This simulates opening a plugin tab
  // (You'll need to implement a UI button in the toolbar/menu)
  ```

### 4. Test Plugin Features
Once the plugin tab is open:

#### Project Statistics
- Verify it shows correct counts for:
  - Blocks (number of .rpy files)
  - Characters
  - Variables
  - Labels
- Verify project path is displayed

#### Settings Persistence
- Click "Increment" button several times
- Note the counter value
- Close and reopen the IDE
- Verify counter value persists

#### API Testing
- Click "Test Toast (Success)" - should show green toast
- Click "Test Toast (Warning)" - should show yellow toast
- Click "Test Toast (Error)" - should show red toast
- Click "Test Logger" - check console for prefixed log messages
- Click "Test Dialog" - should show alert dialog

#### Error Handling
- Modify plugin code to throw an error:
  ```javascript
  throw new Error('Test error handling');
  ```
- Verify ErrorBoundary catches it and shows error UI with retry button

## 🔧 Known Issues / TODO

1. **UI Integration**: Need to add plugin tab buttons to the toolbar or menu
   - Current: Plugins load but no UI to open tabs
   - Fix: Add a "Plugins" menu or toolbar section with loaded plugin tabs

2. **Plugin Hot Reload**: Not supported in Phase 1
   - Workaround: Restart IDE after plugin changes

3. **Security Warning**: Phase 1 uses trust-based security (no sandboxing)

## 📊 Performance Verification

Check that plugin system overhead is <10%:
1. Open DevTools Performance tab
2. Start recording
3. Load a project
4. Stop recording
5. Check plugin-related operations (should be minimal)

## 🎯 Success Criteria

- [ ] IDE starts without errors
- [ ] Plugin loads successfully (check console)
- [ ] Plugin tab can be opened (need UI button)
- [ ] All plugin features work correctly
- [ ] Settings persist across sessions
- [ ] Error boundary catches plugin errors
- [ ] Performance impact <10%

## 🚀 Next Steps After Testing

1. **Add Plugin Tab UI** - Create toolbar/menu buttons for plugin tabs
2. **Documentation** - Write Plugin Development Guide
3. **Unit Tests** - Add tests for plugin loader, context, manager
4. **Phase 2 Planning** - Enhanced features (sandboxing, permissions, more APIs)

## 📝 Notes

- Plugin installed at: `~/.vangard-ide/plugins/example-hello-world/`
- Plugin manifest: `~/.vangard-ide/plugins/example-hello-world/manifest.json`
- Plugin entry: `~/.vangard-ide/plugins/example-hello-world/dist/index.js`
- Settings stored in: `game/project.ide.json` under `pluginData.example-hello-world`
