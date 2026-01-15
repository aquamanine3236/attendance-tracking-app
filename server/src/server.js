/**
 * Demo QR Scanning & Tracking Server
 * 
 * Adapted from Test/server/src/server.js
 * 
 * Features:
 * - Express + Socket.IO for real-time communication
 * - JWT-signed QR tokens with TTL
 * - Role-based authentication (admin, display, user)
 * - PostgreSQL database for persistent storage
 * 
 * Events:
 * - qr:new - New QR code generated (sent to display)
 * - qr:consumed - QR code was scanned (sent to display)
 * - scan:logged - Scan data recorded (sent to admin)
 */

import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import http from 'http';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import path from 'path';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import * as XLSX from 'xlsx';
import db from './db.js';

// ES Module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================================
// Configuration
// =============================================================================

const PORT = process.env.PORT || 4000;
const QR_SECRET = process.env.QR_SECRET || 'demo-secret-key';
const QR_TTL_SECONDS = Number(process.env.QR_TTL_SECONDS || 60);
const ALLOW_MULTI_SCAN = process.env.ALLOW_MULTI_SCAN === 'true'; // Allow same QR to be scanned multiple times (for testing)

// Demo authentication tokens (replace with proper JWT verification in production)
const TOKEN_MAP = {
  admin: process.env.ADMIN_JWT || 'demo-admin-token',
  display: process.env.DISPLAY_JWT || 'demo-display-token',
  user: process.env.USER_JWT || 'demo-user-token',
};

// =============================================================================
// In-Memory Cache for QR Display (for real-time updates)
// =============================================================================

/** @type {Map<string, object>} displayId -> latest QR payload (cached for quick access) */
const latestQrByDisplay = new Map();

// =============================================================================
// Express + Socket.IO Setup
// =============================================================================

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['*'],
  },
});

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // Disable CSP for inline scripts in static files
}));

// CORS configuration - allow all origins for demo
const corsOptions = {
  origin: (origin, callback) => {
    // Allow null origin (file://), localhost, and any origin for demo
    callback(null, true);
  },
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '15mb' }));

// =============================================================================
// Static File Serving for Web Apps
// =============================================================================

// Serve web-display at /display
app.use('/display', express.static(path.join(__dirname, '../../web-display')));

// Serve web-admin at /admin
app.use('/admin', express.static(path.join(__dirname, '../../web-admin')));

// =============================================================================
// Authentication Middleware
// =============================================================================

/**
 * Require a specific role for route access
 * @param {string} role - Required role
 */
const requireRole = (role) => requireAnyRole([role]);

/**
 * Require any of the specified roles for route access
 * @param {string[]} roles - Allowed roles
 */
const requireAnyRole = (roles) => (req, res, next) => {
  const auth = req.headers.authorization || '';
  const headerToken = auth.replace('Bearer ', '');
  // Also check query parameter for browser downloads (window.open)
  const queryToken = req.query.token || '';
  const token = headerToken || queryToken;

  const matched = roles.find((r) => TOKEN_MAP[r] && token === TOKEN_MAP[r]);
  if (matched) {
    req.role = matched;
    return next();
  }
  return res.status(401).json({ error: 'unauthorized' });
};

// =============================================================================
// API Routes
// =============================================================================

// Health check endpoint
app.get('/health', async (_req, res) => {
  const dbHealth = await db.healthCheck();
  res.json({ ok: true, database: dbHealth });
});

// =============================================================================
// Authentication Endpoints
// =============================================================================

/**
 * Employee Login
 * POST /auth/login
 * Body: { username, password }
 * Returns employee data on success
 */
app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    // Find user by username
    const user = await db.users.findByUsername(username);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password (using plaintext for demo - use bcrypt in production)
    if (user.password_hash !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check role - only employees can login via scanner
    if (user.role !== 'employee') {
      return res.status(403).json({ error: 'Access denied. Employee account required.' });
    }

    // Get company info
    const company = user.company_id ? await db.companies.findById(user.company_id) : null;

    // Update last login
    await db.users.updateLastLogin(user.id);

    // Return user data
    res.json({
      success: true,
      user: {
        id: user.id,
        fullName: user.full_name,
        employeeId: user.employee_id,
        jobTitle: user.job_title || '',
        avatar: user.avatar || null,
        company: company ? {
          id: company.id,
          name: company.name,
        } : null,
      },
      token: TOKEN_MAP.user, // Use the demo token for now
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

/**
 * Admin Login
 * POST /auth/admin/login
 * Body: { username, password }
 * Returns admin data and token on success
 */
app.post('/auth/admin/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    // Find user by username
    const user = await db.users.findByUsername(username);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password (using plaintext for demo - use bcrypt in production)
    if (user.password_hash !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check role - only admins can login to admin dashboard
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin account required.' });
    }

    // Get company info
    const company = user.company_id ? await db.companies.findById(user.company_id) : null;

    // Update last login
    await db.users.updateLastLogin(user.id);

    // Return admin data
    res.json({
      success: true,
      user: {
        id: user.id,
        fullName: user.full_name,
        company: company ? {
          id: company.id,
          name: company.name,
        } : null,
      },
      token: TOKEN_MAP.admin,
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

/**
 * Generate a QR image for arbitrary text (utility endpoint)
 * GET /qr/image?text=<text>
 */
app.get('/qr/image', async (req, res) => {
  const text = req.query.text;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text query param required' });
  }
  try {
    const png = await generateQrImage(text);
    res.setHeader('Content-Type', 'image/png');
    res.send(png);
  } catch (err) {
    res.status(500).json({ error: 'qr_generation_failed' });
  }
});

/**
 * Get all companies
 * GET /api/companies
 * Accessible by admin and display roles
 */
app.get('/api/companies', requireAnyRole(['admin', 'display']), async (req, res) => {
  try {
    const companies = await db.companies.findAll();
    res.json({
      data: companies.map(c => ({
        id: c.id,
        name: c.name,
        employeeCount: c.employee_count || 0,
        logo: c.logo || c.name?.charAt(0)?.toUpperCase() || '?',
        location: c.location_label || '',
      })),
    });
  } catch (err) {
    console.error('Error fetching companies:', err);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

/**
 * Admin: Get all companies (legacy endpoint)
 * GET /admin/companies
 */
app.get('/admin/companies', requireRole('admin'), async (req, res) => {
  try {
    const companies = await db.companies.findAll();
    res.json({
      data: companies.map(c => ({
        id: c.id,
        name: c.name,
        employeeCount: c.employee_count || 0,
        logo: c.logo || c.name?.charAt(0)?.toUpperCase() || '?',
        location: c.location_label || '',
      })),
    });
  } catch (err) {
    console.error('Error fetching companies:', err);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

/**
 * Admin: Generate a new QR code for a display
 * POST /admin/qr
 * Body: { displayId: string }
 */
app.post('/admin/qr', requireRole('admin'), async (req, res) => {
  const displayId = req.body.displayId || 'default-display';
  const companyId = req.body.companyId || null;
  const qr = await generateQr(displayId, { issuedBy: 'admin', companyId });
  res.json(qr);
});

/**
 * Display: Get the current active QR code
 * GET /display/qr/current?displayId=<displayId>
 */
app.get('/display/qr/current', requireAnyRole(['display', 'admin']), async (req, res) => {
  const displayId = req.query.displayId || 'default-display';
  const companyId = req.query.companyId || null;

  // Check cache first
  const cached = latestQrByDisplay.get(displayId);
  if (cached) {
    return res.json(cached);
  }

  // Check database for active session
  const activeSession = await db.qrSessions.findActiveByDisplay(displayId);
  if (activeSession) {
    const buffer = await generateQrImage(activeSession.token);
    const imageDataUrl = `data:image/png;base64,${buffer.toString('base64')}`;
    const payload = {
      token: activeSession.token,
      expiresAt: activeSession.expires_at,
      imageDataUrl,
    };
    latestQrByDisplay.set(displayId, payload);
    return res.json(payload);
  }

  // Auto-generate initial QR if none exists
  const qr = await generateQr(displayId, { issuedBy: 'system', companyId });
  return res.json(qr);
});

/**
 * User: Validate a QR token before form submission
 * GET /qr/validate?token=<token>
 * Returns { valid: true } if token is valid, or { valid: false, error: string } if invalid
 */
app.get('/qr/validate', requireRole('user'), async (req, res) => {
  const token = req.query.token;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ valid: false, error: 'token_required' });
  }

  // Check if session exists in database
  const session = await db.qrSessions.findByToken(token);
  if (!session) {
    return res.status(400).json({ valid: false, error: 'expired_or_unknown_qr' });
  }

  // Check if already used
  if (session.status !== 'active' && !ALLOW_MULTI_SCAN) {
    return res.status(409).json({ valid: false, error: 'already_used' });
  }

  // Note: QR codes don't expire by time - only when used or replaced

  // Verify JWT signature
  try {
    jwt.verify(token, QR_SECRET);
  } catch (err) {
    return res.status(400).json({ valid: false, error: 'invalid_token' });
  }

  return res.json({ valid: true });
});

/**
 * User: Submit a scan
 * POST /scan
 * Body: { token, fullName, jobTitle, employeeId, lat, lng, accuracy, imageData? }
 */
app.post('/scan', requireRole('user'), async (req, res) => {
  // Validate request body
  const schema = z.object({
    token: z.string().min(8),
    fullName: z.string().trim().min(1),
    jobTitle: z.string().trim().min(1),
    employeeId: z.string().trim().min(1),
    type: z.enum(['check-in', 'check-out']),
    lat: z.number({ required_error: 'Location is required' }),
    lng: z.number({ required_error: 'Location is required' }),
    accuracy: z.number({ required_error: 'Location accuracy is required' }),
    imageData: z
      .string()
      .max(15_000_000, 'image too large')
      .refine((v) => v.startsWith('data:image/'), { message: 'imageData must be a data URL' })
      .optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
  }

  const { token, fullName, jobTitle, employeeId, type, lat, lng, accuracy, imageData } = parsed.data;

  // Validate QR session from database
  const session = await db.qrSessions.findByToken(token);
  if (!session) {
    return res.status(400).json({ error: 'expired_or_unknown_qr' });
  }
  if (session.status !== 'active' && !ALLOW_MULTI_SCAN) {
    return res.status(409).json({ error: 'already_used' });
  }

  // Note: QR codes don't expire by time - only when used or replaced

  // Verify JWT signature
  try {
    jwt.verify(token, QR_SECRET);
  } catch (err) {
    return res.status(400).json({ error: 'invalid_token' });
  }

  // Mark session as used in database
  await db.qrSessions.markUsed(token);

  // Get company name for snapshot
  const companyName = session.company_id
    ? await db.companies.getNameById(session.company_id)
    : 'Unknown Company';

  // Create scan record in database
  const scanId = nanoid();
  const scan = await db.scans.create({
    id: scanId,
    qrSessionId: session.id,
    displayId: session.display_id,
    companyId: session.company_id,
    userId: null, // User lookup could be added if needed
    fullNameSnapshot: fullName,
    jobTitleSnapshot: jobTitle,
    employeeIdSnapshot: employeeId,
    companyNameSnapshot: companyName,
    type,
    lat,
    lng,
    accuracy,
    image: imageData,
  });

  // Format response for client compatibility
  const scanResponse = {
    id: scan.id,
    qrSessionId: scan.qr_session_id,
    displayId: scan.display_id,
    companyId: scan.company_id,
    companyName: scan.company_name_snapshot,
    fullName: scan.full_name_snapshot,
    jobTitle: scan.job_title_snapshot,
    employeeId: scan.employee_id_snapshot,
    type: scan.type,
    lat: scan.lat,
    lng: scan.lng,
    accuracy: scan.accuracy,
    imageData: scan.image,
    createdAt: scan.created_at,
  };

  // Emit real-time events
  io.to(getDisplayRoom(session.display_id)).emit('qr:consumed', { token, at: scan.created_at });
  io.to('admin').emit('scan:logged', scanResponse);

  // Auto-generate next QR for the display (with same company)
  await generateQr(session.display_id, { companyId: session.company_id });

  return res.json(scanResponse);
});

/**
 * Admin: Get all scans with optional search
 * GET /admin/scans?search=<term>
 */
app.get('/admin/scans', requireRole('admin'), async (req, res) => {
  const { search, companyId } = req.query;

  const rows = await db.scans.findAll({
    companyId: companyId || null,
    search: search || null
  });

  // Format for client compatibility
  const data = rows.map((s) => ({
    id: s.id,
    qrSessionId: s.qr_session_id,
    displayId: s.display_id,
    companyId: s.company_id,
    companyName: s.company_name_snapshot,
    fullName: s.full_name_snapshot,
    jobTitle: s.job_title_snapshot,
    employeeId: s.employee_id_snapshot,
    type: s.type,
    lat: s.lat,
    lng: s.lng,
    accuracy: s.accuracy,
    imageData: s.image,
    createdAt: s.created_at,
  }));

  res.json({ data });
});

/**
 * Admin: Export scans as CSV
 * GET /admin/export.csv
 */
app.get('/admin/export.csv', requireRole('admin'), async (req, res) => {
  const rows = await db.scans.findAll({});

  const header = 'id,fullName,jobTitle,employeeId,lat,lng,accuracy,createdAt\n';
  const csvRows = rows
    .map((s) =>
      [
        s.id,
        s.full_name_snapshot,
        s.job_title_snapshot,
        s.employee_id_snapshot,
        s.lat ?? '',
        s.lng ?? '',
        s.accuracy ?? '',
        s.created_at,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    )
    .join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="scans.csv"');
  res.send(header + csvRows);
});

/**
 * Admin: Export scans as XLSX (Excel)
 * GET /admin/export.xlsx
 */
app.get('/admin/export.xlsx', requireRole('admin'), async (req, res) => {
  const rows = await db.scans.findAll({});

  // Helper function to format date in GMT+7
  const formatToGMT7 = (dateValue) => {
    const date = new Date(dateValue);
    // Add 7 hours to convert from UTC to GMT+7
    const gmt7Date = new Date(date.getTime() + (7 * 60 * 60 * 1000));
    const day = String(gmt7Date.getUTCDate()).padStart(2, '0');
    const month = String(gmt7Date.getUTCMonth() + 1).padStart(2, '0');
    const year = gmt7Date.getUTCFullYear();
    const hours = String(gmt7Date.getUTCHours()).padStart(2, '0');
    const minutes = String(gmt7Date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(gmt7Date.getUTCSeconds()).padStart(2, '0');
    return {
      date: `${day}/${month}/${year}`,
      time: `${hours}:${minutes}:${seconds}`
    };
  };

  // Prepare data for Excel
  const data = rows.map((s) => {
    const datetime = formatToGMT7(s.created_at);
    return {
      'ID': s.id,
      'Full Name': s.full_name_snapshot,
      'Job Title': s.job_title_snapshot,
      'Employee ID': s.employee_id_snapshot,
      'Type': s.type || '',
      'Latitude': s.lat ?? '',
      'Longitude': s.lng ?? '',
      'Accuracy': s.accuracy ?? '',
      'Date (GMT+7)': datetime.date,
      'Time (GMT+7)': datetime.time,
    };
  });

  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(data);

  // Set column widths for better readability
  worksheet['!cols'] = [
    { wch: 20 },  // ID
    { wch: 25 },  // Full Name
    { wch: 20 },  // Job Title
    { wch: 15 },  // Employee ID
    { wch: 12 },  // Type
    { wch: 12 },  // Latitude
    { wch: 12 },  // Longitude
    { wch: 10 },  // Accuracy
    { wch: 15 },  // Date (GMT+7)
    { wch: 12 },  // Time (GMT+7)
  ];

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Scans');

  // Generate buffer
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  // Generate filename with current date (dd-mm-yyyy format)
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const filename = `Attendance_${day}-${month}-${year}.xlsx`;

  // Send response
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
});

/**
 * Admin: Reset all scans (clear dashboard)
 * POST /admin/reset
 */
app.post('/admin/reset', requireRole('admin'), async (req, res) => {
  const { companyId } = req.body;

  // Reset in database
  await db.admin.resetDashboard(companyId);

  // Clear cache
  latestQrByDisplay.clear();

  console.log('Dashboard reset by admin');

  // Notify connected clients
  io.to('admin').emit('dashboard:reset');

  res.json({ ok: true, message: 'All scans cleared' });
});

// =============================================================================
// WebSocket Handling
// =============================================================================

io.on('connection', (socket) => {
  const { role, token, displayId } = socket.handshake.query;
  const bearer = Array.isArray(token) ? token[0] : token;
  const display = Array.isArray(displayId) ? displayId[0] : displayId || 'default-display';

  // Verify authentication
  if (!role || TOKEN_MAP[role] !== bearer) {
    socket.emit('error', 'unauthorized');
    return socket.disconnect(true);
  }

  // Join appropriate rooms based on role
  if (role === 'display') {
    socket.join(getDisplayRoom(display));
    console.log(`Display connected: ${display}`);
  }
  if (role === 'admin') {
    socket.join('admin');
    console.log('Admin connected');
  }
  if (role === 'user') {
    console.log('User (scanner) connected');
  }

  socket.emit('ready', { role, displayId: display });
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the Socket.IO room name for a display
 * @param {string} displayId 
 */
function getDisplayRoom(displayId) {
  return `display:${displayId}`;
}

/**
 * Generate a new QR code and broadcast to display
 * @param {string} displayId 
 * @param {object} options 
 */
async function generateQr(displayId, options = {}) {
  const id = nanoid();
  const exp = Date.now() + QR_TTL_SECONDS * 1000;

  // Create JWT token with session info
  const token = jwt.sign(
    { sid: id, n: uuidv4(), exp: Math.floor(exp / 1000) },
    QR_SECRET
  );

  // Ensure display exists (auto-create if needed)
  if (options.companyId) {
    await db.displays.findOrCreate({
      id: displayId,
      companyId: options.companyId,
      label: displayId
    });
  }

  // Create session record in database
  await db.qrSessions.create({
    id,
    token,
    displayId,
    companyId: options.companyId || null,
    expiresAt: exp,
    issuedBy: options.issuedBy || 'system',
  });

  // Generate QR image
  const buffer = await generateQrImage(token);
  const imageDataUrl = `data:image/png;base64,${buffer.toString('base64')}`;

  // Create payload for display
  const payload = {
    token,
    expiresAt: new Date(exp).toISOString(),
    imageDataUrl,
  };

  // Store in cache and broadcast
  latestQrByDisplay.set(displayId, payload);
  io.to(getDisplayRoom(displayId)).emit('qr:new', payload);

  console.log(`QR generated for display: ${displayId}, expires: ${payload.expiresAt}`);

  return payload;
}

/**
 * Generate QR code image buffer
 * @param {string} text - Text to encode
 */
async function generateQrImage(text) {
  return QRCode.toBuffer(text, {
    errorCorrectionLevel: 'M',
    type: 'png',
    margin: 2,
    scale: 8,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });
}

// =============================================================================
// Session Cleanup (expire stale sessions in database)
// =============================================================================

setInterval(async () => {
  try {
    const expired = await db.qrSessions.expireOldSessions();
    if (expired > 0) {
      console.log(`Expired ${expired} stale QR sessions`);
    }
  } catch (err) {
    console.error('Error expiring sessions:', err);
  }
}, 30000);

// =============================================================================
// Graceful Shutdown
// =============================================================================

process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await db.closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await db.closePool();
  process.exit(0);
});

// =============================================================================
// Start Server
// =============================================================================

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║         Demo QR Scanning & Tracking Server                    ║
║         (PostgreSQL Database Mode)                            ║
╠═══════════════════════════════════════════════════════════════╣
║  Server listening on port ${PORT}                                ║
║                                                               ║
║  Endpoints:                                                   ║
║    GET  /health              - Health check                   ║
║    POST /admin/qr            - Generate new QR (admin)        ║
║    GET  /display/qr/current  - Get current QR (display)       ║
║    POST /scan                - Submit scan (user)             ║
║    GET  /admin/scans         - List all scans (admin)         ║
║    GET  /admin/export.csv    - Export scans CSV (admin)       ║
║    GET  /admin/export.xlsx   - Export scans XLSX (admin)      ║
║                                                               ║
║  WebSocket Events:                                            ║
║    qr:new       - New QR generated                            ║
║    qr:consumed  - QR was scanned                              ║
║    scan:logged  - Scan data recorded                          ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});
