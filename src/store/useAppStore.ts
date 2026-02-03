import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { shallow } from "zustand/shallow";
import type { CropAreaNorm } from "../domain/crop/cropTypes";
import { clampTelegramCount, type PresetId } from "../domain/layout/presets";
import type { InstagramMedia, InstagramProfile } from "../domain/instagram/instagramApi";
import { fetchInstagramMedia, fetchInstagramProfile } from "../domain/instagram/instagramApi";
import { loadGridsFromLocal, peekLocalSnapshotInfo, persistGridsLocally } from "../persistence/gridsPersistence";

export type MediaKind = "image" | "video";

export type MediaSource = "local" | "instagram";

export type MediaItem = {
  id: string;
  fileName: string;
  kind: MediaKind;
  source: MediaSource;
  /** URL for the original file (image/video) */
  objectUrl: string;
  /** URL for preview image (image itself or extracted video frame) */
  previewUrl: string;
  width: number;
  height: number;
  aspect: number;
  remoteId?: string;
  permalink?: string;
  timestamp?: string;
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
  persistence: {
    hydrating: boolean;
    snapshot: "unknown" | "none" | "present";
    error: string | null;
  };

  instagram: {
    token: string;
    profile: InstagramProfile | null;
    media: InstagramMedia[];
    status: "idle" | "loading" | "connected" | "error";
    error: string | null;
    lastFetchedAt: number | null;
  };

  createGrid: () => void;
  selectGrid: (gridId: string) => void;
  renameGrid: (gridId: string, name: string) => void;
  deleteGrid: (gridId: string) => void;

  setPreset: (preset: PresetId) => void;
  setCustom: (patch: Partial<CustomPreset>) => void;

  setInstagramToken: (token: string) => void;
  connectInstagram: (token?: string) => Promise<void>;
  refreshInstagram: () => Promise<void>;
  disconnectInstagram: () => void;
  applyInstagramGridToActive: () => void;

  addFiles: (files: FileList | File[]) => Promise<void>;
  replaceItemFile: (args: { itemId: string; file: File }) => Promise<void>;
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
  if (it.source !== "local") return;
  URL.revokeObjectURL(it.objectUrl);
  if (it.previewUrl !== it.objectUrl) URL.revokeObjectURL(it.previewUrl);
}

const initialCustom: CustomPreset = { columns: 3, tileAspect: 1, gap: 6, containerWidth: 420 };
const initialGrid: GridState = createEmptyGrid({ name: "Grid 1", preset: "tg", custom: initialCustom });

const IG_TOKEN_STORAGE_KEY = "gridTest:instagramAccessToken";

function loadInstagramTokenFromStorage() {
  try {
    return localStorage.getItem(IG_TOKEN_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function saveInstagramTokenToStorage(token: string) {
  try {
    const t = token.trim();
    if (!t) {
      localStorage.removeItem(IG_TOKEN_STORAGE_KEY);
      return;
    }
    localStorage.setItem(IG_TOKEN_STORAGE_KEY, t);
  } catch {
    // ignore
  }
}

function instagramMediaToGridItems(media: InstagramMedia[]): MediaItem[] {
  // Profile grid thumbnails are effectively squares; we use a safe default size.
  const defaultW = 1080;
  const defaultH = 1080;

  return media.map((m) => {
    const kind: MediaKind = m.media_type === "VIDEO" ? "video" : "image";
    const previewUrl = m.thumbnail_url ?? m.media_url;
    return {
      id: makeId(),
      fileName: `IG ${m.id}`,
      kind,
      source: "instagram",
      objectUrl: m.media_url,
      previewUrl,
      width: defaultW,
      height: defaultH,
      aspect: defaultW / defaultH,
      remoteId: m.id,
      permalink: m.permalink,
      timestamp: m.timestamp,
    };
  });
}

export const useAppStore = create<AppState>()(
  subscribeWithSelector((set, get) => ({
  grids: [initialGrid],
  activeGridId: initialGrid.id,
  cropModal: { open: false, gridId: null, itemId: null, cropKey: null, targetAspect: null },
  persistence: { hydrating: false, snapshot: "unknown", error: null },

  instagram: {
    token: typeof window !== "undefined" ? loadInstagramTokenFromStorage() : "",
    profile: null,
    media: [],
    status: "idle",
    error: null,
    lastFetchedAt: null,
  },

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

  deleteGrid: (gridId) => {
    const s = get();
    // Не позволяем удалить последний grid
    if (s.grids.length <= 1) return;

    const gridToDelete = s.grids.find((g) => g.id === gridId);
    if (!gridToDelete) return;

    // Освобождаем URL для элементов удаляемого grid
    for (const it of gridToDelete.items) revokeItemUrls(it);

    const remainingGrids = s.grids.filter((g) => g.id !== gridId);
    let nextActiveGridId = s.activeGridId;

    // Если удаляемый grid был активным, переключаемся на первый оставшийся
    if (s.activeGridId === gridId) {
      nextActiveGridId = remainingGrids[0]?.id ?? s.grids[0]?.id;
    }

    set({
      grids: remainingGrids,
      activeGridId: nextActiveGridId,
      cropModal: { open: false, gridId: null, itemId: null, cropKey: null, targetAspect: null },
    });
  },

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

  setInstagramToken: (token) => {
    saveInstagramTokenToStorage(token);
    set((s) => ({ instagram: { ...s.instagram, token: token.trim() } }));
  },

  connectInstagram: async (tokenMaybe) => {
    const token = (tokenMaybe ?? get().instagram.token).trim();
    saveInstagramTokenToStorage(token);
    set((s) => ({
      instagram: { ...s.instagram, token, status: "loading", error: null },
    }));

    try {
      const [profile, media] = await Promise.all([
        fetchInstagramProfile({ accessToken: token }),
        fetchInstagramMedia({ accessToken: token, limit: 60 }),
      ]);
      set((s) => ({
        instagram: {
          ...s.instagram,
          token,
          profile,
          media,
          status: "connected",
          error: null,
          lastFetchedAt: Date.now(),
        },
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to connect Instagram";
      set((s) => ({
        instagram: { ...s.instagram, token, status: "error", error: msg },
      }));
    }
  },

  refreshInstagram: async () => {
    const { token } = get().instagram;
    if (!token.trim()) return;
    set((s) => ({ instagram: { ...s.instagram, status: "loading", error: null } }));
    try {
      const media = await fetchInstagramMedia({ accessToken: token, limit: 60 });
      set((s) => ({
        instagram: {
          ...s.instagram,
          media,
          status: "connected",
          error: null,
          lastFetchedAt: Date.now(),
        },
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to refresh Instagram";
      set((s) => ({ instagram: { ...s.instagram, status: "error", error: msg } }));
    }
  },

  disconnectInstagram: () => {
    saveInstagramTokenToStorage("");
    set((s) => ({
      instagram: {
        ...s.instagram,
        token: "",
        profile: null,
        media: [],
        status: "idle",
        error: null,
        lastFetchedAt: null,
      },
    }));
  },

  applyInstagramGridToActive: () => {
    const s0 = get();
    const ig = s0.instagram;
    if (ig.media.length === 0) return;

    // Revoke existing local URLs to avoid leaks, then replace with IG items.
    const grid0 = s0.grids.find((g) => g.id === s0.activeGridId) ?? s0.grids[0];
    for (const it of grid0.items) revokeItemUrls(it);

    const nextItems = instagramMediaToGridItems(ig.media);
    set((s) => ({
      grids: s.grids.map((g) => (g.id === s.activeGridId ? { ...g, items: nextItems, crops: {} } : g)),
      cropModal: { open: false, gridId: null, itemId: null, cropKey: null, targetAspect: null },
    }));
  },

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
            source: "local",
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
            source: "local",
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

  replaceItemFile: async ({ itemId, file }) => {
    if (!file) return;

    const s0 = get();
    const grid0 = s0.grids.find((g) => g.id === s0.activeGridId) ?? s0.grids[0];
    const idx = grid0.items.findIndex((x) => x.id === itemId);
    if (idx < 0) return;

    const prev = grid0.items[idx];

    const objectUrl = URL.createObjectURL(file);
    try {
      let next: MediaItem;
      if (file.type.startsWith("video/")) {
        const v = await extractVideoPreview(objectUrl);
        next = {
          ...prev,
          fileName: file.name,
          kind: "video",
          source: "local",
          objectUrl,
          previewUrl: v.previewUrl,
          width: v.width,
          height: v.height,
          aspect: v.width / v.height,
          remoteId: undefined,
          permalink: undefined,
          timestamp: undefined,
        };
      } else {
        const meta = await loadImageMeta(objectUrl);
        next = {
          ...prev,
          fileName: file.name,
          kind: "image",
          source: "local",
          objectUrl,
          previewUrl: objectUrl,
          width: meta.width,
          height: meta.height,
          aspect: meta.width / meta.height,
          remoteId: undefined,
          permalink: undefined,
          timestamp: undefined,
        };
      }

      // Revoke previous local URLs to avoid leaks.
      if (prev.source === "local") revokeItemUrls(prev);

      set((s) => ({
        grids: s.grids.map((g) => {
          if (g.id !== s.activeGridId) return g;
          const nextItems = g.items.slice();
          nextItems[idx] = next;
          const nextCrops = { ...g.crops };
          delete nextCrops[itemId]; // reset crop for replaced media
          return { ...g, items: nextItems, crops: nextCrops };
        }),
        cropModal: { open: false, gridId: null, itemId: null, cropKey: null, targetAspect: null },
      }));
    } catch {
      URL.revokeObjectURL(objectUrl);
    }
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
  })),
);

function revokeAllLocalUrls(grids: GridState[]) {
  for (const g of grids) {
    for (const it of g.items) revokeItemUrls(it);
  }
}

function closeCropModalState(): CropModalState {
  return { open: false, gridId: null, itemId: null, cropKey: null, targetAspect: null };
}

let persistenceReady = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let persistRunning = false;
let persistPending = false;

async function flushPersist() {
  if (!persistenceReady) return;
  if (persistRunning) {
    persistPending = true;
    return;
  }
  persistRunning = true;
  try {
    const s = useAppStore.getState();
    await persistGridsLocally({ grids: s.grids, activeGridId: s.activeGridId });
  } finally {
    persistRunning = false;
    if (persistPending) {
      persistPending = false;
      void flushPersist();
    }
  }
}

function schedulePersist() {
  if (!persistenceReady) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void flushPersist();
  }, 500);
}

async function initLocalPersistence() {
  try {
    const info = await peekLocalSnapshotInfo();
    useAppStore.setState((s) => ({
      persistence: {
        ...s.persistence,
        snapshot: info.hasSnapshot ? "present" : "none",
        hydrating: info.hasSnapshot && info.totalItems > 0,
        error: null,
      },
    }));

    // Hydrate from IndexedDB (if any), then enable autosave.
    const loaded = info.hasSnapshot ? await loadGridsFromLocal() : null;
    if (loaded) {
      const current = useAppStore.getState();
      revokeAllLocalUrls(current.grids);
      useAppStore.setState((s) => ({
        grids: loaded.grids,
        activeGridId: loaded.activeGridId,
        cropModal: closeCropModalState(),
        persistence: { ...s.persistence, hydrating: false, error: null },
      }));
    } else {
      useAppStore.setState((s) => ({ persistence: { ...s.persistence, hydrating: false } }));
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load local snapshot";
    useAppStore.setState((s) => ({ persistence: { ...s.persistence, hydrating: false, error: msg } }));
  } finally {
    persistenceReady = true;
  }
}

if (typeof window !== "undefined") {
  void initLocalPersistence();

  useAppStore.subscribe(
    (s) => ({ grids: s.grids, activeGridId: s.activeGridId }),
    () => schedulePersist(),
    { equalityFn: shallow },
  );
}

