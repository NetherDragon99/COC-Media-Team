import React, { useState } from 'react';
import { Language } from '../types.ts';
import { translations } from '../i18n.ts';
import { Shield, LogIn, X, Loader2, User, Sparkles } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  language: Language;
  onClose: () => void;
  onGoogleSignIn: () => Promise<void>;
  onManualSignIn: (name: string, email: string) => Promise<void>;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  language,
  onClose,
  onGoogleSignIn,
  onManualSignIn,
}) => {
  const t = translations[language];
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [showManual, setShowManual] = useState(false);

  if (!isOpen) return null;

  const handleGoogleClick = async () => {
    setIsLoading(true);
    setError('');
    try {
      await onGoogleSignIn();
      onClose();
    } catch (err: unknown) {
      console.warn('Google sign-in popup issue (possibly iframe popup blocker):', err);
      setError(
        language === 'ar'
          ? 'تعذر فتح نافذة تسجيل الدخول (قد تكون محظورة داخل الإطار). يمكنك تسجيل الدخول المباشر أدناه.'
          : 'Could not open Google popup (may be blocked in iframe). You can use direct sign-in below.'
      );
      setShowManual(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) return;
    setIsLoading(true);
    setError('');
    try {
      await onManualSignIn(
        manualName.trim(),
        manualEmail.trim() || `${manualName.toLowerCase().replace(/\s+/g, '')}@cocmedia.team`
      );
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-md p-6 sm:p-8 rounded-3xl glass-panel-elevated border border-white/15 text-white shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-200">
        
        <div className="flex justify-end mb-2">
          <button onClick={onClose} className="p-1 rounded-lg text-neutral-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-[#0A84FF] to-blue-700 p-0.5 shadow-xl shadow-[#0A84FF]/30 flex items-center justify-center mb-4">
            <div className="w-full h-full bg-[#0B0C10] rounded-[22px] flex items-center justify-center">
              <Shield className="w-8 h-8 text-[#0A84FF]" />
            </div>
          </div>

          <h2 className="text-2xl font-black text-white tracking-tight">
            COC Media Team
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            {language === 'ar' ? 'سجل دخولك لبدء تنفيذ المهام وجمع النقاط والمنافسة' : 'Sign in to access your tasks, record attendance, and climb the leaderboard'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <button
            type="button"
            onClick={handleGoogleClick}
            disabled={isLoading}
            className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-neutral-100 text-black text-sm font-bold shadow-lg transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {isLoading && !showManual ? (
              <Loader2 className="w-4 h-4 animate-spin text-black" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
            )}
            <span>{t.signInWithGoogle}</span>
          </button>

          {/* Fallback direct sign-in for preview environment */}
          {showManual ? (
            <form onSubmit={handleManualSubmit} className="space-y-3 pt-3 border-t border-white/10 animate-in fade-in">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  {language === 'ar' ? 'الاسم بالكامل' : 'Full Name'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Steven Mario"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  {language === 'ar' ? 'البريد الإلكتروني (اختياري)' : 'Email (Optional)'}
                </label>
                <input
                  type="email"
                  placeholder="name@cocmedia.team"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-[#0A84FF] hover:bg-blue-600 text-white text-xs font-bold transition-all shadow-md shadow-[#0A84FF]/25"
              >
                {isLoading ? 'Signing in...' : 'Sign In Direct'}
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowManual(true)}
              className="w-full text-center text-[11px] text-neutral-400 hover:text-white transition-colors pt-2"
            >
              {language === 'ar' ? 'أو الدخول المباشر بالاسم والبريد' : 'Or sign in directly with name & email'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
