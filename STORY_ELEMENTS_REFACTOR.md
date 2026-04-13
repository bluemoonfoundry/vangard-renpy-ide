# Story Elements Panel Refactor - Two-Level Tab Navigation

## Summary
Refactored Story Elements panel from collapsible subsections to a two-level tab navigation system, eliminating nested scroll containers and providing consistent, predictable scrolling behavior.

## What Changed

### Before
- 4 main tabs with collapsible subsections
- Multiple nested scroll containers
- Confusing UX: users had to position cursor correctly to scroll
- Subsection state tracked via `collapsedSubsections` object

### After
- 4 category tabs (Story, Assets, Compose, Tools)
- Sub-tabs for each category (10 total leaf tabs)
- **Single scroll container** - parent handles all scrolling
- Clear navigation, no cursor positioning issues

## Tab Structure

### Story Category
- **Characters** - Character management and editing
- **Variables** - Variable definitions and usage
- **Screens** - Screen definitions

### Assets Category
- **Images** - Image library and scanning
- **Audio** - Audio library and scanning

### Compose Category
- **Scenes** - Scene compositions
- **ImageMaps** - Imagemap builders
- **Layouts** - Screen layout composer

### Tools Category
- **Snippets** - Code snippet library
- **Menus** - Menu template builder

## Technical Changes

### StoryElementsPanel.tsx
1. Introduced `CategoryId` and `SubTabId` types
2. Added `TAB_CATEGORIES` structure with nested sub-tabs
3. State management: `activeCategory` + `activeSubTab` (replaced `collapsedSubsections`)
4. Two-level tab bar rendering (category bar + sub-tab bar)
5. Removed all `SubsectionHeader` usage
6. Single parent scroll container handles all content

### types.ts
Updated `ProjectSettings.storyElementsTabState`:
```typescript
// Before
storyElementsTabState?: {
  activeTab: CategoryId;
  collapsedSubsections: { ... };
}

// After
storyElementsTabState?: {
  activeTab: CategoryId;
  activeSubTab?: SubTabId;
}
```

### ImageManager.tsx & AudioManager.tsx
- Removed wrapping `<div>` with `h-full flex flex-col` (caused flex layout issues)
- Changed to `<>` fragment wrapper
- Removed `max-h-96` constraint on scroll containers
- Changed scroll containers from `overflow-y-auto` to `relative` positioning
- Content now flows naturally in parent scroll area

### VariableManager.tsx
- Removed fixed height constraint (`listHeight`) from internal scroll containers
- Changed from `overflow-y-auto` with fixed height to `relative` positioning
- Virtualization still works but content height is natural

## Benefits

### User Experience
✅ **Predictable Scrolling** - Scroll works anywhere in the content area
✅ **Clear Navigation** - Always visible which section you're viewing
✅ **No Cursor Positioning** - Don't need to know where to hover
✅ **Consistent Behavior** - All sections scroll the same way

### Developer Experience
✅ **Simpler Layout** - No nested scroll container conflicts
✅ **Easier Debugging** - Single scroll context
✅ **Cleaner State** - No collapse state management
✅ **Better Maintainability** - Clear component boundaries

### Performance
✅ **Reduced DOM Complexity** - Fewer scroll observers
✅ **Virtualization Still Works** - At component level
✅ **Less State Updates** - No collapse/expand rerenders

## Migration Notes

### State Persistence
Old collapsed state will be ignored. Users will start on first sub-tab of "Story" category on first load after update.

### Component Contracts
- ImageManager and AudioManager no longer manage their own scroll containers
- They render content directly into parent's scroll context
- VariableManager's internal collapsible sections still exist but don't constrain scroll

## Future Enhancements

### Possible Improvements
1. **Keyboard Navigation** - Arrow keys to switch tabs
2. **Tab Badges** - Count badges on tabs (e.g., "Images (42)")
3. **Search Across All** - Global search across all sections
4. **Recent Tabs** - Quick switch to recently viewed tabs
5. **Tab Groups** - Visual separation between category sub-tabs

### Performance Optimizations
1. **Lazy Loading** - Don't render inactive tab content
2. **Virtual Scrolling at Parent** - For very long lists
3. **Intersection Observer** - Load images/audio on demand
