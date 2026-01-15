/**
 * Firebase Data Import Script
 * 
 * Usage: node scripts/import-data.js
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// =============================================================================
// Firebase Initialization
// =============================================================================

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT || './firebase-service-account.json';
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// =============================================================================
// Sample Data - EDIT THIS SECTION
// =============================================================================

// Companies data
const companies = [
    {
        id: 'c8f12b6e-3a9d-4f2c-9e71-1b72d9f4a301',
        name: 'NovaTech Solutions',
        employee_count: 50,
        location_label: 'Hanoi, Vietnam',
        logo: 'https://img.grouponcdn.com/vouchercloud/3YMWpjDWrA4KpCJeUoP574pQxg44/3Y-300x300',
        created_at: new Date('2023-06-01T08:30:00Z'),
    },
    {
        id: 'a3e9d441-6f1c-42a5-bc8e-92f1d3a7b120',
        name: 'Apex Digital Holdings',
        employee_count: 75,
        location_label: 'Ho Chi Minh City, Vietnam',
        logo: 'https://images.steamusercontent.com/ugc/952979309891314703/9532DF045969448C2280ACAF3E181CDF190D4EA2/?imw=512&&ima=fit&impolicy=Letterbox&imcolor=%23000000&letterbox=false',
        created_at: new Date('2023-08-07T08:30:00Z'),
    },
    {
        id: 'f0b7c8d2-9e34-4b11-8d22-6a9c1f3e5b90',
        name: 'Meridian Systems Vietnam',
        employee_count: 320,
        location_label: 'Da Nang, Vietnam',
        logo: 'https://static.cdnlogo.com/logos/m/30/meridian.svg',
        created_at: new Date('2023-05-02T08:30:00Z'),
    },
    {
        id: '9d4e1a2f-cc87-4a6f-b9e3-18a7f2d0c611',
        name: 'Vertex Finance Technologies',
        employee_count: 42,
        location_label: 'Hai Phong, Vietnam',
        logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRbKo8Q0FUv1XUKEiYGZh6ho1qQcR1kOV6cig&s',
        created_at: new Date('2023-11-09T08:30:00Z'),
    },
];


// Displays data
const displays = [
    {
        id: '7b2f9c6a-41e3-4f8d-a9b5-2c0e6d1f8a44',
        company_id: 'c8f12b6e-3a9d-4f2c-9e71-1b72d9f4a301',
        created_at: new Date('2024-06-01T08:30:00Z'),
        label: 'Main Gate',
    },
    {
        id: '1a4d8c72-9e21-4b5f-bc33-8d0f2e6a91ab',
        company_id: 'a3e9d441-6f1c-42a5-bc8e-92f1d3a7b120',
        created_at: new Date('2024-06-03T09:00:00Z'),
        label: 'Reception Lobby',
    },
    {
        id: '5f9c2b18-7a6e-4d21-9c44-0b8e71a6df32',
        company_id: 'f0b7c8d2-9e34-4b11-8d22-6a9c1f3e5b90',
        created_at: new Date('2024-06-05T07:45:00Z'),
        label: 'Factory Entrance',
    },
    {
        id: 'c2e71a44-0f9d-4a8e-b6a1-3c5d92e8a770',
        company_id: '9d4e1a2f-cc87-4a6f-b9e3-18a7f2d0c611',
        created_at: new Date('2024-06-06T10:15:00Z'),
        label: 'Office Floor 1',
    },
];


const users = [
    {
        id: 'a4d9e2c7-8f3b-4a6d-bc21-5e7f91a2d084',
        avatar: 'https://photo.znews.vn/w660/Uploaded/ohunua2/2017_04_10/duong8.jpg',
        company_id: 'c8f12b6e-3a9d-4f2c-9e71-1b72d9f4a301',
        employee_id: 'NV-NT-0001',
        full_name: 'Nguyễn Minh Quân',
        job_title: 'CTO',
        password_hash: 'admin',
        role: 'admin',
        username: 'admin.novatech',
        created_at: new Date('2024-06-20T01:30:50Z'),
        last_login_at: new Date('2026-01-14T12:27:39Z'),
    },
    {
        id: 'b5e8f3d9-2c4a-5b7e-cd32-6f8g02b3e195',
        avatar: 'https://iweather.edu.vn/upload/2025/10/gai-xinh-viet-nam-012.webp',
        company_id: 'c8f12b6e-3a9d-4f2c-9e71-1b72d9f4a301',
        employee_id: 'NV-NT-0102',
        full_name: 'Trần Thùy Linh',
        job_title: 'Software Engineer',
        password_hash: 'employee',
        role: 'employee',
        username: 'linh.tran',
        created_at: new Date('2024-07-15T03:00:00Z'),
        last_login_at: new Date('2026-01-10T08:15:00Z'),
    },

    {
        id: 'c6f9g4e0-3d5b-6c8f-de43-7g9h13c4f206',
        avatar: 'https://cdn-i.doisongphapluat.com.vn/426/2015/7/19/tuanphong1.jpg',
        company_id: 'a3e9d441-6f1c-42a5-bc8e-92f1d3a7b120',
        employee_id: 'NV-AP-0001',
        full_name: 'Lê Hoàng Nam',
        job_title: 'Managing Director',
        password_hash: 'admin',
        role: 'admin',
        username: 'admin.apex',
        created_at: new Date('2024-05-10T02:00:00Z'),
        last_login_at: new Date('2026-01-13T09:30:00Z'),
    },
    {
        id: 'd7g0h5f1-4e6c-7d9g-ef54-8h0i24d5g317',
        avatar: 'https://phunuphapluat.nguoiduatin.vn/uploads/2023/05/21/co-gai-viet-bat-ngo-noi-tieng-nhu-ngoi-sao-nho-cu-day-thi-thanh-cong-nhat-gioi-ten-nho-mot-bien-phap-img-8088-2-1684596457-786-width660height660.jpg',
        company_id: 'a3e9d441-6f1c-42a5-bc8e-92f1d3a7b120',
        employee_id: 'NV-AP-0124',
        full_name: 'Nguyễn Thu Hương',
        job_title: 'HR Executive',
        password_hash: 'employee',
        role: 'employee',
        username: 'huong.nguyen',
        created_at: new Date('2024-08-20T04:30:00Z'),
        last_login_at: new Date('2026-01-12T07:45:00Z'),
    },

    {
        id: 'e8h1i6g2-5f7d-8e0h-fg65-9i1j35e6h428',
        avatar: 'https://image.voh.com.vn/voh/Image/2022/06/30/luan.jpg?t=o',
        company_id: 'f0b7c8d2-9e34-4b11-8d22-6a9c1f3e5b90',
        employee_id: 'NV-MR-0001',
        full_name: 'Phạm Quốc Khánh',
        job_title: 'Operations Director',
        password_hash: 'admin',
        role: 'admin',
        username: 'admin.meridian',
        created_at: new Date('2024-04-01T01:00:00Z'),
        last_login_at: new Date('2026-01-14T10:00:00Z'),
    },
    {
        id: 'f9i2j7h3-6g8e-9f1i-gh76-0j2k46f7i539',
        avatar: 'https://afamilycdn.com/2017/photo-10-1487899674425.jpg',
        company_id: 'f0b7c8d2-9e34-4b11-8d22-6a9c1f3e5b90',
        employee_id: 'NV-MR-0231',
        full_name: 'Phạm Tiến Đạt',
        job_title: 'System Analyst',
        password_hash: 'employee',
        role: 'employee',
        username: 'dat.pham',
        created_at: new Date('2024-09-15T05:00:00Z'),
        last_login_at: new Date('2026-01-11T06:30:00Z'),
    },

    {
        id: 'g0j3k8i4-7h9f-0g2j-hi87-1k3l57g8j640',
        avatar: 'https://afamilycdn.com/2017/photo-10-1487899674425.jpg',
        company_id: '9d4e1a2f-cc87-4a6f-b9e3-18a7f2d0c611',
        employee_id: 'NV-VX-0001',
        full_name: 'Vũ Anh Tuấn',
        job_title: 'Head of Finance',
        password_hash: 'admin',
        role: 'admin',
        username: 'admin.vertex',
        created_at: new Date('2024-03-01T00:00:00Z'),
        last_login_at: new Date('2026-01-14T11:15:00Z'),
    },
    {
        id: 'h1k4l9j5-8i0g-1h3k-ij98-2l4m68h9k751',
        avatar: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQVA-j1M0vIfBapbGAZZCA8eG1j_7e8VONEJg&s',
        company_id: '9d4e1a2f-cc87-4a6f-b9e3-18a7f2d0c611',
        employee_id: 'NV-VX-0147',
        full_name: 'Lê Ngọc Mai',
        job_title: 'Financial Analyst',
        password_hash: 'employee',
        role: 'employee',
        username: 'mai.le',
        created_at: new Date('2024-10-01T06:00:00Z'),
        last_login_at: new Date('2026-01-09T05:00:00Z'),
    },
];


// =============================================================================
// Import Functions
// =============================================================================

async function importCompanies() {
    console.log('Importing companies...');
    const batch = db.batch();

    for (const company of companies) {
        const { id, ...data } = company;
        const ref = db.collection('companies').doc(id);
        batch.set(ref, {
            ...data,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
        });
    }

    await batch.commit();
    console.log(`✓ Imported ${companies.length} companies`);
}

async function importDisplays() {
    console.log('Importing displays...');

    for (const display of displays) {
        try {
            const { id, ...data } = display;
            await db.collection('displays').doc(id).set(data);
            console.log(`  ✓ Display: ${id}`);
        } catch (err) {
            console.error(`  ✗ Display ${display.id}: ${err.message}`);
        }
    }

    console.log(`✓ Imported ${displays.length} displays`);
}

async function importUsers() {
    console.log('Importing users...');
    const batch = db.batch();

    for (const user of users) {
        const { id, ...data } = user;
        const ref = db.collection('users').doc(id); // Use explicit ID
        batch.set(ref, {
            ...data,
        });
    }

    await batch.commit();
    console.log(`✓ Imported ${users.length} users`);
}

// =============================================================================
// Main
// =============================================================================

async function main() {
    console.log('Starting data import...\n');

    try {
        await importCompanies();
        // await importDisplays();
        // await importUsers();

        console.log('\n✅ All data imported successfully!');
    } catch (error) {
        console.error('\n❌ Import failed:', error.message);
    }

    process.exit(0);
}

main();
