/**
 * Enhanced Admin Dashboard
 * 
 * Features:
 * - Company selection with multi-company support
 * - Real-time scan updates via Socket.IO
 * - Date and type filters
 * - Stats cards (check-ins, check-outs, absent)
 * - Location manager
 * - Export dialog with options
 */

// ==========================================================================
// Company Context Management
// ==========================================================================

const CompanyContext = {
    get companyId() {
        return sessionStorage.getItem('selectedCompanyId');
    },

    set companyId(id) {
        sessionStorage.setItem('selectedCompanyId', id);
    },

    get companyName() {
        return sessionStorage.getItem('selectedCompanyName');
    },

    set companyName(name) {
        sessionStorage.setItem('selectedCompanyName', name);
    },

    clear() {
        sessionStorage.removeItem('selectedCompanyId');
        sessionStorage.removeItem('selectedCompanyName');
    },

    isSelected() {
        return !!this.companyId;
    }
};

// ==========================================================================
// Mock Data
// ==========================================================================

const MOCK_COMPANIES = [
    { id: 'company-1', name: 'ABC Corporation', employeeCount: 150, logo: 'A', location: 'HCM Office' },
    { id: 'company-2', name: 'XYZ Tech', employeeCount: 85, logo: 'X', location: 'Hanoi Office' },
    { id: 'company-3', name: 'Global Solutions', employeeCount: 200, logo: 'G', location: 'Da Nang Office' },
];

// ==========================================================================
// State
// ==========================================================================

const params = new URLSearchParams(location.search);
const ADMIN_TOKEN = params.get('token') || 'demo-admin-token';
let API;
let scans = [];
let filteredScans = [];
let socket = null;

function formatTime(dateLike) {
    return new Date(dateLike).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
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

function renderCompanyGrid() {
    console.log('renderCompanyGrid called, MOCK_COMPANIES:', MOCK_COMPANIES);
    const grid = document.getElementById('companyGrid');
    console.log('grid element:', grid);
    if (!grid) {
        console.error('companyGrid element not found!');
        return;
    }
    grid.innerHTML = MOCK_COMPANIES.map(company => `
    <div class="company-card" onclick="selectCompany('${company.id}', '${company.name}')">
      <div class="company-logo">${company.logo}</div>
      <div class="company-name">${company.name}</div>
      <div class="company-info">${company.employeeCount} employees</div>
    </div>
  `).join('');
    console.log('Grid innerHTML set, length:', grid.innerHTML.length);
}

function selectCompany(id, name) {
    CompanyContext.companyId = id;
    CompanyContext.companyName = name;
    document.getElementById('currentCompanyName').textContent = name;
    showView('dashboardView');
    initDashboard();
}

const companySwitcherEl = document.getElementById('companySwitcher');
if (companySwitcherEl) {
    companySwitcherEl.addEventListener('click', () => {
        showView('companyView');
    });
}

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
// Dashboard Initialization
// ==========================================================================

async function initDashboard() {
    try {
        API = await resolveApi();
        document.getElementById('qrStatus').textContent = `✅ Connected to API: ${API}`;

        // Set today's date in date picker
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('datePicker').value = today;

        // Initialize Socket.IO
        socket = io(API, {
            query: { role: 'admin', token: ADMIN_TOKEN },
            transports: ['websocket'],
            reconnectionAttempts: 10,
        });

        socket.on('connect', () => {
            updateConnectionStatus(true);
        });

        socket.on('disconnect', () => {
            updateConnectionStatus(false);
        });

        socket.on('ready', loadInitial);

        socket.on('scan:logged', (scan) => {
            // Only add scan if it matches the current company
            if (scan.companyId === CompanyContext.companyId) {
                scan._isNew = true;
                scans = [scan, ...scans];
                applyFilters();
                document.getElementById('qrStatus').textContent =
                    `🔔 New scan: ${scan.fullName} at ${new Date(scan.createdAt).toLocaleTimeString()}`;
            }
        });

        socket.on('connect_error', (err) => {
            updateConnectionStatus(false);
            document.getElementById('qrStatus').textContent = `Socket error: ${err.message}`;
        });

        await loadInitial();

    } catch (err) {
        document.getElementById('qrStatus').textContent = err.message;
        updateConnectionStatus(false);
    }
}

// ==========================================================================
// Data Loading
// ==========================================================================

async function loadInitial() {
    try {
        // Filter by company when loading scans
        const companyId = CompanyContext.companyId;
        let url = `${API}/admin/scans`;
        if (companyId) {
            url += `?companyId=${encodeURIComponent(companyId)}`;
        }
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${ADMIN_TOKEN}` }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        scans = data.data || [];
        applyFilters();
    } catch (err) {
        // Keep empty when API is not available
        scans = [];
        applyFilters();
        document.getElementById('qrStatus').textContent = `Waiting for scans...`;
    }
}

// ==========================================================================
// Filtering
// ==========================================================================

function applyFilters() {
    const selectedDate = document.getElementById('datePicker').value;
    const selectedType = document.getElementById('typeFilter').value;
    const searchTerm = document.getElementById('search').value.toLowerCase();

    filteredScans = scans.filter(s => {
        // Date filter
        if (selectedDate) {
            const scanDate = new Date(s.createdAt).toISOString().split('T')[0];
            if (scanDate !== selectedDate) return false;
        }

        // Type filter
        if (selectedType !== 'all' && s.type !== selectedType) return false;

        // Search filter
        if (searchTerm) {
            const matchesSearch =
                s.fullName.toLowerCase().includes(searchTerm) ||
                s.jobTitle.toLowerCase().includes(searchTerm) ||
                s.employeeId.toLowerCase().includes(searchTerm);
            if (!matchesSearch) return false;
        }

        return true;
    });

    render(filteredScans);
    updateStats(filteredScans, selectedType);
}

// Filter event listeners (only attach if elements exist)
const datePickerEl = document.getElementById('datePicker');
const typeFilterEl = document.getElementById('typeFilter');
const searchEl = document.getElementById('search');

if (datePickerEl) datePickerEl.addEventListener('change', applyFilters);
if (typeFilterEl) typeFilterEl.addEventListener('change', applyFilters);
if (searchEl) searchEl.addEventListener('input', applyFilters);

// ==========================================================================
// Rendering
// ==========================================================================

function render(list) {
    const tbody = document.getElementById('rows');

    if (list.length === 0) {
        tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <div class="empty-state-icon">📡</div>
          <div>No scans found</div>
        </td>
      </tr>
    `;
        return;
    }

    tbody.innerHTML = '';
    list.forEach((s, index) => {
        const tr = document.createElement('tr');
        tr.className = 'row';
        if (index === 0 && s._isNew) {
            tr.classList.add('new-scan');
            delete s._isNew;
        }

        const locationStr = s.lat
            ? `${s.lat.toFixed(4)}, ${s.lng?.toFixed(4) ?? ''}`
            : '—';

        const typeBadgeClass = s.type === 'check-in' ? 'check-in' : 'check-out';
        const typeBadgeText = s.type === 'check-in' ? 'Check In' : 'Check Out';

        tr.innerHTML = `
      <td>${new Date(s.createdAt).toLocaleTimeString()}</td>
      <td><strong>${escapeHtml(s.fullName)}</strong></td>
      <td>${escapeHtml(s.employeeId)}</td>
      <td>${escapeHtml(s.jobTitle)}</td>
      <td>${locationStr}</td>
      <td><span class="type-badge ${typeBadgeClass}">${typeBadgeText}</span></td>
      <td>${s.imageData ? `<button class="photo-btn secondary" data-id="${s.id}">View</button>` : '—'}</td>
    `;
        tbody.appendChild(tr);
    });

    // Attach photo button handlers
    document.querySelectorAll('.photo-btn').forEach(btn => {
        btn.onclick = () => {
            const id = btn.getAttribute('data-id');
            const scan = scans.find(x => x.id === id);
            if (scan?.imageData) showPhoto(scan);
        };
    });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

function updateStats(list = filteredScans, selectedType = document.getElementById('typeFilter')?.value || 'all') {
    // Count from the filtered list (which already has type filter applied)
    const checkIns = list.filter(s => s.type === 'check-in').length;
    const checkOuts = list.filter(s => s.type === 'check-out').length;

    // Stats show what's actually visible in the table
    document.getElementById('checkInCount').textContent = checkIns;
    document.getElementById('checkOutCount').textContent = checkOuts;
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
// Export Dialog
// ==========================================================================

function openExportDialog() {
    document.getElementById('exportDialog').classList.add('active');
}

function closeExportDialog() {
    const el = document.getElementById('exportDialog');
    if (el) el.classList.remove('active');
}

const exportBtnEl = document.getElementById('exportBtn');
if (exportBtnEl) exportBtnEl.addEventListener('click', openExportDialog);

const exportFormEl = document.getElementById('exportForm');
if (exportFormEl) {
    exportFormEl.addEventListener('submit', (e) => {
        e.preventDefault();
        const exportType = document.querySelector('input[name="exportType"]:checked').value;

        // Build export URL with type filter
        let url = `${API}/admin/export.xlsx?token=${ADMIN_TOKEN}`;
        if (exportType !== 'all') {
            url += `&type=${exportType}`;
        }

        window.open(url, '_blank');
        closeExportDialog();
    });
}

// ==========================================================================
// Photo Modal
// ==========================================================================

function showPhoto(scan) {
    document.getElementById('photoFull').src = scan.imageData;
    document.getElementById('photoTitle').textContent = `Photo — ${scan.fullName} (${scan.employeeId})`;
    document.getElementById('photoModal').classList.add('active');
}

function closePhotoModal() {
    const el = document.getElementById('photoModal');
    if (el) el.classList.remove('active');
}

// ==========================================================================
// QR Generation
// ==========================================================================

const newQrEl = document.getElementById('newQr');
if (newQrEl) {
    newQrEl.addEventListener('click', async () => {
        // Use company-specific displayId for isolation
        const displayId = `display-${CompanyContext.companyId}`;
        const companyId = CompanyContext.companyId;
        document.getElementById('qrStatus').textContent = '⏳ Requesting new QR...';

        try {
            const res = await fetch(`${API}/admin/qr`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${ADMIN_TOKEN}`,
                },
                body: JSON.stringify({ displayId, companyId }),
            });
            if (!res.ok) throw new Error('Failed to generate QR');
            const data = await res.json();
            document.getElementById('qrStatus').textContent =
                `✅ New QR generated!`;
        } catch (err) {
            document.getElementById('qrStatus').textContent = `❌ ${err.message}`;
        }
    });
}

// ==========================================================================
// Reset Dashboard
// ==========================================================================

const resetDashboardEl = document.getElementById('resetDashboard');
if (resetDashboardEl) {
    resetDashboardEl.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to clear all scan data? This cannot be undone.')) {
            return;
        }

        try {
            const res = await fetch(`${API}/admin/reset`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${ADMIN_TOKEN}`,
                },
            });
            if (!res.ok) throw new Error('Failed to reset');
            scans = [];
            applyFilters();
            document.getElementById('qrStatus').textContent = '✅ Dashboard reset successfully!';
        } catch (err) {
            document.getElementById('qrStatus').textContent = `❌ Reset failed: ${err.message}`;
        }
    });
}

// Hide add location button - 1 location per company
const addLocationBtnEl = document.getElementById('addLocationBtn');
if (addLocationBtnEl) addLocationBtnEl.style.display = 'none';

// ==========================================================================
// Initialization
// ==========================================================================

// Render company selection on page load
renderCompanyGrid();
