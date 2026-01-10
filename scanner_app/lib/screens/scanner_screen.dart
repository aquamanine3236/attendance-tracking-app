// Scanner Screen - QR code scanning with camera
//
// Adapted from qr_code_scanner/example/lib/main.dart patterns.
// Uses mobile_scanner package for QR detection.

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:image_picker/image_picker.dart';
import '../services/api_service.dart';
// Conditional import for web QR scanner
import '../services/web_qr_scanner.dart'
    if (dart.library.io) '../services/web_qr_scanner_stub.dart';
import 'user_form_screen.dart';

class ScannerScreen extends StatefulWidget {
  final ApiService apiService;

  const ScannerScreen({super.key, required this.apiService});

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  final MobileScannerController _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.normal,
    facing: CameraFacing.back,
    torchEnabled: false,
  );
  final ImagePicker _imagePicker = ImagePicker();
  final TextEditingController _tokenController = TextEditingController();

  bool _isProcessing = false;
  String? _lastScannedCode;

  @override
  void dispose() {
    _controller.dispose();
    _tokenController.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_isProcessing) return;

    final List<Barcode> barcodes = capture.barcodes;
    for (final barcode in barcodes) {
      final String? code = barcode.rawValue;

      if (code != null && code.isNotEmpty && code != _lastScannedCode) {
        setState(() {
          _isProcessing = true;
          _lastScannedCode = code;
        });

        // Pause scanning and navigate to form
        _controller.stop();
        _navigateToForm(code);
        break;
      }
    }
  }

  void _navigateToForm(String token) {
    Navigator.of(context)
        .push(
      MaterialPageRoute(
        builder: (context) => UserFormScreen(
          token: token,
          apiService: widget.apiService,
        ),
      ),
    )
        .then((_) {
      // Resume scanning when returning
      setState(() {
        _isProcessing = false;
        _lastScannedCode = null;
      });
      _controller.start();
    });
  }

  Future<void> _toggleFlash() async {
    await _controller.toggleTorch();
    setState(() {});
  }

  Future<void> _switchCamera() async {
    await _controller.switchCamera();
    setState(() {});
  }

  // Handle "Can't scan" action based on platform
  void _handleCantScan() {
    if (kIsWeb) {
      // On web, use jsQR to scan from uploaded image
      _pickAndScanImageWeb();
    } else {
      // On mobile, pick image from gallery
      _pickAndScanImage();
    }
  }

  // Pick and scan QR image on web using jsQR
  Future<void> _pickAndScanImageWeb() async {
    setState(() => _isProcessing = true);

    try {
      final String? token = await WebQrScanner.pickAndScanImage();

      if (token != null && token.isNotEmpty) {
        _controller.stop();
        _navigateToForm(token);
        return;
      }

      // No QR code found or user cancelled
      setState(() => _isProcessing = false);
      if (mounted && token == null) {
        // User likely cancelled - no need to show error
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
                'No QR code found in the image. Please try another image.'),
            backgroundColor: Colors.orange,
          ),
        );
      }
    } catch (e) {
      setState(() => _isProcessing = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to scan image: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  // Show dialog for manual token input (fallback)
  void _showManualTokenDialog() {
    _tokenController.clear();
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF111A33),
        title: const Text('Enter QR Token'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Copy the token from the QR code and paste it below:',
              style: TextStyle(
                color: Colors.white.withAlpha(179),
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _tokenController,
              decoration: const InputDecoration(
                hintText: 'Paste token here...',
                border: OutlineInputBorder(),
              ),
              maxLines: 3,
              autofocus: true,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              final token = _tokenController.text.trim();
              if (token.isNotEmpty) {
                Navigator.pop(context);
                _controller.stop();
                _navigateToForm(token);
              }
            },
            child: const Text('Submit'),
          ),
        ],
      ),
    );
  }

  // Pick QR code image from gallery and scan it (mobile only)
  Future<void> _pickAndScanImage() async {
    try {
      final XFile? image = await _imagePicker.pickImage(
        source: ImageSource.gallery,
      );

      if (image == null) return;

      setState(() => _isProcessing = true);

      // Use MobileScanner to analyze the image
      final BarcodeCapture? result = await _controller.analyzeImage(image.path);

      if (result != null && result.barcodes.isNotEmpty) {
        final String? code = result.barcodes.first.rawValue;
        if (code != null && code.isNotEmpty) {
          _controller.stop();
          _navigateToForm(code);
          return;
        }
      }

      // No QR code found
      setState(() => _isProcessing = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
                'No QR code found in the image. Please try another image.'),
            backgroundColor: Colors.orange,
          ),
        );
      }
    } catch (e) {
      setState(() => _isProcessing = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to scan image: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final scanArea = MediaQuery.of(context).size.width * 0.7;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Scan QR Code'),
        actions: [
          // Flash toggle
          IconButton(
            icon: ValueListenableBuilder(
              valueListenable: _controller,
              builder: (context, state, child) {
                return Icon(
                  state.torchState == TorchState.on
                      ? Icons.flash_on
                      : Icons.flash_off,
                );
              },
            ),
            onPressed: _toggleFlash,
          ),
          // Camera switch
          IconButton(
            icon: ValueListenableBuilder(
              valueListenable: _controller,
              builder: (context, state, child) {
                return Icon(
                  state.cameraDirection == CameraFacing.front
                      ? Icons.camera_front
                      : Icons.camera_rear,
                );
              },
            ),
            onPressed: _switchCamera,
          ),
        ],
      ),
      body: Column(
        children: [
          // Scanner View
          Expanded(
            flex: 4,
            child: Stack(
              alignment: Alignment.center,
              children: [
                // Camera Preview
                MobileScanner(
                  controller: _controller,
                  onDetect: _onDetect,
                ),

                // Scan Overlay
                CustomPaint(
                  painter: ScanOverlayPainter(
                    scanAreaSize: scanArea,
                    borderColor: Theme.of(context).colorScheme.primary,
                  ),
                  child: Container(),
                ),

                // Scan Area Indicator
                Container(
                  width: scanArea,
                  height: scanArea,
                  decoration: BoxDecoration(
                    border: Border.all(
                      color: _isProcessing
                          ? Colors.green
                          : Theme.of(context).colorScheme.primary,
                      width: 3,
                    ),
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),

                // Processing Indicator
                if (_isProcessing)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 24,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.black.withAlpha(179),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        ),
                        SizedBox(width: 12),
                        Text(
                          'Processing...',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),

          // Instructions & Upload Button
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.qr_code_2,
                  size: 28,
                  color: Theme.of(context).colorScheme.secondary,
                ),
                const SizedBox(height: 8),
                Text(
                  'Position the QR code within the frame',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white.withAlpha(204),
                    fontSize: 15,
                  ),
                ),
                const SizedBox(height: 16),

                // Cannot scan? Upload image button
                TextButton.icon(
                  onPressed: _isProcessing ? null : _handleCantScan,
                  icon: const Icon(Icons.photo_library_outlined, size: 20),
                  label: const Text("Can't scan? Upload image"),
                  style: TextButton.styleFrom(
                    foregroundColor: Theme.of(context).colorScheme.secondary,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 12,
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

/// Custom painter for scan overlay
class ScanOverlayPainter extends CustomPainter {
  final double scanAreaSize;
  final Color borderColor;

  ScanOverlayPainter({
    required this.scanAreaSize,
    required this.borderColor,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.black.withAlpha(128)
      ..style = PaintingStyle.fill;

    final scanRect = Rect.fromCenter(
      center: Offset(size.width / 2, size.height / 2),
      width: scanAreaSize,
      height: scanAreaSize,
    );

    // Draw dark overlay with cutout
    final path = Path()
      ..addRect(Rect.fromLTWH(0, 0, size.width, size.height))
      ..addRRect(RRect.fromRectAndRadius(scanRect, const Radius.circular(12)))
      ..fillType = PathFillType.evenOdd;

    canvas.drawPath(path, paint);

    // Draw corner indicators
    final cornerPaint = Paint()
      ..color = borderColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4
      ..strokeCap = StrokeCap.round;

    const cornerLength = 30.0;

    // Top-left
    canvas.drawLine(
      Offset(scanRect.left, scanRect.top + cornerLength),
      Offset(scanRect.left, scanRect.top),
      cornerPaint,
    );
    canvas.drawLine(
      Offset(scanRect.left, scanRect.top),
      Offset(scanRect.left + cornerLength, scanRect.top),
      cornerPaint,
    );

    // Top-right
    canvas.drawLine(
      Offset(scanRect.right - cornerLength, scanRect.top),
      Offset(scanRect.right, scanRect.top),
      cornerPaint,
    );
    canvas.drawLine(
      Offset(scanRect.right, scanRect.top),
      Offset(scanRect.right, scanRect.top + cornerLength),
      cornerPaint,
    );

    // Bottom-left
    canvas.drawLine(
      Offset(scanRect.left, scanRect.bottom - cornerLength),
      Offset(scanRect.left, scanRect.bottom),
      cornerPaint,
    );
    canvas.drawLine(
      Offset(scanRect.left, scanRect.bottom),
      Offset(scanRect.left + cornerLength, scanRect.bottom),
      cornerPaint,
    );

    // Bottom-right
    canvas.drawLine(
      Offset(scanRect.right - cornerLength, scanRect.bottom),
      Offset(scanRect.right, scanRect.bottom),
      cornerPaint,
    );
    canvas.drawLine(
      Offset(scanRect.right, scanRect.bottom),
      Offset(scanRect.right, scanRect.bottom - cornerLength),
      cornerPaint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
