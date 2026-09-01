import 'dart:convert';
import 'dart:io';
import 'package:path_provider/path_provider.dart';
import '../models/document_item.dart';

class StorageService {
  static const _archiveFileName = 'docuscan_archive.json';

  static Future<List<DocumentItem>> getSavedDocuments() async {
    try {
      final directory = await getApplicationDocumentsDirectory();
      final file = File('${directory.path}/$_archiveFileName');
      if (!file.existsSync()) return [];

      final content = await file.readAsString();
      final List<dynamic> jsonList = jsonDecode(content);
      return jsonList.map((item) => DocumentItem.fromJson(item)).toList();
    } catch (e) {
      return [];
    }
  }

  static Future<void> saveDocument(DocumentItem document) async {
    final list = await getSavedDocuments();
    list.insert(0, document);

    final directory = await getApplicationDocumentsDirectory();
    final file = File('${directory.path}/$_archiveFileName');
    await file.writeAsString(jsonEncode(list.map((d) => d.toJson()).toList()));
  }

  static Future<void> deleteDocument(String id) async {
    final list = await getSavedDocuments();
    list.removeWhere((item) => item.id == id);

    final directory = await getApplicationDocumentsDirectory();
    final file = File('${directory.path}/$_archiveFileName');
    await file.writeAsString(jsonEncode(list.map((d) => d.toJson()).toList()));
  }
}
