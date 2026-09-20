export interface CanonicalProfile {
  citizenship: string | null;
  education_level: string | null;
  semester: number | null;
  university: string | null;
  major: string | null;
  gpa: number | null;
  receives_other_scholarship: boolean | null;
  current_scholarship_name: string | null;
  has_organization: boolean | null;
  has_achievement: boolean | null;
  has_volunteer: boolean | null;
  goal: string | null;
  age_years_at_2026_12_31?: number | null;
  marital_status?: string | null;
  works_full_time?: boolean | null;
  has_bonded_service?: boolean | null;
  bca_category_selected?: 'FINANCIAL' | 'ACADEMIC' | 'NON_ACADEMIC' | null;
  has_academic_achievement?: boolean | null;
  has_nonacademic_achievement_province_last3years?: boolean | null;
  has_competition_experience?: boolean | null;
  has_community_initiative?: boolean | null;
  commits_program?: boolean | null;
  [key: string]: any;
}

export interface ScanFormProfile {
  educationLevel: string;
  semester: number | null;
  university: string;
  major: string;
  gpa: string;
  receivesOtherScholarship: boolean | null;
  currentScholarshipName: string;
  hasOrganization: boolean | null;
  hasAchievement: boolean | null;
  hasVolunteer: boolean | null;
  goal: string;
  citizenship: string;
}

export const INITIAL_CANONICAL_PROFILE: CanonicalProfile = {
  citizenship: null,
  education_level: null,
  semester: null,
  university: null,
  major: null,
  gpa: null,
  receives_other_scholarship: null,
  current_scholarship_name: null,
  has_organization: null,
  has_achievement: null,
  has_volunteer: null,
  goal: null,
};

export const INITIAL_SCAN_FORM_PROFILE: ScanFormProfile = {
  educationLevel: '',
  semester: null,
  university: '',
  major: '',
  gpa: '',
  receivesOtherScholarship: null,
  currentScholarshipName: '',
  hasOrganization: null,
  hasAchievement: null,
  hasVolunteer: null,
  goal: '',
  citizenship: '',
};

/**
 * Normalizes any profile input (camelCase or snake_case, string gpa or numeric gpa)
 * into the single authoritative CanonicalProfile (snake_case).
 *
 * CRITICAL:
 * - Preserves false booleans (receives_other_scholarship: false remains false).
 * - Converts gpa "3.55" -> 3.55.
 * - Converts empty current_scholarship_name -> null.
 * - Trims strings.
 */
export function normalizeProfileToCanonical(input: any): CanonicalProfile {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ...INITIAL_CANONICAL_PROFILE };
  }

  // String trimmer helper
  const cleanString = (val: any): string | null => {
    if (val === null || val === undefined) return null;
    const str = String(val).trim();
    return str.length > 0 ? str : null;
  };

  // Boolean helper that strictly preserves false values
  const getBool = (v1: any, v2: any): boolean | null => {
    if (typeof v1 === 'boolean') return v1;
    if (typeof v2 === 'boolean') return v2;
    if (v1 === 'true' || v1 === 1) return true;
    if (v1 === 'false' || v1 === 0) return false;
    if (v2 === 'true' || v2 === 1) return true;
    if (v2 === 'false' || v2 === 0) return false;
    return null;
  };

  // Education level normalization
  const rawEdu = input.education_level !== undefined ? input.education_level : input.educationLevel;
  let normEdu: string | null = cleanString(rawEdu);
  if (normEdu) {
    const lower = normEdu.toLowerCase();
    if (lower === 's1') normEdu = 'S1';
    else if (lower === 'd4') normEdu = 'D4';
    else if (lower === 'd3') normEdu = 'D3';
    else if (lower === 's2') normEdu = 'S2';
  }

  // Semester normalization: finite number or null
  const rawSem = input.semester;
  let normSem: number | null = null;
  if (rawSem !== null && rawSem !== undefined && rawSem !== '') {
    const parsed = typeof rawSem === 'number' ? rawSem : parseInt(String(rawSem), 10);
    if (Number.isFinite(parsed)) {
      normSem = parsed;
    }
  }

  // GPA normalization: finite float or null
  const rawGpa = input.gpa;
  let normGpa: number | null = null;
  if (rawGpa !== null && rawGpa !== undefined && rawGpa !== '') {
    const parsed = typeof rawGpa === 'number' ? rawGpa : parseFloat(String(rawGpa));
    if (Number.isFinite(parsed)) {
      normGpa = parsed;
    }
  }

  // Age normalization
  const rawAge = input.age_years_at_2026_12_31 !== undefined ? input.age_years_at_2026_12_31 : input.ageYearsAt20261231;
  let normAge: number | null = null;
  if (rawAge !== null && rawAge !== undefined && rawAge !== '') {
    const parsed = typeof rawAge === 'number' ? rawAge : parseInt(String(rawAge), 10);
    if (Number.isFinite(parsed)) {
      normAge = parsed;
    }
  }

  const canonical: CanonicalProfile = {
    citizenship: cleanString(input.citizenship),
    education_level: normEdu,
    semester: normSem,
    university: cleanString(input.university),
    major: cleanString(input.major),
    gpa: normGpa,
    receives_other_scholarship: getBool(input.receives_other_scholarship, input.receivesOtherScholarship),
    current_scholarship_name: cleanString(
      input.current_scholarship_name !== undefined ? input.current_scholarship_name : input.currentScholarshipName
    ),
    has_organization: getBool(input.has_organization, input.hasOrganization),
    has_achievement: getBool(input.has_achievement, input.hasAchievement),
    has_volunteer: getBool(input.has_volunteer, input.hasVolunteer),
    goal: cleanString(input.goal),
  };

  // Extended / progressive fields
  if (normAge !== null) {
    canonical.age_years_at_2026_12_31 = normAge;
  }
  const marital = cleanString(input.marital_status !== undefined ? input.marital_status : input.maritalStatus);
  if (marital !== null) {
    canonical.marital_status = marital;
  }
  const fullTime = getBool(input.works_full_time, input.worksFullTime);
  if (fullTime !== null) {
    canonical.works_full_time = fullTime;
  }
  const bonded = getBool(input.has_bonded_service, input.hasBondedService);
  if (bonded !== null) {
    canonical.has_bonded_service = bonded;
  }
  const rawBcaCategory = input.bca_category_selected !== undefined ? input.bca_category_selected : input.bcaCategorySelected;
  if (rawBcaCategory === 'FINANCIAL' || rawBcaCategory === 'ACADEMIC' || rawBcaCategory === 'NON_ACADEMIC') {
    canonical.bca_category_selected = rawBcaCategory;
  } else if (rawBcaCategory === null) {
    canonical.bca_category_selected = null;
  }
  const acadAch = getBool(input.has_academic_achievement, input.hasAcademicAchievement);
  if (acadAch !== null) {
    canonical.has_academic_achievement = acadAch;
  }
  const nonAcadAch = getBool(
    input.has_nonacademic_achievement_province_last3years,
    input.hasNonacademicAchievementProvinceLast3years
  );
  if (nonAcadAch !== null) {
    canonical.has_nonacademic_achievement_province_last3years = nonAcadAch;
  }
  const compExp = getBool(input.has_competition_experience, input.hasCompetitionExperience);
  if (compExp !== null) {
    canonical.has_competition_experience = compExp;
  }
  const commInit = getBool(input.has_community_initiative, input.hasCommunityInitiative);
  if (commInit !== null) {
    canonical.has_community_initiative = commInit;
  }
  const commitProg = getBool(input.commits_program, input.commitsProgram);
  if (commitProg !== null) {
    canonical.commits_program = commitProg;
  }

  // Copy any additional custom/progressive keys
  for (const key of Object.keys(input)) {
    if (
      !(key in canonical) &&
      key !== 'educationLevel' &&
      key !== 'receivesOtherScholarship' &&
      key !== 'currentScholarshipName' &&
      key !== 'hasOrganization' &&
      key !== 'hasAchievement' &&
      key !== 'hasVolunteer' &&
      key !== 'ageYearsAt20261231' &&
      key !== 'maritalStatus' &&
      key !== 'worksFullTime' &&
      key !== 'hasBondedService' &&
      key !== 'bcaCategorySelected' &&
      key !== 'hasAcademicAchievement' &&
      key !== 'hasNonacademicAchievementProvinceLast3years' &&
      key !== 'hasCompetitionExperience' &&
      key !== 'hasCommunityInitiative' &&
      key !== 'commitsProgram'
    ) {
      canonical[key] = input[key];
    }
  }

  return canonical;
}

/**
 * Converts a CanonicalProfile (snake_case) to ScanFormProfile (camelCase)
 * for use in form editing (Step 1-4).
 */
export function canonicalToScanFormProfile(canonical: Partial<CanonicalProfile> | Record<string, any> | null | undefined): ScanFormProfile {
  if (!canonical) return { ...INITIAL_SCAN_FORM_PROFILE };
  const p = canonical as Record<string, any>;
  return {
    educationLevel: p.education_level || p.educationLevel || '',
    semester: p.semester ?? null,
    university: p.university || '',
    major: p.major || '',
    gpa: p.gpa !== null && p.gpa !== undefined ? String(p.gpa) : '',
    receivesOtherScholarship: p.receives_other_scholarship !== undefined ? p.receives_other_scholarship : (p.receivesOtherScholarship ?? null),
    currentScholarshipName: p.current_scholarship_name || p.currentScholarshipName || '',
    hasOrganization: p.has_organization !== undefined ? p.has_organization : (p.hasOrganization ?? null),
    hasAchievement: p.has_achievement !== undefined ? p.has_achievement : (p.hasAchievement ?? null),
    hasVolunteer: p.has_volunteer !== undefined ? p.has_volunteer : (p.hasVolunteer ?? null),
    goal: p.goal || '',
    citizenship: p.citizenship || '',
  };
}
