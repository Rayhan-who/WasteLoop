/**
 * Client-side photo preparation before upload: downscale to at most
 * `maxDim` pixels on the long edge and re-encode, so a 6 MB phone photo
 * becomes ~200–400 KB. Keeps uploads fast on mobile data (§4.1) and well
 * under the 5 MB bucket limit. Falls back to the original file if the
 * browser cannot decode it.
 */
export const ACCEPTED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

export type PreparedPhoto = { blob: Blob; ext: "webp" | "jpg" | "png"; contentType: string };

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function preparePhoto(file: File, maxDim = 1600, quality = 0.82): Promise<PreparedPhoto> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const webp = await canvasToBlob(canvas, "image/webp", quality);
    if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp", contentType: "image/webp" };
    const jpeg = await canvasToBlob(canvas, "image/jpeg", quality);
    if (jpeg) return { blob: jpeg, ext: "jpg", contentType: "image/jpeg" };
  } catch {
    // fall through to the original file
  }
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  return { blob: file, ext, contentType: file.type || "image/jpeg" };
}
