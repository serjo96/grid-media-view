import type { CropAreaNorm } from "./cropTypes";

/**
 * Center crop (like CSS object-fit: cover), expressed as normalized image coords.
 */
export function defaultCoverCrop(args: {
  imageWidth: number;
  imageHeight: number;
  targetAspect: number; // w/h
}): CropAreaNorm {
  const { imageWidth: iw, imageHeight: ih, targetAspect } = args;
  const imageAspect = iw / ih;
  if (!Number.isFinite(targetAspect) || targetAspect <= 0 || !Number.isFinite(imageAspect) || imageAspect <= 0) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }

  let cropW = iw;
  let cropH = ih;
  if (imageAspect > targetAspect) {
    // too wide -> crop left/right
    cropW = ih * targetAspect;
  } else {
    // too tall -> crop top/bottom
    cropH = iw / targetAspect;
  }

  const x = (iw - cropW) / 2;
  const y = (ih - cropH) / 2;
  return {
    x: x / iw,
    y: y / ih,
    width: cropW / iw,
    height: cropH / ih,
  };
}

