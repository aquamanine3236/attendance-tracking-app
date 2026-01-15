/**
 * Firebase Test Script - Simple test to debug Firestore connection
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccountPath = './firebase-service-account.json';
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function test() {
    console.log('Testing Firestore connection...\n');

    try {
        // Test 1: Read existing collection
        console.log('1. Reading companies collection...');
        const snapshot = await db.collection('companies').get();
        console.log(`   ✓ Found ${snapshot.size} companies\n`);

        // Test 2: Add document with auto-ID
        console.log('2. Adding test document...');
        const docRef = await db.collection('test').add({
            name: 'Test Document',
            created_at: new Date(),
        });
        console.log(`   ✓ Created document: ${docRef.id}\n`);

        // Test 3: Add document with specific ID
        console.log('3. Adding document with specific ID...');
        await db.collection('test').doc('test-doc-123').set({
            name: 'Test with ID',
            created_at: new Date(),
        });
        console.log('   ✓ Created document: test-doc-123\n');

        // Cleanup
        console.log('4. Cleaning up test documents...');
        await db.collection('test').doc(docRef.id).delete();
        await db.collection('test').doc('test-doc-123').delete();
        console.log('   ✓ Cleaned up\n');

        console.log('✅ All tests passed!');
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Full error:', error);
    }

    process.exit(0);
}

test();
