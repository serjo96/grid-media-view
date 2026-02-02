import { idbDelBlob, idbGetBlob, idbGetKv, idbListBlobKeys, idbPutBlob, idbSetKv } from "./idb";
import type { CropAreaNorm } from "../domain/crop/cropTypes";
import type { PresetId } from "../domain/layout/presets";
import type { CustomPreset, GridState, MediaItem } from "../store/useAppStore";

type PersistedItemV1 =
  | {
      id: string;
      fileName: string;
      kind: "image" | "video";
      source: "instagram";
      objectUrl: string;
      previewUrl: string;
      width: number;
      height: number;
      aspect: number;
      remoteId?: string;
      permalink?: string;
      timestamp?: string;
    }
  | {
      id: string;
      fileName: string;
      kind: "image" | "video";
      source: "local";
      width: number;
      height: number;
      aspect: number;
      origBlobKey: string;
      previewBlobKey?: string;
    };

type PersistedGridV1 = {
  id: string;
  name: string;
  createdAt: number;
  preset: PresetId;
  custom: CustomPreset;
  items: PersistedItemV1[];
  crops: Record<string, Record<string, CropAreaNorm>>;
};

type PersistedAppV1 = {
  v: 1;
  savedAt: number;
  activeGridId: string;
  grids: PersistedGridV1[];
};

const KV_APP_KEY = "gridTest:appState:v1";
const BLOB_PREFIX = "gridTest:media:v1:";

export type LocalSnapshotInfo = {
  hasSnapshot: boolean;
  gridCount: number;
  totalItems: number;
  localItems: number;
};

export async function peekLocalSnapshotInfo(): Promise<LocalSnapshotInfo> {
  const app = await idbGetKv<PersistedAppV1>(KV_APP_KEY);
  if (!app || app.v !== 1 || !Array.isArray(app.grids)) {
    return { hasSnapshot: false, gridCount: 0, totalItems: 0, localItems: 0 };
  }
  let total = 0;
  let local = 0;
  for (const g of app.grids) {
    const items = g.items ?? [];
    total += items.length;
    for (const it of items) if (it.source === "local") local += 1;
  }
  return { hasSnapshot: true, gridCount: app.grids.length, totalItems: total, localItems: local };
}

function origKey(gridId: string, itemId: string) {
  return `${BLOB_PREFIX}${gridId}:${itemId}:orig`;
}
function previewKey(gridId: string, itemId: string) {
  return `${BLOB_PREFIX}${gridId}:${itemId}:preview`;
}

async function blobFromUrl(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to read blob: ${res.status}`);
  return await res.blob();
}

function serializeApp(args: { grids: GridState[]; activeGridId: string }): PersistedAppV1 {
  return {
    v: 1,
    savedAt: Date.now(),
    activeGridId: args.activeGridId,
    grids: args.grids.map((g) => ({
      id: g.id,
      name: g.name,
      createdAt: g.createdAt,
      preset: g.preset,
      custom: g.custom,
      crops: g.crops,
      items: g.items.map((it) => {
        if (it.source === "instagram") {
          return {
            id: it.id,
            fileName: it.fileName,
            kind: it.kind,
            source: "instagram",
            objectUrl: it.objectUrl,
            previewUrl: it.previewUrl,
            width: it.width,
            height: it.height,
            aspect: it.aspect,
            remoteId: it.remoteId,
            permalink: it.permalink,
            timestamp: it.timestamp,
          };
        }
        return {
          id: it.id,
          fileName: it.fileName,
          kind: it.kind,
          source: "local",
          width: it.width,
          height: it.height,
          aspect: it.aspect,
          origBlobKey: origKey(g.id, it.id),
          previewBlobKey: it.kind === "video" ? previewKey(g.id, it.id) : undefined,
        };
      }),
    })),
  };
}

let savedBlobKeys = new Set<string>();

async function ensureLocalBlobs(args: { grids: GridState[] }) {
  for (const g of args.grids) {
    for (const it of g.items) {
      if (it.source !== "local") continue;

      const kOrig = origKey(g.id, it.id);
      if (!savedBlobKeys.has(kOrig)) {
        const exists = await idbGetBlob(kOrig);
        if (exists) {
          savedBlobKeys.add(kOrig);
        } else {
          const blob = await blobFromUrl(it.objectUrl);
          const ok = await idbPutBlob(kOrig, blob);
          if (ok) savedBlobKeys.add(kOrig);
        }
      }

      if (it.kind === "video") {
        const kPrev = previewKey(g.id, it.id);
        if (!savedBlobKeys.has(kPrev)) {
          const existsPrev = await idbGetBlob(kPrev);
          if (existsPrev) {
            savedBlobKeys.add(kPrev);
          } else {
            // previewUrl is expected to be a jpeg blob URL created by the app
            const blobPrev = await blobFromUrl(it.previewUrl);
            const okPrev = await idbPutBlob(kPrev, blobPrev);
            if (okPrev) savedBlobKeys.add(kPrev);
          }
        }
      }
    }
  }
}

async function cleanupUnusedBlobs(neededKeys: Set<string>) {
  const all = await idbListBlobKeys(BLOB_PREFIX);
  for (const k of all) {
    if (!neededKeys.has(k)) await idbDelBlob(k);
  }
  // keep cache aligned
  savedBlobKeys = new Set(Array.from(savedBlobKeys).filter((k) => neededKeys.has(k)));
}

export async function persistGridsLocally(args: { grids: GridState[]; activeGridId: string }) {
  const app = serializeApp(args);

  // Ensure blobs first; if that fails, we still store JSON snapshot.
  try {
    await ensureLocalBlobs({ grids: args.grids });
  } catch {
    // ignore
  }

  await idbSetKv(KV_APP_KEY, app);

  // Optional cleanup to avoid unbounded growth.
  const needed = new Set<string>();
  for (const g of app.grids) {
    for (const it of g.items) {
      if (it.source !== "local") continue;
      needed.add(it.origBlobKey);
      if (it.previewBlobKey) needed.add(it.previewBlobKey);
    }
  }
  void cleanupUnusedBlobs(needed);
}

export async function loadGridsFromLocal(): Promise<{ grids: GridState[]; activeGridId: string } | null> {
  const app = await idbGetKv<PersistedAppV1>(KV_APP_KEY);
  if (!app || app.v !== 1 || !Array.isArray(app.grids)) return null;

  const grids: GridState[] = [];

  for (const g of app.grids) {
    const items: MediaItem[] = [];
    for (const it of g.items ?? []) {
      if (it.source === "instagram") {
        items.push({
          id: it.id,
          fileName: it.fileName,
          kind: it.kind,
          source: "instagram",
          objectUrl: it.objectUrl,
          previewUrl: it.previewUrl,
          width: it.width,
          height: it.height,
          aspect: it.aspect,
          remoteId: it.remoteId,
          permalink: it.permalink,
          timestamp: it.timestamp,
        });
        continue;
      }

      const blob = await idbGetBlob(it.origBlobKey);
      if (!blob) continue;
      const objectUrl = URL.createObjectURL(blob);

      if (it.kind === "video") {
        const pBlob = it.previewBlobKey ? await idbGetBlob(it.previewBlobKey) : null;
        const previewUrl = pBlob ? URL.createObjectURL(pBlob) : objectUrl;
        items.push({
          id: it.id,
          fileName: it.fileName,
          kind: "video",
          source: "local",
          objectUrl,
          previewUrl,
          width: it.width,
          height: it.height,
          aspect: it.aspect,
        });
      } else {
        items.push({
          id: it.id,
          fileName: it.fileName,
          kind: "image",
          source: "local",
          objectUrl,
          previewUrl: objectUrl,
          width: it.width,
          height: it.height,
          aspect: it.aspect,
        });
      }
    }

    grids.push({
      id: g.id,
      name: g.name,
      createdAt: g.createdAt,
      preset: g.preset,
      custom: g.custom,
      items,
      crops: g.crops ?? {},
    });
  }

  const activeGridId = grids.some((x) => x.id === app.activeGridId) ? app.activeGridId : (grids[0]?.id ?? "");
  if (!activeGridId) return null;

  return { grids, activeGridId };
}

