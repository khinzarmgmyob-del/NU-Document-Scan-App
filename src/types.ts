export type UserRole = 'admin' | 'normal';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  branch: string;
  status: 'active' | 'inactive';
  createdAt: string;
  avatarColor?: string;
}

export interface DocumentItem {
  id: string;
  title: string;
  imagePath: string; // Base64 data URL or local blob URL
  extractedText: string;
  createdAt: string; // ISO date string
  tableData: string[][];
  pdfPath?: string;
  pdfBlob?: Blob;
  voiceNotePath?: string;
  voiceDurationSec?: number;
  isSyncedToDrive?: boolean;
  userId?: string;
  userName?: string;
  userRole?: UserRole;
  branch?: string;
}

export interface LocalFileItem {
  id: string;
  path: string;
  name: string;
  extension: string;
  sizeBytes: number;
  modifiedAt: string; // ISO string
  isPdf: boolean;
  isExcel: boolean;
  isCsv: boolean;
  isAudio: boolean;
  dataUrl?: string;
  textContent?: string;
  tableData?: string[][];
  driveSynced?: boolean;
  userId?: string;
  userName?: string;
  userRole?: UserRole;
  branch?: string;
}

export interface DriveAccount {
  isSignedIn: boolean;
  email?: string;
  name?: string;
  avatarUrl?: string;
  syncedFilesCount: number;
}

export type ActiveTab = 'scan' | 'excel' | 'voice' | 'storage' | 'bsetup';
export type FilterCategory = 'all' | 'pdf' | 'excel' | 'audio';
export type ExportLayoutMode = 'framed' | 'text' | 'matrix';

export interface DocumentSectionItem {
  text: string;
  subtext?: string;
  isCheck?: boolean;
}

export interface DocumentSectionBlock {
  type: 'standard_box' | 'danger_box' | 'warning_box' | 'table' | 'paragraph' | 'notes';
  title: string;
  colorTheme?: 'emerald' | 'blue' | 'red' | 'amber' | 'slate' | 'yellow';
  items?: DocumentSectionItem[];
  content?: string;
  table?: string[][];
}

export interface FormattedLayoutResult {
  title: string;
  subtitle?: string;
  formattedText: string;
  sections: DocumentSectionBlock[];
  table?: string[][];
}

