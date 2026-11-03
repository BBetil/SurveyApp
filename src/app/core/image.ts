import exifr from 'exifr';

export interface ProcessedImage {
  blob: Blob;
  thumb: Blob;
  takenAt: number;
  sourceKey: string;
}

const MAX_EDGE = 2000;
const THUMB_EDGE = 240;

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  release(): void;
}

/** Eski Safari createImageBitmap seçeneklerini desteklemeyebilir, o zaman <img> ile çözülür (yön otomatik uygulanır). */
async function decode(blob: Blob): Promise<Decoded> {
  try {
    const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  } catch {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch (e) {
      URL.revokeObjectURL(url);
      throw e;
    }
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
  }
}

function scaled(image: Decoded, edge: number, quality: number): Promise<Blob> {
  const ratio = Math.min(1, edge / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * ratio);
  canvas.height = Math.round(image.height * ratio);
  canvas.getContext('2d')!.drawImage(image.source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Fotoğraf işlenemedi'))), 'image/jpeg', quality),
  );
}

async function readTakenAt(file: File): Promise<number> {
  try {
    const exif = await exifr.parse(file, ['DateTimeOriginal']);
    if (exif?.DateTimeOriginal instanceof Date) return exif.DateTimeOriginal.getTime();
  } catch {
    // EXIF okunamazsa dosya tarihine düşer
  }
  return file.lastModified || Date.now();
}

/** Fotoğrafı küçültür, önizleme üretir ve çekim saatini okur. */
export async function processImage(file: File): Promise<ProcessedImage> {
  const takenAt = await readTakenAt(file);
  const image = await decode(file);
  try {
    const blob = await scaled(image, MAX_EDGE, 0.85);
    const thumb = await scaled(image, THUMB_EDGE, 0.7);
    return { blob, thumb, takenAt, sourceKey: `${file.size}-${takenAt}` };
  } finally {
    image.release();
  }
}

export async function thumbFrom(blob: Blob): Promise<Blob> {
  const image = await decode(blob);
  try {
    return await scaled(image, THUMB_EDGE, 0.7);
  } finally {
    image.release();
  }
}
