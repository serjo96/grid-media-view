import { useEffect, useMemo, useRef } from "react";
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

  const stageWrapRef = useRef<HTMLDivElement | null>(null);
  const { width: availableWidth } = useElementSize(stageWrapRef, "GridPreview.previewStageWrap");

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
    const safeAvail = availableWidth ? Math.max(0, Math.floor(availableWidth) - 2) : 0;
    const viewport =
      typeof document !== "undefined"
        ? Math.floor(document.documentElement?.clientWidth || (typeof window !== "undefined" ? window.innerWidth : 0))
        : 0;
    const viewportClamp = viewport ? Math.max(0, viewport - 24) : Number.POSITIVE_INFINITY;
    return Math.max(160, Math.min(target, Math.floor(safeAvail || target), viewportClamp));
  }, [availableWidth, custom.containerWidth, preset]);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const debugEnabled = (import.meta as any).env?.DEV && (globalThis as any).__GRID_DEBUG === true;
    if (!debugEnabled) return;

    const el = stageWrapRef.current;
    const rect = el?.getBoundingClientRect();

    // eslint-disable-next-line no-console
    console.groupCollapsed("[grid-debug] GridPreview width calc");
    // eslint-disable-next-line no-console
    console.log({ preset, availableWidth, containerWidthPx });
    // eslint-disable-next-line no-console
    console.log("wrapRect", rect ? { width: rect.width, height: rect.height } : null);
    // eslint-disable-next-line no-console
    console.log("documentElement.clientWidth", document?.documentElement?.clientWidth);
    // eslint-disable-next-line no-console
    console.groupEnd();
  }, [availableWidth, containerWidthPx, preset]);

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

      <div className="previewCanvas">
        <div ref={stageWrapRef} className="previewStageWrap">
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
    </div>
  );
}

