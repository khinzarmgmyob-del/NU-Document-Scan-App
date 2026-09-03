/**
 * Image Pre-Processing & Deskewing Pipeline
 * 
 * Provides:
 * 1. Aspect-ratio preservation with optimal high-DPI scaling (up to 2048px)
 * 2. Automatic Skew Detection & Deskewing (horizontal projection profile variance analysis)
 * 3. Illumination normalization & adaptive contrast stretching
 * 4. Edge sharpening filter for crisp Myanmar Unicode ligatures & table lines
 */

export interface PreprocessedImageResult {
  processedDataUrl: string;
  skewAngleDeg: number;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
}

/**
 * Calculates the variance of horizontal row projections at a given rotation angle.
 * When text lines are aligned horizontally, horizontal projection variance reaches maximum.
 */
function calculateProjectionVariance(
  binaryData: Uint8Array,
  width: number,
  height: number,
  angleRad: number
): number {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const cx = width / 2;
  const cy = height / 2;

  // Reduced sample rows for high speed (every 2 rows)
  const stepY = 2;
  const sampleRows = Math.floor(height / stepY);
  const rowSums = new Float32Array(sampleRows);

  // Sample across width (stepX = 3)
  const stepX = 3;
  let validPoints = 0;

  for (let y = 0; y < height; y += stepY) {
    const rowIdx = Math.floor(y / stepY);
    let sum = 0;
    const dy = y - cy;

    for (let x = 0; x < width; x += stepX) {
      const dx = x - cx;
      // Reverse rotate coordinate
      const srcX = Math.round(cx + dx * cos - dy * sin);
      const srcY = Math.round(cy + dx * sin + dy * cos);

      if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
        if (binaryData[srcY * width + srcX] === 1) {
          sum++;
        }
      }
    }
    rowSums[rowIdx] = sum;
    validPoints += sum;
  }

  if (validPoints === 0) return 0;

  // Calculate variance of row sums
  let mean = 0;
  for (let i = 0; i < rowSums.length; i++) {
    mean += rowSums[i];
  }
  mean /= rowSums.length;

  let variance = 0;
  for (let i = 0; i < rowSums.length; i++) {
    const diff = rowSums[i] - mean;
    variance += diff * diff;
  }
  return variance / rowSums.length;
}

/**
 * Detects the document tilt / skew angle in degrees using projection profile analysis.
 * Tests angles between -10.0° and +10.0° in two passes (coarse 1.0°, fine 0.25°).
 */
export function detectSkewAngle(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D
): number {
  const w = canvas.width;
  const h = canvas.height;

  // Downsample to small thumbnail for fast 60fps computation
  const targetW = 240;
  const targetH = Math.round((h * targetW) / w);

  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = targetW;
  thumbCanvas.height = targetH;
  const thumbCtx = thumbCanvas.getContext('2d', { willReadFrequently: true });
  if (!thumbCtx) return 0;

  thumbCtx.drawImage(canvas, 0, 0, targetW, targetH);
  const imgData = thumbCtx.getImageData(0, 0, targetW, targetH);
  const data = imgData.data;

  // Create binarized edge data (detect dark ink on light paper or vice versa)
  const binaryData = new Uint8Array(targetW * targetH);
  let totalLuma = 0;

  for (let i = 0; i < data.length; i += 4) {
    const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    totalLuma += luma;
  }
  const avgLuma = totalLuma / (targetW * targetH);
  const threshold = avgLuma * 0.88;

  for (let i = 0; i < data.length; i += 4) {
    const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    binaryData[i / 4] = luma < threshold ? 1 : 0;
  }

  // Pass 1: Coarse search (-10° to +10° with 1.0° step)
  let bestAngleDeg = 0;
  let maxVariance = -1;

  for (let angleDeg = -10; angleDeg <= 10; angleDeg += 1.0) {
    const angleRad = (angleDeg * Math.PI) / 180;
    const variance = calculateProjectionVariance(binaryData, targetW, targetH, angleRad);
    if (variance > maxVariance) {
      maxVariance = variance;
      bestAngleDeg = angleDeg;
    }
  }

  // Pass 2: Fine search around best angle (+- 1.5° with 0.25° step)
  const fineMin = Math.max(-12, bestAngleDeg - 1.5);
  const fineMax = Math.min(12, bestAngleDeg + 1.5);

  for (let angleDeg = fineMin; angleDeg <= fineMax; angleDeg += 0.25) {
    const angleRad = (angleDeg * Math.PI) / 180;
    const variance = calculateProjectionVariance(binaryData, targetW, targetH, angleRad);
    if (variance > maxVariance) {
      maxVariance = variance;
      bestAngleDeg = angleDeg;
    }
  }

  // If angle is negligible (<0.4°), treat as 0
  if (Math.abs(bestAngleDeg) < 0.4) {
    return 0;
  }

  return bestAngleDeg;
}

/**
 * Preprocesses and deskews an input document image before sending to Gemini API / OCR:
 * 1. Aspect-ratio preserved scaling up to 2048px max dimension
 * 2. Automatic tilt detection and rotation (deskew)
 * 3. Contrast stretching and illumination balancing
 * 4. Edge sharpening for complex Myanmar script ligatures
 */
export async function preprocessAndDeskewImage(
  imageSource: string | File | Blob,
  options: {
    enableDeskew?: boolean;
    maxDimension?: number;
    sharpen?: boolean;
  } = {}
): Promise<PreprocessedImageResult> {
  const { enableDeskew = true, maxDimension = 2048, sharpen = true } = options;

  return new Promise((resolve) => {
    let srcUrl = '';
    let isObjectUrl = false;

    if (typeof imageSource === 'string') {
      srcUrl = imageSource;
    } else {
      srcUrl = URL.createObjectURL(imageSource);
      isObjectUrl = true;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const origW = img.naturalWidth || img.width;
        const origH = img.naturalHeight || img.height;

        // 1. Maintain exact aspect ratio while scaling to optimal resolution
        let targetW = origW;
        let targetH = origH;

        if (origW > maxDimension || origH > maxDimension) {
          if (origW > origH) {
            targetW = maxDimension;
            targetH = Math.round((origH * maxDimension) / origW);
          } else {
            targetH = maxDimension;
            targetW = Math.round((origW * maxDimension) / origH);
          }
        }

        // Enforce minimum dimension
        targetW = Math.max(targetW, 400);
        targetH = Math.max(targetH, 400);

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (!ctx) {
          if (isObjectUrl) URL.revokeObjectURL(srcUrl);
          resolve({
            processedDataUrl: srcUrl,
            skewAngleDeg: 0,
            width: targetW,
            height: targetH,
            originalWidth: origW,
            originalHeight: origH,
          });
          return;
        }

        // Fill clean white background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);

        // 2. Detect skew angle
        let skewAngleDeg = 0;
        if (enableDeskew) {
          try {
            skewAngleDeg = detectSkewAngle(canvas, ctx);
          } catch (e) {
            console.warn('Deskew angle detection skipped:', e);
          }
        }

        // If skew detected, rotate canvas to straighten document
        let workingCanvas = canvas;
        let workingCtx = ctx;

        if (Math.abs(skewAngleDeg) >= 0.4) {
          const rotCanvas = document.createElement('canvas');
          rotCanvas.width = targetW;
          rotCanvas.height = targetH;
          const rotCtx = rotCanvas.getContext('2d', { willReadFrequently: true });

          if (rotCtx) {
            rotCtx.fillStyle = '#FFFFFF';
            rotCtx.fillRect(0, 0, targetW, targetH);
            rotCtx.save();
            rotCtx.translate(targetW / 2, targetH / 2);
            // Rotate negative of skew angle to straighten
            rotCtx.rotate((-skewAngleDeg * Math.PI) / 180);
            rotCtx.drawImage(canvas, -targetW / 2, -targetH / 2);
            rotCtx.restore();

            workingCanvas = rotCanvas;
            workingCtx = rotCtx;
          }
        }

        // 3. Contrast normalization & illumination correction
        const imgData = workingCtx.getImageData(0, 0, targetW, targetH);
        const data = imgData.data;

        // Calculate min & max luminance for stretching
        let minLuma = 255;
        let maxLuma = 0;

        // Sample 1 out of 8 pixels for speed
        for (let i = 0; i < data.length; i += 32) {
          const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          if (luma < minLuma) minLuma = luma;
          if (luma > maxLuma) maxLuma = luma;
        }

        const lumaRange = Math.max(30, maxLuma - minLuma);

        // Stretch contrast gently
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Normalize
          const normR = Math.min(255, Math.max(0, ((r - minLuma) / lumaRange) * 255));
          const normG = Math.min(255, Math.max(0, ((g - minLuma) / lumaRange) * 255));
          const normB = Math.min(255, Math.max(0, ((b - minLuma) / lumaRange) * 255));

          // Soft S-curve for deep text blacks and clean whites
          data[i] = normR < 128 ? normR * 0.85 : Math.min(255, normR * 1.08 + 10);
          data[i + 1] = normG < 128 ? normG * 0.85 : Math.min(255, normG * 1.08 + 10);
          data[i + 2] = normB < 128 ? normB * 0.85 : Math.min(255, normB * 1.08 + 10);
        }

        workingCtx.putImageData(imgData, 0, 0);

        // 4. Edge Sharpening (for crisp text ligatures and table borders)
        if (sharpen && targetW <= 2200) {
          try {
            const sharpCanvas = document.createElement('canvas');
            sharpCanvas.width = targetW;
            sharpCanvas.height = targetH;
            const sharpCtx = sharpCanvas.getContext('2d');
            if (sharpCtx) {
              sharpCtx.drawImage(workingCanvas, 0, 0);
              // Mild high-pass overlay
              sharpCtx.globalAlpha = 0.18;
              sharpCtx.filter = 'contrast(130%)';
              sharpCtx.drawImage(workingCanvas, 0, 0);
              workingCanvas = sharpCanvas;
            }
          } catch {
            // Ignore filter errors on older browsers
          }
        }

        const resultDataUrl = workingCanvas.toDataURL('image/jpeg', 0.92);
        if (isObjectUrl) URL.revokeObjectURL(srcUrl);

        resolve({
          processedDataUrl: resultDataUrl,
          skewAngleDeg: Math.round(skewAngleDeg * 10) / 10,
          width: targetW,
          height: targetH,
          originalWidth: origW,
          originalHeight: origH,
        });
      } catch (err) {
        console.warn('Image pre-processing fallback:', err);
        if (isObjectUrl) URL.revokeObjectURL(srcUrl);
        resolve({
          processedDataUrl: srcUrl,
          skewAngleDeg: 0,
          width: 800,
          height: 1000,
          originalWidth: 800,
          originalHeight: 1000,
        });
      }
    };

    img.onerror = () => {
      if (isObjectUrl) URL.revokeObjectURL(srcUrl);
      resolve({
        processedDataUrl: srcUrl,
        skewAngleDeg: 0,
        width: 800,
        height: 1000,
        originalWidth: 800,
        originalHeight: 1000,
      });
    };

    img.src = srcUrl;
  });
}
