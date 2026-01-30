export type LayoutRect = {
  /** item id */
  id: string;
  /** left in [0..1] */
  x: number;
  /** top in [0..1] */
  y: number;
  /** width in [0..1] */
  w: number;
  /** height in [0..1] */
  h: number;
  /** convenience */
  aspect: number;
  /** corner rounding flags (layout dependent) */
  round?: {
    tl?: boolean;
    tr?: boolean;
    bl?: boolean;
    br?: boolean;
  };
};

export type LayoutInputItem = {
  id: string;
  /** natural media aspect ratio (width/height) */
  aspect: number;
};

export type LayoutEngine = (args: {
  items: LayoutInputItem[];
  containerAspect: number;
}) => {
  rects: LayoutRect[];
  /** height of the layout in normalized units (relative to container width) */
  normalizedHeight: number;
};

