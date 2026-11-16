export interface PreparedImage {
  base64: string;
  mimeType: string;
  previewUrl: string;
  fileName: string;
  fileSizeBytes: number;
}

const MAX_RAW_FILE_BYTES = 20 * 1024 * 1024; // 20 MB upload cap
const MAX_DIMENSION = 2200;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export async function prepareImageFile(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error(
      "Please select an image file (PNG, JPG, WEBP, or GIF)."
    );
  }
  if (file.size > MAX_RAW_FILE_BYTES) {
    throw new Error(
      "This image is larger than 20 MB. Please choose a smaller image."
    );
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Could not read the selected image."));
      }
    };
    reader.onerror = () => reject(new Error("Could not read the selected image."));
    reader.readAsDataURL(file);
  });

  // If image is reasonably sized (< 3.5 MB) and standard web format, use directly
  const isStandardWebFormat = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif",
  ].includes(file.type.toLowerCase());

  if (file.size <= 3.5 * 1024 * 1024 && isStandardWebFormat) {
    const [, base64 = ""] = dataUrl.split(",");
    return {
      base64,
      mimeType: file.type === "image/jpg" ? "image/jpeg" : file.type,
      previewUrl: dataUrl,
      fileName: file.name,
      fileSizeBytes: file.size,
    };
  }

  // Otherwise normalize/downscale via canvas while preserving sharp text legibility
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("Could not decode this image file. Try PNG or JPG."));
    image.src = dataUrl;
  });

  let { width, height } = img;
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not process the image in this browser.");
  }
  ctx.drawImage(img, 0, 0, width, height);

  const outputMime = "image/jpeg";
  const compressedUrl = canvas.toDataURL(outputMime, 0.92);
  const [, base64 = ""] = compressedUrl.split(",");

  return {
    base64,
    mimeType: outputMime,
    previewUrl: compressedUrl,
    fileName: file.name,
    fileSizeBytes: file.size,
  };
}

export function base64ToBlobUrl(base64: string, mimeType: string): {
  blob: Blob;
  url: string;
} {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  return { blob, url };
}
