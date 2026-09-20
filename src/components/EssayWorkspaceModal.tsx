import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Save, 
  Clock, 
  Trash2, 
  Maximize2, 
  Minimize2, 
  Sparkles, 
  FileText, 
  CheckCircle2, 
  HelpCircle, 
  ChevronDown, 
  Plus,
  Library,
  ChevronRight,
  ChevronLeft,
  Zap,
  AlertCircle,
  History,
  Target,
  BarChart3,
  Undo2,
  Lock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getEssayDraft, saveEssayDraft, EssayDraft } from '../lib/essayWorkspaceService.ts';
import { SCHOLARSHIPS } from '../data/scholarships.ts';
import { EvidenceLibrary } from './EvidenceLibrary.tsx';
import { getEvidenceLibrary } from '../lib/evidenceService.ts';

interface EssayWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  scholarshipId: string;
  scholarshipTitle: string;
  activePassTier?: 'NONE' | 'MATE_PASS' | 'MATE_PLUS';
  onUpgrade?: () => void;
}

type AIAction = 'brainstorm' | 'outline' | 'review' | 'strengthen' | 'polish' | 'generic-check' | 'evidence-check';

export function EssayWorkspaceModal({ 
  isOpen, 
  onClose, 
  scholarshipId, 
  scholarshipTitle,
  activePassTier = 'NONE',
  onUpgrade
}: EssayWorkspaceModalProps) {
  const isMatePassActive = activePassTier !== 'NONE';
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [showEvidence, setShowEvidence] = useState(false);
  const [isAILoading, setIsAILoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [showAIMenu, setShowAIMenu] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showReadiness, setShowReadiness] = useState(false);
  const [draft, setDraft] = useState<EssayDraft | null>(null);
  
  // Prompt states
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedPromptIndex, setSelectedPromptIndex] = useState<number | null>(null);
  const [showPromptPicker, setShowPromptPicker] = useState(false);
  const [isEditingCustomPrompt, setIsEditingCustomPrompt] = useState(false);

  const scholarship = SCHOLARSHIPS.find(s => s.id === scholarshipId);
  const officialPrompts = scholarship?.essayPrompts || [];
  
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen && scholarshipId) {
      const d = getEssayDraft(scholarshipId);
      setDraft(d);
      if (d) {
        setContent(d.content);
        setWordCount(d.wordCount);
        setLastSaved(d.lastModified);
        setCustomPrompt(d.customPrompt || '');
        setSelectedPromptIndex(d.selectedPromptIndex !== undefined ? d.selectedPromptIndex : (officialPrompts.length > 0 ? 0 : null));
      } else {
        setContent('');
        setWordCount(0);
        setLastSaved(null);
        setCustomPrompt('');
        setSelectedPromptIndex(officialPrompts.length > 0 ? 0 : null);
      }
    }
  }, [isOpen, scholarshipId, officialPrompts.length]);

  // Auto-save logic
  useEffect(() => {
    if (isOpen) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      
      saveTimerRef.current = setTimeout(() => {
        handleSave();
      }, 2000);
    }
    
    // Update word count immediately
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    setWordCount(words);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [content, customPrompt, selectedPromptIndex]);

  const handleSave = () => {
    if (!scholarshipId) return;
    setIsSaving(true);
    try {
      const saved = saveEssayDraft(
        scholarshipId, 
        scholarshipTitle, 
        content, 
        customPrompt, 
        selectedPromptIndex !== null ? selectedPromptIndex : undefined
      );
      setDraft(saved);
      setLastSaved(saved.lastModified);
      setTimeout(() => setIsSaving(false), 800);
    } catch (err) {
      console.error(err);
      setIsSaving(false);
    }
  };

  const restoreVersion = (versionContent: string) => {
    if (!isMatePassActive) {
      if (onUpgrade) onUpgrade();
      return;
    }
    if (confirm('Apakah Anda yakin ingin mengembalikan versi ini? Tulisan saat ini akan disimpan sebagai versi baru.')) {
      handleSave(); // Save current state as version
      setContent(versionContent);
      setShowHistory(false);
    }
  };

  const handleAIAction = async (action: AIAction) => {
    // Tiered Access Check
    if (!isMatePassActive) {
      // FREE allows: outline, brainstorm (as brainstorming is basic), review (1x)
      const allowedActions = ['outline', 'brainstorm', 'review'];
      if (!allowedActions.includes(action)) {
        if (onUpgrade) onUpgrade();
        return;
      }
      
      // If action is review, check if already used (using localStorage for simplicity in this sandbox)
      if (action === 'review') {
        const reviewsUsed = localStorage.getItem(`sm_reviews_free_${scholarshipId}`);
        if (reviewsUsed === 'true') {
          if (onUpgrade) onUpgrade();
          return;
        }
        localStorage.setItem(`sm_reviews_free_${scholarshipId}`, 'true');
      }
    }

    setIsAILoading(true);
    setShowAIMenu(false);
    setAiSuggestion(null);
    try {
      const evidence = getEvidenceLibrary();
      const currentPromptText = selectedPromptIndex !== null 
        ? officialPrompts[selectedPromptIndex] 
        : (customPrompt || '');

      const response = await fetch('/api/ai/essay-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          prompt: currentPromptText,
          content,
          evidence: Object.values(evidence),
          scholarshipTitle
        })
      });

      const data = await response.json();
      if (data.success) {
        setAiSuggestion(data.suggestion);
      } else {
        alert(data.error || 'Failed to get AI suggestion');
      }
    } catch (err) {
      console.error(err);
      alert('Network error while connecting to AI Assistant');
    } finally {
      setIsAILoading(false);
    }
  };

  if (!isOpen) return null;

  const currentPromptText = selectedPromptIndex !== null 
    ? officialPrompts[selectedPromptIndex] 
    : (customPrompt || 'Belum ada pertanyaan resmi yang dipilih/dimasukkan.');

  return (
    <div className={`fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-all duration-300 ${isFullScreen ? 'p-0' : 'p-4'}`}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={`bg-white shadow-2xl flex flex-col overflow-hidden border border-slate-200 transition-all duration-500 ${
          isFullScreen ? 'w-full h-full rounded-none' : 'max-w-4xl w-full h-[85vh] rounded-2xl'
        }`}
      >
        {/* Workspace Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 sticky top-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#1F8ED8] text-white flex items-center justify-center shrink-0 shadow-lg shadow-sky-100">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900 truncate">Essay Workspace</h2>
              <p className="text-[11px] text-slate-500 font-medium truncate uppercase tracking-wider">{scholarshipTitle}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-500 mr-2">
              {isSaving ? (
                <div className="flex items-center gap-1.5 text-[#1F8ED8]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#1F8ED8] animate-pulse" />
                  <span className="font-bold">Auto-saving...</span>
                </div>
              ) : lastSaved ? (
                <div className="flex items-center gap-1.5 text-emerald-600">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Last saved: {new Date(lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ) : (
                <span>Drafting mode</span>
              )}
            </div>

            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center transition-colors cursor-pointer"
              title={isFullScreen ? "Minimize" : "Full Screen"}
            >
              {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-900 text-white hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Prompt Header Section */}
        <div className="px-6 py-4 bg-slate-50/30 border-b border-slate-100 relative group">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-[#1F8ED8]" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pertanyaan Resmi (Official Prompt)</span>
                {officialPrompts.length > 0 && (
                  <span className="bg-emerald-100 text-emerald-700 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">Verified</span>
                )}
              </div>
              
              {isEditingCustomPrompt ? (
                <div className="space-y-2">
                  <textarea
                    autoFocus
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Tempel pertanyaan resmi dari website beasiswa di sini..."
                    className="w-full p-3 bg-white border border-sky-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1F8ED8] shadow-sm"
                    rows={2}
                  />
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => setIsEditingCustomPrompt(false)}
                      className="px-3 py-1 bg-[#1F8ED8] text-white text-[10px] font-bold rounded-lg cursor-pointer"
                    >
                      Selesai
                    </button>
                  </div>
                </div>
              ) : (
                <div 
                  className={`text-sm font-bold text-slate-800 leading-relaxed cursor-pointer hover:bg-slate-100/50 p-2 -ml-2 rounded-lg transition-colors ${!currentPromptText ? 'italic text-slate-400' : ''}`}
                  onClick={() => {
                    if (officialPrompts.length > 0) setShowPromptPicker(!showPromptPicker);
                    else setIsEditingCustomPrompt(true);
                  }}
                >
                  {currentPromptText}
                  {officialPrompts.length > 1 && (
                    <ChevronDown className={`inline-block w-4 h-4 ml-2 text-slate-400 transition-transform ${showPromptPicker ? 'rotate-180' : ''}`} />
                  )}
                </div>
              )}
            </div>
            
            {!isEditingCustomPrompt && (
              <button
                onClick={() => {
                  setSelectedPromptIndex(null);
                  setIsEditingCustomPrompt(true);
                }}
                className="shrink-0 p-2 text-slate-400 hover:text-[#1F8ED8] hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all cursor-pointer"
                title="Input Pertanyaan Sendiri"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Prompt Dropdown for multiple official prompts */}
          <AnimatePresence>
            {showPromptPicker && officialPrompts.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute left-6 right-6 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden"
              >
                <div className="max-h-48 overflow-y-auto divide-y divide-slate-50">
                  {officialPrompts.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setSelectedPromptIndex(i);
                        setShowPromptPicker(false);
                      }}
                      className={`w-full text-left px-4 py-3 text-xs transition-colors hover:bg-slate-50 ${selectedPromptIndex === i ? 'bg-sky-50 text-[#1F8ED8] font-bold' : 'text-slate-600 font-medium'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Editor Toolbar */}
        <div className="px-6 py-2 bg-white border-b border-slate-100 flex items-center gap-4 text-xs font-medium text-slate-500 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-sky-400" />
            <span>Words: <strong className="text-slate-900">{wordCount}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            <span>Chars: <strong className="text-slate-900">{content.length}</strong>
              {scholarship?.characterLimit && (
                <span className={content.length > scholarship.characterLimit ? 'text-rose-500 ml-1' : 'text-slate-400 ml-1'}>
                  / {scholarship.characterLimit}
                </span>
              )}
            </span>
          </div>
          <div className="h-4 w-px bg-slate-200 shrink-0" />
          
          <button 
            onClick={() => setShowReadiness(!showReadiness)}
            className={`flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer px-2 py-1 rounded-lg ${showReadiness ? 'bg-emerald-50 text-emerald-600' : 'hover:bg-slate-50'}`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Readiness: <strong className={showReadiness ? 'text-emerald-700' : 'text-slate-900'}>{draft?.readiness?.overall || 0}%</strong></span>
          </button>

          <button 
            onClick={() => {
              if (!isMatePassActive) {
                if (onUpgrade) onUpgrade();
                return;
              }
              setShowHistory(!showHistory);
            }}
            className={`flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer px-2 py-1 rounded-lg ${showHistory ? 'bg-amber-50 text-amber-600' : 'hover:bg-slate-50'}`}
          >
            <History className="w-3.5 h-3.5" />
            <div className="flex items-center gap-1">
              <span>History</span>
              {!isMatePassActive && <Lock className="w-2.5 h-2.5 text-amber-400" />}
            </div>
          </button>
          
          <div className="ml-auto flex items-center gap-3 shrink-0">
             <button 
                onClick={() => {
                  if (!isMatePassActive) {
                    if (onUpgrade) onUpgrade();
                    return;
                  }
                  setShowEvidence(!showEvidence);
                }}
                className={`flex items-center gap-2 px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  showEvidence ? 'bg-[#1F8ED8] text-white' : 'hover:bg-slate-100 text-[#1F8ED8]'
                }`}
             >
               <Library className="w-3.5 h-3.5" />
               <div className="flex items-center gap-1">
                 <span className="font-bold">Evidence Library</span>
                 {!isMatePassActive && <Lock className="w-3 h-3 text-sky-300" />}
               </div>
               {showEvidence ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
             </button>
             <div className="h-4 w-px bg-slate-200" />
             
             <div className="relative">
               <button 
                 onClick={() => setShowAIMenu(!showAIMenu)}
                 disabled={isAILoading}
                 className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                   isAILoading ? 'bg-slate-100 text-slate-400' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                 }`}
               >
                 <Sparkles className={`w-3.5 h-3.5 ${isAILoading ? 'animate-spin' : ''}`} />
                 <span>{isAILoading ? 'Thinking...' : 'AI Assist'}</span>
                 <ChevronDown className={`w-3 h-3 transition-transform ${showAIMenu ? 'rotate-180' : ''}`} />
               </button>

               <AnimatePresence>
                 {showAIMenu && (
                   <motion.div
                     initial={{ opacity: 0, y: 10, scale: 0.95 }}
                     animate={{ opacity: 1, y: 0, scale: 1 }}
                     exit={{ opacity: 0, y: 10, scale: 0.95 }}
                     className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden py-1"
                   >
                     <AIMenuItem 
                       icon={<HelpCircle className="w-3.5 h-3.5" />} 
                       label="Brainstorm" 
                       onClick={() => handleAIAction('brainstorm')} 
                     />
                     <AIMenuItem 
                       icon={<FileText className="w-3.5 h-3.5" />} 
                       label="Buat Outline" 
                       onClick={() => handleAIAction('outline')} 
                     />
                     <div className="h-px bg-slate-100 my-1" />
                     <AIMenuItem 
                       icon={<CheckCircle2 className="w-3.5 h-3.5" />} 
                       label="Review Draft" 
                       onClick={() => handleAIAction('review')} 
                     />
                     <AIMenuItem 
                       icon={<Zap className="w-3.5 h-3.5" />} 
                       label="Perkuat Bagian Tertentu" 
                       onClick={() => handleAIAction('strengthen')} isLocked={!isMatePassActive} 
                     />
                     <AIMenuItem 
                       icon={<Sparkles className="w-3.5 h-3.5" />} 
                       label="Rapikan Bahasa" 
                       onClick={() => handleAIAction('polish')} isLocked={!isMatePassActive} 
                     />
                     <div className="h-px bg-slate-100 my-1" />
                     <AIMenuItem 
                       icon={<AlertCircle className="w-3.5 h-3.5 text-amber-500" />} 
                       label="Cek Terlalu Generik" 
                       onClick={() => handleAIAction('generic-check')} isLocked={!isMatePassActive} 
                     />
                     <AIMenuItem 
                       icon={<Target className="w-3.5 h-3.5 text-rose-500" />} 
                       label="Cek Klaim Tanpa Bukti" 
                       onClick={() => handleAIAction('evidence-check')} isLocked={!isMatePassActive} 
                     />
                   </motion.div>
                 )}
               </AnimatePresence>
             </div>
          </div>
        </div>

        {/* Main Editor Area */}
        <div className="flex-1 flex overflow-hidden bg-white relative">
          <div className="flex-1 relative overflow-hidden h-full flex flex-col">
            <AnimatePresence>
              {showReadiness && draft?.readiness && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-emerald-50 border-b border-emerald-100 overflow-hidden shrink-0"
                >
                  <div className="p-4 sm:p-6 grid grid-cols-2 sm:grid-cols-5 gap-4">
                    <ReadinessMetric label="Prompt" value={draft.readiness.promptCoverage} />
                    <ReadinessMetric label="Evidence" value={draft.readiness.evidence} />
                    <ReadinessMetric label="Specificity" value={draft.readiness.specificity} />
                    <ReadinessMetric label="Structure" value={draft.readiness.structure} />
                    <ReadinessMetric label="Clarity" value={draft.readiness.clarity} />
                  </div>
                </motion.div>
              )}
              
              {showHistory && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-amber-50 border-b border-amber-100 overflow-hidden shrink-0"
                >
                  <div className="p-4 sm:p-6 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Version History (Last 10)</h4>
                      <button onClick={() => setShowHistory(false)} className="text-[10px] font-bold text-amber-400 hover:text-amber-600 uppercase tracking-widest cursor-pointer">Tutup</button>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-amber-200">
                      {draft?.versions && draft.versions.length > 0 ? (
                        [...draft.versions].reverse().map((v) => (
                          <button
                            key={v.id}
                            onClick={() => restoreVersion(v.content)}
                            className="shrink-0 bg-white border border-amber-200 p-3 rounded-xl text-left hover:border-amber-400 transition-all group"
                          >
                            <div className="text-[10px] font-bold text-amber-600 mb-1 flex items-center gap-1">
                              <Undo2 className="w-2.5 h-2.5" />
                              {new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="text-[9px] text-slate-500 line-clamp-2 w-32">
                              {v.content || '(Draft Kosong)'}
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="text-xs text-amber-600 italic py-2">Belum ada versi yang tersimpan secara otomatis.</div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
              {aiSuggestion && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-indigo-50 border-b border-indigo-100 overflow-hidden shrink-0"
                >
                  <div className="p-4 sm:p-6 max-h-[40vh] overflow-y-auto">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-600" />
                        <h4 className="font-bold text-indigo-900 text-sm">AI Suggestion</h4>
                      </div>
                      <button 
                        onClick={() => setAiSuggestion(null)}
                        className="text-[10px] font-bold text-indigo-400 hover:text-indigo-600 uppercase tracking-widest cursor-pointer"
                      >
                        Tutup
                      </button>
                    </div>
                    <div className="text-xs text-indigo-800 leading-relaxed whitespace-pre-wrap font-medium">
                      {aiSuggestion}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Tulis essay atau jawaban pertanyaan aplikasi Anda di sini...

Tips dari ScholarMate:
1. Mulailah dengan outline yang kuat.
2. Ceritakan pengalaman spesifik daripada generalisasi.
3. Hubungkan visi beasiswa dengan tujuan karirmu."
              className="w-full flex-1 p-8 sm:p-12 text-slate-800 text-base sm:text-lg leading-relaxed focus:outline-none resize-none scrollbar-thin scrollbar-thumb-slate-200 placeholder:text-slate-300"
              spellCheck={false}
            />
            
            {/* Subtle Page Lines decoration in full screen */}
            {isFullScreen && (
              <div className="absolute top-0 bottom-0 left-0 w-1 bg-[#1F8ED8]/10" />
            )}
          </div>

          {/* Evidence Sidebar */}
          <AnimatePresence>
            {showEvidence && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 320, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="h-full border-l border-slate-200 overflow-hidden hidden lg:block"
              >
                <EvidenceLibrary 
                  className="w-80" 
                  onSelect={(text) => {
                    // Append text or show as info
                    // For now, let's just alert or log, or better:
                    // copy to clipboard would be nice, but user intent is often "reference"
                    // I'll add it as a toast-like notification or just let them read it.
                    // Actually, let's just let them read it in the sidebar.
                  }} 
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mobile Evidence Overlay */}
          <AnimatePresence>
            {showEvidence && (
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                className="absolute inset-0 z-20 bg-white lg:hidden"
              >
                <div className="h-full flex flex-col">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-bold text-slate-900">Evidence Library</h3>
                    <button onClick={() => setShowEvidence(false)} className="p-2 text-slate-400">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <EvidenceLibrary />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-5 bg-slate-50 border-t border-slate-100 flex flex-col gap-5">
          {/* Contextual Mentoring CTA */}
          <div className="w-full">
            {(() => {
              let mentoringCTA = {
                label: "Strategy Mentoring",
                sub: "Optimasi profil untuk tembus beasiswa ini",
                type: "STRATEGY"
              };

              if (scholarship?.selectionStages?.some(s => s.toLowerCase().includes('interview') || s.toLowerCase().includes('wawancara'))) {
                mentoringCTA = { label: "Mock Interview", sub: "Latihan simulasi wawancara dengan mentor", type: "INTERVIEW" };
              } else if (scholarship?.selectionStages?.some(s => s.toLowerCase().includes('fgd') || s.toLowerCase().includes('lgd'))) {
                mentoringCTA = { label: "FGD Prep", sub: "Strategi diskusi kelompok yang dominan & taktis", type: "FGD" };
              } else if (content.length > 100) {
                mentoringCTA = { label: "Review Essay", sub: "Feedback mendalam untuk essay-mu", type: "ESSAY" };
              }

              return (
                <button
                  onClick={() => {
                    const waNumber = import.meta.env.VITE_MENTORING_WHATSAPP_NUMBER || '6281234567890';
                    window.open(`https://wa.me/${waNumber}?text=Halo%20ScholarMate,%20saya%20ingin%20booking%20${mentoringCTA.label}%20untuk%20beasiswa%20${scholarshipTitle}`, '_blank');
                  }}
                  className="w-full p-4 rounded-2xl bg-white border border-indigo-100 shadow-sm hover:shadow-md transition-all group flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-bold text-slate-900">{mentoringCTA.label}</p>
                      <p className="text-[10px] text-slate-500">{mentoringCTA.sub}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                </button>
              );
            })()}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[11px] text-slate-400 text-center sm:text-left">
              Draft disimpan secara lokal di browser Anda. <br className="hidden sm:block" />
              Pastikan menyalin ke portal resmi sebelum deadline.
            </p>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={() => {
                  if (confirm('Apakah Anda yakin ingin menghapus draft ini?')) {
                    setContent('');
                  }
                }}
                className="flex-1 sm:flex-none px-4 py-2 text-rose-600 font-bold text-xs hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
              >
                Hapus Draft
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 sm:flex-none px-6 py-2.5 bg-[#1F8ED8] text-white font-bold rounded-xl shadow-lg shadow-sky-100 hover:bg-[#1F8ED8]/90 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Menyimpan...' : 'Simpan Draft'}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function ReadinessMetric({ label, value }: { label: string, value: number }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">{label}</span>
        <span className="text-[10px] font-black text-emerald-800">{value}%</span>
      </div>
      <div className="h-1.5 w-full bg-emerald-200 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          className="h-full bg-emerald-500"
        />
      </div>
    </div>
  );
}

function AIMenuItem({ icon, label, onClick, isLocked }: { icon: React.ReactNode, label: string, onClick: () => void, isLocked?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-2 text-xs font-bold transition-colors cursor-pointer ${
        isLocked ? 'text-slate-400 hover:bg-slate-50' : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-600'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="shrink-0">{icon}</span>
        <span>{label}</span>
      </div>
      {isLocked && <Lock className="w-3 h-3 text-slate-300" />}
    </button>
  );
}
