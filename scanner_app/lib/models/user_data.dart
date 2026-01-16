/// Company data model
class CompanyData {
  final String companyId;
  final String companyName;
  final String? logo;

  const CompanyData({
    required this.companyId,
    required this.companyName,
    this.logo,
  });

  factory CompanyData.fromJson(Map<String, dynamic> json) {
    return CompanyData(
      companyId: json['id'] ?? '',
      companyName: json['name'] ?? '',
      logo: json['logo'],
    );
  }
}

/// User data model passed after login
class UserData {
  final String fullName;
  final String employeeId;
  final String jobTitle;
  final String? avatar;
  final List<String> companyIds;
  final List<CompanyData> companies;

  const UserData({
    required this.fullName,
    required this.employeeId,
    required this.jobTitle,
    this.avatar,
    this.companyIds = const [],
    this.companies = const [],
  });

  /// Get the first company (for backward compatibility)
  CompanyData? get company => companies.isNotEmpty ? companies.first : null;
}
