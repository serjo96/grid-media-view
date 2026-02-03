import { useMemo } from "react";
import type { LayoutRect } from "../../domain/layout/LayoutEngine";
import { defaultCoverCrop } from "../../domain/crop/defaultCrop";
import { cropToImgStyle } from "../../domain/crop/applyCropToCss";
import { useAppStore } from "../../store/useAppStore";
import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";

export function SortableTile(props: {
  rect: LayoutRect;
  pxRect: { left: number; top: number; width: number; height: number };
  index: number;
  cropKey: string;
  editMode: boolean;
  isEditSelected: boolean;
  onRequestReplace: (itemId: string) => void;
}) {
  const { rect, pxRect, index, cropKey, editMode, isEditSelected, onRequestReplace } = props;

  const item = useAppStore(
    (s) => (s.grids.find((g) => g.id === s.activeGridId) ?? s.grids[0])?.items.find((i) => i.id === rect.id) ?? null,
  );
  const savedCrop = useAppStore(
    (s) => (s.grids.find((g) => g.id === s.activeGridId) ?? s.grids[0])?.crops[rect.id]?.[cropKey] ?? null,
  );
  const openCrop = useAppStore((s) => s.openCrop);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: rect.id,
    disabled: !item || editMode,
  });

  const style = useMemo(() => {
    const t = transform ? CSS.Transform.toString(transform) : undefined;
    return {
      transform: t,
      transition,
      opacity: isDragging ? 0.7 : 1,
      zIndex: isDragging ? 50 : 1,
      left: `${pxRect.left}px`,
      top: `${pxRect.top}px`,
      width: `${pxRect.width}px`,
      height: `${pxRect.height}px`,
      borderRadius: 14,
    } as const;
  }, [isDragging, pxRect.height, pxRect.left, pxRect.top, pxRect.width, transform, transition]);

  const targetAspect = rect.w / rect.h;

  const crop = useMemo(() => {
    if (!item) return null;
    if (savedCrop) return savedCrop;
    return defaultCoverCrop({ imageWidth: item.width, imageHeight: item.height, targetAspect });
  }, [item, savedCrop, targetAspect]);

  return (
    <div
      ref={setNodeRef}
      className={`tile ${editMode ? "tileEditMode" : ""} ${isEditSelected ? "tileSelected" : ""}`}
      style={{
        ...style,
        borderTopLeftRadius: rect.round?.tl ? 18 : 12,
        borderTopRightRadius: rect.round?.tr ? 18 : 12,
        borderBottomLeftRadius: rect.round?.bl ? 18 : 12,
        borderBottomRightRadius: rect.round?.br ? 18 : 12,
      }}
      {...(item && !editMode ? attributes : {})}
      {...(item && !editMode ? listeners : {})}
      aria-label="Tile"
    >
      <div className="tileInner">
        {item && crop && (
          <img
            src={item.previewUrl}
            alt={item.fileName}
            draggable={false}
            style={cropToImgStyle({
              tileW: pxRect.width,
              tileH: pxRect.height,
              imageW: item.width,
              imageH: item.height,
              crop,
            })}
          />
        )}
        <div className="tileOverlay">
          <div className="tileBadge">#{index + 1}</div>
          {item && editMode && (
            <div className="tileActions">
              <button
                className="tileActionBtn tileActionBtnIcon"
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onRequestReplace(rect.id);
                }}
                aria-label={`Replace ${item.fileName}`}
                title="Replace"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M4 20h4l10.5-10.5a2.121 2.121 0 0 0 0-3L16.5 4.5a2.121 2.121 0 0 0-3 0L3 15v5Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <path d="M13.5 6.5l4 4" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
              </button>

              <button
                className="tileActionBtn"
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  openCrop({ itemId: rect.id, cropKey, targetAspect });
                }}
              >
                Crop
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

