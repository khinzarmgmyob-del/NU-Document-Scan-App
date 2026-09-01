import 'dart:io';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../services/ocr_service.dart';
import '../services/pdf_service.dart';
import '../services/storage_service.dart';
import '../models/document_item.dart';
import '../widgets/camera_viewfinder.dart';

class ScannerTab extends StatefulWidget {
  final Function(String ocrText, List<List<String>> tableData, String? imagePath) onScanCompleted;
  final Function(int targetTab) onNavigateTab;

  const ScannerTab({
    Key? key,
    required this.onScanCompleted,
    required this.onNavigateTab,
  }) : super(key: key);

  @override
  State<ScannerTab> createState() => _ScannerTabState();
}

class _ScannerTabState extends State<ScannerTab> {
  File? _scannedImage;
  String? _extractedText;
  List<List<String>> _tableData = [];
  bool _isProcessing = false;
  double _progress = 0.0;

  Future<void> _openCamera() async {
    try {
      final cameras = await availableCameras();
      if (!mounted) return;

      final imagePath = await Navigator.push<String>(
        context,
        MaterialPageRoute(
          builder: (context) => CameraViewfinderScreen(cameras: cameras),
        ),
      );

      if (imagePath != null) {
        _processScannedImage(File(imagePath));
      }
    } catch (e) {
      debugPrint('Camera launcher error: $e');
    }
  }

  Future<void> _pickGalleryImage() async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(source: ImageSource.gallery);
    if (pickedFile != null) {
      _processScannedImage(File(pickedFile.path));
    }
  }

  Future<void> _processScannedImage(File imageFile) async {
    setState(() {
      _scannedImage = imageFile;
      _isProcessing = true;
      _progress = 0.2;
    });

    try {
      setState(() => _progress = 0.6);
      final text = await OcrService.processImage(imageFile);
      setState(() => _progress = 0.9);

      final table = OcrService.parseTextToTable(text);

      setState(() {
        _extractedText = text;
        _tableData = table;
        _isProcessing = false;
        _progress = 1.0;
      });

      widget.onScanCompleted(text, table, imageFile.path);
    } catch (e) {
      setState(() => _isProcessing = false);
    }
  }

  Future<void> _exportPdf() async {
    if (_extractedText == null && _scannedImage == null) return;

    final title = 'DocuScan_${DateTime.now().millisecondsSinceEpoch}';
    final file = await PdfService.generateAndSavePdf(
      title: title,
      imagePath: _scannedImage?.path,
      ocrText: _extractedText,
      tableData: _tableData,
    );

    if (file != null) {
      await StorageService.saveDocument(
        DocumentItem(
          id: DateTime.now().millisecondsSinceEpoch.toString(),
          title: '$title.pdf',
          date: 'Just now',
          type: 'pdf',
          size: '${(file.lengthSync() / 1024).toStringAsFixed(1)} KB',
          imagePath: _scannedImage?.path,
          ocrText: _extractedText,
          tableData: _tableData,
        ),
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('✓ Searchable PDF created and archived!'),
            backgroundColor: Color(0xFF10B981),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Action Buttons Card
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF0F1715) : Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isDark ? const Color(0xFF1E2E2A) : const Color(0xFFD1FAE5),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.04),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: _openCamera,
                    icon: const Icon(Icons.camera_alt, size: 20),
                    label: const Text('Open Camera', style: TextStyle(fontWeight: FontWeight.bold)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF10B981),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _pickGalleryImage,
                    icon: const Icon(Icons.photo_library, size: 20),
                    label: const Text('From Gallery', style: TextStyle(fontWeight: FontWeight.bold)),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: isDark ? const Color(0xFF34D399) : const Color(0xFF059669),
                      side: BorderSide(
                        color: isDark ? const Color(0xFF34D399) : const Color(0xFF10B981),
                      ),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 14),

          // Processing progress bar
          if (_isProcessing) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF0F1715) : const Color(0xFFECFDF5),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF10B981)),
              ),
              child: Column(
                children: [
                  const Text('Processing OCR & Matrix Detection...', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                  const SizedBox(height: 8),
                  LinearProgressIndicator(
                    value: _progress,
                    backgroundColor: Colors.grey.withOpacity(0.2),
                    valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF10B981)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
          ],

          // Scanned Document Preview & OCR Result
          if (_scannedImage != null) ...[
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF0F1715) : Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: isDark ? const Color(0xFF1E2E2A) : const Color(0xFFD1FAE5),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.file(_scannedImage!, height: 180, width: double.infinity, fit: BoxFit.cover),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      ElevatedButton.icon(
                        onPressed: _exportPdf,
                        icon: const Icon(Icons.picture_as_pdf, size: 18),
                        label: const Text('Export PDF'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF059669),
                          foregroundColor: Colors.white,
                        ),
                      ),
                      if (_tableData.isNotEmpty)
                        OutlinedButton.icon(
                          onPressed: () => widget.onNavigateTab(1),
                          icon: const Icon(Icons.table_chart, size: 18),
                          label: Text('View Excel (${_tableData.length} Rows)'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: const Color(0xFF10B981),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Extracted OCR Content:',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                  const SizedBox(height: 6),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: isDark ? Colors.black38 : const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.grey.withOpacity(0.2)),
                    ),
                    child: SelectableText(
                      _extractedText ?? 'No text detected.',
                      style: const TextStyle(fontSize: 12, height: 1.4),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
