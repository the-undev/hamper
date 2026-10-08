import { useState } from "react";
import { cn } from "@/lib/utils";
import { type PictureSize, pictureSizes, Thumb } from "./Thumb";

/** A meal's or item's picture: the server's image when it has one that loads, the placeholder otherwise, offline included. */
export function Picture({
  name,
  imageId,
  size,
}: {
  name: string;
  imageId: string | null;
  size: PictureSize;
}) {
  const [failedImageId, setFailedImageId] = useState<string | null>(null);
  if (imageId === null || failedImageId === imageId) {
    return <Thumb name={name} size={size} />;
  }
  const served = size === "hero" ? "large" : "thumb";
  return (
    <img
      src={`/images/${imageId}/${served}`}
      alt=""
      loading="lazy"
      onError={() => setFailedImageId(imageId)}
      className={cn("flex-none bg-soft object-cover", pictureSizes[size])}
    />
  );
}
