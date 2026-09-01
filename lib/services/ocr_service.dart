import 'dart:developer';
import 'dart:io';
import 'dart:ui';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';

/// Represents an OCR text word or phrase with 2D spatial bounding box
class SpatialTextItem {
  final String text;
  final Rect rect;

  SpatialTextItem({required this.text, required this.rect});

  double get left => rect.left;
  double get right => rect.right;
  double get top => rect.top;
  double get bottom => rect.bottom;
  double get centerX => rect.left + (rect.width / 2);
  double get centerY => rect.top + (rect.height / 2);
  double get width => rect.width;
  double get height => rect.height;
}

/// Represents a detected column interval on the X-axis
class ColumnRange {
  double left;
  double right;

  ColumnRange({required this.left, required this.right});

  double get centerX => (left + right) / 2;
  double get width => right - left;

  bool overlaps(ColumnRange other, {double margin = 12.0}) {
    return (left - margin) < (other.right + margin) &&
        (right + margin) > (other.left - margin);
  }

  void merge(ColumnRange other) {
    if (other.left < left) left = other.left;
    if (other.right > right) right = other.right;
  }
}

class OcrService {
  static final _textRecognizer =
      TextRecognizer(script: TextRecognitionScript.latin);

  /// Performs ML Kit Optical Character Recognition and returns the raw recognized text
  static Future<String> processImage(File imageFile) async {
    try {
      final inputImage = InputImage.fromFile(imageFile);
      final RecognizedText recognizedText =
          await _textRecognizer.processImage(inputImage);
      return recognizedText.text;
    } catch (e) {
      log('OCR processing error: $e');
      return '';
    }
  }

  /// Advanced Table Detection using 2D Bounding Box Spatial Coordinates
  /// Clusters X/Y positions to reconstruct tables with exact column alignment
  /// even on borderless/unlined paper, invoices, and multi-column receipts.
  static Future<List<List<String>>> extractSpatialTable(File imageFile) async {
    try {
      final inputImage = InputImage.fromFile(imageFile);
      final RecognizedText recognizedText =
          await _textRecognizer.processImage(inputImage);

      // Collect all text elements/words with exact bounding boxes
      final List<SpatialTextItem> items = [];

      for (final block in recognizedText.blocks) {
        for (final line in block.lines) {
          if (line.elements.isNotEmpty) {
            for (final element in line.elements) {
              final text = element.text.trim();
              if (text.isNotEmpty) {
                items.add(SpatialTextItem(
                  text: text,
                  rect: element.boundingBox,
                ));
              }
            }
          } else {
            final text = line.text.trim();
            if (text.isNotEmpty) {
              items.add(SpatialTextItem(
                text: text,
                rect: line.boundingBox,
              ));
            }
          }
        }
      }

      if (items.isEmpty) {
        return parseTextToTable(recognizedText.text);
      }

      return reconstructTableFromSpatialItems(items);
    } catch (e) {
      log('Spatial table extraction error: $e');
      return [];
    }
  }

  /// Spatial Clustering Algorithm (Horizontal Y clustering + Vertical X Column Interval Clustering)
  static List<List<String>> reconstructTableFromSpatialItems(
      List<SpatialTextItem> items) {
    if (items.isEmpty) return [];

    // 1. Sort items top-to-bottom, then left-to-right
    items.sort((a, b) {
      final yDiff = a.centerY.compareTo(b.centerY);
      if (yDiff.abs() > 8) return yDiff;
      return a.left.compareTo(b.left);
    });

    // Calculate median line height for clustering thresholds
    final heights = items.map((e) => e.height).toList()..sort();
    final medianHeight =
        heights.isNotEmpty ? heights[heights.length ~/ 2] : 16.0;
    final yTolerance = (medianHeight * 0.55).clamp(6.0, 18.0);

    // 2. Group into Horizontal Rows (Y-Clustering)
    final List<List<SpatialTextItem>> rowGroups = [];
    for (final item in items) {
      bool placed = false;
      for (final row in rowGroups) {
        final rowAvgY =
            row.map((e) => e.centerY).reduce((a, b) => a + b) / row.length;
        if ((item.centerY - rowAvgY).abs() <= yTolerance) {
          row.add(item);
          placed = true;
          break;
        }
      }
      if (!placed) {
        rowGroups.add([item]);
      }
    }

    // Sort each row left-to-right
    for (final row in rowGroups) {
      row.sort((a, b) => a.left.compareTo(b.left));
    }

    // 3. Detect Vertical Columns (X-Clustering across all rows)
    final List<ColumnRange> columnRanges = [];

    for (final row in rowGroups) {
      final List<SpatialTextItem> segments = [];
      SpatialTextItem? currentSegment;

      for (final word in row) {
        if (currentSegment == null) {
          currentSegment = word;
        } else {
          final gap = word.left - currentSegment.right;
          if (gap < medianHeight * 1.25) {
            currentSegment = SpatialTextItem(
              text: '${currentSegment.text} ${word.text}',
              rect: Rect.fromLTRB(
                currentSegment.left,
                currentSegment.top < word.top ? currentSegment.top : word.top,
                word.right,
                currentSegment.bottom > word.bottom
                    ? currentSegment.bottom
                    : word.bottom,
              ),
            );
          } else {
            segments.add(currentSegment);
            currentSegment = word;
          }
        }
      }
      if (currentSegment != null) {
        segments.add(currentSegment);
      }

      // Register column ranges from segments
      for (final seg in segments) {
        final segRange = ColumnRange(left: seg.left, right: seg.right);
        bool merged = false;
        for (final col in columnRanges) {
          if (col.overlaps(segRange, margin: medianHeight * 0.8)) {
            col.merge(segRange);
            merged = true;
            break;
          }
        }
        if (!merged) {
          columnRanges.add(segRange);
        }
      }
    }

    // Sort columns left-to-right
    columnRanges.sort((a, b) => a.left.compareTo(b.left));

    // Consolidate overlapping / near columns
    final List<ColumnRange> finalColumns = [];
    for (final col in columnRanges) {
      if (finalColumns.isEmpty) {
        finalColumns.add(col);
      } else {
        final last = finalColumns.last;
        if (last.overlaps(col, margin: 8.0)) {
          last.merge(col);
        } else {
          finalColumns.add(col);
        }
      }
    }

    if (finalColumns.isEmpty) return [];

    // 4. Map Each Row into the Discovered Columns
    final List<List<String>> table = [];

    for (final row in rowGroups) {
      final rowCells = List<String>.filled(finalColumns.length, '');

      for (final item in row) {
        int bestColIdx = 0;
        double minDistance = double.infinity;

        for (int c = 0; c < finalColumns.length; c++) {
          final col = finalColumns[c];
          final dist = (item.centerX - col.centerX).abs();
          if (dist < minDistance) {
            minDistance = dist;
            bestColIdx = c;
          }
        }

        if (rowCells[bestColIdx].isEmpty) {
          rowCells[bestColIdx] = item.text;
        } else {
          rowCells[bestColIdx] = '${rowCells[bestColIdx]} ${item.text}';
        }
      }

      if (rowCells.any((c) => c.trim().isNotEmpty)) {
        table.add(rowCells);
      }
    }

    return normalizeTable(table);
  }

  /// Fallback simple parser for pure text
  static List<List<String>> parseTextToTable(String rawText) {
    if (rawText.trim().isEmpty) return [];

    final rawLines = rawText
        .split('\n')
        .map((l) => l.trim())
        .where((l) => l.isNotEmpty)
        .toList();

    final List<List<String>> parsedRows = [];

    for (final rawLine in rawLines) {
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
        cells = line
            .split(RegExp(r'\s{2,}|\s+-\s+'))
            .map((c) => c.trim())
            .toList();
      }

      if (cells.isNotEmpty) {
        parsedRows.add(cells);
      }
    }

    return normalizeTable(parsedRows);
  }

  /// Strictly normalizes a 2D table so that EVERY row has the EXACT same length as header cells.
  static List<List<String>> normalizeTable(List<List<String>> table) {
    if (table.isEmpty) return [];

    int maxCols = table.map((r) => r.length).reduce((a, b) => a > b ? a : b);
    if (maxCols < 1) maxCols = 1;

    final List<List<String>> normalized = [];
    for (final row in table) {
      if (row.length == maxCols) {
        normalized.add(List<String>.from(row));
      } else if (row.length < maxCols) {
        final padded = List<String>.from(row);
        while (padded.length < maxCols) {
          padded.add('');
        }
        normalized.add(padded);
      } else {
        normalized.add(row.sublist(0, maxCols));
      }
    }

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
