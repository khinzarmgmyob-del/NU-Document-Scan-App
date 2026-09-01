import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { OcrService } from './ocrService';

export class PdfService {
  /**
   * Generates a structured, searchable PDF containing the scanned image,
   * formatted OCR text, and extracted table matrix with clear borders and columns.
   */
  static async generateAndSavePdf({
    title,
    imageSrc,
    ocrText,
    tableData,
    customFileName,
  }: {
    title: string;
    imageSrc?: string;
    ocrText: string;
    tableData?: string[][];
    customFileName?: string;
  }): Promise<{ blob: Blob; fileName: string; dataUrl: string }> {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const cleanName = (customFileName || title).replace(/[^a-zA-Z0-9_\-]/g, '_');
    const fullFileName = `${cleanName}.pdf`;

    const pageWidth = doc.internal.pageSize.getWidth();
    let currentY = 20;

    // Header Background Accent Bar (Emerald)
    doc.setFillColor(16, 185, 129); // #10B981 Emerald
    doc.rect(14, 14, pageWidth - 28, 3.5, 'F');

    currentY = 25;

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(6, 78, 59); // Dark Emerald #064E3B
    doc.text(title, 14, currentY);

    // Date & Time right-aligned
    const dateStr = new Date().toLocaleString();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(dateStr, pageWidth - 14, currentY, { align: 'right' });

    currentY += 6;
    doc.setFontSize(9.5);
    doc.setTextColor(52, 211, 153);
    doc.text('NextUnit DocuScan Archive • OCR Table Matrix & Extraction', 14, currentY);

    currentY += 7;
    doc.setDrawColor(209, 250, 229);
    doc.setLineWidth(0.5);
    doc.line(14, currentY, pageWidth - 14, currentY);

    currentY += 8;

    // Extracted Line Items Matrix (Table Data with Clear Borders & Columns directly on Page 1)
    let rowsToRender: string[][] = [];
    if (tableData && tableData.length > 0) {
      rowsToRender = OcrService.normalizeTable(tableData);
    } else if (ocrText && ocrText.trim().length > 0) {
      // Fallback: parse OCR text lines as rows
      rowsToRender = ocrText
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .map(l => [l]);
    }

    if (rowsToRender.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text('EXTRACTED DATA TABLE & COLUMNS', 14, currentY);
      currentY += 4.5;

      const head = [rowsToRender[0]];
      const body = rowsToRender.slice(1);

      autoTable(doc, {
        startY: currentY,
        head: head,
        body: body.length > 0 ? body : [['(No data rows)'] as string[]],
        theme: 'grid',
        tableLineWidth: 0.2,
        tableLineColor: [203, 213, 225],
        headStyles: {
          fillColor: [5, 150, 105], // #059669 Teal-Emerald
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8.5,
          halign: 'left',
          lineWidth: 0.2,
          lineColor: [4, 120, 87],
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [30, 41, 59],
          lineWidth: 0.15,
          lineColor: [226, 232, 240],
        },
        alternateRowStyles: {
          fillColor: [240, 253, 244], // Light Emerald tint
        },
        margin: { left: 14, right: 14 },
      });
    }

    const blob = doc.output('blob');
    const dataUrl = doc.output('datauristring');

    // Trigger download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fullFileName;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 200);

    return { blob, fileName: fullFileName, dataUrl };
  }

  /**
   * Prints the generated PDF document in a new print iframe
   */
  static printPdfBlob(blob: Blob): void {
    const blobUrl = URL.createObjectURL(blob);
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.src = blobUrl;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    };
  }

  /**
   * Opens the PDF in a new tab
   */
  static openPdfInNewTab(blob: Blob): void {
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }
}
