import { useMemo, useState } from "react";
import Cropper from "react-easy-crop";
import type { Area, Point } from "react-easy-crop";
import { defaultCoverCrop } from "../domain/crop/defaultCrop";
import { ASPECT_PRECISION } from "../domain/layout/constants";
import { useAppStore } from "../store/useAppStore";

export function CropModal() {
  const cropModal = useAppStore((s) => s.cropModal);
  const grid = useAppStore((s) => {
    if (!s.cropModal.open || !s.cropModal.gridId) return null;
    return s.grids.find((g) => g.id === s.cropModal.gridId) ?? null;
  });
  const closeCrop = useAppStore((s) => s.closeCrop);
  const setCrop = useAppStore((s) => s.setCrop);

  const item = useMemo(() => {
    if (!cropModal.open || !cropModal.itemId) return null;
    return grid?.items.find((i) => i.id === cropModal.itemId) ?? null;
  }, [cropModal.itemId, cropModal.open, grid]);

  const [crop, setCropPoint] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation] = useState(0);
  const [lastAreaPixels, setLastAreaPixels] = useState<Area | null>(null);

  const initialCroppedAreaPixels = useMemo<Area | undefined>(() => {
    if (!item || !cropModal.cropKey || !cropModal.targetAspect) return undefined;
    const saved = grid?.crops[item.id]?.[cropModal.cropKey];
    const base =
      saved ??
      defaultCoverCrop({
        imageWidth: item.width,
        imageHeight: item.height,
        targetAspect: cropModal.targetAspect,
      });
    return {
      x: base.x * item.width,
      y: base.y * item.height,
      width: base.width * item.width,
      height: base.height * item.height,
    };
  }, [cropModal.cropKey, cropModal.targetAspect, grid, item]);

  if (!cropModal.open || !item || !cropModal.cropKey || !cropModal.targetAspect) return null;
  const cropKey = cropModal.cropKey;
  const targetAspect = cropModal.targetAspect;

  return (
    <div
      className="modalBackdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Crop image"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeCrop();
      }}
    >
      <div className="modal">
        <div className="modalHeader">
          <div className="modalTitle">
            Crop • {item.fileName} • aspect {targetAspect.toFixed(ASPECT_PRECISION)}
          </div>
          <button className="btn" type="button" onClick={closeCrop}>
            Close
          </button>
        </div>

        <div className="modalBody">
          <Cropper
            image={item.previewUrl}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={targetAspect}
            minZoom={1}
            maxZoom={5}
            cropShape="rect"
            objectFit="cover"
            showGrid
            initialCroppedAreaPixels={initialCroppedAreaPixels}
            onCropChange={setCropPoint}
            onZoomChange={setZoom}
            onCropComplete={(_area, areaPixels) => {
              setLastAreaPixels(areaPixels);
            }}
            style={{
              containerStyle: { background: "rgba(0,0,0,0.65)" },
              mediaStyle: { userSelect: "none" },
              cropAreaStyle: { border: "1px solid rgba(255,255,255,0.35)" },
            }}
          />
        </div>

        <div className="modalFooter">
          <div className="sliderRow">
            <span>Zoom</span>
            <input
              className="range"
              type="range"
              min={1}
              max={5}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="btn"
              type="button"
              onClick={() => {
                // reset to default cover crop
                const base = defaultCoverCrop({
                  imageWidth: item.width,
                  imageHeight: item.height,
                  targetAspect,
                });
                setCrop({
                  itemId: item.id,
                  cropKey,
                  crop: base,
                });
                closeCrop();
              }}
            >
              Reset
            </button>

            <button
              className="btn"
              type="button"
              onClick={() => {
                const area = lastAreaPixels ?? initialCroppedAreaPixels;
                if (!area) return;
                setCrop({
                  itemId: item.id,
                  cropKey,
                  crop: {
                    x: area.x / item.width,
                    y: area.y / item.height,
                    width: area.width / item.width,
                    height: area.height / item.height,
                  },
                });
                closeCrop();
              }}
            >
              Save crop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

