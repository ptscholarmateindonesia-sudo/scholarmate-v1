export interface UniversityPartnerFlags {
  BAZNAS_2026?: boolean | null;
  KSE_2026_27?: boolean | null;
  TANOTO_TELADAN_2027?: boolean | null;
  PERTAMINA_SOBI_2026?: boolean | null;
  DJARUM_2026_27?: boolean | null;
  [key: string]: boolean | null | undefined;
}

export interface UniversityMapping {
  id: string;
  canonicalName: string;
  aliases: string[];
  universityType: 'PTN' | 'PTS' | string;
  partnerFlags: UniversityPartnerFlags;
  sources?: Record<string, string>;
  verification?: Record<string, string>;
}

export interface MajorMapping {
  canonicalName: string;
  aliases: string[];
  majorGroup: 'STEM' | 'SHARE' | string;
}

export interface DerivedProfileFields {
  university_matched?: UniversityMapping | null;
  major_matched?: MajorMapping | null;
  university_type?: string | null;
  major_group?: string | null;
  university_in_baznas_partner_list?: boolean | null;
  university_in_kse_partner_list?: boolean | null;
  university_in_teladan_partner_list?: boolean | null;
  university_in_pertamina_partner_list?: boolean | null;
  university_in_djarum_partner_list?: boolean | null;
}

export const CAMPUS_MAPPINGS: UniversityMapping[] = [
  {
    id: "UB",
    canonicalName: "Universitas Brawijaya",
    aliases: [
      "universitas brawijaya",
      "ub",
      "brawijaya university",
      "univ brawijaya"
    ],
    universityType: "PTN",
    partnerFlags: {
      BAZNAS_2026: true,
      KSE_2026_27: true,
      TANOTO_TELADAN_2027: true,
      PERTAMINA_SOBI_2026: true,
      DJARUM_2026_27: null
    },
    sources: {
      BAZNAS_2026: "https://umm.ac.id/daftar-lengkap-246-kampus-dan-lembaga-mitra-beasiswa-cendekia-baznas-2026/",
      KSE_2026_27: "https://www.beasiswa.or.id/",
      TANOTO_TELADAN_2027: "https://www.tanotofoundation.org/teladan-2027/",
      PERTAMINA_SOBI_2026: "https://feb.ub.ac.id/informasi-pendaftaran-beasiswa-penerima-sobat-bumi-2026/"
    },
    verification: {
      BAZNAS_2026: "SOURCE_FOUND",
      KSE_2026_27: "SOURCE_FOUND",
      TANOTO_TELADAN_2027: "SOURCE_FOUND",
      PERTAMINA_SOBI_2026: "SOURCE_FOUND",
      DJARUM_2026_27: "UNKNOWN"
    }
  },
  {
    id: "UI",
    canonicalName: "Universitas Indonesia",
    aliases: [
      "universitas indonesia",
      "ui"
    ],
    universityType: "PTN",
    partnerFlags: {
      BAZNAS_2026: true,
      KSE_2026_27: true,
      TANOTO_TELADAN_2027: true
    }
  },
  {
    id: "UGM",
    canonicalName: "Universitas Gadjah Mada",
    aliases: [
      "universitas gadjah mada",
      "ugm"
    ],
    universityType: "PTN",
    partnerFlags: {
      BAZNAS_2026: true,
      KSE_2026_27: true,
      TANOTO_TELADAN_2027: true
    }
  },
  {
    id: "ITB",
    canonicalName: "Institut Teknologi Bandung",
    aliases: [
      "institut teknologi bandung",
      "itb"
    ],
    universityType: "PTN",
    partnerFlags: {
      BAZNAS_2026: true,
      KSE_2026_27: true,
      TANOTO_TELADAN_2027: true
    }
  },
  {
    id: "IPB",
    canonicalName: "IPB University",
    aliases: [
      "ipb university",
      "institut pertanian bogor",
      "ipb"
    ],
    universityType: "PTN",
    partnerFlags: {
      BAZNAS_2026: true,
      KSE_2026_27: true,
      TANOTO_TELADAN_2027: true
    }
  },
  {
    id: "UNDIP",
    canonicalName: "Universitas Diponegoro",
    aliases: [
      "universitas diponegoro",
      "undip"
    ],
    universityType: "PTN",
    partnerFlags: {
      BAZNAS_2026: true,
      KSE_2026_27: true,
      TANOTO_TELADAN_2027: true
    }
  },
  {
    id: "UNAIR",
    canonicalName: "Universitas Airlangga",
    aliases: [
      "universitas airlangga",
      "unair"
    ],
    universityType: "PTN",
    partnerFlags: {
      BAZNAS_2026: true,
      KSE_2026_27: true
    }
  },
  {
    id: "UNHAS",
    canonicalName: "Universitas Hasanuddin",
    aliases: [
      "universitas hasanuddin",
      "unhas"
    ],
    universityType: "PTN",
    partnerFlags: {
      BAZNAS_2026: true,
      KSE_2026_27: true,
      TANOTO_TELADAN_2027: true
    }
  },
  {
    id: "USU",
    canonicalName: "Universitas Sumatera Utara",
    aliases: [
      "universitas sumatera utara",
      "usu"
    ],
    universityType: "PTN",
    partnerFlags: {
      BAZNAS_2026: true,
      KSE_2026_27: true,
      TANOTO_TELADAN_2027: true
    }
  },
  {
    id: "UNMUL",
    canonicalName: "Universitas Mulawarman",
    aliases: [
      "universitas mulawarman",
      "unmul"
    ],
    universityType: "PTN",
    partnerFlags: {
      BAZNAS_2026: true,
      KSE_2026_27: true,
      TANOTO_TELADAN_2027: true
    }
  },
  {
    id: "UNRI",
    canonicalName: "Universitas Riau",
    aliases: [
      "universitas riau",
      "unri",
      "ur"
    ],
    universityType: "PTN",
    partnerFlags: {
      BAZNAS_2026: true,
      KSE_2026_27: true,
      TANOTO_TELADAN_2027: true
    }
  }
];

export const MAJOR_MAPPINGS: MajorMapping[] = [
  {
    canonicalName: "Teknik Lingkungan",
    aliases: [
      "teknik lingkungan",
      "environmental engineering"
    ],
    majorGroup: "STEM"
  },
  {
    canonicalName: "Teknik Informatika",
    aliases: [
      "teknik informatika",
      "informatika",
      "computer science",
      "ilmu komputer"
    ],
    majorGroup: "STEM"
  },
  {
    canonicalName: "Sistem Informasi",
    aliases: [
      "sistem informasi",
      "information systems"
    ],
    majorGroup: "STEM"
  },
  {
    canonicalName: "Teknik Elektro",
    aliases: [
      "teknik elektro",
      "electrical engineering"
    ],
    majorGroup: "STEM"
  },
  {
    canonicalName: "Teknik Mesin",
    aliases: [
      "teknik mesin",
      "mechanical engineering"
    ],
    majorGroup: "STEM"
  },
  {
    canonicalName: "Teknik Sipil",
    aliases: [
      "teknik sipil",
      "civil engineering"
    ],
    majorGroup: "STEM"
  },
  {
    canonicalName: "Matematika",
    aliases: [
      "matematika",
      "mathematics"
    ],
    majorGroup: "STEM"
  },
  {
    canonicalName: "Statistika",
    aliases: [
      "statistika",
      "statistics"
    ],
    majorGroup: "STEM"
  },
  {
    canonicalName: "Biologi",
    aliases: [
      "biologi",
      "biology"
    ],
    majorGroup: "STEM"
  },
  {
    canonicalName: "Kimia",
    aliases: [
      "kimia",
      "chemistry"
    ],
    majorGroup: "STEM"
  },
  {
    canonicalName: "Fisika",
    aliases: [
      "fisika",
      "physics"
    ],
    majorGroup: "STEM"
  },
  {
    canonicalName: "Kedokteran",
    aliases: [
      "kedokteran",
      "pendidikan dokter",
      "medicine"
    ],
    majorGroup: "STEM"
  },
  {
    canonicalName: "Farmasi",
    aliases: [
      "farmasi",
      "pharmacy"
    ],
    majorGroup: "STEM"
  },
  {
    canonicalName: "Psikologi",
    aliases: [
      "psikologi",
      "psychology"
    ],
    majorGroup: "SHARE"
  },
  {
    canonicalName: "Akuntansi",
    aliases: [
      "akuntansi",
      "accounting"
    ],
    majorGroup: "SHARE"
  },
  {
    canonicalName: "Manajemen",
    aliases: [
      "manajemen",
      "management"
    ],
    majorGroup: "SHARE"
  },
  {
    canonicalName: "Ekonomi",
    aliases: [
      "ekonomi",
      "ilmu ekonomi",
      "economics"
    ],
    majorGroup: "SHARE"
  },
  {
    canonicalName: "Ilmu Komunikasi",
    aliases: [
      "ilmu komunikasi",
      "komunikasi",
      "communication"
    ],
    majorGroup: "SHARE"
  },
  {
    canonicalName: "Ilmu Hukum",
    aliases: [
      "ilmu hukum",
      "hukum",
      "law"
    ],
    majorGroup: "SHARE"
  },
  {
    canonicalName: "Hubungan Internasional",
    aliases: [
      "hubungan internasional",
      "international relations"
    ],
    majorGroup: "SHARE"
  },
  {
    canonicalName: "Pendidikan",
    aliases: [
      "pendidikan",
      "education"
    ],
    majorGroup: "SHARE"
  }
];

/**
 * Deterministic text normalization:
 * - lowercase
 * - trim
 * - collapse repeated spaces
 * - remove harmless punctuation differences (replace with space)
 * - preserve meaningful words
 */
export function normalizeText(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Finds a university by comparing normalized input against canonicalName and aliases.
 * Exact normalized alias match only for V0.
 * If no match: returns null.
 */
export function findUniversity(input: string | null | undefined): UniversityMapping | null {
  const normInput = normalizeText(input);
  if (!normInput) return null;

  for (const uni of CAMPUS_MAPPINGS) {
    if (normalizeText(uni.canonicalName) === normInput) {
      return uni;
    }
    for (const alias of uni.aliases) {
      if (normalizeText(alias) === normInput) {
        return uni;
      }
    }
  }

  return null;
}

/**
 * Finds a major by comparing normalized input against canonicalName and aliases.
 * Exact normalized alias match only for V0.
 * If no match: returns null.
 */
export function findMajor(input: string | null | undefined): MajorMapping | null {
  const normInput = normalizeText(input);
  if (!normInput) return null;

  for (const m of MAJOR_MAPPINGS) {
    if (normalizeText(m.canonicalName) === normInput) {
      return m;
    }
    for (const alias of m.aliases) {
      if (normalizeText(alias) === normInput) {
        return m;
      }
    }
  }

  return null;
}

/**
 * Derives trusted profile fields from known university and major mappings.
 * Never guess scholarship partner membership.
 * Missing or null partner flags remain missing (undefined/null).
 */
export function deriveProfileFields(universityInput?: string | null, majorInput?: string | null): DerivedProfileFields {
  const uni = findUniversity(universityInput);
  const major = findMajor(majorInput);

  const derived: DerivedProfileFields = {
    university_matched: uni,
    major_matched: major,
  };

  if (uni) {
    derived.university_type = uni.universityType;
    derived.university_in_baznas_partner_list = uni.partnerFlags.BAZNAS_2026 ?? null;
    derived.university_in_kse_partner_list = uni.partnerFlags.KSE_2026_27 ?? null;
    derived.university_in_teladan_partner_list = uni.partnerFlags.TANOTO_TELADAN_2027 ?? null;
    derived.university_in_pertamina_partner_list = uni.partnerFlags.PERTAMINA_SOBI_2026 ?? null;
    derived.university_in_djarum_partner_list = uni.partnerFlags.DJARUM_2026_27 ?? null;
  }

  if (major) {
    derived.major_group = major.majorGroup;
  }

  return derived;
}

/**
 * Autocomplete search for universities matching input query.
 * Matches canonical name or aliases.
 */
export function searchUniversitySuggestions(query: string, limit = 6): UniversityMapping[] {
  const normQ = normalizeText(query);
  if (!normQ) return [];

  const matches: UniversityMapping[] = [];
  for (const uni of CAMPUS_MAPPINGS) {
    const canonicalNorm = normalizeText(uni.canonicalName);
    const aliasMatches = uni.aliases.some((alias) => normalizeText(alias).includes(normQ));
    if (canonicalNorm.includes(normQ) || aliasMatches) {
      matches.push(uni);
    }
  }
  return matches.slice(0, limit);
}

/**
 * Autocomplete search for majors matching input query.
 * Matches canonical name or aliases.
 */
export function searchMajorSuggestions(query: string, limit = 6): MajorMapping[] {
  const normQ = normalizeText(query);
  if (!normQ) return [];

  const matches: MajorMapping[] = [];
  for (const m of MAJOR_MAPPINGS) {
    const canonicalNorm = normalizeText(m.canonicalName);
    const aliasMatches = m.aliases.some((alias) => normalizeText(alias).includes(normQ));
    if (canonicalNorm.includes(normQ) || aliasMatches) {
      matches.push(m);
    }
  }
  return matches.slice(0, limit);
}
