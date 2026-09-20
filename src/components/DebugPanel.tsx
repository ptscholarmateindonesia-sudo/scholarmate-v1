import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Bug, Trash2, LogIn, LogOut, RefreshCw } from 'lucide-react';
import { authService, AuthUser, AuthState } from '../lib/authService.ts';
import { SaveStatus, getSavedResult, clearSavedResult, isStorageAvailable } from '../lib/saveService.ts';
import { getRecentEvents, subscribeAnalytics, AnalyticsEvent } from '../lib/analytics.ts';
import { ScreenState } from '../types.ts';

interface DebugPanelProps {
  viewMode?: ScreenState;
  hasCompletedScan?: boolean;
  saveStatus: SaveStatus;
  hasUnsavedChanges: boolean;
  activeProfileValid: boolean;
  activeProfileReason?: string;
  rawScanProfile?: Record<string, any>;
  canonicalActiveProfile?: Record<string, any>;
  engineProfileInput?: Record<string, any>;
  activeProfileSnapshot?: Record<string, any>;
  activeProfileFingerprint?: string;
  savedSnapshotValidity?: 'VALID' | 'INVALID' | 'NONE';
  savedProfileFingerprint?: string;
  fingerprintMatch?: boolean;
  pendingSnapshotStatus: 'NONE' | 'VALID' | 'INVALID';
  onClearSavedResult: () => void;
  onRefreshSavedResult: () => void;
  onSimulateLogin: () => void;
  onSignOut: () => void;
}

export function DebugPanel({
  viewMode = 'RESULT',
  hasCompletedScan = true,
  saveStatus,
  hasUnsavedChanges,
  activeProfileValid,
  activeProfileReason,
  rawScanProfile,
  canonicalActiveProfile,
  engineProfileInput,
  activeProfileSnapshot,
  activeProfileFingerprint,
  savedSnapshotValidity,
  savedProfileFingerprint,
  fingerprintMatch,
  pendingSnapshotStatus,
  onClearSavedResult,
  onRefreshSavedResult,
  onSimulateLogin,
  onSignOut,
}: DebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [authState, setAuthState] = useState<AuthState>(authService.getAuthState());
  const [user, setUser] = useState<AuthUser | null>(authService.getCurrentUser());
  const [recentEvents, setRecentEvents] = useState<AnalyticsEvent[]>(getRecentEvents());

  const savedResult = getSavedResult();

  useEffect(() => {
    const unsubscribeAuth = authService.subscribe((state, u) => {
      setAuthState(state);
      setUser(u);
    });

    const unsubscribeAnalytics = subscribeAnalytics((events) => {
      setRecentEvents(events);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeAnalytics();
    };
  }, []);

  return (
    <div className="w-full mt-6 bg-slate-900 text-slate-200 border border-slate-800 rounded-2xl overflow-hidden shadow-sm text-xs font-mono" id="debug-panel-wrapper">
      <button
        type="button"
        id="btn-toggle-debug-panel"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-slate-950 hover:bg-slate-900 transition-colors flex items-center justify-between text-amber-400 font-bold cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-amber-400" />
          <span>SAVE / AUTH DEBUG (Dev Mode Only)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
            {authState === 'AUTHENTICATED' ? 'DEV_USER' : 'NO_AUTH'}
          </span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-4 space-y-4 bg-slate-900 border-t border-slate-800" id="debug-panel-content">
          {/* Grid Information */}
          <div className="grid grid-cols-2 gap-3 text-[11px]">
            <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-500 block text-[10px]">View Mode:</span>
              <span className="text-sky-400 font-bold">{viewMode}</span>
            </div>

            <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Has Completed Scan:</span>
              <span className={hasCompletedScan ? 'text-emerald-400 font-bold' : 'text-slate-400 font-bold'}>
                {hasCompletedScan ? 'true' : 'false'}
              </span>
            </div>

            <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Auth Mode:</span>
              <span className="text-emerald-400 font-semibold">FIREBASE_GOOGLE_AUTH</span>
            </div>

            <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Auth State:</span>
              <span className={authState === 'AUTHENTICATED' ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
                {authState}
              </span>
            </div>

            <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Active Profile Valid:</span>
              <span className={activeProfileValid ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                {activeProfileValid ? 'true' : `false (${activeProfileReason || 'Incomplete'})`}
              </span>
            </div>

            <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Save State:</span>
              <span className="text-sky-400 font-semibold">{saveStatus}</span>
            </div>

            <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Saved Snapshot Validity:</span>
              <span className={(savedSnapshotValidity || (savedResult ? 'VALID' : 'NONE')) === 'VALID' ? 'text-emerald-400 font-semibold' : 'text-slate-400'}>
                {savedSnapshotValidity || (savedResult ? 'VALID' : 'NONE')}
              </span>
            </div>

            <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Fingerprint Match:</span>
              <span className={fingerprintMatch ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
                {fingerprintMatch ? 'true' : 'false'}
              </span>
            </div>
          </div>

          {/* Canonical Profile Schemas Debug View */}
          <div className="space-y-2 text-[11px]">
            {rawScanProfile && (
              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px] font-bold">RAW SCAN PROFILE (dev only):</span>
                <pre className="text-amber-300 font-mono text-[10px] mt-0.5 whitespace-pre-wrap break-all">
                  {JSON.stringify(rawScanProfile, null, 2)}
                </pre>
              </div>
            )}

            {(canonicalActiveProfile || activeProfileSnapshot) && (
              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px] font-bold">CANONICAL ACTIVE PROFILE:</span>
                <pre className="text-sky-300 font-mono text-[10px] mt-0.5 whitespace-pre-wrap break-all">
                  {JSON.stringify(canonicalActiveProfile || activeProfileSnapshot, null, 2)}
                </pre>
              </div>
            )}

            {engineProfileInput && (
              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px] font-bold">ENGINE PROFILE INPUT:</span>
                <pre className="text-emerald-300 font-mono text-[10px] mt-0.5 whitespace-pre-wrap break-all">
                  {JSON.stringify(engineProfileInput, null, 2)}
                </pre>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-500 block">Active Fingerprint:</span>
                <span className="text-slate-300 font-mono text-[9px] break-all">{activeProfileFingerprint || 'null'}</span>
              </div>
              <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-500 block">Saved Fingerprint:</span>
                <span className="text-slate-300 font-mono text-[9px] break-all">{savedProfileFingerprint || 'null'}</span>
              </div>
            </div>
          </div>

          {/* Saved Profile Summary if valid */}
          {savedResult && (
            <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-[11px]">
              <span className="text-slate-500 block text-[10px]">Saved Profile Summary:</span>
              <div className="text-sky-300 font-medium mt-0.5">
                {(savedResult.profile.education_level || (savedResult.profile as any).educationLevel || '-').toUpperCase()} • Semester {savedResult.profile.semester || '-'} • {savedResult.profile.major || '-'} • {savedResult.profile.university || '-'}
              </div>
            </div>
          )}

          {/* Current User */}
          <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-[11px]">
            <span className="text-slate-500 block text-[10px]">Current User:</span>
            {user ? (
              <div className="text-slate-200 mt-0.5">
                <span className="font-bold text-sky-400">{user.displayName}</span> ({user.id})
              </div>
            ) : (
              <span className="text-slate-500 italic">No authenticated user (Unauthenticated)</span>
            )}
          </div>

          {/* Saved At Timestamp */}
          <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-[11px]">
            <span className="text-slate-500 block text-[10px]">Saved At:</span>
            <span className="text-slate-300">
              {savedResult ? new Date(savedResult.savedAt).toLocaleString('id-ID') : 'No saved result in localStorage'}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-1" id="debug-action-buttons">
            {authState !== 'AUTHENTICATED' ? (
              <button
                type="button"
                id="btn-debug-google-login"
                onClick={onSimulateLogin}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-sans font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Google Sign-In</span>
              </button>
            ) : (
              <button
                type="button"
                id="btn-debug-signout"
                onClick={onSignOut}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-sans font-medium text-xs rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out Google</span>
              </button>
            )}

            <button
              type="button"
              id="btn-debug-clear-saved"
              onClick={onClearSavedResult}
              className="px-3 py-1.5 bg-rose-950 hover:bg-rose-900 text-rose-300 font-sans font-medium text-xs rounded-lg border border-rose-800/50 flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Saved Result</span>
            </button>
          </div>

          {/* Internal Analytics Log */}
          <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-500 block text-[10px] font-bold">Recent Internal Analytics Events:</span>
            {recentEvents.length === 0 ? (
              <span className="text-slate-600 italic text-[10px]">No events recorded yet</span>
            ) : (
              <div className="max-h-28 overflow-y-auto space-y-1 text-[10px]">
                {recentEvents.map((evt) => (
                  <div key={evt.id} className="flex items-center justify-between text-slate-400 py-0.5 border-b border-slate-900">
                    <span className="text-emerald-400 font-semibold">{evt.name}</span>
                    <span className="text-slate-600 text-[9px]">{new Date(evt.timestamp).toLocaleTimeString('id-ID')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
