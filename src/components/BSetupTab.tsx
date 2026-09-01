import React, { useState, useMemo } from 'react';
import {
  Users,
  Shield,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Filter,
  Calendar,
  Search,
  Building2,
  FileText,
  Table as TableIcon,
  Mic,
  Eye,
  Trash2,
  Download,
  RotateCcw,
  CheckCircle2,
  SlidersHorizontal,
  ArrowRightLeft,
  UserX,
  FileSpreadsheet
} from 'lucide-react';
import { AppUser, LocalFileItem, UserRole } from '../types';
import { StorageService } from '../services/storageService';

interface BSetupTabProps {
  currentUser: AppUser;
  users: AppUser[];
  files: LocalFileItem[];
  onAddUser: (user: Omit<AppUser, 'id' | 'createdAt'>) => void;
  onUpdateUser: (id: string, updates: Partial<Omit<AppUser, 'id' | 'createdAt'>>) => void;
  onDeleteUser: (id: string) => void;
  onSwitchUser: (userId: string) => void;
  onOpenFile: (file: LocalFileItem) => void;
  onDeleteFile: (id: string) => void;
}

export const BSetupTab: React.FC<BSetupTabProps> = ({
  currentUser,
  users,
  files,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onSwitchUser,
  onOpenFile,
  onDeleteFile,
}) => {
  // Main sub-section state
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'documents'>('users');

  // New User Form State
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('normal');
  const [newBranch, setNewBranch] = useState('Yangon Branch');
  const [formError, setFormError] = useState<string | null>(null);

  // Document Audit Filters
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [selectedDatePreset, setSelectedDatePreset] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'pdf' | 'excel' | 'audio'>('all');

  // Handle Add User Submit
  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) {
      setFormError('ကျေးဇူးပြု၍ အမည်နှင့် အီးမေးလ် ထည့်သွင်းပါ');
      return;
    }
    if (users.some(u => u.email.toLowerCase() === newEmail.trim().toLowerCase())) {
      setFormError('ဤအီးမေးလ်ဖြင့် User စာရင်း ရှိနှင့်ပြီးဖြစ်ပါသည်');
      return;
    }

    onAddUser({
      name: newName.trim(),
      email: newEmail.trim(),
      role: newRole,
      branch: newBranch.trim() || 'Headquarters',
      status: 'active',
    });

    setNewName('');
    setNewEmail('');
    setNewRole('normal');
    setNewBranch('Yangon Branch');
    setFormError(null);
    setIsAddUserModalOpen(false);
  };

  // Filter documents by User, Date, Type, Search
  const filteredFiles = useMemo(() => {
    return files.filter(file => {
      // 1. User Filter
      if (selectedUserId !== 'all') {
        if (file.userId !== selectedUserId) {
          // If file has no userId, check match with userName if available
          const matchingUser = users.find(u => u.id === selectedUserId);
          if (!matchingUser || file.userName !== matchingUser.name) {
            return false;
          }
        }
      }

      // 2. Type Filter
      if (typeFilter === 'pdf' && !file.isPdf) return false;
      if (typeFilter === 'excel' && !file.isExcel && !file.isCsv) return false;
      if (typeFilter === 'audio' && !file.isAudio) return false;

      // 3. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = file.name.toLowerCase().includes(query);
        const matchUser = (file.userName || '').toLowerCase().includes(query);
        const matchBranch = (file.branch || '').toLowerCase().includes(query);
        const matchText = (file.textContent || '').toLowerCase().includes(query);
        if (!matchName && !matchUser && !matchBranch && !matchText) {
          return false;
        }
      }

      // 4. Date Filter
      const fileDate = new Date(file.modifiedAt);
      const now = new Date();

      if (selectedDatePreset === 'today') {
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (fileDate < todayStart) return false;
      } else if (selectedDatePreset === 'yesterday') {
        const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (fileDate < yesterdayStart || fileDate >= todayStart) return false;
      } else if (selectedDatePreset === 'week') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (fileDate < sevenDaysAgo) return false;
      } else if (selectedDatePreset === 'month') {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (fileDate < thirtyDaysAgo) return false;
      } else if (selectedDatePreset === 'custom') {
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (fileDate < start) return false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (fileDate > end) return false;
        }
      }

      return true;
    });
  }, [files, selectedUserId, typeFilter, searchQuery, selectedDatePreset, startDate, endDate, users]);

  // Statistics
  const adminCount = users.filter(u => u.role === 'admin').length;
  const normalCount = users.filter(u => u.role === 'normal').length;
  const activeCount = users.filter(u => u.status === 'active').length;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-dark-card border border-emerald-100 dark:border-dark-border rounded-2xl p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-600/20 shrink-0">
              <SlidersHorizontal className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-emerald-50">
                  Setup (Branch &amp; User Administration)
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 rounded-full border border-emerald-200 dark:border-emerald-800">
                  Admin Only
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Manage system users, assign Admin/Normal roles, and download &amp; audit all documents across all branches and dates.
              </p>
            </div>
          </div>

          {/* Quick Active User Indicator & Switcher */}
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-dark-elevated p-2 rounded-xl border border-slate-200/80 dark:border-dark-border">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold ${currentUser.avatarColor || 'bg-emerald-600'}`}>
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div className="text-left pr-2">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                <span>{currentUser.name}</span>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                {currentUser.branch}
              </div>
            </div>
          </div>
        </div>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-100 dark:border-dark-border">
          <div className="bg-slate-50 dark:bg-dark-elevated/60 p-3 rounded-xl border border-slate-200/60 dark:border-dark-border">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Users</span>
            <div className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 mt-0.5">
              <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{users.length}</span>
              <span className="text-[10px] font-normal text-emerald-700 dark:text-emerald-400">({activeCount} Active)</span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-dark-elevated/60 p-3 rounded-xl border border-slate-200/60 dark:border-dark-border">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Admin Users</span>
            <div className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 mt-0.5">
              <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{adminCount}</span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-dark-elevated/60 p-3 rounded-xl border border-slate-200/60 dark:border-dark-border">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Normal Users</span>
            <div className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 mt-0.5">
              <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>{normalCount}</span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-dark-elevated/60 p-3 rounded-xl border border-slate-200/60 dark:border-dark-border">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">System Archives</span>
            <div className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 mt-0.5">
              <FileSpreadsheet className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>{files.length}</span>
              <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">files</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Switcher (User Setup vs Document Monitoring) */}
      <div className="flex border-b border-slate-200 dark:border-dark-border">
        <button
          onClick={() => setActiveSubTab('users')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeSubTab === 'users'
              ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Setup &amp; Rights (အသုံးပြုသူများ စီမံခြင်း)</span>
          <span className="px-2 py-0.5 text-xs bg-slate-200 dark:bg-dark-elevated rounded-full">
            {users.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('documents')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeSubTab === 'documents'
              ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Filter className="w-4 h-4" />
          <span>All Users Document Monitor (User &amp; Date Filter)</span>
          <span className="px-2 py-0.5 text-xs bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 rounded-full font-bold">
            {filteredFiles.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: USER MANAGEMENT & ROLE SETUP */}
      {/* ========================================================================= */}
      {activeSubTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50 dark:bg-dark-elevated/40 p-4 rounded-xl border border-slate-200/80 dark:border-dark-border">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                System Users &amp; Role Permissions
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                <strong>Normal User:</strong> Access to Scanner, Excel, Voice, and Storage tabs. | <strong>Admin User:</strong> Has access to all tabs including <strong>B setup</strong>.
              </p>
            </div>

            <button
              onClick={() => setIsAddUserModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              <span>User အသစ်ဆောက်ရန် (Add User)</span>
            </button>
          </div>

          {/* User List Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {users.map(user => {
              const isCurrent = user.id === currentUser.id;
              const userDocsCount = files.filter(f => f.userId === user.id || f.userName === user.name).length;

              return (
                <div
                  key={user.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isCurrent
                      ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/80 shadow-xs'
                      : 'bg-white dark:bg-dark-card border-slate-200/90 dark:border-dark-border hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-xs shrink-0 ${
                          user.avatarColor || 'bg-slate-700'
                        }`}
                      >
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {user.name}
                          </h4>
                          {isCurrent && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-emerald-600 text-white rounded-md">
                              CURRENT ACTIVE
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                          {user.email}
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-xs">
                          <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            {user.branch}
                          </span>
                          <span className="text-slate-300 dark:text-slate-700">•</span>
                          <span className="text-slate-500 dark:text-slate-400">
                            {userDocsCount} uploads
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Role Badge */}
                    <div className="flex flex-col items-end gap-1.5">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${
                          user.role === 'admin'
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-blue-50 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                        }`}
                      >
                        {user.role === 'admin' ? (
                          <>
                            <Shield className="w-3.5 h-3.5" />
                            Admin User
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-3.5 h-3.5" />
                            Normal User
                          </>
                        )}
                      </span>

                      {/* Status badge */}
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          user.status === 'active'
                            ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}
                      >
                        {user.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  {/* Actions & Role Toggles for this User */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-dark-border flex items-center justify-between flex-wrap gap-2 text-xs">
                    {/* Fast Switch User */}
                    {!isCurrent && (
                      <button
                        onClick={() => onSwitchUser(user.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 dark:bg-dark-elevated hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 rounded-lg font-medium transition-colors border border-slate-200 dark:border-dark-border"
                        title="Switch active session to this user"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        <span>Switch to this user</span>
                      </button>
                    )}

                    <div className="flex items-center gap-1.5 ml-auto">
                      {/* Role Toggle Dropdown / Button */}
                      <button
                        onClick={() =>
                          onUpdateUser(user.id, {
                            role: user.role === 'admin' ? 'normal' : 'admin',
                          })
                        }
                        className="px-2.5 py-1.5 bg-slate-50 dark:bg-dark-elevated hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-dark-border font-medium transition-colors"
                        title="Toggle role right"
                      >
                        Change to {user.role === 'admin' ? 'Normal User' : 'Admin'}
                      </button>

                      {/* Status Toggle */}
                      <button
                        onClick={() =>
                          onUpdateUser(user.id, {
                            status: user.status === 'active' ? 'inactive' : 'active',
                          })
                        }
                        className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-elevated transition-colors"
                        title={user.status === 'active' ? 'Deactivate user' : 'Activate user'}
                      >
                        {user.status === 'active' ? <UserCheck className="w-4 h-4 text-emerald-600" /> : <UserX className="w-4 h-4 text-slate-400" />}
                      </button>

                      {/* Delete User (Cannot delete last admin or current user) */}
                      {!isCurrent && users.length > 1 && (
                        <button
                          onClick={() => {
                            if (window.confirm(`User "${user.name}" အား အမှန်တကယ် ဖျက်လိုပါသလား?`)) {
                              onDeleteUser(user.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                          title="Delete user"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: ALL USERS DOCUMENT MONITOR (MASTER FILTER BY USER & DATE) */}
      {/* ========================================================================= */}
      {activeSubTab === 'documents' && (
        <div className="space-y-4">
          {/* Master Filter Toolbar */}
          <div className="bg-white dark:bg-dark-card p-4 sm:p-5 rounded-2xl border border-emerald-100/90 dark:border-dark-border shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100 dark:border-dark-border">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Master Filter Bar (User &amp; Date Controls)
                </h3>
              </div>

              {(selectedUserId !== 'all' || selectedDatePreset !== 'all' || typeFilter !== 'all' || searchQuery.trim() || startDate || endDate) && (
                <button
                  onClick={() => {
                    setSelectedUserId('all');
                    setSelectedDatePreset('all');
                    setTypeFilter('all');
                    setSearchQuery('');
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 hover:underline font-medium"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Clear All Filters (မူလအတိုင်း ပြန်ထားရန်)</span>
                </button>
              )}
            </div>

            {/* Filter Inputs Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* 1. Filter by User */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>User အလိုက် Filter လုပ်ရန်</span>
                </label>
                <select
                  value={selectedUserId}
                  onChange={e => setSelectedUserId(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-dark-elevated border border-slate-200 dark:border-dark-border rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                >
                  <option value="all">👤 All Users (အသုံးပြုသူအားလုံး - {files.length} files)</option>
                  {users.map(u => {
                    const uFilesCount = files.filter(f => f.userId === u.id || f.userName === u.name).length;
                    return (
                      <option key={u.id} value={u.id}>
                        {u.role === 'admin' ? '🛡️ [Admin]' : '👤 [User]'} {u.name} ({u.branch}) - {uFilesCount} files
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* 2. Filter by Date Presets */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Date အလိုက် Filter လုပ်ရန်</span>
                </label>
                <select
                  value={selectedDatePreset}
                  onChange={e => setSelectedDatePreset(e.target.value as any)}
                  className="w-full text-xs bg-slate-50 dark:bg-dark-elevated border border-slate-200 dark:border-dark-border rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                >
                  <option value="all">📅 All Time (အချိန်အားလုံး)</option>
                  <option value="today">⚡ Today (ယနေ့ အပ်လုဒ်များ)</option>
                  <option value="yesterday">⏪ Yesterday (မနေ့က အပ်လုဒ်များ)</option>
                  <option value="week">📆 Last 7 Days (လွန်ခဲ့သော ၇ ရက်)</option>
                  <option value="month">🗓️ Last 30 Days (လွန်ခဲ့သော ရက် ၃၀)</option>
                  <option value="custom">🔍 Custom Date Range (ရက်စွဲ စိတ်ကြိုက်ရွေးရန်)</option>
                </select>
              </div>

              {/* 3. Filter by File Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>File Type (ဖိုင်အမျိုးအစား)</span>
                </label>
                <select
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value as any)}
                  className="w-full text-xs bg-slate-50 dark:bg-dark-elevated border border-slate-200 dark:border-dark-border rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                >
                  <option value="all">📁 All Formats (အားလုံး)</option>
                  <option value="pdf">📄 PDF Documents (.pdf)</option>
                  <option value="excel">📊 Excel &amp; CSV Sheets (.xlsx / .csv)</option>
                  <option value="audio">🎙️ Voice Notes (.m4a / .wav)</option>
                </select>
              </div>

              {/* 4. Search Query */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Search Query (ရှာဖွေရန်)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Doc name, invoice#, text..."
                    className="w-full text-xs bg-slate-50 dark:bg-dark-elevated border border-slate-200 dark:border-dark-border rounded-xl pl-8 pr-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>
              </div>
            </div>

            {/* Custom Date Range Pickers (shown when Custom is selected) */}
            {selectedDatePreset === 'custom' && (
              <div className="flex items-center gap-3 pt-2 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/50 flex-wrap text-xs">
                <span className="font-semibold text-emerald-800 dark:text-emerald-300">ရက်စွဲသတ်မှတ်ရန်:</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">From (စတင်ရက်):</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-lg px-2 py-1 text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">To (ပြီးဆုံးရက်):</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-lg px-2 py-1 text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Filter Result Summary Header */}
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 px-1">
            <span>
              တွေ့ရှိသော ဖိုင်စုစုပေါင်း: <strong className="text-emerald-700 dark:text-emerald-400">{filteredFiles.length}</strong> / {files.length}
            </span>
            {selectedUserId !== 'all' && (
              <span className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-md font-medium border border-emerald-200 dark:border-emerald-800">
                Filtered User: {users.find(u => u.id === selectedUserId)?.name || selectedUserId}
              </span>
            )}
          </div>

          {/* Filtered Documents List */}
          {filteredFiles.length === 0 ? (
            <div className="bg-white dark:bg-dark-card p-10 rounded-2xl border border-slate-200 dark:border-dark-border text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-dark-elevated flex items-center justify-center mx-auto text-slate-400 mb-3">
                <Search className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                သတ်မှတ်ထားသော Filter နှင့် ကိုက်ညီသည့် ဖိုင်မရှိပါ
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                ရွေးချယ်ထားသော User သို့မဟုတ် Date Range တွင် စာရွက်စာတမ်း အပ်လုဒ် မရှိသေးပါခင်ဗျာ။
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredFiles.map(file => {
                const uploader = users.find(u => u.id === file.userId || u.name === file.userName);
                const role = file.userRole || uploader?.role || 'normal';
                const branch = file.branch || uploader?.branch || 'Headquarters';
                const uploaderName = file.userName || uploader?.name || 'System Upload';

                return (
                  <div
                    key={file.id}
                    className="bg-white dark:bg-dark-card border border-slate-200/90 dark:border-dark-border rounded-xl p-3.5 sm:p-4 hover:border-emerald-300 dark:hover:border-emerald-800 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                  >
                    {/* Left: Icon & File Info */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          file.isPdf
                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50'
                            : file.isExcel || file.isCsv
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50'
                            : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50'
                        }`}
                      >
                        {file.isPdf ? (
                          <FileText className="w-5 h-5" />
                        ) : file.isExcel || file.isCsv ? (
                          <TableIcon className="w-5 h-5" />
                        ) : (
                          <Mic className="w-5 h-5" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate max-w-xs sm:max-w-md">
                            {file.name}
                          </h4>
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-dark-elevated text-slate-600 dark:text-slate-400">
                            {file.extension}
                          </span>
                        </div>

                        {/* Metadata Tag Row: Uploader, Branch, Date/Time */}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[11px] text-slate-500 dark:text-slate-400">
                          {/* Uploader Pill */}
                          <span className="inline-flex items-center gap-1 font-medium bg-slate-100 dark:bg-dark-elevated px-2 py-0.5 rounded-md text-slate-700 dark:text-slate-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            {uploaderName}
                            <span
                              className={`text-[9px] font-bold px-1 rounded ${
                                role === 'admin'
                                  ? 'bg-emerald-200/80 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200'
                                  : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                              }`}
                            >
                              {role === 'admin' ? 'Admin' : 'User'}
                            </span>
                          </span>

                          <span className="inline-flex items-center gap-1 font-medium text-slate-600 dark:text-slate-400">
                            <Building2 className="w-3 h-3 text-slate-400" />
                            {branch}
                          </span>

                          <span>•</span>

                          <span className="font-mono text-slate-600 dark:text-slate-400">
                            {new Date(file.modifiedAt).toLocaleString()}
                          </span>

                          <span>•</span>
                          <span>{StorageService.formatFileSize(file.sizeBytes)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      <button
                        onClick={() => onOpenFile(file)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-dark-elevated hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 rounded-lg text-xs font-semibold border border-slate-200 dark:border-dark-border transition-colors"
                        title="Open Document Reader"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>

                      <button
                        onClick={() => StorageService.downloadFile(file)}
                        className="flex items-center gap-1 p-1.5 sm:px-2.5 sm:py-1.5 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs font-semibold border border-emerald-200 dark:border-emerald-800 transition-colors"
                        title={`Download ${file.name} (${file.isExcel || file.extension === 'xlsx' ? 'Excel Spreadsheet' : file.isCsv || file.extension === 'csv' ? 'CSV File' : file.isPdf ? 'PDF Document' : 'File'})`}
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Down</span>
                      </button>

                      <button
                        onClick={() => {
                          if (window.confirm(`ဖိုင် "${file.name}" အား အမှန်တကယ် ဖျက်လိုပါသလား?`)) {
                            onDeleteFile(file.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                        title="Delete file"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE NEW USER */}
      {/* ========================================================================= */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-dark-card w-full max-w-md rounded-2xl border border-slate-200 dark:border-dark-border shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-border pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    User အသစ် ဆောက်ရန် (Create New User)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Assign role rights and branch department
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddUserModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-2.5 bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 rounded-xl text-xs font-semibold border border-rose-200 dark:border-rose-900">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3.5 text-xs">
              {/* Full Name */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  အမည် (Full Name) *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Mg Mg / Daw Hla"
                  className="w-full bg-slate-50 dark:bg-dark-elevated border border-slate-200 dark:border-dark-border rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  အီးမေးလ် (Email Address) *
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="e.g. user@nextunit.io"
                  className="w-full bg-slate-50 dark:bg-dark-elevated border border-slate-200 dark:border-dark-border rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium"
                />
              </div>

              {/* Role Selection (Admin vs Normal) */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Role &amp; Permissions (လုပ်ပိုင်ခွင့် သတ်မှတ်ချက်) *
                </label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setNewRole('normal')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      newRole === 'normal'
                        ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 ring-2 ring-blue-500/20'
                        : 'border-slate-200 dark:border-dark-border bg-white dark:bg-dark-elevated text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <UserCheck className="w-4 h-4 text-blue-600" />
                      Normal User
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-tight">
                      Storage &amp; Drive အထိသာ သုံးနိုင်မည် (No Setup Tab)
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewRole('admin')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      newRole === 'admin'
                        ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-dark-border bg-white dark:bg-dark-elevated text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-700 dark:text-emerald-400">
                      <Shield className="w-4 h-4" />
                      Admin User
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-tight">
                      Setup Tab ပါဝင်ပြီး User အားလုံး စီမံနိုင်မည်
                    </p>
                  </button>
                </div>
              </div>

              {/* Branch / Department */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Branch / Department (ရုံးခွဲ/ဌာန)
                </label>
                <input
                  type="text"
                  value={newBranch}
                  onChange={e => setNewBranch(e.target.value)}
                  placeholder="e.g. Yangon Branch / Logistics"
                  className="w-full bg-slate-50 dark:bg-dark-elevated border border-slate-200 dark:border-dark-border rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-dark-border">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-elevated font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Create User</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
