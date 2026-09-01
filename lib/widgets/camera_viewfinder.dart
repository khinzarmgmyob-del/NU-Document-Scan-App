import 'dart:io';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';

enum ViewfinderMode { portrait, landscape, receipt, full }

class CameraViewfinderScreen extends StatefulWidget {
  final List<CameraDescription> cameras;

  const CameraViewfinderScreen({Key? key, required this.cameras}) : super(key: key);

  @override
  State<CameraViewfinderScreen> createState() => _CameraViewfinderScreenState();
}

class _CameraViewfinderScreenState extends State<CameraViewfinderScreen> {
  CameraController? _controller;
  int _selectedCameraIndex = 0;
  bool _isTorchOn = false;
  bool _showGrid = true;
  ViewfinderMode _viewfinderMode = ViewfinderMode.portrait;
  bool _isCapturing = false;

  @override
  void initState() {
    super.initState();
    if (widget.cameras.isNotEmpty) {
      _initCamera(widget.cameras[_selectedCameraIndex]);
    }
  }

  Future<void> _initCamera(CameraDescription camera) async {
    _controller = CameraController(
      camera,
      ResolutionPreset.high,
      enableAudio: false,
    );

    try {
      await _controller!.initialize();
      if (mounted) setState(() {});
    } catch (e) {
      debugPrint('Camera init error: $e');
    }
  }

  Future<void> _toggleTorch() async {
    if (_controller == null || !_controller!.value.isInitialized) return;
    try {
      final nextState = !_isTorchOn;
      await _controller!.setFlashMode(nextState ? FlashMode.torch : FlashMode.off);
      setState(() {
        _isTorchOn = nextState;
      });
    } catch (e) {
      debugPrint('Flash toggle error: $e');
    }
  }

  Future<void> _switchCamera() async {
    if (widget.cameras.length < 2) return;
    _selectedCameraIndex = (_selectedCameraIndex + 1) % widget.cameras.length;
    await _controller?.dispose();
    _initCamera(widget.cameras[_selectedCameraIndex]);
  }

  Future<void> _takePicture() async {
    if (_controller == null || !_controller!.value.isInitialized || _isCapturing) return;

    try {
      setState(() => _isCapturing = true);
      final XFile picture = await _controller!.takePicture();
      if (mounted) {
        Navigator.pop(context, picture.path);
      }
    } catch (e) {
      debugPrint('Capture error: $e');
    } finally {
      if (mounted) setState(() => _isCapturing = false);
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_controller == null || !_controller!.value.isInitialized) {
      return const Scaffold(
        backgroundColor: Colors.black,
        body: Center(
          child: CircularProgressIndicator(color: Color(0xFF10B981)),
        ),
      );
    }

    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Stack(
          children: [
            // 1. Camera Preview
            Center(
              child: CameraPreview(_controller!),
            ),

            // 2. Viewfinder Target Overlay
            if (_viewfinderMode != ViewfinderMode.full)
              Center(
                child: _buildFrameOverlay(),
              ),

            // 3. Top Action Bar
            Positioned(
              top: 12,
              left: 16,
              right: 16,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.white),
                    onPressed: () => Navigator.pop(context),
                  ),
                  Row(
                    children: [
                      IconButton(
                        icon: Icon(
                          _isTorchOn ? Icons.flash_on : Icons.flash_off,
                          color: _isTorchOn ? Colors.amber : Colors.white,
                        ),
                        onPressed: _toggleTorch,
                      ),
                      IconButton(
                        icon: Icon(
                          _showGrid ? Icons.grid_on : Icons.grid_off,
                          color: _showGrid ? const Color(0xFF10B981) : Colors.white70,
                        ),
                        onPressed: () => setState(() => _showGrid = !_showGrid),
                      ),
                      IconButton(
                        icon: const Icon(Icons.flip_camera_ios, color: Colors.white),
                        onPressed: _switchCamera,
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // 4. Orientation Mode Selector
            Positioned(
              bottom: 100,
              left: 0,
              right: 0,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _modeButton(ViewfinderMode.portrait, 'Portrait (ဒေါင်လိုက်)'),
                  const SizedBox(width: 8),
                  _modeButton(ViewfinderMode.landscape, 'Landscape (အလျားလိုက်)'),
                  const SizedBox(width: 8),
                  _modeButton(ViewfinderMode.receipt, 'Receipt'),
                ],
              ),
            ),

            // 5. Bottom Shutter
            Positioned(
              bottom: 24,
              left: 0,
              right: 0,
              child: Center(
                child: GestureDetector(
                  onTap: _takePicture,
                  child: Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 4),
                      color: const Color(0xFF10B981),
                    ),
                    child: _isCapturing
                        ? const CircularProgressIndicator(color: Colors.white)
                        : const Icon(Icons.camera_alt, color: Colors.white, size: 32),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _modeButton(ViewfinderMode mode, String label) {
    final isSelected = _viewfinderMode == mode;
    return GestureDetector(
      onTap: () => setState(() => _viewfinderMode = mode),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF10B981) : Colors.black54,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? const Color(0xFF34D399) : Colors.white24,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.black : Colors.white,
            fontSize: 11,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }

  Widget _buildFrameOverlay() {
    double widthFactor = 0.80;
    double heightFactor = 0.65;

    if (_viewfinderMode == ViewfinderMode.portrait) {
      widthFactor = 0.78;
      heightFactor = 0.65;
    } else if (_viewfinderMode == ViewfinderMode.landscape) {
      widthFactor = 0.90;
      heightFactor = 0.45;
    } else if (_viewfinderMode == ViewfinderMode.receipt) {
      widthFactor = 0.60;
      heightFactor = 0.70;
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final boxW = constraints.maxWidth * widthFactor;
        final boxH = constraints.maxHeight * heightFactor;

        return Container(
          width: boxW,
          height: boxH,
          decoration: BoxDecoration(
            border: Border.all(color: const Color(0xFF34D399), width: 2),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Stack(
            children: [
              if (_showGrid)
                Positioned.fill(
                  child: CustomPaint(
                    painter: GridPainter(),
                  ),
                ),
              Positioned(
                bottom: 8,
                left: 0,
                right: 0,
                child: Center(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.black87,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Text(
                      'Align document inside frame',
                      style: TextStyle(color: Colors.white70, fontSize: 10),
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class GridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFF34D399).withOpacity(0.3)
      ..strokeWidth = 1.0;

    // Vertical lines
    canvas.drawLine(Offset(size.width / 3, 0), Offset(size.width / 3, size.height), paint);
    canvas.drawLine(Offset(size.width * 2 / 3, 0), Offset(size.width * 2 / 3, size.height), paint);

    // Horizontal lines
    canvas.drawLine(Offset(0, size.height / 3), Offset(size.width, size.height / 3), paint);
    canvas.drawLine(Offset(0, size.height * 2 / 3), Offset(size.width, size.height * 2 / 3), paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
