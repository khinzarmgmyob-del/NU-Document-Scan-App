import React, { useState } from 'react';
import { Scan, Cloud, HardDrive, Sun, Moon, Shield, UserCheck, ChevronDown, UserPlus } from 'lucide-react';
import { AppUser, DriveAccount } from '../types';

interface NavbarProps {
  driveAccount: DriveAccount;
  currentUser: AppUser;
  users: AppUser[];
  isDark: boolean;
  onToggleTheme: () => void;
  onToggleDrive: () => void;
  onOpenStorage: () => void;
  onSwitchUser: (userId: string) => void;
  onOpenSetup?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  driveAccount,
  currentUser,
  users,
  isDark,
  onToggleTheme,
  onToggleDrive,
  onOpenStorage,
  onSwitchUser,
  onOpenSetup,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-white/85 dark:bg-dark-bg/85 backdrop-blur-md border-b border-emerald-100/80 dark:border-dark-border shadow-xs transition-colors duration-300">
      <div className="max-w-4xl mx-auto px-4 py-2.5 sm:py-3 flex items-center justify-between">
        {/* Brand Logo & Title */}
        <div className="flex items-center space-x-2.5 sm:space-x-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 dark:from-emerald-400 dark:to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 shrink-0">
            <Scan className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-emerald-50 leading-tight flex items-center gap-1.5">
              NextUnit DocuScan
            </h1>
            <p className="text-[11px] sm:text-xs text-emerald-700 dark:text-emerald-400/80 font-medium">
              OCR • PDF • Excel • Voice • Drive
            </p>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          {/* User Profile / Quick Switcher Pill */}
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(prev => !prev)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-dark-elevated hover:bg-slate-200/80 dark:hover:bg-dark-card border border-slate-200/80 dark:border-dark-border text-xs font-semibold transition-all"
              title="Click to switch user role or account"
            >
              <div
                className={`w-5 h-5 rounded-md flex items-center justify-center text-white text-[10px] font-bold ${
                  currentUser.avatarColor || 'bg-emerald-600'
                }`}
              >
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 max-w-[90px] sm:max-w-[120px] truncate leading-tight">
                  {currentUser.name.split(' ')[0]}
                </span>
                <span
                  className={`text-[9px] font-bold leading-none ${
                    currentUser.role === 'admin'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-blue-600 dark:text-blue-400'
                  }`}
                >
                  {currentUser.role === 'admin' ? 'Admin' : 'Normal'}
                </span>
              </div>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {/* Dropdown Menu */}
            {isUserMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsUserMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-dark-card rounded-2xl shadow-xl border border-slate-200 dark:border-dark-border z-50 p-2 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-dark-border">
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Current Active User
                    </div>
                    <div className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5 mt-0.5">
                      <span>{currentUser.name}</span>
                      {currentUser.role === 'admin' ? (
                        <Shield className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      {currentUser.branch} ({currentUser.role === 'admin' ? 'Admin User' : 'Normal User'})
                    </div>
                  </div>

                  <div className="py-1">
                    <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Switch User Role / Account
                    </div>
                    {users.map(u => (
                      <button
                        key={u.id}
                        onClick={() => {
                          onSwitchUser(u.id);
                          setIsUserMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors text-left ${
                          u.id === currentUser.id
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold'
                            : 'hover:bg-slate-50 dark:hover:bg-dark-elevated text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold ${
                              u.avatarColor || 'bg-slate-500'
                            }`}
                          >
                            {u.name.charAt(0)}
                          </div>
                          <span className="truncate max-w-[130px]">{u.name}</span>
                        </div>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                            u.role === 'admin'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                          }`}
                        >
                          {u.role === 'admin' ? 'Admin' : 'Normal'}
                        </span>
                      </button>
                    ))}
                  </div>

                  {currentUser.role === 'admin' && onOpenSetup && (
                    <div className="pt-1 border-t border-slate-100 dark:border-dark-border">
                      <button
                        onClick={() => {
                          onOpenSetup();
                          setIsUserMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-semibold hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        <span>Open B setup (Branch Settings)</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Theme Toggle (Light / Dark) */}
          <button
            onClick={onToggleTheme}
            title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            className="p-2 rounded-xl text-slate-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-dark-card border border-transparent dark:border-dark-border transition-all"
          >
            {isDark ? <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-700" />}
          </button>

          <button
            onClick={onOpenStorage}
            title="Local Archives"
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-dark-card border border-transparent dark:border-dark-border transition-colors"
          >
            <HardDrive className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <button
            onClick={onToggleDrive}
            title={driveAccount.isSignedIn ? `Google Drive Active (${driveAccount.email})` : 'Connect Google Drive'}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
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


