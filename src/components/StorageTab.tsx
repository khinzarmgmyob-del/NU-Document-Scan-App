import React, { useRef } from 'react';
import {
  FileText,
  Table,
  FileSpreadsheet,
  Mic,
  FileCode,
  FolderOpen,
  CloudUpload,
  Cloud,
  CheckCircle2,
  Trash2,
  HardDrive,
  Eye
} from 'lucide-react';
import { LocalFileItem, DriveAccount, FilterCategory } from '../types';
import { StorageService } from '../services/storageService';

interface StorageTabProps {
  files: LocalFileItem[];
  selectedFilter: FilterCategory;
  driveAccount: DriveAccount;
  onFilterChange: (filter: FilterCategory) => void;
  onToggleDrive: () => void;
  onUploadToDrive: (file: LocalFileItem) => void;
  onOpenFile: (file: LocalFileItem) => void;
  onDeleteFile: (id: string) => void;
  onImportFile: (file: File) => void;
}

export const StorageTab: React.FC<StorageTabProps> = ({
  files,
  selectedFilter,
  driveAccount,
  onFilterChange,
  onToggleDrive,
  onUploadToDrive,
  onOpenFile,
  onDeleteFile,
  onImportFile,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredFiles = files.filter(f => {
    if (selectedFilter === 'pdf') return f.isPdf;
    if (selectedFilter === 'excel') return f.isExcel || f.isCsv;
    if (selectedFilter === 'audio') return f.isAudio;
    return true;
  });

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportFile(file);
    }
  };

  const getFileIcon = (item: LocalFileItem) => {
    if (item.isPdf) {
      return (
        <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5" />
        </div>
      );
    }
    if (item.isExcel) {
      return (
        <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
          <Table className="w-5 h-5" />
        </div>
      );
    }
    if (item.isCsv) {
      return (
        <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
          <FileSpreadsheet className="w-5 h-5" />
        </div>
      );
    }
    if (item.isAudio) {
      return (
        <div className="w-10 h-10 rounded-xl bg-emerald-100/70 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
          <Mic className="w-5 h-5" />
        </div>
      );
    }
    return (
      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-dark-surface text-slate-600 dark:text-slate-400 flex items-center justify-center shrink-0">
        <FileCode className="w-5 h-5" />
      </div>
    );
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-8">
      {/* Google Drive Status Banner Card */}
      <div
        className={`rounded-2xl border p-4 transition-all ${
          driveAccount.isSignedIn
            ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200'
            : 'bg-white/95 dark:bg-dark-card/95 border-emerald-100 dark:border-dark-border text-slate-800 dark:text-slate-200'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-white dark:bg-dark-surface shadow-xs border border-emerald-100 dark:border-dark-border flex items-center justify-center shrink-0">
              {driveAccount.isSignedIn ? (
                <Cloud className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <HardDrive className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm leading-snug truncate">
                {driveAccount.isSignedIn ? 'Connected to Google Drive' : 'Google Drive Backup & Sync'}
              </h3>
              <p className="text-xs text-emerald-700/80 dark:text-emerald-400/70 truncate">
                {driveAccount.isSignedIn
                  ? `${driveAccount.email} • Cloud storage active`
                  : 'Sign in to automatically sync scans & spreadsheets'}
              </p>
            </div>
          </div>

          <button
            onClick={onToggleDrive}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all shrink-0 ${
              driveAccount.isSignedIn
                ? 'bg-white dark:bg-dark-card hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-xs'
            }`}
          >
            {driveAccount.isSignedIn ? 'Disconnect' : 'Connect'}
          </button>
        </div>
      </div>

      {/* Pick & Import Document Button */}
      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white dark:bg-dark-card hover:bg-emerald-50 dark:hover:bg-dark-elevated text-emerald-950 dark:text-emerald-300 font-semibold text-xs sm:text-sm border border-emerald-200 dark:border-dark-border shadow-2xs transition-all active:scale-[0.99]"
      >
        <FolderOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        <span>Pick &amp; Read Local PDF / Document</span>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.xlsx,.xls,.csv,.txt,image/*"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Filter Category Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {(
          [
            { id: 'all', label: 'All Files' },
            { id: 'pdf', label: 'PDFs (.pdf)' },
            { id: 'excel', label: 'Sheets (.xlsx / .csv)' },
            { id: 'audio', label: 'Audio (.m4a / .webm)' },
          ] as const
        ).map(chip => (
          <button
            key={chip.id}
            onClick={() => onFilterChange(chip.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
              selectedFilter === chip.id
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white dark:bg-dark-card text-emerald-900 dark:text-emerald-300 border border-emerald-200 dark:border-dark-border hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-dark-elevated'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Archive Section Header */}
      <div className="flex items-center justify-between px-1">
        <h3 className="font-bold text-slate-900 dark:text-emerald-100 text-sm">Local Storage Archives</h3>
        <span className="text-xs text-emerald-700 dark:text-emerald-400/70 font-medium">{filteredFiles.length} files</span>
      </div>

      {/* Files List */}
      {filteredFiles.length === 0 ? (
        <div className="bg-white/90 dark:bg-dark-card/90 rounded-xl border border-emerald-100 dark:border-dark-border p-12 text-center transition-colors">
          <FolderOpen className="w-10 h-10 text-emerald-300 dark:text-emerald-800 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">No local files found in this category.</p>
          <p className="text-xs text-emerald-700 dark:text-emerald-400/70 mt-1">
            Scanned docs, generated PDFs, and exported spreadsheets will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredFiles.map(file => (
            <div
              key={file.id}
              onClick={() => onOpenFile(file)}
              className="bg-white/95 dark:bg-dark-card/95 backdrop-blur-xs rounded-xl border border-emerald-100 dark:border-dark-border p-3.5 shadow-2xs flex items-center justify-between gap-3 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-xs transition-all cursor-pointer group"
            >
              <div className="flex items-center space-x-3 min-w-0">
                {getFileIcon(file)}
                <div className="min-w-0">
                  <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-emerald-100 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {file.name}
                  </div>
                  <div className="text-[11px] text-emerald-700/80 dark:text-emerald-400/70 flex items-center gap-2">
                    <span>{StorageService.formatFileSize(file.sizeBytes)}</span>
                    <span>•</span>
                    <span>
                      {new Date(file.modifiedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {file.driveSynced && (
                      <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3 h-3" />
                        Synced
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-1 shrink-0" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => onOpenFile(file)}
                  className="p-2 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg hover:bg-emerald-50 dark:hover:bg-dark-elevated transition-colors"
                  title="Open & Read Document"
                >
                  <Eye className="w-4 h-4" />
                </button>

                <button
                  onClick={() => onUploadToDrive(file)}
                  className="p-2 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg hover:bg-emerald-50 dark:hover:bg-dark-elevated transition-colors"
                  title="Upload to Google Drive"
                >
                  <CloudUpload className="w-4 h-4" />
                </button>

                <button
                  onClick={() => onDeleteFile(file.id)}
                  className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  title="Delete File"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

