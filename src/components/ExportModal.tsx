import React, { useState } from 'react';
import {
  X,
  FileText,
  Table,
  FileSpreadsheet,
  Download,
  Cloud,
  CheckCircle2,
  Printer,
  Sparkles,
  Layers,
  AlignLeft,
  Grid,
  Check,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { ExportLayoutMode, DriveAccount } from '../types';
import { PdfService } from '../services/pdfService';
import { SpreadsheetService } from '../services/spreadsheetService';
import { DriveService } from '../services/driveService';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  imageSrc?: string | null;
  extractedText: string;
  tableData?: string[][];
  driveAccount: DriveAccount;
  initialFormat?: 'pdf' | 'excel' | 'csv';
  initialLayoutMode?: ExportLayoutMode;
  onFileSavedLocally?: (newFile: {
    id: string;
    name: string;
    extension: string;
    blob: Blob;
    dataUrl?: string;
    driveSynced: boolean;
  }) => void;
  onToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  title,
  imageSrc,
  extractedText,
  tableData = [],
  driveAccount,
  initialFormat = 'pdf',
  initialLayoutMode = 'framed',
  onFileSavedLocally,
  onToast,
}) => {
  const [format, setFormat] = useState<'pdf' | 'excel' | 'csv'>(initialFormat);
  const [layoutMode, setLayoutMode] = useState<ExportLayoutMode>(initialLayoutMode);
  const [fileName, setFileName] = useState<string>(() => {
    const timeStamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    return title ? title.replace(/[/\\?%*:|"<>]/g, '_') : `DocuScan_${timeStamp}`;
  });
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState<boolean>(false);
  const [uploadedDriveLink, setUploadedDriveLink] = useState<{ id: string; url: string; name: string } | null>(null);

  // Sync state when modal is opened
  React.useEffect(() => {
    if (isOpen) {
      if (initialFormat) setFormat(initialFormat);
      if (initialLayoutMode) setLayoutMode(initialLayoutMode);
      const timeStamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      setFileName(title ? title.replace(/[/\\?%*:|"<>]/g, '_') : `DocuScan_${timeStamp}`);
      setUploadedDriveLink(null);
    }
  }, [isOpen, initialFormat, initialLayoutMode, title]);

  if (!isOpen) return null;

  const currentExt = format === 'pdf' ? '.pdf' : format === 'excel' ? '.xlsx' : '.csv';
  const cleanBaseName = fileName.replace(/\.(pdf|xlsx|csv)$/i, '');
  const fullFileName = `${cleanBaseName}${currentExt}`;

  // Execute Save as PDF / Excel to Local Device
  const handleSaveToDevice = async () => {
    setIsProcessing(true);
    try {
      if (format === 'pdf') {
        const { blob, dataUrl, fileName: savedName } = await PdfService.generateAndSavePdf({
          title: cleanBaseName,
          imageSrc: imageSrc || undefined,
          ocrText: extractedText,
          tableData: tableData.length > 0 ? tableData : undefined,
          customFileName: cleanBaseName,
          layoutMode,
          autoDownload: true,
        });

        if (onFileSavedLocally) {
          onFileSavedLocally({
            id: `pdf-${Date.now()}`,
            name: savedName,
            extension: 'pdf',
            blob,
            dataUrl,
            driveSynced: false,
          });
        }
        onToast(`PDF သိမ်းဆည်းပြီးပါပြီ (${layoutMode === 'framed' ? 'Frame Cards' : layoutMode === 'text' ? 'Text Flow' : 'Table Matrix'}): ${savedName}`);
      } else if (format === 'excel') {
        const { blob, fileName: savedName } = SpreadsheetService.exportToExcel({
          fileName: cleanBaseName,
          tableData,
          ocrText: extractedText,
          layoutMode,
          autoDownload: true,
        });

        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });

        if (onFileSavedLocally) {
          onFileSavedLocally({
            id: `excel-${Date.now()}`,
            name: savedName,
            extension: 'xlsx',
            blob,
            dataUrl,
            driveSynced: false,
          });
        }
        onToast(`Excel Workbook သိမ်းဆည်းပြီးပါပြီ (${layoutMode === 'framed' ? 'Frame Cards' : layoutMode === 'text' ? 'Text Flow' : 'Table Matrix'}): ${savedName}`);
      } else {
        const { blob, fileName: savedName } = SpreadsheetService.exportToCsv({
          fileName: cleanBaseName,
          tableData,
          autoDownload: true,
        });

        if (onFileSavedLocally) {
          onFileSavedLocally({
            id: `csv-${Date.now()}`,
            name: savedName,
            extension: 'csv',
            blob,
            driveSynced: false,
          });
        }
        onToast(`CSV ထုတ်ယူသိမ်းဆည်းပြီးပါပြီ: ${savedName}`);
      }
      onClose();
    } catch (err) {
      console.error('Save to device failed:', err);
      onToast('သိမ်းဆည်းရာတွင် အမှားအယွင်း ဖြစ်ပေါ်ပါသည်', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Execute Direct Upload to Google Drive
  const handleUploadToDrive = async () => {
    setIsUploadingToDrive(true);
    setUploadedDriveLink(null);

    try {
      let targetBlob: Blob;
      let targetName: string;
      let targetMime: string;

      if (format === 'pdf') {
        const res = await PdfService.generateAndSavePdf({
          title: cleanBaseName,
          imageSrc: imageSrc || undefined,
          ocrText: extractedText,
          tableData: tableData.length > 0 ? tableData : undefined,
          customFileName: cleanBaseName,
          layoutMode,
          autoDownload: false, // Don't trigger browser download when uploading to drive
        });
        targetBlob = res.blob;
        targetName = res.fileName;
        targetMime = 'application/pdf';
      } else if (format === 'excel') {
        const res = SpreadsheetService.exportToExcel({
          fileName: cleanBaseName,
          tableData,
          ocrText: extractedText,
          layoutMode,
          autoDownload: false,
        });
        targetBlob = res.blob;
        targetName = res.fileName;
        targetMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      } else {
        const res = SpreadsheetService.exportToCsv({
          fileName: cleanBaseName,
          tableData,
          autoDownload: false,
        });
        targetBlob = res.blob;
        targetName = res.fileName;
        targetMime = 'text/csv';
      }

      // Perform Google Drive upload
      const driveResult = await DriveService.uploadBlob({
        blob: targetBlob,
        fileName: targetName,
        mimeType: targetMime,
      });

      if (driveResult.success) {
        setUploadedDriveLink({
          id: driveResult.fileId,
          url: driveResult.driveUrl,
          name: driveResult.fileName,
        });

        // Save local copy with driveSynced = true
        if (onFileSavedLocally) {
          onFileSavedLocally({
            id: `${format}-${Date.now()}`,
            name: targetName,
            extension: format === 'pdf' ? 'pdf' : format === 'excel' ? 'xlsx' : 'csv',
            blob: targetBlob,
            driveSynced: true,
          });
        }

        onToast(`Google Drive ထဲသို့ အောင်မြင်စွာ တင်ပြီးပါပြီ! (${driveResult.fileName})`, 'success');
      }
    } catch (err) {
      console.error('Google Drive upload error:', err);
      onToast('Google Drive သို့ upload လုပ်ရာတွင် အမှားရှိပါသည်', 'error');
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  // Print PDF directly
  const handlePrint = async () => {
    setIsProcessing(true);
    try {
      const { blob } = await PdfService.generateAndSavePdf({
        title: cleanBaseName,
        imageSrc: imageSrc || undefined,
        ocrText: extractedText,
        tableData: tableData.length > 0 ? tableData : undefined,
        customFileName: cleanBaseName,
        layoutMode,
        autoDownload: false,
      });
      PdfService.printPdfBlob(blob);
      onToast('Document print dialog ဖွင့်နေပါသည်...');
    } catch (err) {
      console.error('Print failed:', err);
      onToast('Print လုပ်ရာတွင် အမှားရှိပါသည်', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-dark-border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/15 backdrop-blur-xs">
              <Sparkles className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white tracking-tight">
                Save & Export Document
              </h3>
              <p className="text-xs text-emerald-100/90">
                Frame Cards / Text Flow / Table Matrix ရွေးချယ်ပြီး Save & Drive Upload လုပ်ပါ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 overflow-y-auto space-y-5">

          {/* 1. Format Selection Tabs */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">
              ၁။ File Format ရွေးချယ်ပါ (Select Output Format):
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFormat('pdf')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition-all ${
                  format === 'pdf'
                    ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface/60 text-slate-600 dark:text-slate-400 hover:border-rose-300'
                }`}
              >
                <FileText className={`w-5 h-5 mb-1.5 ${format === 'pdf' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'}`} />
                <span>PDF Document</span>
                <span className="text-[10px] font-normal text-slate-500">.pdf</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('excel')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition-all ${
                  format === 'excel'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface/60 text-slate-600 dark:text-slate-400 hover:border-emerald-300'
                }`}
              >
                <Table className={`w-5 h-5 mb-1.5 ${format === 'excel' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`} />
                <span>Excel Workbook</span>
                <span className="text-[10px] font-normal text-slate-500">.xlsx</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('csv')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition-all ${
                  format === 'csv'
                    ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 ring-2 ring-teal-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface/60 text-slate-600 dark:text-slate-400 hover:border-teal-300'
                }`}
              >
                <FileSpreadsheet className={`w-5 h-5 mb-1.5 ${format === 'csv' ? 'text-teal-600 dark:text-teal-400' : 'text-slate-500'}`} />
                <span>CSV Sheet</span>
                <span className="text-[10px] font-normal text-slate-500">.csv</span>
              </button>
            </div>
          </div>

          {/* 2. Layout Mode Selection (Framed Cards / Text Flow / Table Matrix) */}
          {format !== 'csv' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  ၂။ Layout ဖွဲ့စည်းမှု ရွေးချယ်ပါ (Choose Document Layout):
                </label>
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  {layoutMode === 'framed' ? '🗂️ Frame Cards' : layoutMode === 'text' ? '📝 Text Flow' : '▦ Matrix Grid'}
                </span>
              </div>

              <div className="space-y-2.5">
                {/* Option 1: Frame Cards */}
                <button
                  type="button"
                  onClick={() => setLayoutMode('framed')}
                  className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 ${
                    layoutMode === 'framed'
                      ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/50 ring-1 ring-blue-500 shadow-xs'
                      : 'border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface/40 hover:border-blue-300'
                  }`}
                >
                  <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                    layoutMode === 'framed' ? 'bg-[#0B2A59] text-white' : 'bg-slate-100 dark:bg-dark-elevated text-slate-600'
                  }`}>
                    <Layers className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                        Frame Cards (၁၀၀% မူရင်းပုံစံ Card Layout)
                      </span>
                      {layoutMode === 'framed' && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                      မူရင်း Deep Navy Header Banner၊ White Cards၊ Green Checkmarks (✔)၊ Accent Bars နှင့် သတိပေးချက် Note Box ပါဝင်သော 1:1 Layout
                    </p>
                  </div>
                </button>

                {/* Option 2: Text Flow */}
                <button
                  type="button"
                  onClick={() => setLayoutMode('text')}
                  className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 ${
                    layoutMode === 'text'
                      ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/50 ring-1 ring-blue-500 shadow-xs'
                      : 'border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface/40 hover:border-blue-300'
                  }`}
                >
                  <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                    layoutMode === 'text' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-dark-elevated text-slate-600'
                  }`}>
                    <AlignLeft className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                        Text Flow (Clean Document & Paragraphs)
                      </span>
                      {layoutMode === 'text' && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                      သပ်ရပ်သော Document Typography၊ ခေါင်းစဉ်ကြီး/ငယ်၊ စာပိုဒ်များနှင့် အစီအစဉ်တကျ ကျစ်လျစ်သော Bullet Point များဖြင့် ဖွဲ့စည်းမှု
                    </p>
                  </div>
                </button>

                {/* Option 3: Table Matrix */}
                <button
                  type="button"
                  onClick={() => setLayoutMode('matrix')}
                  className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 ${
                    layoutMode === 'matrix'
                      ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/50 ring-1 ring-blue-500 shadow-xs'
                      : 'border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface/40 hover:border-blue-300'
                  }`}
                >
                  <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                    layoutMode === 'matrix' ? 'bg-teal-600 text-white' : 'bg-slate-100 dark:bg-dark-elevated text-slate-600'
                  }`}>
                    <Grid className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                        Structured Table Matrix (Full Data Grid)
                      </span>
                      {layoutMode === 'matrix' && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                      အချက်အလက်အားလုံးကို No, Section, Topic နှင့် Details/Action Columns များဖြင့် အပြည့်အစုံ ဇယား Matrix ဆွဲပေးထားသော Layout
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* 3. Custom File Name Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
              ၃။ ဖိုင်အမည် သတ်မှတ်ပါ (File Name):
            </label>
            <div className="flex items-center rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface px-3 py-2 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500">
              <input
                type="text"
                value={cleanBaseName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="Enter custom file name..."
                className="w-full bg-transparent text-xs sm:text-sm font-semibold text-slate-900 dark:text-white outline-hidden"
              />
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 shrink-0 ml-1">
                {currentExt}
              </span>
            </div>
          </div>

          {/* Google Drive Status Bar */}
          <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <div>
                <span className="font-bold text-blue-900 dark:text-blue-200">Google Drive: </span>
                <span className="text-blue-700 dark:text-blue-300">{driveAccount.email || 'khinzarmg.myob@gmail.com'}</span>
              </div>
            </div>
            <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
              Connected
            </span>
          </div>

          {/* Uploaded Drive Success Banner */}
          {uploadedDriveLink && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="truncate">Uploaded to Google Drive: <strong>{uploadedDriveLink.name}</strong></span>
              </div>
              <a
                href={uploadedDriveLink.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-800 dark:text-emerald-300 underline shrink-0 ml-2"
              >
                <span>Open Drive</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

        </div>

        {/* Footer Action Buttons */}
        <div className="p-4 bg-slate-50 dark:bg-dark-surface border-t border-slate-200 dark:border-dark-border flex flex-col sm:flex-row items-center gap-2.5">
          {/* Direct Download Button */}
          <button
            type="button"
            onClick={handleSaveToDevice}
            disabled={isProcessing || isUploadingToDrive}
            className="w-full sm:flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating {format.toUpperCase()}...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Save to Device ({format.toUpperCase()})</span>
              </>
            )}
          </button>

          {/* Google Drive Upload Button */}
          <button
            type="button"
            onClick={handleUploadToDrive}
            disabled={isProcessing || isUploadingToDrive}
            className="w-full sm:flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-600/20 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {isUploadingToDrive ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Uploading to Drive...</span>
              </>
            ) : (
              <>
                <Cloud className="w-4 h-4" />
                <span>Upload to Google Drive</span>
              </>
            )}
          </button>

          {/* Direct Print Button (for PDF) */}
          {format === 'pdf' && (
            <button
              type="button"
              onClick={handlePrint}
              disabled={isProcessing || isUploadingToDrive}
              className="p-3 rounded-xl bg-white dark:bg-dark-elevated hover:bg-slate-100 dark:hover:bg-dark-bg text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-dark-border transition-colors disabled:opacity-50"
              title="Direct Print"
            >
              <Printer className="w-4 h-4" />
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
