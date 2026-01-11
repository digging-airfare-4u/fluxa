import type * as fabric from 'fabric';

export interface ExportOptions {
  format?: 'png' | 'jpeg';
  multiplier?: 1 | 2 | 4;
  quality?: number;
  backgroundColor?: string;
}

export interface ExportResult {
  blob: Blob;
  dataURL: string;
  width: number;
  height: number;
}

/**
 * Export canvas to PNG with specified multiplier (1x, 2x, 4x)
 * Requirements: 15.3, 15.4
 */
export async function exportCanvasToPNG(
  canvas: fabric.Canvas,
  options: ExportOptions = {}
): Promise<ExportResult> {
  const {
    format = 'png',
    multiplier = 1,
    quality = 1,
    backgroundColor,
  } = options;

  if (!canvas) {
    throw new Error('Canvas is required for export');
  }

  // Store original background if we need to override
  const originalBackground = canvas.backgroundColor;

  try {
    // Set background if specified
    if (backgroundColor) {
      canvas.backgroundColor = backgroundColor;
      canvas.requestRenderAll();
    }

    // Generate data URL with multiplier for resolution
    const dataURL = canvas.toDataURL({
      format,
      multiplier,
      quality,
    });

    // Convert data URL to Blob
    const blob = await dataURLToBlob(dataURL);

    // Calculate output dimensions
    const width = canvas.getWidth() * multiplier;
    const height = canvas.getHeight() * multiplier;

    return {
      blob,
      dataURL,
      width,
      height,
    };
  } finally {
    // Restore original background
    if (backgroundColor && originalBackground !== undefined) {
      canvas.backgroundColor = originalBackground;
      canvas.requestRenderAll();
    }
  }
}

/**
 * Convert data URL to Blob
 */
export async function dataURLToBlob(dataURL: string): Promise<Blob> {
  const response = await fetch(dataURL);
  return response.blob();
}

/**
 * Download blob as file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate filename for export
 */
export function generateExportFilename(
  projectName: string,
  multiplier: number,
  format: 'png' | 'jpeg' = 'png'
): string {
  const timestamp = new Date().toISOString().slice(0, 10);
  const resolution = `${multiplier}x`;
  const safeName = projectName.replace(/[^a-zA-Z0-9-_]/g, '_');
  return `${safeName}_${resolution}_${timestamp}.${format}`;
}

/**
 * Export and download canvas
 */
export async function exportAndDownload(
  canvas: fabric.Canvas,
  projectName: string,
  options: ExportOptions = {}
): Promise<ExportResult> {
  const result = await exportCanvasToPNG(canvas, options);
  const filename = generateExportFilename(
    projectName,
    options.multiplier || 1,
    options.format || 'png'
  );
  downloadBlob(result.blob, filename);
  return result;
}
