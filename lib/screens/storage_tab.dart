import 'package:flutter/material.dart';
import '../services/storage_service.dart';
import '../models/document_item.dart';

class StorageTab extends StatefulWidget {
  const StorageTab({Key? key}) : super(key: key);

  @override
  State<StorageTab> createState() => _StorageTabState();
}

class _StorageTabState extends State<StorageTab> {
  List<DocumentItem> _documents = [];
  String _filter = 'all';

  @override
  void initState() {
    super.initState();
    _loadDocuments();
  }

  Future<void> _loadDocuments() async {
    final docs = await StorageService.getSavedDocuments();
    setState(() {
      _documents = docs;
    });
  }

  Future<void> _deleteDoc(String id) async {
    await StorageService.deleteDocument(id);
    _loadDocuments();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final filtered = _documents.where((d) {
      if (_filter == 'all') return true;
      return d.type == _filter;
    }).toList();

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Google Drive Status Card
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF0F1715) : Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isDark ? const Color(0xFF1E2E2A) : const Color(0xFFD1FAE5),
              ),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFF10B981).withOpacity(0.15),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.cloud_done, color: Color(0xFF10B981), size: 24),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Google Drive Cloud Sync', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                      Text('Auto backup enabled • 15 GB Free', style: TextStyle(fontSize: 11, color: Colors.grey)),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 14),

          // Filter Chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _filterChip('all', 'All Files (${_documents.length})'),
                const SizedBox(width: 8),
                _filterChip('pdf', 'PDFs'),
                const SizedBox(width: 8),
                _filterChip('excel', 'Excel / CSV'),
                const SizedBox(width: 8),
                _filterChip('voice', 'Voice Notes'),
              ],
            ),
          ),

          const SizedBox(height: 14),

          // Document List
          if (filtered.isEmpty)
            Container(
              padding: const EdgeInsets.all(32),
              child: const Center(
                child: Text('No archived documents yet.', style: TextStyle(color: Colors.grey)),
              ),
            )
          else
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: filtered.length,
              itemBuilder: (context, index) {
                final doc = filtered[index];
                IconData iconData = Icons.insert_drive_file;
                Color iconColor = const Color(0xFF10B981);

                if (doc.type == 'pdf') {
                  iconData = Icons.picture_as_pdf;
                  iconColor = Colors.redAccent;
                } else if (doc.type == 'excel') {
                  iconData = Icons.table_chart;
                  iconColor = const Color(0xFF10B981);
                } else if (doc.type == 'voice') {
                  iconData = Icons.audiotrack;
                  iconColor = Colors.purpleAccent;
                }

                return Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF0F1715) : Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isDark ? const Color(0xFF1E2E2A) : const Color(0xFFD1FAE5),
                    ),
                  ),
                  child: ListTile(
                    leading: Icon(iconData, color: iconColor),
                    title: Text(doc.title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                    subtitle: Text('${doc.date} • ${doc.size}', style: const TextStyle(fontSize: 11)),
                    trailing: IconButton(
                      icon: const Icon(Icons.delete_outline, size: 20, color: Colors.grey),
                      onPressed: () => _deleteDoc(doc.id),
                    ),
                  ),
                );
              },
            ),
        ],
      ),
    );
  }

  Widget _filterChip(String value, String label) {
    final isSelected = _filter == value;
    return ChoiceChip(
      label: Text(label, style: TextStyle(fontSize: 12, color: isSelected ? Colors.white : null)),
      selected: isSelected,
      selectedColor: const Color(0xFF10B981),
      onSelected: (_) => setState(() => _filter = value),
    );
  }
}
