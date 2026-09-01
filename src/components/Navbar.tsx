import React from 'react';
import { Scan, Cloud, HardDrive, Sun, Moon } from 'lucide-react';
import { DriveAccount } from '../types';

interface NavbarProps {
  driveAccount: DriveAccount;
  isDark: boolean;
  onToggleTheme: () => void;
  onToggleDrive: () => void;
  onOpenStorage: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  driveAccount,
  isDark,
  onToggleTheme,
  onToggleDrive,
  onOpenStorage,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/85 dark:bg-dark-bg/85 backdrop-blur-md border-b border-emerald-100/80 dark:border-dark-border shadow-xs transition-colors duration-300">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Brand Logo & Title */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 dark:from-emerald-400 dark:to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
            <Scan className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-emerald-50 leading-tight flex items-center gap-1.5">
              NextUnit DocuScan
            </h1>
            <p className="text-xs text-emerald-700 dark:text-emerald-400/80 font-medium">
              OCR • PDF • Excel • Voice • Drive
            </p>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          {/* Theme Toggle (Light / Dark) */}
          <button
            onClick={onToggleTheme}
            title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            className="p-2 rounded-xl text-slate-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-dark-card border border-transparent dark:border-dark-border transition-all"
          >
            {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-emerald-700" />}
          </button>

          <button
            onClick={onOpenStorage}
            title="Local Archives"
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-dark-card border border-transparent dark:border-dark-border transition-colors"
          >
            <HardDrive className="w-5 h-5" />
          </button>

          <button
            onClick={onToggleDrive}
            title={driveAccount.isSignedIn ? `Google Drive Active (${driveAccount.email})` : 'Connect Google Drive'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              driveAccount.isSignedIn
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                : 'bg-white dark:bg-dark-card text-slate-700 dark:text-slate-300 border-slate-200 dark:border-dark-border hover:bg-slate-50 dark:hover:bg-dark-elevated'
            }`}
          >
            {driveAccount.isSignedIn ? (
              <>
                <Cloud className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline">Drive Synced</span>
              </>
            ) : (
              <>
                <Cloud className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                <span className="hidden sm:inline">Connect Drive</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

