import React, { useRef, useState, useEffect } from 'react';
import {
  Camera,
  Image as ImageIcon,
  Copy,
  Check,
  FileText,
  FileEdit,
  Table,
  Loader2,
  Sparkles,
  X,
  Key,
  RefreshCw,
  CheckCircle2,
  Columns,
  Layout,
  Wand2,
  ZoomIn,
  ZoomOut,
  Download,
  ArrowRight,
  Eye,
  Cloud,
  Layers,
  AlignLeft,
  Grid,
  ChevronDown
} from 'lucide-react';
import { SAMPLE_DOCUMENTS, SampleDoc, OcrService } from '../services/ocrService';
import { DocumentGridService } from '../services/documentGridService';
import { AutoFramedDocumentView } from './AutoFramedDocumentView';
import { DocumentSectionBlock, ExportLayoutMode, DocumentReconstruction } from '../types';

interface ScannerTabProps {
  scannedImage: string | null;
  extractedText: string;
  tableRows?: string[][];
  onUpdateTableRows?: (rows: string[][]) => void;
  reconstruction?: DocumentReconstruction | null;
  onReconstructionChange?: (reconstruction: DocumentReconstruction) => void;
  isProcessingOcr: boolean;
  ocrProgress: { progress: number; status: string };
  selectedEngine: 'gemini' | 'spatial';
  lastEngineUsed?: string;
  engineWarning?: string | null;
  onEngineChange: (engine: 'gemini' | 'spatial') => void;
  onScanCamera: () => void;
  onImageSelected: (file: File | string) => void;
  onTextChange: (text: string) => void;
  onSaveAsPdf: () => void;
  onExportExcelDirectly?: () => void;
  onGoToExcel: () => void;
  onClearScan: () => void;
  onOpenExportModal?: (defaultFormat?: 'pdf' | 'word' | 'excel' | 'csv', layoutMode?: ExportLayoutMode) => void;
  onQuickUploadToDrive?: () => void;
}

export const ScannerTab: React.FC<ScannerTabProps> = ({
  scannedImage,
  extractedText,
  tableRows = [],
  onUpdateTableRows,
  reconstruction,
  onReconstructionChange,
  isProcessingOcr,
  ocrProgress,
  selectedEngine,
  lastEngineUsed,
  engineWarning,
  onEngineChange,
  onScanCamera,
  onImageSelected,
  onTextChange,
  onSaveAsPdf,
  onExportExcelDirectly,
  onGoToExcel,
  onClearScan,
  onOpenExportModal,
  onQuickUploadToDrive,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [selectedSample, setSelectedSample] = useState<string | null>(null);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeySavedSuccess, setApiKeySavedSuccess] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [localReconstruction, setLocalReconstruction] = useState<DocumentReconstruction | null>(reconstruction || null);
  const [viewMode, setViewMode] = useState<'reconstructed' | 'framed' | 'ai_grid'>('reconstructed');
  const [aiGridHtml, setAiGridHtml] = useState<string | null>(null);
  const [isLoadingAiGrid, setIsLoadingAiGrid] = useState(false);
  const [isAutoFormatting, setIsAutoFormatting] = useState(false);
  const [isImageZoomed, setIsImageZoomed] = useState(false);
  const [formattedDoc, setFormattedDoc] = useState<{
    title: string;
    subtitle: string;
    sections: DocumentSectionBlock[];
  } | null>(null);

  const loadAiGridData = async (forceRefresh = false) => {
    if ((aiGridHtml && !forceRefresh) || (!extractedText && !scannedImage && (!tableRows || tableRows.length === 0))) return;
    setIsLoadingAiGrid(true);
    try {
      const grid = await DocumentGridService.fetchAiGridData({
        imageBase64: scannedImage || undefined,
        ocrText: extractedText,
        tableData: tableRows,
        title: formattedDoc?.title || 'Extracted Document',
      });
      const html = DocumentGridService.buildHtmlFromAiGrid(grid, {
        isWord: false,
        containerPadding: '20px 24px',
      });
      setAiGridHtml(html);
    } catch (err) {
      console.warn('Failed to load AI Grid in ScannerTab:', err);
    } finally {
      setIsLoadingAiGrid(false);
    }
  };

  useEffect(() => {
    if (reconstruction) {
      setLocalReconstruction(reconstruction);
      if (reconstruction.htmlContent) {
        setViewMode('reconstructed');
      }
    }
  }, [reconstruction]);

  useEffect(() => {
    if (extractedText) {
      const parsed = OcrService.parseTextToSections(extractedText);
      setFormattedDoc(parsed);
    } else {
      setFormattedDoc(null);
    }
    setAiGridHtml(null);
  }, [extractedText]);

  useEffect(() => {
    if (viewMode === 'ai_grid' && !aiGridHtml && (extractedText || scannedImage)) {
      loadAiGridData();
    }
  }, [viewMode, extractedText, scannedImage]);

  useEffect(() => {
    setApiKeyInput(OcrService.getStoredApiKey());
    setTestResult(null);
  }, [isApiKeyModalOpen]);

  const handleCopy = () => {
    if (!extractedText) return;
    navigator.clipboard.writeText(extractedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedSample(null);
      onImageSelected(file);
    }
  };

  const handleSampleClick = (sample: SampleDoc) => {
    setSelectedSample(sample.id);
    onImageSelected(sample.imageUrl);
  };

  const handleTestKey = async () => {
    if (!apiKeyInput.trim()) {
      setTestResult({ success: false, message: 'Please enter an API Key first' });
      return;
    }
    setIsTestingKey(true);
    setTestResult(null);
    const res = await OcrService.testGeminiApiKey(apiKeyInput.trim());
    setIsTestingKey(false);
    setTestResult(res);
  };

  const handleSaveApiKey = () => {
    OcrService.setStoredApiKey(apiKeyInput);
    setApiKeySavedSuccess(true);
    setTimeout(() => {
      setApiKeySavedSuccess(false);
      setIsApiKeyModalOpen(false);
      if (scannedImage) {
        onImageSelected(scannedImage);
      }
    }, 1000);
  };

  const handleReScanCurrent = (engine: 'gemini' | 'spatial') => {
    onEngineChange(engine);
    if (scannedImage) {
      onImageSelected(scannedImage);
    }
  };

  const handleAutoFormatAndAdjust = async () => {
    if (!extractedText && !scannedImage) return;
    setIsAutoFormatting(true);
    try {
      if (scannedImage) {
        // Run full hybrid coordinate-aware document reconstruction on original scan
        const recon = await OcrService.reconstructDocument(scannedImage, {
          apiKey: OcrService.getStoredApiKey(),
          deskew: true,
        });

        setLocalReconstruction(recon);
        if (onReconstructionChange) {
          onReconstructionChange(recon);
        }
        if (recon.fullText) {
          onTextChange(recon.fullText);
        }
        if (recon.tableMatrix && recon.tableMatrix.length > 0 && onUpdateTableRows) {
          onUpdateTableRows(recon.tableMatrix);
        }
        if (recon.sections && recon.sections.length > 0) {
          setFormattedDoc({
            title: recon.title || 'Reconstructed Document',
            subtitle: recon.subtitle || '',
            sections: recon.sections,
          });
        }
        if (recon.htmlContent) {
          setViewMode('reconstructed');
        } else {
          setViewMode('framed');
        }
      } else {
        const res = await OcrService.autoFormatAndAlignLayout(extractedText, tableRows);
        if (res.formattedText && res.formattedText !== extractedText) {
          onTextChange(res.formattedText);
        }
        if (res.table && onUpdateTableRows) {
          onUpdateTableRows(res.table);
        }
        setFormattedDoc({
          title: res.title,
          subtitle: res.subtitle || '',
          sections: res.sections,
        });
        setViewMode('framed');
      }
    } catch (err) {
      console.error('Auto format error:', err);
    } finally {
      setIsAutoFormatting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-8">
      {/* Engine Selection & API Key Configuration Bar */}
      <div className="bg-white/95 dark:bg-dark-card/95 backdrop-blur-xs rounded-xl p-3 border border-emerald-100 dark:border-dark-border shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-800 dark:text-emerald-200 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            AI Document & Table Engine:
          </span>
          <div className="flex items-center gap-2">
            {OcrService.getStoredApiKey() ? (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Connected
              </span>
            ) : (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                {selectedEngine === 'gemini' ? '✨ AI Smart Vision (Gemini Flash)' : '⚡ 100% Offline / Client-side'}
              </span>
            )}
            <button
              type="button"
              onClick={() => setIsApiKeyModalOpen(true)}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 dark:bg-dark-elevated hover:bg-emerald-50 dark:hover:bg-emerald-950/60 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-200 dark:border-dark-border text-xs transition-colors"
              title="Configure Google Gemini API Key"
            >
              <Key className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium">{OcrService.getStoredApiKey() ? 'API Key' : 'Setup Key'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleReScanCurrent('gemini')}
            className={`flex flex-col items-center text-center p-2 rounded-lg border transition-all ${
              selectedEngine === 'gemini'
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/70 text-emerald-950 dark:text-emerald-100 ring-1 ring-emerald-500'
                : 'border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface/50 text-slate-600 dark:text-slate-400 hover:border-emerald-300'
            }`}
          >
            <div className="flex items-center gap-1 font-bold text-xs">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>AI Smart Vision</span>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Gemini Flash (100% Table Match)</span>
          </button>

          <button
            type="button"
            onClick={() => handleReScanCurrent('spatial')}
            className={`flex flex-col items-center text-center p-2 rounded-lg border transition-all ${
              selectedEngine === 'spatial'
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/70 text-emerald-950 dark:text-emerald-100 ring-1 ring-emerald-500'
                : 'border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface/50 text-slate-600 dark:text-slate-400 hover:border-emerald-300'
            }`}
          >
            <div className="flex items-center gap-1 font-bold text-xs">
              <Table className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Fast 2D Spatial</span>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Bounding Box Clustering (Offline)</span>
          </button>
        </div>
      </div>

      {/* Primary Scan Action Bar */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onScanCamera}
          className="flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold text-sm shadow-md shadow-emerald-500/20 transition-all active:scale-[0.98]"
        >
          <Camera className="w-5 h-5" />
          <span>Camera Scan</span>
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-xl bg-white dark:bg-dark-card hover:bg-emerald-50/50 dark:hover:bg-dark-elevated text-emerald-950 dark:text-emerald-300 font-semibold text-sm border border-emerald-200 dark:border-dark-border shadow-xs transition-all active:scale-[0.98]"
        >
          <ImageIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <span>From Gallery</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Sample Document Quick Test Selector */}
      <div className="bg-white/90 dark:bg-dark-card/90 backdrop-blur-xs rounded-xl p-3.5 border border-emerald-100 dark:border-dark-border shadow-2xs transition-colors">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200">Sample OCR Templates (Click to Test OCR):</span>
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">Runs live {selectedEngine === 'gemini' ? 'AI Vision' : '2D Spatial'} engine</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {SAMPLE_DOCUMENTS.map(sample => (
            <button
              key={sample.id}
              onClick={() => handleSampleClick(sample)}
              className={`text-left p-2.5 rounded-lg border text-xs transition-all ${
                selectedSample === sample.id
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 font-semibold ring-1 ring-emerald-400/40'
                  : 'border-slate-200 dark:border-dark-border hover:border-emerald-300 dark:hover:border-emerald-700/50 hover:bg-emerald-50/30 dark:hover:bg-dark-elevated text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="font-bold truncate text-slate-900 dark:text-emerald-100">{sample.category}</div>
              <div className="text-[11px] text-emerald-700 dark:text-emerald-400/70 truncate">{sample.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 100% RAW PHOTO LIVE PREVIEW VIEWPORT (Main Focus) */}
      {scannedImage && (
        <div className="bg-white dark:bg-dark-card rounded-xl border border-emerald-200 dark:border-dark-border shadow-sm overflow-hidden transition-all">
          <div className="px-4 py-2.5 bg-emerald-50/60 dark:bg-dark-surface/60 border-b border-emerald-100 dark:border-dark-border flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-emerald-100 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-emerald-600" />
                100% Raw Scanned Document Photo
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800">
                Original Capture
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsImageZoomed(prev => !prev)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-white dark:bg-dark-elevated hover:bg-slate-100 dark:hover:bg-dark-bg text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-dark-border shadow-2xs transition-colors"
                title="Toggle Zoom Fit"
              >
                {isImageZoomed ? <ZoomOut className="w-3.5 h-3.5" /> : <ZoomIn className="w-3.5 h-3.5" />}
                <span className="text-[11px]">{isImageZoomed ? 'Fit Height' : 'Full Zoom'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleReScanCurrent(selectedEngine)}
                title="Re-run AI OCR on current image"
                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors shadow-2xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="text-[11px]">Re-scan</span>
              </button>

              <button
                type="button"
                onClick={onClearScan}
                title="Remove Scan"
                className="p-1 rounded-md hover:bg-rose-100 dark:hover:bg-rose-950/60 text-slate-400 hover:text-rose-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className={`relative bg-slate-950 dark:bg-black p-3 flex items-center justify-center transition-all ${
            isImageZoomed ? 'min-h-[500px]' : 'max-h-[320px] min-h-[220px]'
          }`}>
            <img
              src={scannedImage}
              alt="100% Raw Scanned Document"
              className={`max-w-full object-contain rounded-lg shadow-md transition-all ${
                isImageZoomed ? 'h-auto max-h-[700px]' : 'max-h-[300px]'
              }`}
            />
          </div>

          {/* DEDICATED 1-CLICK INSTANT CONVERSION ACTION HUB */}
          <div className="p-3.5 bg-gradient-to-r from-emerald-50/80 via-teal-50/50 to-slate-50/80 dark:from-dark-surface dark:via-dark-card dark:to-dark-surface border-t border-emerald-100 dark:border-dark-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800 dark:text-emerald-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                Save & Export Options ({viewMode === 'ai_grid' ? 'Gemini AI Grid Engine' : viewMode === 'framed' ? 'Frame Cards' : 'Reconstructed'}):
              </span>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
                100% 1:1 Matching
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {/* Convert to PDF Button */}
              <button
                type="button"
                onClick={() => {
                  const currentLayout: ExportLayoutMode = viewMode === 'ai_grid' ? 'ai_grid' : viewMode === 'framed' ? 'framed' : 'reconstructed';
                  if (onOpenExportModal) onOpenExportModal('pdf', currentLayout);
                  else onSaveAsPdf();
                }}
                disabled={isProcessingOcr || (!extractedText && !localReconstruction)}
                className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-semibold text-xs shadow-md shadow-red-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-white/20">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-xs">Save as PDF</div>
                    <div className="text-[10px] text-red-100">
                      {viewMode === 'ai_grid' ? 'AI Grid Engine' : viewMode === 'framed' ? 'Frame Cards' : 'Reconstructed'}
                    </div>
                  </div>
                </div>
                <Download className="w-4 h-4" />
              </button>

              {/* Convert to Word Button */}
              <button
                type="button"
                onClick={() => {
                  const currentLayout: ExportLayoutMode = viewMode === 'ai_grid' ? 'ai_grid' : viewMode === 'framed' ? 'framed' : 'reconstructed';
                  if (onOpenExportModal) onOpenExportModal('word', currentLayout);
                }}
                disabled={isProcessingOcr || (!extractedText && !localReconstruction)}
                className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-white/20">
                    <FileEdit className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-xs">Save as Word</div>
                    <div className="text-[10px] text-blue-100">
                      {viewMode === 'ai_grid' ? 'AI Grid (.docx)' : viewMode === 'framed' ? 'Frame Cards' : 'Reconstructed'}
                    </div>
                  </div>
                </div>
                <Download className="w-4 h-4" />
              </button>

              {/* Convert to Excel Button */}
              <button
                type="button"
                onClick={() => {
                  const currentLayout: ExportLayoutMode = viewMode === 'ai_grid' ? 'ai_grid' : viewMode === 'framed' ? 'framed' : 'reconstructed';
                  if (onOpenExportModal) onOpenExportModal('excel', currentLayout);
                  else if (onExportExcelDirectly) onExportExcelDirectly();
                  else onGoToExcel();
                }}
                disabled={isProcessingOcr || (!extractedText && (!tableRows || tableRows.length === 0))}
                className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-semibold text-xs shadow-md shadow-emerald-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-white/20">
                    <Table className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-xs">Save as Excel</div>
                    <div className="text-[10px] text-emerald-100">
                      {viewMode === 'ai_grid' ? 'Excel AI Grid' : viewMode === 'framed' ? 'Frame Cards' : 'Excel Table'}
                    </div>
                  </div>
                </div>
                <Download className="w-4 h-4" />
              </button>

              {/* Direct Gemini AI Grid Engine Export Button */}
              <button
                type="button"
                onClick={() => {
                  if (onOpenExportModal) onOpenExportModal('pdf', 'ai_grid');
                }}
                disabled={isProcessingOcr || (!extractedText && !localReconstruction && (!tableRows || tableRows.length === 0))}
                className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-800 hover:from-emerald-800 hover:to-cyan-900 text-white font-semibold text-xs shadow-md shadow-teal-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
                title="Gemini AI Smart Cell & Grid Calculation Engine (PDF/Word/Excel)"
              >
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-white/20">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-xs">Gemini AI Grid</div>
                    <div className="text-[10px] text-teal-100">Smart Calculation</div>
                  </div>
                </div>
                <Download className="w-4 h-4" />
              </button>

              {/* Upload to Google Drive Button */}
              <button
                type="button"
                onClick={() => {
                  const currentLayout: ExportLayoutMode = viewMode === 'ai_grid' ? 'ai_grid' : viewMode === 'framed' ? 'framed' : 'reconstructed';
                  if (onOpenExportModal) onOpenExportModal('pdf', currentLayout);
                  else if (onQuickUploadToDrive) onQuickUploadToDrive();
                }}
                disabled={isProcessingOcr || (!extractedText && !localReconstruction)}
                className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-white/20">
                    <Cloud className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-xs">Upload to Drive</div>
                    <div className="text-[10px] text-sky-100">Cloud Sync</div>
                  </div>
                </div>
                <Sparkles className="w-4 h-4 text-sky-200" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Engine Fallback or Warning Banner */}
      {engineWarning && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl p-3 flex items-start justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
          <div className="space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <span>⚠️ AI Vision Status:</span>
              <span className="font-normal">{engineWarning}</span>
            </div>
            <p className="text-[11px] text-amber-800 dark:text-amber-300/80">
              Google AI Studio API Key ကို Settings (⚙️) တွင် ထည့်သွင်းထားပါက ScanToExcel အဆင့် ၁၀၀% တိကျသော Table Extraction ကို အသုံးပြုနိုင်ပါမည်။
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsApiKeyModalOpen(true)}
            className="shrink-0 px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-[11px] shadow-sm transition-colors"
          >
            🔑 Configure Key
          </button>
        </div>
      )}

      {/* OCR Results Section */}
      <div className="bg-white/95 dark:bg-dark-card/95 backdrop-blur-xs rounded-xl border border-emerald-100 dark:border-dark-border shadow-xs overflow-hidden transition-colors">
        {/* Header with View Switchers */}
        <div className="px-4 py-3 border-b border-emerald-100 dark:border-dark-border flex items-center justify-between flex-wrap gap-2 bg-emerald-50/40 dark:bg-dark-surface/50">
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="font-bold text-slate-900 dark:text-emerald-100 text-sm sm:text-base">
              Extracted OCR Structure & Layout
            </h2>
            {lastEngineUsed && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                lastEngineUsed.includes('AI')
                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                  : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
              }`}>
                {lastEngineUsed}
              </span>
            )}
          </div>

          {extractedText && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* AI Auto-Format & Align Lines/Columns Button */}
              <button
                onClick={handleAutoFormatAndAdjust}
                disabled={isAutoFormatting}
                title="AI Auto-Frame, Align Lines and Structure Columns"
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-200 dark:hover:bg-emerald-900 transition-all disabled:opacity-50"
              >
                {isAutoFormatting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                ) : (
                  <Wand2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                )}
                <span>AI Auto-Frame & Align</span>
              </button>

              {/* View Switcher Pills - Exactly 3 modes: Reconstructed, Frame Cards, Gemini AI Smart Cell & Grid Calculation Engine */}
              <div className="inline-flex rounded-lg p-0.5 bg-slate-100 dark:bg-dark-bg border border-slate-300 dark:border-dark-border text-xs">
                {/* 1. Reconstructed */}
                <button
                  type="button"
                  onClick={() => setViewMode('reconstructed')}
                  className={`px-2.5 py-1 rounded-md font-semibold flex items-center gap-1.5 transition-all ${
                    viewMode === 'reconstructed'
                      ? 'bg-white dark:bg-dark-card text-emerald-700 dark:text-emerald-300 shadow-xs ring-1 ring-emerald-500/30'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                  title="Reconstructed (1:1 Hybrid Coordinate-Aware Document Layout)"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Reconstructed</span>
                </button>

                {/* 2. Frame Cards */}
                <button
                  type="button"
                  onClick={() => setViewMode('framed')}
                  className={`px-2.5 py-1 rounded-md font-semibold flex items-center gap-1.5 transition-all ${
                    viewMode === 'framed'
                      ? 'bg-white dark:bg-dark-card text-emerald-700 dark:text-emerald-300 shadow-xs ring-1 ring-emerald-500/30'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                  title="Frame Cards (Auto-Framed Cards & Structure)"
                >
                  <Layout className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Frame Cards</span>
                </button>

                {/* 3. Gemini AI Smart Cell & Grid Calculation Engine */}
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('ai_grid');
                    loadAiGridData();
                  }}
                  className={`px-2.5 py-1 rounded-md font-semibold flex items-center gap-1.5 transition-all ${
                    viewMode === 'ai_grid'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                  title="Gemini AI Smart Cell & Grid Calculation Engine (Precise Cell Borders, Colors & Alignment)"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Gemini AI Smart Cell & Grid Calculation Engine</span>
                </button>
              </div>

              {/* Copy Text Button */}
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-900 transition-colors"
                title="Copy Text"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Copy</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="p-4">
          {isProcessingOcr ? (
            <div className="py-10 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin mb-3" />
              <p className="text-sm font-semibold text-slate-800 dark:text-emerald-100">
                {ocrProgress.status || 'Recognizing text with OCR engine...'}
              </p>
              {ocrProgress.progress > 0 && (
                <div className="w-56 bg-emerald-100 dark:bg-dark-border rounded-full h-2 mt-3 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-200"
                    style={{ width: `${Math.round(ocrProgress.progress * 100)}%` }}
                  />
                </div>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                Formatting 1:1 PDF & Excel structure with Myanmar Unicode...
              </p>
            </div>
          ) : extractedText || localReconstruction ? (
            <div className="space-y-3">
              {/* Mode 1: Reconstructed View */}
              {viewMode === 'reconstructed' && (
                localReconstruction?.htmlContent ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs px-1 text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                          1:1 Coordinate-Aware Document Layout
                        </span>
                        {localReconstruction.deskewAngleDeg !== undefined && localReconstruction.deskewAngleDeg !== 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300">
                            Auto-deskewed ({localReconstruction.deskewAngleDeg.toFixed(1)}°)
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Pixel-perfect tables, borders & alignments
                      </span>
                    </div>

                    <div className="p-6 sm:p-8 bg-white dark:bg-white text-slate-900 rounded-xl border border-emerald-200 dark:border-dark-border shadow-sm min-h-[300px] overflow-x-auto">
                      <div
                        className="prose max-w-none text-slate-900 leading-relaxed font-sans"
                        dangerouslySetInnerHTML={{ __html: localReconstruction.htmlContent }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="py-12 flex flex-col items-center justify-center bg-white dark:bg-dark-surface/40 rounded-xl border border-dashed border-emerald-300 text-center px-4">
                    <Sparkles className="w-8 h-8 text-emerald-600 mb-2" />
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      1:1 Reconstructed Document Layout
                    </p>
                    <p className="text-xs text-slate-500 mt-1 mb-3 max-w-md">
                      မူရင်းစာရွက်အတိုင်း တိကျသော Table Grid၊ Merged Cells၊ Header၊ Border၊ Font Style နှင့် အရောင်များဖြင့် ပြန်လည်တည်ဆောက်ရန် နှိပ်ပါ
                    </p>
                    <button
                      type="button"
                      onClick={handleAutoFormatAndAdjust}
                      disabled={isAutoFormatting}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold hover:shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                    >
                      {isAutoFormatting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                      <span>Generate 1:1 Reconstructed Layout</span>
                    </button>
                  </div>
                )
              )}

              {/* Mode 2: Frame Cards View */}
              {viewMode === 'framed' && (
                formattedDoc ? (
                  <AutoFramedDocumentView
                    title={formattedDoc.title}
                    subtitle={formattedDoc.subtitle}
                    sections={formattedDoc.sections}
                    tableData={tableRows}
                  />
                ) : (
                  <div className="p-6 bg-white dark:bg-dark-surface rounded-xl border border-slate-200 dark:border-dark-border text-center text-xs text-slate-500">
                    No structured sections found for Frame Cards.
                  </div>
                )
              )}

              {/* Mode 3: Gemini AI Smart Cell & Grid Calculation Engine View */}
              {viewMode === 'ai_grid' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 dark:from-emerald-950/40 dark:via-teal-950/40 dark:to-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-emerald-600 text-white">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>Gemini AI Smart Cell & Grid Calculation Engine</span>
                          <span className="text-[10px] bg-emerald-600 text-white font-semibold px-2 py-0.5 rounded-full">
                            Live Preview
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-300">
                          Cell Borders၊ Background Colors၊ Columns နှင့် Alignment များကို Gemini AI ဖြင့် တိကျစွာ တွက်ချက်ထားသော Preview
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => loadAiGridData(true)}
                        disabled={isLoadingAiGrid}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-dark-card border border-slate-300 dark:border-dark-border text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 transition-all disabled:opacity-50"
                        title="Recalculate AI Grid"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAiGrid ? 'animate-spin' : ''}`} />
                        <span>Recalculate</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (onOpenExportModal) onOpenExportModal('pdf', 'ai_grid');
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-all active:scale-95"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Save as PDF (AI Grid)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (onOpenExportModal) onOpenExportModal('word', 'ai_grid');
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all active:scale-95"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Save as Word (AI Grid)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (onOpenExportModal) onOpenExportModal('excel', 'ai_grid');
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all active:scale-95"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Save as Excel (AI Grid)</span>
                      </button>
                    </div>
                  </div>

                  {isLoadingAiGrid ? (
                    <div className="py-16 flex flex-col items-center justify-center bg-white dark:bg-dark-surface/40 rounded-xl border border-emerald-200 dark:border-dark-border text-center">
                      <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        Gemini AI Smart Cell & Grid Calculation Engine ဖြင့် တွက်ချက်နေပါသည်...
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Analyzing cell boundaries, borders, colors, column spans and typography
                      </p>
                    </div>
                  ) : aiGridHtml ? (
                    <div className="p-4 sm:p-6 bg-white text-slate-900 rounded-xl border border-emerald-200 shadow-sm overflow-x-auto">
                      <div dangerouslySetInnerHTML={{ __html: aiGridHtml }} />
                    </div>
                  ) : (
                    <div className="py-12 flex flex-col items-center justify-center bg-white dark:bg-dark-surface/40 rounded-xl border border-dashed border-emerald-300 text-center px-4">
                      <Sparkles className="w-8 h-8 text-emerald-600 mb-2" />
                      <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                        Gemini AI Smart Cell & Grid Calculation Engine Preview
                      </p>
                      <p className="text-xs text-slate-500 mt-1 mb-3">
                        ပုံရိပ်မှ ဇယားမျဉ်း၊ အရောင်နှင့် Cell ဖွဲ့စည်းမှုများကို အထူးတိကျစွာ တွက်ချက်ကြည့်ရှုနိုင်ပါသည်
                      </p>
                      <button
                        type="button"
                        onClick={() => loadAiGridData(true)}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold hover:shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>Calculate AI Grid Preview</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-center px-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 max-w-sm">
                Scan a document via camera or upload an image to perform instant OCR extraction.
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400/70 mt-1">
                Receipts, invoices, tables, and physical forms are automatically converted to 1:1 PDF & Excel.
              </p>
            </div>
          )}

          {/* Bottom Conversion Action Footer */}
          {extractedText && (
            <div className="mt-4 pt-3 border-t border-emerald-100 dark:border-dark-border flex items-center justify-between flex-wrap gap-2">
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <span>Layout: </span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">
                  {viewMode === 'ai_grid'
                    ? 'Gemini AI Smart Cell & Grid Calculation Engine'
                    : viewMode === 'framed'
                    ? 'Frame Cards'
                    : 'Reconstructed'}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Save as PDF */}
                <button
                  type="button"
                  onClick={() => {
                    const currentLayout: ExportLayoutMode = viewMode === 'ai_grid' ? 'ai_grid' : viewMode === 'framed' ? 'framed' : 'reconstructed';
                    if (onOpenExportModal) onOpenExportModal('pdf', currentLayout);
                    else onSaveAsPdf();
                  }}
                  className="flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-semibold text-xs shadow-sm shadow-red-500/20 transition-all active:scale-[0.98]"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Save as PDF</span>
                </button>

                {/* Save as Word */}
                <button
                  type="button"
                  onClick={() => {
                    const currentLayout: ExportLayoutMode = viewMode === 'ai_grid' ? 'ai_grid' : viewMode === 'framed' ? 'framed' : 'reconstructed';
                    if (onOpenExportModal) onOpenExportModal('word', currentLayout);
                  }}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold text-xs shadow-sm shadow-blue-500/20 transition-all active:scale-[0.98]"
                  title="Save as Microsoft Word (.docx)"
                >
                  <FileEdit className="w-3.5 h-3.5" />
                  <span>Save as Word</span>
                </button>

                {/* Export Excel */}
                <button
                  type="button"
                  onClick={() => {
                    const currentLayout: ExportLayoutMode = viewMode === 'ai_grid' ? 'ai_grid' : viewMode === 'framed' ? 'framed' : 'reconstructed';
                    if (onOpenExportModal) onOpenExportModal('excel', currentLayout);
                    else if (onExportExcelDirectly) onExportExcelDirectly();
                    else onGoToExcel();
                  }}
                  className="flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-semibold text-xs shadow-sm shadow-emerald-500/20 transition-all active:scale-[0.98]"
                >
                  <Table className="w-3.5 h-3.5" />
                  <span>Save as Excel</span>
                </button>

                {/* Gemini AI Grid direct modal */}
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenExportModal) onOpenExportModal('pdf', 'ai_grid');
                  }}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white font-semibold text-xs shadow-sm shadow-teal-500/20 transition-all active:scale-[0.98]"
                  title="Save using Gemini AI Smart Cell & Grid Calculation Engine"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Gemini AI Grid</span>
                </button>

                {/* Upload to Google Drive */}
                <button
                  type="button"
                  onClick={() => {
                    const currentLayout: ExportLayoutMode = viewMode === 'ai_grid' ? 'ai_grid' : viewMode === 'framed' ? 'framed' : 'reconstructed';
                    if (onOpenExportModal) onOpenExportModal('pdf', currentLayout);
                    else if (onQuickUploadToDrive) onQuickUploadToDrive();
                  }}
                  className="flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-xs shadow-sm shadow-blue-500/20 transition-all active:scale-[0.98]"
                >
                  <Cloud className="w-3.5 h-3.5" />
                  <span>Upload to Drive</span>
                </button>

                {/* Open in Interactive Excel Studio */}
                <button
                  type="button"
                  onClick={onGoToExcel}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 dark:bg-dark-elevated hover:bg-emerald-50 dark:hover:bg-dark-border text-slate-700 dark:text-slate-200 font-semibold text-xs border border-slate-200 dark:border-dark-border transition-all"
                  title="Open in Interactive Excel Studio"
                >
                  <span>Studio</span>
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-600" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Gemini API Key Configuration Modal */}
      {isApiKeyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-dark-card border border-emerald-200 dark:border-dark-border rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-border pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">Gemini AI Vision Configuration</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Google AI Studio Free Tier (1,500 req/day)</p>
                </div>
              </div>
              <button
                onClick={() => setIsApiKeyModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-elevated text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Google AI Studio API Key:
                  </label>
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                  >
                    🔑 Get Free Key ↗
                  </a>
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={e => {
                      setApiKeyInput(e.target.value);
                      setTestResult(null);
                    }}
                    placeholder="AIzaSy..."
                    className="flex-1 text-xs font-mono p-2.5 rounded-lg border border-slate-300 dark:border-dark-border bg-slate-50 dark:bg-dark-bg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleTestKey}
                    disabled={isTestingKey || !apiKeyInput.trim()}
                    className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-dark-elevated hover:bg-emerald-100 dark:hover:bg-emerald-950 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-300 dark:border-dark-border disabled:opacity-50 transition-colors flex items-center gap-1 shrink-0"
                  >
                    {isTestingKey ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                    ) : (
                      <span>Test Key</span>
                    )}
                  </button>
                </div>
              </div>

              {testResult && (
                <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                  testResult.success 
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800' 
                    : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                }`}>
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <X className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}

              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-[11px] text-emerald-800 dark:text-emerald-300 space-y-1">
                <p className="font-semibold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  ScanToExcel Precision Features:
                </p>
                <p>✓ 100% structured column-row alignment for invoices, bills & borderless receipts.</p>
                <p>✓ Free Tier provides 1,500 requests per day at zero cost.</p>
                <p>✓ Key is securely stored in your local browser only.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-dark-border">
              <button
                type="button"
                onClick={() => setIsApiKeyModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-elevated"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveApiKey}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors"
              >
                {apiKeySavedSuccess ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <span>Save Key</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
