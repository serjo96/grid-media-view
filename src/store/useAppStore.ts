import { create } from "zustand";
import type { CropAreaNorm } from "../domain/crop/cropTypes";
import { clampTelegramCount, type PresetId } from "../domain/layout/presets";

export type MediaKind = "image" | "video";

export type MediaItem = {
  id: string;
  fileName: string;
  kind: MediaKind;
  /** URL for the original file (image/video) */
  objectUrl: string;
  /** URL for preview image (image itself or extracted video frame) */
  previewUrl: string;
  width: number;
  height: number;
  aspect: number;
};

export type CustomPreset = {
  columns: number;
  tileAspect: number; // w/h
  gap: number; // px
  containerWidth: number; // px (preview max width)
};

type CropModalState = {
  open: boolean;
  gridId: string | null;
  itemId: string | null;
  cropKey: string | null;
  targetAspect: number | null;
};

export type GridState = {
  id: string;
  name: string;
  createdAt: number;
  preset: PresetId;
  custom: CustomPreset;
  items: MediaItem[];
  crops: Record<string, Record<string, CropAreaNorm>>;
};

type AppState = {
  grids: GridState[];
  activeGridId: string;
  cropModal: CropModalState;

  createGrid: () => void;
  selectGrid: (gridId: string) => void;
  renameGrid: (gridId: string, name: string) => void;

  setPreset: (preset: PresetId) => void;
  setCustom: (patch: Partial<CustomPreset>) => void;

  addFiles: (files: FileList | File[]) => Promise<void>;
  removeItem: (id: string) => void;
  clear: () => void;
  reorder: (activeId: string, overId: string) => void;

  openCrop: (args: { itemId: string; cropKey: string; targetAspect: number }) => void;
  closeCrop: () => void;
  setCrop: (args: { itemId: string; cropKey: string; crop: CropAreaNorm }) => void;
};

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function loadImageMeta(objectUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = objectUrl;
  });
}

async function extractVideoPreview(objectUrl: string): Promise<{
  width: number;
  height: number;
  previewUrl: string;
}> {
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.src = objectUrl;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Failed to load video metadata"));
  });

  const width = video.videoWidth || 0;
  const height = video.videoHeight || 0;
  if (!width || !height) {
    throw new Error("Video has no dimensions");
  }

  // Seek to a tiny offset to avoid black first frame on some encodings
  const seekTo = Math.min(0.1, Math.max(0, (video.duration || 0) * 0.01));
  await new Promise<void>((resolve) => {
    const onSeeked = () => resolve();
    video.onseeked = onSeeked;
    // Some browsers may throw if duration is Infinity; fallback to 0
    try {
      video.currentTime = Number.isFinite(seekTo) ? seekTo : 0;
    } catch {
      video.currentTime = 0;
    }
  });

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("No canvas 2d context");
  }
  ctx.drawImage(video, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to create preview blob"))), "image/jpeg", 0.86);
  });

  const previewUrl = URL.createObjectURL(blob);
  return { width, height, previewUrl };
}

function insertAtEnd<T>(arr: T[], items: T[]) {
  return [...arr, ...items];
}

function createEmptyGrid(args: { name: string; preset: PresetId; custom: CustomPreset }): GridState {
  return {
    id: makeId(),
    name: args.name,
    createdAt: Date.now(),
    preset: args.preset,
    custom: args.custom,
    items: [],
    crops: {},
  };
}

function revokeItemUrls(it: MediaItem) {
  URL.revokeObjectURL(it.objectUrl);
  if (it.previewUrl !== it.objectUrl) URL.revokeObjectURL(it.previewUrl);
}

const initialCustom: CustomPreset = { columns: 3, tileAspect: 1, gap: 6, containerWidth: 420 };
const initialGrid: GridState = createEmptyGrid({ name: "Grid 1", preset: "tg", custom: initialCustom });

export const useAppStore = create<AppState>((set, get) => ({
  grids: [initialGrid],
  activeGridId: initialGrid.id,
  cropModal: { open: false, gridId: null, itemId: null, cropKey: null, targetAspect: null },

  createGrid: () => {
    const s = get();
    const active = s.grids.find((g) => g.id === s.activeGridId) ?? s.grids[0];
    const name = `Grid ${s.grids.length + 1}`;
    const next = createEmptyGrid({
      name,
      preset: active?.preset ?? "tg",
      custom: active?.custom ?? { columns: 3, tileAspect: 1, gap: 6, containerWidth: 420 },
    });
    set({
      grids: [...s.grids, next],
      activeGridId: next.id,
      cropModal: { open: false, gridId: null, itemId: null, cropKey: null, targetAspect: null },
    });
  },

  selectGrid: (gridId) => {
    const s = get();
    if (s.activeGridId === gridId) return;
    set({
      activeGridId: gridId,
      cropModal: { open: false, gridId: null, itemId: null, cropKey: null, targetAspect: null },
    });
  },

  renameGrid: (gridId, name) =>
    set((s) => ({
      grids: s.grids.map((g) => (g.id === gridId ? { ...g, name: name.trim().slice(0, 60) || g.name } : g)),
    })),

  setPreset: (preset) =>
    set((s) => ({
      grids: s.grids.map((g) => (g.id === s.activeGridId ? { ...g, preset } : g)),
    })),

  setCustom: (patch) =>
    set((s) => ({
      grids: s.grids.map((g) => {
        if (g.id !== s.activeGridId) return g;
        const nextCustom: CustomPreset = {
          ...g.custom,
          ...patch,
          columns: Math.max(1, Math.min(8, Math.round(patch.columns ?? g.custom.columns))),
          tileAspect: Math.max(0.1, patch.tileAspect ?? g.custom.tileAspect),
          gap: Math.max(0, Math.min(40, Math.round(patch.gap ?? g.custom.gap))),
          containerWidth: Math.max(240, Math.min(1200, Math.round(patch.containerWidth ?? g.custom.containerWidth))),
        };
        return { ...g, custom: nextCustom };
      }),
    })),

  addFiles: async (filesLike) => {
    const files = Array.from(filesLike);
    if (files.length === 0) return;

    const s = get();
    const grid = s.grids.find((g) => g.id === s.activeGridId) ?? s.grids[0];
    const current = grid.items;
    const preset = grid.preset;
    const maxAllowed =
      preset === "tg" ? clampTelegramCount(current.length + files.length) : current.length + files.length;
    const canAdd = Math.max(0, maxAllowed - current.length);
    const slice = files.slice(0, canAdd);

    const created: MediaItem[] = [];
    for (const f of slice) {
      const objectUrl = URL.createObjectURL(f);
      try {
        if (f.type.startsWith("video/")) {
          const v = await extractVideoPreview(objectUrl);
          created.push({
            id: makeId(),
            fileName: f.name,
            kind: "video",
            objectUrl,
            previewUrl: v.previewUrl,
            width: v.width,
            height: v.height,
            aspect: v.width / v.height,
          });
        } else {
          const meta = await loadImageMeta(objectUrl);
          created.push({
            id: makeId(),
            fileName: f.name,
            kind: "image",
            objectUrl,
            previewUrl: objectUrl,
            width: meta.width,
            height: meta.height,
            aspect: meta.width / meta.height,
          });
        }
      } catch {
        URL.revokeObjectURL(objectUrl);
      }
    }

    if (created.length === 0) return;
    set((s) => ({
      grids: s.grids.map((g) => (g.id === s.activeGridId ? { ...g, items: insertAtEnd(g.items, created) } : g)),
    }));
  },

  removeItem: (id) => {
    const s0 = get();
    const grid0 = s0.grids.find((g) => g.id === s0.activeGridId) ?? s0.grids[0];
    const it = grid0.items.find((x) => x.id === id);
    if (it) revokeItemUrls(it);
    set((s) => {
      return {
        grids: s.grids.map((g) => {
          if (g.id !== s.activeGridId) return g;
          const nextItems = g.items.filter((x) => x.id !== id);
          const nextCrops = { ...g.crops };
          delete nextCrops[id];
          return { ...g, items: nextItems, crops: nextCrops };
        }),
      };
    });
  },

  clear: () => {
    const s0 = get();
    const grid0 = s0.grids.find((g) => g.id === s0.activeGridId) ?? s0.grids[0];
    for (const it of grid0.items) revokeItemUrls(it);
    set((s) => ({
      grids: s.grids.map((g) => (g.id === s.activeGridId ? { ...g, items: [], crops: {} } : g)),
      cropModal: { open: false, gridId: null, itemId: null, cropKey: null, targetAspect: null },
    }));
  },

  reorder: (activeId, overId) => {
    if (activeId === overId) return;
    set((s) => {
      const grid = s.grids.find((g) => g.id === s.activeGridId);
      if (!grid) return s;
      const from = grid.items.findIndex((i) => i.id === activeId);
      const to = grid.items.findIndex((i) => i.id === overId);
      if (from < 0 || to < 0) return s;
      const nextItems = grid.items.slice();
      const [moved] = nextItems.splice(from, 1);
      nextItems.splice(to, 0, moved);
      return {
        grids: s.grids.map((g) => (g.id === s.activeGridId ? { ...g, items: nextItems } : g)),
      };
    });
  },

  openCrop: ({ itemId, cropKey, targetAspect }) =>
    set((s) => ({ cropModal: { open: true, gridId: s.activeGridId, itemId, cropKey, targetAspect } })),

  closeCrop: () => set({ cropModal: { open: false, gridId: null, itemId: null, cropKey: null, targetAspect: null } }),

  setCrop: ({ itemId, cropKey, crop }) =>
    set((s) => ({
      grids: s.grids.map((g) => {
        if (g.id !== s.activeGridId) return g;
        return {
          ...g,
          crops: {
            ...g.crops,
            [itemId]: {
              ...(g.crops[itemId] ?? {}),
              [cropKey]: crop,
            },
          },
        };
      }),
    })),
}));

