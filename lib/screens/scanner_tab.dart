import 'dart:io';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../services/ocr_service.dart';
import '../services/gemini_service.dart';
import '../services/pdf_service.dart';
import '../services/storage_service.dart';
import '../models/document_item.dart';
import '../widgets/camera_viewfinder.dart';

enum ScanEngineMode {
  offlineSpatial,
  aiGeminiVision,
}

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
  String _statusMessage = '';
  ScanEngineMode _selectedEngine = ScanEngineMode.aiGeminiVision;
  String _lastEngineUsed = '';

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
      _progress = 0.15;
      _statusMessage = _selectedEngine == ScanEngineMode.aiGeminiVision
          ? 'Connecting to Gemini AI Vision...'
          : 'Processing ML Kit 2D Spatial OCR...';
    });

    try {
      String text = '';
      List<List<String>> table = [];

      if (_selectedEngine == ScanEngineMode.aiGeminiVision) {
        setState(() {
          _progress = 0.45;
          _statusMessage = 'AI Vision analyzing columns & cell structures...';
        });

        final aiResult = await GeminiVisionService.extractTableWithGemini(
          imageFile: imageFile,
        );

        text = aiResult.text;
        table = aiResult.table;
        _lastEngineUsed = aiResult.isAiSuccess
            ? '✨ Gemini 2.5 Flash Vision (100% Precision)'
            : '⚡ Fast Offline Spatial Engine (Fallback)';
      } else {
        setState(() {
          _progress = 0.5;
          _statusMessage = 'Extracting OCR text...';
        });

        text = await OcrService.processImage(imageFile);
        
        setState(() {
          _progress = 0.8;
          _statusMessage = 'Clustering 2D Spatial Bounding Boxes...';
        });

        table = await OcrService.extractSpatialTable(imageFile);
        _lastEngineUsed = '⚡ Fast Offline Spatial Engine (ML Kit)';
      }

      setState(() {
        _extractedText = text;
        _tableData = table;
        _isProcessing = false;
        _progress = 1.0;
        _statusMessage = 'Extraction Complete!';
      });

      widget.onScanCompleted(text, table, imageFile.path);
    } catch (e) {
      setState(() {
        _isProcessing = false;
        _statusMessage = 'Error occurred during processing';
      });
    }
  }

  void _showApiKeyDialog() {
    final controller = TextEditingController(text: GeminiVisionService.userApiKey);

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.auto_awesome, color: Color(0xFF10B981), size: 22),
            SizedBox(width: 8),
            Text('Gemini AI Vision Setup', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Google AI Studio API Key (Free Tier: 1,500 requests/day free):',
              style: TextStyle(fontSize: 12, color: Colors.grey),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: controller,
              decoration: InputDecoration(
                hintText: 'AIzaSy...',
                labelText: 'Gemini API Key',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                prefixIcon: const Icon(Icons.key, size: 18),
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              '✓ ScanToExcel-level 100% precision for invoices, receipts & borderless tables.\n✓ If empty or offline, Fast ML Kit engine is used automatically.',
              style: TextStyle(fontSize: 11, color: Color(0xFF059669), height: 1.4),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              GeminiVisionService.userApiKey = controller.text.trim();
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('✓ Gemini API Key updated successfully!'),
                  backgroundColor: Color(0xFF10B981),
                ),
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF10B981),
              foregroundColor: Colors.white,
            ),
            child: const Text('Save'),
          ),
        ],
      ),
    );
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
          // Engine Selector Card
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF0F1715) : Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isDark ? const Color(0xFF1E2E2A) : const Color(0xFFD1FAE5),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.03),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.tune, size: 16, color: Color(0xFF10B981)),
                        SizedBox(width: 6),
                        Text(
                          'Extraction Engine',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                        ),
                      ],
                    ),
                    IconButton(
                      icon: const Icon(Icons.settings, size: 18, color: Colors.grey),
                      tooltip: 'Configure Gemini API Key',
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                      onPressed: _showApiKeyDialog,
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: GestureDetector(
                        onTap: () {
                          setState(() => _selectedEngine = ScanEngineMode.aiGeminiVision);
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
                          decoration: BoxDecoration(
                            color: _selectedEngine == ScanEngineMode.aiGeminiVision
                                ? const Color(0xFF10B981).withOpacity(0.15)
                                : (isDark ? Colors.black26 : const Color(0xFFF1F5F9)),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: _selectedEngine == ScanEngineMode.aiGeminiVision
                                  ? const Color(0xFF10B981)
                                  : Colors.transparent,
                              width: 1.5,
                            ),
                          ),
                          child: Column(
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    Icons.auto_awesome,
                                    size: 14,
                                    color: _selectedEngine == ScanEngineMode.aiGeminiVision
                                        ? const Color(0xFF10B981)
                                        : Colors.grey,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    'AI Smart Vision',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.bold,
                                      color: _selectedEngine == ScanEngineMode.aiGeminiVision
                                          ? const Color(0xFF10B981)
                                          : (isDark ? Colors.white70 : Colors.black87),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 2),
                              const Text(
                                'Gemini 2.5 (100% Precision)',
                                style: TextStyle(fontSize: 10, color: Colors.grey),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: GestureDetector(
                        onTap: () {
                          setState(() => _selectedEngine = ScanEngineMode.offlineSpatial);
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
                          decoration: BoxDecoration(
                            color: _selectedEngine == ScanEngineMode.offlineSpatial
                                ? const Color(0xFF10B981).withOpacity(0.15)
                                : (isDark ? Colors.black26 : const Color(0xFFF1F5F9)),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: _selectedEngine == ScanEngineMode.offlineSpatial
                                  ? const Color(0xFF10B981)
                                  : Colors.transparent,
                              width: 1.5,
                            ),
                          ),
                          child: Column(
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    Icons.bolt,
                                    size: 14,
                                    color: _selectedEngine == ScanEngineMode.offlineSpatial
                                        ? const Color(0xFF10B981)
                                        : Colors.grey,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    'Fast Offline',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.bold,
                                      color: _selectedEngine == ScanEngineMode.offlineSpatial
                                          ? const Color(0xFF10B981)
                                          : (isDark ? Colors.white70 : Colors.black87),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 2),
                              const Text(
                                'ML Kit Spatial (No Internet)',
                                style: TextStyle(fontSize: 10, color: Colors.grey),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 12),

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
                  Text(
                    _statusMessage.isNotEmpty ? _statusMessage : 'Processing OCR & Table Matrix...',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                  ),
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
                  
                  if (_lastEngineUsed.isNotEmpty)
                    Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: const Color(0xFF10B981).withOpacity(0.1),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFF10B981).withOpacity(0.3)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.verified, size: 14, color: Color(0xFF10B981)),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              _lastEngineUsed,
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF059669)),
                            ),
                          ),
                        ],
                      ),
                    ),

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
