import type { LayoutRect } from "../../domain/layout/LayoutEngine";

export type PxRect = { left: number; top: number; width: number; height: number };

function approxEq(a: number, b: number, eps = 1e-6) {
  return Math.abs(a - b) <= eps;
}

export function buildCustomGridRects(args: { ids: string[]; columns: number; tileAspect: number }): {
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

export function applyGap(args: {
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

