import XLSX from 'xlsx-js-style';
import { OcrService } from './ocrService';
import { ExportLayoutMode } from '../types';

export class SpreadsheetService {
  /**
   * Helper to strip hashes and ensure valid 6-character hex for Excel styling
   */
  private static cleanHex(color?: string, fallback = '000000'): string {
    if (!color) return fallback;
    const cleaned = color.replace(/^#/, '').trim().toUpperCase();
    return /^[0-9A-F]{6}$/i.test(cleaned) ? cleaned : fallback;
  }

  /**
   * Applies cell-by-cell borders, background fills, font colors, and alignment
   * replicating the visual presentation of table borders and colors from the original document.
   */
  static applyVisualStylesToWorksheet(
    ws: any,
    grid: string[][],
    merges?: { startRow: number; startCol: number; endRow: number; endCol: number }[],
    palette?: {
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
    },
    rangeStyles?: {
      startRow: number;
      startCol: number;
      endRow: number;
      endCol: number;
      bgColor?: string;
      textColor?: string;
      bold?: boolean;
      align?: string;
      borderStyle?: string;
      borderColor?: string;
    }[]
  ) {
    const headerBg = this.cleanHex(palette?.headerBgColor, '0F766E'); // Default deep emerald / teal
    const headerText = this.cleanHex(palette?.headerTextColor, 'FFFFFF');
    const sectionBg = this.cleanHex(palette?.sectionBgColor, 'ECFDF5'); // Light emerald
    const sectionText = this.cleanHex(palette?.sectionTextColor, '065F46');
    const noteBg = this.cleanHex(palette?.noteBgColor, 'FEF3C7'); // Light amber
    const noteText = this.cleanHex(palette?.noteTextColor, '92400E');
    const tableBorder = this.cleanHex(palette?.tableBorderColor, 'CBD5E1'); // Slate border
    const bStyle = (palette?.tableBorderStyle && ['thin', 'medium', 'double', 'dotted', 'dashed'].includes(palette.tableBorderStyle)
      ? palette.tableBorderStyle
      : 'thin') as 'thin' | 'medium' | 'double' | 'dotted' | 'dashed';
    const zebraBg = palette?.zebraBgColor ? this.cleanHex(palette.zebraBgColor, 'F8FAFC') : null;

    const defaultCellBorder = {
      top: { style: bStyle, color: { rgb: tableBorder } },
      bottom: { style: bStyle, color: { rgb: tableBorder } },
      left: { style: bStyle, color: { rgb: tableBorder } },
      right: { style: bStyle, color: { rgb: tableBorder } },
    };

    const headerBorder = {
      top: { style: 'medium', color: { rgb: headerBg } },
      bottom: { style: 'medium', color: { rgb: headerBg } },
      left: { style: 'thin', color: { rgb: tableBorder } },
      right: { style: 'thin', color: { rgb: tableBorder } },
    };

    // 1. Traverse all rows and cells to assign mathematically calculated styles
    for (let r = 0; r < grid.length; r++) {
      const row = grid[r] || [];
      const firstVal = String(row[0] || '').trim();
      const isSpacingRow = row.every(c => !String(c || '').trim());
      const rowMerge = merges?.find(m => m.startRow === r && m.endRow === r && m.endCol > m.startCol);

      for (let c = 0; c < row.length; c++) {
        const cellAddress = XLSX.utils.encode_cell({ r, c });
        if (!ws[cellAddress]) {
          ws[cellAddress] = { t: 's', v: '' };
        }
        const cell = ws[cellAddress];
        const val = String(cell.v || '').trim();

        // Row 0: Document Title Banner
        if (r === 0) {
          cell.s = {
            fill: { fgColor: { rgb: headerBg } },
            font: { name: 'Pyidaungsu', sz: 14, bold: true, color: { rgb: headerText } },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: {
              top: { style: 'medium', color: { rgb: headerBg } },
              bottom: { style: 'medium', color: { rgb: headerBg } },
              left: { style: 'medium', color: { rgb: headerBg } },
              right: { style: 'medium', color: { rgb: headerBg } },
            },
          };
        }
        // Row 1: Subtitle, Date & Metadata Banner
        else if (r === 1) {
          cell.s = {
            fill: { fgColor: { rgb: 'F1F5F9' } },
            font: { name: 'Pyidaungsu', sz: 9, italic: true, color: { rgb: '475569' } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: {
              bottom: { style: 'thin', color: { rgb: tableBorder } },
            },
          };
        }
        // Spacing Rows (leave clean and unbordered)
        else if (isSpacingRow) {
          cell.s = {};
        }
        // Section Header Banner (starts with ▶ or has wide row merge)
        else if (firstVal.startsWith('▶') || (rowMerge && rowMerge.endCol >= 3 && !firstVal.startsWith('[NOTE]'))) {
          cell.s = {
            fill: { fgColor: { rgb: sectionBg } },
            font: { name: 'Pyidaungsu', sz: 11, bold: true, color: { rgb: sectionText } },
            alignment: { horizontal: 'left', vertical: 'center' },
            border: {
              top: { style: 'thin', color: { rgb: sectionText } },
              bottom: { style: 'thin', color: { rgb: sectionText } },
              left: { style: 'medium', color: { rgb: sectionText } },
              right: { style: 'thin', color: { rgb: sectionText } },
            },
          };
        }
        // Notes, Warnings & SOP Notices
        else if (firstVal.startsWith('[NOTE]') || firstVal.startsWith('မှတ်ချက်') || firstVal.startsWith('သတိပေးချက်')) {
          cell.s = {
            fill: { fgColor: { rgb: noteBg } },
            font: { name: 'Pyidaungsu', sz: 10, bold: c <= 1, color: { rgb: noteText } },
            alignment: { horizontal: c <= 1 ? 'center' : 'left', vertical: 'center', wrapText: true },
            border: {
              top: { style: 'thin', color: { rgb: 'FDE68A' } },
              bottom: { style: 'thin', color: { rgb: 'FDE68A' } },
              left: { style: 'medium', color: { rgb: 'F59E0B' } },
              right: { style: 'thin', color: { rgb: 'FDE68A' } },
            },
          };
        }
        // Column Headers Row (No, Topic, Details, Category, Notes, etc.)
        else if (
          row.some(x => /စဉ်|No|ခေါင်းစဉ်|Topic|အကြောင်းအရာ|နှုန်း|သင့်ငွေ|Description|Qty|Amount|Price/i.test(String(x || ''))) &&
          c < 6
        ) {
          cell.s = {
            fill: { fgColor: { rgb: headerBg } },
            font: { name: 'Pyidaungsu', sz: 10, bold: true, color: { rgb: headerText } },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: headerBorder,
          };
        }
        // Standard Table Data & Text Content Cells
        else {
          const isNum = /^[0-9,.]+(%|MMK|Ks|\$)?$/.test(val) || /^[၀-၉]+$/.test(val);
          const isCheckmark = val.startsWith('✔') || val === '✓';
          const isBullet = val.startsWith('•') || val.startsWith('-');

          let cellAlign: 'left' | 'center' | 'right' = 'left';
          if (c === 0 || isCheckmark || isBullet) cellAlign = 'center';
          else if (isNum) cellAlign = 'right';

          let textColor = '1E293B';
          if (isCheckmark) textColor = '16A34A'; // Emerald green checkmark
          else if (val.startsWith('❌')) textColor = 'DC2626';

          const bgFill = zebraBg && r % 2 === 0 ? { fgColor: { rgb: zebraBg } } : undefined;

          cell.s = {
            ...(bgFill ? { fill: bgFill } : {}),
            font: {
              name: 'Pyidaungsu',
              sz: 10,
              bold: isCheckmark || c === 0 || /^(Total|စုစုပေါင်း)/i.test(val),
              color: { rgb: textColor },
            },
            alignment: { horizontal: cellAlign, vertical: 'center', wrapText: true },
            border: defaultCellBorder,
          };
        }
      }
    }

    // 2. Overlay specific AI-detected Range Styles (Highest Visual Fidelity)
    if (rangeStyles && Array.isArray(rangeStyles) && rangeStyles.length > 0) {
      for (const rs of rangeStyles) {
        const sR = Math.max(0, rs.startRow || 0);
        const eR = Math.min(grid.length - 1, rs.endRow || 0);
        const sC = Math.max(0, rs.startCol || 0);
        const eC = rs.endCol !== undefined ? rs.endCol : 4;

        for (let r = sR; r <= eR; r++) {
          for (let c = sC; c <= eC; c++) {
            const addr = XLSX.utils.encode_cell({ r, c });
            if (!ws[addr]) ws[addr] = { t: 's', v: '' };
            const cell = ws[addr];
            if (!cell.s) cell.s = {};

            if (rs.bgColor) {
              cell.s.fill = { fgColor: { rgb: this.cleanHex(rs.bgColor) } };
            }
            if (rs.textColor || rs.bold !== undefined) {
              cell.s.font = {
                ...(cell.s.font || { name: 'Pyidaungsu', sz: 10 }),
                ...(rs.textColor ? { color: { rgb: this.cleanHex(rs.textColor) } } : {}),
                ...(rs.bold !== undefined ? { bold: rs.bold } : {}),
              };
            }
            if (rs.align) {
              cell.s.alignment = {
                ...(cell.s.alignment || { vertical: 'center', wrapText: true }),
                horizontal: rs.align,
              };
            }
            if (rs.borderStyle || rs.borderColor) {
              const style = (rs.borderStyle && ['thin', 'medium', 'double', 'dotted', 'dashed'].includes(rs.borderStyle)
                ? rs.borderStyle
                : 'thin') as 'thin' | 'medium' | 'double' | 'dotted' | 'dashed';
              const color = this.cleanHex(rs.borderColor, tableBorder);
              cell.s.border = {
                top: { style, color: { rgb: color } },
                bottom: { style, color: { rgb: color } },
                left: { style, color: { rgb: color } },
                right: { style, color: { rgb: color } },
              };
            }
          }
        }
      }
    }
  }

  /**
   * Applies clean borders and header colors to standard tabular data worksheets
   */
  static applyTableStylesToWorksheet(ws: any, tableData: string[][], headerBgColor = '0F766E', borderColor = 'CBD5E1') {
    const cleanHeaderBg = this.cleanHex(headerBgColor, '0F766E');
    const cleanBorder = this.cleanHex(borderColor, 'CBD5E1');

    for (let r = 0; r < tableData.length; r++) {
      const row = tableData[r] || [];
      const isHeader = r === 0;

      for (let c = 0; c < row.length; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) ws[addr] = { t: 's', v: '' };
        const cell = ws[addr];
        const val = String(cell.v || '').trim();
        const isNum = /^[0-9,.]+(%|MMK|Ks|\$)?$/.test(val) || /^[၀-၉]+$/.test(val);

        if (isHeader) {
          cell.s = {
            fill: { fgColor: { rgb: cleanHeaderBg } },
            font: { name: 'Pyidaungsu', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: {
              top: { style: 'medium', color: { rgb: cleanHeaderBg } },
              bottom: { style: 'medium', color: { rgb: cleanHeaderBg } },
              left: { style: 'thin', color: { rgb: cleanBorder } },
              right: { style: 'thin', color: { rgb: cleanBorder } },
            },
          };
        } else {
          cell.s = {
            ...(r % 2 === 0 ? { fill: { fgColor: { rgb: 'F8FAFC' } } } : {}),
            font: { name: 'Pyidaungsu', sz: 10, color: { rgb: '1E293B' }, bold: /^(Total|စုစုပေါင်း)/i.test(val) },
            alignment: { horizontal: isNum ? 'right' : (c === 0 ? 'center' : 'left'), vertical: 'center', wrapText: true },
            border: {
              top: { style: 'thin', color: { rgb: cleanBorder } },
              bottom: { style: 'thin', color: { rgb: cleanBorder } },
              left: { style: 'thin', color: { rgb: cleanBorder } },
              right: { style: 'thin', color: { rgb: cleanBorder } },
            },
          };
        }
      }
    }
  }
  /**
   * High-precision local fallback grid calculator that mathematically computes
   * rows, columns, merged titles, bullet items, and empty spacing rows
   * mirroring the document structure cell-by-cell.
   */
  static generateLocalAiCalculatedGrid({
    docTitle,
    parsedDoc,
    tableData,
    ocrText,
  }: {
    docTitle: string;
    parsedDoc: any;
    tableData: string[][];
    ocrText?: string;
  }): {
    grid: string[][];
    merges: { startRow: number; startCol: number; endRow: number; endCol: number }[];
    columnWidths: number[];
  } {
    const grid: string[][] = [];
    const merges: { startRow: number; startCol: number; endRow: number; endCol: number }[] = [];

    // Row 0: Document Title Banner
    const finalTitle = parsedDoc?.title || docTitle || 'Document Sheet Analysis';
    grid.push([finalTitle, '', '', '', '']);
    merges.push({ startRow: 0, startCol: 0, endRow: 0, endCol: 4 });

    // Row 1: Subtitle & Metadata Banner
    const subtitle = parsedDoc?.subtitle || `Export Date: ${new Date().toLocaleString()} | Engine: Gemini AI Grid Layout`;
    grid.push([subtitle, '', '', '', '']);
    merges.push({ startRow: 1, startCol: 0, endRow: 1, endCol: 4 });

    // Row 2: Visual Spacing Row
    grid.push(['', '', '', '', '']);

    let currentRow = 3;

    if (parsedDoc && parsedDoc.sections && parsedDoc.sections.length > 0) {
      for (const sec of parsedDoc.sections) {
        // Section Header Banner Row
        const secTitle = '▶ ' + (sec.title || 'ကဏ္ဍ / အပိုင်း');
        grid.push([secTitle, '', '', '', '']);
        merges.push({ startRow: currentRow, startCol: 0, endRow: currentRow, endCol: 4 });
        currentRow++;

        if (sec.type === 'table' && sec.table && sec.table.length > 0) {
          for (let r = 0; r < sec.table.length; r++) {
            const tableRow = sec.table[r] || [];
            const paddedRow = [
              tableRow[0] || '',
              tableRow[1] || '',
              tableRow[2] || '',
              tableRow[3] || '',
              tableRow.slice(4).join(' | '),
            ];
            grid.push(paddedRow);
            currentRow++;
          }
        } else if (sec.items && sec.items.length > 0) {
          // Column Headers Row for Items
          grid.push(['စဉ် (No)', 'အကြောင်းအရာ / ခေါင်းစဉ် (Topic)', 'အသေးစိတ် ရှင်းလင်းချက် (Details / Action)', 'အမျိုးအစား (Category)', 'မှတ်ချက် (Notes)']);
          currentRow++;

          let itemIndex = 1;
          for (const item of sec.items) {
            grid.push([
              String(itemIndex++),
              (item.isCheck !== false ? '✔ ' : '• ') + item.text,
              item.subtext || '',
              'Standard SOP',
              '',
            ]);
            currentRow++;
          }
        } else if (sec.content) {
          grid.push(['၁', 'မှတ်ချက် / သတိပေးချက်', sec.content, 'Important Note', '']);
          merges.push({ startRow: currentRow, startCol: 2, endRow: currentRow, endCol: 4 });
          currentRow++;
        }

        // Spacing row between sections
        grid.push(['', '', '', '', '']);
        currentRow++;
      }
    } else if (ocrText && ocrText.trim()) {
      // If parsedDoc is simple, parse lines into deliberate rows and columns
      const lines = ocrText.split('\n').map(l => l.trim()).filter(Boolean);
      grid.push(['စဉ် (No)', 'အကြောင်းအရာ / စာသား (Content)', 'အသေးစိတ် (Details)', 'အမျိုးအစား (Type)', 'မှတ်ချက် (Notes)']);
      currentRow++;

      let lineCounter = 1;
      for (const line of lines) {
        if (line.startsWith('မှတ်ချက်') || line.startsWith('Note:')) {
          grid.push(['[NOTE]', 'မှတ်ချက်', line, 'Notice', '']);
          merges.push({ startRow: currentRow, startCol: 2, endRow: currentRow, endCol: 4 });
          currentRow++;
          grid.push(['', '', '', '', '']);
          currentRow++;
        } else if (line.startsWith('✔') || line.startsWith('•') || line.startsWith('-')) {
          grid.push([String(lineCounter++), line.slice(0, 40), line.slice(40) || '', 'Action Item', '']);
          currentRow++;
        } else {
          grid.push([String(lineCounter++), line, '', 'Text Paragraph', '']);
          currentRow++;
        }
      }
    }

    // Append direct table rows if provided
    if (tableData && tableData.length > 0) {
      grid.push(['', '', '', '', '']);
      currentRow++;
      grid.push(['▶ တိုက်ရိုက်ထုတ်ယူထားသော Data Table ဇယားကွက်', '', '', '', '']);
      merges.push({ startRow: currentRow, startCol: 0, endRow: currentRow, endCol: 4 });
      currentRow++;

      for (const row of tableData) {
        const paddedRow = [
          row[0] || '',
          row[1] || '',
          row[2] || '',
          row[3] || '',
          row.slice(4).join(' | '),
        ];
        grid.push(paddedRow);
        currentRow++;
      }
    }

    return {
      grid,
      merges,
      columnWidths: [10, 32, 55, 20, 18],
    };
  }

  /**
   * Asynchronously calculates and generates a spreadsheet via the Gemini AI Cell & Grid Engine.
   * Inspects columns, titles, paragraphs, text chunks, and spacing cell-by-cell.
   */
  static async exportToExcelWithAiEngine({
    fileName,
    tableData = [],
    ocrText = '',
    imageBase64,
    title,
    layoutMode = 'ai_grid',
    autoDownload = true,
  }: {
    fileName: string;
    tableData?: string[][];
    ocrText?: string;
    imageBase64?: string;
    title?: string;
    layoutMode?: ExportLayoutMode;
    autoDownload?: boolean;
  }): Promise<{ blob: Blob; fileName: string; isAiCalculated: boolean; modelUsed?: string }> {
    const cleanName = (fileName || 'DocuScan_Export').replace(/[/\\?%*:|"<>]/g, '_').replace(/\.xlsx$/i, '');
    const fullFileName = `${cleanName}.xlsx`;

    // Try Gemini AI Grid & Cell Calculation Engine on server
    try {
      if (imageBase64 || (ocrText && ocrText.trim().length > 0)) {
        const res = await fetch('/api/gemini/excel-grid-engine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64,
            ocrText,
            tableData,
            title: title || cleanName,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.grid && Array.isArray(data.grid) && data.grid.length > 0) {
            const wb = XLSX.utils.book_new();

            // Sheet 1: AI Calculated Document Grid
            const wsGrid = XLSX.utils.aoa_to_sheet(data.grid);

            // Apply calculated column widths
            if (data.columnWidths && Array.isArray(data.columnWidths) && data.columnWidths.length > 0) {
              wsGrid['!cols'] = data.columnWidths.map((w: number) => ({ wch: Math.max(Number(w) || 12, 10) }));
            } else {
              wsGrid['!cols'] = [{ wch: 10 }, { wch: 32 }, { wch: 55 }, { wch: 22 }, { wch: 18 }];
            }

            // Apply calculated cell merges
            if (data.merges && Array.isArray(data.merges) && data.merges.length > 0) {
              wsGrid['!merges'] = data.merges.map((m: any) => ({
                s: { r: Number(m.startRow), c: Number(m.startCol) },
                e: { r: Number(m.endRow), c: Number(m.endCol) },
              }));
            }

            // Apply Visual Borders & Colors matching the original image
            this.applyVisualStylesToWorksheet(
              wsGrid,
              data.grid,
              data.merges,
              data.palette,
              data.rangeStyles
            );

            const sheetName = (data.sheetTitle || 'Document_AI_Grid').replace(/[\\/?*[\]]/g, '_').slice(0, 31);
            XLSX.utils.book_append_sheet(wb, wsGrid, sheetName);

            // Sheet 2: Raw Data Table if extracted
            const rawTable = (data.rawDataTable && data.rawDataTable.length > 0) ? data.rawDataTable : tableData;
            if (rawTable && rawTable.length > 0) {
              const wsTable = XLSX.utils.aoa_to_sheet(rawTable);
              wsTable['!cols'] = (rawTable[0] || []).map(() => ({ wch: 20 }));
              this.applyTableStylesToWorksheet(
                wsTable,
                rawTable,
                data.palette?.headerBgColor || '0F766E',
                data.palette?.tableBorderColor || 'CBD5E1'
              );
              XLSX.utils.book_append_sheet(wb, wsTable, 'Data_Table_Matrix');
            }

            // Write binary with full style support
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], {
              type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
            });

            if (autoDownload) {
              this.downloadBlob(blob, fullFileName);
            }

            return { blob, fileName: fullFileName, isAiCalculated: true, modelUsed: data.modelUsed };
          }
        }
      }
    } catch (err) {
      console.warn('AI Grid Engine backend call failed, falling back to local calculation engine:', err);
    }

    // Fallback: Local High-Precision Grid Calculator
    const parsedDoc = ocrText && ocrText.trim().length > 0
      ? OcrService.parseTextToSections(ocrText, tableData)
      : null;

    const localResult = this.generateLocalAiCalculatedGrid({
      docTitle: title || cleanName,
      parsedDoc,
      tableData,
      ocrText,
    });

    const wb = XLSX.utils.book_new();
    const wsGrid = XLSX.utils.aoa_to_sheet(localResult.grid);
    wsGrid['!cols'] = localResult.columnWidths.map(w => ({ wch: w }));
    wsGrid['!merges'] = localResult.merges.map(m => ({
      s: { r: m.startRow, c: m.startCol },
      e: { r: m.endRow, c: m.endCol },
    }));

    // Apply clean default theme styling to local grid
    this.applyVisualStylesToWorksheet(
      wsGrid,
      localResult.grid,
      localResult.merges,
      {
        headerBgColor: '0F766E',
        headerTextColor: 'FFFFFF',
        sectionBgColor: 'ECFDF5',
        sectionTextColor: '065F46',
        noteBgColor: 'FEF3C7',
        noteTextColor: '92400E',
        tableBorderColor: 'CBD5E1',
        tableBorderStyle: 'thin',
        hasTableBorders: true,
      }
    );

    XLSX.utils.book_append_sheet(wb, wsGrid, 'AI_Calculated_Grid');

    if (tableData && tableData.length > 0) {
      const wsData = XLSX.utils.aoa_to_sheet(tableData);
      this.applyTableStylesToWorksheet(wsData, tableData, '0F766E', 'CBD5E1');
      XLSX.utils.book_append_sheet(wb, wsData, 'Data_Table_Matrix');
    }

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
    });

    if (autoDownload) {
      this.downloadBlob(blob, fullFileName);
    }

    return { blob, fileName: fullFileName, isAiCalculated: false };
  }

  /**
   * Exports table rows and structured document sections to an Excel (.xlsx) file
   * with support for distinct layout modes:
   * - 'ai_grid': Gemini AI Cell & Grid Calculation Engine (Columns, Titles, Paragraphs, Spaces)
   * - 'matrix': Complete Unified Table Matrix Grid
   * - 'framed': Structured Frame Cards & SOP checkmark matrix
   * - 'text': Clean Document Text Flow & Section Notes (1:1 Text Preview matching)
   */
  static exportToExcel({
    fileName,
    tableData,
    ocrText,
    sheetName = 'Table_Data',
    layoutMode = 'framed',
    autoDownload = true,
  }: {
    fileName: string;
    tableData: string[][];
    ocrText?: string;
    sheetName?: string;
    layoutMode?: ExportLayoutMode;
    autoDownload?: boolean;
  }): { blob: Blob; fileName: string } {
    const cleanName = (fileName || 'DocuScan_Export').replace(/[/\\?%*:|"<>]/g, '_').replace(/\.xlsx$/i, '');
    const fullFileName = `${cleanName}.xlsx`;

    // Strictly normalize table rows to prevent mismatched column counts
    const normalizedData = OcrService.normalizeTable(tableData);

    // Create a new workbook with Unicode support
    const wb = XLSX.utils.book_new();

    const parsedDoc = ocrText && ocrText.trim().length > 0
      ? OcrService.parseTextToSections(ocrText, tableData)
      : null;

    // =========================================================================
    // MODE AI: GEMINI AI SMART GRID & CELL CALCULATION (COLUMNS, TITLES, PARAGRAPHS, SPACES)
    // =========================================================================
    if (layoutMode === 'ai_grid') {
      const localResult = this.generateLocalAiCalculatedGrid({
        docTitle: parsedDoc?.title || fileName || 'Document Sheet Analysis',
        parsedDoc,
        tableData: normalizedData,
        ocrText,
      });

      const wsAiGrid = XLSX.utils.aoa_to_sheet(localResult.grid);
      wsAiGrid['!cols'] = localResult.columnWidths.map(w => ({ wch: w }));
      wsAiGrid['!merges'] = localResult.merges.map(m => ({
        s: { r: m.startRow, c: m.startCol },
        e: { r: m.endRow, c: m.endCol },
      }));
      this.applyVisualStylesToWorksheet(
        wsAiGrid,
        localResult.grid,
        localResult.merges,
        {
          headerBgColor: '0F766E',
          headerTextColor: 'FFFFFF',
          sectionBgColor: 'ECFDF5',
          sectionTextColor: '065F46',
          noteBgColor: 'FEF3C7',
          noteTextColor: '92400E',
          tableBorderColor: 'CBD5E1',
          tableBorderStyle: 'thin',
          hasTableBorders: true,
        }
      );
      XLSX.utils.book_append_sheet(wb, wsAiGrid, 'AI_Calculated_Grid');
    }

    // =========================================================================
    // MODE A: STRUCTURED TABLE MATRIX (FULL GRID)
    // =========================================================================
    else if (layoutMode === 'matrix') {
      const matrixRows: string[][] = [
        ['အစီရင်ခံစာ / Document Title:', parsedDoc?.title || fileName || 'Document Matrix Report', '', '', ''],
        ['ရက်စွဲ / Export Date:', new Date().toLocaleString(), '', '', ''],
        ['ဖွဲ့စည်းမှုပုံစံ / Layout Mode:', 'Structured Table Matrix (Full Data Grid)', '', '', ''],
        ['', '', '', '', ''],
        ['စဉ် (No)', 'ကဏ္ဍ / အပိုင်း (Section)', 'ခေါင်းစဉ် / အကြောင်းအရာ (Topic)', 'အသေးစိတ် ရှင်းလင်းချက် (Details / Action)', 'အမျိုးအစား (Type)'],
      ];

      let itemCounter = 1;

      if (parsedDoc) {
        for (const sec of parsedDoc.sections) {
          if (sec.type === 'table' && sec.table && sec.table.length > 0) {
            for (let r = 1; r < sec.table.length; r++) {
              const row = sec.table[r];
              matrixRows.push([
                String(itemCounter++),
                sec.title || 'Table Matrix',
                row[0] || row[1] || '',
                row.slice(1).join(' | '),
                'Table Row',
              ]);
            }
          } else if (sec.items && sec.items.length > 0) {
            for (const item of sec.items) {
              matrixRows.push([
                String(itemCounter++),
                sec.title,
                (item.isCheck !== false ? '✔ ' : '• ') + item.text,
                item.subtext || '',
                'Action Item',
              ]);
            }
          } else if (sec.content) {
            matrixRows.push([
              String(itemCounter++),
              sec.title,
              'သတိပေးချက် / မှတ်ချက်',
              sec.content,
              'Note / Warning',
            ]);
          }
        }
      }

      // Add direct table rows if any
      if (normalizedData.length > 0) {
        for (let r = 0; r < normalizedData.length; r++) {
          const row = normalizedData[r];
          matrixRows.push([
            String(itemCounter++),
            'Raw Data Table',
            row[0] || '',
            row.slice(1).join(' | '),
            'Data Cell',
          ]);
        }
      }

      const wsMatrix = XLSX.utils.aoa_to_sheet(matrixRows);
      wsMatrix['!cols'] = [{ wch: 10 }, { wch: 30 }, { wch: 45 }, { wch: 60 }, { wch: 18 }];
      this.applyTableStylesToWorksheet(wsMatrix, matrixRows, '0F766E', 'CBD5E1');
      XLSX.utils.book_append_sheet(wb, wsMatrix, 'Table_Matrix_Full');
    }

    // =========================================================================
    // MODE B: CLEAN TEXT FLOW TYPOGRAPHY (1:1 Text Flow Preview Matching)
    // =========================================================================
    else if (layoutMode === 'text') {
      const textFlowRows: string[][] = [
        ['ခေါင်းစဉ် / Document Title:', parsedDoc?.title || fileName || 'Document Export', '', ''],
        ['စာတန်းခွဲ / Subtitle:', parsedDoc?.subtitle || '', '', ''],
        ['ရက်စွဲ / Export Date:', new Date().toLocaleString(), '', ''],
        ['ပုံစံ / Layout Mode:', 'Text Flow (1:1 Preview Buffer & Paragraphs)', '', ''],
        ['', '', '', ''],
        ['စဉ် / အမျိုးအစား (Type)', 'ခေါင်းစဉ် / အကြောင်းအရာ (Content / Topic)', 'အသေးစိတ် / ရှင်းလင်းချက် (Details / Notes)', 'မူရင်းစာကြောင်း (Raw Line)'],
      ];

      const rawLines = (ocrText || '').split('\n');
      let lineCounter = 1;

      for (let lIdx = 0; lIdx < rawLines.length; lIdx++) {
        const line = rawLines[lIdx].trim();
        if (!line) {
          textFlowRows.push(['', '', '', '']);
          continue;
        }

        // Note line
        if (line.startsWith('မှတ်ချက်') || line.startsWith('Note:') || (line.startsWith('*') && line.length > 5)) {
          textFlowRows.push([
            `[NOTE #${lineCounter++}]`,
            'မှတ်ချက် / သတိပေးချက်',
            line,
            line,
          ]);
          continue;
        }

        // Table line with |
        if (line.includes('|')) {
          const cells = line.split('|').map(c => c.trim()).filter(Boolean);
          textFlowRows.push([
            `[TABLE ROW]`,
            cells[0] || '',
            cells.slice(1).join(' | '),
            line,
          ]);
          continue;
        }

        // Bullet line
        const isBullet =
          line.startsWith('✔') ||
          line.startsWith('•') ||
          line.startsWith('- ') ||
          line.startsWith('— ') ||
          /^\d+[.)]/.test(line);

        if (isBullet) {
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

          textFlowRows.push([
            `[ITEM ${lineCounter++}]`,
            (line.startsWith('✔') ? '✔ ' : '• ') + cleanText,
            subtext,
            line,
          ]);
          continue;
        }

        // Heading candidate
        const isHeading =
          line.length < 75 &&
          (line.startsWith('▶') ||
            line.startsWith('##') ||
            line.includes('Standard') ||
            line.includes('နည်းလမ်း') ||
            line.includes('ပြဿနာ') ||
            line.includes('ရွေးချယ်စရာ') ||
            line.includes('Solution') ||
            line.includes('လမ်းညွှန်') ||
            lIdx === 0 ||
            lIdx === 1);

        if (isHeading) {
          textFlowRows.push([
            `[SECTION]`,
            line.replace(/^[▶#\s]+/, '').trim(),
            '',
            line,
          ]);
          continue;
        }

        // Normal text line
        textFlowRows.push([
          `[TEXT ${lineCounter++}]`,
          line,
          '',
          line,
        ]);
      }

      const wsText = XLSX.utils.aoa_to_sheet(textFlowRows);
      wsText['!cols'] = [{ wch: 18 }, { wch: 45 }, { wch: 60 }, { wch: 50 }];
      this.applyTableStylesToWorksheet(wsText, textFlowRows, '1E293B', 'E2E8F0');
      XLSX.utils.book_append_sheet(wb, wsText, 'Text_Flow_Doc');
    }

    // =========================================================================
    // MODE C: FRAMED CARDS (DEFAULT SOP MATRIX)
    // =========================================================================
    else {
      if (parsedDoc) {
        const structuredRows: string[][] = [
          ['ခေါင်းစဉ် / Document Title:', parsedDoc.title || 'Scanned Document', '', ''],
          ['စာတန်းခွဲ / Subtitle:', parsedDoc.subtitle || '', '', ''],
          ['ရက်စွဲ / Export Date:', new Date().toLocaleString(), '', ''],
          ['ပုံစံ / Layout Mode:', 'Frame Cards (1:1 Raw Document Layout)', '', ''],
          ['', '', '', ''],
          ['စဉ် (No)', 'ကဏ္ဍ / Card Section', 'အကြောင်းအရာ / လုပ်ဆောင်ချက် (Topic / Item)', 'အသေးစိတ် ရှင်းလင်းချက် (Details / Notes)'],
        ];

        let itemCounter = 1;
        for (const sec of parsedDoc.sections) {
          if (sec.type === 'table') continue;

          if (sec.items && sec.items.length > 0) {
            for (const item of sec.items) {
              structuredRows.push([
                String(itemCounter++),
                sec.title,
                (item.isCheck !== false ? '✔ ' : '• ') + item.text,
                item.subtext || '',
              ]);
            }
          } else if (sec.content) {
            structuredRows.push([
              String(itemCounter++),
              sec.title,
              'မှတ်ချက် / Note',
              sec.content,
            ]);
          } else if (sec.title) {
            structuredRows.push([
              String(itemCounter++),
              sec.title,
              'ခေါင်းစဉ် / အပိုင်း',
              '',
            ]);
          }
        }

        if (structuredRows.length > 5) {
          const wsDoc = XLSX.utils.aoa_to_sheet(structuredRows);
          wsDoc['!cols'] = [{ wch: 10 }, { wch: 32 }, { wch: 45 }, { wch: 60 }];
          this.applyTableStylesToWorksheet(wsDoc, structuredRows, '0F766E', 'CBD5E1');
          XLSX.utils.book_append_sheet(wb, wsDoc, 'Framed_Cards_SOP');
        }
      }
    }

    // Secondary Sheet: Primary Raw Data Table (if exists)
    if (normalizedData.length > 0) {
      const wsData = XLSX.utils.aoa_to_sheet(normalizedData);
      const colWidths = (normalizedData[0] || []).map((_, colIdx) => {
        let maxLen = 14;
        for (const row of normalizedData) {
          const cell = row[colIdx] ? String(row[colIdx]) : '';
          if (cell.length > maxLen) maxLen = Math.min(cell.length + 4, 60);
        }
        return { wch: maxLen };
      });
      wsData['!cols'] = colWidths;
      this.applyTableStylesToWorksheet(wsData, normalizedData, '0F766E', 'CBD5E1');
      const safeSheetName = (sheetName || 'Table_Data').replace(/[\\/?*[\]]/g, '_').slice(0, 31);
      XLSX.utils.book_append_sheet(wb, wsData, safeSheetName);
    }

    // If workbook has no sheets, add a default one
    if (wb.SheetNames.length === 0) {
      const wsEmpty = XLSX.utils.aoa_to_sheet([['No data extracted']]);
      XLSX.utils.book_append_sheet(wb, wsEmpty, 'Empty');
    }

    // Write to binary array
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
    });

    // Trigger browser download if requested
    if (autoDownload) {
      this.downloadBlob(blob, fullFileName);
    }

    return { blob, fileName: fullFileName };
  }

  /**
   * Exports table rows to a standard CSV (.csv) file with UTF-8 BOM for Myanmar Unicode support
   */
  static exportToCsv({
    fileName,
    tableData,
    autoDownload = true,
  }: {
    fileName: string;
    tableData: string[][];
    autoDownload?: boolean;
  }): { blob: Blob; fileName: string; csvContent: string } {
    const cleanName = (fileName || 'DocuScan_Export').replace(/[/\\?%*:|"<>]/g, '_').replace(/\.csv$/i, '');
    const fullFileName = `${cleanName}.csv`;

    const normalizedData = OcrService.normalizeTable(tableData);

    const csvContent = normalizedData
      .map(row =>
        row
          .map(cell => {
            const str = cell !== undefined && cell !== null ? String(cell) : '';
            const escaped = str.replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(',')
      )
      .join('\r\n');

    const utf8BomCsv = '\uFEFF' + csvContent;
    const blob = new Blob([utf8BomCsv], { type: 'text/csv;charset=utf-8;' });
    if (autoDownload) {
      this.downloadBlob(blob, fullFileName);
    }

    return { blob, fileName: fullFileName, csvContent: utf8BomCsv };
  }

  /**
   * Helper to trigger download of any Blob
   */
  static downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 200);
  }

  /**
   * Share file via Web Share API or download fallback
   */
  static async shareFile(fileName: string, blob: Blob, title?: string): Promise<boolean> {
    try {
      const file = new File([blob], fileName, { type: blob.type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: title || 'Exported Document',
          text: `Exported from NextUnit DocuScan App: ${fileName}`,
        });
        return true;
      } else {
        this.downloadBlob(blob, fileName);
        return true;
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        this.downloadBlob(blob, fileName);
      }
      return false;
    }
  }
}
