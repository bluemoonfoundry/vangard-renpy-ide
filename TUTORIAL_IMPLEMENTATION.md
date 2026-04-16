# First Run Tutorial Implementation

## Overview
Implemented an optional first-run interactive tutorial as described in GitHub issue #109. The tutorial appears on first app launch and guides new users through creating/opening a project and understanding the core interface with a brief, skippable tour.

## Files Modified

### New Files
- **`components/FirstRunTutorial.tsx`**: Main tutorial component with custom overlay and spotlight effect

### Modified Files
- **`App.tsx`**:
  - Added import for FirstRunTutorial component
  - Added state variable for tutorial control
  - Rendered FirstRunTutorial component at the end of the component tree
  - Added `data-tutorial="project-menu"` attribute to New/Open Project buttons container

- **`components/StoryCanvas.tsx`**:
  - Added `data-tutorial="story-canvas"` attribute to main canvas div

- **`components/Toolbar.tsx`**:
  - Added `data-tutorial="new-scene-button"` attribute to New Scene button
  - Added `data-tutorial="canvas-tabs"` attribute to canvas switcher buttons container

- **`components/CodeBlock.tsx`**:
  - Removed - no longer needed in the updated tutorial flow

- **`components/StoryElementsPanel.tsx`**:
  - Added `data-tutorial="story-elements"` attribute to main panel div

## Features

### Welcome Modal
- Shows once per user on first app launch (stored in localStorage with key `renpy-ide-tutorial-completed`)
- Friendly welcome message with wave emoji
- Two options: "Start Tour" or "Skip — I'll explore on my own"
- Uses `useModalAccessibility` hook for proper focus management

### Tour Steps (6 steps)
1. **Getting Started**: Highlights the New/Open Project buttons - guides user to create or open a project
2. **Three Canvas Types**: Highlights the canvas tabs - explains Story, Route, and Choice canvases
3. **Story Canvas**: Highlights the main canvas area - explains file-level view
4. **Create Scene**: Highlights the "New Scene" button in toolbar - shows how to add scenes
5. **Story Elements**: Highlights the right sidebar panel - shows where assets are managed
6. **You're Ready!**: Final message centered on screen with no spotlight and keyboard shortcut tip

### Spotlight Effect
- Semi-transparent black overlay (75% opacity) with SVG mask for spotlight cutout
- Animated pulsing blue border (4px, indigo-500) around highlighted element
- Spotlight automatically positions around the target element
- Message card intelligently positions itself relative to the highlighted element

### Navigation & Controls
- **Next button**: Advances to next step (changes to "Start Creating" on last step)
- **Skip button**: Always visible, dismisses tutorial and marks as completed
- **Keyboard shortcuts**:
  - `Escape`: Skip tutorial
  - `Enter` or `→`: Next step
  - `←`: Previous step (when available)
- **Progress indicators**: Dots showing current step and completed steps

### Design Details
- Message card: 320px wide, white/dark mode support
- Position preference per step: top, bottom, left, or right of target
- Auto-adjusts position to keep message within viewport
- Z-index: 200+ to appear above all other UI elements

## Technical Details

### LocalStorage
- Key: `renpy-ide-tutorial-completed`
- Value: `"true"` when completed or skipped
- Checked on component mount when project is opened

### Data Attributes
Tutorial targets use `data-tutorial` attributes for easy selection:
- `[data-tutorial="project-menu"]`: New/Open Project buttons container
- `[data-tutorial="canvas-tabs"]`: Canvas switcher (Story/Route/Choice tabs)
- `[data-tutorial="story-canvas"]`: Main canvas area
- `[data-tutorial="new-scene-button"]`: New Scene button
- `[data-tutorial="story-elements"]`: Right sidebar panel

### Accessibility
- Uses `useModalAccessibility` hook for welcome modal
- Proper focus management and keyboard navigation
- ARIA labels for better screen reader support
- Escape key to exit at any time

### Help Menu Integration
- Added "Show Tutorial" option to Help menu (first item)
- Accessible via Help → Show Tutorial
- Allows users to replay the tutorial anytime, even after dismissing it
- Standard UX pattern for onboarding features

## User Experience
- **Automatic trigger**: Shows 1 second after app first launches (if not previously completed)
- **Manual trigger**: Available anytime via Help → Show Tutorial menu option
- **Guides from zero**: Starts with project creation/opening, doesn't assume a project is already loaded
- **Brief**: Designed to take 30-60 seconds
- **Skippable**: Big, obvious Skip button always visible
- **Progressive**: Shows basics only, introduces key concepts (canvas types) before diving into details
- **Respectful**: Never repeats if dismissed (unless manually triggered)
- **Graceful fallback**: If an element isn't found (e.g., no project open yet), shows message centered without spotlight

## Testing Checklist

### Automatic First-Run
- [ ] Tutorial shows on first app launch
- [ ] Tutorial doesn't show on subsequent app launches
- [ ] LocalStorage flag persists across sessions

### Manual Trigger
- [ ] Help → Show Tutorial menu option is visible
- [ ] Clicking Help → Show Tutorial shows the tutorial
- [ ] Tutorial can be replayed even after being dismissed
- [ ] Manual trigger works regardless of localStorage flag

### Tutorial Flow
- [ ] First step highlights project menu buttons (New/Open Project)
- [ ] Second step highlights canvas tabs (Story/Route/Choice)
- [ ] Subsequent steps highlight correct elements
- [ ] All spotlight highlights appear correctly
- [ ] Navigation buttons work (Next, Skip, keyboard shortcuts)
- [ ] Final step shows centered message without spotlight

### Visual & UX
- [ ] Dark mode styling works correctly
- [ ] Responsive positioning keeps message in viewport
- [ ] Graceful handling when elements don't exist (shows centered message)
- [ ] Accessibility: keyboard navigation and focus management work

## Future Improvements (Optional)
- Add animation transitions between steps
- Add ability to restart tutorial from settings
- Add analytics to track completion rate
- Support for custom tour steps per project type
