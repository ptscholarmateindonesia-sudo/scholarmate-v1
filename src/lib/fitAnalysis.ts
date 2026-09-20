import { Scholarship } from '../data/scholarships';
import {
  EvaluatedScholarship,
  UserProfileData,
  humanFieldLabel,
} from './eligibilityEngine';
import { DerivedProfileFields } from '../data/campusMajorMapping';

export type FitLabel = 'Strong Match' | 'Moderate Match' | 'Potential Match' | 'Basic Match';

export type GapType =
  | 'ELIGIBILITY_MISSING'
  | 'PREPARATION_MISSING'
  | 'EVIDENCE_MISSING'
  | 'TIMING'
  | 'PROFILE_BUILDING';

export interface FitStrength {
  title: string;
  evidence: string;
  sourceType: 'USER_PROFILE' | 'DERIVED_PROFILE' | 'SCHOLARSHIP_CRITERIA';
}

export interface FitGap {
  type: GapType;
  title: string;
  description: string;
  fieldKey?: string;
  scholarshipId?: string;
}

export type SignalEvaluationStatus = 'PASS' | 'FAIL' | 'UNKNOWN';

export interface ApplicableSignal {
  name: string;
  weight: number;
  status: SignalEvaluationStatus;
  detail: string;
}

export interface DimensionAudit {
  applicableSignals: ApplicableSignal[];
  excludedSignals: string[];
}

export interface DimensionScore {
  score: number;
  maxScore: number;
  evidence: string[];
  unknownFactors: string[];
  audit: DimensionAudit;
}

export interface CoverageAudit {
  knownApplicableWeight: number;
  unknownApplicableWeight: number;
  totalApplicableWeight: number;
  coveragePercentage: number;
  knownSignals: { name: string; weight: number }[];
  unknownSignals: { name: string; weight: number }[];
}

export interface FitAnalysisResult {
  scholarshipId: string;
  isActionable: boolean; // Only true for ELIGIBLE and NEEDS_CHECK
  totalFitScore: number; // 0 - 100
  evidenceCoverage: number; // 0 - 100 (%)
  fitLabel: FitLabel;
  disclaimer: string;
  dimensions: {
    academicAlignment: DimensionScore; // max 30
    activityAlignment: DimensionScore; // max 30
    goalAlignment: DimensionScore; // max 20
    preparationEvidence: DimensionScore; // max 20
  };
  coverageAudit: CoverageAudit;
  strengths: FitStrength[]; // max 3
  gaps: FitGap[]; // max 2
}

export interface RecommendedNextAction {
  actionType: 'COMPLETE_CHECK' | 'PREPARE_APPLICATION' | 'DRAFT_ESSAY' | 'PREPARE_INTERVIEW' | 'MONITOR_CYCLE' | 'BUILD_PROFILE';
  title: string;
  reason: string;
  buttonLabel: string;
  estimatedMinutes?: number;
  scholarshipId?: string;
}

export interface GlobalBiggestGap {
  main: string;
  supporting: string;
  type: GapType;
  scholarshipId?: string;
}

export const FIT_DISCLAIMER = 'Fit Score menunjukkan kecocokan profil, bukan peluang lolos.';

/**
 * Helper to distribute a total target dimension weight (e.g. 30 or 20)
 * into clean integer weights summing EXACTLY to totalWeight.
 */
function distributeDimensionWeights(count: number, totalWeight: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(totalWeight / count);
  const remainder = totalWeight % count;
  const weights: number[] = [];
  for (let i = 0; i < count; i++) {
    weights.push(base + (i < remainder ? 1 : 0));
  }
  return weights;
}

/**
 * Deterministically evaluates the 4-dimension Fit Analysis for a scholarship
 * with STRICT applicable evidence weights and no arbitrary partial scores.
 */
export function evaluateScholarshipFit(
  evaluatedSch: EvaluatedScholarship,
  userProfile: UserProfileData,
  derivedFields: DerivedProfileFields
): FitAnalysisResult | null {
  const { scholarship, status } = evaluatedSch;

  // Fit Analysis is ONLY generated for actionable scholarships: ELIGIBLE or NEEDS_CHECK
  const isActionable = status === 'ELIGIBLE' || status === 'NEEDS_CHECK';
  if (!isActionable) {
    return null;
  }

  const sch = scholarship;

  // =========================================================================
  // 1. ACADEMIC ALIGNMENT (Max: 30 pts)
  // Identify applicable verified academic signals only.
  // =========================================================================
  const academicExcluded: string[] = [];
  const rawAcademicSignals: { key: string; name: string }[] = [];

  // Check 1: Education Level (Applicable if program specifies educationLevel)
  if (sch.educationLevel) {
    rawAcademicSignals.push({ key: 'level', name: 'Jenjang pendidikan' });
  } else {
    academicExcluded.push('Jenjang pendidikan (tidak dibatasi)');
  }

  // Check 2: Semester (Applicable if program specifies semester boundaries)
  if (sch.semesterMin !== undefined || sch.semesterMax !== undefined) {
    rawAcademicSignals.push({ key: 'semester', name: 'Semester' });
  } else {
    academicExcluded.push('Semester (tidak dibatasi)');
  }

  // Check 3: GPA (ONLY applicable if scholarship HAS a verified minimum numerical GPA requirement or category-specific GPA)
  let effectiveMinGpa = sch.minGpa;
  if (sch.id === 'BCA-BAKTI-2027') {
    if (userProfile.bca_category_selected === 'FINANCIAL') {
      effectiveMinGpa = 3.00;
    } else if (userProfile.bca_category_selected === 'ACADEMIC') {
      effectiveMinGpa = 3.25;
    } else if (userProfile.bca_category_selected === 'NON_ACADEMIC') {
      effectiveMinGpa = null;
    }
  }

  if (effectiveMinGpa !== null && effectiveMinGpa !== undefined && effectiveMinGpa > 0) {
    rawAcademicSignals.push({ key: 'gpa', name: `IPK minimum (>= ${effectiveMinGpa.toFixed(2)})` });
  } else {
    academicExcluded.push('Batas IPK numerik (tidak disyaratkan)');
  }

  // Check 4: Major Scope (Applicable ONLY if scholarship restricts/prioritizes specific majors)
  if (sch.majorScope === 'SPECIFIC_MAJOR') {
    rawAcademicSignals.push({ key: 'major', name: 'Kesesuaian Rumpun Jurusan' });
  } else {
    academicExcluded.push('Kesesuaian Jurusan (terbuka untuk semua jurusan)');
  }

  // Check 5: Campus Scope (Applicable if scholarship restricts to PTN or partner list)
  if (sch.universityScope === 'PTN' || sch.universityScope === 'SPECIFIC_UNIVERSITY') {
    const scopeLabel = sch.universityScope === 'PTN' ? 'Tipe Perguruan Tinggi (PTN)' : 'Daftar Kampus Mitra Resmi';
    rawAcademicSignals.push({ key: 'campus', name: scopeLabel });
  } else {
    academicExcluded.push('Tipe Kampus (terbuka untuk semua kampus)');
  }

  // Fallback if no specific academic restriction exists: level + semester baseline
  if (rawAcademicSignals.length === 0) {
    rawAcademicSignals.push({ key: 'level', name: 'Jenjang pendidikan' });
    rawAcademicSignals.push({ key: 'semester', name: 'Semester' });
  }

  // Distribute 30 points across applicable academic signals
  const academicWeights = distributeDimensionWeights(rawAcademicSignals.length, 30);
  const academicSignals: ApplicableSignal[] = [];
  let academicScore = 0;
  const academicEvidence: string[] = [];
  const academicUnknowns: string[] = [];

  rawAcademicSignals.forEach((sig, idx) => {
    const weight = academicWeights[idx];
    let sigStatus: SignalEvaluationStatus = 'UNKNOWN';
    let detail = '';

    if (sig.key === 'level') {
      if (userProfile.education_level) {
        const isMulti = sch.educationLevel === 'MULTI';
        const levelMatch = isMulti || (sch.educationLevel && sch.educationLevel.toUpperCase().includes(userProfile.education_level.toUpperCase()));
        if (levelMatch) {
          sigStatus = 'PASS';
          detail = `Jenjang ${userProfile.education_level} sesuai ketentuan program (${sch.educationLevel || 'Multi'})`;
          academicScore += weight;
          academicEvidence.push(detail);
        } else {
          sigStatus = 'FAIL';
          detail = `Jenjang ${userProfile.education_level} tidak sesuai dengan ${sch.educationLevel}`;
        }
      } else {
        sigStatus = 'UNKNOWN';
        detail = 'Jenjang pendidikan belum tercatat';
        academicUnknowns.push(detail);
      }
    } else if (sig.key === 'semester') {
      if (userProfile.semester !== null && userProfile.semester !== undefined) {
        const semMin = sch.semesterMin ?? 1;
        const semMax = sch.semesterMax ?? 8;
        if (userProfile.semester >= semMin && userProfile.semester <= semMax) {
          sigStatus = 'PASS';
          detail = `Semester ${userProfile.semester} sesuai rentang program (${semMin}–${semMax})`;
          academicScore += weight;
          academicEvidence.push(detail);
        } else {
          sigStatus = 'FAIL';
          detail = `Semester ${userProfile.semester} di luar rentang program (${semMin}–${semMax})`;
        }
      } else {
        sigStatus = 'UNKNOWN';
        detail = 'Data semester belum tercatat';
        academicUnknowns.push(detail);
      }
    } else if (sig.key === 'gpa') {
      if (userProfile.gpa !== null && userProfile.gpa !== undefined && !isNaN(userProfile.gpa)) {
        const targetMinGpa = effectiveMinGpa ?? (sch.minGpa ?? 0);
        if (userProfile.gpa >= targetMinGpa) {
          sigStatus = 'PASS';
          detail = `IPK ${userProfile.gpa.toFixed(2)} memenuhi batas minimum program (${targetMinGpa.toFixed(2)})`;
          academicScore += weight;
          academicEvidence.push(detail);
        } else {
          sigStatus = 'FAIL';
          detail = `IPK ${userProfile.gpa.toFixed(2)} di bawah batas minimum program (${targetMinGpa.toFixed(2)})`;
        }
      } else {
        sigStatus = 'UNKNOWN';
        detail = 'Data IPK belum tercatat';
        academicUnknowns.push(detail);
      }
    } else if (sig.key === 'major') {
      if (userProfile.major) {
        if (derivedFields.major_group === 'STEM' || sch.notesInternal?.includes('STEM')) {
          sigStatus = 'PASS';
          detail = `Jurusan ${userProfile.major} (${derivedFields.major_group || 'Spesifik'}) sesuai prioritas bidang program`;
          academicScore += weight;
          academicEvidence.push(detail);
        } else {
          sigStatus = 'PASS';
          detail = `Jurusan ${userProfile.major} dalam evaluasi kesesuaian program`;
          academicScore += weight;
          academicEvidence.push(detail);
        }
      } else {
        sigStatus = 'UNKNOWN';
        detail = 'Data jurusan belum tercatat';
        academicUnknowns.push(detail);
      }
    } else if (sig.key === 'campus') {
      if (userProfile.university) {
        if (sch.universityScope === 'PTN') {
          if (derivedFields.university_type === 'PTN') {
            sigStatus = 'PASS';
            detail = `${userProfile.university} berstatus PTN sesuai ketentuan beasiswa`;
            academicScore += weight;
            academicEvidence.push(detail);
          } else {
            sigStatus = 'FAIL';
            detail = `${userProfile.university} bukan perguruan tinggi negeri (PTN)`;
          }
        } else if (sch.universityScope === 'SPECIFIC_UNIVERSITY') {
          const isPartner =
            (sch.id === 'BCB-2026' && derivedFields.university_in_baznas_partner_list) ||
            (sch.id === 'TANOTO-TELADAN-2027' && derivedFields.university_in_teladan_partner_list) ||
            (sch.id === 'KSE-2026' && derivedFields.university_in_kse_partner_list) ||
            (sch.id === 'PERTAMINA-SOBAT-BUMI-2026' && derivedFields.university_in_pertamina_partner_list) ||
            (sch.id === 'DJARUM-PLUS-2026' && derivedFields.university_in_djarum_partner_list);

          if (isPartner) {
            sigStatus = 'PASS';
            detail = `${userProfile.university} terdaftar dalam mitra resmi beasiswa`;
            academicScore += weight;
            academicEvidence.push(detail);
          } else {
            sigStatus = 'FAIL';
            detail = `${userProfile.university} belum teridentifikasi dalam mitra resmi`;
          }
        }
      } else {
        sigStatus = 'UNKNOWN';
        detail = 'Data perguruan tinggi belum tercatat';
        academicUnknowns.push(detail);
      }
    }

    academicSignals.push({
      name: sig.name,
      weight,
      status: sigStatus,
      detail,
    });
  });

  // =========================================================================
  // 2. ACTIVITY ALIGNMENT (Max: 30 pts)
  // Identify applicable verified activity criteria only.
  // =========================================================================
  const activityExcluded: string[] = [];
  const rawActivitySignals: { key: string; name: string }[] = [];

  const requiresOrg =
    sch.id === 'BCB-2026' ||
    sch.id === 'BCA-BAKTI-2027' ||
    sch.id === 'TANOTO-TELADAN-2027' ||
    sch.id === 'DJARUM-PLUS-2026' ||
    sch.id === 'PERTAMINA-SOBAT-BUMI-2026' ||
    sch.id === 'KSE-2026' ||
    sch.id === 'JAPFA-EXT-2026-B2';

  let requiresAchievement =
    sch.id === 'BCB-2026' ||
    sch.id === 'DJARUM-PLUS-2026' ||
    sch.id === 'KALLA-2026' ||
    sch.id === 'TANOTO-TELADAN-2027';

  if (sch.id === 'BCA-BAKTI-2027') {
    if (userProfile.bca_category_selected === 'ACADEMIC') {
      requiresAchievement = true;
    } else if (userProfile.bca_category_selected === 'NON_ACADEMIC') {
      requiresAchievement = true;
    } else {
      // FINANCIAL or unselected: general BCA only requires org, not achievement
      requiresAchievement = false;
    }
  }

  const requiresVolunteer =
    sch.id === 'PERTAMINA-SOBAT-BUMI-2026' ||
    sch.id === 'KSE-2026' ||
    sch.id === 'JAPFA-EXT-2026-B2';

  if (requiresOrg) {
    rawActivitySignals.push({ key: 'org', name: 'Pengalaman Organisasi / Kepanitiaan' });
  } else {
    activityExcluded.push('Pengalaman Organisasi (tidak disyaratkan)');
  }

  if (requiresAchievement) {
    rawActivitySignals.push({ key: 'achievement', name: 'Prestasi Kompetisi / Akademik' });
  } else {
    activityExcluded.push('Prestasi Kompetisi (tidak disyaratkan)');
  }

  if (requiresVolunteer) {
    rawActivitySignals.push({ key: 'volunteer', name: 'Aktivitas Sosial / Kerelawanan' });
  } else {
    activityExcluded.push('Aktivitas Sosial / Kerelawanan (tidak disyaratkan)');
  }

  // If no activity is required, award 30 for general profile compatibility
  if (rawActivitySignals.length === 0) {
    rawActivitySignals.push({ key: 'general_activity', name: 'Karakter Program Umum (Tanpa Syarat Aktivitas Khusus)' });
  }

  const activityWeights = distributeDimensionWeights(rawActivitySignals.length, 30);
  const activitySignals: ApplicableSignal[] = [];
  let activityScore = 0;
  const activityEvidence: string[] = [];
  const activityUnknowns: string[] = [];

  rawActivitySignals.forEach((sig, idx) => {
    const weight = activityWeights[idx];
    let sigStatus: SignalEvaluationStatus = 'UNKNOWN';
    let detail = '';

    if (sig.key === 'org') {
      if (userProfile.has_organization !== null && userProfile.has_organization !== undefined) {
        if (userProfile.has_organization === true) {
          sigStatus = 'PASS';
          detail = 'Pengalaman organisasi tercatat di profil';
          activityScore += weight;
          activityEvidence.push(detail);
        } else {
          sigStatus = 'FAIL';
          detail = 'Belum memiliki catatan keaktifan organisasi';
        }
      } else {
        sigStatus = 'UNKNOWN';
        detail = 'Status keaktifan organisasi belum dicatat';
        activityUnknowns.push(detail);
      }
    } else if (sig.key === 'achievement') {
      let hasAch = userProfile.has_achievement;
      if (sch.id === 'BCA-BAKTI-2027') {
        if (userProfile.bca_category_selected === 'ACADEMIC') {
          hasAch = userProfile.has_academic_achievement ?? userProfile.has_achievement;
        } else if (userProfile.bca_category_selected === 'NON_ACADEMIC') {
          hasAch = userProfile.has_nonacademic_achievement_province_last3years ?? userProfile.has_achievement;
        }
      }

      if (hasAch !== null && hasAch !== undefined) {
        if (hasAch === true) {
          sigStatus = 'PASS';
          detail = 'Catatan prestasi kompetisi/akademik tersedia dalam profil';
          activityScore += weight;
          activityEvidence.push(detail);
        } else {
          sigStatus = 'FAIL';
          detail = 'Belum mencatat prestasi yang disyaratkan kategori beasiswa';
        }
      } else {
        sigStatus = 'UNKNOWN';
        detail = 'Status prestasi belum dicatat';
        activityUnknowns.push(detail);
      }
    } else if (sig.key === 'volunteer') {
      if (userProfile.has_volunteer !== null && userProfile.has_volunteer !== undefined) {
        if (userProfile.has_volunteer === true) {
          sigStatus = 'PASS';
          detail = 'Aktivitas sosial/kerelawanan tersedia dalam profil';
          activityScore += weight;
          activityEvidence.push(detail);
        } else {
          sigStatus = 'FAIL';
          detail = 'Belum mencatat kegiatan kerelawanan';
        }
      } else {
        sigStatus = 'UNKNOWN';
        detail = 'Status kegiatan sosial belum dicatat';
        activityUnknowns.push(detail);
      }
    } else if (sig.key === 'general_activity') {
      sigStatus = 'PASS';
      detail = 'Program tidak mensyaratkan portofolio aktivitas khusus';
      activityScore += weight;
      activityEvidence.push(detail);
    }

    activitySignals.push({
      name: sig.name,
      weight,
      status: sigStatus,
      detail,
    });
  });

  // =========================================================================
  // 3. GOAL ALIGNMENT (Max: 20 pts)
  // Deterministic mapping based on documented user goal & scholarship state.
  // =========================================================================
  const goalExcluded: string[] = [];
  const rawGoalSignals: { key: string; name: string }[] = [
    { key: 'goal_match', name: 'Kesesuaian Target & Status Program' }
  ];

  const goalWeights = [20];
  const goalSignals: ApplicableSignal[] = [];
  let goalScore = 0;
  const goalEvidence: string[] = [];
  const goalUnknowns: string[] = [];

  const userGoal = userProfile.goal || 'Cek kecocokan profil';
  let goalStatus: SignalEvaluationStatus = 'UNKNOWN';
  let goalDetail = '';

  if (userProfile.goal) {
    if (userGoal === 'Cek kecocokan profil') {
      // Goal 1: Profile Fit check -> active actionable scholarships get full 20/20
      goalStatus = 'PASS';
      goalScore = 20;
      goalDetail = 'Sesuai dengan target evaluasi kelayakan program beasiswa aktif';
      goalEvidence.push(goalDetail);
    } else if (userGoal === 'Cari beasiswa aktif') {
      // Goal 2: Search Active scholarships -> active scholarships get 20/20
      if (sch.status === 'OPEN') {
        goalStatus = 'PASS';
        goalScore = 20;
        goalDetail = 'Program berstatus aktif dan sedang membuka pendaftaran';
        goalEvidence.push(goalDetail);
      } else {
        goalStatus = 'FAIL';
        goalDetail = 'Program berstatus ditutup (belum membuka pendaftaran baru)';
      }
    } else if (userGoal === 'Siapkan aplikasi') {
      // Goal 3: Prepare Application -> ELIGIBLE gets 20/20, NEEDS_CHECK gets 15/20 (documented)
      if (status === 'ELIGIBLE' && sch.status === 'OPEN') {
        goalStatus = 'PASS';
        goalScore = 20;
        goalDetail = 'Status telah terverifikasi cocok dan siap untuk persiapan aplikasi';
        goalEvidence.push(goalDetail);
      } else if (status === 'NEEDS_CHECK' && sch.status === 'OPEN') {
        goalStatus = 'PASS';
        goalScore = 15; // Documented rule: 15/20 because eligibility is not yet final
        goalDetail = 'Program aktif, memerlukan penyelesaian verifikasi sebelum berkas disiapkan';
        goalEvidence.push(goalDetail);
      } else {
        goalStatus = 'FAIL';
        goalDetail = 'Program tidak dalam status pendaftaran aktif';
      }
    } else if (userGoal === 'Bangun profil dari sekarang') {
      // Goal 4: Profile Building -> full alignment
      goalStatus = 'PASS';
      goalScore = 20;
      goalDetail = 'Relevan sebagai target penguatan profil beasiswa';
      goalEvidence.push(goalDetail);
    }
  } else {
    goalStatus = 'UNKNOWN';
    goalDetail = 'Tujuan spesifik belum dipilih oleh user';
    goalUnknowns.push(goalDetail);
  }

  goalSignals.push({
    name: 'Kesesuaian Target Profil & Status Program',
    weight: 20,
    status: goalStatus,
    detail: goalDetail,
  });

  // =========================================================================
  // 4. PREPARATION EVIDENCE (Max: 20 pts)
  // Evaluates explicit known preparation items only.
  // Unknown items receive weight with status UNKNOWN (+0).
  // =========================================================================
  const prepExcluded: string[] = [];
  const rawPrepSignals: { key: string; name: string }[] = [];

  if (sch.id === 'BCA-BAKTI-2027') {
    const cat = userProfile.bca_category_selected;
    if (cat === 'FINANCIAL') {
      rawPrepSignals.push({ key: 'org_doc_prep', name: 'Dokumen Pendukung Organisasi/Kepanitiaan' });
      rawPrepSignals.push({ key: 'financial_rec_prep', name: 'Surat Rekomendasi Terkendala Finansial' });
      prepExcluded.push('Sertifikat Prestasi (tidak disyaratkan kategori Finansial)');
      prepExcluded.push('Video Talenta (tidak disyaratkan kategori Finansial)');
    } else if (cat === 'ACADEMIC') {
      rawPrepSignals.push({ key: 'org_doc_prep', name: 'Dokumen Pendukung Organisasi/Kepanitiaan' });
      rawPrepSignals.push({ key: 'academic_cert_prep', name: 'Sertifikat Prestasi Akademis' });
      prepExcluded.push('Surat Rekomendasi Finansial (tidak disyaratkan kategori Akademis)');
      prepExcluded.push('Video Talenta (tidak disyaratkan kategori Akademis)');
    } else if (cat === 'NON_ACADEMIC') {
      rawPrepSignals.push({ key: 'nonacademic_doc_prep', name: 'Dokumen Prestasi Non-Akademis' });
      rawPrepSignals.push({ key: 'talent_video_prep', name: 'Video Talenta 30 Detik' });
      prepExcluded.push('Surat Rekomendasi Finansial (tidak disyaratkan kategori Non-Akademis)');
      prepExcluded.push('Dokumen Organisasi (tidak disyaratkan kategori Non-Akademis)');
    } else {
      if (requiresOrg) rawPrepSignals.push({ key: 'org_detail', name: 'Detail Bukti Pengalaman Organisasi' });
      if (requiresAchievement) rawPrepSignals.push({ key: 'achievement_detail', name: 'Detail Bukti Prestasi Kompetisi' });
    }
    if (sch.essayRequired === 'YES') {
      rawPrepSignals.push({ key: 'essay_prep', name: 'Draft & Persiapan Esai Beasiswa' });
    } else {
      prepExcluded.push('Draft Esai Beasiswa (tidak disyaratkan)');
    }
    if (sch.interviewRequired === 'YES') {
      rawPrepSignals.push({ key: 'interview_prep', name: 'Persiapan Seleksi Wawancara' });
    } else {
      prepExcluded.push('Persiapan Wawancara (tidak ada tahap wawancara)');
    }
  } else {
    // Check 1: Organization detail evidence (Applicable if program requires organization)
    if (requiresOrg) {
      rawPrepSignals.push({ key: 'org_detail', name: 'Detail Bukti Pengalaman Organisasi' });
    } else {
      prepExcluded.push('Detail Bukti Organisasi (tidak disyaratkan)');
    }

    // Check 2: Competition achievement detail (Applicable if program requires achievement)
    if (requiresAchievement) {
      rawPrepSignals.push({ key: 'achievement_detail', name: 'Detail Bukti Prestasi Kompetisi' });
    } else {
      prepExcluded.push('Detail Bukti Prestasi (tidak disyaratkan)');
    }

    // Check 3: Essay Preparation (Applicable if scholarship explicitly requires essay)
    if (sch.essayRequired === 'YES') {
      rawPrepSignals.push({ key: 'essay_prep', name: 'Draft & Persiapan Esai Beasiswa' });
    } else {
      prepExcluded.push('Draft Esai Beasiswa (tidak disyaratkan)');
    }

    // Check 4: Interview Preparation (Applicable if scholarship explicitly has interview selection)
    if (sch.interviewRequired === 'YES') {
      rawPrepSignals.push({ key: 'interview_prep', name: 'Persiapan Seleksi Wawancara' });
    } else {
      prepExcluded.push('Persiapan Wawancara (tidak ada tahap wawancara)');
    }

    // Fallback if no specific preparation requirement: General document readiness
    if (rawPrepSignals.length === 0) {
      rawPrepSignals.push({ key: 'general_admin', name: 'Kesiapan Berkas Administrasi Umum' });
    }
  }

  const prepWeights = distributeDimensionWeights(rawPrepSignals.length, 20);
  const prepSignals: ApplicableSignal[] = [];
  let prepScore = 0;
  const prepEvidence: string[] = [];
  const prepUnknowns: string[] = [];

  rawPrepSignals.forEach((sig, idx) => {
    const weight = prepWeights[idx];
    let sigStatus: SignalEvaluationStatus = 'UNKNOWN';
    let detail = '';

    if (sig.key === 'org_detail') {
      // For V0: We only know boolean has_organization. Detailed role/impact is UNKNOWN.
      sigStatus = 'UNKNOWN';
      detail = 'Detail pengalaman organisasi belum dinilai secara mendalam';
      prepUnknowns.push(detail);
    } else if (sig.key === 'achievement_detail') {
      // For V0: We only know boolean has_achievement. Detailed evidence is UNKNOWN.
      sigStatus = 'UNKNOWN';
      detail = 'Bukti sertifikat prestasi belum dinilai';
      prepUnknowns.push(detail);
    } else if (sig.key === 'essay_prep') {
      sigStatus = 'UNKNOWN';
      detail = 'Draft esai beasiswa belum disusun atau dianalisis';
      prepUnknowns.push(detail);
    } else if (sig.key === 'interview_prep') {
      sigStatus = 'UNKNOWN';
      detail = 'Persiapan wawancara belum dinilai';
      prepUnknowns.push(detail);
    } else if (sig.key === 'general_admin') {
      sigStatus = 'PASS';
      detail = 'Persyaratan administrasi dasar umum';
      prepScore += weight;
      prepEvidence.push(detail);
    } else if (sig.key === 'org_doc_prep') {
      const val = userProfile.has_organization_document;
      sigStatus = val === true ? 'PASS' : 'UNKNOWN';
      detail = val === true ? 'Dokumen pendukung organisasi telah disiapkan' : 'Dokumen pendukung organisasi belum lengkap';
      if (sigStatus === 'PASS') {
        prepScore += weight;
        prepEvidence.push(detail);
      } else {
        prepUnknowns.push(detail);
      }
    } else if (sig.key === 'financial_rec_prep') {
      const val = userProfile.has_financial_constraint_recommendation_letter;
      sigStatus = val === true ? 'PASS' : 'UNKNOWN';
      detail = val === true ? 'Surat rekomendasi finansial telah disiapkan' : 'Surat rekomendasi finansial belum lengkap';
      if (sigStatus === 'PASS') {
        prepScore += weight;
        prepEvidence.push(detail);
      } else {
        prepUnknowns.push(detail);
      }
    } else if (sig.key === 'academic_cert_prep') {
      const val = userProfile.has_academic_achievement_certificate;
      sigStatus = val === true ? 'PASS' : 'UNKNOWN';
      detail = val === true ? 'Sertifikat prestasi akademis telah disiapkan' : 'Sertifikat prestasi akademis belum lengkap';
      if (sigStatus === 'PASS') {
        prepScore += weight;
        prepEvidence.push(detail);
      } else {
        prepUnknowns.push(detail);
      }
    } else if (sig.key === 'nonacademic_doc_prep') {
      const val = userProfile.has_nonacademic_achievement_document;
      sigStatus = val === true ? 'PASS' : 'UNKNOWN';
      detail = val === true ? 'Dokumen prestasi non-akademis telah disiapkan' : 'Dokumen prestasi non-akademis belum lengkap';
      if (sigStatus === 'PASS') {
        prepScore += weight;
        prepEvidence.push(detail);
      } else {
        prepUnknowns.push(detail);
      }
    } else if (sig.key === 'talent_video_prep') {
      const val = userProfile.has_talent_video_30s;
      sigStatus = val === true ? 'PASS' : 'UNKNOWN';
      detail = val === true ? 'Video talenta 30 detik telah disiapkan' : 'Video talenta 30 detik belum lengkap';
      if (sigStatus === 'PASS') {
        prepScore += weight;
        prepEvidence.push(detail);
      } else {
        prepUnknowns.push(detail);
      }
    }

    prepSignals.push({
      name: sig.name,
      weight,
      status: sigStatus,
      detail,
    });
  });

  // =========================================================================
  // TOTAL FIT SCORE (0 - 100)
  // =========================================================================
  const totalFitScore = academicScore + activityScore + goalScore + prepScore;

  // =========================================================================
  // 5. EVIDENCE COVERAGE AUDIT
  // Formula: known applicable signal weight / total applicable signal weight * 100
  // Note: Coverage uses evidence availability (PASS or FAIL), not UNKNOWN.
  // =========================================================================
  const allSignals: ApplicableSignal[] = [
    ...academicSignals,
    ...activitySignals,
    ...goalSignals,
    ...prepSignals,
  ];

  let knownApplicableWeight = 0;
  let unknownApplicableWeight = 0;
  const knownSignalsList: { name: string; weight: number }[] = [];
  const unknownSignalsList: { name: string; weight: number }[] = [];

  allSignals.forEach((sig) => {
    if (sig.status === 'PASS' || sig.status === 'FAIL') {
      knownApplicableWeight += sig.weight;
      knownSignalsList.push({ name: `${sig.name} (${sig.status})`, weight: sig.weight });
    } else {
      unknownApplicableWeight += sig.weight;
      unknownSignalsList.push({ name: `${sig.name} (UNKNOWN)`, weight: sig.weight });
    }
  });

  const totalApplicableWeight = knownApplicableWeight + unknownApplicableWeight; // Exactly 100
  const evidenceCoverage = totalApplicableWeight > 0
    ? Math.round((knownApplicableWeight / totalApplicableWeight) * 100)
    : 0;

  const coverageAudit: CoverageAudit = {
    knownApplicableWeight,
    unknownApplicableWeight,
    totalApplicableWeight,
    coveragePercentage: evidenceCoverage,
    knownSignals: knownSignalsList,
    unknownSignals: unknownSignalsList,
  };

  // =========================================================================
  // FIT LABEL ASSIGNMENT
  // =========================================================================
  let fitLabel: FitLabel = 'Potential Match';

  if (status === 'NEEDS_CHECK') {
    // NEEDS_CHECK is always Potential Match regardless of score
    fitLabel = 'Potential Match';
  } else if (status === 'ELIGIBLE') {
    if (evidenceCoverage < 50) {
      fitLabel = 'Potential Match';
    } else if (totalFitScore >= 75) {
      fitLabel = 'Strong Match';
    } else if (totalFitScore >= 50) {
      fitLabel = 'Moderate Match';
    } else {
      fitLabel = 'Basic Match';
    }
  }

  // =========================================================================
  // EXTRACT TOP STRENGTHS (Max 3)
  // =========================================================================
  const strengths: FitStrength[] = [];

  if (userProfile.education_level && userProfile.semester) {
    strengths.push({
      title: 'Jenjang & Semester Sesuai',
      evidence: `Jenjang ${userProfile.education_level} semester ${userProfile.semester} sesuai ketentuan program.`,
      sourceType: 'USER_PROFILE',
    });
  }

  if (derivedFields.major_group === 'STEM' && sch.notesInternal?.includes('STEM')) {
    strengths.push({
      title: 'Rumpun Studi Sesuai',
      evidence: `${userProfile.major || 'Jurusan'} dipetakan ke rumpun STEM yang diprioritaskan program.`,
      sourceType: 'DERIVED_PROFILE',
    });
  } else if (derivedFields.university_type === 'PTN' && sch.universityScope === 'PTN') {
    strengths.push({
      title: 'Perguruan Tinggi Sesuai',
      evidence: `${userProfile.university || 'Kampus'} berstatus PTN sesuai ketentuan beasiswa.`,
      sourceType: 'DERIVED_PROFILE',
    });
  } else if (derivedFields.university_in_baznas_partner_list && sch.id === 'BCB-2026') {
    strengths.push({
      title: 'Kampus Mitra Terdaftar',
      evidence: `${userProfile.university || 'Kampus'} terdaftar dalam 246 mitra beasiswa BAZNAS.`,
      sourceType: 'DERIVED_PROFILE',
    });
  }

  if (userProfile.has_organization === true && strengths.length < 3 && requiresOrg) {
    strengths.push({
      title: 'Pengalaman Organisasi Tersedia',
      evidence: 'Pengalaman organisasi tercatat di profil.',
      sourceType: 'USER_PROFILE',
    });
  } else if (userProfile.has_achievement === true && strengths.length < 3 && requiresAchievement) {
    strengths.push({
      title: 'Prestasi Kompetisi Tersedia',
      evidence: 'Catatan prestasi kompetisi tersedia dalam profil.',
      sourceType: 'USER_PROFILE',
    });
  } else if (userProfile.gpa && sch.minGpa && userProfile.gpa >= sch.minGpa && strengths.length < 3) {
    strengths.push({
      title: 'IPK Memenuhi Batas',
      evidence: `IPK ${userProfile.gpa.toFixed(2)} memenuhi batas minimum ${sch.minGpa.toFixed(2)}.`,
      sourceType: 'USER_PROFILE',
    });
  }

  // =========================================================================
  // EXTRACT TOP GAPS (Max 2)
  // Strictly prioritize ELIGIBILITY_MISSING > PREPARATION_MISSING > EVIDENCE_MISSING
  // =========================================================================
  const gaps: FitGap[] = [];

  if (status === 'NEEDS_CHECK') {
    const missingFieldsText = evaluatedSch.missingFieldKeys
      .map((k) => humanFieldLabel(k))
      .slice(0, 2)
      .join(', ');
    gaps.push({
      type: 'ELIGIBILITY_MISSING',
      title: 'Konfirmasi Syarat Khusus',
      description: `Masih membutuhkan data: ${missingFieldsText || 'kriteria tambahan'} untuk menyelesaikan verifikasi syarat.`,
      scholarshipId: sch.id,
    });
  }

  if (sch.essayRequired === 'YES' && gaps.length < 2) {
    gaps.push({
      type: 'PREPARATION_MISSING',
      title: 'Draft Esai Belum Tersedia',
      description: 'Program mensyaratkan esai pendaftaran yang perlu disiapkan sebelum batas pendaftaran.',
      scholarshipId: sch.id,
    });
  }

  if (sch.interviewRequired === 'YES' && gaps.length < 2) {
    gaps.push({
      type: 'PREPARATION_MISSING',
      title: 'Persiapan Wawancara',
      description: 'Program memiliki tahapan wawancara, tetapi ScholarMate belum memiliki data persiapan interview kamu.',
      scholarshipId: sch.id,
    });
  }

  if (userProfile.has_organization === true && gaps.length < 2) {
    gaps.push({
      type: 'EVIDENCE_MISSING',
      title: 'Detail Pengalaman Organisasi',
      description: 'Detail pengalaman organisasi belum tersedia untuk menilai peran dan dampaknya.',
    });
  } else if (userProfile.has_organization === false && requiresOrg && gaps.length < 2) {
    gaps.push({
      type: 'PROFILE_BUILDING',
      title: 'Pengalaman Organisasi Belum Ada',
      description: 'Keaktifan organisasi bernilai tambah pada proses seleksi program ini.',
    });
  }

  return {
    scholarshipId: sch.id,
    isActionable,
    totalFitScore,
    evidenceCoverage,
    fitLabel,
    disclaimer: FIT_DISCLAIMER,
    dimensions: {
      academicAlignment: {
        score: academicScore,
        maxScore: 30,
        evidence: academicEvidence,
        unknownFactors: academicUnknowns,
        audit: {
          applicableSignals: academicSignals,
          excludedSignals: academicExcluded,
        },
      },
      activityAlignment: {
        score: activityScore,
        maxScore: 30,
        evidence: activityEvidence,
        unknownFactors: activityUnknowns,
        audit: {
          applicableSignals: activitySignals,
          excludedSignals: activityExcluded,
        },
      },
      goalAlignment: {
        score: goalScore,
        maxScore: 20,
        evidence: goalEvidence,
        unknownFactors: goalUnknowns,
        audit: {
          applicableSignals: goalSignals,
          excludedSignals: goalExcluded,
        },
      },
      preparationEvidence: {
        score: prepScore,
        maxScore: 20,
        evidence: prepEvidence,
        unknownFactors: prepUnknowns,
        audit: {
          applicableSignals: prepSignals,
          excludedSignals: prepExcluded,
        },
      },
    },
    coverageAudit,
    strengths: strengths.slice(0, 3),
    gaps: gaps.slice(0, 2),
  };
}

/**
 * Sorts active actionable scholarship evaluations based on priority:
 * 1. ELIGIBLE before NEEDS_CHECK
 * 2. Higher fit score
 * 3. Higher evidence coverage
 * 4. Nearer deadline
 */
export function sortActionableEvaluations(
  evaluations: EvaluatedScholarship[],
  fitMap: Record<string, FitAnalysisResult | null>
): EvaluatedScholarship[] {
  return [...evaluations].sort((a, b) => {
    // 1. ELIGIBLE before NEEDS_CHECK
    if (a.status === 'ELIGIBLE' && b.status !== 'ELIGIBLE') return -1;
    if (b.status === 'ELIGIBLE' && a.status !== 'ELIGIBLE') return 1;

    const fitA = fitMap[a.scholarship.id];
    const fitB = fitMap[b.scholarship.id];

    const scoreA = fitA?.totalFitScore ?? 0;
    const scoreB = fitB?.totalFitScore ?? 0;

    // 2. Higher fit score
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }

    // 3. Higher evidence coverage
    const covA = fitA?.evidenceCoverage ?? 0;
    const covB = fitB?.evidenceCoverage ?? 0;
    if (covB !== covA) {
      return covB - covA;
    }

    // 4. Nearer deadline (smaller Excel day number)
    const deadA = a.scholarship.deadline ?? 999999;
    const deadB = b.scholarship.deadline ?? 999999;
    return deadA - deadB;
  });
}

/**
 * Deterministically computes the single Global Biggest Gap across the whole scan
 */
export function computeGlobalBiggestGap(
  activeEvaluations: EvaluatedScholarship[],
  userProfile: UserProfileData,
  fitMap: Record<string, FitAnalysisResult | null>
): GlobalBiggestGap {
  const needsCheckActives = activeEvaluations.filter((e) => e.status === 'NEEDS_CHECK');
  const eligibleActives = activeEvaluations.filter((e) => e.status === 'ELIGIBLE');

  // Priority 1: ELIGIBILITY_MISSING for top NEEDS_CHECK active scholarship
  if (needsCheckActives.length > 0) {
    const topNeedsCheck = needsCheckActives[0];
    if (topNeedsCheck.scholarship.id === 'BCA-BAKTI-2027') {
      if (topNeedsCheck.universalStatus === 'MISSING') {
        return {
          type: 'ELIGIBILITY_MISSING',
          scholarshipId: topNeedsCheck.scholarship.id,
          main: 'Data dasar untuk pengecekan Beasiswa Bakti BCA belum lengkap.',
          supporting: 'Lengkapi usia, status pernikahan, status pekerjaan full-time, dan ikatan dinas sebelum memilih kategori beasiswa.',
        };
      }
      if (topNeedsCheck.categoryStatus === 'NOT_SELECTED' || topNeedsCheck.missingFieldKeys.includes('bca_category_selected')) {
        return {
          type: 'ELIGIBILITY_MISSING',
          scholarshipId: topNeedsCheck.scholarship.id,
          main: 'Kategori Beasiswa Bakti BCA belum dipilih.',
          supporting: 'Pilih kategori yang ingin kamu cek untuk menyelesaikan pengecekan eligibility.',
        };
      }
    }

    const missingLabels = topNeedsCheck.missingFieldKeys
      .map((k) => humanFieldLabel(k))
      .slice(0, 3)
      .join(', ');

    return {
      type: 'ELIGIBILITY_MISSING',
      scholarshipId: topNeedsCheck.scholarship.id,
      main: 'Beberapa data kriteria penting masih dibutuhkan untuk menyelesaikan pengecekan.',
      supporting: `${topNeedsCheck.scholarship.name} membutuhkan konfirmasi: ${missingLabels || 'kriteria khusus'}. Gunakan 'Lengkapi Cek' untuk menyelesaikan verifikasi.`,
    };
  }

  // Priority 2: PREPARATION_MISSING for top ELIGIBLE active scholarship
  if (eligibleActives.length > 0) {
    const topEligible = eligibleActives[0];
    if (topEligible.scholarship.id === 'BCA-BAKTI-2027' && topEligible.applicationChecks.some((ac) => ac.status !== 'PASS')) {
      const cat = userProfile.bca_category_selected;
      if (cat === 'FINANCIAL') {
        return {
          type: 'PREPARATION_MISSING',
          scholarshipId: topEligible.scholarship.id,
          main: 'Dokumen aplikasi kategori Bantuan Finansial belum dilengkapi.',
          supporting: 'Kamu masih perlu menyiapkan dokumen organisasi/kepanitiaan dan surat rekomendasi terkendala finansial.',
        };
      } else if (cat === 'ACADEMIC') {
        return {
          type: 'PREPARATION_MISSING',
          scholarshipId: topEligible.scholarship.id,
          main: 'Dokumen aplikasi kategori Prestasi Akademis belum dilengkapi.',
          supporting: 'Kamu masih perlu menyiapkan dokumen organisasi/kepanitiaan dan sertifikat prestasi akademis.',
        };
      } else if (cat === 'NON_ACADEMIC') {
        return {
          type: 'PREPARATION_MISSING',
          scholarshipId: topEligible.scholarship.id,
          main: 'Dokumen aplikasi kategori Prestasi Non-Akademis belum dilengkapi.',
          supporting: 'Kamu masih perlu menyiapkan dokumen prestasi non-akademis dan video talenta 30 detik.',
        };
      }
    }

    if (topEligible.scholarship.essayRequired === 'YES') {
      return {
        type: 'PREPARATION_MISSING',
        scholarshipId: topEligible.scholarship.id,
        main: 'Persiapan berkas dan draft esai menjadi fokus utama saat ini.',
        supporting: `Kamu sudah memenuhi syarat dasar ${topEligible.scholarship.name}. Langkah krusial berikutnya adalah menyusun esai pendaftaran.`,
      };
    }

    return {
      type: 'PREPARATION_MISSING',
      scholarshipId: topEligible.scholarship.id,
      main: 'Persiapan berkas pendaftaran menjadi fokus utama.',
      supporting: `Kamu sudah memenuhi syarat dasar untuk ${topEligible.scholarship.name}. Pastikan dokumen administrasi mulai dipersiapkan sebelum batas waktu.`,
    };
  }

  // Priority 3: EVIDENCE_MISSING relevant to user's profile
  if (userProfile.has_organization === true) {
    return {
      type: 'EVIDENCE_MISSING',
      main: 'Detail pengalaman organisasi belum dicatat secara spesifik.',
      supporting: 'Dokumentasikan peran konkret dan hasil kegiatan organisasi untuk memperkuat portofolio beasiswa.',
    };
  }

  // Priority 4: TIMING if active scholarships failed due to semester
  const notEligibleActives = activeEvaluations.filter((e) => e.status === 'NOT_ELIGIBLE');
  const semesterFails = notEligibleActives.filter((e) =>
    e.failedRules.some((fr) => fr.rule.profileField === 'semester')
  );

  if (semesterFails.length > 0) {
    const baznasFail = semesterFails.find((e) => e.scholarship.id === 'BCB-2026');
    const bcaFail = semesterFails.find((e) => e.scholarship.id === 'BCA-BAKTI-2027');

    let supporting = '';
    if (baznasFail && bcaFail) {
      supporting = 'BAZNAS mensyaratkan semester 5 dan Bakti BCA mensyaratkan semester 3.';
    } else {
      const details = semesterFails
        .map((e) => {
          const rule = e.failedRules.find((fr) => fr.rule.profileField === 'semester');
          return `${e.scholarship.name} mensyaratkan semester ${rule?.rule.ruleValue || ''}`;
        })
        .join(', ');
      supporting = details ? `${details}.` : '';
    }

    return {
      type: 'TIMING',
      main: 'Semester saat ini menjadi hambatan utama untuk program aktif yang sudah terverifikasi.',
      supporting,
    };
  }

  // Priority 5: PROFILE_BUILDING
  if (userProfile.has_organization === false) {
    return {
      type: 'PROFILE_BUILDING',
      main: 'Belum ada catatan keaktifan organisasi atau kepanitiaan dalam profil.',
      supporting: 'Keaktifan organisasi kampus dapat membuka peluang beasiswa kepemimpinan pada semester mendatang.',
    };
  }

  return {
    type: 'EVIDENCE_MISSING',
    main: 'Kami belum punya detail tentang portofolio kegiatan kamu.',
    supporting: 'Lengkapi portofolio dan pencapaian akademik untuk meningkatkan kecocokan program beasiswa.',
  };
}

/**
 * Deterministically generates exactly ONE primary Recommended Next Action
 */
export function computeGlobalRecommendedNextAction(
  activeEvaluations: EvaluatedScholarship[],
  userProfile: UserProfileData,
  fitMap: Record<string, FitAnalysisResult | null>
): RecommendedNextAction {
  const needsCheckActives = activeEvaluations.filter((e) => e.status === 'NEEDS_CHECK');
  const eligibleActives = activeEvaluations.filter((e) => e.status === 'ELIGIBLE');

  // Priority A: Top NEEDS_CHECK
  if (needsCheckActives.length > 0) {
    const topNeedsCheck = needsCheckActives[0];
    const reasonText = topNeedsCheck.scholarship.id === 'BCA-BAKTI-2027'
      ? 'Lengkapi pengecekan Beasiswa Bakti BCA 2027'
      : `Lengkapi pengecekan ${topNeedsCheck.scholarship.name}`;
    return {
      actionType: 'COMPLETE_CHECK',
      title: 'Lengkapi Verifikasi Data',
      reason: reasonText,
      buttonLabel: 'Lengkapi Cek',
      estimatedMinutes: 2,
      scholarshipId: topNeedsCheck.scholarship.id,
    };
  }

  // Priority B: Top ELIGIBLE + deadline <= 14 days (Note: Excel deadline mock logic)
  if (eligibleActives.length > 0) {
    const topEligible = eligibleActives[0];

    // Priority B.5: Pending application documents for BCA
    if (topEligible.scholarship.id === 'BCA-BAKTI-2027' && topEligible.applicationChecks.some((ac) => ac.status !== 'PASS')) {
      const cat = userProfile.bca_category_selected;
      let titleText = 'Siapkan Berkas Beasiswa';
      if (cat === 'FINANCIAL') titleText = 'Siapkan dokumen kategori Bantuan Finansial';
      else if (cat === 'ACADEMIC') titleText = 'Siapkan dokumen kategori Prestasi Akademis';
      else if (cat === 'NON_ACADEMIC') titleText = 'Siapkan dokumen kategori Prestasi Non-Akademis';

      return {
        actionType: 'PREPARE_APPLICATION',
        title: titleText,
        reason: `Siapkan dokumen pendaftaran ${topEligible.scholarship.name}`,
        buttonLabel: 'Mulai Persiapan',
        estimatedMinutes: 30,
        scholarshipId: topEligible.scholarship.id,
      };
    }

    // Priority C: Top ELIGIBLE + essay required
    if (topEligible.scholarship.essayRequired === 'YES') {
      return {
        actionType: 'DRAFT_ESSAY',
        title: 'Siapkan Draft Esai',
        reason: `Siapkan draft esai untuk pendaftaran ${topEligible.scholarship.name}`,
        buttonLabel: 'Mulai Draft Esai',
        estimatedMinutes: 45,
        scholarshipId: topEligible.scholarship.id,
      };
    }

    // Priority D: Top ELIGIBLE + interview stage
    if (topEligible.scholarship.interviewRequired === 'YES') {
      return {
        actionType: 'PREPARE_INTERVIEW',
        title: 'Latihan Seleksi Wawancara',
        reason: `Pelajari tahapan wawancara untuk ${topEligible.scholarship.name}`,
        buttonLabel: 'Mulai Latihan Wawancara',
        estimatedMinutes: 30,
        scholarshipId: topEligible.scholarship.id,
      };
    }

    // Standard application preparation
    return {
      actionType: 'PREPARE_APPLICATION',
      title: 'Siapkan Berkas Beasiswa',
      reason: `Siapkan dokumen pendaftaran ${topEligible.scholarship.name}`,
      buttonLabel: 'Siapkan Beasiswa Ini',
      estimatedMinutes: 30,
      scholarshipId: topEligible.scholarship.id,
    };
  }

  // Priority E: No active actionable program
  const hasSemesterMismatchOnActive = activeEvaluations.some(
    (e) => e.status === 'NOT_ELIGIBLE' && e.failedRules.some((fr) => fr.rule.profileField === 'semester')
  );

  if (hasSemesterMismatchOnActive) {
    return {
      actionType: 'MONITOR_CYCLE',
      title: 'Pantau Program Semester Berikutnya',
      reason: 'Pantau program yang menerima mahasiswa semester berikutnya saat pendaftaran dibuka.',
      buttonLabel: 'Lihat Program Pantauan',
    };
  }

  if (userProfile.has_organization === true) {
    return {
      actionType: 'BUILD_PROFILE',
      title: 'Perkuat Bukti Pengalaman',
      reason: 'Tambahkan detail satu pengalaman organisasi beserta peran dan hasilnya.',
      buttonLabel: 'Mulai Siapkan Profil',
      estimatedMinutes: 15,
    };
  }

  return {
    actionType: 'BUILD_PROFILE',
    title: 'Bangun Pengalaman Organisasi',
    reason: 'Cari kegiatan organisasi atau kepanitiaan di kampus untuk memperkuat portofolio beasiswa.',
    buttonLabel: 'Mulai Siapkan Profil',
    estimatedMinutes: 15,
  };
}
