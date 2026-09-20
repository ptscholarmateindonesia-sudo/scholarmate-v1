import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db, authService } from './authService.ts';

const USAGE_STORAGE_KEY = 'scholarmate_usage_v1';

export interface UserUsage {
  scanCount: number;
  aiActionCount: number;
  lastUpdated: string;
}

const INITIAL_USAGE: UserUsage = {
  scanCount: 0,
  aiActionCount: 0,
  lastUpdated: new Date().toISOString(),
};

export function getLocalUsage(): UserUsage {
  try {
    const data = localStorage.getItem(USAGE_STORAGE_KEY);
    if (!data) return INITIAL_USAGE;
    return JSON.parse(data);
  } catch {
    return INITIAL_USAGE;
  }
}

export function setLocalUsage(usage: UserUsage) {
  try {
    localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(usage));
  } catch (err) {
    console.warn('[UsageService] Error saving local usage:', err);
  }
}

export async function fetchUsageFromCloud(userId: string): Promise<UserUsage | null> {
  if (!userId) return null;
  try {
    const docRef = doc(db, 'users', userId, 'stats', 'usage');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as any;
      const usage: UserUsage = {
        scanCount: data.scanCount || 0,
        aiActionCount: data.aiActionCount || 0,
        lastUpdated: data.updatedAt?.toDate()?.toISOString() || new Date().toISOString(),
      };
      setLocalUsage(usage);
      return usage;
    }
    return null;
  } catch (err) {
    console.warn('[UsageService] Error fetching cloud usage:', err);
    return null;
  }
}

export async function recordFirstScanServer(): Promise<void> {
  const token = await authService.getIdToken();
  if (!token) return;

  try {
    await fetch('/api/usage/record-scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
  } catch (err) {
    console.warn('[UsageService] Error recording scan server-side:', err);
  }
}

export async function validateCorrectionServer(): Promise<{ allowed: boolean; reason: string }> {
  const token = await authService.getIdToken();
  if (!token) return { allowed: true, reason: 'unauthenticated_fallback' }; // Fallback to client logic if unauth

  try {
    const res = await fetch('/api/usage/validate-correction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    return await res.json();
  } catch (err) {
    console.warn('[UsageService] Error validating correction server-side:', err);
    return { allowed: true, reason: 'error_fallback' };
  }
}

export async function incrementScanCount(userId?: string): Promise<number> {
  const usage = getLocalUsage();
  usage.scanCount += 1;
  usage.lastUpdated = new Date().toISOString();
  setLocalUsage(usage);

  if (userId) {
    try {
      const docRef = doc(db, 'users', userId, 'stats', 'usage');
      await setDoc(
        docRef,
        {
          scanCount: increment(1),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      
      // Also record first scan timestamp if it's the first one
      await recordFirstScanServer();
    } catch (err) {
      console.warn('[UsageService] Error incrementing scan count in cloud:', err);
    }
  }
  return usage.scanCount;
}

export async function incrementAiActionCount(userId?: string): Promise<number> {
  const usage = getLocalUsage();
  usage.aiActionCount += 1;
  usage.lastUpdated = new Date().toISOString();
  setLocalUsage(usage);

  if (userId) {
    try {
      const docRef = doc(db, 'users', userId, 'stats', 'usage');
      await setDoc(
        docRef,
        {
          aiActionCount: increment(1),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('[UsageService] Error incrementing ai count in cloud:', err);
    }
  }
  return usage.aiActionCount;
}
