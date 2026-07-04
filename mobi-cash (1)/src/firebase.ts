import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, get } from 'firebase/database';
import { getFirestore, doc, setDoc, onSnapshot, collection, getDocs, deleteDoc } from 'firebase/firestore';

// Your official Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCzGqH4OowC4kCnbkD0PNbiwHpy18ly4Lg",
  authDomain: "admin-1930b.firebaseapp.com",
  databaseURL: "https://admin-1930b-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "admin-1930b",
  storageBucket: "admin-1930b.appspot.com",
  messagingSenderId: "963507923277",
  appId: "1:963507923277:web:79cf3746cc647d5f88ef04",
  measurementId: "G-X5801Z311G"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);
export const rtdb = getDatabase(app);

// Graceful helpers to update/get data with real-time sync across clients
export async function syncBalanceToFirebase(balance: number) {
  try {
    // 1. Realtime Database Sync
    await set(ref(rtdb, 'mobicash/balance'), balance);
  } catch (err) {
    console.warn('Realtime Database balance sync error, trying Firestore...', err);
  }

  try {
    // 2. Firestore Sync as double protection
    await setDoc(doc(db, 'mobicash_system', 'balance_state'), {
      balance,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.warn('Firestore balance sync error', err);
  }
}

export async function syncTransactionsToFirebase(transactions: any[]) {
  try {
    // 1. Realtime Database Sync
    await set(ref(rtdb, 'mobicash/transactions'), transactions);
  } catch (err) {
    console.warn('Realtime Database transactions sync error, trying Firestore...', err);
  }

  try {
    // 2. Firestore Sync
    await setDoc(doc(db, 'mobicash_system', 'transactions_state'), {
      list: transactions,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.warn('Firestore transactions sync error', err);
  }
}

export async function clearTransactionsInFirebase() {
  try {
    await set(ref(rtdb, 'mobicash/transactions'), []);
  } catch (err) {
    console.warn('RTDB clear transactions error', err);
  }

  try {
    await setDoc(doc(db, 'mobicash_system', 'transactions_state'), {
      list: [],
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.warn('Firestore clear transactions error', err);
  }
}
