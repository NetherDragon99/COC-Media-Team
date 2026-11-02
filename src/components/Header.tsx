import React from 'react';
import { AppSettings, UserProfile, Language } from '../types.ts';
import { translations } from '../i18n.ts';
import { Bell, Download, Globe, User, LogIn } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';

interface HeaderProps {
  settings: AppSettings;
  user: UserProfile | null;
  language: Language;
  onToggleLanguage: () => void;
  unreadNotificationsCount: number;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  onOpenAuth: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  user,
  language,
  onToggleLanguage,
  unreadNotificationsCount,
  activeTab,
  setActiveTab,
  onOpenAuth,
}) => {
  const t = translations[language];
  const { isInstallable, isInstalled, install } = usePWAInstall();

  const announcement = language === 'ar' ? settings.announcementAr : settings.announcementEn;
  const subtitle = language === 'ar' ? settings.subtitleAr : settings.subtitleEn;

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-2xl bg-[#000000]/85 border-b border-white/[0.08] transition-all">
      {/* Top Announcement Bar if set */}
      {announcement && (
        <div className="bg-gradient-to-r from-[#0A84FF]/20 via-[#F59E0B]/20 to-[#0A84FF]/20 border-b border-white/10 px-4 py-1.5 text-center text-xs font-semibold text-white flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse flex-shrink-0" />
          <span>{announcement}</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-4">
          
          {/* Brand Logo & Name */}
          <div 
            className="flex items-center gap-3.5 cursor-pointer group flex-shrink-0"
            onClick={() => setActiveTab('tasks')}
          >
            <div className="relative">
              <div 
                className="absolute -inset-1 rounded-2xl blur opacity-30 group-hover:opacity-75 transition duration-300"
                style={{ backgroundColor: settings.accentColor || '#0A84FF' }}
              />
              <div className="relative w-12 h-12 rounded-2xl overflow-hidden border border-white/15 bg-[#0B0C10] shadow-xl flex items-center justify-center">
                {/* Default exact logo element requested by user */}
                <img
                  src={settings.logoUrl || "image_ad59c0.jpg"}
                  alt="COC Media Team"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'image_ad59c0.jpg';
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-white flex items-center gap-1.5">
                  {settings.appName || 'COC Media Team'}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0A84FF]/15 text-[#0A84FF] border border-[#0A84FF]/30">
                  {settings.version || 'v1.0.0'}
                </span>
              </div>
              <p className="text-xs text-neutral-400 font-medium hidden sm:block">
                {subtitle || t.tagline}
              </p>
            </div>
          </div>

          {/* Desktop Navigation Links (Hidden on mobile where bottom nav is active) */}
          <nav className="hidden md:flex items-center p-1 rounded-full bg-[#12141C]/90 border border-white/10 shadow-inner">
            <button
              onClick={() => setActiveTab('tasks')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                activeTab === 'tasks'
                  ? 'bg-[#0A84FF] text-white shadow-lg shadow-[#0A84FF]/30'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {t.tasks}
            </button>
            <button
              onClick={() => setActiveTab('attendance')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                activeTab === 'attendance'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {t.attendance}
            </button>
            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                activeTab === 'leaderboard'
                  ? 'bg-[#F59E0B] text-black shadow-lg shadow-[#F59E0B]/30'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {t.leaderboard}
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`relative px-4 py-2 rounded-full text-xs font-bold transition-all ${
                activeTab === 'notifications'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <span>{t.notifications}</span>
              {unreadNotificationsCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-black">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                activeTab === 'profile'
                  ? 'bg-neutral-800 text-white border border-white/20'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {t.profile}
            </button>
          </nav>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Install PWA Button if available */}
            {isInstallable && !isInstalled && (
              <button
                onClick={install}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-[#0A84FF]/15 hover:bg-[#0A84FF]/25 border border-[#0A84FF]/30 text-[#0A84FF] transition-all"
                title={t.installNow}
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t.installNow}</span>
              </button>
            )}

            {/* Language Switcher (EN | AR) */}
            <button
              onClick={onToggleLanguage}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-bold text-neutral-200 hover:text-white transition-all"
              title="Toggle Language / تغيير اللغة"
            >
              <Globe className="w-3.5 h-3.5 text-[#0A84FF]" />
              <span className="uppercase">{language === 'en' ? 'AR' : 'EN'}</span>
            </button>

            {/* Notification Bell (Mobile & Desktop) */}
            <button
              onClick={() => setActiveTab('notifications')}
              className="relative p-2.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-neutral-300 hover:text-white transition-all"
              title={t.notifications}
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center animate-pulse">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

            {/* User Capsule or Sign-In Button */}
            {user ? (
              <button
                onClick={() => setActiveTab('profile')}
                className="flex items-center gap-2.5 p-1 sm:pr-3 sm:pl-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-white transition-all group"
              >
                <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-tr from-[#0A84FF] to-blue-700 flex items-center justify-center font-bold text-xs text-white shadow-md shadow-[#0A84FF]/20 flex-shrink-0">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
                  ) : (
                    user.displayName?.slice(0, 2).toUpperCase() || <User className="w-4 h-4" />
                  )}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-bold leading-tight group-hover:text-[#0A84FF] transition-colors max-w-[110px] truncate">
                    {user.displayName || 'Member'}
                  </div>
                  <div className="text-[10px] text-[#F59E0B] font-extrabold flex items-center gap-1">
                    <span>{user.points} {t.points}</span>
                  </div>
                </div>
              </button>
            ) : (
              <button
                onClick={onOpenAuth}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#0A84FF] hover:bg-blue-600 text-white text-xs font-bold transition-all shadow-md shadow-[#0A84FF]/30"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{t.signInWithGoogle}</span>
              </button>
            )}

          </div>

        </div>
      </div>
    </header>
  );
};
