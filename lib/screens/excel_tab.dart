import 'dart:io';
import 'package:flutter/material.dart';
import '../services/excel_service.dart';
import '../services/ocr_service.dart';
import '../services/storage_service.dart';
import '../models/document_item.dart';

class ExcelTab extends StatefulWidget {
  final List<List<String>> tableRows;
  final Function(List<List<String>>) onUpdateTable;
  final VoidCallback onGoToScan;

  const ExcelTab({
    Key? key,
    required this.tableRows,
    required this.onUpdateTable,
    required this.onGoToScan,
  }) : super(key: key);

  @override
  State<ExcelTab> createState() => _ExcelTabState();
}

class _ExcelTabState extends State<ExcelTab> {
  bool _isEditing = false;

  void _balanceColumns() {
    if (widget.tableRows.isEmpty) return;
    final normalized = OcrService.normalizeTable(widget.tableRows);
    widget.onUpdateTable(normalized);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('✓ Table rows and columns auto-balanced!'),
        backgroundColor: Color(0xFF10B981),
      ),
    );
  }

  void _loadPreset(String type) {
    if (type == 'invoice') {
      widget.onUpdateTable([
        ['Item Description', 'Qty', 'Unit Price', 'Total'],
        ['Industrial Document Scanner 4K', '2', '\$450.00', '\$900.00'],
        ['Cloud OCR API License (1 Year)', '5', '\$120.00', '\$600.00'],
        ['High-Speed Thermal Receipt Unit', '1', '\$280.00', '\$280.00'],
        ['SUBTOTAL', '', '', '\$1,780.00'],
        ['TAX (8.5%)', '', '', '\$151.30'],
        ['GRAND TOTAL', '', '', '\$1,931.30'],
      ]);
    } else if (type == 'receipt') {
      widget.onUpdateTable([
        ['Item', 'Qty', 'Price'],
        ['Cold Brew Latte', '2', '\$11.00'],
        ['Avocado Toast Supreme', '2', '\$28.00'],
        ['Artisan Pastry Box', '1', '\$14.50'],
        ['SUBTOTAL', '', '\$53.50'],
        ['SALES TAX', '', '\$4.41'],
        ['TOTAL PAID', '', '\$67.54'],
      ]);
    } else {
      widget.onUpdateTable([
        ['SKU Code', 'Product Name', 'Location', 'In Stock'],
        ['SKU-9901', 'Wireless Laser Scanner', 'Aisle 4-B', '142'],
        ['SKU-9902', 'Thermal Label Rolls 4x6', 'Aisle 1-A', '580'],
        ['SKU-9903', 'Barcode Mobile Terminal', 'Aisle 4-C', '36'],
        ['SKU-9904', 'Heavy Duty Storage Bin', 'Rack 12', '210'],
      ]);
    }
  }

  Future<void> _exportExcel() async {
    if (widget.tableRows.isEmpty) return;
    final title = 'Spreadsheet_${DateTime.now().millisecondsSinceEpoch}';
    final file = await ExcelService.exportToExcel(
      fileName: title,
      tableData: widget.tableRows,
    );

    if (file != null) {
      await StorageService.saveDocument(
        DocumentItem(
          id: DateTime.now().millisecondsSinceEpoch.toString(),
          title: '$title.xlsx',
          date: 'Just now',
          type: 'excel',
          size: '${(file.lengthSync() / 1024).toStringAsFixed(1)} KB',
          tableData: widget.tableRows,
        ),
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('✓ Excel (.xlsx) generated and saved!'),
            backgroundColor: Color(0xFF10B981),
          ),
        );
      }
    }
  }

  Future<void> _exportCsv() async {
    if (widget.tableRows.isEmpty) return;
    final title = 'Spreadsheet_${DateTime.now().millisecondsSinceEpoch}';
    final file = await ExcelService.exportToCsv(
      fileName: title,
      tableData: widget.tableRows,
    );

    if (file != null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('✓ CSV generated and saved!'),
          backgroundColor: Color(0xFF059669),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final normalized = OcrService.normalizeTable(widget.tableRows);

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Export Actions
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: normalized.isEmpty ? null : _exportExcel,
                  icon: const Icon(Icons.file_download, size: 18),
                  label: const Text('Export .XLSX', style: TextStyle(fontWeight: FontWeight.bold)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF10B981),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: normalized.isEmpty ? null : _exportCsv,
                  icon: const Icon(Icons.download, size: 18),
                  label: const Text('Export .CSV', style: TextStyle(fontWeight: FontWeight.bold)),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: isDark ? const Color(0xFF34D399) : const Color(0xFF059669),
                    side: const BorderSide(color: Color(0xFF10B981)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 14),

          // Header with Tools
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF0F1715) : Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isDark ? const Color(0xFF1E2E2A) : const Color(0xFFD1FAE5),
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.table_chart, color: Color(0xFF10B981), size: 18),
                    const SizedBox(width: 6),
                    Text(
                      'Spreadsheet Matrix (${normalized.length} Rows)',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                  ],
                ),
                TextButton.icon(
                  onPressed: _balanceColumns,
                  icon: const Icon(Icons.auto_fix_high, size: 16),
                  label: const Text('Auto-Balance', style: TextStyle(fontSize: 12)),
                  style: TextButton.styleFrom(foregroundColor: const Color(0xFF10B981)),
                ),
              ],
            ),
          ),

          const SizedBox(height: 12),

          // Data Table View
          if (normalized.isEmpty)
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF0F1715) : Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: isDark ? const Color(0xFF1E2E2A) : const Color(0xFFD1FAE5),
                ),
              ),
              child: Column(
                children: [
                  const Icon(Icons.table_rows, size: 40, color: Color(0xFF10B981)),
                  const SizedBox(height: 10),
                  const Text('No parsed table rows.', style: TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  const Text(
                    'Scan a document or load a sample preset below:',
                    style: TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                  const SizedBox(height: 14),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      ActionChip(
                        label: const Text('Sample Invoice'),
                        onPressed: () => _loadPreset('invoice'),
                        backgroundColor: isDark ? const Color(0xFF1E2E2A) : const Color(0xFFECFDF5),
                      ),
                      ActionChip(
                        label: const Text('Store Receipt'),
                        onPressed: () => _loadPreset('receipt'),
                        backgroundColor: isDark ? const Color(0xFF1E2E2A) : const Color(0xFFECFDF5),
                      ),
                      ActionChip(
                        label: const Text('Inventory Audit'),
                        onPressed: () => _loadPreset('inventory'),
                        backgroundColor: isDark ? const Color(0xFF1E2E2A) : const Color(0xFFECFDF5),
                      ),
                    ],
                  ),
                ],
              ),
            )
          else
            Container(
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF0F1715) : Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: isDark ? const Color(0xFF1E2E2A) : const Color(0xFFD1FAE5),
                ),
              ),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: _buildSafeDataTable(normalized, isDark),
              ),
            ),
        ],
      ),
    );
  }

  /// Constructs a safe DataTable where EVERY row has the EXACT same cell count as columns
  /// Strictly prevents '!rows.any((DataRow row) => row.cells.length != columns.length)'
  Widget _buildSafeDataTable(List<List<String>> table, bool isDark) {
    if (table.isEmpty) return const SizedBox();

    final headerRow = table.first;
    final dataRows = table.length > 1 ? table.sublist(1) : <List<String>>[];

    final columns = headerRow.map((col) {
      return DataColumn(
        label: Text(
          col,
          style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF10B981)),
        ),
      );
    }).toList();

    final rows = dataRows.map((row) {
      // Guarantee length matches columns.length
      final cells = List<DataCell>.generate(columns.length, (index) {
        final text = (index < row.length) ? row[index] : '';
        return DataCell(
          Text(
            text,
            style: TextStyle(
              color: isDark ? Colors.white70 : Colors.black87,
              fontSize: 12,
            ),
          ),
        );
      });

      return DataRow(cells: cells);
    }).toList();

    return DataTable(
      headingRowColor: MaterialStateProperty.all(
        isDark ? const Color(0xFF1E2E2A) : const Color(0xFFECFDF5),
      ),
      columns: columns,
      rows: rows,
    );
  }
}
