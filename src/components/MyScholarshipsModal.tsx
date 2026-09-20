import React, { useState, useEffect } from 'react';
import { X, Bookmark, Trash2, Edit3, CheckCircle, Clock, ExternalLink, Target, FileText, Award, Edit } from 'lucide-react';
import {
  getMyFocusedScholarships,
  removeFocusedScholarship,
  updateFocusedScholarship,
  FocusedScholarshipItem,
  ApplicationStatus,
} from '../lib/myScholarshipsService.ts';
import { EssayWorkspaceModal } from './EssayWorkspaceModal.tsx';

interface MyScholarshipsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectScholarship?: (scholarshipId: string) => void;
}

export function MyScholarshipsModal({ isOpen, onClose, onSelectScholarship }: MyScholarshipsModalProps) {
  const [items, setItems] = useState<FocusedScholarshipItem[]>([]);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState<string>('');
  
  // Workspace state
  const [activeWorkspace, setActiveWorkspace] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setItems(getMyFocusedScholarships());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStatusChange = (id: string, status: ApplicationStatus) => {
    const updated = updateFocusedScholarship(id, { status });
    setItems(updated);
  };

  const handleRemove = (id: string) => {
    const updated = removeFocusedScholarship(id);
    setItems(updated);
  };

  const handleSaveNotes = (id: string) => {
    const updated = updateFocusedScholarship(id, { notes: tempNotes });
    setItems(updated);
    setEditingNotesId(null);
  };

  const getStatusBadge = (status: ApplicationStatus) => {
    switch (status) {
      case 'Tertarik':
        return <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-full border border-slate-200">⭐ Tertarik</span>;
      case 'Sedang Persiapan':
        return <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full border border-blue-200">📚 Sedang Persiapan</span>;
      case 'Siap Daftar':
        return <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-200">🚀 Siap Daftar</span>;
      case 'Sudah Daftar':
        return <span className="px-2.5 py-1 bg-purple-50 text-purple-700 text-xs font-semibold rounded-full border border-purple-200">📤 Sudah Daftar</span>;
      case 'Menunggu Hasil':
        return <span className="px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-semibold rounded-full border border-amber-200">⏳ Menunggu Hasil</span>;
      case 'Lolos':
        return <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-full border border-emerald-200">🎉 Lolos</span>;
      case 'Belum Lolos':
        return <span className="px-2.5 py-1 bg-rose-50 text-rose-700 text-xs font-semibold rounded-full border border-rose-200">❌ Belum Lolos</span>;
      default:
        return <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-full border border-slate-200">{status}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-100">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Bookmark className="w-5 h-5 fill-emerald-600 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Beasiswa Saya & Application Tracker</h2>
              <p className="text-sm text-slate-500">Kelola status dan progres aplikasi beasiswa pilihan Anda</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {items.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                <Target className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-1">Belum Ada Beasiswa yang Difokuskan</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
                Jelajahi rekomendasi beasiswa dan klik tombol "Fokuskan" pada kartu beasiswa untuk melacak progres aplikasi Anda di sini.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Fokus Minggu Ini (Maks 3 Task Prioritas) */}
              {items.filter((i) => i.status !== 'Lolos' && i.status !== 'Belum Lolos').length > 0 && (
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/80 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                        ⚡
                      </div>
                      <h3 className="text-sm font-bold text-emerald-950">Fokus Minggu Ini (Maks 3 Task Prioritas)</h3>
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                      {Math.min(3, items.filter((i) => i.status !== 'Lolos' && i.status !== 'Belum Lolos').length)} dari 3 Task Aktif
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {items
                      .filter((i) => i.status !== 'Lolos' && i.status !== 'Belum Lolos')
                      .slice(0, 3)
                      .map((item, idx) => (
                        <div key={item.id} className="bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                              #{idx + 1} Prioritas
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-900 line-clamp-1 mt-1">{item.title}</h4>
                          <p className="text-[11px] text-slate-500 truncate">{item.sponsor}</p>
                          <div className="pt-1">
                            {getStatusBadge(item.status)}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {items.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs hover:shadow-sm transition-shadow flex flex-col gap-3 relative group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                      {item.sponsor}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 mt-1">{item.title}</h3>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                      {item.deadline && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" /> Deadline: {item.deadline}
                        </span>
                      )}
                      {item.degree && <span>• {item.degree}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(item.status)}
                    <button
                      onClick={() => handleRemove(item.id)}
                      className="text-slate-400 hover:text-red-600 p-1 rounded transition-colors cursor-pointer"
                      title="Hapus dari Beasiswa Saya"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Actions & Status selector */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600 font-bold">Tracker Status:</span>
                    <select
                      value={item.status}
                      onChange={(e) => handleStatusChange(item.id, e.target.value as ApplicationStatus)}
                      className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value="Tertarik">⭐ Tertarik</option>
                      <option value="Sedang Persiapan">📚 Sedang Persiapan</option>
                      <option value="Siap Daftar">🚀 Siap Daftar</option>
                      <option value="Sudah Daftar">📤 Sudah Daftar</option>
                      <option value="Menunggu Hasil">⏳ Menunggu Hasil</option>
                      <option value="Lolos">🎉 Lolos</option>
                      <option value="Belum Lolos">❌ Belum Lolos</option>
                    </select>
                  </div>

                  <button
                    onClick={() => setActiveWorkspace({ id: item.id, title: item.title })}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-[#1F8ED8] text-white text-xs font-bold rounded-xl hover:bg-[#1F8ED8]/90 transition-all shadow-md shadow-sky-50 cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    Tulis Essay & Jawaban
                  </button>
                </div>

                {/* Notes section */}
                <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-700 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-slate-500" /> Catatan Pribadi & Link Pendaftaran:
                    </span>
                    {editingNotesId === item.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleSaveNotes(item.id)}
                          className="px-2.5 py-1 bg-emerald-600 text-white rounded font-bold hover:bg-emerald-700 cursor-pointer"
                        >
                          Simpan
                        </button>
                        <button
                          onClick={() => setEditingNotesId(null)}
                          className="px-2.5 py-1 bg-slate-200 text-slate-700 rounded font-medium hover:bg-slate-300 cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingNotesId(item.id);
                          setTempNotes(item.notes || '');
                        }}
                        className="text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Edit Catatan
                      </button>
                    )}
                  </div>

                  {editingNotesId === item.id ? (
                    <textarea
                      value={tempNotes}
                      onChange={(e) => setTempNotes(e.target.value)}
                      placeholder="Tulis catatan, jadwal wawancara, link essay, atau status dokumen..."
                      className="w-full mt-1.5 p-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      rows={2}
                    />
                  ) : (
                    <p className="text-slate-700 mt-1 whitespace-pre-wrap">
                      {item.notes ? item.notes : <span className="text-slate-400 italic">Belum ada catatan. Klik Edit Catatan untuk menambahkan.</span>}
                    </p>
                  )}
                </div>
              </div>
            ))
              }
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
          <span>Total beasiswa dipantau: <strong>{items.length}</strong></span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>

      <EssayWorkspaceModal 
        isOpen={!!activeWorkspace}
        onClose={() => setActiveWorkspace(null)}
        scholarshipId={activeWorkspace?.id || ''}
        scholarshipTitle={activeWorkspace?.title || ''}
      />
    </div>
  );
}
