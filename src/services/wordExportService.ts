import { ExportLayoutMode } from '../types';
import { OcrService } from './ocrService';

/**
 * Microsoft Word (.docx / Office HTML) Document Generation Service
 * 
 * Takes structured document data, verbatim text, and HTML5 with tables, colspans/rowspans,
 * borders, colors, and Myanmar Unicode styling, and compiles it into an official Microsoft Word
 * document that opens natively in Microsoft Word (Desktop & Mobile), Google Docs, Apple Pages,
 * and WPS Office.
 */

export class WordExportService {
  /**
   * Generates a Word-compatible document blob from HTML / Reconstructed Document
   */
  static generateWordBlob({
    title,
    htmlContent,
    fullText,
    subtitle,
    imageSrc,
    tableData,
    layoutMode = 'reconstructed',
  }: {
    title: string;
    htmlContent?: string;
    fullText?: string;
    subtitle?: string;
    imageSrc?: string | null;
    tableData?: string[][];
    layoutMode?: ExportLayoutMode;
  }): Blob {
    const cleanTitle = (title || 'Document').replace(/[/\\?%*:|"<>]/g, '_');

    let contentHtml = '';

    // 1. Matrix Layout in Word (Structured Table Matrix Grid)
    if (layoutMode === 'matrix') {
      let matrixRows = tableData || [];
      if (matrixRows.length === 0 && fullText) {
        matrixRows = OcrService.parseTextToSpreadsheetMatrix(fullText);
      }

      const tableHtml = matrixRows.length > 0
        ? `
          <table style="border-collapse: collapse; width: 100%; margin: 16pt 0; border: 1.5pt solid #0f172a;">
            <thead>
              <tr style="background-color: #0B2A59; color: #ffffff;">
                ${matrixRows[0].map(cell => `<th style="border: 1pt solid #cbd5e1; padding: 8pt 10pt; background-color: #0B2A59; color: #ffffff; font-weight: bold; font-size: 11pt; text-align: left;">${cell || ''}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${matrixRows.slice(1).map((row, rIdx) => `
                <tr style="background-color: ${rIdx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                  ${row.map(c => `<td style="border: 1pt solid #cbd5e1; padding: 7pt 10pt; font-size: 10pt; color: #1e293b;">${c || ''}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        `
        : '<p>No table matrix data available.</p>';

      contentHtml = `
        <div style="margin-bottom: 14pt;">
          <h1 style="color: #0B2A59; font-size: 19pt; margin-bottom: 4pt;">${cleanTitle}</h1>
          <p style="color: #64748b; font-size: 11pt; margin-top: 0;">Structured Data Table Matrix (ဇယားကွက်အပြည့်အစုံ)</p>
          <hr style="border: 0; border-top: 2pt solid #0B2A59; margin: 8pt 0 16pt 0;" />
        </div>
        ${tableHtml}
      `;
    }
    // 2. Dual Review Layout in Word (Side-by-Side Scan & OCR Reconstructed)
    else if (layoutMode === 'dual') {
      const ocrBody = htmlContent || (fullText ? fullText.split('\n').map(l => `<p style="margin: 4pt 0;">${l}</p>`).join('') : '<p>Extracted OCR content</p>');

      contentHtml = `
        <div style="margin-bottom: 16pt;">
          <h1 style="color: #0B2A59; font-size: 18pt; margin-bottom: 4pt;">${cleanTitle} - Dual Review Document</h1>
          <p style="color: #64748b; font-size: 11pt; margin-top: 0;">Original Scanned Image &amp; AI Reconstructed Layout</p>
          <hr style="border: 0; border-top: 2pt solid #0B2A59; margin: 8pt 0 16pt 0;" />
        </div>

        <div style="margin-bottom: 24pt;">
          <h2 style="color: #0B2A59; font-size: 14pt; border-left: 4pt solid #0B2A59; padding-left: 8pt;">📸 1. Original Scanned Capture (မူရင်းမှတ်တမ်း ဓာတ်ပုံ)</h2>
          ${imageSrc
            ? `<div style="text-align: center; margin: 12pt 0; padding: 8pt; border: 1pt solid #cbd5e1; background-color: #f8fafc;">
                 <img src="${imageSrc}" style="max-width: 480pt; height: auto;" alt="Scanned Original" />
               </div>`
            : '<p style="color: #94a3b8; font-style: italic;">(No image file provided)</p>'
          }
        </div>

        <br clear="all" style="page-break-before:always;" />

        <div style="margin-top: 16pt;">
          <h2 style="color: #059669; font-size: 14pt; border-left: 4pt solid #059669; padding-left: 8pt;">✨ 2. AI Reconstructed Document (1:1 ပြန်လည်တည်ဆောက်ထားသော စာရွက်စာတမ်း)</h2>
          <div style="margin-top: 12pt;">
            ${ocrBody}
          </div>
        </div>
      `;
    }
    // 3. Reconstructed HTML Layout
    else if (htmlContent && layoutMode === 'reconstructed') {
      contentHtml = htmlContent;
    }
    // 4. Framed / Text Flow Fallback
    else if (fullText) {
      // Build clean HTML from plain text
      const lines = fullText.split('\n');
      const paragraphs = lines
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed) return '<p style="margin: 6pt 0;">&nbsp;</p>';
          if (trimmed.startsWith('✔') || trimmed.startsWith('•') || trimmed.startsWith('-')) {
            return `<p style="margin: 3pt 0 3pt 18pt; text-indent: -12pt;">${trimmed}</p>`;
          }
          if (trimmed.length < 50 && !trimmed.endsWith('.')) {
            return `<h3 style="margin: 12pt 0 4pt; color: #1e3a8a; font-size: 13pt;">${trimmed}</h3>`;
          }
          return `<p style="margin: 4pt 0; line-height: 1.6;">${trimmed}</p>`;
        })
        .join('\n');

      contentHtml = `
        <div style="margin-bottom: 16pt;">
          <h1 style="color: #0f172a; font-size: 20pt; margin-bottom: 4pt;">${cleanTitle}</h1>
          ${subtitle ? `<p style="color: #64748b; font-size: 12pt; margin-top: 0;">${subtitle}</p>` : ''}
          <hr style="border: 0; border-top: 1.5pt solid #cbd5e1; margin: 12pt 0 16pt 0;" />
        </div>
        <div>${paragraphs}</div>
      `;
    } else {
      contentHtml = htmlContent || `<p>${cleanTitle}</p>`;
    }

    const wordXml = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' 
      xmlns:w='urn:schemas-microsoft-com:office:word' 
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <title>${cleanTitle}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page Section1 {
      size: 595.3pt 841.9pt; /* A4 Portrait */
      margin: 1.0in 1.0in 1.0in 1.0in;
      mso-header-margin: .5in;
      mso-footer-margin: .5in;
      mso-paper-source: 0;
    }
    div.Section1 { page: Section1; }
    body {
      font-family: 'Pyidaungsu', 'Myanmar Text', 'Noto Sans Myanmar', 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      color: #0f172a;
      line-height: 1.6;
    }
    h1 { font-size: 18pt; color: #0f172a; margin-top: 0; margin-bottom: 6pt; }
    h2 { font-size: 14pt; color: #1e293b; margin-top: 14pt; margin-bottom: 6pt; }
    h3 { font-size: 12pt; color: #334155; margin-top: 10pt; margin-bottom: 4pt; }
    p { margin: 4pt 0; }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 12pt 0;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    th, td {
      border: 1pt solid #cbd5e1;
      padding: 6pt 10pt;
      vertical-align: top;
      font-size: 10.5pt;
    }
    th {
      background-color: #f1f5f9;
      font-weight: bold;
      text-align: center;
      color: #0f172a;
    }
    .callout-box {
      border-left: 4pt solid #3b82f6;
      background-color: #eff6ff;
      padding: 8pt 12pt;
      margin: 10pt 0;
    }
  </style>
</head>
<body>
  <div class="Section1">
    ${contentHtml}
  </div>
</body>
</html>`;

    return new Blob([wordXml], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document;charset=utf-8',
    });
  }

  /**
   * Generates and downloads a .docx Word document
   */
  static generateAndSaveWord({
    title,
    htmlContent,
    fullText,
    subtitle,
    imageSrc,
    tableData,
    layoutMode = 'reconstructed',
    customFileName,
    autoDownload = true,
  }: {
    title: string;
    htmlContent?: string;
    fullText?: string;
    subtitle?: string;
    imageSrc?: string | null;
    tableData?: string[][];
    layoutMode?: ExportLayoutMode;
    customFileName?: string;
    autoDownload?: boolean;
  }): { blob: Blob; fileName: string; dataUrl: string } {
    const cleanName = (customFileName || title || 'Scanned_Document').replace(/[/\\?%*:|"<>]/g, '_');
    const fileName = cleanName.endsWith('.docx') ? cleanName : `${cleanName}.docx`;

    const blob = this.generateWordBlob({
      title: cleanName,
      htmlContent,
      fullText,
      subtitle,
      imageSrc,
      tableData,
      layoutMode,
    });

    const dataUrl = URL.createObjectURL(blob);

    if (autoDownload) {
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(dataUrl);
      }, 500);
    }

    return { blob, fileName, dataUrl };
  }
}
