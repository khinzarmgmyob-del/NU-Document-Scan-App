import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'screens/scanner_tab.dart';
import 'screens/excel_tab.dart';
import 'screens/voice_tab.dart';
import 'screens/storage_tab.dart';
import 'widgets/wave_background.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const NextUnitDocuScanApp());
}

class NextUnitDocuScanApp extends StatefulWidget {
  const NextUnitDocuScanApp({Key? key}) : super(key: key);

  @override
  State<NextUnitDocuScanApp> createState() => _NextUnitDocuScanAppState();
}

class _NextUnitDocuScanAppState extends State<NextUnitDocuScanApp> {
  ThemeMode _themeMode = ThemeMode.light;

  @override
  void initState() {
    super.initState();
    _loadTheme();
  }

  Future<void> _loadTheme() async {
    final prefs = await SharedPreferences.getInstance();
    final isDark = prefs.getBool('isDark') ?? false;
    setState(() {
      _themeMode = isDark ? ThemeMode.dark : ThemeMode.light;
    });
  }

  Future<void> _toggleTheme() async {
    final prefs = await SharedPreferences.getInstance();
    final isDark = _themeMode == ThemeMode.dark;
    await prefs.setBool('isDark', !isDark);
    setState(() {
      _themeMode = isDark ? ThemeMode.light : ThemeMode.dark;
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'NextUnit DocuScan',
      debugShowCheckedModeBanner: false,
      themeMode: _themeMode,
      theme: ThemeData(
        brightness: Brightness.light,
        scaffoldBackgroundColor: const Color(0xFFF8FAFC),
        primaryColor: const Color(0xFF10B981),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF10B981),
          brightness: Brightness.light,
          primary: const Color(0xFF10B981),
          surface: Colors.white,
        ),
        useMaterial3: true,
      ),
      darkTheme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF090D0C),
        primaryColor: const Color(0xFF10B981),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF10B981),
          surface: Color(0xFF0F1715),
          background: Color(0xFF090D0C),
        ),
        useMaterial3: true,
      ),
      home: MainScreen(
        isDark: _themeMode == ThemeMode.dark,
        onToggleTheme: _toggleTheme,
      ),
    );
  }
}

class MainScreen extends StatefulWidget {
  final bool isDark;
  final VoidCallback onToggleTheme;

  const MainScreen({
    Key? key,
    required this.isDark,
    required this.onToggleTheme,
  }) : super(key: key);

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  int _currentIndex = 0;
  List<List<String>> _currentTableData = [];
  String _currentOcrText = '';
  String? _currentImagePath;

  void _onScanCompleted(String ocrText, List<List<String>> tableData, String? imagePath) {
    setState(() {
      _currentOcrText = ocrText;
      _currentTableData = tableData;
      _currentImagePath = imagePath;
    });
  }

  @override
  Widget build(BuildContext context) {
    final List<Widget> screens = [
      ScannerTab(
        onScanCompleted: _onScanCompleted,
        onNavigateTab: (idx) => setState(() => _currentIndex = idx),
      ),
      ExcelTab(
        tableRows: _currentTableData,
        onUpdateTable: (updated) => setState(() => _currentTableData = updated),
        onGoToScan: () => setState(() => _currentIndex = 0),
      ),
      const VoiceTab(),
      const StorageTab(),
    ];

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: const Color(0xFF10B981),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.document_scanner, color: Colors.white, size: 20),
            ),
            const SizedBox(width: 8),
            const Text(
              'NextUnit DocuScan',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: Icon(
              widget.isDark ? Icons.light_mode : Icons.dark_mode,
              color: widget.isDark ? const Color(0xFF34D399) : const Color(0xFF059669),
            ),
            onPressed: widget.onToggleTheme,
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Stack(
        children: [
          // Top 1/3 Wave Background Graphic
          WaveBackground(isDark: widget.isDark),

          // Main View Content
          SafeArea(
            child: screens[_currentIndex],
          ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) => setState(() => _currentIndex = index),
        backgroundColor: widget.isDark ? const Color(0xFF0F1715) : Colors.white,
        indicatorColor: const Color(0xFF10B981).withOpacity(0.2),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.document_scanner_outlined),
            selectedIcon: Icon(Icons.document_scanner, color: Color(0xFF10B981)),
            label: 'Scan',
          ),
          NavigationDestination(
            icon: Icon(Icons.table_chart_outlined),
            selectedIcon: Icon(Icons.table_chart, color: Color(0xFF10B981)),
            label: 'Excel',
          ),
          NavigationDestination(
            icon: Icon(Icons.mic_none),
            selectedIcon: Icon(Icons.mic, color: Color(0xFF10B981)),
            label: 'Voice',
          ),
          NavigationDestination(
            icon: Icon(Icons.folder_outlined),
            selectedIcon: Icon(Icons.folder, color: Color(0xFF10B981)),
            label: 'Storage',
          ),
        ],
      ),
    );
  }
}
