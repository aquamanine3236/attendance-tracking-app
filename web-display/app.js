/**
 * Enhanced QR Display
 * 
 * Features:
 * - Fixed location display with permanent QR codes
 * - Location name prominently displayed
 * - QR generation timestamp (no countdown/TTL)
 * - Smooth transition animation on QR update
 * - Auto-refresh on scan success
 * - Download QR functionality
 */

const params = new URLSearchParams(location.search);
const DISPLAY_TOKEN = params.get('token') || 'demo-display-token';
const displayId = params.get('displayId') || 'default-display';
const companyName = params.get('company') || 'ABC Corporation';
const locationName = params.get('location') || 'HCM Office';
let API;
let currentQrData = null;

function formatTime(dateLike) {
    const date = new Date(dateLike);
    const pad = (n) => n.toString().padStart(2, '0');
    // Force 24-hour clock regardless of browser locale
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// Set company/location name from URL params
document.getElementById('locationName').textContent = companyName;

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
// QR Display Functions
// ==========================================================================

async function fetchNewQr() {
    try {
        showLoading();
        const res = await fetch(`${API}/display/qr/current?displayId=${encodeURIComponent(displayId)}`, {
            headers: { 'Authorization': `Bearer ${DISPLAY_TOKEN}` }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setQr(data);
    } catch (err) {
        document.getElementById('status').textContent = `QR fetch failed: ${err.message}`;
        document.getElementById('generatedAt').textContent = '—';
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

    // Show generation timestamp (not expiry countdown)
    document.getElementById('generatedAt').textContent = formatTime(data.createdAt || Date.now());
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
    document.getElementById('status').textContent = `Scanned at ${formatTime(timestamp)}`;

    // Auto-request new QR after brief delay (since QR is consumed)
    // The new QR will be sent via WebSocket
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
// Download QR
// ==========================================================================

function downloadQr() {
    if (!currentQrData?.imageDataUrl) return;

    const link = document.createElement('a');
    link.href = currentQrData.imageDataUrl;

    // Create filename with location and timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const safeName = locationName.replace(/[^a-zA-Z0-9]/g, '_');
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
// Initialization
// ==========================================================================

(async () => {
    try {
        API = await resolveApi();

        // Fetch initial QR
        await fetchNewQr();

        // Initialize Socket.IO
        const socket = io(API, {
            query: { role: 'display', token: DISPLAY_TOKEN, displayId },
            transports: ['websocket'],
            reconnectionAttempts: 10,
        });

        socket.on('connect', () => {
            updateConnectionStatus(true);
        });

        socket.on('disconnect', () => {
            updateConnectionStatus(false);
        });

        socket.on('ready', fetchNewQr);

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
})();
