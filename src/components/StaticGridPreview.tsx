import { useMemo, useRef } from "react";
import type { PresetId } from "../domain/layout/presets";
import { presetEngines } from "../domain/layout/presets";
import type { GridState } from "../store/useAppStore";
import { defaultCoverCrop } from "../domain/crop/defaultCrop";
import { cropToImgStyle } from "../domain/crop/applyCropToCss";
import type { CropAreaNorm } from "../domain/crop/cropTypes";
import { applyGap, buildCustomGridRects, type PxRect } from "./GridPreview/layoutHelpers";
import { useElementSize } from "../hooks/useElementSize";

function getPresetGap(preset: PresetId, customGap: number) {
  if (preset === "custom") return customGap;
  if (preset === "tg") return 2;
  return 2;
}

function getDefaultWidth(preset: PresetId, customWidth: number) {
  if (preset === "custom") return customWidth;
  if (preset === "inst") return 560;
  return 460;
}

export function StaticGridPreview(props: {
  grid: GridState;
  presetOverride?: PresetId;
  widthPx?: number;
  maxWidthPx?: number;
  className?: string;
}) {
  const { grid, presetOverride, widthPx, maxWidthPx = 560, className } = props;
  const preset = presetOverride ?? grid.preset;
  const items = preset === "tg" ? grid.items.slice(0, 10) : grid.items;
  const custom = grid.custom;

  const stageWrapRef = useRef<HTMLDivElement | null>(null);
  const { width: availableWidth } = useElementSize(stageWrapRef);

  const layout = useMemo(() => {
    const layoutItems = items.map((i) => ({ id: i.id, aspect: i.aspect }));
    if (preset === "custom") {
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
  const containerWidthPx = Math.max(240, Math.min(maxWidthPx, Math.floor(availableWidth || targetWidth), targetWidth));
  const stageHeightPx = Math.max(120, containerWidthPx * layout.normalizedHeight);
  const gap = getPresetGap(preset, custom.gap);

  if (items.length === 0) {
    return <div className="uploadHint">Пусто</div>;
  }

  return (
    <div className={className}>
      <div className="previewCanvas" style={{ padding: 8 }}>
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
              const cropKey = `${preset}:${targetAspect.toFixed(4)}`;
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
                    borderRadius: 14,
                    borderTopLeftRadius: r.round?.tl ? 18 : 12,
                    borderTopRightRadius: r.round?.tr ? 18 : 12,
                    borderBottomLeftRadius: r.round?.bl ? 18 : 12,
                    borderBottomRightRadius: r.round?.br ? 18 : 12,
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

