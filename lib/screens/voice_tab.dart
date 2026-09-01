import 'dart:async';
import 'package:flutter/material.dart';
import '../services/voice_service.dart';
import '../services/storage_service.dart';
import '../models/document_item.dart';

class VoiceTab extends StatefulWidget {
  const VoiceTab({Key? key}) : super(key: key);

  @override
  State<VoiceTab> createState() => _VoiceTabState();
}

class _VoiceTabState extends State<VoiceTab> {
  bool _isRecording = false;
  int _recordDuration = 0;
  Timer? _timer;
  String? _lastRecordedPath;

  void _toggleRecording() async {
    if (_isRecording) {
      final path = await VoiceService.stopRecording();
      _timer?.cancel();
      setState(() {
        _isRecording = false;
        _lastRecordedPath = path;
      });

      if (path != null) {
        final title = 'VoiceNote_${DateTime.now().millisecondsSinceEpoch}.m4a';
        await StorageService.saveDocument(
          DocumentItem(
            id: DateTime.now().millisecondsSinceEpoch.toString(),
            title: title,
            date: 'Just now',
            type: 'voice',
            size: '${(_recordDuration * 12)} KB',
            audioPath: path,
          ),
        );

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('✓ Voice Note recorded and saved to archive!'),
              backgroundColor: Color(0xFF10B981),
            ),
          );
        }
      }
    } else {
      final fileName = 'Voice_${DateTime.now().millisecondsSinceEpoch}';
      await VoiceService.startRecording(fileName);
      setState(() {
        _isRecording = true;
        _recordDuration = 0;
      });

      _timer = Timer.periodic(const Duration(seconds: 1), (_) {
        setState(() => _recordDuration++);
      });
    }
  }

  String _formatDuration(int seconds) {
    final mins = (seconds ~/ 60).toString().padLeft(2, '0');
    final secs = (seconds % 60).toString().padLeft(2, '0');
    return '$mins:$secs';
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Audio Recorder Hero
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF0F1715) : Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isDark ? const Color(0xFF1E2E2A) : const Color(0xFFD1FAE5),
              ),
            ),
            child: Column(
              children: [
                const Text(
                  'Voice Notes & Audio Archive',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                ),
                const SizedBox(height: 6),
                Text(
                  _isRecording ? 'Recording audio in progress...' : 'Tap the microphone button to record',
                  style: const TextStyle(fontSize: 12, color: Colors.grey),
                ),
                const SizedBox(height: 24),
                Text(
                  _formatDuration(_recordDuration),
                  style: TextStyle(
                    fontSize: 36,
                    fontWeight: FontWeight.bold,
                    color: _isRecording ? Colors.red : const Color(0xFF10B981),
                  ),
                ),
                const SizedBox(height: 24),
                GestureDetector(
                  onTap: _toggleRecording,
                  child: Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: _isRecording ? Colors.red : const Color(0xFF10B981),
                      boxShadow: [
                        BoxShadow(
                          color: (_isRecording ? Colors.red : const Color(0xFF10B981)).withOpacity(0.3),
                          blurRadius: 16,
                          spreadRadius: 4,
                        ),
                      ],
                    ),
                    child: Icon(
                      _isRecording ? Icons.stop : Icons.mic,
                      color: Colors.white,
                      size: 36,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
