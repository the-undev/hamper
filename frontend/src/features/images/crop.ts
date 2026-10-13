import { centerCrop, makeAspectCrop, type PercentCrop } from "react-image-crop";

/** The square frame over the picture, in the picture's own pixels: its top-left corner and its edge. */
export interface Crop {
  x: number;
  y: number;
  size: number;
}

/** The size of the picture being cropped, in pixels. */
export interface SourceSize {
  width: number;
  height: number;
}

/** The largest square that fits the picture, centred on it, as the crop library's percent frame. */
export function largestCentredSquare(source: SourceSize): PercentCrop {
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 100 }, 1, source.width, source.height),
    source.width,
    source.height,
  );
}

/** Converts the crop library's percent frame to a square in the picture's pixels, kept inside the picture. */
export function cropFromPercent(frame: PercentCrop, source: SourceSize): Crop {
  const size = Math.min(
    (frame.width / 100) * source.width,
    (frame.height / 100) * source.height,
    source.width,
    source.height,
  );
  const clamp = (start: number, edge: number) =>
    Math.min(Math.max(0, start), edge - size);
  return {
    x: clamp((frame.x / 100) * source.width, source.width),
    y: clamp((frame.y / 100) * source.height, source.height),
    size,
  };
}

/** The picture's size once turned a quarter turn: its width and height swapped. */
export function rotateQuarter(source: SourceSize): SourceSize {
  return { width: source.height, height: source.width };
}
