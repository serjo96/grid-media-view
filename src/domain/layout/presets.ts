import type { LayoutEngine } from "./LayoutEngine";
import { instagramProfileGrid } from "./instagram/instagramProfileGrid";
import { telegramAlbumLayout } from "./telegram/telegramAlbumLayout";
import { TELEGRAM_MAX_ITEMS } from "./constants";

// Const object for erasableSyntaxOnly compatibility
export const PresetId = {
  Telegram: "tg",
  Instagram: "inst",
  Custom: "custom",
} as const;
export type PresetId = (typeof PresetId)[keyof typeof PresetId];

export const presetEngines: Record<Exclude<PresetId, "custom">, LayoutEngine> = {
  [PresetId.Telegram]: telegramAlbumLayout,
  [PresetId.Instagram]: instagramProfileGrid,
};

export function clampTelegramCount(itemsCount: number) {
  return Math.min(TELEGRAM_MAX_ITEMS, Math.max(0, itemsCount));
}

