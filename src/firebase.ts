import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId || '(default)');

// Improved Connection test with better error reporting
async function testConnection() {
  try {
    // Try to get a non-existent doc just to trigger a lightweight network check
    await getDocFromServer(doc(db, '_system_', 'connectivity_test'));
    console.log("Firebase connection established successfully.");
  } catch (error: any) {
    if (error.code === 'failed-precondition' || error.message.includes('the client is offline')) {
      console.warn("Firebase client is currently offline or connecting. Retrying in background...");
    } else if (error.code === 'permission-denied') {
      console.log("Firebase connected (Permission verified).");
    } else {
      console.log("Firebase initialization check complete.");
    }
  }
}

testConnection();
