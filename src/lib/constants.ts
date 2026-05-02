export const UI_TIMING = {
  TUTORIAL_SHOW_DELAY_MS: 1000,
  TUTORIAL_SPOTLIGHT_RETRY_MS: 100,
  TUTORIAL_MAX_RETRIES: 30,
  SAVE_STATE_RESET_MS: 2000,
  CANVAS_CENTER_DELAY_MS: 50,
  ANALYSIS_TIMEOUT_MS: 30_000,
} as const;

export const Z_INDEX = {
  // Context menus sit above canvas chrome but below modals
  CONTEXT_MENU: 40,
  // Tutorial overlay must cover all other UI layers
  TUTORIAL_OVERLAY: 200,
  TUTORIAL_SPOTLIGHT_BORDER: 201,
  TUTORIAL_MESSAGE: 202,
} as const;

export const TUTORIAL_DIMENSIONS = {
  MESSAGE_WIDTH: 320,
  MESSAGE_HEIGHT: 200,
} as const;
