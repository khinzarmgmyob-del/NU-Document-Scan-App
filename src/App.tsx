import React, { useState, useEffect, useMemo } from 'react';
import {
  Scan,
  Table,
  Mic,
  Folder,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react';
import { ActiveTab, DocumentItem, LocalFileItem, FilterCategory, DriveAccount } from './types';
import { Navbar } from './components/Navbar';
import { WaveBackground } from './components/WaveBackground';
import { ScannerTab } from './components/ScannerTab';
import { ExcelTab } from './components/ExcelTab';
import { VoiceTab } from './components/VoiceTab';
import { StorageTab } from './components/StorageTab';
import { CameraModal } from './components/CameraModal';
import { DocumentReaderModal } from './components/DocumentReaderModal';
import { OcrService, SAMPLE_DOCUMENTS } from './services/ocrService';
import { SpreadsheetService } from './services/spreadsheetService';
import { PdfService } from './services/pdfService';
import { StorageService } from './services/storageService';
import { VoiceService } from './services/voiceService';
import { DriveService } from './services/driveService';

export function App() {
  // Theme State
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  // Navigation
  const [activeTab, setActiveTab] = useState<ActiveTab>('scan');

  // Scanner & OCR State
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [currentDocTitle, setCurrentDocTitle] = useState<string>('Scanned_Doc');
  const [isProcessingOcr, setIsProcessingOcr] = useState<boolean>(false);
  const [ocrProgress, setOcrProgress] = useState<{ progress: number; status: string }>({
    progress: 0,
    status: '',
  });
  const [tableRows, setTableRows] = useState<string[][]>([]);

  // Local Storage & Documents
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [localFiles, setLocalFiles] = useState<LocalFileItem[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<FilterCategory>('all');

  // Drive Account
  const [driveAccount, setDriveAccount] = useState<DriveAccount>(DriveService.getAccount());

  // Modals
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [readerModal, setReaderModal] = useState<{
    isOpen: boolean;
    file: LocalFileItem | null;
    imageSrc?: string | null;
    ocrText?: string;
    tableData?: string[][];
  }>({
    isOpen: false,
    file: null,
  });

  // Toasts
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Singleton Voice Service
  const voiceService = useMemo(() => new VoiceService(), []);

  // Initialize data on mount
  useEffect(() => {
    const loadedDocs = StorageService.getDocuments();
    const loadedFiles = StorageService.getLocalFiles();
    setDocuments(loadedDocs);
    setLocalFiles(loadedFiles);

    // If initial seed doc exists, load it into scanner
    if (loadedDocs.length > 0) {
      const initialDoc = loadedDocs[0];
      setCurrentDocTitle(initialDoc.title);
      setExtractedText(initialDoc.extractedText);
      setTableRows(initialDoc.tableData);
    }
  }, []);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // --- OCR & Image Processing ---
  const processImageForOcr = async (imageSource: string | File) => {
    const timeStamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const title = `Doc_${timeStamp}`;
    setCurrentDocTitle(title);
    setIsProcessingOcr(true);
    setOcrProgress({ progress: 0.1, status: 'Initializing OCR Engine...' });

    try {
      let imageSrc = '';
      if (typeof imageSource === 'string') {
        imageSrc = imageSource;
      } else {
        imageSrc = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(imageSource);
        });
      }

      setScannedImage(imageSrc);

      // Check if image is one of our sample documents for instantaneous matching
      const matchingSample = SAMPLE_DOCUMENTS.find(s => s.imageUrl === imageSrc);
      let text = '';
      let table: string[][] = [];

      if (matchingSample) {
        text = matchingSample.ocrText;
        table = matchingSample.tableData;
      } else {
        const ocrResult = await OcrService.recognizeImageWithSpatialClustering(imageSource, (progress, status) => {
          setOcrProgress({ progress, status });
        });
        text = ocrResult.text;
        table = ocrResult.table;
      }

      setExtractedText(text || 'No text detected in this document.');
      setTableRows(table);
      setIsProcessingOcr(false);

      if (text) {
        const newDoc: DocumentItem = {
          id: Date.now().toString(),
          title,
          imagePath: imageSrc,
          extractedText: text,
          createdAt: new Date().toISOString(),
          tableData: table,
          isSyncedToDrive: driveAccount.isSignedIn,
        };

        const updatedDocs = StorageService.addDocument(newDoc);
        setDocuments(updatedDocs);
        showToast('Document scanned & OCR processed successfully!');
      }
    } catch (err) {
      console.error('Scan failed:', err);
      setIsProcessingOcr(false);
      showToast('Error scanning image. Please try another sample or upload.', 'error');
    }
  };

  // --- Save as PDF ---
  const handleSaveAsPdf = async () => {
    if (!extractedText && !scannedImage) {
      showToast('No scanned content available to generate PDF.', 'error');
      return;
    }

    try {
      const { blob, fileName, dataUrl } = await PdfService.generateAndSavePdf({
        title: currentDocTitle,
        imageSrc: scannedImage || undefined,
        ocrText: extractedText,
        tableData: tableRows.length > 0 ? tableRows : undefined,
      });

      const now = new Date();
      const newFileItem: LocalFileItem = {
        id: `pdf-${Date.now()}`,
        path: `/storage/${fileName}`,
        name: fileName,
        extension: 'pdf',
        sizeBytes: blob.size,
        modifiedAt: now.toISOString(),
        isPdf: true,
        isExcel: false,
        isCsv: false,
        isAudio: false,
        dataUrl,
        textContent: extractedText,
        tableData: tableRows,
        driveSynced: driveAccount.isSignedIn,
      };

      const updatedFiles = StorageService.addLocalFile(newFileItem);
      setLocalFiles(updatedFiles);
      showToast(`Saved PDF locally: ${fileName}`);
    } catch (e) {
      console.error('PDF error:', e);
      showToast('Failed to save PDF.', 'error');
    }
  };

  // --- Export Excel (.xlsx) ---
  const handleExportExcel = () => {
    if (tableRows.length === 0) {
      showToast('No tabular data found to export.', 'error');
      return;
    }

    try {
      const timeStamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      const fileName = `DocuScan_Export_${timeStamp}`;
      const { blob, fileName: fullFileName } = SpreadsheetService.exportToExcel({
        fileName,
        tableData: tableRows,
      });

      const newFileItem: LocalFileItem = {
        id: `excel-${Date.now()}`,
        path: `/storage/${fullFileName}`,
        name: fullFileName,
        extension: 'xlsx',
        sizeBytes: blob.size,
        modifiedAt: new Date().toISOString(),
        isPdf: false,
        isExcel: true,
        isCsv: false,
        isAudio: false,
        tableData: tableRows,
        driveSynced: driveAccount.isSignedIn,
      };

      const updatedFiles = StorageService.addLocalFile(newFileItem);
      setLocalFiles(updatedFiles);
      showToast(`Exported successfully: ${fullFileName}`);
    } catch (e) {
      console.error('Excel export error:', e);
      showToast('Failed to export Excel spreadsheet.', 'error');
    }
  };

  // --- Export CSV (.csv) ---
  const handleExportCsv = () => {
    if (tableRows.length === 0) {
      showToast('No tabular data found to export.', 'error');
      return;
    }

    try {
      const timeStamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      const fileName = `DocuScan_Export_${timeStamp}`;
      const { blob, fileName: fullFileName, csvContent } = SpreadsheetService.exportToCsv({
        fileName,
        tableData: tableRows,
      });

      const newFileItem: LocalFileItem = {
        id: `csv-${Date.now()}`,
        path: `/storage/${fullFileName}`,
        name: fullFileName,
        extension: 'csv',
        sizeBytes: blob.size,
        modifiedAt: new Date().toISOString(),
        isPdf: false,
        isExcel: false,
        isCsv: true,
        isAudio: false,
        textContent: csvContent,
        tableData: tableRows,
        driveSynced: driveAccount.isSignedIn,
      };

      const updatedFiles = StorageService.addLocalFile(newFileItem);
      setLocalFiles(updatedFiles);
      showToast(`Exported CSV successfully: ${fullFileName}`);
    } catch (e) {
      console.error('CSV export error:', e);
      showToast('Failed to export CSV.', 'error');
    }
  };

  // --- Google Drive Actions ---
  const handleToggleDrive = async () => {
    const updated = await DriveService.toggleSignIn();
    setDriveAccount(updated);
    showToast(
      updated.isSignedIn
        ? 'Connected to Google Drive (khinzarmg.myob@gmail.com)'
        : 'Google Drive disconnected'
    );
  };

  const handleUploadToDrive = async (file: LocalFileItem) => {
    const result = await DriveService.uploadFile(file);
    if (result.success) {
      const updated = localFiles.map(f =>
        f.id === file.id ? { ...f, driveSynced: true } : f
      );
      StorageService.saveLocalFiles(updated);
      setLocalFiles(updated);
      showToast(`Uploaded to Google Drive (${result.fileId})`);
    }
  };

  // --- File Storage Import & Management ---
  const handleImportFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const isPdf = ext === 'pdf';
    const isExcel = ext === 'xlsx' || ext === 'xls';
    const isCsv = ext === 'csv';
    const isAudio = ['m4a', 'mp3', 'webm', 'wav'].includes(ext);

    let textContent = '';
    let dataUrl = '';

    if (isCsv || ext === 'txt') {
      textContent = await file.text();
    } else {
      dataUrl = await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result as string);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
    }

    const newFile: LocalFileItem = {
      id: `imported-${Date.now()}`,
      path: `/storage/${file.name}`,
      name: file.name,
      extension: ext,
      sizeBytes: file.size,
      modifiedAt: new Date().toISOString(),
      isPdf,
      isExcel,
      isCsv,
      isAudio,
      textContent,
      dataUrl,
      driveSynced: false,
    };

    const updated = StorageService.addLocalFile(newFile);
    setLocalFiles(updated);
    showToast(`Imported ${file.name} to local archives`);

    // Open in Reader
    setReaderModal({
      isOpen: true,
      file: newFile,
      imageSrc: file.type.startsWith('image/') ? dataUrl : null,
      ocrText: textContent,
    });
  };

  const handleDeleteFile = (id: string) => {
    const updated = StorageService.deleteLocalFile(id);
    setLocalFiles(updated);
    showToast('File deleted from archives');
  };

  const handleSaveVoiceNote = (file: LocalFileItem) => {
    const updated = StorageService.addLocalFile(file);
    setLocalFiles(updated);
    showToast(`Voice note saved: ${file.name}`);
  };

  const handleOpenFile = (file: LocalFileItem) => {
    setReaderModal({
      isOpen: true,
      file,
      imageSrc: file.dataUrl && !file.isPdf && !file.isAudio ? file.dataUrl : scannedImage,
      ocrText: file.textContent || (file.isPdf ? extractedText : undefined),
      tableData: file.tableData || (file.isPdf || file.isExcel ? tableRows : undefined),
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-dark-bg text-slate-900 dark:text-slate-100 flex flex-col selection:bg-emerald-500/20 pb-20 relative overflow-x-hidden transition-colors duration-300">
      {/* Top 1/3 Wave Background Graphic */}
      <WaveBackground isDark={isDark} />

      {/* Top Navigation Bar */}
      <Navbar
        driveAccount={driveAccount}
        isDark={isDark}
        onToggleTheme={() => setIsDark(prev => !prev)}
        onToggleDrive={handleToggleDrive}
        onOpenStorage={() => setActiveTab('storage')}
      />

      {/* Main View Area with Tab Panels */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-4 sm:py-6 relative z-10">
        {activeTab === 'scan' && (
          <ScannerTab
            scannedImage={scannedImage}
            extractedText={extractedText}
            isProcessingOcr={isProcessingOcr}
            ocrProgress={ocrProgress}
            onScanCamera={() => setIsCameraOpen(true)}
            onImageSelected={processImageForOcr}
            onTextChange={setExtractedText}
            onSaveAsPdf={handleSaveAsPdf}
            onGoToExcel={() => setActiveTab('excel')}
            onClearScan={() => {
              setScannedImage(null);
              setExtractedText('');
              setTableRows([]);
            }}
          />
        )}

        {activeTab === 'excel' && (
          <ExcelTab
            tableRows={tableRows}
            onUpdateTable={setTableRows}
            onExportExcel={handleExportExcel}
            onExportCsv={handleExportCsv}
            onGoToScan={() => setActiveTab('scan')}
          />
        )}

        {activeTab === 'voice' && (
          <VoiceTab
            voiceService={voiceService}
            savedVoiceNotes={localFiles.filter(f => f.isAudio)}
            onSaveVoiceNote={handleSaveVoiceNote}
            onDeleteVoiceNote={handleDeleteFile}
          />
        )}

        {activeTab === 'storage' && (
          <StorageTab
            files={localFiles}
            selectedFilter={selectedFilter}
            driveAccount={driveAccount}
            onFilterChange={setSelectedFilter}
            onToggleDrive={handleToggleDrive}
            onUploadToDrive={handleUploadToDrive}
            onOpenFile={handleOpenFile}
            onDeleteFile={handleDeleteFile}
            onImportFile={handleImportFile}
          />
        )}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-dark-card/95 backdrop-blur-md border-t border-emerald-100 dark:border-dark-border shadow-lg transition-colors">
        <div className="max-w-md mx-auto grid grid-cols-4 h-16">
          {/* Destination 1: Scan & OCR */}
          <button
            onClick={() => setActiveTab('scan')}
            className={`flex flex-col items-center justify-center gap-1 transition-all ${
              activeTab === 'scan'
                ? 'text-emerald-700 dark:text-emerald-300 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-300'
            }`}
          >
            <div
              className={`p-1.5 rounded-full transition-all ${
                activeTab === 'scan' ? 'bg-emerald-100/90 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300' : ''
              }`}
            >
              <Scan className="w-5 h-5" />
            </div>
            <span className="text-[11px] tracking-tight">Scan &amp; OCR</span>
          </button>

          {/* Destination 2: Scan to Excel */}
          <button
            onClick={() => setActiveTab('excel')}
            className={`flex flex-col items-center justify-center gap-1 transition-all ${
              activeTab === 'excel'
                ? 'text-emerald-700 dark:text-emerald-300 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-300'
            }`}
          >
            <div
              className={`p-1.5 rounded-full transition-all ${
                activeTab === 'excel' ? 'bg-emerald-100/90 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300' : ''
              }`}
            >
              <Table className="w-5 h-5" />
            </div>
            <span className="text-[11px] tracking-tight">Scan to Excel</span>
          </button>

          {/* Destination 3: Voice Notes */}
          <button
            onClick={() => setActiveTab('voice')}
            className={`flex flex-col items-center justify-center gap-1 transition-all ${
              activeTab === 'voice'
                ? 'text-emerald-700 dark:text-emerald-300 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-300'
            }`}
          >
            <div
              className={`p-1.5 rounded-full transition-all ${
                activeTab === 'voice' ? 'bg-emerald-100/90 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300' : ''
              }`}
            >
              <Mic className="w-5 h-5" />
            </div>
            <span className="text-[11px] tracking-tight">Voice Notes</span>
          </button>

          {/* Destination 4: Storage & Drive */}
          <button
            onClick={() => setActiveTab('storage')}
            className={`flex flex-col items-center justify-center gap-1 transition-all ${
              activeTab === 'storage'
                ? 'text-emerald-700 dark:text-emerald-300 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-300'
            }`}
          >
            <div
              className={`p-1.5 rounded-full transition-all ${
                activeTab === 'storage' ? 'bg-emerald-100/90 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300' : ''
              }`}
            >
              <Folder className="w-5 h-5" />
            </div>
            <span className="text-[11px] tracking-tight">Storage &amp; Drive</span>
          </button>
        </div>
      </nav>

      {/* Camera Capture Modal */}
      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={processImageForOcr}
      />

      {/* Document Reader Bottom Sheet Modal */}
      <DocumentReaderModal
        isOpen={readerModal.isOpen}
        onClose={() => setReaderModal({ ...readerModal, isOpen: false })}
        file={readerModal.file}
        imageSrc={readerModal.imageSrc}
        ocrText={readerModal.ocrText}
        tableData={readerModal.tableData}
        onDownload={() => {
          if (readerModal.file?.dataUrl) {
            const a = document.createElement('a');
            a.href = readerModal.file.dataUrl;
            a.download = readerModal.file.name;
            a.click();
          } else if (readerModal.ocrText) {
            PdfService.generateAndSavePdf({
              title: readerModal.file?.name || 'Document',
              ocrText: readerModal.ocrText,
              tableData: readerModal.tableData,
            });
          }
        }}
        onPrint={() => {
          window.print();
        }}
        onShare={() => {
          if (navigator.share && readerModal.file) {
            navigator.share({
              title: readerModal.file.name,
              text: `NextUnit DocuScan Archive: ${readerModal.file.name}`,
              url: window.location.href,
            }).catch(() => {});
          }
        }}
      />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-16 right-4 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
          <div
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold border ${
              toast.type === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-slate-900 text-white border-slate-800'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
