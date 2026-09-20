import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, Calendar, ShieldCheck, Zap, Info, ArrowRight, Edit } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'URGENT' | 'INFO' | 'SUCCESS';
  timestamp: string;
  isRead: boolean;
  link?: string;
  snoozedUntil?: number; // timestamp
}

interface NotificationCenterProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onSnooze: (id: string, duration: '1d' | '3d' | 'morning') => void;
  onWriteEssay?: (id: string, title: string) => void;
}

export function NotificationCenter({ 
  notifications, 
  onMarkAsRead, 
  onMarkAllAsRead,
  onClearAll,
  onSnooze,
  onWriteEssay
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const now = Date.now();
  const visibleNotifications = notifications.filter(n => !n.snoozedUntil || n.snoozedUntil < now);
  const unreadCount = visibleNotifications.filter(n => !n.isRead).length;

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'URGENT':
        return <Calendar className="w-4 h-4 text-rose-600" />;
      case 'SUCCESS':
        return <ShieldCheck className="w-4 h-4 text-emerald-600" />;
      default:
        return <Info className="w-4 h-4 text-sky-600" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        id="btn-toggle-notifications"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-slate-100 transition-colors cursor-pointer text-slate-600 focus:outline-none"
        aria-label="Notifikasi"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <motion.span 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-1 right-1 w-4 h-4 bg-rose-600 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white"
          >
            {unreadCount}
          </motion.span>
        )}
      </button>

      {/* Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 mt-2 w-[320px] sm:w-[380px] max-h-[500px] bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-50 flex flex-col"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Notifikasi</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
                    {unreadCount} Baru
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {notifications.length > 0 && (
                  <button
                    onClick={onMarkAllAsRead}
                    className="text-[10px] font-bold text-[#1F8ED8] hover:text-[#197EC2] cursor-pointer"
                  >
                    Baca Semua
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-full hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-slate-200">
              {visibleNotifications.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center px-6">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 mb-3">
                    <Bell className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-900">Belum ada notifikasi</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Kami akan memberi tahu jika ada beasiswa mendesak atau pembaruan profil.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {visibleNotifications.map((n) => (
                    <div
                      key={n.id}
                      className={`px-4 py-4 hover:bg-slate-50 transition-colors relative ${!n.isRead ? 'bg-sky-50/30' : ''}`}
                    >
                      {!n.isRead && (
                        <div className="absolute top-4 left-1.5 w-1.5 h-1.5 rounded-full bg-[#1F8ED8]" />
                      )}
                      <div className="flex gap-3">
                        <div 
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 cursor-pointer ${
                            n.type === 'URGENT' ? 'bg-rose-50' : 
                            n.type === 'SUCCESS' ? 'bg-emerald-50' : 
                            'bg-sky-50'
                          }`}
                          onClick={() => onMarkAsRead(n.id)}
                        >
                          {getIcon(n.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 
                              className={`text-[13px] leading-tight mb-1 truncate cursor-pointer ${!n.isRead ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}
                              onClick={() => onMarkAsRead(n.id)}
                            >
                              {n.title}
                            </h4>
                            <span className="text-[10px] text-slate-400 whitespace-nowrap">
                              {n.timestamp}
                            </span>
                          </div>
                          <p 
                            className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 cursor-pointer"
                            onClick={() => onMarkAsRead(n.id)}
                          >
                            {n.message}
                          </p>
                          
                          <div className="mt-3 flex items-center justify-between">
                            {n.link ? (
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => {
                                    onMarkAsRead(n.id);
                                    // Usually there's a link action handled in parent, 
                                    // but here we just show the link.
                                  }}
                                  className="flex items-center gap-1 text-[10px] font-bold text-[#1F8ED8] cursor-pointer hover:underline"
                                >
                                  <span>Lihat</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                                {n.id.startsWith('tasks-') && n.message.toLowerCase().includes('essay') && onWriteEssay && (
                                  <button 
                                    onClick={() => {
                                      onMarkAsRead(n.id);
                                      onWriteEssay(n.link!, n.title.replace('Reminder: ', ''));
                                      setIsOpen(false);
                                    }}
                                    className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 cursor-pointer hover:underline ml-1"
                                  >
                                    <Edit className="w-3 h-3" />
                                    <span>Tulis Essay</span>
                                  </button>
                                )}
                              </div>
                            ) : <div />}
                            
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">Snooze:</span>
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
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {visibleNotifications.length > 0 && (
              <div className="p-3 bg-slate-50/50 border-t border-slate-100 text-center">
                <button
                  onClick={onClearAll}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  Bersihkan Semua
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
