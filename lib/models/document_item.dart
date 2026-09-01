class DocumentItem {
  final String id;
  final String title;
  final String date;
  final String type; // 'pdf', 'excel', 'voice', 'scan'
  final String size;
  final String? imagePath;
  final String? ocrText;
  final List<List<String>>? tableData;
  final String? audioPath;

  DocumentItem({
    required this.id,
    required this.title,
    required this.date,
    required this.type,
    required this.size,
    this.imagePath,
    this.ocrText,
    this.tableData,
    this.audioPath,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'date': date,
        'type': type,
        'size': size,
        'imagePath': imagePath,
        'ocrText': ocrText,
        'tableData': tableData,
        'audioPath': audioPath,
      };

  factory DocumentItem.fromJson(Map<String, dynamic> json) => DocumentItem(
        id: json['id'] ?? '',
        title: json['title'] ?? '',
        date: json['date'] ?? '',
        type: json['type'] ?? 'scan',
        size: json['size'] ?? '',
        imagePath: json['imagePath'],
        ocrText: json['ocrText'],
        tableData: json['tableData'] != null
            ? (json['tableData'] as List)
                .map((row) => (row as List).map((cell) => cell.toString()).toList())
                .toList()
            : null,
        audioPath: json['audioPath'],
      );
}
