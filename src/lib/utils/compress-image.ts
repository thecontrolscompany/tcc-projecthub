/**
 * Downscales/recompresses an image client-side so it fits under Vercel's
 * serverless function request body limit (~4.5 MB, hard platform cap that
 * cannot be raised via app config). Mobile camera photos routinely exceed
 * this before any app-level size check ever runs.
 */
export async function compressImageForUpload(
  file: File,
  { maxBytes = 4 * 1024 * 1024, maxDimension = 2400 }: { maxBytes?: number; maxDimension?: number } = {}
): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  if (file.size <= maxBytes) return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  let quality = 0.85;
  let blob: Blob | null = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob || blob.size <= maxBytes) break;
    quality -= 0.15;
  }

  if (!blob) return file;

  const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], newName, { type: "image/jpeg", lastModified: file.lastModified });
}
