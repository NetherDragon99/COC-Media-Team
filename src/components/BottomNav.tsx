import React from 'react';
import { Language } from '../types.ts';
import { translations } from '../i18n.ts';
import { CheckSquare, CalendarCheck, Trophy, Bell, User } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  language: Language;
  unreadNotificationsCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  language,
  unreadNotificationsCount,
}) => {
  const t = translations[language];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 backdrop-blur-2xl bg-[#000000]/90 border-t border-white/[0.08] px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 transition-all">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        
        {/* Tasks */}
        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
            activeTab === 'tasks' ? 'text-[#0A84FF]' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <div className={`p-1 rounded-xl transition-all ${activeTab === 'tasks' ? 'bg-[#0A84FF]/15' : ''}`}>
            <CheckSquare className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold mt-0.5">{t.tasks}</span>
        </button>

        {/* Attendance */}
        <button
          onClick={() => setActiveTab('attendance')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
            activeTab === 'attendance' ? 'text-emerald-400' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <div className={`p-1 rounded-xl transition-all ${activeTab === 'attendance' ? 'bg-emerald-500/15' : ''}`}>
            <CalendarCheck className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold mt-0.5">{t.attendance}</span>
        </button>

        {/* Leaderboard */}
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
            activeTab === 'leaderboard' ? 'text-[#F59E0B]' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <div className={`p-1 rounded-xl transition-all ${activeTab === 'leaderboard' ? 'bg-[#F59E0B]/15' : ''}`}>
            <Trophy className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold mt-0.5">{t.leaderboard}</span>
        </button>

        {/* Notifications */}
        <button
          onClick={() => setActiveTab('notifications')}
          className={`relative flex flex-col items-center justify-center flex-1 py-1 transition-all ${
            activeTab === 'notifications' ? 'text-purple-400' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <div className={`p-1 rounded-xl transition-all relative ${activeTab === 'notifications' ? 'bg-purple-500/15' : ''}`}>
            <Bell className="w-5 h-5" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                {unreadNotificationsCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold mt-0.5">{t.notifications}</span>
        </button>

        {/* Profile */}
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
            activeTab === 'profile' ? 'text-white' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <div className={`p-1 rounded-xl transition-all ${activeTab === 'profile' ? 'bg-white/15' : ''}`}>
            <User className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold mt-0.5">{t.profile}</span>
        </button>

      </div>
    </nav>
  );
};
