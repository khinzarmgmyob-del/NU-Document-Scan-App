import React, { useRef, useState, useEffect } from 'react';
import { Camera, Image as ImageIcon, Copy, Check, FileText, Table, Loader2, Sparkles, X, Settings, Key, RefreshCw, CheckCircle2 } from 'lucide-react';
import { SAMPLE_DOCUMENTS, SampleDoc, OcrService } from '../services/ocrService';

interface ScannerTabProps {
  scannedImage: string | null;
  extractedText: string;
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
  onGoToExcel: () => void;
  onClearScan: () => void;
}

export const ScannerTab: React.FC<ScannerTabProps> = ({
  scannedImage,
  extractedText,
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
  onGoToExcel,
  onClearScan,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [selectedSample, setSelectedSample] = useState<string | null>(null);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeySavedSuccess, setApiKeySavedSuccess] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

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

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-8">
      {/* Engine Selection Toggle Card */}
      <div className="bg-white/95 dark:bg-dark-card/95 backdrop-blur-xs rounded-xl p-3 border border-emerald-100 dark:border-dark-border shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-800 dark:text-emerald-200 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Table Extraction Engine:
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              {selectedEngine === 'gemini' ? '✨ ScanToExcel-grade precision' : '⚡ 100% Offline / Client-side'}
            </span>
            <button
              type="button"
              onClick={() => setIsApiKeyModalOpen(true)}
              className="p-1 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-950/60 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
              title="Configure Gemini API Key"
            >
              <Settings className="w-3.5 h-3.5" />
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
            <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Gemini 3.7 Flash (100% Table Match)</span>
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
              onClick={() => handleReScanCurrent(selectedEngine)}
              title="Re-run OCR on current image"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-700 text-white text-xs font-semibold backdrop-blur-xs transition-colors shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Re-scan</span>
            </button>
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
        {/* Header */}
        <div className="px-4 py-3 border-b border-emerald-100 dark:border-dark-border flex items-center justify-between bg-emerald-50/40 dark:bg-dark-surface/50">
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="font-bold text-slate-900 dark:text-emerald-100 text-sm sm:text-base">
              Extracted OCR Text
            </h2>
            {lastEngineUsed && (
              <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                lastEngineUsed.includes('AI')
                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                  : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
              }`}>
                {lastEngineUsed}
              </span>
            )}
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

