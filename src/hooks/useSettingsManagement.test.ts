import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSettingsManagement } from '@/hooks/useSettingsManagement';

describe('useSettingsManagement', () => {
  // ── Initial state ─────────────────────────────────────────────────────────

  it('initializes with system theme', () => {
    const { result } = renderHook(() => useSettingsManagement());
    expect(result.current.appSettings.theme).toBe('system');
  });

  it('initializes with empty recentProjects', () => {
    const { result } = renderHook(() => useSettingsManagement());
    expect(result.current.appSettings.recentProjects).toHaveLength(0);
  });

  it('initializes appSettingsLoaded as false', () => {
    const { result } = renderHook(() => useSettingsManagement());
    expect(result.current.appSettingsLoaded).toBe(false);
  });

  it('initializes isRenpyPathValid as false', () => {
    const { result } = renderHook(() => useSettingsManagement());
    expect(result.current.isRenpyPathValid).toBe(false);
  });

  it('initializes characterProfiles as empty object', () => {
    const { result } = renderHook(() => useSettingsManagement());
    expect(result.current.characterProfiles).toEqual({});
  });

  it('initializes characterPortraits as empty object', () => {
    const { result } = renderHook(() => useSettingsManagement());
    expect(result.current.characterPortraits).toEqual({});
  });

  it('initializes draftingMode as false', () => {
    const { result } = renderHook(() => useSettingsManagement());
    expect(result.current.projectSettings.draftingMode).toBe(false);
  });

  it('initializes fileSizeThresholds with the defaults', () => {
    const { result } = renderHook(() => useSettingsManagement());
    expect(result.current.appSettings.fileSizeThresholds).toEqual({
      healthy: 500,
      warning: 1000,
      critical: 1500,
    });
  });

  // ── updateTheme ───────────────────────────────────────────────────────────

  it('updateTheme changes the theme', () => {
    const { result } = renderHook(() => useSettingsManagement());
    act(() => result.current.updateTheme('dark'));
    expect(result.current.appSettings.theme).toBe('dark');
  });

  it('updateTheme can switch between themes', () => {
    const { result } = renderHook(() => useSettingsManagement());
    act(() => result.current.updateTheme('light'));
    act(() => result.current.updateTheme('dark'));
    expect(result.current.appSettings.theme).toBe('dark');
  });

  // ── updateRenpyPath ───────────────────────────────────────────────────────

  it('updateRenpyPath sets the Ren\'Py path', () => {
    const { result } = renderHook(() => useSettingsManagement());
    act(() => result.current.updateRenpyPath('/usr/local/bin/renpy'));
    expect(result.current.appSettings.renpyPath).toBe('/usr/local/bin/renpy');
  });

  // ── updateEditorFont ──────────────────────────────────────────────────────

  it('updateEditorFont sets family and size', () => {
    const { result } = renderHook(() => useSettingsManagement());
    act(() => result.current.updateEditorFont('Fira Code', 16));
    expect(result.current.appSettings.editorFontFamily).toBe('Fira Code');
    expect(result.current.appSettings.editorFontSize).toBe(16);
  });

  // ── toggleSidebar ─────────────────────────────────────────────────────────

  it('toggleSidebar left toggles isLeftSidebarOpen', () => {
    const { result } = renderHook(() => useSettingsManagement());
    expect(result.current.appSettings.isLeftSidebarOpen).toBe(true);
    act(() => result.current.toggleSidebar('left'));
    expect(result.current.appSettings.isLeftSidebarOpen).toBe(false);
    act(() => result.current.toggleSidebar('left'));
    expect(result.current.appSettings.isLeftSidebarOpen).toBe(true);
  });

  it('toggleSidebar right toggles isRightSidebarOpen', () => {
    const { result } = renderHook(() => useSettingsManagement());
    act(() => result.current.toggleSidebar('right'));
    expect(result.current.appSettings.isRightSidebarOpen).toBe(false);
  });

  // ── updateSidebarWidth ────────────────────────────────────────────────────

  it('updateSidebarWidth left sets leftSidebarWidth', () => {
    const { result } = renderHook(() => useSettingsManagement());
    act(() => result.current.updateSidebarWidth('left', 320));
    expect(result.current.appSettings.leftSidebarWidth).toBe(320);
  });

  it('updateSidebarWidth right sets rightSidebarWidth', () => {
    const { result } = renderHook(() => useSettingsManagement());
    act(() => result.current.updateSidebarWidth('right', 400));
    expect(result.current.appSettings.rightSidebarWidth).toBe(400);
  });

  // ── addRecentProject ──────────────────────────────────────────────────────

  it('addRecentProject prepends to list', () => {
    const { result } = renderHook(() => useSettingsManagement());
    act(() => result.current.addRecentProject('/project/a'));
    act(() => result.current.addRecentProject('/project/b'));
    expect(result.current.appSettings.recentProjects[0]).toBe('/project/b');
    expect(result.current.appSettings.recentProjects[1]).toBe('/project/a');
  });

  it('addRecentProject deduplicates existing entries', () => {
    const { result } = renderHook(() => useSettingsManagement());
    act(() => result.current.addRecentProject('/project/a'));
    act(() => result.current.addRecentProject('/project/b'));
    act(() => result.current.addRecentProject('/project/a'));
    expect(result.current.appSettings.recentProjects).toHaveLength(2);
    expect(result.current.appSettings.recentProjects[0]).toBe('/project/a');
  });

  it('addRecentProject limits list to 10 entries', () => {
    const { result } = renderHook(() => useSettingsManagement());
    for (let i = 0; i < 12; i++) {
      act(() => result.current.addRecentProject(`/project/${i}`));
    }
    expect(result.current.appSettings.recentProjects).toHaveLength(10);
  });

  // ── removeRecentProject ───────────────────────────────────────────────────

  it('removeRecentProject removes the matching entry', () => {
    const { result } = renderHook(() => useSettingsManagement());
    act(() => result.current.addRecentProject('/project/a'));
    act(() => result.current.addRecentProject('/project/b'));
    act(() => result.current.removeRecentProject('/project/a'));
    expect(result.current.appSettings.recentProjects).toEqual(['/project/b']);
  });

  // ── clearRecentProjects ───────────────────────────────────────────────────

  it('clearRecentProjects empties the list', () => {
    const { result } = renderHook(() => useSettingsManagement());
    act(() => result.current.addRecentProject('/project/a'));
    act(() => result.current.clearRecentProjects());
    expect(result.current.appSettings.recentProjects).toHaveLength(0);
  });

  // ── resetAppSettings ──────────────────────────────────────────────────────

  it('resetAppSettings restores defaults while keeping renpyPath', () => {
    const { result } = renderHook(() => useSettingsManagement());
    act(() => result.current.updateRenpyPath('/custom/renpy'));
    act(() => result.current.updateTheme('dark'));
    act(() => result.current.updateEditorFont('Fira Code', 20));
    act(() => result.current.resetAppSettings());
    expect(result.current.appSettings.theme).toBe('system');
    expect(result.current.appSettings.editorFontSize).toBe(14);
    expect(result.current.appSettings.renpyPath).toBe('/custom/renpy');
  });

  it('resetAppSettings restores default fileSizeThresholds after a change', () => {
    const { result } = renderHook(() => useSettingsManagement());
    act(() => {
      result.current.updateAppSettings((draft) => {
        draft.fileSizeThresholds = { healthy: 100, warning: 200, critical: 300 };
      });
    });
    expect(result.current.appSettings.fileSizeThresholds).toEqual({ healthy: 100, warning: 200, critical: 300 });
    act(() => result.current.resetAppSettings());
    expect(result.current.appSettings.fileSizeThresholds).toEqual({
      healthy: 500,
      warning: 1000,
      critical: 1500,
    });
  });

  // ── resetProjectSettings ──────────────────────────────────────────────────

  it('resetProjectSettings restores draftingMode to false', () => {
    const { result } = renderHook(() => useSettingsManagement());
    act(() => result.current.updateProjectSettings(draft => { draft.draftingMode = true; }));
    act(() => result.current.resetProjectSettings());
    expect(result.current.projectSettings.draftingMode).toBe(false);
  });

  it('resetProjectSettings restores canvas layout to flow-lr', () => {
    const { result } = renderHook(() => useSettingsManagement());
    act(() => result.current.updateProjectSettings(draft => {
      draft.storyCanvasLayoutMode = 'flow-td';
    }));
    act(() => result.current.resetProjectSettings());
    expect(result.current.projectSettings.storyCanvasLayoutMode).toBe('flow-lr');
  });

  // ── updateProjectSettings ─────────────────────────────────────────────────

  it('updateProjectSettings can mutate drafting mode', () => {
    const { result } = renderHook(() => useSettingsManagement());
    act(() => result.current.updateProjectSettings(draft => { draft.draftingMode = true; }));
    expect(result.current.projectSettings.draftingMode).toBe(true);
  });

  // ── setCharacterProfiles ──────────────────────────────────────────────────

  it('setCharacterProfiles stores character profiles', () => {
    const { result } = renderHook(() => useSettingsManagement());
    act(() => result.current.setCharacterProfiles(draft => { draft['eileen'] = 'The protagonist'; }));
    expect(result.current.characterProfiles['eileen']).toBe('The protagonist');
  });
});
