/**
 * Client-side raster image resize & compression using HTML5 Canvas.
 * Keeps uploads lightweight on Vercel without native image-binary dependencies.
 * Skips SVG, GIF, Audio, and PDF untouched.
 */

export interface CompressedUploadResult {
  file: File;
  width: number | null;
  height: number | null;
  originalSize: number;
  compressedSize: number;
  wasCompressed: boolean;
}

const COMPRESSIBLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function compressImageIfNeeded(
  file: File,
  options?: { maxWidth?: number; quality?: number }
): Promise<CompressedUploadResult> {
  const originalSize = file.size;
  if (!COMPRESSIBLE_TYPES.has(file.type) || typeof window === "undefined") {
    return {
      file,
      width: null,
      height: null,
      originalSize,
      compressedSize: originalSize,
      wasCompressed: false,
    };
  }

  const maxWidth = options?.maxWidth ?? 1920;
  const quality = options?.quality ?? 0.82;

  try {
    const objectUrl = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("image_decode_failed"));
      el.src = objectUrl;
    });
    URL.revokeObjectURL(objectUrl);

    const origW = img.naturalWidth || img.width;
    const origH = img.naturalHeight || img.height;

    const scale = origW > maxWidth ? maxWidth / origW : 1;
    const targetW = Math.max(1, Math.round(origW * scale));
    const targetH = Math.max(1, Math.round(origH * scale));

    // If image is already small (< 200KB) and within maxWidth, keep original bytes
    if (scale === 1 && originalSize <= 200 * 1024) {
      return {
        file,
        width: origW,
        height: origH,
        originalSize,
        compressedSize: originalSize,
        wasCompressed: false,
      };
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return {
        file,
        width: origW,
        height: origH,
        originalSize,
        compressedSize: originalSize,
        wasCompressed: false,
      };
    }

    ctx.drawImage(img, 0, 0, targetW, targetH);

    // Prefer WebP when supported; fall back to original MIME
    const targetMime =
      file.type === "image/png" ? "image/webp" : file.type === "image/jpeg" ? "image/jpeg" : "image/webp";

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), targetMime, quality)
    );

    if (!blob || blob.size >= originalSize) {
      return {
        file,
        width: origW,
        height: origH,
        originalSize,
        compressedSize: originalSize,
        wasCompressed: false,
      };
    }

    const ext = targetMime === "image/webp" ? "webp" : targetMime === "image/jpeg" ? "jpg" : "png";
    const baseName = file.name.replace(/\.[^.]+$/, "");
    const nextFile = new File([blob], `${baseName}.${ext}`, {
      type: targetMime,
      lastModified: Date.now(),
    });

    return {
      file: nextFile,
      width: targetW,
      height: targetH,
      originalSize,
      compressedSize: nextFile.size,
      wasCompressed: true,
    };
  } catch {
    return {
      file,
      width: null,
      height: null,
      originalSize,
      compressedSize: originalSize,
      wasCompressed: false,
    };
  }
}
