/// Company Service for fetching company data
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/user_data.dart';

class CompanyService {
  final String _baseUrl;
  final String _userToken;

  CompanyService(
      {required String baseUrl, String userToken = 'demo-user-token'})
      : _baseUrl = baseUrl,
        _userToken = userToken;

  /// Fetch companies by IDs
  Future<List<CompanyData>> fetchCompanies(List<String> companyIds) async {
    if (companyIds.isEmpty) {
      return [];
    }

    try {
      final idsParam = companyIds.join(',');
      final response = await http.get(
        Uri.parse('$_baseUrl/api/companies?companyIds=$idsParam'),
        headers: {
          'Authorization': 'Bearer $_userToken',
        },
      ).timeout(const Duration(seconds: 5));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final List<dynamic> companiesData = data['data'] ?? [];
        return companiesData
            .map((c) => CompanyData.fromJson(c as Map<String, dynamic>))
            .toList();
      }
      return [];
    } catch (e) {
      print('Failed to fetch companies: $e');
      return [];
    }
  }
}
