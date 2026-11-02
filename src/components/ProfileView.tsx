import React, { useState } from 'react';
import { UserProfile, Language } from '../types.ts';
import { translations } from '../i18n.ts';
import { 
  Award, 
  Trophy, 
  Flame, 
  ShieldAlert, 
  Download, 
  Edit3, 
  Shield, 
  Camera, 
  LogOut, 
  Check, 
  Info,
  ExternalLink
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';

interface ProfileViewProps {
  user: UserProfile | null;
  language: Language;
  onUpdateProfile: (name: string, photoURL: string) => Promise<void>;
  onOpenAdmin: () => void;
  isAdminUnlocked: boolean;
  onSignOut: () => void;
  onOpenAuth: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  language,
  onUpdateProfile,
  onOpenAdmin,
  isAdminUnlocked,
  onSignOut,
  onOpenAuth,
}) => {
  const t = translations[language];
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  const [isEditing, setIsEditing] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState(user?.displayName || '');
  const [photoURLInput, setPhotoURLInput] = useState(user?.photoURL || '');
  const [isSaving, setIsSaving] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  if (!user) {
    return (
      <div className="rounded-3xl glass-panel-elevated p-8 sm:p-12 text-center max-w-md mx-auto border border-white/10 my-8">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-[#0A84FF]/15 border border-[#0A84FF]/30 flex items-center justify-center text-[#0A84FF] mb-4">
          <Shield className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">{t.memberProfile}</h3>
        <p className="text-xs text-neutral-400 mb-6">
          Sign in with your Google account to track points, earn podium badges, and access team tasks.
        </p>
        <button
          onClick={onOpenAuth}
          className="w-full py-3.5 rounded-2xl bg-[#0A84FF] hover:bg-blue-600 text-white font-bold text-sm shadow-lg shadow-[#0A84FF]/30 transition-all"
        >
          {t.signInWithGoogle}
        </button>
      </div>
    );
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayNameInput.trim()) return;
    setIsSaving(true);
    try {
      await onUpdateProfile(displayNameInput.trim(), photoURLInput.trim());
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoURLInput(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
      
      {/* Profile Card */}
      <div className="relative rounded-3xl glass-panel-elevated p-6 sm:p-8 overflow-hidden border border-white/10">
        <div className="absolute -top-16 -left-16 w-48 h-48 bg-[#0A84FF]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-[#F59E0B]/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row items-center justify-between gap-6">
          
          {/* Avatar and User Name */}
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <div className="relative group">
              <div className="w-20 h-20 rounded-3xl overflow-hidden bg-gradient-to-tr from-[#0A84FF] via-blue-700 to-[#F59E0B] p-0.5 shadow-xl shadow-[#0A84FF]/25 flex items-center justify-center">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover rounded-[22px]" />
                ) : (
                  <div className="w-full h-full bg-[#0B0C10] rounded-[22px] flex items-center justify-center font-black text-2xl text-white">
                    {user.displayName?.slice(0, 2).toUpperCase() || 'ME'}
                  </div>
                )}
              </div>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-[#0A84FF] text-white shadow-lg hover:scale-105 transition-transform"
                title="Change Photo"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            <div>
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  {user.displayName}
                </h2>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="p-1 rounded-lg text-neutral-400 hover:text-white transition-colors"
                  title={t.editProfile}
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5 font-mono">{user.email}</p>
            </div>
          </div>

          {/* THE ONLY ENTRY POINT TO ADMIN DASHBOARD IN THE ENTIRE APP */}
          <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-end">
            <button
              onClick={onOpenAdmin}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all border shadow-lg ${
                isAdminUnlocked
                  ? 'bg-gradient-to-r from-[#0A84FF] to-blue-600 text-white border-blue-400 shadow-[#0A84FF]/25'
                  : 'bg-white/[0.06] hover:bg-white/[0.12] text-white border-white/10'
              }`}
            >
              <Shield className="w-4 h-4 text-[#F59E0B]" />
              <span>{t.adminDashboard}</span>
              {isAdminUnlocked && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>

            <button
              onClick={onSignOut}
              className="p-2.5 rounded-2xl bg-white/[0.05] hover:bg-rose-500/20 hover:text-rose-300 text-neutral-400 border border-white/10 transition-colors"
              title={t.signOut}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* Profile Editing Form */}
        {isEditing && (
          <form onSubmit={handleSaveProfile} className="mt-6 pt-6 border-t border-white/10 space-y-4 animate-in fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">{t.displayName}</label>
                <input
                  type="text"
                  required
                  value={displayNameInput}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#0A84FF]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">{t.photoURL}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="https://..."
                    value={photoURLInput}
                    onChange={(e) => setPhotoURLInput(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#0A84FF]"
                  />
                  <label className="cursor-pointer px-3 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-xs font-semibold text-white flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5" />
                    <span>Upload</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 rounded-xl bg-white/[0.06] text-neutral-300 text-xs font-semibold"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-[#0A84FF] text-white text-xs font-bold shadow-md shadow-[#0A84FF]/30"
              >
                {isSaving ? 'Saving...' : t.saveProfile}
              </button>
            </div>
          </form>
        )}

        {/* 4 Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 pt-6 border-t border-white/10">
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center">
            <div className="w-8 h-8 mx-auto rounded-xl bg-[#F59E0B]/15 text-[#F59E0B] flex items-center justify-center mb-1.5">
              <Award className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-amber-300">
              {user.points || 0}
            </div>
            <div className="text-[11px] text-neutral-400 font-semibold mt-0.5">{t.totalPoints}</div>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center">
            <div className="w-8 h-8 mx-auto rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center mb-1.5">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-rose-300">
              {user.totalPenalties || 0}
            </div>
            <div className="text-[11px] text-neutral-400 font-semibold mt-0.5">{t.penaltiesTotal}</div>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center">
            <div className="w-8 h-8 mx-auto rounded-xl bg-[#0A84FF]/15 text-[#0A84FF] flex items-center justify-center mb-1.5">
              <Trophy className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-[#0A84FF]">
              {user.role}
            </div>
            <div className="text-[11px] text-neutral-400 font-semibold mt-0.5">Role</div>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center">
            <div className="w-8 h-8 mx-auto rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mb-1.5">
              <Flame className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-emerald-300">
              {user.streakDays || 1} <span className="text-xs font-normal">{t.days}</span>
            </div>
            <div className="text-[11px] text-neutral-400 font-semibold mt-0.5">{t.activeStreak}</div>
          </div>
        </div>

      </div>

      {/* PWA Install Banner */}
      <div className="rounded-3xl glass-panel p-6 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#0A84FF]/15 border border-[#0A84FF]/30 flex items-center justify-center text-[#0A84FF] flex-shrink-0">
            <Download className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">{t.installPWA}</h4>
            <p className="text-xs text-neutral-400 mt-0.5">{t.installPWADesc}</p>
          </div>
        </div>

        <div>
          {isInstalled ? (
            <div className="px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>{t.installed}</span>
            </div>
          ) : isInstallable ? (
            <button
              onClick={install}
              className="px-5 py-2.5 rounded-xl bg-[#0A84FF] hover:bg-blue-600 text-white text-xs font-bold shadow-lg shadow-[#0A84FF]/30 transition-all flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>{t.installNow}</span>
            </button>
          ) : isIOS ? (
            <button
              onClick={() => setShowIOSModal(true)}
              className="px-4 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-white text-xs font-bold transition-all"
            >
              Install on iPhone / iPad
            </button>
          ) : (
            <span className="text-xs text-neutral-500">Standalone PWA Ready</span>
          )}
        </div>
      </div>

      {/* iOS Safari Guide Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowIOSModal(false)} />
          <div className="relative w-full max-w-sm p-6 rounded-3xl glass-panel-elevated border border-white/15 text-white z-10 space-y-4">
            <h3 className="text-base font-bold text-white">Install on iPhone / iPad</h3>
            <p className="text-xs text-neutral-300 leading-relaxed">
              1. Tap the <strong>Share</strong> icon in the Safari bottom bar.<br />
              2. Scroll down and tap <strong>Add to Home Screen</strong>.<br />
              3. The COC Media Team PWA will launch full screen with native app capabilities.
            </p>
            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2.5 rounded-xl bg-white/[0.1] text-white text-xs font-bold"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
