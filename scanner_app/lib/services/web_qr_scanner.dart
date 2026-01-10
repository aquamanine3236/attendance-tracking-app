// Web QR Scanner Service - Decodes QR codes from images using jsQR
// This service only works on web platform

// ignore: avoid_web_libraries_in_flutter
import 'dart:html' as html;
import 'dart:async';
// ignore: avoid_web_libraries_in_flutter
import 'dart:js' as js;
import 'dart:typed_data';

/// Service to decode QR codes from images on web platform
class WebQrScanner {
  /// Pick an image from file input and decode QR code from it
  /// Returns the decoded QR code string, or null if no QR found
  static Future<String?> pickAndScanImage() async {
    final completer = Completer<String?>();

    // Create file input element
    final input = html.FileUploadInputElement()..accept = 'image/*';

    input.onChange.listen((event) async {
      final files = input.files;
      if (files == null || files.isEmpty) {
        completer.complete(null);
        return;
      }

      final file = files.first;
      final result = await _decodeQrFromFile(file);
      completer.complete(result);
    });

    // Handle cancel
    input.onAbort.listen((_) => completer.complete(null));

    // Trigger file picker
    input.click();

    return completer.future;
  }

  /// Decode QR code from a File object
  static Future<String?> _decodeQrFromFile(html.File file) async {
    final completer = Completer<String?>();

    final reader = html.FileReader();
    reader.readAsDataUrl(file);

    reader.onLoadEnd.listen((_) async {
      final dataUrl = reader.result as String?;
      if (dataUrl == null) {
        completer.complete(null);
        return;
      }

      // Create image element to get pixel data
      final img = html.ImageElement()..src = dataUrl;

      await img.onLoad.first;

      // Create canvas to extract image data
      final canvas = html.CanvasElement(
        width: img.naturalWidth,
        height: img.naturalHeight,
      );
      final ctx = canvas.context2D;
      ctx.drawImage(img, 0, 0);

      // Get image data
      final imageData = ctx.getImageData(
        0,
        0,
        canvas.width!,
        canvas.height!,
      );

      // Use jsQR to decode
      final result = _callJsQr(
        imageData.data,
        canvas.width!,
        canvas.height!,
      );

      completer.complete(result);
    });

    reader.onError.listen((_) => completer.complete(null));

    return completer.future;
  }

  /// Call the jsQR library to decode QR from image data
  static String? _callJsQr(Uint8ClampedList data, int width, int height) {
    try {
      // Check if jsQR is available
      if (!js.context.hasProperty('jsQR')) {
        print('jsQR library not loaded');
        return null;
      }

      // Call jsQR(imageData, width, height)
      final result = js.context.callMethod('jsQR', [
        js.JsObject.jsify(data.toList()),
        width,
        height,
      ]);

      if (result == null) return null;

      // Get the data property from result
      final qrData = result['data'];
      return qrData?.toString();
    } catch (e) {
      print('jsQR error: $e');
      return null;
    }
  }
}
