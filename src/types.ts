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
}

export interface DriveAccount {
  isSignedIn: boolean;
  email?: string;
  name?: string;
  avatarUrl?: string;
  syncedFilesCount: number;
}

export type ActiveTab = 'scan' | 'excel' | 'voice' | 'storage';
export type FilterCategory = 'all' | 'pdf' | 'excel' | 'audio';
