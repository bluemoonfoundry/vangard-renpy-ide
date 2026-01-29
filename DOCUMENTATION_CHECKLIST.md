# Documentation Checklist for Developers

Use this checklist when creating new code or modifying existing code in the Vangard Ren'Py IDE.

---

## When Adding a New Type/Interface

- [ ] Add to `types.ts`
- [ ] Include file-level @description if creating new type family
- [ ] Add @interface JSDoc comment
- [ ] Document each @property with type and description
- [ ] Mark optional properties with [brackets]
- [ ] Include usage context in description
- [ ] Update DOCUMENTATION.md "Type Definitions" section
- [ ] Update QUICK_REFERENCE.md if it's a commonly-used type

**Example:**
```typescript
/**
 * Represents a [what-it-is].
 * [Key features and usage context]
 * @interface TypeName
 * @property {Type} fieldName - Description
 * @property {Type} [optionalField] - Description
 */
export interface TypeName {
  fieldName: Type;
  optionalField?: Type;
}
```

---

## When Creating a New Hook

- [ ] Create file in `/hooks/` with `use` prefix
- [ ] Add file-level JSDoc with @file, @description
- [ ] Describe what the hook manages
- [ ] Document exported functions/hooks with JSDoc
- [ ] Include @param and @returns for each export
- [ ] Document error conditions in @throws
- [ ] Add related types to types.ts if new
- [ ] Update DOCUMENTATION.md "Hooks" section
- [ ] Update QUICK_REFERENCE.md with function list
- [ ] Add usage example in JSDoc or DOCUMENTATION.md

**Example:**
```typescript
/**
 * @file useMyHook.ts
 * @description What this hook does (one sentence).
 * Longer description of features and responsibilities.
 * Integration points with other parts of app.
 */

/**
 * Hook to [do something].
 * 
 * @param {Type} param - Description
 * @returns {Object} Object with these properties:
 *   - prop1: Description
 *   - prop2: Description
 * @throws {Error} When [error condition]
 */
export const useMyHook = (param: Type) => {
  // Implementation
};
```

---

## When Creating a New Component

- [ ] Create file in `/components/` with PascalCase name
- [ ] Add file-level JSDoc (@file, @description, approx. line count)
- [ ] Define Props interface with full JSDoc
- [ ] Document main component function with JSDoc
- [ ] Mark optional props with `?` in interface
- [ ] Document callback prop signatures
- [ ] Include return type annotation
- [ ] Add to DOCUMENTATION.md component list
- [ ] Add to QUICK_REFERENCE.md if major component
- [ ] Update parent component to import if needed

**Example:**
```typescript
/**
 * @file MyComponent.tsx
 * @description What this component renders (250 lines).
 * Key visual features and interactive capabilities.
 * Integration with other components and state.
 */

import React from 'react';

/**
 * Props for MyComponent.
 * @interface MyComponentProps
 * @property {string} title - Display title
 * @property {Function} onChange - Called when value changes
 * @property {string} [className] - Optional CSS classes
 */
interface MyComponentProps {
  title: string;
  onChange: (newValue: string) => void;
  className?: string;
}

/**
 * A component that [does something].
 * Displays [what it displays] and handles [interactions].
 * 
 * @component
 * @param {MyComponentProps} props - Component props
 * @returns {React.ReactElement} The rendered component
 */
const MyComponent: React.FC<MyComponentProps> = ({ 
  title, 
  onChange, 
  className 
}) => {
  // Implementation
  return <div className={className}>{title}</div>;
};

export default MyComponent;
```

---

## When Adding a New Function/Method

**For exported functions:**
- [ ] Add JSDoc comment above function
- [ ] Document all parameters with @param
- [ ] Document return value with @returns
- [ ] Document error conditions with @throws
- [ ] Include usage example if non-obvious
- [ ] Use clear parameter names in signature
- [ ] Add return type annotation

**For private functions:**
- [ ] Add inline comment explaining purpose
- [ ] Document complex logic with comments
- [ ] Use meaningful variable names
- [ ] Keep to single responsibility

**Example:**
```typescript
/**
 * Calculate the total word count in all Ren'Py scripts.
 * Parses dialogue and narration text patterns.
 * 
 * @param {Block[]} blocks - Array of story blocks
 * @returns {number} Total word count across all blocks
 * @throws {Error} If block content is null/undefined
 * 
 * @example
 * const blocks = [...];
 * const count = calculateTotalWords(blocks);
 * console.log(count); // 1234
 */
export function calculateTotalWords(blocks: Block[]): number {
  // Implementation
  return totalCount;
}
```

---

## When Adding a New Context

- [ ] Create file in `/contexts/` with "Context" suffix
- [ ] Add file-level JSDoc
- [ ] Create interface for context value type
- [ ] Document each method/property in interface
- [ ] Create hook to access context safely
- [ ] Include error message if used outside provider
- [ ] Create Provider component if needed
- [ ] Add to DOCUMENTATION.md "Contexts" section
- [ ] Update QUICK_REFERENCE.md "Context Usage"

**Example:**
```typescript
/**
 * @file MyContext.ts
 * @description React Context for managing [feature].
 * Provides [operations] across the application.
 */

import { createContext, useContext } from 'react';

/**
 * Context value type for MyContext.
 * @interface MyContextValue
 * @property {Function} doSomething - Perform operation
 */
interface MyContextValue {
  doSomething: (arg: string) => void;
}

export const MyContext = createContext<MyContextValue | null>(null);

/**
 * Hook to access MyContext.
 * @function useMyContext
 * @returns {MyContextValue} Context value
 * @throws {Error} If used outside MyProvider
 */
export const useMyContext = () => {
  const context = useContext(MyContext);
  if (!context) {
    throw new Error('useMyContext must be used within MyProvider');
  }
  return context;
};
```

---

## When Modifying Existing Code

- [ ] Update JSDoc if behavior changes
- [ ] Add @deprecated comment if removing functionality
- [ ] Document new parameters with @param
- [ ] Update @returns if return value changes
- [ ] Add @throws if new errors possible
- [ ] Update DOCUMENTATION.md if architecture changes
- [ ] Update tests if test files exist
- [ ] Leave old tests passing if possible

**Deprecation Example:**
```typescript
/**
 * Do something.
 * 
 * @deprecated Since v0.5.0. Use {@link newFunction} instead.
 * @param {Type} param - Parameter
 * @returns {Type} Result
 */
export function oldFunction(param: Type): Type {
  // Implementation
}
```

---

## When Adding State to App.tsx

- [ ] Add to appropriate interface in types.ts
- [ ] Document the state variable purpose with comment
- [ ] Create update function in App.tsx
- [ ] Pass update function to children, not state directly
- [ ] Document callback signatures
- [ ] Add to ProjectSettings if project-specific
- [ ] Add save handler in handleSaveAll()
- [ ] Add load handler in project loading logic

**Example in App.tsx:**
```typescript
// State for [what this manages]
const [myState, setMyState] = useImmer<MyStateType>({
  // Initial value
});

/**
 * Update [feature].
 * @param {Type} id - Item ID
 * @param {Partial<ItemType>} updates - Fields to update
 */
const updateItem = useCallback((id: string, updates: Partial<ItemType>) => {
  setMyState(draft => {
    const item = draft.find(i => i.id === id);
    if (item) Object.assign(item, updates);
  });
}, []);
```

---

## When Adding a Keyboard Shortcut

- [ ] Add listener in component or App.tsx
- [ ] Document in code with // comment
- [ ] Add to KeyboardShortcutsModal.tsx displayed list
- [ ] Add to QUICK_REFERENCE.md "Keyboard Shortcuts"
- [ ] Verify doesn't conflict with browser shortcuts
- [ ] Consider accessibility (arrows, enter, escape)
- [ ] Include Ctrl/Cmd/Shift modifiers as needed

**Example:**
```typescript
// Listen for Ctrl+Shift+K shortcut
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'k') {
      e.preventDefault();
      myFunction();
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

---

## When Adding Settings/Configuration

- [ ] Add to AppSettings or ProjectSettings in types.ts
- [ ] Add UI control to SettingsModal.tsx
- [ ] Add to initialization logic
- [ ] Add load handler from storage
- [ ] Add save handler to storage
- [ ] Document default values
- [ ] Consider user experience (grouping, ordering)
- [ ] Update DOCUMENTATION.md if major feature

**Example in types.ts:**
```typescript
export interface AppSettings {
  // ... existing settings
  
  /**
   * New setting for [feature].
   * Default: 'value'
   */
  newSetting: string;
}
```

---

## Documentation Quality Checklist

For all documentation added:

- [ ] Written in clear, concise English
- [ ] Spelling and grammar checked
- [ ] Consistent with existing documentation style
- [ ] Includes complete type information
- [ ] Explains "why" not just "what"
- [ ] Provides usage examples for complex items
- [ ] Links to related documentation
- [ ] Updated in all relevant places

---

## File Organization Standards

### Component Files
```
ComponentName.tsx (file header with JSDoc)
├── Imports
├── Types/Interfaces (with JSDoc)
├── Styled components (if any)
├── Helper functions (with comments)
├── Main component
└── Export
```

### Hook Files
```
useHookName.ts (file header with JSDoc)
├── Imports
├── Types/Interfaces (with JSDoc)
├── Helper functions (with comments)
├── Main hook function
└── Export
```

### Utility Files
```
utilityName.ts (file header with JSDoc)
├── Imports
├── Constants (with comments)
├── Types/Interfaces (with JSDoc)
├── Functions (with JSDoc)
└── Exports
```

---

## Documentation Tools

### JSDoc Resources
- [JSDoc Official](https://jsdoc.app/)
- [TypeScript JSDoc](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html)
- [React with JSDoc](https://react.dev/)

### Code Quality
- VS Code IntelliSense shows JSDoc in hover
- TypeScript compiler checks for complete JSDoc
- ESLint can enforce JSDoc standards

### Generation
- Generate HTML docs: `npm install -g jsdoc` then `jsdoc src/`
- Use TypeDoc for full API documentation

---

## Checklist Summary

**Before committing code:**
- [ ] All new types documented in types.ts
- [ ] All exported functions have JSDoc
- [ ] All components have file-level header
- [ ] All interfaces documented with @property
- [ ] All errors documented with @throws
- [ ] DOCUMENTATION.md updated if major change
- [ ] Code follows existing style
- [ ] No unused imports or variables
- [ ] TypeScript compiles without errors

---

## Getting Help

1. **Confused about a type?** Check types.ts
2. **Need function examples?** Check DOCUMENTATION.md
3. **Looking for similar code?** Search QUICK_REFERENCE.md
4. **Component question?** See file-level JSDoc in component
5. **How to structure?** Follow existing patterns in similar files

---

**Created:** January 28, 2026
**Last Updated:** January 28, 2026
**Version:** 1.0

