import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.ts';
import {
  CanonicalProfile,
  normalizeProfileToCanonical,
} from './profileAdapter.ts';

export type SaveStatus = 'UNSAVED' | 'SAVING' | 'SAVED' | 'SAVE_ERROR' | 'UNSAVED_CHANGES';

export interface SavedResultSnapshot {
  version: 'v0';
  profileSchemaVersion?: 'snake_case_v1';
  savedAt: string;
  savedByUserId?: string;
  profile: CanonicalProfile;
  progressiveAnswers: Record<string, any>;
  selectedCategory?: string | null;
  context?: Record<string, any>;
  derivedProfile?: {
    university_type?: string;
    major_group?: string;
    verified_partner?: boolean;
  };
  // Optional runtime snapshot results (app always re-runs live eligibility & fit score against latest rules)
  results?: Array<{
    scholarshipId: string;
    finalState: string;
    selectedCategory?: string;
    fitScore: number;
    evidenceCoverage: number;
    fitLabel?: string;
    biggestRelevantGap?: string;
    deterministicNextAction?: string;
  }>;
  topRecommendationId?: string;
  profileReadiness?: number;
}

export function computeProfileFingerprint(
  profile: Partial<CanonicalProfile> | Record<string, any> | null | undefined,
  progressiveAnswers: Record<string, any> = {},
  selectedCategory?: string | null
): string | null {
  if (!isProfileValid(profile)) return null;
  const canonical = normalizeProfileToCanonical(profile);

  const normalized = {
    citizenship: (canonical.citizenship || '').toLowerCase(),
    education_level: (canonical.education_level || '').toLowerCase(),
    semester: canonical.semester ?? null,
    university: (canonical.university || '').toLowerCase(),
    major: (canonical.major || '').toLowerCase(),
    gpa: canonical.gpa !== null && canonical.gpa !== undefined ? Number(canonical.gpa.toFixed(2)) : null,
    receives_other_scholarship: canonical.receives_other_scholarship,
    current_scholarship_name: canonical.current_scholarship_name || null,
    has_organization: canonical.has_organization ?? null,
    has_achievement: canonical.has_achievement ?? null,
    has_volunteer: canonical.has_volunteer ?? null,
    goal: (canonical.goal || '').toLowerCase(),
    progressiveAnswers: Object.keys(progressiveAnswers || {}).sort().reduce((acc, key) => {
      acc[key] = progressiveAnswers[key];
      return acc;
    }, {} as Record<string, any>),
    selectedCategory: selectedCategory || null,
  };

  const jsonStr = JSON.stringify(normalized);
  let hash = 0;
  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `FP_${Math.abs(hash).toString(36)}_${jsonStr.length}`;
}

export const STORAGE_KEY = 'scholarmate_saved_result_v0';

export interface ProfileValidationResult {
  valid: boolean;
  reason?: string;
}

export function isProfileValid(
  profile: Partial<CanonicalProfile> | Record<string, any> | null | undefined
): boolean {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return false;
  if (Object.keys(profile).length === 0) return false;

  const p = normalizeProfileToCanonical(profile);

  // Citizenship
  if (!p.citizenship || p.citizenship.trim() === '') return false;

  // Education Level
  if (!p.education_level || p.education_level.trim() === '') return false;

  // Semester
  if (typeof p.semester !== 'number' || !Number.isFinite(p.semester) || p.semester < 1) return false;

  // University
  if (
    !p.university ||
    p.university.trim() === '' ||
    p.university.trim().toLowerCase() === 'kampus' ||
    p.university.trim().toLowerCase() === 'universitas'
  ) return false;

  // Major
  if (
    !p.major ||
    p.major.trim() === '' ||
    p.major.trim().toLowerCase() === 'mahasiswa' ||
    p.major.trim().toLowerCase() === 'jurusan'
  ) return false;

  // Receives Other Scholarship (strict boolean check: false or true)
  if (typeof p.receives_other_scholarship !== 'boolean') return false;

  // Goal
  if (!p.goal || p.goal.trim() === '') return false;

  // GPA requirement if semester >= 2
  if (p.semester >= 2) {
    if (p.gpa === null || p.gpa === undefined) return false;
    if (!Number.isFinite(p.gpa) || p.gpa <= 0 || p.gpa > 4.0) return false;
  }

  return true;
}

export const isProfileCoreComplete = isProfileValid;

export function validateSavedSnapshot(snapshot: any): ProfileValidationResult {
  if (!snapshot || typeof snapshot !== 'object') {
    return { valid: false, reason: 'Format snapshot tidak valid' };
  }
  if (snapshot.version !== 'v0') {
    return { valid: false, reason: 'Versi snapshot tidak cocok' };
  }
  if (!snapshot.savedAt || typeof snapshot.savedAt !== 'string') {
    return { valid: false, reason: 'Waktu simpan tidak valid' };
  }
  if (!snapshot.profile || typeof snapshot.profile !== 'object') {
    return { valid: false, reason: 'Data profil dalam snapshot tidak ada' };
  }

  const canonicalProfile = normalizeProfileToCanonical(snapshot.profile);
  if (!isProfileValid(canonicalProfile)) {
    return { valid: false, reason: 'Profil snapshot tidak lengkap atau tidak valid' };
  }

  return { valid: true };
}

export function isStorageAvailable(): boolean {
  try {
    const testKey = '__scholarmate_test__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export function getSavedResult(): SavedResultSnapshot | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    const parsed = JSON.parse(data);
    const validation = validateSavedSnapshot(parsed);
    if (validation.valid) {
      parsed.profile = normalizeProfileToCanonical(parsed.profile);
      return parsed as SavedResultSnapshot;
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchSavedResultFromCloud(userId: string): Promise<SavedResultSnapshot | null> {
  if (!userId) return null;
  try {
    const docRef = doc(db, 'users', userId, 'saved_results', 'latest');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as any;
      if (data.deleted) return null;
      const validation = validateSavedSnapshot(data);
      if (validation.valid) {
        data.profile = normalizeProfileToCanonical(data.profile);
        if (!data.progressiveAnswers) data.progressiveAnswers = {};
        if (data.selectedCategory && !data.progressiveAnswers.bca_category_selected) {
          data.progressiveAnswers.bca_category_selected = data.selectedCategory;
        }
        // Sync to localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return data as SavedResultSnapshot;
      }
    }
    return null;
  } catch (error) {
    console.warn('[ScholarMate Save] Error fetching saved result from Cloud Firestore:', error);
    return null;
  }
}

export function hasSavedResult(): boolean {
  return getSavedResult() !== null;
}

export function saveResult(snapshot: SavedResultSnapshot, userId?: string): boolean {
  try {
    const canonicalProfile = normalizeProfileToCanonical(snapshot.profile);
    const selectedCategory = snapshot.selectedCategory || snapshot.progressiveAnswers?.bca_category_selected || null;
    const canonicalSnapshot: SavedResultSnapshot = {
      ...snapshot,
      savedByUserId: userId || snapshot.savedByUserId,
      profileSchemaVersion: 'snake_case_v1',
      profile: canonicalProfile,
      progressiveAnswers: snapshot.progressiveAnswers || {},
      selectedCategory,
    };
    const validation = validateSavedSnapshot(canonicalSnapshot);
    if (!validation.valid) {
      console.error('[ScholarMate Save] Aborting save, snapshot invalid:', validation.reason);
      return false;
    }
    
    // Always persist to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(canonicalSnapshot));

    // Also persist to Firestore if userId is present
    const uid = userId || snapshot.savedByUserId;
    if (uid) {
      const docRef = doc(db, 'users', uid, 'saved_results', 'latest');
      setDoc(
        docRef,
        {
          version: 'v0',
          profileSchemaVersion: 'snake_case_v1',
          savedByUserId: uid,
          savedAt: canonicalSnapshot.savedAt || new Date().toISOString(),
          profile: canonicalProfile,
          progressiveAnswers: canonicalSnapshot.progressiveAnswers,
          selectedCategory: selectedCategory,
          context: canonicalSnapshot.context || {},
          derivedProfile: canonicalSnapshot.derivedProfile || {},
          profileReadiness: canonicalSnapshot.profileReadiness || 0,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch((err) => {
        console.warn('[ScholarMate Save] Cloud Firestore write warning:', err);
      });
    }

    return true;
  } catch (e) {
    console.error('[ScholarMate Save] Error saving snapshot:', e);
    return false;
  }
}

export async function saveResultAsync(snapshot: SavedResultSnapshot, userId?: string): Promise<boolean> {
  const localOk = saveResult(snapshot, userId);
  const uid = userId || snapshot.savedByUserId;
  if (uid && localOk) {
    try {
      const canonicalProfile = normalizeProfileToCanonical(snapshot.profile);
      const selectedCategory = snapshot.selectedCategory || snapshot.progressiveAnswers?.bca_category_selected || null;
      const docRef = doc(db, 'users', uid, 'saved_results', 'latest');
      await setDoc(
        docRef,
        {
          version: 'v0',
          profileSchemaVersion: 'snake_case_v1',
          savedByUserId: uid,
          savedAt: snapshot.savedAt || new Date().toISOString(),
          profile: canonicalProfile,
          progressiveAnswers: snapshot.progressiveAnswers || {},
          selectedCategory: selectedCategory,
          context: snapshot.context || {},
          derivedProfile: snapshot.derivedProfile || {},
          profileReadiness: snapshot.profileReadiness || 0,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      return true;
    } catch (e) {
      console.warn('[ScholarMate Save] Cloud Firestore async write error:', e);
      return localOk;
    }
  }
  return localOk;
}

export function clearSavedResult(userId?: string): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    if (userId) {
      const docRef = doc(db, 'users', userId, 'saved_results', 'latest');
      setDoc(docRef, { deleted: true, updatedAt: serverTimestamp() }).catch(() => {});
    }
  } catch (e) {
    console.error('[ScholarMate Save] Error clearing saved result:', e);
  }
}
