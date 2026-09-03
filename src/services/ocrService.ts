import { createWorker } from 'tesseract.js';
import { preprocessAndDeskewImage } from './imagePreprocessingService';
import {
  BoundingBox,
  ReconstructedElement,
  ReconstructedTable,
  DocumentReconstruction,
  DocumentSectionBlock,
} from '../types';

let workerPromise: Promise<Tesseract.Worker> | null = null;

async function getOcrWorker(onProgress?: (progress: number, status: string) => void): Promise<Tesseract.Worker> {
  const worker = await createWorker('eng', 1, {
    logger: m => {
      if (onProgress && m.status) {
        onProgress(m.progress || 0, m.status);
      }
    }
  });
  return worker;
}

/**
 * Clean OCR noisy tokens and artifacts (e.g. ~~, |, [, ], spurious table grid characters)
 */
function cleanOcrToken(raw: string): string {
  if (!raw) return '';
  let text = raw.trim();
  // Remove markdown and table border artifacts
  text = text.replace(/^[|~\[\]{}<>_=+\-–—\\/]+|[|~\[\]{}<>_=+\-–—\\/]+$/g, '').trim();
  text = text.replace(/~~+/g, '').replace(/\|+/g, '').trim();
  // Remove standalone punctuation noise
  if (/^[|~\[\]{}_=+\-–—\\/.,:;!?'"`]+$/.test(text)) {
    return '';
  }
  return text;
}

/**
 * Preprocesses document image (grayscale + high-contrast binarization) for high OCR accuracy
 */
export async function preprocessImageForOcr(imageSource: string | File | Blob): Promise<string> {
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
        const canvas = document.createElement('canvas');
        const maxDimension = 1800;
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = Math.max(width, 300);
        canvas.height = Math.max(height, 300);

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          if (isObjectUrl) URL.revokeObjectURL(srcUrl);
          resolve(srcUrl);
          return;
        }

        // Draw white background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Get pixel data for contrast enhancement & binarization
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        // Grayscale + High-Contrast stretching
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          // Luminance formula
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          // Apply gentle S-curve contrast stretch
          const enhanced = gray < 135 ? Math.max(0, gray * 0.75) : Math.min(255, gray * 1.15 + 15);
          data[i] = enhanced;
          data[i + 1] = enhanced;
          data[i + 2] = enhanced;
        }

        ctx.putImageData(imgData, 0, 0);
        const resultDataUrl = canvas.toDataURL('image/png');
        if (isObjectUrl) URL.revokeObjectURL(srcUrl);
        resolve(resultDataUrl);
      } catch (err) {
        if (isObjectUrl) URL.revokeObjectURL(srcUrl);
        resolve(srcUrl);
      }
    };

    img.onerror = () => {
      if (isObjectUrl) URL.revokeObjectURL(srcUrl);
      resolve(srcUrl);
    };

    img.src = srcUrl;
  });
}

/**
 * Spatial Clustering for Web OCR using Word Bounding Boxes (X/Y coordinates)
 * Accurately groups words into lines and clusters column boundaries without merging unrelated content.
 */
export function extractSpatialTableFromWords(
  words: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }>
): string[][] {
  if (!words || words.length === 0) return [];

  // Filter and clean valid words
  const validWords = words
    .map(w => ({
      text: cleanOcrToken(w.text),
      bbox: w.bbox,
      x0: w.bbox.x0,
      y0: w.bbox.y0,
      x1: w.bbox.x1,
      y1: w.bbox.y1,
      width: w.bbox.x1 - w.bbox.x0,
      height: w.bbox.y1 - w.bbox.y0,
      centerX: (w.bbox.x0 + w.bbox.x1) / 2,
      centerY: (w.bbox.y0 + w.bbox.y1) / 2,
    }))
    .filter(w => w.text.length > 0);

  if (validWords.length === 0) return [];

  // 1. Calculate median word height
  const heights = validWords.map(w => w.height).sort((a, b) => a - b);
  const medianH = heights[Math.floor(heights.length / 2)] || 16;
  const yTolerance = Math.max(6, Math.min(22, medianH * 0.6));

  // 2. Group into Horizontal Rows (Y-Clustering)
  const rows: Array<Array<typeof validWords[0]>> = [];
  const sortedWords = [...validWords].sort((a, b) => a.centerY - b.centerY || a.x0 - b.x0);

  for (const word of sortedWords) {
    let placed = false;
    for (const r of rows) {
      const avgY = r.reduce((sum, item) => sum + item.centerY, 0) / r.length;
      if (Math.abs(word.centerY - avgY) <= yTolerance) {
        r.push(word);
        placed = true;
        break;
      }
    }
    if (!placed) {
      rows.push([word]);
    }
  }

  // Sort words left-to-right in each row
  rows.forEach(r => r.sort((a, b) => a.x0 - b.x0));

  // 3. Merge adjacent words into distinct "Cell Segments" within each row
  interface Segment {
    text: string;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    centerX: number;
  }

  const rowSegments: Segment[][] = [];
  const interWordThreshold = Math.max(14, medianH * 1.35);

  for (const r of rows) {
    const segments: Segment[] = [];
    let current: Segment | null = null;

    for (const word of r) {
      if (!current) {
        current = {
          text: word.text,
          x0: word.x0,
          y0: word.y0,
          x1: word.x1,
          y1: word.y1,
          centerX: word.centerX,
        };
      } else {
        const gap = word.x0 - current.x1;
        if (gap < interWordThreshold) {
          // Merge with current segment
          current.text = `${current.text} ${word.text}`;
          current.x1 = Math.max(current.x1, word.x1);
          current.y0 = Math.min(current.y0, word.y0);
          current.y1 = Math.max(current.y1, word.y1);
          current.centerX = (current.x0 + current.x1) / 2;
        } else {
          // New column segment
          if (current.text.trim()) {
            segments.push(current);
          }
          current = {
            text: word.text,
            x0: word.x0,
            y0: word.y0,
            x1: word.x1,
            y1: word.y1,
            centerX: word.centerX,
          };
        }
      }
    }
    if (current && current.text.trim()) {
      segments.push(current);
    }
    if (segments.length > 0) {
      rowSegments.push(segments);
    }
  }

  if (rowSegments.length === 0) return [];

  // 4. Identify Column Intervals from Multi-Column Rows
  const multiColRows = rowSegments.filter(s => s.length >= 2);
  const anchorRows = multiColRows.length > 0 ? multiColRows : rowSegments;

  // Collect starting X coordinates of all cell segments
  const xStartCoords: number[] = [];
  for (const r of anchorRows) {
    for (const seg of r) {
      xStartCoords.push(seg.x0);
    }
  }

  xStartCoords.sort((a, b) => a - b);

  // Cluster X coordinates into column starting zones
  const colLeftAnchors: number[] = [];
  const colMergeGap = Math.max(20, medianH * 2.2);

  for (const x of xStartCoords) {
    let matched = false;
    for (let i = 0; i < colLeftAnchors.length; i++) {
      if (Math.abs(colLeftAnchors[i] - x) <= colMergeGap) {
        colLeftAnchors[i] = (colLeftAnchors[i] + x) / 2;
        matched = true;
        break;
      }
    }
    if (!matched) {
      colLeftAnchors.push(x);
    }
  }

  colLeftAnchors.sort((a, b) => a - b);

  // If only 1 column anchor detected, return each row segment as a line
  if (colLeftAnchors.length <= 1) {
    const singleColTable = rowSegments.map(r => [r.map(s => s.text).join('   ')]);
    return singleColTable;
  }

  // 5. Map each row's segments into the detected column bins
  const rawTable: string[][] = [];

  for (const r of rowSegments) {
    const rowCells = new Array(colLeftAnchors.length).fill('');

    for (const seg of r) {
      // Find the best column index
      let bestIdx = 0;
      let minDistance = Infinity;

      for (let c = 0; c < colLeftAnchors.length; c++) {
        const anchor = colLeftAnchors[c];
        const dist = Math.abs(seg.x0 - anchor);
        if (dist < minDistance) {
          minDistance = dist;
          bestIdx = c;
        }
      }

      if (rowCells[bestIdx]) {
        rowCells[bestIdx] = `${rowCells[bestIdx]} ${seg.text}`.trim();
      } else {
        rowCells[bestIdx] = seg.text.trim();
      }
    }

    if (rowCells.some(c => c.length > 0)) {
      rawTable.push(rowCells);
    }
  }

  // 6. Clean up empty columns
  const activeColIndices: number[] = [];
  for (let c = 0; c < colLeftAnchors.length; c++) {
    const hasData = rawTable.some(row => row[c] && row[c].trim().length > 0);
    if (hasData) {
      activeColIndices.push(c);
    }
  }

  if (activeColIndices.length === 0) return [];

  const cleanedTable = rawTable.map(row => activeColIndices.map(c => row[c] || ''));
  return OcrService.normalizeTable(cleanedTable);
}

/**
 * Converts SVG data URLs to clean raster PNG data URLs for optimal OCR recognition
 */
export async function ensureRasterImage(imageSrc: string): Promise<string> {
  if (!imageSrc || !imageSrc.startsWith('data:image/svg')) {
    return imageSrc;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 800;
      canvas.height = img.naturalHeight || 1000;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else {
        resolve(imageSrc);
      }
    };
    img.onerror = () => resolve(imageSrc);
    img.src = imageSrc;
  });
}

export class OcrService {
  /**
   * Stored User API key for Google AI Studio
   */
  static getStoredApiKey(): string {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('gemini_api_key') || '';
    }
    return '';
  }

  static setStoredApiKey(key: string): void {
    if (typeof window !== 'undefined') {
      if (key.trim()) {
        localStorage.setItem('gemini_api_key', key.trim());
      } else {
        localStorage.removeItem('gemini_api_key');
      }
    }
  }

  /**
   * Check if Gemini API is available (either server configured or stored in localStorage)
   */
  static async checkGeminiAvailability(): Promise<{ available: boolean; hasStoredKey: boolean; hasServerKey: boolean }> {
    const storedKey = this.getStoredApiKey();
    let hasServerKey = false;
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        hasServerKey = Boolean(data.hasGeminiKey);
      }
    } catch {
      hasServerKey = false;
    }
    return {
      available: Boolean(storedKey || hasServerKey),
      hasStoredKey: Boolean(storedKey),
      hasServerKey,
    };
  }

  /**
   * Test Gemini API Key connectivity
   */
  static async testGeminiApiKey(key: string): Promise<{ success: boolean; message: string }> {
    const trimmed = (key || '').trim();
    if (!trimmed) {
      return { success: false, message: 'Please enter a valid Google Gemini API Key' };
    }

    // 1. Try server-side endpoint /api/gemini/test-key
    try {
      const res = await fetch('/api/gemini/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: trimmed }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (data.success) {
          return {
            success: true,
            message: `Connected to Google Gemini (${data.modelUsed || 'AI Flash'})!`,
          };
        } else if (data.error) {
          return { success: false, message: data.error };
        }
      }
    } catch (err: any) {
      console.warn('Server test-key proxy check:', err);
    }

    // 2. Direct validation against Google Gemini ListModels API as reliable client fallback
    try {
      const googleRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(trimmed)}`
      );
      if (googleRes.ok) {
        return { success: true, message: 'Connected to Google Gemini AI successfully!' };
      } else {
        const errorData = await googleRes.json().catch(() => ({}));
        const msg = errorData?.error?.message || `Google API returned status ${googleRes.status}`;
        return { success: false, message: msg };
      }
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Network error verifying API Key with Google AI Studio',
      };
    }
  }

  /**
   * Fast client-side image compressor for rapid upload and fast AI inference (max 1280px, JPEG 0.85)
   */
  static async prepareCompressedBase64(imageSource: string | File | Blob): Promise<{ base64: string; mimeType: string }> {
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
          const maxDim = 1280;
          let width = img.naturalWidth || img.width || 800;
          let height = img.naturalHeight || img.height || 600;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(width, 100);
          canvas.height = Math.max(height, 100);

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            if (isObjectUrl) URL.revokeObjectURL(srcUrl);
            resolve({ base64: srcUrl, mimeType: 'image/jpeg' });
            return;
          }

          // White background
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          const base64 = canvas.toDataURL('image/jpeg', 0.85);
          if (isObjectUrl) URL.revokeObjectURL(srcUrl);
          resolve({ base64, mimeType: 'image/jpeg' });
        } catch {
          if (isObjectUrl) URL.revokeObjectURL(srcUrl);
          resolve({ base64: srcUrl, mimeType: 'image/jpeg' });
        }
      };

      img.onerror = () => {
        if (isObjectUrl) URL.revokeObjectURL(srcUrl);
        resolve({ base64: srcUrl, mimeType: 'image/jpeg' });
      };

      img.src = srcUrl;
    });
  }

  /**
   * HYBRID DOCUMENT RECONSTRUCTION ENGINE:
   * 1. Preprocesses & auto-deskews image (straightens tilt, normalizes contrast, sharpens edges)
   * 2. Executes Dual-Pass / Coordinate-Aware Gemini Reconstruction
   * 3. Extracts strict verbatim OCR, coordinate bounding boxes (0-1000), complex tables (with colspan/rowspan), and pixel-perfect HTML5+CSS
   */
  static async reconstructDocument(
    imageSource: string | File | Blob,
    onProgress?: (progress: number, status: string) => void
  ): Promise<{
    text: string;
    table: string[][];
    htmlContent: string;
    elements: ReconstructedElement[];
    tables: ReconstructedTable[];
    sections: DocumentSectionBlock[];
    reconstruction?: DocumentReconstruction;
    engine: 'gemini' | 'spatial';
    deskewAngleDeg?: number;
    error?: string;
  }> {
    const apiKey = this.getStoredApiKey();

    if (onProgress) onProgress(0.1, 'Auto-Deskewing & Contrast Normalization (Image Preprocessing)...');
    const preprocessed = await preprocessAndDeskewImage(imageSource, {
      enableDeskew: true,
      maxDimension: 2048,
      sharpen: true,
    });

    const cleanBase64 = preprocessed.processedDataUrl.replace(/^data:image\/[a-zA-Z0-9.+_-]+;base64,/, '');

    // 1. First Attempt: Server-side Hybrid Reconstruction Engine /api/gemini/reconstruct-document
    try {
      if (onProgress) onProgress(0.3, 'AI Coordinate-Aware Dual-Pass Reconstruction (Gemini Flash)...');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      const response = await fetch('/api/gemini/reconstruct-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: preprocessed.processedDataUrl,
          mimeType: 'image/jpeg',
          apiKey: apiKey || undefined,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const result = await response.json();
        if (result.success && (result.fullText || result.htmlContent)) {
          if (onProgress) onProgress(1.0, 'Document Reconstruction & Table Match Complete');

          const extractedTable =
            result.tables?.[0]?.rawMatrix && Array.isArray(result.tables[0].rawMatrix)
              ? result.tables[0].rawMatrix
              : OcrService.parseTextToTable(result.fullText || '');

          const reconstruction: DocumentReconstruction = {
            title: result.title || 'Scanned Document',
            subtitle: result.subtitle || '',
            documentType: result.documentType || 'general',
            language: result.language || 'my',
            orientation: result.orientation || 'portrait',
            fullText: result.fullText || '',
            htmlContent: result.htmlContent || '',
            elements: result.elements || [],
            tables: result.tables || [],
            sections: result.sections || [],
            confidence: result.confidence || 0.98,
            deskewAngleDeg: preprocessed.skewAngleDeg,
          };

          return {
            text: result.fullText || '',
            table: extractedTable,
            htmlContent: result.htmlContent || '',
            elements: result.elements || [],
            tables: result.tables || [],
            sections: result.sections || [],
            reconstruction,
            engine: 'gemini',
            deskewAngleDeg: preprocessed.skewAngleDeg,
          };
        }
      }
    } catch (err: any) {
      console.warn('Server reconstruct-document endpoint issue:', err.message || err);
    }

    // 2. Second Attempt: Fallback to table-extract endpoint
    try {
      if (onProgress) onProgress(0.5, 'Running Table Extraction & Verbatim OCR...');
      const fallbackRes = await fetch('/api/gemini/table-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: preprocessed.processedDataUrl,
          mimeType: 'image/jpeg',
          apiKey: apiKey || undefined,
        }),
      });
      const data = await fallbackRes.json();
      if (data.success && data.text) {
        const rawTable = data.table && Array.isArray(data.table) ? data.table : [];
        return {
          text: data.text,
          table: rawTable.length > 0 ? OcrService.normalizeTable(rawTable) : OcrService.parseTextToTable(data.text),
          htmlContent: `<div style="font-family:'Pyidaungsu','Segoe UI',sans-serif;line-height:1.6;"><pre>${data.text}</pre></div>`,
          elements: [],
          tables: [],
          sections: [],
          engine: 'gemini',
          deskewAngleDeg: preprocessed.skewAngleDeg,
        };
      }
    } catch (tblErr) {
      console.warn('Fallback table-extract failed:', tblErr);
    }

    // 3. Third Attempt: Direct Client-Side Gemini Vision API call (if user has API Key)
    if (apiKey) {
      const CANDIDATE_DIRECT_MODELS = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-2.5-flash', 'gemini-flash-latest'];
      for (const model of CANDIDATE_DIRECT_MODELS) {
        try {
          if (onProgress) onProgress(0.65, `Direct connection to Google Gemini (${model})...`);
          const prompt =
            "You are an expert Document Intelligence, Multilingual OCR, and High-Precision Table & Structure Extraction Engine.\n" +
            "You have native, fluent understanding of Myanmar Unicode (မြန်မာ ယူနီကုဒ် / Unicode 5.2+), English, and international character sets.\n\n" +
            "MANDATORY OCR & EXTRACTION INSTRUCTIONS:\n" +
            "1. Transcribe ALL visible text into 'fullText' with 100% exact fidelity in Myanmar Unicode and English.\n" +
            "2. Preserve every section, bullet point, checkmark, note (မှတ်ချက်), and technical term.\n" +
            "3. Extract structured 2D table matrix into 'table':\n" +
            "   - For tables/invoices: Row 0 is column headers, following rows are values.\n" +
            "   - For guides/infographics/notices: Extract 3-column table: ['ကဏ္ဍ / အပိုင်း (Section)', 'အကြောင်းအရာ (Topic / Point)', 'အသေးစိတ် ရှင်းလင်းချက် (Details / Action)'].\n" +
            "Return strictly valid JSON with format: {\"fullText\": \"...\", \"table\": [[\"...\", \"...\"]]}";

          const directRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
                      { text: prompt },
                    ],
                  },
                ],
                generationConfig: {
                  temperature: 0.1,
                  responseMimeType: 'application/json',
                },
              }),
            }
          );

          if (directRes.ok) {
            const data = await directRes.json();
            const textContent = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textContent) {
              let parsed: any = {};
              try {
                parsed = JSON.parse(textContent);
              } catch {
                parsed = { fullText: textContent, table: [] };
              }

              if (onProgress) onProgress(1.0, 'AI Vision Extraction Complete');
              const rawTable = parsed.table && Array.isArray(parsed.table) ? parsed.table : [];
              const normalizedTable = rawTable.length > 0
                ? OcrService.normalizeTable(rawTable)
                : OcrService.parseTextToTable(parsed.fullText || textContent);

              return {
                text: parsed.fullText || textContent || '',
                table: normalizedTable,
                htmlContent: `<div style="font-family:'Pyidaungsu','Segoe UI',sans-serif;line-height:1.6;"><pre>${parsed.fullText || textContent}</pre></div>`,
                elements: [],
                tables: [],
                sections: [],
                engine: 'gemini',
                deskewAngleDeg: preprocessed.skewAngleDeg,
              };
            }
          }
        } catch (directErr) {
          console.warn(`Direct client call to ${model} failed:`, directErr);
        }
      }
    }

    // 4. Fallback when AI Vision is unavailable: Local Spatial Clustering Engine
    if (onProgress) onProgress(0.8, 'Using local 2D Spatial Clustering Engine...');
    const fallbackResult = await OcrService.recognizeImageWithSpatialClustering(preprocessed.processedDataUrl, onProgress);
    return {
      ...fallbackResult,
      htmlContent: `<div style="font-family:'Pyidaungsu','Segoe UI',sans-serif;line-height:1.6;"><pre>${fallbackResult.text}</pre></div>`,
      elements: [],
      tables: [],
      sections: [],
      engine: 'spatial',
      deskewAngleDeg: preprocessed.skewAngleDeg,
      error: apiKey
        ? 'Gemini Vision connection timeout. Used local Spatial Engine.'
        : '⚠️ မြန်မာစာ ယူနီကုဒ် အပြည့်အဝ ဖတ်ရှုနိုင်ရန် Google Gemini API Key ထည့်သွင်းပေးပါ။ (Used local Spatial Engine)',
    };
  }

  /**
   * AI Smart Vision Table Extraction using Gemini Flash (Fast, Accurate Table Matrix & Unicode)
   * Calls the Hybrid Document Reconstruction Engine with automatic fallback.
   */
  static async recognizeImageWithGeminiVision(
    imageSource: string | File | Blob,
    onProgress?: (progress: number, status: string) => void
  ): Promise<{
    text: string;
    table: string[][];
    engine: 'gemini' | 'spatial';
    htmlContent?: string;
    elements?: ReconstructedElement[];
    tables?: ReconstructedTable[];
    sections?: DocumentSectionBlock[];
    reconstruction?: DocumentReconstruction;
    deskewAngleDeg?: number;
    error?: string;
  }> {
    return await this.reconstructDocument(imageSource, onProgress);
  }

  /**
   * Recognizes text and extracts structured 2D table using 2D Spatial Bounding Box Clustering
   */
  static async recognizeImageWithSpatialClustering(
    imageSource: string | File | Blob,
    onProgress?: (progress: number, status: string) => void
  ): Promise<{ text: string; table: string[][] }> {
    try {
      if (onProgress) onProgress(0.1, 'Pre-processing document image...');
      // Clean and enhance contrast for sharp characters
      const enhancedSource = await preprocessImageForOcr(imageSource);

      if (onProgress) onProgress(0.25, 'Initializing Spatial OCR Engine...');
      
      const workerPromise = getOcrWorker(onProgress);
      const workerTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Spatial OCR worker initialization timed out')), 12000)
      );
      const worker = await Promise.race([workerPromise, workerTimeout]);

      if (onProgress) onProgress(0.45, 'Running Optical Recognition...');
      
      const recogPromise = worker.recognize(enhancedSource);
      const recogTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Spatial OCR recognition timed out')), 15000)
      );
      const result = await Promise.race([recogPromise, recogTimeout]);

      if (onProgress) onProgress(0.85, 'Clustering spatial column coordinates...');
      
      let text = (result.data.text || '')
        .split('\n')
        .map(line => cleanOcrToken(line))
        .filter(line => line.length > 0)
        .join('\n');

      let table: string[][] = [];

      // Extract using 2D Spatial Bounding Box Clustering Algorithm
      if (result.data.words && result.data.words.length > 0) {
        const words = result.data.words.map(w => ({
          text: cleanOcrToken(w.text),
          bbox: {
            x0: w.bbox.x0,
            y0: w.bbox.y0,
            x1: w.bbox.x1,
            y1: w.bbox.y1,
          }
        })).filter(w => w.text.length > 0);

        table = extractSpatialTableFromWords(words);
      }

      // Fallback to text parsing if spatial table produced no rows
      if (table.length === 0 && text) {
        table = OcrService.parseTextToTable(text);
      }

      if (onProgress) onProgress(1.0, 'Table Extraction Complete');
      return { text, table };
    } catch (err) {
      console.error('Spatial OCR error:', err);
      return { text: '', table: [] };
    }
  }

  /**
   * Recognizes text from image data URL, File, or Blob
   */
  static async recognizeTextFromImage(
    imageSource: string | File | Blob,
    onProgress?: (progress: number, status: string) => void
  ): Promise<string> {
    try {
      if (onProgress) onProgress(0.1, 'Initializing OCR Engine...');
      const worker = await getOcrWorker(onProgress);
      if (onProgress) onProgress(0.3, 'Processing image...');
      
      const result = await worker.recognize(imageSource);
      if (onProgress) onProgress(1.0, 'Complete');
      
      return result.data.text.trim();
    } catch (err) {
      console.error('Tesseract OCR error:', err);
      // Fallback extraction if worker fails
      return '';
    }
  }

  /**
   * Parses extracted OCR text lines into structured 2D tabular rows
   * Handles ASCII borders (| - +), CSV, Tabs, Multi-spaces, Invoices, and receipts.
   * Guarantees strict row column length matching (preventing Flutter/PDF DataTable assertion errors).
   */
  static parseTextToTable(rawText: string): string[][] {
    if (!rawText || rawText.trim().length === 0) return [];

    const rawLines = rawText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const parsedRows: string[][] = [];

    // Filter out pure separator lines like "+---+---+", "|---|---|", "==========", "----------"
    const isSeparatorLine = (line: string) => {
      const cleaned = line.replace(/[\s\-|+=:_~]/g, '');
      return cleaned.length === 0;
    };

    for (const rawLine of rawLines) {
      if (isSeparatorLine(rawLine)) continue;

      let line = rawLine;

      // Strip leading and trailing pipe if it's formatted like a markdown / boxed table: | Col 1 | Col 2 |
      if (line.startsWith('|') && line.endsWith('|')) {
        line = line.substring(1, line.length - 1).trim();
      }

      let cells: string[] = [];

      // Check delimiters in order of specificity
      if (line.includes('|')) {
        cells = line
          .split('|')
          .map(c => c.trim())
          .filter((_, idx, arr) => {
            // Keep empty cells unless it's just exterior padding
            return idx > 0 || arr[idx].length > 0;
          });
      } else if (line.includes('\t')) {
        cells = line.split('\t').map(c => c.trim());
      } else if (line.includes(';') && line.split(';').length > 1) {
        cells = line.split(';').map(c => c.trim());
      } else if (line.includes(',') && line.split(',').length > 1 && !/^\$\d+,\d+/.test(line)) {
        cells = line.split(',').map(c => c.trim());
      } else {
        // Multi-space separated columns (2 or more spaces)
        cells = line
          .split(/\s{2,}|\s+-\s+/)
          .map(c => c.trim())
          .filter(c => c.length > 0);

        // If line is single-space separated, check if it matches an invoice/receipt line
        if (cells.length <= 1 && line.includes(' ')) {
          // Check if line ends with a price or numeric total e.g. "Cold Brew Latte 2 $11.00"
          const priceMatch = line.match(/^(.*?)\s+(\d+)?\s*([$€£¥]?\s*\d+[.,]\d{2})$/);
          if (priceMatch) {
            const item = priceMatch[1].trim();
            const qty = priceMatch[2] ? priceMatch[2].trim() : '';
            const price = priceMatch[3].trim();
            cells = qty ? [item, qty, price] : [item, price];
          } else {
            const words = line.split(' ').map(w => w.trim()).filter(w => w.length > 0);
            if (words.length >= 2 && words.length <= 6) {
              cells = words;
            } else {
              cells = [line];
            }
          }
        }
      }

      if (cells.length > 0) {
        parsedRows.push(cells);
      }
    }

    if (parsedRows.length === 0) return [];

    return this.normalizeTable(parsedRows);
  }

  /**
   * Strictly normalizes a 2D table so that EVERY row has the EXACT same length as the header.
   * Prevents '!rows.any((DataRow row) => row.cells.length != columns.length)' assertion failures.
   */
  static normalizeTable(table: string[][]): string[][] {
    if (!table || table.length === 0) return [];

    // Find the maximum column count across all rows
    let maxCols = Math.max(...table.map(r => r.length));
    if (maxCols < 1) maxCols = 1;

    // Ensure header row exists and has maxCols
    const normalized: string[][] = [];

    for (let rIdx = 0; rIdx < table.length; rIdx++) {
      const row = [...table[rIdx]];

      if (row.length === maxCols) {
        normalized.push(row);
      } else if (row.length < maxCols) {
        // Intelligent padding:
        // If row is a summary/total row (e.g. ['Subtotal', '$53.50'] with maxCols = 4),
        // place the label at start and value at the end.
        const padded = new Array(maxCols).fill('');
        if (row.length === 1) {
          padded[0] = row[0];
        } else if (row.length === 2) {
          padded[0] = row[0];
          padded[maxCols - 1] = row[1];
        } else {
          // Fill from start, and put the last element in the last column
          for (let i = 0; i < row.length - 1; i++) {
            padded[i] = row[i];
          }
          padded[maxCols - 1] = row[row.length - 1];
        }
        normalized.push(padded);
      } else {
        // row has more items than maxCols: consolidate excess items into the first description cell
        const excess = row.length - maxCols;
        const mergedFirst = row.slice(0, excess + 1).join(' ');
        const remainder = row.slice(excess + 1);
        normalized.push([mergedFirst, ...remainder]);
      }
    }

    // If first row has missing names, supply friendly default header names
    if (normalized.length > 0) {
      normalized[0] = normalized[0].map((col, idx) => (col && col.trim().length > 0 ? col : `Column ${idx + 1}`));
    }

    return normalized;
  }

  /**
   * Parse extracted raw text and table into structured document layout blocks
   * with colored status themes, titles, bullet items with checkmarks, and notes.
   * Guarantees 100% preservation of all lines and paragraphs.
   */
  static parseTextToSections(
    rawText: string,
    tableData?: string[][]
  ): { title: string; subtitle: string; sections: any[] } {
    const lines = (rawText || '').split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) {
      return {
        title: 'Extracted Document',
        subtitle: 'DocuScan Formatted OCR',
        sections: tableData && tableData.length > 0 ? [{ type: 'table', title: 'Data Table', table: tableData }] : [],
      };
    }

    let title = lines[0] || 'Scanned Document';
    let subtitle = '';
    let startIdx = 1;

    if (lines.length > 1 && !lines[1].startsWith('✔') && !lines[1].startsWith('•') && !lines[1].startsWith('-') && !lines[1].startsWith('*') && !lines[1].includes('|')) {
      subtitle = lines[1];
      startIdx = 2;
    }

    const sections: any[] = [];
    let currentSection: {
      type: 'standard_box' | 'danger_box' | 'warning_box' | 'table' | 'paragraph' | 'notes';
      title: string;
      colorTheme: 'emerald' | 'blue' | 'red' | 'amber' | 'slate' | 'yellow';
      items: { text: string; subtext?: string; isCheck?: boolean }[];
      content?: string;
    } | null = null;

    const determineTheme = (titleText: string): { type: any; colorTheme: any } => {
      const lower = titleText.toLowerCase();
      if (
        lower.includes('ပြဿနာ') ||
        lower.includes('corrupt') ||
        lower.includes('ပျက်စီး') ||
        lower.includes('problem') ||
        lower.includes('error') ||
        lower.includes('fail')
      ) {
        return { type: 'danger_box', colorTheme: 'red' };
      }
      if (
        lower.includes('မှတ်ချက်') ||
        lower.includes('သတိပေးချက်') ||
        lower.includes('warning') ||
        lower.includes('caution') ||
        lower.includes('note')
      ) {
        return { type: 'warning_box', colorTheme: 'amber' };
      }
      if (
        lower.includes('standard') ||
        lower.includes('နည်းလမ်း') ||
        lower.includes('guide') ||
        lower.includes('instruction') ||
        lower.includes('sop')
      ) {
        return { type: 'standard_box', colorTheme: 'blue' };
      }
      if (
        lower.includes('ရွေးချယ်စရာ') ||
        lower.includes('option') ||
        lower.includes('solution') ||
        lower.includes('repair') ||
        lower.includes('rdpnight')
      ) {
        return { type: 'standard_box', colorTheme: 'emerald' };
      }
      return { type: 'standard_box', colorTheme: 'slate' };
    };

    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i];

      // 1. Note line detection
      const isNote = line.startsWith('မှတ်ချက်') || line.startsWith('*') || line.startsWith('Note:');
      if (isNote) {
        if (currentSection) {
          currentSection.content = (currentSection.content ? currentSection.content + '\n' : '') + line;
        } else {
          sections.push({
            type: 'warning_box',
            title: 'မှတ်ချက် / သတိပေးချက် (Important Note)',
            colorTheme: 'yellow',
            content: line,
            items: [],
          });
        }
        continue;
      }

      // 2. Inline Table Row detection (e.g. Item | Qty | Price)
      if (line.includes('|')) {
        const parts = line.split('|').map(p => p.trim());
        if (parts.length >= 2) {
          if (!currentSection) {
            currentSection = {
              type: 'standard_box',
              title: 'စာရင်း အချက်အလက်များ (Table Data)',
              colorTheme: 'blue',
              items: [],
            };
          }
          currentSection.items.push({
            text: parts[0],
            subtext: parts.slice(1).join(' | '),
            isCheck: false,
          });
          continue;
        }
      }

      // 3. Bullet line detection
      const isBullet =
        line.startsWith('✔') ||
        line.startsWith('•') ||
        line.startsWith('- ') ||
        line.startsWith('— ') ||
        /^\d+[.)]/.test(line);

      // 4. Section Title detection (clean short headers or known keywords)
      const isSectionHeadingCandidate =
        !isBullet &&
        (line.length < 60 ||
          line.includes('Standard') ||
          line.includes('နည်းလမ်း') ||
          line.includes('ပြဿနာ') ||
          line.includes('ရွေးချယ်စရာ') ||
          line.includes('Solution') ||
          line.includes('အကြောင်းအရာ') ||
          line.includes('အချက်အလက်') ||
          line.includes('အဆင့်') ||
          line.includes('ညွှန်ကြားချက်'));

      if (isSectionHeadingCandidate) {
        // If current section exists, commit it
        if (currentSection && (currentSection.items.length > 0 || currentSection.content || currentSection.title)) {
          sections.push(currentSection);
        }
        const { type, colorTheme } = determineTheme(line);
        currentSection = {
          type,
          title: line,
          colorTheme,
          items: [],
        };
        continue;
      }

      // 5. Normal line / Item line / Paragraph line
      let cleanText = line.replace(/^[✔•\-\*—]\s*/, '').replace(/^\d+[.)]\s*/, '').trim();
      let subtext = '';

      if (cleanText.includes('–')) {
        const parts = cleanText.split('–');
        cleanText = parts[0].trim();
        subtext = parts.slice(1).join('–').trim();
      } else if (cleanText.includes(' : ')) {
        const parts = cleanText.split(' : ');
        cleanText = parts[0].trim();
        subtext = parts.slice(1).join(' : ').trim();
      } else if (cleanText.includes(': ') && !cleanText.startsWith('http')) {
        const parts = cleanText.split(': ');
        cleanText = parts[0].trim();
        subtext = parts.slice(1).join(': ').trim();
      }

      // Check if next line is a subtext
      if (i + 1 < lines.length && (lines[i + 1].startsWith('- ') || lines[i + 1].startsWith('  '))) {
        subtext = (subtext ? subtext + ' ' : '') + lines[i + 1].replace(/^[-\s]+/, '').trim();
        i++;
      }

      if (!currentSection) {
        currentSection = {
          type: 'standard_box',
          title: 'အဓိက အချက်အလက်များ (Key Information)',
          colorTheme: 'blue',
          items: [],
        };
      }

      currentSection.items.push({
        text: cleanText,
        subtext,
        isCheck: line.startsWith('✔') || isBullet,
      });
    }

    if (currentSection && (currentSection.items.length > 0 || currentSection.content || currentSection.title)) {
      sections.push(currentSection);
    }

    return { title, subtitle, sections };
  }

  /**
   * AI-Powered Auto-Frame, Auto-Alignment, and Line/Column Beautifier
   * Restructures text and tables with perfect Myanmar Unicode and responsive layout cards.
   */
  static async autoFormatAndAlignLayout(
    text: string,
    table?: string[][]
  ): Promise<{
    title: string;
    subtitle?: string;
    formattedText: string;
    sections: any[];
    table?: string[][];
  }> {
    const apiKey = this.getStoredApiKey();

    // 1. Try server-side AI Auto-Format endpoint
    try {
      const res = await fetch('/api/gemini/format-layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, table, apiKey }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.sections && data.sections.length > 0) {
          return {
            title: data.title || 'Formatted Document',
            subtitle: data.subtitle || '',
            formattedText: data.formattedText || text,
            sections: data.sections,
            table: data.table && data.table.length > 0 ? this.normalizeTable(data.table) : table,
          };
        }
      }
    } catch (err) {
      console.warn('AI format layout endpoint error, using intelligent local heuristic:', err);
    }

    // 2. Intelligent local layout parsing fallback
    const parsed = this.parseTextToSections(text, table);
    return {
      title: parsed.title,
      subtitle: parsed.subtitle,
      formattedText: text,
      sections: parsed.sections,
      table: table && table.length > 0 ? this.normalizeTable(table) : undefined,
    };
  }
}

export interface SampleDoc {
  id: string;
  name: string;
  category: string;
  description: string;
  imageUrl: string;
  ocrText: string;
  tableData: string[][];
}

export const SAMPLE_DOCUMENTS: SampleDoc[] = [
  {
    id: 'sample-myob-guide',
    name: 'MYOB_ABSS_Accounting_Guide.png',
    category: 'MYOB/ABSS Guide (မြန်မာ)',
    description: 'MYOB/ABSS စနစ်တကျ အသုံးပြုနည်းနှင့် ပြုပြင်ထိန်းသိမ်းခြင်းဆိုင်ရာ လမ်းညွှန်ချက်',
    imageUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="850" viewBox="0 0 600 850" fill="%23ffffff"><rect width="600" height="850" fill="%23F8FAFC"/><rect x="0" y="0" width="600" height="80" fill="%230F172A"/><text x="300" y="38" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="bold" fill="%23ffffff">MYOB/ABSS Accounting Software</text><text x="300" y="62" text-anchor="middle" font-family="sans-serif" font-size="13" fill="%2394A3B8">စနစ်တကျ အသုံးပြုနည်းနှင့် ပြုပြင်ထိန်းသိမ်းခြင်းဆိုင်ရာ လမ်းညွှန်ချက်</text><rect x="30" y="105" width="540" height="195" rx="8" fill="%23ffffff" stroke="%233B82F6" stroke-width="2"/><text x="50" y="135" font-family="sans-serif" font-size="15" font-weight="bold" fill="%231E3A8A">MYOB စနစ်တကျ အသုံးပြုရန် Standard နည်းလမ်းများ</text><text x="50" y="165" font-family="sans-serif" font-size="12" fill="%23059669">✔ ၃ ရက်လျှင် ၁ ကြိမ် Backup ပြုလုပ်ပါ</text><text x="50" y="185" font-family="sans-serif" font-size="11" fill="%23475569">- Data ဆုံးရှုံးမှု မရှိစေရန် ပုံမှန် Backup ဆွဲပေးရန် လိုအပ်ပါသည်။</text><text x="50" y="215" font-family="sans-serif" font-size="12" fill="%23059669">✔ ၁ လလျှင် ၁ ကြိမ် Optimise &amp; Verification ပြုလုပ်ပါ</text><text x="50" y="235" font-family="sans-serif" font-size="11" fill="%23475569">- Software အတွင်း Database Structure ကျန်းမာစေရန် လစဉ် ဆောင်ရွက်ရပါမည်။</text><text x="50" y="265" font-family="sans-serif" font-size="12" fill="%23059669">✔ စနစ်တကျ Exit လုပ်ပြီးမှ Cloud ပိတ်ပါ</text><text x="50" y="285" font-family="sans-serif" font-size="11" fill="%23475569">- Menu Bar &gt; File &gt; Exit မှတစ်ဆင့် ထွက်ပြီးမှသာ Cloud ပိတ်ရပါမည်။</text><rect x="30" y="320" width="540" height="150" rx="8" fill="%23ffffff" stroke="%23EF4444" stroke-width="2"/><text x="50" y="350" font-family="sans-serif" font-size="15" font-weight="bold" fill="%23991B1B">လက်ရှိ ဖြစ်ပေါ်နေသော ပြဿနာ၏ ပင်မအကြောင်းအရင်း</text><text x="50" y="380" font-family="sans-serif" font-size="12" fill="%23059669">✔ Software မှ စနစ်တကျ မထွက်ခြင်း</text><text x="50" y="400" font-family="sans-serif" font-size="11" fill="%23475569">- Exit မှ မထွက်ဘဲ Cloud ကို တိုက်ရိုက်ပိတ်သဖြင့် Database Corrupt ဖြစ်ပေါ်လာခဲ့ပါသည်။</text><text x="50" y="430" font-family="sans-serif" font-size="12" fill="%23059669">✔ Data File စနစ်တကျ ပျက်စီးသွားခြင်း</text><text x="50" y="450" font-family="sans-serif" font-size="11" fill="%23475569">- Corrupt မကြာခဏ ဖြစ်ပွားရာမှ Database File တစ်ခုလုံး ပြင်းထန်စွာ ထိခိုက်သွားခြင်း။</text><rect x="30" y="490" width="540" height="210" rx="8" fill="%23ffffff" stroke="%23E2E8F0" stroke-width="2"/><text x="50" y="520" font-family="sans-serif" font-size="15" font-weight="bold" fill="%231E293B">Database ပြုပြင်ထိန်းသိမ်းခြင်းဆိုင်ရာ ရွေးချယ်စရာများ</text><text x="50" y="550" font-family="sans-serif" font-size="12" fill="%23059669">✔ Malaysia / Singapore တွင် ပြုပြင်ခြင်း</text><text x="50" y="570" font-family="sans-serif" font-size="11" fill="%23475569">- ကုန်ကျစရိတ် သက်သာနိုင်သော်လည်း Data စုံလင်စွာ မပါလာနိုင်ဘဲ ပြန်လည် ပျက်စီးနိုင်ခြေ များပါသည်။</text><text x="50" y="605" font-family="sans-serif" font-size="12" fill="%23059669">✔ Australia (MYOB Creator) တွင် ပြုပြင်ခြင်း</text><text x="50" y="625" font-family="sans-serif" font-size="11" fill="%23475569">- Australia HQ သို့ ပို့ဆောင် ပြုပြင်ခြင်းသည်သာ Data များ စနစ်တကျ ပြန်လည်ရရှိပြီး ၁၀၀% အဆင်ပြေစေပါသည်။</text><rect x="50" y="650" width="500" height="35" rx="4" fill="%23FEF9C3" stroke="%23FDE047"/><text x="60" y="672" font-family="sans-serif" font-size="11" fill="%23854D0E">* Database ပျက်စီးပါက မည်သည့် Provider မှ Optimise လုပ်ပေးရုံမှလွဲ၍ အခြားမပြင်နိုင်ပါ။</text><text x="50" y="735" font-family="sans-serif" font-size="14" font-weight="bold" fill="%230F172A">ရေရှည် ကာကွယ်ပေးနိုင်မည့် RDPNight Solution</text></svg>',
    ocrText: `MYOB/ABSS Accounting Software
စနစ်တကျ အသုံးပြုနည်းနှင့် ပြုပြင်ထိန်းသိမ်းခြင်းဆိုင်ရာ လမ်းညွှန်ချက်

MYOB စနစ်တကျ အသုံးပြုရန် Standard နည်းလမ်းများ
✔ ၃ ရက်လျှင် ၁ ကြိမ် Backup ပြုလုပ်ပါ – Data ဆုံးရှုံးမှု မရှိစေရန် ပုံမှန် Backup ဆွဲပေးရန် လိုအပ်ပါသည်။
✔ ၁ လလျှင် ၁ ကြိမ် Optimise & Verification ပြုလုပ်ပါ – Software အတွင်း Database Structure ကျန်းမာစေရန် လစဉ် ဆောင်ရွက်ရပါမည်။
✔ စနစ်တကျ Exit လုပ်ပြီးမှ Cloud ပိတ်ပါ – Software အသုံးပြုပြီးပါက Menu Bar > File > Exit မှတစ်ဆင့် စနစ်တကျ ထွက်ပြီးမှသာ Cloud Application ကို ပိတ်ရပါမည်။
မှတ်ချက် - Cloud Services အသုံးပြုနေသမျှ ကာလပတ်လုံး Optimise & Verification ကို Provider မှ လုပ်ဆောင်ပေးပါသည်။

လက်ရှိ ဖြစ်ပေါ်နေသော ပြဿနာ၏ ပင်မအကြောင်းအရင်း
✔ Software မှ စနစ်တကျ မထွက်ခြင်း: Exit မှ မထွက်ဘဲ Cloud ကို တိုက်ရိုက်ပိတ်မိသည့်အတွက် MYOB Database Corrupt နေ့တိုင်း ဖြစ်ပေါ်လာခဲ့ပါသည်။
✔ Data File စနစ်တကျ ပျက်စီးသွားခြင်း: Corrupt မကြာခဏ ဖြစ်ပွားရာမှ ကြာလာသည်နှင့်အမျှ Database File တစ်ခုလုံး ပြင်းထန်စွာ ထိခိုက်သွားသည့် အခြေအနေသို့ ရောက်ရှိသွားခြင်းဖြစ်ပါသည်။

Database ပြုပြင်ထိန်းသိမ်းခြင်းဆိုင်ရာ ရွေးချယ်စရာများ
✔ Malaysia / Singapore တွင် ပြုပြင်ခြင်း: ကုန်ကျစရိတ် သက်သာနိုင်သော်လည်း Data များ စုံလင်စွာ မပါလာနိုင်ခြင်းနှင့် စနစ်တကျ ပြုပြင်ခြင်း မဟုတ်သည့်အတွက် ယာယီသာ ခံပြီး ပြန်လည် ပျက်စီးနိုင်ခြေ များပါသည်။
✔ Australia (MYOB Creator) တွင် ပြုပြင်ခြင်း: MYOB ကို စတင်ဖန်တီးခဲ့သည့် Australia HQ သို့ ပို့ဆောင် ပြုပြင်ခြင်းသည်သာ Data များ စနစ်တကျ ပြန်လည်ရရှိပြီး ၁၀၀% အဆင်ပြေစေမည့် နည်းလမ်းဖြစ်ပါသည်။
* ထိုသို့ Database ပျက်စီးသွားပါက မည်သည့် Provider မှ Optimise လုပ်ပေးရုံမှလွဲ၍ အခြားပြင်ဆင်၍ မရနိုင်ပါ။

ရေရှည် ကာကွယ်ပေးနိုင်မည့် RDPNight Solution`,
    tableData: [
      ['ကဏ္ဍ / အပိုင်း (Section)', 'အကြောင်းအရာ (Topic / Point)', 'အသေးစိတ် ရှင်းလင်းချက် (Details / Action)'],
      ['MYOB စနစ်တကျ အသုံးပြုရန် Standard နည်းလမ်းများ', '၃ ရက်လျှင် ၁ ကြိမ် Backup ပြုလုပ်ပါ', 'Data ဆုံးရှုံးမှု မရှိစေရန် ပုံမှန် Backup ဆွဲပေးရန် လိုအပ်ပါသည်။'],
      ['MYOB စနစ်တကျ အသုံးပြုရန် Standard နည်းလမ်းများ', '၁ လလျှင် ၁ ကြိမ် Optimise & Verification ပြုလုပ်ပါ', 'Software အတွင်း Database Structure ကျန်းမာစေရန် လစဉ် ဆောင်ရွက်ရပါမည်။'],
      ['MYOB စနစ်တကျ အသုံးပြုရန် Standard နည်းလမ်းများ', 'စနစ်တကျ Exit လုပ်ပြီးမှ Cloud ပိတ်ပါ', 'Software အသုံးပြုပြီးပါက Menu Bar > File > Exit မှတစ်ဆင့် စနစ်တကျ ထွက်ပြီးမှသာ Cloud Application ကို ပိတ်ရပါမည်။'],
      ['Standard နည်းလမ်းများ - မှတ်ချက်', 'Cloud Services Provider တာဝန်', 'Cloud Services အသုံးပြုနေသမျှ ကာလပတ်လုံး Optimise & Verification ကို Provider မှ လုပ်ဆောင်ပေးပါသည်။'],
      ['လက်ရှိ ဖြစ်ပေါ်နေသော ပြဿနာ၏ ပင်မအကြောင်းအရင်း', 'Software မှ စနစ်တကျ မထွက်ခြင်း', 'Exit မှ မထွက်ဘဲ Cloud ကို တိုက်ရိုက်ပိတ်မိသည့်အတွက် MYOB Database Corrupt နေ့တိုင်း ဖြစ်ပေါ်လာခဲ့ပါသည်။'],
      ['လက်ရှိ ဖြစ်ပေါ်နေသော ပြဿနာ၏ ပင်မအကြောင်းအရင်း', 'Data File စနစ်တကျ ပျက်စီးသွားခြင်း', 'Corrupt မကြာခဏ ဖြစ်ပွားရာမှ ကြာလာသည်နှင့်အမျှ Database File တစ်ခုလုံး ပြင်းထန်စွာ ထိခိုက်သွားသည့် အခြေအနေသို့ ရောက်ရှိသွားခြင်းဖြစ်ပါသည်။'],
      ['Database ပြုပြင်ထိန်းသိမ်းခြင်းဆိုင်ရာ ရွေးချယ်စရာများ', 'Malaysia / Singapore တွင် ပြုပြင်ခြင်း', 'ကုန်ကျစရိတ် သက်သာနိုင်သော်လည်း Data များ စုံလင်စွာ မပါလာနိုင်ခြင်းနှင့် စနစ်တကျ ပြုပြင်ခြင်း မဟုတ်သည့်အတွက် ယာယီသာ ခံပြီး ပြန်လည် ပျက်စီးနိုင်ခြေ များပါသည်။'],
      ['Database ပြုပြင်ထိန်းသိမ်းခြင်းဆိုင်ရာ ရွေးချယ်စရာများ', 'Australia (MYOB Creator) တွင် ပြုပြင်ခြင်း', 'MYOB ကို စတင်ဖန်တီးခဲ့သည့် Australia HQ သို့ ပို့ဆောင် ပြုပြင်ခြင်းသည်သာ Data များ စနစ်တကျ ပြန်လည်ရရှိပြီး ၁၀၀% အဆင်ပြေစေမည့် နည်းလမ်းဖြစ်ပါသည်။'],
      ['Database ပြုပြင်ထိန်းသိမ်းခြင်းဆိုင်ရာ ရွေးချယ်စရာများ', 'Provider ကန့်သတ်ချက် သတိပေးချက်', 'ထိုသို့ Database ပျက်စီးသွားပါက မည်သည့် Provider မှ Optimise လုပ်ပေးရုံမှလွဲ၍ အခြားပြင်ဆင်၍ မရနိုင်ပါ။'],
      ['ရေရှည် ကာကွယ်ရေး', 'RDPNight Solution', 'ရေရှည် ကာကွယ်ပေးနိုင်မည့် RDPNight Solution']
    ]
  },
  {
    id: 'sample-invoice',
    name: 'TechSupply_Invoice_#4829.png',
    category: 'Commercial Invoice',
    description: 'B2B equipment purchase with line items, tax, and subtotals',
    imageUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800" fill="%23ffffff"><rect width="600" height="800" fill="%23FAFAFA"/><rect x="40" y="40" width="520" height="720" rx="8" fill="%23ffffff" stroke="%23E2E8F0" stroke-width="2"/><text x="70" y="90" font-family="sans-serif" font-size="22" font-weight="bold" fill="%230F62FE">NEXTUNIT LOGISTICS &amp; TECH</text><text x="70" y="115" font-family="sans-serif" font-size="12" fill="%2364748B">INVOICE: #INV-2026-4829 | DATE: 2026-08-31</text><line x1="70" y1="135" x2="530" y2="135" stroke="%23E2E8F0" stroke-width="1.5"/><text x="70" y="165" font-family="sans-serif" font-size="14" font-weight="bold" fill="%231E293B">BILL TO: Apex Systems Inc.</text><text x="70" y="185" font-family="sans-serif" font-size="12" fill="%23475569">450 Market Street, San Francisco, CA</text><rect x="70" y="210" width="460" height="30" fill="%230F62FE" rx="4"/><text x="85" y="230" font-family="sans-serif" font-size="12" font-weight="bold" fill="%23ffffff">Item Description</text><text x="260" y="230" font-family="sans-serif" font-size="12" font-weight="bold" fill="%23ffffff">Qty</text><text x="340" y="230" font-family="sans-serif" font-size="12" font-weight="bold" fill="%23ffffff">Unit Price</text><text x="460" y="230" font-family="sans-serif" font-size="12" font-weight="bold" fill="%23ffffff">Total</text><text x="85" y="270" font-family="sans-serif" font-size="12" fill="%231E293B">Industrial Document Scanner 4K</text><text x="270" y="270" font-family="sans-serif" font-size="12" fill="%231E293B">2</text><text x="350" y="270" font-family="sans-serif" font-size="12" fill="%231E293B">$450.00</text><text x="465" y="270" font-family="sans-serif" font-size="12" fill="%231E293B">$900.00</text><line x1="70" y1="290" x2="530" y2="290" stroke="%23F1F5F9"/><text x="85" y="320" font-family="sans-serif" font-size="12" fill="%231E293B">Cloud OCR API License (1 Year)</text><text x="270" y="320" font-family="sans-serif" font-size="12" fill="%231E293B">5</text><text x="350" y="320" font-family="sans-serif" font-size="12" fill="%231E293B">$120.00</text><text x="465" y="320" font-family="sans-serif" font-size="12" fill="%231E293B">$600.00</text><line x1="70" y1="340" x2="530" y2="340" stroke="%23F1F5F9"/><text x="85" y="370" font-family="sans-serif" font-size="12" fill="%231E293B">High-Speed Thermal Receipt Unit</text><text x="270" y="370" font-family="sans-serif" font-size="12" fill="%231E293B">1</text><text x="350" y="370" font-family="sans-serif" font-size="12" fill="%231E293B">$280.00</text><text x="465" y="370" font-family="sans-serif" font-size="12" fill="%231E293B">$280.00</text><line x1="70" y1="400" x2="530" y2="400" stroke="%23CBD5E1" stroke-width="2"/><text x="340" y="440" font-family="sans-serif" font-size="13" font-weight="bold" fill="%231E293B">SUBTOTAL:</text><text x="465" y="440" font-family="sans-serif" font-size="13" font-weight="bold" fill="%231E293B">$1,780.00</text><text x="340" y="470" font-family="sans-serif" font-size="13" fill="%23475569">TAX (8.5%):</text><text x="465" y="470" font-family="sans-serif" font-size="13" fill="%23475569">$151.30</text><text x="340" y="510" font-family="sans-serif" font-size="15" font-weight="bold" fill="%230F62FE">GRAND TOTAL:</text><text x="465" y="510" font-family="sans-serif" font-size="15" font-weight="bold" fill="%230F62FE">$1,931.30</text><rect x="70" y="580" width="460" height="90" rx="6" fill="%23F8FAFC" stroke="%23E2E8F0"/><text x="90" y="615" font-family="sans-serif" font-size="12" font-weight="bold" fill="%23334155">Payment Terms &amp; Instructions:</text><text x="90" y="638" font-family="sans-serif" font-size="11" fill="%2364748B">Due within 30 days via Direct Wire / ACH transfer.</text><text x="90" y="655" font-family="sans-serif" font-size="11" fill="%2364748B">Routing: 121000358 | Account: 8829-4410-09</text></svg>',
    ocrText: `NEXTUNIT LOGISTICS & TECH
INVOICE: #INV-2026-4829 | DATE: 2026-08-31
BILL TO: Apex Systems Inc.
450 Market Street, San Francisco, CA

Item Description | Qty | Unit Price | Total
Industrial Document Scanner 4K | 2 | $450.00 | $900.00
Cloud OCR API License (1 Year) | 5 | $120.00 | $600.00
High-Speed Thermal Receipt Unit | 1 | $280.00 | $280.00
SUBTOTAL | | | $1,780.00
TAX (8.5%) | | | $151.30
GRAND TOTAL | | | $1,931.30

Payment Terms & Instructions:
Due within 30 days via Direct Wire / ACH transfer.
Routing: 121000358 | Account: 8829-4410-09`,
    tableData: [
      ['Item Description', 'Qty', 'Unit Price', 'Total'],
      ['Industrial Document Scanner 4K', '2', '$450.00', '$900.00'],
      ['Cloud OCR API License (1 Year)', '5', '$120.00', '$600.00'],
      ['High-Speed Thermal Receipt Unit', '1', '$280.00', '$280.00'],
      ['SUBTOTAL', '', '', '$1,780.00'],
      ['TAX (8.5%)', '', '', '$151.30'],
      ['GRAND TOTAL', '', '', '$1,931.30']
    ]
  },
  {
    id: 'sample-receipt',
    name: 'Bistro_Cafe_Receipt_Aug31.png',
    category: 'Store Receipt',
    description: 'Dining and meeting expense with line items and tip',
    imageUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="500" height="700" viewBox="0 0 500 700" fill="%23ffffff"><rect width="500" height="700" fill="%23F8FAFC"/><rect x="40" y="30" width="420" height="640" rx="4" fill="%23ffffff" stroke="%23CBD5E1" stroke-dasharray="4 4"/><text x="250" y="80" text-anchor="middle" font-family="monospace" font-size="20" font-weight="bold" fill="%230F172A">METROPOLIS BISTRO &amp; CAFE</text><text x="250" y="105" text-anchor="middle" font-family="monospace" font-size="12" fill="%2364748B">742 Evergreen Terrace</text><text x="250" y="125" text-anchor="middle" font-family="monospace" font-size="12" fill="%2364748B">Tel: (555) 019-2834</text><line x1="60" y1="145" x2="440" y2="145" stroke="%23E2E8F0" stroke-width="1.5"/><text x="70" y="175" font-family="monospace" font-size="13" fill="%231E293B">Server: Michael T.</text><text x="350" y="175" font-family="monospace" font-size="13" fill="%231E293B">Table: 14</text><text x="70" y="195" font-family="monospace" font-size="12" fill="%2364748B">Date: 2026-08-31 13:42</text><line x1="60" y1="215" x2="440" y2="215" stroke="%23E2E8F0" stroke-width="1.5"/><text x="70" y="245" font-family="monospace" font-size="13" font-weight="bold" fill="%231E293B">Item</text><text x="260" y="245" font-family="monospace" font-size="13" font-weight="bold" fill="%231E293B">Qty</text><text x="390" y="245" font-family="monospace" font-size="13" font-weight="bold" fill="%231E293B">Price</text><text x="70" y="280" font-family="monospace" font-size="13" fill="%23334155">Cold Brew Latte</text><text x="270" y="280" font-family="monospace" font-size="13" fill="%23334155">2</text><text x="390" y="280" font-family="monospace" font-size="13" fill="%23334155">$11.00</text><text x="70" y="315" font-family="monospace" font-size="13" fill="%23334155">Avocado Toast Supreme</text><text x="270" y="315" font-family="monospace" font-size="13" fill="%23334155">2</text><text x="390" y="315" font-family="monospace" font-size="13" fill="%23334155">$28.00</text><text x="70" y="350" font-family="monospace" font-size="13" fill="%23334155">Artisan Pastry Box</text><text x="270" y="350" font-family="monospace" font-size="13" fill="%23334155">1</text><text x="390" y="350" font-family="monospace" font-size="13" fill="%23334155">$14.50</text><line x1="60" y1="380" x2="440" y2="380" stroke="%23E2E8F0" stroke-width="1.5"/><text x="220" y="415" font-family="monospace" font-size="13" fill="%2364748B">SUBTOTAL:</text><text x="390" y="415" font-family="monospace" font-size="13" fill="%231E293B">$53.50</text><text x="220" y="445" font-family="monospace" font-size="13" fill="%2364748B">SALES TAX (8.25%):</text><text x="390" y="445" font-family="monospace" font-size="13" fill="%231E293B">$4.41</text><text x="220" y="475" font-family="monospace" font-size="13" fill="%2364748B">GRATUITY (18%):</text><text x="390" y="475" font-family="monospace" font-size="13" fill="%231E293B">$9.63</text><line x1="200" y1="495" x2="440" y2="495" stroke="%230F172A" stroke-width="2"/><text x="220" y="525" font-family="monospace" font-size="15" font-weight="bold" fill="%230F172A">TOTAL PAID:</text><text x="380" y="525" font-family="monospace" font-size="15" font-weight="bold" fill="%230F172A">$67.54</text><text x="250" y="590" text-anchor="middle" font-family="monospace" font-size="12" fill="%2364748B">Auth: 994812 • VISA **** 4921</text><text x="250" y="615" text-anchor="middle" font-family="monospace" font-size="12" font-weight="bold" fill="%23107C41">THANK YOU FOR YOUR VISIT!</text></svg>',
    ocrText: `METROPOLIS BISTRO & CAFE
742 Evergreen Terrace
Tel: (555) 019-2834
Server: Michael T. | Table: 14
Date: 2026-08-31 13:42

Item | Qty | Price
Cold Brew Latte | 2 | $11.00
Avocado Toast Supreme | 2 | $28.00
Artisan Pastry Box | 1 | $14.50
SUBTOTAL | | $53.50
SALES TAX (8.25%) | | $4.41
GRATUITY (18%) | | $9.63
TOTAL PAID | | $67.54

Auth: 994812 • VISA **** 4921
THANK YOU FOR YOUR VISIT!`,
    tableData: [
      ['Item', 'Qty', 'Price'],
      ['Cold Brew Latte', '2', '$11.00'],
      ['Avocado Toast Supreme', '2', '$28.00'],
      ['Artisan Pastry Box', '1', '$14.50'],
      ['SUBTOTAL', '', '$53.50'],
      ['SALES TAX (8.25%)', '', '$4.41'],
      ['GRATUITY (18%)', '', '$9.63'],
      ['TOTAL PAID', '', '$67.54']
    ]
  },
  {
    id: 'sample-inventory',
    name: 'Warehouse_Inventory_Audit.png',
    category: 'Inventory Audit',
    description: 'Stock tracking and unit count sheet',
    imageUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750" viewBox="0 0 600 750" fill="%23ffffff"><rect width="600" height="750" fill="%23FFFFFF"/><rect x="30" y="30" width="540" height="690" rx="6" fill="%23ffffff" stroke="%23CBD5E1"/><rect x="30" y="30" width="540" height="60" fill="%23107C41" rx="6"/><text x="50" y="68" font-family="sans-serif" font-size="18" font-weight="bold" fill="%23ffffff">WAREHOUSE STOCK AUDIT - SECTION B</text><rect x="50" y="110" width="500" height="28" fill="%23E2E8F0"/><text x="60" y="129" font-family="sans-serif" font-size="12" font-weight="bold" fill="%231E293B">SKU Code</text><text x="180" y="129" font-family="sans-serif" font-size="12" font-weight="bold" fill="%231E293B">Product Name</text><text x="350" y="129" font-family="sans-serif" font-size="12" font-weight="bold" fill="%231E293B">Location</text><text x="460" y="129" font-family="sans-serif" font-size="12" font-weight="bold" fill="%231E293B">In Stock</text><text x="60" y="165" font-family="sans-serif" font-size="12" fill="%23334155">SKU-9901</text><text x="180" y="165" font-family="sans-serif" font-size="12" fill="%23334155">Wireless Laser Scanner</text><text x="350" y="165" font-family="sans-serif" font-size="12" fill="%23334155">Aisle 4-B</text><text x="470" y="165" font-family="sans-serif" font-size="12" font-weight="bold" fill="%23107C41">142</text><line x1="50" y1="185" x2="550" y2="185" stroke="%23E2E8F0"/><text x="60" y="215" font-family="sans-serif" font-size="12" fill="%23334155">SKU-9902</text><text x="180" y="215" font-family="sans-serif" font-size="12" fill="%23334155">Thermal Label Rolls 4x6</text><text x="350" y="215" font-family="sans-serif" font-size="12" fill="%23334155">Aisle 1-A</text><text x="470" y="215" font-family="sans-serif" font-size="12" font-weight="bold" fill="%23107C41">580</text><line x1="50" y1="235" x2="550" y2="235" stroke="%23E2E8F0"/><text x="60" y="265" font-family="sans-serif" font-size="12" fill="%23334155">SKU-9903</text><text x="180" y="265" font-family="sans-serif" font-size="12" fill="%23334155">Barcode Mobile Terminal</text><text x="350" y="265" font-family="sans-serif" font-size="12" fill="%23334155">Aisle 4-C</text><text x="470" y="265" font-family="sans-serif" font-size="12" font-weight="bold" fill="%23107C41">36</text><line x1="50" y1="285" x2="550" y2="285" stroke="%23E2E8F0"/><text x="60" y="315" font-family="sans-serif" font-size="12" fill="%23334155">SKU-9904</text><text x="180" y="315" font-family="sans-serif" font-size="12" fill="%23334155">Heavy Duty Storage Bin</text><text x="350" y="315" font-family="sans-serif" font-size="12" fill="%23334155">Rack 12</text><text x="470" y="315" font-family="sans-serif" font-size="12" font-weight="bold" fill="%23107C41">210</text><line x1="50" y1="335" x2="550" y2="335" stroke="%23E2E8F0"/><text x="60" y="365" font-family="sans-serif" font-size="12" fill="%23334155">SKU-9905</text><text x="180" y="365" font-family="sans-serif" font-size="12" fill="%23334155">Handheld POS Stand</text><text x="350" y="365" font-family="sans-serif" font-size="12" fill="%23334155">Aisle 2-D</text><text x="470" y="365" font-family="sans-serif" font-size="12" font-weight="bold" fill="%23107C41">85</text></svg>',
    ocrText: `WAREHOUSE STOCK AUDIT - SECTION B

SKU Code | Product Name | Location | In Stock
SKU-9901 | Wireless Laser Scanner | Aisle 4-B | 142
SKU-9902 | Thermal Label Rolls 4x6 | Aisle 1-A | 580
SKU-9903 | Barcode Mobile Terminal | Aisle 4-C | 36
SKU-9904 | Heavy Duty Storage Bin | Rack 12 | 210
SKU-9905 | Handheld POS Stand | Aisle 2-D | 85`,
    tableData: [
      ['SKU Code', 'Product Name', 'Location', 'In Stock'],
      ['SKU-9901', 'Wireless Laser Scanner', 'Aisle 4-B', '142'],
      ['SKU-9902', 'Thermal Label Rolls 4x6', 'Aisle 1-A', '580'],
      ['SKU-9903', 'Barcode Mobile Terminal', 'Aisle 4-C', '36'],
      ['SKU-9904', 'Heavy Duty Storage Bin', 'Rack 12', '210'],
      ['SKU-9905', 'Handheld POS Stand', 'Aisle 2-D', '85']
    ]
  }
];
