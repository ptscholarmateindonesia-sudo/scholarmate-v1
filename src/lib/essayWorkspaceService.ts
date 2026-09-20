export interface EssayVersion {
  id: string;
  timestamp: number;
  content: string;
  label?: string;
}

export interface EssayReadiness {
  promptCoverage: number; // 0-100
  evidence: number; // 0-100
  specificity: number; // 0-100
  structure: number; // 0-100
  clarity: number; // 0-100
  overall: number; // 0-100
}

export interface EssayDraft {
  scholarshipId: string;
  scholarshipTitle: string;
  lastModified: number;
  content: string;
  wordCount: number;
  charCount: number;
  customPrompt?: string;
  selectedPromptIndex?: number;
  versions: EssayVersion[];
  readiness?: EssayReadiness;
}

const STORAGE_KEY = 'scholarmate_essay_drafts_v1';

export function getEssayDrafts(): Record<string, EssayDraft> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error('Error reading essay drafts:', err);
    return {};
  }
}

export function saveEssayDraft(
  scholarshipId: string, 
  title: string, 
  content: string, 
  customPrompt?: string,
  selectedPromptIndex?: number
): EssayDraft {
  try {
    const drafts = getEssayDrafts();
    const existing = drafts[scholarshipId];
    
    const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
    const charCount = content.length;
    
    // Auto-create version if content changed significantly or every hour
    const versions = existing?.versions || [];
    const lastVersion = versions[versions.length - 1];
    
    if (!lastVersion || (lastVersion.content !== content && Date.now() - lastVersion.timestamp > 1000 * 60 * 30)) {
      versions.push({
        id: `v-${Date.now()}`,
        timestamp: Date.now(),
        content: existing?.content || content
      });
    }

    // Keep last 10 versions
    if (versions.length > 10) versions.shift();
    
    const draft: EssayDraft = {
      scholarshipId,
      scholarshipTitle: title,
      content,
      wordCount,
      charCount,
      lastModified: Date.now(),
      customPrompt,
      selectedPromptIndex,
      versions,
      readiness: calculateReadiness(content, customPrompt || '', !!selectedPromptIndex)
    };
    
    drafts[scholarshipId] = draft;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
    return draft;
  } catch (err) {
    console.error('Error saving essay draft:', err);
    throw err;
  }
}

function calculateReadiness(content: string, prompt: string, hasOfficialPrompt: boolean): EssayReadiness {
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  
  // Very basic heuristic for readiness
  const promptCoverage = (prompt.length > 5 || hasOfficialPrompt) ? (content.length > 100 ? 80 : 30) : 10;
  const evidenceScore = (content.match(/\d+|%/g) || []).length > 3 ? 85 : 40;
  const specificityScore = content.length > 500 ? 90 : 50;
  const structureScore = content.split('\n\n').length >= 3 ? 80 : 40;
  const clarityScore = words > 100 ? 75 : 30;
  
  const overall = Math.round((promptCoverage + evidenceScore + specificityScore + structureScore + clarityScore) / 5);
  
  return {
    promptCoverage,
    evidence: evidenceScore,
    specificity: specificityScore,
    structure: structureScore,
    clarity: clarityScore,
    overall
  };
}

export function getEssayDraft(scholarshipId: string): EssayDraft | null {
  const drafts = getEssayDrafts();
  return drafts[scholarshipId] || null;
}

export function deleteEssayDraft(scholarshipId: string): void {
  try {
    const drafts = getEssayDrafts();
    delete drafts[scholarshipId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch (err) {
    console.error('Error deleting essay draft:', err);
  }
}
