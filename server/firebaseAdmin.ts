import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const app = getApps().length ? getApp() : initializeApp();

export const db = getFirestore(app);
export const auth = getAuth(app);
export { Timestamp, FieldValue };
export const admin = { auth: () => auth, firestore: () => db };
