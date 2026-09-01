import 'dart:io';
import 'package:audioplayers/audioplayers.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

class VoiceService {
  static final _audioRecorder = AudioRecorder();
  static final _audioPlayer = AudioPlayer();

  static Future<bool> hasPermission() async {
    return await _audioRecorder.hasPermission();
  }

  static Future<void> startRecording(String fileName) async {
    if (await _audioRecorder.hasPermission()) {
      final directory = await getApplicationDocumentsDirectory();
      final path = '${directory.path}/$fileName.m4a';
      await _audioRecorder.start(const RecordConfig(), path: path);
    }
  }

  static Future<String?> stopRecording() async {
    return await _audioRecorder.stop();
  }

  static Future<void> playAudio(String path) async {
    await _audioPlayer.play(DeviceFileSource(path));
  }

  static Future<void> pauseAudio() async {
    await _audioPlayer.pause();
  }

  static Future<void> stopAudio() async {
    await _audioPlayer.stop();
  }

  static void dispose() {
    _audioRecorder.dispose();
    _audioPlayer.dispose();
  }
}
