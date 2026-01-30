import type { CSSProperties } from "react";
import type { CropAreaNorm } from "./cropTypes";

/**
 * Convert a normalized crop area (in source image coords) into an <img> positioning style
 * that shows exactly that crop in a tile of size (tileW, tileH).
 *
 * We render <img> absolutely positioned inside an overflow-hidden tile.
 */
export function cropToImgStyle(args: {
  tileW: number;
  tileH: number;
  imageW: number;
  imageH: number;
  crop: CropAreaNorm;
}): CSSProperties {
  const { tileW, tileH, imageW, imageH, crop } = args;
  const iw = Math.max(1, imageW);
  const ih = Math.max(1, imageH);
  const cw = Math.max(1e-6, crop.width) * iw;
  const ch = Math.max(1e-6, crop.height) * ih;

  // tileScale should be equal on both axes when crop aspect == tile aspect
  const scaleX = tileW / cw;
  const scaleY = tileH / ch;
  const scale = Math.max(scaleX, scaleY);

  const w = iw * scale;
  const h = ih * scale;
  const left = -(crop.x * iw) * scale;
  const top = -(crop.y * ih) * scale;

  return {
    position: "absolute",
    width: `${w}px`,
    height: `${h}px`,
    left: `${left}px`,
    top: `${top}px`,
    willChange: "transform",
    userSelect: "none",
    pointerEvents: "none",
  };
}

