import type { LayoutEngine, LayoutRect } from "../LayoutEngine";

/**
 * Instagram profile grid preview: 3 columns, tiles are 3:4 (w:h).
 * We model a viewport of width=1, height depends on rows.
 */
export const instagramProfileGrid: LayoutEngine = ({ items }) => {
  const cols = 3;
  const tileW = 1 / cols;
  const tileH = tileW * (4 / 3);
  const rows = Math.ceil(items.length / cols) || 1;
  const totalH = rows * tileH;

  const rects: LayoutRect[] = items.map((it, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    return {
      id: it.id,
      x: col * tileW,
      y: row * tileH,
      w: tileW,
      h: tileH,
      aspect: tileW / tileH,
      round: {
        tl: row === 0 && col === 0,
        tr: row === 0 && col === cols - 1,
        bl: row === rows - 1 && col === 0,
        br: row === rows - 1 && col === cols - 1,
      },
    };
  });

  return { rects, normalizedHeight: totalH };
};

