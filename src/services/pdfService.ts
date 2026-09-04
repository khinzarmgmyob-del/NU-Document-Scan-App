import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { OcrService } from './ocrService';
import { DocumentGridService } from './documentGridService';
import { ExportLayoutMode } from '../types';

/**
 * Standard font stack with full Myanmar Unicode & International script shaping
 */
const UNICODE_FONT_STACK =
  '"Pyidaungsu", "Myanmar Text", "Padauk", "Noto Sans Myanmar", "Segoe UI", -apple-system, BlinkMacSystemFont, "Roboto", "Helvetica Neue", Arial, sans-serif';

export class PdfService {
  /**
   * Generates a Pixel-Perfect PDF from structured HTML5 with Inline CSS
   */
  static async renderHtmlToPdf({
    title,
    htmlContent,
    customFileName,
    autoDownload = true,
  }: {
    title: string;
    htmlContent: string;
    customFileName?: string;
    autoDownload?: boolean;
  }): Promise<{ blob: Blob; fileName: string; dataUrl: string }> {
    const cleanName = (customFileName || title || 'Scanned_Document').replace(/[/\\?%*:|"<>]/g, '_');
    const fullFileName = cleanName.endsWith('.pdf') ? cleanName : `${cleanName}.pdf`;

    // 1. Create temporary container with standard A4 width
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '794px'; // Standard A4 at 96 DPI
    container.style.backgroundColor = '#FFFFFF';
    container.style.padding = '36px 42px';
    container.style.boxSizing = 'border-box';
    container.style.fontFamily = UNICODE_FONT_STACK;
    container.style.color = '#0f172a';
    container.style.lineHeight = '1.6';
    container.innerHTML = htmlContent;

    document.body.appendChild(container);

    try {
      // 2. Render to high-DPI canvas
      const canvas = await html2canvas(container, {
        scale: 2.0,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#FFFFFF',
        logging: false,
      });

      const a4WidthPt = 595.28;
      const a4HeightPt = 841.89;
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
        compress: true,
      });

      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const pageHeightPx = Math.round((canvasWidth * a4HeightPt) / a4WidthPt);

      let renderedHeight = 0;
      let pageIndex = 0;

      while (renderedHeight < canvasHeight) {
        if (pageIndex > 0) {
          pdf.addPage('a4', 'portrait');
        }

        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvasWidth;
        const currentSliceHeight = Math.min(pageHeightPx, canvasHeight - renderedHeight);
        sliceCanvas.height = currentSliceHeight;

        const sliceCtx = sliceCanvas.getContext('2d');
        if (sliceCtx) {
          sliceCtx.fillStyle = '#FFFFFF';
          sliceCtx.fillRect(0, 0, canvasWidth, currentSliceHeight);
          sliceCtx.drawImage(
            canvas,
            0,
            renderedHeight,
            canvasWidth,
            currentSliceHeight,
            0,
            0,
            canvasWidth,
            currentSliceHeight
          );

          const imgData = sliceCanvas.toDataURL('image/jpeg', 0.95);
          const sliceHeightPt = (currentSliceHeight * a4WidthPt) / canvasWidth;
          pdf.addImage(imgData, 'JPEG', 0, 0, a4WidthPt, sliceHeightPt, undefined, 'FAST');
        }

        renderedHeight += pageHeightPx;
        pageIndex++;
      }

      const blob = pdf.output('blob');
      const dataUrl = pdf.output('dataurlstring');

      if (autoDownload) {
        pdf.save(fullFileName);
      }

      return { blob, fileName: fullFileName, dataUrl };
    } finally {
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    }
  }

  /**
   * Generates a Document-Matching PDF in the selected layout mode with full multi-page pagination:
   * - 'reconstructed': 1:1 Pixel-Perfect Reconstructed HTML5 with tables, colspans/rowspans, and inline CSS
   * - 'framed': Document-Matching (Navy Banner, Rounded Cards, Green Ticks, Accent Bars, Yellow Note Boxes)
   * - 'text': Clean Text Flow (1:1 Text Flow Preview matching, Structured Bullet Points, Paragraphs & Headings)
   */
  static async generateAndSavePdf({
    title,
    ocrText,
    tableData,
    customFileName,
    layoutMode = 'framed',
    htmlContent,
    imageSrc,
    autoDownload = true,
  }: {
    title: string;
    imageSrc?: string;
    ocrText: string;
    tableData?: string[][];
    customFileName?: string;
    layoutMode?: ExportLayoutMode;
    htmlContent?: string;
    autoDownload?: boolean;
  }): Promise<{ blob: Blob; fileName: string; dataUrl: string }> {
    let documentTitle = title || 'Scanned Document';

    // 0. GEMINI AI SMART CELL & GRID CALCULATION ENGINE (Exact Borders, Colors, Rows, Spacing & Cell Alignment)
    if (layoutMode === 'ai_grid') {
      try {
        const gridData = await DocumentGridService.fetchAiGridData({
          imageBase64: imageSrc || undefined,
          ocrText,
          tableData,
          title: documentTitle,
        });

        const aiGridHtml = DocumentGridService.buildHtmlFromAiGrid(gridData, {
          isWord: false,
          containerPadding: '28px 36px',
        });

        return await this.renderHtmlToPdf({
          title: documentTitle,
          htmlContent: aiGridHtml,
          customFileName,
          autoDownload,
        });
      } catch (gridErr) {
        console.warn('AI Grid PDF export encountered error, falling back to layout:', gridErr);
      }
    }

    // 1. DUAL REVIEW MODE (Original Scanned Image + AI Reconstructed Layout)
    if (layoutMode === 'dual') {
      const dualHtml = `
        <div style="font-family: ${UNICODE_FONT_STACK}; color: #0f172a; padding: 12px 16px;">
          <!-- Dual Header -->
          <div style="background-color: #0B2A59; color: #ffffff; padding: 16px 20px; border-radius: 8px; margin-bottom: 24px; text-align: center;">
            <h1 style="margin: 0; font-size: 20px; font-weight: bold; color: #ffffff;">${documentTitle}</h1>
            <p style="margin: 6px 0 0; font-size: 12px; color: #93C5FD;">Dual Review Document • မူရင်းမှတ်တမ်းနှင့် OCR ပြန်လည်တည်ဆောက်မှု နှိုင်းယှဉ်ချက်</p>
          </div>

          <!-- Section 1: Original Scanned Image -->
          <div style="margin-bottom: 28px; border: 1.5px solid #cbd5e1; border-radius: 8px; overflow: hidden; background-color: #f8fafc;">
            <div style="background-color: #e2e8f0; padding: 10px 16px; font-weight: bold; font-size: 13px; color: #1e293b; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #cbd5e1;">
              <span>📸 ၁။ Original Scanned Capture (မူရင်းမှတ်တမ်း ဓာတ်ပုံ)</span>
              <span style="font-size: 11px; color: #64748b; font-weight: normal;">High Resolution</span>
            </div>
            <div style="padding: 16px; text-align: center; background-color: #ffffff;">
              ${imageSrc ? `<img src="${imageSrc}" style="max-width: 100%; max-height: 580px; object-fit: contain; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.12);" />` : '<p style="color: #94a3b8; font-style: italic;">(မူရင်းမှတ်တမ်း ဓာတ်ပုံ မရှိပါ)</p>'}
            </div>
          </div>

          <!-- Section 2: AI Reconstructed Document on Next Page -->
          <div style="page-break-before: always; padding-top: 12px;">
            <div style="background-color: #065F46; color: #ffffff; padding: 12px 18px; border-radius: 6px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: bold; font-size: 14px;">✨ ၂။ AI Reconstructed Document (1:1 ပြန်လည်တည်ဆောက်ထားသော စာရွက်စာတမ်း)</span>
              <span style="font-size: 11px; color: #A7F3D0;">OCR Layout &amp; Text</span>
            </div>
            <div style="background-color: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 20px;">
              ${htmlContent || `<div style="white-space: pre-wrap; line-height: 1.6; font-size: 12px;">${ocrText}</div>`}
            </div>
          </div>
        </div>
      `;

      try {
        return await this.renderHtmlToPdf({
          title,
          htmlContent: dualHtml,
          customFileName,
          autoDownload,
        });
      } catch (err) {
        console.warn('Dual HTML PDF rendering failed, falling back:', err);
      }
    }

    // 2. MATRIX MODE (Structured Table Matrix Grid)
    if (layoutMode === 'matrix') {
      let matrixRows = tableData || [];
      if (matrixRows.length === 0 && ocrText) {
        matrixRows = OcrService.parseTextToSpreadsheetMatrix(ocrText);
      }

      if (matrixRows.length > 0) {
        const matrixHtml = `
          <div style="font-family: ${UNICODE_FONT_STACK}; color: #0f172a; padding: 12px 16px;">
            <!-- Header Banner -->
            <div style="background-color: #0B2A59; color: #ffffff; padding: 18px 24px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 20px; font-weight: bold; color: #ffffff;">${documentTitle}</h1>
              <p style="margin: 6px 0 0; font-size: 12px; color: #93C5FD;">Structured Data Table Matrix • ဇယားကွက်အပြည့်အစုံ</p>
            </div>

            <!-- Table Matrix -->
            <table style="width: 100%; border-collapse: collapse; margin-top: 14px; border: 1.5px solid #0B2A59; font-size: 11px;">
              <thead>
                <tr style="background-color: #0B2A59; color: #ffffff;">
                  ${matrixRows[0].map(cell => `<th style="border: 1px solid #475569; padding: 9px 12px; font-weight: bold; font-size: 11.5px; text-align: left; background-color: #0B2A59; color: #ffffff;">${cell || ''}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${matrixRows.slice(1).map((row, rIdx) => `
                  <tr style="background-color: ${rIdx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                    ${row.map(c => `<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #1e293b; line-height: 1.5; font-size: 10.5px;">${c || ''}</td>`).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;

        try {
          return await this.renderHtmlToPdf({
            title,
            htmlContent: matrixHtml,
            customFileName,
            autoDownload,
          });
        } catch (err) {
          console.warn('Matrix HTML PDF rendering failed, falling back:', err);
        }
      }
    }

    // 3. RECONSTRUCTED MODE: If layout mode is 'reconstructed' and HTML content is provided, use pixel-perfect HTML renderer
    if ((layoutMode === 'reconstructed' || !layoutMode) && htmlContent && htmlContent.trim().length > 0) {
      try {
        return await this.renderHtmlToPdf({
          title,
          htmlContent,
          customFileName,
          autoDownload,
        });
      } catch (renderErr) {
        console.warn('HTML-to-PDF rendering failed, falling back to canvas layout:', renderErr);
      }
    }
    const cleanName = (customFileName || title || 'Scanned_Document').replace(/[/\\?%*:|"<>]/g, '_');
    const fullFileName = cleanName.endsWith('.pdf') ? cleanName : `${cleanName}.pdf`;

    // A4 dimensions at 2.5x scale for ultra-crisp, print-ready DPI quality
    const a4WidthPt = 595.28; // pt
    const a4HeightPt = 841.89; // pt
    const scale = 2.5;
    const canvasWidth = Math.round(a4WidthPt * scale); // 1488px
    const canvasHeight = Math.round(a4HeightPt * scale); // 2105px

    const pageMarginX = 32 * scale;
    const contentWidth = canvasWidth - pageMarginX * 2;
    const topMargin = 28 * scale;
    const bottomMargin = 40 * scale;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4',
      compress: true,
    });

    const pages: HTMLCanvasElement[] = [];

    const createNewPageCanvas = (): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } => {
      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      return { canvas, ctx };
    };

    // Helper: Draw Rounded Rectangle with optional stroke and fill
    const drawRoundedRect = (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      w: number,
      h: number,
      r: number,
      fillColor?: string,
      strokeColor?: string,
      lineWidth?: number
    ) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();

      if (fillColor) {
        ctx.fillStyle = fillColor;
        ctx.fill();
      }
      if (strokeColor) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth || 1 * scale;
        ctx.stroke();
      }
    };

    // Helper: Split text into wrapped lines given a max width
    const getWrappedLines = (
      ctx: CanvasRenderingContext2D,
      text: string,
      maxWidth: number,
      font: string
    ): string[] => {
      ctx.font = font;
      if (!text || text.trim().length === 0) return [''];
      const words = text.split(' ');
      const lines: string[] = [];
      let currentLine = '';

      for (let i = 0; i < words.length; i++) {
        const testLine = currentLine ? `${currentLine} ${words[i]}` : words[i];
        if (ctx.measureText(testLine).width > maxWidth && currentLine.length > 0) {
          lines.push(currentLine);
          currentLine = words[i];
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        lines.push(currentLine);
      }
      return lines.length > 0 ? lines : [text];
    };

    // Parse text to structured document model (clean document sections only, no attached table matrix)
    const parsedDoc = OcrService.parseTextToSections(ocrText);
    documentTitle = parsedDoc.title || documentTitle;
    const documentSubtitle = parsedDoc.subtitle || '';

    // Strictly filter out any table blocks or matrix sections from PDF output
    parsedDoc.sections = (parsedDoc.sections || []).filter(
      (sec) =>
        sec.type !== 'table' &&
        !sec.table &&
        !sec.title?.toLowerCase().includes('matrix') &&
        !sec.title?.includes('ဇယားကွက်') &&
        !sec.title?.toLowerCase().includes('table')
    );

    let { canvas: curCanvas, ctx: curCtx } = createNewPageCanvas();
    let curY = 0;

    // Helper: Page breaker when approaching bottom
    const checkAndBreakPage = (neededHeight: number): void => {
      if (curY + neededHeight > canvasHeight - bottomMargin) {
        pages.push(curCanvas);
        const newPage = createNewPageCanvas();
        curCanvas = newPage.canvas;
        curCtx = newPage.ctx;

        // Draw top mini-header for continuation pages
        curCtx.fillStyle = '#0B2A59';
        curCtx.fillRect(0, 0, canvasWidth, 32 * scale);

        curCtx.font = `bold ${10 * scale}px ${UNICODE_FONT_STACK}`;
        curCtx.fillStyle = '#FFFFFF';
        curCtx.textAlign = 'center';
        curCtx.textBaseline = 'middle';
        curCtx.fillText(`${documentTitle} (Cont.)`, canvasWidth / 2, 16 * scale);

        curCtx.textAlign = 'left';
        curCtx.textBaseline = 'top';
        curY = 48 * scale;
      }
    };

    // --- 1. TOP HEADER BANNER (Deep Navy `#0B2A59`) on Page 1 ---
    const bannerHeight = documentSubtitle ? 84 * scale : 62 * scale;
    curCtx.fillStyle = '#0B2A59';
    curCtx.fillRect(0, 0, canvasWidth, bannerHeight);

    // Document Main Title
    curCtx.font = `bold ${16.5 * scale}px ${UNICODE_FONT_STACK}`;
    curCtx.fillStyle = '#FFFFFF';
    curCtx.textAlign = 'center';
    curCtx.textBaseline = 'middle';
    curCtx.fillText(documentTitle, canvasWidth / 2, documentSubtitle ? 32 * scale : 31 * scale);

    // Document Subtitle
    if (documentSubtitle) {
      curCtx.font = `normal ${10.5 * scale}px ${UNICODE_FONT_STACK}`;
      curCtx.fillStyle = '#93C5FD'; // Light Ice Blue
      curCtx.fillText(documentSubtitle, canvasWidth / 2, 58 * scale);
    }

    curCtx.textAlign = 'left';
    curCtx.textBaseline = 'top';
    curY = bannerHeight + 20 * scale;

    // Normalize layout: PDF output strictly uses clean document formats ('framed' or 'text') without matrix tables
    const effectiveLayoutMode: 'framed' | 'text' = layoutMode === 'text' ? 'text' : 'framed';

    // =========================================================================
    // MODE A: CLEAN TEXT FLOW TYPOGRAPHY (1:1 Document & Preview Matching)
    // =========================================================================
    if (effectiveLayoutMode === 'text') {
      // Split raw OCR text lines or parsed sections to ensure 100% of all text is printed
      const rawLines = (ocrText || '').split('\n');

      for (let lIdx = 0; lIdx < rawLines.length; lIdx++) {
        const line = rawLines[lIdx].trim();

        // 1. Empty Line / Paragraph Spacing
        if (!line) {
          curY += 8 * scale;
          checkAndBreakPage(20 * scale);
          continue;
        }

        // 2. Note Box (starts with မှတ်ချက်, *, Note:)
        if (line.startsWith('မှတ်ချက်') || line.startsWith('Note:') || (line.startsWith('*') && line.length > 5)) {
          const noteText = line.replace(/^\*\s*/, '');
          const noteLines = getWrappedLines(curCtx, noteText, contentWidth - 28 * scale, `normal ${9.4 * scale}px ${UNICODE_FONT_STACK}`);
          const noteH = noteLines.length * 15 * scale + 14 * scale;

          checkAndBreakPage(noteH + 10 * scale);

          drawRoundedRect(curCtx, pageMarginX, curY, contentWidth, noteH, 6 * scale, '#FEF9C3', '#FDE047', 1.2 * scale);

          curCtx.font = `normal ${9.4 * scale}px ${UNICODE_FONT_STACK}`;
          curCtx.fillStyle = '#854D0E';
          let ny = curY + 7 * scale;
          for (const nl of noteLines) {
            curCtx.fillText(nl, pageMarginX + 12 * scale, ny);
            ny += 15 * scale;
          }
          curY += noteH + 10 * scale;
          continue;
        }

        // 3. Inline Table Line (contains |)
        if (line.includes('|')) {
          const cells = line.split('|').map(c => c.trim()).filter(Boolean);
          if (cells.length >= 2) {
            const rowH = 22 * scale;
            const colW = contentWidth / cells.length;

            checkAndBreakPage(rowH + 4 * scale);

            curCtx.fillStyle = '#F8FAFC';
            curCtx.fillRect(pageMarginX, curY, contentWidth, rowH);
            curCtx.strokeStyle = '#E2E8F0';
            curCtx.strokeRect(pageMarginX, curY, contentWidth, rowH);

            curCtx.font = `normal ${9.2 * scale}px ${UNICODE_FONT_STACK}`;
            curCtx.fillStyle = '#1E293B';
            for (let c = 0; c < cells.length; c++) {
              curCtx.fillText(cells[c], pageMarginX + c * colW + 8 * scale, curY + 4 * scale);
            }
            curY += rowH + 2 * scale;
            continue;
          }
        }

        // 4. Bullet Items (starts with ✔, •, -, —, 1., 2.)
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

          const subLines = subtext
            ? getWrappedLines(curCtx, subtext, contentWidth - 32 * scale, `normal ${9.2 * scale}px ${UNICODE_FONT_STACK}`)
            : [];

          const itemHeight = 18 * scale + subLines.length * 14 * scale + 6 * scale;
          checkAndBreakPage(itemHeight);

          // Checkmark / Bullet Icon
          curCtx.font = `bold ${10 * scale}px ${UNICODE_FONT_STACK}`;
          curCtx.fillStyle = '#059669'; // Emerald Check/Bullet
          curCtx.fillText(line.startsWith('✔') ? '✔' : '•', pageMarginX + 4 * scale, curY);

          // Bullet Title
          curCtx.font = `bold ${10.2 * scale}px ${UNICODE_FONT_STACK}`;
          curCtx.fillStyle = '#0F172A';
          curCtx.fillText(cleanText, pageMarginX + 18 * scale, curY);
          curY += 16 * scale;

          // Subtext / Description
          if (subLines.length > 0) {
            curCtx.font = `normal ${9.2 * scale}px ${UNICODE_FONT_STACK}`;
            curCtx.fillStyle = '#475569';
            for (const sl of subLines) {
              curCtx.fillText(sl, pageMarginX + 22 * scale, curY);
              curY += 14 * scale;
            }
          }

          curY += 6 * scale;
          continue;
        }

        // 5. Section Heading Candidates (Major sections, Guide topics, etc.)
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
            line.includes('Option') ||
            lIdx === 0 ||
            lIdx === 1);

        if (isHeading) {
          const headingText = line.replace(/^[▶#\s]+/, '').trim();
          const headH = 34 * scale;
          checkAndBreakPage(headH);

          curY += 6 * scale;
          // Left Accent Pill
          curCtx.fillStyle = '#2563EB';
          curCtx.fillRect(pageMarginX, curY + 2 * scale, 3.5 * scale, 14 * scale);

          // Heading Title
          curCtx.font = `bold ${11.5 * scale}px ${UNICODE_FONT_STACK}`;
          curCtx.fillStyle = '#0B2A59';
          curCtx.fillText(headingText, pageMarginX + 10 * scale, curY);
          curY += 18 * scale;

          // Subtle Divider Line
          curCtx.strokeStyle = '#E2E8F0';
          curCtx.lineWidth = 1 * scale;
          curCtx.beginPath();
          curCtx.moveTo(pageMarginX + 10 * scale, curY);
          curCtx.lineTo(pageMarginX + contentWidth, curY);
          curCtx.stroke();

          curY += 10 * scale;
          continue;
        }

        // 6. Normal Paragraph Line
        const paraLines = getWrappedLines(curCtx, line, contentWidth, `normal ${9.5 * scale}px ${UNICODE_FONT_STACK}`);
        const paraH = paraLines.length * 15 * scale + 4 * scale;
        checkAndBreakPage(paraH);

        curCtx.font = `normal ${9.5 * scale}px ${UNICODE_FONT_STACK}`;
        curCtx.fillStyle = '#1E293B';
        for (const pl of paraLines) {
          curCtx.fillText(pl, pageMarginX, curY);
          curY += 15 * scale;
        }
        curY += 4 * scale;
      }
    }

    // =========================================================================
    // MODE B: FRAMED CARDS (100% RAW PHOTO MATCH & SOP MATRIX)
    // =========================================================================
    else {
      for (const section of parsedDoc.sections) {
        // Standalone bottom text callout
        if (
          section.title &&
          (section.title.includes('RDPNight') || section.title.includes('ရေရှည်') || section.title.includes('Solution')) &&
          (!section.items || section.items.length === 0) &&
          !section.content
        ) {
          checkAndBreakPage(35 * scale);
          curCtx.font = `bold ${12.5 * scale}px ${UNICODE_FONT_STACK}`;
          curCtx.fillStyle = '#1E3A8A';
          curCtx.fillText(section.title, pageMarginX + 4 * scale, curY);
          curY += 28 * scale;
          continue;
        }

        // Determine Theme Colors
        const isDanger = section.type === 'danger_box' || section.colorTheme === 'red';
        const isWarning = section.type === 'warning_box' || section.colorTheme === 'yellow' || section.colorTheme === 'amber';
        const isOption = section.title && (section.title.includes('ရွေးချယ်စရာ') || section.title.includes('Option'));

        let cardTitleColor = '#1E3A8A';
        let accentBarColor: string | null = '#2563EB';

        if (isDanger) {
          cardTitleColor = '#991B1B';
          accentBarColor = '#DC2626';
        } else if (isWarning || isOption) {
          cardTitleColor = '#0F172A';
          accentBarColor = null;
        }

        // Pre-calculate Card Height
        const cardPaddingX = 14 * scale;
        const cardPaddingY = 12 * scale;
        const textX = pageMarginX + cardPaddingX;
        const maxInnerW = contentWidth - cardPaddingX * 2;

        let totalInnerH = 0;
        if (section.title) {
          totalInnerH += 24 * scale;
        }

        const itemsData: {
          tickText: string;
          titlePart: string;
          subtextLines: string[];
          isCheck: boolean;
        }[] = [];

        if (section.items && section.items.length > 0) {
          for (const item of section.items) {
            let titlePart = item.text;
            let subtext = item.subtext || '';

            if (!subtext) {
              if (titlePart.includes('–')) {
                const parts = titlePart.split('–');
                titlePart = parts[0].trim();
                subtext = parts.slice(1).join('–').trim();
              } else if (titlePart.includes(': ')) {
                const parts = titlePart.split(': ');
                titlePart = parts[0].trim();
                subtext = parts.slice(1).join(': ').trim();
              }
            }

            const subtextLines = subtext
              ? getWrappedLines(
                  curCtx,
                  `- ${subtext}`,
                  maxInnerW - 22 * scale,
                  `normal ${9.4 * scale}px ${UNICODE_FONT_STACK}`
                )
              : [];

            itemsData.push({
              tickText: titlePart,
              titlePart,
              subtextLines,
              isCheck: item.isCheck !== false,
            });

            totalInnerH += 20 * scale;
            totalInnerH += subtextLines.length * 15 * scale;
            totalInnerH += 6 * scale;
          }
        }

        let noteLines: string[] = [];
        let noteBoxH = 0;
        if (section.content) {
          noteLines = getWrappedLines(
            curCtx,
            section.content,
            maxInnerW - 18 * scale,
            `normal ${9.2 * scale}px ${UNICODE_FONT_STACK}`
          );
          noteBoxH = noteLines.length * 15 * scale + 14 * scale;
          totalInnerH += noteBoxH + 8 * scale;
        }

        const totalCardH = totalInnerH + cardPaddingY * 2;

        // Check if card fits on page
        checkAndBreakPage(totalCardH + 10 * scale);

        // Draw Card Background
        drawRoundedRect(
          curCtx,
          pageMarginX,
          curY,
          contentWidth,
          totalCardH,
          8 * scale,
          '#FFFFFF',
          '#E2E8F0',
          1.2 * scale
        );

        // Render contents inside Card
        let insideY = curY + cardPaddingY;

        if (section.title) {
          if (accentBarColor) {
            curCtx.fillStyle = accentBarColor;
            curCtx.fillRect(textX, insideY + 1 * scale, 3.5 * scale, 15 * scale);
          }

          const titleDrawX = accentBarColor ? textX + 10 * scale : textX;

          curCtx.font = `bold ${11.5 * scale}px ${UNICODE_FONT_STACK}`;
          curCtx.fillStyle = cardTitleColor;
          curCtx.fillText(section.title, titleDrawX, insideY);

          insideY += 24 * scale;
        }

        for (const item of itemsData) {
          curCtx.font = `bold ${11 * scale}px ${UNICODE_FONT_STACK}`;
          curCtx.fillStyle = '#16A34A';
          curCtx.fillText('✔', textX, insideY);

          curCtx.font = `bold ${10 * scale}px ${UNICODE_FONT_STACK}`;
          curCtx.fillStyle = '#0F172A';
          curCtx.fillText(item.titlePart, textX + 18 * scale, insideY);

          insideY += 18 * scale;

          if (item.subtextLines.length > 0) {
            curCtx.font = `normal ${9.4 * scale}px ${UNICODE_FONT_STACK}`;
            curCtx.fillStyle = '#475569';
            for (const sLine of item.subtextLines) {
              curCtx.fillText(sLine, textX + 18 * scale, insideY);
              insideY += 15 * scale;
            }
          }

          insideY += 6 * scale;
        }

        if (section.content && noteLines.length > 0) {
          insideY += 2 * scale;
          drawRoundedRect(
            curCtx,
            textX,
            insideY,
            maxInnerW,
            noteBoxH,
            5 * scale,
            '#FEF9C3',
            '#FDE047',
            1 * scale
          );

          curCtx.font = `normal ${9.2 * scale}px ${UNICODE_FONT_STACK}`;
          curCtx.fillStyle = '#854D0E';

          let noteTextY = insideY + 7 * scale;
          for (const nLine of noteLines) {
            curCtx.fillText(nLine, textX + 8 * scale, noteTextY);
            noteTextY += 15 * scale;
          }

          insideY += noteBoxH + 4 * scale;
        }

        curY += totalCardH + 15 * scale;
      }
    }

    // Push the last page
    pages.push(curCanvas);

    // Render Clean Footers on all pages
    const totalPagesCount = pages.length;
    for (let p = 0; p < totalPagesCount; p++) {
      const pCtx = pages[p].getContext('2d')!;
      pCtx.font = `normal ${8.5 * scale}px ${UNICODE_FONT_STACK}`;
      pCtx.fillStyle = '#94A3B8';
      pCtx.textAlign = 'left';
      pCtx.fillText('NextUnit DocuScan & Spreadsheet OCR', pageMarginX, canvasHeight - 20 * scale);

      pCtx.textAlign = 'right';
      pCtx.fillText(`Page ${p + 1} of ${totalPagesCount}`, canvasWidth - pageMarginX, canvasHeight - 20 * scale);
    }

    // Assemble all high-res canvas pages into jsPDF
    for (let p = 0; p < pages.length; p++) {
      if (p > 0) {
        doc.addPage('a4', 'portrait');
      }
      const pageDataUrl = pages[p].toDataURL('image/jpeg', 0.98);
      doc.addImage(pageDataUrl, 'JPEG', 0, 0, a4WidthPt, a4HeightPt, undefined, 'FAST');
    }

    const blob = doc.output('blob');
    const dataUrl = doc.output('datauristring');

    // Trigger download in browser if autoDownload is true
    if (autoDownload) {
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
    }

    return { blob, fileName: fullFileName, dataUrl };
  }

  /**
   * Prints the generated PDF document
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
