import { OcrService } from './ocrService';
import { SpreadsheetService } from './spreadsheetService';

export interface AiGridMerge {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface AiGridPalette {
  headerBgColor?: string;
  headerTextColor?: string;
  sectionBgColor?: string;
  sectionTextColor?: string;
  noteBgColor?: string;
  noteTextColor?: string;
  tableBorderColor?: string;
  tableBorderStyle?: string;
  zebraBgColor?: string;
  hasTableBorders?: boolean;
}

export interface AiGridRangeStyle {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
  bgColor?: string;
  textColor?: string;
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  borderStyle?: string;
  borderColor?: string;
}

export interface AiGridData {
  success: boolean;
  documentTitle?: string;
  sheetTitle?: string;
  grid: string[][];
  merges: AiGridMerge[];
  columnWidths: number[];
  palette?: AiGridPalette;
  rangeStyles?: AiGridRangeStyle[];
  rawDataTable?: string[][];
  isAiCalculated: boolean;
  modelUsed?: string;
}

export class DocumentGridService {
  /**
   * Cleans hex colors and ensures valid 6-character hex format
   */
  static cleanHex(color?: string, fallback = '000000'): string {
    if (!color) return fallback;
    const cleaned = color.replace(/^#/, '').trim().toUpperCase();
    return /^[0-9A-F]{6}$/i.test(cleaned) ? cleaned : fallback;
  }

  /**
   * Fetches AI Grid calculation from Gemini AI backend, with automatic fallback
   * to high-precision local calculation if server call is unavailable.
   */
  static async fetchAiGridData({
    imageBase64,
    ocrText,
    tableData,
    title,
  }: {
    imageBase64?: string;
    ocrText?: string;
    tableData?: string[][];
    title?: string;
  }): Promise<AiGridData> {
    const cleanTitle = (title || 'Scanned_Document').replace(/[/\\?%*:|"<>]/g, '_');

    // 1. Attempt Gemini AI Smart Cell & Grid Calculation Engine API
    try {
      if (imageBase64 || (ocrText && ocrText.trim().length > 0)) {
        const res = await fetch('/api/gemini/excel-grid-engine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64,
            ocrText,
            tableData,
            title: cleanTitle,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.grid && Array.isArray(data.grid) && data.grid.length > 0) {
            return {
              success: true,
              documentTitle: data.documentTitle || cleanTitle,
              sheetTitle: data.sheetTitle,
              grid: data.grid,
              merges: Array.isArray(data.merges) ? data.merges : [],
              columnWidths: Array.isArray(data.columnWidths) ? data.columnWidths : [10, 32, 55, 22, 18],
              palette: data.palette || {
                headerBgColor: '0F766E',
                headerTextColor: 'FFFFFF',
                sectionBgColor: 'ECFDF5',
                sectionTextColor: '065F46',
                noteBgColor: 'FEF3C7',
                noteTextColor: '92400E',
                tableBorderColor: 'CBD5E1',
                tableBorderStyle: 'thin',
                zebraBgColor: 'F8FAFC',
                hasTableBorders: true,
              },
              rangeStyles: Array.isArray(data.rangeStyles) ? data.rangeStyles : [],
              rawDataTable: (data.rawDataTable && data.rawDataTable.length > 0) ? data.rawDataTable : tableData,
              isAiCalculated: true,
              modelUsed: data.modelUsed,
            };
          }
        }
      }
    } catch (err) {
      console.warn('Backend AI Grid calculation call failed, falling back to local engine:', err);
    }

    // 2. High-Precision Local Fallback Grid Engine
    const parsedDoc = ocrText && ocrText.trim().length > 0
      ? OcrService.parseTextToSections(ocrText, tableData)
      : null;

    const localResult = SpreadsheetService.generateLocalAiCalculatedGrid({
      docTitle: cleanTitle,
      parsedDoc,
      tableData,
      ocrText,
    });

    return {
      success: true,
      documentTitle: cleanTitle,
      grid: localResult.grid,
      merges: localResult.merges,
      columnWidths: localResult.columnWidths,
      palette: {
        headerBgColor: '0F766E',
        headerTextColor: 'FFFFFF',
        sectionBgColor: 'ECFDF5',
        sectionTextColor: '065F46',
        noteBgColor: 'FEF3C7',
        noteTextColor: '92400E',
        tableBorderColor: 'CBD5E1',
        tableBorderStyle: 'thin',
        zebraBgColor: 'F8FAFC',
        hasTableBorders: true,
      },
      rangeStyles: [],
      rawDataTable: tableData,
      isAiCalculated: false,
    };
  }

  /**
   * Transforms the calculated AI Grid, Palette, Merges, and Range Styles into
   * pixel-perfect, standards-compliant HTML for PDF rendering and Word (.docx) export.
   */
  static buildHtmlFromAiGrid(
    data: AiGridData,
    options?: {
      isWord?: boolean;
      containerPadding?: string;
    }
  ): string {
    const { grid, merges = [], columnWidths = [], palette = {}, rangeStyles = [], rawDataTable } = data;
    const documentTitle = data.documentTitle || 'Scanned Document';

    const headerBg = this.cleanHex(palette.headerBgColor, '0F766E');
    const headerText = this.cleanHex(palette.headerTextColor, 'FFFFFF');
    const sectionBg = this.cleanHex(palette.sectionBgColor, 'ECFDF5');
    const sectionText = this.cleanHex(palette.sectionTextColor, '065F46');
    const noteBg = this.cleanHex(palette.noteBgColor, 'FEF3C7');
    const noteText = this.cleanHex(palette.noteTextColor, '92400E');
    const tableBorder = this.cleanHex(palette.tableBorderColor, 'CBD5E1');
    const zebraBg = palette.zebraBgColor ? this.cleanHex(palette.zebraBgColor, 'F8FAFC') : null;
    const borderStyle = palette.tableBorderStyle || 'thin';
    const borderCss = `${borderStyle === 'medium' ? '1.5px' : '1px'} solid #${tableBorder}`;

    const totalColWidth = columnWidths.reduce((sum, w) => sum + (Number(w) || 20), 0) || 100;
    const colPercentages = columnWidths.map(w => `${Math.max(8, Math.round(((Number(w) || 20) / totalColWidth) * 100))}%`);

    const numCols = Math.max(
      columnWidths.length,
      grid.reduce((max, r) => Math.max(max, r.length), 0),
      5
    );

    // Matrix to track covered cells from merges
    const covered = Array.from({ length: grid.length }, () => Array(numCols).fill(false));
    const mergeStarts = new Map<string, AiGridMerge>();

    for (const m of merges) {
      const sR = Math.max(0, m.startRow);
      const eR = Math.min(grid.length - 1, m.endRow);
      const sC = Math.max(0, m.startCol);
      const eC = Math.min(numCols - 1, m.endCol);

      mergeStarts.set(`${sR},${sC}`, { startRow: sR, startCol: sC, endRow: eR, endCol: eC });
      for (let r = sR; r <= eR; r++) {
        for (let c = sC; c <= eC; c++) {
          if (r !== sR || c !== sC) {
            if (covered[r]) covered[r][c] = true;
          }
        }
      }
    }

    // Build Table Rows HTML
    const rowsHtml: string[] = [];

    for (let r = 0; r < grid.length; r++) {
      const row = grid[r] || [];
      const firstVal = String(row[0] || '').trim();
      const isSpacingRow = row.every(c => !String(c || '').trim());

      // Spacing Row between major sections
      if (isSpacingRow) {
        rowsHtml.push(`
          <tr style="height: 12px;">
            <td colspan="${numCols}" style="height: 12px; border: none; padding: 0; background: transparent;">&nbsp;</td>
          </tr>
        `);
        continue;
      }

      const cellsHtml: string[] = [];

      for (let c = 0; c < numCols; c++) {
        // Skip cell if covered by a previous merge
        if (covered[r] && covered[r][c]) {
          continue;
        }

        const merge = mergeStarts.get(`${r},${c}`);
        const rowspan = merge ? merge.endRow - merge.startRow + 1 : 1;
        const colspan = merge ? merge.endCol - merge.startCol + 1 : 1;
        const val = String(row[c] || '').trim();

        // Check range style overrides
        const rStyle = rangeStyles.find(
          rs => r >= rs.startRow && r <= rs.endRow && c >= rs.startCol && c <= rs.endCol
        );

        let cellBg = '#FFFFFF';
        let cellColor = '#1E293B';
        let cellAlign: 'left' | 'center' | 'right' = 'left';
        let cellWeight = 'normal';
        let cellPadding = '8px 10px';
        let cellBorder = borderCss;
        let fontSize = '11px';

        // Row 0: Document Title Banner
        if (r === 0) {
          cellBg = `#${headerBg}`;
          cellColor = `#${headerText}`;
          cellWeight = 'bold';
          cellAlign = 'center';
          cellPadding = '12px 16px';
          fontSize = '14px';
          cellBorder = `1.5px solid #${headerBg}`;
        }
        // Row 1: Subtitle or Verification Metadata
        else if (r === 1 && (colspan >= 3 || firstVal.toLowerCase().includes('report') || firstVal.includes('စစ်ဆေးချက်'))) {
          cellBg = '#F1F5F9';
          cellColor = '#475569';
          cellAlign = 'center';
          cellPadding = '6px 12px';
          fontSize = '10px';
          cellBorder = `1px solid #${tableBorder}`;
        }
        // Section Header Row (e.g. ▶ ၁။ ခေါင်းစဉ်)
        else if (firstVal.startsWith('▶') || (colspan >= 3 && !firstVal.startsWith('[NOTE]'))) {
          cellBg = `#${sectionBg}`;
          cellColor = `#${sectionText}`;
          cellWeight = 'bold';
          cellAlign = 'left';
          cellPadding = '8px 12px';
          fontSize = '12px';
          cellBorder = `1px solid #${sectionText}`;
        }
        // Notes / Warnings Banner (e.g. [NOTE] သတိပေးချက်)
        else if (firstVal.startsWith('[NOTE]') || firstVal.startsWith('မှတ်ချက်') || firstVal.startsWith('သတိပေးချက်')) {
          cellBg = `#${noteBg}`;
          cellColor = `#${noteText}`;
          cellWeight = '500';
          cellAlign = 'left';
          cellPadding = '9px 12px';
          fontSize = '11px';
          cellBorder = `1px solid #FDE68A`;
        }
        // Column Headers (No, Topic, Details, Category, Notes)
        else if (
          row.some(x => /စဉ်|No|ခေါင်းစဉ်|Topic|အကြောင်းအရာ|နှုန်း|သင့်ငွေ|Description|Qty|Amount|Price/i.test(String(x || ''))) &&
          c < 6
        ) {
          cellBg = `#${headerBg}`;
          cellColor = `#${headerText}`;
          cellWeight = 'bold';
          cellAlign = 'center';
          cellPadding = '8px 10px';
          fontSize = '11px';
          cellBorder = `1px solid #${headerBg}`;
        }
        // Standard Content Cells
        else {
          const isNum = /^[0-9,.]+(%|MMK|Ks|\$)?$/.test(val) || /^[၀-၉]+$/.test(val);
          const isCheckmark = val.startsWith('✔') || val === '✓';
          const isBullet = val.startsWith('•') || val.startsWith('-');

          if (c === 0 || isCheckmark || isBullet) {
            cellAlign = 'center';
          } else if (isNum) {
            cellAlign = 'right';
          }

          if (isCheckmark) {
            cellColor = '#16A34A';
            cellWeight = 'bold';
          } else if (val.startsWith('❌')) {
            cellColor = '#DC2626';
          }

          if (zebraBg && r % 2 === 0) {
            cellBg = `#${zebraBg}`;
          }
        }

        // Apply Range Style Overrides if matched
        if (rStyle) {
          if (rStyle.bgColor) cellBg = `#${this.cleanHex(rStyle.bgColor)}`;
          if (rStyle.textColor) cellColor = `#${this.cleanHex(rStyle.textColor)}`;
          if (rStyle.bold !== undefined) cellWeight = rStyle.bold ? 'bold' : 'normal';
          if (rStyle.align) cellAlign = rStyle.align;
          if (rStyle.borderColor || rStyle.borderStyle) {
            const bClr = this.cleanHex(rStyle.borderColor, tableBorder);
            const bSt = rStyle.borderStyle || 'solid';
            cellBorder = `1px ${bSt} #${bClr}`;
          }
        }

        const rowspanAttr = rowspan > 1 ? ` rowspan="${rowspan}"` : '';
        const colspanAttr = colspan > 1 ? ` colspan="${colspan}"` : '';

        // Formatted value display
        let displayVal = val;
        if (val.startsWith('✔')) {
          displayVal = `<span style="color: #16A34A; font-weight: bold; margin-right: 4px;">✔</span>${val.slice(1).trim()}`;
        } else if (val.startsWith('•')) {
          displayVal = `<span style="color: #64748B; font-weight: bold; margin-right: 4px;">•</span>${val.slice(1).trim()}`;
        } else if (val.startsWith('▶')) {
          displayVal = `<span style="color: #${sectionText}; font-weight: bold; margin-right: 4px;">▶</span>${val.slice(1).trim()}`;
        } else if (!val) {
          displayVal = '&nbsp;';
        }

        cellsHtml.push(`
          <td${colspanAttr}${rowspanAttr} style="
            background-color: ${cellBg};
            color: ${cellColor};
            font-weight: ${cellWeight};
            text-align: ${cellAlign};
            padding: ${cellPadding};
            border: ${cellBorder};
            font-size: ${fontSize};
            line-height: 1.5;
            vertical-align: middle;
            word-break: break-word;
          ">
            ${displayVal}
          </td>
        `);
      }

      rowsHtml.push(`<tr>${cellsHtml.join('')}</tr>`);
    }

    const padding = options?.containerPadding || '20px 24px';
    const fontStack = options?.isWord
      ? "'Pyidaungsu', 'Myanmar Text', 'Segoe UI', Arial, sans-serif"
      : '"Pyidaungsu", "Myanmar Text", "Padauk", "Noto Sans Myanmar", "Segoe UI", sans-serif';

    return `
      <div style="font-family: ${fontStack}; color: #0F172A; padding: ${padding}; background-color: #FFFFFF; box-sizing: border-box;">
        <!-- AI Calculated Grid Main Table with Full Borders, Colors & Cell Hierarchy -->
        <table style="width: 100%; border-collapse: collapse; border: ${borderCss}; table-layout: fixed; margin-bottom: 0;">
          <colgroup>
            ${colPercentages.map(pct => `<col style="width: ${pct};" />`).join('')}
          </colgroup>
          <tbody>
            ${rowsHtml.join('')}
          </tbody>
        </table>
      </div>
    `;
  }
}
