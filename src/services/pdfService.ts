import { jsPDF } from 'jspdf';
import { OcrService } from './ocrService';
import { ExportLayoutMode } from '../types';

/**
 * Standard font stack with full Myanmar Unicode & International script shaping
 */
const UNICODE_FONT_STACK =
  '"Pyidaungsu", "Myanmar Text", "Padauk", "Noto Sans Myanmar", "Segoe UI", -apple-system, BlinkMacSystemFont, "Roboto", "Helvetica Neue", Arial, sans-serif';

export class PdfService {
  /**
   * Generates a Document-Matching PDF in the selected layout mode with full multi-page pagination:
   * - 'framed': 100% Raw Document-Matching (Navy Banner, Rounded Cards, Green Ticks, Accent Bars, Yellow Note Boxes)
   * - 'text': Clean Text Flow (1:1 Text Flow Preview matching, Structured Bullet Points, Paragraphs & Headings)
   * - 'matrix': Structured Table Matrix (Unified Data Grid with Columns: No, Section, Topic, Details/Action)
   */
  static async generateAndSavePdf({
    title,
    ocrText,
    tableData,
    customFileName,
    layoutMode = 'framed',
    autoDownload = true,
  }: {
    title: string;
    imageSrc?: string;
    ocrText: string;
    tableData?: string[][];
    customFileName?: string;
    layoutMode?: ExportLayoutMode;
    autoDownload?: boolean;
  }): Promise<{ blob: Blob; fileName: string; dataUrl: string }> {
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

    // Parse text to structured document model
    const parsedDoc = OcrService.parseTextToSections(ocrText, tableData);
    const documentTitle = parsedDoc.title || title || 'Scanned Document';
    const documentSubtitle = parsedDoc.subtitle || '';

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

    // =========================================================================
    // MODE A: STRUCTURED TABLE MATRIX (FULL GRID)
    // =========================================================================
    if (layoutMode === 'matrix') {
      const colWidths = [
        38 * scale,   // No
        120 * scale,  // Section
        150 * scale,  // Topic
        contentWidth - (38 + 120 + 150) * scale, // Details / Subtext
      ];

      const headers = ['စဉ် (No)', 'ကဏ္ဍ (Section)', 'ခေါင်းစဉ် / အကြောင်းအရာ (Topic)', 'အသေးစိတ် ရှင်းလင်းချက် (Details / Notes)'];
      const headerH = 28 * scale;

      const drawMatrixHeader = (y: number) => {
        curCtx.fillStyle = '#0B2A59';
        curCtx.fillRect(pageMarginX, y, contentWidth, headerH);

        let colX = pageMarginX;
        curCtx.font = `bold ${9.5 * scale}px ${UNICODE_FONT_STACK}`;
        curCtx.fillStyle = '#FFFFFF';
        curCtx.textBaseline = 'middle';

        for (let i = 0; i < headers.length; i++) {
          curCtx.fillText(headers[i], colX + 6 * scale, y + headerH / 2);
          colX += colWidths[i];
          if (i < headers.length - 1) {
            curCtx.strokeStyle = '#1E3A8A';
            curCtx.beginPath();
            curCtx.moveTo(colX, y);
            curCtx.lineTo(colX, y + headerH);
            curCtx.stroke();
          }
        }
        curCtx.textBaseline = 'top';
      };

      drawMatrixHeader(curY);
      curY += headerH;

      let rowCounter = 1;

      for (const sec of parsedDoc.sections) {
        if (sec.type === 'table' && sec.table && sec.table.length > 0) {
          for (let r = 1; r < sec.table.length; r++) {
            const row = sec.table[r];
            const topic = row[0] || row[1] || '';
            const details = row.slice(1).join(' | ');

            const detailLines = getWrappedLines(curCtx, details, colWidths[3] - 12 * scale, `normal ${9 * scale}px ${UNICODE_FONT_STACK}`);
            const rowH = Math.max(22 * scale, detailLines.length * 14 * scale + 10 * scale);

            checkAndBreakPage(rowH + headerH);
            if (curY === 48 * scale) {
              drawMatrixHeader(curY);
              curY += headerH;
            }

            curCtx.fillStyle = rowCounter % 2 === 1 ? '#F8FAFC' : '#FFFFFF';
            curCtx.fillRect(pageMarginX, curY, contentWidth, rowH);
            curCtx.strokeStyle = '#CBD5E1';
            curCtx.lineWidth = 0.8 * scale;
            curCtx.strokeRect(pageMarginX, curY, contentWidth, rowH);

            let colX = pageMarginX;
            // No
            curCtx.font = `bold ${9 * scale}px ${UNICODE_FONT_STACK}`;
            curCtx.fillStyle = '#64748B';
            curCtx.fillText(String(rowCounter++), colX + 6 * scale, curY + 6 * scale);
            colX += colWidths[0];

            // Section
            curCtx.font = `bold ${9 * scale}px ${UNICODE_FONT_STACK}`;
            curCtx.fillStyle = '#1E3A8A';
            curCtx.fillText(sec.title || 'Table Matrix', colX + 6 * scale, curY + 6 * scale);
            colX += colWidths[1];

            // Topic
            curCtx.font = `normal ${9 * scale}px ${UNICODE_FONT_STACK}`;
            curCtx.fillStyle = '#0F172A';
            curCtx.fillText(topic, colX + 6 * scale, curY + 6 * scale);
            colX += colWidths[2];

            // Details
            curCtx.font = `normal ${9 * scale}px ${UNICODE_FONT_STACK}`;
            curCtx.fillStyle = '#334155';
            let dy = curY + 6 * scale;
            for (const dl of detailLines) {
              curCtx.fillText(dl, colX + 6 * scale, dy);
              dy += 14 * scale;
            }

            curY += rowH;
          }
        } else if (sec.items && sec.items.length > 0) {
          for (const item of sec.items) {
            const topic = item.text;
            const subtext = item.subtext || '';
            const detailLines = getWrappedLines(curCtx, subtext || 'None', colWidths[3] - 12 * scale, `normal ${9 * scale}px ${UNICODE_FONT_STACK}`);
            const rowH = Math.max(22 * scale, detailLines.length * 14 * scale + 10 * scale);

            checkAndBreakPage(rowH + headerH);
            if (curY === 48 * scale) {
              drawMatrixHeader(curY);
              curY += headerH;
            }

            curCtx.fillStyle = rowCounter % 2 === 1 ? '#F8FAFC' : '#FFFFFF';
            curCtx.fillRect(pageMarginX, curY, contentWidth, rowH);
            curCtx.strokeStyle = '#CBD5E1';
            curCtx.lineWidth = 0.8 * scale;
            curCtx.strokeRect(pageMarginX, curY, contentWidth, rowH);

            let colX = pageMarginX;
            // No
            curCtx.font = `bold ${9 * scale}px ${UNICODE_FONT_STACK}`;
            curCtx.fillStyle = '#64748B';
            curCtx.fillText(String(rowCounter++), colX + 6 * scale, curY + 6 * scale);
            colX += colWidths[0];

            // Section
            curCtx.font = `bold ${9 * scale}px ${UNICODE_FONT_STACK}`;
            curCtx.fillStyle = '#1E3A8A';
            curCtx.fillText(sec.title, colX + 6 * scale, curY + 6 * scale);
            colX += colWidths[1];

            // Topic
            curCtx.font = `bold ${9 * scale}px ${UNICODE_FONT_STACK}`;
            curCtx.fillStyle = '#059669';
            curCtx.fillText((item.isCheck !== false ? '✔ ' : '• ') + topic, colX + 6 * scale, curY + 6 * scale);
            colX += colWidths[2];

            // Details
            curCtx.font = `normal ${9 * scale}px ${UNICODE_FONT_STACK}`;
            curCtx.fillStyle = '#334155';
            let dy = curY + 6 * scale;
            for (const dl of detailLines) {
              curCtx.fillText(dl, colX + 6 * scale, dy);
              dy += 14 * scale;
            }

            curY += rowH;
          }
        } else if (sec.content) {
          const detailLines = getWrappedLines(curCtx, sec.content, colWidths[3] - 12 * scale, `normal ${9 * scale}px ${UNICODE_FONT_STACK}`);
          const rowH = Math.max(22 * scale, detailLines.length * 14 * scale + 10 * scale);

          checkAndBreakPage(rowH + headerH);
          if (curY === 48 * scale) {
            drawMatrixHeader(curY);
            curY += headerH;
          }

          curCtx.fillStyle = '#FEF9C3';
          curCtx.fillRect(pageMarginX, curY, contentWidth, rowH);
          curCtx.strokeStyle = '#FDE047';
          curCtx.strokeRect(pageMarginX, curY, contentWidth, rowH);

          let colX = pageMarginX;
          curCtx.font = `bold ${9 * scale}px ${UNICODE_FONT_STACK}`;
          curCtx.fillStyle = '#854D0E';
          curCtx.fillText(String(rowCounter++), colX + 6 * scale, curY + 6 * scale);
          colX += colWidths[0];

          curCtx.fillText(sec.title, colX + 6 * scale, curY + 6 * scale);
          colX += colWidths[1];

          curCtx.fillText('မှတ်ချက် / Note', colX + 6 * scale, curY + 6 * scale);
          colX += colWidths[2];

          let dy = curY + 6 * scale;
          for (const dl of detailLines) {
            curCtx.fillText(dl, colX + 6 * scale, dy);
            dy += 14 * scale;
          }

          curY += rowH;
        }
      }
    }

    // =========================================================================
    // MODE B: CLEAN TEXT FLOW TYPOGRAPHY (1:1 Document & Preview Matching)
    // =========================================================================
    else if (layoutMode === 'text') {
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

      // If there's an attached tableData, render it cleanly at the bottom
      if (tableData && tableData.length > 0) {
        checkAndBreakPage(60 * scale);
        curY += 10 * scale;

        curCtx.font = `bold ${11.5 * scale}px ${UNICODE_FONT_STACK}`;
        curCtx.fillStyle = '#0B2A59';
        curCtx.fillText('ဇယားကွက် အချက်အလက်များ (Attached Data Table)', pageMarginX, curY);
        curY += 20 * scale;

        const numCols = tableData[0].length;
        const colW = contentWidth / numCols;

        for (let r = 0; r < tableData.length; r++) {
          const row = tableData[r];
          const isHeader = r === 0;
          const rowH = (isHeader ? 24 : 20) * scale;

          checkAndBreakPage(rowH + 4 * scale);

          curCtx.fillStyle = isHeader ? '#0B2A59' : r % 2 === 1 ? '#F8FAFC' : '#FFFFFF';
          curCtx.fillRect(pageMarginX, curY, contentWidth, rowH);
          curCtx.strokeStyle = '#CBD5E1';
          curCtx.strokeRect(pageMarginX, curY, contentWidth, rowH);

          curCtx.font = isHeader
            ? `bold ${9 * scale}px ${UNICODE_FONT_STACK}`
            : `normal ${8.8 * scale}px ${UNICODE_FONT_STACK}`;
          curCtx.fillStyle = isHeader ? '#FFFFFF' : '#1E293B';
          curCtx.textBaseline = 'middle';

          for (let c = 0; c < numCols; c++) {
            curCtx.fillText(row[c] || '', pageMarginX + c * colW + 6 * scale, curY + rowH / 2);
          }
          curCtx.textBaseline = 'top';
          curY += rowH;
        }
      }
    }

    // =========================================================================
    // MODE C: FRAMED CARDS (100% RAW PHOTO MATCH & SOP MATRIX)
    // =========================================================================
    else {
      for (const section of parsedDoc.sections) {
        // Table section handling
        if (section.type === 'table' && section.table && section.table.length > 0) {
          const numCols = section.table[0].length;
          const colWidth = contentWidth / Math.max(1, numCols);

          checkAndBreakPage(60 * scale);
          curCtx.font = `bold ${11.5 * scale}px ${UNICODE_FONT_STACK}`;
          curCtx.fillStyle = '#0F172A';
          curCtx.fillText(section.title || 'Table Matrix', pageMarginX, curY);
          curY += 22 * scale;

          for (let r = 0; r < section.table.length; r++) {
            const row = section.table[r];
            const isHeader = r === 0;
            const rowH = (isHeader ? 26 : 22) * scale;

            checkAndBreakPage(rowH + 4 * scale);

            curCtx.fillStyle = isHeader ? '#0B2A59' : r % 2 === 1 ? '#F1F5F9' : '#FFFFFF';
            curCtx.fillRect(pageMarginX, curY, contentWidth, rowH);

            curCtx.strokeStyle = isHeader ? '#0B2A59' : '#CBD5E1';
            curCtx.lineWidth = 0.75 * scale;

            for (let c = 0; c < numCols; c++) {
              const cellText = row[c] || '';
              const cellX = pageMarginX + c * colWidth;
              curCtx.strokeRect(cellX, curY, colWidth, rowH);

              curCtx.font = isHeader
                ? `bold ${9.5 * scale}px ${UNICODE_FONT_STACK}`
                : `normal ${9 * scale}px ${UNICODE_FONT_STACK}`;
              curCtx.fillStyle = isHeader ? '#FFFFFF' : '#1E293B';
              curCtx.textBaseline = 'middle';

              curCtx.save();
              curCtx.beginPath();
              curCtx.rect(cellX + 4 * scale, curY, colWidth - 8 * scale, rowH);
              curCtx.clip();
              curCtx.fillText(cellText, cellX + 6 * scale, curY + rowH / 2);
              curCtx.restore();
            }
            curCtx.textBaseline = 'top';
            curY += rowH;
          }
          curY += 16 * scale;
          continue;
        }

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
