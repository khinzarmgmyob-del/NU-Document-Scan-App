import 'dart:io';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'ocr_service.dart';

class PdfService {
  /// Generates a high-quality PDF document with Emerald branding,
  /// embedded scanned image, data table matrix, and formatted OCR text.
  static Future<File?> generateAndSavePdf({
    required String title,
    String? imagePath,
    String? ocrText,
    List<List<String>>? tableData,
  }) async {
    try {
      final pdf = pw.Document();
      final dateStr = DateFormat('MMMM d, yyyy • h:mm a').format(DateTime.now());

      pw.MemoryImage? docImage;
      if (imagePath != null && File(imagePath).existsSync()) {
        final imageBytes = await File(imagePath).readAsBytes();
        docImage = pw.MemoryImage(imageBytes);
      }

      final normalizedTable = (tableData != null && tableData.isNotEmpty)
          ? OcrService.normalizeTable(tableData)
          : null;

      pdf.addPage(
        pw.MultiPage(
          pageFormat: PdfPageFormat.a4,
          margin: const pw.EdgeInsets.all(32),
          header: (context) => pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Container(
                height: 4,
                color: PdfColor.fromHex('#10B981'), // Emerald Accent
              ),
              pw.SizedBox(height: 12),
              pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Text(
                    title,
                    style: pw.TextStyle(
                      fontSize: 18,
                      fontWeight: pw.FontWeight.bold,
                      color: PdfColor.fromHex('#064E3B'),
                    ),
                  ),
                  pw.Text(
                    dateStr,
                    style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey700),
                  ),
                ],
              ),
              pw.Text(
                'NextUnit DocuScan Archive • OCR Table Matrix & Extraction',
                style: pw.TextStyle(fontSize: 9, color: PdfColor.fromHex('#059669')),
              ),
              pw.SizedBox(height: 8),
              pw.Divider(color: PdfColor.fromHex('#D1FAE5'), thickness: 0.8),
              pw.SizedBox(height: 12),
            ],
          ),
          build: (context) => [
            // 1. Scanned Image embed
            if (docImage != null) ...[
              pw.Text(
                'SCANNED DOCUMENT CAPTURE',
                style: pw.TextStyle(fontSize: 11, fontWeight: pw.FontWeight.bold),
              ),
              pw.SizedBox(height: 6),
              pw.Center(
                child: pw.Container(
                  height: 200,
                  decoration: pw.BoxDecoration(
                    border: pw.Border.all(color: PdfColors.grey300),
                    borderRadius: const pw.BorderRadius.all(pw.Radius.circular(6)),
                  ),
                  child: pw.ClipRRect(
                    horizontalRadius: 6,
                    verticalRadius: 6,
                    child: pw.Image(docImage, fit: pw.BoxFit.contain),
                  ),
                ),
              ),
              pw.SizedBox(height: 16),
            ],

            // 2. Data Table Matrix
            if (normalizedTable != null && normalizedTable.isNotEmpty) ...[
              pw.Text(
                'EXTRACTED DATA TABLE & COLUMNS',
                style: pw.TextStyle(fontSize: 11, fontWeight: pw.FontWeight.bold),
              ),
              pw.SizedBox(height: 6),
              pw.TableHelper.fromTextArray(
                headers: normalizedTable.first,
                data: normalizedTable.length > 1 ? normalizedTable.sublist(1) : [],
                border: pw.TableBorder.all(color: PdfColors.grey300, width: 0.5),
                headerStyle: pw.TextStyle(
                  color: PdfColors.white,
                  fontWeight: pw.FontWeight.bold,
                  fontSize: 9,
                ),
                headerDecoration: pw.BoxDecoration(
                  color: PdfColor.fromHex('#059669'),
                ),
                cellStyle: const pw.TextStyle(fontSize: 8),
                rowDecoration: const pw.BoxDecoration(),
                oddRowDecoration: pw.BoxDecoration(
                  color: PdfColor.fromHex('#F0FDF4'),
                ),
              ),
              pw.SizedBox(height: 16),
            ],

            // 3. Recognized OCR Text
            if (ocrText != null && ocrText.trim().isNotEmpty) ...[
              pw.Text(
                'RECOGNIZED OCR TEXT CONTENT',
                style: pw.TextStyle(fontSize: 11, fontWeight: pw.FontWeight.bold),
              ),
              pw.SizedBox(height: 6),
              pw.Container(
                width: double.infinity,
                padding: const pw.EdgeInsets.all(10),
                decoration: pw.BoxDecoration(
                  color: PdfColors.grey100,
                  border: pw.Border.all(color: PdfColors.grey300),
                  borderRadius: const pw.BorderRadius.all(pw.Radius.circular(6)),
                ),
                child: pw.Text(
                  ocrText,
                  style: const pw.TextStyle(fontSize: 8.5, lineSpacing: 1.3),
                ),
              ),
            ],
          ],
        ),
      );

      final directory = await getApplicationDocumentsDirectory();
      final cleanTitle = title.replaceAll(RegExp(r'[^a-zA-Z0-9_\-]'), '_');
      final file = File('${directory.path}/$cleanTitle.pdf');
      await file.writeAsBytes(await pdf.save());
      return file;
    } catch (e) {
      return null;
    }
  }

  /// Print or share PDF directly
  static Future<void> printPdf(File file) async {
    await Printing.layoutPdf(onLayout: (_) => file.readAsBytes());
  }
}
