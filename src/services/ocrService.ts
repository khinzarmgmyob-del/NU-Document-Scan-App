import { createWorker } from 'tesseract.js';

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
 * Spatial Clustering for Web OCR using Word Bounding Boxes (X/Y coordinates)
 */
export function extractSpatialTableFromWords(words: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }>): string[][] {
  if (!words || words.length === 0) return [];

  // 1. Calculate median word height
  const heights = words.map(w => w.bbox.y1 - w.bbox.y0).sort((a, b) => a - b);
  const medianH = heights[Math.floor(heights.length / 2)] || 16;
  const yTolerance = Math.max(6, Math.min(18, medianH * 0.55));

  // 2. Group into Horizontal Rows (Y-Clustering)
  const rows: Array<Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number }; centerX: number; centerY: number }>> = [];
  
  const sortedWords = [...words].map(w => ({
    ...w,
    centerX: (w.bbox.x0 + w.bbox.x1) / 2,
    centerY: (w.bbox.y0 + w.bbox.y1) / 2,
  })).sort((a, b) => a.centerY - b.centerY || a.bbox.x0 - b.bbox.x0);

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
  rows.forEach(r => r.sort((a, b) => a.bbox.x0 - b.bbox.x0));

  // 3. Vertical Column Clustering (X-Axis intervals)
  const columnRanges: Array<{ left: number; right: number; centerX: number }> = [];

  for (const r of rows) {
    for (const word of r) {
      const left = word.bbox.x0;
      const right = word.bbox.x1;
      let merged = false;
      for (const col of columnRanges) {
        if ((left - 12) < (col.right + 12) && (right + 12) > (col.left - 12)) {
          col.left = Math.min(col.left, left);
          col.right = Math.max(col.right, right);
          col.centerX = (col.left + col.right) / 2;
          merged = true;
          break;
        }
      }
      if (!merged) {
        columnRanges.push({ left, right, centerX: (left + right) / 2 });
      }
    }
  }

  columnRanges.sort((a, b) => a.left - b.left);
  if (columnRanges.length === 0) return [];

  // 4. Map each row into detected column intervals
  const table: string[][] = [];
  for (const r of rows) {
    const rowCells = new Array(columnRanges.length).fill('');
    for (const word of r) {
      let bestColIdx = 0;
      let minDist = Infinity;
      for (let c = 0; c < columnRanges.length; c++) {
        const dist = Math.abs(word.centerX - columnRanges[c].centerX);
        if (dist < minDist) {
          minDist = dist;
          bestColIdx = c;
        }
      }
      rowCells[bestColIdx] = rowCells[bestColIdx] ? `${rowCells[bestColIdx]} ${word.text}` : word.text;
    }
    if (rowCells.some(c => c.trim().length > 0)) {
      table.push(rowCells);
    }
  }

  return table.length > 0 ? table : [];
}

export class OcrService {
  /**
   * Recognizes text and extracts structured 2D table using 2D Spatial Bounding Box Clustering
   */
  static async recognizeImageWithSpatialClustering(
    imageSource: string | File | Blob,
    onProgress?: (progress: number, status: string) => void
  ): Promise<{ text: string; table: string[][] }> {
    try {
      if (onProgress) onProgress(0.1, 'Initializing Spatial OCR Engine...');
      const worker = await getOcrWorker(onProgress);
      if (onProgress) onProgress(0.3, 'Running Optical Recognition...');
      
      const result = await worker.recognize(imageSource);
      if (onProgress) onProgress(0.85, 'Clustering spatial column coordinates...');
      
      const text = result.data.text.trim();
      let table: string[][] = [];

      // Extract using 2D Spatial Bounding Box Clustering Algorithm
      if (result.data.words && result.data.words.length > 0) {
        const words = result.data.words.map(w => ({
          text: w.text.trim(),
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
