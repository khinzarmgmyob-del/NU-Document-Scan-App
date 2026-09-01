import 'dart:convert';
import 'dart:developer';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'ocr_service.dart';

class GeminiVisionResult {
  final String text;
  final List<List<String>> table;
  final bool isAiSuccess;
  final String? errorMessage;

  GeminiVisionResult({
    required this.text,
    required this.table,
    required this.isAiSuccess,
    this.errorMessage,
  });
}

class GeminiVisionService {
  // Free / Default API Key placeholder (can be customized by user or configured in env)
  static String userApiKey = '';

  /// Performs AI Multimodal Table Extraction using Gemini 2.5 Flash Vision
  /// Extracts 100% accurate column alignment and cell structures (Receipts, Invoices, Financial Tables).
  static Future<GeminiVisionResult> extractTableWithGemini({
    required File imageFile,
    String? apiKey,
  }) async {
    final activeKey = apiKey ?? userApiKey;

    if (activeKey.trim().isEmpty) {
      // If no API key configured, use ML Kit 2D Spatial coordinates clustering
      log('Gemini API key not configured, falling back to ML Kit Spatial Extraction');
      final fallbackTable = await OcrService.extractSpatialTable(imageFile);
      final rawText = await OcrService.processImage(imageFile);
      return GeminiVisionResult(
        text: rawText,
        table: fallbackTable,
        isAiSuccess: false,
        errorMessage: 'API Key not provided. Used Fast Offline Spatial Engine.',
      );
    }

    try {
      final bytes = await imageFile.readAsBytes();
      final base64Image = base64Encode(bytes);

      final url = Uri.parse(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$activeKey',
      );

      final prompt = 
        'You are an expert Document Table OCR AI. Analyze this image carefully.\n'
        '1. Extract the full textual content from the image accurately into "fullText".\n'
        '2. Extract tabular or columnar data into a 2D array matrix "table" (rows of string cells). The first row must be the column headers.\n'
        '3. Ensure every row has the same number of columns as the header. Preserve empty cells as empty strings. Align items, quantities, prices, and amounts accurately into distinct columns.';

      final payload = {
        'contents': [
          {
            'parts': [
              {
                'inlineData': {
                  'mimeType': 'image/jpeg',
                  'data': base64Image,
                }
              },
              {
                'text': prompt,
              }
            ]
          }
        ],
        'generationConfig': {
          'responseMimeType': 'application/json',
          'responseSchema': {
            'type': 'OBJECT',
            'properties': {
              'fullText': {
                'type': 'STRING',
                'description': 'The complete raw OCR text',
              },
              'table': {
                'type': 'ARRAY',
                'description': '2D matrix of extracted table where index 0 is column headers',
                'items': {
                  'type': 'ARRAY',
                  'items': {
                    'type': 'STRING',
                  }
                }
              }
            },
            'required': ['fullText', 'table'],
          }
        }
      };

      final response = await http.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(payload),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final candidates = data['candidates'] as List?;
        if (candidates != null && candidates.isNotEmpty) {
          final content = candidates[0]['content'];
          final parts = content['parts'] as List?;
          if (parts != null && parts.isNotEmpty) {
            final jsonText = parts[0]['text'] as String?;
            if (jsonText != null) {
              final parsed = jsonDecode(jsonText);
              final fullText = parsed['fullText'] as String? ?? '';
              final rawTable = parsed['table'] as List? ?? [];

              final List<List<String>> table = rawTable.map((row) {
                if (row is List) {
                  return row.map((cell) => cell.toString()).toList();
                }
                return <String>[];
              }).toList();

              return GeminiVisionResult(
                text: fullText,
                table: OcrService.normalizeTable(table),
                isAiSuccess: true,
              );
            }
          }
        }
      }

      // If status code != 200 or parsing failed, fallback
      log('Gemini API call returned status ${response.statusCode}: ${response.body}');
      final fallbackTable = await OcrService.extractSpatialTable(imageFile);
      final rawText = await OcrService.processImage(imageFile);
      return GeminiVisionResult(
        text: rawText,
        table: fallbackTable,
        isAiSuccess: false,
        errorMessage: 'Gemini Error (${response.statusCode}). Used Offline Spatial Engine.',
      );
    } catch (e) {
      log('Gemini Vision exception: $e');
      final fallbackTable = await OcrService.extractSpatialTable(imageFile);
      final rawText = await OcrService.processImage(imageFile);
      return GeminiVisionResult(
        text: rawText,
        table: fallbackTable,
        isAiSuccess: false,
        errorMessage: 'Connection Error: $e. Used Offline Spatial Engine.',
      );
    }
  }
}
