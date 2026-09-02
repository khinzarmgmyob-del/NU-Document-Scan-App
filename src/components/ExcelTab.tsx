import React, { useState } from 'react';
import { Download, FileSpreadsheet, Plus, Trash2, Edit3, Table, Check, Wand2, Sparkles, Cloud, SlidersHorizontal } from 'lucide-react';
import { OcrService } from '../services/ocrService';

interface ExcelTabProps {
  tableRows: string[][];
  onUpdateTable: (rows: string[][]) => void;
  onExportExcel: () => void;
  onExportCsv: () => void;
  onGoToScan: () => void;
  onOpenExportModal?: (defaultFormat?: 'pdf' | 'excel' | 'csv') => void;
}

export const ExcelTab: React.FC<ExcelTabProps> = ({
  tableRows,
  onUpdateTable,
  onExportExcel,
  onExportCsv,
  onGoToScan,
  onOpenExportModal,
}) => {
  const [isEditing, setIsEditing] = useState(false);

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    const updated = tableRows.map((r, rIdx) => {
      if (rIdx === rowIndex) {
        const newRow = [...r];
        newRow[colIndex] = value;
        return newRow;
      }
      return r;
    });
    onUpdateTable(updated);
  };

  const handleAddRow = () => {
    const colCount = tableRows.length > 0 ? tableRows[0].length : 3;
    const newRow = new Array(colCount).fill('');
    onUpdateTable([...tableRows, newRow]);
  };

  const handleAddColumn = () => {
    if (tableRows.length === 0) {
      onUpdateTable([['Col 1', 'Col 2', 'Col 3']]);
      return;
    }
    const updated = tableRows.map((row, idx) => [
      ...row,
      idx === 0 ? `Col ${row.length + 1}` : '',
    ]);
    onUpdateTable(updated);
  };

  const handleDeleteRow = (rowIndex: number) => {
    const updated = tableRows.filter((_, idx) => idx !== rowIndex);
    onUpdateTable(updated);
  };

  const handleAutoBalanceColumns = () => {
    if (tableRows.length === 0) return;
    const normalized = OcrService.normalizeTable(tableRows);
    onUpdateTable(normalized);
  };

  // Quick preset templates
  const loadPreset = (type: 'invoice' | 'receipt' | 'inventory') => {
    if (type === 'invoice') {
      onUpdateTable([
        ['Item Description', 'Qty', 'Unit Price', 'Total'],
        ['Industrial Document Scanner 4K', '2', '$450.00', '$900.00'],
        ['Cloud OCR API License (1 Year)', '5', '$120.00', '$600.00'],
        ['High-Speed Thermal Receipt Unit', '1', '$280.00', '$280.00'],
        ['SUBTOTAL', '', '', '$1,780.00'],
        ['TAX (8.5%)', '', '', '$151.30'],
        ['GRAND TOTAL', '', '', '$1,931.30'],
      ]);
    } else if (type === 'receipt') {
      onUpdateTable([
        ['Item', 'Qty', 'Price'],
        ['Cold Brew Latte', '2', '$11.00'],
        ['Avocado Toast Supreme', '2', '$28.00'],
        ['Artisan Pastry Box', '1', '$14.50'],
        ['SUBTOTAL', '', '$53.50'],
        ['SALES TAX', '', '$4.41'],
        ['TOTAL PAID', '', '$67.54'],
      ]);
    } else {
      onUpdateTable([
        ['SKU Code', 'Product Name', 'Location', 'In Stock'],
        ['SKU-9901', 'Wireless Laser Scanner', 'Aisle 4-B', '142'],
        ['SKU-9902', 'Thermal Label Rolls 4x6', 'Aisle 1-A', '580'],
        ['SKU-9903', 'Barcode Mobile Terminal', 'Aisle 4-C', '36'],
        ['SKU-9904', 'Heavy Duty Storage Bin', 'Rack 12', '210'],
      ]);
    }
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-8">
      {/* Export Action Buttons (Save as Excel with Layouts / Google Drive) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={() => onOpenExportModal ? onOpenExportModal('excel') : onExportExcel()}
          disabled={tableRows.length === 0}
          className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition-all active:scale-[0.98]"
        >
          <Download className="w-4 h-4" />
          <span>Save as Excel (.xlsx)</span>
        </button>

        <button
          onClick={() => onOpenExportModal ? onOpenExportModal('excel') : null}
          disabled={tableRows.length === 0}
          className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm shadow-md shadow-blue-600/20 transition-all active:scale-[0.98]"
        >
          <Cloud className="w-4 h-4" />
          <span>Upload to Google Drive</span>
        </button>

        <button
          onClick={onExportCsv}
          disabled={tableRows.length === 0}
          className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-white dark:bg-dark-card hover:bg-emerald-50 dark:hover:bg-dark-elevated disabled:opacity-50 text-emerald-900 dark:text-emerald-300 font-semibold text-xs sm:text-sm border border-emerald-300 dark:border-dark-border shadow-xs transition-all active:scale-[0.98]"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Export CSV (.csv)</span>
        </button>
      </div>

      {/* Spreadsheet Data Grid Preview Card */}
      <div className="bg-white/95 dark:bg-dark-card/95 backdrop-blur-xs rounded-xl border border-emerald-100 dark:border-dark-border shadow-xs overflow-hidden transition-colors">
        {/* Header */}
        <div className="px-4 py-3 border-b border-emerald-100 dark:border-dark-border flex items-center justify-between flex-wrap gap-2 bg-emerald-50/40 dark:bg-dark-surface/50">
          <div className="flex items-center space-x-2">
            <Table className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="font-bold text-slate-900 dark:text-emerald-100 text-sm sm:text-base">
              Parsed Spreadsheet Matrix
            </h2>
            <span className="text-xs text-emerald-700 dark:text-emerald-400/70 font-medium">
              ({tableRows.length} {tableRows.length === 1 ? 'Row' : 'Rows'} • {tableRows[0]?.length || 0} Cols)
            </span>
          </div>

          {tableRows.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleAutoBalanceColumns}
                title="Strictly format and balance column counts across all rows"
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-100/90 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 hover:bg-emerald-200 dark:hover:bg-emerald-900 transition-all"
              >
                <Wand2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Auto-Balance Columns</span>
              </button>

              <button
                onClick={() => setIsEditing(!isEditing)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                  isEditing
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white dark:bg-dark-surface text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-dark-border hover:bg-emerald-50 dark:hover:bg-dark-elevated'
                }`}
              >
                {isEditing ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Done Editing</span>
                  </>
                ) : (
                  <>
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Cells</span>
                  </>
                )}
              </button>

              <button
                onClick={handleAddRow}
                title="Add new row"
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-white dark:bg-dark-surface text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-dark-border hover:bg-emerald-50 dark:hover:bg-dark-elevated transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline">Row</span>
              </button>

              <button
                onClick={handleAddColumn}
                title="Add new column"
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-white dark:bg-dark-surface text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-dark-border hover:bg-emerald-50 dark:hover:bg-dark-elevated transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline">Col</span>
              </button>
            </div>
          )}
        </div>

        {/* Table Content Area */}
        <div className="p-0">
          {tableRows.length === 0 ? (
            <div className="py-14 px-4 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                No parsed table rows.
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400/70 mt-1 max-w-sm">
                Scan a document with tabular content or choose a sample table template below to test:
              </p>

              {/* Quick Template Presets */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={() => loadPreset('invoice')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-dark-surface text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-dark-border text-xs font-medium hover:bg-emerald-100 transition-colors"
                >
                  Load Commercial Invoice
                </button>
                <button
                  onClick={() => loadPreset('receipt')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-dark-surface text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-dark-border text-xs font-medium hover:bg-emerald-100 transition-colors"
                >
                  Load Store Receipt
                </button>
                <button
                  onClick={() => loadPreset('inventory')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-dark-surface text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-dark-border text-xs font-medium hover:bg-emerald-100 transition-colors"
                >
                  Load Inventory Audit
                </button>
              </div>

              <button
                onClick={onGoToScan}
                className="mt-4 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-bold hover:from-emerald-600 hover:to-teal-700 shadow-sm shadow-emerald-500/20 transition-all"
              >
                Go to Document Scanner
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[480px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-emerald-600 dark:bg-emerald-900/90 text-white border-b border-emerald-700 dark:border-dark-border sticky top-0 z-10">
                    <th className="py-2.5 px-3 w-10 text-center text-emerald-100 font-medium">#</th>
                    {(tableRows[0] || []).map((colName, colIdx) => (
                      <th
                        key={colIdx}
                        className="py-2.5 px-3 text-white font-bold border-r border-emerald-500/50 dark:border-dark-border last:border-r-0 tracking-tight whitespace-nowrap"
                      >
                        {isEditing ? (
                          <input
                            type="text"
                            value={colName}
                            onChange={e => handleCellChange(0, colIdx, e.target.value)}
                            className="bg-white dark:bg-dark-bg border border-emerald-300 dark:border-dark-border text-slate-900 dark:text-white rounded px-1.5 py-0.5 w-full font-bold text-xs"
                          />
                        ) : (
                          colName || `Column ${colIdx + 1}`
                        )}
                      </th>
                    ))}
                    {isEditing && <th className="py-2.5 px-2 w-10 text-center"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100/60 dark:divide-dark-border">
                  {tableRows.slice(1).map((row, rowIdx) => {
                    const actualRowIdx = rowIdx + 1;
                    return (
                      <tr
                        key={actualRowIdx}
                        className="hover:bg-emerald-50/50 dark:hover:bg-dark-surface/80 transition-colors odd:bg-white dark:odd:bg-dark-card even:bg-emerald-50/20 dark:even:bg-dark-bg/60"
                      >
                        <td className="py-2 px-3 text-center text-emerald-700/60 dark:text-emerald-400/60 font-mono text-[11px]">
                          {actualRowIdx}
                        </td>
                        {row.map((cellValue, colIdx) => (
                          <td
                            key={colIdx}
                            className="py-2 px-3 text-slate-800 dark:text-slate-200 border-r border-emerald-100/60 dark:border-dark-border last:border-r-0"
                          >
                            {isEditing ? (
                              <input
                                type="text"
                                value={cellValue}
                                onChange={e =>
                                  handleCellChange(actualRowIdx, colIdx, e.target.value)
                                }
                                className="w-full bg-white dark:bg-dark-bg border border-emerald-200 dark:border-dark-border rounded px-1.5 py-0.5 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                              />
                            ) : (
                              <span className="font-mono text-xs">{cellValue || '—'}</span>
                            )}
                          </td>
                        ))}
                        {isEditing && (
                          <td className="py-2 px-2 text-center">
                            <button
                              onClick={() => handleDeleteRow(actualRowIdx)}
                              className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded"
                              title="Delete Row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
