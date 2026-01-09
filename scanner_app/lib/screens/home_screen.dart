/**
 * Home Screen - Entry point with navigation to scanner
 */

import 'package:flutter/material.dart';
import 'scanner_screen.dart';
import '../services/api_service.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final ApiService _apiService = ApiService();
  bool _isConnecting = true;
  bool _isConnected = false;
  String _apiUrl = '';
  final TextEditingController _serverController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _connectToApi();
  }

  Future<void> _connectToApi() async {
    setState(() => _isConnecting = true);
    
    final connected = await _apiService.connect(
      explicitUrl: _serverController.text.isNotEmpty 
          ? _serverController.text 
          : null,
    );
    
    setState(() {
      _isConnecting = false;
      _isConnected = connected;
      _apiUrl = _apiService.baseUrl ?? '';
    });
  }

  void _navigateToScanner() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => ScannerScreen(apiService: _apiService),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Demo QR Scanner'),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Status Card
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFF12213D),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              'Scanner',
                              style: TextStyle(
                                color: Theme.of(context).colorScheme.secondary,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          const Spacer(),
                          _buildConnectionIndicator(),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'QR Scanner',
                        style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Scan QR codes to log your attendance. Make sure to connect to the server first.',
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.7),
                          fontSize: 14,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),
              
              // Server Configuration
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Server Configuration',
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.secondary,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _serverController,
                        decoration: InputDecoration(
                          hintText: 'http://your-server:4000',
                          labelText: 'Server URL (optional)',
                          suffixIcon: IconButton(
                            icon: const Icon(Icons.refresh),
                            onPressed: _connectToApi,
                          ),
                        ),
                      ),
                      if (_apiUrl.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Icon(
                              Icons.check_circle,
                              color: Colors.green,
                              size: 16,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'Connected to: $_apiUrl',
                                style: TextStyle(
                                  color: Colors.green,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const Spacer(),
              
              // Start Scanning Button
              SizedBox(
                height: 56,
                child: ElevatedButton.icon(
                  onPressed: _isConnected ? _navigateToScanner : null,
                  icon: const Icon(Icons.qr_code_scanner, size: 24),
                  label: Text(
                    _isConnecting
                        ? 'Connecting...'
                        : _isConnected
                            ? 'Start Scanning'
                            : 'Not Connected',
                  ),
                ),
              ),
              const SizedBox(height: 12),
              
              // Retry Button
              if (!_isConnected && !_isConnecting)
                TextButton.icon(
                  onPressed: _connectToApi,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Retry Connection'),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildConnectionIndicator() {
    if (_isConnecting) {
      return const SizedBox(
        width: 16,
        height: 16,
        child: CircularProgressIndicator(strokeWidth: 2),
      );
    }
    
    return Row(
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            color: _isConnected ? Colors.green : Colors.red,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 6),
        Text(
          _isConnected ? 'Connected' : 'Disconnected',
          style: TextStyle(
            color: Colors.white.withOpacity(0.7),
            fontSize: 12,
          ),
        ),
      ],
    );
  }
}
