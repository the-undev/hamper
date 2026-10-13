import { useMutation } from "@tanstack/react-query";
import { RotateCw } from "lucide-react";
import { type ChangeEvent, useRef, useState } from "react";
import ReactCrop, { type PercentCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import {
  deleteImage,
  type PictureTable,
  RestError,
  uploadImage,
} from "@/api/rest";
import { hint } from "@/components/styles";
import { showToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDb, useSyncLoop } from "@/store/provider";
import { write } from "@/store/write";
import { useSyncStatus } from "@/sync/loop";
import {
  type Crop,
  cropFromPercent,
  largestCentredSquare,
  rotateQuarter,
} from "./crop";

/** The edge of the JPEG sent to the server, in pixels. */
const uploadEdge = 1200;

/** The JPEG quality of the upload; the server encodes again at its own. */
const uploadQuality = 0.9;

/** The smallest the frame goes, in screen pixels. */
const minFrameEdge = 48;

/** The picture being cropped: its pixels, turned upright from its EXIF data, and a URL the dialog shows it from. */
interface CropSource {
  bitmap: ImageBitmap;
  url: string;
}

/** Closes the picture's bitmap and revokes its URL. */
function releaseSource(source: CropSource): void {
  source.bitmap.close();
  URL.revokeObjectURL(source.url);
}

/** Renders a canvas as a JPEG at the given quality. */
function canvasJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("The crop made no JPEG")),
      "image/jpeg",
      quality,
    ),
  );
}

/** Redraws the picture a quarter turn clockwise, as a new bitmap and a URL to show it from. */
async function rotateClockwise(source: CropSource): Promise<CropSource> {
  const turned = rotateQuarter(source.bitmap);
  const canvas = document.createElement("canvas");
  canvas.width = turned.width;
  canvas.height = turned.height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("This phone cannot turn the photo");
  }
  context.translate(turned.width, 0);
  context.rotate(Math.PI / 2);
  context.drawImage(source.bitmap, 0, 0);
  const shown = await canvasJpeg(canvas, uploadQuality);
  return {
    bitmap: await createImageBitmap(canvas),
    url: URL.createObjectURL(shown),
  };
}

/** Draws the frame's region of the picture at the upload size as a JPEG. */
function exportJpeg(source: ImageBitmap, crop: Crop): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = uploadEdge;
  canvas.height = uploadEdge;
  const context = canvas.getContext("2d");
  if (!context) {
    return Promise.reject(new Error("This phone cannot draw the photo"));
  }
  context.drawImage(
    source,
    crop.x,
    crop.y,
    crop.size,
    crop.size,
    0,
    0,
    uploadEdge,
    uploadEdge,
  );
  return canvasJpeg(canvas, uploadQuality);
}

/** Take photo and Choose photo, which crop a picture square and upload it, and Remove photo; all need the server. */
export function CropUpload({
  table,
  rowId,
  hasImage,
}: {
  table: PictureTable;
  rowId: string;
  hasImage: boolean;
}) {
  const db = useDb();
  const loop = useSyncLoop();
  const { online } = useSyncStatus(loop);
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<CropSource | null>(null);

  const showRestError = (error: Error): void =>
    showToast(error instanceof RestError ? error.title : error.message);

  // The server already holds the id, so the row is not pushed for it; a pending change to the row carries it.
  const storeImageId = (imageId: string | null): Promise<void> =>
    write(db, (w) => w.patchFromServer(table, rowId, { imageId }));

  const upload = useMutation({
    mutationFn: async (jpeg: Blob) => {
      // The server can only take a picture for a row it has; the push sends one made offline.
      await loop.syncNow();
      await storeImageId(await uploadImage(table, rowId, jpeg));
    },
    onSuccess: async () => {
      closeCrop();
      await loop.syncNow();
    },
    onError: showRestError,
  });
  const remove = useMutation({
    mutationFn: async () => {
      await deleteImage(table, rowId);
      await storeImageId(null);
    },
    onSuccess: () => loop.syncNow(),
    onError: showRestError,
  });

  const closeCrop = (): void => {
    if (source) {
      releaseSource(source);
    }
    setSource(null);
  };

  const rotateSource = async (turning: CropSource): Promise<void> => {
    try {
      const turned = await rotateClockwise(turning);
      releaseSource(turning);
      setSource(turned);
    } catch {
      showToast("This phone cannot turn that picture");
    }
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
      // Turned upright as the dialog's <img> shows it, so the export draws what the frame was over.
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
      setSource({ bitmap, url: URL.createObjectURL(file) });
    } catch {
      showToast("This phone cannot open that picture");
    }
  };

  const busy = upload.isPending || remove.isPending;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="flex-1"
          disabled={!online || busy}
          onClick={() => cameraInput.current?.click()}
        >
          Take photo
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="flex-1"
          disabled={!online || busy}
          onClick={() => fileInput.current?.click()}
        >
          Choose photo
        </Button>
        {hasImage && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="flex-1"
            disabled={!online || busy}
            onClick={() => remove.mutate()}
          >
            Remove photo
          </Button>
        )}
      </div>
      {!online && (
        <p className={hint}>
          Changing the photo needs a connection to the server.
        </p>
      )}
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        aria-label="Camera"
        className="hidden"
        onChange={(event) => void onFileChosen(event)}
      />
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
          onRotate={() => rotateSource(source)}
          onUse={(crop) =>
            void exportJpeg(source.bitmap, crop).then(
              (jpeg) => upload.mutate(jpeg),
              showRestError,
            )
          }
        />
      )}
    </div>
  );
}

/** The whole picture with a square frame over it: drag the frame to move it, its corners to resize it, Rotate to turn the picture, then Use photo. */
function CropDialog({
  source,
  uploading,
  onCancel,
  onRotate,
  onUse,
}: {
  source: CropSource;
  uploading: boolean;
  onCancel: () => void;
  onRotate: () => Promise<void>;
  onUse: (crop: Crop) => void;
}) {
  // A new picture, after Rotate, starts again from the largest centred square.
  const [framed, setFramed] = useState<{
    source: CropSource;
    frame: PercentCrop;
  }>(() => ({ source, frame: largestCentredSquare(source.bitmap) }));
  const frame =
    framed.source === source
      ? framed.frame
      : largestCentredSquare(source.bitmap);
  const [rotating, setRotating] = useState(false);

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent showCloseButton={false} className="bg-surface">
        <DialogTitle className="text-lg font-bold">Crop the photo</DialogTitle>
        <DialogDescription className="text-sm text-muted">
          Move or resize the frame, then Use photo.
        </DialogDescription>
        <div className="flex justify-center">
          <ReactCrop
            crop={frame}
            aspect={1}
            minWidth={minFrameEdge}
            minHeight={minFrameEdge}
            keepSelection
            className="max-h-[60dvh]"
            onChange={(_, percentFrame) =>
              setFramed({ source, frame: percentFrame })
            }
          >
            <img src={source.url} alt="Being cropped" />
          </ReactCrop>
        </div>
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={rotating || uploading}
          onClick={() => {
            setRotating(true);
            void onRotate().finally(() => setRotating(false));
          }}
        >
          <RotateCw aria-hidden="true" />
          Rotate
        </Button>
        <div className="flex gap-2">
          <DialogClose className="min-h-11 flex-1 rounded-[10px] border border-line font-semibold">
            Cancel
          </DialogClose>
          <button
            type="button"
            disabled={uploading}
            onClick={() => onUse(cropFromPercent(frame, source.bitmap))}
            className="min-h-11 flex-1 rounded-[10px] bg-accent font-semibold text-accent-foreground disabled:opacity-40"
          >
            {uploading ? "Uploading…" : "Use photo"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
