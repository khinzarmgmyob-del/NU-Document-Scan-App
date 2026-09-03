import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { LocalFileItem } from '../types';
import { SpreadsheetService } from './spreadsheetService';
import { PdfService } from './pdfService';
import { WordExportService } from './wordExportService';
import { OcrService } from './ocrService';

export interface NativeExportResult {
  success: boolean;
  filePath?: string;
  isNative: boolean;
  message?: string;
  error?: string;
}

/**
 * Utility to convert a Blob into a clean Base64 string for Capacitor Filesystem
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Extract pure base64 part
      const base64 = dataUrl.split(',')[1] || dataUrl;
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}

export class NativeExportService {
  /**
   * Check if running inside a native mobile/tablet environment (Android or iOS Capacitor container)
   */
  static isNative(): boolean {
    try {
      return Capacitor.isNativePlatform();
    } catch {
      return false;
    }
  }

  /**
   * Save a Blob or Base64 string to Native Device Storage (Documents / Cache)
   * and automatically launch the Native Reader (PDF Reader / Excel / Sheets app)
   */
  static async saveAndOpenNativeFile({
    fileName,
    blob,
    base64Data,
    mimeType,
    onToast,
  }: {
    fileName: string;
    blob?: Blob;
    base64Data?: string;
    mimeType: string;
    onToast?: (msg: string) => void;
  }): Promise<NativeExportResult> {
    const cleanFileName = fileName.replace(/[/\\?%*:|"<>]/g, '_');

    // 1. If running on Web / Browser: Trigger standard browser download
    if (!this.isNative()) {
      if (blob) {
        SpreadsheetService.downloadBlob(blob, cleanFileName);
      } else if (base64Data) {
        const fullUrl = base64Data.startsWith('data:')
          ? base64Data
          : `data:${mimeType};base64,${base64Data}`;
        const link = document.createElement('a');
        link.href = fullUrl;
        link.download = cleanFileName;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => document.body.removeChild(link), 200);
      }
      onToast?.(`Downloaded: ${cleanFileName}`);
      return { success: true, isNative: false, filePath: cleanFileName };
    }

    // 2. Native Capacitor Mobile Approach (Filesystem + FileOpener)
    try {
      let dataToWrite = base64Data || '';
      if (!dataToWrite && blob) {
        dataToWrite = await blobToBase64(blob);
      }

      if (!dataToWrite) {
        throw new Error('No data available to export');
      }

      // Try saving to Documents directory first (preferred for user documents)
      let targetDir = Directory.Documents;
      let writeResult;

      try {
        writeResult = await Filesystem.writeFile({
          path: cleanFileName,
          data: dataToWrite,
          directory: targetDir,
          recursive: true,
        });
      } catch (docErr) {
        console.warn('Writing to Documents directory failed, falling back to Cache:', docErr);
        // Fallback to Cache directory if Documents has permission restrictions
        targetDir = Directory.Cache;
        writeResult = await Filesystem.writeFile({
          path: cleanFileName,
          data: dataToWrite,
          directory: targetDir,
          recursive: true,
        });
      }

      // Get native absolute file path
      const uriResult = await Filesystem.getUri({
        path: cleanFileName,
        directory: targetDir,
      });

      const fullNativePath = uriResult.uri;
      onToast?.(`Saved to ${targetDir}: ${cleanFileName}`);

      // Auto-Open with installed Native Apps (e.g. Adobe Acrobat, Microsoft Excel, Google Sheets)
      try {
        await FileOpener.open({
          filePath: fullNativePath,
          contentType: mimeType,
          openWithDefault: false,
        });
        return {
          success: true,
          isNative: true,
          filePath: fullNativePath,
          message: `Opened with native app: ${cleanFileName}`,
        };
      } catch (openErr: any) {
        console.warn('FileOpener could not open file directly:', openErr);
        const msg = `Saved to Documents: ${cleanFileName}. (No default app found to open directly)`;
        onToast?.(msg);
        return {
          success: true,
          isNative: true,
          filePath: fullNativePath,
          message: msg,
        };
      }
    } catch (err: any) {
      console.error('Native Capacitor Export Error:', err);
      const errMsg = err.message || 'Failed to save or open file on device';
      onToast?.(`Export Error: ${errMsg}`);
      
      // Fallback: If blob exists, try browser link fallback
      if (blob) {
        SpreadsheetService.downloadBlob(blob, cleanFileName);
      }
      return {
        success: false,
        isNative: true,
        error: errMsg,
      };
    }
  }

  /**
   * Export Excel (.xlsx) using Native Filesystem + FileOpener
   */
  static async exportAndOpenExcel({
    fileName,
    tableData,
    onToast,
  }: {
    fileName: string;
    tableData: string[][];
    onToast?: (msg: string) => void;
  }): Promise<NativeExportResult> {
    const baseName = fileName.replace(/\.xlsx$/i, '');
    const fullFileName = `${baseName}.xlsx`;
    const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    // Generate Excel blob
    const { blob } = SpreadsheetService.exportToExcel({
      fileName: baseName,
      tableData,
    });

    return await this.saveAndOpenNativeFile({
      fileName: fullFileName,
      blob,
      mimeType,
      onToast,
    });
  }

  /**
   * Export CSV (.csv) using Native Filesystem + FileOpener with Myanmar Unicode UTF-8 BOM
   */
  static async exportAndOpenCsv({
    fileName,
    tableData,
    onToast,
  }: {
    fileName: string;
    tableData: string[][];
    onToast?: (msg: string) => void;
  }): Promise<NativeExportResult> {
    const baseName = fileName.replace(/\.csv$/i, '');
    const fullFileName = `${baseName}.csv`;
    const mimeType = 'text/csv';

    const { blob } = SpreadsheetService.exportToCsv({
      fileName: baseName,
      tableData,
    });

    return await this.saveAndOpenNativeFile({
      fileName: fullFileName,
      blob,
      mimeType,
      onToast,
    });
  }

  /**
   * Export PDF (.pdf) using Native Filesystem + FileOpener
   */
  static async exportAndOpenPdf({
    title,
    ocrText,
    tableData,
    fileName,
    onToast,
  }: {
    title: string;
    ocrText: string;
    tableData?: string[][];
    fileName?: string;
    onToast?: (msg: string) => void;
  }): Promise<NativeExportResult> {
    const baseName = (fileName || title).replace(/\.pdf$/i, '');
    const fullFileName = `${baseName}.pdf`;
    const mimeType = 'application/pdf';

    const { blob } = await PdfService.generateAndSavePdf({
      title,
      ocrText,
      tableData,
      customFileName: baseName,
    });

    return await this.saveAndOpenNativeFile({
      fileName: fullFileName,
      blob,
      mimeType,
      onToast,
    });
  }

  /**
   * Export Word (.docx) using Native Filesystem + FileOpener
   */
  static async exportAndOpenWord({
    title,
    htmlContent,
    fullText,
    fileName,
    onToast,
  }: {
    title: string;
    htmlContent?: string;
    fullText?: string;
    fileName?: string;
    onToast?: (msg: string) => void;
  }): Promise<NativeExportResult> {
    const baseName = (fileName || title).replace(/\.docx$/i, '');
    const fullFileName = `${baseName}.docx`;
    const mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    const { blob } = WordExportService.generateAndSaveWord({
      title,
      htmlContent,
      fullText,
      customFileName: baseName,
      autoDownload: false,
    });

    return await this.saveAndOpenNativeFile({
      fileName: fullFileName,
      blob,
      mimeType,
      onToast,
    });
  }

  /**
   * Universal Helper for any LocalFileItem (handles Word, Excel, CSV, PDF, Audio, and Text)
   */
  static async exportAndOpenLocalFile(
    file: LocalFileItem,
    onToast?: (msg: string) => void
  ): Promise<NativeExportResult> {
    // 0. Word File (.docx)
    if (file.isWord || file.extension === 'docx' || file.name.toLowerCase().endsWith('.docx')) {
      return await this.exportAndOpenWord({
        title: file.name.replace(/\.docx$/i, ''),
        htmlContent: file.htmlContent,
        fullText: file.textContent || '',
        fileName: file.name,
        onToast,
      });
    }

    // 1. Excel File (.xlsx)
    if (file.isExcel || file.extension === 'xlsx' || file.name.toLowerCase().endsWith('.xlsx')) {
      let table = file.tableData && file.tableData.length > 0 ? file.tableData : null;
      if (!table && file.textContent) {
        table = OcrService.parseTableFromText(file.textContent);
      }
      if (!table || table.length === 0) {
        table = [
          ['Item / Description', 'Details / Note', 'Date'],
          [file.name, file.textContent || 'Scanned Document', new Date().toLocaleDateString()],
        ];
      }
      return await this.exportAndOpenExcel({
        fileName: file.name,
        tableData: table,
        onToast,
      });
    }

    // 2. CSV File (.csv)
    if (file.isCsv || file.extension === 'csv' || file.name.toLowerCase().endsWith('.csv')) {
      let table = file.tableData && file.tableData.length > 0 ? file.tableData : null;
      if (!table && file.textContent) {
        table = OcrService.parseTableFromText(file.textContent);
      }
      if (!table || table.length === 0) {
        table = [
          ['Column 1', 'Column 2', 'Column 3'],
          ['Extracted CSV', file.name, new Date().toLocaleDateString()],
        ];
      }
      return await this.exportAndOpenCsv({
        fileName: file.name,
        tableData: table,
        onToast,
      });
    }

    // 3. PDF File (.pdf)
    if (file.isPdf || file.extension === 'pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      return await this.exportAndOpenPdf({
        title: file.name.replace(/\.pdf$/i, ''),
        ocrText: file.textContent || '',
        tableData: file.tableData,
        fileName: file.name,
        onToast,
      });
    }

    // 4. If dataUrl exists (Images, Audio, etc.)
    if (file.dataUrl) {
      let mime = 'application/octet-stream';
      if (file.name.endsWith('.png')) mime = 'image/png';
      else if (file.name.endsWith('.jpg') || file.name.endsWith('.jpeg')) mime = 'image/jpeg';
      else if (file.name.endsWith('.webm') || file.name.endsWith('.mp3')) mime = 'audio/webm';

      return await this.saveAndOpenNativeFile({
        fileName: file.name,
        base64Data: file.dataUrl,
        mimeType: mime,
        onToast,
      });
    }

    // 5. Default text file fallback
    const blob = new Blob([file.textContent || `File: ${file.name}`], { type: 'text/plain;charset=utf-8' });
    return await this.saveAndOpenNativeFile({
      fileName: file.name.includes('.') ? file.name : `${file.name}.txt`,
      blob,
      mimeType: 'text/plain',
      onToast,
    });
  }
}
