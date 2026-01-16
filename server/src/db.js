/**
 * Firebase Firestore Database Connection Module
 * 
 * Provides Firestore connection and query helpers for the attendance tracking system.
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import 'dotenv/config';

// =============================================================================
// Firebase Initialization
// =============================================================================

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT || './firebase-service-account.json';

let serviceAccount;
try {
    serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
} catch (err) {
    console.error('Failed to load Firebase service account:', err.message);
    console.error('Please ensure firebase-service-account.json exists in the server directory');
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// =============================================================================
// Collection References
// =============================================================================

const companiesRef = db.collection('companies');
const usersRef = db.collection('users');
const displaysRef = db.collection('displays');
const qrSessionsRef = db.collection('qr_sessions');
const scansRef = db.collection('scans');

// =============================================================================
// Company Operations
// =============================================================================

export const companies = {
    async findById(id) {
        const doc = await companiesRef.doc(id).get();
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
    },

    async findAll() {
        const snapshot = await companiesRef.orderBy('name').get();
        return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    },

    async create({ id, name, employeeCount, logo, locationLabel }) {
        const data = {
            name,
            employee_count: employeeCount || 0,
            logo: logo || null,
            location_label: locationLabel || null,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
        };
        await companiesRef.doc(id).set(data);
        return { id, ...data };
    },

    async getNameById(id) {
        const doc = await companiesRef.doc(id).get();
        return doc.exists ? doc.data().name : 'Unknown Company';
    },

    async findByIds(ids) {
        if (!ids || ids.length === 0) return [];
        // Firestore 'in' queries have max 30 elements, so we chunk if needed
        const chunks = [];
        for (let i = 0; i < ids.length; i += 30) {
            chunks.push(ids.slice(i, i + 30));
        }
        const results = [];
        for (const chunk of chunks) {
            const snapshot = await companiesRef
                .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
                .get();
            results.push(...snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        }
        return results;
    },
};

// =============================================================================
// User Operations
// =============================================================================

export const users = {
    async findById(id) {
        const doc = await usersRef.doc(id).get();
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
    },

    async findByUsername(username) {
        const snapshot = await usersRef.where('username', '==', username).limit(1).get();
        if (snapshot.empty) return null;
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() };
    },

    async findByEmployeeId(employeeId) {
        const snapshot = await usersRef.where('employee_id', '==', employeeId).limit(1).get();
        if (snapshot.empty) return null;
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() };
    },

    async create({ companyId, username, passwordHash, fullName, jobTitle, employeeId, role, avatar }) {
        const data = {
            company_id: companyId,
            username,
            password_hash: passwordHash,
            full_name: fullName,
            job_title: jobTitle || null,
            employee_id: employeeId,
            role: role || 'employee',
            avatar: avatar || null,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            last_login_at: null,
        };
        const docRef = await usersRef.add(data);
        return { id: docRef.id, ...data };
    },

    async updateLastLogin(id) {
        await usersRef.doc(id).update({
            last_login_at: admin.firestore.FieldValue.serverTimestamp(),
        });
    },
};

// =============================================================================
// Display Operations
// =============================================================================

export const displays = {
    async findById(id) {
        const doc = await displaysRef.doc(id).get();
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
    },

    async findByCompany(companyId) {
        const snapshot = await displaysRef
            .where('company_id', '==', companyId)
            .orderBy('label')
            .get();
        return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    },

    async create({ id, companyId, label }) {
        const data = {
            company_id: companyId,
            label: label || id,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
        };
        await displaysRef.doc(id).set(data);
        return { id, ...data };
    },

    async findOrCreate({ id, companyId, label }) {
        let display = await this.findById(id);
        if (!display) {
            display = await this.create({ id, companyId, label: label || id });
        }
        return display;
    },
};

// =============================================================================
// QR Session Operations
// =============================================================================

export const qrSessions = {
    async findByToken(token) {
        const snapshot = await qrSessionsRef.where('token', '==', token).limit(1).get();
        if (snapshot.empty) return null;
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() };
    },

    async findActiveByDisplay(displayId) {
        const snapshot = await qrSessionsRef
            .where('display_id', '==', displayId)
            .where('status', '==', 'active')
            .orderBy('created_at', 'desc')
            .limit(1)
            .get();
        if (snapshot.empty) return null;
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() };
    },

    async create({ id, token, displayId, companyId, issuedBy }) {
        // First, mark any existing active sessions for this display as 'used'
        const activeSnapshot = await qrSessionsRef
            .where('display_id', '==', displayId)
            .where('status', '==', 'active')
            .get();

        const batch = db.batch();
        activeSnapshot.docs.forEach((doc) => {
            batch.update(doc.ref, {
                status: 'used',
                used_at: admin.firestore.FieldValue.serverTimestamp()
            });
        });

        // Create new session (no expiration - only expires when used or replaced)
        const data = {
            token,
            display_id: displayId,
            company_id: companyId || null,
            status: 'active',
            issued_by: issuedBy || 'system',
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            used_at: null,
        };
        batch.set(qrSessionsRef.doc(id), data);

        await batch.commit();
        return { id, ...data };
    },

    async markUsed(token) {
        const snapshot = await qrSessionsRef.where('token', '==', token).limit(1).get();
        if (snapshot.empty) return null;

        const doc = snapshot.docs[0];
        await doc.ref.update({
            status: 'used',
            used_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { id: doc.id, ...doc.data(), status: 'used' };
    },

    async markExpired(token) {
        const snapshot = await qrSessionsRef.where('token', '==', token).limit(1).get();
        if (snapshot.empty) return null;

        const doc = snapshot.docs[0];
        await doc.ref.update({ status: 'expired' });
        return { id: doc.id, ...doc.data(), status: 'expired' };
    },

    // Note: expireOldSessions removed - QR codes don't expire by time
};

// =============================================================================
// Scan Operations
// =============================================================================

export const scans = {
    async findAll({ companyId, search, limit = 100 } = {}) {
        let query = scansRef.orderBy('created_at', 'desc').limit(limit);

        if (companyId) {
            query = scansRef
                .where('company_id', '==', companyId)
                .orderBy('created_at', 'desc')
                .limit(limit);
        }

        const snapshot = await query.get();
        let results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        // Client-side search filter (Firestore doesn't support LIKE queries)
        if (search) {
            const term = search.toLowerCase();
            results = results.filter(
                (s) =>
                    (s.full_name_snapshot || '').toLowerCase().includes(term) ||
                    (s.job_title_snapshot || '').toLowerCase().includes(term) ||
                    (s.employee_id_snapshot || '').toLowerCase().includes(term)
            );
        }

        return results;
    },

    async create({
        id,
        qrSessionId,
        displayId,
        companyId,
        userId,
        fullNameSnapshot,
        jobTitleSnapshot,
        employeeIdSnapshot,
        companyNameSnapshot,
        type,
        lat,
        lng,
        accuracy,
        image,
    }) {
        const data = {
            qr_session_id: qrSessionId,
            display_id: displayId,
            company_id: companyId || null,
            user_id: userId || null,
            full_name_snapshot: fullNameSnapshot,
            job_title_snapshot: jobTitleSnapshot || null,
            employee_id_snapshot: employeeIdSnapshot || null,
            company_name_snapshot: companyNameSnapshot || null,
            type,
            lat: lat || null,
            lng: lng || null,
            accuracy: accuracy || null,
            image: image || null,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
        };
        await scansRef.doc(id).set(data);

        // Return with created_at as ISO string for consistency
        return {
            id,
            ...data,
            created_at: new Date().toISOString()
        };
    },

    async getStats(companyId) {
        let query = scansRef;
        if (companyId) {
            query = scansRef.where('company_id', '==', companyId);
        }

        const snapshot = await query.get();
        const docs = snapshot.docs.map((doc) => doc.data());

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return {
            total_scans: docs.length,
            check_ins: docs.filter((d) => d.type === 'check-in').length,
            check_outs: docs.filter((d) => d.type === 'check-out').length,
            today_scans: docs.filter((d) => {
                const scanDate = d.created_at?.toDate?.() || new Date(d.created_at);
                return scanDate >= today;
            }).length,
        };
    },

    async deleteAll(companyId) {
        let query = scansRef;
        if (companyId) {
            query = scansRef.where('company_id', '==', companyId);
        }

        const snapshot = await query.get();
        const batch = db.batch();
        snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
    },
};

// =============================================================================
// Admin Operations
// =============================================================================

export const adminOps = {
    async resetDashboard(companyId) {
        // Delete scans
        await scans.deleteAll(companyId);

        // Mark all active QR sessions as used
        let query = qrSessionsRef.where('status', '==', 'active');
        if (companyId) {
            query = qrSessionsRef
                .where('company_id', '==', companyId)
                .where('status', '==', 'active');
        }

        const snapshot = await query.get();
        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
            batch.update(doc.ref, {
                status: 'used',
                used_at: admin.firestore.FieldValue.serverTimestamp(),
            });
        });
        await batch.commit();
    },
};

// =============================================================================
// Database Health Check
// =============================================================================

export const healthCheck = async () => {
    try {
        // Simple read to verify connection
        await companiesRef.limit(1).get();
        return { ok: true, database: 'firebase' };
    } catch (err) {
        return { ok: false, error: err.message };
    }
};

// =============================================================================
// Graceful Shutdown (no-op for Firebase)
// =============================================================================

export const closePool = async () => {
    // Firebase Admin SDK doesn't require explicit cleanup
};

export default {
    companies,
    users,
    displays,
    qrSessions,
    scans,
    admin: adminOps,
    healthCheck,
    closePool,
};
