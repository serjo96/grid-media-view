import { useCallback, useMemo, useRef } from "react";
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, closestCenter } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { useAppStore } from "../../store/useAppStore";
import { PresetId, presetEngines } from "../../domain/layout/presets";
import {
  ASPECT_PRECISION,
  DRAG_LONG_PRESS_DELAY,
  DRAG_LONG_PRESS_TOLERANCE,
  MIN_CONTAINER_WIDTH,
  MIN_STAGE_HEIGHT,
  PRESET_GAP_TELEGRAM,
  PRESET_GAP_INSTAGRAM,
  PRESET_WIDTH_TELEGRAM,
  PRESET_WIDTH_INSTAGRAM,
  PRESET_WIDTH_CUSTOM_DEFAULT,
  SAFE_AVAIL_OFFSET,
  TELEGRAM_MAX_ITEMS,
  VIEWPORT_PADDING,
} from "../../domain/layout/constants";
import { useElementSize } from "../../hooks/useElementSize";
import { SortableTile } from "./SortableTile";
import type { PxRect } from "./layoutHelpers";
import { applyGap, buildCustomGridRects } from "./layoutHelpers";

export function GridPreview(props: {
  editMode: boolean;
  editTargetId: string | null;
  onRequestReplace: (itemId: string) => void;
}) {
  const { editMode, editTargetId, onRequestReplace } = props;
  const activeGrid = useAppStore((s) => s.grids.find((g) => g.id === s.activeGridId) ?? s.grids[0]);
  const preset = activeGrid?.preset ?? PresetId.Telegram;
  const custom = activeGrid?.custom ?? { columns: 3, tileAspect: 1, gap: 6, containerWidth: PRESET_WIDTH_CUSTOM_DEFAULT };
  const items = activeGrid?.items ?? [];
  const reorder = useAppStore((s) => s.reorder);

  const stageWrapNodeRef = useRef<HTMLDivElement | null>(null);
  const scrollPositionRef = useRef<{ x: number; y: number } | null>(null);
  const { ref: measureRef, width: availableWidth } = useElementSize<HTMLDivElement>("GridPreview.previewStageWrap");
  const stageWrapRef = useCallback(
    (el: HTMLDivElement | null) => {
      stageWrapNodeRef.current = el;
      measureRef(el);
    },
    [measureRef],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: DRAG_LONG_PRESS_DELAY, tolerance: DRAG_LONG_PRESS_TOLERANCE },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: DRAG_LONG_PRESS_DELAY, tolerance: DRAG_LONG_PRESS_TOLERANCE },
    }),
  );

  const layout = useMemo(() => {
    const layoutItems =
      preset === PresetId.Telegram
        ? items.slice(0, TELEGRAM_MAX_ITEMS).map((i) => ({ id: i.id, aspect: i.aspect }))
        : items.map((i) => ({ id: i.id, aspect: i.aspect }));

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

  const containerWidthPx = useMemo(() => {
    const target =
      preset === PresetId.Custom
        ? custom.containerWidth
        : preset === PresetId.Instagram
          ? PRESET_WIDTH_INSTAGRAM
          : PRESET_WIDTH_TELEGRAM;
    const safeAvail = availableWidth ? Math.max(0, Math.floor(availableWidth) - SAFE_AVAIL_OFFSET) : 0;
    const viewport =
      typeof document !== "undefined"
        ? Math.floor(document.documentElement?.clientWidth || (typeof window !== "undefined" ? window.innerWidth : 0))
        : 0;
    const viewportClamp = viewport ? Math.max(0, viewport - VIEWPORT_PADDING) : Number.POSITIVE_INFINITY;
    return Math.max(MIN_CONTAINER_WIDTH, Math.min(target, Math.floor(safeAvail || target), viewportClamp));
  }, [availableWidth, custom.containerWidth, preset]);

  const gap = useMemo(() => {
    if (preset === PresetId.Custom) return custom.gap;
    if (preset === PresetId.Telegram) return PRESET_GAP_TELEGRAM;
    return PRESET_GAP_INSTAGRAM;
  }, [custom.gap, preset]);

  const stageHeightPx = Math.max(MIN_STAGE_HEIGHT, containerWidthPx * layout.normalizedHeight);

  const ids = useMemo(
    () =>
      (preset === PresetId.Telegram ? items.slice(0, TELEGRAM_MAX_ITEMS) : items).map((i) => i.id),
    [items, preset],
  );

  if (items.length === 0) {
    return <div className="uploadHint">Добавьте файлы, чтобы увидеть раскладку.</div>;
  }

  return (
    <div className="previewWrap">
      {preset === PresetId.Telegram && items.length > TELEGRAM_MAX_ITEMS && (
        <div className="uploadHint">Показаны первые {TELEGRAM_MAX_ITEMS} файлов (лимит альбома Telegram).</div>
      )}

      <div className="previewCanvas">
        <div ref={stageWrapRef} className="previewStageWrap">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={() => {
              // Сохраняем позицию скролла перед началом перетаскивания
              scrollPositionRef.current = {
                x: window.scrollX,
                y: window.scrollY,
              };
            }}
            onDragEnd={(e) => {
              if (editMode) return;
              const overId = e.over?.id;
              if (!overId) return;
              reorder(String(e.active.id), String(overId));
              
              // Восстанавливаем позицию скролла после завершения перетаскивания
              if (scrollPositionRef.current) {
                requestAnimationFrame(() => {
                  window.scrollTo({
                    left: scrollPositionRef.current!.x,
                    top: scrollPositionRef.current!.y,
                    behavior: "instant",
                  });
                  scrollPositionRef.current = null;
                });
              }
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
                  const cropKey = `${preset}:${(r.w / r.h).toFixed(ASPECT_PRECISION)}`;
                  return (
                    <SortableTile
                      key={r.id}
                      rect={r}
                      pxRect={pxWithGap}
                      index={idx}
                      cropKey={cropKey}
                      editMode={editMode}
                      isEditSelected={editMode && editTargetId === r.id}
                      onRequestReplace={onRequestReplace}
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
