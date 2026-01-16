// Data models for scan submission and results

/// Data model for scan submission
class ScanData {
  final String token;
  final String fullName;
  final String jobTitle;
  final String employeeId;
  final String type; // "check-in" or "check-out"
  final double? lat;
  final double? lng;
  final double? accuracy;
  final String? imageData;
  final List<String>?
      userCompanyIds; // User's allowed company IDs for validation

  ScanData({
    required this.token,
    required this.fullName,
    required this.jobTitle,
    required this.employeeId,
    required this.type,
    this.lat,
    this.lng,
    this.accuracy,
    this.imageData,
    this.userCompanyIds,
  });

  Map<String, dynamic> toJson() {
    return {
      'token': token,
      'fullName': fullName,
      'jobTitle': jobTitle,
      'employeeId': employeeId,
      'type': type,
      if (lat != null) 'lat': lat,
      if (lng != null) 'lng': lng,
      if (accuracy != null) 'accuracy': accuracy,
      if (imageData != null) 'imageData': imageData,
      if (userCompanyIds != null && userCompanyIds!.isNotEmpty)
        'userCompanyIds': userCompanyIds,
    };
  }
}

/// Data model for scan result from server
class ScanResult {
  final String id;
  final String displayId;
  final String? companyId;
  final String? companyName;
  final String fullName;
  final String jobTitle;
  final String employeeId;
  final String type; // "check-in" or "check-out"
  final double? lat;
  final double? lng;
  final String createdAt;
  final bool success;
  final String? errorMessage;

  ScanResult({
    required this.id,
    required this.displayId,
    this.companyId,
    this.companyName,
    required this.fullName,
    required this.jobTitle,
    required this.employeeId,
    required this.type,
    this.lat,
    this.lng,
    required this.createdAt,
    this.success = true,
    this.errorMessage,
  });

  factory ScanResult.fromJson(Map<String, dynamic> json) {
    return ScanResult(
      id: json['id'] ?? '',
      displayId: json['displayId'] ?? '',
      companyId: json['companyId'],
      companyName: json['companyName'],
      fullName: json['fullName'] ?? '',
      jobTitle: json['jobTitle'] ?? '',
      employeeId: json['employeeId'] ?? '',
      type: json['type'] ?? 'check-in',
      lat: json['lat']?.toDouble(),
      lng: json['lng']?.toDouble(),
      createdAt: json['createdAt'] ?? DateTime.now().toIso8601String(),
    );
  }

  factory ScanResult.error(String message) {
    return ScanResult(
      id: '',
      displayId: '',
      fullName: '',
      jobTitle: '',
      employeeId: '',
      type: '',
      createdAt: DateTime.now().toIso8601String(),
      success: false,
      errorMessage: message,
    );
  }
}
