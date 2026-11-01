import React, { useState, useEffect } from 'react';
import { User, Sparkles, Film, ArrowRight, ShieldCheck } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  currentName: string;
  onSaveName: (name: string) => void;
  onClose: () => void;
  isFirstVisit: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  currentName,
  onSaveName,
  onClose,
  isFirstVisit,
}) => {
  const [nameInput, setNameInput] = useState(currentName);
  const [error, setError] = useState('');

  useEffect(() => {
    setNameInput(currentName);
    setError('');
  }, [currentName, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setError('Please enter your name or media callsign.');
      return;
    }
    if (trimmed.length < 2) {
      setError('Name must be at least 2 characters.');
      return;
    }
    onSaveName(trimmed);
    onClose();
  };

  const sampleNames = ['Marcus Vance', 'Sarah Jenkins', 'David Kalu', 'Elena Rostova', 'Jordan Lee'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Dark blur backdrop */}
      <div 
        className="fixed inset-0 bg-black/75 backdrop-blur-md transition-opacity duration-300"
        onClick={!isFirstVisit ? onClose : undefined}
      />

      {/* Glass Card */}
      <div className="relative w-full max-w-md p-6 sm:p-8 rounded-3xl glass-panel-elevated border border-white/15 text-white shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Glow ambient background inside modal */}
        <div className="absolute -top-16 -left-16 w-32 h-32 bg-indigo-500/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-purple-500/30 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-600 to-pink-500 p-0.5 shadow-xl shadow-indigo-500/25 mb-4">
            <div className="w-full h-full bg-[#0d111c] rounded-[14px] flex items-center justify-center">
              <Film className="w-8 h-8 text-indigo-400" />
            </div>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-white">
            {isFirstVisit ? 'Welcome to COC Media' : 'Edit Member Profile'}
          </h2>
          <p className="text-sm text-neutral-400 mt-1.5 leading-relaxed">
            {isFirstVisit
              ? 'Enter your name to claim completed media tasks, track points, and climb the team leaderboard.'
              : 'Update your display name for the COC Media Team leaderboard.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
              Your Full Name or Callsign
            </label>
            <div className="relative">
              <input
                type="text"
                autoFocus
                placeholder="e.g. Alex Producer, Jordan Video"
                value={nameInput}
                onChange={(e) => {
                  setNameInput(e.target.value);
                  setError('');
                }}
                className="w-full px-4 py-3.5 pl-11 rounded-2xl bg-white/[0.06] border border-white/15 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm"
              />
              <User className="absolute left-3.5 top-3.5 w-4 h-4 text-neutral-400" />
            </div>
            {error && <p className="text-xs text-rose-400 mt-2 font-medium">{error}</p>}
          </div>

          {/* Quick select suggestions for demo / convenience */}
          {isFirstVisit && (
            <div>
              <div className="text-[11px] font-medium text-neutral-400 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-indigo-400" />
                Quick suggestions:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {sampleNames.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setNameInput(s)}
                    className="px-2.5 py-1 rounded-lg text-xs bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-neutral-300 hover:text-white transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2 flex items-center gap-3">
            {!isFirstVisit && (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] text-neutral-300 text-sm font-semibold transition-all border border-white/10"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="flex-1 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 group"
            >
              <span>{isFirstVisit ? 'Join Media Team' : 'Save Changes'}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </form>

        <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-center gap-2 text-neutral-400 text-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Saved persistently on this device via localStorage</span>
        </div>

      </div>
    </div>
  );
};
