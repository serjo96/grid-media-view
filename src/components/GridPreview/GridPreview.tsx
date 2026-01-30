import { useMemo, useRef } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { useAppStore } from "../../store/useAppStore";
import { presetEngines } from "../../domain/layout/presets";
import { useElementSize } from "../../hooks/useElementSize";
import { SortableTile } from "./SortableTile";
import type { PxRect } from "./layoutHelpers";
import { applyGap, buildCustomGridRects } from "./layoutHelpers";

export function GridPreview() {
  const activeGrid = useAppStore((s) => s.grids.find((g) => g.id === s.activeGridId) ?? s.grids[0]);
  const preset = activeGrid?.preset ?? "tg";
  const custom = activeGrid?.custom ?? { columns: 3, tileAspect: 1, gap: 6, containerWidth: 420 };
  const items = activeGrid?.items ?? [];
  const reorder = useAppStore((s) => s.reorder);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const { width: availableWidth } = useElementSize(stageRef);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
  );

  const layout = useMemo(() => {
    const layoutItems =
      preset === "tg"
        ? items.slice(0, 10).map((i) => ({ id: i.id, aspect: i.aspect }))
        : items.map((i) => ({ id: i.id, aspect: i.aspect }));

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

  const containerWidthPx = useMemo(() => {
    const target =
      preset === "custom"
        ? custom.containerWidth
        : preset === "inst"
          ? 560
          : 460;
    return Math.max(240, Math.min(target, Math.floor(availableWidth || target)));
  }, [availableWidth, custom.containerWidth, preset]);

  const gap = useMemo(() => {
    if (preset === "custom") return custom.gap;
    if (preset === "tg") return 2;
    return 2;
  }, [custom.gap, preset]);

  const stageHeightPx = Math.max(120, containerWidthPx * layout.normalizedHeight);

  const ids = useMemo(
    () =>
      (preset === "tg" ? items.slice(0, 10) : items).map((i) => i.id),
    [items, preset],
  );

  if (items.length === 0) {
    return <div className="uploadHint">Добавьте файлы, чтобы увидеть раскладку.</div>;
  }

  return (
    <div className="previewWrap">
      {preset === "tg" && items.length > 10 && (
        <div className="uploadHint">Показаны первые 10 файлов (лимит альбома Telegram).</div>
      )}

      <div ref={stageRef} className="previewCanvas">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(e) => {
            const overId = e.over?.id;
            if (!overId) return;
            reorder(String(e.active.id), String(overId));
          }}
        >
          <SortableContext items={ids} strategy={rectSortingStrategy}>
            <div
              className="gridStage"
              style={{
                width: `${containerWidthPx}px`,
                height: `${stageHeightPx}px`,
              }}
            >
              {layout.rects.map((r, idx) => {
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
                const cropKey = `${preset}:${(r.w / r.h).toFixed(4)}`;
                return (
                  <SortableTile
                    key={r.id}
                    rect={r}
                    pxRect={pxWithGap}
                    index={idx}
                    cropKey={cropKey}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}

