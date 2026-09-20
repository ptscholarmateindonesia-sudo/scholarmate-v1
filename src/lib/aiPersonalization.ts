import { EvaluatedScholarship, UserProfileData, humanFieldLabel } from './eligibilityEngine';
import { FitAnalysisResult, RecommendedNextAction } from './fitAnalysis';
import { formatExcelDate } from '../data/scholarships';

export interface PersonalizationOutput {
  shortFitExplanation: string;
  biggestGapExplanation: string;
  nextActionExplanation: string;
}

export interface PersonalizationState {
  enabled: boolean;
  secureRuntimeAvailable: boolean;
  callState: 'DISABLED' | 'LOADING' | 'SUCCESS' | 'FALLBACK' | 'ERROR';
  payloadSent: any | null;
  rawValidatedOutput: PersonalizationOutput | null;
  fallbackReason: string | null;
}

const FORBIDDEN_PHRASES = [
  "peluang lolos tinggi",
  "kemungkinan lolos tinggi",
  "pasti lolos",
  "dijamin lolos",
  "kesempatan lolos",
  "persentase lolos",
  "sangat berpeluang diterima"
];

const personalizationCache = new Map<string, PersonalizationOutput>();

export function getDeterministicFallbacks(evaluated: EvaluatedScholarship, fit: FitAnalysisResult | null): PersonalizationOutput {
  const isEligible = evaluated.status === 'ELIGIBLE';
  const isNeedsCheck = evaluated.status === 'NEEDS_CHECK';
  const schId = evaluated.scholarship.id;

  if (schId === 'BCA-BAKTI-2027' && isNeedsCheck) {
    if (evaluated.universalStatus === 'MISSING') {
      return {
        shortFitExplanation: "Sebagian syarat dasar profilmu sudah sesuai. Beberapa data universal Beasiswa Bakti BCA masih diperlukan.",
        biggestGapExplanation: "Data dasar untuk pengecekan Beasiswa Bakti BCA belum lengkap.",
        nextActionExplanation: "Lengkapi pengecekan Beasiswa Bakti BCA 2027"
      };
    }
    return {
      shortFitExplanation: "Profil dasarmu sudah sesuai, tetapi kategori Beasiswa Bakti BCA masih perlu dipilih untuk menyelesaikan pengecekan.",
      biggestGapExplanation: "Kategori Beasiswa Bakti BCA belum dipilih.",
      nextActionExplanation: "Lengkapi pengecekan Beasiswa Bakti BCA 2027"
    };
  }

  if (isEligible && schId === 'BCA-BAKTI-2027') {
    return {
      shortFitExplanation: "Profilmu sudah sesuai dengan syarat dasar kategori Bantuan Finansial. Fokus berikutnya adalah menyiapkan bukti aplikasi yang dibutuhkan.",
      biggestGapExplanation: "Dokumen pendukung kategori Bantuan Finansial belum lengkap di profil ScholarMate.",
      nextActionExplanation: "Mulai dari dokumen yang wajib agar persiapan aplikasi lebih terarah sebelum deadline."
    };
  }

  if (schId === 'JAPFA-EXT-2026-B2') {
    return {
      shortFitExplanation: `Profilmu memiliki potensi kecocokan ${fit?.fitLabel || 'baik'} untuk program JAPFA Cohort 2026.`,
      biggestGapExplanation: "Pastikan data keaktifan organisasi dan prestasi sesuai dengan kriteria kontribusi sosial JAPFA.",
      nextActionExplanation: "Lengkapi pendaftaran Beasiswa JAPFA melalui portal resmi."
    };
  }

  if (isEligible) {
    return {
      shortFitExplanation: `Profilmu memenuhi kriteria utama untuk ${evaluated.scholarship.name} dengan kecocokan ${fit?.fitLabel || 'baik'}.`,
      biggestGapExplanation: "Pastikan kelengkapan dokumen pendukung dan persiapan esai/wawancara sebelum batas waktu.",
      nextActionExplanation: "Siapkan dokumen pendaftaran sesuai persyaratan program."
    };
  }

  return {
    shortFitExplanation: "Hasil evaluasi menunjukkan kecocokan berdasarkan kriteria dasar program.",
    biggestGapExplanation: "Periksa kembali bagian persyaratan yang belum terpenuhi.",
    nextActionExplanation: "Ikuti langkah rekomendasi berikutnya."
  };
}

export function buildSanitizedPayload(
  evaluated: EvaluatedScholarship,
  userProfile: UserProfileData,
  fit: FitAnalysisResult | null,
  nextAction?: RecommendedNextAction
) {
  return {
    scholarship: {
      name: evaluated.scholarship.name,
      provider: evaluated.scholarship.provider,
      finalState: evaluated.status,
      universalStatus: evaluated.universalStatus || 'N/A',
      categoryStatus: evaluated.categoryStatus || 'N/A',
      deadline: formatExcelDate(evaluated.scholarship.deadline),
      selectedCategory: evaluated.scholarship.id === 'BCA-BAKTI-2027' ? (userProfile.bca_category_selected || 'NONE') : null
    },
    fit: fit ? {
      score: fit.totalFitScore,
      coverage: fit.evidenceCoverage,
      label: fit.fitLabel
    } : null,
    strengths: evaluated.passedRules.map(pr => humanFieldLabel(pr.rule.profileField)),
    gaps: evaluated.missingRules.map(mr => humanFieldLabel(mr.rule.profileField)),
    missingUniversalFields: (evaluated.missingUniversalFields || []).map(f => humanFieldLabel(f)),
    nextAction: nextAction ? {
      actionType: nextAction.actionType,
      title: nextAction.title,
      reason: nextAction.reason
    } : {
      title: "Lengkapi verifikasi data"
    },
    goal: userProfile.goal || "Cek kecocokan profil"
  };
}

export function getCacheKey(evaluated: EvaluatedScholarship, userProfile: UserProfileData, fit: FitAnalysisResult | null): string {
  const parts = [
    evaluated.scholarship.id,
    evaluated.status,
    evaluated.scholarship.id === 'BCA-BAKTI-2027' ? String(userProfile.bca_category_selected) : '',
    String(fit?.totalFitScore ?? 0),
    String(fit?.evidenceCoverage ?? 0),
    evaluated.passedRules.map(r => r.rule.id).sort().join(','),
    evaluated.missingRules.map(r => r.rule.id).sort().join(',')
  ];
  return parts.join('|');
}

export async function fetchPersonalization(
  evaluated: EvaluatedScholarship,
  userProfile: UserProfileData,
  fit: FitAnalysisResult | null,
  nextAction?: RecommendedNextAction,
  simulateError?: string
): Promise<{ output: PersonalizationOutput; state: Partial<PersonalizationState> }> {
  const cacheKey = getCacheKey(evaluated, userProfile, fit);
  if (personalizationCache.has(cacheKey) && !simulateError) {
    return {
      output: personalizationCache.get(cacheKey)!,
      state: {
        callState: 'SUCCESS',
        rawValidatedOutput: personalizationCache.get(cacheKey)!,
        fallbackReason: null
      }
    };
  }

  const payload = buildSanitizedPayload(evaluated, userProfile, fit, nextAction);

  try {
    const res = await fetch('/api/personalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload, simulateError })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.fallbackReason || data.error || 'Server error');
    }

    const output = data.output as PersonalizationOutput;
    personalizationCache.set(cacheKey, output);

    return {
      output,
      state: {
        callState: 'SUCCESS',
        payloadSent: payload,
        rawValidatedOutput: output,
        fallbackReason: null
      }
    };
  } catch (err: any) {
    const fallback = getDeterministicFallbacks(evaluated, fit);
    return {
      output: fallback,
      state: {
        callState: 'FALLBACK',
        payloadSent: payload,
        rawValidatedOutput: null,
        fallbackReason: err.message || 'network_or_validation_error'
      }
    };
  }
}
