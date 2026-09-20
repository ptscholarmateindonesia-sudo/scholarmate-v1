import { useState, useEffect } from 'react';
import {
  ScholarshipProfile,
  ScanFormProfile,
  EMPTY_PROFILE,
  ScreenState,
  normalizeProfileToCanonical,
  canonicalToScanFormProfile,
  MAX_FREE_SCANS,
  trackEvent,
} from './types.ts';
import { LandingView } from './components/LandingView.tsx';
import { ProfileScanView } from './components/ProfileScanView.tsx';
import { LoadingView } from './components/LoadingView.tsx';
import { MockResultView } from './components/MockResultView.tsx';
import { SaveGateModal } from './components/SaveGateModal.tsx';
import { MyScholarshipsModal } from './components/MyScholarshipsModal.tsx';
import { MatePassModal } from './components/MatePassModal.tsx';
import {
  getSavedResult,
  clearSavedResult,
  fetchSavedResultFromCloud,
  SavedResultSnapshot,
  isProfileValid,
} from './lib/saveService.ts';
import { authService, AuthUser } from './lib/authService.ts';
import { getLocalUsage, fetchUsageFromCloud, incrementScanCount } from './lib/usageService.ts';
import { ensureUserProfile } from './lib/profileService.ts';

export default function App() {
  // Single Screen State: LANDING | RETURNING | SCAN | LOADING | RESULT
  const [screen, setScreen] = useState<ScreenState>('LANDING');
  const [activeProfile, setActiveProfile] = useState<ScholarshipProfile>(EMPTY_PROFILE);
  const [rawScanProfile, setRawScanProfile] = useState<ScanFormProfile | undefined>(undefined);
  const [hasCompletedScan, setHasCompletedScan] = useState<boolean>(false);
  const [activeScanStep, setActiveScanStep] = useState<number>(1);

  // Saved Result State
  const [savedResultSnapshot, setSavedResultSnapshot] = useState<SavedResultSnapshot | null>(null);
  const [progressiveAnswers, setProgressiveAnswers] = useState<Record<string, any>>({});
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLandingLoginModalOpen, setIsLandingLoginModalOpen] = useState<boolean>(false);
  const [isMyScholarshipsModalOpen, setIsMyScholarshipsModalOpen] = useState<boolean>(false);
  const [isMatePassModalOpen, setIsMatePassModalOpen] = useState<boolean>(false);

  // Mate Pass Status (unfied with MockResultView logic)
  const [activePassTier, setActivePassTier] = useState<'NONE' | 'MATE_PASS' | 'MATE_PLUS'>(() => {
    try {
      const savedTier = localStorage.getItem('scholarmate_active_pass_tier');
      if (savedTier === 'MATE_PLUS' || savedTier === 'MATE_PASS') return savedTier as any;
      if (localStorage.getItem('scholarmate_mate_pass_active') === 'true') return 'MATE_PASS';
      return 'NONE';
    } catch {
      return 'NONE';
    }
  });

  const isMatePassActive = activePassTier !== 'NONE';
  const [scanCount, setScanCount] = useState<number>(() => getLocalUsage().scanCount);

  // On mount: Check saved result and listen to auth
  useEffect(() => {
    trackEvent('landing_view');
    
    // Check local storage first
    const saved = getSavedResult();
    if (saved && isProfileValid(saved.profile)) {
      setSavedResultSnapshot(saved);
      setScreen('RETURNING');
    } else {
      clearSavedResult();
      setSavedResultSnapshot(null);
      setScreen('LANDING');
    }

    // Subscribe to Google Auth changes
    const unsubscribe = authService.subscribe(async (authState, user) => {
      setCurrentUser(user);
      if (authState === 'AUTHENTICATED' && user) {
        // Ensure profile exists and sync entitlement
        const profile = await ensureUserProfile(user);
        if (profile) {
          // Sync entitlement from Cloud
          if (profile.activePassTier && profile.activePassTier !== 'NONE') {
            const now = Date.now();
            const expiry = profile.passExpiryAt?.toMillis ? profile.passExpiryAt.toMillis() : (profile.passExpiryAt instanceof Date ? profile.passExpiryAt.getTime() : 0);
            
            if (expiry > now) {
              setActivePassTier(profile.activePassTier);
              localStorage.setItem('scholarmate_active_pass_tier', profile.activePassTier);
              localStorage.setItem('scholarmate_mate_pass_active', 'true');
            } else {
              // Expired
              setActivePassTier('NONE');
              localStorage.removeItem('scholarmate_active_pass_tier');
              localStorage.removeItem('scholarmate_mate_pass_active');
            }
          }

          // Sync firstScanAt from Cloud
          if (profile.firstScanAt) {
            const cloudFirstScanAt = profile.firstScanAt.toMillis ? profile.firstScanAt.toMillis() : (profile.firstScanAt instanceof Date ? profile.firstScanAt.getTime() : 0);
            const localFirstScanAt = localStorage.getItem('scholarmate_first_scan_at');
            if (!localFirstScanAt || parseInt(localFirstScanAt) > cloudFirstScanAt) {
              localStorage.setItem('scholarmate_first_scan_at', cloudFirstScanAt.toString());
            }
          }
        }

        // Fetch from Cloud Firestore if available
        const cloudSaved = await fetchSavedResultFromCloud(user.id);
        if (cloudSaved && isProfileValid(cloudSaved.profile)) {
          setSavedResultSnapshot(cloudSaved);
          setScreen((curr) => (curr === 'LANDING' ? 'RETURNING' : curr));
        }

        // Fetch usage
        const usage = await fetchUsageFromCloud(user.id);
        if (usage) setScanCount(usage.scanCount);
      }
    });

    return () => unsubscribe();
  }, []);

  // Top-level fail-closed guard for screen === 'RESULT'
  useEffect(() => {
    if (screen === 'RESULT') {
      if (!hasCompletedScan || !isProfileValid(activeProfile)) {
        const saved = getSavedResult();
        if (saved && isProfileValid(saved.profile)) {
          setScreen('RETURNING');
        } else {
          setScreen('LANDING');
        }
      }
    }
  }, [screen, hasCompletedScan, activeProfile]);

  const refreshSavedSnapshot = () => {
    const saved = getSavedResult();
    setSavedResultSnapshot(saved);
    if (!saved) {
      if (screen === 'RETURNING') {
        setScreen('LANDING');
      }
    }
  };

  const handleStartScan = () => {
    if (!isMatePassActive && scanCount >= MAX_FREE_SCANS) {
      setIsMatePassModalOpen(true);
      return;
    }
    setActiveProfile(EMPTY_PROFILE);
    setRawScanProfile(undefined);
    setProgressiveAnswers({});
    setHasCompletedScan(false);
    setRestoreError(null);
    setActiveScanStep(1);
    setScreen('SCAN');
  };

  const handleCompleteScan = async (formData: ScanFormProfile) => {
    setRawScanProfile(formData);
    const canonicalProfile = normalizeProfileToCanonical(formData);
    setActiveProfile(canonicalProfile);
    setHasCompletedScan(true);

    // Authoritative increment scan count
    const newCount = await incrementScanCount(currentUser?.id);
    setScanCount(newCount);

    trackEvent('profile_scan_completed');
    setScreen('LOADING');
  };

  const handleFinishLoading = () => {
    trackEvent('result_viewed');
    setScreen('RESULT');
  };

  const handleRestoreSavedResult = () => {
    const saved = getSavedResult();
    if (!saved || !saved.profile) {
      setRestoreError('Hasil tersimpan tidak bisa dipulihkan. Mulai scan baru.');
      setScreen('RETURNING');
      return;
    }

    const canonicalProfile = normalizeProfileToCanonical(saved.profile);
    if (!isProfileValid(canonicalProfile)) {
      setRestoreError('Hasil tersimpan tidak bisa dipulihkan. Mulai scan baru.');
      setScreen('RETURNING');
      return;
    }

    const restoredProgressive = { ...(saved.progressiveAnswers || {}) };
    if (saved.selectedCategory && !restoredProgressive.bca_category_selected) {
      restoredProgressive.bca_category_selected = saved.selectedCategory;
    }

    // Populates activeProfile and progressive answers first, then shows Loading, then Result
    // Live deterministic eligibility and Fit Score calculations are re-computed dynamically against current rules
    setActiveProfile(canonicalProfile);
    setProgressiveAnswers(restoredProgressive);
    setHasCompletedScan(true);
    setRestoreError(null);
    setScreen('LOADING');
    trackEvent('saved_result_restored', { savedAt: saved.savedAt });
  };

  const handleNewScanFromSaved = () => {
    if (!isMatePassActive && scanCount >= MAX_FREE_SCANS) {
      setIsMatePassModalOpen(true);
      return;
    }
    // Keep saved snapshot in localStorage intact
    setActiveProfile(EMPTY_PROFILE);
    setRawScanProfile(undefined);
    setProgressiveAnswers({});
    setHasCompletedScan(false);
    setRestoreError(null);
    setActiveScanStep(1);
    setScreen('SCAN');
    trackEvent('new_scan_started_from_saved_state');
  };

  const handleRestart = () => {
    setActiveProfile(EMPTY_PROFILE);
    setRawScanProfile(undefined);
    setProgressiveAnswers({});
    setHasCompletedScan(false);
    setRestoreError(null);
    setActiveScanStep(1);
    refreshSavedSnapshot();

    const saved = getSavedResult();
    if (saved && isProfileValid(saved.profile)) {
      setScreen('RETURNING');
    } else {
      setScreen('LANDING');
    }
    trackEvent('landing_view');
  };

  const handleEditProfile = () => {
    if (!isMatePassActive && scanCount >= MAX_FREE_SCANS) {
      setIsMatePassModalOpen(true);
      return;
    }
    setActiveScanStep(1);
    setScreen('SCAN');
  };

  const handleBackToLanding = () => {
    refreshSavedSnapshot();
    const saved = getSavedResult();
    if (saved && isProfileValid(saved.profile)) {
      setScreen('RETURNING');
    } else {
      setScreen('LANDING');
    }
  };

  const handleProgressiveAnswersChange = (newAnswers: Record<string, any>) => {
    setProgressiveAnswers(newAnswers);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-start font-sans antialiased text-[#111111] selection:bg-[#EBF5FC] selection:text-[#1F8ED8] sm:py-6">
      {/* Container optimized for mobile (390px) while looking polished on larger screens */}
      <div
        className="w-full max-w-lg bg-white min-h-screen sm:min-h-[840px] sm:rounded-3xl sm:border sm:border-[#E2E8F0] sm:shadow-sm flex flex-col overflow-hidden"
        id="app-viewport-card"
      >
        <MatePassModal
          isOpen={isMatePassModalOpen}
          onClose={() => setIsMatePassModalOpen(false)}
          activePassTier={activePassTier}
          onActivatePass={(tier) => {
            setActivePassTier(tier);
            localStorage.setItem('scholarmate_active_pass_tier', tier);
            localStorage.setItem('scholarmate_mate_pass_active', 'true');
          }}
          onDeactivatePass={() => {
            setActivePassTier('NONE');
            localStorage.removeItem('scholarmate_active_pass_tier');
            localStorage.removeItem('scholarmate_mate_pass_active');
          }}
        />

        {(screen === 'LANDING' || screen === 'RETURNING') && (
          <div className="flex flex-col flex-1">
            {restoreError && (
              <div className="mx-4 mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl text-center">
                {restoreError}
              </div>
            )}
            <LandingView
              onStartScan={handleStartScan}
              hasSavedResult={screen === 'RETURNING' && savedResultSnapshot !== null}
              savedAtTimestamp={savedResultSnapshot?.savedAt}
              savedUserEmail={currentUser?.email || undefined}
              currentUser={currentUser}
              onRestoreSavedResult={handleRestoreSavedResult}
              onNewScanFromSaved={handleNewScanFromSaved}
              onGoogleSignInClick={() => setIsLandingLoginModalOpen(true)}
              onSignOut={async () => {
                await authService.signOut();
                clearSavedResult();
                setSavedResultSnapshot(null);
                setScreen('LANDING');
              }}
              onOpenMyScholarships={() => setIsMyScholarshipsModalOpen(true)}
            />

            {/* Landing Google Login Modal */}
            <SaveGateModal
              isOpen={isLandingLoginModalOpen}
              onClose={() => setIsLandingLoginModalOpen(false)}
              onGoogleSignInSuccess={async (user) => {
                setIsLandingLoginModalOpen(false);
                const cloudSaved = await fetchSavedResultFromCloud(user.id);
                if (cloudSaved && isProfileValid(cloudSaved.profile)) {
                  setSavedResultSnapshot(cloudSaved);
                  setScreen('RETURNING');
                }
              }}
              isAuthenticated={currentUser !== null}
              currentUser={currentUser}
            />
          </div>
        )}

        {screen === 'SCAN' && (
          <ProfileScanView
            initialProfile={canonicalToScanFormProfile(activeProfile)}
            initialStep={activeScanStep}
            onComplete={handleCompleteScan}
            onBackToLanding={handleBackToLanding}
          />
        )}

        {screen === 'LOADING' && <LoadingView onFinish={handleFinishLoading} />}

        {screen === 'RESULT' && hasCompletedScan && isProfileValid(activeProfile) && (
          <MockResultView
            profile={activeProfile}
            rawScanProfile={rawScanProfile}
            initialProgressiveAnswers={progressiveAnswers}
            onProgressiveAnswersChange={handleProgressiveAnswersChange}
            viewMode={screen}
            hasCompletedScan={hasCompletedScan}
            onRestart={handleRestart}
            onEditProfile={handleEditProfile}
            onSavedSnapshotChanged={refreshSavedSnapshot}
            onOpenMyScholarships={() => setIsMyScholarshipsModalOpen(true)}
            activePassTier={activePassTier}
            onActivatePass={(tier) => {
              setActivePassTier(tier);
              localStorage.setItem('scholarmate_active_pass_tier', tier);
              localStorage.setItem('scholarmate_mate_pass_active', 'true');
            }}
          />
        )}

        {/* Global My Scholarships Modal */}
        <MyScholarshipsModal
          isOpen={isMyScholarshipsModalOpen}
          onClose={() => setIsMyScholarshipsModalOpen(false)}
        />
      </div>
    </div>
  );
}
