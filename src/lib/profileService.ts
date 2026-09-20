import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './authService';

export interface UserProfile {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  activePassTier?: 'NONE' | 'MATE_PASS' | 'MATE_PLUS';
  passStartsAt?: any;
  passExpiryAt?: any;
  firstScanAt?: any;
  createdAt?: any;
  lastLoginAt?: any;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

export async function ensureUserProfile(user: { id: string; email?: string | null; displayName?: string | null; photoURL?: string | null }): Promise<UserProfile | null> {
  try {
    const docRef = doc(db, 'users', user.id);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      const newProfile: UserProfile = {
        uid: user.id,
        email: user.email || undefined,
        displayName: user.displayName || undefined,
        photoURL: user.photoURL || undefined,
        activePassTier: 'NONE',
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp()
      };
      await setDoc(docRef, newProfile);
      return newProfile;
    } else {
      await updateDoc(docRef, {
        lastLoginAt: serverTimestamp()
      });
      return docSnap.data() as UserProfile;
    }
  } catch (error) {
    console.error('Error ensuring user profile:', error);
    return null;
  }
}
