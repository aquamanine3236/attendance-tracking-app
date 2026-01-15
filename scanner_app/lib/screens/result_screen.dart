/**
 * Result Screen - Display scan submission result
 */

import 'package:flutter/material.dart';
import '../models/scan_data.dart';

class ResultScreen extends StatelessWidget {
  final ScanResult result;

  const ResultScreen({super.key, required this.result});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(result.success ? 'Success' : 'Error'),
        automaticallyImplyLeading: false,
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Result Icon
                  Container(
                    width: 88,
                    height: 88,
                    decoration: BoxDecoration(
                      color: result.success
                          ? Colors.green.withOpacity(0.12)
                          : Colors.red.withOpacity(0.12),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      result.success ? Icons.check_circle : Icons.error,
                      size: 48,
                      color: result.success ? Colors.green : Colors.red,
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Title
                  Text(
                    result.success ? 'Scan Successful!' : 'Scan Failed',
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  const SizedBox(height: 8),

                  // Subtitle
                  Text(
                    result.success
                        ? 'Your attendance has been recorded'
                        : result.errorMessage ?? 'An error occurred',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.6),
                      fontSize: 15,
                    ),
                  ),
                  const SizedBox(height: 28),

                  // Details Card (only for success)
                  if (result.success)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: const Color(0xFF111A33),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFF1C2637)),
                      ),
                      child: Column(
                        children: [
                          if (result.companyName != null) ...[
                            _buildDetailRow(
                              context,
                              'Company',
                              result.companyName!,
                            ),
                            const SizedBox(height: 16),
                          ],
                          _buildDetailRow(
                            context,
                            'Name',
                            result.fullName,
                          ),
                          const SizedBox(height: 16),
                          _buildDetailRow(
                            context,
                            'Position',
                            result.jobTitle,
                          ),
                          const SizedBox(height: 16),
                          _buildDetailRow(
                            context,
                            'Employee ID',
                            result.employeeId,
                          ),
                          const SizedBox(height: 16),
                          _buildDetailRow(
                            context,
                            'Time',
                            _formatDateTime(result.createdAt),
                          ),
                          if (result.lat != null) ...[
                            const SizedBox(height: 16),
                            _buildDetailRow(
                              context,
                              'Location',
                              '${result.lat!.toStringAsFixed(5)}, ${result.lng?.toStringAsFixed(5) ?? ''}',
                            ),
                          ],
                        ],
                      ),
                    ),

                  const SizedBox(height: 32),

                  // Action Button
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton(
                      onPressed: () {
                        // Pop back to scanner
                        Navigator.of(context)
                            .popUntil((route) => route.isFirst);
                      },
                      child: Text(
                        result.success ? 'Done' : 'Try Again',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDetailRow(
    BuildContext context,
    String label,
    String value,
  ) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            color: Colors.white.withOpacity(0.5),
            fontSize: 14,
          ),
        ),
        const SizedBox(width: 16),
        Flexible(
          child: Text(
            value,
            style: const TextStyle(
              fontWeight: FontWeight.w500,
              fontSize: 14,
            ),
            textAlign: TextAlign.right,
          ),
        ),
      ],
    );
  }

  String _formatDateTime(String isoString) {
    try {
      final dt = DateTime.parse(isoString).toLocal();
      return '${dt.day}/${dt.month}/${dt.year} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return isoString;
    }
  }
}
