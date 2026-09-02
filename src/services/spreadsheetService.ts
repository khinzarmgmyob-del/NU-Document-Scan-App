import * as XLSX from 'xlsx';
import { OcrService } from './ocrService';
import { ExportLayoutMode } from '../types';

export class SpreadsheetService {
  /**
   * Exports table rows and structured document sections to an Excel (.xlsx) file
   * with support for 3 distinct layout modes matching the preview exactly:
   * - 'framed': Structured Frame Cards & SOP checkmark matrix
   * - 'text': Clean Document Text Flow & Section Notes (1:1 Text Preview matching)
   * - 'matrix': Complete Unified Table Matrix Grid
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
    // MODE A: STRUCTURED TABLE MATRIX (FULL GRID)
    // =========================================================================
    if (layoutMode === 'matrix') {
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
