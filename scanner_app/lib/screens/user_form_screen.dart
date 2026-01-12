// User Form Screen - Collect user information before submitting scan

import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../models/scan_data.dart';
import '../services/api_service.dart';
import '../services/location_service.dart';
import 'result_screen.dart';

class UserFormScreen extends StatefulWidget {
  final String token;
  final ApiService apiService;

  const UserFormScreen({
    super.key,
    required this.token,
    required this.apiService,
  });

  @override
  State<UserFormScreen> createState() => _UserFormScreenState();
}

class _UserFormScreenState extends State<UserFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _fullNameController = TextEditingController();
  final _jobTitleController = TextEditingController();
  final _employeeIdController = TextEditingController();
  final _locationService = LocationService();
  final _imagePicker = ImagePicker();

  bool _isSubmitting = false;
  bool _isGettingLocation = false;
  LocationData? _location;
  String? _locationError;

  // Image attachment
  XFile? _selectedImage;
  String? _imageBase64;

  @override
  void initState() {
    super.initState();
    _getLocation();
  }

  @override
  void dispose() {
    _fullNameController.dispose();
    _jobTitleController.dispose();
    _employeeIdController.dispose();
    super.dispose();
  }

  Future<void> _getLocation() async {
    setState(() {
      _isGettingLocation = true;
      _locationError = null;
    });

    try {
      final location = await _locationService.getCurrentLocation();
      setState(() {
        _location = location;
        _isGettingLocation = false;
      });
    } catch (e) {
      setState(() {
        _locationError = 'Could not get location';
        _isGettingLocation = false;
      });
    }
  }

  // Pick image from gallery
  Future<void> _pickImageFromGallery() async {
    try {
      final XFile? image = await _imagePicker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 800,
        maxHeight: 800,
        imageQuality: 80,
      );
      if (image != null) {
        await _processImage(image);
      }
    } catch (e) {
      _showSnackBar('Failed to pick image: $e');
    }
  }

  // Capture image from camera
  Future<void> _captureImage() async {
    try {
      final XFile? image = await _imagePicker.pickImage(
        source: ImageSource.camera,
        maxWidth: 800,
        maxHeight: 800,
        imageQuality: 80,
      );
      if (image != null) {
        await _processImage(image);
      }
    } catch (e) {
      _showSnackBar('Failed to capture image: $e');
    }
  }

  // Process and convert image to base64
  Future<void> _processImage(XFile image) async {
    try {
      final bytes = await image.readAsBytes();
      final base64String = base64Encode(bytes);

      // Determine mime type
      String mimeType = 'image/jpeg';
      if (image.name.toLowerCase().endsWith('.png')) {
        mimeType = 'image/png';
      } else if (image.name.toLowerCase().endsWith('.gif')) {
        mimeType = 'image/gif';
      }

      setState(() {
        _selectedImage = image;
        _imageBase64 = 'data:$mimeType;base64,$base64String';
      });
    } catch (e) {
      _showSnackBar('Failed to process image: $e');
    }
  }

  // Remove selected image
  void _removeImage() {
    setState(() {
      _selectedImage = null;
      _imageBase64 = null;
    });
  }

  void _showSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  // Show image source selection dialog
  void _showImageSourceDialog() {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF111A33),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Add Photo',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),
              const SizedBox(height: 20),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E7BFF).withAlpha(30),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child:
                      const Icon(Icons.photo_library, color: Color(0xFF1E7BFF)),
                ),
                title: const Text('Choose from Gallery'),
                onTap: () {
                  Navigator.pop(context);
                  _pickImageFromGallery();
                },
              ),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFF22C55E).withAlpha(30),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.camera_alt, color: Color(0xFF22C55E)),
                ),
                title: const Text('Take a Photo'),
                onTap: () {
                  Navigator.pop(context);
                  _captureImage();
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _submitScan() async {
    if (!_formKey.currentState!.validate()) return;

    // Check if location is available (required)
    if (_location == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
              'Location is required. Please enable location services and try again.'),
          backgroundColor: Colors.red,
        ),
      );
      _getLocation(); // Try to get location again
      return;
    }

    setState(() => _isSubmitting = true);

    final scanData = ScanData(
      token: widget.token,
      fullName: _fullNameController.text.trim(),
      jobTitle: _jobTitleController.text.trim(),
      employeeId: _employeeIdController.text.trim(),
      lat: _location!.latitude,
      lng: _location!.longitude,
      accuracy: _location!.accuracy,
      imageData: _imageBase64, // Include image if attached
    );

    final result = await widget.apiService.submitScan(scanData);

    setState(() => _isSubmitting = false);

    if (mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (context) => ResultScreen(result: result),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Your Information'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // QR Token Info
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(
                              Icons.check_circle,
                              color: Colors.green,
                              size: 20,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'QR Code Scanned',
                              style: TextStyle(
                                color: Colors.green,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Token: ${widget.token.length > 20 ? widget.token.substring(0, 20) : widget.token}...',
                          style: TextStyle(
                            color: Colors.white.withAlpha(128),
                            fontSize: 12,
                            fontFamily: 'monospace',
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                // Form Fields
                Text(
                  'Enter Your Details',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                ),
                const SizedBox(height: 16),

                TextFormField(
                  controller: _fullNameController,
                  decoration: const InputDecoration(
                    labelText: 'Full Name',
                    prefixIcon: Icon(Icons.person_outline),
                  ),
                  textCapitalization: TextCapitalization.words,
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return 'Please enter your full name';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),

                TextFormField(
                  controller: _jobTitleController,
                  decoration: const InputDecoration(
                    labelText: 'Job Title / Position',
                    prefixIcon: Icon(Icons.work_outline),
                  ),
                  textCapitalization: TextCapitalization.words,
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return 'Please enter your job title';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),

                TextFormField(
                  controller: _employeeIdController,
                  decoration: const InputDecoration(
                    labelText: 'Employee ID',
                    prefixIcon: Icon(Icons.badge_outlined),
                  ),
                  textCapitalization: TextCapitalization.characters,
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return 'Please enter your employee ID';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 24),

                // Image Attachment Section
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(
                              Icons.photo_camera,
                              color: Theme.of(context).colorScheme.secondary,
                            ),
                            const SizedBox(width: 12),
                            Text(
                              'Photo (Optional)',
                              style: TextStyle(
                                color: Colors.white.withAlpha(179),
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        if (_selectedImage != null) ...[
                          // Image Preview
                          Stack(
                            children: [
                              ClipRRect(
                                borderRadius: BorderRadius.circular(12),
                                child: kIsWeb
                                    ? Image.network(
                                        _selectedImage!.path,
                                        height: 150,
                                        width: double.infinity,
                                        fit: BoxFit.cover,
                                      )
                                    : Image.file(
                                        File(_selectedImage!.path),
                                        height: 150,
                                        width: double.infinity,
                                        fit: BoxFit.cover,
                                      ),
                              ),
                              Positioned(
                                top: 8,
                                right: 8,
                                child: GestureDetector(
                                  onTap: _removeImage,
                                  child: Container(
                                    padding: const EdgeInsets.all(6),
                                    decoration: BoxDecoration(
                                      color: Colors.black54,
                                      borderRadius: BorderRadius.circular(20),
                                    ),
                                    child: const Icon(
                                      Icons.close,
                                      color: Colors.white,
                                      size: 18,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          TextButton.icon(
                            onPressed: _showImageSourceDialog,
                            icon: const Icon(Icons.refresh),
                            label: const Text('Change Photo'),
                          ),
                        ] else ...[
                          // Add Photo Button
                          OutlinedButton.icon(
                            onPressed: _showImageSourceDialog,
                            icon: const Icon(Icons.add_a_photo),
                            label: const Text('Add Photo'),
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 20,
                                vertical: 14,
                              ),
                              side: BorderSide(
                                color: Theme.of(context)
                                    .colorScheme
                                    .primary
                                    .withAlpha(128),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Location Status
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      children: [
                        Icon(
                          _location != null
                              ? Icons.location_on
                              : Icons.location_off,
                          color:
                              _location != null ? Colors.green : Colors.orange,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Location',
                                style: TextStyle(
                                  color: Colors.white.withAlpha(179),
                                  fontSize: 12,
                                ),
                              ),
                              const SizedBox(height: 2),
                              if (_isGettingLocation)
                                const Text('Getting location...')
                              else if (_location != null)
                                Text(
                                  '${_location!.latitude.toStringAsFixed(5)}, ${_location!.longitude.toStringAsFixed(5)}',
                                  style: const TextStyle(fontSize: 13),
                                )
                              else
                                Text(
                                  _locationError ?? 'Location not available',
                                  style: const TextStyle(
                                    color: Colors.orange,
                                    fontSize: 13,
                                  ),
                                ),
                            ],
                          ),
                        ),
                        if (!_isGettingLocation && _location == null)
                          IconButton(
                            icon: const Icon(Icons.refresh),
                            onPressed: _getLocation,
                          ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 32),

                // Submit Button
                SizedBox(
                  height: 56,
                  child: ElevatedButton(
                    onPressed: _isSubmitting ? null : _submitScan,
                    child: _isSubmitting
                        ? const SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text('Submit Scan'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
