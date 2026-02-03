import { useCallback, useMemo, useRef } from "react";
import { PresetId, presetEngines } from "../domain/layout/presets";
import {
  MIN_CONTAINER_WIDTH,
  MIN_STAGE_HEIGHT,
  PRESET_GAP_INSTAGRAM,
  PRESET_GAP_TELEGRAM,
  PRESET_WIDTH_INSTAGRAM,
  PRESET_WIDTH_TELEGRAM,
  SAFE_AVAIL_OFFSET,
  STATIC_PREVIEW_PADDING,
  TELEGRAM_MAX_ITEMS,
  VIEWPORT_PADDING,
  BORDER_RADIUS_DEFAULT,
  BORDER_RADIUS_ROUNDED,
  BORDER_RADIUS_SMALL,
  ASPECT_PRECISION,
} from "../domain/layout/constants";
import type { GridState } from "../store/useAppStore";
import { defaultCoverCrop } from "../domain/crop/defaultCrop";
import { cropToImgStyle } from "../domain/crop/applyCropToCss";
import type { CropAreaNorm } from "../domain/crop/cropTypes";
import { applyGap, buildCustomGridRects, type PxRect } from "./GridPreview/layoutHelpers";
import { useElementSize } from "../hooks/useElementSize";

function getPresetGap(preset: PresetId, customGap: number) {
  if (preset === PresetId.Custom) return customGap;
  if (preset === PresetId.Telegram) return PRESET_GAP_TELEGRAM;
  return PRESET_GAP_INSTAGRAM;
}

function getDefaultWidth(preset: PresetId, customWidth: number) {
  if (preset === PresetId.Custom) return customWidth;
  if (preset === PresetId.Instagram) return PRESET_WIDTH_INSTAGRAM;
  return PRESET_WIDTH_TELEGRAM;
}

export function StaticGridPreview(props: {
  grid: GridState;
  presetOverride?: PresetId;
  widthPx?: number;
  maxWidthPx?: number;
  className?: string;
}) {
  const { grid, presetOverride, widthPx, maxWidthPx = PRESET_WIDTH_INSTAGRAM, className } = props;
  const preset = presetOverride ?? grid.preset;
  const items = preset === PresetId.Telegram ? grid.items.slice(0, TELEGRAM_MAX_ITEMS) : grid.items;
  const custom = grid.custom;

  const stageWrapNodeRef = useRef<HTMLDivElement | null>(null);
  const { ref: measureRef, width: availableWidth } =
    useElementSize<HTMLDivElement>("StaticGridPreview.previewStageWrap");
  const stageWrapRef = useCallback(
    (el: HTMLDivElement | null) => {
      stageWrapNodeRef.current = el;
      measureRef(el);
    },
    [measureRef],
  );

  const layout = useMemo(() => {
    const layoutItems = items.map((i) => ({ id: i.id, aspect: i.aspect }));
    if (preset === PresetId.Custom) {
      return buildCustomGridRects({
        ids: layoutItems.map((i) => i.id),
        columns: custom.columns,
        tileAspect: custom.tileAspect,
      });
    }
    const engine = presetEngines[preset];
    return engine({ items: layoutItems, containerAspect: 1 });
  }, [custom.columns, custom.tileAspect, items, preset]);

  const targetWidth = Math.floor(widthPx ?? getDefaultWidth(preset, custom.containerWidth));
  const safeAvail = availableWidth ? Math.max(0, Math.floor(availableWidth) - SAFE_AVAIL_OFFSET) : 0;
  const viewport =
    typeof document !== "undefined"
      ? Math.floor(document.documentElement?.clientWidth || (typeof window !== "undefined" ? window.innerWidth : 0))
      : 0;
  const viewportClamp = viewport ? Math.max(0, viewport - VIEWPORT_PADDING) : Number.POSITIVE_INFINITY;
  const containerWidthPx = Math.max(
    MIN_CONTAINER_WIDTH,
    Math.min(maxWidthPx, Math.floor(safeAvail || targetWidth), targetWidth, viewportClamp),
  );
  const stageHeightPx = Math.max(MIN_STAGE_HEIGHT, containerWidthPx * layout.normalizedHeight);
  const gap = getPresetGap(preset, custom.gap);

  if (items.length === 0) {
    return <div className="uploadHint">Пусто</div>;
  }

  return (
    <div className={className}>
      <div className="previewCanvas" style={{ padding: STATIC_PREVIEW_PADDING }}>
        <div ref={stageWrapRef} className="previewStageWrap">
          <div
            className="gridStage"
            style={{
              width: `${containerWidthPx}px`,
              height: `${stageHeightPx}px`,
            }}
          >
            {layout.rects.map((r) => {
              const px: PxRect = {
                left: r.x * containerWidthPx,
                top: r.y * containerWidthPx,
                width: r.w * containerWidthPx,
                height: r.h * containerWidthPx,
              };
              const pxWithGap = applyGap({
                rect: r,
                px,
                gap,
                layoutHeightNorm: layout.normalizedHeight,
              });

              const item = items.find((x) => x.id === r.id) ?? null;
              const targetAspect = r.w / r.h;
              const cropKey = `${preset}:${targetAspect.toFixed(ASPECT_PRECISION)}`;
              const savedCrop: CropAreaNorm | null = (item ? grid.crops[item.id]?.[cropKey] : null) ?? null;
              const crop =
                item && (savedCrop ?? defaultCoverCrop({ imageWidth: item.width, imageHeight: item.height, targetAspect }));

              return (
                <div
                  key={r.id}
                  className="tile"
                  style={{
                    left: `${pxWithGap.left}px`,
                    top: `${pxWithGap.top}px`,
                    width: `${pxWithGap.width}px`,
                    height: `${pxWithGap.height}px`,
                    borderRadius: BORDER_RADIUS_DEFAULT,
                    borderTopLeftRadius: r.round?.tl ? BORDER_RADIUS_ROUNDED : BORDER_RADIUS_SMALL,
                    borderTopRightRadius: r.round?.tr ? BORDER_RADIUS_ROUNDED : BORDER_RADIUS_SMALL,
                    borderBottomLeftRadius: r.round?.bl ? BORDER_RADIUS_ROUNDED : BORDER_RADIUS_SMALL,
                    borderBottomRightRadius: r.round?.br ? BORDER_RADIUS_ROUNDED : BORDER_RADIUS_SMALL,
                  }}
                >
                  <div className="tileInner">
                    {item && crop && (
                      <img
                        src={item.previewUrl}
                        alt={item.fileName}
                        draggable={false}
                        style={cropToImgStyle({
                          tileW: pxWithGap.width,
                          tileH: pxWithGap.height,
                          imageW: item.width,
                          imageH: item.height,
                          crop,
                        })}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

