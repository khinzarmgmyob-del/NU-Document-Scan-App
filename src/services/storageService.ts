import { DocumentItem, LocalFileItem } from '../types';

const STORAGE_KEY_DOCS = 'nextunit_docuscan_documents';
const STORAGE_KEY_FILES = 'nextunit_docuscan_files';

export class StorageService {
  /**
   * Loads all scanned DocumentItems
   */
  static getDocuments(): DocumentItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_DOCS);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Failed to load documents:', e);
    }
    return this.getSeedDocuments();
  }

  /**
   * Saves documents to storage
   */
  static saveDocuments(docs: DocumentItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(docs));
    } catch (e) {
      console.warn('Storage quota exceeded or error:', e);
    }
  }

  /**
   * Adds or updates a document
   */
  static addDocument(doc: DocumentItem): DocumentItem[] {
    const docs = this.getDocuments();
    const updated = [doc, ...docs.filter(d => d.id !== doc.id)];
    this.saveDocuments(updated);
    return updated;
  }

  /**
   * Deletes a document
   */
  static deleteDocument(id: string): DocumentItem[] {
    const docs = this.getDocuments();
    const updated = docs.filter(d => d.id !== id);
    this.saveDocuments(updated);
    return updated;
  }

  /**
   * Loads all LocalFileItems (PDFs, Excel, CSV, Audio)
   */
  static getLocalFiles(): LocalFileItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_FILES);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Failed to load local files:', e);
    }
    const seedFiles = this.getSeedFiles();
    this.saveLocalFiles(seedFiles);
    return seedFiles;
  }

  /**
   * Saves local files
   */
  static saveLocalFiles(files: LocalFileItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_FILES, JSON.stringify(files));
    } catch (e) {
      console.warn('Storage error:', e);
    }
  }

  /**
   * Adds a file to local archive
   */
  static addLocalFile(file: LocalFileItem): LocalFileItem[] {
    const files = this.getLocalFiles();
    const updated = [file, ...files.filter(f => f.id !== file.id && f.name !== file.name)];
    this.saveLocalFiles(updated);
    return updated;
  }

  /**
   * Deletes a file from local archive
   */
  static deleteLocalFile(id: string): LocalFileItem[] {
    const files = this.getLocalFiles();
    const updated = files.filter(f => f.id !== id);
    this.saveLocalFiles(updated);
    return updated;
  }

  /**
   * Formats file size in bytes to human readable string
   */
  static formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  /**
   * Seed initial documents for instant out-of-the-box utility
   */
  private static getSeedDocuments(): DocumentItem[] {
    return [
      {
        id: 'seed-doc-1',
        title: 'Doc_20260831_TechSupply_Invoice',
        imagePath: '',
        extractedText: `NEXTUNIT LOGISTICS & TECH
INVOICE: #INV-2026-4829 | DATE: 2026-08-31
BILL TO: Apex Systems Inc.

Item Description | Qty | Unit Price | Total
Industrial Document Scanner 4K | 2 | $450.00 | $900.00
Cloud OCR API License (1 Year) | 5 | $120.00 | $600.00
High-Speed Thermal Receipt Unit | 1 | $280.00 | $280.00
SUBTOTAL | | | $1,780.00
TAX (8.5%) | | | $151.30
GRAND TOTAL | | | $1,931.30`,
        createdAt: new Date().toISOString(),
        tableData: [
          ['Item Description', 'Qty', 'Unit Price', 'Total'],
          ['Industrial Document Scanner 4K', '2', '$450.00', '$900.00'],
          ['Cloud OCR API License (1 Year)', '5', '$120.00', '$600.00'],
          ['High-Speed Thermal Receipt Unit', '1', '$280.00', '$280.00'],
          ['SUBTOTAL', '', '', '$1,780.00'],
          ['TAX (8.5%)', '', '', '$151.30'],
          ['GRAND TOTAL', '', '', '$1,931.30']
        ],
        isSyncedToDrive: true,
      }
    ];
  }

  /**
   * Seed initial files
   */
  private static getSeedFiles(): LocalFileItem[] {
    const now = new Date();
    return [
      {
        id: 'seed-file-1',
        path: '/storage/TechSupply_Invoice_4829.pdf',
        name: 'TechSupply_Invoice_4829.pdf',
        extension: 'pdf',
        sizeBytes: 184320,
        modifiedAt: new Date(now.getTime() - 1000 * 60 * 15).toISOString(),
        isPdf: true,
        isExcel: false,
        isCsv: false,
        isAudio: false,
        driveSynced: true,
        textContent: `NEXTUNIT LOGISTICS & TECH\nINVOICE: #INV-2026-4829\nGRAND TOTAL: $1,931.30`,
        tableData: [
          ['Item Description', 'Qty', 'Unit Price', 'Total'],
          ['Industrial Document Scanner 4K', '2', '$450.00', '$900.00'],
          ['Cloud OCR API License (1 Year)', '5', '$120.00', '$600.00'],
          ['High-Speed Thermal Receipt Unit', '1', '$280.00', '$280.00'],
          ['GRAND TOTAL', '', '', '$1,931.30']
        ]
      },
      {
        id: 'seed-file-2',
        path: '/storage/Warehouse_Stock_Audit.xlsx',
        name: 'Warehouse_Stock_Audit.xlsx',
        extension: 'xlsx',
        sizeBytes: 52140,
        modifiedAt: new Date(now.getTime() - 1000 * 60 * 45).toISOString(),
        isPdf: false,
        isExcel: true,
        isCsv: false,
        isAudio: false,
        driveSynced: true,
        tableData: [
          ['SKU Code', 'Product Name', 'Location', 'In Stock'],
          ['SKU-9901', 'Wireless Laser Scanner', 'Aisle 4-B', '142'],
          ['SKU-9902', 'Thermal Label Rolls 4x6', 'Aisle 1-A', '580'],
          ['SKU-9903', 'Barcode Mobile Terminal', 'Aisle 4-C', '36'],
          ['SKU-9904', 'Heavy Duty Storage Bin', 'Rack 12', '210']
        ]
      },
      {
        id: 'seed-file-3',
        path: '/storage/Metropolis_Bistro_Receipt.csv',
        name: 'Metropolis_Bistro_Receipt.csv',
        extension: 'csv',
        sizeBytes: 1240,
        modifiedAt: new Date(now.getTime() - 1000 * 60 * 90).toISOString(),
        isPdf: false,
        isExcel: false,
        isCsv: true,
        isAudio: false,
        driveSynced: false,
        textContent: `"Item","Qty","Price"\n"Cold Brew Latte","2","$11.00"\n"Avocado Toast Supreme","2","$28.00"\n"Artisan Pastry Box","1","$14.50"\n"TOTAL PAID","","$67.54"`
      },
      {
        id: 'seed-file-4',
        path: '/storage/Meeting_Voice_Memo_Aug31.m4a',
        name: 'Meeting_Voice_Memo_Aug31.m4a',
        extension: 'm4a',
        sizeBytes: 942000,
        modifiedAt: new Date(now.getTime() - 1000 * 60 * 120).toISOString(),
        isPdf: false,
        isExcel: false,
        isCsv: false,
        isAudio: true,
        driveSynced: false
      }
    ];
  }
}
