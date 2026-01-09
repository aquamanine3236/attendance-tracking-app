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
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              const Spacer(),

              // Result Icon
              Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  color: result.success
                      ? Colors.green.withOpacity(0.1)
                      : Colors.red.withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  result.success ? Icons.check_circle : Icons.error,
                  size: 64,
                  color: result.success ? Colors.green : Colors.red,
                ),
              ),
              const SizedBox(height: 24),

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
                  color: Colors.white.withOpacity(0.7),
                  fontSize: 16,
                ),
              ),
              const SizedBox(height: 32),

              // Details Card (only for success)
              if (result.success)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      children: [
                        _buildDetailRow(
                          context,
                          Icons.person,
                          'Name',
                          result.fullName,
                        ),
                        const Divider(height: 24),
                        _buildDetailRow(
                          context,
                          Icons.work,
                          'Position',
                          result.jobTitle,
                        ),
                        const Divider(height: 24),
                        _buildDetailRow(
                          context,
                          Icons.badge,
                          'Employee ID',
                          result.employeeId,
                        ),
                        const Divider(height: 24),
                        _buildDetailRow(
                          context,
                          Icons.access_time,
                          'Time',
                          _formatDateTime(result.createdAt),
                        ),
                        if (result.lat != null) ...[
                          const Divider(height: 24),
                          _buildDetailRow(
                            context,
                            Icons.location_on,
                            'Location',
                            '${result.lat!.toStringAsFixed(5)}, ${result.lng?.toStringAsFixed(5) ?? ''}',
                          ),
                        ],
                      ],
                    ),
                  ),
                ),

              const Spacer(),

              // Action Buttons
              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: () {
                    // Pop back to scanner
                    Navigator.of(context).popUntil((route) => route.isFirst);
                  },
                  child: Text(
                    result.success ? 'Done' : 'Try Again',
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDetailRow(
    BuildContext context,
    IconData icon,
    String label,
    String value,
  ) {
    return Row(
      children: [
        Icon(
          icon,
          size: 20,
          color: Theme.of(context).colorScheme.secondary,
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: TextStyle(
                  color: Colors.white.withOpacity(0.5),
                  fontSize: 12,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: const TextStyle(
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
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
