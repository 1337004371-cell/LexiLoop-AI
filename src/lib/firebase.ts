import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  deleteDoc,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Auth Providers
export const googleProvider = new GoogleAuthProvider();

// Firestore Helpers
export const collections = {
  users: collection(db, 'users'),
  words: collection(db, 'words'),
  scenarios: collection(db, 'scenarios'),
};

/**
 * Handle Firestore errors by providing detailed contextual info.
 */
export function handleFirestoreError(error: any, operationType: string, path: string | null = null) {
  const user = auth.currentUser;
  const errorInfo = {
    error: error.message || 'Unknown error',
    operationType,
    path,
    authInfo: {
      userId: user?.uid || 'anonymous',
      email: user?.email || '',
      emailVerified: user?.emailVerified || false,
      isAnonymous: user?.isAnonymous || false,
      providerInfo: user?.providerData.map(p => ({
        providerId: p.providerId,
        displayName: p.displayName || '',
        email: p.email || ''
      })) || []
    }
  };
  console.error("Firestore Error:", JSON.stringify(errorInfo, null, 2));
  throw new Error(`Firebase Operation Failed: ${operationType}. Check console for details.`);
}
