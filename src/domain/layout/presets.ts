import type { LayoutEngine } from "./LayoutEngine";
import { instagramProfileGrid } from "./instagram/instagramProfileGrid";
import { telegramAlbumLayout } from "./telegram/telegramAlbumLayout";
import { TELEGRAM_MAX_ITEMS } from "./constants";

export enum PresetId {
  Telegram = "tg",
  Instagram = "inst",
  Custom = "custom",
}

export const presetEngines: Record<Exclude<PresetId, PresetId.Custom>, LayoutEngine> = {
  [PresetId.Telegram]: telegramAlbumLayout,
  [PresetId.Instagram]: instagramProfileGrid,
};

export function clampTelegramCount(itemsCount: number) {
  return Math.min(TELEGRAM_MAX_ITEMS, Math.max(0, itemsCount));
}

