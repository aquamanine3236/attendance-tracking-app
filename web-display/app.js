/**
 * Enhanced QR Display
 * 
 * Features:
 * - Company selection from database (shows ALL companies)
 * - Fixed location display with permanent QR codes
 * - Location name prominently displayed
 * - QR generation timestamp (no countdown/TTL)
 * - Smooth transition animation on QR update
 * - Auto-refresh on scan success
 * - Download QR functionality
 */

const params = new URLSearchParams(location.search);
const DISPLAY_TOKEN = params.get('token') || 'demo-display-token';
let API;
let currentQrData = null;
let companies = [];
let selectedCompanyId = null;
let selectedCompanyName = null;
let displayId = null;

// ==========================================================================
// API Resolution
// ==========================================================================

async function resolveApi() {
    const explicit = params.get('api');
    const origin = location.origin && location.origin.startsWith('http') ? location.origin : null;
    const candidates = [explicit, origin, 'http://localhost:4000', 'http://127.0.0.1:4000']
        .filter(Boolean)
        .filter((v, i, arr) => arr.indexOf(v) === i);

    for (const base of candidates) {
        try {
            const res = await fetch(`${base}/health`, { mode: 'cors' });
            if (res.ok) return base;
        } catch (_err) { }
    }
    throw new Error('No reachable API (tried ' + candidates.join(', ') + ')');
}

// ==========================================================================
// View Management
// ==========================================================================

function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

// ==========================================================================
// Company Selection
// ==========================================================================

async function loadCompanies() {
    const grid = document.getElementById('companyGrid');
    if (!grid) return;

    grid.innerHTML = '<div class="loading-state">Loading companies...</div>';

    try {
        if (!API) {
            API = await resolveApi();
        }

        // Display shows ALL companies (no filter)
        const res = await fetch(`${API}/api/companies`, {
            headers: { Authorization: `Bearer ${DISPLAY_TOKEN}` }
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        companies = data.data || [];
        renderCompanyGrid();
    } catch (err) {
        console.error('Failed to load companies:', err);
        grid.innerHTML = '<div class="empty-state">Failed to load companies. Please refresh.</div>';
    }
}

function renderCompanyGrid() {
    const grid = document.getElementById('companyGrid');
    if (!grid) return;

    if (companies.length === 0) {
        grid.innerHTML = '<div class="empty-state">No companies found.</div>';
        return;
    }

    grid.innerHTML = companies.map(company => `
    <div class="company-card" onclick="selectCompany('${company.id}', '${company.name.replace(/'/g, "\\'")}')">
      <div class="company-logo">${company.logo && company.logo.startsWith('http') ? `<img src="${company.logo}" alt="${company.name} logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" /><span class="logo-fallback" style="display:none;">${company.name?.charAt(0) || '?'}</span>` : company.name?.charAt(0) || '?'}</div>
      <div class="company-name">${company.name}</div>
      <div class="company-info">${company.employeeCount || 0} employees</div>
    </div>
  `).join('');
}

function selectCompany(id, name) {
    selectedCompanyId = id;
    selectedCompanyName = name;
    displayId = `display-${id}`;

    document.getElementById('locationName').textContent = name;
    showView('qrView');
    initQrDisplay();
}

function goBackToCompanySelection() {
    // Disconnect socket if connected
    if (window.displaySocket) {
        window.displaySocket.disconnect();
        window.displaySocket = null;
    }
    showView('companyView');
    loadCompanies();
}

// ==========================================================================
// QR Display Functions
// ==========================================================================

async function fetchNewQr() {
    try {
        showLoading();
        const res = await fetch(`${API}/display/qr/current?displayId=${encodeURIComponent(displayId)}&companyId=${encodeURIComponent(selectedCompanyId)}`, {
            headers: { 'Authorization': `Bearer ${DISPLAY_TOKEN}` }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setQr(data);
    } catch (err) {
        document.getElementById('status').textContent = `QR fetch failed: ${err.message}`;
        hideLoading();
    }
}

function setQr(data, animate = false) {
    currentQrData = data;

    const qrImg = document.getElementById('qr');
    const qrContainer = document.getElementById('qrContainer');
    const spinner = document.getElementById('spinner');
    const downloadBtn = document.getElementById('downloadBtn');
    const overlay = document.getElementById('qrOverlay');

    // Hide overlay and spinner
    overlay.classList.remove('visible');
    spinner.style.display = 'none';

    // Animate if requested
    if (animate) {
        qrContainer.classList.add('qr-updating');
        setTimeout(() => qrContainer.classList.remove('qr-updating'), 500);
    }

    // Show QR
    qrImg.src = data.imageDataUrl;
    qrImg.style.display = 'block';
    downloadBtn.style.display = 'flex';

    document.getElementById('status').textContent = 'Awaiting scan...';
}

function showLoading() {
    document.getElementById('spinner').style.display = 'flex';
    document.getElementById('qr').style.display = 'none';
    document.getElementById('downloadBtn').style.display = 'none';
}

function hideLoading() {
    document.getElementById('spinner').style.display = 'none';
}

function showScannedFeedback(timestamp) {
    const overlay = document.getElementById('qrOverlay');
    overlay.classList.add('visible');
    document.getElementById('status').textContent = `Scanned at ${new Date(timestamp).toLocaleTimeString()}`;
}

function updateConnectionStatus(connected) {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('connectionText');

    if (connected) {
        dot.classList.add('connected');
        text.textContent = 'Connected';
    } else {
        dot.classList.remove('connected');
        text.textContent = 'Disconnected';
    }
}

// ==========================================================================
// QR Display Initialization (after company selection)
// ==========================================================================

async function initQrDisplay() {
    try {
        // Fetch initial QR
        await fetchNewQr();

        // Initialize Socket.IO
        const socket = io(API, {
            query: { role: 'display', token: DISPLAY_TOKEN, displayId },
            transports: ['websocket'],
            reconnectionAttempts: 10,
        });

        window.displaySocket = socket;

        socket.on('connect', () => {
            updateConnectionStatus(true);
        });

        socket.on('disconnect', () => {
            updateConnectionStatus(false);
        });

        socket.on('ready', () => {
            console.log('Socket ready, display connected');
        });

        // Listen for new QR (with smooth transition)
        socket.on('qr:new', (data) => {
            console.log('New QR received');
            setQr(data, true); // animate = true
        });

        // Listen for QR consumed
        socket.on('qr:consumed', ({ at }) => {
            showScannedFeedback(at);
        });

        socket.on('connect_error', (err) => {
            updateConnectionStatus(false);
            document.getElementById('status').textContent = `Socket error: ${err.message}`;
            console.error(err);
        });

    } catch (err) {
        document.getElementById('status').textContent = err.message;
        hideLoading();
        updateConnectionStatus(false);
    }
}

// ==========================================================================
// Download QR
// ==========================================================================

function downloadQr() {
    if (!currentQrData?.imageDataUrl) return;

    const link = document.createElement('a');
    link.href = currentQrData.imageDataUrl;

    // Create filename with location and timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const safeName = (selectedCompanyName || 'qr').replace(/[^a-zA-Z0-9]/g, '_');
    link.download = `qr-${safeName}-${timestamp}.png`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==========================================================================
// Fullscreen
// ==========================================================================

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => { });
    } else {
        document.exitFullscreen().catch(() => { });
    }
}

// ==========================================================================
// Event Handlers
// ==========================================================================

document.getElementById('downloadBtn').addEventListener('click', downloadQr);
document.getElementById('refreshBtn').addEventListener('click', fetchNewQr);
document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);

// ==========================================================================
// Initialization - Load companies on page load
// ==========================================================================

(async () => {
    try {
        API = await resolveApi();
        await loadCompanies();
    } catch (err) {
        const grid = document.getElementById('companyGrid');
        if (grid) {
            grid.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
        }
    }
})();
