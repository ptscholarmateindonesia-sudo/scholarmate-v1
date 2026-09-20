import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db } from './firebase.ts';

export interface AuthUser {
  id: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
}

export type AuthState = 'UNAUTHENTICATED' | 'AUTHENTICATING' | 'AUTHENTICATED';

export const AUTH_MODE = 'FIREBASE_GOOGLE_AUTH';

type AuthListener = (state: AuthState, user: AuthUser | null) => void;

class FirebaseAuthService {
  private listeners: Set<AuthListener> = new Set();
  private currentUser: AuthUser | null = null;
  private authState: AuthState = 'AUTHENTICATING';
  private isInitialized = false;

  constructor() {
    this.initAuthListener();
  }

  private initAuthListener() {
    onAuthStateChanged(
      auth,
      async (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser) {
          const authUser: AuthUser = {
            id: firebaseUser.uid,
            email: firebaseUser.email || undefined,
            displayName: firebaseUser.displayName || undefined,
            photoURL: firebaseUser.photoURL || undefined,
          };
          this.currentUser = authUser;
          this.authState = 'AUTHENTICATED';

          // Sync user record to Firestore (fire-and-forget)
          try {
            const userRef = doc(db, 'users', firebaseUser.uid);
            await setDoc(
              userRef,
              {
                uid: firebaseUser.uid,
                email: firebaseUser.email || '',
                displayName: firebaseUser.displayName || '',
                photoURL: firebaseUser.photoURL || '',
                lastLoginAt: serverTimestamp(),
              },
              { merge: true }
            );
          } catch (e) {
            console.warn('[FirebaseAuth] Firestore user sync warning:', e);
          }
        } else {
          this.currentUser = null;
          this.authState = 'UNAUTHENTICATED';
        }
        this.isInitialized = true;
        this.notify();
      },
      (error) => {
        console.error('[FirebaseAuth] Auth state change error:', error);
        this.currentUser = null;
        this.authState = 'UNAUTHENTICATED';
        this.isInitialized = true;
        this.notify();
      }
    );
  }

  public getAuthState(): AuthState {
    return this.authState;
  }

  public getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  public isReady(): boolean {
    return this.isInitialized;
  }

  public async signInWithGoogle(): Promise<AuthUser> {
    this.authState = 'AUTHENTICATING';
    this.notify();

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;
      const authUser: AuthUser = {
        id: firebaseUser.uid,
        email: firebaseUser.email || undefined,
        displayName: firebaseUser.displayName || undefined,
        photoURL: firebaseUser.photoURL || undefined,
      };

      this.currentUser = authUser;
      this.authState = 'AUTHENTICATED';

      // Save/update user doc in Firestore
      try {
        const userRef = doc(db, 'users', firebaseUser.uid);
        await setDoc(
          userRef,
          {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || '',
            photoURL: firebaseUser.photoURL || '',
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (err) {
        console.warn('[FirebaseAuth] Could not write user to Firestore:', err);
      }

      this.notify();
      return authUser;
    } catch (error: any) {
      const code = error?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        console.warn('[FirebaseAuth] Google Sign-In cancelled by user.');
      } else {
        console.error('[FirebaseAuth] Google Sign-In error:', error);
      }
      this.currentUser = null;
      this.authState = 'UNAUTHENTICATED';
      this.notify();
      throw error;
    }
  }

  public async signOut(): Promise<void> {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('[FirebaseAuth] Sign-out error:', error);
    } finally {
      this.currentUser = null;
      this.authState = 'UNAUTHENTICATED';
      this.notify();
    }
  }

  public async getIdToken(): Promise<string | null> {
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken();
  }

  public subscribe(listener: AuthListener): () => void {
    this.listeners.add(listener);
    // Notify immediately with current state
    listener(this.authState, this.currentUser);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.authState, this.currentUser);
    }
  }
}

export const authService = new FirebaseAuthService();
export { auth, db };
