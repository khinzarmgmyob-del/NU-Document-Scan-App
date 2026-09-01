import 'dart:io';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';

class OcrService {
  static final _textRecognizer = TextRecognizer(script: TextRecognitionScript.latin);

  /// Performs ML Kit optical character recognition on an image file
  static Future<String> processImage(File imageFile) async {
    try {
      final inputImage = InputImage.fromFile(imageFile);
      final RecognizedText recognizedText = await _textRecognizer.processImage(inputImage);
      return recognizedText.text;
    } catch (e) {
      return '';
    }
  }

  /// Parses raw OCR text lines into structured 2D table matrix
  /// Prevents DataTable length mismatch assertions
  static List<List<String>> parseTextToTable(String rawText) {
    if (rawText.trim().isEmpty) return [];

    final rawLines = rawText
        .split('\n')
        .map((l) => l.trim())
        .where((l) => l.isNotEmpty)
        .toList();

    final List<List<String>> parsedRows = [];

    bool isSeparatorLine(String line) {
      final cleaned = line.replaceAll(RegExp(r'[\s\-|+=:_~]'), '');
      return cleaned.isEmpty;
    }

    for (final rawLine in rawLines) {
      if (isSeparatorLine(rawLine)) continue;

      String line = rawLine;
      if (line.startsWith('|') && line.endsWith('|')) {
        line = line.substring(1, line.length - 1).trim();
      }

      List<String> cells = [];

      if (line.contains('|')) {
        cells = line.split('|').map((c) => c.trim()).toList();
      } else if (line.contains('\t')) {
        cells = line.split('\t').map((c) => c.trim()).toList();
      } else if (line.contains(';') && line.split(';').length > 1) {
        cells = line.split(';').map((c) => c.trim()).toList();
      } else if (line.contains(',') && line.split(',').length > 1) {
        cells = line.split(',').map((c) => c.trim()).toList();
      } else {
        // Multi-space separated columns
        cells = line
            .split(RegExp(r'\s{2,}|\s+-\s+'))
            .map((c) => c.trim())
            .toList();

        if (cells.length <= 1 && line.contains(' ')) {
          // Receipt / price line item detector: "Item Name 2 $12.00"
          final priceMatch = RegExp(r'^(.*?)\s+(\d+)?\s*([$€£¥]?\s*\d+[.,]\d{2})$').firstMatch(line);
          if (priceMatch != null) {
            final item = priceMatch.group(1)?.trim() ?? '';
            final qty = priceMatch.group(2)?.trim() ?? '';
            final price = priceMatch.group(3)?.trim() ?? '';
            cells = qty.isNotEmpty ? [item, qty, price] : [item, price];
          } else {
            final words = line.split(' ').map((w) => w.trim()).where((w) => w.isNotEmpty).toList();
            if (words.length >= 2 && words.length <= 6) {
              cells = words;
            } else {
              cells = [line];
            }
          }
        }
      }

      if (cells.isNotEmpty) {
        parsedRows.add(cells);
      }
    }

    if (parsedRows.isEmpty) return [];
    return normalizeTable(parsedRows);
  }

  /// Strictly normalizes a 2D table so that EVERY row has the EXACT same length as header cells.
  /// Fixes Flutter: '!rows.any((DataRow row) => row.cells.length != columns.length)'
  static List<List<String>> normalizeTable(List<List<String>> table) {
    if (table.isEmpty) return [];

    int maxCols = 1;
    for (final row in table) {
      if (row.length > maxCols) {
        maxCols = row.length;
      }
    }

    final List<List<String>> normalized = [];

    for (int rIdx = 0; rIdx < table.length; rIdx++) {
      final row = List<String>.from(table[rIdx]);

      if (row.length == maxCols) {
        normalized.add(row);
      } else if (row.length < maxCols) {
        final padded = List<String>.filled(maxCols, '');
        if (row.length == 1) {
          padded[0] = row[0];
        } else if (row.length == 2) {
          padded[0] = row[0];
          padded[maxCols - 1] = row[1];
        } else {
          for (int i = 0; i < row.length - 1; i++) {
            padded[i] = row[i];
          }
          padded[maxCols - 1] = row.last;
        }
        normalized.add(padded);
      } else {
        // Excess cells
        final excess = row.length - maxCols;
        final merged = row.sublist(0, excess + 1).join(' ');
        final remainder = row.sublist(excess + 1);
        normalized.add([merged, ...remainder]);
      }
    }

    // Default column headers if empty
    if (normalized.isNotEmpty) {
      for (int i = 0; i < normalized[0].length; i++) {
        if (normalized[0][i].trim().isEmpty) {
          normalized[0][i] = 'Column ${i + 1}';
        }
      }
    }

    return normalized;
  }

  static void dispose() {
    _textRecognizer.close();
  }
}
