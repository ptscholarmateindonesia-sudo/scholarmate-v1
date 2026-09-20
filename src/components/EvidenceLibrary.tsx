import React, { useState, useEffect } from 'react';
import { 
  Library, 
  Plus, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Edit2, 
  Trash2, 
  Save, 
  X,
  Target,
  Trophy,
  Users,
  Heart,
  BarChart3,
  Lightbulb,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { EvidenceItem, EvidenceCategory } from '../types.ts';
import { getEvidenceLibrary, saveEvidenceItem, deleteEvidenceItem } from '../lib/evidenceService.ts';
import { getSavedResult } from '../lib/saveService.ts';

interface EvidenceLibraryProps {
  onSelect?: (content: string) => void;
  className?: string;
}

export function EvidenceLibrary({ onSelect, className = "" }: EvidenceLibraryProps) {
  const [items, setItems] = useState<Record<string, EvidenceItem>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<EvidenceCategory | 'ALL'>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<EvidenceItem | null>(null);

  useEffect(() => {
    loadLibrary();
  }, []);

  const loadLibrary = () => {
    const lib = getEvidenceLibrary();
    
    // Check if we need to pre-populate from profile
    if (Object.keys(lib).length === 0) {
      const savedResult = getSavedResult();
      if (savedResult?.profile) {
        const profile = savedResult.profile;
        const initialItems: EvidenceItem[] = [];

        if (profile.goal) {
          initialItems.push({
            id: `goal-${Date.now()}`,
            category: 'GOAL',
            title: 'Tujuan Karir & Pendidikan',
            role: 'Personal Goal',
            action: profile.goal,
            impact: '',
            metrics: '',
            lessons: '',
            lastModified: Date.now()
          });
        }

        if (profile.has_organization) {
          initialItems.push({
            id: `org-placeholder-${Date.now()}`,
            category: 'ORGANIZATION',
            title: 'Pengalaman Organisasi',
            role: '',
            action: '',
            impact: '',
            metrics: '',
            lessons: '',
            lastModified: Date.now()
          });
        }

        if (profile.has_achievement) {
          initialItems.push({
            id: `ach-placeholder-${Date.now()}`,
            category: 'ACHIEVEMENT',
            title: 'Prestasi & Penghargaan',
            role: '',
            action: '',
            impact: '',
            metrics: '',
            lessons: '',
            lastModified: Date.now()
          });
        }

        if (profile.has_volunteer) {
          initialItems.push({
            id: `vol-placeholder-${Date.now()}`,
            category: 'VOLUNTEER',
            title: 'Pengalaman Volunteer',
            role: '',
            action: '',
            impact: '',
            metrics: '',
            lessons: '',
            lastModified: Date.now()
          });
        }

        initialItems.forEach(item => {
          saveEvidenceItem(item);
        });
        
        setItems(getEvidenceLibrary());
        return;
      }
    }
    
    setItems(lib);
  };

  const handleSave = (item: EvidenceItem) => {
    saveEvidenceItem(item);
    setEditingItem(null);
    loadLibrary();
  };

  const handleDelete = (id: string) => {
    if (confirm('Hapus bukti ini dari library?')) {
      deleteEvidenceItem(id);
      loadLibrary();
    }
  };

  const filteredItems = Object.values(items).filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.role.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'ALL' || item.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryIcon = (category: EvidenceCategory) => {
    switch (category) {
      case 'ORGANIZATION': return <Users className="w-4 h-4" />;
      case 'ACHIEVEMENT': return <Trophy className="w-4 h-4" />;
      case 'VOLUNTEER': return <Heart className="w-4 h-4" />;
      case 'GOAL': return <Target className="w-4 h-4" />;
    }
  };

  const getCategoryColor = (category: EvidenceCategory) => {
    switch (category) {
      case 'ORGANIZATION': return 'text-blue-600 bg-blue-50';
      case 'ACHIEVEMENT': return 'text-amber-600 bg-amber-50';
      case 'VOLUNTEER': return 'text-rose-600 bg-rose-50';
      case 'GOAL': return 'text-purple-600 bg-purple-50';
    }
  };

  return (
    <div className={`flex flex-col h-full bg-slate-50 border-l border-slate-200 ${className}`}>
      {/* Header */}
      <div className="p-4 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Library className="w-5 h-5 text-[#1F8ED8]" />
            <h3 className="font-bold text-slate-900 text-sm">Evidence Library</h3>
          </div>
          <button 
            onClick={() => setEditingItem({
              id: `item-${Date.now()}`,
              category: 'ORGANIZATION',
              title: '',
              role: '',
              action: '',
              impact: '',
              metrics: '',
              lessons: '',
              lastModified: Date.now()
            })}
            className="p-1.5 rounded-lg bg-[#1F8ED8] text-white hover:bg-[#197EC2] transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input 
            type="text"
            placeholder="Cari bukti..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-100 border border-transparent focus:bg-white focus:border-[#1F8ED8] rounded-xl text-xs transition-all outline-none"
          />
        </div>

        {/* Categories */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
          {(['ALL', 'ORGANIZATION', 'ACHIEVEMENT', 'VOLUNTEER', 'GOAL'] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeCategory === cat 
                  ? 'bg-slate-900 text-white' 
                  : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300'
              }`}
            >
              {cat === 'ALL' ? 'Semua' : cat.charAt(0) + cat.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-300">
              <Library className="w-6 h-6" />
            </div>
            <p className="text-xs font-medium text-slate-500">Belum ada data bukti. Tambahkan pengalaman organisasi, prestasi, atau volunteer kamu.</p>
          </div>
        ) : (
          filteredItems.map(item => (
            <div 
              key={item.id}
              className={`bg-white border rounded-xl overflow-hidden transition-all ${
                expandedId === item.id ? 'border-[#1F8ED8] shadow-md ring-1 ring-[#1F8ED8]/10' : 'border-slate-200 shadow-sm hover:border-slate-300'
              }`}
            >
              {/* Item Header */}
              <div 
                className="p-3 cursor-pointer flex items-start gap-3"
                onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
              >
                <div className={`p-2 rounded-lg shrink-0 ${getCategoryColor(item.category)}`}>
                  {getCategoryIcon(item.category)}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-slate-900 truncate">{item.title || 'Tanpa Judul'}</h4>
                  <p className="text-[10px] text-slate-500 truncate">{item.role || 'Peran belum diisi'}</p>
                </div>
                <div className="shrink-0 text-slate-400">
                  {expandedId === item.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>

              {/* Item Details */}
              <AnimatePresence>
                {expandedId === item.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-3 pb-3 border-t border-slate-50"
                  >
                    <div className="pt-3 space-y-3">
                      {/* Action Grid */}
                      <div className="grid grid-cols-1 gap-2.5">
                        <DetailRow icon={<Users className="w-3 h-3" />} label="Peran" content={item.role} />
                        <DetailRow icon={<Zap className="w-3 h-3" />} label="Aksi" content={item.action} />
                        <DetailRow icon={<Target className="w-3 h-3" />} label="Dampak" content={item.impact} />
                        <DetailRow icon={<BarChart3 className="w-3 h-3" />} label="Angka/Metric" content={item.metrics} />
                        <DetailRow icon={<Lightbulb className="w-3 h-3" />} label="Pelajaran" content={item.lessons} />
                      </div>

                      <div className="pt-2 flex items-center justify-between border-t border-slate-50">
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => setEditingItem(item)}
                            className="p-1.5 text-slate-400 hover:text-[#1F8ED8] hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        
                        {onSelect && (
                          <button 
                            onClick={() => {
                              const summary = `Pengalaman: ${item.title}\nPeran: ${item.role}\nAksi: ${item.action}\nDampak: ${item.impact}\nAngka: ${item.metrics}\nPelajaran: ${item.lessons}`;
                              onSelect(summary);
                            }}
                            className="px-3 py-1 bg-sky-50 text-[#1F8ED8] text-[10px] font-bold rounded-lg hover:bg-[#1F8ED8] hover:text-white transition-all cursor-pointer"
                          >
                            Gunakan Bukti
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))
        )}
      </div>

      {/* Editor Modal Overlay */}
      <AnimatePresence>
        {editingItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-900">Detail Bukti Pengalaman</h3>
                <button onClick={() => setEditingItem(null)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kategori</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['ORGANIZATION', 'ACHIEVEMENT', 'VOLUNTEER', 'GOAL'] as const).map(cat => (
                      <button
                        key={cat}
                        onClick={() => setEditingItem({ ...editingItem, category: cat })}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          editingItem.category === cat 
                            ? 'bg-slate-900 border-slate-900 text-white' 
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {cat.charAt(0) + cat.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <InputField label="Judul Pengalaman" value={editingItem.title} placeholder="Contoh: BEM UI, Juara 1 OSN, Volunteer UNICEF" onChange={v => setEditingItem({...editingItem, title: v})} />
                <InputField label="Peran / Posisi" value={editingItem.role} placeholder="Contoh: Ketua Departemen, Peserta, Fasilitator" onChange={v => setEditingItem({...editingItem, role: v})} />
                
                <div className="grid grid-cols-1 gap-4">
                  <TextareaField label="Aksi (Apa yang kamu lakukan?)" value={editingItem.action} placeholder="Gunakan kata kerja aktif: Mengelola, Menyusun, Memimpin..." onChange={v => setEditingItem({...editingItem, action: v})} />
                  <TextareaField label="Dampak (Apa hasilnya?)" value={editingItem.impact} placeholder="Perubahan apa yang terjadi setelah aksimu?" onChange={v => setEditingItem({...editingItem, impact: v})} />
                  <InputField label="Angka / Metric (Opsional)" value={editingItem.metrics} placeholder="Contoh: 500+ peserta, Naik 20%, Anggaran 10jt" onChange={v => setEditingItem({...editingItem, metrics: v})} />
                  <TextareaField label="Pelajaran (Insight)" value={editingItem.lessons} placeholder="Apa yang kamu pelajari dari pengalaman ini?" onChange={v => setEditingItem({...editingItem, lessons: v})} />
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button 
                  onClick={() => setEditingItem(null)}
                  className="flex-1 px-4 py-2.5 text-slate-600 font-bold text-sm bg-white border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button 
                  onClick={() => handleSave(editingItem)}
                  className="flex-1 px-4 py-2.5 bg-[#1F8ED8] text-white font-bold text-sm rounded-xl hover:bg-[#197EC2] shadow-lg shadow-sky-100 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  Simpan Bukti
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DetailRow({ icon, label, content }: { icon: React.ReactNode, label: string, content: string }) {
  if (!content) return null;
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 text-[#1F8ED8]">{icon}</div>
      <div className="min-w-0 flex-1">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">{label}</span>
        <p className="text-xs text-slate-700 leading-relaxed font-medium">{content}</p>
      </div>
    </div>
  );
}

function InputField({ label, value, onChange, placeholder }: { label: string, value: string, onChange: (v: string) => void, placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
      <input 
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#1F8ED8] outline-none transition-all font-medium"
      />
    </div>
  );
}

function TextareaField({ label, value, onChange, placeholder }: { label: string, value: string, onChange: (v: string) => void, placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
      <textarea 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#1F8ED8] outline-none transition-all font-medium resize-none"
      />
    </div>
  );
}
