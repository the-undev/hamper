/** Where the picture sits in the square crop box: a zoom of at least 1, and a pan as fractions of the box's edge from centred. */
export interface Crop {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

/** The size of the picture being cropped, in pixels. */
export interface SourceSize {
  width: number;
  height: number;
}

/** The most the slider zooms in. */
export const maxZoom = 3;

/** Centred, at the zoom where the picture just covers the box. */
export const initialCrop: Crop = { zoom: 1, offsetX: 0, offsetY: 0 };

/** The picture's drawn width and height as fractions of the box's edge. */
function coverSize(source: SourceSize, zoom: number): SourceSize {
  return {
    width: zoom * Math.max(1, source.width / source.height),
    height: zoom * Math.max(1, source.height / source.width),
  };
}

function clampOffset(offset: number, drawn: number): number {
  const limit = (drawn - 1) / 2;
  return Math.min(limit, Math.max(-limit, offset));
}

/** Keeps the zoom in range and the pan where the picture still covers the whole box. */
export function clampCrop(crop: Crop, source: SourceSize): Crop {
  const zoom = Math.min(maxZoom, Math.max(1, crop.zoom));
  const drawn = coverSize(source, zoom);
  return {
    zoom,
    offsetX: clampOffset(crop.offsetX, drawn.width),
    offsetY: clampOffset(crop.offsetY, drawn.height),
  };
}

/** Where to draw the picture on a square canvas of the given edge: its top-left corner and its size, in pixels. */
export function cropPlacement(
  crop: Crop,
  source: SourceSize,
  edge: number,
): { x: number; y: number; width: number; height: number } {
  const drawn = coverSize(source, crop.zoom);
  const width = drawn.width * edge;
  const height = drawn.height * edge;
  return {
    x: (edge - width) / 2 + crop.offsetX * edge,
    y: (edge - height) / 2 + crop.offsetY * edge,
    width,
    height,
  };
}
