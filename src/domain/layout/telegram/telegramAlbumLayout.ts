import type { LayoutEngine, LayoutRect } from "../LayoutEngine";

type Attempt = { lineCounts: number[]; heights: number[] };

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function multiHeight(maxSizeWidth: number, ratios: number[], start: number, end: number) {
  let sum = 0;
  for (let i = start; i < end; i++) sum += ratios[i];
  return maxSizeWidth / sum;
}

function roundFlagsForGrid(args: {
  row: number;
  col: number;
  rows: number;
  colsInRow: number;
}): LayoutRect["round"] {
  const { row, col, rows, colsInRow } = args;
  return {
    tl: row === 0 && col === 0,
    tr: row === 0 && col === colsInRow - 1,
    bl: row === rows - 1 && col === 0,
    br: row === rows - 1 && col === colsInRow - 1,
  };
}

/**
 * Port of Telegram Android grouped messages layout core logic.
 * Goal: match album tile proportions for 2..10 items with "slight crop" behavior.
 *
 * Source reference: MessageObject.GroupedMessages.calculate() (Telegram Android).
 */
export const telegramAlbumLayout: LayoutEngine = ({ items }) => {
  const count = items.length;
  const maxSizeWidth = 800;
  const maxSizeHeight = 814;

  if (count <= 0) {
    return { rects: [], normalizedHeight: 1 };
  }

  // 1) gather ratios + metadata
  const ratios = items.map((i) => (Number.isFinite(i.aspect) && i.aspect > 0 ? i.aspect : 1));
  const proportions = ratios
    .map((r) => (r > 1.2 ? "w" : r < 0.8 ? "n" : "q"))
    .join("");
  const avg = ratios.reduce((a, b) => a + b, 0) / Math.max(1, count);
  const forceCalc = ratios.some((r) => r > 2.0);

  const maxAspectRatio = maxSizeWidth / maxSizeHeight;
  const minHeightPx = 120;
  const minWidthPx = 120;
  const paddingsWidth = 40;
  const minH = 100 / maxSizeHeight; // normalized to maxSizeHeight (matches Telegram's dp(100)/maxSizeHeight)

  // Helpers to convert px->normalized units (width=1)
  const nx = (px: number) => px / maxSizeWidth;
  const ny = (px: number) => px / maxSizeWidth;

  // 2) specialized layouts for 2..4 when not forceCalc
  if (!forceCalc && (count === 2 || count === 3 || count === 4)) {
    if (count === 2) {
      const ar1 = ratios[0];
      const ar2 = ratios[1];
      const p = proportions;

      // stacked (two wide)
      if (p === "ww" && avg > 1.4 * maxAspectRatio && Math.abs(ar1 - ar2) < 0.2) {
        const heightPx = Math.round(
          Math.min(maxSizeWidth / ar1, Math.min(maxSizeWidth / ar2, maxSizeHeight / 2)),
        );
        const hNorm = heightPx / maxSizeHeight;
        const hPx = Math.max(minH, hNorm) * maxSizeHeight;
        const totalH = hPx * 2;
        return {
          normalizedHeight: ny(totalH),
          rects: [
            {
              id: items[0].id,
              x: 0,
              y: 0,
              w: 1,
              h: ny(hPx),
              aspect: 1 / ny(hPx),
              round: { tl: true, tr: true },
            },
            {
              id: items[1].id,
              x: 0,
              y: ny(hPx),
              w: 1,
              h: ny(hPx),
              aspect: 1 / ny(hPx),
              round: { bl: true, br: true },
            },
          ],
        };
      }

      // side-by-side equal
      if (p === "ww" || p === "qq") {
        const w1 = Math.floor(maxSizeWidth / 2);
        const hPx = Math.round(Math.min(w1 / ar1, Math.min(w1 / ar2, maxSizeHeight)));
        const totalH = Math.max(1, hPx);
        return {
          normalizedHeight: ny(totalH),
          rects: [
            {
              id: items[0].id,
              x: 0,
              y: 0,
              w: nx(w1),
              h: ny(totalH),
              aspect: w1 / totalH,
              round: { tl: true, bl: true },
            },
            {
              id: items[1].id,
              x: nx(w1),
              y: 0,
              w: nx(maxSizeWidth - w1),
              h: ny(totalH),
              aspect: (maxSizeWidth - w1) / totalH,
              round: { tr: true, br: true },
            },
          ],
        };
      }

      // split by aspect
      let secondWidth = Math.max(
        0.4 * maxSizeWidth,
        Math.round((maxSizeWidth / ar1) / (1 / ar1 + 1 / ar2)),
      );
      let firstWidth = maxSizeWidth - secondWidth;
      if (firstWidth < minWidthPx) {
        const diff = minWidthPx - firstWidth;
        firstWidth = minWidthPx;
        secondWidth -= diff;
      }
      const hPx = Math.min(
        maxSizeHeight,
        Math.round(Math.min(firstWidth / ar1, secondWidth / ar2)),
      );
      const totalH = Math.max(1, hPx);
      return {
        normalizedHeight: ny(totalH),
        rects: [
          {
            id: items[0].id,
            x: 0,
            y: 0,
            w: nx(firstWidth),
            h: ny(totalH),
            aspect: firstWidth / totalH,
            round: { tl: true, bl: true },
          },
          {
            id: items[1].id,
            x: nx(firstWidth),
            y: 0,
            w: nx(maxSizeWidth - firstWidth),
            h: ny(totalH),
            aspect: (maxSizeWidth - firstWidth) / totalH,
            round: { tr: true, br: true },
          },
        ],
      };
    }

    if (count === 3) {
      const ar1 = ratios[0];
      const ar2 = ratios[1];
      const ar3 = ratios[2];

      if (proportions.charAt(0) === "n") {
        const thirdHeightPx = Math.min(
          maxSizeHeight * 0.5,
          Math.round((ar2 * maxSizeWidth) / (ar3 + ar2)),
        );
        const secondHeightPx = maxSizeHeight - thirdHeightPx;

        const rightWidth = Math.max(
          minWidthPx,
          Math.min(
            maxSizeWidth * 0.5,
            Math.round(Math.min(thirdHeightPx * ar3, secondHeightPx * ar2)),
          ),
        );

        const leftWidth = Math.round(
          Math.min(maxSizeHeight * ar1 + paddingsWidth, maxSizeWidth - rightWidth),
        );

        const totalH = maxSizeHeight;
        return {
          normalizedHeight: ny(totalH),
          rects: [
            {
              id: items[0].id,
              x: 0,
              y: 0,
              w: nx(leftWidth),
              h: ny(totalH),
              aspect: leftWidth / totalH,
              round: { tl: true, bl: true },
            },
            {
              id: items[1].id,
              x: nx(leftWidth),
              y: 0,
              w: nx(maxSizeWidth - leftWidth),
              h: ny(secondHeightPx),
              aspect: (maxSizeWidth - leftWidth) / secondHeightPx,
              round: { tr: true },
            },
            {
              id: items[2].id,
              x: nx(leftWidth),
              y: ny(secondHeightPx),
              w: nx(maxSizeWidth - leftWidth),
              h: ny(thirdHeightPx),
              aspect: (maxSizeWidth - leftWidth) / thirdHeightPx,
              round: { br: true },
            },
          ],
        };
      }

      const firstHeightPx = Math.round(
        Math.min(maxSizeWidth / ar1, maxSizeHeight * 0.66),
      );

      const w = Math.floor(maxSizeWidth / 2);
      let secondHeightPx = Math.min(
        maxSizeHeight - firstHeightPx,
        Math.round(Math.min(w / ar2, w / ar3)),
      );

      if (secondHeightPx / maxSizeHeight < minH) {
        secondHeightPx = Math.round(minH * maxSizeHeight);
      }

      const totalH = firstHeightPx + secondHeightPx;
      return {
        normalizedHeight: ny(totalH),
        rects: [
          {
            id: items[0].id,
            x: 0,
            y: 0,
            w: 1,
            h: ny(firstHeightPx),
            aspect: maxSizeWidth / firstHeightPx,
            round: { tl: true, tr: true },
          },
          {
            id: items[1].id,
            x: 0,
            y: ny(firstHeightPx),
            w: nx(w),
            h: ny(secondHeightPx),
            aspect: w / secondHeightPx,
            round: { bl: true },
          },
          {
            id: items[2].id,
            x: nx(w),
            y: ny(firstHeightPx),
            w: nx(maxSizeWidth - w),
            h: ny(secondHeightPx),
            aspect: (maxSizeWidth - w) / secondHeightPx,
            round: { br: true },
          },
        ],
      };
    }

    // count === 4
    {
      const ar1 = ratios[0];
      const ar2 = ratios[1];
      const ar3 = ratios[2];
      const ar4 = ratios[3];

      if (proportions.charAt(0) === "w") {
        const topHeightPx = Math.round(
          Math.min(maxSizeWidth / ar1, maxSizeHeight * 0.66),
        );

        let h = Math.round(maxSizeWidth / (ar2 + ar3 + ar4));
        let w0 = Math.max(minWidthPx, Math.min(maxSizeWidth * 0.4, h * ar2));
        let w2 = Math.max(Math.max(minWidthPx, maxSizeWidth * 0.33), h * ar4);
        let w1 = maxSizeWidth - w0 - w2;
        if (w1 < 58) {
          const diff = 58 - w1;
          w1 = 58;
          w0 -= diff / 2;
          w2 -= diff - diff / 2;
        }

        h = Math.min(maxSizeHeight - topHeightPx, h);
        if (h / maxSizeHeight < minH) {
          h = Math.round(minH * maxSizeHeight);
        }

        const totalH = topHeightPx + h;
        return {
          normalizedHeight: ny(totalH),
          rects: [
            {
              id: items[0].id,
              x: 0,
              y: 0,
              w: 1,
              h: ny(topHeightPx),
              aspect: maxSizeWidth / topHeightPx,
              round: { tl: true, tr: true },
            },
            {
              id: items[1].id,
              x: 0,
              y: ny(topHeightPx),
              w: nx(w0),
              h: ny(h),
              aspect: w0 / h,
              round: { bl: true },
            },
            {
              id: items[2].id,
              x: nx(w0),
              y: ny(topHeightPx),
              w: nx(w1),
              h: ny(h),
              aspect: w1 / h,
            },
            {
              id: items[3].id,
              x: nx(w0 + w1),
              y: ny(topHeightPx),
              w: nx(maxSizeWidth - (w0 + w1)),
              h: ny(h),
              aspect: (maxSizeWidth - (w0 + w1)) / h,
              round: { br: true },
            },
          ],
        };
      }

      const w = Math.max(
        minWidthPx,
        Math.round(maxSizeHeight / (1 / ar2 + 1 / ar3 + 1 / ar4)),
      );
      const h0 = Math.min(0.33, Math.max(minHeightPx, w / ar2) / maxSizeHeight);
      const h1 = Math.min(0.33, Math.max(minHeightPx, w / ar3) / maxSizeHeight);
      const h2 = 1.0 - h0 - h1;
      const leftWidth = Math.round(
        Math.min(maxSizeHeight * ar1 + paddingsWidth, maxSizeWidth - w),
      );

      const totalH = maxSizeHeight;
      return {
        normalizedHeight: ny(totalH),
        rects: [
          {
            id: items[0].id,
            x: 0,
            y: 0,
            w: nx(leftWidth),
            h: ny(totalH),
            aspect: leftWidth / totalH,
            round: { tl: true, bl: true },
          },
          {
            id: items[1].id,
            x: nx(leftWidth),
            y: 0,
            w: nx(maxSizeWidth - leftWidth),
            h: ny(h0 * maxSizeHeight),
            aspect: (maxSizeWidth - leftWidth) / (h0 * maxSizeHeight),
            round: { tr: true },
          },
          {
            id: items[2].id,
            x: nx(leftWidth),
            y: ny(h0 * maxSizeHeight),
            w: nx(maxSizeWidth - leftWidth),
            h: ny(h1 * maxSizeHeight),
            aspect: (maxSizeWidth - leftWidth) / (h1 * maxSizeHeight),
          },
          {
            id: items[3].id,
            x: nx(leftWidth),
            y: ny((h0 + h1) * maxSizeHeight),
            w: nx(maxSizeWidth - leftWidth),
            h: ny(h2 * maxSizeHeight),
            aspect: (maxSizeWidth - leftWidth) / (h2 * maxSizeHeight),
            round: { br: true },
          },
        ],
      };
    }
  }

  // 3) general case (5..10 or forced)
  const croppedRatios = ratios.map((r) => {
    let v = avg > 1.1 ? Math.max(1.0, r) : Math.min(1.0, r);
    v = clamp(v, 0.66667, 1.7);
    return v;
  });

  const attempts: Attempt[] = [];

  // 2 lines
  for (let first = 1; first < croppedRatios.length; first++) {
    const second = croppedRatios.length - first;
    if (first > 3 || second > 3) continue;
    attempts.push({
      lineCounts: [first, second],
      heights: [
        multiHeight(maxSizeWidth, croppedRatios, 0, first),
        multiHeight(maxSizeWidth, croppedRatios, first, croppedRatios.length),
      ],
    });
  }

  // 3 lines
  for (let first = 1; first < croppedRatios.length - 1; first++) {
    for (let second = 1; second < croppedRatios.length - first; second++) {
      const third = croppedRatios.length - first - second;
      if (first > 3 || second > (avg < 0.85 ? 4 : 3) || third > 3) continue;
      attempts.push({
        lineCounts: [first, second, third],
        heights: [
          multiHeight(maxSizeWidth, croppedRatios, 0, first),
          multiHeight(maxSizeWidth, croppedRatios, first, first + second),
          multiHeight(maxSizeWidth, croppedRatios, first + second, croppedRatios.length),
        ],
      });
    }
  }

  // 4 lines
  for (let first = 1; first < croppedRatios.length - 2; first++) {
    for (let second = 1; second < croppedRatios.length - first; second++) {
      for (let third = 1; third < croppedRatios.length - first - second; third++) {
        const fourth = croppedRatios.length - first - second - third;
        if (first > 3 || second > 3 || third > 3 || fourth > 3) continue;
        attempts.push({
          lineCounts: [first, second, third, fourth],
          heights: [
            multiHeight(maxSizeWidth, croppedRatios, 0, first),
            multiHeight(maxSizeWidth, croppedRatios, first, first + second),
            multiHeight(
              maxSizeWidth,
              croppedRatios,
              first + second,
              first + second + third,
            ),
            multiHeight(
              maxSizeWidth,
              croppedRatios,
              first + second + third,
              croppedRatios.length,
            ),
          ],
        });
      }
    }
  }

  let optimal: Attempt | null = null;
  let optimalDiff = 0;
  const maxHeightTarget = (maxSizeWidth / 3) * 4;
  for (const attempt of attempts) {
    let heightSum = 0;
    let minLineHeight = Number.POSITIVE_INFINITY;
    for (const h of attempt.heights) {
      heightSum += h;
      minLineHeight = Math.min(minLineHeight, h);
    }
    let diff = Math.abs(heightSum - maxHeightTarget);
    const lc = attempt.lineCounts;
    if (
      lc.length > 1 &&
      (lc[0] > lc[1] || (lc.length > 2 && lc[1] > lc[2]) || (lc.length > 3 && lc[2] > lc[3]))
    ) {
      diff *= 1.2;
    }
    if (minLineHeight < minWidthPx) diff *= 1.5;
    if (!optimal || diff < optimalDiff) {
      optimal = attempt;
      optimalDiff = diff;
    }
  }

  if (!optimal) {
    // Fallback: single-column stack
    const tileH = maxSizeWidth;
    return {
      normalizedHeight: ny(tileH * count),
      rects: items.map((it, idx) => ({
        id: it.id,
        x: 0,
        y: ny(idx * tileH),
        w: 1,
        h: ny(tileH),
        aspect: 1,
        round: roundFlagsForGrid({ row: idx, col: 0, rows: count, colsInRow: 1 }),
      })),
    };
  }

  const rects: LayoutRect[] = [];
  let index = 0;
  let yPx = 0;
  const rows = optimal.lineCounts.length;

  for (let row = 0; row < rows; row++) {
    const colsInRow = optimal.lineCounts[row];
    const lineHeightPx = optimal.heights[row];
    const hNorm = Math.max(minH, lineHeightPx / maxSizeHeight);
    const rowHeightPx = hNorm * maxSizeHeight;

    let xPx = 0;
    let spanLeft = maxSizeWidth;

    // First pass compute widths
    const widths: number[] = [];
    for (let col = 0; col < colsInRow; col++) {
      const ratio = croppedRatios[index + col];
      const wPx = Math.floor(ratio * lineHeightPx);
      widths.push(wPx);
      spanLeft -= wPx;
    }
    // Telegram adds remainder to an edge item. We'll add it to the last tile in row.
    if (widths.length > 0) widths[widths.length - 1] += spanLeft;

    for (let col = 0; col < colsInRow; col++) {
      const it = items[index];
      const wPx = widths[col];

      rects.push({
        id: it.id,
        x: nx(xPx),
        y: ny(yPx),
        w: nx(wPx),
        h: ny(rowHeightPx),
        aspect: wPx / rowHeightPx,
        round: roundFlagsForGrid({ row, col, rows, colsInRow }),
      });

      xPx += wPx;
      index++;
    }

    yPx += rowHeightPx;
  }

  return { rects, normalizedHeight: ny(yPx) };
};

