import React from 'react';
import { Target, ArrowRight, Clock, Edit } from 'lucide-react';
import { motion } from 'motion/react';
import { Notification } from './NotificationCenter.tsx';

interface FocusReminderBoxProps {
  notifications: Notification[];
  onSnooze: (id: string, duration: '1d' | '3d' | 'morning') => void;
  onAction: (link?: string) => void;
  onWriteEssay?: (link: string, title: string) => void;
}

export function FocusReminderBox({ notifications, onSnooze, onAction, onWriteEssay }: FocusReminderBoxProps) {
  const now = Date.now();
  const visible = notifications
    .filter(n => !n.snoozedUntil || n.snoozedUntil < now)
    .sort((a, b) => {
      // Priority: URGENT first
      if (a.type === 'URGENT' && b.type !== 'URGENT') return -1;
      if (a.type !== 'URGENT' && b.type === 'URGENT') return 1;
      return 0;
    })
    .slice(0, 3);

  if (visible.length === 0) return null;

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden" id="focus-reminder-box">
      <div className="px-4 py-3 bg-[#1F8ED8]/5 border-b border-[#1F8ED8]/10 flex items-center gap-2">
        <Target className="w-4 h-4 text-[#1F8ED8]" />
        <h3 className="text-sm font-bold text-slate-900">Fokus Minggu Ini</h3>
      </div>
      
      <div className="divide-y divide-slate-100">
        {visible.map((n) => {
          const isEssayTask = n.id.startsWith('tasks-') && n.message.toLowerCase().includes('essay');
          
          return (
            <div key={n.id} className="p-4 hover:bg-slate-50/50 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {n.type === 'URGENT' && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[9px] font-black uppercase tracking-wider">
                        Mendesak
                      </span>
                    )}
                    <h4 className="text-[13px] font-bold text-slate-900 truncate">
                      {n.title}
                    </h4>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2">
                    {n.message}
                  </p>
                  
                  <div className="mt-3 flex items-center justify-between gap-3">
                    {n.link && (
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => onAction(n.link)}
                          className="flex items-center gap-1 text-[10px] font-bold text-[#1F8ED8] hover:underline cursor-pointer"
                        >
                          <span>Lihat</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                        {isEssayTask && onWriteEssay && (
                          <button 
                            onClick={() => onWriteEssay(n.link!, n.title.replace('Reminder: ', ''))}
                            className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:underline cursor-pointer ml-1"
                          >
                            <Edit className="w-3 h-3" />
                            <span>Tulis Essay</span>
                          </button>
                        )}
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 ml-auto">
                      <span className="text-[9px] font-medium text-slate-400">Snooze:</span>
                      <div className="flex gap-1">
                        <button 
                          onClick={() => onSnooze(n.id, '1d')}
                          className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[9px] font-bold hover:bg-[#1F8ED8] hover:text-white transition-colors cursor-pointer"
                        >
                          1 Hari
                        </button>
                        <button 
                          onClick={() => onSnooze(n.id, '3d')}
                          className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[9px] font-bold hover:bg-[#1F8ED8] hover:text-white transition-colors cursor-pointer"
                        >
                          3 Hari
                        </button>
                        <button 
                          onClick={() => onSnooze(n.id, 'morning')}
                          className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[9px] font-bold hover:bg-[#1F8ED8] hover:text-white transition-colors cursor-pointer"
                        >
                          Besok Pagi
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
