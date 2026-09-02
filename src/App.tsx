import React, { useState, useEffect, useMemo } from 'react';
import {
  Scan,
  Table,
  Mic,
  Folder,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react';
import { ActiveTab, DocumentItem, LocalFileItem, FilterCategory, DriveAccount, AppUser } from './types';
import { Navbar } from './components/Navbar';
import { WaveBackground } from './components/WaveBackground';
import { ScannerTab } from './components/ScannerTab';
import { ExcelTab } from './components/ExcelTab';
import { VoiceTab } from './components/VoiceTab';
import { StorageTab } from './components/StorageTab';
import { BSetupTab } from './components/BSetupTab';
import { CameraModal } from './components/CameraModal';
import { DocumentReaderModal } from './components/DocumentReaderModal';
import { ExportModal } from './components/ExportModal';
import { OcrService, SAMPLE_DOCUMENTS } from './services/ocrService';
import { SpreadsheetService } from './services/spreadsheetService';
import { PdfService } from './services/pdfService';
import { StorageService } from './services/storageService';
import { NativeExportService } from './services/nativeExportService';
import { VoiceService } from './services/voiceService';
import { DriveService } from './services/driveService';
import { UserService } from './services/userService';

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

  // User & RBAC State
  const [users, setUsers] = useState<AppUser[]>(() => UserService.getUsers());
  const [currentUser, setCurrentUser] = useState<AppUser>(() => UserService.getCurrentUser());

  // Navigation
  const [activeTab, setActiveTab] = useState<ActiveTab>('scan');

  // Guard: Normal User cannot access bsetup tab
  useEffect(() => {
    if (currentUser.role !== 'admin' && activeTab === 'bsetup') {
      setActiveTab('storage');
    }
  }, [currentUser, activeTab]);

  // Scanner & OCR State
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [currentDocTitle, setCurrentDocTitle] = useState<string>('Scanned_Doc');
  const [currentDocDate, setCurrentDocDate] = useState<string>(() => new Date().toLocaleString());
  const [isProcessingOcr, setIsProcessingOcr] = useState<boolean>(false);
  const [selectedEngine, setSelectedEngine] = useState<'gemini' | 'spatial'>('gemini');
  const [lastEngineUsed, setLastEngineUsed] = useState<string>('');
  const [engineWarning, setEngineWarning] = useState<string | null>(null);
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
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [exportModalFormat, setExportModalFormat] = useState<'pdf' | 'excel' | 'csv'>('pdf');
  const [exportModalLayoutMode, setExportModalLayoutMode] = useState<ExportLayoutMode>('framed');
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

  const handleOpenExportModal = (format: 'pdf' | 'excel' | 'csv' = 'pdf', layoutMode: ExportLayoutMode = 'framed') => {
    setExportModalFormat(format);
    setExportModalLayoutMode(layoutMode);
    setIsExportModalOpen(true);
  };

  const handleFileSavedLocally = (newFile: {
    id: string;
    name: string;
    extension: string;
    blob: Blob;
    dataUrl?: string;
    driveSynced: boolean;
  }) => {
    const isPdf = newFile.extension === 'pdf';
    const isExcel = newFile.extension === 'xlsx';
    const isCsv = newFile.extension === 'csv';

    const newFileItem: LocalFileItem = {
      id: newFile.id,
      path: `/storage/${newFile.name}`,
      name: newFile.name,
      extension: newFile.extension,
      sizeBytes: newFile.blob.size,
      modifiedAt: new Date().toISOString(),
      isPdf,
      isExcel,
      isCsv,
      isAudio: false,
      dataUrl: newFile.dataUrl,
      textContent: extractedText,
      tableData: tableRows,
      driveSynced: newFile.driveSynced,
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      branch: currentUser.branch,
    };

    const updatedFiles = StorageService.addLocalFile(newFileItem);
    setLocalFiles(updatedFiles);
  };

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
      setCurrentDocDate(new Date(initialDoc.createdAt).toLocaleString());
      setExtractedText(initialDoc.extractedText);
      setTableRows(initialDoc.tableData);
    }
  }, []);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // --- User Management Actions ---
  const handleSwitchUser = (userId: string) => {
    const switched = UserService.setCurrentUser(userId);
    if (switched) {
      setCurrentUser(switched);
      showToast(`Switched active user: ${switched.name} (${switched.role === 'admin' ? 'Admin User' : 'Normal User'})`);
      if (switched.role !== 'admin' && activeTab === 'bsetup') {
        setActiveTab('storage');
      }
    }
  };

  const handleAddUser = (user: Omit<AppUser, 'id' | 'createdAt'>) => {
    const newUser = UserService.addUser(user);
    const updatedUsers = UserService.getUsers();
    setUsers(updatedUsers);
    showToast(`User created: ${newUser.name} (${newUser.role === 'admin' ? 'Admin' : 'Normal User'})`);
  };

  const handleUpdateUser = (id: string, updates: Partial<Omit<AppUser, 'id' | 'createdAt'>>) => {
    const updatedUsers = UserService.updateUser(id, updates);
    setUsers(updatedUsers);
    if (currentUser.id === id) {
      const updatedCurrent = updatedUsers.find(u => u.id === id);
      if (updatedCurrent) setCurrentUser(updatedCurrent);
    }
    showToast('User permissions updated successfully');
  };

  const handleDeleteUser = (id: string) => {
    const updatedUsers = UserService.deleteUser(id);
    setUsers(updatedUsers);
    showToast('User removed');
  };

  // --- OCR & Image Processing ---
  const processImageForOcr = async (imageSource: string | File) => {
    const now = new Date();
    const timeStamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const title = `Doc_${timeStamp}`;
    const scanDateFormatted = now.toLocaleString();
    setCurrentDocTitle(title);
    setCurrentDocDate(scanDateFormatted);
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

      let text = '';
      let table: string[][] = [];

      if (selectedEngine === 'gemini') {
        const geminiResult = await OcrService.recognizeImageWithGeminiVision(imageSource, (progress, status) => {
          setOcrProgress({ progress, status });
        });
        text = geminiResult.text;
        table = geminiResult.table;
        if (geminiResult.engine === 'gemini') {
          setLastEngineUsed('✨ AI Smart Vision (Gemini Flash)');
          setEngineWarning(null);
        } else {
          setLastEngineUsed('⚡ Fast 2D Spatial Engine (Fallback)');
          setEngineWarning(geminiResult.error || 'Gemini Vision could not connect. Using local Spatial OCR.');
        }
      } else {
        const ocrResult = await OcrService.recognizeImageWithSpatialClustering(imageSource, (progress, status) => {
          setOcrProgress({ progress, status });
        });
        text = ocrResult.text;
        table = ocrResult.table;
        setLastEngineUsed('⚡ Fast 2D Spatial Clustering Engine');
        setEngineWarning(null);
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
          userId: currentUser.id,
          userName: currentUser.name,
          userRole: currentUser.role,
          branch: currentUser.branch,
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
      const timeStamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      const cleanTitle = currentDocTitle || `DocuScan_${timeStamp}`;
      const fullFileName = `${cleanTitle}.pdf`;

      const { blob, dataUrl } = await PdfService.generateAndSavePdf({
        title: currentDocTitle,
        imageSrc: scannedImage || undefined,
        ocrText: extractedText,
        tableData: tableRows.length > 0 ? tableRows : undefined,
        customFileName: cleanTitle,
      });

      // Also trigger Native Capacitor Mobile auto-opener if on mobile
      if (NativeExportService.isNative()) {
        await NativeExportService.exportAndOpenPdf({
          title: currentDocTitle,
          ocrText: extractedText,
          tableData: tableRows.length > 0 ? tableRows : undefined,
          fileName: cleanTitle,
        });
      }

      const now = new Date();
      const newFileItem: LocalFileItem = {
        id: `pdf-${Date.now()}`,
        path: `/storage/${fullFileName}`,
        name: fullFileName,
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
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        branch: currentUser.branch,
      };

      const updatedFiles = StorageService.addLocalFile(newFileItem);
      setLocalFiles(updatedFiles);
      showToast(`Saved PDF locally: ${fullFileName}`);
    } catch (e) {
      console.error('PDF error:', e);
      showToast('Failed to save PDF.', 'error');
    }
  };

  // --- Export Excel (.xlsx) ---
  const handleExportExcel = async () => {
    if (tableRows.length === 0 && !extractedText.trim()) {
      showToast('No tabular data or text content found to export.', 'error');
      return;
    }

    try {
      const timeStamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      const fileName = `${currentDocTitle || `DocuScan_Export_${timeStamp}`}`;
      const { blob, fileName: fullFileName } = SpreadsheetService.exportToExcel({
        fileName,
        tableData: tableRows,
        ocrText: extractedText,
      });

      // Convert blob to DataURL for offline storage caching
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      // Also trigger Native Capacitor Mobile auto-opener if on mobile
      if (NativeExportService.isNative()) {
        await NativeExportService.exportAndOpenExcel({
          fileName,
          tableData: tableRows,
        });
      }

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
        dataUrl,
        tableData: tableRows,
        driveSynced: driveAccount.isSignedIn,
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        branch: currentUser.branch,
      };

      const updatedFiles = StorageService.addLocalFile(newFileItem);
      setLocalFiles(updatedFiles);
      showToast(`1:1 Excel exported & saved: ${fullFileName}`);
    } catch (e) {
      console.error('Excel export error:', e);
      showToast('Failed to export Excel spreadsheet.', 'error');
    }
  };

  // --- Export CSV (.csv) ---
  const handleExportCsv = async () => {
    if (tableRows.length === 0) {
      showToast('No tabular data found to export.', 'error');
      return;
    }

    try {
      const timeStamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      const fileName = `${currentDocTitle || `DocuScan_Export_${timeStamp}`}`;
      const { blob, fileName: fullFileName, csvContent } = SpreadsheetService.exportToCsv({
        fileName,
        tableData: tableRows,
      });

      // Convert blob to DataURL
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      // Also trigger Native Capacitor Mobile auto-opener if on mobile
      if (NativeExportService.isNative()) {
        await NativeExportService.exportAndOpenCsv({
          fileName,
          tableData: tableRows,
        });
      }

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
        dataUrl,
        textContent: csvContent,
        tableData: tableRows,
        driveSynced: driveAccount.isSignedIn,
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        branch: currentUser.branch,
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
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      branch: currentUser.branch,
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
    const fileWithUser: LocalFileItem = {
      ...file,
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      branch: currentUser.branch,
    };
    const updated = StorageService.addLocalFile(fileWithUser);
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

  const isAdmin = currentUser.role === 'admin';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-dark-bg text-slate-900 dark:text-slate-100 flex flex-col selection:bg-emerald-500/20 pb-20 relative overflow-x-hidden transition-colors duration-300">
      {/* Top 1/3 Wave Background Graphic */}
      <WaveBackground isDark={isDark} />

      {/* Top Navigation Bar */}
      <Navbar
        driveAccount={driveAccount}
        currentUser={currentUser}
        users={users}
        isDark={isDark}
        onToggleTheme={() => setIsDark(prev => !prev)}
        onToggleDrive={handleToggleDrive}
        onOpenStorage={() => setActiveTab('storage')}
        onSwitchUser={handleSwitchUser}
        onOpenSetup={() => setActiveTab('bsetup')}
      />

      {/* Main View Area with Tab Panels */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-4 sm:py-6 relative z-10">
        {activeTab === 'scan' && (
          <ScannerTab
            scannedImage={scannedImage}
            extractedText={extractedText}
            tableRows={tableRows}
            onUpdateTableRows={setTableRows}
            isProcessingOcr={isProcessingOcr}
            ocrProgress={ocrProgress}
            selectedEngine={selectedEngine}
            lastEngineUsed={lastEngineUsed}
            engineWarning={engineWarning}
            onEngineChange={setSelectedEngine}
            onScanCamera={() => setIsCameraOpen(true)}
            onImageSelected={processImageForOcr}
            onTextChange={setExtractedText}
            onSaveAsPdf={handleSaveAsPdf}
            onExportExcelDirectly={handleExportExcel}
            onGoToExcel={() => setActiveTab('excel')}
            onOpenExportModal={handleOpenExportModal}
            onQuickUploadToDrive={() => handleOpenExportModal('pdf')}
            onClearScan={() => {
              setScannedImage(null);
              setExtractedText('');
              setTableRows([]);
              setLastEngineUsed('');
              setEngineWarning(null);
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
            onOpenExportModal={handleOpenExportModal}
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

        {activeTab === 'bsetup' && isAdmin && (
          <BSetupTab
            currentUser={currentUser}
            users={users}
            files={localFiles}
            onAddUser={handleAddUser}
            onUpdateUser={handleUpdateUser}
            onDeleteUser={handleDeleteUser}
            onSwitchUser={handleSwitchUser}
            onOpenFile={handleOpenFile}
            onDeleteFile={handleDeleteFile}
          />
        )}
      </main>

      {/* Bottom Navigation Bar (Dynamic 4 or 5 Columns based on Role) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-dark-card/95 backdrop-blur-md border-t border-emerald-100 dark:border-dark-border shadow-lg transition-colors">
        <div className={`max-w-md mx-auto grid h-16 ${isAdmin ? 'grid-cols-5' : 'grid-cols-4'}`}>
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

          {/* Destination 5: Setup (Admin Only) */}
          {isAdmin && (
            <button
              onClick={() => setActiveTab('bsetup')}
              className={`flex flex-col items-center justify-center gap-1 transition-all ${
                activeTab === 'bsetup'
                  ? 'text-emerald-700 dark:text-emerald-300 font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-300'
              }`}
            >
              <div
                className={`p-1.5 rounded-full transition-all ${
                  activeTab === 'bsetup' ? 'bg-emerald-100/90 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300' : ''
                }`}
              >
                <SlidersHorizontal className="w-5 h-5" />
              </div>
              <span className="text-[11px] tracking-tight">Setup</span>
            </button>
          )}
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
          if (readerModal.file) {
            StorageService.downloadFile(readerModal.file);
          } else if (readerModal.ocrText || (readerModal.tableData && readerModal.tableData.length > 0)) {
            NativeExportService.exportAndOpenPdf({
              title: 'Document',
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

      {/* Save as / Export with Frame Cards, Text Flow, Matrix & Google Drive Upload Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title={currentDocTitle}
        imageSrc={scannedImage}
        extractedText={extractedText}
        tableData={tableRows}
        driveAccount={driveAccount}
        initialFormat={exportModalFormat}
        initialLayoutMode={exportModalLayoutMode}
        onFileSavedLocally={handleFileSavedLocally}
        onToast={showToast}
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
