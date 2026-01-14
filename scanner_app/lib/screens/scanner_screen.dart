// Scanner Screen - Profile-based attendance with Check In/Out
//
// Features:
// - Profile section with avatar, name, employee ID
// - Greeting with job title
// - Check In and Check Out buttons (unified theme)
// - QR scanner opens with type parameter

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:image_picker/image_picker.dart';
import '../services/api_service.dart';
import '../services/location_service.dart';
import '../services/web_qr_scanner.dart'
    if (dart.library.io) '../services/web_qr_scanner_stub.dart';
import '../models/scan_data.dart';
import 'login_screen.dart';
import 'result_screen.dart';

class ScannerScreen extends StatefulWidget {
  final ApiService apiService;
  final UserData userData;

  const ScannerScreen({
    super.key,
    required this.apiService,
    required this.userData,
  });

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  final LocationService _locationService = LocationService();
  LocationData? _cachedLocation;
  bool _isLoadingLocation = true;
  String? _locationError;

  @override
  void initState() {
    super.initState();
    _fetchLocation();
  }

  Future<void> _fetchLocation() async {
    setState(() {
      _isLoadingLocation = true;
      _locationError = null;
    });

    try {
      final location = await _locationService.getCurrentLocation();
      if (mounted) {
        setState(() {
          _cachedLocation = location;
          _isLoadingLocation = false;
          if (location == null) {
            _locationError =
                'Could not get location. Please enable location services.';
          }
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoadingLocation = false;
          _locationError = 'Location access failed. Please try again.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    // Extract first name for greeting
    final firstName = widget.userData.fullName.split(' ').first;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Attendance'),
        automaticallyImplyLeading: false,
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () {
              Navigator.of(context).pushReplacement(
                MaterialPageRoute(builder: (context) => const LoginScreen()),
              );
            },
            tooltip: 'Logout',
          ),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Profile Row
                  Row(
                    children: [
                      // Avatar
                      Container(
                        width: 52,
                        height: 52,
                        decoration: BoxDecoration(
                          color: Theme.of(context)
                              .colorScheme
                              .primary
                              .withAlpha(40),
                          shape: BoxShape.circle,
                        ),
                        child: Center(
                          child: Text(
                            firstName[0].toUpperCase(),
                            style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.bold,
                              color: Theme.of(context).colorScheme.primary,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 14),
                      // Name and Employee ID
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.userData.fullName,
                            style: const TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Employee ID: ${widget.userData.employeeId}',
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.secondary,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),

                  // Greeting Section
                  Text(
                    'Hi, $firstName.',
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    widget.userData.jobTitle,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.secondary,
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 28),

                  // Location status
                  if (_isLoadingLocation)
                    Row(
                      children: [
                        SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Theme.of(context).colorScheme.secondary,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Text(
                          'Getting your location...',
                          style: TextStyle(
                            color: Colors.white.withOpacity(0.6),
                            fontSize: 13,
                          ),
                        ),
                      ],
                    )
                  else if (_locationError != null)
                    InkWell(
                      onTap: _fetchLocation,
                      child: Row(
                        children: [
                          const Icon(Icons.warning_amber_rounded,
                              size: 18, color: Colors.orange),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              '$_locationError Tap to retry.',
                              style: const TextStyle(
                                  color: Colors.orange, fontSize: 13),
                            ),
                          ),
                        ],
                      ),
                    )
                  else
                    Row(
                      children: [
                        Icon(
                          Icons.location_on,
                          size: 16,
                          color: Theme.of(context).colorScheme.secondary,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          'Location ready',
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.secondary,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  const SizedBox(height: 28),

                  // Action Buttons - List style with chevrons
                  _buildActionTile(
                    context,
                    'Check In',
                    _cachedLocation != null
                        ? () => _openScanner('check-in')
                        : null,
                  ),
                  const SizedBox(height: 12),
                  _buildActionTile(
                    context,
                    'Check Out',
                    _cachedLocation != null
                        ? () => _openScanner('check-out')
                        : null,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildActionTile(
      BuildContext context, String title, VoidCallback? onTap) {
    final isDisabled = onTap == null;
    return Material(
      color: const Color(0xFF111A33),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Opacity(
          opacity: isDisabled ? 0.5 : 1.0,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
            decoration: BoxDecoration(
              border: Border.all(color: const Color(0xFF1C2637)),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                Icon(
                  Icons.chevron_right,
                  color: Theme.of(context).colorScheme.primary,
                  size: 22,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _openScanner(String type) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => QrScannerView(
          apiService: widget.apiService,
          userData: widget.userData,
          scanType: type,
          cachedLocation: _cachedLocation!,
        ),
      ),
    );
  }
}

/// QR Scanner View - Camera scanning with processing
class QrScannerView extends StatefulWidget {
  final ApiService apiService;
  final UserData userData;
  final String scanType;
  final LocationData cachedLocation;

  const QrScannerView({
    super.key,
    required this.apiService,
    required this.userData,
    required this.scanType,
    required this.cachedLocation,
  });

  @override
  State<QrScannerView> createState() => _QrScannerViewState();
}

class _QrScannerViewState extends State<QrScannerView> {
  final MobileScannerController _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.normal,
    facing: CameraFacing.back,
    torchEnabled: false,
  );
  final ImagePicker _imagePicker = ImagePicker();

  bool _isProcessing = false;
  String? _lastScannedCode;

  @override
  void dispose() {
    _controller.dispose();
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

        _controller.stop();
        _processQrCode(code);
        break;
      }
    }
  }

  Future<void> _processQrCode(String token) async {
    // Validate QR before submitting
    final validation = await widget.apiService.validateQrToken(token);

    if (!validation.valid) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(validation.error ?? 'Invalid QR code'),
            backgroundColor: Colors.red,
          ),
        );
        setState(() {
          _isProcessing = false;
          _lastScannedCode = null;
        });
        _controller.start();
      }
      return;
    }

    // Use cached location
    final location = widget.cachedLocation;

    // Submit scan with user data and type
    final scanData = ScanData(
      token: token,
      fullName: widget.userData.fullName,
      jobTitle: widget.userData.jobTitle,
      employeeId: widget.userData.employeeId,
      type: widget.scanType,
      lat: location.latitude,
      lng: location.longitude,
      accuracy: location.accuracy,
    );

    final result = await widget.apiService.submitScan(scanData);

    if (mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (context) => ResultScreen(result: result),
        ),
      );
    }
  }

  Future<void> _toggleFlash() async {
    await _controller.toggleTorch();
    setState(() {});
  }

  Future<void> _switchCamera() async {
    await _controller.switchCamera();
    setState(() {});
  }

  void _handleCantScan() {
    if (kIsWeb) {
      _pickAndScanImageWeb();
    } else {
      _pickAndScanImage();
    }
  }

  Future<void> _pickAndScanImageWeb() async {
    setState(() => _isProcessing = true);

    try {
      final String? token = await WebQrScanner.pickAndScanImage();

      if (token != null && token.isNotEmpty) {
        _controller.stop();
        _processQrCode(token);
        return;
      }

      setState(() => _isProcessing = false);
      if (mounted && token != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('No QR code found in the image.'),
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

  Future<void> _pickAndScanImage() async {
    try {
      final XFile? image = await _imagePicker.pickImage(
        source: ImageSource.gallery,
      );

      if (image == null) return;

      setState(() => _isProcessing = true);

      final BarcodeCapture? result = await _controller.analyzeImage(image.path);

      if (result != null && result.barcodes.isNotEmpty) {
        final String? code = result.barcodes.first.rawValue;
        if (code != null && code.isNotEmpty) {
          _controller.stop();
          _processQrCode(code);
          return;
        }
      }

      setState(() => _isProcessing = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('No QR code found in the image.'),
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
    final isCheckIn = widget.scanType == 'check-in';

    return Scaffold(
      appBar: AppBar(
        title: Text(isCheckIn ? 'Check In' : 'Check Out'),
        actions: [
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
          // Type indicator
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 12),
            color: Theme.of(context).colorScheme.primary.withAlpha(30),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  isCheckIn ? Icons.login : Icons.logout,
                  size: 20,
                  color: Theme.of(context).colorScheme.primary,
                ),
                const SizedBox(width: 8),
                Text(
                  isCheckIn
                      ? 'Scanning for Check In'
                      : 'Scanning for Check Out',
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.primary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),

          // Scanner View
          Expanded(
            flex: 4,
            child: Stack(
              alignment: Alignment.center,
              children: [
                MobileScanner(
                  controller: _controller,
                  onDetect: _onDetect,
                ),
                CustomPaint(
                  painter: ScanOverlayPainter(
                    scanAreaSize: scanArea,
                    borderColor: Theme.of(context).colorScheme.primary,
                  ),
                  child: Container(),
                ),
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

          // Instructions
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

    final path = Path()
      ..addRect(Rect.fromLTWH(0, 0, size.width, size.height))
      ..addRRect(RRect.fromRectAndRadius(scanRect, const Radius.circular(12)))
      ..fillType = PathFillType.evenOdd;

    canvas.drawPath(path, paint);

    final cornerPaint = Paint()
      ..color = borderColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4
      ..strokeCap = StrokeCap.round;

    const cornerLength = 30.0;

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
