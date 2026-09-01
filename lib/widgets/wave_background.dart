import 'package:flutter/material.dart';

class WaveBackground extends StatelessWidget {
  final bool isDark;

  const WaveBackground({Key? key, required this.isDark}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final screenHeight = MediaQuery.of(context).size.height;

    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      height: screenHeight * 0.34,
      child: IgnorePointer(
        child: CustomPaint(
          size: Size(double.infinity, screenHeight * 0.34),
          painter: WavePainter(isDark: isDark),
        ),
      ),
    );
  }
}

class WavePainter extends CustomPainter {
  final bool isDark;

  WavePainter({required this.isDark});

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    // 1. Base Gradient Fill
    final baseGradient = LinearGradient(
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
      colors: isDark
          ? [
              const Color(0xFF0F1715),
              const Color(0xFF090D0C),
            ]
          : [
              const Color(0xFFECFDF5),
              const Color(0xFFF8FAFC),
            ],
    );

    final rect = Rect.fromLTWH(0, 0, w, h);
    final basePaint = Paint()..shader = baseGradient.createShader(rect);
    canvas.drawRect(rect, basePaint);

    // 2. Layer 1: Back Wave
    final path1 = Path();
    path1.moveTo(0, 0);
    path1.lineTo(0, h * 0.65);
    path1.cubicTo(w * 0.25, h * 0.90, w * 0.45, h * 0.45, w * 0.75, h * 0.70);
    path1.cubicTo(w * 0.88, h * 0.82, w * 0.95, h * 0.60, w, h * 0.65);
    path1.lineTo(w, 0);
    path1.close();

    final paint1 = Paint()
      ..color = isDark
          ? const Color(0xFF10B981).withOpacity(0.08)
          : const Color(0xFFA7F3D0).withOpacity(0.45)
      ..style = PaintingStyle.fill;
    canvas.drawPath(path1, paint1);

    // 3. Layer 2: Middle S-Curve Wave
    final path2 = Path();
    path2.moveTo(0, 0);
    path2.lineTo(0, h * 0.50);
    path2.cubicTo(w * 0.20, h * 0.35, w * 0.40, h * 0.80, w * 0.65, h * 0.55);
    path2.cubicTo(w * 0.85, h * 0.35, w * 0.92, h * 0.68, w, h * 0.48);
    path2.lineTo(w, 0);
    path2.close();

    final paint2 = Paint()
      ..color = isDark
          ? const Color(0xFF059669).withOpacity(0.12)
          : const Color(0xFF6EE7B7).withOpacity(0.35)
      ..style = PaintingStyle.fill;
    canvas.drawPath(path2, paint2);

    // 4. Layer 3: Front Flowing Wave
    final path3 = Path();
    path3.moveTo(0, 0);
    path3.lineTo(0, h * 0.35);
    path3.cubicTo(w * 0.30, h * 0.60, w * 0.55, h * 0.25, w * 0.80, h * 0.45);
    path3.cubicTo(w * 0.90, h * 0.55, w * 0.96, h * 0.40, w, h * 0.38);
    path3.lineTo(w, 0);
    path3.close();

    final paint3 = Paint()
      ..color = isDark
          ? const Color(0xFF34D399).withOpacity(0.15)
          : const Color(0xFF34D399).withOpacity(0.25)
      ..style = PaintingStyle.fill;
    canvas.drawPath(path3, paint3);

    // 5. Delicate Accent Stroke Line
    final strokePath = Path();
    strokePath.moveTo(0, h * 0.35);
    strokePath.cubicTo(w * 0.30, h * 0.60, w * 0.55, h * 0.25, w * 0.80, h * 0.45);
    strokePath.cubicTo(w * 0.90, h * 0.55, w * 0.96, h * 0.40, w, h * 0.38);

    final strokePaint = Paint()
      ..color = isDark
          ? const Color(0xFF34D399).withOpacity(0.35)
          : const Color(0xFF059669).withOpacity(0.40)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0;
    canvas.drawPath(strokePath, strokePaint);
  }

  @override
  bool shouldRepaint(covariant WavePainter oldDelegate) {
    return oldDelegate.isDark != isDark;
  }
}
