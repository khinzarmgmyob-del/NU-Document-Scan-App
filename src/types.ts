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
  htmlContent?: string;
  reconstruction?: DocumentReconstruction;
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
  isWord?: boolean;
  isAudio: boolean;
  dataUrl?: string;
  textContent?: string;
  htmlContent?: string;
  reconstruction?: DocumentReconstruction;
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
export type FilterCategory = 'all' | 'pdf' | 'excel' | 'audio' | 'word';
export type ExportLayoutMode = 'reconstructed' | 'framed' | 'text' | 'matrix' | 'dual';

export interface BoundingBox {
  ymin: number; // 0 - 1000 normalized coordinate
  xmin: number; // 0 - 1000 normalized coordinate
  ymax: number; // 0 - 1000 normalized coordinate
  xmax: number; // 0 - 1000 normalized coordinate
}

export interface ReconstructedElementStyle {
  fontSizePt?: number;
  fontWeight?: 'normal' | 'bold' | '600' | '700';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidthPx?: number;
  paddingPx?: number;
}

export interface ReconstructedElement {
  id: string;
  type:
    | 'header'
    | 'footer'
    | 'heading'
    | 'paragraph'
    | 'table'
    | 'callout_box'
    | 'list_item'
    | 'key_value'
    | 'signature_stamp';
  bbox?: BoundingBox;
  text: string;
  html?: string;
  styles?: ReconstructedElementStyle;
}

export interface TableCell {
  text: string;
  colSpan?: number;
  rowSpan?: number;
  isHeader?: boolean;
  align?: 'left' | 'center' | 'right';
  backgroundColor?: string;
  border?: string;
}

export interface ReconstructedTable {
  id: string;
  caption?: string;
  headers?: TableCell[];
  rows: TableCell[][];
  rawMatrix: string[][];
  bbox?: BoundingBox;
}

export interface DocumentReconstruction {
  title: string;
  subtitle?: string;
  documentType: 'general' | 'invoice' | 'table' | 'form' | 'guide' | 'certificate' | 'receipt';
  language: string;
  orientation: 'portrait' | 'landscape';
  fullText: string;
  htmlContent: string; // Pixel-perfect HTML5 with Inline CSS & complex tables
  elements: ReconstructedElement[];
  tables: ReconstructedTable[];
  sections: DocumentSectionBlock[];
  confidence: number;
  deskewAngleDeg?: number;
}

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

