import { useMemo } from "react";
import { useAppStore, type GridState, type MediaItem } from "../../store/useAppStore";
import { PresetId } from "../../domain/layout/presets";
import { PRESET_WIDTH_INSTAGRAM, PRESET_WIDTH_CUSTOM_DEFAULT } from "../../domain/layout/constants";
import type { InstagramMedia } from "../../domain/instagram/instagramApi";
import { StaticGridPreview } from "../StaticGridPreview";
import { GridPreview } from "../GridPreview/GridPreview";

interface InstagramViewProps {
  editMode: boolean;
  editTargetId: string | null;
  onRequestReplace: (itemId: string) => void;
  onScrollToInstagramPanel?: () => void;
}

function mediaToItems(media: InstagramMedia[]): MediaItem[] {
  const defaultW = 1080;
  const defaultH = 1080;
  return media.map((m) => {
    const kind = m.media_type === "VIDEO" ? "video" : "image";
    return {
      id: m.id,
      fileName: `IG ${m.id}`,
      kind,
      source: "instagram",
      objectUrl: m.media_url,
      previewUrl: m.thumbnail_url ?? m.media_url,
      width: defaultW,
      height: defaultH,
      aspect: defaultW / defaultH,
      remoteId: m.id,
      permalink: m.permalink,
      timestamp: m.timestamp,
    };
  });
}

export function InstagramView(props: InstagramViewProps) {
  const { editMode, editTargetId, onRequestReplace, onScrollToInstagramPanel } = props;
  const ig = useAppStore((s) => s.instagram);
  const activeGrid = useAppStore((s) => s.grids.find((g) => g.id === s.activeGridId) ?? s.grids[0]);

  const currentGrid = useMemo<GridState>(() => {
    return {
      id: "ig_current",
      name: "Instagram current",
      createdAt: ig.lastFetchedAt ?? 0,
      preset: PresetId.Instagram,
      custom: activeGrid?.custom ?? { columns: 3, tileAspect: 1, gap: 6, containerWidth: PRESET_WIDTH_CUSTOM_DEFAULT },
      items: mediaToItems(ig.media),
      crops: {},
    };
  }, [activeGrid?.custom, ig.lastFetchedAt, ig.media]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <div style={{ fontWeight: 650, fontSize: 13, marginBottom: 6 }}>Current Instagram grid</div>
        {ig.media.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="uploadHint">Нет данных. Подключите аккаунт (token) и нажмите Connect/Refresh.</div>
            {onScrollToInstagramPanel && (
              <button
                className="btn"
                type="button"
                onClick={onScrollToInstagramPanel}
                style={{ alignSelf: "flex-start" }}
              >
                Подключить Instagram
              </button>
            )}
          </div>
        ) : (
          <StaticGridPreview grid={currentGrid} presetOverride={PresetId.Instagram} widthPx={PRESET_WIDTH_INSTAGRAM} maxWidthPx={PRESET_WIDTH_INSTAGRAM} />
        )}
      </div>

      <div>
        <div style={{ fontWeight: 650, fontSize: 13, marginBottom: 6 }}>Planned grid (editable)</div>
        <div className="uploadHint" style={{ marginBottom: 10 }}>
          Это ваш активный грид: можно драгать, кропать и добавлять локальные файлы даже без авторизации.
        </div>
        <GridPreview editMode={editMode} editTargetId={editTargetId} onRequestReplace={onRequestReplace} />
      </div>
    </div>
  );
}

