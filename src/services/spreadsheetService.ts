import * as XLSX from 'xlsx';
import { OcrService } from './ocrService';

export class SpreadsheetService {
  /**
   * Exports table rows to an Excel (.xlsx) file with clean table borders
   * and proper column widths.
   */
  static exportToExcel({
    fileName,
    tableData,
    sheetName = 'ScannedData',
  }: {
    fileName: string;
    tableData: string[][];
    sheetName?: string;
  }): { blob: Blob; fileName: string } {
    const cleanName = fileName.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const fullFileName = `${cleanName}.xlsx`;

    // Strictly normalize table rows to prevent mismatched column counts
    const normalizedData = OcrService.normalizeTable(tableData);

    // Create a new workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(normalizedData);

    // Set column widths dynamically based on longest content in each column
    if (normalizedData.length > 0) {
      const colWidths = (normalizedData[0] || []).map((_, colIdx) => {
        let maxLen = 10;
        for (const row of normalizedData) {
          const cell = row[colIdx] ? String(row[colIdx]) : '';
          if (cell.length > maxLen) maxLen = Math.min(cell.length + 3, 50);
        }
        return { wch: maxLen };
      });
      ws['!cols'] = colWidths;
    }

    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // Write to binary array
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    // Trigger browser download
    this.downloadBlob(blob, fullFileName);

    return { blob, fileName: fullFileName };
  }

  /**
   * Exports table rows to a standard CSV (.csv) file and triggers download
   */
  static exportToCsv({
    fileName,
    tableData,
  }: {
    fileName: string;
    tableData: string[][];
  }): { blob: Blob; fileName: string; csvContent: string } {
    const cleanName = fileName.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const fullFileName = `${cleanName}.csv`;

    const normalizedData = OcrService.normalizeTable(tableData);

    const csvContent = normalizedData
      .map(row =>
        row
          .map(cell => {
            const str = cell ? String(cell) : '';
            const escaped = str.replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(',')
      )
      .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    this.downloadBlob(blob, fullFileName);

    return { blob, fileName: fullFileName, csvContent };
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
