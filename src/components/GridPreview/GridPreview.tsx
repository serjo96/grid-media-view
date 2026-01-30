import { useMemo, useRef } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { useAppStore } from "../../store/useAppStore";
import type { LayoutRect } from "../../domain/layout/LayoutEngine";
import { presetEngines } from "../../domain/layout/presets";
import { useElementSize } from "../../hooks/useElementSize";
import { SortableTile } from "./SortableTile";

type PxRect = { left: number; top: number; width: number; height: number };

function approxEq(a: number, b: number, eps = 1e-6) {
  return Math.abs(a - b) <= eps;
}

function buildCustomGridRects(args: { ids: string[]; columns: number; tileAspect: number }): {
  rects: LayoutRect[];
  normalizedHeight: number;
} {
  const cols = Math.max(1, Math.min(8, Math.round(args.columns)));
  const tileW = 1 / cols;
  const tileH = tileW / Math.max(0.1, args.tileAspect);
  const rows = Math.ceil(args.ids.length / cols) || 1;
  const totalH = rows * tileH;

  const rects: LayoutRect[] = args.ids.map((id, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const colsInRow = row === rows - 1 ? ((args.ids.length - row * cols) % cols || cols) : cols;
    return {
      id,
      x: col * tileW,
      y: row * tileH,
      w: tileW,
      h: tileH,
      aspect: tileW / tileH,
      round: {
        tl: row === 0 && col === 0,
        tr: row === 0 && col === colsInRow - 1,
        bl: row === rows - 1 && col === 0,
        br: row === rows - 1 && col === colsInRow - 1,
      },
    };
  });

  return { rects, normalizedHeight: totalH };
}

function applyGap(args: {
  rect: LayoutRect;
  px: PxRect;
  gap: number;
  layoutHeightNorm: number;
}): PxRect {
  const { rect, px, gap, layoutHeightNorm } = args;
  if (gap <= 0) return px;

  const e = 1e-6;
  const isLeft = approxEq(rect.x, 0, e);
  const isRight = approxEq(rect.x + rect.w, 1, e);
  const isTop = approxEq(rect.y, 0, e);
  const isBottom = approxEq(rect.y + rect.h, layoutHeightNorm, e);

  const half = gap / 2;
  const left = px.left + (isLeft ? 0 : half);
  const top = px.top + (isTop ? 0 : half);
  const width = px.width - (isLeft ? half : gap) - (isRight ? half : 0);
  const height = px.height - (isTop ? half : gap) - (isBottom ? half : 0);

  return {
    left,
    top,
    width: Math.max(1, width),
    height: Math.max(1, height),
  };
}

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

