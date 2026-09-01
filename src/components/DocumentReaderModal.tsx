import React, { useState } from 'react';
import {
  FileText,
  X,
  Printer,
  Share2,
  Copy,
  Check,
  Download
} from 'lucide-react';
import { LocalFileItem } from '../types';
import { OcrService } from '../services/ocrService';

interface DocumentReaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: LocalFileItem | null;
  imageSrc?: string | null;
  ocrText?: string;
  tableData?: string[][];
  onPrint?: () => void;
  onShare?: () => void;
  onDownload?: () => void;
}

export const DocumentReaderModal: React.FC<DocumentReaderModalProps> = ({
  isOpen,
  onClose,
  file,
  imageSrc,
  ocrText,
  tableData,
  onPrint,
  onShare,
  onDownload,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !file) return null;

  const handleCopyOcr = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayText = ocrText || file.textContent || '';
  const rawTable = tableData || file.tableData || [];
  const displayTable = OcrService.normalizeTable(rawTable);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-dark-card w-full max-w-2xl max-h-[90vh] rounded-t-3xl sm:rounded-2xl border border-emerald-100 dark:border-dark-border shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-200 transition-colors">
        {/* Grab Handle */}
        <div className="w-full flex justify-center pt-2.5 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-emerald-100 dark:border-dark-border flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-slate-900 dark:text-emerald-100 text-sm sm:text-base truncate">
                {file.name}
              </h2>
              <p className="text-xs text-emerald-700/80 dark:text-emerald-400/70 truncate">
                Local Archive: {file.path}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-dark-elevated transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="px-4 py-2 bg-emerald-50/40 dark:bg-dark-surface border-b border-emerald-100 dark:border-dark-border flex items-center justify-around text-xs font-semibold text-emerald-900 dark:text-emerald-300">
          <button
            onClick={onDownload}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg hover:bg-emerald-100/60 dark:hover:bg-dark-elevated transition-colors text-emerald-700 dark:text-emerald-400"
          >
            <Download className="w-4 h-4" />
            <span>Download</span>
          </button>

          <button
            onClick={onPrint}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg hover:bg-emerald-100/60 dark:hover:bg-dark-elevated transition-colors text-slate-700 dark:text-slate-300"
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </button>

          <button
            onClick={onShare}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg hover:bg-emerald-100/60 dark:hover:bg-dark-elevated transition-colors text-slate-700 dark:text-slate-300"
          >
            <Share2 className="w-4 h-4" />
            <span>Share</span>
          </button>
        </div>

        {/* Scrollable Reader Content */}
        <div className="p-5 overflow-y-auto space-y-6 max-h-[calc(90vh-140px)]">
          {/* 1. Scanned Document Capture */}
          {imageSrc && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-400 tracking-wider">
                ORIGINAL SCANNED DOCUMENT
              </h4>
              <div className="bg-slate-950 dark:bg-black rounded-xl overflow-hidden p-2 flex items-center justify-center max-h-72 border border-emerald-900/30 dark:border-dark-border">
                <img
                  src={imageSrc}
                  alt="Scanned Document"
                  className="max-h-64 max-w-full object-contain rounded"
                />
              </div>
            </div>
          )}

          {/* 2. Recognized OCR Text */}
          {displayText && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-400 tracking-wider">
                  RECOGNIZED OCR TEXT
                </h4>
                <button
                  onClick={() => handleCopyOcr(displayText)}
                  className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 font-semibold"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-3.5 bg-emerald-50/20 dark:bg-dark-bg border border-emerald-100 dark:border-dark-border rounded-xl font-mono text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                {displayText}
              </div>
            </div>
          )}

          {/* 3. Extracted Data Matrix */}
          {displayTable && displayTable.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-400 tracking-wider">
                EXTRACTED DATA MATRIX
              </h4>
              <div className="overflow-x-auto border border-emerald-100 dark:border-dark-border rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-emerald-50/70 dark:bg-dark-surface border-b border-emerald-100 dark:border-dark-border">
                      {(displayTable[0] || []).map((col, idx) => (
                        <th
                          key={idx}
                          className="py-2 px-3 font-bold text-emerald-950 dark:text-emerald-300 border-r border-emerald-100 dark:border-dark-border last:border-r-0 whitespace-nowrap"
                        >
                          {col || `Col ${idx + 1}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-100/60 dark:divide-dark-border">
                    {displayTable.slice(1).map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-emerald-50/40 dark:hover:bg-dark-surface">
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className="py-2 px-3 text-slate-700 dark:text-slate-300 font-mono border-r border-emerald-100/60 dark:border-dark-border last:border-r-0"
                          >
                            {cell || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

