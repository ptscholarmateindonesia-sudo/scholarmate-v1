import { EvidenceItem } from '../types.ts';

const STORAGE_KEY = 'scholarmate_evidence_library_v1';

export function getEvidenceLibrary(): Record<string, EvidenceItem> {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch (err) {
    console.error('Failed to load evidence library:', err);
    return {};
  }
}

export function saveEvidenceItem(item: EvidenceItem): void {
  try {
    const library = getEvidenceLibrary();
    library[item.id] = {
      ...item,
      lastModified: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
  } catch (err) {
    console.error('Failed to save evidence item:', err);
  }
}

export function deleteEvidenceItem(id: string): void {
  try {
    const library = getEvidenceLibrary();
    delete library[id];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
  } catch (err) {
    console.error('Failed to delete evidence item:', err);
  }
}

export function getEvidenceByCategory(category: string): EvidenceItem[] {
  const library = getEvidenceLibrary();
  return Object.values(library).filter(item => item.category === category);
}
