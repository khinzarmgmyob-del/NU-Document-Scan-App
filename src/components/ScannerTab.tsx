import React, { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Copy, Check, FileText, Table, Loader2, Sparkles, X } from 'lucide-react';
import { SAMPLE_DOCUMENTS, SampleDoc } from '../services/ocrService';

interface ScannerTabProps {
  scannedImage: string | null;
  extractedText: string;
  isProcessingOcr: boolean;
  ocrProgress: { progress: number; status: string };
  onScanCamera: () => void;
  onImageSelected: (file: File | string) => void;
  onTextChange: (text: string) => void;
  onSaveAsPdf: () => void;
  onGoToExcel: () => void;
  onClearScan: () => void;
}

export const ScannerTab: React.FC<ScannerTabProps> = ({
  scannedImage,
  extractedText,
  isProcessingOcr,
  ocrProgress,
  onScanCamera,
  onImageSelected,
  onTextChange,
  onSaveAsPdf,
  onGoToExcel,
  onClearScan,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [selectedSample, setSelectedSample] = useState<string | null>(null);

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

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-8">
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
        <div className="flex items-center gap-1.5 mb-2.5">
          <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200">Sample OCR Templates:</span>
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

      {/* Image Preview Container (if image selected) */}
      {scannedImage && (
        <div className="relative bg-slate-950 dark:bg-black rounded-xl overflow-hidden shadow-inner border border-emerald-900/30 dark:border-dark-border">
          <div className="h-56 sm:h-64 flex items-center justify-center p-3">
            <img
              src={scannedImage}
              alt="Scanned Document"
              className="max-h-full max-w-full object-contain rounded-lg shadow-md"
            />
          </div>
          <div className="absolute top-2 right-2 flex items-center gap-1.5">
            <button
              onClick={onClearScan}
              title="Remove Scan"
              className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur-xs transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* OCR Results Section */}
      <div className="bg-white/95 dark:bg-dark-card/95 backdrop-blur-xs rounded-xl border border-emerald-100 dark:border-dark-border shadow-xs overflow-hidden transition-colors">
        {/* Header */}
        <div className="px-4 py-3 border-b border-emerald-100 dark:border-dark-border flex items-center justify-between bg-emerald-50/40 dark:bg-dark-surface/50">
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="font-bold text-slate-900 dark:text-emerald-100 text-sm sm:text-base">
              Extracted OCR Text
            </h2>
          </div>

          {extractedText && (
            <div className="flex items-center gap-2">
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
                    <span>Copy Text</span>
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
                <div className="w-48 bg-emerald-100 dark:bg-dark-border rounded-full h-1.5 mt-3 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-200"
                    style={{ width: `${Math.round(ocrProgress.progress * 100)}%` }}
                  />
                </div>
              )}
            </div>
          ) : extractedText ? (
            <div className="space-y-3">
              <textarea
                value={extractedText}
                onChange={e => onTextChange(e.target.value)}
                rows={8}
                className="w-full font-mono text-xs sm:text-sm p-3 rounded-lg border border-emerald-200 dark:border-dark-border bg-emerald-50/20 dark:bg-dark-bg text-slate-900 dark:text-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-y leading-relaxed"
                placeholder="OCR recognized text will appear here..."
              />
              <div className="flex items-center justify-between text-[11px] text-emerald-800/80 dark:text-emerald-400/80 px-1">
                <span>{extractedText.split('\n').filter(l => l.trim()).length} lines detected</span>
                <span>Editable text buffer</span>
              </div>
            </div>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-center px-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 max-w-sm">
                Scan a document via camera or choose an image to perform OCR extraction.
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400/70 mt-1">
                Receipts, invoices, tables, and physical forms are automatically parsed.
              </p>
            </div>
          )}

          {/* Dual Action Buttons: Save as PDF & To Excel */}
          {extractedText && (
            <div className="mt-4 pt-3 border-t border-emerald-100 dark:border-dark-border grid grid-cols-2 gap-3">
              <button
                onClick={onSaveAsPdf}
                className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-semibold text-xs sm:text-sm shadow-sm shadow-red-500/20 transition-all active:scale-[0.98]"
              >
                <FileText className="w-4 h-4" />
                <span>Save as PDF</span>
              </button>

              <button
                onClick={onGoToExcel}
                className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-semibold text-xs sm:text-sm shadow-sm shadow-emerald-500/20 transition-all active:scale-[0.98]"
              >
                <Table className="w-4 h-4" />
                <span>To Excel</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

