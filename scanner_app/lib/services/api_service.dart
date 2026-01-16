/**
 * API Service for communicating with the Demo server
 * 
 * Adapted from Test/web-scanner API communication patterns.
 */

import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/scan_data.dart';

class ApiService {
  // Default API endpoints to try (production first, then local development)
  static const List<String> _defaultEndpoints = [
    'https://testchamcong.merlinle.com', // Production server
    'http://10.0.2.2:4000', // Android emulator localhost
    'http://localhost:4000', // iOS simulator / web
    'http://127.0.0.1:4000',
  ];

  String? _baseUrl;
  final String _userToken;

  ApiService({String? baseUrl, String userToken = 'demo-user-token'})
      : _baseUrl = baseUrl,
        _userToken = userToken;

  /// Get the current base URL
  String? get baseUrl => _baseUrl;

  /// Check if API is connected
  bool get isConnected => _baseUrl != null;

  /// Resolve a working API endpoint
  Future<bool> connect({String? explicitUrl}) async {
    final candidates = [
      if (explicitUrl != null) explicitUrl,
      ..._defaultEndpoints,
    ];

    for (final base in candidates) {
      try {
        final response = await http
            .get(Uri.parse('$base/health'))
            .timeout(const Duration(seconds: 3));

        if (response.statusCode == 200) {
          _baseUrl = base;
          print('API connected: $base');
          return true;
        }
      } catch (e) {
        print('Failed to connect to $base: $e');
      }
    }

    print('No reachable API found');
    return false;
  }

  /// Login with username and password
  /// Returns LoginResult with user data on success or error message on failure
  Future<LoginResult> login(String username, String password) async {
    if (_baseUrl == null) {
      return LoginResult.error('API not connected');
    }

    try {
      final response = await http
          .post(
            Uri.parse('$_baseUrl/auth/login'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'username': username,
              'password': password,
            }),
          )
          .timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success'] == true) {
          return LoginResult.success(
            fullName: data['user']['fullName'] ?? '',
            employeeId: data['user']['employeeId'] ?? '',
            jobTitle: data['user']['jobTitle'] ?? '',
            companyId: data['user']['company']?['id'],
            companyName: data['user']['company']?['name'],
            avatar: data['user']['avatar'],
            token: data['token'],
          );
        }
        return LoginResult.error(data['error'] ?? 'Login failed');
      } else {
        final data = jsonDecode(response.body);
        return LoginResult.error(data['error'] ?? 'Login failed');
      }
    } catch (e) {
      return LoginResult.error('Network error: ${e.toString()}');
    }
  }

  /// Submit a scan to the server
  Future<ScanResult> submitScan(ScanData scanData) async {
    if (_baseUrl == null) {
      return ScanResult.error('API not connected');
    }

    try {
      final response = await http
          .post(
            Uri.parse('$_baseUrl/scan'),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $_userToken',
            },
            body: jsonEncode(scanData.toJson()),
          )
          .timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return ScanResult.fromJson(data);
      } else {
        final error = _parseError(response);
        return ScanResult.error(error);
      }
    } catch (e) {
      return ScanResult.error('Network error: ${e.toString()}');
    }
  }

  /// Parse error message from response
  String _parseError(http.Response response) {
    try {
      final data = jsonDecode(response.body);
      final error = data['error'] ?? 'Unknown error';

      // Human-friendly error messages
      switch (error) {
        case 'expired_or_unknown_qr':
          return 'QR code has expired or is invalid. Please scan a new QR code.';
        case 'already_used':
          return 'This QR code has already been used. Please scan a new one.';
        case 'invalid_token':
          return 'Invalid QR code. Please scan a valid QR code.';
        case 'invalid_payload':
          return 'Please fill in all required fields.';
        case 'token_required':
          return 'No QR token provided.';
        default:
          return error;
      }
    } catch (_) {
      return 'Server error: ${response.statusCode}';
    }
  }

  /// Validate a QR token before showing the form
  Future<QrValidationResult> validateQrToken(String token) async {
    if (_baseUrl == null) {
      return QrValidationResult(valid: false, error: 'API not connected');
    }

    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/qr/validate?token=${Uri.encodeComponent(token)}'),
        headers: {
          'Authorization': 'Bearer $_userToken',
        },
      ).timeout(const Duration(seconds: 5));

      if (response.statusCode == 200) {
        return QrValidationResult(valid: true);
      } else {
        final error = _parseError(response);
        return QrValidationResult(valid: false, error: error);
      }
    } catch (e) {
      return QrValidationResult(
          valid: false, error: 'Network error: ${e.toString()}');
    }
  }
}

/// Result of QR token validation
class QrValidationResult {
  final bool valid;
  final String? error;

  QrValidationResult({required this.valid, this.error});
}

/// Result of login attempt
class LoginResult {
  final bool success;
  final String? error;
  final String? fullName;
  final String? employeeId;
  final String? jobTitle;
  final String? companyId;
  final String? companyName;
  final String? avatar;
  final String? token;

  LoginResult._({
    required this.success,
    this.error,
    this.fullName,
    this.employeeId,
    this.jobTitle,
    this.companyId,
    this.companyName,
    this.avatar,
    this.token,
  });

  factory LoginResult.success({
    required String fullName,
    required String employeeId,
    required String jobTitle,
    String? companyId,
    String? companyName,
    String? avatar,
    String? token,
  }) {
    return LoginResult._(
      success: true,
      fullName: fullName,
      employeeId: employeeId,
      jobTitle: jobTitle,
      companyId: companyId,
      companyName: companyName,
      avatar: avatar,
      token: token,
    );
  }

  factory LoginResult.error(String message) {
    return LoginResult._(success: false, error: message);
  }
}
