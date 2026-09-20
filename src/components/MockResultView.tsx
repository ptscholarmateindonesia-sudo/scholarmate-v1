import React, { useState, useMemo, useEffect } from 'react';
import { NotificationCenter, Notification } from './NotificationCenter.tsx';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  RotateCcw,
  SlidersHorizontal,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Calendar,
  ShieldCheck,
  X,
  ExternalLink,
  HelpCircle,
  Clock,
  Sparkles,
  Info,
  AlertCircle,
  Target,
  FileText,
  UserCheck,
  Bookmark,
  LogOut,
  User as UserIcon,
  Zap,
  Lock,
  Edit,
  Library,
  Search,
} from 'lucide-react';
import { 
  ScholarshipProfile, 
  AppViewMode, 
  normalizeProfileToCanonical, 
  trackEvent, 
  MAX_FREE_MATCHES, 
  MAX_FREE_AI_ACTIONS,
  FREE_CORRECTION_WINDOW_MS
} from '../types.ts';
import { ScholarMateLogo } from './ScholarMateLogo.tsx';
import { EvidenceLibrary } from './EvidenceLibrary.tsx';
import { addFocusedScholarship, getMyFocusedScholarships } from '../lib/myScholarshipsService.ts';
import { getDeadlineRelativeStatus } from '../lib/deadlineHelper.ts';
import { getEssayDrafts } from '../lib/essayWorkspaceService.ts';
import { generateScholarshipChecklist } from '../lib/scholarshipChecklist.ts';
import {
  runEligibilityEngine,
  calculateProfileReadiness,
  enrichProfileWithCampusAndMajor,
  formatPassedRuleSummary,
  EvaluatedScholarship,
  UserProfileData,
  humanFieldLabel,
  PROGRESSIVE_FIELD_PRIORITY,
} from '../lib/eligibilityEngine.ts';
import { formatExcelDate, Scholarship } from '../data/scholarships.ts';
import { PROGRESSIVE_QUESTIONS, ProgressiveQuestion } from '../data/progressiveQuestions.ts';
import {
  evaluateScholarshipFit,
  sortActionableEvaluations,
  computeGlobalBiggestGap,
  computeGlobalRecommendedNextAction,
  FitAnalysisResult,
  FIT_DISCLAIMER,
} from '../lib/fitAnalysis.ts';
import {
  fetchPersonalization,
  getDeterministicFallbacks,
  PersonalizationOutput,
  PersonalizationState,
} from '../lib/aiPersonalization.ts';
import { authService, AuthUser, AuthState } from '../lib/authService.ts';
import {
  saveResult,
  saveResultAsync,
  getSavedResult,
  clearSavedResult,
  SaveStatus,
  SavedResultSnapshot,
  isProfileValid,
  computeProfileFingerprint,
} from '../lib/saveService.ts';
import { incrementAiActionCount, validateCorrectionServer } from '../lib/usageService.ts';
import { SaveGateModal } from './SaveGateModal.tsx';
import { MatePassModal } from './MatePassModal.tsx';
import { DebugPanel } from './DebugPanel.tsx';
import { FocusReminderBox } from './FocusReminderBox.tsx';
import { EssayWorkspaceModal } from './EssayWorkspaceModal.tsx';

function formatFlag(val: boolean | null | undefined): string {
  if (val === true) return 'TRUE';
  if (val === false) return 'FALSE';
  return 'UNKNOWN';
}

export type ProgressiveStep =
  | {
      type: 'QUESTION';
      question: ProgressiveQuestion;
    }
  | {
      type: 'DISABILITY_CHOICE_PROMPT';
    };

function getNextProgressiveStep(
  evalSch: EvaluatedScholarship,
  answers: Record<string, any>,
  showDisabilityOption: boolean
): ProgressiveStep | null {
  // If BCA universal status failed, stop progressive questioning immediately
  if (evalSch.scholarship.id === 'BCA-BAKTI-2027' && evalSch.universalStatus === 'FAIL') {
    return null;
  }

  // If BAZNAS (BCB-2026): category pathway flow (Prestasi -> Aktivis -> Optional Disability)
  if (evalSch.scholarship.id === 'BCB-2026') {
    // 1. Prestasi tingkat nasional/internasional
    if (answers['has_national_international_achievement'] === undefined) {
      const q = PROGRESSIVE_QUESTIONS.find((pq) => pq.fieldKey === 'has_national_international_achievement');
      if (q) return { type: 'QUESTION', question: q };
    }
    // 2. Aktivis organisasi
    if (
      answers['has_national_international_achievement'] === false &&
      answers['is_student_activist'] === undefined
    ) {
      const q = PROGRESSIVE_QUESTIONS.find((pq) => pq.fieldKey === 'is_student_activist');
      if (q) return { type: 'QUESTION', question: q };
    }
    // 3. Both regular pathways declined: offer disability pathway explicitly
    if (
      answers['has_national_international_achievement'] === false &&
      answers['is_student_activist'] === false &&
      answers['has_disability'] === undefined
    ) {
      if (!showDisabilityOption) {
        return { type: 'DISABILITY_CHOICE_PROMPT' };
      } else {
        const q = PROGRESSIVE_QUESTIONS.find((pq) => pq.fieldKey === 'has_disability');
        if (q) return { type: 'QUESTION', question: q };
      }
    }
  }

  // If JAPFA (JAPFA-EXT-2026-B2): progressive activity verification
  if (evalSch.scholarship.id === 'JAPFA-EXT-2026-B2') {
    const hasOrg = answers['has_organization'] === true;
    const hasVol = answers['has_volunteer'] === true;
    // If user already has org or volunteer, activity requirement is fulfilled
    if (!hasOrg && !hasVol) {
      // Ask competition first
      if (answers['has_competition_experience'] === undefined) {
        const q = PROGRESSIVE_QUESTIONS.find((pq) => pq.fieldKey === 'has_competition_experience');
        if (q) return { type: 'QUESTION', question: q };
      }
      // If competition answered false, ask community initiative
      if (
        answers['has_competition_experience'] === false &&
        answers['has_community_initiative'] === undefined
      ) {
        const q = PROGRESSIVE_QUESTIONS.find((pq) => pq.fieldKey === 'has_community_initiative');
        if (q) return { type: 'QUESTION', question: q };
      }
      // If all activity branches answered false, stop
      if (
        answers['has_competition_experience'] === false &&
        answers['has_community_initiative'] === false
      ) {
        return null;
      }
    }
  }

  // General missing keys sorted by PROGRESSIVE_FIELD_PRIORITY
  const missingKeys = evalSch.missingFieldKeys.filter((k) => {
    if (answers[k] !== undefined && answers[k] !== null && answers[k] !== '') return false;
    if (k === 'has_disability') return false; // Never ask automatically
    return true;
  });

  const sortedKeys = [...missingKeys].sort((a, b) => {
    const pA = PROGRESSIVE_FIELD_PRIORITY[a] ?? 50;
    const pB = PROGRESSIVE_FIELD_PRIORITY[b] ?? 50;
    return pA - pB;
  });

  for (const key of sortedKeys) {
    const q = PROGRESSIVE_QUESTIONS.find((pq) => pq.fieldKey === key);
    if (q) return { type: 'QUESTION', question: q };
  }

  return null;
}

interface MockResultViewProps {
  profile: ScholarshipProfile;
  rawScanProfile?: Record<string, any>;
  initialProgressiveAnswers?: Record<string, any>;
  onProgressiveAnswersChange?: (answers: Record<string, any>) => void;
  isRestoredWithNewData?: boolean;
  viewMode?: AppViewMode;
  hasCompletedScan?: boolean;
  onRestart: () => void;
  onEditProfile: () => void;
  onSavedSnapshotChanged?: () => void;
  onOpenMyScholarships?: () => void;
  activePassTier?: 'NONE' | 'MATE_PASS' | 'MATE_PLUS';
  onActivatePass?: (tier: 'MATE_PASS' | 'MATE_PLUS') => void;
}

export function MockResultView({
  profile,
  rawScanProfile,
  initialProgressiveAnswers,
  onProgressiveAnswersChange,
  isRestoredWithNewData,
  viewMode = 'RESULT',
  hasCompletedScan = true,
  onRestart,
  onEditProfile,
  onSavedSnapshotChanged,
  onOpenMyScholarships,
  activePassTier: propsActivePassTier = 'NONE',
  onActivatePass: propsOnActivatePass,
}: MockResultViewProps) {
  // State for additional progressive answers provided in this session
  const [progressiveAnswers, setProgressiveAnswers] = useState<Record<string, any>>(
    initialProgressiveAnswers || {}
  );

  // Keep progressive answers synced when initial answers change (e.g. restore)
  useEffect(() => {
    if (initialProgressiveAnswers) {
      setProgressiveAnswers(initialProgressiveAnswers);
    }
  }, [initialProgressiveAnswers]);

  // --- CORE ANALYTICAL HOOKS (Initialization Priority) ---
  
  // 1. Map canonical profile directly to UserProfileData
  const baseUserProfile: UserProfileData = useMemo(() => {
    return normalizeProfileToCanonical(profile);
  }, [profile]);

  // 2. Enrich profile with campus mapping and major group
  const enrichedUserProfile: UserProfileData = useMemo(() => {
    const { engineProfile } = enrichProfileWithCampusAndMajor(baseUserProfile);
    return engineProfile;
  }, [baseUserProfile]);

  // 3. Merge base enriched profile with progressive answers collected in result view
  const mergedUserProfile: UserProfileData = useMemo(() => {
    return {
      ...enrichedUserProfile,
      ...progressiveAnswers,
    };
  }, [enrichedUserProfile, progressiveAnswers]);

  // Core profile validity validation check directly on the authoritative profile prop
  const profileCoreComplete = useMemo(() => isProfileValid(profile), [profile]);

  // 4. Run deterministic eligibility engine across active scholarship database
  const evaluatedScholarships: EvaluatedScholarship[] = useMemo(() => {
    if (!profileCoreComplete) return [];
    return runEligibilityEngine(mergedUserProfile);
  }, [profileCoreComplete, mergedUserProfile]);

  // 5. Compute Fit Score & Fit Analysis for each evaluated scholarship
  const fitAnalysisMap = useMemo(() => {
    if (!profileCoreComplete) return {};
    const map: Record<string, FitAnalysisResult | null> = {};
    const derivedFields = {
      university_type: mergedUserProfile.university_type,
      major_group: mergedUserProfile.major_group,
      verified_partner: mergedUserProfile.verified_partner,
    };
    evaluatedScholarships.forEach((evalSch) => {
      map[evalSch.scholarship.id] = evaluateScholarshipFit(evalSch, mergedUserProfile, derivedFields);
    });
    return map;
  }, [profileCoreComplete, evaluatedScholarships, mergedUserProfile]);

  // 7. Calculate Deterministic Profile Readiness Score (0-100)
  const readinessScore = useMemo(() => {
    if (!profileCoreComplete) return 0;
    return calculateProfileReadiness(mergedUserProfile);
  }, [profileCoreComplete, mergedUserProfile]);

  // Mate Pass & Mate Plus Configuration
  const activePassTier = propsActivePassTier;
  const isMatePassActive = activePassTier !== 'NONE';

  // 7. Sort active evaluations deterministically & enforce display limit
  const allSortedActiveEvaluations = useMemo(() => {
    if (!profileCoreComplete) return [];
    return sortActionableEvaluations(evaluatedScholarships, fitAnalysisMap as any);
  }, [profileCoreComplete, evaluatedScholarships, fitAnalysisMap]);

  const sortedActiveEvaluations = allSortedActiveEvaluations;

  // --- UI STATE & HANDLERS ---
  const [isMatePassModalOpen, setIsMatePassModalOpen] = useState<boolean>(false);
  const [modalInitialTier, setModalInitialTier] = useState<'MATE_PASS' | 'MATE_PLUS'>('MATE_PLUS');

  // Save Result & Local Dev Auth State Model - starts strictly as UNSAVED
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('UNSAVED');
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ title: string; subtitle: string } | null>(null);

  // State for modals
  const [activeDetailScholarship, setActiveDetailScholarship] = useState<EvaluatedScholarship | null>(null);
  const [activeFitDetail, setActiveFitDetail] = useState<FitAnalysisResult | null>(null);
  const [activeProgressiveTarget, setActiveProgressiveTarget] = useState<EvaluatedScholarship | null>(null);
  const [showDisabilityOption, setShowDisabilityOption] = useState<boolean>(false);
  const [showClosedSection, setShowClosedSection] = useState(false);
  const [showNotEligibleSection, setShowNotEligibleSection] = useState(false);
  const [showDebugSection, setShowDebugSection] = useState(false);
  const [showNextActionModal, setShowNextActionModal] = useState(false);

  // Progressive Question Input state
  const [currentQuestionValue, setCurrentQuestionValue] = useState<string>('');

  const handleActivatePass = (tier: 'MATE_PASS' | 'MATE_PLUS') => {
    if (propsOnActivatePass) {
      propsOnActivatePass(tier);
    }
    const isPlus = tier === 'MATE_PLUS';
    setToastMessage({
      title: isPlus ? 'Mate Plus Aktif!' : 'Mate Pass Aktif!',
      subtitle: isPlus
        ? 'Akses 30 hari aktif. Semua beasiswa, Full Fit Analysis, dan AI terbuka penuh untuk multi beasiswa.'
        : 'Akses 7 hari aktif. Semua beasiswa, Full Fit Analysis, dan AI terbuka penuh.',
    });
    setShowToast(true);
    setTimeout(() => setShowToast(false), 4500);
  };

  const handleDeactivatePass = () => {
    // Note: Deactivation usually managed in App.tsx, but kept here for local state consistency if needed
    const _isPlus = activePassTier === 'MATE_PLUS';
  };

  // Aliases for compatibility
  const handleActivateMatePass = () => handleActivatePass('MATE_PASS');
  const handleDeactivateMatePass = handleDeactivatePass;

  const handleFocusScholarship = (
    scholarship: { id: string; name: string; provider: string; deadline: any; educationLevel?: string; fundingType?: string },
    evalSch: EvaluatedScholarship,
    actionType: 'prepare' | 'check'
  ) => {
    const currentFocused = getMyFocusedScholarships();
    const isAlreadyFocused = currentFocused.some((i) => i.id === scholarship.id);
    if (!isMatePassActive && !isAlreadyFocused && currentFocused.length >= MAX_FREE_MATCHES) {
      setIsMatePassModalOpen(true);
      setToastMessage({
        title: `Batas Tracker Free (Maks ${MAX_FREE_MATCHES} Beasiswa)`,
        subtitle: 'Upgrade ke Mate Pass atau Mate Plus untuk unlimited tracking beasiswa!',
      });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
      return;
    }

    addFocusedScholarship({
      id: scholarship.id,
      title: scholarship.name,
      sponsor: scholarship.provider,
      deadline: formatExcelDate(scholarship.deadline),
      degree: scholarship.educationLevel,
      fundingType: scholarship.fundingType,
    });

    if (actionType === 'prepare') {
      trackEvent('prepare_scholarship_clicked', { scholarshipId: scholarship.id });
      setActiveDetailScholarship(evalSch);
    } else if (actionType === 'check') {
      handleOpenProgressiveCheck(evalSch);
    }
  };

  // Free Limits Configuration
  const [aiRequestedCards, setAiRequestedCards] = useState<Set<string>>(new Set());

  // AI Personalization state (Step 7B)
  const [enableAiPersonalization, setEnableAiPersonalization] = useState<boolean>(true);
  const [simulateError, setSimulateError] = useState<string | undefined>(undefined);
  const [aiOutputs, setAiOutputs] = useState<Record<string, PersonalizationOutput>>({});
  const [aiStates, setAiStates] = useState<Record<string, Partial<PersonalizationState>>>({});

  // Pending snapshot for Save Gate modal flow
  const [pendingSaveSnapshot, setPendingSaveSnapshot] = useState<SavedResultSnapshot | null>(null);

  // Notification Center State
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Workspace State
  const [activeWorkspace, setActiveWorkspace] = useState<{ id: string; title: string } | null>(null);

  const handleOpenWorkspace = (id: string, title: string) => {
    if (!isMatePassActive) {
      const drafts = getEssayDrafts();
      const draftIds = Object.keys(drafts);
      const isExisting = draftIds.includes(id);
      
      if (!isExisting && draftIds.length >= 1) {
        setIsMatePassModalOpen(true);
        setToastMessage({
          title: 'Batas 1 Essay Draft Aktif (Free)',
          subtitle: 'Upgrade ke Mate Pass atau Mate Plus untuk menulis essay untuk semua beasiswa!',
        });
        setShowToast(true);
        setTimeout(() => setShowToast(false), 5000);
        return;
      }
    }
    setActiveWorkspace({ id, title });
  };
  const [isEvidenceLibraryOpen, setIsEvidenceLibraryOpen] = useState(false);

  // Generate smart notifications based on results
  useEffect(() => {
    setNotifications(prev => {
      const generated: Notification[] = [
        {
          id: 'welcome',
          title: 'Selamat Datang!',
          message: 'ScholarMate siap membantumu menemukan beasiswa impian. Cek rekomendasi di bawah.',
          type: 'INFO',
          timestamp: 'Tadi',
          isRead: false
        }
      ];

      // Check for urgent deadlines
      sortedActiveEvaluations.slice(0, 5).forEach(evalSch => {
        const deadlineStatus = getDeadlineRelativeStatus(evalSch.scholarship.deadline);
        if (deadlineStatus.isUrgent) {
          generated.push({
            id: `deadline-${evalSch.scholarship.id}`,
            title: 'Deadline Mendekat!',
            message: `Beasiswa ${evalSch.scholarship.name} akan ditutup dalam ${deadlineStatus.daysLeft} hari.`,
            type: 'URGENT',
            timestamp: 'Baru saja',
            isRead: false,
            link: evalSch.scholarship.id
          });
        }
      });

      // --- Profile Blocker Consolidation ---
      evaluatedScholarships.filter(e => e.status === 'NOT_ELIGIBLE').forEach(evalSch => {
        if (evalSch.failedRules.length > 0) {
          const blockerLabels = evalSch.failedRules.map(fr => humanFieldLabel(fr.rule.profileField));
          const uniqueBlockers = Array.from(new Set(blockerLabels));
          
          generated.push({
            id: `blocker-${evalSch.scholarship.id}`,
            title: 'Kendala Profil!',
            message: `Profilmu belum memenuhi ${uniqueBlockers.length} kriteria ${evalSch.scholarship.name}: ${uniqueBlockers.join(', ')}.`,
            type: 'INFO',
            timestamp: 'Tadi',
            isRead: false,
            link: evalSch.scholarship.id
          });
        }
      });

      // --- Task Reminders ---
      const focusedList = getMyFocusedScholarships();
      focusedList.forEach(item => {
        const evalSch = evaluatedScholarships.find(e => e.scholarship.id === item.id);
        if (evalSch && (item.status === 'Tertarik' || item.status === 'Sedang Persiapan')) {
          const tasks: string[] = [];
          const needsEssay = evalSch.scholarship.essayRequired !== 'NO';
          const hasPsychometric = evalSch.scholarship.selectionStages?.some(s => 
            s.toLowerCase().includes('psikotes') || s.toLowerCase().includes('psychometric')
          );
          const hasFgd = evalSch.scholarship.selectionStages?.some(s => 
            s.toLowerCase().includes('fgd') || s.toLowerCase().includes('group discussion')
          );
          const essayCheck = evalSch.applicationChecks.find(c => c.field.includes('essay') || c.field.includes('motivation'));
          const docCheck = evalSch.applicationChecks.find(c => c.field.includes('document') || c.field.includes('certificate'));
          
          if (needsEssay && (!essayCheck || essayCheck.status === 'FAIL')) tasks.push('Essay belum selesai');
          if (!docCheck || docCheck.status === 'FAIL') tasks.push('Dokumen belum lengkap');
          if (hasPsychometric || hasFgd) tasks.push('FGD/psychometric belum disiapkan');

          if (tasks.length > 0) {
            generated.push({
              id: `tasks-${item.id}`,
              title: `Reminder: ${item.title}`,
              message: tasks.join(', '),
              type: 'INFO',
              timestamp: 'Tadi',
              isRead: false,
              link: item.id
            });
          }
        }
      });

      // Check for readiness
      if (readinessScore > 0 && readinessScore < 70) {
        generated.push({
          id: 'readiness-tip',
          title: 'Tingkatkan Kesiapan',
          message: 'Skor kesiapanmu masih di bawah 70%. Lengkapilah profil untuk hasil matching yang lebih akurat.',
          type: 'INFO',
          timestamp: '1 jam lalu',
          isRead: false
        });
      }

      // Merge with deduplication and state preservation
      const nextState = [...prev];
      generated.forEach(gen => {
        const existingIdx = nextState.findIndex(n => n.id === gen.id);
        if (existingIdx === -1) {
          nextState.push(gen);
        } else {
          // Update message if it changed, but keep isRead and snoozedUntil
          if (nextState[existingIdx].message !== gen.message) {
            nextState[existingIdx] = { ...nextState[existingIdx], message: gen.message };
          }
        }
      });
      return nextState;
    });
  }, [sortedActiveEvaluations.length, readinessScore]);

  const handleMarkAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const handleClearAll = () => {
    setNotifications([]);
  };

  const handleSnooze = (id: string, duration: '1d' | '3d' | 'morning') => {
    let snoozeTime = Date.now();
    if (duration === '1d') {
      snoozeTime += 24 * 60 * 60 * 1000;
    } else if (duration === '3d') {
      snoozeTime += 3 * 24 * 60 * 60 * 1000;
    } else if (duration === 'morning') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(7, 0, 0, 0);
      snoozeTime = tomorrow.getTime();
    }

    setNotifications(prev => prev.map(n => n.id === id ? { ...n, snoozedUntil: snoozeTime } : n));
  };

  // 8. Compute count of opportunities
  const opportunityCount = useMemo(() => {
    if (!profileCoreComplete) return 0;
    return allSortedActiveEvaluations.filter(
      (e) => e.status === 'ELIGIBLE' || e.status === 'NEEDS_CHECK'
    ).length;
  }, [profileCoreComplete, allSortedActiveEvaluations]);

  // 9. Compute stats for non-matches
  const notEligibleActiveCount = useMemo(() => {
    if (!profileCoreComplete) return 0;
    return allSortedActiveEvaluations.filter((e) => e.status === 'NOT_ELIGIBLE').length;
  }, [profileCoreComplete, allSortedActiveEvaluations]);

  const needsRecheckActiveCount = useMemo(() => {
    if (!profileCoreComplete) return 0;
    return allSortedActiveEvaluations.filter((e) => e.status === 'NEEDS_RECHECK').length;
  }, [profileCoreComplete, allSortedActiveEvaluations]);

  // 9b. Extract all not eligible scholarships (always transparently accessible for free)
  const notEligibleEvaluations = useMemo(() => {
    if (!profileCoreComplete) return [];
    return evaluatedScholarships.filter((e) => e.status === 'NOT_ELIGIBLE');
  }, [profileCoreComplete, evaluatedScholarships]);

  // 10. Extract closed relevant scholarships
  const closedRelevantEvaluations = useMemo(() => {
    if (!profileCoreComplete) return [];
    return evaluatedScholarships.filter((e) => (e.status as string) === 'CLOSED_RELEVANT');
  }, [profileCoreComplete, evaluatedScholarships]);

  // 11. Top Recommendation (First actionable opportunity)
  const topActionableScholarship = profileCoreComplete ? sortedActiveEvaluations[0] || null : null;
  const topActionableFit = topActionableScholarship
    ? fitAnalysisMap[topActionableScholarship.scholarship.id] || null
    : null;

  // 12. Global Biggest Gap
  const globalBiggestGap = useMemo(() => {
    if (!profileCoreComplete) return { main: '', isClean: true };
    return computeGlobalBiggestGap(allSortedActiveEvaluations, mergedUserProfile, fitAnalysisMap as any);
  }, [profileCoreComplete, allSortedActiveEvaluations, mergedUserProfile, fitAnalysisMap]);

  // 13. Global Recommended Next Action
  const globalNextAction = useMemo(() => {
    if (!profileCoreComplete) {
      return {
        actionType: 'BUILD_PROFILE' as const,
        title: 'Lengkapi Profil',
        reason: 'Lengkapi profil scan terlebih dahulu.',
        buttonLabel: 'Lengkapi Profil',
      };
    }
    return computeGlobalRecommendedNextAction(allSortedActiveEvaluations, mergedUserProfile, fitAnalysisMap as any);
  }, [profileCoreComplete, allSortedActiveEvaluations, mergedUserProfile, fitAnalysisMap]);

  // Auth state subscription
  const [authState, setAuthState] = useState<AuthState>(() => authService.getAuthState());

  useEffect(() => {
    const unsubscribe = authService.subscribe((state) => {
      setAuthState(state);
    });
    return () => unsubscribe();
  }, []);

  // Deterministic Fingerprint Engine on the authoritative profile prop
  const activeProfileFingerprint = useMemo(() => {
    return computeProfileFingerprint(profile, progressiveAnswers);
  }, [profile, progressiveAnswers]);

  const savedSnapshot = getSavedResult();

  const savedProfileFingerprint = useMemo(() => {
    if (!savedSnapshot) return null;
    return computeProfileFingerprint(savedSnapshot.profile, savedSnapshot.progressiveAnswers);
  }, [savedSnapshot, saveStatus]);

  const fingerprintMatch = useMemo(() => {
    if (activeProfileFingerprint === null || savedProfileFingerprint === null) {
      return false;
    }
    return activeProfileFingerprint === savedProfileFingerprint;
  }, [activeProfileFingerprint, savedProfileFingerprint]);

  // Derive public save status strictly based on facts
  useEffect(() => {
    if (saveStatus === 'SAVING') return;

    const savedValid = savedSnapshot ? isProfileValid(savedSnapshot.profile) : false;
    const activeValid = isProfileValid(profile);

    const isSaved =
      authState === 'AUTHENTICATED' &&
      activeValid &&
      hasCompletedScan &&
      savedValid &&
      activeProfileFingerprint !== null &&
      savedProfileFingerprint !== null &&
      activeProfileFingerprint === savedProfileFingerprint;

    if (isSaved) {
      if (saveStatus !== 'SAVED') {
        setSaveStatus('SAVED');
      }
    } else {
      if (saveStatus === 'SAVED') {
        if (savedSnapshot && !fingerprintMatch && activeValid) {
          setSaveStatus('UNSAVED_CHANGES');
        } else {
          setSaveStatus('UNSAVED');
        }
      } else if (savedSnapshot && !fingerprintMatch && activeValid) {
        if (saveStatus !== 'UNSAVED_CHANGES') {
          setSaveStatus('UNSAVED_CHANGES');
        }
      } else if (!savedSnapshot || fingerprintMatch || !activeValid) {
        if (saveStatus !== 'UNSAVED' && saveStatus !== 'SAVE_ERROR') {
          setSaveStatus('UNSAVED');
        }
      }
    }
  }, [
    authState,
    profile,
    hasCompletedScan,
    savedSnapshot,
    activeProfileFingerprint,
    savedProfileFingerprint,
    fingerprintMatch,
    saveStatus,
  ]);

  // Helper to construct a valid snapshot from current state
  const createCurrentSnapshot = (): SavedResultSnapshot => {
    const user = authService.getCurrentUser();
    return {
      version: 'v0',
      profileSchemaVersion: 'snake_case_v1',
      savedAt: new Date().toISOString(),
      savedByUserId: user?.id,
      profile: normalizeProfileToCanonical(profile),
      derivedProfile: {
        university_type: mergedUserProfile.university_type || undefined,
        major_group: mergedUserProfile.major_group || undefined,
        verified_partner: mergedUserProfile.verified_partner || undefined,
      },
      results: sortedActiveEvaluations.map((e) => ({
        scholarshipId: e.scholarship.id,
        finalState: e.status,
        selectedCategory: mergedUserProfile.bca_category_selected || undefined,
        fitScore: fitAnalysisMap[e.scholarship.id]?.totalFitScore || 0,
        evidenceCoverage: fitAnalysisMap[e.scholarship.id]?.evidenceCoverage || 0,
        fitLabel: fitAnalysisMap[e.scholarship.id]?.fitLabel,
        biggestRelevantGap: globalBiggestGap.main,
        deterministicNextAction: globalNextAction.reason,
      })),
      progressiveAnswers,
      topRecommendationId: topActionableScholarship?.scholarship.id,
      profileReadiness: readinessScore,
    };
  };

  // Save handler logic
  const performSave = async (overrideUser?: AuthUser | null, snapshotToSave?: SavedResultSnapshot | null) => {
    if (!profileCoreComplete) {
      setToastMessage({
        title: 'Hasil belum bisa disimpan',
        subtitle: 'Lengkapi profil scan terlebih dahulu.',
      });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
      return;
    }

    setSaveStatus('SAVING');
    const user = overrideUser !== undefined ? overrideUser : authService.getCurrentUser();
    const snapshot: SavedResultSnapshot = snapshotToSave || createCurrentSnapshot();

    const success = await saveResultAsync(snapshot, user?.id);
    if (success) {
      setSaveStatus('SAVED');
      setPendingSaveSnapshot(null);
      if (onSavedSnapshotChanged) onSavedSnapshotChanged();
      trackEvent('result_saved', { user_id: user?.id });

      setToastMessage(
        user
          ? {
              title: 'Hasil tersimpan ke Cloud Firestore',
              subtitle: `Tersinkronisasi dengan akun Google (${user.email || user.displayName || 'Pengguna'}).`,
            }
          : {
              title: 'Hasil tersimpan di perangkat',
              subtitle: 'Kamu bisa lanjut lagi dari progres terakhir di browser ini.',
            }
      );
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
    } else {
      setSaveStatus('SAVE_ERROR');
    }
  };

  const handleSaveButtonClick = () => {
    trackEvent('save_result_clicked', { current_save_status: saveStatus });
    if (!profileCoreComplete) {
      setToastMessage({
        title: 'Hasil belum bisa disimpan',
        subtitle: 'Lengkapi profil scan terlebih dahulu.',
      });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
      return;
    }

    const snapshot = createCurrentSnapshot();
    const user = authService.getCurrentUser();

    if (user && authState === 'AUTHENTICATED') {
      performSave(user, snapshot);
    } else {
      setPendingSaveSnapshot(snapshot);
      trackEvent('save_gate_viewed');
      setIsSaveModalOpen(true);
    }
  };

  const handleGoogleSignInSuccess = async (user: AuthUser) => {
    trackEvent('google_signin_completed', { user_id: user.id });
    await performSave(user, pendingSaveSnapshot || createCurrentSnapshot());
    setIsSaveModalOpen(false);
  };

  // Helper for Next Action CTA Button
  const handleNextActionButtonClick = () => {
    trackEvent('recommended_next_action_clicked', { action_type: globalNextAction.actionType });
    if (globalNextAction.scholarshipId) {
      const target = sortedActiveEvaluations.find(
        (e) => e.scholarship.id === globalNextAction.scholarshipId
      );
      if (target) {
        if (target.status === 'NEEDS_CHECK') {
          handleOpenProgressiveCheck(target);
          return;
        } else if (target.status === 'ELIGIBLE') {
          setShowNextActionModal(true);
          return;
        }
      }
    }
    // Fallback: edit profile
    onEditProfile();
  };

  const recommendedNextAction = useMemo(() => {
    return {
      text: globalNextAction.title,
      buttonLabel: globalNextAction.buttonLabel,
      onAction: handleNextActionButtonClick,
    };
  }, [globalNextAction, sortedActiveEvaluations]);

  // Progressive modal logic
  const handleOpenProgressiveCheck = (evalSch: EvaluatedScholarship) => {
    trackEvent('complete_check_clicked', { scholarshipId: evalSch.scholarship.id });
    setActiveProgressiveTarget(evalSch);
    setCurrentQuestionValue('');
  };

  const activeProgressiveStep = useMemo(() => {
    if (!activeProgressiveTarget) return null;
    const latestEval = evaluatedScholarships.find(
      (e) => e.scholarship.id === activeProgressiveTarget.scholarship.id
    );
    if (!latestEval) return null;
    return getNextProgressiveStep(latestEval, progressiveAnswers, showDisabilityOption);
  }, [activeProgressiveTarget, evaluatedScholarships, progressiveAnswers, showDisabilityOption]);

  const handleAnswerQuestion = (fieldKey: string, value: any) => {
    trackEvent('progressive_question_answered', { fieldKey, value });
    const updatedAnswers = {
      ...progressiveAnswers,
      [fieldKey]: value,
    };
    setProgressiveAnswers(updatedAnswers);
    if (onProgressiveAnswersChange) {
      onProgressiveAnswersChange(updatedAnswers);
    }
    setCurrentQuestionValue('');
  };

  const getBcaSummaryText = (sch: EvaluatedScholarship) => {
    if (sch.scholarship.id !== 'BCA-BAKTI-2027') {
      return sch.status === 'NEEDS_CHECK'
        ? 'Eligibility belum final karena masih ada data yang perlu dilengkapi.'
        : 'Semua kriteria dasar telah sesuai. Siapkan aplikasi sebelum batas waktu pendaftaran.';
    }

    if (sch.universalStatus === 'MISSING') {
      const missingLabels = (sch.missingUniversalFields || []).map(f => humanFieldLabel(f)).join(', ');
      return `Sebagian syarat dasar profilmu sudah sesuai. Kami masih membutuhkan beberapa data untuk menyelesaikan pengecekan${missingLabels ? ` (${missingLabels})` : ''}.`;
    }

    if (sch.universalStatus === 'PASS' && sch.categoryStatus === 'NOT_SELECTED') {
      return 'Syarat dasar profilmu sudah sesuai. Pilih kategori Beasiswa Bakti BCA untuk melanjutkan pengecekan.';
    }

    return sch.status === 'NEEDS_CHECK'
      ? 'Eligibility belum final karena masih ada data yang perlu dilengkapi.'
      : 'Semua kriteria dasar telah sesuai. Siapkan aplikasi sebelum batas waktu pendaftaran.';
  };

  const handleRequestAiExplanation = React.useCallback(async (schId: string) => {
    setAiRequestedCards(prev => {
      if (prev.has(schId)) return prev;
      if (!isMatePassActive && prev.size >= MAX_FREE_AI_ACTIONS) return prev;
      const next = new Set(prev);
      next.add(schId);
      return next;
    });

    if (!isMatePassActive && aiRequestedCards.size >= MAX_FREE_AI_ACTIONS && !aiRequestedCards.has(schId)) {
      return;
    }

    const evalSch = evaluatedScholarships.find(e => e.scholarship.id === schId);
    if (!evalSch) return;

    // Increment AI count usage
    await incrementAiActionCount(authService.getCurrentUser()?.id);
    
    const fit = fitAnalysisMap[schId] || null;

    setAiStates(prev => ({
      ...prev,
      [schId]: { callState: 'LOADING', enabled: true, secureRuntimeAvailable: true }
    }));

    fetchPersonalization(evalSch, mergedUserProfile, fit, globalNextAction, simulateError).then(res => {
      setAiOutputs(prev => ({ ...prev, [schId]: res.output }));
      setAiStates(prev => ({
        ...prev,
        [schId]: {
          enabled: true,
          secureRuntimeAvailable: true,
          ...res.state
        }
      }));
    });
  }, [isMatePassActive, evaluatedScholarships, fitAnalysisMap, mergedUserProfile, simulateError]);

  // Auto-request AI explanation for top recommendation on initial load (respect quota)
  React.useEffect(() => {
    if (sortedActiveEvaluations.length > 0 && aiRequestedCards.size === 0) {
      const topSchId = sortedActiveEvaluations[0].scholarship.id;
      handleRequestAiExplanation(topSchId);
    }
  }, [sortedActiveEvaluations, aiRequestedCards.size, handleRequestAiExplanation]);

  const renderAiPersonalizationBox = (evalSch: EvaluatedScholarship, fit: FitAnalysisResult | null) => {
    const schId = evalSch.scholarship.id;
    const isRequested = aiRequestedCards.has(schId);
    const aiState = aiStates[schId];
    const aiOutput = aiOutputs[schId] || getDeterministicFallbacks(evalSch, fit);
    const aiUsedCount = aiRequestedCards.size;
    const remainingAi = Math.max(0, MAX_FREE_AI_ACTIONS - aiUsedCount);

    if (!isRequested) {
      return (
        <div className="mt-3 p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5" id={`ai-request-box-${schId}`}>
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="text-xs text-indigo-950 font-medium">
              Dapatkan rekomendasi & analisis strategi personal dari AI
            </span>
          </div>
          {isMatePassActive ? (
            <button
              type="button"
              id={`btn-ai-request-${schId}`}
              onClick={() => handleRequestAiExplanation(schId)}
              className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white font-bold text-[11px] rounded-lg transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
            >
              <Zap className="w-3 h-3 fill-amber-300 text-amber-300" />
              <span>Minta Analisis AI (Mate Pass Unlimited)</span>
            </button>
          ) : remainingAi > 0 ? (
            <button
              type="button"
              id={`btn-ai-request-${schId}`}
              onClick={() => handleRequestAiExplanation(schId)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-[11px] rounded-lg transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
            >
              <Sparkles className="w-3 h-3 text-indigo-200" />
              <span>Minta Analisis AI ({remainingAi}/{MAX_FREE_AI_ACTIONS} tersisa)</span>
            </button>
          ) : (
            <button
              type="button"
              id={`btn-ai-continue-locked-${schId}`}
              onClick={() => {
                setModalInitialTier('MATE_PLUS');
                setIsMatePassModalOpen(true);
              }}
              className="px-3 py-1.5 bg-[#0B1E34] hover:bg-[#132A47] text-white font-bold text-[11px] rounded-lg transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
            >
              <Lock className="w-3 h-3 text-amber-300" />
              <span>Lanjut AI (Kuota Gratis Habis)</span>
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="mt-3 p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-xl space-y-2 text-xs" id={`ai-box-${schId}`}>
        <div className="flex items-center justify-between border-b border-indigo-200/60 pb-1.5">
          <div className="flex items-center gap-1.5 font-bold text-indigo-950">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
            <span>Rekomendasi Personal AI</span>
          </div>
          {isMatePassActive ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-100 to-indigo-100 text-indigo-950 font-bold border border-amber-300 flex items-center gap-1">
              <Zap className="w-3 h-3 fill-amber-500 text-amber-500" />
              Mate Pass Unlimited
            </span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-bold border border-indigo-200">
              AI Assistant ({aiUsedCount}/{MAX_FREE_AI_ACTIONS} kuota)
            </span>
          )}
        </div>

        {aiState?.callState === 'LOADING' ? (
          <div className="py-2 text-indigo-800/80 flex items-center gap-2 italic">
            <span className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span>Menyusun rekomendasi khusus profilmu...</span>
          </div>
        ) : (
          <div className="space-y-2 text-slate-800">
            <div>
              <span className="font-bold text-indigo-950 block text-[11px] uppercase tracking-wider">
                Mengapa Cocok Untukmu:
              </span>
              <p className="mt-0.5 leading-relaxed text-[#111111]">{aiOutput.shortFitExplanation}</p>
            </div>

            <div>
              <span className="font-bold text-indigo-950 block text-[11px] uppercase tracking-wider">
                Langkah Persiapan Utama:
              </span>
              <p className="mt-0.5 leading-relaxed text-[#111111]">{aiOutput.nextActionExplanation}</p>
            </div>

            <div>
              <span className="font-bold text-indigo-950 block text-[11px] uppercase tracking-wider">
                Penyesuaian Berdasarkan Gap:
              </span>
              <p className="mt-0.5 leading-relaxed text-[#111111]">{aiOutput.biggestGapExplanation}</p>
            </div>

            {aiState?.callState === 'FALLBACK' && (
              <div className="text-[10px] text-indigo-800/80 italic pt-1 border-t border-indigo-200/50">
                • Mode cadangan deterministik aktif (Aman, tanpa halusinasi).
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full max-w-lg mx-auto py-6 px-4 sm:px-6 space-y-6" id="real-results-container">
      {/* Toast Notification for Save Success */}
      {showToast && toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 animate-in slide-in-from-top duration-300">
          <div className="bg-[#0B1E34] text-white p-3.5 rounded-2xl shadow-xl border border-sky-400/40 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-white leading-snug">{toastMessage.title}</h4>
              <p className="text-[11px] text-slate-300 leading-relaxed mt-0.5">{toastMessage.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowToast(false)}
              className="text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Top Brand Bar */}
      <div className="flex items-center justify-between gap-2" id="results-top-bar">
        <div className="flex items-center gap-2">
          <ScholarMateLogo variant="full" size="sm" showAiBadge={true} />
        </div>

        <div className="flex items-center gap-2">
          {onOpenMyScholarships && (
            <button
              type="button"
              id="btn-my-scholarships-result"
              onClick={onOpenMyScholarships}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-[11px] font-bold text-emerald-800 shadow-2xs transition-colors cursor-pointer"
            >
              <Bookmark className="w-3.5 h-3.5 fill-emerald-600 text-emerald-600" />
              <span>Beasiswa Saya</span>
            </button>
          )}

          <button
            type="button"
            id="btn-evidence-library-top"
            onClick={() => setIsEvidenceLibraryOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-700 shadow-2xs transition-colors cursor-pointer"
          >
            <Library className="w-3.5 h-3.5 text-[#1F8ED8]" />
            <span>Evidence Library</span>
          </button>
          {/* Mate Pass Status Badge (shown only when active) */}
          {isMatePassActive && (
            <button
              type="button"
              id="btn-mate-pass-status-top"
              onClick={() => setIsMatePassModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-indigo-600 text-white text-[11px] font-bold shadow-xs cursor-pointer hover:opacity-95 transition-opacity"
            >
              <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
              <span>{activePassTier === 'MATE_PLUS' ? 'Mate Plus Aktif' : 'Mate Pass Aktif'}</span>
            </button>
          )}

          <NotificationCenter 
            notifications={notifications}
            onMarkAsRead={handleMarkAsRead}
            onMarkAllAsRead={handleMarkAllAsRead}
            onClearAll={handleClearAll}
            onSnooze={handleSnooze}
            onWriteEssay={(id, title) => {
              handleOpenWorkspace(id, title);
            }}
          />

          {/* Google Auth Status Widget */}
          {authState === 'AUTHENTICATED' && authService.getCurrentUser() ? (
            <div className="flex items-center gap-2 bg-white border border-[#E2E8F0] py-1 px-2.5 rounded-full shadow-2xs">
              {authService.getCurrentUser()?.photoURL ? (
                <img
                  src={authService.getCurrentUser()?.photoURL!}
                  alt="Google Avatar"
                  referrerPolicy="no-referrer"
                  className="w-5 h-5 rounded-full object-cover border border-slate-200"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-[#EBF5FC] text-[#1F8ED8] flex items-center justify-center text-[10px] font-bold">
                  {(authService.getCurrentUser()?.displayName || authService.getCurrentUser()?.email || 'U')[0].toUpperCase()}
                </div>
              )}
              <span className="text-[11px] font-semibold text-[#111111] max-w-[110px] truncate hidden sm:inline">
                {authService.getCurrentUser()?.displayName || authService.getCurrentUser()?.email}
              </span>
              <button
                type="button"
                id="btn-google-signout-topbar"
                onClick={async () => {
                  await authService.signOut();
                  setToastMessage({
                    title: 'Berhasil keluar',
                    subtitle: 'Sesi Google kamu telah diakhiri.',
                  });
                  setShowToast(true);
                  setTimeout(() => setShowToast(false), 3000);
                }}
                className="text-[#64748B] hover:text-rose-600 p-1 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                title="Keluar dari Google"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              id="btn-google-signin-topbar"
              onClick={() => setIsSaveModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-slate-50 border border-[#CBD5E1] text-[11px] font-bold text-[#111111] shadow-2xs transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Masuk</span>
            </button>
          )}
        </div>
      </div>

      {/* Restored with updated scholarship data notice */}
      {isRestoredWithNewData && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-xs text-sky-900 flex items-start gap-2 animate-in fade-in">
          <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold">Progres dipulihkan: </span>
            Hasil diperbarui menggunakan data beasiswa terbaru di ScholarMate.
          </div>
        </div>
      )}

      {/* Header */}
      <div className="space-y-1" id="results-header">
        <h1 className="text-xl sm:text-2xl font-extrabold text-[#111111] tracking-tight" id="results-title">
          Profil beasiswamu sudah terbaca
        </h1>
        <p className="text-xs sm:text-sm text-[#475569] leading-relaxed" id="results-profile-summary">
          {mergedUserProfile.education_level ? mergedUserProfile.education_level.toUpperCase() : '-'} • {mergedUserProfile.semester ? `Semester ${mergedUserProfile.semester}` : 'Semester -'} • {mergedUserProfile.major || '-'} • {mergedUserProfile.university || '-'}
        </p>
      </div>

      {/* Summary Card: Deterministic Scholarship Readiness */}
      <div className="bg-[#0B1E34] text-white rounded-2xl p-5 shadow-xs space-y-3" id="readiness-summary-card">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-slate-300" id="readiness-heading">
              PROFILE READINESS
            </div>
            <div className="text-3xl sm:text-4xl font-black tracking-tight mt-1 text-white" id="readiness-score-number">
              {readinessScore}<span className="text-lg font-bold text-slate-400">/100</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#132A47] border border-[#1F8ED8]/30 flex items-center justify-center text-[#1F8ED8]">
            <ShieldCheck className="w-5 h-5 text-[#1F8ED8]" />
          </div>
        </div>

        {/* Small Note: High Trust Disclaimer */}
        <div className="pt-2.5 border-t border-slate-700/60 space-y-1.5 text-xs text-slate-300 leading-relaxed" id="readiness-disclaimer">
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-[#1F8ED8] shrink-0 mt-0.5" />
            <span>
              Readiness berarti kesiapan profil, bukan peluang lolos.
            </span>
          </div>
          {readinessScore === 100 && (
            <p className="text-[11px] text-slate-400 pl-6" id="readiness-100-helper">
              Profil dasar sudah lengkap untuk proses matching.
            </p>
          )}
        </div>
      </div>

      {/* Incomplete Profile Guard Banner */}
      {!profileCoreComplete && (
        <div className="bg-amber-50/90 border-2 border-amber-300 rounded-2xl p-5 space-y-3.5 text-left shadow-xs" id="incomplete-profile-guard-card">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5 border border-amber-200">
              <AlertTriangle className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#111111] leading-snug">
                Profil belum cukup lengkap untuk matching
              </h2>
              <p className="text-xs text-[#475569] mt-1 leading-relaxed font-medium">
                Lengkapi profil dasar dulu (kewarganegaraan, jenjang, semester, universitas, jurusan, IPK) supaya ScholarMate bisa mengecek beasiswa secara akurat.
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-amber-200/80">
            <button
              type="button"
              id="btn-incomplete-profile-edit"
              onClick={onEditProfile}
              className="w-full min-h-[44px] px-4 py-2.5 bg-[#1F8ED8] hover:bg-[#197EC2] active:bg-[#156FAE] text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <span>Lengkapi Profil Scan</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Only render active scholarship opportunities if profile core is complete */}
      {profileCoreComplete && (
        <>
          {/* Dynamic Summary Banner */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3.5 space-y-2" id="potential-opportunities-banner">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${opportunityCount > 0 ? 'bg-[#1F8ED8]' : 'bg-slate-400'} shrink-0`} />
              <span className="text-xs sm:text-sm font-bold text-[#111111]" id="potential-count-text">
                {opportunityCount > 0
                  ? `Kami menemukan ${opportunityCount} peluang untuk profilmu`
                  : 'Belum ada peluang aktif yang bisa kami pastikan dari data saat ini.'}
              </span>
            </div>
            {opportunityCount > 0 ? (
              <p className="text-[11px] text-[#475569] pl-4 font-medium" id="potential-subcopy">
                Peluang yang memenuhi syarat dasar atau membutuhkan sedikit data tambahan.
              </p>
            ) : (
              <div className="pl-4 space-y-2.5 pt-0.5">
                <div className="space-y-1 text-xs text-[#475569] font-medium leading-relaxed" id="no-match-reasons-list">
                  {notEligibleActiveCount > 0 && (
                    <p id="not-eligible-active-count-text">
                      • {notEligibleActiveCount} program aktif belum sesuai pada syarat dasar profilmu.
                    </p>
                  )}
                  {needsRecheckActiveCount > 0 && (
                    <p id="needs-recheck-active-count-text">
                      • {needsRecheckActiveCount} program lainnya masih sedang diverifikasi oleh ScholarMate.
                    </p>
                  )}
                  {notEligibleActiveCount === 0 && needsRecheckActiveCount === 0 && (
                    <p id="generic-no-match-reason">
                      • Kriteria program aktif di database saat ini belum sesuai dengan data profilmu.
                    </p>
                  )}
                </div>
                <div className="pt-2 border-t border-[#E2E8F0] space-y-1.5" id="no-match-action-box">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#475569]">
                    Yang bisa kamu lakukan sekarang
                  </div>
                  <div className="text-xs font-semibold text-[#111111] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span>{recommendedNextAction.text}</span>
                    <button
                      type="button"
                      onClick={recommendedNextAction.onAction}
                      className="px-2.5 py-1.5 text-[11px] font-bold text-[#1F8ED8] bg-[#EBF5FC] hover:bg-[#D5EBF9] rounded-lg shrink-0 transition-colors cursor-pointer self-start sm:self-auto"
                    >
                      {recommendedNextAction.buttonLabel}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Top Recommendation Banner (Actionable Opportunities Only) */}
          {topActionableScholarship && topActionableFit && (
            <div className="bg-gradient-to-r from-[#EBF5FC] to-white border-2 border-[#1F8ED8]/60 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xs" id="card-top-recommendation">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-[#1F8ED8] text-white text-[10px] font-extrabold uppercase tracking-wider">
                    Top Recommendation
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      topActionableFit.fitLabel === 'Strong Match'
                        ? 'bg-emerald-100 text-emerald-800'
                        : topActionableFit.fitLabel === 'Moderate Match'
                        ? 'bg-sky-100 text-sky-800'
                        : 'bg-amber-100 text-amber-900'
                    }`}
                    id="badge-top-rec-fit-label"
                  >
                    {topActionableFit.fitLabel}
                  </span>
                </div>
                <div className="text-right">
                  {topActionableFit.evidenceCoverage === 0 ? (
                    <span className="text-xs font-semibold text-slate-500 italic">
                      Data belum cukup untuk Fit Score
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-[#1F8ED8]" id="text-top-rec-fit-score">
                      Fit Score {topActionableFit.totalFitScore}/100
                    </span>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-[#111111]" id="title-top-recommendation">
                  {topActionableScholarship.scholarship.name}
                </h3>
                <p className="text-xs font-semibold text-[#475569] mt-0.5">
                  {topActionableScholarship.scholarship.provider}
                </p>
                <p className="text-xs text-[#334155] leading-relaxed mt-2 font-medium" id="text-top-rec-summary">
                  {getBcaSummaryText(topActionableScholarship)}
                </p>
                <div className="text-[11px] text-[#64748B] mt-1">
                  {topActionableFit.evidenceCoverage === 0
                    ? 'Lengkapi profil untuk mendapatkan analisis kecocokan yang lebih akurat.'
                    : `Dinilai berdasarkan ${topActionableFit.evidenceCoverage}% bukti profil relevan yang sudah tersedia.`}
                </div>
              </div>

              <div className="pt-1">
                {topActionableScholarship.status === 'NEEDS_CHECK' ? (
                  <button
                    type="button"
                    id="btn-top-rec-complete-check"
                    onClick={() => handleOpenProgressiveCheck(topActionableScholarship)}
                    className="w-full min-h-[42px] px-4 py-2 bg-[#1F8ED8] hover:bg-[#197EC2] active:bg-[#156FAE] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <span>Lengkapi Cek</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    id="btn-top-rec-prepare"
                    onClick={() => {
                      trackEvent('prepare_scholarship_clicked', { scholarshipId: topActionableScholarship.scholarship.id });
                      setShowNextActionModal(true);
                    }}
                    className="w-full min-h-[42px] px-4 py-2 bg-[#1F8ED8] hover:bg-[#197EC2] active:bg-[#156FAE] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <span>Siapkan Beasiswa Ini</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* PLACEMENT 1: Save Result CTA (After Top Recommendation) */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-4 space-y-2.5 shadow-xs" id="card-save-result-top">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-[#111111] flex items-center gap-1.5">
                  <Bookmark className="w-4 h-4 text-[#1F8ED8]" />
                  <span>Simpan hasil ini</span>
                </div>
                <p className="text-xs text-[#475569] leading-relaxed">
                  Jangan isi ulang dari awal saat kamu kembali.
                </p>
              </div>
              <button
                type="button"
                id="btn-save-result-top"
                onClick={handleSaveButtonClick}
                disabled={saveStatus === 'SAVING'}
                className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  saveStatus === 'SAVED'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                    : saveStatus === 'UNSAVED_CHANGES'
                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                    : 'bg-white hover:bg-[#F1F5F9] text-[#1F8ED8] border border-[#BAE0F8]'
                }`}
              >
                {saveStatus === 'SAVING' && (
                  <>
                    <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                )}
                {saveStatus === 'SAVED' && (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Tersimpan</span>
                  </>
                )}
                {saveStatus === 'UNSAVED_CHANGES' && (
                  <>
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>Simpan Perubahan</span>
                  </>
                )}
                {saveStatus === 'UNSAVED' && (
                  <>
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>Simpan Hasil</span>
                  </>
                )}
                {saveStatus === 'SAVE_ERROR' && (
                  <span>Gagal menyimpan — Coba Lagi</span>
                )}
              </button>
            </div>
            {saveStatus === 'UNSAVED_CHANGES' && (
              <div className="text-[11px] text-amber-800 font-medium">
                • Perubahan belum disimpan.
              </div>
            )}
          </div>

          {/* Fokus Minggu Ini - Priority Reminders */}
          <FocusReminderBox 
            notifications={notifications}
            onSnooze={handleSnooze}
            onAction={(link) => {
              if (!link) return;
              const target = sortedActiveEvaluations.find(e => e.scholarship.id === link);
              if (target) {
                trackEvent('focus_reminder_clicked', { scholarshipId: link });
                setActiveDetailScholarship(target);
              }
            }}
            onWriteEssay={(link, title) => {
              handleOpenWorkspace(link, title);
            }}
          />

          {/* Real Scholarship Cards List: Ordered Deterministically */}
          <div className="space-y-4" id="scholarship-cards-list">
            {sortedActiveEvaluations.map((evalSch, cardIdx) => {
              const { scholarship, status, passedRules, failedRules, missingRules, missingFieldKeys } = evalSch;
              const fit = fitAnalysisMap[scholarship.id];
              const isVerified =
                scholarship.verificationStatus === 'SOURCE_FOUND' ||
                scholarship.verificationStatus === 'HUMAN_VERIFIED';
              
              // Paywall Logic:
              // Card index 0 (Top #1) gets full features for free.
              // Card index 1+ keeps basic info free (Name, Provider, Deadline, Source, Requirements, Hard Fail Reasons).
              // Card index 1+ locks: Detailed Fit Analysis, AI Kenapa Beasiswa Ini, & Focus/Checklist.
              const isFullAnalysisAllowed = isMatePassActive || (cardIdx === 0);
              const isActionLocked = !isMatePassActive && cardIdx >= MAX_FREE_MATCHES;

              // --- 1. ELIGIBLE / NEEDS_CHECK CARD ---
              if (status === 'ELIGIBLE' || status === 'NEEDS_CHECK') {
                return (
                  <div
                    key={scholarship.id}
                    className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-xs transition-colors hover:border-[#BAE0F8] space-y-4"
                    id={`card-scholarship-${scholarship.id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          status === 'ELIGIBLE' 
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80' 
                            : 'bg-amber-50 text-amber-900 border-amber-200/80'
                        }`}
                        id={`badge-status-${scholarship.id}`}
                      >
                        {status === 'ELIGIBLE' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        )}
                        {status === 'ELIGIBLE' ? 'Cocok secara syarat' : 'Perlu cek syarat tambahan'}
                      </span>
                      {!isMatePassActive && cardIdx >= MAX_FREE_MATCHES && (
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200 flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" />
                          <span>PRATINJAU</span>
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-[#111111]" id={`title-${scholarship.id}`}>
                        {scholarship.name}
                      </h3>
                      <p className="text-xs font-semibold text-[#475569] mt-0.5">
                        {scholarship.provider}
                      </p>
                      
                      <div className="flex flex-wrap gap-2 mt-2.5">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-medium text-[#111111]">
                          <Calendar className="w-3.5 h-3.5 text-[#1F8ED8]" />
                          <span>Deadline {formatExcelDate(scholarship.deadline)}</span>
                        </div>
                        <a 
                          href={scholarship.officialSourceUrl} 
                          target="_blank" 
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-[#E2E8F0] text-xs font-semibold text-[#1F8ED8] hover:bg-sky-50 hover:border-sky-200 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Official Source</span>
                        </a>
                      </div>
                    </div>

                    {/* Public Requirements (ALWAYS FREE) */}
                    <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3.5 space-y-2.5">
                      <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Syarat Publik Utama</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="flex items-center gap-2 text-xs text-[#334155]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span>IPK Minimal: {scholarship.minGpa || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[#334155]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span>Semester: {scholarship.semesterMin} s/d {scholarship.semesterMax}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[#334155] sm:col-span-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span>Lingkup Kampus: {scholarship.universityScope}</span>
                        </div>
                      </div>
                    </div>

                    {/* Fit Analysis Section (Locked for cardIdx >= 1 if Free) */}
                    {fit && (
                      <div className={`border rounded-xl p-3.5 space-y-2.5 relative ${
                        isFullAnalysisAllowed ? 'bg-[#F8FAFC] border-[#E2E8F0]' : 'bg-slate-50 border-slate-200 opacity-80'
                      }`} id={`fit-section-${scholarship.id}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#111111]">Fit Analysis</span>
                            {!isFullAnalysisAllowed ? (
                              <Lock className="w-3 h-3 text-slate-400" />
                            ) : (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  fit.fitLabel === 'Strong Match'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : fit.fitLabel === 'Moderate Match'
                                    ? 'bg-sky-100 text-sky-800'
                                    : fit.fitLabel === 'Potential Match'
                                    ? 'bg-amber-100 text-amber-900'
                                    : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                {fit.fitLabel}
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            {!isFullAnalysisAllowed ? (
                              <span className="text-xs font-bold text-slate-400">Fit Score: LOCKED</span>
                            ) : fit.evidenceCoverage === 0 ? (
                              <span className="text-xs font-semibold text-slate-500 italic">Data belum cukup</span>
                            ) : (
                              <span className="text-xs font-bold text-[#1F8ED8]">
                                Fit Score {fit.totalFitScore}/100
                              </span>
                            )}
                          </div>
                        </div>

                        {isFullAnalysisAllowed ? (
                          <>
                            <div className="text-[11px] text-[#475569]">
                              {fit.evidenceCoverage === 0
                                ? 'Data belum cukup untuk Fit Score.'
                                : `Dinilai berdasarkan ${fit.evidenceCoverage}% profil.`}
                            </div>
                            {/* Strengths & Gaps (Detailed) */}
                            {fit.strengths.length > 0 && (
                              <div className="space-y-1">
                                {fit.strengths.slice(0, 2).map((s, idx) => (
                                  <div key={idx} className="flex items-start gap-1.5 text-xs text-slate-700">
                                    <span className="w-1 h-1 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                                    <span><strong className="text-[#111111]">{s.title}:</strong> {s.evidence}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="py-1">
                            <button
                              type="button"
                              onClick={() => {
                                setModalInitialTier('MATE_PLUS');
                                setIsMatePassModalOpen(true);
                              }}
                              className="w-full py-2 bg-white border border-slate-200 text-[#1F8ED8] text-[11px] font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                              <Lock className="w-3 h-3" />
                              <span>Buka Fit Analysis & Pemetaan Gap</span>
                            </button>
                          </div>
                        )}
                        
                        {isFullAnalysisAllowed && renderAiPersonalizationBox(evalSch, fit)}
                      </div>
                    )}

                    {/* Primary Action (Locked for cardIdx >= 1 if Free) */}
                    <button
                      type="button"
                      onClick={() => {
                        if (isActionLocked) {
                          setModalInitialTier('MATE_PLUS');
                          setIsMatePassModalOpen(true);
                          return;
                        }
                        handleFocusScholarship(scholarship, evalSch, status === 'ELIGIBLE' ? 'prepare' : 'check');
                      }}
                      className={`w-full min-h-[42px] px-4 py-2 rounded-xl flex items-center justify-center gap-1.5 font-bold text-xs transition-colors cursor-pointer shadow-xs ${
                        isActionLocked
                          ? 'bg-slate-100 border border-slate-200 text-slate-500'
                          : 'bg-[#1F8ED8] hover:bg-[#197EC2] text-white'
                      }`}
                    >
                      {isActionLocked ? <Lock className="w-4 h-4 text-slate-400" /> : <Bookmark className="w-4 h-4" />}
                      <span>{isActionLocked ? 'Fokuskan & Lihat Checklist' : 'Fokuskan & Lihat Checklist'}</span>
                      {!isActionLocked && <ArrowRight className="w-3.5 h-3.5" />}
                    </button>

                    {/* Trust Metadata (Always Free) */}
                    <div className="pt-2 border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#64748B]">
                      {isVerified && (
                        <span className="flex items-center gap-1 font-medium text-[#111111]">
                          <ShieldCheck className="w-3 h-3 text-[#1F8ED8]" />
                          Verified
                        </span>
                      )}
                      <span>Update: {formatExcelDate(scholarship.lastChecked)}</span>
                    </div>
                  </div>
                );
              }

              // --- 2. NOT_ELIGIBLE CARD (Always Free) ---
              if (status === 'NOT_ELIGIBLE') {
                return (
                  <div
                    key={scholarship.id}
                    className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 opacity-90 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200/80 text-xs font-semibold">
                        <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        Belum memenuhi syarat
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-[#111111]">{scholarship.name}</h3>
                      <p className="text-xs font-semibold text-[#475569] mt-0.5">{scholarship.provider}</p>
                      <div className="inline-flex items-center gap-1.5 mt-2.5 px-2.5 py-1 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-medium text-[#111111]">
                        <Calendar className="w-3.5 h-3.5 text-[#1F8ED8]" />
                        <span>Deadline {formatExcelDate(scholarship.deadline)}</span>
                      </div>
                    </div>

                    {/* Alasan Hard Fail (ALWAYS FREE) */}
                    <div className="p-3.5 bg-rose-50/70 rounded-xl border border-rose-200/80 space-y-2 text-xs">
                      <div className="font-bold text-rose-900 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>Alasan Tidak Lolos:</span>
                      </div>
                      <div className="space-y-1.5">
                        {failedRules.map((fr, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-rose-950 font-medium leading-relaxed">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                            <span>{fr.neutralMessage || `Program mensyaratkan ${fr.rule.sourceSummary}.`}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <a
                        href={scholarship.officialSourceUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-[11px] font-bold text-[#1F8ED8] hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Lihat Sumber Resmi</span>
                      </a>
                    </div>
                  </div>
                );
              }

              return null;
            })}
          </div>

          {/* Mate Pass & Mate Plus Status Banner OR Upgrade Promotion Banner */}
          {isMatePassActive ? (
            <div className="p-4 bg-gradient-to-r from-[#0B1E34] to-[#132A47] text-white rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs border border-sky-500/30" id="card-mate-pass-active-banner">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0">
                  <Zap className="w-5 h-5 fill-amber-300 text-amber-300" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>{activePassTier === 'MATE_PLUS' ? 'Mate Plus Aktif' : 'Mate Pass Aktif'}</span>
                    <span className="text-[10px] px-2 py-0.2 rounded-full bg-gradient-to-r from-amber-400 to-amber-300 text-slate-950 font-black">
                      {activePassTier === 'MATE_PLUS' ? '30 HARI' : '7 HARI'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5">
                    {activePassTier === 'MATE_PLUS'
                      ? `Menampilkan seluruh ${sortedActiveEvaluations.length} beasiswa dengan Full Fit Analysis & AI tanpa batas untuk persiapan beberapa beasiswa.`
                      : `Menampilkan seluruh ${sortedActiveEvaluations.length} beasiswa dengan Full Fit Analysis & AI tanpa batas.`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                {activePassTier === 'MATE_PASS' && (
                  <button
                    type="button"
                    onClick={() => {
                      setModalInitialTier('MATE_PLUS');
                      setIsMatePassModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl border border-indigo-400/30 cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3 text-amber-300" />
                    <span>Upgrade Plus (30 Hari)</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsMatePassModalOpen(true)}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/20 cursor-pointer transition-colors"
                >
                  Detail
                </button>
              </div>
            </div>
          ) : allSortedActiveEvaluations.length > MAX_FREE_MATCHES ? (
            <div className="p-5 bg-white border border-[#E2E8F0] rounded-2xl text-center space-y-3 shadow-xs" id="card-locked-opportunities">
              <div className="w-10 h-10 rounded-full bg-[#EBF5FC] text-[#1F8ED8] flex items-center justify-center mx-auto border border-[#BAE0F8]/60">
                <Lock className="w-5 h-5 text-[#1F8ED8]" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm sm:text-base font-bold text-[#111111]">
                  Masih ada {allSortedActiveEvaluations.length - MAX_FREE_MATCHES} peluang beasiswa cocok lainnya
                </h4>
                <p className="text-xs text-[#475569] leading-relaxed max-w-sm mx-auto">
                  Mode gratis menampilkan {MAX_FREE_MATCHES} rekomendasi beasiswa teratas. Akses seluruh peluang beasiswa aktif yang sesuai profilmu.
                </p>
              </div>
              <div className="pt-1">
                <button
                  type="button"
                  id="btn-see-all-opportunities"
                  onClick={() => {
                    setModalInitialTier('MATE_PLUS');
                    setIsMatePassModalOpen(true);
                  }}
                  className="w-full sm:w-auto px-6 py-2.5 bg-[#1F8ED8] hover:bg-[#197EC2] active:bg-[#156FAE] text-white font-bold text-xs rounded-xl inline-flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Lihat Semua Peluang ({allSortedActiveEvaluations.length - MAX_FREE_MATCHES} Beasiswa)</span>
                </button>
              </div>
            </div>
          ) : null}

          {/* PLACEMENT 2: Save Result CTA (Near Bottom of Results) */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 text-center space-y-3" id="card-save-result-bottom">
            <div className="space-y-1">
              <div className="text-sm font-extrabold text-[#111111]">
                Simpan profil dan hasil pengecekan
              </div>
              <p className="text-xs text-[#475569] leading-relaxed max-w-sm mx-auto font-normal">
                Simpan profil dan hasil pengecekan supaya kamu bisa lanjut lagi tanpa isi ulang.
              </p>
            </div>
            <button
              type="button"
              id="btn-save-result-bottom"
              onClick={handleSaveButtonClick}
              disabled={saveStatus === 'SAVING'}
              className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all inline-flex items-center gap-2 cursor-pointer shadow-xs ${
                saveStatus === 'SAVED'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                  : saveStatus === 'UNSAVED_CHANGES'
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'bg-[#1F8ED8] hover:bg-[#197EC2] text-white'
              }`}
            >
              {saveStatus === 'SAVING' && (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Menyimpan...</span>
                </>
              )}
              {saveStatus === 'SAVED' && (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Tersimpan</span>
                </>
              )}
              {saveStatus === 'UNSAVED_CHANGES' && (
                <>
                  <Bookmark className="w-4 h-4" />
                  <span>Simpan Perubahan</span>
                </>
              )}
              {saveStatus === 'UNSAVED' && (
                <>
                  <Bookmark className="w-4 h-4" />
                  <span>Simpan Hasil</span>
                </>
              )}
              {saveStatus === 'SAVE_ERROR' && <span>Gagal menyimpan — Coba Lagi</span>}
            </button>
          </div>
        </>
      )}

      {/* Collapsible Section: Program yang bisa dipantau untuk siklus berikutnya (CLOSED RELEVANT ONLY) */}
      {closedRelevantEvaluations.length > 0 && (
        <div className="border border-[#E2E8F0] rounded-2xl bg-[#F8FAFC] overflow-hidden" id="section-closed-scholarships">
          <button
            type="button"
            onClick={() => setShowClosedSection((prev) => !prev)}
            className="w-full p-4 flex items-center justify-between text-left cursor-pointer hover:bg-slate-100/70 transition-colors"
          >
            <div>
              <div className="text-xs sm:text-sm font-bold text-[#111111]">
                Program yang bisa dipantau untuk siklus berikutnya ({closedRelevantEvaluations.length})
              </div>
              <p className="text-[11px] text-[#475569] mt-0.5">
                Beasiswa dengan siklus pendaftaran telah ditutup namun relevan untuk dipantau pada semester atau siklus berikutnya
              </p>
            </div>
            {showClosedSection ? (
              <ChevronUp className="w-4 h-4 text-[#475569]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#475569]" />
            )}
          </button>

          {showClosedSection && (
            <div className="p-4 pt-0 space-y-3 border-t border-[#E2E8F0]">
              {closedRelevantEvaluations.map((evalSch) => (
                <div
                  key={evalSch.scholarship.id}
                  className="bg-white p-3.5 rounded-xl border border-[#E2E8F0] space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
                      Pendaftaran ditutup
                    </span>
                    <span className="text-[10px] text-[#475569]">
                      Ditutup: {formatExcelDate(evalSch.scholarship.deadline)}
                    </span>
                  </div>
                  <h4 className="font-bold text-[#111111] text-xs">
                    {evalSch.scholarship.name}
                  </h4>
                  <p className="text-[#475569] text-[11px]">
                    {evalSch.scholarship.provider}
                  </p>
                  <div className="pt-1 flex items-center justify-between">
                    <a
                      href={evalSch.scholarship.officialSourceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-[#1F8ED8] font-semibold text-[11px] hover:underline flex items-center gap-1"
                    >
                      <span>Lihat Informasi Resmi</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="pt-2 border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#475569]">
                    <span className="flex items-center gap-1 font-medium text-[#111111]">
                      <ShieldCheck className="w-3 h-3 text-[#1F8ED8]" />
                      Verified by ScholarMate
                    </span>
                    <span>Last checked: {formatExcelDate(evalSch.scholarship.lastChecked)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Collapsible Section: Program yang belum memenuhi syarat (ALWAYS 100% FREE) */}
      {notEligibleEvaluations.length > 0 && (
        <div className="border border-[#E2E8F0] rounded-2xl bg-[#F8FAFC] overflow-hidden" id="section-not-eligible-scholarships">
          <button
            type="button"
            id="btn-toggle-not-eligible-section"
            onClick={() => setShowNotEligibleSection((prev) => !prev)}
            className="w-full p-4 flex items-center justify-between text-left cursor-pointer hover:bg-slate-100/70 transition-colors"
          >
            <div>
              <div className="text-xs sm:text-sm font-bold text-[#111111] flex items-center gap-2">
                <span>Program yang belum sesuai profilmu ({notEligibleEvaluations.length})</span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                  Selalu Gratis
                </span>
              </div>
              <p className="text-[11px] text-[#475569] mt-0.5">
                Transparansi penuh: alasan mengapa kriteria program ini belum sesuai dengan profilmu saat ini
              </p>
            </div>
            {showNotEligibleSection ? (
              <ChevronUp className="w-4 h-4 text-[#475569]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#475569]" />
            )}
          </button>

          {showNotEligibleSection && (
            <div className="p-4 pt-0 space-y-3.5 border-t border-[#E2E8F0]">
              {notEligibleEvaluations.map((evalSch) => {
                const { scholarship, failedRules } = evalSch;
                const isVerified =
                  scholarship.verificationStatus === 'SOURCE_FOUND' ||
                  scholarship.verificationStatus === 'HUMAN_VERIFIED';

                return (
                  <div
                    key={scholarship.id}
                    className="bg-white p-4 rounded-xl border border-[#E2E8F0] space-y-3 text-xs shadow-2xs"
                    id={`card-not-eligible-expanded-${scholarship.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200/80 text-[11px] font-semibold">
                        <XCircle className="w-3 h-3 text-rose-600 shrink-0" />
                        Belum memenuhi syarat
                      </span>
                      <div className="inline-flex items-center gap-1 text-[11px] text-[#475569] font-medium">
                        <Calendar className="w-3 h-3 text-[#1F8ED8]" />
                        <span>Deadline: {formatExcelDate(scholarship.deadline)}</span>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-bold text-[#111111] text-sm">
                        {scholarship.name}
                      </h4>
                      <p className="text-[#475569] text-xs font-medium mt-0.5">
                        {scholarship.provider}
                      </p>
                    </div>

                    {/* Alasan tidak eligible */}
                    <div className="p-3 bg-rose-50/70 rounded-lg border border-rose-200/80 space-y-1.5 text-xs">
                      <div className="font-bold text-rose-900 flex items-center gap-1.5 text-[11px]">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>Alasan Tidak Eligible:</span>
                      </div>
                      {failedRules.length > 0 ? (
                        <div className="space-y-1 pl-1">
                          {failedRules.map((fr, idx) => (
                            <div key={idx} className="flex items-start gap-1.5 text-rose-950 text-[11px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                              <span className="leading-relaxed font-medium">
                                {fr.neutralMessage || `Program mensyaratkan ${fr.rule.sourceSummary}.`}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-700 text-[11px]">
                          Ketentuan kriteria program belum sesuai dengan profil kamu saat ini.
                        </p>
                      )}
                    </div>

                    {/* Action & Trust metadata */}
                    <div className="pt-2 border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#475569]">
                      <div className="flex items-center gap-3">
                        {isVerified && (
                          <span className="flex items-center gap-1 font-medium text-[#111111]">
                            <ShieldCheck className="w-3 h-3 text-[#1F8ED8]" />
                            Verified by ScholarMate
                          </span>
                        )}
                        <span>Last checked: {formatExcelDate(scholarship.lastChecked)}</span>
                      </div>
                      <a
                        href={scholarship.officialSourceUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-[#1F8ED8] font-bold hover:underline inline-flex items-center gap-1"
                      >
                        <span>Official Source</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Edit Profile CTA Bar */}
      <div className="pt-2 border-t border-[#E2E8F0] flex items-center justify-between text-xs" id="results-footer-actions">
        <button
          type="button"
          id="btn-edit-profile-scan"
          onClick={onEditProfile}
          className="text-[#1F8ED8] font-bold hover:underline flex items-center gap-1 cursor-pointer"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Ubah Data Profil</span>
        </button>

        <button
          type="button"
          id="btn-restart-scan"
          onClick={async () => {
            // Audit V1: Server-authoritative correction validation
            const { allowed, reason } = await validateCorrectionServer();

            if (!allowed) {
              setModalInitialTier('MATE_PLUS');
              setIsMatePassModalOpen(true);
              return;
            }
            onRestart();
          }}
          className="text-[#475569] hover:text-[#111111] font-semibold flex items-center gap-1 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Ulangi Pengecekan</span>
        </button>
      </div>

      {/* PROGRESSIVE QUESTION MODAL */}
      {activeProgressiveTarget && activeProgressiveStep && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl border border-[#E2E8F0] relative">
            <button
              type="button"
              onClick={() => setActiveProgressiveTarget(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {activeProgressiveStep.type === 'QUESTION' && (
              <div className="space-y-4">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200 text-xs font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-[#1F8ED8]" />
                  <span>Lengkapi Data — {activeProgressiveTarget.scholarship.name}</span>
                </div>

                <div>
                  <h3 className="text-base font-extrabold text-[#111111]">
                    {activeProgressiveStep.question.user_copy}
                  </h3>
                </div>

                {/* Input Controls depending on inputType */}
                {activeProgressiveStep.question.inputType === 'BUTTONS' && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      type="button"
                      id={`btn-ans-yes-${activeProgressiveStep.question.fieldKey}`}
                      onClick={() => handleAnswerQuestion(activeProgressiveStep.question.fieldKey, true)}
                      className="py-3 px-4 bg-[#EBF5FC] hover:bg-[#D5EBF9] border border-[#BAE0F8] text-[#1F8ED8] font-bold text-sm rounded-xl transition-colors cursor-pointer"
                    >
                      Ya
                    </button>
                    <button
                      type="button"
                      id={`btn-ans-no-${activeProgressiveStep.question.fieldKey}`}
                      onClick={() => handleAnswerQuestion(activeProgressiveStep.question.fieldKey, false)}
                      className="py-3 px-4 bg-white hover:bg-slate-50 border border-[#E2E8F0] text-slate-700 font-bold text-sm rounded-xl transition-colors cursor-pointer"
                    >
                      Tidak
                    </button>
                  </div>
                )}

                {(activeProgressiveStep.question.inputType === 'INTEGER' ||
                  activeProgressiveStep.question.inputType === 'DECIMAL') && (
                  <div className="space-y-3 pt-2">
                    <input
                      type="number"
                      value={currentQuestionValue}
                      onChange={(e) => setCurrentQuestionValue(e.target.value)}
                      placeholder="Ketik angka..."
                      className="w-full px-4 py-3 bg-white border border-[#E2E8F0] focus:border-[#1F8ED8] focus:ring-2 focus:ring-[#1F8ED8]/20 rounded-xl text-sm outline-none text-[#111111]"
                    />
                    <button
                      type="button"
                      disabled={!currentQuestionValue.trim()}
                      onClick={() => {
                        const val = parseFloat(currentQuestionValue);
                        handleAnswerQuestion(activeProgressiveStep.question.fieldKey, val);
                      }}
                      className="w-full py-3 bg-[#1F8ED8] hover:bg-[#197EC2] disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-colors cursor-pointer"
                    >
                      Simpan Jawaban
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeProgressiveStep.type === 'DISABILITY_CHOICE_PROMPT' && (
              <div className="space-y-4">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Jalur Khusus Penyandang Disabilitas</span>
                </div>

                <div>
                  <h3 className="text-base font-extrabold text-[#111111]">
                    Apakah kamu ingin memeriksa eligibility Jalur Disabilitas BAZNAS?
                  </h3>
                  <p className="text-xs text-[#475569] mt-1 leading-relaxed">
                    Program Beasiswa Cendekia BAZNAS menyediakan kuota khusus bagi mahasiswa penyandang disabilitas.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowDisabilityOption(true)}
                    className="py-3 px-4 bg-[#EBF5FC] hover:bg-[#D5EBF9] border border-[#BAE0F8] text-[#1F8ED8] font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Ya, Cek Jalur Disabilitas
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleAnswerQuestion('has_disability', false);
                      setActiveProgressiveTarget(null);
                    }}
                    className="py-3 px-4 bg-white hover:bg-slate-50 border border-[#E2E8F0] text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Bukan / Lewati
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PREPARE NEXT ACTION MODAL */}
      {showNextActionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl border border-[#E2E8F0] relative">
            <button
              type="button"
              onClick={() => setShowNextActionModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Persiapan Pendaftaran</span>
            </div>

            <div>
              <h3 className="text-base font-extrabold text-[#111111]">
                Siapkan Berkas & Langkah Selanjutnya
              </h3>
              <p className="text-xs text-[#475569] mt-1 leading-relaxed">
                Profil dasar kamu sudah sesuai untuk program ini. Berikut langkah yang disarankan:
              </p>
            </div>

            <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0] space-y-2.5 text-xs text-slate-700">
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-[#EBF5FC] text-[#1F8ED8] font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  <strong className="text-[#111111]">Siapkan Transkrip Nilai IPK:</strong> Pastikan IPK resmi terbit minimal sesuai kriteria program.
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-[#EBF5FC] text-[#1F8ED8] font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  <strong className="text-[#111111]">Surat Rekomendasi Kampus:</strong> Minta surat rekomendasi dari Dekanat atau Wadek Kemahasiswaan.
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-[#EBF5FC] text-[#1F8ED8] font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <div>
                  <strong className="text-[#111111]">Pantau Portal Resmi Provider:</strong> Akses website resmi penyedia untuk mengunggah berkas.
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowNextActionModal(false)}
                className="w-full py-3 bg-[#1F8ED8] hover:bg-[#197EC2] text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Saya Mengerti
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FIT ANALYSIS DETAIL MODAL */}
      {activeFitDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-[#E2E8F0] relative my-8 max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              id="btn-close-fit-modal"
              onClick={() => setActiveFitDetail(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full cursor-pointer hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-md bg-[#EBF5FC] text-[#1F8ED8] border border-[#BAE0F8]">
                {activeFitDetail.fitLabel}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                Fit Score: {activeFitDetail.totalFitScore}/100 • Coverage: {activeFitDetail.evidenceCoverage}%
              </span>
            </div>

            <div>
              <h3 className="text-lg font-extrabold text-[#111111]">
                Rincian Evaluasi Fit Score
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Transparansi perhitungan kecocokan berdasarkan dimensi profil kamu
              </p>
            </div>

            {/* 4 Dimensions Breakdown */}
            <div className="space-y-3">
              <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0] space-y-1.5">
                <div className="flex justify-between items-center text-xs font-bold text-[#111111]">
                  <span>1. Keselarasan Akademik (Academic Alignment)</span>
                  <span className="text-[#1F8ED8]">{activeFitDetail.dimensions.academicAlignment.score} / {activeFitDetail.dimensions.academicAlignment.maxScore}</span>
                </div>
                {activeFitDetail.dimensions.academicAlignment.evidence.map((ev, i) => (
                  <p key={i} className="text-[11px] text-slate-600 pl-2 border-l-2 border-[#1F8ED8]">✓ {ev}</p>
                ))}
              </div>

              <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0] space-y-1.5">
                <div className="flex justify-between items-center text-xs font-bold text-[#111111]">
                  <span>2. Keselarasan Aktivitas & Kepemimpinan</span>
                  <span className="text-[#1F8ED8]">{activeFitDetail.dimensions.activityAlignment.score} / {activeFitDetail.dimensions.activityAlignment.maxScore}</span>
                </div>
                {activeFitDetail.dimensions.activityAlignment.evidence.map((ev, i) => (
                  <p key={i} className="text-[11px] text-slate-600 pl-2 border-l-2 border-[#1F8ED8]">✓ {ev}</p>
                ))}
              </div>

              <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0] space-y-1.5">
                <div className="flex justify-between items-center text-xs font-bold text-[#111111]">
                  <span>3. Keselarasan Tujuan (Goal Alignment)</span>
                  <span className="text-[#1F8ED8]">{activeFitDetail.dimensions.goalAlignment.score} / {activeFitDetail.dimensions.goalAlignment.maxScore}</span>
                </div>
                {activeFitDetail.dimensions.goalAlignment.evidence.map((ev, i) => (
                  <p key={i} className="text-[11px] text-slate-600 pl-2 border-l-2 border-[#1F8ED8]">✓ {ev}</p>
                ))}
              </div>

              <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0] space-y-1.5">
                <div className="flex justify-between items-center text-xs font-bold text-[#111111]">
                  <span>4. Bukti Kesiapan Berkas (Preparation Evidence)</span>
                  <span className="text-[#1F8ED8]">{activeFitDetail.dimensions.preparationEvidence.score} / {activeFitDetail.dimensions.preparationEvidence.maxScore}</span>
                </div>
                {activeFitDetail.dimensions.preparationEvidence.evidence.map((ev, i) => (
                  <p key={i} className="text-[11px] text-slate-600 pl-2 border-l-2 border-[#1F8ED8]">✓ {ev}</p>
                ))}
              </div>
            </div>

            {/* Strengths & Gaps */}
            {activeFitDetail.strengths.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider">Kekuatan Utama</h4>
                <div className="space-y-1">
                  {activeFitDetail.strengths.map((s, idx) => (
                    <div key={idx} className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-lg text-xs text-emerald-950">
                      <strong className="block font-bold">{s.title}</strong>
                      <span className="text-[11px] text-emerald-800">{s.evidence}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeFitDetail.gaps.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-extrabold text-amber-800 uppercase tracking-wider">Hal Yang Perlu Disiapkan (Gap)</h4>
                <div className="space-y-1">
                  {activeFitDetail.gaps.map((g, idx) => (
                    <div key={idx} className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-950">
                      <strong className="block font-bold">{g.title}</strong>
                      <span className="text-[11px] text-amber-800">{g.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setActiveFitDetail(null)}
                className="w-full py-3 bg-[#1F8ED8] hover:bg-[#197EC2] text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Tutup Analisis
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SCHOLARSHIP REQUIREMENT DETAIL MODAL (ALWAYS 100% FREE) */}
      {activeDetailScholarship && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-[#E2E8F0] relative my-8 max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              id="btn-close-detail-modal"
              onClick={() => setActiveDetailScholarship(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full cursor-pointer hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  activeDetailScholarship.status === 'ELIGIBLE'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : activeDetailScholarship.status === 'NEEDS_CHECK'
                    ? 'bg-amber-50 text-amber-900 border border-amber-200'
                    : activeDetailScholarship.status === 'NEEDS_RECHECK'
                    ? 'bg-slate-100 text-slate-700 border border-slate-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {activeDetailScholarship.status === 'ELIGIBLE' && (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Cocok secara syarat</span>
                  </>
                )}
                {activeDetailScholarship.status === 'NEEDS_CHECK' && (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Perlu data tambahan</span>
                  </>
                )}
                {activeDetailScholarship.status === 'NEEDS_RECHECK' && (
                  <>
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>Sedang diverifikasi</span>
                  </>
                )}
                {activeDetailScholarship.status === 'NOT_ELIGIBLE' && (
                  <>
                    <XCircle className="w-3.5 h-3.5 text-rose-600" />
                    <span>Belum memenuhi syarat</span>
                  </>
                )}
              </span>

              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                Informasi Selalu Gratis
              </span>
            </div>

            <div>
              <h3 className="text-lg font-extrabold text-[#111111]">
                {activeDetailScholarship.scholarship.name}
              </h3>
              <p className="text-xs font-semibold text-[#475569] mt-0.5">
                {activeDetailScholarship.scholarship.provider}
              </p>
              <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-medium text-[#111111]">
                <Calendar className="w-3.5 h-3.5 text-[#1F8ED8]" />
                <span>Deadline: {formatExcelDate(activeDetailScholarship.scholarship.deadline)}</span>
              </div>
            </div>

            {/* If NOT_ELIGIBLE: show all failed reasons clearly */}
            {activeDetailScholarship.status === 'NOT_ELIGIBLE' && (
              <div className="p-4 bg-rose-50/70 rounded-xl border border-rose-200/80 space-y-2">
                <h4 className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Alasan Belum Memenuhi Syarat:</span>
                </h4>
                {activeDetailScholarship.failedRules.length > 0 ? (
                  <div className="space-y-1.5 pl-1">
                    {activeDetailScholarship.failedRules.map((fr, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-rose-950 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                        <span className="leading-relaxed">
                          {fr.neutralMessage || `Program mensyaratkan ${fr.rule.sourceSummary}.`}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    Ketentuan kriteria program belum sesuai dengan profil kamu saat ini.
                  </p>
                )}
              </div>
            )}

            {/* Passed Rules */}
            {activeDetailScholarship.passedRules.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Syarat Yang Sudah Terpenuhi ({activeDetailScholarship.passedRules.length}):</span>
                </h4>
                <div className="space-y-1 bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0]">
                  {activeDetailScholarship.passedRules.map((pr, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                      <span className="text-emerald-600 font-bold">✓</span>
                      <span>{pr.rule.sourceSummary}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Verified Preparation Checklist */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Checklist Persiapan & Pendaftaran (Data Verified):</span>
              </h4>
              <div className="space-y-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                {generateScholarshipChecklist(activeDetailScholarship.scholarship).map((chk, idx) => (
                  <div key={chk.id} className="flex items-start gap-2.5 text-xs">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 text-[10px] mt-0.5">
                      {idx + 1}
                    </span>
                    <div>
                      <span className="font-bold text-slate-900">{chk.label}</span>
                      <p className="text-slate-600 mt-0.5 text-[11px] leading-relaxed">{chk.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Official Source Link & Trust Section */}
            <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0] space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-[11px] text-[#475569]">
                <span className="flex items-center gap-1 font-medium text-[#111111]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#1F8ED8]" />
                  Verified by ScholarMate
                </span>
                <span>Last checked: {formatExcelDate(activeDetailScholarship.scholarship.lastChecked)}</span>
              </div>
              <a
                href={activeDetailScholarship.scholarship.officialSourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="w-full py-2.5 px-4 bg-white border border-[#BAE0F8] hover:bg-[#EBF5FC] text-[#1F8ED8] font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <span>Buka Website Resmi Provider</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  if (activeDetailScholarship) {
                    handleOpenWorkspace(
                      activeDetailScholarship.scholarship.id, 
                      activeDetailScholarship.scholarship.name 
                    );
                  }
                }}
                className="w-full py-3 bg-[#1F8ED8] hover:bg-[#197EC2] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-sky-100 cursor-pointer"
              >
                <Edit className="w-4 h-4" />
                Tulis Essay & Jawaban Aplikasi
              </button>
              <button
                type="button"
                id="btn-close-detail-modal-footer"
                onClick={() => setActiveDetailScholarship(null)}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Tutup Informasi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Gate Modal */}
      <SaveGateModal
        isOpen={isSaveModalOpen}
        onClose={() => {
          setIsSaveModalOpen(false);
          setPendingSaveSnapshot(null);
        }}
        onGoogleSignInSuccess={handleGoogleSignInSuccess}
        isAuthenticated={authService.getAuthState() === 'AUTHENTICATED'}
        currentUser={authService.getCurrentUser()}
      />

      {/* Mate Pass & Mate Plus Modal */}
      <MatePassModal
        isOpen={isMatePassModalOpen}
        onClose={() => setIsMatePassModalOpen(false)}
        activePassTier={activePassTier}
        isMatePassActive={isMatePassActive}
        onActivatePass={handleActivatePass}
        onDeactivatePass={handleDeactivatePass}
        initialSelectedTier={modalInitialTier}
      />

      {/* Essay Workspace Modal */}
      <EssayWorkspaceModal 
        isOpen={!!activeWorkspace}
        onClose={() => setActiveWorkspace(null)}
        scholarshipId={activeWorkspace?.id || ''}
        scholarshipTitle={activeWorkspace?.title || ''}
        activePassTier={activePassTier}
        onUpgrade={() => {
          setModalInitialTier('MATE_PLUS');
          setIsMatePassModalOpen(true);
        }}
      />

      {/* Evidence Library Modal */}
      <AnimatePresence>
        {isEvidenceLibraryOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white shadow-2xl rounded-2xl w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden border border-slate-200"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#1F8ED8] text-white flex items-center justify-center shadow-lg shadow-sky-100">
                    <Library className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Evidence Library</h2>
                    <p className="text-[11px] text-slate-500 font-medium">Bank Bukti Pengalaman & Prestasi</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsEvidenceLibraryOpen(false)}
                  className="w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex-1 overflow-hidden">
                <EvidenceLibrary className="border-l-0" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DEV / DEBUG Panel */}
      <DebugPanel
        viewMode={viewMode}
        hasCompletedScan={hasCompletedScan}
        saveStatus={saveStatus}
        hasUnsavedChanges={saveStatus === 'UNSAVED_CHANGES'}
        activeProfileValid={profileCoreComplete}
        activeProfileReason={profileCoreComplete ? undefined : 'Profil tidak lengkap'}
        rawScanProfile={rawScanProfile}
        canonicalActiveProfile={profile}
        engineProfileInput={mergedUserProfile}
        activeProfileSnapshot={profile}
        activeProfileFingerprint={activeProfileFingerprint || undefined}
        savedSnapshotValidity={savedSnapshot ? (isProfileValid(savedSnapshot.profile) ? 'VALID' : 'INVALID') : 'NONE'}
        savedProfileFingerprint={savedProfileFingerprint || undefined}
        fingerprintMatch={fingerprintMatch}
        pendingSnapshotStatus={pendingSaveSnapshot ? (isProfileValid(pendingSaveSnapshot.profile) ? 'VALID' : 'INVALID') : 'NONE'}
        onClearSavedResult={() => {
          clearSavedResult(authService.getCurrentUser()?.id);
          setSaveStatus('UNSAVED');
          if (onSavedSnapshotChanged) onSavedSnapshotChanged();
        }}
        onRefreshSavedResult={() => {
          if (onSavedSnapshotChanged) onSavedSnapshotChanged();
        }}
        onSimulateLogin={() => setIsSaveModalOpen(true)}
        onSignOut={async () => {
          await authService.signOut();
        }}
      />
    </div>
  );
}
