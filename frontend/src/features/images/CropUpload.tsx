import { useMutation } from "@tanstack/react-query";
import {
  type ChangeEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  deleteImage,
  type PictureTable,
  RestError,
  uploadImage,
} from "@/api/rest";
import { hint, secondaryButton } from "@/components/styles";
import { useToast } from "@/components/Toast";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSyncLoop } from "@/store/provider";
import { useSyncStatus } from "@/sync/loop";
import {
  type Crop,
  clampCrop,
  cropPlacement,
  initialCrop,
  maxZoom,
} from "./crop";

/** The edge of the JPEG sent to the server, in pixels. */
const uploadEdge = 1200;

/** The JPEG quality of the upload; the server encodes again at its own. */
const uploadQuality = 0.9;

/** The crop box canvas's own resolution, sharp on a high-density phone screen. */
const previewEdge = 640;

/** Draws the cropped picture onto a square canvas, filling it. */
function drawCrop(
  canvas: HTMLCanvasElement,
  source: ImageBitmap,
  crop: Crop,
): void {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  const placement = cropPlacement(crop, source, canvas.width);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    source,
    placement.x,
    placement.y,
    placement.width,
    placement.height,
  );
}

/** Renders the crop at the upload size as a JPEG. */
function exportJpeg(source: ImageBitmap, crop: Crop): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = uploadEdge;
  canvas.height = uploadEdge;
  drawCrop(canvas, source, crop);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("The crop made no JPEG")),
      "image/jpeg",
      uploadQuality,
    ),
  );
}

/** Change photo, which takes or chooses a picture and crops it square, and Remove photo; both need the server. */
export function CropUpload({
  table,
  rowId,
  hasImage,
}: {
  table: PictureTable;
  rowId: string;
  hasImage: boolean;
}) {
  const loop = useSyncLoop();
  const { online } = useSyncStatus(loop);
  const showToast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<ImageBitmap | null>(null);

  const showRestError = (error: Error): void =>
    showToast(error instanceof RestError ? error.title : error.message);

  const upload = useMutation({
    mutationFn: async (jpeg: Blob) => {
      // The server can only take a picture for a row it has; the push sends one made offline.
      await loop.syncNow();
      return uploadImage(table, rowId, jpeg);
    },
    onSuccess: async () => {
      closeCrop();
      await loop.syncNow();
    },
    onError: showRestError,
  });
  const remove = useMutation({
    mutationFn: () => deleteImage(table, rowId),
    onSuccess: () => loop.syncNow(),
    onError: showRestError,
  });

  const closeCrop = (): void => {
    source?.close();
    setSource(null);
  };

  const onFileChosen = async (
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    try {
      setSource(await createImageBitmap(file));
    } catch {
      showToast("This phone cannot open that picture");
    }
  };

  const busy = upload.isPending || remove.isPending;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          className={secondaryButton}
          disabled={!online || busy}
          onClick={() => fileInput.current?.click()}
        >
          Change photo
        </button>
        {hasImage && (
          <button
            type="button"
            className={secondaryButton}
            disabled={!online || busy}
            onClick={() => remove.mutate()}
          >
            Remove photo
          </button>
        )}
      </div>
      {!online && (
        <p className={hint}>
          Changing the photo needs a connection to the server.
        </p>
      )}
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        aria-label="Photo file"
        className="hidden"
        onChange={(event) => void onFileChosen(event)}
      />
      {source && (
        <CropDialog
          source={source}
          uploading={upload.isPending}
          onCancel={closeCrop}
          onUse={(crop) =>
            void exportJpeg(source, crop).then(
              (jpeg) => upload.mutate(jpeg),
              showRestError,
            )
          }
        />
      )}
    </div>
  );
}

/** The square crop box: drag to pan, the slider to zoom, then Use photo. */
function CropDialog({
  source,
  uploading,
  onCancel,
  onUse,
}: {
  source: ImageBitmap;
  uploading: boolean;
  onCancel: () => void;
  onUse: (crop: Crop) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const dragFrom = useRef<{ x: number; y: number } | null>(null);
  const [crop, setCrop] = useState<Crop>(initialCrop);

  useEffect(() => {
    if (canvas.current) {
      drawCrop(canvas.current, source, crop);
    }
  }, [source, crop]);

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>): void => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragFrom.current = { x: event.clientX, y: event.clientY };
  };
  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>): void => {
    const from = dragFrom.current;
    const boxEdge = event.currentTarget.getBoundingClientRect().width;
    if (!from || boxEdge === 0) {
      return;
    }
    dragFrom.current = { x: event.clientX, y: event.clientY };
    setCrop((current) =>
      clampCrop(
        {
          ...current,
          offsetX: current.offsetX + (event.clientX - from.x) / boxEdge,
          offsetY: current.offsetY + (event.clientY - from.y) / boxEdge,
        },
        source,
      ),
    );
  };
  const endDrag = (): void => {
    dragFrom.current = null;
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent showCloseButton={false} className="bg-surface">
        <DialogTitle className="text-lg font-bold">Crop the photo</DialogTitle>
        <DialogDescription className="text-sm text-muted">
          Drag to move it, and use the slider to zoom.
        </DialogDescription>
        <canvas
          ref={canvas}
          width={previewEdge}
          height={previewEdge}
          aria-label="Crop box"
          className="aspect-square w-full touch-none rounded-[14px] bg-soft"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        />
        <input
          type="range"
          aria-label="Zoom"
          min={1}
          max={maxZoom}
          step={0.01}
          value={crop.zoom}
          onChange={(event) =>
            setCrop((current) =>
              clampCrop(
                { ...current, zoom: Number(event.target.value) },
                source,
              ),
            )
          }
        />
        <div className="flex gap-2">
          <DialogClose className="min-h-11 flex-1 rounded-[10px] border border-line font-semibold">
            Cancel
          </DialogClose>
          <button
            type="button"
            disabled={uploading}
            onClick={() => onUse(crop)}
            className="min-h-11 flex-1 rounded-[10px] bg-accent font-semibold text-accent-foreground disabled:opacity-40"
          >
            {uploading ? "Uploading…" : "Use photo"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
