# NextUnit DocuScan (React & TypeScript)

A complete, production-ready web document scanning, OCR text extraction, Scan to Excel/CSV generator, voice recorder, and Google Drive storage management system.

## 🚀 Key Features

1. **Document Scanning & OCR**:
   - Live camera scanning with camera selector and viewfinder.
   - Gallery image file upload (PNG, JPG, SVG, WebP) with drag-and-drop.
   - Built-in optical character recognition (OCR) with progress tracking.
   - One-click sample test documents (Commercial Invoices, Cafe Receipts, Warehouse Inventory).

2. **Scan to Excel & CSV**:
   - Automated conversion of tabular OCR data into structured 2D matrices.
   - Formatted `.xlsx` (Excel) export with styled headers and dynamic column widths.
   - Standard `.csv` export with full RFC formatting.
   - Interactive spreadsheet data grid with cell editing, row additions, column additions, and deletion.

3. **PDF Generation & Native Reader**:
   - High-resolution searchable PDF creation with blue header branding, scanned image embed, line item matrix, and formatted OCR text.
   - In-app bottom sheet document reader with print, download, and share capabilities.

4. **Voice Recording & Audio Notes**:
   - Web Audio / MediaRecorder microphone recording engine with real-time waveform visualization and timer.
   - Audio playback engine with time tracking and share actions.

5. **Storage & Google Drive Sync**:
   - Local storage archives with categorization (All, PDFs, Sheets, Audio).
   - Google Drive backup and synchronization status.
   - File picker to import external PDFs and spreadsheets directly into the system.

## 🛠️ Tech Stack

- **React 18** with **TypeScript** & **Vite**
- **Tailwind CSS** with Material Blue & Excel Green color palettes
- **Tesseract.js** client-side OCR engine
- **SheetJS (xlsx)** for Excel workbook generation
- **jsPDF & jsPDF-autotable** for searchable PDF document generation
- **Lucide Icons**
