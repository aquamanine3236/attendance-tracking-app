// Stub file for non-web platforms
// This file provides empty implementations for platforms that don't support web APIs

/// Stub service - real implementation is in web_qr_scanner.dart
class WebQrScanner {
  /// Returns null on non-web platforms - not supported
  static Future<String?> pickAndScanImage() async {
    // Not supported on this platform
    return null;
  }
}
