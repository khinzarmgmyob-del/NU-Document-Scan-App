import 'dart:io';
import 'package:csv/csv.dart';
import 'package:excel/excel.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'ocr_service.dart';

class ExcelService {
  /// Exports table matrix to .xlsx file with styled headers
  static Future<File?> exportToExcel({
    required String fileName,
    required List<List<String>> tableData,
    String sheetName = 'ExtractedData',
  }) async {
    try {
      final normalized = OcrService.normalizeTable(tableData);
      final excel = Excel.createExcel();
      final sheet = excel[sheetName];

      // Insert rows
      for (final row in normalized) {
        sheet.appendRow(row.map((cell) => TextCellValue(cell)).toList());
      }

      final directory = await getApplicationDocumentsDirectory();
      final cleanName = fileName.replaceAll(RegExp(r'[^a-zA-Z0-9_\-]'), '_');
      final filePath = '${directory.path}/$cleanName.xlsx';

      final fileBytes = excel.save();
      if (fileBytes == null) return null;

      final file = File(filePath);
      await file.writeAsBytes(fileBytes);
      return file;
    } catch (e) {
      return null;
    }
  }

  /// Exports table matrix to .csv format
  static Future<File?> exportToCsv({
    required String fileName,
    required List<List<String>> tableData,
  }) async {
    try {
      final normalized = OcrService.normalizeTable(tableData);
      final csvString = const ListToCsvConverter().convert(normalized);

      final directory = await getApplicationDocumentsDirectory();
      final cleanName = fileName.replaceAll(RegExp(r'[^a-zA-Z0-9_\-]'), '_');
      final filePath = '${directory.path}/$cleanName.csv';

      final file = File(filePath);
      await file.writeAsString(csvString);
      return file;
    } catch (e) {
      return null;
    }
  }

  /// Share file via system share sheet
  static Future<void> shareFile(File file) async {
    await Share.shareXFiles([XFile(file.path)], text: 'Exported from NextUnit DocuScan');
  }
}
