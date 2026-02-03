/**
 * Layout constants used across the application
 */

// View modes
export enum ViewMode {
  Single = "single",
  TgChat = "tgChat",
  AllGrids = "allGrids",
}

// Telegram album limits
export const TELEGRAM_MAX_ITEMS = 10;

// Preset container widths (px)
export const PRESET_WIDTH_TELEGRAM = 460;
export const PRESET_WIDTH_INSTAGRAM = 560;
export const PRESET_WIDTH_CUSTOM_DEFAULT = 420;

// Preset gaps (px)
export const PRESET_GAP_TELEGRAM = 2;
export const PRESET_GAP_INSTAGRAM = 2;

// Layout constraints
export const MIN_CONTAINER_WIDTH = 160;
export const MIN_STAGE_HEIGHT = 120;
export const VIEWPORT_PADDING = 24;
export const SAFE_AVAIL_OFFSET = 2;

// Drag & Drop settings
export const DRAG_ACTIVATION_DISTANCE = 4;
export const TOUCH_ACTIVATION_DELAY = 120;
export const TOUCH_ACTIVATION_TOLERANCE = 8;

// UI constants
export const STATIC_PREVIEW_PADDING = 8;
export const BORDER_RADIUS_DEFAULT = 14;
export const BORDER_RADIUS_ROUNDED = 18;
export const BORDER_RADIUS_SMALL = 12;

// Precision for aspect ratio calculations
export const ASPECT_PRECISION = 4;
