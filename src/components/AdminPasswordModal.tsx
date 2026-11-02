import React, { useState } from 'react';
import { MASTER_ADMIN_PASSWORD } from '../i18n.ts';
import { Shield, Lock, KeyRound, Eye, EyeOff, X } from 'lucide-react';

interface AdminPasswordModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onClose: () => void;
}

export const AdminPasswordModal: React.FC<AdminPasswordModalProps> = ({
  isOpen,
  onSuccess,
  onClose,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === MASTER_ADMIN_PASSWORD) {
      setError('');
      setPassword('');
      onSuccess();
    } else {
      setError('Invalid master password. Please verify and try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-md p-6 sm:p-8 rounded-3xl glass-panel-elevated border border-white/15 text-white shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-200">
        
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#0A84FF] to-blue-700 p-0.5 shadow-xl shadow-[#0A84FF]/30 mb-4">
            <div className="w-full h-full bg-[#0B0C10] rounded-[14px] flex items-center justify-center">
              <Shield className="w-8 h-8 text-[#0A84FF]" />
            </div>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Admin Master Access
          </h2>
          <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
            Enter master password to unlock full CMS control on this device permanently.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoFocus
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                className="w-full px-4 py-3.5 pr-11 pl-11 rounded-2xl bg-white/[0.06] border border-white/15 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-[#0A84FF]/50 text-sm font-mono text-center tracking-widest"
              />
              <KeyRound className="absolute right-3.5 top-3.5 w-4 h-4 text-neutral-400" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3.5 top-3.5 text-neutral-400 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {error && (
              <p className="text-xs text-rose-400 mt-2 font-medium text-center">
                {error}
              </p>
            )}
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] text-neutral-300 text-xs sm:text-sm font-semibold transition-all border border-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-[#0A84FF] to-blue-600 hover:from-blue-500 hover:to-blue-600 text-white text-xs sm:text-sm font-bold shadow-lg shadow-[#0A84FF]/30 transition-all flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              <span>Unlock Admin</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
