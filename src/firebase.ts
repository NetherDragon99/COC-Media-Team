import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot,
  Timestamp,
  serverTimestamp,
  increment
} from 'firebase/firestore';

// Hardcoded exact firebaseConfig per user specification
export const firebaseConfig = {
  apiKey: "AIzaSyBgnWU2azejTgCr-zVtVPLQYYRMGNtfieQ",
  authDomain: "coc-media-team.firebaseapp.com",
  projectId: "coc-media-team",
  storageBucket: "coc-media-team.firebasestorage.app",
  messagingSenderId: "956334806347",
  appId: "1:956334806347:web:f9f1200268c451bbe284ce",
  measurementId: "G-BXX1WE9EWJ"
};

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Export common firestore utilities
export {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  increment,
  signInWithPopup,
  firebaseSignOut,
  onAuthStateChanged
};
export type { FirebaseUser };
