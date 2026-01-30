import type { LayoutEngine } from "./LayoutEngine";
import { instagramProfileGrid } from "./instagram/instagramProfileGrid";
import { telegramAlbumLayout } from "./telegram/telegramAlbumLayout";

export type PresetId = "tg" | "inst" | "custom";

export const presetEngines: Record<Exclude<PresetId, "custom">, LayoutEngine> = {
  tg: telegramAlbumLayout,
  inst: instagramProfileGrid,
};

export function clampTelegramCount(itemsCount: number) {
  return Math.min(10, Math.max(0, itemsCount));
}

