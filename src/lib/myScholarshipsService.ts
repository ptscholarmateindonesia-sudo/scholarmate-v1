export type ApplicationStatus =
  | 'Tertarik'
  | 'Sedang Persiapan'
  | 'Siap Daftar'
  | 'Sudah Daftar'
  | 'Menunggu Hasil'
  | 'Lolos'
  | 'Belum Lolos';

export interface FocusedScholarshipItem {
  id: string; // scholarship id or unique key
  title: string;
  sponsor: string;
  deadline?: string;
  degree?: string;
  fundingType?: string;
  status: ApplicationStatus;
  notes?: string;
  savedAt: number;
}

const STORAGE_KEY = 'scholarmate_my_focused_scholarships_v2';

export function getMyFocusedScholarships(): FocusedScholarshipItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Check legacy v1
      const legacy = localStorage.getItem('scholarmate_my_focused_scholarships_v1');
      if (legacy) {
        const parsedLegacy = JSON.parse(legacy);
        // Map legacy status to ApplicationStatus
        const migrated: FocusedScholarshipItem[] = parsedLegacy.map((item: any) => {
          let mappedStatus: ApplicationStatus = 'Tertarik';
          if (item.status === 'MENDAFTAR') mappedStatus = 'Sedang Persiapan';
          else if (item.status === 'DOKUMEN_LENGKAP') mappedStatus = 'Siap Daftar';
          else if (item.status === 'SUDAH_SUBMIT') mappedStatus = 'Sudah Daftar';
          return {
            ...item,
            status: mappedStatus,
          };
        });
        saveMyFocusedScholarships(migrated);
        return migrated;
      }
      return [];
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading focused scholarships:', err);
    return [];
  }
}

export function saveMyFocusedScholarships(items: FocusedScholarshipItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.error('Error saving focused scholarships:', err);
  }
}

export function addFocusedScholarship(item: Omit<FocusedScholarshipItem, 'savedAt' | 'status'>): FocusedScholarshipItem[] {
  const current = getMyFocusedScholarships();
  if (current.some((i) => i.id === item.id)) {
    return current; // already exists
  }
  const newItem: FocusedScholarshipItem = {
    ...item,
    status: 'Tertarik',
    savedAt: Date.now(),
  };
  const updated = [newItem, ...current];
  saveMyFocusedScholarships(updated);
  return updated;
}

export function removeFocusedScholarship(id: string): FocusedScholarshipItem[] {
  const current = getMyFocusedScholarships();
  const updated = current.filter((i) => i.id !== id);
  saveMyFocusedScholarships(updated);
  return updated;
}

export function updateFocusedScholarship(
  id: string,
  updates: Partial<Pick<FocusedScholarshipItem, 'status' | 'notes'>>
): FocusedScholarshipItem[] {
  const current = getMyFocusedScholarships();
  const updated = current.map((item) => {
    if (item.id === id) {
      return { ...item, ...updates };
    }
    return item;
  });
  saveMyFocusedScholarships(updated);
  return updated;
}
