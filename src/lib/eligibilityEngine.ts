import { SCHOLARSHIPS, Scholarship } from '../data/scholarships';
import { ELIGIBILITY_RULES, EligibilityRule, RuleOperator } from '../data/eligibilityRules';
import {
  deriveProfileFields,
  DerivedProfileFields,
  normalizeText,
  findUniversity,
  findMajor,
} from '../data/campusMajorMapping';

export interface UserProfileData {
  citizenship?: string | null;
  education_level?: string | null;
  semester?: number | null;
  university?: string | null;
  major?: string | null;
  gpa?: number | null;
  receives_other_scholarship?: boolean | null;
  current_scholarship_name?: string | null;
  has_organization?: boolean | null;
  has_achievement?: boolean | null;
  has_volunteer?: boolean | null;
  goal?: string | null;
  // Progressive / dynamic fields
  age_years_at_2026_12_31?: number | null;
  marital_status?: string | null;
  family_monthly_income?: number | null;
  origin_province?: string | null;
  high_school_avg?: number | null;
  snbt_score?: number | null;
  works_full_time?: boolean | null;
  has_bonded_service?: boolean | null;
  has_national_international_achievement?: boolean | null;
  is_student_activist?: boolean | null;
  has_disability?: boolean | null;
  commits_program?: boolean | null;
  drug_criminal_clearance?: boolean | null;
  bca_category_selected?: 'FINANCIAL' | 'ACADEMIC' | 'NON_ACADEMIC' | null;
  bca_category_criteria_met?: boolean | null;
  bca_failed_categories?: string[] | null;
  has_academic_achievement?: boolean | null;
  has_nonacademic_achievement_province_last3years?: boolean | null;
  has_organization_document?: boolean | null;
  has_financial_constraint_recommendation_letter?: boolean | null;
  has_academic_achievement_certificate?: boolean | null;
  has_nonacademic_achievement_document?: boolean | null;
  has_talent_video_30s?: boolean | null;
  has_competition_experience?: boolean | null;
  has_community_initiative?: boolean | null;
  japfa_motivation_prepared?: boolean | null;
  japfa_essay_prepared?: boolean | null;
  kalla_pathway_qualified?: boolean | null;
  // Derived fields (unresolved in V0)
  university_type?: string | null;
  major_group?: string | null;
  university_in_baznas_partner_list?: boolean | null;
  university_in_teladan_partner_list?: boolean | null;
  university_in_kse_partner_list?: boolean | null;
  university_in_pertamina_partner_list?: boolean | null;
  university_in_djarum_partner_list?: boolean | null;
  [key: string]: any;
}

export type FinalEligibilityStatus =
  | 'ELIGIBLE'
  | 'NEEDS_CHECK'
  | 'NEEDS_RECHECK'
  | 'NOT_ELIGIBLE'
  | 'CLOSED';

export type ClosedMonitoringRelevance =
  | 'CLOSED_RELEVANT'
  | 'CLOSED_NOT_RELEVANT'
  | 'NOT_APPLICABLE';

export const APPLICATION_STAGE_FIELDS = new Set<string>([
  'commits_program',
  'drug_criminal_clearance',
  'has_organization_document',
  'has_financial_constraint_recommendation_letter',
  'has_academic_achievement_certificate',
  'has_nonacademic_achievement_document',
  'has_talent_video_30s',
  'japfa_motivation_prepared',
  'japfa_essay_prepared',
]);

export function isApplicationStageField(field: string): boolean {
  return APPLICATION_STAGE_FIELDS.has(field);
}

export interface ApplicationCheck {
  rule: EligibilityRule;
  field: string;
  status: 'NOT_ASKED' | 'PASS' | 'FAIL';
  value: any;
  summary: string;
}

export interface EvaluatedRule {
  rule: EligibilityRule;
  status: 'PASS' | 'FAIL' | 'MISSING';
  profileValue: any;
  neutralMessage?: string;
}

export interface EvaluatedRuleSet {
  ruleSetId: string;
  setLogic: 'ALL' | 'ANY';
  status: 'PASS' | 'FAIL' | 'MISSING';
  rules: EvaluatedRule[];
}

export interface EvaluatedScholarship {
  scholarship: Scholarship;
  status: FinalEligibilityStatus;
  underlyingStatus: FinalEligibilityStatus; // MATCH_STAGE status
  matchStageStatus: 'PASS' | 'FAIL' | 'MISSING';
  universalStatus?: 'PASS' | 'FAIL' | 'MISSING';
  categoryStatus?: 'PASS' | 'FAIL' | 'MISSING' | 'NOT_SELECTED';
  missingUniversalFields?: string[];
  closedRelevance?: ClosedMonitoringRelevance;
  ruleSets: EvaluatedRuleSet[]; // MATCH_STAGE rule sets
  passedRules: EvaluatedRule[]; // MATCH_STAGE passed rules
  failedRules: EvaluatedRule[]; // MATCH_STAGE failed rules
  missingRules: EvaluatedRule[]; // MATCH_STAGE missing rules
  missingFieldKeys: string[]; // MATCH_STAGE missing field keys
  applicationChecks: ApplicationCheck[]; // APPLICATION_STAGE checks
  excludedApplicationChecks?: { field: string; summary: string; reason: string }[];
}

export const PROGRESSIVE_FIELD_PRIORITY: Record<string, number> = {
  age_years_at_2026_12_31: 1,
  marital_status: 2,
  works_full_time: 3,
  has_bonded_service: 4,
  bca_category_selected: 5,
  bca_category_criteria_met: 5.5,
  has_academic_achievement: 5.6,
  has_nonacademic_achievement_province_last3years: 5.7,
  high_school_avg: 6,
  snbt_score: 7,
  family_monthly_income: 8,
  origin_province: 9,
  has_national_international_achievement: 10,
  is_student_activist: 11,
  kalla_pathway_qualified: 12,
  has_competition_experience: 13,
  has_community_initiative: 14,
  has_disability: 99, // sensitive, only explicit opt-in
};

export function humanFieldLabel(field: string): string {
  const map: Record<string, string> = {
    gpa: 'IPK minimum',
    education_level: 'Jenjang pendidikan',
    semester: 'Semester',
    citizenship: 'Kewarganegaraan',
    receives_other_scholarship: 'Status beasiswa lain',
    current_scholarship_name: 'Beasiswa yang sedang diterima',
    has_organization: 'Pengalaman organisasi',
    has_achievement: 'Prestasi kompetisi',
    has_volunteer: 'Aktivitas kerelawanan',
    has_competition_experience: 'Pengalaman kompetisi',
    has_community_initiative: 'Inisiatif/kegiatan komunitas',
    japfa_motivation_prepared: 'Kesiapan motivasi diri',
    japfa_essay_prepared: 'Kesiapan esai aplikasi',
    age_years_at_2026_12_31: 'Usia per 31 Desember 2026',
    marital_status: 'Status pernikahan',
    works_full_time: 'Status pekerjaan full-time',
    has_bonded_service: 'Ikatan dinas',
    family_monthly_income: 'Pendapatan keluarga per bulan',
    origin_province: 'Provinsi asal',
    high_school_avg: 'Nilai rapor SMA/SMK',
    snbt_score: 'Nilai UTBK/SNBT',
    has_national_international_achievement: 'Prestasi tingkat nasional/internasional',
    is_student_activist: 'Pengalaman sebagai pengurus/aktivis organisasi',
    has_disability: 'Jalur disabilitas',
    bca_category_selected: 'Kategori Beasiswa Bakti BCA',
    bca_category_criteria_met: 'Kriteria Kategori Bakti BCA',
    has_academic_achievement: 'Prestasi akademik',
    has_nonacademic_achievement_province_last3years: 'Prestasi non-akademis (min. prov / 3 thn)',
    has_organization_document: 'Dokumen keaktifan organisasi',
    has_financial_constraint_recommendation_letter: 'Surat rekomendasi terkendala finansial',
    has_academic_achievement_certificate: 'Sertifikat prestasi akademis',
    has_nonacademic_achievement_document: 'Sertifikat prestasi non-akademis',
    has_talent_video_30s: 'Video unjuk talenta (30s)',
    kalla_pathway_qualified: 'Jalur khusus beasiswa Kalla',
    commits_program: 'Komitmen program',
    drug_criminal_clearance: 'Bebas narkoba dan tindak kriminal',
    university_type: 'Jenis perguruan tinggi',
    major_group: 'Rumpun program studi',
    university_in_baznas_partner_list: 'Daftar kampus mitra BAZNAS',
    university_in_teladan_partner_list: 'Daftar kampus mitra Tanoto',
    university_in_kse_partner_list: 'Daftar kampus mitra KSE',
    university_in_pertamina_partner_list: 'Daftar kampus mitra Pertamina',
    university_in_djarum_partner_list: 'Daftar kampus mitra Djarum',
  };
  return map[field] || field;
}

export function formatFailedRuleMessage(rule: EligibilityRule, rawValue: any): string {
  const field = rule.profileField;
  const op = rule.operator;
  const ruleVal = rule.ruleValue;

  if (field === 'semester') {
    if (op === 'EQ') {
      return `Program ini mensyaratkan mahasiswa semester ${ruleVal}. Kamu saat ini berada di semester ${rawValue}.`;
    }
    if (op === 'IN') {
      const parts = ruleVal.split('|').map((s) => s.trim()).join(' atau ');
      return `Program ini mensyaratkan mahasiswa semester ${parts}. Kamu saat ini berada di semester ${rawValue}.`;
    }
    if (op === 'GTE') {
      return `Program ini mensyaratkan mahasiswa minimal semester ${ruleVal}. Kamu saat ini berada di semester ${rawValue}.`;
    }
    if (op === 'LTE') {
      return `Program ini mensyaratkan mahasiswa maksimal semester ${ruleVal}. Kamu saat ini berada di semester ${rawValue}.`;
    }
  }

  if (field === 'gpa') {
    if (op === 'GTE') {
      return `Program ini mensyaratkan IPK minimum ${ruleVal}. IPK kamu saat ini: ${rawValue}.`;
    }
    if (op === 'LTE') {
      return `Program ini mensyaratkan IPK maksimal ${ruleVal}. IPK kamu saat ini: ${rawValue}.`;
    }
    return `Program ini mensyaratkan IPK ${ruleVal}. IPK kamu saat ini: ${rawValue}.`;
  }

  if (field === 'education_level') {
    const parts = ruleVal.split('|').map((s) => s.trim()).join(' atau ');
    return `Program ini mensyaratkan jenjang pendidikan ${parts}. Jenjang kamu saat ini: ${rawValue}.`;
  }

  if (field === 'citizenship') {
    return `Program ini mensyaratkan kewarganegaraan ${ruleVal}. Kewarganegaraan kamu saat ini: ${rawValue}.`;
  }

  if (field === 'receives_other_scholarship') {
    return `Program ini mensyaratkan tidak sedang menerima beasiswa lain.`;
  }

  if (field === 'age_years_at_2026_12_31') {
    if (op === 'LTE') {
      return `Program ini mensyaratkan usia maksimal ${ruleVal} tahun per 31 Desember 2026. Usia kamu saat ini: ${rawValue} tahun.`;
    }
    if (op === 'GTE') {
      return `Program ini mensyaratkan usia minimal ${ruleVal} tahun per 31 Desember 2026. Usia kamu saat ini: ${rawValue} tahun.`;
    }
  }

  if (field === 'marital_status') {
    return `Program ini mensyaratkan status pernikahan ${ruleVal === 'UNMARRIED' ? 'belum menikah' : ruleVal}.`;
  }

  if (field === 'works_full_time') {
    return `Program ini mensyaratkan tidak sedang bekerja penuh waktu (full-time).`;
  }

  if (field === 'has_bonded_service') {
    return `Program ini mensyaratkan tidak sedang dalam ikatan dinas.`;
  }

  // Generic fallback with human-readable label
  const label = humanFieldLabel(field);
  if (op === 'IN') {
    const parts = ruleVal.split('|').map((s) => s.trim()).join(' atau ');
    return `Program ini mensyaratkan ${label.toLowerCase()} ${parts}. Data kamu saat ini: ${rawValue}.`;
  }
  if (op === 'GTE') {
    return `Program ini mensyaratkan ${label.toLowerCase()} minimal ${ruleVal}. Data kamu saat ini: ${rawValue}.`;
  }
  if (op === 'LTE') {
    return `Program ini mensyaratkan ${label.toLowerCase()} maksimal ${ruleVal}. Data kamu saat ini: ${rawValue}.`;
  }
  if (op === 'EQ') {
    return `Program ini mensyaratkan ${label.toLowerCase()} ${ruleVal}. Data kamu saat ini: ${rawValue}.`;
  }

  return `Syarat: ${rule.sourceSummary} (Data profil saat ini belum memenuhi)`;
}

/**
 * Normalizes boolean values safely: true, false, "TRUE", "FALSE", "true", "false"
 */
function normalizeBoolean(val: any): boolean | null {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const s = val.trim().toUpperCase();
    if (s === 'TRUE' || s === 'YES' || s === 'YA') return true;
    if (s === 'FALSE' || s === 'NO' || s === 'TIDAK') return false;
  }
  return null;
}

/**
 * Normalizes number values safely
 */
function normalizeNumber(val: any): number | null {
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') {
    const parsed = parseFloat(val.replace(',', '.'));
    if (!isNaN(parsed)) return parsed;
  }
  return null;
}

/**
 * Evaluates a single rule deterministically against the user profile.
 */
export function evaluateRule(rule: EligibilityRule, profile: UserProfileData): EvaluatedRule {
  const rawValue = profile[rule.profileField];
  
  // Check if missing
  const isMissing =
    rawValue === undefined ||
    rawValue === null ||
    (typeof rawValue === 'string' && rawValue.trim() === '');

  // Operator: EXISTS
  if (rule.operator === 'EXISTS') {
    const passes = !isMissing;
    return {
      rule,
      status: passes ? 'PASS' : 'FAIL',
      profileValue: rawValue,
      neutralMessage: passes
        ? rule.sourceSummary
        : formatFailedRuleMessage(rule, rawValue)
    };
  }

  // For other operators, if value is missing, it is MISSING
  if (isMissing) {
    return {
      rule,
      status: 'MISSING',
      profileValue: null,
      neutralMessage: `Membutuhkan informasi: ${rule.sourceSummary || humanFieldLabel(rule.profileField)}`
    };
  }

  const op = rule.operator;
  const ruleVal = rule.ruleValue;

  // Check if boolean comparison
  const ruleBool = normalizeBoolean(ruleVal);
  const profileBool = normalizeBoolean(rawValue);

  if (ruleBool !== null && profileBool !== null) {
    const passes = op === 'EQ' ? profileBool === ruleBool : profileBool !== ruleBool;
    return {
      rule,
      status: passes ? 'PASS' : 'FAIL',
      profileValue: rawValue,
      neutralMessage: passes
        ? rule.sourceSummary
        : formatFailedRuleMessage(rule, rawValue)
    };
  }

  // Check pipe-separated values for IN / NOT_IN / EQ
  if (op === 'IN' || op === 'NOT_IN') {
    const allowed = ruleVal.split('|').map((s) => s.trim().toUpperCase());
    const valStr = String(rawValue).trim().toUpperCase();
    const valNum = normalizeNumber(rawValue);

    let found = allowed.includes(valStr);
    if (!found && valNum !== null) {
      found = allowed.some((item) => normalizeNumber(item) === valNum);
    }

    const passes = op === 'IN' ? found : !found;
    return {
      rule,
      status: passes ? 'PASS' : 'FAIL',
      profileValue: rawValue,
      neutralMessage: passes
        ? rule.sourceSummary
        : formatFailedRuleMessage(rule, rawValue)
    };
  }

  // Numeric comparisons: GTE, LTE, GT, LT
  const pNum = normalizeNumber(rawValue);
  const rNum = normalizeNumber(ruleVal);

  if (pNum !== null && rNum !== null && (op === 'GTE' || op === 'LTE' || op === 'GT' || op === 'LT')) {
    let passes = false;
    if (op === 'GTE') passes = pNum >= rNum;
    else if (op === 'LTE') passes = pNum <= rNum;
    else if (op === 'GT') passes = pNum > rNum;
    else if (op === 'LT') passes = pNum < rNum;

    return {
      rule,
      status: passes ? 'PASS' : 'FAIL',
      profileValue: rawValue,
      neutralMessage: passes
        ? rule.sourceSummary
        : formatFailedRuleMessage(rule, rawValue)
    };
  }

  // String comparisons: EQ, CONTAINS
  const pStr = String(rawValue).trim().toUpperCase();
  const rStr = ruleVal.trim().toUpperCase();

  if (op === 'EQ') {
    // If rule value has pipe even in EQ (edge case)
    if (ruleVal.includes('|')) {
      const allowed = ruleVal.split('|').map((s) => s.trim().toUpperCase());
      const passes = allowed.includes(pStr);
      return {
        rule,
        status: passes ? 'PASS' : 'FAIL',
        profileValue: rawValue,
        neutralMessage: passes
          ? rule.sourceSummary
          : formatFailedRuleMessage(rule, rawValue)
      };
    }

    // Direct string or numeric equality
    let passes = pStr === rStr;
    if (!passes && pNum !== null && rNum !== null) {
      passes = pNum === rNum;
    }

    return {
      rule,
      status: passes ? 'PASS' : 'FAIL',
      profileValue: rawValue,
      neutralMessage: passes
        ? rule.sourceSummary
        : formatFailedRuleMessage(rule, rawValue)
    };
  }

  if (op === 'CONTAINS') {
    const passes = pStr.includes(rStr);
    return {
      rule,
      status: passes ? 'PASS' : 'FAIL',
      profileValue: rawValue,
      neutralMessage: passes
        ? rule.sourceSummary
        : formatFailedRuleMessage(rule, rawValue)
    };
  }

  // Fallback
  return {
    rule,
    status: 'MISSING',
    profileValue: rawValue,
    neutralMessage: `Evaluasi ${humanFieldLabel(rule.profileField)} belum lengkap`
  };
}

/**
 * Evaluates closed scholarship relevance for monitoring next cycle.
 * CLOSED_RELEVANT: closed scholarship but user currently satisfies or could reasonably satisfy timing in the future.
 * CLOSED_NOT_RELEVANT: closed scholarship with permanent/past timing mismatch or hard incompatibility.
 */
export function evaluateClosedRelevance(
  rules: EligibilityRule[],
  profile: UserProfileData,
  failedRules: EvaluatedRule[]
): ClosedMonitoringRelevance {
  // 1. Permanent non-academic hard disqualifiers (e.g. citizenship, education_level)
  const hasHardDisqualifier = failedRules.some((fr) => {
    const f = fr.rule.profileField;
    return f === 'citizenship' || f === 'education_level';
  });
  if (hasHardDisqualifier) {
    return 'CLOSED_NOT_RELEVANT';
  }

  // 2. Academic timing check (semester)
  const semesterRules = rules.filter((r) => r.profileField === 'semester');
  if (semesterRules.length > 0 && profile.semester != null) {
    const currentSem = profile.semester;
    let maxAllowedSem = -1;

    for (const sr of semesterRules) {
      if (sr.operator === 'EQ') {
        const val = parseInt(sr.ruleValue, 10);
        if (!isNaN(val)) maxAllowedSem = Math.max(maxAllowedSem, val);
      } else if (sr.operator === 'IN') {
        const parts = sr.ruleValue
          .split('|')
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n));
        if (parts.length > 0) maxAllowedSem = Math.max(maxAllowedSem, ...parts);
      } else if (sr.operator === 'LTE' || sr.operator === 'LT') {
        const val = parseInt(sr.ruleValue, 10);
        if (!isNaN(val)) maxAllowedSem = Math.max(maxAllowedSem, val);
      } else if (sr.operator === 'GTE' || sr.operator === 'GT') {
        maxAllowedSem = Math.max(maxAllowedSem, 8);
      }
    }

    if (maxAllowedSem > 0 && currentSem > maxAllowedSem) {
      // Past timing mismatch - student has already passed the eligible semester(s)
      return 'CLOSED_NOT_RELEVANT';
    }
  }

  return 'CLOSED_RELEVANT';
}

/**
 * Evaluates a scholarship against user profile according to rule set logic.
 * Separates evaluation into MATCH_STAGE and APPLICATION_STAGE:
 * - MATCH_STAGE: used to determine eligibility for recommendations.
 * - APPLICATION_STAGE: later declarations (e.g. commits_program, drug_criminal_clearance) do NOT block MATCH_STAGE.
 * - For CLOSED and NEEDS_RECHECK: public status override is preserved, while MATCH_STAGE is computed underneath.
 */
export function evaluateScholarship(
  scholarship: Scholarship,
  rules: EligibilityRule[],
  profile: UserProfileData
): EvaluatedScholarship {
  // Deterministic evaluation profile with BCA category criteria resolution
  const effectiveProfile: UserProfileData = { ...profile };

  if (scholarship.id === 'BCA-BAKTI-2027') {
    const cat = effectiveProfile.bca_category_selected;
    if (!cat) {
      effectiveProfile.bca_category_criteria_met = undefined;
    } else if (cat === 'FINANCIAL') {
      // Financial: IPK >= 3.00
      if (effectiveProfile.gpa !== null && effectiveProfile.gpa !== undefined && !isNaN(effectiveProfile.gpa)) {
        effectiveProfile.bca_category_criteria_met = effectiveProfile.gpa >= 3.00;
      } else {
        effectiveProfile.bca_category_criteria_met = undefined;
      }
    } else if (cat === 'ACADEMIC') {
      // Academic: IPK >= 3.25 and has_academic_achievement = true
      if (
        effectiveProfile.gpa !== null &&
        effectiveProfile.gpa !== undefined &&
        !isNaN(effectiveProfile.gpa) &&
        effectiveProfile.has_academic_achievement !== undefined &&
        effectiveProfile.has_academic_achievement !== null
      ) {
        effectiveProfile.bca_category_criteria_met =
          effectiveProfile.gpa >= 3.25 && effectiveProfile.has_academic_achievement === true;
      } else {
        effectiveProfile.bca_category_criteria_met = undefined;
      }
    } else if (cat === 'NON_ACADEMIC') {
      // Non-Academic: has_nonacademic_achievement_province_last3years = true (no min GPA)
      if (
        effectiveProfile.has_nonacademic_achievement_province_last3years !== undefined &&
        effectiveProfile.has_nonacademic_achievement_province_last3years !== null
      ) {
        effectiveProfile.bca_category_criteria_met =
          effectiveProfile.has_nonacademic_achievement_province_last3years === true;
      } else {
        effectiveProfile.bca_category_criteria_met = undefined;
      }
    }
  }

  // Separate rules for this scholarship into MATCH_STAGE and APPLICATION_STAGE
  const schRules = rules.filter((r) => r.scholarshipId === scholarship.id);
  let matchStageRules = schRules.filter((r) => !isApplicationStageField(r.profileField));
  let appStageRules = schRules.filter((r) => isApplicationStageField(r.profileField));

  // For BCA: if bca_category_selected is null/undefined, do not evaluate BCA-R12 (CATEGORY_CRITERIA) yet
  if (scholarship.id === 'BCA-BAKTI-2027' && !effectiveProfile.bca_category_selected) {
    matchStageRules = matchStageRules.filter((r) => r.id !== 'BCA-R12');
  }

  let excludedApplicationChecks: { field: string; summary: string; reason: string }[] = [];
  if (scholarship.id === 'BCA-BAKTI-2027') {
    const cat = effectiveProfile.bca_category_selected;
    if (cat === 'FINANCIAL') {
      appStageRules = appStageRules.filter((r) => r.id === 'BCA-R13' || r.id === 'BCA-R14');
      excludedApplicationChecks = [
        { field: 'has_academic_achievement_certificate', summary: 'Sertifikat/dokumen prestasi akademis', reason: 'Excluded because different category' },
        { field: 'has_nonacademic_achievement_document', summary: 'Sertifikat/dokumen prestasi non-akademis', reason: 'Excluded because different category' },
        { field: 'has_talent_video_30s', summary: 'Video keahlian/talenta maksimal 30 detik', reason: 'Excluded because different category' },
      ];
    } else if (cat === 'ACADEMIC') {
      appStageRules = appStageRules.filter((r) => r.id === 'BCA-R13' || r.id === 'BCA-R15');
      excludedApplicationChecks = [
        { field: 'has_financial_constraint_recommendation_letter', summary: 'Surat rekomendasi terkendala finansial', reason: 'Excluded because different category' },
        { field: 'has_nonacademic_achievement_document', summary: 'Sertifikat/dokumen prestasi non-akademis', reason: 'Excluded because different category' },
        { field: 'has_talent_video_30s', summary: 'Video keahlian/talenta maksimal 30 detik', reason: 'Excluded because different category' },
      ];
    } else if (cat === 'NON_ACADEMIC') {
      appStageRules = appStageRules.filter((r) => r.id === 'BCA-R16' || r.id === 'BCA-R17');
      excludedApplicationChecks = [
        { field: 'has_organization_document', summary: 'Dokumen pendukung kegiatan organisasi', reason: 'Excluded because different category' },
        { field: 'has_financial_constraint_recommendation_letter', summary: 'Surat rekomendasi terkendala finansial', reason: 'Excluded because different category' },
        { field: 'has_academic_achievement_certificate', summary: 'Sertifikat/dokumen prestasi akademis', reason: 'Excluded because different category' },
      ];
    } else {
      excludedApplicationChecks = [
        { field: 'has_organization_document', summary: 'Dokumen pendukung kegiatan organisasi', reason: 'Excluded because category unselected' },
        { field: 'has_financial_constraint_recommendation_letter', summary: 'Surat rekomendasi terkendala finansial', reason: 'Excluded because category unselected' },
        { field: 'has_academic_achievement_certificate', summary: 'Sertifikat/dokumen prestasi akademis', reason: 'Excluded because category unselected' },
        { field: 'has_nonacademic_achievement_document', summary: 'Sertifikat/dokumen prestasi non-akademis', reason: 'Excluded because category unselected' },
        { field: 'has_talent_video_30s', summary: 'Video keahlian/talenta maksimal 30 detik', reason: 'Excluded because category unselected' },
      ];
      appStageRules = [];
    }
  }

  // 1. Evaluate APPLICATION_STAGE rules
  const applicationChecks: ApplicationCheck[] = appStageRules.map((r) => {
    const rawVal = effectiveProfile[r.profileField];
    if (rawVal === undefined || rawVal === null || rawVal === '') {
      return {
        rule: r,
        field: r.profileField,
        status: 'NOT_ASKED',
        value: rawVal,
        summary: r.sourceSummary,
      };
    }
    const evalRes = evaluateRule(r, effectiveProfile);
    return {
      rule: r,
      field: r.profileField,
      status: evalRes.status === 'PASS' ? 'PASS' : 'FAIL',
      value: rawVal,
      summary: r.sourceSummary,
    };
  });

  // 2. Group MATCH_STAGE rules by ruleSetId
  const ruleSetMap = new Map<string, EligibilityRule[]>();
  for (const r of matchStageRules) {
    const list = ruleSetMap.get(r.ruleSetId) || [];
    list.push(r);
    ruleSetMap.set(r.ruleSetId, list);
  }

  const evaluatedRuleSets: EvaluatedRuleSet[] = [];
  const allPassed: EvaluatedRule[] = [];
  const allFailed: EvaluatedRule[] = [];
  const allMissing: EvaluatedRule[] = [];

  for (const [ruleSetId, rList] of ruleSetMap.entries()) {
    const setLogic = rList[0]?.setLogic || 'ALL';
    const evalResults = rList.map((r) => evaluateRule(r, effectiveProfile));

    let setStatus: 'PASS' | 'FAIL' | 'MISSING';

    if (setLogic === 'ALL') {
      const hasFail = evalResults.some((e) => e.status === 'FAIL');
      const hasMissing = evalResults.some((e) => e.status === 'MISSING');

      if (hasFail) {
        setStatus = 'FAIL';
      } else if (hasMissing) {
        setStatus = 'MISSING';
      } else {
        setStatus = 'PASS';
      }

      evalResults.forEach((e) => {
        if (e.status === 'PASS') allPassed.push(e);
        else if (e.status === 'FAIL') allFailed.push(e);
        else if (e.status === 'MISSING') allMissing.push(e);
      });
    } else {
      // setLogic === 'ANY'
      const hasPass = evalResults.some((e) => e.status === 'PASS');
      const hasMissing = evalResults.some((e) => e.status === 'MISSING');

      if (hasPass) {
        setStatus = 'PASS';
        evalResults.filter((e) => e.status === 'PASS').forEach((e) => allPassed.push(e));
      } else if (hasMissing) {
        setStatus = 'MISSING';
        evalResults.filter((e) => e.status === 'MISSING').forEach((e) => allMissing.push(e));
        evalResults.filter((e) => e.status === 'FAIL').forEach((e) => allFailed.push(e));
      } else {
        // All known FAIL and none MISSING
        setStatus = 'FAIL';
        evalResults.forEach((e) => allFailed.push(e));
      }
    }

    evaluatedRuleSets.push({
      ruleSetId,
      setLogic,
      status: setStatus,
      rules: evalResults,
    });
  }

  // 3. MATCH_STAGE hard set evaluation for underlying eligibility:
  // any hard rule set FAIL -> NOT_ELIGIBLE
  // no FAIL but one or more hard rule sets MISSING -> NEEDS_CHECK
  // all hard rule sets PASS -> ELIGIBLE
  let underlyingStatus: FinalEligibilityStatus = 'ELIGIBLE';

  const anyFail = evaluatedRuleSets.some((rs) => rs.status === 'FAIL');
  const anyMissing = evaluatedRuleSets.some((rs) => rs.status === 'MISSING');

  if (anyFail) {
    if (scholarship.id === 'BCA-BAKTI-2027') {
      const universalFail = evaluatedRuleSets
        .filter((rs) => rs.ruleSetId !== 'CATEGORY_CRITERIA')
        .some((rs) => rs.status === 'FAIL');

      const failedCategories = effectiveProfile.bca_failed_categories || [];
      const currentCat = effectiveProfile.bca_category_selected;
      const allFailedList = currentCat && !failedCategories.includes(currentCat)
        ? [...failedCategories, currentCat]
        : failedCategories;

      const allThreeFailed =
        allFailedList.includes('FINANCIAL') &&
        allFailedList.includes('ACADEMIC') &&
        allFailedList.includes('NON_ACADEMIC');

      if (!universalFail && !allThreeFailed) {
        // Universal criteria pass, only one selected category failed -> allow checking another category
        underlyingStatus = 'NEEDS_CHECK';
      } else {
        underlyingStatus = 'NOT_ELIGIBLE';
      }
    } else {
      underlyingStatus = 'NOT_ELIGIBLE';
    }
  } else if (anyMissing) {
    underlyingStatus = 'NEEDS_CHECK';
  } else {
    underlyingStatus = 'ELIGIBLE';
  }

  const matchStageStatus: 'PASS' | 'FAIL' | 'MISSING' =
    underlyingStatus === 'ELIGIBLE' ? 'PASS' : underlyingStatus === 'NEEDS_CHECK' ? 'MISSING' : 'FAIL';

  // 4. Final public status with overrides
  let finalStatus: FinalEligibilityStatus = underlyingStatus;
  if (scholarship.status === 'CLOSED') {
    finalStatus = 'CLOSED';
  } else if (scholarship.verificationStatus === 'NEEDS_RECHECK') {
    finalStatus = 'NEEDS_RECHECK';
  }

  // 5. Closed relevance calculation (based on matchStageRules)
  let closedRelevance: ClosedMonitoringRelevance = 'NOT_APPLICABLE';
  if (scholarship.status === 'CLOSED') {
    closedRelevance = evaluateClosedRelevance(matchStageRules, profile, allFailed);
  }

  const missingFieldKeys = Array.from(
    new Set(allMissing.map((m) => m.rule.profileField))
  );

  let universalStatus: 'PASS' | 'FAIL' | 'MISSING' = 'PASS';
  let categoryStatus: 'PASS' | 'FAIL' | 'MISSING' | 'NOT_SELECTED' = 'NOT_SELECTED';
  let missingUniversalFields: string[] = [];

  if (scholarship.id === 'BCA-BAKTI-2027') {
    const coreRules = schRules.filter((r) => r.ruleSetId === 'CORE');
    const coreEvaluations = coreRules.map((r) => evaluateRule(r, effectiveProfile));
    const hasCoreFail = coreEvaluations.some((e) => e.status === 'FAIL');
    const coreMissing = coreEvaluations.filter((e) => e.status === 'MISSING');
    if (hasCoreFail) {
      universalStatus = 'FAIL';
    } else if (coreMissing.length > 0) {
      universalStatus = 'MISSING';
      missingUniversalFields = coreMissing.map((m) => m.rule.profileField);
    } else {
      universalStatus = 'PASS';
    }

    const catSelected = effectiveProfile.bca_category_selected;
    if (!catSelected) {
      categoryStatus = 'NOT_SELECTED';
    } else {
      const catRules = schRules.filter((r) => r.ruleSetId === 'CATEGORY_SELECTION' || r.ruleSetId === 'CATEGORY_CRITERIA');
      const catEvaluations = catRules.map((r) => evaluateRule(r, effectiveProfile));
      const hasCatFail = catEvaluations.some((e) => e.status === 'FAIL');
      const hasCatMissing = catEvaluations.some((e) => e.status === 'MISSING');
      if (hasCatFail) {
        categoryStatus = 'FAIL';
      } else if (hasCatMissing) {
        categoryStatus = 'MISSING';
      } else {
        categoryStatus = 'PASS';
      }
    }
  }

  return {
    scholarship,
    status: finalStatus,
    underlyingStatus,
    matchStageStatus,
    universalStatus: scholarship.id === 'BCA-BAKTI-2027' ? universalStatus : undefined,
    categoryStatus: scholarship.id === 'BCA-BAKTI-2027' ? categoryStatus : undefined,
    missingUniversalFields: scholarship.id === 'BCA-BAKTI-2027' ? missingUniversalFields : undefined,
    closedRelevance,
    ruleSets: evaluatedRuleSets,
    passedRules: allPassed,
    failedRules: allFailed,
    missingRules: allMissing,
    missingFieldKeys,
    applicationChecks,
    excludedApplicationChecks,
  };
}

/**
 * Sort result groups in this exact order:
 * 1. ELIGIBLE
 * 2. NEEDS_CHECK
 * 3. NEEDS_RECHECK
 * 4. NOT_ELIGIBLE
 * 5. CLOSED
 *
 * Within the same group: prioritize nearest deadline first when a deadline exists.
 */
export function sortEvaluatedScholarships(items: EvaluatedScholarship[]): EvaluatedScholarship[] {
  const statusPriority: Record<FinalEligibilityStatus, number> = {
    ELIGIBLE: 1,
    NEEDS_CHECK: 2,
    NEEDS_RECHECK: 3,
    NOT_ELIGIBLE: 4,
    CLOSED: 5
  };

  return [...items].sort((a, b) => {
    const prioDiff = statusPriority[a.status] - statusPriority[b.status];
    if (prioDiff !== 0) return prioDiff;

    // Within same group: nearest deadline first
    const dA = a.scholarship.deadline ?? 9999999;
    const dB = b.scholarship.deadline ?? 9999999;
    return dA - dB;
  });
}

/**
 * Enriches user profile with trusted campus and major mappings before rule evaluation.
 * - Never overwrite an explicit user answer with null.
 * - Unknown campus or major keeps derived fields as null/unresolved.
 */
export function enrichProfileWithCampusAndMajor(profile: UserProfileData): {
  engineProfile: UserProfileData;
  derived: DerivedProfileFields;
} {
  const derived = deriveProfileFields(profile.university, profile.major);

  const engineProfile: UserProfileData = {
    ...profile,
  };

  const keysToDerive: (keyof DerivedProfileFields)[] = [
    'university_type',
    'major_group',
    'university_in_baznas_partner_list',
    'university_in_kse_partner_list',
    'university_in_teladan_partner_list',
    'university_in_pertamina_partner_list',
    'university_in_djarum_partner_list',
  ];

  for (const key of keysToDerive) {
    const derivedVal = derived[key];
    if (derivedVal !== undefined && derivedVal !== null) {
      engineProfile[key] = derivedVal;
    } else {
      if (engineProfile[key] === undefined) {
        engineProfile[key] = null;
      }
    }
  }

  return { engineProfile, derived };
}

/**
 * Runs the full deterministic eligibility engine for all scholarships.
 * Enriches the profile with trusted derived fields before evaluation.
 */
export function runEligibilityEngine(
  profile: UserProfileData,
  scholarships = SCHOLARSHIPS,
  rules = ELIGIBILITY_RULES
): EvaluatedScholarship[] {
  const { engineProfile } = enrichProfileWithCampusAndMajor(profile);
  const evaluated = scholarships.map((s) => evaluateScholarship(s, rules, engineProfile));
  return sortEvaluatedScholarships(evaluated);
}

/**
 * Formats a passed rule for high-trust user display.
 * Derived mapping mechanics are cleanly abstracted:
 * - university partner / type -> "Kampus sesuai"
 * - major_group -> "Rumpun jurusan sesuai"
 */
export function formatPassedRuleSummary(rule: EligibilityRule): string {
  if (rule.profileField.startsWith('university_in_') || rule.profileField === 'university_type') {
    return 'Kampus sesuai';
  }
  if (rule.profileField === 'major_group') {
    return 'Rumpun jurusan sesuai';
  }
  if (rule.profileField === 'education_level') {
    return 'Jenjang sesuai';
  }
  if (rule.profileField === 'semester') {
    return 'Semester memenuhi';
  }
  if (rule.profileField === 'gpa') {
    return 'IPK memenuhi';
  }
  return rule.sourceSummary;
}

/**
 * Deterministic Profile Readiness Score (0 - 100).
 *
 * Core profile — 40 points:
 * - education level answered: +8
 * - semester answered: +8
 * - university answered: +8
 * - major answered: +8
 * - citizenship answered: +8
 *
 * Academic — 20 points:
 * - if semester >= 2 and valid GPA answered: +20
 * - if semester = 1: +20 automatically because GPA is not expected yet
 *
 * Experience evidence — 30 points:
 * - organization = yes: +10
 * - achievement = yes: +10
 * - volunteer = yes: +10
 *
 * Application clarity — 10 points:
 * - goal answered: +5
 * - other-scholarship status answered: +5
 */
export function calculateProfileReadiness(profile: UserProfileData): number {
  let score = 0;

  // Core profile (40 points)
  if (profile.education_level && profile.education_level.trim() !== '') score += 8;
  if (profile.semester != null && !isNaN(profile.semester)) score += 8;
  if (profile.university && profile.university.trim() !== '') score += 8;
  if (profile.major && profile.major.trim() !== '') score += 8;
  if (profile.citizenship && profile.citizenship.trim() !== '') score += 8;

  // Academic (20 points)
  if (profile.semester === 1) {
    score += 20;
  } else if (
    profile.semester != null &&
    profile.semester >= 2 &&
    profile.gpa != null &&
    !isNaN(profile.gpa)
  ) {
    score += 20;
  }

  // Experience evidence (30 points)
  if (profile.has_organization === true) score += 10;
  if (profile.has_achievement === true) score += 10;
  if (profile.has_volunteer === true) score += 10;

  // Application clarity (10 points)
  if (profile.goal && profile.goal.trim() !== '') score += 5;
  if (profile.receives_other_scholarship != null) score += 5;

  return Math.min(100, Math.max(0, score));
}
